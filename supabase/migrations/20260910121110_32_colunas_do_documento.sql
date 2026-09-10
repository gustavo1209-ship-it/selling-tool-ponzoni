-- ============================================================
-- Quais colunas saem no documento do contrato.
--
-- O demonstrativo mostrava sempre as mesmas colunas, e a de "valor de
-- origem" é a que mais atrapalha: o cliente vê dois números para a mesma
-- parcela e liga perguntando qual vale. Quem entrega o papel quer poder
-- mandar só o corrigido.
--
-- `null` = todas, que é o comportamento de sempre — nenhum contrato
-- existente muda de aparência. A lista vale para o demonstrativo (PDF) e
-- para o XLSX: o catálogo de colunas é um só, e cada saída ignora as chaves
-- que não sabe desenhar (`encargos`, por exemplo, só existe na planilha).
-- ============================================================

alter table contratos add column colunas_documento text[];

comment on column contratos.colunas_documento is
  'Chaves das colunas do cronograma que saem no demonstrativo e no XLSX. null = todas. Catálogo em src/lib/contratos/colunas.ts.';
