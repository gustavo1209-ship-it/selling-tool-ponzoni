-- ============================================================
-- Corretores: cada um enxerga a própria carteira.
--
-- Até aqui a ferramenta era de um time fechado e a RLS dizia "leitura do
-- time" em quase tudo: qualquer usuário autenticado via todas as propostas,
-- todos os clientes e todos os contratos. Com corretores de fora da casa
-- isso deixa de servir — a carteira de um não é do outro.
--
-- A regra passa a ser uma só, e vale para proposta, cliente e contrato:
-- **vê quem criou, e admin vê tudo.** Os filhos (lotes, cenários, blocos,
-- parcelas) seguem o pai.
--
-- O que continua compartilhado é o catálogo, porque é dele que se vende:
-- empreendimentos, lotes, tabelas de preço e condições. E a série de
-- índices — ver o comentário lá embaixo, que é onde mora a pegadinha.
-- ============================================================

-- ------------------------------------------------------------- papéis
-- 'vendedor' vira 'corretor': o nome que a casa usa, e o papel que todo
-- cadastro novo recebe por padrão.
alter table perfis drop constraint if exists perfis_papel_check;
update perfis set papel = 'corretor' where papel = 'vendedor';
alter table perfis alter column papel set default 'corretor';
alter table perfis add constraint perfis_papel_check
  check (papel in ('corretor', 'admin'));

-- Gustavo e Gelson veem tudo. Estavam como 'vendedor' — o CLAUDE.md mandava
-- promover o primeiro usuário a admin e isso nunca tinha sido feito, então
-- na prática ninguém administrava tabela de preço nem condição oficial.
update perfis set papel = 'admin'
where email in ('gustavo1209@gmail.com', 'gelson.ponzoni@gmail.com');

comment on column perfis.papel is
  'corretor = vê só o que criou. admin = vê e edita tudo, inclusive tabelas de preço, espelho e índices.';

-- ---------------------------------------------------- quem vê o quê
create or replace function public.pode_ver_proposta(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.propostas p
    where p.id = p_id and (p.criado_por = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.pode_ver_cenario(c_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.proposta_cenarios c
    join public.propostas p on p.id = c.proposta_id
    where c.id = c_id and (p.criado_por = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.pode_ver_contrato(c_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contratos c
    where c.id = c_id and (c.criado_por = auth.uid() or public.is_admin())
  );
$$;

-- --------------------------------------------------------- propostas
drop policy "propostas: leitura do time" on propostas;
create policy "propostas: autor ou admin lê" on propostas
  for select to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()));

drop policy "proposta_lotes: leitura do time" on proposta_lotes;
create policy "proposta_lotes: segue a proposta" on proposta_lotes
  for select to authenticated
  using ((select public.pode_ver_proposta(proposta_id)));

drop policy "cenarios: leitura do time" on proposta_cenarios;
create policy "cenarios: segue a proposta" on proposta_cenarios
  for select to authenticated
  using ((select public.pode_ver_proposta(proposta_id)));

drop policy "proposta_blocos: leitura do time" on proposta_blocos;
create policy "proposta_blocos: segue o cenário" on proposta_blocos
  for select to authenticated
  using ((select public.pode_ver_cenario(cenario_id)));

-- ---------------------------------------------------------- clientes
-- Aqui uma decisão anterior é revertida de propósito. A migration 09 abriu
-- cliente para o time inteiro porque prender a edição ao autor gerava
-- cadastro duplicado quando outra pessoa atendia o mesmo comprador. Isso
-- valia para uma equipe de duas pessoas na mesma sala; com corretores, a
-- carteira de contatos de um não pode aparecer para o outro. O duplicado
-- volta a ser possível, e é o preço combinado.
drop policy "clientes: leitura do time" on clientes;
drop policy "clientes: time cria" on clientes;
drop policy "clientes: time edita" on clientes;

create policy "clientes: autor ou admin lê" on clientes
  for select to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()));
create policy "clientes: cria como autor" on clientes
  for insert to authenticated
  with check (criado_por = (select auth.uid()) or (select public.is_admin()));
create policy "clientes: autor ou admin edita" on clientes
  for update to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()))
  with check (criado_por = (select auth.uid()) or (select public.is_admin()));

-- --------------------------------------------------------- contratos
drop policy "contratos: leitura do time" on contratos;
drop policy "contratos: time cria" on contratos;
drop policy "contratos: time edita" on contratos;

create policy "contratos: autor ou admin lê" on contratos
  for select to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()));
create policy "contratos: cria como autor" on contratos
  for insert to authenticated
  with check (criado_por = (select auth.uid()) or (select public.is_admin()));
create policy "contratos: autor ou admin edita" on contratos
  for update to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()))
  with check (criado_por = (select auth.uid()) or (select public.is_admin()));

drop policy "contrato_lotes: leitura do time" on contrato_lotes;
drop policy "contrato_lotes: time escreve" on contrato_lotes;
create policy "contrato_lotes: segue o contrato" on contrato_lotes
  for all to authenticated
  using ((select public.pode_ver_contrato(contrato_id)))
  with check ((select public.pode_ver_contrato(contrato_id)));

drop policy "contrato_parcelas: leitura do time" on contrato_parcelas;
drop policy "contrato_parcelas: time escreve" on contrato_parcelas;
create policy "contrato_parcelas: segue o contrato" on contrato_parcelas
  for all to authenticated
  using ((select public.pode_ver_contrato(contrato_id)))
  with check ((select public.pode_ver_contrato(contrato_id)));

-- ------------------------------------------------------------- lotes
-- Status e comprador saem do Google Sheets e valem para a casa inteira:
-- um corretor não muda o espelho dos outros. Leitura continua livre, que é
-- o catálogo de venda.
drop policy "lotes: time escreve" on lotes;
create policy "lotes: admin escreve" on lotes
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- -------------------------------------------------- série de índices
-- **A leitura continua aberta a qualquer autenticado, e isso é de
-- propósito.** A correção das parcelas é calculada no servidor com o
-- cliente Supabase DO USUÁRIO: se o corretor não pudesse ler
-- `indices_mensais`, o contrato dele apareceria com fator 1 em toda parcela
-- — sem erro, sem aviso, só com o valor errado. Não é dado sensível: é o
-- índice que a FGV publica.
--
-- O que se restringe é escrever, e a tela `/indices` some do menu de quem
-- não é admin.
drop policy "indices_mensais: time lanca" on indices_mensais;
drop policy "indices_mensais: time edita" on indices_mensais;

create policy "indices_mensais: admin lanca" on indices_mensais
  for insert to authenticated with check ((select public.is_admin()));
create policy "indices_mensais: admin edita" on indices_mensais
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
