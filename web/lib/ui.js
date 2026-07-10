/* Componentes visuais compartilhados + regras de negócio (client-side). */
import { html } from "htm/preact";
import { useState, useEffect } from "preact/hooks";

/* ---------------- helpers gerais ---------------- */
export const brl = (v) =>
  "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function parseDate(s) {
  if (!s) return null;
  const d = new Date(String(s).slice(0, 10) + "T00:00:00");
  return isNaN(d) ? null : d;
}
export function diasDesde(s) {
  const d = parseDate(s); if (!d) return null;
  return Math.floor((new Date(todayISO() + "T00:00:00") - d) / 864e5);
}
export function diasPara(s) {
  const v = diasDesde(s); return v == null ? null : -v;
}

/* ---------------- cores de status ---------------- */
const COR = {
  Aberta: "#6b7280", "Em andamento": "#2563eb", "Aguardando outra área": "#d97706",
  Concluída: "#16a34a", Cancelada: "#9ca3af",
  Baixa: "#16a34a", Média: "#d97706", Alta: "#ea580c", Crítica: "#dc2626",
  Recebido: "#6b7280", "Em análise": "#2563eb", "Aguardando diretoria": "#d97706",
  "Aguardando financeiro": "#d97706", Finalizado: "#16a34a",
  "1º contato": "#3b82f6", "2º contato": "#f59e0b", "3º contato": "#ea580c",
  "Pré-negativação": "#dc2626", Regularizado: "#16a34a",
  baixo: "#16a34a", médio: "#d97706", alto: "#dc2626",
  Retido: "#16a34a", Cancelou: "#dc2626", Cancelado: "#dc2626", "Em acompanhamento": "#2563eb",
  Solicitada: "#6b7280", Aprovada: "#2563eb", Agendada: "#7c3aed", Realizada: "#16a34a",
  elogio: "#16a34a", reclamação: "#dc2626", sugestão: "#2563eb",
  Aberto: "#d97706", "Em tratativa": "#2563eb", Resolvido: "#16a34a",
};
export const badgeColor = (t) => COR[t] || "#6b7280";
export const Badge = (t) =>
  t == null || t === "" ? "" : html`<span class="badge" style=${`background:${badgeColor(t)}`}>${t}</span>`;

/* ---------------- KPI card ---------------- */
export function Kpi({ label, val, sub, tone = "", onClick }) {
  return html`<div class=${"card kpi " + tone + (onClick ? " clickable" : "")} onClick=${onClick}>
    <div class="lbl">${label}</div><div class="val">${val}</div>
    ${sub ? html`<div class="sub2">${sub}</div>` : ""}
  </div>`;
}

/* ---------------- tabela ----------------
   Seleção em massa: passe `sel` (Set de ids), `onSel(id)` e `onSelAll(rows)`
   para exibir a coluna de checkboxes. Sem esses props, funciona como antes. */
export function Table({ columns, rows, onRow, rowClass, sel, onSel, onSelAll, idKey = "id" }) {
  if (!rows.length) return html`<div class="empty">Nenhum registro encontrado.</div>`;
  const selecionavel = !!sel;
  const todos = selecionavel && rows.length > 0 && rows.every((r) => sel.has(r[idKey]));
  return html`<div class="table-wrap"><table>
    <thead><tr>
      ${selecionavel ? html`<th class="cbx"><input type="checkbox" checked=${todos} onChange=${() => onSelAll(rows)}/></th>` : ""}
      ${columns.map((c) => html`<th>${c.label}</th>`)}
    </tr></thead>
    <tbody>${rows.map((r) => html`
      <tr class=${(rowClass ? rowClass(r) : "") + (selecionavel && sel.has(r[idKey]) ? " sel" : "")} onClick=${onRow ? () => onRow(r) : null}>
        ${selecionavel ? html`<td class="cbx" onClick=${(e) => e.stopPropagation()}>
          <input type="checkbox" checked=${sel.has(r[idKey])} onChange=${() => onSel(r[idKey])}/></td>` : ""}
        ${columns.map((c) => html`<td>${c.render ? c.render(r) : (r[c.key] ?? "")}</td>`)}
      </tr>`)}
    </tbody>
  </table></div>`;
}

