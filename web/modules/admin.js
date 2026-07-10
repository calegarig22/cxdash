/* Painel Admin (ADMIN ONLY) — usuários, integração Slack, backup e logs de auditoria.
   Espelha os padrões de tarefas.js: abas por toggle, modais de CRUD, export CSV. */
import { html } from "htm/preact";
import { useState, useEffect } from "preact/hooks";
import { store } from "../lib/store.js";
import { useCollection } from "../lib/hooks.js";
import { useUsers } from "../lib/hooks.js";
import { Badge, Table, Modal, Tabs, Text, Select, Assignee, FilterSelect, toast, ExportButtons, DOM } from "../lib/ui.js";
import { alertarSlack } from "../lib/notify.js";
import { gerarTarefasAuto } from "../lib/autotasks.js";

const nowTs = () =>new Date().toISOString().slice(0, 19).replace("T", " ");
const T_USERS = store.DEMO ? "users" : "profiles";

/* chama a função serverless de gestão de usuários (create/remove/password) */
async function adminApi(op, payload) {
  const token = await store.auth.token();
  const r = await fetch("/api/admin-users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ op, ...payload }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
  return j;
}
const BACKUP_TABS = ["users", "tarefas", "tarefa_hist", "cancelamentos", "cancel_hist", "cobrancas", "retencao", "vendedores", "documentos", "consultorias", "playbooks", "voc", "logs", "config"];

export function View({ user }) {
  if (user.perfil !== "Admin")
    return html`<h1 class="h1">Painel Admin</h1><div class="empty">Acesso restrito ao perfil Admin.</div>`;

  const [aba, setAba] = useState("usuarios");

  return html`
    <h1 class="h1">Painel Admin</h1>
    <p class="sub">Usuários, integrações, backup e logs de auditoria — acesso restrito ao perfil Admin.</p>

    ${Tabs({ value: aba, onInput: setAba, options: [
      ["usuarios", "Usuários"], ["vendedores", "Vendedores"], ["automacao", "Automação"], ["slack", "Slack"], ["backup", "Backup"], ["logs", "Logs"]] })}

    ${aba === "usuarios" ? html`<${Usuarios} user=${user}/>` : ""}
    ${aba === "vendedores" ? html`<${Vendedores} user=${user}/>` : ""}
    ${aba === "automacao" ? html`<${Automacao} user=${user}/>` : ""}
    ${aba === "slack" ? html`<${Slack} user=${user}/>` : ""}
    ${aba === "backup" ? html`<${Backup} user=${user}/>` : ""}
    ${aba === "logs" ? html`<${Logs}/>` : ""}`;
}

/* Gestão de vendedores — cadastro/exclusão pelo Admin; o colaborador só seleciona no card. */
function Vendedores({ user }) {
  const { rows } = useCollection("vendedores", { order: "nome" });
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const n = nome.trim();
    if (!n) return;
    if (rows.some((v) =>(v.nome || "").toLowerCase() === n.toLowerCase())) return toast("Esse vendedor já existe.", "warn");
    setBusy(true);
    try {
      await store.insert("vendedores", { nome: n, ativo: true });
      await store.logAction(user.email, "vendedor_criado", n);
      setNome(""); toast("Vendedor adicionado.");
    } catch (e) { toast("Falha ao adicionar vendedor.", "err"); }
    finally { setBusy(false); }
  };
  const excluir = async (v) => {
    if (!confirm(`Excluir o vendedor "${v.nome}"?`)) return;
    await store.remove("vendedores", v.id);
    await store.logAction(user.email, "vendedor_excluido", v.nome);
    toast("Vendedor excluído.");
  };

  return html`
    <div class="card">
      <div class="section-t">Vendedores</div>
      <p class="sub">Cadastre os vendedores aqui. No card de cancelamento, o colaborador apenas seleciona o nome — sem digitar.</p>
      <div class="toolbar" style="margin-top:6px">
        <div class="grow"><label>Novo vendedor</label>
          <input placeholder="nome do vendedor" value=${nome} onInput=${(e) =>setNome(e.target.value)}
            onKeyDown=${(e) =>e.key === "Enter" && add()}/></div>
        <button class="btn primary" onClick=${add} disabled=${busy || !nome.trim()}>Adicionar</button>
      </div>
      <div class="count">${rows.length} vendedor(es)</div>
      ${rows.length ? html`<div class="table-wrap"><table>
        <thead><tr><th>Nome</th><th style="width:120px">Ação</th></tr></thead>
        <tbody>${rows.map((v) =>html`<tr>
          <td>${v.nome}</td>
          <td><button class="btn sm danger" onClick=${() =>excluir(v)}>Excluir</button></td>
        </tr>`)}</tbody></table></div>` : html`<div class="empty">Nenhum vendedor cadastrado ainda.</div>`}
    </div>`;
}

