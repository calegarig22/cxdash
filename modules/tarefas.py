"""Gestão de Tarefas do CX."""
import pandas as pd
import streamlit as st

from core import db, ui
from core.slack import enviar_slack

TIPOS = ["Atendimento", "Cobrança", "Cancelamento", "Reembolso", "Retenção",
         "Acadêmico", "Financeiro", "Produto", "Reclame Aqui"]
PRIORIDADES = ["Baixa", "Média", "Alta", "Crítica"]
STATUS = ["Aberta", "Em andamento", "Aguardando outra área", "Concluída", "Cancelada"]


def _hist(tarefa_id, usuario, texto):
    db.execute("INSERT INTO tarefa_historico (tarefa_id,ts,usuario,texto) VALUES (?,?,?,?)",
               (tarefa_id, db.now(), usuario, texto))


def render(user):
    ui.titulo("Gestão de Tarefas do CX", "Cadastre, acompanhe e atualize as tarefas da equipe")
    tab_lista, tab_nova = st.tabs(["📋 Tarefas", "➕ Nova tarefa"])

    with tab_nova:
        with st.form("nova_tarefa", clear_on_submit=True):
            c1, c2 = st.columns(2)
            titulo = c1.text_input("Título da tarefa *")
            tipo = c2.selectbox("Tipo", TIPOS)
            c1, c2, c3 = st.columns(3)
            responsavel = c1.text_input("Responsável", value=user["nome"])
            prioridade = c2.selectbox("Prioridade", PRIORIDADES, index=1)
            status = c3.selectbox("Status", STATUS)
            c1, c2 = st.columns(2)
            prazo = c1.date_input("Prazo")
            obs = st.text_area("Observações")
            if st.form_submit_button("Criar tarefa", type="primary"):
                if not titulo:
                    st.error("Informe o título da tarefa.")
                else:
                    tid = db.execute(
                        "INSERT INTO tarefas (titulo,tipo,responsavel,prioridade,status,prazo,"
                        "observacoes,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?)",
                        (titulo, tipo, responsavel, prioridade, status, str(prazo), obs,
                         db.now(), db.now()))
                    _hist(tid, user["nome"], f"Tarefa criada (status '{status}').")
                    db.log_action(user["email"], "tarefa_criada", titulo)
                    if prioridade == "Crítica":
                        enviar_slack(
                            f":rotating_light: *Tarefa CRÍTICA criada* — {titulo}\n"
                            f"Tipo: {tipo} · Responsável: {responsavel} · Prazo: {prazo}",
                            "tarefa_critica")
                        st.warning("Tarefa crítica — alerta enviado ao Slack.")
                    st.success("Tarefa criada com sucesso!")

    with tab_lista:
        c1, c2, c3 = st.columns(3)
        f_status = c1.multiselect("Status", STATUS, default=[s for s in STATUS if s not in ("Concluída", "Cancelada")])
        f_prio = c2.multiselect("Prioridade", PRIORIDADES)
        f_resp = c3.text_input("Responsável contém")

        rows = db.query("SELECT * FROM tarefas ORDER BY prazo")
        data = []
        for r in rows:
            if f_status and r["status"] not in f_status:
                continue
            if f_prio and r["prioridade"] not in f_prio:
                continue
            if f_resp and f_resp.lower() not in (r["responsavel"] or "").lower():
                continue
            dias = ui.dias_para(r["prazo"])
            vencida = dias is not None and dias < 0 and r["status"] not in ("Concluída", "Cancelada")
            data.append({
                "ID": r["id"], "Título": r["titulo"], "Tipo": r["tipo"],
                "Responsável": r["responsavel"], "Prioridade": r["prioridade"],
                "Status": r["status"], "Prazo": r["prazo"],
                "Situação": "🔴 VENCIDA" if vencida else ("Hoje" if dias == 0 else f"{dias}d"),
            })
        df = pd.DataFrame(data)
        st.caption(f"{len(df)} tarefa(s)")
        if not df.empty:
            def _cor(row):
                if "VENCIDA" in str(row["Situação"]):
                    return ["background-color:#fee2e2"] * len(row)
                return [""] * len(row)
            st.dataframe(df.style.apply(_cor, axis=1), use_container_width=True, hide_index=True)
            ui.botoes_export(df, "tarefas")
        else:
            st.info("Nenhuma tarefa encontrada com os filtros atuais.")

        st.divider()
        st.markdown("##### ✏️ Editar / atualizar tarefa")
        ids = [r["id"] for r in rows]
        if ids:
            sel = st.selectbox("Selecione a tarefa",
                               ids, format_func=lambda i: f"#{i} · " + next(r["titulo"] for r in rows if r["id"] == i))
            t = db.query_one("SELECT * FROM tarefas WHERE id=?", (sel,))
            with st.form("edit_tarefa"):
                c1, c2 = st.columns(2)
                titulo = c1.text_input("Título", t["titulo"])
                tipo = c2.selectbox("Tipo", TIPOS, index=TIPOS.index(t["tipo"]) if t["tipo"] in TIPOS else 0)
                c1, c2, c3 = st.columns(3)
                responsavel = c1.text_input("Responsável", t["responsavel"] or "")
                prioridade = c2.selectbox("Prioridade", PRIORIDADES,
                                          index=PRIORIDADES.index(t["prioridade"]) if t["prioridade"] in PRIORIDADES else 1)
                status = c3.selectbox("Status", STATUS,
                                      index=STATUS.index(t["status"]) if t["status"] in STATUS else 0)
                prazo = c1.date_input("Prazo", ui.parse_date(t["prazo"]) or None)
                obs = st.text_area("Observações", t["observacoes"] or "")
                nota = st.text_input("Nota para o histórico (o que mudou?)")
                salvar = st.form_submit_button("Salvar alterações", type="primary")
            if salvar:
                mudancas = []
                if status != t["status"]:
                    mudancas.append(f"status '{t['status']}'→'{status}'")
                if prioridade != t["prioridade"]:
                    mudancas.append(f"prioridade '{t['prioridade']}'→'{prioridade}'")
                if responsavel != t["responsavel"]:
                    mudancas.append(f"responsável '{t['responsavel']}'→'{responsavel}'")
                db.execute(
                    "UPDATE tarefas SET titulo=?,tipo=?,responsavel=?,prioridade=?,status=?,"
                    "prazo=?,observacoes=?,atualizado_em=? WHERE id=?",
                    (titulo, tipo, responsavel, prioridade, status, str(prazo), obs, db.now(), sel))
                texto = (nota + " | " if nota else "") + ("; ".join(mudancas) if mudancas else "Atualização de dados.")
                _hist(sel, user["nome"], texto)
                db.log_action(user["email"], "tarefa_editada", f"#{sel} {titulo}")
                if prioridade == "Crítica" and t["prioridade"] != "Crítica":
                    enviar_slack(f":rotating_light: *Tarefa elevada a CRÍTICA* — {titulo}", "tarefa_critica")
                st.success("Tarefa atualizada.")
                st.rerun()

            st.markdown("**Histórico de atualizações**")
            for h in db.query("SELECT * FROM tarefa_historico WHERE tarefa_id=? ORDER BY id DESC", (sel,)):
                st.markdown(f"- `{h['ts']}` **{h['usuario']}**: {h['texto']}")
