-- ============================================================
-- No Florescer, à vista é a coluna de 6x (é ela que já vem descontada) —
-- NÃO o PREÇO cheio. A condição de referência tinha herdado o rótulo
-- "Pagamento à vista" no bloco, o que faria o vendedor cotar dinheiro na
-- mão por R$ 589 mil onde o certo são R$ 460 mil. Renomeado.
-- ============================================================

update condicoes_pagamento c
set
  descricao =
    'PREÇO cheio da tabela R.22/02/26 — a base de onde saem os descontos das '
    || 'demais condições. Serve de referência; o prazo e a forma de pagamento '
    || 'se montam nos blocos do cenário.',
  template = '[{"rotulo":"Valor total","tipo":"entrada","base_percentual":1.00,"qtd_parcelas":1,"mes_inicio":0,"periodicidade_meses":1,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"}]'::jsonb
from tabelas_preco t, empreendimentos e
where c.tabela_preco_id = t.id
  and t.empreendimento_id = e.id
  and e.slug = 'florescer'
  and c.nome = 'Preço de tabela';

-- e a de 6x diz, no nome, que é a condição à vista
update condicoes_pagamento c
set descricao =
  'Condição de referência — é o valor publicado no espelho e no PDF de vendas, '
  || 'já descontado como à vista.'
from tabelas_preco t, empreendimentos e
where c.tabela_preco_id = t.id
  and t.empreendimento_id = e.id
  and e.slug = 'florescer'
  and c.nome = '40% Entrada + 6x sem juros';
