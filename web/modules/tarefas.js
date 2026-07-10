/* Gestão de Tarefas do CX — MÓDULO DE REFERÊNCIA (padrão de CRUD).
   Demonstra: form de criação, filtros, tabela com destaque de vencidas,
   modal de edição com histórico, export CSV, alerta Slack em tarefa crítica. */
import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { store } from "../lib/store.js";
import { useCollection, useUsers, useSelecao } from "../lib/hooks.js";
import {
  Badge, Table, Modal, Text, Select, DateF, Area, FilterSelect, Assignee, ReadOnly, Tabs, BulkBar,
  toast, ExportButtons, diasPara, DOM, aplicarEscopo, podeVerTudo, ehAdmin,
} from "../lib/ui.js";
import { alertarSlack } from "../lib/notify.js";

const nowTs = () =>new Date().toISOString().slice(0, 19).replace("T", " ");
const vazia = (u) => ({ titulo: "", tipo: DOM.tarefa_tipo[0], responsavel: u ? u.nome : "", prioridade: "Média", status: "Aberta", prazo: new Date().toISOString().slice(0, 10), observacoes: "" });
const CONCLUIDA = (s) => ["Concluída", "Cancelada"].includes(s);

/* conclui uma tarefa: marca como Concluída, registra no histórico e avisa o Slack (gestor + equipe) */
async function concluirTarefa(user, t) {
  await store.update("tarefas", t.id, { status: "Concluída" });
  await store.insert("tarefa_hist", { pai: t.id, ts: nowTs(), usuario: user.nome, texto: "Tarefa marcada como concluída." });
  await store.logAction(user.email, "tarefa_concluida", `#${t.id} ${t.titulo}`);
  alertarSlack(`:white_check_mark: *Tarefa concluída* — ${t.titulo}\nPor: ${user.nome} · Tipo: ${t.tipo || "—"} · Resp.: ${t.responsavel || "—"}`, "tarefa_concluida");
}

