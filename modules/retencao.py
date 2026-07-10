"""Módulo de Retenção / Churn com score simples e ofertas sugeridas."""
import pandas as pd
import streamlit as st

from core import db, ui
from core.slack import enviar_slack

MOTIVOS = ["financeiro", "tempo", "metodologia", "professor", "plataforma", "horários", "baixo uso"]
NIVEIS = ["baixo", "médio", "alto"]
RESULTADOS = ["Retido", "Cancelou", "Em acompanhamento"]

# peso do motivo para o score de churn
PESO_MOTIVO = {
    "financeiro": 30, "baixo uso": 28, "metodologia": 22, "professor": 20,
    "plataforma": 18, "tempo": 15, "horários": 12,
}
PESO_NIVEL = {"baixo": 10, "médio": 30, "alto": 55}

OFERTAS = {
    "metodologia": "Reavaliação acadêmica",
    "horários": "Ajuste de agenda",
    "tempo": "Ajuste de agenda",
    "baixo uso": "Aulas particulares",
    "financeiro": "Plano de retomada leve",
    "professor": "Mudança de professor",
    "plataforma": "Extensão",
}


def calcular_score(motivo, nivel, historico=0):
    """Score de churn 0–100 = motivo + urgência(nível) + histórico de atendimentos."""
    base = PESO_MOTIVO.get(motivo, 15) + PESO_NIVEL.get(nivel, 30)
    base += min(historico * 3, 15)  # histórico agrava
    return min(base, 100)


def oferta_sugerida(motivo):
    return OFERTAS.get(motivo, "Plano de retomada leve")


def render(user):
    ui.titulo("Retenção / Churn", "Alunos em risco, score de churn e ofertas de retenção")
    tab_lista, tab_novo = st.tabs(["📋 Alunos em risco", "➕ Novo caso"])

    with tab_novo:
        c1, c2 = st.columns(2)
        motivo_prev = c1.selectbox("Motivo de risco", MOTIVOS, key="mot_prev")
        nivel_prev = c2.selectbox("Nível de risco", NIVEIS, index=2, key="niv_prev")
        score_prev = calcular_score(motivo_prev, nivel_prev)
        st.info(f"**Score de churn estimado: {score_prev}/100** · "
                f"Oferta sugerida: **{oferta_sugerida(motivo_prev)}**")
        with st.form("novo_ret", clear_on_submit=True):
            aluno = st.text_input("Nome do aluno *")
            c1, c2 = st.columns(2)
            acao = c1.text_input("Ação sugerida", value=oferta_sugerida(motivo_prev))
            resultado = c2.selectbox("Resultado", RESULTADOS, index=2)
            obs = st.text_area("Observações")
            if st.form_submit_button("Registrar caso", type="primary"):
                if not aluno:
                    st.error("Informe o nome do aluno.")
                else:
                    score = calcular_score(motivo_prev, nivel_prev)
                    db.execute(
                        "INSERT INTO retencao (aluno,motivo,nivel,acao_sugerida,status,resultado,"
                        "observacoes,score,criado_em) VALUES (?,?,?,?,?,?,?,?,?)",
                        (aluno, motivo_prev, nivel_prev, acao, "Em acompanhamento", resultado,
                         obs, score, db.now()))
                    db.log_action(user["email"], "retencao_criada", aluno)
                    if nivel_prev == "alto":
                        enviar_slack(f":warning: *Aluno em risco ALTO de churn* — {aluno} "
                                     f"(score {score}, motivo {motivo_prev}). Oferta: {acao}", "churn_alto")
                        st.warning("Risco alto — alerta enviado ao Slack.")
                    st.success("Caso registrado.")

    with tab_lista:
        c1, c2, c3 = st.columns(3)
        f_nivel = c1.multiselect("Nível", NIVEIS)
        f_result = c2.multiselect("Resultado", RESULTADOS)
        f_busca = c3.text_input("Buscar aluno")
        rows = db.query("SELECT * FROM retencao ORDER BY score DESC")
        data = []
        for r in rows:
            if f_nivel and r["nivel"] not in f_nivel:
                continue
            if f_result and r["resultado"] not in f_result:
                continue
            if f_busca and f_busca.lower() not in (r["aluno"] or "").lower():
                continue
            data.append({
                "ID": r["id"], "Aluno": r["aluno"], "Motivo": r["motivo"],
                "Nível": r["nivel"], "Score": r["score"], "Ação sugerida": r["acao_sugerida"],
                "Resultado": r["resultado"],
            })
        df = pd.DataFrame(data)
        st.caption(f"{len(df)} caso(s)")
        if not df.empty:
            st.dataframe(df, use_container_width=True, hide_index=True,
                         column_config={"Score": st.column_config.ProgressColumn(
                             "Score churn", min_value=0, max_value=100, format="%d")})
            ui.botoes_export(df, "retencao")

        st.divider()
        st.markdown("##### ✏️ Atualizar caso")
        ids = [r["id"] for r in rows]
        if ids:
            sel = st.selectbox("Selecione", ids,
                               format_func=lambda i: next(r["aluno"] for r in rows if r["id"] == i))
            r = db.query_one("SELECT * FROM retencao WHERE id=?", (sel,))
            with st.form("edit_ret"):
                c1, c2 = st.columns(2)
                motivo = c1.selectbox("Motivo", MOTIVOS,
                                      index=MOTIVOS.index(r["motivo"]) if r["motivo"] in MOTIVOS else 0)
                nivel = c2.selectbox("Nível", NIVEIS,
                                     index=NIVEIS.index(r["nivel"]) if r["nivel"] in NIVEIS else 0)
                c1, c2 = st.columns(2)
                acao = c1.text_input("Ação sugerida", r["acao_sugerida"] or "")
                resultado = c2.selectbox("Resultado", RESULTADOS,
                                         index=RESULTADOS.index(r["resultado"]) if r["resultado"] in RESULTADOS else 2)
                obs = st.text_area("Observações", r["observacoes"] or "")
                if st.form_submit_button("Salvar", type="primary"):
                    score = calcular_score(motivo, nivel)
                    db.execute("UPDATE retencao SET motivo=?,nivel=?,acao_sugerida=?,resultado=?,observacoes=?,score=? WHERE id=?",
                               (motivo, nivel, acao, resultado, obs, score, sel))
                    db.log_action(user["email"], "retencao_editada", f"#{sel} {r['aluno']}")
                    st.success(f"Atualizado. Novo score: {score}/100")
                    st.rerun()
