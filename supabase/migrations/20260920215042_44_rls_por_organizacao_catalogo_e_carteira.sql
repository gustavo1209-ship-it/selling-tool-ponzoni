-- ============================================================
-- Continuação da 43: as funções security definer que os demais módulos
-- usam (empreendimento, cliente, proposta, cenário, contrato) e as
-- policies diretas de catálogo (empreendimentos/lotes/tabelas_preco/
-- condicoes_pagamento) e carteira (clientes/propostas/contratos/
-- negociacoes/funil_etapas/campanhas/configuracoes/corretor_empreendimentos)
-- que ainda não passavam por organização nenhuma.
--
-- indexadores e indices_mensais ficam de fora de propósito — são a série
-- pública do Banco Central/FGV, igual para qualquer organização.
-- ============================================================

-- ---------------------------------------------------- funções
create or replace function public.pode_ver_empreendimento(e_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    (select organizacao_id from public.empreendimentos where id = e_id) = public.minha_organizacao()
    and case
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

create or replace function public.pode_ver_cliente(p_criado_por uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    (select organizacao_id from public.perfis where id = p_criado_por) = public.minha_organizacao()
    and (
      public.is_admin()
      or p_criado_por = auth.uid()
      or (select coalesce(clientes_compartilhados, false) from public.configuracoes
          where organizacao_id = public.minha_organizacao())
    );
$$;

create or replace function public.pode_ver_proposta(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.propostas p
    where p.id = p_id
      and p.organizacao_id = public.minha_organizacao()
      and (p.criado_por = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.pode_editar_proposta(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.propostas p
    where p.id = p_id
      and p.organizacao_id = public.minha_organizacao()
      and (p.criado_por = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.pode_ver_cenario(c_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.proposta_cenarios c
    join public.propostas p on p.id = c.proposta_id
    where c.id = c_id
      and p.organizacao_id = public.minha_organizacao()
      and (p.criado_por = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.pode_editar_cenario(c_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.proposta_cenarios c
    join public.propostas p on p.id = c.proposta_id
    where c.id = c_id
      and p.organizacao_id = public.minha_organizacao()
      and (p.criado_por = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.pode_ver_contrato(c_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contratos c
    where c.id = c_id
      and c.organizacao_id = public.minha_organizacao()
      and (c.criado_por = auth.uid() or public.is_admin())
  );
$$;
-- pode_ver_comissao delega para pode_ver_contrato — herda a correção de graça.

-- ---------------------------------------------------- lotes_visiveis
-- mesma lógica; só troca "configuracoes where id = 1" por organização.
create or replace view public.lotes_visiveis as
 select id,
    empreendimento_id,
    quadra,
    numero,
    area_m2,
    case
      when is_admin() then preco_tabela
      when status = any (array['vendido'::lote_status, 'indisponivel'::lote_status])
        and not (select coalesce(configuracoes.corretor_ve_preco_vendido, false)
                 from configuracoes where configuracoes.organizacao_id = minha_organizacao())
        then null::numeric
      else preco_tabela
    end as preco_tabela,
    status,
    tipo,
    observacao,
    atualizado_em,
    case
      when is_admin() then comprador
      when (select coalesce(configuracoes.corretor_ve_comprador, false)
            from configuracoes where configuracoes.organizacao_id = minha_organizacao())
        then comprador
      else null::text
    end as comprador
   from lotes l
  where pode_ver_empreendimento(empreendimento_id);

-- ---------------------------------------------------- empreendimentos
drop policy "empreendimentos: admin escreve" on empreendimentos;
create policy "empreendimentos: admin escreve" on empreendimentos
  for all to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (select public.is_admin()))
  with check (organizacao_id = (select public.minha_organizacao()) and (select public.is_admin()));

-- ---------------------------------------------------- lotes (sem coluna própria — junta por empreendimento_id)
drop policy "lotes: admin escreve" on lotes;
create policy "lotes: admin escreve" on lotes
  for all to authenticated
  using (
    (select public.is_admin())
    and (select organizacao_id from empreendimentos where id = lotes.empreendimento_id) = (select public.minha_organizacao())
  )
  with check (
    (select public.is_admin())
    and (select organizacao_id from empreendimentos where id = lotes.empreendimento_id) = (select public.minha_organizacao())
  );

-- ---------------------------------------------------- tabelas_preco
drop policy "tabelas_preco: admin escreve" on tabelas_preco;
create policy "tabelas_preco: admin escreve" on tabelas_preco
  for all to authenticated
  using (
    (select public.is_admin())
    and (select organizacao_id from empreendimentos where id = tabelas_preco.empreendimento_id) = (select public.minha_organizacao())
  )
  with check (
    (select public.is_admin())
    and (select organizacao_id from empreendimentos where id = tabelas_preco.empreendimento_id) = (select public.minha_organizacao())
  );

-- ---------------------------------------------------- condicoes_pagamento
drop policy "condicoes: autor ou admin apaga" on condicoes_pagamento;
create policy "condicoes: autor ou admin apaga" on condicoes_pagamento
  for delete to authenticated
  using (
    exists (
      select 1 from tabelas_preco t join empreendimentos e on e.id = t.empreendimento_id
      where t.id = condicoes_pagamento.tabela_preco_id and e.organizacao_id = (select public.minha_organizacao())
    )
    and ((select public.is_admin()) or (oficial = false and criado_por = (select auth.uid())))
  );

drop policy "condicoes: time cria favorita" on condicoes_pagamento;
create policy "condicoes: time cria favorita" on condicoes_pagamento
  for insert to authenticated
  with check (
    exists (
      select 1 from tabelas_preco t join empreendimentos e on e.id = t.empreendimento_id
      where t.id = condicoes_pagamento.tabela_preco_id and e.organizacao_id = (select public.minha_organizacao())
    )
    and ((select public.is_admin()) or (oficial = false and criado_por = (select auth.uid())))
  );

drop policy "condicoes: autor ou admin edita" on condicoes_pagamento;
create policy "condicoes: autor ou admin edita" on condicoes_pagamento
  for update to authenticated
  using (
    exists (
      select 1 from tabelas_preco t join empreendimentos e on e.id = t.empreendimento_id
      where t.id = condicoes_pagamento.tabela_preco_id and e.organizacao_id = (select public.minha_organizacao())
    )
    and ((select public.is_admin()) or (oficial = false and criado_por = (select auth.uid())))
  )
  with check (
    exists (
      select 1 from tabelas_preco t join empreendimentos e on e.id = t.empreendimento_id
      where t.id = condicoes_pagamento.tabela_preco_id and e.organizacao_id = (select public.minha_organizacao())
    )
    and ((select public.is_admin()) or (oficial = false and criado_por = (select auth.uid())))
  );

-- ---------------------------------------------------- clientes
drop policy "clientes: autor ou admin apaga" on clientes;
create policy "clientes: autor ou admin apaga" on clientes
  for delete to authenticated
  using (
    organizacao_id = (select public.minha_organizacao())
    and (criado_por = (select auth.uid()) or (select public.is_admin()))
  );

drop policy "clientes: cria como autor" on clientes;
create policy "clientes: cria como autor" on clientes
  for insert to authenticated
  with check (
    organizacao_id = (select public.minha_organizacao())
    and (criado_por = (select auth.uid()) or (select public.is_admin()))
  );

-- ---------------------------------------------------- propostas
drop policy "propostas: autor apaga" on propostas;
create policy "propostas: autor apaga" on propostas
  for delete to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())));

drop policy "propostas: autor cria" on propostas;
create policy "propostas: autor cria" on propostas
  for insert to authenticated
  with check (organizacao_id = (select public.minha_organizacao()) and criado_por = (select auth.uid()));

drop policy "propostas: autor ou admin lê" on propostas;
create policy "propostas: autor ou admin lê" on propostas
  for select to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())));

drop policy "propostas: autor edita" on propostas;
create policy "propostas: autor edita" on propostas
  for update to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())))
  with check (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())));

