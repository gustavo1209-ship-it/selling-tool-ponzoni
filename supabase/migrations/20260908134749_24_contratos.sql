-- ============================================================
-- Contratos: o que já foi vendido.
--
-- A proposta é uma projeção — o motor de cálculo monta o fluxo a partir de
-- blocos e de uma taxa estimada. O contrato é o contrário: o cronograma já
-- está fechado, cada parcela tem data e valor de origem, e a correção que
-- vale é a que os índices publicados mandarem (`indices_mensais`).
--
-- Por isso as parcelas são LINHAS, não blocos. Um cronograma de contrato é
-- editado parcela a parcela (o cliente antecipa, renegocia um vencimento,
-- paga um valor diferente), e nada disso cabe num template.
--
-- `valor_corrigido` NÃO é coluna. Ele é derivado da série de índices em
-- `src/lib/contratos/correcao.ts` e muda toda vez que um índice novo é
-- lançado. Gravar seria congelar um número que ainda vai mudar. O que se
-- grava é o que aconteceu de fato: `valor_pago` e `pago_em`.
-- ============================================================

create type contrato_status as enum ('ativo','quitado','distratado','suspenso');

create sequence contratos_codigo_seq;

create table contratos (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique
                     default 'C-' || to_char(now(), 'YYYY') || '-' ||
                             lpad(nextval('contratos_codigo_seq')::text, 4, '0'),
  empreendimento_id  uuid not null references empreendimentos on delete restrict,
  cliente_id         uuid references clientes on delete set null,
  -- de onde veio, quando veio: contrato gerado a partir de proposta aceita
  proposta_id        uuid references propostas on delete set null,
  cenario_origem     text,
  titulo             text,
  status             contrato_status not null default 'ativo',
  -- assinatura do contrato; só informativa
  data_contrato      date not null default current_date,
  -- marco zero da correção: o índice acumulado conta a partir dela
  data_base          date not null default current_date,
  valor_total        numeric(14,2) not null default 0,
  indexador          indexador not null default 'incc',
  -- O INCC-M de um mês só é publicado no fim dele. Cobrar a parcela de
  -- outubro exigindo o índice de outubro é impossível na prática: o boleto
  -- sai antes. A defasagem diz quantos meses o contrato anda para trás ao
  -- buscar o índice — 1 é o usual, 2 aparece em contrato mais conservador.
  defasagem_indice_meses integer not null default 1
    check (defasagem_indice_meses between 0 and 6),
  dia_vencimento     integer not null default 10
    check (dia_vencimento between 1 and 31),
  -- encargos de atraso; entram só no que já venceu e não foi pago
  juros_mora_mensal  numeric(8,6) not null default 0.01,
  multa_atraso_pct   numeric(8,6) not null default 0.02,
  observacoes        text,
  criado_por         uuid references auth.users on delete set null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

create index contratos_empreendimento_idx
  on contratos (empreendimento_id, criado_em desc);
create index contratos_cliente_idx on contratos (cliente_id);

comment on column contratos.data_base is
  'Marco zero da correção monetária. A parcela que vence em M é corrigida pelo acumulado das competências entre data_base e M − defasagem.';
comment on column contratos.defasagem_indice_meses is
  'Meses que o contrato anda para trás ao buscar o índice, porque o boleto sai antes de a FGV publicar o mês corrente. 1 é o usual.';

-- ------------------------------------------------- lotes do contrato
-- Mesma ideia de `proposta_lotes`: guarda snapshot de área e valor, porque
-- o espelho muda e o contrato assinado não.
create table contrato_lotes (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid not null references contratos on delete cascade,
  lote_id      uuid references lotes on delete set null,
  quadra       text not null,
  numero       text not null,
  area_m2      numeric(12,2) not null default 0,
  valor        numeric(14,2) not null default 0,
  ordem        integer not null default 0,
  unique (contrato_id, lote_id)
);

create index contrato_lotes_contrato_idx on contrato_lotes (contrato_id, ordem);

-- --------------------------------------------- parcelas do contrato
create table contrato_parcelas (
  id             uuid primary key default gen_random_uuid(),
  contrato_id    uuid not null references contratos on delete cascade,
  -- ordem no cronograma inteiro, para a numeração do carnê
  numero         integer not null,
  -- "Entrada", "Parcelas", "Reforço semestral" — o grupo a que pertence
  rotulo         text not null default 'Parcelas',
  tipo           bloco_tipo not null default 'parcelas',
  -- posição dentro do grupo, para exibir "12 de 36"
  indice         integer not null default 1,
  total_no_grupo integer not null default 1,
  vencimento     date not null,
  -- valor nominal na data-base; a correção se aplica sobre ele
  valor_original numeric(14,2) not null default 0,
  -- entrada e sinal costumam ser à vista e não corrigem
  indexada       boolean not null default true,
  -- baixa
  pago_em        date,
  valor_pago     numeric(14,2),
  forma_pagamento text,
  -- identificador do boleto no banco, anotado por quem emitiu
  boleto_numero  text,
  observacao     text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (contrato_id, numero)
);

create index contrato_parcelas_contrato_idx on contrato_parcelas (contrato_id, numero);
-- a consulta que mais roda: "o que vence neste mês, em todos os contratos"
create index contrato_parcelas_vencimento_idx on contrato_parcelas (vencimento)
  where pago_em is null;

comment on column contrato_parcelas.valor_original is
  'Valor nominal na data-base do contrato. O valor do boleto é este corrigido pelo índice acumulado — ver src/lib/contratos/correcao.ts.';
comment on column contrato_parcelas.indexada is
  'false em entrada e sinal, que se pagam no ato e não sofrem correção.';

create trigger touch_contratos before update on contratos
  for each row execute function public.touch_atualizado_em();
create trigger touch_contrato_parcelas before update on contrato_parcelas
  for each row execute function public.touch_atualizado_em();

-- ------------------------------------------------------------- RLS
alter table contratos         enable row level security;
alter table contrato_lotes    enable row level security;
alter table contrato_parcelas enable row level security;

-- Contrato é dado do escritório, não do vendedor: quem dá baixa num
-- pagamento raramente é quem fechou a venda. Mesma regra de `clientes` —
-- o time lê e escreve, e só o autor ou um admin apaga.
create policy "contratos: leitura do time" on contratos
  for select to authenticated using (true);
create policy "contratos: time cria" on contratos
  for insert to authenticated with check (true);
create policy "contratos: time edita" on contratos
  for update to authenticated using (true) with check (true);
create policy "contratos: autor ou admin apaga" on contratos
  for delete to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()));

create policy "contrato_lotes: leitura do time" on contrato_lotes
  for select to authenticated using (true);
create policy "contrato_lotes: time escreve" on contrato_lotes
  for all to authenticated using (true) with check (true);

create policy "contrato_parcelas: leitura do time" on contrato_parcelas
  for select to authenticated using (true);
create policy "contrato_parcelas: time escreve" on contrato_parcelas
  for all to authenticated using (true) with check (true);
