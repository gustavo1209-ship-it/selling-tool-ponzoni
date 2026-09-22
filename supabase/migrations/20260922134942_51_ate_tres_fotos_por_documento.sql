-- ============================================================
-- Troca foto_proposta_id/foto_contrato_id (uma foto só cada) por arrays de
-- até 3 (limite aplicado na action, arrays não suportam FK — a limpeza de
-- id órfão ao apagar uma foto também é responsabilidade da action, ver
-- apagarFotoEmpreendimento). Lado a lado quando tem mais de uma; com uma
-- só, continua podendo usar o SVG de destaque de lote de sempre
-- (MapaDaProposta), que não faz sentido pra mais de uma foto ao mesmo tempo.
-- ============================================================

alter table empreendimentos add column fotos_proposta_ids uuid[] not null default '{}';
alter table empreendimentos add column fotos_contrato_ids uuid[] not null default '{}';

update empreendimentos set fotos_proposta_ids = array[foto_proposta_id] where foto_proposta_id is not null;
update empreendimentos set fotos_contrato_ids = array[foto_contrato_id] where foto_contrato_id is not null;

alter table empreendimentos drop column foto_proposta_id;
alter table empreendimentos drop column foto_contrato_id;
