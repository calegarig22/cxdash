/* Voice of Customer — feedbacks dos alunos (elogios, reclamações, sugestões).
   Três abas: Dashboard (KPIs + gráficos + críticos + sugestões), Feedbacks
   (tabela filtrável + edição/exclusão) e Novo feedback (form inline).
   Feedback crítico dispara alerta no Slack. */
import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { store } from "../lib/store.js";
import { useCollection, useUsers, useSelecao } from "../lib/hooks.js";
import {
  Badge, Table, Modal, Tabs, Kpi, BarChart, Text, Area, Select, FilterSelect,
  Assignee, BulkBar, aplicarEscopo, podeVerTudo, toast, baixarCSV, DOM,
} from "../lib/ui.js";
import { alertarSlack } from "../lib/notify.js";

const nowTs = () =>new Date().toISOString().slice(0, 19).replace("T", " ");
const vazio = (u) => ({ aluno: "", categoria: DOM.voc_categoria[0], tipo: "reclamação", gravidade: "Média", descricao: "", area: DOM.area[0], acao: "", status: "Aberto", responsavel: u ? u.nome : "" });

/* agrupa por chave e devolve [{label, n}, ...] ordenado desc, cortado em `top` */
function agrupar(rows, key, top) {
  const m = {};
  rows.forEach((r) => { const k = r[key] || "—"; m[k] = (m[k] || 0) + 1; });
  const arr = Object.entries(m).map(([label, n]) => ({ label, n })).sort((a, b) =>b.n - a.n);
  return top ? arr.slice(0, top) : arr;
}

export function View({ user }) {
  const { rows } = useCollection("voc", { order: "id", desc: true });
  const users = useUsers();
  const [aba, setAba] = useState("dashboard");

  return html`
    <h1 class="h1">Feedbacks</h1>
    <p class="sub">Feedbacks dos alunos: elogios, reclamações e sugestões — críticos alertam no Slack.</p>

    ${Tabs({ value: aba, onInput: setAba, options: [
      ["dashboard", "Dashboard"], ["lista", "Feedbacks"], ["novo", "Novo feedback"]] })}

    ${aba === "dashboard" ? html`<${Dashboard} rows=${rows}/>` : ""}
    ${aba === "lista" ? html`<${Lista} user=${user} users=${users} rows=${rows}/>` : ""}
    ${aba === "novo" ? html`<${Novo} user=${user} users=${users} onSalvo=${() =>setAba("lista")}/>` : ""}`;
}

/* ============================== DASHBOARD ============================== */
function Dashboard({ rows }) {
  if (!rows.length) return html`<div class="empty">Sem feedbacks registrados ainda.</div>`;
  const recl = rows.filter((r) =>r.tipo === "reclamação");
  const crit = rows.filter((r) =>r.gravidade === "Crítica");
  const sug = rows.filter((r) =>r.tipo === "sugestão");
  const sugPorCat = agrupar(sug, "categoria");

  return html`
    <div class="grid c3">
      ${Kpi({ label: "Total de feedbacks", val: rows.length })}
      ${Kpi({ label: "Reclamações", val: recl.length })}
      ${Kpi({ label: "Feedbacks críticos", val: crit.length, tone: "alert" })}
    </div>

    <div class="grid c2">
      <div class="card">
        <div class="section-t">Top 5 motivos de reclamação (por categoria)</div>
        ${recl.length ? BarChart({ data: agrupar(recl, "categoria", 5) }) : html`<div class="empty">Sem reclamações.</div>`}
      </div>
      <div class="card">
        <div class="section-t">Reclamações por área responsável</div>
        ${recl.length ? BarChart({ data: agrupar(recl, "area") }) : html`<div class="empty">Sem reclamações.</div>`}
      </div>
    </div>

    <div class="card">
      <div class="section-t">Feedbacks críticos</div>
      ${crit.length ? crit.map((r) =>html`<div class="h-item">
        ${Badge(r.tipo)} <b>${r.categoria}</b> · ${r.area}: ${r.descricao} ${Badge(r.status)}
      </div>`) : html`<span style="color:#9ca3af">Nenhum feedback crítico.</span>`}
    </div>

    <div class="card">
      <div class="section-t">Sugestões recorrentes</div>
      ${sugPorCat.length ? sugPorCat.map((s) =>html`<div class="h-item"><b>${s.label}</b>: ${s.n} sugestão(ões)</div>`)
        : html`<span style="color:#9ca3af">Sem sugestões registradas.</span>`}
    </div>`;
}

