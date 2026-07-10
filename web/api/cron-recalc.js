/* GET /api/cron-recalc — Vercel Cron (diário).
   Recalcula scores de churn, sinaliza cobranças/cancelamentos que cruzaram
   o limiar e dispara alertas em tempo (quase) real ao Slack. */
const { admin, diasDesde, postSlack, authorized, churnScore } = require("./_lib");

module.exports = async (req, res) => {
  if (!authorized(req)) return res.status(401).end();
  const sb = admin();
  if (!sb) return res.status(200).json({ ok: false, reason: "no-supabase" });
  try {
    const alertas = [];

    // 1) recalcula score de churn e atualiza quando mudou
    const { data: ret } = await sb.from("retencao").select("*");
    let atualizados = 0;
    for (const r of ret || []) {
      const s = churnScore(r.motivo, r.nivel);
      if (s !== r.score) { await sb.from("retencao").update({ score: s }).eq("id", r.id); atualizados++; }
      if (r.nivel === "alto" && r.resultado === "Em acompanhamento") alertas.push(`churn alto: ${r.aluno} (${s})`);
    }

    // 2) cobranças que cruzaram 60 dias
    const { data: cobr } = await sb.from("cobrancas").select("*");
    const novos60 = (cobr || []).filter((c) => c.status !== "Regularizado" && diasDesde(c.vencimento) >= 60);
    for (const c of novos60) alertas.push(`cobrança >60d: ${c.aluno} (${diasDesde(c.vencimento)}d)`);

    // 3) cancelamentos que passaram de 20 dias
    const { data: cancel } = await sb.from("cancelamentos").select("*");
    const novos20 = (cancel || []).filter((c) => c.status !== "Finalizado" && diasDesde(c.data_solicitacao) >= 20);
    for (const c of novos20) alertas.push(`cancelamento >20d: ${c.aluno} (${diasDesde(c.data_solicitacao)}d)`);

    if (alertas.length) {
      await postSlack(sb, `:radar: *Recálculo diário — pontos de atenção*\n• ` + alertas.slice(0, 20).join("\n• "));
    }
    await sb.from("logs").insert({ usuario: "cron", acao: "recalc_diario", detalhe: `scores=${atualizados} alertas=${alertas.length}` });
    return res.status(200).json({ ok: true, scores_atualizados: atualizados, alertas: alertas.length });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
