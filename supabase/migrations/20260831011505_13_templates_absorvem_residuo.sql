-- ============================================================
-- Nos templates das condições, o ÚLTIMO bloco passa a absorver o resíduo
-- em vez de ter percentual travado.
--
-- Motivo: a entrada é a alavanca da negociação. Com "40% entrada + 60% em
-- 36x" travados, subir a entrada para 60% deixava os blocos somando 120%
-- do valor — a conta não fechava e só um aviso na tela avisava. Com o
-- último bloco absorvendo, mexer na entrada rebalanceia sozinho, que é o
-- comportamento que o vendedor espera.
--
-- Propostas já criadas não mudam: elas carregam cópia própria dos blocos.
-- ============================================================

update condicoes_pagamento c
set template = (
  select jsonb_agg(
    case
      when item.ordem = ultimo.ordem
        then (item.bloco - 'base_percentual') || '{"absorve_residuo": true}'::jsonb
      else item.bloco
    end
    order by item.ordem
  )
  from jsonb_array_elements(c.template) with ordinality as item(bloco, ordem)
  cross join lateral (
    select jsonb_array_length(c.template) as ordem
  ) ultimo
)
where jsonb_array_length(c.template) > 1;
