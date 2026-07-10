"""Authentication and role-based access control."""
import hashlib
import os

import streamlit as st

from core import db

# Perfis e módulos que cada um pode acessar.
PERFIS = ["Admin", "CX", "Financeiro", "Coordenação"]

ACESSO = {
    "Admin": "*",  # tudo
    "CX": [
        "dashboard", "tarefas", "cancelamentos", "cobranca", "retencao",
        "recibos", "consultorias", "playbooks", "voc", "relatorios",
    ],
    "Financeiro": [
        "dashboard", "cobranca", "cancelamentos", "recibos", "tarefas",
        "playbooks", "relatorios",
    ],
    "Coordenação": [
        "dashboard", "tarefas", "retencao", "consultorias", "voc",
        "playbooks", "relatorios",
    ],
}


def _hash(senha, salt):
    return hashlib.pbkdf2_hmac(
        "sha256", senha.encode("utf-8"), salt.encode("utf-8"), 100_000
    ).hex()


def hash_senha(senha):
    """Return (salt, hash) for a new password."""
    salt = os.urandom(16).hex()
    return salt, _hash(senha, salt)


def verificar_senha(senha, salt, senha_hash):
    return _hash(senha, salt) == senha_hash


def pode_acessar(perfil, modulo):
    regras = ACESSO.get(perfil, [])
    return regras == "*" or modulo in regras


def autenticar(email, senha):
    """Return the user Row if credentials are valid and active, else None."""
    user = db.query_one("SELECT * FROM users WHERE email = ? AND ativo = 1", (email.strip().lower(),))
    if user and verificar_senha(senha, user["salt"], user["senha_hash"]):
        return user
    return None


def usuario_atual():
    return st.session_state.get("user")


def logout():
    for k in ("user",):
        st.session_state.pop(k, None)
