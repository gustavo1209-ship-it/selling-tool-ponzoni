-- ============================================================
-- Condições de pagamento da tabela R n.º5 2026/07.
--
-- `desconto_pct` é a escada de desconto sobre o PREÇO do espelho
-- (que é a condição 40% + 36x INCC). `template` é o conjunto de blocos
-- copiado para a proposta — a partir daí tudo é editável.
--
-- Nos blocos, taxa_indexador_mensal null significa "herda o INCC da
-- proposta"; base_percentual é fração do valor negociado.
-- ============================================================

insert into condicoes_pagamento (tabela_preco_id, nome, descricao, desconto_pct, ordem, template)
select t.id, v.nome, v.descricao, v.desconto, v.ordem, v.template::jsonb
from (values

  ('40% Entrada + 36x INCC',
   'Condição de referência da tabela — é o preço publicado no espelho.',
   0.0000, 1,
   '[{"rotulo":"Entrada","tipo":"entrada","base_percentual":0.40,"qtd_parcelas":1,"mes_inicio":0,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"},
     {"rotulo":"36x corrigidas pelo INCC","tipo":"parcelas","base_percentual":0.60,"qtd_parcelas":36,"mes_inicio":1,"indexador":"incc","juros_mensal":0,"amortizacao":"nenhuma"}]'),

  ('40% Entrada + 24x INCC',
   'Desconto de 3,5% sobre o preço de tabela.',
   0.0350, 2,
   '[{"rotulo":"Entrada","tipo":"entrada","base_percentual":0.40,"qtd_parcelas":1,"mes_inicio":0,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"},
     {"rotulo":"24x corrigidas pelo INCC","tipo":"parcelas","base_percentual":0.60,"qtd_parcelas":24,"mes_inicio":1,"indexador":"incc","juros_mensal":0,"amortizacao":"nenhuma"}]'),

  ('40% Entrada + 12x INCC',
   'Desconto de 6,5% sobre o preço de tabela.',
   0.0650, 3,
   '[{"rotulo":"Entrada","tipo":"entrada","base_percentual":0.40,"qtd_parcelas":1,"mes_inicio":0,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"},
     {"rotulo":"12x corrigidas pelo INCC","tipo":"parcelas","base_percentual":0.60,"qtd_parcelas":12,"mes_inicio":1,"indexador":"incc","juros_mensal":0,"amortizacao":"nenhuma"}]'),

  ('À vista',
   'Desconto de 9% sobre o preço de tabela. Pagamento integral no ato.',
   0.0900, 4,
   '[{"rotulo":"Pagamento à vista","tipo":"entrada","base_percentual":1.00,"qtd_parcelas":1,"mes_inicio":0,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"}]'),

  ('40% Entrada + 6x sem juros',
   'Âncora da tabela: o preço de 36x é este valor acrescido de 14%.',
   0.1228, 5,
   '[{"rotulo":"Entrada","tipo":"entrada","base_percentual":0.40,"qtd_parcelas":1,"mes_inicio":0,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"},
     {"rotulo":"6x sem juros","tipo":"parcelas","base_percentual":0.60,"qtd_parcelas":6,"mes_inicio":1,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"}]'),

  ('20% + 25% em 12x INCC + 55% em 36x INCC',
   'Estrutura escalonada usada nas propostas de parcelamento: entrada menor, um bloco curto e um longo.',
   0.0000, 6,
   '[{"rotulo":"Entrada","tipo":"entrada","base_percentual":0.20,"qtd_parcelas":1,"mes_inicio":0,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"},
     {"rotulo":"12x corrigidas pelo INCC","tipo":"parcelas","base_percentual":0.25,"qtd_parcelas":12,"mes_inicio":1,"indexador":"incc","juros_mensal":0,"amortizacao":"nenhuma"},
     {"rotulo":"36x corrigidas pelo INCC","tipo":"parcelas","base_percentual":0.55,"qtd_parcelas":36,"mes_inicio":1,"indexador":"incc","juros_mensal":0,"amortizacao":"nenhuma"}]'),

  ('20% + 80% em 48x INCC',
   'Entrada reduzida com prazo longo.',
   0.0000, 7,
   '[{"rotulo":"Entrada","tipo":"entrada","base_percentual":0.20,"qtd_parcelas":1,"mes_inicio":0,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"},
     {"rotulo":"48x corrigidas pelo INCC","tipo":"parcelas","base_percentual":0.80,"qtd_parcelas":48,"mes_inicio":1,"indexador":"incc","juros_mensal":0,"amortizacao":"nenhuma"}]'),

  ('Sicredi — 40% entrada + 120x SAC',
   'Financiamento Sicredi: até 120 meses, SAC, CDI + 0,35% a.m. (1,4479% a.m. com CDI a 14% a.a.).',
   0.0900, 8,
   '[{"rotulo":"Entrada","tipo":"entrada","base_percentual":0.40,"qtd_parcelas":1,"mes_inicio":0,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"},
     {"rotulo":"Financiamento Sicredi 120x SAC","tipo":"financiamento","base_percentual":0.60,"qtd_parcelas":120,"mes_inicio":1,"indexador":"cdi","taxa_indexador_mensal":0,"juros_mensal":0.014479,"amortizacao":"sac"}]'),

  ('Sicredi — 100% financiado em 120x SAC',
   'Linha de 100% financiável do Sicredi. O empreendedor recebe à vista, por isso parte do preço à vista.',
   0.0900, 9,
   '[{"rotulo":"Financiamento Sicredi 120x SAC","tipo":"financiamento","base_percentual":1.00,"qtd_parcelas":120,"mes_inicio":1,"indexador":"cdi","taxa_indexador_mensal":0,"juros_mensal":0.014479,"amortizacao":"sac"}]')

) as v(nome, descricao, desconto, ordem, template)
cross join (
  select tp.id from tabelas_preco tp
  join empreendimentos e on e.id = tp.empreendimento_id
  where e.slug = 'industrial-ponzoni' and tp.referencia = 'R n.º5 2026/07'
) t;
