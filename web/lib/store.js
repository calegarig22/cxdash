/* Camada de dados: mesma API para modo DEMO (localStorage) e Supabase.
   Tabelas: users(profiles), tarefas, tarefa_hist, cancelamentos, cancel_hist,
   cobrancas, retencao, documentos, consultorias, playbooks, voc, logs, config. */
import { createClient } from "@supabase/supabase-js";

const CFG = window.CX_CONFIG || {};
export const DEMO = CFG.DEMO_MODE || !CFG.SUPABASE_URL;

const hoje = () => new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const nowTs = () => new Date().toISOString().slice(0, 19).replace("T", " ");
export const addDays = (n) => iso(new Date(Date.now() + n * 864e5));

/* ============================ MODO DEMO ============================ */
const LS = "cxcc_demo_v1";

function seed() {
  return {
    users: [
      { id: "u1", nome: "Administrador", email: "admin@betteredu.com.br", senha: "admin123", perfil: "Admin", ativo: 1 },
      { id: "u2", nome: "Ana CX", email: "ana.cx@betteredu.com.br", senha: "cx123", perfil: "CX", ativo: 1 },
      { id: "u3", nome: "Bruno Financeiro", email: "bruno.fin@betteredu.com.br", senha: "fin123", perfil: "Financeiro", ativo: 1 },
      { id: "u4", nome: "Carla Coordenação", email: "carla.coord@betteredu.com.br", senha: "coord123", perfil: "Coordenação", ativo: 1 },
    ],
    config: [{ chave: "slack_webhook", valor: "" }],
    tarefas: [
      { id: "t1", titulo: "Retornar contato do aluno João sobre boleto", tipo: "Cobrança", responsavel: "Ana CX", prioridade: "Alta", status: "Em andamento", prazo: addDays(-1), observacoes: "", criado_em: nowTs() },
      { id: "t2", titulo: "Analisar pedido de cancelamento – Maria", tipo: "Cancelamento", responsavel: "Bruno Financeiro", prioridade: "Crítica", status: "Aguardando outra área", prazo: addDays(-3), observacoes: "", criado_em: nowTs() },
      { id: "t3", titulo: "Ligar para aluno em risco de churn – Pedro", tipo: "Retenção", responsavel: "Carla Coordenação", prioridade: "Alta", status: "Aberta", prazo: addDays(2), observacoes: "", criado_em: nowTs() },
      { id: "t4", titulo: "Emitir recibo de pagamento – Lucas", tipo: "Financeiro", responsavel: "Ana CX", prioridade: "Média", status: "Aberta", prazo: addDays(1), observacoes: "", criado_em: nowTs() },
      { id: "t5", titulo: "Responder Reclame Aqui #4521", tipo: "Reclame Aqui", responsavel: "Ana CX", prioridade: "Crítica", status: "Aberta", prazo: addDays(0), observacoes: "", criado_em: nowTs() },
      { id: "t6", titulo: "Follow-up acadêmico – turma B2", tipo: "Acadêmico", responsavel: "Carla Coordenação", prioridade: "Baixa", status: "Concluída", prazo: addDays(-5), observacoes: "", criado_em: nowTs() },
    ],
    tarefa_hist: [
      { id: "th1", pai: "t1", ts: nowTs(), usuario: "sistema", texto: "Tarefa criada (status 'Em andamento')." },
      { id: "th2", pai: "t2", ts: nowTs(), usuario: "sistema", texto: "Tarefa criada (status 'Aguardando outra área')." },
    ],
    cancelamentos: [
      { id: "c1", aluno: "Maria Souza", email: "maria@email.com", telefone: "(11) 99999-1111", data_solicitacao: addDays(-22), motivo: "Mudança financeira", status: "Aguardando financeiro", valor_multa: 300, valor_material: 150, valor_reembolso: 800, observacoes: "", anexos: "", criado_em: nowTs() },
      { id: "c2", aluno: "Rafael Lima", email: "rafael@email.com", telefone: "(11) 98888-2222", data_solicitacao: addDays(-5), motivo: "Insatisfação metodologia", status: "Em análise", valor_multa: 0, valor_material: 0, valor_reembolso: 0, observacoes: "", anexos: "", criado_em: nowTs() },
      { id: "c3", aluno: "Julia Alves", email: "julia@email.com", telefone: "(11) 97777-3333", data_solicitacao: addDays(-28), motivo: "Falta de tempo", status: "Aguardando diretoria", valor_multa: 200, valor_material: 100, valor_reembolso: 500, observacoes: "", anexos: "", criado_em: nowTs() },
    ],
    cancel_hist: [{ id: "ch1", pai: "c1", ts: nowTs(), usuario: "sistema", texto: "Solicitação registrada – status 'Aguardando financeiro'." }],
    cobrancas: [
      { id: "b1", aluno: "João Pereira", valor: 450, vencimento: addDays(-8), status: "2º contato", ultima_mensagem: "", proxima_acao: "", responsavel: "Ana CX", observacoes: "", criado_em: nowTs() },
      { id: "b2", aluno: "Fernanda Dias", valor: 1200, vencimento: addDays(-65), status: "Pré-negativação", ultima_mensagem: "", proxima_acao: "", responsavel: "Bruno Financeiro", observacoes: "", criado_em: nowTs() },
      { id: "b3", aluno: "Carlos Nunes", valor: 300, vencimento: addDays(-15), status: "3º contato", ultima_mensagem: "", proxima_acao: "", responsavel: "Ana CX", observacoes: "", criado_em: nowTs() },
      { id: "b4", aluno: "Beatriz Rocha", valor: 890, vencimento: addDays(-3), status: "1º contato", ultima_mensagem: "", proxima_acao: "", responsavel: "Bruno Financeiro", observacoes: "", criado_em: nowTs() },
      { id: "b5", aluno: "Diego Martins", valor: 600, vencimento: addDays(-30), status: "Regularizado", ultima_mensagem: "", proxima_acao: "", responsavel: "Ana CX", observacoes: "", criado_em: nowTs() },
    ],
    retencao: [
      { id: "r1", aluno: "Pedro Gomes", motivo: "financeiro", nivel: "alto", acao_sugerida: "Plano de retomada leve", status: "Em acompanhamento", resultado: "Em acompanhamento", observacoes: "", score: 85, criado_em: nowTs() },
      { id: "r2", aluno: "Sofia Ramos", motivo: "metodologia", nivel: "médio", acao_sugerida: "Reavaliação acadêmica", status: "Em acompanhamento", resultado: "Em acompanhamento", observacoes: "", score: 52, criado_em: nowTs() },
      { id: "r3", aluno: "Thiago Melo", motivo: "baixo uso", nivel: "alto", acao_sugerida: "Aulas particulares", status: "Em acompanhamento", resultado: "Em acompanhamento", observacoes: "", score: 83, criado_em: nowTs() },
      { id: "r4", aluno: "Lara Costa", motivo: "horários", nivel: "baixo", acao_sugerida: "Ajuste de agenda", status: "Em acompanhamento", resultado: "Retido", observacoes: "", score: 22, criado_em: nowTs() },
    ],
    documentos: [],
    consultorias: [
      { id: "s1", aluno: "Isabela Freitas", tipo: "Private", solicitante: "Ana CX", data_solicitada: addDays(-2), data_agendada: addDays(3), responsavel: "Carla Coordenação", status: "Agendada", link_zoom: "https://zoom.us/j/123", observacoes: "", criado_em: nowTs() },
      { id: "s2", aluno: "Marcelo Pinto", tipo: "Black", solicitante: "Bruno Financeiro", data_solicitada: addDays(-1), data_agendada: "", responsavel: "Carla Coordenação", status: "Aprovada", link_zoom: "", observacoes: "", criado_em: nowTs() },
      { id: "s3", aluno: "Renata Lopes", tipo: "Retenção", solicitante: "Carla Coordenação", data_solicitada: addDays(-10), data_agendada: addDays(-4), responsavel: "Ana CX", status: "Realizada", link_zoom: "https://zoom.us/j/456", observacoes: "", criado_em: nowTs() },
    ],
    playbooks: [
      { id: "p1", categoria: "Cobrança", titulo: "1º contato amigável", conteudo: "Olá {nome}! Tudo bem? Identificamos uma pendência referente à sua mensalidade. Podemos te ajudar a regularizar? Qualquer dúvida, estou à disposição. 💙", favorito: 1, criado_em: nowTs() },
      { id: "p2", categoria: "Cobrança", titulo: "Pré-negativação", conteudo: "Olá {nome}, seu débito está há mais de 60 dias em aberto. Para evitar a negativação, pedimos a regularização até {data}. Podemos negociar condições especiais.", favorito: 0, criado_em: nowTs() },
      { id: "p3", categoria: "Cancelamento", titulo: "Recebimento da solicitação", conteudo: "Olá {nome}, recebemos sua solicitação de cancelamento. Ela será analisada em até 30 dias conforme contrato. Retornaremos com os próximos passos.", favorito: 0, criado_em: nowTs() },
      { id: "p4", categoria: "Retenção", titulo: "Oferta de retenção", conteudo: "{nome}, queremos muito te ajudar a continuar sua evolução! Que tal reavaliarmos juntos seu plano de estudos e agenda? Temos algumas opções pensadas pra você.", favorito: 1, criado_em: nowTs() },
      { id: "p5", categoria: "Aluno agressivo", titulo: "Acolhimento e desescalada", conteudo: "Entendo sua frustração, {nome}, e lamento muito pelo ocorrido. Vou tratar isso pessoalmente e te dar um retorno com prazo definido. Obrigado pela paciência.", favorito: 0, criado_em: nowTs() },
      { id: "p6", categoria: "Problemas com plataforma", titulo: "Suporte técnico", conteudo: "Sentimos muito pelo transtorno, {nome}. Pode nos enviar um print do erro? Nossa equipe técnica já está acompanhando e retornaremos rapidamente.", favorito: 0, criado_em: nowTs() },
      { id: "p7", categoria: "Reembolso", titulo: "Confirmação de reembolso", conteudo: "Olá {nome}, seu reembolso foi aprovado no valor de {valor} e será processado em até 10 dias úteis na forma de pagamento original.", favorito: 0, criado_em: nowTs() },
      { id: "p8", categoria: "Reclame Aqui", titulo: "Resposta pública padrão", conteudo: "Olá! Lamentamos o ocorrido e já estamos em contato direto para solucionar. A Alumni preza pela melhor experiência e vamos resolver isso com você.", favorito: 0, criado_em: nowTs() },
    ],
    voc: [
      { id: "v1", aluno: "Pedro Gomes", categoria: "Plataforma", tipo: "reclamação", gravidade: "Alta", descricao: "App trava ao abrir aulas", area: "Produto", status: "Aberto", acao: "", criado_em: nowTs() },
      { id: "v2", aluno: "Sofia Ramos", categoria: "Professor", tipo: "reclamação", gravidade: "Média", descricao: "Professor faltou 2 aulas", area: "Acadêmico", status: "Em tratativa", acao: "", criado_em: nowTs() },
      { id: "v3", aluno: "Isabela Freitas", categoria: "Metodologia", tipo: "elogio", gravidade: "Baixa", descricao: "Adorei o método de conversação", area: "Acadêmico", status: "Resolvido", acao: "", criado_em: nowTs() },
      { id: "v4", aluno: "Carlos Nunes", categoria: "Horário", tipo: "sugestão", gravidade: "Baixa", descricao: "Poderia ter turmas noturnas", area: "Comercial", status: "Aberto", acao: "", criado_em: nowTs() },
      { id: "v5", aluno: "Fernanda Dias", categoria: "Financeiro", tipo: "reclamação", gravidade: "Crítica", descricao: "Cobrança indevida na fatura", area: "Financeiro", status: "Aberto", acao: "", criado_em: nowTs() },
      { id: "v6", aluno: "Rafael Lima", categoria: "Plataforma", tipo: "reclamação", gravidade: "Alta", descricao: "Vídeos não carregam", area: "Produto", status: "Aberto", acao: "", criado_em: nowTs() },
    ],
    logs: [],
  };
}

