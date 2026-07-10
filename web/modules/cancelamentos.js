/* Cancelamentos / Retenção — caso único por aluno.
   Um cancelamento e uma retenção são o mesmo registro: o colaborador preenche o
   perfil completo e marca o resultado como Em análise, Retido ou Cancelado.
   Prazo legal de 30 dias; alertas a partir de 20 dias em aberto; histórico e Slack. */
import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { store } from "../lib/store.js";
import { useCollection, useUsers, useSelecao } from "../lib/hooks.js";
import {
  Badge, Table, Modal, Text, Num, DateF, Area, Select, Segmented, FilterSelect, Assignee, ReadOnly, Tabs, BulkBar,
  toast, baixarCSV, brl, diasDesde, DOM, aplicarEscopo, podeVerTudo, ehAdmin,
} from "../lib/ui.js";
import { alertarSlack } from "../lib/notify.js";

const nowTs = () =>new Date().toISOString().slice(0, 19).replace("T", " ");
const PRAZO_LIMITE = 30;
const ALERTA_DIAS = 20;
const RESULT_TONES = { Retido: "ok", Cancelado: "danger" };
const emAberto = (c) =>!c.resultado || c.resultado === "Em análise";
const mesesDuracao = (d) => { const m = parseInt(String(d), 10); return isNaN(m) ? 0 : m; };

/* meses completos entre duas datas "YYYY-MM-DD" (ex.: 01/01 → 12/06 = 5 meses) */
export function mesesEntre(inicio, fim) {
  if (!inicio || !fim) return 0;
  const [ay, am, ad] = String(inicio).split("-").map(Number);
  const [by, bm, bd] = String(fim).split("-").map(Number);
  if (!ay || !by) return 0;
  let m = (by - ay) * 12 + (bm - am);
  if (bd < ad) m -= 1;
  return Math.max(0, m);
}

/* diferença em dias entre duas datas YYYY-MM-DD */
export function diasEntre(inicio, fim) {
  if (!inicio || !fim) return null;
  const a = new Date(String(inicio).slice(0, 10) + "T00:00:00Z");
  const b = new Date(String(fim).slice(0, 10) + "T00:00:00Z");
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 864e5);
}

/* deriva o tipo de cancelamento pelas datas: até 7 dias da compra = "7 dias"
   (direito de arrependimento), acima disso = "Depois de 7 dias".
   Só decide quando há as duas datas; senão devolve o valor atual. */
export function tipoPorDatas(compra, solicitacao, atual) {
  const d = diasEntre(compra, solicitacao);
  if (d == null) return atual || "";
  return d <= 7 ? "7 dias" : "Depois de 7 dias";
}

/* Cálculo padrão de estorno de cancelamento.
   - Dentro de 7 dias (direito do consumidor): estorno de 100% do valor total, sem multa.
   - Após 7 dias: devolve apenas o serviço proporcional aos meses restantes,
     com multa de 10% sobre as parcelas remanescentes. Material não é devolvido. */
export function calcCancel(f) {
  const meses = mesesDuracao(f.duracao);
  const usados = Number(f.meses_utilizados) || 0;
  const restante = Math.max(0, meses - usados);
  const servico = Number(f.valor_servico) || 0;
  const material = Number(f.valor_material) || 0;
  const mensal = meses > 0 ? servico / meses : 0;
  const servicoRestante = restante * mensal;
  const materialMensal = meses > 0 ? material / meses : 0;
  const materialRestante = restante * materialMensal;   // material que segue sendo debitado (recorrente)
  const dentro7 = f.tipo_cancelamento === "7 dias";
  const retido = f.resultado === "Retido";               // aluno permanece → sem estorno e sem multa
  const recorrente = f.tipo_pagamento === "Recorrente";  // recorrente: só multa, sem estorno; material continua

  let multa, estorno;
  if (retido) { multa = 0; estorno = 0; }
  else if (dentro7) { multa = 0; estorno = +(Number(f.valor_total) || 0).toFixed(2); }  // arrependimento: 100%
  else if (recorrente) { multa = +(servicoRestante * 0.1).toFixed(2); estorno = 0; }     // paga multa; material segue
  else { multa = +(servicoRestante * 0.1).toFixed(2); estorno = +Math.max(0, servicoRestante - multa).toFixed(2); }

  return {
    meses, usados, restante, mensal: +mensal.toFixed(2), servicoRestante: +servicoRestante.toFixed(2),
    materialMensal: +materialMensal.toFixed(2), materialRestante: +materialRestante.toFixed(2),
    multa, estorno, dentro7, retido, recorrente,
  };
}

