/* Importar planilha (CSV/XLSX) para a base — evita cadastro manual.
   Admin escolhe o destino, baixa um modelo, sobe o arquivo, confere a
   pré-visualização e importa. Mapeia colunas por nome (sem acento / maiúsculas),
   converte datas e valores (pt-BR) e atribui um responsável padrão. */
import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { store } from "../lib/store.js";
import { useUsers } from "../lib/hooks.js";
import { Select, Assignee, toast } from "../lib/ui.js";
import { parseFile } from "../lib/parse.js";

const nowTs = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const strip = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

function parseNum(v) {
  let s = String(v).replace(/[^\d,.-]/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) s = s.replace(",", ".");
  return parseFloat(s) || 0;
}
function parseData(v) {
  const s = String(v).trim(); if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = "20" + y; return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`; }
  return null;
}

const DEST = {
  tarefas: { label: "Tarefas", campos: [
    { k: "titulo", label: "Título", req: true, alias: ["titulo", "tarefa", "descricao", "assunto", "atividade"] },
    { k: "tipo", label: "Tipo", alias: ["tipo", "categoria"], def: "Atendimento" },
    { k: "responsavel", label: "Responsável", alias: ["responsavel", "resp", "dono", "atribuido", "atribuido a"] },
    { k: "prioridade", label: "Prioridade", alias: ["prioridade"], def: "Média" },
    { k: "status", label: "Status", alias: ["status", "situacao"], def: "Aberta" },
    { k: "prazo", label: "Prazo", tipo: "date", alias: ["prazo", "data", "data limite", "deadline", "vencimento"] },
    { k: "observacoes", label: "Observações", alias: ["observacoes", "obs", "notas", "comentarios"] },
  ] },
  cobrancas: { label: "Cobranças", campos: [
    { k: "aluno", label: "Aluno", req: true, alias: ["aluno", "nome", "cliente"] },
    { k: "valor", label: "Valor", tipo: "num", alias: ["valor", "valor r$", "montante", "divida", "debito"] },
    { k: "vencimento", label: "Vencimento", tipo: "date", alias: ["vencimento", "data de vencimento", "venc", "data"] },
    { k: "status", label: "Status", alias: ["status", "situacao", "estagio"], def: "1º contato" },
    { k: "responsavel", label: "Responsável", alias: ["responsavel", "resp"] },
    { k: "observacoes", label: "Observações", alias: ["observacoes", "obs", "notas"] },
  ] },
  cancelamentos: { label: "Cancelamentos / Retenção", campos: [
    { k: "aluno", label: "Aluno", req: true, alias: ["aluno", "nome", "cliente"] },
    { k: "email", label: "E-mail", alias: ["email", "e-mail"] },
    { k: "telefone", label: "Telefone", alias: ["telefone", "tel", "celular", "whatsapp"] },
    { k: "cpf", label: "CPF", alias: ["cpf", "documento"] },
    { k: "produto", label: "Produto", alias: ["produto", "plano", "curso"] },
    { k: "duracao", label: "Duração", alias: ["duracao", "duração", "tempo", "tempo de duracao"] },
    { k: "tipo_pagamento", label: "Tipo de pagamento", alias: ["tipo_pagamento", "tipo de pagamento", "pagamento"] },
    { k: "vendedor", label: "Vendedor", alias: ["vendedor", "consultor", "seller"] },
    { k: "tipo_cancelamento", label: "Tipo de cancelamento", alias: ["tipo_cancelamento", "tipo de cancelamento"] },
    { k: "data_solicitacao", label: "Data da solicitação", tipo: "date", alias: ["data_solicitacao", "data da solicitacao", "data solicitacao", "data", "abertura"] },
    { k: "motivo", label: "Motivo", alias: ["motivo", "razao"] },
    { k: "resultado", label: "Resultado", alias: ["resultado"], def: "Em análise" },
    { k: "valor_total", label: "Valor total", tipo: "num", alias: ["valor_total", "valor total", "total", "valor pago"] },
    { k: "valor_material", label: "Material", tipo: "num", alias: ["valor_material", "material"] },
    { k: "valor_servico", label: "Serviço", tipo: "num", alias: ["valor_servico", "servico", "serviço", "valor servico"] },
    { k: "valor_multa", label: "Multa", tipo: "num", alias: ["valor_multa", "multa"] },
    { k: "valor_reembolso", label: "Reembolso", tipo: "num", alias: ["valor_reembolso", "reembolso"] },
    { k: "responsavel", label: "Responsável", alias: ["responsavel", "resp"] },
    { k: "observacoes", label: "Observações", alias: ["observacoes", "obs"] },
  ] },
  voc: { label: "Feedbacks", campos: [
    { k: "aluno", label: "Aluno", alias: ["aluno", "nome", "cliente"] },
    { k: "descricao", label: "Descrição", req: true, alias: ["descricao", "feedback", "comentario", "mensagem", "texto"] },
    { k: "categoria", label: "Categoria", alias: ["categoria"], def: "Atendimento" },
    { k: "tipo", label: "Tipo", alias: ["tipo"], def: "reclamação" },
    { k: "gravidade", label: "Gravidade", alias: ["gravidade"], def: "Média" },
    { k: "area", label: "Área", alias: ["area", "area responsavel"], def: "CX" },
    { k: "status", label: "Status", alias: ["status", "situacao"], def: "Aberto" },
    { k: "responsavel", label: "Responsável", alias: ["responsavel", "resp"] },
  ] },
};

function mapear(dest, headers) {
  const norm = headers.map(strip);
  const map = {};
  for (const campo of dest.campos) {
    const nomes = [campo.k, campo.label, ...campo.alias].map(strip);
    for (let i = 0; i < norm.length; i++) if (nomes.includes(norm[i])) { map[campo.k] = i; break; }
  }
  return map;
}

function construir(destKey, matriz, map, respPadrao) {
  const dest = DEST[destKey];
  const recs = []; let ignoradas = 0;
  for (const lin of matriz.slice(1)) {
    const rec = {};
    for (const campo of dest.campos) {
      let v = map[campo.k] != null ? String(lin[map[campo.k]] ?? "").trim() : "";
      if (campo.tipo === "num") rec[campo.k] = v ? parseNum(v) : 0;
      else if (campo.tipo === "date") rec[campo.k] = parseData(v);
      else rec[campo.k] = v || campo.def || "";
    }
    if (dest.campos.some((c) => c.req && !String(rec[c.k]).trim())) { ignoradas++; continue; }
    if (!rec.responsavel) rec.responsavel = respPadrao || "";
    // divide o valor total 50/50 quando material/serviço não vieram na planilha
    if (destKey === "cancelamentos" && rec.valor_total > 0 && !rec.valor_material && !rec.valor_servico) {
      rec.valor_material = +(rec.valor_total / 2).toFixed(2);
      rec.valor_servico = +(rec.valor_total / 2).toFixed(2);
    }
    rec.criado_em = nowTs();
    recs.push(rec);
  }
  return { recs, ignoradas };
}

function baixarModelo(destKey) {
  const dest = DEST[destKey];
  const head = dest.campos.map((c) => c.label);
  const ex = dest.campos.map((c) => c.tipo === "date" ? "2026-07-10" : c.tipo === "num" ? "500" : (c.def || (c.k === "aluno" || c.k === "titulo" ? "Exemplo" : "")));
  const csv = [head, ex].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `modelo_${destKey}.csv`; a.click();
}

export function View({ user }) {
  const users = useUsers();
  const [destKey, setDestKey] = useState("tarefas");
  const [respPadrao, setRespPadrao] = useState(user.nome || "");
  const [arquivo, setArquivo] = useState("");
  const [headers, setHeaders] = useState([]);
  const [map, setMap] = useState({});
  const [preview, setPreview] = useState(null); // {recs, ignoradas}
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);

  const dest = DEST[destKey];

  const reprocessar = (matriz, dk, resp) => {
    if (!matriz) return;
    const hs = matriz[0] || [];
    const mp = mapear(DEST[dk], hs);
    setHeaders(hs); setMap(mp);
    setPreview(construir(dk, matriz, mp, resp));
  };
  const [matriz, setMatriz] = useState(null);

  const aoEscolher = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setErro(""); setArquivo(f.name); setPreview(null);
    try {
      const m = await parseFile(f);
      if (!m.length) { setErro("A planilha está vazia."); return; }
      setMatriz(m); reprocessar(m, destKey, respPadrao);
    } catch (ex) { setErro(ex.message || "Não consegui ler o arquivo."); }
  };

  const trocarDestino = (dk) => { setDestKey(dk); reprocessar(matriz, dk, respPadrao); };
  const trocarResp = (r) => { setRespPadrao(r); reprocessar(matriz, destKey, r); };

  const importar = async () => {
    if (!preview || !preview.recs.length) return;
    setBusy(true);
    try {
      const n = await store.bulkInsert(destKey, preview.recs);
      await store.logAction(user.email, "importacao", `${dest.label}: ${n} linha(s)`);
      toast(`${n} registro(s) importado(s) em ${dest.label}.`);
      setPreview(null); setMatriz(null); setArquivo(""); setHeaders([]);
    } catch (ex) {
      setErro("Falha ao importar: " + (ex.message || ex) + ". Confira os valores (datas, números) e tente de novo.");
    } finally { setBusy(false); }
  };

  return html`
    <h1 class="h1">Importar planilha</h1>
    <p class="sub">Escolha o destino, suba o CSV ou Excel e importe.</p>

    <div class="card imp-card">
      <div class="row c2">
        <div class="field"><label>Importar para</label>
          <select value=${destKey} onChange=${(e) => trocarDestino(e.target.value)}>
            ${Object.keys(DEST).map((k) => html`<option value=${k} selected=${k === destKey}>${DEST[k].label}</option>`)}
          </select></div>
        ${Assignee({ label: "Responsável padrão", value: respPadrao, onInput: trocarResp, users })}
      </div>

      <div class="imp-drop">
        <input type="file" accept=".csv,.xlsx,.xls" onChange=${aoEscolher}/>
        ${arquivo ? html`<span class="imp-file">${arquivo}</span>` : ""}
      </div>
      <button class="imp-link" onClick=${() => baixarModelo(destKey)}>Baixar planilha modelo</button>

      ${erro ? html`<div class="err" style="margin-top:12px">${erro}</div>` : ""}

      ${preview ? html`
        <div class="imp-ready">
          <span>${preview.recs.length} linha(s) prontas${preview.ignoradas ? ` · ${preview.ignoradas} incompleta(s) ignorada(s)` : ""}</span>
          <button class="btn primary" onClick=${importar} disabled=${busy || !preview.recs.length}>
            ${busy ? "Importando…" : "Importar"}</button>
        </div>` : ""}
    </div>`;
}
