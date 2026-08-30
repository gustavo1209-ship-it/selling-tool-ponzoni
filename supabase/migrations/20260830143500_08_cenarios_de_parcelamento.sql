-- ============================================================
-- Uma proposta passa a carregar VÁRIAS opções de parcelamento.
--
-- É como o memorando de negociação da Quadra C já era feito na mão:
-- mesma área, mesmos lotes, e três ou quatro estruturas lado a lado
-- (à vista, 36x INCC, Sicredi em SAC) para o cliente escolher.
--
-- Os blocos passam a pendurar no cenário, não na proposta. Desconto e
-- condição de origem também: à vista tem 9% de desconto e o 36x não, então
-- eles não podem viver no cabeçalho da proposta.
--
-- `propostas.resultado` continua existindo, agora com o snapshot do cenário
-- recomendado — é o que as listagens leem sem precisar carregar tudo.
-- ============================================================

create table proposta_cenarios (
  id              uuid primary key default gen_random_uuid(),
  proposta_id     uuid not null references propostas on delete cascade,
  ordem           integer not null default 0,
  nome            text not null,
  condicao_origem text,
  desconto_pct    numeric(7,4) not null default 0,
  desconto_valor  numeric(14,2) not null default 0,
  desconto_motivo text,
  recomendado     boolean not null default false,
  resultado       jsonb
);

create index cenarios_proposta_idx on proposta_cenarios (proposta_id, ordem);

alter table proposta_cenarios enable row level security;

create policy "cenarios: leitura do time" on proposta_cenarios
  for select to authenticated using (true);
create policy "cenarios: autor escreve" on proposta_cenarios
  for all to authenticated
  using ((select public.pode_editar_proposta(proposta_id)))
  with check ((select public.pode_editar_proposta(proposta_id)));

alter table proposta_blocos
  add column cenario_id uuid references proposta_cenarios on delete cascade;

-- cada proposta existente vira um cenário único, já recomendado
insert into proposta_cenarios
  (proposta_id, ordem, nome, condicao_origem, desconto_pct, desconto_valor, desconto_motivo, recomendado, resultado)
select id, 0, coalesce(condicao_origem, 'Opção A'), condicao_origem,
       desconto_pct, desconto_valor, desconto_motivo, true, resultado
from propostas;

update proposta_blocos b
set cenario_id = c.id
from proposta_cenarios c
where c.proposta_id = b.proposta_id;

alter table proposta_blocos alter column cenario_id set not null;

-- a policy antiga referencia proposta_id; troca antes de derrubar a coluna
create or replace function public.pode_editar_cenario(c_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.proposta_cenarios c
    join public.propostas p on p.id = c.proposta_id
    where c.id = c_id
      and (p.criado_por = auth.uid() or public.is_admin())
  );
$$;

drop policy "proposta_blocos: autor escreve" on proposta_blocos;

create policy "proposta_blocos: autor escreve" on proposta_blocos
  for all to authenticated
  using ((select public.pode_editar_cenario(cenario_id)))
  with check ((select public.pode_editar_cenario(cenario_id)));

alter table proposta_blocos drop column proposta_id;

alter table propostas
  drop column desconto_pct,
  drop column desconto_valor,
  drop column desconto_motivo,
  drop column condicao_origem;

create index blocos_cenario_idx on proposta_blocos (cenario_id, ordem);
