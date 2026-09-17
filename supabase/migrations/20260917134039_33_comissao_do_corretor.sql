-- ============================================================
-- Comissão do corretor: o que ele vai receber, em percentual e em R$.
--
-- Até aqui "a receber" só existia do ponto de vista do escritório — o
-- saldo que o cliente ainda deve. O corretor não tinha como ver, dentro da
-- ferramenta, quanto ele mesmo vai receber daquele contrato.
--
-- Nasce pendente de propósito: o corretor fecha o contrato normalmente, e
-- só o admin — depois, com calma — define o percentual de corretagem, a
-- forma como vai ser paga, e os dados da permuta quando houver uma. A
-- permuta é só registro informativo (o que é, valor de mercado); não entra
-- na conta da comissão.
--
-- Por isso é tabela filha, não colunas em `contratos`: a policy de UPDATE
-- de `contratos` (migration 26) deixa o próprio autor editar o próprio
-- contrato, e deixaria o corretor reescrever a própria comissão se ela
-- fosse coluna ali. Uma tabela com RLS própria resolve sem trigger nem
-- revogação de coluna.
-- ============================================================

create table contrato_comissoes (
  id                     uuid primary key default gen_random_uuid(),
  contrato_id            uuid not null unique references contratos on delete cascade,
  -- fração: 0,08 = 8%, mesmo padrão de condicoes_pagamento.desconto_pct
  percentual             numeric(9,6),
  valor_absoluto         numeric(14,2),
  -- texto livre: "50% na entrada, 50% em 30 dias", "à vista no repasse"...
  forma_pagamento        text,
  permuta                boolean not null default false,
  permuta_descricao      text,
  permuta_valor_mercado  numeric(14,2),
  definido_por           uuid references auth.users on delete set null,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

comment on table contrato_comissoes is
  'Sem linha para um contrato = comissão pendente de definição pelo admin. A permuta é só registro informativo e não entra no cálculo do percentual.';
comment on column contrato_comissoes.percentual is
  'Fração do valor do contrato, digitada pelo admin — não é calculada sozinha a partir de valor_absoluto nem o contrário.';

create trigger touch_contrato_comissoes before update on contrato_comissoes
  for each row execute function public.touch_atualizado_em();

alter table contrato_comissoes enable row level security;

-- mesma visibilidade do contrato: autor vê o próprio, admin vê tudo
create policy "contrato_comissoes: segue o contrato" on contrato_comissoes
  for select to authenticated
  using ((select public.pode_ver_contrato(contrato_id)));

-- só admin define ou muda — é o que mantém "pendente" até alguém decidir
create policy "contrato_comissoes: admin escreve" on contrato_comissoes
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