function demoLoad() {
  let db = null;
  try { db = JSON.parse(localStorage.getItem(LS)); } catch (e) { db = null; }
  if (!db) { db = seed(); localStorage.setItem(LS, JSON.stringify(db)); }
  return db;
}
function demoSave(db) { localStorage.setItem(LS, JSON.stringify(db)); }
function uid() { return "x" + Math.random().toString(36).slice(2, 10); }
export function resetDemo() { localStorage.removeItem(LS); localStorage.removeItem("cxcc_session"); }

const subs = {}; // eventos locais p/ re-render em modo demo

/* ============================ SUPABASE ============================ */
let sb = null;
if (!DEMO) sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
export const supabase = sb;

/* ============================ API UNIFICADA ============================ */
export const store = {
  DEMO,

  /* -------- auth -------- */
  auth: {
    async signIn(email, senha) {
      email = (email || "").trim().toLowerCase();
      if (DEMO) {
        const db = demoLoad();
        const u = db.users.find((x) => x.email === email && x.senha === senha && x.ativo);
        if (!u) throw new Error("Credenciais inválidas ou usuário inativo.");
        const sess = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
        localStorage.setItem("cxcc_session", JSON.stringify(sess));
        await store.logAction(u.email, "login", "acesso ao sistema");
        return sess;
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw new Error("Credenciais inválidas.");
      const prof = await store.get("profiles", data.user.id, "id");
      if (!prof || !prof.ativo) { await sb.auth.signOut(); throw new Error("Usuário inativo."); }
      await store.logAction(prof.email, "login", "acesso ao sistema");
      return prof;
    },
    async current() {
      if (DEMO) {
        try { return JSON.parse(localStorage.getItem("cxcc_session")); } catch (e) { return null; }
      }
      const { data } = await sb.auth.getUser();
      if (!data || !data.user) return null;
      return await store.get("profiles", data.user.id, "id");
    },
    async signOut() {
      if (DEMO) { localStorage.removeItem("cxcc_session"); return; }
      await sb.auth.signOut();
    },
    async token() {
      if (DEMO) return "";
      const { data } = await sb.auth.getSession();
      return (data && data.session && data.session.access_token) || "";
    },
  },

  /* -------- CRUD -------- */
  async list(table, opts = {}) {
    if (DEMO) {
      const db = demoLoad();
      let rows = (db[table] || []).slice();
      if (opts.order) rows.sort((a, b) => (a[opts.order] > b[opts.order] ? 1 : -1) * (opts.desc ? -1 : 1));
      return rows;
    }
    let q = sb.from(table).select("*");
    if (opts.order) q = q.order(opts.order, { ascending: !opts.desc });
    if (opts.eq) Object.entries(opts.eq).forEach(([k, v]) => (q = q.eq(k, v)));
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async get(table, id, key = "id") {
    if (DEMO) { const db = demoLoad(); return (db[table] || []).find((r) => r[key] === id) || null; }
    const { data } = await sb.from(table).select("*").eq(key, id).maybeSingle();
    return data || null;
  },

  async insert(table, row) {
    if (DEMO) {
      const db = demoLoad();
      const r = Object.assign({ id: uid(), criado_em: nowTs() }, row);
      (db[table] = db[table] || []).unshift(r);
      demoSave(db); emit(table);
      return r;
    }
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) throw error;
    return data;
  },

  /* insere várias linhas de uma vez (importação de planilha) */
  async bulkInsert(table, rows) {
    if (!rows || !rows.length) return 0;
    if (DEMO) { for (const r of rows) await store.insert(table, r); return rows.length; }
    let n = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await sb.from(table).insert(chunk);
      if (error) throw error;
      n += chunk.length;
    }
    return n;
  },

  async update(table, id, patch, key = "id") {
    if (DEMO) {
      const db = demoLoad();
      const r = (db[table] || []).find((x) => x[key] === id);
      if (r) Object.assign(r, patch);
      demoSave(db); emit(table);
      return r;
    }
    const { data, error } = await sb.from(table).update(patch).eq(key, id).select().single();
    if (error) throw error;
    return data;
  },

  /* atualiza/remove várias linhas de uma vez (ações em massa) */
  async bulkUpdate(table, ids, patch) {
    if (!ids || !ids.length) return 0;
    if (DEMO) { for (const id of ids) await store.update(table, id, patch); return ids.length; }
    const { error } = await sb.from(table).update(patch).in("id", ids);
    if (error) throw error;
    return ids.length;
  },
  async bulkRemove(table, ids) {
    if (!ids || !ids.length) return 0;
    if (DEMO) { for (const id of ids) await store.remove(table, id); return ids.length; }
    const { error } = await sb.from(table).delete().in("id", ids);
    if (error) throw error;
    return ids.length;
  },

  async remove(table, id, key = "id") {
    if (DEMO) {
      const db = demoLoad();
      db[table] = (db[table] || []).filter((x) => x[key] !== id);
      demoSave(db); emit(table);
      return;
    }
    const { error } = await sb.from(table).delete().eq(key, id);
    if (error) throw error;
  },

  /* -------- usuários da equipe (para atribuição/escopo) -------- */
  async listUsers() {
    if (DEMO) { const db = demoLoad(); return (db.users || []).filter((u) => u.ativo); }
    const { data } = await sb.from("profiles").select("nome,email,perfil,ativo").eq("ativo", true).order("nome");
    return data || [];
  },

  /* -------- config -------- */
  async getConfig(chave, def = "") {
    const rows = await store.list("config");
    const r = rows.find((x) => x.chave === chave);
    return r ? r.valor : def;
  },
  async setConfig(chave, valor) {
    if (DEMO) {
      const db = demoLoad();
      const r = db.config.find((x) => x.chave === chave);
      if (r) r.valor = valor; else db.config.push({ chave, valor });
      demoSave(db); return;
    }
    await sb.from("config").upsert({ chave, valor });
  },

  /* -------- logs -------- */
  async logAction(usuario, acao, detalhe = "") {
    const row = { ts: nowTs(), usuario, acao, detalhe };
    if (DEMO) { const db = demoLoad(); (db.logs = db.logs || []).unshift(Object.assign({ id: uid() }, row)); demoSave(db); return; }
    try { await sb.from("logs").insert(row); } catch (e) {}
  },

  /* -------- realtime / re-render -------- */
  subscribe(table, cb) {
    if (DEMO) {
      (subs[table] = subs[table] || []).push(cb);
      return () => { subs[table] = (subs[table] || []).filter((f) => f !== cb); };
    }
    const ch = sb.channel("rt_" + table + "_" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table }, cb)
      .subscribe();
    return () => sb.removeChannel(ch);
  },
};

function emit(table) { (subs[table] || []).forEach((cb) => { try { cb(); } catch (e) {} }); }
