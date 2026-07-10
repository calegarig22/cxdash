"""Relatórios exportáveis (Excel/CSV) e gráficos consolidados."""
import pandas as pd
import streamlit as st

from core import db, ui

RELATORIOS = {
    "Tarefas por responsável": (
        "SELECT responsavel AS Responsável, status AS Status, COUNT(*) AS Total "
        "FROM tarefas GROUP BY responsavel, status ORDER BY responsavel"),
    "Cancelamentos por status": (
        "SELECT status AS Status, COUNT(*) AS Total, "
        "ROUND(SUM(valor_reembolso),2) AS 'Reembolso total' FROM cancelamentos GROUP BY status"),
    "Cobranças em aberto": (
        "SELECT aluno AS Aluno, valor AS Valor, vencimento AS Vencimento, status AS Status, "
        "responsavel AS Responsável FROM cobrancas WHERE status!='Regularizado' ORDER BY vencimento"),
    "Alunos em risco de churn": (
        "SELECT aluno AS Aluno, motivo AS Motivo, nivel AS Nível, score AS Score, "
        "resultado AS Resultado FROM retencao ORDER BY score DESC"),
    "Feedbacks por categoria": (
        "SELECT categoria AS Categoria, tipo AS Tipo, COUNT(*) AS Total FROM voc "
        "GROUP BY categoria, tipo ORDER BY categoria"),
    "Documentos gerados": (
        "SELECT tipo AS Tipo, aluno AS Aluno, valor AS Valor, data AS Data, "
        "gerado_por AS 'Gerado por' FROM documentos ORDER BY id DESC"),
    "Consultorias realizadas": (
        "SELECT aluno AS Aluno, tipo AS Tipo, data_agendada AS 'Data agendada', "
        "responsavel AS Responsável, status AS Status FROM consultorias "
        "WHERE status='Realizada' ORDER BY data_agendada DESC"),
}


def render(user):
    ui.titulo("Relatórios", "Relatórios consolidados e exportáveis em Excel/CSV")
    escolha = st.selectbox("Selecione o relatório", list(RELATORIOS.keys()))
    rows = db.query(RELATORIOS[escolha])
    if not rows:
        st.info("Sem dados para este relatório.")
        return
    df = pd.DataFrame([dict(r) for r in rows])
    st.dataframe(df, use_container_width=True, hide_index=True)
    ui.botoes_export(df, escolha.lower().replace(" ", "_"))

    # gráfico simples quando houver coluna 'Total'
    if "Total" in df.columns and len(df.columns) >= 2:
        st.markdown("##### Visão gráfica")
        chave = df.columns[0]
        try:
            st.bar_chart(df.groupby(chave)["Total"].sum())
        except Exception:  # noqa: BLE001
            pass
