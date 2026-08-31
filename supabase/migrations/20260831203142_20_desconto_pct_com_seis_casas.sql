-- ============================================================
-- O desconto passa a caber em seis casas decimais.
--
-- No Industrial os descontos são redondos (3,5%, 6,5%, 9%) e quatro casas
-- bastavam. No Florescer o preço guardado é o da condição de 6x, então as
-- demais entram como acréscimo sobre ele — e os fatores são dízimas:
-- 0,83/0,78, 0,88/0,78, 1/0,78. Arredondadas em 4 casas, o preço cheio de
-- um lote de R$ 590 mil saía R$ 22 fora do PDF que o vendedor tem na mão.
-- ============================================================

alter table condicoes_pagamento
  alter column desconto_pct type numeric(9, 6);

alter table proposta_cenarios
  alter column desconto_pct type numeric(9, 6);

-- os fatores exatos do Florescer, contados a partir da condição de 6x
update condicoes_pagamento c
set desconto_pct = v.pct
from tabelas_preco t, empreendimentos e,
     (values
       ('40% Entrada + 12x sem juros', 1 - 0.83 / 0.78),
       ('40% Entrada + 18x sem juros', 1 - 0.88 / 0.78),
       ('Preço de tabela',             1 - 1.00 / 0.78)
     ) as v(nome, pct)
where c.tabela_preco_id = t.id
  and t.empreendimento_id = e.id
  and e.slug = 'florescer'
  and c.nome = v.nome;