/* ============================ AUTOMAÇÃO ============================ */
function Automacao({ user }) {
  const users = useUsers();
  const [owner, setOwner] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { store.getConfig("auto_task_owner", "").then((v) => { setOwner(v || ""); setLoaded(true); }); }, []);

  const salvarOwner = async (v) => {
    setOwner(v);
    await store.setConfig("auto_task_owner", v);
    await store.logAction(user.email, "auto_owner_definido", v || "(nenhum)");
    toast("Responsável padrão salvo.");
  };
  const gerar = async () => {
    setBusy(true);
    try {
      const n = await gerarTarefasAuto(user);
      toast(n ? `${n} tarefa(s) gerada(s).` : "Tudo em dia — nenhuma tarefa nova.");
    } catch (e) { toast("Falha ao gerar tarefas.", "err"); }
    finally { setBusy(false); }
  };

  return html`
    <div class="card">
      <div class="section-t">Tarefas automáticas</div>
      <p class="sub">O sistema cria tarefas sozinho a partir dos dados — no login da equipe e uma vez por dia (cron).
        Cada tarefa é atribuída ao responsável do registro; sem responsável, vai para o padrão abaixo.</p>
      <ul class="lista">
        <li>Cobrança em atraso (7+ dias) → <b>Cobrar {aluno}</b></li>
        <li>Cancelamento parado (20+ dias) → <b>Retomar cancelamento</b></li>
        <li>Reembolso pendente → <b>Processar reembolso</b></li>
        <li>Churn <b>alto</b> em acompanhamento → <b>Reter {aluno}</b></li>
        <li>Feedback <b>crítico</b> aberto → <b>Tratar feedback</b></li>
      </ul>
      <div class="row c2" style="margin-top:6px">
        ${loaded ? Assignee({ label: "Responsável padrão (quando o registro não tem um)", value: owner, onInput: salvarOwner, users }) : ""}
      </div>
      <div class="toolbar" style="margin-top:6px">
        <button class="btn primary" onClick=${gerar} disabled=${busy}>${busy ? "Gerando…" : "Gerar tarefas agora"}</button>
      </div>
      <p class="sub" style="margin-top:4px">As tarefas geradas aparecem em <b>Tarefas</b>, filtradas por responsável (cada um vê as suas).</p>
    </div>`;
}