-- ---------------------------------------------------- contratos
drop policy "contratos: autor ou admin apaga" on contratos;
create policy "contratos: autor ou admin apaga" on contratos
  for delete to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())));

drop policy "contratos: cria como autor" on contratos;
create policy "contratos: cria como autor" on contratos
  for insert to authenticated
  with check (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())));

drop policy "contratos: autor ou admin lê" on contratos;
create policy "contratos: autor ou admin lê" on contratos
  for select to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())));

drop policy "contratos: autor ou admin edita" on contratos;
create policy "contratos: autor ou admin edita" on contratos
  for update to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())))
  with check (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())));

-- ---------------------------------------------------- negociacoes
drop policy "negociacoes: autor ou admin apaga" on negociacoes;
create policy "negociacoes: autor ou admin apaga" on negociacoes
  for delete to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())));

drop policy "negociacoes: cria como autor" on negociacoes;
create policy "negociacoes: cria como autor" on negociacoes
  for insert to authenticated
  with check (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())));

drop policy "negociacoes: autor ou admin lê" on negociacoes;
create policy "negociacoes: autor ou admin lê" on negociacoes
  for select to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())));

drop policy "negociacoes: autor ou admin edita" on negociacoes;
create policy "negociacoes: autor ou admin edita" on negociacoes
  for update to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())))
  with check (organizacao_id = (select public.minha_organizacao()) and (criado_por = (select auth.uid()) or (select public.is_admin())));

