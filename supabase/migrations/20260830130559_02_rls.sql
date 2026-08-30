-- ============================================================
-- RLS: catálogo é leitura para qualquer usuário autenticado;
-- escrita de catálogo é de admin; propostas são visíveis ao time
-- e editáveis pelo autor (ou admin).
-- ============================================================

create trigger touch_lotes before update on lotes
  for each row execute function public.touch_atualizado_em();

alter table perfis               enable row level security;
alter table empreendimentos      enable row level security;
alter table lotes                enable row level security;
alter table tabelas_preco        enable row level security;
alter table condicoes_pagamento  enable row level security;
alter table clientes             enable row level security;
alter table propostas            enable row level security;
alter table proposta_lotes       enable row level security;
alter table proposta_blocos      enable row level security;

-- ------------------------------------------------------------ perfis
create policy "perfis: leitura do time" on perfis
  for select to authenticated using (true);
create policy "perfis: edita o proprio" on perfis
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- --------------------------------------------------------- catálogo
create policy "empreendimentos: leitura" on empreendimentos
  for select to authenticated using (true);
create policy "empreendimentos: admin escreve" on empreendimentos
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "lotes: leitura" on lotes
  for select to authenticated using (true);
create policy "lotes: time escreve" on lotes
  for all to authenticated using (true) with check (true);

create policy "tabelas_preco: leitura" on tabelas_preco
  for select to authenticated using (true);
create policy "tabelas_preco: admin escreve" on tabelas_preco
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "condicoes: leitura" on condicoes_pagamento
  for select to authenticated using (true);
create policy "condicoes: admin escreve" on condicoes_pagamento
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- --------------------------------------------------------- clientes
create policy "clientes: leitura do time" on clientes
  for select to authenticated using (true);
create policy "clientes: time escreve" on clientes
  for insert to authenticated with check (criado_por = (select auth.uid()));
create policy "clientes: autor edita" on clientes
  for update to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()))
  with check (criado_por = (select auth.uid()) or (select public.is_admin()));
create policy "clientes: autor apaga" on clientes
  for delete to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()));

-- -------------------------------------------------------- propostas
create policy "propostas: leitura do time" on propostas
  for select to authenticated using (true);
create policy "propostas: autor cria" on propostas
  for insert to authenticated with check (criado_por = (select auth.uid()));
create policy "propostas: autor edita" on propostas
  for update to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()))
  with check (criado_por = (select auth.uid()) or (select public.is_admin()));
create policy "propostas: autor apaga" on propostas
  for delete to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()));

-- ------------------------------------------- filhos seguem a proposta
create or replace function public.pode_editar_proposta(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.propostas p
    where p.id = p_id
      and (p.criado_por = auth.uid() or public.is_admin())
  );
$$;

create policy "proposta_lotes: leitura do time" on proposta_lotes
  for select to authenticated using (true);
create policy "proposta_lotes: autor escreve" on proposta_lotes
  for all to authenticated
  using ((select public.pode_editar_proposta(proposta_id)))
  with check ((select public.pode_editar_proposta(proposta_id)));

create policy "proposta_blocos: leitura do time" on proposta_blocos
  for select to authenticated using (true);
create policy "proposta_blocos: autor escreve" on proposta_blocos
  for all to authenticated
  using ((select public.pode_editar_proposta(proposta_id)))
  with check ((select public.pode_editar_proposta(proposta_id)));
