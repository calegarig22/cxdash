/* Utilitários compartilhados pelas funções serverless. */
const { createClient } = require("@supabase/supabase-js");

function admin() {
  const u = process.env.SUPABASE_URL, k = process.env.SUPABASE_SERVICE_KEY;
  return u && k ? createClient(u, k) : null;
}
function diasDesde(d) {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(String(d).slice(0, 10) + "T00:00:00Z")) / 864e5);
}
async function webhook(sb) {
  if (process.env.SLACK_WEBHOOK) return process.env.SLACK_WEBHOOK;
  if (!sb) return "";
  const { data } = await sb.from("config").select("valor").eq("chave", "slack_webhook").maybeSingle();
  return data && data.valor ? data.valor : "";
}
async function postSlack(sb, texto) {
  const url = await webhook(sb);
  if (!url) return false;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: texto }) });
  return r.ok;
}
function authorized(req) {
  if (!process.env.CRON_SECRET) return true; // sem secret configurado, libera (Vercel Cron interno)
  return req.headers.authorization === "Bearer " + process.env.CRON_SECRET;
}
// pesos de churn (espelho de web/lib/ui.js)
const PESO_MOTIVO = { financeiro: 30, "baixo uso": 28, metodologia: 22, professor: 20, plataforma: 18, tempo: 15, horários: 12 };
const PESO_NIVEL = { baixo: 10, médio: 30, alto: 55 };
function churnScore(motivo, nivel) {
  return Math.min((PESO_MOTIVO[motivo] || 15) + (PESO_NIVEL[nivel] || 30), 100);
}

module.exports = { admin, diasDesde, postSlack, authorized, churnScore };
