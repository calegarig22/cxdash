/* Consultorias (Private, Black, Retenção) — solicitação, agendamento e alerta Slack.
   Toda nova consultoria dispara alerta no Slack; relatório mensal por data agendada. */
import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { store } from "../lib/store.js";
import { useCollection } from "../lib/hooks.js";
import {
  Badge, Table, Modal, Text, Select, DateF, Area, FilterSelect,
  toast, ExportButtons, todayISO, DOM,
} from "../lib/ui.js";
import { alertarSlack } from "../lib/notify.js";

const nowTs = () =>new Date().toISOString().slice(0, 19).replace("T", " ");
const vazia = (u) => ({ aluno: "", tipo: DOM.cons_tipo[0], solicitante: u ? u.nome : "", data_solicitada: todayISO(), data_agendada: "", responsavel: "", status: DOM.cons_status[0], link_zoom: "", observacoes: "" });

export function View({ user }) {
  const { rows } = useCollection("consultorias", { order: "data_agendada", desc: true });
  const [novo, setNovo] = useState(null);   // objeto em criação
  const [edit, setEdit] = useState(null);   // consultoria em edição
  const [fTipo, setFTipo] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fBusca, setFBusca] = useState("");

  const filtradas = rows.filter((c) =>
    (!fTipo || c.tipo === fTipo) &&
    (!fStatus || c.status === fStatus) &&
    (!fBusca || (c.aluno || "").toLowerCase().includes(fBusca.toLowerCase())));

  const salvarNova = async () => {
    if (!novo.aluno.trim()) return toast("Informe o nome do aluno.", "err");
    const c = await store.insert("consultorias", { ...novo, criado_em: nowTs() });
    await store.logAction(user.email, "consultoria_criada", `${c.tipo} · ${c.aluno}`);
    alertarSlack(`:telephone_receiver: *Nova consultoria ${c.tipo}* — ${c.aluno} (solicitante ${c.solicitante}, resp. ${c.responsavel})`, "consultoria_nova");
    setNovo(null); toast("Consultoria criada — alerta enviado ao Slack.");
  };

  const cols = [
    { key: "id", label: "ID" },
    { key: "aluno", label: "Aluno" },
    { key: "tipo", label: "Tipo" },
    { key: "solicitante", label: "Solicitante" },
    { key: "data_agendada", label: "Agendada" },
    { key: "responsavel", label: "Responsável" },
    { key: "status", label: "Status", render: (r) =>Badge(r.status), csv: (r) =>r.status },
    { key: "link_zoom", label: "Zoom",
      render: (r) =>r.link_zoom ? html`<a href=${r.link_zoom} target="_blank" onClick=${(e) =>e.stopPropagation()}>abrir</a>` : "—",
      csv: (r) =>r.link_zoom || "" },
  ];

  // agrupamento por mês (data_agendada.slice(0,7))
  const porMes = {};
  rows.forEach((r) => { const m = (r.data_agendada || "").slice(0, 7); if (m) porMes[m] = (porMes[m] || 0) + 1; });
  const meses = Object.entries(porMes).map(([mes, total]) => ({ mes, total })).sort((a, b) => (a.mes < b.mes ? 1 : -1));

  return html`
    <h1 class="h1">Consultorias</h1>
    <p class="sub">Controle de consultorias Private, Black e Retenção — cada nova consultoria alerta no Slack.</p>

    <div class="toolbar">
      <button class="btn primary" onClick=${() =>setNovo(vazia(user))}>Nova consultoria</button>
      ${FilterSelect({ label: "Tipo", value: fTipo, onInput: setFTipo, options: DOM.cons_tipo })}
      ${FilterSelect({ label: "Status", value: fStatus, onInput: setFStatus, options: DOM.cons_status })}
      <div class="grow"><label>Aluno</label>
        <input placeholder="buscar por aluno" value=${fBusca} onInput=${(e) =>setFBusca(e.target.value)}/></div>
      ${ExportButtons({ nome: "consultorias", columns: cols, rows: filtradas, titulo: "Consultorias" })}
    </div>
    <div class="count">${filtradas.length} consultoria(s)</div>
    ${Table({ columns: cols, rows: filtradas, onRow: (r) =>setEdit({ ...r }) })}

    <div class="section-t">Consultorias por mês</div>
    ${meses.length ? html`<div class="table-wrap"><table>
      <thead><tr><th>Mês</th><th>Total</th></tr></thead>
      <tbody>${meses.map((m) =>html`<tr><td>${m.mes}</td><td>${m.total}</td></tr>`)}</tbody>
    </table></div>` : html`<div class="empty">Nenhuma consultoria agendada.</div>`}

    ${novo ? html`<${Modal} title="Nova consultoria" onClose=${() =>setNovo(null)}
      footer=${html`<button class="btn" onClick=${() =>setNovo(null)}>Cancelar</button>
        <button class="btn primary" onClick=${salvarNova}>Criar consultoria</button>`}>
      ${Text({ label: "Nome do aluno *", value: novo.aluno, onInput: (v) =>setNovo({ ...novo, aluno: v }) })}
      <div class="row c3">
        ${Select({ label: "Tipo", value: novo.tipo, onInput: (v) =>setNovo({ ...novo, tipo: v }), options: DOM.cons_tipo })}
        ${Text({ label: "Solicitante", value: novo.solicitante, onInput: (v) =>setNovo({ ...novo, solicitante: v }) })}
        ${Text({ label: "Responsável interno", value: novo.responsavel, onInput: (v) =>setNovo({ ...novo, responsavel: v }) })}
      </div>
      <div class="row c3">
        ${DateF({ label: "Data solicitada", value: novo.data_solicitada, onInput: (v) =>setNovo({ ...novo, data_solicitada: v }) })}
        ${DateF({ label: "Data agendada", value: novo.data_agendada, onInput: (v) =>setNovo({ ...novo, data_agendada: v }) })}
        ${Select({ label: "Status", value: novo.status, onInput: (v) =>setNovo({ ...novo, status: v }), options: DOM.cons_status })}
      </div>
      ${Text({ label: "Link Zoom", value: novo.link_zoom, onInput: (v) =>setNovo({ ...novo, link_zoom: v }) })}
      ${Area({ label: "Observações", value: novo.observacoes, onInput: (v) =>setNovo({ ...novo, observacoes: v }) })}
    <//>` : ""}

    ${edit ? html`<${EditModal} user=${user} consultoria=${edit} onClose=${() =>setEdit(null)}/>` : ""}`;
}

function EditModal({ user, consultoria, onClose }) {
  const [c, setC] = useState({ ...consultoria });

  const salvar = async () => {
    await store.update("consultorias", consultoria.id, {
      status: c.status, link_zoom: c.link_zoom, observacoes: c.observacoes,
    });
    await store.logAction(user.email, "consultoria_editada", `#${consultoria.id} ${consultoria.aluno}`);
    toast("Consultoria atualizada."); onClose();
  };
  const excluir = async () => {
    if (!confirm("Excluir esta consultoria?")) return;
    await store.remove("consultorias", consultoria.id);
    await store.logAction(user.email, "consultoria_excluida", `#${consultoria.id}`);
    toast("Consultoria excluída."); onClose();
  };

  return html`<${Modal} title=${"Consultoria #" + consultoria.id + " · " + consultoria.aluno} size="lg" onClose=${onClose}
    footer=${html`<button class="btn danger" onClick=${excluir}>Excluir</button>
      <button class="btn" onClick=${onClose}>Fechar</button>
      <button class="btn primary" onClick=${salvar}>Salvar alterações</button>`}>
    <p class="sub">${c.tipo} · solicitante ${c.solicitante || "—"} · resp. ${c.responsavel || "—"} · agendada ${c.data_agendada || "—"}</p>
    ${Select({ label: "Status", value: c.status, onInput: (v) =>setC({ ...c, status: v }), options: DOM.cons_status })}
    ${Text({ label: "Link Zoom", value: c.link_zoom, onInput: (v) =>setC({ ...c, link_zoom: v }) })}
    ${Area({ label: "Observações", value: c.observacoes, onInput: (v) =>setC({ ...c, observacoes: v }) })}
  <//>`;
}