/* ================================ LISTA ================================ */
function Lista({ user, users, rows }) {
  const verTudo = podeVerTudo(user.perfil);
  const [escopo, setEscopo] = useState("minhas");
  const [edit, setEdit] = useState(null);
  const [fCat, setFCat] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fStatus, setFStatus] = useState("");

  const base = aplicarEscopo(rows, user, verTudo ? escopo : "minhas");
  const filtradas = base.filter((r) =>
    (!fCat || r.categoria === fCat) &&
    (!fTipo || r.tipo === fTipo) &&
    (!fStatus || r.status === fStatus));

  const { sel, toggle, toggleAll, clear } = useSelecao();
  const bulkResolver = async () => {
    const ids = [...sel];
    if (!ids.length) return;
    if (!confirm(`Marcar ${ids.length} feedback(s) como resolvido(s)?`)) return;
    await store.bulkUpdate("voc", ids, { status: "Resolvido" });
    await store.logAction(user.email, "voc_resolvidos_massa", `${ids.length} feedback(s)`);
    clear(); toast(`${ids.length} feedback(s) resolvido(s).`);
  };
  const bulkExcluir = async () => {
    const ids = [...sel];
    if (!confirm(`Excluir ${ids.length} feedback(s)? Essa ação não pode ser desfeita.`)) return;
    await store.bulkRemove("voc", ids);
    await store.logAction(user.email, "voc_excluidos_massa", `${ids.length} feedback(s)`);
    clear(); toast(`${ids.length} feedback(s) excluído(s).`);
  };

  const cols = [
    { key: "id", label: "ID" },
    { key: "aluno", label: "Aluno" },
    { key: "categoria", label: "Categoria" },
    { key: "tipo", label: "Tipo", render: (r) =>Badge(r.tipo), csv: (r) =>r.tipo },
    { key: "gravidade", label: "Gravidade" },
    { key: "descricao", label: "Descrição" },
    { key: "area", label: "Área" },
    { key: "responsavel", label: "Responsável" },
    { key: "status", label: "Status", render: (r) =>Badge(r.status), csv: (r) =>r.status },
    { key: "acao", label: "Ação" },
  ];

  return html`
    ${verTudo ? html`<div style="margin-bottom:14px">${Tabs({ value: escopo, onInput: setEscopo,
      options: [["minhas", "Minhas"], ["todas", "Equipe (todas)"]] })}</div>` : ""}

    <div class="toolbar">
      ${FilterSelect({ label: "Categoria", value: fCat, onInput: setFCat, options: DOM.voc_categoria })}
      ${FilterSelect({ label: "Tipo", value: fTipo, onInput: setFTipo, options: DOM.voc_tipo })}
      ${FilterSelect({ label: "Status", value: fStatus, onInput: setFStatus, options: DOM.voc_status })}
      <div class="grow"></div>
      <button class="btn" onClick=${() =>baixarCSV("voice_of_customer", cols, filtradas)}>Exportar</button>
    </div>
    <div class="count">${filtradas.length} feedback(s)${verTudo && escopo === "todas" ? " · equipe" : " · minhas"}</div>
    ${BulkBar({ n: sel.size, onClear: clear, actions: [
      { label: `Resolver (${sel.size})`, kind: "ok", on: bulkResolver },
      { label: `Excluir (${sel.size})`, kind: "danger", on: bulkExcluir },
    ] })}
    ${Table({ columns: cols, rows: filtradas, onRow: (r) =>setEdit({ ...r }), sel, onSel: toggle, onSelAll: toggleAll })}

    ${edit ? html`<${EditModal} user=${user} users=${users} fb=${edit} onClose=${() =>setEdit(null)}/>` : ""}`;
}

