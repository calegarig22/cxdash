"""Voice of Customer: registro e dashboard de feedbacks dos alunos."""
import pandas as pd
import streamlit as st

from core import db, ui
from core.slack import enviar_slack

CATEGORIAS = ["Plataforma", "Professor", "Horário", "Metodologia", "Comercial", "Financeiro", "Atendimento"]
TIPOS = ["elogio", "reclamação", "sugestão"]
GRAVIDADES = ["Baixa", "Média", "Alta", "Crítica"]
STATUS = ["Aberto", "Em tratativa", "Resolvido"]
AREAS = ["Produto", "Acadêmico", "Comercial", "Financeiro", "CX", "Diretoria"]


def render(user):
    ui.titulo("Voice of Customer", "Feedbacks dos alunos: elogios, reclamações e sugestões")
    tab_dash, tab_lista, tab_novo = st.tabs(["📊 Dashboard", "📋 Feedbacks", "➕ Novo feedback"])

    with tab_novo:
        with st.form("novo_voc", clear_on_submit=True):
            c1, c2, c3 = st.columns(3)
            aluno = c1.text_input("Nome do aluno")
            categoria = c2.selectbox("Categoria", CATEGORIAS)
            tipo = c3.selectbox("Tipo", TIPOS, index=1)
            c1, c2, c3 = st.columns(3)
            gravidade = c1.selectbox("Gravidade", GRAVIDADES, index=1)
            area = c2.selectbox("Área responsável", AREAS)
            status = c3.selectbox("Status", STATUS)
            descricao = st.text_area("Descrição *")
            acao = st.text_input("Ação tomada")
            if st.form_submit_button("Registrar feedback", type="primary"):
                if not descricao:
                    st.error("Descreva o feedback.")
                else:
                    db.execute(
                        "INSERT INTO voc (aluno,categoria,tipo,gravidade,descricao,area,status,acao,criado_em)"
                        " VALUES (?,?,?,?,?,?,?,?,?)",
                        (aluno, categoria, tipo, gravidade, descricao, area, status, acao, db.now()))
                    db.log_action(user["email"], "voc_criado", f"{categoria}/{tipo}")
                    if gravidade == "Crítica":
                        enviar_slack(f":loudspeaker: *Feedback CRÍTICO* — {categoria}/{tipo} "
                                     f"(aluno {aluno or 'N/I'}, área {area}): {descricao[:140]}", "voc_critico")
                        st.warning("Feedback crítico — alerta enviado ao Slack.")
                    st.success("Feedback registrado.")

    with tab_lista:
        c1, c2, c3 = st.columns(3)
        f_cat = c1.multiselect("Categoria", CATEGORIAS)
        f_tipo = c2.multiselect("Tipo", TIPOS)
        f_status = c3.multiselect("Status", STATUS)
        rows = db.query("SELECT * FROM voc ORDER BY id DESC")
        data = []
        for r in rows:
            if f_cat and r["categoria"] not in f_cat:
                continue
            if f_tipo and r["tipo"] not in f_tipo:
                continue
            if f_status and r["status"] not in f_status:
                continue
            data.append({
                "ID": r["id"], "Aluno": r["aluno"], "Categoria": r["categoria"],
                "Tipo": r["tipo"], "Gravidade": r["gravidade"], "Descrição": r["descricao"],
                "Área": r["area"], "Status": r["status"], "Ação": r["acao"],
            })
        df = pd.DataFrame(data)
        st.caption(f"{len(df)} feedback(s)")
        if not df.empty:
            st.dataframe(df, use_container_width=True, hide_index=True)
            ui.botoes_export(df, "voice_of_customer")

        st.divider()
        st.markdown("##### ✏️ Atualizar feedback")
        ids = [r["id"] for r in rows]
        if ids:
            sel = st.selectbox("Selecione", ids,
                               format_func=lambda i: next(f"#{r['id']} · {r['categoria']}/{r['tipo']}"
                                                          for r in rows if r["id"] == i))
            r = db.query_one("SELECT * FROM voc WHERE id=?", (sel,))
            with st.form("edit_voc"):
                c1, c2 = st.columns(2)
                status = c1.selectbox("Status", STATUS,
                                      index=STATUS.index(r["status"]) if r["status"] in STATUS else 0)
                area = c2.selectbox("Área responsável", AREAS,
                                    index=AREAS.index(r["area"]) if r["area"] in AREAS else 0)
                acao = st.text_input("Ação tomada", r["acao"] or "")
                if st.form_submit_button("Salvar", type="primary"):
                    db.execute("UPDATE voc SET status=?,area=?,acao=? WHERE id=?", (status, area, acao, sel))
                    db.log_action(user["email"], "voc_editado", f"#{sel}")
                    st.success("Atualizado.")
                    st.rerun()

    with tab_dash:
        rows = db.query("SELECT * FROM voc")
        if not rows:
            st.info("Sem feedbacks registrados ainda.")
            return
        df = pd.DataFrame([dict(r) for r in rows])
        recl = df[df["tipo"] == "reclamação"]

        c1, c2, c3 = st.columns(3)
        ui.card(c1, "Total de feedbacks", len(df))
        ui.card(c2, "Reclamações", len(recl), tipo="warn")
        crit = len(df[df["gravidade"] == "Crítica"])
        ui.card(c3, "Feedbacks críticos", crit, tipo="alert" if crit else "ok")

        st.write("")
        col_a, col_b = st.columns(2)
        with col_a:
            st.markdown("**Top 5 motivos de reclamação (por categoria)**")
            if not recl.empty:
                top = recl["categoria"].value_counts().head(5)
                st.bar_chart(top)
            else:
                st.caption("Sem reclamações.")
        with col_b:
            st.markdown("**Reclamações por área responsável**")
            if not recl.empty:
                st.bar_chart(recl["area"].value_counts())
            else:
                st.caption("Sem reclamações.")

        st.markdown("**🚨 Feedbacks críticos**")
        for r in db.query("SELECT * FROM voc WHERE gravidade='Crítica' ORDER BY id DESC"):
            st.markdown(f"- {ui.badge(r['tipo'])} **{r['categoria']}** ({r['area']}): "
                        f"{r['descricao']} — {ui.badge(r['status'])}", unsafe_allow_html=True)

        st.markdown("**💡 Sugestões recorrentes**")
        sug = df[df["tipo"] == "sugestão"]
        if not sug.empty:
            for cat, n in sug["categoria"].value_counts().items():
                st.markdown(f"- **{cat}**: {n} sugestão(ões)")
        else:
            st.caption("Sem sugestões registradas.")
