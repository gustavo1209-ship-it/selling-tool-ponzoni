-- ============================================================
-- Uma estrutura montada à mão pode virar favorita e reaparecer na lista.
--
-- Mas a escada de desconto da tabela (R n.º5) não pode ficar aberta: um
-- vendedor criando "condição" com 30% de desconto e ela aparecendo para
-- todos seria furo de política comercial. Por isso a separação:
--
--   oficial = true  → veio da tabela de preços, só admin mexe
--   oficial = false → favorita do time, quem criou (ou admin) edita
-- ============================================================

alter table condicoes_pagamento
  add column oficial boolean not null default false,
  add column criado_por uuid references auth.users on delete set null,
  add column criado_em timestamptz not null default now();

-- tudo que já existe veio do seed da tabela de preços
update condicoes_pagamento set oficial = true;

drop policy "condicoes: admin escreve" on condicoes_pagamento;

create policy "condicoes: time cria favorita" on condicoes_pagamento
  for insert to authenticated
  with check (
    (select public.is_admin())
    or (oficial = false and criado_por = (select auth.uid()))
  );

create policy "condicoes: autor ou admin edita" on condicoes_pagamento
  for update to authenticated
  using (
    (select public.is_admin())
    or (oficial = false and criado_por = (select auth.uid()))
  )
  with check (
    (select public.is_admin())
    or (oficial = false and criado_por = (select auth.uid()))
  );

create policy "condicoes: autor ou admin apaga" on condicoes_pagamento
  for delete to authenticated
  using (
    (select public.is_admin())
    or (oficial = false and criado_por = (select auth.uid()))
  );