/* valores a gravar: calculados por padrão, ou os digitados quando em ajuste manual */
export function valoresFinais(f) {
  if (f.ajuste_manual) return { valor_multa: Number(f.valor_multa) || 0, valor_reembolso: Number(f.valor_reembolso) || 0 };
  const c = calcCancel(f);
  return { valor_multa: c.multa, valor_reembolso: c.estorno };
}

const vazio = (u) => ({
  aluno: "", email: "", telefone: "", cpf: "",
  produto: DOM.produto[0], duracao: DOM.duracao[0], tipo_pagamento: DOM.tipo_pagamento[0],
  vendedor: "", tipo_cancelamento: DOM.tipo_cancelamento[0], meses_utilizados: 0,
  data_compra: "", data_solicitacao: new Date().toISOString().slice(0, 10), motivo: "",
  status: DOM.cancel_status[0], resultado: "Em análise", responsavel: u ? u.nome : "",
  valor_total: 0, valor_material: 0, valor_servico: 0, valor_multa: 0, valor_reembolso: 0,
  observacoes: "",
});

export function View({ user }) {
  const { rows } = useCollection("cancelamentos", { order: "data_solicitacao" });
  const users = useUsers();
  const vendedores = useCollection("vendedores", { order: "nome" }).rows.filter((v) =>v.ativo !== false).map((v) =>v.nome);
  const verTudo = podeVerTudo(user.perfil);
  const admin = ehAdmin(user);
  const [escopo, setEscopo] = useState("minhas");
  const [novo, setNovo] = useState(null);
  const [edit, setEdit] = useState(null);
  const [subindo, setSubindo] = useState(false);
  const [fResult, setFResult] = useState("");

  // Admin sobe o CSV da aba Vendas → atualiza a tabela `vendas` (só admin)
  const subirVendas = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setSubindo(true);
    try {
      const csv = await file.text();
      const tk = await store.auth.token();
      const r = await fetch("/api/venda-upload", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: JSON.stringify({ csv }) });
      const j = await r.json();
      if (j.error === "forbidden") toast("Apenas o Admin pode atualizar as vendas.", "err");
      else if (j.error) toast("Falha ao atualizar: " + j.error, "err");
      else toast(`Vendas atualizadas — ${j.carregados} aluno(s).`);
    } catch (err) { toast("Não consegui ler/enviar o arquivo.", "err"); }
    setSubindo(false);
  };
  const [fBusca, setFBusca] = useState("");

  const base = aplicarEscopo(rows, user, verTudo ? escopo : "minhas");
  const filtrados = base.filter((c) =>
    (!fResult || c.resultado === fResult) &&
    (!fBusca || (c.aluno || "").toLowerCase().includes(fBusca.toLowerCase())));

  const alertas = filtrados
    .filter((c) =>emAberto(c) && (diasDesde(c.data_solicitacao) || 0) >= ALERTA_DIAS)
    .map((c) => ({ c, dias: diasDesde(c.data_solicitacao) || 0 }));

  const enviarAlertas = () => {
    alertas.forEach(({ c, dias }) =>alertarSlack(`:hourglass_flowing_sand: *Caso >20 dias em aberto* — ${c.aluno} (${dias}d) · ${c.produto || "—"}`, "cancelamento_20d"));
    toast(`${alertas.length} alerta(s) enviados ao Slack.`, "warn");
  };

  const salvarNovo = async () => {
    if (!novo.aluno.trim()) return toast("Informe o nome do aluno.", "err");
    if (novo.motivo === "Outros" && !(novo.observacoes || "").trim()) return toast("Motivo 'Outros': descreva nas observações.", "err");
    const { ajuste_manual, ...dados } = novo;
    const c = await store.insert("cancelamentos", {
      ...dados, ...valoresFinais(novo), meses_utilizados: Number(novo.meses_utilizados) || 0,
      data_compra: novo.data_compra || null, criado_em: nowTs(),
    });
    await store.insert("cancel_hist", { pai: c.id, ts: nowTs(), usuario: user.nome, texto: `Caso registrado (${c.produto || "—"}, resultado '${c.resultado}').` });
    await store.logAction(user.email, "cancelamento_criado", c.aluno);
    setNovo(null); toast("Caso registrado com sucesso!");
  };

  const { sel, toggle, toggleAll, clear } = useSelecao();
  const bulkResultado = async (resultado) => {
    const ids = [...sel];
    if (!ids.length) return;
    if (!confirm(`Marcar ${ids.length} caso(s) como ${resultado}?`)) return;
    await store.bulkUpdate("cancelamentos", ids, { resultado });
    await store.logAction(user.email, "cancelamentos_resultado_massa", `${ids.length} → ${resultado}`);
    alertarSlack(`:white_check_mark: *${ids.length} caso(s) marcados como ${resultado}* por ${user.nome}.`, "caso_resultado");
    clear(); toast(`${ids.length} caso(s) marcado(s) como ${resultado}.`);
  };
  const bulkExcluir = async () => {
    const ids = [...sel];
    if (!confirm(`Excluir ${ids.length} caso(s)? Essa ação não pode ser desfeita.`)) return;
    await store.bulkRemove("cancelamentos", ids);
    await store.logAction(user.email, "cancelamentos_excluidos_massa", `${ids.length}`);
    clear(); toast(`${ids.length} caso(s) excluído(s).`);
  };

  const cols = [
    { key: "id", label: "ID" },
    { key: "aluno", label: "Aluno" },
    { key: "produto", label: "Produto" },
    { key: "resultado", label: "Resultado", render: (r) =>Badge(r.resultado), csv: (r) =>r.resultado || "" },
    { key: "responsavel", label: "Responsável" },
    { key: "data_solicitacao", label: "Solicitado em" },
    { label: "Dias", key: "dias", render: (r) =>diasDesde(r.data_solicitacao) ?? 0, csv: (r) =>String(diasDesde(r.data_solicitacao) ?? 0) },
    { label: "Prazo", key: "prazo", render: (r) =>emAberto(r) ? `${PRAZO_LIMITE - (diasDesde(r.data_solicitacao) || 0)}d` : "—", csv: (r) =>emAberto(r) ? `${PRAZO_LIMITE - (diasDesde(r.data_solicitacao) || 0)}d` : "—" },
    { key: "valor_multa", label: "Multa", render: (r) =>brl(r.valor_multa), csv: (r) =>brl(r.valor_multa) },
  ];

  return html`
    <h1 class="h1">Cancelamentos / Retenção</h1>
    <p class="sub">Um caso por aluno — preencha o perfil e defina o resultado: Retido ou Cancelado. Prazo legal de 30 dias, alerta a partir de 20 em aberto.</p>

    ${verTudo ? html`<div style="margin-bottom:14px">${Tabs({ value: escopo, onInput: setEscopo,
      options: [["minhas", "Minhas"], ["todas", "Equipe (todas)"]] })}</div>` : ""}

    <div class="toolbar">
      <button class="btn primary" onClick=${() =>setNovo(vazio(user))}>Novo caso</button>
      ${admin ? html`<label class="btn ok" title="Baixe a aba Vendas em CSV e selecione o arquivo aqui">
        ${subindo ? "Atualizando…" : "↻ Atualizar vendas do dia"}
        <input type="file" accept=".csv,text/csv" style="display:none" disabled=${subindo} onChange=${subirVendas}/>
      </label>` : ""}
      ${FilterSelect({ label: "Resultado", value: fResult, onInput: setFResult, options: DOM.resultado_caso })}
      <div class="grow"><label>Aluno</label>
        <input placeholder="buscar por aluno" value=${fBusca} onInput=${(e) =>setFBusca(e.target.value)}/></div>
      <button class="btn" onClick=${() =>baixarCSV("cancelamentos", cols, filtrados)}>Exportar</button>
    </div>

    ${alertas.map(({ c, dias }) =>html`
      <div style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:8px 14px;border-radius:10px;margin-bottom:8px">
        <b>${c.aluno}</b> está há <b>${dias} dias</b> em aberto (prazo limite ${PRAZO_LIMITE}d).</div>`)}
    ${alertas.length ? html`<div style="margin-bottom:10px"><button class="btn" onClick=${enviarAlertas}>Enviar alertas ao Slack (>20 dias)</button></div>` : ""}

    <div class="count">${filtrados.length} caso(s)${verTudo && escopo === "todas" ? " · equipe" : " · minhas"}</div>
    ${BulkBar({ n: sel.size, onClear: clear, actions: [
      { label: `Retido (${sel.size})`, kind: "ok", on: () =>bulkResultado("Retido") },
      { label: `Cancelado (${sel.size})`, kind: "", on: () =>bulkResultado("Cancelado") },
      admin ? { label: `Excluir (${sel.size})`, kind: "danger", on: bulkExcluir } : null,
    ] })}
    ${Table({ columns: cols, rows: filtrados, onRow: (r) =>setEdit({ ...r }), sel, onSel: toggle, onSelAll: toggleAll })}

    ${novo ? html`<${Modal} title="Novo caso" size="lg" onClose=${() =>setNovo(null)}
      footer=${html`<button class="btn" onClick=${() =>setNovo(null)}>Cancelar</button>
        <button class="btn primary" onClick=${salvarNovo}>Registrar caso</button>`}>
      ${CampoPerfil({ f: novo, set: setNovo, users, vendedores, admin })}
    <//>` : ""}

    ${edit ? html`<${CasoModal} user=${user} users=${users} caso=${edit} onClose=${() =>setEdit(null)}/>` : ""}`;
}

/* Busca os dados do aluno na planilha de Vendas pelo e-mail (via endpoint
   seguro no servidor) e preenche o formulário. Só leitura — nunca escreve. */
async function puxarVenda(f, set) {
  const email = (f.email || "").trim();
  if (!email) return toast("Digite o e-mail do aluno primeiro.", "warn");
  try {
    const token = await store.auth.token();
    const r = await fetch("/api/venda-lookup?email=" + encodeURIComponent(email),
      { headers: token ? { Authorization: "Bearer " + token } : {} });
    const j = await r.json();
    if (j.error === "not-configured") return toast("Planilha de Vendas ainda não conectada.", "warn");
    if (j.error) return toast("Não foi possível consultar a planilha de Vendas.", "err");
    if (!j.found) return toast("E-mail não encontrado na planilha de Vendas.", "warn");
    const c = j.campos || {};
    const patch = {};
    ["aluno", "telefone", "cpf", "produto", "duracao", "tipo_pagamento", "vendedor", "data_compra"]
      .forEach((k) => { if (c[k]) patch[k] = c[k]; });
    if (c.data_compra && f.data_solicitacao) {
      patch.meses_utilizados = mesesEntre(c.data_compra, f.data_solicitacao);
      patch.tipo_cancelamento = tipoPorDatas(c.data_compra, f.data_solicitacao, f.tipo_cancelamento);
    }
    if (c.valor_total != null) {
      const t = Number(c.valor_total) || 0;
      patch.valor_total = t;
      // usa a divisão real da planilha; se não vier, cai no 50/50
      const mat = Number(c.valor_material), serv = Number(c.valor_servico);
      patch.valor_material = mat ? +mat.toFixed(2) : +(t / 2).toFixed(2);
      patch.valor_servico = serv ? +serv.toFixed(2) : +(t / 2).toFixed(2);
    }
    set({ ...f, ...patch });
    toast("Dados da venda carregados da planilha.");
  } catch (e) {
    toast("Falha ao buscar na planilha de Vendas.", "err");
  }
}

/* Campos do perfil do caso — reaproveitados no Novo e na edição.
   Multa e estorno são SEMPRE calculados na hora (calcCancel), sem chance de
   dessincronizar. Para exceções, marque "ajustar manualmente" e digite os valores. */
export function CampoPerfil({ f, set, users, vendedores = [], admin = false }) {
  const setTotal = (v) => set({ ...f, valor_total: v, valor_material: +(v / 2).toFixed(2), valor_servico: +(v / 2).toFixed(2) });
  const setDataCompra = (v) => set({ ...f, data_compra: v, meses_utilizados: mesesEntre(v, f.data_solicitacao), tipo_cancelamento: tipoPorDatas(v, f.data_solicitacao, f.tipo_cancelamento) });
  const setDataSolic = (v) => set({ ...f, data_solicitacao: v, meses_utilizados: f.data_compra ? mesesEntre(f.data_compra, v) : (Number(f.meses_utilizados) || 0), tipo_cancelamento: tipoPorDatas(f.data_compra, v, f.tipo_cancelamento) });
  const calc = calcCancel(f);
  const manual = !!f.ajuste_manual;
  return html`
    <div class="form-sec">Aluno</div>
    <div class="row c3">
      ${Text({ label: "Nome do aluno *", value: f.aluno, onInput: (v) =>set({ ...f, aluno: v }) })}
      ${Text({ label: "E-mail", value: f.email, onInput: (v) =>set({ ...f, email: v }) })}
      ${Text({ label: "Telefone", value: f.telefone, onInput: (v) =>set({ ...f, telefone: v }) })}
    </div>
    <div class="venda-lookup">
      <button type="button" class="btn sm" onClick=${() =>puxarVenda(f, set)}>Buscar dados pelo e-mail</button>
      <span class="hint">Preenche nome, telefone, CPF, produto, duração, pagamento, vendedor, data de início e valor a partir da planilha de Vendas.</span>
    </div>
    <div class="row c3">
      ${Text({ label: "CPF", value: f.cpf, onInput: (v) =>set({ ...f, cpf: v }) })}
      <div class="field"><label>Vendedor</label>
        <select value=${f.vendedor || ""} onChange=${(e) =>set({ ...f, vendedor: e.target.value })}>
          <option value="">— selecione —</option>
          ${vendedores.map((n) =>html`<option value=${n} selected=${n === f.vendedor}>${n}</option>`)}
          ${f.vendedor && !vendedores.includes(f.vendedor) ? html`<option value=${f.vendedor} selected>${f.vendedor} (inativo)</option>` : ""}
        </select>
      </div>
      ${admin
        ? Assignee({ value: f.responsavel, onInput: (v) =>set({ ...f, responsavel: v }), users })
        : ReadOnly({ label: "Responsável", value: f.responsavel })}
    </div>

    <div class="form-sec">Contrato</div>
    <div class="row c3">
      ${Select({ label: "Produto", value: f.produto, onInput: (v) =>set({ ...f, produto: v }), options: DOM.produto })}
      ${Select({ label: "Duração", value: f.duracao, onInput: (v) =>set({ ...f, duracao: v }), options: DOM.duracao })}
      ${Select({ label: "Tipo de pagamento", value: f.tipo_pagamento, onInput: (v) =>set({ ...f, tipo_pagamento: v }), options: DOM.tipo_pagamento })}
    </div>
    <div class="row c3">
      ${DateF({ label: "Data de início (compra)", value: f.data_compra, onInput: setDataCompra })}
      ${DateF({ label: "Data da solicitação", value: f.data_solicitacao, onInput: setDataSolic })}
      ${Select({ label: "Tipo de cancelamento (automático pelas datas)", value: f.tipo_cancelamento, onInput: (v) =>set({ ...f, tipo_cancelamento: v }), options: DOM.tipo_cancelamento })}
    </div>
    ${Text({ label: "Meses utilizados (calculado pelas datas — ajustável)", value: f.meses_utilizados, onInput: (v) =>set({ ...f, meses_utilizados: parseInt(v) || 0 }) })}
    <div class="field"><label>Motivo do cancelamento</label>
      <select value=${f.motivo || ""} onChange=${(e) =>set({ ...f, motivo: e.target.value })}>
        <option value="">— selecione —</option>
        ${DOM.motivo_cancelamento.map((m) =>html`<option value=${m} selected=${m === f.motivo}>${m}</option>`)}
        ${f.motivo && !DOM.motivo_cancelamento.includes(f.motivo) ? html`<option value=${f.motivo} selected>${f.motivo} (antigo)</option>` : ""}
      </select>
      ${f.motivo === "Outros" ? html`<span class="hint" style="color:var(--red)">Descreva o motivo nas observações (obrigatório).</span>` : ""}
    </div>

    <div class="form-sec">Valores (material e serviço divididos 50/50)</div>
    <div class="row c3">
      ${Num({ label: "Valor total pago (R$)", value: f.valor_total, onInput: setTotal })}
      ${Num({ label: "Material (R$)", value: f.valor_material, onInput: (v) =>set({ ...f, valor_material: v }) })}
      ${Num({ label: "Serviço (R$)", value: f.valor_servico, onInput: (v) =>set({ ...f, valor_servico: v }) })}
    </div>
    <div class="info-box">
      ${calc.retido
        ? html`Aluno <b>retido</b> — permanece no contrato. <b>Sem estorno e sem multa</b>; entra positivamente nos números de retenção.`
        : calc.dentro7
        ? html`Cancelamento <b>dentro de 7 dias</b> — estorno integral (100%): <b class="estorno">${brl(f.valor_total)}</b>`
        : calc.recorrente
        ? html`Plano <b>recorrente</b> — <b>não há estorno</b>. Serviço mensal <b>${brl(calc.mensal)}</b> (${brl(f.valor_servico)} ÷ ${calc.meses || "—"} meses) · Restante <b>${calc.restante} ${calc.restante === 1 ? "mês" : "meses"}</b>
            (${calc.restante} × ${brl(calc.mensal)} = <b>${brl(calc.servicoRestante)}</b>) · Multa 10% <b class="estorno">${brl(calc.multa)}</b> (a pagar)
            <br/>Material restante <b>${brl(calc.materialRestante)}</b> — <b>continua sendo debitado</b>. O aluno paga apenas a multa; o material segue.`
        : html`Serviço mensal <b>${brl(calc.mensal)}</b> (${brl(f.valor_servico)} ÷ ${calc.meses || "—"} meses) · Restante <b>${calc.restante} ${calc.restante === 1 ? "mês" : "meses"}</b>
            (${calc.restante} × ${brl(calc.mensal)} = <b>${brl(calc.servicoRestante)}</b>) · Multa 10% <b>${brl(calc.multa)}</b>
            <br/>Valor para estorno: <b class="estorno">${brl(calc.estorno)}</b> · Material (não devolvido): ${brl(f.valor_material)}`}
    </div>
    <label class="chk"><input type="checkbox" checked=${manual}
      onChange=${(e) =>set({ ...f, ajuste_manual: e.target.checked, valor_multa: calc.multa, valor_reembolso: calc.estorno })}/> Ajustar multa e estorno manualmente (exceção)</label>
    <div class="row c2">
      ${manual
        ? html`${Num({ label: "Multa (R$)", value: f.valor_multa, onInput: (v) =>set({ ...f, valor_multa: v }) })}
               ${Num({ label: "Valor de estorno (reembolso) (R$)", value: f.valor_reembolso, onInput: (v) =>set({ ...f, valor_reembolso: v }) })}`
        : html`<div class="field"><label>Multa (R$)</label><input type="text" readonly value=${brl(calc.multa)}/></div>
               <div class="field"><label>Valor de estorno (reembolso) (R$)</label><input type="text" readonly value=${brl(calc.estorno)}/></div>`}
    </div>

    <div class="form-sec">Resultado</div>
    ${Segmented({ label: "O aluno foi:", value: f.resultado, onInput: (v) =>set({ ...f, resultado: v }), options: DOM.resultado_caso, tones: RESULT_TONES })}
    ${Area({ label: f.motivo === "Outros" ? "Observações (obrigatória — descreva o motivo)" : "Observações", value: f.observacoes, onInput: (v) =>set({ ...f, observacoes: v }) })}`;
}

/* Modal de perfil completo do caso (edição) — exportado para reuso na aba Retenção. */
export function CasoModal({ user, users, caso, onClose }) {
  const [c, setC] = useState({ ...caso, valor_total: caso.valor_total || (Number(caso.valor_material || 0) + Number(caso.valor_servico || 0)) });
  const [nota, setNota] = useState("");
  const admin = ehAdmin(user);
  const vendedores = useCollection("vendedores", { order: "nome" }).rows.filter((v) =>v.ativo !== false).map((v) =>v.nome);
  const { rows: hist } = useCollection("cancel_hist");
  const meuHist = hist.filter((h) =>h.pai === caso.id).sort((a, b) => (a.id < b.id ? 1 : -1));

  const salvar = async () => {
    if (c.motivo === "Outros" && !(c.observacoes || "").trim()) return toast("Motivo 'Outros': descreva nas observações.", "err");
    const vf = valoresFinais(c);
    const mud = [];
    if (c.resultado !== caso.resultado) mud.push(`resultado '${caso.resultado || "—"}'→'${c.resultado}'`);
    if (c.responsavel !== caso.responsavel) mud.push(`responsável '${caso.responsavel || "—"}'→'${c.responsavel || "—"}'`);
    if (Number(vf.valor_multa) !== Number(caso.valor_multa)) mud.push(`multa ${brl(caso.valor_multa)}→${brl(vf.valor_multa)}`);
    if (Number(vf.valor_reembolso) !== Number(caso.valor_reembolso)) mud.push(`estorno ${brl(caso.valor_reembolso)}→${brl(vf.valor_reembolso)}`);
    await store.update("cancelamentos", caso.id, {
      aluno: c.aluno, email: c.email, telefone: c.telefone, cpf: c.cpf,
      produto: c.produto, duracao: c.duracao, tipo_pagamento: c.tipo_pagamento,
      vendedor: c.vendedor, tipo_cancelamento: c.tipo_cancelamento, meses_utilizados: Number(c.meses_utilizados) || 0,
      motivo: c.motivo,
      data_compra: c.data_compra || null, data_solicitacao: c.data_solicitacao, resultado: c.resultado, responsavel: admin ? c.responsavel : caso.responsavel,
      valor_total: c.valor_total, valor_material: c.valor_material, valor_servico: c.valor_servico,
      ...vf, observacoes: c.observacoes,
    });
    const texto = (nota ? nota + " | " : "") + (mud.length ? mud.join("; ") : "Atualização de dados.");
    await store.insert("cancel_hist", { pai: caso.id, ts: nowTs(), usuario: user.nome, texto });
    await store.logAction(user.email, "cancelamento_editado", `#${caso.id} ${caso.aluno}`);
    if (c.resultado !== caso.resultado && (c.resultado === "Retido" || c.resultado === "Cancelado")) {
      alertarSlack(`:white_check_mark: *Caso ${c.resultado}* — ${c.aluno} (${c.produto || "—"})\nPor: ${user.nome} · Multa: ${brl(c.valor_multa)}`, "caso_resultado");
    }
    toast("Caso atualizado."); onClose();
  };
  const excluir = async () => {
    if (!confirm("Excluir este caso?")) return;
    await store.remove("cancelamentos", caso.id);
    await store.logAction(user.email, "cancelamento_excluido", `#${caso.id}`);
    toast("Caso excluído."); onClose();
  };

  return html`<${Modal} title=${"Caso #" + caso.id + " · " + caso.aluno} size="lg" onClose=${onClose}
    footer=${html`${admin ? html`<button class="btn danger" onClick=${excluir}>Excluir</button>` : ""}
      <button class="btn" onClick=${onClose}>Fechar</button>
      <button class="btn primary" onClick=${salvar}>Salvar alterações</button>`}>
    ${CampoPerfil({ f: c, set: setC, users, vendedores, admin })}
    ${Text({ label: "Nota para o histórico (o que mudou?)", value: nota, onInput: setNota })}
    <div class="form-sec">Histórico do processo</div>
    <div class="hist">${meuHist.length ? meuHist.map((h) =>html`<div class="h-item"><code>${h.ts}</code> <b>${h.usuario}</b>: ${h.texto}</div>`) : html`<span style="color:#9ca3af">Sem histórico.</span>`}</div>
  <//>`;
}
