/* GET /api/cron-autotasks — Vercel Cron (diário).
   Gera tarefas automáticas a partir dos dados operacionais, já atribuídas ao
   responsável do registro (ou ao dono padrão em config.auto_task_owner).
   Idempotente por `ref` (origem='auto'). Regras espelhadas em web/lib/autotasks.js. */
const { admin, diasDesde, authorized } = require("./_lib");

const brl = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

module.exports = async (req, res) => {
  if (!authorized(req)) return res.status(401).end();
  const sb = admin();
  if (!sb) return res.status(200).json({ ok: false, reason: "no-supabase" });
  try {
    const [tar, cob, can, voc, cfg] = await Promise.all([
      sb.from("tarefas").select("id,ref,origem"),
      sb.from("cobrancas").select("*"),
      sb.from("cancelamentos").select("*"),
      sb.from("voc").select("*"),
      sb.from("config").select("valor").eq("chave", "auto_task_owner").maybeSingle(),
    ]);
    const casoEmAberto = (c) => !c.resultado || c.resultado === "Em análise";
    const owner = (cfg.data && cfg.data.valor) || "";
    const existentes = new Set((tar.data || []).filter((t) => t.origem === "auto" && t.ref).map((t) => t.ref));
    const cand = [];
    const add = (ref, titulo, tipo, prioridade, responsavel) =>
      cand.push({ ref, titulo, tipo, prioridade, responsavel: responsavel || owner || "", status: "Aberta", prazo: today(), origem: "auto", observacoes: "" });

    for (const c of cob.data || []) {
      if (c.status === "Regularizado") continue;
      const d = diasDesde(c.vencimento);
      if (d >= 7) add(`cobr:${c.id}`, `Cobrar ${c.aluno} — ${d}d em atraso (${brl(c.valor)})`,
        "Cobrança", d >= 60 ? "Crítica" : d >= 28 ? "Alta" : "Média", c.responsavel);
    }
    for (const c of can.data || []) {
      if (!casoEmAberto(c)) continue;
      add(`caso:${c.id}`, `Trabalhar retenção — ${c.aluno} (${c.produto || "—"})`,
        "Retenção", "Alta", c.responsavel);
      const d = diasDesde(c.data_solicitacao);
      if (d >= 20) add(`cancel:${c.id}`, `Cancelamento >20d — ${c.aluno} (${d}d em aberto)`,
        "Cancelamento", d >= 30 ? "Crítica" : "Alta", c.responsavel);
      if (Number(c.valor_reembolso) > 0) add(`reemb:${c.id}`, `Processar reembolso — ${c.aluno} (${brl(c.valor_reembolso)})`,
        "Reembolso", "Média", c.responsavel);
    }
    for (const v of voc.data || []) {
      if (v.gravidade === "Crítica" && v.status === "Aberto")
        add(`voc:${v.id}`, `Tratar feedback crítico — ${v.aluno}: ${String(v.descricao || "").slice(0, 60)}`,
          "Atendimento", "Crítica", v.responsavel);
    }

    let criadas = 0;
    for (const c of cand) {
      if (existentes.has(c.ref)) continue;
      const { data: t } = await sb.from("tarefas").insert(c).select("id").single();
      if (t) {
        await sb.from("tarefa_hist").insert({ pai: t.id, usuario: "sistema", texto: `Tarefa gerada automaticamente (${c.ref}).` });
        existentes.add(c.ref); criadas++;
      }
    }
    await sb.from("logs").insert({ usuario: "cron", acao: "tarefas_auto_geradas", detalhe: `${criadas} tarefa(s)` });
    return res.status(200).json({ ok: true, criadas });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
