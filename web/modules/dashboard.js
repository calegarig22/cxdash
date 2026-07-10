/* Dashboard geral: cards de indicadores em tempo real. */
import { html } from "htm/preact";
import { useCollection } from "../lib/hooks.js";
import { Kpi, Badge, brl, diasDesde, diasPara } from "../lib/ui.js";

const ativo = (s) => !["Concluída", "Cancelada"].includes(s);

export function View({ user }) {
  const tarefas = useCollection("tarefas", { order: "prazo" }).rows;
  const cancel = useCollection("cancelamentos", { order: "data_solicitacao" }).rows;
  const cobr = useCollection("cobrancas", { order: "vencimento" }).rows;
  const cons = useCollection("consultorias").rows;

  const emAberto = (c) => !c.resultado || c.resultado === "Em análise";
  const pend = tarefas.filter((t) =>ativo(t.status)).length;
  const hoje = tarefas.filter((t) =>ativo(t.status) && diasPara(t.prazo) === 0).length;
  const venc = tarefas.filter((t) =>ativo(t.status) && diasPara(t.prazo) < 0).length;
  const crit = tarefas.filter((t) =>ativo(t.status) && t.prioridade === "Crítica").length;
  const cancAtivos = cancel.filter(emAberto).length;
  const reemb = cancel.filter((c) =>emAberto(c) && Number(c.valor_reembolso) >0).length;
  const retidos = cancel.filter((c) =>c.resultado === "Retido").length;
  const cancelados = cancel.filter((c) =>c.resultado === "Cancelado").length;
  const taxaRet = retidos + cancelados ? Math.round((retidos / (retidos + cancelados)) * 100) : 0;
  const cobrAberto = cobr.filter((c) =>c.status !== "Regularizado").length;
  const consAgend = cons.filter((c) => ["Aprovada", "Agendada"].includes(c.status)).length;

  const criticasList = tarefas
    .filter((t) =>ativo(t.status) && (diasPara(t.prazo) < 0 || t.prioridade === "Crítica"))
    .slice(0, 8);
  const cobrList = cobr.filter((c) =>c.status !== "Regularizado").slice(0, 8);

  return html`
    <h1 class="h1">Dashboard Geral</h1>
    <p class="sub">Visão consolidada da operação de CX – Alumni ${user ? "· " + user.nome : ""}</p>

    <div class="section-t">Operação</div>
    <div class="grid c3">
      ${Kpi({ label: "Atendimentos pendentes", val: pend, sub: "Tarefas abertas / em andamento", tone: "warn" })}
      ${Kpi({ label: "Tarefas do dia", val: hoje, sub: "Com prazo para hoje" })}
      ${Kpi({ label: "Tarefas vencidas", val: venc, sub: "Prazo ultrapassado", tone: venc ? "alert" : "ok" })}
    </div>
    <div class="grid c3" style="margin-top:16px">
      ${Kpi({ label: "Casos críticos", val: crit, sub: "Prioridade crítica", tone: crit ? "alert" : "ok" })}
      ${Kpi({ label: "Casos em aberto", val: cancAtivos, sub: "Cancelamento/retenção em análise", tone: "warn" })}
      ${Kpi({ label: "Reembolsos pendentes", val: reemb, sub: "Com valor a devolver", tone: reemb ? "warn" : "ok" })}
    </div>
    <div class="grid c3" style="margin-top:16px">
      ${Kpi({ label: "Taxa de retenção", val: `${taxaRet}%`, sub: `${retidos} retidos de ${retidos + cancelados} decididos`, tone: taxaRet >= 50 || !(retidos + cancelados) ? "ok" : "alert" })}
      ${Kpi({ label: "Cobranças em aberto", val: cobrAberto, sub: "Não regularizadas", tone: "warn" })}
      ${Kpi({ label: "Consultorias agendadas", val: consAgend, sub: "Aprovadas / agendadas" })}
    </div>

    <div class="grid c2" style="margin-top:24px">
      <div class="card">
        <div class="section-t" style="margin-top:0">Tarefas vencidas / críticas</div>
        ${criticasList.length ? criticasList.map((t) =>html`
          <div style="padding:8px 0;border-bottom:1px solid #f1f3f8">
            <b>${t.titulo}</b> ${Badge(t.prioridade)} ${Badge(t.status)}
            <div style="color:#9ca3af;font-size:.8rem">${t.responsavel} · prazo ${t.prazo}</div>
          </div>`) : html`<div class="empty">Nenhuma tarefa vencida ou crítica. </div>`}
      </div>
      <div class="card">
        <div class="section-t" style="margin-top:0">Cobranças mais antigas</div>
        ${cobrList.length ? cobrList.map((c) => {
          const atr = diasDesde(c.vencimento) || 0;
          const cor = atr >= 60 ? "#dc2626" : "#6b7280";
          return html`<div style="padding:8px 0;border-bottom:1px solid #f1f3f8">
            <b>${c.aluno}</b> ${Badge(c.status)} <span style=${`color:${cor};font-weight:700`}>${atr}d</span>
            <div style="color:#9ca3af;font-size:.8rem">${brl(c.valor)} · venc. ${c.vencimento}</div></div>`;
        }) : html`<div class="empty">Sem cobranças em aberto.</div>`}
      </div>
    </div>`;
}
