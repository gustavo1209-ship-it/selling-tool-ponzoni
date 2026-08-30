-- ============================================================
-- Dois ajustes que só ficaram claros ao reproduzir as planilhas:
--
-- 1. As duas famílias de planilha discordam sobre a 1ª parcela: as abas
--    "Propostas de Parcelamento" usam fator INCC = 1 no mês 1
--    ((1+i)^(m-1)); as abas "IND ..." já corrigem o mês 1 ((1+i)^m).
--    `correcao_primeira_parcela` escolhe a convenção por proposta.
--
-- 2. Numa estrutura customizada é comum fixar todos os blocos menos um e
--    deixar o último absorver o que sobrar do valor negociado.
-- ============================================================

alter table propostas
  add column correcao_primeira_parcela boolean not null default false;

alter table proposta_blocos
  add column absorve_residuo boolean not null default false;

alter table proposta_blocos
  drop constraint base_definida;

alter table proposta_blocos
  add constraint base_definida check (
    absorve_residuo
    or base_percentual is not null
    or base_valor is not null
    or parcela_fixa is not null
  );

-- no template da condição escalonada os dois blocos correm em paralelo a
-- partir do mês 1, como na planilha de origem
update condicoes_pagamento
set template = replace(template::text, '"mes_inicio":13', '"mes_inicio":1')::jsonb
where nome = '20% + 25% em 12x INCC + 55% em 36x INCC';
