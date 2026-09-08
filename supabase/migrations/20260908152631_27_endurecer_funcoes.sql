-- ============================================================
-- Endurecimento das funções, agora que a base abre para corretores.
-- Vem dos avisos do linter do Supabase (get_advisors → security).
--
-- Duas coisas, e uma que de propósito NÃO se faz:
--
-- 1. `touch_atualizado_em` era a única função sem `search_path` fixo. Numa
--    função de trigger isso é um vetor conhecido: quem consegue criar um
--    schema no caminho de busca passa a decidir qual `now()` roda.
--
-- 2. Nenhuma dessas funções precisa ser chamável pela API REST. `anon` não
--    tem por que executar nada disso, e `handle_new_user` é gatilho de
--    signup — não é para ser invocada por ninguém.
--
-- 3. **`authenticated` continua com EXECUTE nas funções `is_admin` e
--    `pode_ver_*`.** O linter aponta as duas, mas as policies as chamam no
--    contexto do próprio usuário: revogar aí derrubaria toda a RLS com
--    "permission denied for function", e a base ficaria inacessível. O que
--    elas devolvem é sobre quem pergunta — se ele é admin, se pode ver um
--    id que já é dele —, então não há o que vazar.
-- ============================================================

create or replace function public.touch_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.pode_ver_proposta(uuid) from anon;
revoke execute on function public.pode_ver_cenario(uuid) from anon;
revoke execute on function public.pode_ver_contrato(uuid) from anon;
revoke execute on function public.pode_editar_proposta(uuid) from anon;
revoke execute on function public.pode_editar_cenario(uuid) from anon;
