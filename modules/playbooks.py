"""Base de Conhecimento / Playbooks: scripts e respostas prontas."""
import streamlit as st

from core import db, ui

CATEGORIAS = ["Cobrança", "Cancelamento", "Retenção", "Aluno agressivo",
              "Problemas com plataforma", "Problemas com professor", "Reembolso",
              "Reclame Aqui", "Dúvidas sobre contrato"]


def render(user):
    ui.titulo("Base de Conhecimento / Playbooks", "Scripts e respostas prontas para agilizar o atendimento")
    tab_buscar, tab_novo = st.tabs(["🔎 Consultar", "➕ Nova resposta"])

    with tab_novo:
        with st.form("novo_pb", clear_on_submit=True):
            c1, c2 = st.columns([2, 3])
            categoria = c1.selectbox("Categoria", CATEGORIAS)
            titulo = c2.text_input("Título *")
            conteudo = st.text_area("Conteúdo da resposta *", height=140,
                                    help="Use {nome}, {valor}, {data} como campos a substituir.")
            if st.form_submit_button("Cadastrar", type="primary"):
                if not titulo or not conteudo:
                    st.error("Preencha título e conteúdo.")
                else:
                    db.execute("INSERT INTO playbooks (categoria,titulo,conteudo,favorito,criado_em) VALUES (?,?,?,0,?)",
                               (categoria, titulo, conteudo, db.now()))
                    db.log_action(user["email"], "playbook_criado", titulo)
                    st.success("Resposta cadastrada.")

    with tab_buscar:
        c1, c2, c3 = st.columns([2, 3, 1])
        f_cat = c1.multiselect("Categoria", CATEGORIAS)
        busca = c2.text_input("Buscar por palavra-chave")
        so_fav = c3.checkbox("★ Favoritas")
        rows = db.query("SELECT * FROM playbooks ORDER BY favorito DESC, categoria, titulo")
        vistos = 0
        for r in rows:
            if f_cat and r["categoria"] not in f_cat:
                continue
            if so_fav and not r["favorito"]:
                continue
            if busca and busca.lower() not in (r["titulo"] + " " + r["conteudo"] + " " + r["categoria"]).lower():
                continue
            vistos += 1
            star = "★" if r["favorito"] else "☆"
            with st.expander(f"{star} [{r['categoria']}] {r['titulo']}"):
                st.text_area("Resposta", r["conteudo"], height=120, key=f"pb_{r['id']}",
                             label_visibility="collapsed")
                c1, c2, _ = st.columns([1, 1, 4])
                if c1.button(("☆ Desfavoritar" if r["favorito"] else "★ Favoritar"), key=f"fav_{r['id']}"):
                    db.execute("UPDATE playbooks SET favorito=? WHERE id=?", (0 if r["favorito"] else 1, r["id"]))
                    st.rerun()
                if c2.button("🗑️ Excluir", key=f"del_{r['id']}"):
                    db.execute("DELETE FROM playbooks WHERE id=?", (r["id"],))
                    db.log_action(user["email"], "playbook_excluido", r["titulo"])
                    st.rerun()
        if vistos == 0:
            st.info("Nenhuma resposta encontrada.")
        else:
            st.caption(f"{vistos} resposta(s). Selecione o texto e copie (Ctrl/Cmd+C).")
