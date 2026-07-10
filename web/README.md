# CX Command Center – Alumni (web) 🎧

CRM interno de Customer Experience da **Alumni by Better** — plataforma **viva**, hospedada e
compartilhada em tempo real. Frontend **sem build** (Preact + htm via CDN/ESM), dados e
autenticação no **Supabase**, automações em **funções serverless + Vercel Cron**.

Mesmo código roda em dois modos:
- **Modo demo** (padrão): dados locais no navegador, para testar sem infraestrutura.
- **Modo Supabase**: dados compartilhados, multiusuário, edições em tempo real entre todos.

---

## 1. Rodar localmente (modo demo)

Não precisa de Node. Basta servir a pasta:

```bash
cd web
python3 -m http.server 8611
# abra http://localhost:8611
```

Login demo: `admin@betteredu.com.br` / `admin123` (também CX, Financeiro, Coordenação — ver tela).
O botão **♻️ Resetar demo** restaura os dados de exemplo.

## 2. Colocar no ar (modo Supabase + Vercel)

### 2.1 Criar o banco (Supabase)
1. Crie um projeto em https://supabase.com (grátis).
2. **SQL Editor** → cole e rode `supabase/schema.sql` (cria tabelas, RLS, realtime e dados de exemplo).
3. **Authentication → Users → Add user**: crie seu 1º usuário (e-mail + senha).
   Depois, no SQL Editor: `update public.profiles set perfil='Admin' where email='seu@email';`
4. **Project Settings → API**: copie a `Project URL` e a chave `anon public`.

### 2.2 Configurar o frontend
Edite `config.js`:
```js
window.CX_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "sua-anon-key",
  DEMO_MODE: false,
  ...
};
```
> A `anon key` é pública por design — a segurança vem do **RLS** (só usuários autenticados leem/escrevem).

### 2.3 Publicar na Vercel
Recomendado via GitHub (a Vercel builda as funções na nuvem — dispensa Node local):
1. Suba o repositório no GitHub.
2. Em https://vercel.com → **New Project** → importe o repo.
3. **Root Directory:** `cxdash/web`.
4. **Environment Variables** (para as funções serverless / automações):

   | Variável | Valor | Usada por |
   |---|---|---|
   | `SUPABASE_URL` | URL do projeto | funções cron + slack |
   | `SUPABASE_SERVICE_KEY` | chave `service_role` (Settings → API) | funções cron + slack |
   | `SLACK_WEBHOOK` | (opcional) URL do Incoming Webhook | pode ficar vazio e ser definido no Painel Admin |
   | `CRON_SECRET` | (opcional) string aleatória | protege os endpoints de cron |
5. **Deploy**. Pronto — URL pública, sempre no ar.

> A chave `service_role` **nunca** vai para o frontend — só nas env vars das funções.

## 3. Automações (rodando sozinhas)

Definidas em `vercel.json` (Vercel Cron, horários em UTC):

| Função | Quando | O que faz |
|---|---|---|
| `/api/cron-digest` | diário ~08h BRT | Envia ao Slack o **digest do dia**: tarefas vencidas/críticas, cobranças >60d, cancelamentos >20d, churn alto, consultorias de hoje |
| `/api/cron-recalc` | diário ~02h30 BRT | **Recalcula scores de churn**, detecta cobranças/cancelamentos que cruzaram o limiar e dispara **alertas** ao Slack |

Alertas **em tempo real** (evento a evento) saem direto do app via `/api/slack` ao criar/editar:
tarefa crítica, cancelamento >20d, churn alto, cobrança >60d, nova consultoria, feedback crítico.

## 4. Módulos

Dashboard · Tarefas (histórico) · Cancelamentos (prazo 30d) · Cobrança (régua 7·14·21·28·60d + mensagem pronta) ·
Retenção/Churn (score) · Recibos & Termos (PDF institucional via impressão) · Consultorias ·
Playbooks · Voice of Customer (dashboard) · Painel Admin (usuários, Slack, backup, logs) · Relatórios.

Perfis: **Admin** (tudo) · **CX** · **Financeiro** · **Coordenação** — o menu se adapta ao perfil.

## 5. Estrutura

```
web/
├── index.html            # shell + importmap (Preact/htm/supabase via CDN)
├── config.js             # SUPABASE_URL / ANON_KEY / DEMO_MODE
├── app.js                # login, sidebar por perfil, roteamento
├── styles.css            # tema SaaS (marca Alumni)
├── lib/
│   ├── store.js          # adaptador de dados (demo ⇄ Supabase) + realtime + auth
│   ├── hooks.js          # useCollection (lista + realtime)
│   ├── ui.js             # componentes + regras de negócio (régua, churn, valor extenso…)
│   └── notify.js         # alerta Slack (via /api/slack)
├── modules/              # um arquivo por módulo (dashboard, tarefas, …)
├── api/                  # funções serverless: slack.js, cron-digest.js, cron-recalc.js
├── supabase/schema.sql   # tabelas + RLS + realtime + seed
├── package.json          # dep das funções (@supabase/supabase-js)
└── vercel.json           # crons + headers de segurança (CSP)
```

## 6. Segurança

- **RLS** no Supabase: só usuários autenticados acessam os dados.
- `service_role` apenas em env vars de servidor; `anon key` no cliente (seguro com RLS).
- **CSP** e headers de segurança em `vercel.json`.
- Export CSV neutraliza **injeção de fórmula**.
- **Logs de auditoria** de todas as ações.

> Observação: no modo Supabase, **criar usuários** exige o Supabase Auth (o Painel Admin edita
> perfis/ativo; a criação com senha é feita no Supabase Auth ou por uma função com `service_role`).
