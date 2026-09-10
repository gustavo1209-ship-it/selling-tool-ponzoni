-- ============================================================
-- Funil de vendas: o que existe antes da proposta.
--
-- A ferramenta começava na proposta — quando o cliente já tinha escolhido
-- lote e condição. O que vinha antes (o lead que ligou, a visita marcada, o
-- "ele ficou de responder na segunda") vivia no WhatsApp de cada corretor.
--
-- `negociacoes` é esse pedaço: um cartão por oportunidade, andando pelas
-- colunas de `funil_etapas`. Um cliente pode ter duas negociações abertas
-- (dois lotes, dois momentos) — por isso não é uma coluna em `clientes`.
--
-- O cartão nasce solto (só um nome e um telefone) e vai ganhando vínculo:
-- cliente cadastrado, empreendimento, lote de interesse, proposta montada,
-- contrato assinado. Nenhum desses vínculos é obrigatório, porque o funil
-- tem de aceitar o lead frio — se exigisse cliente cadastrado, ninguém
-- registraria a ligação de quinta-feira.
-- ============================================================

-- --------------------------------------------------------- as colunas
-- Editáveis pelo admin: nome, cor e ordem. `desfecho` é o que a etapa
-- significa para o negócio — é dele que sai a taxa de conversão, e é ele
-- que faz o cartão carimbar `fechada_em` ao chegar na coluna.
create table funil_etapas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  cor        text not null default '#7C2A28',
  ordem      integer not null default 0,
  desfecho   text not null default 'aberta'
             check (desfecho in ('aberta', 'ganha', 'perdida')),
  ativa      boolean not null default true,
  criado_em  timestamptz not null default now()
);

comment on column funil_etapas.desfecho is
  'aberta = negociação em andamento. ganha/perdida = coluna terminal, carimba fechada_em no cartão.';

-- ------------------------------------------------------- os cartões
create sequence negociacoes_codigo_seq;

create table negociacoes (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique
                     default 'N-' || to_char(now(), 'YYYY') || '-' ||
                             lpad(nextval('negociacoes_codigo_seq')::text, 4, '0'),
  etapa_id           uuid not null references funil_etapas on delete restrict,

  -- quem é. `titulo` é o nome do prospecto enquanto ele não vira cadastro;
  -- assim que vira, `cliente_id` manda e o título fica de apelido.
  cliente_id         uuid references clientes on delete set null,
  titulo             text,
  telefone           text,

  -- o que se está vendendo, à medida que a conversa fecha o foco
  empreendimento_id  uuid references empreendimentos on delete set null,
  lote_id            uuid references lotes on delete set null,
  proposta_id        uuid references propostas on delete set null,
  contrato_id        uuid references contratos on delete set null,

  valor_estimado     numeric(14,2),
  origem             text,
  proximo_contato    date,
  observacao         text,

  -- posição dentro da coluna. numeric para reordenar sem reescrever a
  -- lista inteira: entre 1 e 2 sempre cabe 1,5
  ordem              numeric(20,6) not null default 0,
  fechada_em         timestamptz,

  criado_por         uuid references auth.users on delete set null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),

  constraint negociacoes_tem_nome
    check (cliente_id is not null or nullif(btrim(coalesce(titulo, '')), '') is not null)
);

create index negociacoes_coluna_idx on negociacoes (etapa_id, ordem);
create index negociacoes_autor_idx  on negociacoes (criado_por);

create trigger negociacoes_touch
  before update on negociacoes
  for each row execute function public.touch_atualizado_em();

-- ------------------------------------------------------------- RLS
-- Mesma regra do resto da carteira (migration 26): vê quem criou, e admin
-- vê tudo. As etapas são da casa — todo mundo lê, só admin mexe.
alter table funil_etapas enable row level security;
alter table negociacoes  enable row level security;

create policy "funil_etapas: leitura" on funil_etapas
  for select to authenticated using (true);
create policy "funil_etapas: admin escreve" on funil_etapas
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "negociacoes: autor ou admin lê" on negociacoes
  for select to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()));
create policy "negociacoes: cria como autor" on negociacoes
  for insert to authenticated
  with check (criado_por = (select auth.uid()) or (select public.is_admin()));
create policy "negociacoes: autor ou admin edita" on negociacoes
  for update to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()))
  with check (criado_por = (select auth.uid()) or (select public.is_admin()));
create policy "negociacoes: autor ou admin apaga" on negociacoes
  for delete to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()));

-- ------------------------------------------------------- funil padrão
-- Nasce preenchido porque um kanban vazio não se explica. O admin renomeia,
-- reordena e acrescenta na tela de administração.
insert into funil_etapas (nome, cor, ordem, desfecho) values
  ('Novo lead',       '#6B6662', 10, 'aberta'),
  ('Contato feito',   '#2F6F8F', 20, 'aberta'),
  ('Visita agendada', '#7A5EA8', 30, 'aberta'),
  ('Proposta enviada','#C98A12', 40, 'aberta'),
  ('Em negociação',   '#B4671B', 50, 'aberta'),
  ('Fechado',         '#2E7D4F', 60, 'ganha'),
  ('Perdido',         '#96262C', 70, 'perdida');
