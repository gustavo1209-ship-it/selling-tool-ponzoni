-- ============================================================
-- Fecha o buraco que aconteceu na prática: um corretor com conta já criada
-- (hoje, manualmente, enquanto o SMTP não está de pé) que loga direto em
-- vez de abrir o link de convite cai em /onboarding e, sem saber que devia
-- usar o convite, cria uma organização própria por engano.
--
-- meu_convite_pendente() deixa a página de onboarding perguntar "essa
-- pessoa tem um convite esperando?" antes de oferecer "criar organização
-- nova". Casa com info_convite/aceitar_convite da migration 43.
-- ============================================================

create or replace function public.meu_convite_pendente()
returns text
language sql
stable security definer
set search_path = public
as $$
  select token from public.convites
  where email = lower((select auth.email()))
    and usado_em is null
    and expira_em > now()
  order by criado_em desc
  limit 1;
$$;

revoke execute on function public.meu_convite_pendente() from public;
grant execute on function public.meu_convite_pendente() to authenticated;
