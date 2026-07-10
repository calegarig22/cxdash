"""Módulo de Cobrança e Inadimplência com régua automática."""
import pandas as pd
import streamlit as st

from core import db, ui
from core.slack import enviar_slack

STATUS = ["1º contato", "2º contato", "3º contato", "Pré-negativação", "Regularizado"]
REGUA = [7, 14, 21, 28, 60]


def estagio_regua(dias):
    """Retorna o marco da régua (7/14/21/28/60) apropriado para os dias de atraso."""
    marco = 0
    for d in REGUA:
        if dias >= d:
            marco = d
    return marco


def mensagem_sugerida(nome, dias, valor):
    marco = estagio_regua(dias)
    valor_fmt = f"R$ {valor:.2f}"
    if marco == 0:
        return (f"Olá {nome}! Passando para lembrar da mensalidade de {valor_fmt}. "
                "Qualquer coisa estamos à disposição para ajudar. 💙")
    if marco == 7:
        return (f"Olá {nome}! Identificamos a mensalidade de {valor_fmt} em aberto há {dias} dias. "
                "Conseguimos regularizar hoje? Posso te enviar a 2ª via.")
    if marco == 14:
        return (f"Oi {nome}, tudo bem? Sua pendência de {valor_fmt} está há {dias} dias em aberto. "
                "Podemos combinar uma data para o pagamento? Estou aqui para facilitar.")
    if marco == 21:
        return (f"{nome}, seu débito de {valor_fmt} ({dias} dias) segue em aberto. "
                "Para evitar bloqueios de acesso, vamos resolver juntos? Temos opções de negociação.")
    if marco == 28:
        return (f"{nome}, atenção: sua mensalidade de {valor_fmt} está há {dias} dias vencida. "
                "Precisamos regularizar esta semana para manter sua matrícula ativa.")
    return (f"{nome}, seu débito de {valor_fmt} ultrapassou {dias} dias. Para evitar a "
            "negativação, é essencial regularizar. Vamos negociar condições especiais o quanto antes.")


def render(user):
    ui.titulo("Cobrança e Inadimplência", "Régua de contato 7 · 14 · 21 · 28 · 60 dias e mensagens prontas")
    tab_lista, tab_novo = st.tabs(["📋 Inadimplentes", "➕ Novo registro"])

    with tab_novo:
        with st.form("nova_cobr", clear_on_submit=True):
            c1, c2, c3 = st.columns(3)
            aluno = c1.text_input("Nome do aluno *")
            valor = c2.number_input("Valor em aberto (R$)", 0.0, step=50.0)
            venc = c3.date_input("Data de vencimento")
            c1, c2 = st.columns(2)
            status = c1.selectbox("Status", STATUS)
            resp = c2.text_input("Responsável", value=user["nome"])
            proxima = st.text_input("Próxima ação")
            obs = st.text_area("Observações")
            if st.form_submit_button("Registrar", type="primary"):
                if not aluno:
                    st.error("Informe o nome do aluno.")
                else:
                    db.execute(
                        "INSERT INTO cobrancas (aluno,valor,vencimento,status,ultima_mensagem,"
                        "proxima_acao,responsavel,observacoes,criado_em) VALUES (?,?,?,?,?,?,?,?,?)",
                        (aluno, valor, str(venc), status, "", proxima, resp, obs, db.now()))
                    db.log_action(user["email"], "cobranca_criada", aluno)
                    st.success("Registro criado.")

    with tab_lista:
        c1, c2 = st.columns([2, 3])
        f_status = c1.multiselect("Status", STATUS)
        f_busca = c2.text_input("Buscar aluno")
        rows = db.query("SELECT * FROM cobrancas ORDER BY vencimento")

        data, criticos = [], []
        for r in rows:
            if f_status and r["status"] not in f_status:
                continue
            if f_busca and f_busca.lower() not in (r["aluno"] or "").lower():
                continue
            dias = ui.dias_desde(r["vencimento"]) or 0
            if r["status"] != "Regularizado" and dias >= 60:
                criticos.append((r, dias))
            data.append({
                "ID": r["id"], "Aluno": r["aluno"], "Valor": r["valor"],
                "Vencimento": r["vencimento"], "Dias atraso": dias,
                "Régua": f"{estagio_regua(dias)}d" if dias > 0 else "—",
                "Status": r["status"], "Responsável": r["responsavel"],
            })

        if criticos:
            for r, dias in criticos:
                st.error(f"🚨 **{r['aluno']}** está há **{dias} dias** em atraso (R$ {r['valor']:.2f}).")

        df = pd.DataFrame(data)
        st.caption(f"{len(df)} registro(s)")
        if not df.empty:
            st.dataframe(df, use_container_width=True, hide_index=True)
            ui.botoes_export(df, "cobrancas")

        if criticos and st.button("📨 Enviar alertas ao Slack (>60 dias)"):
            for r, dias in criticos:
                enviar_slack(f":money_with_wings: *Inadimplência >60 dias* — {r['aluno']} "
                             f"({dias}d, R$ {r['valor']:.2f}) · {r['status']}", "cobranca_60d")
            st.success(f"{len(criticos)} alerta(s) enviados.")

        st.divider()
        st.markdown("##### 💬 Régua & mensagem sugerida")
        ids = [r["id"] for r in rows]
        if ids:
            sel = st.selectbox("Selecione o aluno", ids,
                               format_func=lambda i: next(r["aluno"] for r in rows if r["id"] == i))
            r = db.query_one("SELECT * FROM cobrancas WHERE id=?", (sel,))
            dias = ui.dias_desde(r["vencimento"]) or 0
            msg = mensagem_sugerida(r["aluno"], dias, float(r["valor"] or 0))
            st.info(f"Estágio da régua: **{estagio_regua(dias)} dias** · atraso real: {dias} dias")
            st.text_area("Mensagem pronta (copie e envie)", msg, height=120, key="msg_cobr")
            st.caption("Selecione o texto acima e copie (Ctrl/Cmd+C).")

            with st.form("edit_cobr"):
                c1, c2 = st.columns(2)
                status = c1.selectbox("Atualizar status", STATUS,
                                      index=STATUS.index(r["status"]) if r["status"] in STATUS else 0)
                proxima = c2.text_input("Próxima ação", r["proxima_acao"] or "")
                marcar = st.checkbox("Registrar esta mensagem como 'última enviada'")
                if st.form_submit_button("Salvar", type="primary"):
                    db.execute("UPDATE cobrancas SET status=?,proxima_acao=?,ultima_mensagem=? WHERE id=?",
                               (status, proxima, msg if marcar else r["ultima_mensagem"], sel))
                    db.log_action(user["email"], "cobranca_editada", f"#{sel} {r['aluno']}")
                    st.success("Atualizado.")
                    st.rerun()
            if r["ultima_mensagem"]:
                st.caption(f"Última mensagem registrada: {r['ultima_mensagem'][:120]}…")
