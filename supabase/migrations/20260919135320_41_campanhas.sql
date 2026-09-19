create table campanhas (
  id uuid primary key default gen_random_uuid(),
  empreendimento_id uuid not null references empreendimentos on delete cascade,
  nome text not null,
  percentual_desconto numeric(9,6) not null check (percentual_desconto > 0),
  modo text not null default 'substituir' check (modo in ('substituir', 'somar')),
  inicio date not null,
  fim date not null check (fim >= inicio),
  ativa boolean not null default true,
  criado_por uuid references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table campanhas is
  'Desconto promocional por tempo determinado, de um empreendimento. O corretor escolhe aplicar ou nao, no Simulador, combinando com uma condicao existente.';
comment on column campanhas.modo is
  'substituir = o percentual da campanha vira o desconto do cenario, por cima do template da condicao escolhida. somar = soma-se ao desconto_pct da condicao escolhida.';

create index campanhas_empreendimento_idx on campanhas (empreendimento_id);

alter table campanhas enable row level security;

create policy "campanhas: leitura" on campanhas
  for select to authenticated using (true);

create policy "campanhas: admin escreve" on campanhas
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create trigger touch_campanhas before update on campanhas
  for each row execute function public.touch_atualizado_em();

-- rastreabilidade: qual cenario/contrato usou desconto de campanha.
-- on delete set null: apagar a campanha nao pode arrastar proposta/contrato reais.
alter table proposta_cenarios add column campanha_id uuid references campanhas on delete set null;
alter table contratos add column campanha_id uuid references campanhas on delete set null;
