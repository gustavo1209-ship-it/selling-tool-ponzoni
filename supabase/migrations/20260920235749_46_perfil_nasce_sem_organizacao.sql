-- ============================================================
-- Bug da migration 42: o loop que travou organizacao_id como NOT NULL em
-- toda tabela raiz não podia incluir `perfis`. Todas as outras só recebem
-- insert depois que o usuário já tem organização (o app grava o valor);
-- `perfis` é a única que nasce ANTES — handle_new_user() insere a linha no
-- signup sem organizacao_id de propósito (fica null até /onboarding ou
-- /convite/<token>). Com NOT NULL, o trigger falhava em todo cadastro
-- novo e o Supabase devolvia "Database error saving new user" — sem
-- detalhe nenhum pro usuário.
-- ============================================================

alter table perfis alter column organizacao_id drop not null;
