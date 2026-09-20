-- ============================================================
-- `create or replace function` reinicia os privilégios da função para o
-- padrão do Postgres — EXECUTE liberado para PUBLIC, que é herdado por
-- `anon` mesmo depois de um `revoke ... from anon` isolado (PUBLIC é um
-- pseudo-papel que todo mundo pertence; só revogar dele fecha de verdade).
-- É por isso que a advisor de segurança continuava acusando estas funções
-- como chamáveis por visitante não-logado mesmo já tendo "revoke from
-- anon" na 43/44 — e por isso is_admin()/handle_new_user(), que nem foram
-- tocadas aqui, também apareciam: a migration 27 tinha o mesmo lapso.
-- ============================================================

revoke execute on function public.is_admin() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.minha_organizacao() from public;
revoke execute on function public.pode_ver_empreendimento(uuid) from public;
revoke execute on function public.pode_ver_cliente(uuid) from public;
revoke execute on function public.pode_ver_proposta(uuid) from public;
revoke execute on function public.pode_editar_proposta(uuid) from public;
revoke execute on function public.pode_ver_cenario(uuid) from public;
revoke execute on function public.pode_editar_cenario(uuid) from public;
revoke execute on function public.pode_ver_contrato(uuid) from public;
revoke execute on function public.pode_ver_comissao(uuid) from public;
revoke execute on function public.criar_organizacao(text) from public;
revoke execute on function public.aceitar_convite(text) from public;
revoke execute on function public.info_convite(text) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.minha_organizacao() to authenticated;
grant execute on function public.pode_ver_empreendimento(uuid) to authenticated;
grant execute on function public.pode_ver_cliente(uuid) to authenticated;
grant execute on function public.pode_ver_proposta(uuid) to authenticated;
grant execute on function public.pode_editar_proposta(uuid) to authenticated;
grant execute on function public.pode_ver_cenario(uuid) to authenticated;
grant execute on function public.pode_editar_cenario(uuid) to authenticated;
grant execute on function public.pode_ver_contrato(uuid) to authenticated;
grant execute on function public.pode_ver_comissao(uuid) to authenticated;
grant execute on function public.criar_organizacao(text) to authenticated;
grant execute on function public.aceitar_convite(text) to authenticated;

-- handle_new_user() não precisa de grant nenhum: só é chamada pelo
-- trigger em auth.users, nunca via RPC.

-- info_convite é o único que precisa continuar aberto a anon de propósito
-- (quem abre o link do convite ainda não está logado).
grant execute on function public.info_convite(text) to anon, authenticated;
