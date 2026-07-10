"""CX Command Center – Alumni. Aplicação Streamlit (ponto de entrada)."""
import streamlit as st

from core import auth, db, ui
from core.seed import seed_all
from modules import (admin, cancelamentos, cobranca, consultorias, dashboard,
                     playbooks, recibos, relatorios, retencao, tarefas, voc)

st.set_page_config(page_title="CX Command Center – Alumni",
                   page_icon="🎧", layout="wide")

# Inicializa banco + dados de exemplo (idempotente).
seed_all()
ui.carregar_css()

# Estrutura do menu: chave -> (rótulo, ícone, função render)
MENU = {
    "dashboard": ("Dashboard", "📊", dashboard.render),
    "tarefas": ("Tarefas", "✅", tarefas.render),
    "cancelamentos": ("Cancelamentos", "🚫", cancelamentos.render),
    "cobranca": ("Cobrança", "💸", cobranca.render),
    "retencao": ("Retenção / Churn", "🔁", retencao.render),
    "recibos": ("Recibos & Termos", "🧾", recibos.render),
    "consultorias": ("Consultorias", "📞", consultorias.render),
    "playbooks": ("Playbooks", "📚", playbooks.render),
    "voc": ("Voice of Customer", "🗣️", voc.render),
    "relatorios": ("Relatórios", "📈", relatorios.render),
    "admin": ("Painel Admin", "⚙️", admin.render),
}


def tela_login():
    _, mid, _ = st.columns([1, 1.3, 1])
    with mid:
        st.markdown(
            f"<div style='text-align:center;margin-top:6vh'>"
            f"<div style='font-size:2.4rem;font-weight:800;color:{ui.AZUL_MARINHO}'>"
            f"CX Command Center</div>"
            f"<div style='color:{ui.VERMELHO};font-weight:700;letter-spacing:.15em'>"
            f"ALUMNI BY BETTER</div></div>",
            unsafe_allow_html=True)
        st.write("")
        with st.form("login"):
            email = st.text_input("E-mail", placeholder="voce@betteredu.com.br")
            senha = st.text_input("Senha", type="password")
            entrar = st.form_submit_button("Entrar", type="primary", use_container_width=True)
        if entrar:
            u = auth.autenticar(email, senha)
            if u:
                st.session_state["user"] = dict(u)
                db.log_action(u["email"], "login", "acesso ao sistema")
                st.rerun()
            else:
                st.error("Credenciais inválidas ou usuário inativo.")
        with st.expander("Usuários de demonstração"):
            st.markdown(
                "| Perfil | E-mail | Senha |\n|---|---|---|\n"
                "| Admin | admin@betteredu.com.br | admin123 |\n"
                "| CX | ana.cx@betteredu.com.br | cx123 |\n"
                "| Financeiro | bruno.fin@betteredu.com.br | fin123 |\n"
                "| Coordenação | carla.coord@betteredu.com.br | coord123 |")


def sidebar(user):
    with st.sidebar:
        st.markdown(
            f"<div style='font-size:1.3rem;font-weight:800'>🎧 CX Command Center</div>"
            f"<div style='opacity:.7;font-size:.8rem;margin-bottom:1rem'>Alumni by Better</div>",
            unsafe_allow_html=True)
        st.markdown(f"👤 **{user['nome']}**  \n<span style='opacity:.7;font-size:.8rem'>"
                    f"{user['perfil']}</span>", unsafe_allow_html=True)
        st.divider()
        atual = st.session_state.get("pagina", "dashboard")
        for chave, (rotulo, icone, _) in MENU.items():
            if not auth.pode_acessar(user["perfil"], chave):
                continue
            if st.button(f"{icone}  {rotulo}", key=f"nav_{chave}", use_container_width=True):
                st.session_state["pagina"] = chave
                st.rerun()
        st.divider()
        if st.button("🚪 Sair", use_container_width=True):
            db.log_action(user["email"], "logout", "")
            auth.logout()
            st.session_state.pop("pagina", None)
            st.rerun()


def main():
    if "user" not in st.session_state:
        tela_login()
        return
    user = st.session_state["user"]
    sidebar(user)
    pagina = st.session_state.get("pagina", "dashboard")
    if not auth.pode_acessar(user["perfil"], pagina):
        pagina = "dashboard"
    MENU[pagina][2](user)


if __name__ == "__main__":
    main()
