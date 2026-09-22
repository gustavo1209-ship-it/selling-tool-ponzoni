-- ============================================================
-- Foto de capa: uma foto da galeria (empreendimento_fotos) escolhida pelo
-- admin pra aparecer no card do empreendimento na página inicial. Segue o
-- mesmo padrão de foto_proposta_id/foto_contrato_id de antes da migration
-- 51 — aqui continua sendo uma foto só (o card não tem como mostrar mais
-- de uma), então nunca vira array. Vazio = a primeira foto por ordem,
-- resolvido em JS (mesma regra de "padrao" em GaleriaFotos.tsx).
-- ============================================================

alter table empreendimentos
  add column foto_capa_id uuid references empreendimento_fotos(id) on delete set null;

comment on column empreendimentos.foto_capa_id is
  'Foto de capa no card da página inicial. null = a primeira foto da galeria por ordem.';
