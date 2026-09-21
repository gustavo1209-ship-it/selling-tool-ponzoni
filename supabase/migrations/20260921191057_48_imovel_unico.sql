-- ============================================================
-- Pedido de um cliente construtor: hoje todo empreendimento pressupõe um
-- loteamento com grade de lotes vinda do Sheets. Pra quem vende uma casa
-- ou apartamento único, isso é fricção sem propósito — o cadastro precisa
-- caber área, área construída, preço e descrição direto na tela de criação,
-- sem espelho nenhum.
--
-- A solução reaproveita `lotes` sem mudar nada em proposta/contrato/cálculo:
-- um empreendimento "imóvel único" ganha automaticamente UM lote só
-- (quadra 'ÚNICO', numero '1') no momento da criação. Todo o resto do
-- sistema (proposta, contrato, PDF) já sabe lidar com "os lotes de um
-- empreendimento" — não precisa saber que aqui é só um.
-- ============================================================

alter table empreendimentos add column imovel_unico boolean not null default false;
comment on column empreendimentos.imovel_unico is
  'true = casa/apartamento único, cadastro direto sem espelho de vendas. false (padrão) = loteamento com grade de lotes.';

alter table lotes add column area_construida_m2 numeric;
comment on column lotes.area_construida_m2 is
  'Área construída, distinta de area_m2 (terreno). Nula em loteamento, onde só a área do terreno importa.';

alter table lotes add column descricao text;
comment on column lotes.descricao is
  'Texto livre de marketing (características, acabamentos) — distinto de observacao, que é nota interna do espelho.';

-- ---------------------------------------------------- bucket de fotos
insert into storage.buckets (id, name, public)
values ('empreendimentos', 'empreendimentos', true)
on conflict (id) do nothing;

create policy "empreendimentos: leitura pública" on storage.objects
  for select
  using (bucket_id = 'empreendimentos');

create policy "empreendimentos: admin da organização sobe arquivo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'empreendimentos'
    and (storage.foldername(name))[1] = (select organizacao_id::text from public.perfis where id = auth.uid())
    and (select public.is_admin())
  );

create policy "empreendimentos: admin da organização substitui arquivo" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'empreendimentos'
    and (storage.foldername(name))[1] = (select organizacao_id::text from public.perfis where id = auth.uid())
    and (select public.is_admin())
  )
  with check (
    bucket_id = 'empreendimentos'
    and (storage.foldername(name))[1] = (select organizacao_id::text from public.perfis where id = auth.uid())
    and (select public.is_admin())
  );

create policy "empreendimentos: admin da organização apaga arquivo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'empreendimentos'
    and (storage.foldername(name))[1] = (select organizacao_id::text from public.perfis where id = auth.uid())
    and (select public.is_admin())
  );
