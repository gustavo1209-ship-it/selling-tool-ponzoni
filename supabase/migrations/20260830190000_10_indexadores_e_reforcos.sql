-- ============================================================
-- Três coisas que faltavam para montar condição customizada:
--
-- 1. Mais indexadores do mercado imobiliário brasileiro.
-- 2. Uma tabela de referência para eles, com a taxa, a fonte e a data —
--    a taxa de projeção não pode ser um número mágico no código.
-- 3. `periodicidade_meses` no bloco, para reforços trimestrais,
--    semestrais ou anuais: o mesmo principal em menos parcelas, o que
--    derruba a mensal sem mudar o valor total.
-- ============================================================

alter type indexador add value if not exists 'inpc';
alter type indexador add value if not exists 'igpdi';
alter type indexador add value if not exists 'cub';
alter type indexador add value if not exists 'tr';

alter table proposta_blocos
  add column periodicidade_meses integer not null default 1
    check (periodicidade_meses between 1 and 60);

comment on column proposta_blocos.periodicidade_meses is
  'Meses entre vencimentos. 1 = mensal, 3 = trimestral, 6 = semestral, 12 = anual.';

create table indexadores (
  codigo                 indexador primary key,
  nome                   text not null,
  descricao              text,
  -- taxa mensal usada como sugestão nas simulações
  taxa_mensal_referencia numeric(8,6),
  -- acumulado em 12 meses de onde a mensal foi derivada
  acumulado_12m          numeric(8,6),
  variacao_mes           numeric(8,6),
  fonte                  text,
  referencia             text,
  ordem                  integer not null default 0,
  atualizado_em          timestamptz not null default now()
);

alter table indexadores enable row level security;

create policy "indexadores: leitura" on indexadores
  for select to authenticated using (true);
create policy "indexadores: admin escreve" on indexadores
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create trigger touch_indexadores before update on indexadores
  for each row execute function public.touch_atualizado_em();
