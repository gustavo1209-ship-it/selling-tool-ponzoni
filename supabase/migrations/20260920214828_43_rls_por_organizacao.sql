-- ============================================================
-- Corte de RLS por organização: toda regra de acesso que hoje separa só
-- "quem criou vs. admin" ganha mais uma camada por baixo — "dentro da
-- mesma organização". A receita é a mesma das migrations 26/31: reescrever
-- a policy inteira, ou (quando a checagem mora numa função security
-- definer) reescrever a função, para que o filho herde de graça.
--
-- De quebra, corrige um buraco que não tinha nada a ver com tenancy: a
-- policy "perfis: edita o proprio" só checava `id = auth.uid()`, sem travar
-- a coluna `papel` — qualquer corretor logado podia se autopromover a admin
-- com um PATCH direto em /rest/v1/perfis. Fechado abaixo, junto da mesma
-- mexida (o "with check" que passa a travar papel/organizacao_id/
-- empreendimentos_restritos no auto-edit).
-- ============================================================

-- ---------------------------------------------------- bug da migration 42
-- `configuracoes.id` nunca foi coluna serial (nasceu "integer default 1"),
-- então pg_get_serial_sequence() não achava sequência nenhuma e o default
-- ficava um nextval(null) — funcionava para leitura, quebraria no primeiro
-- insert de configuracoes de uma organização nova.
create sequence if not exists configuracoes_id_seq owned by configuracoes.id;
select setval('configuracoes_id_seq', (select coalesce(max(id), 1) from configuracoes));
alter table configuracoes alter column id set default nextval('configuracoes_id_seq');

-- ---------------------------------------------------- o helper novo
create or replace function public.minha_organizacao()
returns uuid
language sql
stable security definer
set search_path = public
as $$
  select organizacao_id from public.perfis where id = auth.uid();
$$;

revoke execute on function public.minha_organizacao() from anon;

-- ninguém muda organizacao_id por fora das funções abaixo — só insert
-- (a linha nasce já na organização de quem criou) grava; update nunca.
revoke update (organizacao_id) on
  perfis, empreendimentos, clientes, propostas, contratos, negociacoes,
  funil_etapas, campanhas, corretor_empreendimentos, configuracoes
from authenticated;

-- ============================================================ perfis
drop policy "perfis: leitura do time" on perfis;
create policy "perfis: leitura da organização ou do próprio" on perfis
  for select to authenticated
  using (
    id = (select auth.uid())
    or organizacao_id = (select public.minha_organizacao())
  );

drop policy "perfis: admin edita" on perfis;
create policy "perfis: admin edita dentro da organização" on perfis
  for update to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (select public.is_admin()))
  with check (organizacao_id = (select public.minha_organizacao()) and (select public.is_admin()));

-- a correção da autopromoção: o próprio usuário só edita se papel,
-- organizacao_id e empreendimentos_restritos continuarem exatamente como
-- estavam — nome e email continuam livres.
drop policy "perfis: edita o proprio" on perfis;
create policy "perfis: edita o próprio (campos seguros)" on perfis
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and papel = (select p.papel from public.perfis p where p.id = (select auth.uid()))
    and organizacao_id = (select p.organizacao_id from public.perfis p where p.id = (select auth.uid()))
    and empreendimentos_restritos = (select p.empreendimentos_restritos from public.perfis p where p.id = (select auth.uid()))
  );

-- ============================================================ onboarding
create or replace function public.criar_organizacao(p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_slug text;
begin
  if exists (select 1 from public.perfis where id = auth.uid() and organizacao_id is not null) then
    raise exception 'Você já pertence a uma organização.';
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(p_nome), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then v_slug := 'organizacao'; end if;
  if exists (select 1 from public.organizacoes where slug = v_slug) then
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 5);
  end if;

  insert into public.organizacoes (slug, nome) values (v_slug, p_nome) returning id into v_org_id;
  update public.perfis set organizacao_id = v_org_id, papel = 'admin' where id = auth.uid();
  insert into public.configuracoes (organizacao_id) values (v_org_id);
  return v_org_id;
end;
$$;

revoke execute on function public.criar_organizacao(text) from anon;

create or replace function public.info_convite(p_token text)
returns table(organizacao_nome text, email text, papel text, valido boolean)
language sql
stable security definer
set search_path = public
as $$
  select o.nome, c.email, c.papel, (c.usado_em is null and c.expira_em > now())
  from public.convites c
  join public.organizacoes o on o.id = c.organizacao_id
  where c.token = p_token;
$$;

-- quem abre o link do convite ainda não está logado — precisa ver do que
-- se trata antes de criar a conta. Só devolve nome da organização, e-mail,
-- papel e validade; nada sensível.
grant execute on function public.info_convite(text) to anon;

create or replace function public.aceitar_convite(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_convite public.convites%rowtype;
begin
  select * into v_convite from public.convites where token = p_token for update;
  if v_convite.id is null then
    raise exception 'Convite não encontrado.';
  end if;
  if v_convite.usado_em is not null then
    raise exception 'Convite já foi usado.';
  end if;
  if v_convite.expira_em < now() then
    raise exception 'Convite expirado.';
  end if;
  if exists (select 1 from public.perfis where id = auth.uid() and organizacao_id is not null) then
    raise exception 'Você já pertence a uma organização.';
  end if;

  update public.perfis set organizacao_id = v_convite.organizacao_id, papel = v_convite.papel where id = auth.uid();
  update public.convites set usado_em = now() where id = v_convite.id;
end;
$$;

revoke execute on function public.aceitar_convite(text) from anon;
