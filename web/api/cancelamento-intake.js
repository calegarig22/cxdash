/* POST /api/cancelamento-intake — recebe uma solicitação de cancelamento de um
   formulário externo (Google Forms via Apps Script), grava em `cancelamentos`
   (status "Recebido") e avisa no Slack. Protegido por INTAKE_SECRET. */
const { admin, postSlack } = require("./_lib");

const hoje = () => new Date().toISOString().slice(0, 10);
function pick(o, chaves) {
  const ks = Object.keys(o);
  for (const alvo of chaves) for (const k of ks) if (k.toLowerCase().trim().includes(alvo)) return o[k];
  return "";
}
function normData(s) {
  s = String(s || "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = "20" + y; return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`; }
  return hoje();
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Intake-Secret");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const secret = req.headers["x-intake-secret"] || body.secret || "";
  if (process.env.INTAKE_SECRET && secret !== process.env.INTAKE_SECRET)
    return res.status(401).json({ error: "unauthorized" });
  if (body.website || body._gotcha) return res.status(200).json({ ok: true, skipped: true }); // honeypot anti-spam

  const sb = admin();
  if (!sb) return res.status(500).json({ error: "no-supabase" });

  const aluno = String(pick(body, ["aluno", "nome", "name"]) || "").trim();
  if (!aluno) return res.status(400).json({ error: "nome/aluno obrigatório" });

  const row = {
    aluno,
    email: String(pick(body, ["e-mail", "email", "mail"]) || "").trim(),
    telefone: String(pick(body, ["telefone", "celular", "whats", "fone", "tel"]) || "").trim(),
    motivo: String(pick(body, ["motivo", "razao", "razão"]) || "").trim(),
    data_solicitacao: normData(pick(body, ["data_solicitacao", "data"])),
    status: "Recebido",
    observacoes: String(pick(body, ["observ", "obs", "mensagem", "coment", "detalhe"]) || "").trim(),
    responsavel: "",
  };
  try {
    const { data: cfg } = await sb.from("config").select("valor").eq("chave", "auto_task_owner").maybeSingle();
    if (cfg && cfg.valor) row.responsavel = cfg.valor;
  } catch (e) {}

  const { data, error } = await sb.from("cancelamentos").insert(row).select("id").single();
  if (error) return res.status(500).json({ error: error.message });

  await postSlack(sb, `:bell: *Nova solicitação de cancelamento*\n*Aluno:* ${aluno}` +
    (row.motivo ? `\n*Motivo:* ${row.motivo}` : "") +
    (row.email ? `\n*E-mail:* ${row.email}` : "") +
    (row.telefone ? `\n*Telefone:* ${row.telefone}` : "") +
    `\nRegistrada em Cancelamentos (status Recebido).`);
  try { await sb.from("logs").insert({ usuario: "formulario", acao: "cancelamento_intake", detalhe: aluno }); } catch (e) {}

  return res.status(200).json({ ok: true, id: data.id });
};
