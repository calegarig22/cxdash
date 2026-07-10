# CX Command Center – Alumni 🎧

Plataforma interna da equipe de **Customer Experience** da **Alumni by Better** para
administrar todas as frentes operacionais, financeiras, acadêmicas e de retenção do dia a dia:
atendimento, cobrança, cancelamentos, reembolsos, retenção/churn, emissão de recibos,
consultorias, base de conhecimento, Voice of Customer e relatórios — com login por perfil,
alertas no Slack e exportação em PDF/Excel.

Construída em **Python + Streamlit + SQLite**. Roda localmente com um comando.

---

## ✨ Módulos

| Módulo | O que faz |
|---|---|
| **Dashboard** | Cards de indicadores: pendências, cancelamentos, reembolsos, churn, cobranças, consultorias, tarefas vencidas/do dia, casos críticos |
| **Tarefas** | CRUD de tarefas com tipo, prioridade, status, prazo e **histórico**. Vencidas em vermelho; críticas alertam no Slack |
| **Cancelamentos** | Fluxo completo (prazo de 30 dias), valores de multa/material/reembolso, histórico e **alerta > 20 dias** |
| **Cobrança** | Régua automática **7·14·21·28·60 dias**, mensagem sugerida por estágio (copiar), alerta **> 60 dias** |
| **Retenção / Churn** | **Score de churn** (motivo + urgência + histórico), oferta de retenção sugerida, alerta risco alto |
| **Recibos & Termos** | Gera PDF institucional (recibo, quitação, vínculo, cancelamento, regularização) com histórico e reimpressão |
| **Consultorias** | Private / Black / Retenção, status, link Zoom, relatório por mês, alerta de nova consultoria |
| **Playbooks** | Base de conhecimento com busca, favoritos, cadastro e cópia de scripts prontos |
| **Voice of Customer** | Registro de feedbacks + dashboard (top reclamações, por área, críticos, sugestões) |
| **Painel Admin** | Usuários, perfis, senhas, webhook Slack, backup do banco e **logs de auditoria** |
| **Relatórios** | 7 relatórios exportáveis em Excel/CSV com visão gráfica |

## 🔐 Perfis de acesso

`Admin` (tudo) · `CX` (operação completa) · `Financeiro` (cobrança, cancelamentos, recibos) ·
`Coordenação` (tarefas, retenção, consultorias, VoC). O menu lateral se adapta ao perfil.

## 🚀 Como rodar

Requer **Python 3.9+**.

```bash
cd cxdash
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

O navegador abre em `http://localhost:8501`. O banco (`data/cxdash.db`) e os
**dados de exemplo** são criados automaticamente no primeiro acesso.

### Usuários de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | admin@betteredu.com.br | `admin123` |
| CX | ana.cx@betteredu.com.br | `cx123` |
| Financeiro | bruno.fin@betteredu.com.br | `fin123` |
| Coordenação | carla.coord@betteredu.com.br | `coord123` |

> ⚠️ Troque as senhas no **Painel Admin** antes de usar em produção.

## 🔔 Slack

No **Painel Admin → Slack**, cole a URL do *Incoming Webhook* do canal de CX e clique em
**Enviar teste**. Alertas automáticos disparam em: tarefa crítica, cancelamento > 20 dias,
churn alto, cobrança > 60 dias, reembolso pendente, nova consultoria e feedback crítico.
Sem webhook configurado, o app funciona normalmente (os alertas apenas não são enviados).

## 🗂️ Estrutura

```
cxdash/
├── app.py                 # entrada: login, sidebar, roteamento por perfil
├── requirements.txt
├── core/
│   ├── db.py              # SQLite: conexão, schema, helpers, config, logs
│   ├── auth.py            # hash de senha (PBKDF2), login, ACL por perfil
│   ├── slack.py           # envio via webhook (tolerante a falha)
│   ├── pdf.py             # PDF institucional (ReportLab) + valor por extenso
│   ├── exporter.py        # Excel/CSV (com anti-injeção de fórmula)
│   ├── ui.py              # CSS, cards, badges, datas, botões de export
│   └── seed.py            # dados de exemplo
├── modules/               # um arquivo por módulo funcional
└── data/cxdash.db         # gerado automaticamente
```

## 🔒 Segurança

- Senhas com **PBKDF2-HMAC-SHA256** (salt por usuário) — nunca em texto puro.
- **Logs de auditoria** de todas as ações (login, criação/edição, backup, Slack).
- Exportações CSV/Excel **neutralizam injeção de fórmula** (`= + - @`).
- Controle de acesso por perfil no menu e na renderização de cada página.

## 💾 Backup

**Painel Admin → Backup**: baixe o `.db` ou salve uma cópia local em `backups/`.

---

Alumni by Better · Better Education LTDA — ferramenta interna de CX.
