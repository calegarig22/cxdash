/* Leitura de planilhas: CSV nativo (sempre) e XLSX via SheetJS carregado sob
   demanda (só quando o arquivo é .xlsx). Retorna sempre uma matriz de linhas
   (array de arrays); a 1ª linha são os cabeçalhos. */

function detectDelim(line) {
  const c = (line.match(/,/g) || []).length;
  const s = (line.match(/;/g) || []).length;
  const t = (line.match(/\t/g) || []).length;
  if (t >= c && t >= s) return "\t";
  return s > c ? ";" : ",";
}

export function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const delim = detectDelim((text.split(/\r?\n/)[0]) || "");
  const rows = []; let row = []; let field = ""; let i = 0; let inq = false;
  while (i < text.length) {
    const c = text[i];
    if (inq) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inq = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inq = true; i++; continue; }
    if (c === delim) { row.push(field); field = ""; i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

export async function parseFile(file) {
  const nome = (file.name || "").toLowerCase();
  if (nome.endsWith(".xlsx") || nome.endsWith(".xls")) {
    let XLSX;
    try { XLSX = await import("https://esm.sh/xlsx@0.18.5"); }
    catch (e) { throw new Error("Não consegui ler o Excel agora. Salve a planilha como CSV e tente de novo."); }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, blankrows: false });
    return arr.map((r) => r.map((c) => (c == null ? "" : String(c))));
  }
  const text = await file.text();
  return parseCSV(text);
}
