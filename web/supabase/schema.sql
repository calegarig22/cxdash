-- ============================================================
--  CX Command Center – Alumni · Schema Supabase (Postgres)
--  Rode este arquivo no Supabase → SQL Editor (uma vez).
--  Depois crie o 1º usuário em Auth → Users e rode:
--    update public.profiles set perfil='Admin' where email='seu@email';
-- ============================================================

-- ---------- perfis (espelham auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  perfil text not null default 'CX',
  ativo boolean not null default true,
  criado_em timestamptz default now()
);

-- cria profile automaticamente quando um usuário é criado no Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email, perfil, ativo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'perfil', 'CX'),
    true
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- tabelas operacionais ----------
create table if not exists public.tarefas (
  id bigint generated always as identity primary key,
  titulo text not null, tipo text, responsavel text, prioridade text,
  status text, prazo date, observacoes text,
  criado_em timestamptz default now(), atualizado_em timestamptz default now()
);
create table if not exists public.tarefa_hist (
  id bigint generated always as identity primary key,
  pai bigint, ts timestamptz default now(), usuario text, texto text
);
create table if not exists public.cancelamentos (
  id bigint generated always as identity primary key,
  aluno text not null, email text, telefone text, data_solicitacao date,
  motivo text, status text, valor_multa numeric default 0, valor_material numeric default 0,
  valor_reembolso numeric default 0, observacoes text, anexos text,
  criado_em timestamptz default now()
);
create table if not exists public.cancel_hist (
  id bigint generated always as identity primary key,
  pai bigint, ts timestamptz default now(), usuario text, texto text
);
create table if not exists public.cobrancas (
  id bigint generated always as identity primary key,
  aluno text not null, valor numeric default 0, vencimento date, status text,
  ultima_mensagem text, proxima_acao text, responsavel text, observacoes text,
  criado_em timestamptz default now()
);
create table if not exists public.retencao (
  id bigint generated always as identity primary key,
  aluno text not null, motivo text, nivel text, acao_sugerida text, status text,
  resultado text, observacoes text, score int default 0,
  criado_em timestamptz default now()
);
create table if not exists public.documentos (
  id bigint generated always as identity primary key,
  tipo text, aluno text, cpf text, curso text, valor numeric default 0,
  forma_pagamento text, parcelas int default 1, data date, referencia text,
  gerado_por text, criado_em timestamptz default now()
);
create table if not exists public.consultorias (
  id bigint generated always as identity primary key,
  aluno text not null, tipo text, solicitante text, data_solicitada date,
  data_agendada date, responsavel text, status text, link_zoom text, observacoes text,
  criado_em timestamptz default now()
);
create table if not exists public.playbooks (
  id bigint generated always as identity primary key,
  categoria text, titulo text, conteudo text, favorito int default 0,
  criado_em timestamptz default now()
);
create table if not exists public.voc (
  id bigint generated always as identity primary key,
  aluno text, categoria text, tipo text, gravidade text, descricao text,
  area text, status text, acao text, criado_em timestamptz default now()
);
create table if not exists public.logs (
  id bigint generated always as identity primary key,
  ts timestamptz default now(), usuario text, acao text, detalhe text
);
create table if not exists public.config (
  chave text primary key, valor text
);
insert into public.config (chave, valor) values ('slack_webhook','')
  on conflict (chave) do nothing;

-- ---------- RLS: ferramenta interna → qualquer usuário autenticado ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','tarefas','tarefa_hist','cancelamentos','cancel_hist',
    'cobrancas','retencao','documentos','consultorias','playbooks','voc','logs','config']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists p_all on public.%I;', t);
    execute format(
      'create policy p_all on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ---------- realtime ----------
do $$
declare t text;
begin
  foreach t in array array['tarefas','tarefa_hist','cancelamentos','cancel_hist','cobrancas',
    'retencao','documentos','consultorias','playbooks','voc','logs','config']
  loop
    begin execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- ---------- dados de exemplo (idempotente) ----------
insert into public.tarefas (titulo,tipo,responsavel,prioridade,status,prazo)
select * from (values
  ('Retornar contato do aluno João sobre boleto','Cobrança','Ana CX','Alta','Em andamento',current_date-1),
  ('Analisar pedido de cancelamento – Maria','Cancelamento','Bruno Financeiro','Crítica','Aguardando outra área',current_date-3),
  ('Ligar para aluno em risco de churn – Pedro','Retenção','Carla Coordenação','Alta','Aberta',current_date+2),
  ('Responder Reclame Aqui #4521','Reclame Aqui','Ana CX','Crítica','Aberta',current_date)
) v where not exists (select 1 from public.tarefas);

insert into public.cobrancas (aluno,valor,vencimento,status,responsavel)
select * from (values
  ('João Pereira',450,current_date-8,'2º contato','Ana CX'),
  ('Fernanda Dias',1200,current_date-65,'Pré-negativação','Bruno Financeiro'),
  ('Carlos Nunes',300,current_date-15,'3º contato','Ana CX'),
  ('Beatriz Rocha',890,current_date-3,'1º contato','Bruno Financeiro')
) v where not exists (select 1 from public.cobrancas);

insert into public.retencao (aluno,motivo,nivel,acao_sugerida,status,resultado,score)
select * from (values
  ('Pedro Gomes','financeiro','alto','Plano de retomada leve','Em acompanhamento','Em acompanhamento',85),
  ('Sofia Ramos','metodologia','médio','Reavaliação acadêmica','Em acompanhamento','Em acompanhamento',52),
  ('Thiago Melo','baixo uso','alto','Aulas particulares','Em acompanhamento','Em acompanhamento',83)
) v where not exists (select 1 from public.retencao);

insert into public.cancelamentos (aluno,email,telefone,data_solicitacao,motivo,status,valor_multa,valor_material,valor_reembolso)
select * from (values
  ('Maria Souza','maria@email.com','(11) 99999-1111',current_date-22,'Mudança financeira','Aguardando financeiro',300,150,800),
  ('Julia Alves','julia@email.com','(11) 97777-3333',current_date-28,'Falta de tempo','Aguardando diretoria',200,100,500)
) v where not exists (select 1 from public.cancelamentos);
