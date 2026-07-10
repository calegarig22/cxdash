"""SQLite database layer: connection, schema and query helpers."""
import os
import sqlite3
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "cxdash.db")

os.makedirs(DATA_DIR, exist_ok=True)


def get_conn():
    """Return a new SQLite connection with row access by column name."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def query(sql, params=()):
    """Run a SELECT and return a list of sqlite3.Row."""
    with get_conn() as conn:
        return conn.execute(sql, params).fetchall()


def query_one(sql, params=()):
    with get_conn() as conn:
        return conn.execute(sql, params).fetchone()


def execute(sql, params=()):
    """Run an INSERT/UPDATE/DELETE. Returns lastrowid."""
    with get_conn() as conn:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur.lastrowid


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'CX',
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT
);

CREATE TABLE IF NOT EXISTS config (
    chave TEXT PRIMARY KEY,
    valor TEXT
);

CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT,
    usuario TEXT,
    acao TEXT,
    detalhe TEXT
);

CREATE TABLE IF NOT EXISTS tarefas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    tipo TEXT,
    responsavel TEXT,
    prioridade TEXT,
    status TEXT,
    prazo TEXT,
    observacoes TEXT,
    criado_em TEXT,
    atualizado_em TEXT
);

CREATE TABLE IF NOT EXISTS tarefa_historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tarefa_id INTEGER,
    ts TEXT,
    usuario TEXT,
    texto TEXT
);

CREATE TABLE IF NOT EXISTS cancelamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aluno TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    data_solicitacao TEXT,
    motivo TEXT,
    status TEXT,
    valor_multa REAL DEFAULT 0,
    valor_material REAL DEFAULT 0,
    valor_reembolso REAL DEFAULT 0,
    observacoes TEXT,
    anexos TEXT,
    criado_em TEXT
);

CREATE TABLE IF NOT EXISTS cancelamento_historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cancelamento_id INTEGER,
    ts TEXT,
    usuario TEXT,
    texto TEXT
);

CREATE TABLE IF NOT EXISTS cobrancas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aluno TEXT NOT NULL,
    valor REAL DEFAULT 0,
    vencimento TEXT,
    status TEXT,
    ultima_mensagem TEXT,
    proxima_acao TEXT,
    responsavel TEXT,
    observacoes TEXT,
    criado_em TEXT
);

CREATE TABLE IF NOT EXISTS retencao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aluno TEXT NOT NULL,
    motivo TEXT,
    nivel TEXT,
    acao_sugerida TEXT,
    status TEXT,
    resultado TEXT,
    observacoes TEXT,
    score INTEGER DEFAULT 0,
    criado_em TEXT
);

CREATE TABLE IF NOT EXISTS documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT,
    aluno TEXT,
    cpf TEXT,
    curso TEXT,
    valor REAL DEFAULT 0,
    forma_pagamento TEXT,
    parcelas INTEGER DEFAULT 1,
    data TEXT,
    referencia TEXT,
    gerado_por TEXT,
    criado_em TEXT
);

CREATE TABLE IF NOT EXISTS consultorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aluno TEXT NOT NULL,
    tipo TEXT,
    solicitante TEXT,
    data_solicitada TEXT,
    data_agendada TEXT,
    responsavel TEXT,
    status TEXT,
    link_zoom TEXT,
    observacoes TEXT,
    criado_em TEXT
);

CREATE TABLE IF NOT EXISTS playbooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria TEXT,
    titulo TEXT,
    conteudo TEXT,
    favorito INTEGER DEFAULT 0,
    criado_em TEXT
);

CREATE TABLE IF NOT EXISTS voc (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aluno TEXT,
    categoria TEXT,
    tipo TEXT,
    gravidade TEXT,
    descricao TEXT,
    area TEXT,
    status TEXT,
    acao TEXT,
    criado_em TEXT
);
"""


def init_db():
    """Create all tables if they don't exist."""
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        conn.commit()


def get_config(chave, default=None):
    row = query_one("SELECT valor FROM config WHERE chave = ?", (chave,))
    return row["valor"] if row else default


def set_config(chave, valor):
    execute(
        "INSERT INTO config (chave, valor) VALUES (?, ?) "
        "ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
        (chave, valor),
    )


def log_action(usuario, acao, detalhe=""):
    execute(
        "INSERT INTO logs (ts, usuario, acao, detalhe) VALUES (?, ?, ?, ?)",
        (now(), usuario, acao, detalhe),
    )
