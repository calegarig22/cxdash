/* POST /api/venda-upload  { csv: "<conteúdo do CSV da aba Vendas>" }
   Somente ADMIN. Recebe o CSV que o admin baixou da planilha, normaliza e faz
   upsert na tabela `vendas` (por e-mail). Não apaga nada. A tabela segue
   trancada: só este endpoint (service role) grava/lê. */
const { admin } = require("./_lib");

const strip = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase();
const txt = (v) => { const s = String(v == null ? "" : v).trim(); return s || null; };

function parseNum(x) {
  let s = String(x == null ? "" : x).replace(/[^\d,.-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s); return isNaN(n) ? null : Math.round(n * 100) / 100;
}
function asDigits(x) {
  let s = String(x == null ? "" : x).trim();
  if (!s) return null;
  if (/^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(s) || /^-?\d+\.0+$/.test(s)) { const n = Number(s); if (!isNaN(n)) s = String(Math.round(n)); }
  return s || null;
}
function normData(x) {
  const s = String(x == null ? "" : x).trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = "20" + y; return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`; }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if (/^\d+(\.\d+)?$/.test(s)) { const n = Number(s); if (n > 20000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + n * 864e5).toISOString().slice(0, 10); }
  return null;
}
const normDur = (x) => { const m = String(x == null ? "" : x).match(/\d+/); return m ? Number(m[0]) + " meses" : null; };
const normPag = (x) => { const t = strip(x); return t.includes("parcel") ? "Parcelado" : t.includes("recorr") ? "Recorrente" : null; };

function parseCSV(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c === "\r") { /* ignora */ }
    else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const sb = admin();
  if (!sb) return res.status(500).json({ error: "no-supabase" });

  // autentica e exige perfil Admin
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "sem token" });
  const { data: au } = await sb.auth.getUser(token);
  if (!au || !au.user) return res.status(401).json({ error: "token inválido" });
  const { data: prof } = await sb.from("profiles").select("perfil").eq("id", au.user.id).maybeSingle();
  if (!prof || prof.perfil !== "Admin") return res.status(403).json({ error: "forbidden" });

  const csv = (req.body && req.body.csv) || "";
  if (!csv || typeof csv !== "string") return res.status(400).json({ error: "sem csv" });

  const rows = parseCSV(csv);
  if (rows.length < 2) return res.status(400).json({ error: "csv vazio ou sem linhas" });

  // acha a linha de cabeçalho (a que tem 'nome' e 'cliente')
  let hi = 0;
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const vals = rows[i].map(strip);
    if (vals.includes("nome") && vals.includes("cliente")) { hi = i; break; }
  }
  const headers = rows[hi].map(strip);
  const findCol = (...alvos) => {
    for (const a of alvos) { const i = headers.indexOf(strip(a)); if (i >= 0) return i; }
    for (const a of alvos) { const i = headers.findIndex((h) => h.includes(strip(a))); if (i >= 0) return i; }
    return -1;
  };
  const COL = {
    email: findCol("cliente"), aluno: findCol("nome"), telefone: findCol("celular", "telefone"),
    cpf: findCol("cpf/cnpj", "cpf", "documento"), duracao: findCol("duracao_curso", "duracao", "duração"),
    tipo_pagamento: findCol("forma"), vendedor: findCol("fonte", "vendedor"),
    data_compra: findCol("data_venda", "data da venda", "data_transacao"),
    valor_total: findCol("valor_total", "valor total"), valor_material: findCol("valor_produto", "valor produto"),
    valor_servico: findCol("valor_servico", "valor servico"),
  };
  if (COL.email < 0) return res.status(400).json({ error: "não achei a coluna de e-mail (Cliente) no CSV" });

  const g = (row, i) => (i >= 0 ? row[i] : null);
  const byEmail = {};
  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i];
    const email = String(g(row, COL.email) || "").trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    byEmail[email] = {
      email, aluno: txt(g(row, COL.aluno)), telefone: asDigits(g(row, COL.telefone)), cpf: asDigits(g(row, COL.cpf)),
      duracao: normDur(g(row, COL.duracao)), tipo_pagamento: normPag(g(row, COL.tipo_pagamento)),
      vendedor: txt(g(row, COL.vendedor)), data_compra: normData(g(row, COL.data_compra)),
      valor_total: parseNum(g(row, COL.valor_total)), valor_material: parseNum(g(row, COL.valor_material)),
      valor_servico: parseNum(g(row, COL.valor_servico)), atualizado_em: new Date().toISOString(),
    };
  }
  const recs = Object.values(byEmail);
  if (!recs.length) return res.status(200).json({ ok: true, carregados: 0, aviso: "nenhum e-mail válido encontrado" });

  let ok = 0;
  for (let i = 0; i < recs.length; i += 500) {
    const chunk = recs.slice(i, i + 500);
    const rr = await fetch(process.env.SUPABASE_URL + "/rest/v1/vendas?on_conflict=email", {
      method: "POST",
      headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + process.env.SUPABASE_SERVICE_KEY, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(chunk),
    });
    if (rr.ok) ok += chunk.length;
    else { const t = await rr.text(); return res.status(502).json({ error: "gravacao-" + rr.status, detalhe: t.slice(0, 200), carregados: ok }); }
  }
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  await sb.from("logs").insert({ ts, usuario: au.user.email, acao: "vendas_upload", detalhe: `${ok} aluno(s)` }).then(() => {}, () => {});
  return res.status(200).json({ ok: true, carregados: ok });
};
