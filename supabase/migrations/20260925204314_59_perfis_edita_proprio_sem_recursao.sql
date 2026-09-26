-- ============================================================
-- Corrige "infinite recursion detected in policy for relation perfis".
--
-- A migration 43 escreveu o with check de "perfis: edita o próprio (campos
-- seguros)" com três subselects direto em `public.perfis` (papel,
-- organizacao_id, empreendimentos_restritos). Uma subquery na MESMA tabela
-- dentro de using/with check é o gatilho clássico dessa mensagem: o
-- Postgres detecta que a RLS de perfis já está em avaliação para a
-- linha e recusa entrar de novo, mesmo a subquery sendo inofensiva. Todo
-- o resto do schema evita isso passando por função security definer
-- (is_admin(), minha_organizacao()) — esta policy era a exceção.
-- ============================================================

create or replace function public.meu_perfil_atual()
returns table(papel text, organizacao_id uuid, empreendimentos_restritos boolean)
language sql
stable
security definer
set search_path = public
as $$
  select papel, organizacao_id, empreendimentos_restritos
  from public.perfis
  where id = auth.uid();
$$;

revoke execute on function public.meu_perfil_atual() from public;
revoke execute on function public.meu_perfil_atual() from anon;
grant execute on function public.meu_perfil_atual() to authenticated;

drop policy "perfis: edita o próprio (campos seguros)" on perfis;
create policy "perfis: edita o próprio (campos seguros)" on perfis
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and papel is not distinct from (select mp.papel from public.meu_perfil_atual() mp)
    and organizacao_id is not distinct from (select mp.organizacao_id from public.meu_perfil_atual() mp)
    and empreendimentos_restritos is not distinct from (select mp.empreendimentos_restritos from public.meu_perfil_atual() mp)
  );