/* barra de ações em massa (aparece quando há seleção) */
export function BulkBar({ n, actions, onClear }) {
  if (!n) return "";
  return html`<div class="bulkbar">
    <span class="bulk-n"><b>${n}</b> selecionada(s)</span>
    <span style="flex:1"></span>
    ${actions.filter(Boolean).map((a) => html`<button class=${"btn sm " + (a.kind || "")} onClick=${a.on} disabled=${a.busy}>${a.label}</button>`)}
    <button class="btn sm" onClick=${onClear}>Limpar</button>
  </div>`;
}

/* ---------------- barra de progresso (score) ---------------- */
export const ScoreBar = (v) => {
  const cor = v >= 70 ? "#dc2626" : v >= 45 ? "#d97706" : "#16a34a";
  return html`<span class="bar"><i style=${`width:${v}%;background:${cor}`}></i></span>
    <span style="margin-left:8px;font-weight:700;color:${cor}">${v}</span>`;
};

/* ---------------- gráfico de barras simples ---------------- */
export function BarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  if (!data.length) return html`<div class="empty">Sem dados.</div>`;
  return html`<div>${data.map((d) => html`<div class="chart-row">
    <span style="width:130px">${d.label}</span>
    <span class="track"><i style=${`width:${(d.n / max) * 100}%`}></i></span>
    <span class="n">${d.n}</span></div>`)}</div>`;
}

/* ---------------- modal ---------------- */
export function Modal({ title, children, onClose, footer, size = "" }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return html`<div class="overlay">
    <div class=${"modal " + size}>
      <header><h3>${title}</h3><button class="x" onClick=${onClose}>×</button></header>
      <div class="body">${children}</div>
      ${footer ? html`<footer>${footer}</footer>` : ""}
    </div></div>`;
}

/* ---------------- toasts ---------------- */
export function toast(msg, kind = "ok") {
  window.dispatchEvent(new CustomEvent("cx-toast", { detail: { msg, kind } }));
}
export function Toasts() {
  const [items, set] = useState([]);
  useEffect(() => {
    const h = (e) => {
      const id = Math.random();
      set((x) => [...x, { id, ...e.detail }]);
      setTimeout(() => set((x) => x.filter((t) => t.id !== id)), 3600);
    };
    window.addEventListener("cx-toast", h);
    return () => window.removeEventListener("cx-toast", h);
  }, []);
  return html`<div class="toasts">${items.map((t) => html`<div class=${"toast " + t.kind}>${t.msg}</div>`)}</div>`;
}

