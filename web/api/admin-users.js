/* POST /api/admin-users — gestão de usuários (somente Admin).
   Cria login + senha (Supabase Auth), remove usuário e redefine senha.
   Usa a service key (server-side); o chamador precisa ser um Admin autenticado.
   Body: { op: "create"|"remove"|"password", ... } com o access token no header
   Authorization: Bearer <jwt>. */
const { createClient } = require("@supabase/supabase-js");

function admin() {
  const u = process.env.SUPABASE_URL, k = process.env.SUPABASE_SERVICE_KEY;
  return u && k ? createClient(u, k) : null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const sb = admin();
  if (!sb) return res.status(500).json({ error: "no-supabase" });
  try {
    // 1) autentica o chamador e exige perfil Admin
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "sem token" });
    const { data: au } = await sb.auth.getUser(token);
    if (!au || !au.user) return res.status(401).json({ error: "não autenticado" });
    const { data: prof } = await sb.from("profiles").select("perfil").eq("id", au.user.id).maybeSingle();
    if (!prof || prof.perfil !== "Admin") return res.status(403).json({ error: "acesso restrito ao Admin" });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const op = body.op;

    if (op === "create") {
      const email = (body.email || "").toString().trim().toLowerCase();
      const senha = (body.senha || "").toString();
      const nome = (body.nome || "").toString().trim();
      const perfil = (body.perfil || "Atendimento").toString();
      const ativo = body.ativo !== false;
      if (!email || !senha) return res.status(400).json({ error: "e-mail e senha são obrigatórios" });
      if (senha.length < 6) return res.status(400).json({ error: "a senha precisa de ao menos 6 caracteres" });
      const { data, error } = await sb.auth.admin.createUser({
        email, password: senha, email_confirm: true, user_metadata: { nome, perfil },
      });
      if (error) return res.status(400).json({ error: error.message });
      await sb.from("profiles").upsert({ id: data.user.id, nome, email, perfil, ativo }, { onConflict: "id" });
      return res.status(200).json({ ok: true, id: data.user.id });
    }

    if (op === "remove") {
      if (!body.id) return res.status(400).json({ error: "id ausente" });
      if (body.id === au.user.id) return res.status(400).json({ error: "você não pode remover a si mesmo" });
      const { error } = await sb.auth.admin.deleteUser(body.id); // cascata remove o profile
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (op === "password") {
      if (!body.id || !body.senha) return res.status(400).json({ error: "id e senha são obrigatórios" });
      if (String(body.senha).length < 6) return res.status(400).json({ error: "a senha precisa de ao menos 6 caracteres" });
      const { error } = await sb.auth.admin.updateUserById(body.id, { password: String(body.senha) });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "operação inválida" });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};
