-- ============================================================
-- Selling Tool — schema base (multi-empreendimento)
-- ============================================================

create type lote_status     as enum ('livre','reservado','vendido','indisponivel');
create type proposta_status as enum ('rascunho','enviada','em_negociacao','aceita','recusada','expirada');
create type bloco_tipo      as enum ('entrada','sinal','parcelas','balao','financiamento');
create type amortizacao     as enum ('nenhuma','sac','price','americano');
create type indexador       as enum ('nenhum','incc','igpm','ipca','cdi','selic');

-- ------------------------------------------------------------ perfis
create table perfis (
  id         uuid primary key references auth.users on delete cascade,
  nome       text not null,
  email      text not null,
  papel      text not null default 'vendedor' check (papel in ('vendedor','admin')),
  criado_em  timestamptz not null default now()
);

-- cria o perfil automaticamente no signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'admin');
$$;

-- ------------------------------------------------- empreendimentos
create table empreendimentos (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  nome             text not null,
  subtitulo        text,
  cidade           text,
  uf               char(2),
  -- CSV publicado do Google Sheets usado para sincronizar o espelho
  espelho_csv_url  text,
  cor_primaria     text not null default '#7C2A28',
  cor_secundaria   text not null default '#E0A221',
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

-- ------------------------------------------------------------ lotes
create table lotes (
  id                 uuid primary key default gen_random_uuid(),
  empreendimento_id  uuid not null references empreendimentos on delete cascade,
  quadra             text not null,
  numero             text not null,
  area_m2            numeric(12,2) not null check (area_m2 > 0),
  -- preço da condição de referência da tabela vigente (ex.: 40% + 36x INCC)
  preco_tabela       numeric(14,2),
  status             lote_status not null default 'livre',
  comprador          text,
  observacao         text,
  atualizado_em      timestamptz not null default now(),
  unique (empreendimento_id, quadra, numero)
);

create index lotes_empreendimento_idx on lotes (empreendimento_id, quadra, numero);

-- -------------------------------------------------- tabelas de preço
create table tabelas_preco (
  id                 uuid primary key default gen_random_uuid(),
  empreendimento_id  uuid not null references empreendimentos on delete cascade,
  referencia         text not null,                       -- 'R n.º5 2026/07'
  condicao_base      text not null default '40% Entrada + 36x INCC',
  vigente_desde      date not null default current_date,
  -- premissas padrão herdadas pelas propostas criadas a partir dela
  incc_mensal        numeric(8,6) not null default 0.005,
  juros_vp_mensal    numeric(8,6) not null default 0.01,
  ativa              boolean not null default true,
  criado_em          timestamptz not null default now(),
  unique (empreendimento_id, referencia)
);

-- ---------------------------------------------- condições de pagamento
-- Cada linha é uma coluna do espelho: 'À vista -9%', '40% + 12x INCC -6,5%'…
-- `template` guarda os blocos que serão copiados para a proposta.
create table condicoes_pagamento (
  id                uuid primary key default gen_random_uuid(),
  tabela_preco_id   uuid not null references tabelas_preco on delete cascade,
  nome              text not null,
  descricao         text,
  desconto_pct      numeric(7,4) not null default 0,      -- 0.09 = 9% off sobre o preço base
  ordem             integer not null default 0,
  template          jsonb not null default '[]'::jsonb,
  ativa             boolean default true
);

create index condicoes_tabela_idx on condicoes_pagamento (tabela_preco_id, ordem);

-- --------------------------------------------------------- clientes
create table clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  documento   text,
  email       text,
  telefone    text,
  empresa     text,
  observacao  text,
  criado_por  uuid references auth.users on delete set null,
  criado_em   timestamptz not null default now()
);

-- -------------------------------------------------------- propostas
create sequence propostas_codigo_seq;

create table propostas (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique
                     default 'P-' || to_char(now(), 'YYYY') || '-' ||
                             lpad(nextval('propostas_codigo_seq')::text, 4, '0'),
  empreendimento_id  uuid not null references empreendimentos on delete restrict,
  cliente_id         uuid references clientes on delete set null,
  tabela_preco_id    uuid references tabelas_preco on delete set null,
  condicao_origem    text,                                 -- condição usada como ponto de partida
  titulo             text,
  status             proposta_status not null default 'rascunho',
  data_base          date not null default current_date,
  validade_dias      integer not null default 7,
  -- premissas de cálculo desta proposta
  incc_mensal        numeric(8,6) not null default 0.005,
  juros_vp_mensal    numeric(8,6) not null default 0.01,
  -- desconto comercial aplicado sobre a soma dos lotes
  desconto_pct       numeric(7,4) not null default 0,
  desconto_valor     numeric(14,2) not null default 0,
  desconto_motivo    text,
  observacoes        text,
  -- snapshot do cálculo no momento da última gravação (auditoria)
  resultado          jsonb,
  criado_por         uuid references auth.users on delete set null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

create index propostas_empreendimento_idx on propostas (empreendimento_id, criado_em desc);
create index propostas_criado_por_idx on propostas (criado_por);

-- --------------------------------------------- lotes de uma proposta
-- Guarda snapshot de área/preço: o espelho muda, a proposta não.
create table proposta_lotes (
  id              uuid primary key default gen_random_uuid(),
  proposta_id     uuid not null references propostas on delete cascade,
  lote_id         uuid references lotes on delete set null,
  quadra          text not null,
  numero          text not null,
  area_m2         numeric(12,2) not null,
  preco_tabela    numeric(14,2) not null default 0,
  valor_negociado numeric(14,2) not null default 0,
  ordem           integer not null default 0,
  unique (proposta_id, lote_id)
);

-- -------------------------------------------- blocos de pagamento
-- O coração da customização: cada bloco é um trecho do fluxo
-- (entrada, 2x de X, 36x corrigidas pelo INCC, 120x SAC no Sicredi…).
create table proposta_blocos (
  id                     uuid primary key default gen_random_uuid(),
  proposta_id            uuid not null references propostas on delete cascade,
  ordem                  integer not null default 0,
  rotulo                 text not null,
  tipo                   bloco_tipo not null default 'parcelas',
  -- a base do bloco é um percentual do valor negociado OU um valor absoluto
  base_percentual        numeric(7,4),
  base_valor             numeric(14,2),
  qtd_parcelas           integer not null default 1 check (qtd_parcelas between 1 and 480),
  mes_inicio             integer not null default 1 check (mes_inicio >= 0),
  indexador              indexador not null default 'nenhum',
  taxa_indexador_mensal  numeric(8,6) not null default 0,
  juros_mensal           numeric(8,6) not null default 0,
  amortizacao            amortizacao not null default 'nenhuma',
  -- trava o valor da parcela; a base do bloco passa a ser derivada dela
  parcela_fixa           numeric(14,2),
  observacao             text,
  constraint base_definida check (base_percentual is not null or base_valor is not null or parcela_fixa is not null)
);

create index blocos_proposta_idx on proposta_blocos (proposta_id, ordem);

-- ---------------------------------------------------- atualizado_em
create or replace function public.touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger touch_empreendimentos before update on empreendimentos
  for each row execute function public.touch_atualizado_em();
create trigger touch_propostas before update on propostas
  for each row execute function public.touch_atualizado_em();