/* ============================ USUÁRIOS ============================ */
function Usuarios({ user }) {
  const { rows } = useCollection(T_USERS);
  const [novo, setNovo] = useState(null);
  const [edit, setEdit] = useState(null);

  const [busy, setBusy] = useState(false);
  const salvarNovo = async () => {
    if (!novo.nome.trim() || !novo.email.trim() || !novo.senha.trim())
      return toast("Preencha nome, e-mail e senha.", "err");
    const email = novo.email.trim().toLowerCase();
    if (rows.some((u) => (u.email || "").toLowerCase() === email))
      return toast("Já existe um usuário com esse e-mail.", "err");
    setBusy(true);
    try {
      if (store.DEMO) {
        await store.insert("users", { nome: novo.nome.trim(), email, senha: novo.senha, perfil: novo.perfil, ativo: novo.ativo ? 1 : 0 });
      } else {
        await adminApi("create", { nome: novo.nome.trim(), email, senha: novo.senha, perfil: novo.perfil, ativo: novo.ativo });
      }
      await store.logAction(user.email, "usuario_criado", email);
      setNovo(null); toast("Usuário criado com acesso liberado.");
    } catch (e) { toast(e.message || "Falha ao criar usuário.", "err"); }
    finally { setBusy(false); }
  };

  const cols = [
    { key: "id", label: "ID" },
    { key: "nome", label: "Nome" },
    { key: "email", label: "Email" },
    { key: "perfil", label: "Perfil", render: (r) =>Badge(r.perfil), csv: (r) =>r.perfil },
    { key: "ativo", label: "Ativo", render: (r) => (r.ativo ? "Sim" : "Não"), csv: (r) => (r.ativo ? "Sim" : "Não") },
    { key: "criado_em", label: "Criado em" },
  ];

  return html`
    <div class="toolbar">
      <button class="btn primary" onClick=${() =>setNovo({ nome: "", email: "", senha: "", perfil: DOM.perfil[1], ativo: true })}>Criar usuário</button>
      ${ExportButtons({ nome: "usuarios", columns: cols, rows: rows, titulo: "Usuários" })}
    </div>
    <div class="count">${rows.length} usuário(s)</div>
    ${Table({ columns: cols, rows, onRow: (r) =>setEdit({ ...r }) })}

    ${novo ? html`<${Modal} title="Criar usuário" onClose=${() =>setNovo(null)}
      footer=${html`<button class="btn" onClick=${() =>setNovo(null)}>Cancelar</button>
        <button class="btn primary" onClick=${salvarNovo} disabled=${busy}>${busy ? "Criando…" : "Criar usuário"}</button>`}>
      <div class="row c2">
        ${Text({ label: "Nome *", value: novo.nome, onInput: (v) =>setNovo({ ...novo, nome: v }) })}
        ${Text({ label: "E-mail *", value: novo.email, onInput: (v) =>setNovo({ ...novo, email: v }) })}
      </div>
      <div class="row c2">
        ${Text({ label: "Senha *", type: "password", value: novo.senha, onInput: (v) =>setNovo({ ...novo, senha: v }) })}
        ${Select({ label: "Perfil", value: novo.perfil, onInput: (v) =>setNovo({ ...novo, perfil: v }), options: DOM.perfil })}
      </div>
      <label class="chk"><input type="checkbox" checked=${novo.ativo} onChange=${(e) =>setNovo({ ...novo, ativo: e.target.checked })}/>Usuário ativo (pode acessar o sistema)</label>
    <//>` : ""}

    ${edit ? html`<${EditUser} user=${user} alvo=${edit} onClose=${() =>setEdit(null)}/>` : ""}`;
}

function EditUser({ user, alvo, onClose }) {
  const [u, setU] = useState({ ...alvo, senha: "" });
  const [busy, setBusy] = useState(false);
  const ativo = !!u.ativo;
  const souEu = alvo.email === user.email;

  const salvar = async () => {
    if (!u.nome.trim()) return toast("Informe o nome.", "err");
    setBusy(true);
    try {
      const patch = { nome: u.nome.trim(), perfil: u.perfil };
      if (u.senha && store.DEMO) patch.senha = u.senha;
      await store.update(T_USERS, alvo.id, patch);
      if (u.senha && !store.DEMO) await adminApi("password", { id: alvo.id, senha: u.senha });
      await store.logAction(user.email, "usuario_editado", alvo.email);
      toast("Usuário atualizado."); onClose();
    } catch (e) { toast(e.message || "Falha ao salvar.", "err"); }
    finally { setBusy(false); }
  };

  const alternarAtivo = async () => {
    const novo = !ativo;
    if (!confirm(`${novo ? "Ativar" : "Desativar"} o acesso de ${alvo.nome || alvo.email}?` +
      (novo ? "" : "\nEle não conseguirá mais entrar no sistema."))) return;
    setBusy(true);
    try {
      await store.update(T_USERS, alvo.id, { ativo: store.DEMO ? (novo ? 1 : 0) : novo });
      await store.logAction(user.email, novo ? "usuario_ativado" : "usuario_desativado", alvo.email);
      toast(novo ? "Usuário ativado." : "Usuário desativado."); onClose();
    } catch (e) { toast(e.message || "Falha ao alterar.", "err"); }
    finally { setBusy(false); }
  };

  const remover = async () => {
    if (souEu) return toast("Você não pode remover a si mesmo.", "err");
    if (!confirm(`Remover definitivamente ${alvo.nome || alvo.email}?\nEssa ação não pode ser desfeita.`)) return;
    setBusy(true);
    try {
      if (store.DEMO) await store.remove("users", alvo.id);
      else await adminApi("remove", { id: alvo.id });
      await store.logAction(user.email, "usuario_removido", alvo.email);
      toast("Usuário removido."); onClose();
    } catch (e) { toast(e.message || "Falha ao remover.", "err"); }
    finally { setBusy(false); }
  };

  return html`<${Modal} title=${"Editar usuário"} onClose=${onClose}
    footer=${html`
      <button class="btn danger" onClick=${remover} disabled=${busy || souEu}>Remover</button>
      <button class="btn" onClick=${alternarAtivo} disabled=${busy}>${ativo ? "Desativar" : "Ativar"}</button>
      <span style="flex:1"></span>
      <button class="btn" onClick=${onClose}>Fechar</button>
      <button class="btn primary" onClick=${salvar} disabled=${busy}>Salvar</button>`}>
    <div class="user-flag ${ativo ? "on" : "off"}">
      <span class="ok-dot"></span>${ativo ? "Acesso ativo" : "Acesso desativado"}
    </div>
    ${Text({ label: "Nome", value: u.nome, onInput: (v) =>setU({ ...u, nome: v }) })}
    ${Text({ label: "E-mail", value: alvo.email, onInput: () => {} })}
    ${Select({ label: "Perfil", value: u.perfil, onInput: (v) =>setU({ ...u, perfil: v }), options: DOM.perfil })}
    ${Text({ label: "Nova senha (vazio = manter)", type: "password", value: u.senha, onInput: (v) =>setU({ ...u, senha: v }) })}
  <//>`;
}

