/* Hook de coleção com realtime: lista a tabela e re-renderiza em cada mudança. */
import { useState, useEffect } from "preact/hooks";
import { store } from "./store.js";

export function useCollection(table, opts = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => store.list(table, opts).then((r) => { setRows(r); setLoading(false); });
  useEffect(() => {
    load();
    const off = store.subscribe(table, load);
    return off;
  }, [table]);
  return { rows, loading, reload: load };
}

/* Lista os usuários ativos da equipe (para atribuir responsável e filtrar escopo). */
export function useUsers() {
  const [users, setUsers] = useState([]);
  useEffect(() => { store.listUsers().then(setUsers).catch(() => setUsers([])); }, []);
  return users;
}

/* Seleção em massa de linhas (para concluir/excluir vários de uma vez). */
export function useSelecao(idKey = "id") {
  const [sel, setSel] = useState(new Set());
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (rows) => setSel((s) => {
    const ids = rows.map((r) => r[idKey]);
    const marcados = ids.length > 0 && ids.every((i) => s.has(i));
    const n = new Set(s);
    if (marcados) ids.forEach((i) => n.delete(i)); else ids.forEach((i) => n.add(i));
    return n;
  });
  const clear = () => setSel(new Set());
  return { sel, toggle, toggleAll, clear };
}