function EditModal({ user, users, fb, onClose }) {
  const [f, setF] = useState({ ...fb });

  const salvar = async () => {
    await store.update("voc", fb.id, { status: f.status, area: f.area, acao: f.acao, responsavel: f.responsavel });
    await store.logAction(user.email, "voc_editado", `#${fb.id}`);
    toast("Feedback atualizado."); onClose();
  };
  const excluir = async () => {
    if (!confirm("Excluir este feedback?")) return;
    await store.remove("voc", fb.id);
    await store.logAction(user.email, "voc_excluido", `#${fb.id}`);
    toast("Feedback excluído."); onClose();
  };

  return html`<${Modal} title=${"Feedback #" + fb.id} onClose=${onClose}
    footer=${html`<button class="btn danger" onClick=${excluir}>Excluir</button>
      <button class="btn" onClick=${onClose}>Fechar</button>
      <button class="btn primary" onClick=${salvar}>Salvar alterações</button>`}>
    <div class="h-item"><b>${fb.categoria}</b> / ${Badge(fb.tipo)} · Gravidade: ${fb.gravidade} · Aluno: ${fb.aluno || "N/I"}</div>
    <div class="h-item">${fb.descricao}</div>
    <div class="row c2">
      ${Select({ label: "Status", value: f.status, onInput: (v) =>setF({ ...f, status: v }), options: DOM.voc_status })}
      ${Select({ label: "Área responsável", value: f.area, onInput: (v) =>setF({ ...f, area: v }), options: DOM.area })}
    </div>
    ${Assignee({ value: f.responsavel, onInput: (v) =>setF({ ...f, responsavel: v }), users })}
    ${Text({ label: "Ação tomada", value: f.acao, onInput: (v) =>setF({ ...f, acao: v }) })}
  <//>`;
}

/* ================================= NOVO ================================= */
function Novo({ user, users, onSalvo }) {
  const [f, setF] = useState(vazio(user));

  const salvar = async () => {
    if (!f.descricao.trim()) return toast("Descreva o feedback.", "err");
    await store.insert("voc", { ...f, criado_em: nowTs() });
    await store.logAction(user.email, "voc_criado", `${f.categoria}/${f.tipo}`);
    if (f.gravidade === "Crítica") {
      alertarSlack(`:loudspeaker: *Feedback CRÍTICO* — ${f.categoria}/${f.tipo} (aluno ${f.aluno || "N/I"}, área ${f.area}): ${f.descricao.slice(0, 140)}`, "voc_critico");
      toast("Feedback crítico — alerta enviado ao Slack.", "warn");
    }
    toast("Feedback registrado.");
    setF(vazio(user));
    onSalvo();
  };

  return html`<div class="card">
    <div class="section-t">Registrar novo feedback</div>
    <div class="row c3">
      ${Text({ label: "Nome do aluno", value: f.aluno, onInput: (v) =>setF({ ...f, aluno: v }) })}
      ${Select({ label: "Categoria", value: f.categoria, onInput: (v) =>setF({ ...f, categoria: v }), options: DOM.voc_categoria })}
      ${Select({ label: "Tipo", value: f.tipo, onInput: (v) =>setF({ ...f, tipo: v }), options: DOM.voc_tipo })}
    </div>
    <div class="row c3">
      ${Select({ label: "Gravidade", value: f.gravidade, onInput: (v) =>setF({ ...f, gravidade: v }), options: DOM.gravidade })}
      ${Select({ label: "Área responsável", value: f.area, onInput: (v) =>setF({ ...f, area: v }), options: DOM.area })}
      ${Select({ label: "Status", value: f.status, onInput: (v) =>setF({ ...f, status: v }), options: DOM.voc_status })}
    </div>
    ${Assignee({ value: f.responsavel, onInput: (v) =>setF({ ...f, responsavel: v }), users })}
    ${Area({ label: "Descrição *", value: f.descricao, onInput: (v) =>setF({ ...f, descricao: v }) })}
    ${Text({ label: "Ação tomada", value: f.acao, onInput: (v) =>setF({ ...f, acao: v }) })}
    <div class="toolbar">
      <button class="btn primary" onClick=${salvar}>Registrar feedback</button>
    </div>
  </div>`;
}
