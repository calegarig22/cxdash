/* GET /api/venda-lookup?email=... — busca UMA venda pelo e-mail na tabela
   `vendas` (cópia da planilha "Vendas para Emissão de NF", carregada pela
   equipe). A tabela é trancada por RLS: só a service role (este endpoint) lê,
   nunca o navegador. Devolve só a linha do e-mail pedido. Requer login. */
const { admin } = require("./_lib");

const CAMPOS = ["aluno", "telefone", "cpf", "duracao", "tipo_pagamento", "vendedor",
  "data_compra", "valor_total", "valor_material", "valor_servico"];

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "method" });
  const sb = admin();
  if (!sb) return res.status(500).json({ error: "no-supabase" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "sem token" });
  const { data: au } = await sb.auth.getUser(token);
  if (!au || !au.user) return res.status(401).json({ error: "token inválido" });

  const email = String((req.query && req.query.email) || (req.body && req.body.email) || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "sem email" });

  const { data, error } = await sb.from("vendas")
    .select(CAMPOS.join(",")).eq("email", email).limit(1).maybeSingle();
  if (error) return res.status(502).json({ error: "consulta", detalhe: error.message });
  if (!data) return res.status(200).json({ found: false });

  const campos = {};
  for (const k of CAMPOS) if (data[k] != null && data[k] !== "") campos[k] = data[k];
  return res.status(200).json({ found: true, campos });
};
