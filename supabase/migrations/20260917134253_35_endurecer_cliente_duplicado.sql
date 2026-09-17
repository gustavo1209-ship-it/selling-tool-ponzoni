-- ============================================================
-- `cliente_duplicado` (migration 34) nasceu com EXECUTE concedido
-- diretamente a `anon` — não via PUBLIC, então o `revoke ... from public`
-- da 34 não bastou. Diferente das funções endurecidas na 27
-- (`pode_ver_*`, que só recebem um id que o chamador já tem), esta recebe
-- nome/CPF/telefone livres: um anônimo poderia varrer CPFs para descobrir
-- se já são clientes cadastrados. Revoga de `anon` de propósito.
-- ============================================================

revoke execute on function public.cliente_duplicado(text, text, text) from anon;
