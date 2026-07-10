/* Retenção / Churn — painel de análise sobre os casos de cancelamento.
   Lê a MESMA base de Cancelamentos (um caso por aluno) e mostra taxa de retenção,
   valores e casos em aberto para o time trabalhar. Editar abre o card completo. */
import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { useCollection, useUsers } from "../lib/hooks.js";
import {
  Badge, Table, Kpi, BarChart, FilterSelect,
  baixarCSV, brl, diasDesde, DOM,
} from "../lib/ui.js";
import { CasoModal } from "./cancelamentos.js";

const emAberto = (c) =>!c.resultado || c.resultado === "Em análise";
const soma = (arr, k) =>arr.reduce((s, r) =>s + (Number(r[k]) || 0), 0);

/* agrupa por chave → [{label, n}] ordenado desc */
function agrupar(rows, key, top) {
  const m = {};
  rows.forEach((r) => { const k = r[key] || "—"; m[k] = (m[k] || 0) + 1; });
  const arr = Object.entries(m).map(([label, n]) => ({ label, n })).sort((a, b) =>b.n - a.n);
  return top ? arr.slice(0, top) : arr;
}

export function View({ user }) {
  const { rows } = useCollection("cancelamentos", { order: "data_solicitacao" });
  const users = useUsers();
  const [fProduto, setFProduto] = useState("");
  const [fResp, setFResp] = useState("");
  const [edit, setEdit] = useState(null);

  const nomes = (users || []).map((u) => (typeof u === "string" ? u : u.nome)).filter(Boolean);
  const base = rows
    .filter((c) => (!fProduto || c.produto === fProduto))
    .filter((c) => (!fResp || (c.responsavel || "") === fResp));

  const abertos = base.filter(emAberto);
  const retidos = base.filter((c) =>c.resultado === "Retido");
  const cancelados = base.filter((c) =>c.resultado === "Cancelado");
  const decididos = retidos.length + cancelados.length;
  const taxa = decididos ? Math.round((retidos.length / decididos) * 100) : 0;

  const cols = [
    { key: "aluno", label: "Aluno" },
    { key: "produto", label: "Produto" },
    { key: "motivo", label: "Motivo" },
    { key: "responsavel", label: "Responsável" },
    { key: "data_solicitacao", label: "Solicitado em" },
    { label: "Dias", key: "dias", render: (r) =>diasDesde(r.data_solicitacao) ?? 0, csv: (r) =>String(diasDesde(r.data_solicitacao) ?? 0) },
    { key: "resultado", label: "Resultado", render: (r) =>Badge(r.resultado), csv: (r) =>r.resultado || "" },
  ];

  return html`
    <h1 class="h1">Retenção / Churn</h1>
    <p class="sub">Visão de retenção sobre os casos de cancelamento — taxa de retenção, valores e casos em aberto para trabalhar.</p>

    <div class="toolbar">
      ${FilterSelect({ label: "Produto", value: fProduto, onInput: setFProduto, options: DOM.produto })}
      ${FilterSelect({ label: "Responsável", value: fResp, onInput: setFResp, options: nomes })}
      <div class="grow"></div>
      <button class="btn" onClick=${() =>baixarCSV("retencao", cols, base)}>Exportar</button>
    </div>

    <div class="grid c4">
      ${Kpi({ label: "Taxa de retenção", val: `${taxa}%`, sub: `${retidos.length} retidos / ${decididos} decididos`, tone: taxa >= 50 ? "" : "alert" })}
      ${Kpi({ label: "Em aberto", val: abertos.length, tone: abertos.length ? "alert" : "" })}
      ${Kpi({ label: "Retidos", val: retidos.length })}
      ${Kpi({ label: "Cancelados", val: cancelados.length })}
    </div>

    <div class="grid c2">
      ${Kpi({ label: "Valor retido (contratos mantidos)", val: brl(soma(retidos, "valor_total")) })}
      ${Kpi({ label: "Multas de cancelamento", val: brl(soma(cancelados, "valor_multa")) })}
    </div>

    <div class="grid c2">
      <div class="card">
        <div class="section-t">Casos por produto</div>
        ${base.length ? BarChart({ data: agrupar(base, "produto") }) : html`<div class="empty">Sem casos.</div>`}
      </div>
      <div class="card">
        <div class="section-t">Motivos mais comuns</div>
        ${base.length ? BarChart({ data: agrupar(base.filter((c) => (c.motivo || "").trim()), "motivo", 12) }) : html`<div class="empty">Sem casos.</div>`}
      </div>
    </div>

    <div class="card">
      <div class="section-t">Casos em aberto — ${abertos.length} para trabalhar</div>
      ${Table({ columns: cols, rows: abertos, onRow: (r) =>setEdit({ ...r }) })}
    </div>

    ${edit ? html`<${CasoModal} user=${user} users=${users} caso=${edit} onClose=${() =>setEdit(null)}/>` : ""}`;
}
