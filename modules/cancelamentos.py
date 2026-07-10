"""Módulo de Cancelamentos."""
import pandas as pd
import streamlit as st

from core import db, ui
from core.slack import enviar_slack

STATUS = ["Recebido", "Em análise", "Aguardando diretoria", "Aguardando financeiro", "Finalizado"]
PRAZO_LIMITE = 30
ALERTA_DIAS = 20


def _hist(cid, usuario, texto):
    db.execute("INSERT INTO cancelamento_historico (cancelamento_id,ts,usuario,texto) VALUES (?,?,?,?)",
               (cid, db.now(), usuario, texto))


def render(user):
    ui.titulo("Módulo de Cancelamentos", "Controle completo do fluxo de cancelamento (prazo legal de 30 dias)")
    tab_lista, tab_novo = st.tabs(["📋 Cancelamentos", "➕ Novo cancelamento"])

    with tab_novo:
        with st.form("novo_cancel", clear_on_submit=True):
            c1, c2, c3 = st.columns(3)
            aluno = c1.text_input("Nome do aluno *")
            email = c2.text_input("E-mail")
            tel = c3.text_input("Telefone")
            c1, c2 = st.columns(2)
            data_sol = c1.date_input("Data da solicitação")
            status = c2.selectbox("Status", STATUS)
            motivo = st.text_area("Motivo do cancelamento")
            c1, c2, c3 = st.columns(3)
            multa = c1.number_input("Valor de multa (R$)", 0.0, step=50.0)
            material = c2.number_input("Valor de material (R$)", 0.0, step=50.0)
            reembolso = c3.number_input("Valor de reembolso (R$)", 0.0, step=50.0)
            anexos = st.text_input("Anexos / links de documentos")
            obs = st.text_area("Observações")
            if st.form_submit_button("Registrar cancelamento", type="primary"):
                if not aluno:
                    st.error("Informe o nome do aluno.")
                else:
                    cid = db.execute(
                        "INSERT INTO cancelamentos (aluno,email,telefone,data_solicitacao,motivo,"
                        "status,valor_multa,valor_material,valor_reembolso,observacoes,anexos,criado_em)"
                        " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                        (aluno, email, tel, str(data_sol), motivo, status, multa, material,
                         reembolso, obs, anexos, db.now()))
                    _hist(cid, user["nome"], f"Solicitação registrada (status '{status}').")
                    db.log_action(user["email"], "cancelamento_criado", aluno)
                    st.success("Cancelamento registrado.")

    with tab_lista:
        c1, c2 = st.columns([2, 3])
        f_status = c1.multiselect("Status", STATUS)
        f_busca = c2.text_input("Buscar aluno")
        rows = db.query("SELECT * FROM cancelamentos ORDER BY data_solicitacao")

        data, alertas = [], []
        for r in rows:
            if f_status and r["status"] not in f_status:
                continue
            if f_busca and f_busca.lower() not in (r["aluno"] or "").lower():
                continue
            dias = ui.dias_desde(r["data_solicitacao"]) or 0
            restante = PRAZO_LIMITE - dias
            if r["status"] != "Finalizado" and dias >= ALERTA_DIAS:
                alertas.append((r, dias))
            data.append({
                "ID": r["id"], "Aluno": r["aluno"], "Status": r["status"],
                "Solicitado em": r["data_solicitacao"], "Dias corridos": dias,
                "Prazo restante": f"{restante}d" if r["status"] != "Finalizado" else "—",
                "Multa": r["valor_multa"], "Material": r["valor_material"],
                "Reembolso": r["valor_reembolso"],
            })

        if alertas:
            for r, dias in alertas:
                st.warning(f"⏰ **{r['aluno']}** está há **{dias} dias** em aberto "
                           f"(prazo limite {PRAZO_LIMITE}d). Status: {r['status']}.")

        df = pd.DataFrame(data)
        st.caption(f"{len(df)} cancelamento(s)")
        if not df.empty:
            st.dataframe(df, use_container_width=True, hide_index=True)
            ui.botoes_export(df, "cancelamentos")

        if alertas and st.button("📨 Enviar alertas ao Slack (>20 dias)"):
            for r, dias in alertas:
                enviar_slack(
                    f":hourglass_flowing_sand: *Cancelamento >20 dias* — {r['aluno']} "
                    f"({dias}d) · status {r['status']}", "cancelamento_20d")
            st.success(f"{len(alertas)} alerta(s) enviados ao Slack.")

        st.divider()
        st.markdown("##### ✏️ Atualizar cancelamento")
        ids = [r["id"] for r in rows]
        if ids:
            sel = st.selectbox("Selecione", ids,
                               format_func=lambda i: f"#{i} · " + next(r["aluno"] for r in rows if r["id"] == i))
            c = db.query_one("SELECT * FROM cancelamentos WHERE id=?", (sel,))
            with st.form("edit_cancel"):
                c1, c2, c3 = st.columns(3)
                status = c1.selectbox("Status", STATUS,
                                      index=STATUS.index(c["status"]) if c["status"] in STATUS else 0)
                multa = c2.number_input("Multa (R$)", 0.0, value=float(c["valor_multa"] or 0), step=50.0)
                reembolso = c3.number_input("Reembolso (R$)", 0.0, value=float(c["valor_reembolso"] or 0), step=50.0)
                obs = st.text_area("Observações", c["observacoes"] or "")
                nota = st.text_input("Nota para o histórico")
                salvar = st.form_submit_button("Salvar", type="primary")
            if salvar:
                mud = f"status '{c['status']}'→'{status}'" if status != c["status"] else "atualização"
                db.execute("UPDATE cancelamentos SET status=?,valor_multa=?,valor_reembolso=?,observacoes=? WHERE id=?",
                           (status, multa, reembolso, obs, sel))
                _hist(sel, user["nome"], (nota + " | " if nota else "") + mud)
                db.log_action(user["email"], "cancelamento_editado", f"#{sel} {c['aluno']}")
                st.success("Atualizado.")
                st.rerun()
            st.markdown("**Histórico do processo**")
            for h in db.query("SELECT * FROM cancelamento_historico WHERE cancelamento_id=? ORDER BY id DESC", (sel,)):
                st.markdown(f"- `{h['ts']}` **{h['usuario']}**: {h['texto']}")
