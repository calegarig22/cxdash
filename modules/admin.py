"""Painel Admin: usuários, webhook Slack, backup e logs."""
import os
import shutil

import pandas as pd
import streamlit as st

from core import db, ui
from core.auth import PERFIS, hash_senha
from core.slack import enviar_slack


def render(user):
    if user["perfil"] != "Admin":
        st.error("Acesso restrito ao perfil Admin.")
        return
    ui.titulo("Painel Admin", "Usuários, integrações, backup e logs de auditoria")
    tabs = st.tabs(["👥 Usuários", "🔗 Slack", "💾 Backup", "📜 Logs"])

    # ---- Usuários ----
    with tabs[0]:
        st.markdown("##### Criar usuário")
        with st.form("novo_user", clear_on_submit=True):
            c1, c2 = st.columns(2)
            nome = c1.text_input("Nome *")
            email = c2.text_input("E-mail *")
            c1, c2, c3 = st.columns(3)
            senha = c1.text_input("Senha *", type="password")
            perfil = c2.selectbox("Perfil", PERFIS)
            ativo = c3.checkbox("Ativo", value=True)
            if st.form_submit_button("Criar usuário", type="primary"):
                if not (nome and email and senha):
                    st.error("Preencha nome, e-mail e senha.")
                elif db.query_one("SELECT 1 FROM users WHERE email=?", (email.lower(),)):
                    st.error("Já existe um usuário com esse e-mail.")
                else:
                    salt, h = hash_senha(senha)
                    db.execute("INSERT INTO users (nome,email,senha_hash,salt,perfil,ativo,criado_em) VALUES (?,?,?,?,?,?,?)",
                               (nome, email.lower(), h, salt, perfil, 1 if ativo else 0, db.now()))
                    db.log_action(user["email"], "usuario_criado", email.lower())
                    st.success("Usuário criado.")
                    st.rerun()

        st.markdown("##### Usuários cadastrados")
        users = db.query("SELECT id,nome,email,perfil,ativo,criado_em FROM users ORDER BY id")
        st.dataframe(pd.DataFrame([{
            "ID": u["id"], "Nome": u["nome"], "E-mail": u["email"], "Perfil": u["perfil"],
            "Ativo": "Sim" if u["ativo"] else "Não", "Criado em": u["criado_em"],
        } for u in users]), use_container_width=True, hide_index=True)

        st.markdown("##### Editar usuário")
        ids = [u["id"] for u in users]
        sel = st.selectbox("Selecione", ids,
                           format_func=lambda i: next(f"#{u['id']} · {u['nome']} ({u['email']})"
                                                      for u in users if u["id"] == i))
        u = db.query_one("SELECT * FROM users WHERE id=?", (sel,))
        with st.form("edit_user"):
            c1, c2 = st.columns(2)
            nome = c1.text_input("Nome", u["nome"])
            perfil = c2.selectbox("Perfil", PERFIS, index=PERFIS.index(u["perfil"]) if u["perfil"] in PERFIS else 1)
            c1, c2 = st.columns(2)
            ativo = c1.checkbox("Ativo", value=bool(u["ativo"]))
            nova_senha = c2.text_input("Nova senha (deixe vazio para manter)", type="password")
            if st.form_submit_button("Salvar", type="primary"):
                if nova_senha:
                    salt, h = hash_senha(nova_senha)
                    db.execute("UPDATE users SET nome=?,perfil=?,ativo=?,senha_hash=?,salt=? WHERE id=?",
                               (nome, perfil, 1 if ativo else 0, h, salt, sel))
                else:
                    db.execute("UPDATE users SET nome=?,perfil=?,ativo=? WHERE id=?",
                               (nome, perfil, 1 if ativo else 0, sel))
                db.log_action(user["email"], "usuario_editado", u["email"])
                st.success("Usuário atualizado.")
                st.rerun()

    # ---- Slack ----
    with tabs[1]:
        st.markdown("##### Integração Slack (Incoming Webhook)")
        atual = db.get_config("slack_webhook", "")
        st.caption("As mensagens automáticas usam esta URL. Cole a URL do webhook do canal de CX.")
        with st.form("slack_cfg"):
            nova = st.text_input("URL do Webhook", atual, type="password")
            c1, c2 = st.columns(2)
            salvar = c1.form_submit_button("Salvar URL", type="primary")
            testar = c2.form_submit_button("Enviar teste")
        if salvar:
            db.set_config("slack_webhook", nova.strip())
            db.log_action(user["email"], "slack_configurado", "webhook atualizado")
            st.success("Webhook salvo.")
        if testar:
            ok, det = enviar_slack(":white_check_mark: Teste de integração do CX Command Center – Alumni.", "teste")
            st.success("Mensagem enviada!") if ok else st.error(f"Falha: {det}")
        with st.expander("Quais eventos disparam alertas no Slack?"):
            st.markdown(
                "- Tarefa **crítica** criada/elevada\n"
                "- Cancelamento acima de **20 dias**\n"
                "- Aluno com risco **alto** de churn\n"
                "- Cobrança acima de **60 dias**\n"
                "- Reembolso pendente (via cancelamentos)\n"
                "- Nova **consultoria** criada\n"
                "- Feedback **crítico** registrado")

    # ---- Backup ----
    with tabs[2]:
        st.markdown("##### Backup do banco de dados")
        st.caption(f"Arquivo atual: `{db.DB_PATH}`")
        with open(db.DB_PATH, "rb") as f:
            st.download_button("⬇️ Baixar backup (.db)", f.read(),
                               file_name="cxdash_backup.db", mime="application/octet-stream",
                               type="primary")
        if st.button("💾 Salvar cópia local em /backups"):
            bdir = os.path.join(db.BASE_DIR, "backups")
            os.makedirs(bdir, exist_ok=True)
            dest = os.path.join(bdir, f"cxdash_{db.now().replace(':', '').replace(' ', '_')}.db")
            shutil.copy2(db.DB_PATH, dest)
            db.log_action(user["email"], "backup", dest)
            st.success(f"Backup salvo em {dest}")

    # ---- Logs ----
    with tabs[3]:
        st.markdown("##### Logs de ações dos usuários")
        c1, c2 = st.columns([2, 3])
        f_user = c1.text_input("Filtrar por usuário")
        f_acao = c2.text_input("Filtrar por ação")
        logs = db.query("SELECT * FROM logs ORDER BY id DESC LIMIT 1000")
        data = [{
            "ID": l["id"], "Quando": l["ts"], "Usuário": l["usuario"],
            "Ação": l["acao"], "Detalhe": l["detalhe"],
        } for l in logs
            if (not f_user or f_user.lower() in (l["usuario"] or "").lower())
            and (not f_acao or f_acao.lower() in (l["acao"] or "").lower())]
        df = pd.DataFrame(data)
        st.caption(f"{len(df)} registro(s) (últimos 1000)")
        st.dataframe(df, use_container_width=True, hide_index=True)
        ui.botoes_export(df, "logs")
