/* Relatórios consolidados do CX — agregações calculadas no cliente (sem SQL).
   Reproduz os 7 relatórios do módulo Python: escolhe o relatório num Select,
   mostra Tabela + (quando há "Total") BarChart + botão de exportar CSV. */
import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { useCollection } from "../lib/hooks.js";
import { Table, BarChart, Select, baixarCSV, brl } from "../lib/ui.js";

/* agrupa `rows`pela tupla de chaves `keys`, contando ocorrências e
   somando os campos indicados em `sums`. Devolve array de linhas agregadas. */
function agrupar(rows, keys, sums = {}) {
  const mapa = new Map();
  for (const r of rows) {
    const chave = keys.map((k) =>r[k] ?? "").join("§");
    let acc = mapa.get(chave);
    if (!acc) {
      acc = { total: 0 };
      keys.forEach((k) => (acc[k] = r[k] ?? ""));
      Object.keys(sums).forEach((s) => (acc[s] = 0));
      mapa.set(chave, acc);
    }
    acc.total += 1;
    Object.keys(sums).forEach((s) => (acc[s] += Number(r[sums[s]]) || 0));
  }
  return [...mapa.values()];
}

/* soma "Total"por categoria (primeira coluna de agrupamento) p/ o BarChart */
function chartPorPrimeira(linhas, campo) {
  const mapa = new Map();
  for (const l of linhas) mapa.set(l[campo], (mapa.get(l[campo]) || 0) + l.total);
  return [...mapa.entries()].map(([label, n]) => ({ label, n }));
}

export function View({ user }) {
  const tarefas = useCollection("tarefas").rows;
  const cancelamentos = useCollection("cancelamentos").rows;
  const cobrancas = useCollection("cobrancas").rows;
  const voc = useCollection("voc").rows;
  const documentos = useCollection("documentos").rows;
  const consultorias = useCollection("consultorias").rows;

  /* cada relatório: { colunas, linhas, chart? } */
  const RELATORIOS = {
    "Tarefas por responsável": () => {
      const linhas = agrupar(tarefas, ["responsavel", "status"])
        .sort((a, b) => (a.responsavel >b.responsavel ? 1 : -1));
      return {
        colunas: [
          { key: "responsavel", label: "Responsável" },
          { key: "status", label: "Status" },
          { key: "total", label: "Total" },
        ],
        linhas,
        chart: chartPorPrimeira(linhas, "responsavel"),
      };
    },

    "Cancelamentos por resultado": () => {
      const linhas = agrupar(cancelamentos, ["resultado"], { reembolso: "valor_reembolso" });
      return {
        colunas: [
          { key: "resultado", label: "Resultado" },
          { key: "total", label: "Total" },
          { key: "reembolso", label: "Reembolso total", render: (r) =>brl(r.reembolso), csv: (r) =>r.reembolso },
        ],
        linhas,
        chart: chartPorPrimeira(linhas, "resultado"),
      };
    },

    "Cobranças em aberto": () => ({
      colunas: [
        { key: "aluno", label: "Aluno" },
        { key: "valor", label: "Valor", render: (r) =>brl(r.valor), csv: (r) =>r.valor },
        { key: "vencimento", label: "Vencimento" },
        { key: "status", label: "Status" },
        { key: "responsavel", label: "Responsável" },
      ],
      linhas: cobrancas
        .filter((c) =>c.status !== "Regularizado")
        .sort((a, b) => (a.vencimento >b.vencimento ? 1 : -1)),
    }),

    "Retenção — casos": () => ({
      colunas: [
        { key: "aluno", label: "Aluno" },
        { key: "produto", label: "Produto" },
        { key: "motivo", label: "Motivo" },
        { key: "resultado", label: "Resultado" },
        { key: "responsavel", label: "Responsável" },
      ],
      linhas: cancelamentos.slice().sort((a, b) => (a.aluno > b.aluno ? 1 : -1)),
    }),

    "Feedbacks por categoria": () => {
      const linhas = agrupar(voc, ["categoria", "tipo"])
        .sort((a, b) => (a.categoria >b.categoria ? 1 : -1));
      return {
        colunas: [
          { key: "categoria", label: "Categoria" },
          { key: "tipo", label: "Tipo" },
          { key: "total", label: "Total" },
        ],
        linhas,
        chart: chartPorPrimeira(linhas, "categoria"),
      };
    },

    "Documentos gerados": () => ({
      colunas: [
        { key: "tipo", label: "Tipo" },
        { key: "aluno", label: "Aluno" },
        { key: "valor", label: "Valor", render: (r) =>brl(r.valor), csv: (r) =>r.valor },
        { key: "data", label: "Data" },
        { key: "gerado_por", label: "Gerado por" },
      ],
      linhas: documentos.slice().sort((a, b) => (a.id < b.id ? 1 : -1)),
    }),

    "Consultorias realizadas": () => ({
      colunas: [
        { key: "aluno", label: "Aluno" },
        { key: "tipo", label: "Tipo" },
        { key: "data_agendada", label: "Data agendada" },
        { key: "responsavel", label: "Responsável" },
        { key: "status", label: "Status" },
      ],
      linhas: consultorias
        .filter((c) =>c.status === "Realizada")
        .sort((a, b) => (a.data_agendada < b.data_agendada ? 1 : -1)),
    }),
  };

  const nomes = Object.keys(RELATORIOS);
  const [rel, setRel] = useState(nomes[0]);
  const { colunas, linhas, chart } = RELATORIOS[rel]();
  const nomeArq = rel.toLowerCase().replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");

  return html`
    <h1 class="h1">Relatórios</h1>
    <p class="sub">Relatórios consolidados do CX — visualize, filtre e exporte em CSV.</p>

    <div class="toolbar">
      <div class="grow">${Select({ label: "Selecione o relatório", value: rel, onInput: setRel, options: nomes })}</div>
      <button class="btn" onClick=${() =>baixarCSV(nomeArq, colunas, linhas)}>Exportar</button>
    </div>

    <div class="count">${linhas.length} linha(s)</div>
    ${linhas.length
      ? html`
        ${Table({ columns: colunas, rows: linhas })}
        ${chart ? html`<div class="section-t">Visão gráfica</div>${BarChart({ data: chart })}` : ""}`
      : html`<div class="empty">Sem dados para este relatório.</div>`}`;
}
