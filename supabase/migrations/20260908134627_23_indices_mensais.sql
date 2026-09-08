-- ============================================================
-- Série histórica mensal dos indexadores.
--
-- `indexadores` guarda a taxa de REFERÊNCIA — um número só, derivado do
-- acumulado em 12 meses, que serve para PROJETAR uma proposta. Não serve
-- para cobrar: o boleto de uma parcela indexada precisa do índice que a FGV
-- publicou em cada mês entre a data-base do contrato e o vencimento.
--
-- É essa série que esta tabela guarda. Uma linha por índice por mês.
-- `variacao` é a variação do mês em fração (0.0085 = 0,85%), do jeito que
-- a fonte publica; a correção acumulada é o produto dos (1 + variacao).
--
-- A competência é sempre o dia 1 do mês — mês é um ponto, não um intervalo,
-- e o check impede lançar "agosto" com duas datas diferentes.
-- ============================================================

create table indices_mensais (
  id           uuid primary key default gen_random_uuid(),
  indexador    indexador not null references indexadores (codigo) on delete cascade,
  competencia  date not null check (extract(day from competencia) = 1),
  -- variação do mês em fração: 0.0085 = 0,85%. Pode ser negativa.
  variacao     numeric(9,6) not null,
  fonte        text,
  observacao   text,
  criado_por   uuid references auth.users on delete set null,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (indexador, competencia)
);

create index indices_mensais_serie_idx
  on indices_mensais (indexador, competencia desc);

comment on table indices_mensais is
  'Série histórica mensal dos índices. É a base da correção real das parcelas de contrato; a taxa em `indexadores` continua sendo só projeção.';
comment on column indices_mensais.variacao is
  'Variação do mês em fração (0.0085 = 0,85%). O acumulado é o produto dos (1 + variacao), nunca a soma.';

create trigger touch_indices_mensais before update on indices_mensais
  for each row execute function public.touch_atualizado_em();

alter table indices_mensais enable row level security;

-- Lançar índice é rotina de quem fecha o mês, não de administração de
-- sistema — mesma regra de `lotes` e `clientes`: o time escreve, e só o
-- autor ou um admin apaga.
create policy "indices_mensais: leitura" on indices_mensais
  for select to authenticated using (true);
create policy "indices_mensais: time lanca" on indices_mensais
  for insert to authenticated with check (true);
create policy "indices_mensais: time edita" on indices_mensais
  for update to authenticated using (true) with check (true);
create policy "indices_mensais: autor ou admin apaga" on indices_mensais
  for delete to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()));
