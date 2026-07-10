/* Playbooks — base de conhecimento estilo Notion: FAQ, processos e guias.
   Navegação por seções à esquerda, artigo (markdown) à direita.
   Edição (criar/editar/excluir) restrita a Admin e Gestor (Coordenação);
   demais perfis têm leitura + cópia. RLS reforça no banco. */
import { html } from "htm/preact";
import { useState, useMemo } from "preact/hooks";
import { store } from "../lib/store.js";
import { useCollection } from "../lib/hooks.js";
import { renderMarkdown } from "../lib/md.js";
import { Text, Select, toast, copiar, DOM } from "../lib/ui.js";

const nowTs = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const ORDER = DOM.pb_categoria;
const secRank = (c) => { const i = ORDER.indexOf(c); return i < 0 ? 999 : i; };

const md = (t) => renderMarkdown(t || "");

export function View({ user }) {
  const { rows } = useCollection("playbooks");
  const podeEditar = ["Admin", "Coordenação"].includes(user.perfil); // Admin + Gestor
  const [sel, setSel] = useState(null);   // id do artigo aberto
  const [edit, setEdit] = useState(null); // artigo em edição/criação
  const [busca, setBusca] = useState("");

  const artigos = useMemo(() => rows.slice().sort((a, b) =>
    secRank(a.categoria) - secRank(b.categoria) ||
    (b.favorito || 0) - (a.favorito || 0) ||
    (a.titulo > b.titulo ? 1 : -1)), [rows]);

  const filtrados = busca
    ? artigos.filter((r) => (`${r.titulo} ${r.conteudo} ${r.categoria}`).toLowerCase().includes(busca.toLowerCase()))
    : artigos;

  // agrupa por seção preservando a ordem
  const secoes = [];
  for (const a of filtrados) {
    let s = secoes.find((x) => x.cat === a.categoria);
    if (!s) { s = { cat: a.categoria, itens: [] }; secoes.push(s); }
    s.itens.push(a);
  }

  const aberto = artigos.find((a) => a.id === sel) || (!busca && !edit ? artigos[0] : null);

  const novo = () => setEdit({ id: null, categoria: "FAQ", titulo: "", conteudo: "" });
  const abrirEdicao = (a) => setEdit({ id: a.id, categoria: a.categoria, titulo: a.titulo, conteudo: a.conteudo });
  const salvar = async () => {
    if (!edit.titulo.trim() || !edit.conteudo.trim()) return toast("Preencha título e conteúdo.", "err");
    if (edit.id) {
      await store.update("playbooks", edit.id, { categoria: edit.categoria, titulo: edit.titulo, conteudo: edit.conteudo });
      await store.logAction(user.email, "playbook_editado", edit.titulo);
      setSel(edit.id); toast("Página atualizada.");
    } else {
      const r = await store.insert("playbooks", { categoria: edit.categoria, titulo: edit.titulo, conteudo: edit.conteudo, favorito: 0, criado_em: nowTs() });
      await store.logAction(user.email, "playbook_criado", edit.titulo);
      setSel(r.id); toast("Página criada.");
    }
    setEdit(null);
  };
  const excluir = async (a) => {
    if (!confirm(`Excluir "${a.titulo}"?`)) return;
    await store.remove("playbooks", a.id);
    await store.logAction(user.email, "playbook_excluido", a.titulo);
    setSel(null); toast("Página excluída.");
  };
  const favoritar = async (a) => { await store.update("playbooks", a.id, { favorito: a.favorito ? 0 : 1 }); };

  return html`
    <h1 class="h1">Base de Conhecimento</h1>
    <p class="sub">FAQ, processos e guias do CX — respostas prontas e como tudo funciona.
      ${podeEditar ? "" : "Edição restrita a Admin e Gestor."}</p>

    <div class=${"kb" + (sel || edit ? " kb--doc" : "")}>
      <aside class="kb-side">
        <div class="kb-search"><input placeholder="Buscar na base…" value=${busca}
          onInput=${(e) => setBusca(e.target.value)}/></div>
        ${podeEditar ? html`<button class="btn primary kb-new" onClick=${novo}>+ Nova página</button>` : ""}
        ${secoes.length ? secoes.map((s) => html`
          <div>
            <div class="kb-sec">${s.cat}</div>
            ${s.itens.map((a) => html`
              <button class=${"kb-item" + (aberto && aberto.id === a.id ? " active" : "")}
                onClick=${() => { setSel(a.id); setEdit(null); }}>
                ${a.favorito ? html`<span class="dot"></span>` : ""}<span>${a.titulo}</span>
              </button>`)}
          </div>`) : html`<div style="color:var(--soft);font-size:13px;padding:10px 6px">Nada encontrado.</div>`}
      </aside>

      <section class="kb-main">
        <button class="btn sm kb-back" onClick=${() => { setSel(null); setEdit(null); }}>← Voltar à lista</button>
        ${edit ? html`<${Editor} edit=${edit} setEdit=${setEdit} salvar=${salvar}/>`
          : aberto ? html`
            <div class="kb-doc-head">
              <div><div class="kb-eyebrow">${aberto.categoria}</div></div>
              <div class="kb-actions">
                <button class="btn sm" onClick=${() => copiar(aberto.conteudo)}>Copiar</button>
                ${podeEditar ? html`
                  <button class="btn sm" onClick=${() => favoritar(aberto)}>${aberto.favorito ? "★ Fixada" : "☆ Fixar"}</button>
                  <button class="btn sm" onClick=${() => abrirEdicao(aberto)}>Editar</button>
                  <button class="btn sm danger" onClick=${() => excluir(aberto)}>Excluir</button>` : ""}
              </div>
            </div>
            <article class="prose" dangerouslySetInnerHTML=${{ __html: md("# " + aberto.titulo + "\n\n" + aberto.conteudo) }}></article>`
          : html`<div class="kb-empty">Selecione uma página à esquerda${podeEditar ? " ou crie uma nova" : ""}.</div>`}
      </section>
    </div>`;
}

function Editor({ edit, setEdit, salvar }) {
  const [preview, setPreview] = useState(false);
  return html`<div class="kb-editor">
    <div class="kb-doc-head">
      <div class="kb-eyebrow">${edit.id ? "Editando página" : "Nova página"}</div>
      <div class="kb-actions">
        <button class="btn sm" onClick=${() => setPreview(!preview)}>${preview ? "Editar" : "Pré-visualizar"}</button>
        <button class="btn sm" onClick=${() => setEdit(null)}>Cancelar</button>
        <button class="btn sm primary" onClick=${salvar}>Salvar</button>
      </div>
    </div>
    ${preview ? html`<article class="prose"
      dangerouslySetInnerHTML=${{ __html: md("# " + (edit.titulo || "Sem título") + "\n\n" + edit.conteudo) }}></article>`
      : html`
      <div class="row c2">
        ${Text({ label: "Título", value: edit.titulo, onInput: (v) => setEdit({ ...edit, titulo: v }) })}
        ${Select({ label: "Seção", value: edit.categoria, onInput: (v) => setEdit({ ...edit, categoria: v }), options: DOM.pb_categoria })}
      </div>
      <label>Conteúdo (Markdown — títulos ##, listas -, **negrito**, tabelas)</label>
      <textarea class="kb-md" value=${edit.conteudo}
        onInput=${(e) => setEdit({ ...edit, conteudo: e.target.value })}></textarea>`}
  </div>`;
}