/* ---------------- marca Alumni + valor por extenso ---------------- */
export const MARCA = {
  navy: "#12277d", royal: "#1b1fd1", red: "#e2001a",
  cnpjMantenedora: "53.286.868/0001-66",
  cnpjInstituicao: "62.572.789/0001-02",
  rodape: "BETTER EDUCATION LTDA · CNPJ 53.286.868/0001-66 · Barueri – SP · Alphaville, Calçada dos Crisântemos, 18",
};
export const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const _U = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
const _D = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
const _C = ["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];
function _ate999(n) {
  if (n === 0) return ""; if (n === 100) return "cem";
  const p = []; const c = Math.floor(n / 100), r = n % 100;
  if (c) p.push(_C[c]);
  if (r) { if (r < 20) p.push(_U[r]); else { const d = Math.floor(r / 10), u = r % 10; p.push(_D[d] + (u ? " e " + _U[u] : "")); } }
  return p.join(" e ");
}
export function valorExtenso(valor) {
  valor = Math.round((Number(valor) || 0) * 100) / 100;
  const inteiro = Math.floor(valor), centavos = Math.round((valor - inteiro) * 100);
  let reais;
  if (inteiro === 0) reais = "zero real";
  else {
    const milhares = Math.floor(inteiro / 1000), resto = inteiro % 1000, b = [];
    if (milhares) b.push(milhares === 1 ? "mil" : _ate999(milhares) + " mil");
    if (resto) b.push(_ate999(resto));
    reais = b.join(" e ") + (inteiro === 1 ? " real" : " reais");
  }
  if (centavos) return reais + " e " + _ate999(centavos) + (centavos === 1 ? " centavo" : " centavos");
  return reais;
}

/* ---------------- inputs de formulário ---------------- */
export function Text({ label, value, onInput, type = "text", placeholder = "" }) {
  return html`<div class="field"><label>${label}</label>
    <input type=${type} value=${value ?? ""} placeholder=${placeholder}
      onInput=${(e) => onInput(e.target.value)}/></div>`;
}
/* Converte texto pt-BR ("1.234,56" ou "67,50") em número. */
export function parseMoeda(s) {
  s = String(s == null ? "" : s).trim();
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/* Campo de valor (R$). Usa input de texto com estado local para aceitar
   vírgula sem “pular” o cursor; entrega sempre um número ao onInput.
   Sincroniza com mudanças externas (ex.: divisão 50/50) só quando o número
   de fato muda — durante a digitação o texto local nunca é sobrescrito. */
const fmtMoeda = (v) => v == null || v === "" || Number(v) === 0 ? "" : String(v).replace(".", ",");
export function Num({ label, value, onInput }) {
  const [txt, setTxt] = useState(fmtMoeda(value));
  useEffect(() => {
    if (parseMoeda(txt) !== (Number(value) || 0)) setTxt(fmtMoeda(value));
  }, [value]);
  const change = (e) => {
    const s = e.target.value.replace(/[^\d.,]/g, "");
    setTxt(s);
    onInput(parseMoeda(s));
  };
  return html`<div class="field"><label>${label}</label>
    <input type="text" inputmode="decimal" value=${txt} placeholder="0,00" onInput=${change}/></div>`;
}
export function DateF({ label, value, onInput }) {
  return html`<div class="field"><label>${label}</label>
    <input type="date" value=${value ?? ""} onInput=${(e) => onInput(e.target.value)}/></div>`;
}
/* campo somente leitura (para quem não pode editar aquele campo) */
export function ReadOnly({ label, value }) {
  return html`<div class="field"><label>${label}</label>
    <input type="text" readonly value=${value ?? ""}/></div>`;
}
export function Area({ label, value, onInput, rows = 3 }) {
  return html`<div class="field"><label>${label}</label>
    <textarea rows=${rows} onInput=${(e) => onInput(e.target.value)}>${value ?? ""}</textarea></div>`;
}
export function Select({ label, value, onInput, options }) {
  return html`<div class="field"><label>${label}</label>
    <select value=${value} onChange=${(e) => onInput(e.target.value)}>
      ${options.map((o) => html`<option value=${o} selected=${o === value}>${o}</option>`)}
    </select></div>`;
}
/* controle segmentado de escolha única (ex.: resultado Retido/Cancelado).
   tones: mapa opcional { opção: "ok" | "danger" } para colorir o botão ativo. */
export function Segmented({ label, value, options, onInput, tones = {} }) {
  return html`<div class="field"><label>${label}</label>
    <div class="seg">${options.map((o) => html`
      <button type="button" class=${"seg-btn" + (value === o ? " on " + (tones[o] || "") : "")}
        onClick=${() => onInput(o)}>${o}</button>`)}</div></div>`;
}

/* abas (segmented control): options = [[id,label], ...] */
export function Tabs({ value, onInput, options }) {
  return html`<div class="tabs">${options.map(([id, label]) => html`
    <button class=${"tab" + (value === id ? " active" : "")} onClick=${() => onInput(id)}>${label}</button>`)}</div>`;
}

/* seletor de responsável a partir da lista de usuários (nomes) */
export function Assignee({ label = "Responsável", value, onInput, users }) {
  const nomes = (users || []).map((u) => (typeof u === "string" ? u : u.nome)).filter(Boolean);
  const atual = value ?? "";
  const faltando = atual && !nomes.includes(atual) ? [atual] : [];
  return html`<div class="field"><label>${label}</label>
    <select value=${atual} onChange=${(e) => onInput(e.target.value)}>
      <option value="">— não atribuído —</option>
      ${[...nomes, ...faltando].map((n) => html`<option value=${n} selected=${n === atual}>${n}</option>`)}
    </select></div>`;
}

/* --- escopo por responsável (foco pessoal x visão de equipe) --- */
export const GESTORES = ["Admin"];
export const podeVerTudo = (perfil) => GESTORES.includes(perfil);
/* só o Admin altera campos sensíveis (responsável, prioridade, tipo, título, prazo) e exclui */
export const ehAdmin = (user) => !!user && user.perfil === "Admin";
export const ehMeu = (row, user) => (row.responsavel || "") === (user && user.nome);
export const aplicarEscopo = (rows, user, escopo) =>
  escopo === "todas" ? rows : rows.filter((r) => ehMeu(r, user));

/* filtro multi-opções em <select multiple> simplificado: usa um select simples "Todos" + valor */
export function FilterSelect({ label, value, onInput, options }) {
  return html`<div style="min-width:150px"><label>${label || "Filtro"}</label>
    <select value=${value} onChange=${(e) => onInput(e.target.value)}>
      <option value="">Todos</option>
      ${options.map((o) => html`<option value=${o} selected=${o === value}>${o}</option>`)}
    </select></div>`;
}

/* ---------------- utilitário de cópia ---------------- */
export async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); toast("Copiado para a área de transferência."); }
  catch (e) { toast("Não foi possível copiar.", "err"); }
}

