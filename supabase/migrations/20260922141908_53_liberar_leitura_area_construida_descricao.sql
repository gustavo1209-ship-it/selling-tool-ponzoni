-- ============================================================
-- Bug real: area_construida_m2 e descricao (migration 48) nasceram sem
-- SELECT pra authenticated. A migration 28 trocou o grant amplo de `lotes`
-- por uma lista explícita de colunas (pra esconder `comprador`) — desde
-- então, toda coluna nova em `lotes` precisa de grant de leitura na mão;
-- não herda automaticamente. Sem o SELECT, a consulta das páginas de
-- impressão (propostas/[id]/imprimir e contratos/[id]/demonstrativo)
-- estourava "permission denied for table lotes" — engolido em silêncio
-- porque o código só olhava `data`, nunca `error`, então a tela simplesmente
-- não mostrava nada em vez de dar erro visível.
-- ============================================================

grant select (area_construida_m2, descricao) on lotes to authenticated;
