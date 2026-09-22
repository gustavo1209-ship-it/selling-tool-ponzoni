-- ============================================================
-- Print do Google Maps/Apple Maps com a localização — separado da galeria
-- de fotos do imóvel (que é sobre o imóvel em si), com toggle próprio de
-- mostrar ou não no documento, mesmo padrão de mostrar_descricao_documento.
-- Reaproveita o bucket `empreendimentos` já existente (migration 48).
-- ============================================================

alter table empreendimentos add column mapa_localizacao_url text;
comment on column empreendimentos.mapa_localizacao_url is
  'Print do mapa (Google Maps/Apple Maps) mostrando a localização — sobe pro bucket empreendimentos.';

alter table empreendimentos add column mostrar_localizacao_documento boolean not null default true;
comment on column empreendimentos.mostrar_localizacao_documento is
  'true (padrão) = mapa_localizacao_url sai na proposta e no contrato, quando preenchida.';
