/* POST /api/slack {texto, contexto} → envia ao webhook do Slack.
   Webhook vem de env SLACK_WEBHOOK ou da tabela config (via service key). */
const { createClient } = require("@supabase/supabase-js");

function admin() {
  const u = process.env.SUPABASE_URL, k = process.env.SUPABASE_SERVICE_KEY;
  return u && k ? createClient(u, k) : null;
}
async function getWebhook() {
  if (process.env.SLACK_WEBHOOK) return process.env.SLACK_WEBHOOK;
  const sb = admin();
  if (!sb) return "";
  const { data } = await sb.from("config").select("valor").eq("chave", "slack_webhook").maybeSingle();
  return data && data.valor ? data.valor : "";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const texto = (body.texto || "").toString().slice(0, 2000);
    if (!texto) return res.status(400).json({ error: "texto" });
    const url = await getWebhook();
    if (!url) return res.status(200).json({ ok: false, reason: "no-webhook" });
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: texto }),
    });
    return res.status(200).json({ ok: r.ok });
  } catch (e) {
    return res.status(500).json({ error: "fail" });
  }
};
