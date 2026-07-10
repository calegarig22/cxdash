"""Dashboard geral com cards de indicadores."""
import pandas as pd
import streamlit as st

from core import db, ui


def _count(sql, params=()):
    row = db.query_one(sql, params)
    return list(row)[0] if row else 0


def render(user):
    ui.titulo("Dashboard Geral", "Visão consolidada da operação de CX – Alumni")

    tarefas_pend = _count(
        "SELECT COUNT(*) FROM tarefas WHERE status NOT IN ('Concluída','Cancelada')")
    tarefas_hoje = _count(
        "SELECT COUNT(*) FROM tarefas WHERE date(prazo)=date('now','localtime') "
        "AND status NOT IN ('Concluída','Cancelada')")
    tarefas_venc = _count(
        "SELECT COUNT(*) FROM tarefas WHERE date(prazo)<date('now','localtime') "
        "AND status NOT IN ('Concluída','Cancelada')")
    criticos = _count(
        "SELECT COUNT(*) FROM tarefas WHERE prioridade='Crítica' "
        "AND status NOT IN ('Concluída','Cancelada')")
    cancel = _count(
        "SELECT COUNT(*) FROM cancelamentos WHERE status!='Finalizado'")
    reemb = _count(
        "SELECT COUNT(*) FROM cancelamentos WHERE status!='Finalizado' AND valor_reembolso>0")
    churn = _count("SELECT COUNT(*) FROM retencao WHERE nivel='alto' AND resultado='Em acompanhamento'")
    cobr = _count("SELECT COUNT(*) FROM cobrancas WHERE status!='Regularizado'")
    consult = _count("SELECT COUNT(*) FROM consultorias WHERE status IN ('Aprovada','Agendada')")

    st.markdown("##### Operação")
    c1, c2, c3 = st.columns(3)
    ui.card(c1, "Atendimentos pendentes", tarefas_pend, "Tarefas abertas/em andamento", "warn")
    ui.card(c2, "Tarefas do dia", tarefas_hoje, "Com prazo para hoje")
    ui.card(c3, "Tarefas vencidas", tarefas_venc, "Prazo ultrapassado",
            "alert" if tarefas_venc else "ok")

    st.write("")
    c1, c2, c3 = st.columns(3)
    ui.card(c1, "Casos críticos", criticos, "Prioridade crítica", "alert" if criticos else "ok")
    ui.card(c2, "Cancelamentos em andamento", cancel, "Não finalizados", "warn")
    ui.card(c3, "Reembolsos pendentes", reemb, "Com valor a devolver", "warn" if reemb else "ok")

    st.write("")
    c1, c2, c3 = st.columns(3)
    ui.card(c1, "Alunos em risco de churn", churn, "Risco alto em acompanhamento",
            "alert" if churn else "ok")
    ui.card(c2, "Cobranças em aberto", cobr, "Não regularizadas", "warn")
    ui.card(c3, "Consultorias agendadas", consult, "Aprovadas/agendadas")

    st.divider()
    col_a, col_b = st.columns(2)

    with col_a:
        st.markdown("##### 🔴 Tarefas vencidas / críticas")
        rows = db.query(
            "SELECT titulo, responsavel, prioridade, status, prazo FROM tarefas "
            "WHERE status NOT IN ('Concluída','Cancelada') AND "
            "(date(prazo)<date('now','localtime') OR prioridade='Crítica') "
            "ORDER BY prazo LIMIT 8")
        if rows:
            for r in rows:
                st.markdown(
                    f"**{r['titulo']}** &nbsp; {ui.badge(r['prioridade'])} {ui.badge(r['status'])}"
                    f"<br><span style='color:#9ca3af;font-size:.8rem'>{r['responsavel']} · prazo {r['prazo']}</span>",
                    unsafe_allow_html=True)
        else:
            st.success("Nenhuma tarefa vencida ou crítica. 🎉")

    with col_b:
        st.markdown("##### 💸 Cobranças mais antigas")
        rows = db.query(
            "SELECT aluno, valor, vencimento, status FROM cobrancas "
            "WHERE status!='Regularizado' ORDER BY vencimento LIMIT 8")
        if rows:
            for r in rows:
                atraso = ui.dias_desde(r["vencimento"]) or 0
                cor = "#dc2626" if atraso >= 60 else "#6b7280"
                st.markdown(
                    f"**{r['aluno']}** — {ui.badge(r['status'])} "
                    f"<span style='color:{cor};font-weight:700'>{atraso}d</span>"
                    f"<br><span style='color:#9ca3af;font-size:.8rem'>"
                    f"R$ {r['valor']:.2f} · venc. {r['vencimento']}</span>",
                    unsafe_allow_html=True)
        else:
            st.info("Sem cobranças em aberto.")