export function View({ user }) {
  const { rows } = useCollection("tarefas", { order: "prazo" });
  const users = useUsers();
  const verTudo = podeVerTudo(user.perfil);
  const admin = ehAdmin(user);
  const [escopo, setEscopo] = useState("minhas");
  const [novo, setNovo] = useState(null);   // objeto em criação
  const [edit, setEdit] = useState(null);   // tarefa em edição
  const [fStatus, setFStatus] = useState("");
  const [fPrio, setFPrio] = useState("");
  const [fResp, setFResp] = useState("");

  const base = aplicarEscopo(rows, user, verTudo ? escopo : "minhas");
  const filtradas = base.filter((t) =>
    (!fStatus || t.status === fStatus) &&
    (!fPrio || t.prioridade === fPrio) &&
    (!fResp || (t.responsavel || "").toLowerCase().includes(fResp.toLowerCase())));

  const salvarNova = async () => {
    if (!novo.titulo.trim()) return toast("Informe o título da tarefa.", "err");
    const t = await store.insert("tarefas", { ...novo, criado_em: nowTs() });
    await store.insert("tarefa_hist", { pai: t.id, ts: nowTs(), usuario: user.nome, texto: `Tarefa criada (status '${t.status}').` });
    await store.logAction(user.email, "tarefa_criada", t.titulo);
    if (t.prioridade === "Crítica") {
      alertarSlack(`:rotating_light: *Tarefa CRÍTICA criada* — ${t.titulo}\nTipo: ${t.tipo} · Resp.: ${t.responsavel} · Prazo: ${t.prazo}`, "tarefa_critica");
      toast("Tarefa crítica — alerta enviado ao Slack.", "warn");
    }
    setNovo(null); toast("Tarefa criada com sucesso!");
  };

  const concluir = async (t) => {
    if (CONCLUIDA(t.status)) return;
    await concluirTarefa(user, t);
    toast("Tarefa concluída — equipe avisada no Slack.");
  };

  const { sel, toggle, toggleAll, clear } = useSelecao();
  const bulkConcluir = async () => {
    const ids = [...sel].filter((id) => { const t = rows.find((r) => r.id === id); return t && !CONCLUIDA(t.status); });
    if (!ids.length) return toast("Nada a concluir na seleção.", "warn");
    if (!confirm(`Concluir ${ids.length} tarefa(s)?`)) return;
    await store.bulkUpdate("tarefas", ids, { status: "Concluída" });
    await store.logAction(user.email, "tarefas_concluidas_massa", `${ids.length} tarefa(s)`);
    alertarSlack(`:white_check_mark: *${ids.length} tarefa(s) concluídas* por ${user.nome}.`, "tarefa_concluida");
    clear(); toast(`${ids.length} tarefa(s) concluída(s) — equipe avisada no Slack.`);
  };
  const bulkExcluir = async () => {
    const ids = [...sel];
    if (!confirm(`Excluir ${ids.length} tarefa(s)? Essa ação não pode ser desfeita.`)) return;
    await store.bulkRemove("tarefas", ids);
    await store.logAction(user.email, "tarefas_excluidas_massa", `${ids.length} tarefa(s)`);
    clear(); toast(`${ids.length} tarefa(s) excluída(s).`);
  };

  const cols = [
    { key: "titulo", label: "Título" },
    { key: "tipo", label: "Tipo" },
    { key: "responsavel", label: "Responsável" },
    { key: "prioridade", label: "Prioridade", render: (r) =>Badge(r.prioridade), csv: (r) =>r.prioridade },
    { key: "status", label: "Status", render: (r) =>Badge(r.status), csv: (r) =>r.status },
    { key: "prazo", label: "Prazo" },
    { label: "Situação", key: "sit", render: (r) => {
        const d = diasPara(r.prazo), venc = d < 0 && !CONCLUIDA(r.status);
        return venc ? html`<b style="color:#dc2626">VENCIDA</b>` : (d === 0 ? "Hoje" : `${d}d`);
      }, csv: (r) =>diasPara(r.prazo) + "d" },
    { label: "Ação", key: "acao", render: (r) => CONCLUIDA(r.status)
        ? html`<span class="done-tag">✓ ${r.status}</span>`
        : html`<button class="btn sm ok" onClick=${(e) => { e.stopPropagation(); concluir(r); }}>Concluir</button>` },
  ];
  const rowClass = (r) => (diasPara(r.prazo) < 0 && !["Concluída", "Cancelada"].includes(r.status) ? "overdue" : "");

  return html`
    <h1 class="h1">Gestão de Tarefas do CX</h1>
    <p class="sub">${verTudo
      ? "Suas tarefas em destaque; alterne para ver as da equipe. Vencidas em vermelho, críticas alertam no Slack."
      : "Suas tarefas — vencidas em vermelho. Muitas chegam automáticas, a partir das cobranças, cancelamentos e churn."}</p>

    ${verTudo ? html`<div style="margin-bottom:14px">${Tabs({ value: escopo, onInput: setEscopo,
      options: [["minhas", "Minhas"], ["todas", "Equipe (todas)"]] })}</div>` : ""}

    <div class="toolbar">
      ${admin ? html`<button class="btn primary" onClick=${() =>setNovo(vazia(user))}>Nova tarefa</button>` : ""}
      ${FilterSelect({ label: "Status", value: fStatus, onInput: setFStatus, options: DOM.tarefa_status })}
      ${FilterSelect({ label: "Prioridade", value: fPrio, onInput: setFPrio, options: DOM.prioridade })}
      ${verTudo && escopo === "todas" ? html`<div class="grow"><label>Responsável</label>
        <input placeholder="filtrar por responsável" value=${fResp} onInput=${(e) =>setFResp(e.target.value)}/></div>` : ""}
      ${ExportButtons({ nome: "tarefas", columns: cols, rows: filtradas, titulo: "Tarefas" })}
    </div>
    <div class="count">${filtradas.length} tarefa(s)${verTudo && escopo === "todas" ? " · equipe" : " · minhas"}</div>
    ${BulkBar({ n: sel.size, onClear: clear, actions: [
      { label: `Concluir (${sel.size})`, kind: "ok", on: bulkConcluir },
      admin ? { label: `Excluir (${sel.size})`, kind: "danger", on: bulkExcluir } : null,
    ] })}
    ${Table({ columns: cols, rows: filtradas, onRow: (r) =>setEdit({ ...r }), rowClass, sel, onSel: toggle, onSelAll: toggleAll })}

    ${novo ? html`<${Modal} title="Nova tarefa" onClose=${() =>setNovo(null)}
      footer=${html`<button class="btn" onClick=${() =>setNovo(null)}>Cancelar</button>
        <button class="btn primary" onClick=${salvarNova}>Criar tarefa</button>`}>
      ${Text({ label: "Título da tarefa *", value: novo.titulo, onInput: (v) =>setNovo({ ...novo, titulo: v }) })}
      <div class="row c2">
        ${Select({ label: "Tipo", value: novo.tipo, onInput: (v) =>setNovo({ ...novo, tipo: v }), options: DOM.tarefa_tipo })}
        ${Assignee({ value: novo.responsavel, onInput: (v) =>setNovo({ ...novo, responsavel: v }), users })}
      </div>
      <div class="row c3">
        ${Select({ label: "Prioridade", value: novo.prioridade, onInput: (v) =>setNovo({ ...novo, prioridade: v }), options: DOM.prioridade })}
        ${Select({ label: "Status", value: novo.status, onInput: (v) =>setNovo({ ...novo, status: v }), options: DOM.tarefa_status })}
        ${DateF({ label: "Prazo", value: novo.prazo, onInput: (v) =>setNovo({ ...novo, prazo: v }) })}
      </div>
      ${Area({ label: "Observações", value: novo.observacoes, onInput: (v) =>setNovo({ ...novo, observacoes: v }) })}
    <//>` : ""}

    ${edit ? html`<${EditModal} user=${user} users=${users} tarefa=${edit} onClose=${() =>setEdit(null)}/>` : ""}`;
}

function EditModal({ user, users, tarefa, onClose }) {
  const [t, setT] = useState({ ...tarefa });
  const [nota, setNota] = useState("");
  const admin = ehAdmin(user);
  const { rows: hist } = useCollection("tarefa_hist");
  const meuHist = hist.filter((h) =>h.pai === tarefa.id).sort((a, b) => (a.id < b.id ? 1 : -1));

  const salvar = async () => {
    // não-admin só pode mexer em status e observações; os demais campos ficam intactos
    const patch = admin
      ? { titulo: t.titulo, tipo: t.tipo, responsavel: t.responsavel, prioridade: t.prioridade, status: t.status, prazo: t.prazo, observacoes: t.observacoes }
      : { status: t.status, observacoes: t.observacoes };
    const mud = [];
    if (t.status !== tarefa.status) mud.push(`status '${tarefa.status}'→'${t.status}'`);
    if (admin && t.prioridade !== tarefa.prioridade) mud.push(`prioridade '${tarefa.prioridade}'→'${t.prioridade}'`);
    if (admin && t.responsavel !== tarefa.responsavel) mud.push(`responsável '${tarefa.responsavel}'→'${t.responsavel}'`);
    await store.update("tarefas", tarefa.id, patch);
    const texto = (nota ? nota + " | " : "") + (mud.length ? mud.join("; ") : "Atualização de dados.");
    await store.insert("tarefa_hist", { pai: tarefa.id, ts: nowTs(), usuario: user.nome, texto });
    await store.logAction(user.email, "tarefa_editada", `#${tarefa.id} ${t.titulo}`);
    if (admin && t.prioridade === "Crítica" && tarefa.prioridade !== "Crítica")
      alertarSlack(`:rotating_light: *Tarefa elevada a CRÍTICA* — ${t.titulo}`, "tarefa_critica");
    if (t.status === "Concluída" && tarefa.status !== "Concluída")
      alertarSlack(`:white_check_mark: *Tarefa concluída* — ${t.titulo}\nPor: ${user.nome} · Tipo: ${t.tipo || "—"} · Resp.: ${t.responsavel || "—"}`, "tarefa_concluida");
    toast("Tarefa atualizada."); onClose();
  };
  const concluir = async () => {
    await concluirTarefa(user, { ...t, id: tarefa.id });
    toast("Tarefa concluída — equipe avisada no Slack."); onClose();
  };
  const excluir = async () => {
    if (!confirm("Excluir esta tarefa?")) return;
    await store.remove("tarefas", tarefa.id);
    await store.logAction(user.email, "tarefa_excluida", `#${tarefa.id}`);
    toast("Tarefa excluída."); onClose();
  };

  return html`<${Modal} title=${"Tarefa #" + tarefa.id} size="lg" onClose=${onClose}
    footer=${html`${admin ? html`<button class="btn danger" onClick=${excluir}>Excluir</button>` : ""}
      ${!CONCLUIDA(t.status) ? html`<button class="btn ok" onClick=${concluir}>Concluir tarefa</button>` : ""}
      <span style="flex:1"></span>
      <button class="btn" onClick=${onClose}>Fechar</button>
      <button class="btn primary" onClick=${salvar}>Salvar alterações</button>`}>
    ${admin
      ? Text({ label: "Título", value: t.titulo, onInput: (v) =>setT({ ...t, titulo: v }) })
      : ReadOnly({ label: "Título", value: t.titulo })}
    <div class="row c2">
      ${admin
        ? Select({ label: "Tipo", value: t.tipo, onInput: (v) =>setT({ ...t, tipo: v }), options: DOM.tarefa_tipo })
        : ReadOnly({ label: "Tipo", value: t.tipo })}
      ${admin
        ? Assignee({ value: t.responsavel, onInput: (v) =>setT({ ...t, responsavel: v }), users })
        : ReadOnly({ label: "Responsável", value: t.responsavel })}
    </div>
    <div class="row c3">
      ${admin
        ? Select({ label: "Prioridade", value: t.prioridade, onInput: (v) =>setT({ ...t, prioridade: v }), options: DOM.prioridade })
        : ReadOnly({ label: "Prioridade", value: t.prioridade })}
      ${Select({ label: "Status", value: t.status, onInput: (v) =>setT({ ...t, status: v }), options: DOM.tarefa_status })}
      ${admin
        ? DateF({ label: "Prazo", value: t.prazo, onInput: (v) =>setT({ ...t, prazo: v }) })
        : ReadOnly({ label: "Prazo", value: t.prazo })}
    </div>
    ${Area({ label: "Observações", value: t.observacoes, onInput: (v) =>setT({ ...t, observacoes: v }) })}
    ${Text({ label: "Nota para o histórico (o que mudou?)", value: nota, onInput: setNota })}
    <div class="section-t">Histórico de atualizações</div>
    <div class="hist">${meuHist.length ? meuHist.map((h) =>html`<div class="h-item"><code>${h.ts}</code> <b>${h.usuario}</b>: ${h.texto}</div>`) : html`<span style="color:#9ca3af">Sem histórico.</span>`}</div>
  <//>`;
}
