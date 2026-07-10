"""Gerador de Recibos e Termos institucionais (PDF Alumni by Better)."""
import pandas as pd
import streamlit as st

from core import db, ui
from core.pdf import TITULOS, gerar_documento_pdf

TIPOS = list(TITULOS.keys())
FORMAS = ["PIX", "Cartão de crédito", "Cartão de débito", "Boleto", "Transferência", "Dinheiro"]


def render(user):
    ui.titulo("Gerador de Recibos e Termos", "Documentos institucionais em PDF com histórico e reimpressão")
    tab_gerar, tab_hist = st.tabs(["🧾 Gerar documento", "🗂️ Histórico"])

    with tab_gerar:
        with st.form("gerar_doc"):
            c1, c2 = st.columns(2)
            tipo = c1.selectbox("Tipo de documento", TIPOS)
            aluno = c2.text_input("Nome do aluno *")
            c1, c2, c3 = st.columns(3)
            cpf = c1.text_input("CPF")
            curso = c2.text_input("Curso")
            valor = c3.number_input("Valor (R$)", 0.0, step=50.0)
            c1, c2, c3 = st.columns(3)
            forma = c1.selectbox("Forma de pagamento", FORMAS)
            parcelas = c2.number_input("Nº de parcelas", 1, 48, 1)
            data = c3.date_input("Data")
            referencia = st.text_input("Documento fiscal / referência")
            gerar = st.form_submit_button("Gerar PDF", type="primary")

        if gerar:
            if not aluno:
                st.error("Informe o nome do aluno.")
            else:
                d = {"aluno": aluno, "cpf": cpf, "curso": curso, "valor": valor,
                     "forma_pagamento": forma, "parcelas": parcelas, "referencia": referencia}
                pdf_bytes = gerar_documento_pdf(tipo, d)
                db.execute(
                    "INSERT INTO documentos (tipo,aluno,cpf,curso,valor,forma_pagamento,parcelas,"
                    "data,referencia,gerado_por,criado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (tipo, aluno, cpf, curso, valor, forma, parcelas, str(data), referencia,
                     user["nome"], db.now()))
                db.log_action(user["email"], "documento_gerado", f"{tipo} · {aluno}")
                st.success(f"{tipo} gerado e salvo no histórico.")
                st.download_button("⬇️ Baixar PDF", pdf_bytes,
                                   file_name=f"{tipo.replace(' ', '_')}_{aluno.replace(' ', '_')}.pdf",
                                   mime="application/pdf", type="primary")

    with tab_hist:
        c1, c2 = st.columns([2, 3])
        f_tipo = c1.multiselect("Tipo", TIPOS)
        f_busca = c2.text_input("Buscar aluno")
        rows = db.query("SELECT * FROM documentos ORDER BY id DESC")
        data = []
        for r in rows:
            if f_tipo and r["tipo"] not in f_tipo:
                continue
            if f_busca and f_busca.lower() not in (r["aluno"] or "").lower():
                continue
            data.append({
                "ID": r["id"], "Tipo": r["tipo"], "Aluno": r["aluno"], "CPF": r["cpf"],
                "Curso": r["curso"], "Valor": r["valor"], "Data": r["data"],
                "Gerado por": r["gerado_por"], "Em": r["criado_em"],
            })
        df = pd.DataFrame(data)
        st.caption(f"{len(df)} documento(s)")
        if not df.empty:
            st.dataframe(df, use_container_width=True, hide_index=True)
            ui.botoes_export(df, "documentos_gerados")

        st.divider()
        st.markdown("##### 🔁 Reimprimir documento")
        ids = [r["id"] for r in rows]
        if ids:
            sel = st.selectbox("Selecione", ids,
                               format_func=lambda i: next(f"#{r['id']} · {r['tipo']} · {r['aluno']}"
                                                          for r in rows if r["id"] == i))
            r = db.query_one("SELECT * FROM documentos WHERE id=?", (sel,))
            d = {"aluno": r["aluno"], "cpf": r["cpf"], "curso": r["curso"], "valor": r["valor"],
                 "forma_pagamento": r["forma_pagamento"], "parcelas": r["parcelas"],
                 "referencia": r["referencia"]}
            pdf_bytes = gerar_documento_pdf(r["tipo"], d)
            st.download_button("⬇️ Reimprimir PDF", pdf_bytes,
                               file_name=f"{r['tipo'].replace(' ', '_')}_{r['aluno'].replace(' ', '_')}.pdf",
                               mime="application/pdf")
