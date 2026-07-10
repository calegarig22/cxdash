# CX Command Center 🎧

> Central de operações de **Customer Experience** — um CRM interno completo que reúne atendimento, cobrança, cancelamentos, retenção/churn, recibos, consultorias, base de conhecimento e relatórios em um só lugar.

![Preact](https://img.shields.io/badge/Preact-673AB8?logo=preact&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)
![PostgreSQL RLS](https://img.shields.io/badge/PostgreSQL-RLS-4169E1?logo=postgresql&logoColor=white)
![Streamlit](https://img.shields.io/badge/Streamlit-FF4B4B?logo=streamlit&logoColor=white)
![No build](https://img.shields.io/badge/build-nenhum-success)

Ferramenta desenvolvida para a equipe de CX da **Alumni by Better**. Este repositório é
uma **vitrine técnica** do projeto — roda em **modo demo** com dados fictícios, sem
nenhuma informação real de clientes.

---

## 💡 O que torna este projeto interessante

- **Frontend reativo sem build.** Zero bundler, zero `node_modules`, zero etapa de compilação.
  Preact + htm carregados por **ESM via CDN** (import maps). Você edita um arquivo e recarrega —
  a mesma app que vai para produção roda com um simples `python3 -m http.server`.
- **Multiusuário em tempo real.** Com Supabase Realtime, uma edição feita por uma pessoa
  aparece na tela de todas as outras **na hora**, sem recarregar.
- **Um código, dois modos.** O mesmo app funciona offline (dados no navegador, para testes)
  ou conectado ao Supabase (dados compartilhados) — trocando **uma linha** de config.
- **Automações que rodam sozinhas.** Funções serverless + Vercel Cron enviam o digest diário
  e recalculam scores de churn de madrugada, disparando alertas no Slack.
- **Segurança levada a sério.** Row-Level Security no banco, hardening contra escalonamento de
  privilégio, sanitização de XSS/injeção de fórmula e cuidado com LGPD (ver abaixo).

## 🧱 Duas implementações

| Versão | Stack | Para quê |
|---|---|---|
| **Web** (`web/`) — *principal* | Preact + htm · Supabase (Auth/RLS/Realtime) · Vercel Serverless + Cron | Plataforma viva, hospedada, multiusuário e em tempo real |
| **Streamlit** (`app.py`, `core/`, `modules/`) — *origem* | Python · Streamlit · SQLite | Protótipo local, roda com um comando, sem infraestrutura |

## 🗺️ Arquitetura (versão web)

```
        ┌──────────────────────────────────────────────┐
        │              Navegador (SPA)                  │
        │   Preact + htm · sem build · ESM via CDN      │
        │   UI reativa e colaborativa em tempo real     │
        └──────────────────┬───────────────────────────┘
                           │  anon key + JWT  ·  toda leitura/escrita passa por RLS
        ┌──────────────────▼───────────────────────────┐
        │                  Supabase                     │
        │   Postgres · Auth · Row-Level Security        │
        │   Realtime — edições ao vivo entre todos      │
        └──────────────────▲───────────────────────────┘
                           │  service_role (somente servidor, nunca no cliente)
        ┌──────────────────┴───────────────────────────┐
        │         Vercel — Serverless + Cron            │
        │   /api/cron-digest   ·   /api/cron-recalc     │
        │   alertas para o Slack (tempo real + diário)  │
        └───────────────────────────────────────────────┘
```

## ✨ Módulos

| Módulo | O que faz |
|---|---|
| **Dashboard** | Indicadores do dia: pendências, cancelamentos, reembolsos, churn, cobranças, consultorias, tarefas vencidas e casos críticos |
| **Tarefas** | CRUD com tipo, prioridade, prazo e **histórico**. Vencidas em vermelho; críticas alertam no Slack |
| **Cancelamentos** | Fluxo completo (prazo de 30 dias), cálculo de multa/material/reembolso, histórico e alerta > 20 dias |
| **Cobrança** | Régua automática **7·14·21·28·60 dias**, mensagem sugerida por estágio e alerta > 60 dias |
| **Retenção / Churn** | **Score de churn** (motivo + urgência + histórico), oferta de retenção sugerida e alerta de risco alto |
| **Recibos & Termos** | Documentos institucionais em PDF (recibo, quitação, vínculo, cancelamento) com reimpressão |
| **Consultorias** | Private / Black / Retenção — status, link de reunião, relatório por mês |
| **Playbooks** | Base de conhecimento com busca, favoritos e scripts prontos para copiar |
| **Voice of Customer** | Registro de feedbacks + dashboard (top reclamações, por área, críticos, sugestões) |
| **Painel Admin** | Usuários, perfis, senhas, webhook do Slack, backup e **logs de auditoria** |
| **Relatórios** | Relatórios exportáveis em Excel/CSV com visão gráfica |

**Perfis de acesso:** `Admin` · `CX` · `Financeiro` · `Coordenação` — o menu lateral e as
permissões de edição se adaptam ao perfil de cada pessoa.

## 🚀 Rodar em modo demo (30 segundos)

Não precisa de Node nem de conta em nenhum serviço.

**Versão web** (recomendada para ver a interface):
```bash
cd web
python3 -m http.server 8611
# abra http://localhost:8611
```

**Versão Streamlit:**
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py          # abre em http://localhost:8501
```

### Usuários de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | admin@btd.com.br | `admin123` |
| CX | ana.cx@btd.com.br | `cx123` |
| Financeiro | bruno.fin@btd.com.br | `fin123` |
| Coordenação | carla.coord@btd.com.br | `coord123` |

> Credenciais e dados são **fictícios**, criados automaticamente para a demonstração.
> Para colocar a versão web no ar (Supabase + Vercel), veja **[`web/README.md`](web/README.md)**.

## 🔒 Segurança & LGPD

Engenharia de segurança foi tratada como requisito, não como enfeite:

- **Row-Level Security (RLS)** em todas as tabelas: a `anon key` é pública por design e a
  proteção real vem das políticas — só usuários **autenticados** acessam dados, e apenas o que
  seu perfil permite. Cadastro público desativado (usuários são provisionados pelo Admin).
- **Anti-escalonamento de privilégio:** políticas `RESTRICTIVE` impedem que um usuário comum
  altere o próprio perfil, leia segredos de configuração ou apague registros/logs.
- **Senhas com PBKDF2-HMAC-SHA256** (salt por usuário) na versão Streamlit — nunca em texto puro.
- **XSS neutralizado** no renderizador de markdown (bloqueio de `javascript:`/`data:` em links).
- **Injeção de fórmula** neutralizada nas exportações CSV/Excel (`= + - @`).
- **CSP e headers de segurança** definidos no `vercel.json`.
- **Logs de auditoria** de todas as ações (login, criação/edição, backup, Slack).
- **`service_role` só no servidor** (env vars das funções) — jamais no frontend.

## 🗂️ Estrutura

```
cxdash/
├── web/                  # ★ versão web (Preact + Supabase + Vercel)
│   ├── index.html        #   shell + importmap (ESM via CDN)
│   ├── app.js            #   login, sidebar por perfil, roteamento
│   ├── lib/              #   store (demo ⇄ Supabase + realtime), hooks, ui, markdown seguro
│   ├── modules/          #   um arquivo por módulo funcional
│   ├── api/              #   funções serverless (slack, crons)
│   ├── supabase/         #   schema.sql (tabelas + RLS + realtime + seed)
│   └── vercel.json       #   crons + headers de segurança
│
├── app.py                # versão Streamlit — entrada (login, roteamento por perfil)
├── core/                 #   db (SQLite), auth (PBKDF2), pdf, exporter, slack, ui
├── modules/              #   um arquivo por módulo
└── requirements.txt
```

---

<sub>Projeto interno de CX da **Alumni by Better** · publicado como vitrine técnica, com dados de exemplo.</sub>
