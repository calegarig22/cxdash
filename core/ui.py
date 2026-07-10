"""Componentes visuais compartilhados: CSS, cards, badges."""
from datetime import date, datetime

import pandas as pd
import streamlit as st

from core import exporter

# Cores da marca Alumni by Better
AZUL_MARINHO = "#12277d"
AZUL_ROYAL = "#1b1fd1"
VERMELHO = "#e2001a"

# Cores por status/prioridade (badges)
CORES_STATUS = {
    # tarefas
    "Aberta": "#6b7280", "Em andamento": "#2563eb",
    "Aguardando outra área": "#d97706", "Concluída": "#16a34a", "Cancelada": "#9ca3af",
    # prioridade
    "Baixa": "#16a34a", "Média": "#d97706", "Alta": "#ea580c", "Crítica": "#dc2626",
    # cancelamentos
    "Recebido": "#6b7280", "Em análise": "#2563eb",
    "Aguardando diretoria": "#d97706", "Aguardando financeiro": "#d97706",
    "Finalizado": "#16a34a",
    # cobrança
    "1º contato": "#3b82f6", "2º contato": "#f59e0b", "3º contato": "#ea580c",
    "Pré-negativação": "#dc2626", "Regularizado": "#16a34a",
    # retenção / nível
    "baixo": "#16a34a", "médio": "#d97706", "alto": "#dc2626",
    "Retido": "#16a34a", "Cancelou": "#dc2626", "Em acompanhamento": "#2563eb",
    # consultorias
    "Solicitada": "#6b7280", "Aprovada": "#2563eb", "Agendada": "#7c3aed",
    "Realizada": "#16a34a",
    # VoC
    "elogio": "#16a34a", "reclamação": "#dc2626", "sugestão": "#2563eb",
    "Aberto": "#d97706", "Em tratativa": "#2563eb", "Resolvido": "#16a34a",
}


def carregar_css():
    st.markdown(
        f"""
        <style>
        :root {{ --azul: {AZUL_MARINHO}; --royal: {AZUL_ROYAL}; --verm: {VERMELHO}; }}
        .block-container {{ padding-top: 2rem; max-width: 1250px; }}
        section[data-testid="stSidebar"] {{
            background: linear-gradient(180deg, {AZUL_MARINHO} 0%, #0d1c5c 100%);
        }}
        section[data-testid="stSidebar"] * {{ color: #eef1ff; }}
        section[data-testid="stSidebar"] .stButton>button {{
            background: rgba(255,255,255,0.06); color:#fff; border:1px solid rgba(255,255,255,0.12);
            text-align:left; width:100%; border-radius:10px; padding:.5rem .8rem; font-weight:500;
        }}
        section[data-testid="stSidebar"] .stButton>button:hover {{
            background: rgba(255,255,255,0.16); border-color: rgba(255,255,255,0.3);
        }}
        .cxcard {{
            background:#fff; border:1px solid #eceef3; border-radius:16px; padding:18px 20px;
            box-shadow:0 1px 3px rgba(16,24,64,.06); height:100%;
        }}
        .cxcard .lbl {{ color:#6b7280; font-size:.8rem; font-weight:600; text-transform:uppercase;
            letter-spacing:.03em; }}
        .cxcard .val {{ color:{AZUL_MARINHO}; font-size:2rem; font-weight:800; line-height:1.1;
            margin-top:4px; }}
        .cxcard .sub {{ color:#9ca3af; font-size:.78rem; margin-top:2px; }}
        .cxcard.alert {{ border-left:5px solid {VERMELHO}; }}
        .cxcard.warn {{ border-left:5px solid #d97706; }}
        .cxcard.ok {{ border-left:5px solid #16a34a; }}
        .badge {{ display:inline-block; padding:2px 10px; border-radius:999px; font-size:.72rem;
            font-weight:700; color:#fff; }}
        .cxtitle {{ color:{AZUL_MARINHO}; font-weight:800; font-size:1.6rem; margin-bottom:.2rem; }}
        .cxsub {{ color:#6b7280; margin-bottom:1.2rem; }}
        .stButton>button {{ border-radius:10px; }}
        div[data-testid="stForm"] {{ border:1px solid #eceef3; border-radius:14px; padding:8px 4px; }}
        </style>
        """,
        unsafe_allow_html=True,
    )


def badge(texto):
    if texto is None or texto == "":
        return ""
    cor = CORES_STATUS.get(str(texto), "#6b7280")
    return f'<span class="badge" style="background:{cor}">{texto}</span>'


def titulo(txt, sub=""):
    st.markdown(f'<div class="cxtitle">{txt}</div>', unsafe_allow_html=True)
    if sub:
        st.markdown(f'<div class="cxsub">{sub}</div>', unsafe_allow_html=True)


def card(col, label, valor, sub="", tipo=""):
    cls = "cxcard" + (f" {tipo}" if tipo else "")
    col.markdown(
        f'<div class="{cls}"><div class="lbl">{label}</div>'
        f'<div class="val">{valor}</div>'
        f'<div class="sub">{sub}</div></div>',
        unsafe_allow_html=True,
    )


def parse_date(s):
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(str(s)[:19] if len(str(s)) > 10 else str(s), fmt).date()
        except ValueError:
            continue
    return None


def dias_para(s):
    """Dias até a data (negativo = vencido)."""
    d = parse_date(s)
    if not d:
        return None
    return (d - date.today()).days


def dias_desde(s):
    d = parse_date(s)
    if not d:
        return None
    return (date.today() - d).days


def botoes_export(df: pd.DataFrame, nome_base: str):
    """Renderiza botões de download Excel e CSV para um DataFrame."""
    if df is None or df.empty:
        return
    c1, c2, _ = st.columns([1, 1, 4])
    c1.download_button(
        "⬇️ Excel", exporter.to_excel_bytes(df), file_name=f"{nome_base}.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        use_container_width=True,
    )
    c2.download_button(
        "⬇️ CSV", exporter.to_csv_bytes(df), file_name=f"{nome_base}.csv",
        mime="text/csv", use_container_width=True,
    )


def tabela_status(df: pd.DataFrame, coluna_status=None):
    """Mostra um DataFrame; se houver coluna de status, renderiza badges via HTML."""
    st.dataframe(df, use_container_width=True, hide_index=True)
