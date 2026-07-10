"""Geração de documentos em PDF no padrão Alumni by Better.

Cores da marca: azul-marinho #12277d, azul royal #1b1fd1, vermelho #e2001a.
Layout: régua vermelha no topo, barra azul com título, corpo justificado,
rodapé Better Education.
"""
import io
from datetime import datetime

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

AZUL_MARINHO = HexColor("#12277d")
AZUL_ROYAL = HexColor("#1b1fd1")
VERMELHO = HexColor("#e2001a")

MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
         "agosto", "setembro", "outubro", "novembro", "dezembro"]

CNPJ_MANTENEDORA = "53.286.868/0001-66"
CNPJ_INSTITUICAO = "62.572.789/0001-02"

TITULOS = {
    "Recibo de pagamento": "RECIBO DE PAGAMENTO",
    "Termo de quitação": "TERMO DE QUITAÇÃO",
    "Declaração de vínculo": "DECLARAÇÃO DE VÍNCULO",
    "Termo de cancelamento": "TERMO DE CANCELAMENTO",
    "Comprovante de regularização": "COMPROVANTE DE REGULARIZAÇÃO",
}


# ---------------------------------------------------------------- valor extenso
_UNID = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
         "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis",
         "dezessete", "dezoito", "dezenove"]
_DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
        "oitenta", "noventa"]
_CEM = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
        "seiscentos", "setecentos", "oitocentos", "novecentos"]


def _ate_999(n):
    if n == 0:
        return ""
    if n == 100:
        return "cem"
    partes = []
    c, resto = divmod(n, 100)
    if c:
        partes.append(_CEM[c])
    if resto:
        if resto < 20:
            partes.append(_UNID[resto])
        else:
            d, u = divmod(resto, 10)
            partes.append(_DEZ[d] + (" e " + _UNID[u] if u else ""))
    return " e ".join(partes)


def valor_extenso(valor):
    valor = round(float(valor), 2)
    inteiro = int(valor)
    centavos = int(round((valor - inteiro) * 100))
    if inteiro == 0:
        reais = "zero real"
    else:
        milhares, resto = divmod(inteiro, 1000)
        blocos = []
        if milhares:
            if milhares == 1:
                blocos.append("mil")
            else:
                blocos.append(_ate_999(milhares) + " mil")
        if resto:
            blocos.append(_ate_999(resto))
        txt = " e ".join([b for b in blocos if b])
        reais = txt + (" real" if inteiro == 1 else " reais")
    if centavos:
        cent = _ate_999(centavos) + (" centavo" if centavos == 1 else " centavos")
        return f"{reais} e {cent}"
    return reais


def brl(valor):
    return ("R$ " + f"{float(valor):,.2f}").replace(",", "X").replace(".", ",").replace("X", ".")


# ---------------------------------------------------------------- corpo do texto
def _corpo_texto(tipo, d):
    nome = d.get("aluno", "")
    cpf = d.get("cpf", "")
    curso = d.get("curso", "")
    valor = float(d.get("valor", 0) or 0)
    forma = d.get("forma_pagamento", "")
    parcelas = d.get("parcelas", 1) or 1
    ref = d.get("referencia", "")
    hoje = datetime.now()
    mes = MESES[hoje.month - 1]

    if tipo == "Recibo de pagamento":
        return (
            f"Declaro por meio desta que <b>{nome}</b>, portador(a) do CPF <b>{cpf}</b>, "
            f"está matriculado(a) na instituição Alumni, CNPJ {CNPJ_INSTITUICAO}, no curso "
            f"de <b>{curso}</b>, administrado e executado pela Better Education – Alumni by "
            f"Better, CNPJ {CNPJ_MANTENEDORA}. O valor pago no mês de {mes} foi de "
            f"<b>{brl(valor)}</b> ({valor_extenso(valor)}) via {forma}"
            f"{' em ' + str(int(parcelas)) + ' parcela(s)' if int(parcelas) > 1 else ''}."
            + (f" Referência: {ref}." if ref else "")
        )
    if tipo == "Termo de quitação":
        return (
            f"A Better Education – Alumni by Better, CNPJ {CNPJ_MANTENEDORA}, declara para os "
            f"devidos fins que <b>{nome}</b>, portador(a) do CPF <b>{cpf}</b>, aluno(a) do curso "
            f"de <b>{curso}</b>, encontra-se com suas obrigações financeiras integralmente "
            f"quitadas, no valor total de <b>{brl(valor)}</b> ({valor_extenso(valor)}), nada mais "
            f"havendo a reclamar a qualquer título. Forma de pagamento: {forma}."
            + (f" Referência: {ref}." if ref else "")
        )
    if tipo == "Declaração de vínculo":
        return (
            f"Declaramos, para os devidos fins, que <b>{nome}</b>, portador(a) do CPF <b>{cpf}</b>, "
            f"possui vínculo ativo com a instituição Alumni, CNPJ {CNPJ_INSTITUICAO}, estando "
            f"regularmente matriculado(a) no curso de <b>{curso}</b>, administrado e executado pela "
            f"Better Education – Alumni by Better, CNPJ {CNPJ_MANTENEDORA}."
        )
    if tipo == "Termo de cancelamento":
        return (
            f"Fica registrado o cancelamento da matrícula de <b>{nome}</b>, portador(a) do CPF "
            f"<b>{cpf}</b>, no curso de <b>{curso}</b>, junto à Better Education – Alumni by Better, "
            f"CNPJ {CNPJ_MANTENEDORA}. Eventuais valores tratados nesta rescisão: <b>{brl(valor)}</b> "
            f"({valor_extenso(valor)}). Forma de tratativa: {forma}."
            + (f" Referência: {ref}." if ref else "")
        )
    # Comprovante de regularização
    return (
        f"Comprovamos que <b>{nome}</b>, portador(a) do CPF <b>{cpf}</b>, aluno(a) do curso de "
        f"<b>{curso}</b>, regularizou sua situação financeira junto à Better Education – Alumni by "
        f"Better, CNPJ {CNPJ_MANTENEDORA}, referente ao valor de <b>{brl(valor)}</b> "
        f"({valor_extenso(valor)}), pago via {forma}."
        + (f" Referência: {ref}." if ref else "")
    )


