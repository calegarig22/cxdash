/* Gerador de tarefas automáticas.
   Varre os dados operacionais e cria tarefas que faltam, já atribuídas ao
   responsável do registro (ou ao dono padrão configurado). Idempotente: cada
   fonte tem um `ref` único (ex.: "cobr:12") — não duplica.
   Roda no login e no botão "Gerar agora" (Painel Admin); o cron faz o mesmo
   no servidor para o caso de ninguém abrir o sistema. Regras espelhadas em
   api/cron-autotasks.js — manter as duas em sincronia. */
import { store } from "./store.js";
import { brl, diasDesde, todayISO } from "./ui.js";

const nowTs = () => new Date().toISOString().slice(0, 19).replace("T", " ");

/* caso de cancelamento ainda sem decisão (Em análise) */
const casoEmAberto = (c) =>!c.resultado || c.resultado === "Em análise";

/* monta a lista de tarefas que DEVERIAM existir a partir dos dados */
export function regrasTarefas({ cobrancas, cancelamentos, voc }) {
  const out = [];
  const add = (ref, titulo, tipo, prioridade, responsavel) =>
    out.push({ ref, titulo, tipo, prioridade, responsavel: responsavel || "", status: "Aberta", prazo: todayISO(), origem: "auto" });

  for (const c of cobrancas || []) {
    if (c.status === "Regularizado") continue;
    const d = diasDesde(c.vencimento);
    if (d >= 7) add(`cobr:${c.id}`, `Cobrar ${c.aluno} — ${d}d em atraso (${brl(c.valor)})`,
      "Cobrança", d >= 60 ? "Crítica" : d >= 28 ? "Alta" : "Média", c.responsavel);
  }
  // Cada caso de cancelamento vira também uma tarefa de retenção (mesmo registro/aluno).
  for (const c of cancelamentos || []) {
    if (!casoEmAberto(c)) continue;
    add(`caso:${c.id}`, `Trabalhar retenção — ${c.aluno} (${c.produto || "—"})`,
      "Retenção", "Alta", c.responsavel);
    const d = diasDesde(c.data_solicitacao);
    if (d >= 20) add(`cancel:${c.id}`, `Cancelamento >20d — ${c.aluno} (${d}d em aberto)`,
      "Cancelamento", d >= 30 ? "Crítica" : "Alta", c.responsavel);
    if (Number(c.valor_reembolso) > 0) add(`reemb:${c.id}`, `Processar reembolso — ${c.aluno} (${brl(c.valor_reembolso)})`,
      "Reembolso", "Média", c.responsavel);
  }
  for (const v of voc || []) {
    if (v.gravidade === "Crítica" && v.status === "Aberto")
      add(`voc:${v.id}`, `Tratar feedback crítico — ${v.aluno}: ${(v.descricao || "").slice(0, 60)}`,
        "Atendimento", "Crítica", v.responsavel);
  }
  return out;
}

/* cria no banco as tarefas que ainda não existem. Retorna quantas criou. */
export async function gerarTarefasAuto(user) {
  const [tarefas, cobrancas, cancelamentos, voc, owner] = await Promise.all([
    store.list("tarefas"), store.list("cobrancas"), store.list("cancelamentos"),
    store.list("voc"), store.getConfig("auto_task_owner", ""),
  ]);
  const existentes = new Set(tarefas.filter((t) => t.origem === "auto" && t.ref).map((t) => t.ref));
  const candidatas = regrasTarefas({ cobrancas, cancelamentos, voc });
  let criadas = 0;
  for (const c of candidatas) {
    if (existentes.has(c.ref)) continue;
    const row = { ...c, responsavel: c.responsavel || owner || "", observacoes: "", criado_em: nowTs() };
    try {
      const t = await store.insert("tarefas", row);
      await store.insert("tarefa_hist", { pai: t.id, ts: nowTs(), usuario: "sistema", texto: `Tarefa gerada automaticamente (${c.ref}).` });
      existentes.add(c.ref); criadas++;
    } catch (e) {
      // outra sessão criou a mesma tarefa ao mesmo tempo (ref único) — ignora
      existentes.add(c.ref);
    }
  }
  if (criadas && user) await store.logAction(user.email, "tarefas_auto_geradas", `${criadas} tarefa(s)`);
  return criadas;
}