/* ============================ SLACK ============================ */
function Slack({ user }) {
  const [saved, setSaved] = useState("");     // valor guardado (não exibido)
  const [loaded, setLoaded] = useState(false);
  const [editando, setEditando] = useState(false);
  const [url, setUrl] = useState("");         // valor do campo ao editar

  useEffect(() => {
    store.getConfig("slack_webhook", "").then((v) => { setSaved(v || ""); setLoaded(true); });
  }, []);

  const valido = (v) => /^https:\/\/hooks\.slack\.com\/services\//.test(v.trim());
  const salvar = async () => {
    const v = (url || "").trim();
    if (!valido(v)) return toast("Cole uma URL válida (https://hooks.slack.com/services/…).", "err");
    await store.setConfig("slack_webhook", v);
    await store.logAction(user.email, "slack_configurado", "webhook atualizado");
    setSaved(v); setUrl(""); setEditando(false); toast("Webhook salvo.");
  };
  const remover = async () => {
    if (!confirm("Remover o webhook? Os alertas e o digest do Slack vão parar de ser enviados.")) return;
    await store.setConfig("slack_webhook", "");
    await store.logAction(user.email, "slack_removido", "webhook removido");
    setSaved(""); setEditando(false); toast("Webhook removido.");
  };
  const testar = async () => {
    await alertarSlack(":white_check_mark: Teste de integração do CX Command Center – Alumni.", "teste");
    if (store.DEMO) toast("Em modo demo o envio é simulado.", "warn");
    else toast("Mensagem de teste enviada.");
  };

  const mostrarForm = !loaded ? false : (!saved || editando);
  return html`
    <div class="card">
      <div class="section-t">Integração Slack (Incoming Webhook)</div>
      <p class="sub">As mensagens automáticas usam esta URL. Cole a URL do webhook do canal de CX.</p>

      ${!loaded ? html`<p class="sub">Carregando…</p>`
        : mostrarForm ? html`
          ${Text({ label: "URL do Webhook", type: "password", value: url, onInput: setUrl,
            placeholder: "https://hooks.slack.com/services/…" })}
          <div class="toolbar">
            <button class="btn primary" onClick=${salvar}>Salvar URL</button>
            ${saved ? html`<button class="btn" onClick=${() => { setEditando(false); setUrl(""); }}>Cancelar</button>` : ""}
          </div>`
        : html`
          <div class="slack-status">
            <span class="ok-dot"></span>
            <div>
              <b>Webhook configurado</b>
              <div class="sub" style="margin:2px 0 0">A URL fica guardada em segurança e não é exibida aqui.</div>
            </div>
          </div>
          <div class="toolbar">
            <button class="btn primary" onClick=${testar}>Enviar teste</button>
            <button class="btn" onClick=${() => { setEditando(true); setUrl(""); }}>Trocar URL</button>
            <button class="btn danger" onClick=${remover}>Remover</button>
          </div>`}
    </div>
    <div class="card">
      <div class="section-t">Eventos que disparam alertas no Slack</div>
      <ul class="lista">
        <li>Tarefa <b>crítica</b> criada ou elevada</li>
        <li>Cancelamento acima de <b>20 dias</b></li>
        <li>Aluno com risco <b>alto</b> de churn</li>
        <li>Cobrança acima de <b>60 dias</b></li>
        <li>Reembolso pendente</li>
        <li>Feedback <b>crítico</b> registrado</li>
      </ul>
    </div>`;
}