def _decorar(canvas, doc):
    """Régua vermelha no topo, barra azul com título e rodapé."""
    w, h = A4
    # régua vermelha
    canvas.setFillColor(VERMELHO)
    canvas.rect(2 * cm, h - 2.1 * cm, w - 4 * cm, 0.12 * cm, fill=1, stroke=0)
    # logo/marca (texto — placeholder do logo oficial)
    canvas.setFillColor(AZUL_MARINHO)
    canvas.setFont("Helvetica-Bold", 20)
    canvas.drawString(2 * cm, h - 3.1 * cm, "alumni")
    canvas.setFont("Helvetica", 11)
    canvas.setFillColor(HexColor("#555555"))
    canvas.drawString(4.4 * cm, h - 3.05 * cm, "by BETTER")
    # barra azul com título
    canvas.setFillColor(AZUL_ROYAL)
    canvas.rect(2 * cm, h - 4.2 * cm, w - 4 * cm, 0.75 * cm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Helvetica-Bold", 13)
    canvas.drawCentredString(w / 2, h - 3.95 * cm, doc.titulo_doc)
    # rodapé
    canvas.setFillColor(VERMELHO)
    canvas.rect(2 * cm, 1.7 * cm, w - 4 * cm, 0.06 * cm, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#666666"))
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(
        w / 2, 1.2 * cm,
        f"BETTER EDUCATION LTDA · CNPJ {CNPJ_MANTENEDORA} · Barueri – SP · "
        "Alphaville, Calçada dos Crisântemos, 18",
    )


def gerar_documento_pdf(tipo, d) -> bytes:
    """Gera o PDF de um documento institucional e devolve os bytes."""
    buffer = io.BytesIO()
    doc = BaseDocTemplate(
        buffer, pagesize=A4,
        leftMargin=2.2 * cm, rightMargin=2.2 * cm,
        topMargin=5 * cm, bottomMargin=2.4 * cm,
    )
    doc.titulo_doc = TITULOS.get(tipo, tipo.upper())
    frame = Frame(doc.leftMargin, doc.bottomMargin,
                  doc.width, doc.height, id="corpo")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=_decorar)])

    corpo = ParagraphStyle("corpo", fontName="Helvetica", fontSize=12,
                           leading=20, alignment=TA_JUSTIFY, spaceAfter=14)
    centro = ParagraphStyle("centro", fontName="Helvetica", fontSize=11,
                            leading=16, alignment=TA_CENTER)

    hoje = datetime.now()
    data_ext = f"Barueri, {hoje.day} de {MESES[hoje.month - 1]} de {hoje.year}."

    elems = [
        Spacer(1, 0.4 * cm),
        Paragraph(_corpo_texto(tipo, d), corpo),
        Spacer(1, 0.8 * cm),
        Paragraph(data_ext, corpo),
        Spacer(1, 2.2 * cm),
        Paragraph("_______________________________________", centro),
        Paragraph("Better Education – Alumni by Better", centro),
    ]
    doc.build(elems)
    return buffer.getvalue()
