"""Módulo de Consultorias (Private, Black, Retenção)."""
import pandas as pd
import streamlit as st

from core import db, ui
from core.slack import enviar_slack

TIPOS = ["Private", "Black", "Retenção"]
STATUS = ["Solicitada", "Aprovada", "Agendada", "Realizada", "Cancelada"]


def render(user):
    ui.titulo("Consultorias", "Controle de consultorias Private, Black e Retenção")
    tab_lista, tab_nova = st.tabs(["📋 Consultorias", "➕ Nova consultoria"])

    with tab_nova:
        with st.form("nova_cons", clear_on_submit=True):
            c1, c2, c3 = st.columns(3)
            aluno = c1.text_input("Nome do aluno *")
            tipo = c2.selectbox("Tipo", TIPOS)
            solicitante = c3.text_input("Solicitante", value=user["nome"])
            c1, c2, c3 = st.columns(3)
            data_sol = c1.date_input("Data solicitada")
            data_ag = c2.date_input("Data agendada")
            responsavel = c3.text_input("Responsável interno")
            c1, c2 = st.columns(2)
            status = c1.selectbox("Status", STATUS)
            zoom = c2.text_input("Link Zoom")
            obs = st.text_area("Observações")
            if st.form_submit_button("Criar consultoria", type="primary"):
                if not aluno:
                    st.error("Informe o nome do aluno.")
                else:
                    db.execute(
                        "INSERT INTO consultorias (aluno,tipo,solicitante,data_solicitada,"
                        "data_agendada,responsavel,status,link_zoom,observacoes,criado_em)"
                        " VALUES (?,?,?,?,?,?,?,?,?,?)",
                        (aluno, tipo, solicitante, str(data_sol), str(data_ag), responsavel,
                         status, zoom, obs, db.now()))
                    db.log_action(user["email"], "consultoria_criada", f"{tipo} · {aluno}")
                    enviar_slack(f":telephone_receiver: *Nova consultoria {tipo}* — {aluno} "
                                 f"(solicitante {solicitante}, resp. {responsavel})", "consultoria_nova")
                    st.success("Consultoria criada — alerta enviado ao Slack.")

    with tab_lista:
        c1, c2, c3 = st.columns(3)
        f_tipo = c1.multiselect("Tipo", TIPOS)
        f_status = c2.multiselect("Status", STATUS)
        f_busca = c3.text_input("Buscar aluno")
        rows = db.query("SELECT * FROM consultorias ORDER BY data_agendada DESC")
        data = []
        for r in rows:
            if f_tipo and r["tipo"] not in f_tipo:
                continue
            if f_status and r["status"] not in f_status:
                continue
            if f_busca and f_busca.lower() not in (r["aluno"] or "").lower():
                continue
            data.append({
                "ID": r["id"], "Aluno": r["aluno"], "Tipo": r["tipo"],
                "Solicitante": r["solicitante"], "Agendada": r["data_agendada"],
                "Responsável": r["responsavel"], "Status": r["status"], "Zoom": r["link_zoom"],
            })
        df = pd.DataFrame(data)
        st.caption(f"{len(df)} consultoria(s)")
        if not df.empty:
            st.dataframe(df, use_container_width=True, hide_index=True)
            ui.botoes_export(df, "consultorias")

        # Relatório por mês
        st.markdown("##### 📅 Consultorias por mês")
        rel = db.query(
            "SELECT substr(data_agendada,1,7) AS mes, COUNT(*) AS total FROM consultorias "
            "WHERE data_agendada!='' GROUP BY mes ORDER BY mes DESC")
        if rel:
            st.dataframe(pd.DataFrame([dict(r) for r in rel]), use_container_width=True, hide_index=True)

        st.divider()
        st.markdown("##### ✏️ Atualizar status")
        ids = [r["id"] for r in rows]
        if ids:
            sel = st.selectbox("Selecione", ids,
                               format_func=lambda i: next(f"#{r['id']} · {r['aluno']} ({r['tipo']})"
                                                          for r in rows if r["id"] == i))
            r = db.query_one("SELECT * FROM consultorias WHERE id=?", (sel,))
            with st.form("edit_cons"):
                c1, c2 = st.columns(2)
                status = c1.selectbox("Status", STATUS,
                                      index=STATUS.index(r["status"]) if r["status"] in STATUS else 0)
                zoom = c2.text_input("Link Zoom", r["link_zoom"] or "")
                obs = st.text_area("Observações", r["observacoes"] or "")
                if st.form_submit_button("Salvar", type="primary"):
                    db.execute("UPDATE consultorias SET status=?,link_zoom=?,observacoes=? WHERE id=?",
                               (status, zoom, obs, sel))
                    db.log_action(user["email"], "consultoria_editada", f"#{sel} {r['aluno']}")
                    st.success("Atualizado.")
                    st.rerun()