/* ============================ BACKUP ============================ */
function Backup({ user }) {
  const [busy, setBusy] = useState(false);

  const baixar = async () => {
    setBusy(true);
    try {
      const dump = {};
      for (const tab of BACKUP_TABS) {
        try { dump[tab] = await store.list(tab); } catch (e) { dump[tab] = []; }
      }
      const payload = { gerado_em: nowTs(), tabelas: dump };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cxdash_backup.json";
      a.click();
      await store.logAction(user.email, "backup", "download JSON");
      toast("Backup gerado.");
    } finally { setBusy(false); }
  };

  return html`
    <div class="card">
      <div class="section-t">Backup do banco de dados</div>
      <p class="sub">Exporta todas as tabelas do sistema em um único arquivo JSON.</p>
      <button class="btn primary" onClick=${baixar} disabled=${busy}>Baixar backup (JSON)</button>
      <div class="count">Em modo demo, os dados vivem no navegador (localStorage) — o backup captura o estado atual.</div>
    </div>`;
}

/* ============================ LOGS ============================ */
function Logs() {
  const { rows } = useCollection("logs");
  const [fUser, setFUser] = useState("");
  const [fAcao, setFAcao] = useState("");

  const ordenadas = rows.slice().sort((a, b) => (a.id < b.id ? 1 : -1));
  const filtradas = ordenadas.filter((l) =>
    (!fUser || (l.usuario || "").toLowerCase().includes(fUser.toLowerCase())) &&
    (!fAcao || (l.acao || "").toLowerCase().includes(fAcao.toLowerCase())));

  const cols = [
    { key: "id", label: "ID" },
    { key: "ts", label: "Quando" },
    { key: "usuario", label: "Usuário" },
    { key: "acao", label: "Ação", render: (r) =>Badge(r.acao) || r.acao, csv: (r) =>r.acao },
    { key: "detalhe", label: "Detalhe" },
  ];

  return html`
    <div class="toolbar">
      <div class="grow"><label>Usuário</label>
        <input placeholder="filtrar por usuário" value=${fUser} onInput=${(e) =>setFUser(e.target.value)}/></div>
      <div class="grow"><label>Ação</label>
        <input placeholder="filtrar por ação" value=${fAcao} onInput=${(e) =>setFAcao(e.target.value)}/></div>
      ${ExportButtons({ nome: "logs", columns: cols, rows: filtradas, titulo: "Logs de auditoria" })}
    </div>
    <div class="count">${filtradas.length} registro(s)</div>
    ${Table({ columns: cols, rows: filtradas })}`;
}