/* ---------------- export CSV (anti-injeção) ---------------- */
export function baixarCSV(nome, columns, rows) {
  const esc = (v) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const head = columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(",")).join("\n");
  const blob = new Blob(["﻿" + head + "\n" + body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome + ".csv";
  a.click();
}

/* ======================================================================
   REGRAS DE NEGÓCIO
   ====================================================================== */

/* --- cobrança: régua 7·14·21·28·60 --- */
export const REGUA = [7, 14, 21, 28, 60];
export function reguaEstagio(dias) {
  let m = 0; for (const d of REGUA) if (dias >= d) m = d; return m;
}
export function mensagemCobranca(nome, dias, valor) {
  const v = brl(valor), m = reguaEstagio(dias);
  if (m === 0) return `Olá ${nome}! Passando para lembrar da mensalidade de ${v}. Qualquer coisa estamos à disposição para ajudar. 💙`;
  if (m === 7) return `Olá ${nome}! Identificamos a mensalidade de ${v} em aberto há ${dias} dias. Conseguimos regularizar hoje? Posso te enviar a 2ª via.`;
  if (m === 14) return `Oi ${nome}, tudo bem? Sua pendência de ${v} está há ${dias} dias em aberto. Podemos combinar uma data para o pagamento? Estou aqui para facilitar.`;
  if (m === 21) return `${nome}, seu débito de ${v} (${dias} dias) segue em aberto. Para evitar bloqueios de acesso, vamos resolver juntos? Temos opções de negociação.`;
  if (m === 28) return `${nome}, atenção: sua mensalidade de ${v} está há ${dias} dias vencida. Precisamos regularizar esta semana para manter sua matrícula ativa.`;
  return `${nome}, seu débito de ${v} ultrapassou ${dias} dias. Para evitar a negativação, é essencial regularizar. Vamos negociar condições especiais o quanto antes.`;
}

/* --- churn --- */
const PESO_MOTIVO = { financeiro: 30, "baixo uso": 28, metodologia: 22, professor: 20, plataforma: 18, tempo: 15, horários: 12 };
const PESO_NIVEL = { baixo: 10, médio: 30, alto: 55 };
const OFERTA = { metodologia: "Reavaliação acadêmica", horários: "Ajuste de agenda", tempo: "Ajuste de agenda", "baixo uso": "Aulas particulares", financeiro: "Plano de retomada leve", professor: "Mudança de professor", plataforma: "Extensão" };
export function churnScore(motivo, nivel, hist = 0) {
  return Math.min((PESO_MOTIVO[motivo] || 15) + (PESO_NIVEL[nivel] || 30) + Math.min(hist * 3, 15), 100);
}
export const ofertaRetencao = (motivo) => OFERTA[motivo] || "Plano de retomada leve";

/* --- listas de domínio --- */
export const DOM = {
  tarefa_tipo: ["Atendimento", "Cobrança", "Cancelamento", "Reembolso", "Retenção", "Acadêmico", "Financeiro", "Produto", "Reclame Aqui"],
  prioridade: ["Baixa", "Média", "Alta", "Crítica"],
  tarefa_status: ["Aberta", "Em andamento", "Aguardando outra área", "Concluída", "Cancelada"],
  cancel_status: ["Recebido", "Em análise", "Aguardando diretoria", "Aguardando financeiro", "Finalizado"],
  cobr_status: ["1º contato", "2º contato", "3º contato", "Pré-negativação", "Regularizado"],
  ret_motivo: ["financeiro", "tempo", "metodologia", "professor", "plataforma", "horários", "baixo uso"],
  ret_nivel: ["baixo", "médio", "alto"],
  ret_resultado: ["Retido", "Cancelou", "Em acompanhamento"],
  cons_tipo: ["Private", "Black", "Retenção"],
  cons_status: ["Solicitada", "Aprovada", "Agendada", "Realizada", "Cancelada"],
  pb_categoria: ["FAQ", "Processos", "Guia da plataforma", "Cobrança", "Cancelamento", "Retenção", "Reembolso", "Aluno agressivo", "Problemas com plataforma", "Problemas com professor", "Reclame Aqui", "Dúvidas sobre contrato"],
  voc_categoria: ["Plataforma", "Professor", "Horário", "Metodologia", "Comercial", "Financeiro", "Atendimento"],
  voc_tipo: ["elogio", "reclamação", "sugestão"],
  gravidade: ["Baixa", "Média", "Alta", "Crítica"],
  voc_status: ["Aberto", "Em tratativa", "Resolvido"],
  area: ["Produto", "Acadêmico", "Comercial", "Financeiro", "CX", "Diretoria"],
  doc_tipo: ["Recibo de pagamento", "Termo de quitação", "Declaração de vínculo", "Termo de cancelamento", "Comprovante de regularização"],
  forma_pagamento: ["PIX", "Cartão de crédito", "Cartão de débito", "Boleto", "Transferência", "Dinheiro"],
  perfil: ["Admin", "Cobrança", "Retenção", "Atendimento"],
  // Caso de cancelamento/retenção (estrutura unificada)
  produto: ["Community Alumni", "Community Flow", "Private", "Espanhol", "Imersão"],
  duracao: ["6 meses", "12 meses"],
  tipo_pagamento: ["Parcelado", "Recorrente"],
  tipo_cancelamento: ["7 dias", "Depois de 7 dias"],
  resultado_caso: ["Em análise", "Retido", "Cancelado"],
  motivo_cancelamento: [
    "Financeiro", "Falta de tempo", "Horários na grade", "Metodologia",
    "Falta de Suporte/pós-venda", "Saúde", "Problema técnico/Plataforma",
    "Qualidade da aula/Professor", "Encontrou outro curso",
    "Mudança pessoal (rotina, trabalho, etc.)", "Desalinhamento com a venda", "Outros",
  ],
};

/* --- controle de acesso por perfil ---
   Regra do gestor: apenas Admin vê Painel Admin e Relatórios. */
const ACESSO = {
  Admin: "*",
  Cobrança: ["dashboard", "tarefas", "cobranca", "recibos", "playbooks", "voc"],
  Retenção: ["dashboard", "tarefas", "cancelamentos", "retencao", "recibos", "playbooks", "voc"],
  Atendimento: ["dashboard", "tarefas", "recibos", "playbooks", "voc"],
};
export const podeAcessar = (perfil, mod) => {
  const r = ACESSO[perfil] || []; return r === "*" || r.includes(mod);
};
