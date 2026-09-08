-- ============================================================
-- A mesma convenção de primeira parcela que a proposta já tinha.
--
-- `propostas.correcao_primeira_parcela` (migration 05) escolhe entre as duas
-- famílias de planilha da casa: fator (1+i)^(m−1), com a 1ª parcela SEM
-- correção, ou (1+i)^m, com ela já corrigida. O contrato precisa da mesma
-- escolha, senão um contrato gerado de uma proposta cobra um mês de INCC a
-- mais do que foi vendido — uma diferença silenciosa, que só apareceria no
-- boleto e contra o papel que o cliente assinou.
--
-- O default é `true` porque é o que um contrato de loteamento diz: a parcela
-- que vence 30 dias depois da data-base já sofreu um mês de variação. Quem
-- gera o contrato a partir de uma proposta herda o que a proposta usou.
-- ============================================================

alter table contratos
  add column corrige_primeira_parcela boolean not null default true;

comment on column contratos.corrige_primeira_parcela is
  'false = a 1ª parcela sai sem correção (convenção das planilhas "Propostas de Parcelamento"). true = já corrigida, que é o texto do contrato.';
