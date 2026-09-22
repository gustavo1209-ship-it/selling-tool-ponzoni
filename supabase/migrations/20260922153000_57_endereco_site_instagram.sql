-- ============================================================
-- Três campos opcionais de identificação do empreendimento — nenhum tem
-- switch de "mostrar no documento" porque já nascem opcionais por
-- natureza (nulo = não aparece, preencheu = aparece, igual subtitulo).
-- Endereço sai no cabeçalho da proposta/contrato, junto do nome; site e
-- Instagram saem no rodapé, junto da assinatura.
-- ============================================================

alter table empreendimentos add column endereco text;
comment on column empreendimentos.endereco is
  'Endereço exato do empreendimento — opcional, sai no cabeçalho da proposta e do contrato quando preenchido.';

alter table empreendimentos add column site_url text;
comment on column empreendimentos.site_url is
  'Site do empreendimento/incorporadora — opcional, sai no rodapé da proposta e do contrato.';

alter table empreendimentos add column instagram text;
comment on column empreendimentos.instagram is
  'Instagram do empreendimento/incorporadora (usuário ou link) — opcional, sai no rodapé da proposta e do contrato.';