-- ---------------------------------------------------- funil_etapas
drop policy "funil_etapas: leitura" on funil_etapas;
create policy "funil_etapas: leitura" on funil_etapas
  for select to authenticated
  using (organizacao_id = (select public.minha_organizacao()));

drop policy "funil_etapas: admin escreve" on funil_etapas;
create policy "funil_etapas: admin escreve" on funil_etapas
  for all to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (select public.is_admin()))
  with check (organizacao_id = (select public.minha_organizacao()) and (select public.is_admin()));

-- ---------------------------------------------------- campanhas
drop policy "campanhas: leitura" on campanhas;
create policy "campanhas: leitura" on campanhas
  for select to authenticated
  using (organizacao_id = (select public.minha_organizacao()));

drop policy "campanhas: admin escreve" on campanhas;
create policy "campanhas: admin escreve" on campanhas
  for all to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (select public.is_admin()))
  with check (organizacao_id = (select public.minha_organizacao()) and (select public.is_admin()));

-- ---------------------------------------------------- configuracoes
drop policy "configuracoes: leitura" on configuracoes;
create policy "configuracoes: leitura" on configuracoes
  for select to authenticated
  using (organizacao_id = (select public.minha_organizacao()));

drop policy "configuracoes: admin edita" on configuracoes;
create policy "configuracoes: admin edita" on configuracoes
  for update to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (select public.is_admin()))
  with check (organizacao_id = (select public.minha_organizacao()) and (select public.is_admin()));

-- ---------------------------------------------------- corretor_empreendimentos
drop policy "corretor_empreendimentos: o próprio ou admin lê" on corretor_empreendimentos;
create policy "corretor_empreendimentos: o próprio ou admin lê" on corretor_empreendimentos
  for select to authenticated
  using (
    organizacao_id = (select public.minha_organizacao())
    and (perfil_id = (select auth.uid()) or (select public.is_admin()))
  );

drop policy "corretor_empreendimentos: admin escreve" on corretor_empreendimentos;
create policy "corretor_empreendimentos: admin escreve" on corretor_empreendimentos
  for all to authenticated
  using (organizacao_id = (select public.minha_organizacao()) and (select public.is_admin()))
  with check (organizacao_id = (select public.minha_organizacao()) and (select public.is_admin()));
