-- ============================================================
-- Cronograma de pagamento da comissão: uma linha por parcela, com data e
-- valor, igual ao cronograma do contrato (`contrato_parcelas`) — só que
-- sem correção nem encargos, porque a comissão não é indexada.
--
-- Os três campos de `contrato_comissoes` (comissao_parcelas,
-- comissao_primeiro_pagamento_dias, comissao_intervalo_dias) continuam
-- sendo a "receita" de como gerar o cronograma, mas quem manda a partir de
-- gerado são as linhas aqui — dar baixa numa parcela não mexe na receita,
-- e mudar a receita não apaga baixa já dada (é ação explícita, "recriar
-- cronograma", que o admin confirma sabendo que apaga histórico).
--
-- Mesma regra de visibilidade da comissão: autor do contrato ou admin lê,
-- só admin escreve.
-- ============================================================

create table contrato_comissao_parcelas (
  id             uuid primary key default gen_random_uuid(),
  comissao_id    uuid not null references contrato_comissoes on delete cascade,
  numero         integer not null,
  vencimento     date not null,
  valor          numeric(14,2) not null default 0,
  pago_em        date,
  valor_pago     numeric(14,2),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (comissao_id, numero)
);

comment on table contrato_comissao_parcelas is
  'Cronograma de pagamento da comissão, gerado a partir de contrato_comissoes.comissao_*. Dar baixa não mexe na receita; recriar o cronograma é ação explícita do admin.';

create index contrato_comissao_parcelas_comissao_idx
  on contrato_comissao_parcelas (comissao_id, numero);

create trigger touch_contrato_comissao_parcelas before update on contrato_comissao_parcelas
  for each row execute function public.touch_atualizado_em();

alter table contrato_comissao_parcelas enable row level security;

create function public.pode_ver_comissao(p_comissao_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contrato_comissoes cc
    where cc.id = p_comissao_id and (select public.pode_ver_contrato(cc.contrato_id))
  );
$$;

comment on function public.pode_ver_comissao is
  'Mesma visibilidade do contrato dono da comissão — segue pode_ver_contrato.';

revoke execute on function public.pode_ver_comissao(uuid) from anon;

create policy "contrato_comissao_parcelas: segue a comissão" on contrato_comissao_parcelas
  for select to authenticated
  using ((select public.pode_ver_comissao(comissao_id)));

create policy "contrato_comissao_parcelas: admin escreve" on contrato_comissao_parcelas
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
