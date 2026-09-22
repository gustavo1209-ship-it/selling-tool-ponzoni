-- ============================================================
-- Substitui empreendimentos.mapa_imagem_url (uma foto só, sem separar
-- proposta de contrato) por uma galeria de até 5 fotos por empreendimento
-- (limite aplicado na action, não aqui), com dois ponteiros — qual foto usa
-- na proposta e qual usa no contrato. Sem escolha, cai na primeira por
-- ordem (mesmo comportamento de hoje, só que explícito).
-- ============================================================

create table empreendimento_fotos (
  id                 uuid primary key default gen_random_uuid(),
  empreendimento_id  uuid not null references empreendimentos on delete cascade,
  url                text not null,
  ordem              integer not null default 0,
  criado_em          timestamptz not null default now()
);

alter table empreendimento_fotos enable row level security;

create policy "empreendimento_fotos: leitura permitida" on empreendimento_fotos
  for select to authenticated
  using ((select public.pode_ver_empreendimento(empreendimento_fotos.empreendimento_id)));

create policy "empreendimento_fotos: admin escreve" on empreendimento_fotos
  for all to authenticated
  using (
    (select public.is_admin())
    and (select organizacao_id from public.empreendimentos where id = empreendimento_fotos.empreendimento_id)
        = (select public.minha_organizacao())
  )
  with check (
    (select public.is_admin())
    and (select organizacao_id from public.empreendimentos where id = empreendimento_fotos.empreendimento_id)
        = (select public.minha_organizacao())
  );

alter table empreendimentos add column foto_proposta_id uuid references empreendimento_fotos(id) on delete set null;
alter table empreendimentos add column foto_contrato_id uuid references empreendimento_fotos(id) on delete set null;

-- migra o que já existia (Industrial Ponzoni, Florescer e qualquer teste)
-- pra não quebrar proposta/contrato de quem já tinha foto configurada
insert into empreendimento_fotos (empreendimento_id, url, ordem)
select id, mapa_imagem_url, 0
from empreendimentos
where mapa_imagem_url is not null and mapa_imagem_url <> '';

update empreendimentos e
set foto_proposta_id = f.id, foto_contrato_id = f.id
from empreendimento_fotos f
where f.empreendimento_id = e.id and f.ordem = 0;

alter table empreendimentos drop column mapa_imagem_url;
