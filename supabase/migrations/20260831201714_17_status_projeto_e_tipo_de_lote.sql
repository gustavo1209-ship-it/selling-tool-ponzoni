-- ============================================================
-- Duas coisas que o Florescer tem e o Industrial não:
--
-- 1. Um quinto status. O espelho do Florescer marca "Projeto" nos lotes
--    com projeto residencial em andamento — não está livre, não está
--    vendido, e a diferença importa para o vendedor.
-- 2. `tipo` do lote (Misto I, Misto II, Residencial), que define o que se
--    pode construir e por isso entra na conversa de venda. No Industrial
--    fica nulo.
-- ============================================================

alter type lote_status add value if not exists 'projeto';

alter table lotes add column tipo text;

comment on column lotes.tipo is
  'Uso permitido no lote: Misto I, Misto II, Residencial. Nulo onde o empreendimento não classifica.';
