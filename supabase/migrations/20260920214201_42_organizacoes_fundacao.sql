-- ============================================================
-- Fundação multi-tenant: tabela organizacoes, coluna organizacao_id nas
-- tabelas raiz, backfill para um único tenant "Ponzoni" (a casa que já usa
-- a ferramenta), convites de time e bucket de marca. Migration puramente
-- aditiva: nenhuma policy existente é tocada aqui — isso é a próxima.
-- ============================================================

create table organizacoes (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique,
  nome                    text not null,
  logo_url                text,
  cor_primaria            text not null default '#5B2166',
  cor_secundaria          text not null default '#C4A550',
  plano                   text not null default 'light'
                            check (plano in ('light','pro','ultimate')),
  status_assinatura       text not null default 'trial'
                            check (status_assinatura in ('trial','ativa','inadimplente','cancelada')),
  trial_termina_em        timestamptz not null default (now() + interval '30 days'),
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);

-- ---------------------------------------------------- organizacao_id
alter table perfis                 add column organizacao_id uuid references organizacoes on delete cascade;
alter table empreendimentos        add column organizacao_id uuid references organizacoes on delete cascade;
alter table clientes               add column organizacao_id uuid references organizacoes on delete cascade;
alter table propostas              add column organizacao_id uuid references organizacoes on delete cascade;
alter table contratos              add column organizacao_id uuid references organizacoes on delete cascade;
alter table negociacoes            add column organizacao_id uuid references organizacoes on delete cascade;
alter table funil_etapas           add column organizacao_id uuid references organizacoes on delete cascade;
alter table corretor_empreendimentos add column organizacao_id uuid references organizacoes on delete cascade;
alter table campanhas              add column organizacao_id uuid references organizacoes on delete cascade;
alter table configuracoes          add column organizacao_id uuid references organizacoes on delete cascade;

-- ---------------------------------------------------- backfill: Ponzoni
do $$
declare v_org_id uuid;
begin
  insert into organizacoes (slug, nome, plano, status_assinatura, trial_termina_em)
  values ('ponzoni', 'Ponzoni', 'ultimate', 'ativa', now())
  returning id into v_org_id;

  update perfis                  set organizacao_id = v_org_id where organizacao_id is null;
  update empreendimentos         set organizacao_id = v_org_id where organizacao_id is null;
  update clientes                set organizacao_id = v_org_id where organizacao_id is null;
  update propostas               set organizacao_id = v_org_id where organizacao_id is null;
  update contratos                set organizacao_id = v_org_id where organizacao_id is null;
  update negociacoes             set organizacao_id = v_org_id where organizacao_id is null;
  update funil_etapas            set organizacao_id = v_org_id where organizacao_id is null;
  update corretor_empreendimentos set organizacao_id = v_org_id where organizacao_id is null;
  update campanhas               set organizacao_id = v_org_id where organizacao_id is null;
  update configuracoes           set organizacao_id = v_org_id where organizacao_id is null;
end $$;

alter table perfis                 alter column organizacao_id set not null;
alter table empreendimentos        alter column organizacao_id set not null;
alter table clientes               alter column organizacao_id set not null;
alter table propostas              alter column organizacao_id set not null;
alter table contratos              alter column organizacao_id set not null;
alter table negociacoes            alter column organizacao_id set not null;
alter table funil_etapas           alter column organizacao_id set not null;
alter table corretor_empreendimentos alter column organizacao_id set not null;
alter table campanhas              alter column organizacao_id set not null;
alter table configuracoes          alter column organizacao_id set not null;

-- ---------------------------------------------------- RLS de organizacoes
-- só cria depois de perfis.organizacao_id existir, porque as policies
-- consultam essa coluna.
alter table organizacoes enable row level security;

create policy "organizacoes: membro lê a própria" on organizacoes
  for select to authenticated
  using (id = (select organizacao_id from public.perfis where id = auth.uid()));

create policy "organizacoes: admin edita a própria" on organizacoes
  for update to authenticated
  using (
    id = (select organizacao_id from public.perfis where id = auth.uid())
    and (select public.is_admin())
  )
  with check (
    id = (select organizacao_id from public.perfis where id = auth.uid())
    and (select public.is_admin())
  );

-- só marca (nome/logo/cores) é editável pelo admin da própria organização;
-- plano, status de assinatura e ids do Stripe só o webhook (service role,
-- que ignora RLS) grava. Nem insert nem delete direto: nascem/somem só via
-- funções security definer.
revoke insert, update, delete on organizacoes from authenticated;
grant update (nome, logo_url, cor_primaria, cor_secundaria) on organizacoes to authenticated;

-- ---------------------------------------------------- ajustes de unicidade
-- dois clientes podem batizar um empreendimento com o mesmo nome
alter table empreendimentos drop constraint empreendimentos_slug_key;
alter table empreendimentos add constraint empreendimentos_organizacao_slug_key unique (organizacao_id, slug);

-- configuracoes deixa de ser linha única travada (id = 1) e vira uma linha
-- por organização. A linha da Ponzoni continua com id = 1 (nada muda pra
-- ela); organizações novas ganham outro id, mas a aplicação passa a
-- consultar por organizacao_id, não mais por id = 1.
alter table configuracoes drop constraint configuracoes_id_check;
alter table configuracoes add constraint configuracoes_organizacao_id_key unique (organizacao_id);
alter table configuracoes alter column id set default nextval(pg_get_serial_sequence('configuracoes','id'));

-- ---------------------------------------------------- convites de time
create table convites (
  id              uuid primary key default gen_random_uuid(),
  organizacao_id  uuid not null references organizacoes on delete cascade,
  email           text not null,
  papel           text not null default 'corretor' check (papel in ('corretor','admin')),
  token           text not null unique
                    default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  criado_por      uuid references auth.users,
  criado_em       timestamptz not null default now(),
  expira_em       timestamptz not null default (now() + interval '7 days'),
  usado_em        timestamptz
);

alter table convites enable row level security;

create policy "convites: admin da organização gerencia" on convites
  for all to authenticated
  using (
    organizacao_id = (select organizacao_id from public.perfis where id = auth.uid())
    and (select public.is_admin())
  )
  with check (
    organizacao_id = (select organizacao_id from public.perfis where id = auth.uid())
    and (select public.is_admin())
  );

-- ---------------------------------------------------- bucket de marca
insert into storage.buckets (id, name, public)
values ('marca', 'marca', true)
on conflict (id) do nothing;

create policy "marca: leitura pública" on storage.objects
  for select
  using (bucket_id = 'marca');

create policy "marca: admin da organização sobe arquivo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marca'
    and (storage.foldername(name))[1] = (select organizacao_id::text from public.perfis where id = auth.uid())
    and (select public.is_admin())
  );

create policy "marca: admin da organização substitui arquivo" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'marca'
    and (storage.foldername(name))[1] = (select organizacao_id::text from public.perfis where id = auth.uid())
    and (select public.is_admin())
  )
  with check (
    bucket_id = 'marca'
    and (storage.foldername(name))[1] = (select organizacao_id::text from public.perfis where id = auth.uid())
    and (select public.is_admin())
  );

create policy "marca: admin da organização apaga arquivo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'marca'
    and (storage.foldername(name))[1] = (select organizacao_id::text from public.perfis where id = auth.uid())
    and (select public.is_admin())
  );
