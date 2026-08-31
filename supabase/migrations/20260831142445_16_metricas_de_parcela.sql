-- ============================================================
-- Qual parcela a proposta mostra.
--
-- "Maior parcela" era a única, e é a métrica errada para abrir a conversa:
-- com reforço periódico ela é o mês em que a mensal e o reforço caem juntos,
-- um número que assusta e que não é o que o cliente vai pagar na maioria
-- dos meses. A inicial é a que o vendedor fala primeiro.
--
-- Continua sendo possível somar média e final (que importam em parcela
-- corrigida, onde a última é bem maior que a primeira) e a maior, que é a
-- que o cliente precisa conseguir pagar no pior mês.
-- ============================================================

alter table propostas
  add column metricas_parcela text[] not null default '{inicial}'::text[];

alter table propostas
  add constraint metricas_parcela_validas check (
    metricas_parcela <@ array['inicial','media','final','maior']::text[]
    and array_length(metricas_parcela, 1) >= 1
  );

comment on column propostas.metricas_parcela is
  'Quais parcelas aparecem no comparativo e na folha: inicial, media, final, maior.';
