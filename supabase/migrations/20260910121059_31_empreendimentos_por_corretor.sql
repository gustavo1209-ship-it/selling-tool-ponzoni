-- ============================================================
-- Quais empreendimentos cada corretor enxerga.
--
-- Até aqui o catálogo era da casa inteira: qualquer autenticado lia todos os
-- empreendimentos, todos os lotes e todas as tabelas de preço (migration 26,
-- "o que continua compartilhado"). Com corretor que trabalha só um
-- loteamento, isso passa a ser barulho — e, no caso de quem representa
-- terceiros, informação que não é dele.
--
-- **O padrão continua sendo ver tudo.** A restrição é opt-in por pessoa:
-- `perfis.empreendimentos_restritos` liga a trava e
-- `corretor_empreendimentos` diz o que fica visível. Duas peças em vez de
-- uma porque "lista vazia" seria ambíguo — desmarcar o último
-- empreendimento não pode significar "vê tudo de novo".
--
-- A trava é RLS, não interface: `pode_ver_empreendimento()` entra nas
-- policies de leitura de empreendimento, lote, tabela de preço e condição.
-- ============================================================

alter table perfis
  add column empreendimentos_restritos boolean not null default false;

comment on column perfis.empreendimentos_restritos is
  'false (padrão) = vê todos os empreendimentos. true = vê só os listados em corretor_empreendimentos.';

create table corretor_empreendimentos (
  perfil_id          uuid not null references perfis on delete cascade,
  empreendimento_id  uuid not null references empreendimentos on delete cascade,
  criado_em          timestamptz not null default now(),
  primary key (perfil_id, empreendimento_id)
);

alter table corretor_empreendimentos enable row level security;

create policy "corretor_empreendimentos: o próprio ou admin lê"
  on corretor_empreendimentos for select to authenticated
  using (perfil_id = (select auth.uid()) or (select public.is_admin()));
create policy "corretor_empreendimentos: admin escreve"
  on corretor_empreendimentos for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------- a função
create or replace function public.pode_ver_empreendimento(e_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then true
    when not exists (
      select 1 from public.perfis p
      where p.id = auth.uid() and p.empreendimentos_restritos
    ) then true
    else exists (
      select 1 from public.corretor_empreendimentos ce
      where ce.perfil_id = auth.uid() and ce.empreendimento_id = e_id
    )
  end;
$$;

revoke execute on function public.pode_ver_empreendimento(uuid) from anon;

-- ------------------------------------------------------- as policies
drop policy "empreendimentos: leitura" on empreendimentos;
create policy "empreendimentos: leitura permitida" on empreendimentos
  for select to authenticated
  using ((select public.pode_ver_empreendimento(id)));

drop policy "lotes: leitura" on lotes;
create policy "lotes: leitura permitida" on lotes
  for select to authenticated
  using ((select public.pode_ver_empreendimento(empreendimento_id)));

drop policy "tabelas_preco: leitura" on tabelas_preco;
create policy "tabelas_preco: leitura permitida" on tabelas_preco
  for select to authenticated
  using ((select public.pode_ver_empreendimento(empreendimento_id)));

drop policy "condicoes: leitura" on condicoes_pagamento;
create policy "condicoes: leitura permitida" on condicoes_pagamento
  for select to authenticated
  using (exists (
    select 1 from public.tabelas_preco t
    where t.id = tabela_preco_id
      and public.pode_ver_empreendimento(t.empreendimento_id)
  ));

-- ------------------------------------------------------------- a view
-- `lotes_visiveis` é SECURITY DEFINER (migration 28) e por isso NÃO aplica a
-- RLS de `lotes`. Enquanto a leitura de lote era `using (true)` isso dava no
-- mesmo; agora não dá mais — sem este `where`, o corretor restrito continua
-- lendo o lote do empreendimento que não é dele. É o caso que o comentário
-- da 28 antecipou.
create or replace view public.lotes_visiveis as
select
  l.id,
  l.empreendimento_id,
  l.quadra,
  l.numero,
  l.area_m2,
  case
    when public.is_admin() then l.preco_tabela
    when l.status in ('vendido', 'indisponivel') then null
    else l.preco_tabela
  end as preco_tabela,
  l.status,
  l.tipo,
  l.observacao,
  l.atualizado_em,
  case when public.is_admin() then l.comprador else null end as comprador
from public.lotes l
where public.pode_ver_empreendimento(l.empreendimento_id);

comment on view public.lotes_visiveis is
  'Leitura de lotes: comprador só para admin, preço escondido em lote fora de venda, e apenas os empreendimentos que o usuário pode ver. Toda leitura da aplicação passa por aqui; a escrita continua em `lotes`.';

-- --------------------------------------------------------- perfis
-- O admin precisa gravar a trava no perfil de outra pessoa; a policy de
-- update só permitia mexer no próprio (migration 02).
create policy "perfis: admin edita" on perfis
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
