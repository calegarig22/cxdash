/* Cobrança e Inadimplência — régua de contato 7·14·21·28·60 dias.
   Banner de críticos (>60d), mensagens prontas por estágio e alerta ao Slack. */
import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { store } from "../lib/store.js";
import { useCollection, useUsers, useSelecao } from "../lib/hooks.js";
import {
  Badge, Table, Modal, Text, Num, DateF, Area, Select, FilterSelect, Assignee, Tabs, BulkBar,
  toast, copiar, ExportButtons, brl, diasDesde, reguaEstagio, mensagemCobranca, DOM,
  aplicarEscopo, podeVerTudo,
} from "../lib/ui.js";
import { alertarSlack } from "../lib/notify.js";

const nowTs = () =>new Date().toISOString().slice(0, 19).replace("T", " ");
const vazia = (u) => ({ aluno: "", valor: 0, vencimento: new Date().toISOString().slice(0, 10), status: DOM.cobr_status[0], ultima_mensagem: "", proxima_acao: "", responsavel: u ? u.nome : "", observacoes: "" });

export function View({ user }) {
  const { rows } = useCollection("cobrancas", { order: "vencimento" });
  const users = useUsers();
  const verTudo = podeVerTudo(user.perfil);
  const [escopo, setEscopo] = useState("minhas");
  const [novo, setNovo] = useState(null);   // objeto em criação
  const [edit, setEdit] = useState(null);   // cobrança em edição
  const [fStatus, setFStatus] = useState("");
  const [fBusca, setFBusca] = useState("");

  const base = aplicarEscopo(rows, user, verTudo ? escopo : "minhas");
  const filtradas = base.filter((r) =>
    (!fStatus || r.status === fStatus) &&
    (!fBusca || (r.aluno || "").toLowerCase().includes(fBusca.toLowerCase())));

  const criticos = filtradas.filter((r) =>r.status !== "Regularizado" && (diasDesde(r.vencimento) || 0) >= 60);

  const salvarNovo = async () => {
    if (!novo.aluno.trim()) return toast("Informe o nome do aluno.", "err");
    const r = await store.insert("cobrancas", { ...novo, criado_em: nowTs() });
    await store.logAction(user.email, "cobranca_criada", r.aluno);
    setNovo(null); toast("Registro criado com sucesso!");
  };

  const enviarAlertas = async () => {
    for (const r of criticos) {
      const dias = diasDesde(r.vencimento) || 0;
      await alertarSlack(`:money_with_wings: *Inadimplência >60 dias* — ${r.aluno} (${dias}d, ${brl(r.valor)}) · ${r.status}`, "cobranca_60d");
    }
    toast(`${criticos.length} alerta(s) enviados ao Slack.`, "warn");
  };

  const { sel, toggle, toggleAll, clear } = useSelecao();
  const bulkRegularizar = async () => {
    const ids = [...sel];
    if (!ids.length) return;
    if (!confirm(`Marcar ${ids.length} cobrança(s) como regularizada(s)?`)) return;
    await store.bulkUpdate("cobrancas", ids, { status: "Regularizado" });
    await store.logAction(user.email, "cobrancas_regularizadas_massa", `${ids.length}`);
    clear(); toast(`${ids.length} cobrança(s) marcada(s) como regularizada(s).`);
  };
  const bulkExcluir = async () => {
    const ids = [...sel];
    if (!confirm(`Excluir ${ids.length} cobrança(s)? Essa ação não pode ser desfeita.`)) return;
    await store.bulkRemove("cobrancas", ids);
    await store.logAction(user.email, "cobrancas_excluidas_massa", `${ids.length}`);
    clear(); toast(`${ids.length} cobrança(s) excluída(s).`);
  };

  const cols = [
    { key: "id", label: "ID" },
    { key: "aluno", label: "Aluno" },
    { key: "valor", label: "Valor", render: (r) =>brl(r.valor), csv: (r) =>brl(r.valor) },
    { key: "vencimento", label: "Vencimento" },
    { key: "atraso", label: "Dias atraso", render: (r) =>diasDesde(r.vencimento) ?? 0, csv: (r) =>diasDesde(r.vencimento) ?? 0 },
    { key: "regua", label: "Régua", render: (r) => { const d = diasDesde(r.vencimento) || 0; return d >0 ? reguaEstagio(d) + "d" : "—"; }, csv: (r) => { const d = diasDesde(r.vencimento) || 0; return d >0 ? reguaEstagio(d) + "d" : "—"; } },
    { key: "status", label: "Status", render: (r) =>Badge(r.status), csv: (r) =>r.status },
    { key: "responsavel", label: "Responsável" },
  ];
  const rowClass = (r) => (r.status !== "Regularizado" && (diasDesde(r.vencimento) || 0) >= 60 ? "overdue" : "");

  return html`
    <h1 class="h1">Cobrança e Inadimplência</h1>
    <p class="sub">Régua de contato 7 · 14 · 21 · 28 · 60 dias e mensagens prontas por estágio.</p>

    ${verTudo ? html`<div style="margin-bottom:14px">${Tabs({ value: escopo, onInput: setEscopo,
      options: [["minhas", "Minhas"], ["todas", "Equipe (todas)"]] })}</div>` : ""}

    <div class="toolbar">
      <button class="btn primary" onClick=${() =>setNovo(vazia(user))}>Novo registro</button>
      ${FilterSelect({ label: "Status", value: fStatus, onInput: setFStatus, options: DOM.cobr_status })}
      <div class="grow"><label>Aluno</label>
        <input placeholder="buscar aluno" value=${fBusca} onInput=${(e) =>setFBusca(e.target.value)}/></div>
      ${ExportButtons({ nome: "cobrancas", columns: cols, rows: filtradas, titulo: "Cobranças" })}
    </div>

    ${criticos.map((r) =>html`<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:8px 14px;border-radius:10px;margin-bottom:8px">
      <b>${r.aluno}</b>está há ${diasDesde(r.vencimento) || 0} dias em atraso (${brl(r.valor)}).</div>`)}
    ${criticos.length ? html`<div style="margin-bottom:12px">
      <button class="btn danger" onClick=${enviarAlertas}>Enviar alertas ao Slack (>60 dias)</button></div>` : ""}

    <div class="count">${filtradas.length} registro(s)${verTudo && escopo === "todas" ? " · equipe" : " · minhas"}</div>
    ${BulkBar({ n: sel.size, onClear: clear, actions: [
      { label: `Marcar regularizada (${sel.size})`, kind: "ok", on: bulkRegularizar },
      { label: `Excluir (${sel.size})`, kind: "danger", on: bulkExcluir },
    ] })}
    ${Table({ columns: cols, rows: filtradas, onRow: (r) =>setEdit({ ...r }), rowClass, sel, onSel: toggle, onSelAll: toggleAll })}

    ${novo ? html`<${Modal} title="Novo registro de cobrança" onClose=${() =>setNovo(null)}
      footer=${html`<button class="btn" onClick=${() =>setNovo(null)}>Cancelar</button>
        <button class="btn primary" onClick=${salvarNovo}>Registrar</button>`}>
      ${Text({ label: "Nome do aluno *", value: novo.aluno, onInput: (v) =>setNovo({ ...novo, aluno: v }) })}
      <div class="row c3">
        ${Num({ label: "Valor em aberto (R$)", value: novo.valor, onInput: (v) =>setNovo({ ...novo, valor: v }) })}
        ${DateF({ label: "Vencimento", value: novo.vencimento, onInput: (v) =>setNovo({ ...novo, vencimento: v }) })}
        ${Select({ label: "Status", value: novo.status, onInput: (v) =>setNovo({ ...novo, status: v }), options: DOM.cobr_status })}
      </div>
      <div class="row c2">
        ${Assignee({ value: novo.responsavel, onInput: (v) =>setNovo({ ...novo, responsavel: v }), users })}
        ${Text({ label: "Próxima ação", value: novo.proxima_acao, onInput: (v) =>setNovo({ ...novo, proxima_acao: v }) })}
      </div>
      ${Area({ label: "Observações", value: novo.observacoes, onInput: (v) =>setNovo({ ...novo, observacoes: v }) })}
    <//>` : ""}

    ${edit ? html`<${EditModal} user=${user} cobr=${edit} onClose=${() =>setEdit(null)}/>` : ""}`;
}

function EditModal({ user, cobr, onClose }) {
  const dias = diasDesde(cobr.vencimento) || 0;
  const msg = mensagemCobranca(cobr.aluno, dias, cobr.valor);
  const [status, setStatus] = useState(cobr.status);
  const [proxima, setProxima] = useState(cobr.proxima_acao || "");
  const [marcar, setMarcar] = useState(false);

  const salvar = async () => {
    await store.update("cobrancas", cobr.id, {
      status, proxima_acao: proxima,
      ultima_mensagem: marcar ? msg : cobr.ultima_mensagem,
    });
    await store.logAction(user.email, "cobranca_editada", `#${cobr.id} ${cobr.aluno}`);
    toast("Cobrança atualizada."); onClose();
  };
  const excluir = async () => {
    if (!confirm("Excluir este registro de cobrança?")) return;
    await store.remove("cobrancas", cobr.id);
    await store.logAction(user.email, "cobranca_excluida", `#${cobr.id}`);
    toast("Registro excluído."); onClose();
  };

  return html`<${Modal} title=${"Cobrança — " + cobr.aluno} size="lg" onClose=${onClose}
    footer=${html`<button class="btn danger" onClick=${excluir}>Excluir</button>
      <button class="btn" onClick=${onClose}>Fechar</button>
      <button class="btn primary" onClick=${salvar}>Salvar alterações</button>`}>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;padding:8px 14px;border-radius:10px;margin-bottom:12px">Estágio da régua: <b>${reguaEstagio(dias)}</b>dias · atraso real: <b>${dias}</b>dias</div>
    <div class="field"><label>Mensagem pronta (copie e envie)</label>
      <textarea class="copybox" rows=${5} readonly>${msg}</textarea></div>
    <div style="margin-bottom:12px"><button class="btn" onClick=${() =>copiar(msg)}>Copiar mensagem</button></div>
    <div class="row c2">
      ${Select({ label: "Atualizar status", value: status, onInput: setStatus, options: DOM.cobr_status })}
      ${Text({ label: "Próxima ação", value: proxima, onInput: setProxima })}
    </div>
    <label class="field" style="flex-direction:row;align-items:center;gap:8px">
      <input type="checkbox" checked=${marcar} onChange=${(e) =>setMarcar(e.target.checked)}/>
      <span>Registrar esta mensagem como última enviada</span></label>
    ${cobr.ultima_mensagem ? html`<div class="section-t">Última mensagem registrada</div>
      <div class="hist"><div class="h-item">${cobr.ultima_mensagem}</div></div>` : ""}
  <//>`;
}
