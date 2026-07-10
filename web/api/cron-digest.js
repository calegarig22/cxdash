/* GET /api/cron-digest — Vercel Cron (diário).
   Monta e envia ao Slack o resumo operacional do dia. */
const { admin, diasDesde, postSlack, authorized } = require("./_lib");

module.exports = async (req, res) => {
  if (!authorized(req)) return res.status(401).end();
  const sb = admin();
  if (!sb) return res.status(200).json({ ok: false, reason: "no-supabase" });
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const ativo = (s) => !["Concluída", "Cancelada"].includes(s);
    const [{ data: tarefas }, { data: cobr }, { data: cancel }, { data: ret }, { data: cons }] =
      await Promise.all([
        sb.from("tarefas").select("*"),
        sb.from("cobrancas").select("*"),
        sb.from("cancelamentos").select("*"),
        sb.from("retencao").select("*"),
        sb.from("consultorias").select("*"),
      ]);
    const venc = (tarefas || []).filter((t) => ativo(t.status) && t.prazo && String(t.prazo).slice(0, 10) < hoje).length;
    const crit = (tarefas || []).filter((t) => ativo(t.status) && t.prioridade === "Crítica").length;
    const cob60 = (cobr || []).filter((c) => c.status !== "Regularizado" && diasDesde(c.vencimento) >= 60).length;
    const can20 = (cancel || []).filter((c) => c.status !== "Finalizado" && diasDesde(c.data_solicitacao) >= 20).length;
    const churn = (ret || []).filter((r) => r.nivel === "alto" && r.resultado === "Em acompanhamento").length;
    const consHoje = (cons || []).filter((c) => c.status !== "Cancelada" && String(c.data_agendada || "").slice(0, 10) === hoje).length;

    const texto =
      `:sunrise: *Digest CX Alumni — ${hoje}*\n` +
      `• Tarefas vencidas: *${venc}*\n` +
      `• Tarefas críticas: *${crit}*\n` +
      `• Cobranças >60 dias: *${cob60}*\n` +
      `• Cancelamentos >20 dias: *${can20}*\n` +
      `• Alunos em churn alto: *${churn}*\n` +
      `• Consultorias agendadas hoje: *${consHoje}*`;
    const ok = await postSlack(sb, texto);
    await sb.from("logs").insert({ usuario: "cron", acao: "digest_diario", detalhe: `enviado=${ok}` });
    return res.status(200).json({ ok, texto });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
