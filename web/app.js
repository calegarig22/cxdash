/* Shell da aplicação: login, sidebar por perfil, roteamento, realtime. */
import { render } from "preact";
import { html } from "htm/preact";
import { useState, useEffect } from "preact/hooks";
import { store, DEMO, resetDemo } from "./lib/store.js";
import { Toasts, toast, podeAcessar } from "./lib/ui.js";
import { Icon } from "./lib/icons.js";
import { gerarTarefasAuto } from "./lib/autotasks.js";

import { View as Dashboard } from "./modules/dashboard.js";
import { View as Tarefas } from "./modules/tarefas.js";
import { View as Cancelamentos } from "./modules/cancelamentos.js";
import { View as Cobranca } from "./modules/cobranca.js";
import { View as Retencao } from "./modules/retencao.js";
import { View as Recibos } from "./modules/recibos.js";
import { View as Playbooks } from "./modules/playbooks.js";
import { View as Voc } from "./modules/voc.js";
import { View as Importar } from "./modules/importar.js";
import { View as Admin } from "./modules/admin.js";
import { View as Relatorios } from "./modules/relatorios.js";

const MENU = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard", C: Dashboard },
  { key: "tarefas", label: "Tarefas", icon: "tarefas", C: Tarefas },
  { key: "cancelamentos", label: "Cancelamentos", icon: "cancelamentos", C: Cancelamentos },
  { key: "cobranca", label: "Cobrança", icon: "cobranca", C: Cobranca },
  { key: "retencao", label: "Retenção / Churn", icon: "retencao", C: Retencao },
  { key: "recibos", label: "Recibos", icon: "recibos", C: Recibos },
  { key: "playbooks", label: "Playbooks", icon: "playbooks", C: Playbooks },
  { key: "voc", label: "Feedbacks", icon: "voc", C: Voc },
  { key: "importar", label: "Importar", icon: "importar", C: Importar },
  { key: "relatorios", label: "Relatórios", icon: "relatorios", C: Relatorios },
  { key: "admin", label: "Painel Admin", icon: "admin", C: Admin },
];
const BRAND = (window.CX_CONFIG || {}).BRAND || { nome: "CX Command Center", sub: "Alumni by Better" };

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const entrar = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { onLogin(await store.auth.signIn(email, senha)); }
    catch (ex) { setErr(ex.message || "Falha no login."); }
    finally { setBusy(false); }
  };
  return html`<div class="login"><div class="box">
    <div class="lead"><div class="brand-mark">CX</div>
      <div><h1>${BRAND.nome}</h1><div class="tag">Alumni by Better</div></div></div>
    <form onSubmit=${entrar}>
      <div class="field"><label>E-mail</label>
        <input type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} placeholder="voce@betteredu.com.br" autofocus/></div>
      <div class="field"><label>Senha</label>
        <input type="password" value=${senha} onInput=${(e) => setSenha(e.target.value)}/></div>
      <button class="btn primary" style="width:100%;justify-content:center" disabled=${busy}>${busy ? "Entrando…" : "Entrar"}</button>
      ${err ? html`<div class="err">${err}</div>` : ""}
    </form>
    ${DEMO ? html`<div class="demo-users">
      <div class="mode-banner" style="margin-top:16px">Modo demonstração (dados locais no navegador). Usuários de teste:</div>
      <table><tbody>
        <tr><td><b>Admin</b></td><td>admin@betteredu.com.br</td><td>admin123</td></tr>
        <tr><td><b>CX</b></td><td>ana.cx@betteredu.com.br</td><td>cx123</td></tr>
        <tr><td><b>Financeiro</b></td><td>bruno.fin@betteredu.com.br</td><td>fin123</td></tr>
        <tr><td><b>Coordenação</b></td><td>carla.coord@betteredu.com.br</td><td>coord123</td></tr>
      </tbody></table></div>` : ""}
  </div></div>`;
}

function App() {
  const [user, setUser] = useState(undefined); // undefined=carregando
  const [route, setRoute] = useState("dashboard");
  useEffect(() => { store.auth.current().then((u) => setUser(u || null)); }, []);
  // materializa as tarefas automáticas quando alguém entra (idempotente por ref)
  useEffect(() => { if (user && user.email) gerarTarefasAuto(user).catch(() => {}); }, [user && user.id]);

  if (user === undefined) return html`<div class="login"><div class="box">Carregando…</div></div>`;
  if (!user) return html`<${Login} onLogin=${(u) => { setUser(u); setRoute("dashboard"); }}/><${Toasts}/>`;

  const itens = MENU.filter((m) => podeAcessar(user.perfil, m.key));
  const atual = itens.find((m) => m.key === route) || itens[0];
  const sair = async () => { await store.logAction(user.email, "logout", ""); await store.auth.signOut(); setUser(null); };

  return html`<div class="app">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">CX</div>
        <div class="brand-tx"><b>${BRAND.nome}</b><span>${BRAND.sub}</span></div></div>
      <div class="me"><b>${user.nome}</b><span>${user.perfil}</span></div>
      <nav class="nav">${itens.map((m) => html`
        <button class=${m.key === atual.key ? "active" : ""} onClick=${() => setRoute(m.key)}>
          ${Icon(m.icon)}<span>${m.label}</span></button>`)}
      </nav>
      <div class="rail-actions">
        <button onClick=${sair}>${Icon("logout")}<span>Sair</span></button>
        ${DEMO ? html`<button
          onClick=${() => { if (confirm("Restaurar dados de demonstração?")) { resetDemo(); location.reload(); } }}>
          ${Icon("reset")}<span>Resetar demo</span></button>` : ""}
      </div>
    </aside>
    <main class="main">
      ${DEMO ? html`<div class="mode-banner"><b>Modo demonstração</b> — dados salvos apenas neste navegador. Configure o Supabase para dados compartilhados em tempo real.</div>` : ""}
      <${atual.C} user=${user} key=${atual.key}/>
    </main>
    <${Toasts}/>
  </div>`;
}

render(html`<${App}/>`, document.getElementById("root"));
