-- ============================================================
-- Florescer Parque Residencial — segundo empreendimento.
--
-- A tabela dele é diferente da do Industrial: as condições são "sem juros"
-- (nada de INCC) e a escada desce do PREÇO cheio:
--
--   PREÇO           (coluna PREÇO do PDF de valores)
--   40% + 18x  −12%
--   40% + 12x  −17%
--   40% + 6x   −22%   ← é o que sai no PDF de VENDAS
--
-- `preco_tabela` guarda o valor de VENDAS (o de 6x), porque é o número que
-- o vendedor abre com o cliente. Por isso as outras condições entram como
-- ACRÉSCIMO sobre ele — `desconto_pct` negativo:
--
--   12x = 0,83/0,78 − 1 = +6,41%   18x = 0,88/0,78 − 1 = +12,82%
--   preço cheio = 1/0,78 − 1 = +28,21%
--
-- Os percentuais exatos entram na migração 20, que alarga a coluna; aqui
-- eles ainda cabem só em quatro casas.
-- ============================================================

insert into empreendimentos
  (slug, nome, subtitulo, cidade, uf, espelho_csv_url, mapa_url, mapa_publico_url,
   mapa_imagem_url, logo_url, cor_primaria, cor_secundaria)
values (
  'florescer',
  'Florescer Parque Residencial',
  'Loteamento residencial — Nova Prata/RS',
  'Nova Prata', 'RS',
  'https://docs.google.com/spreadsheets/d/1o4-YxN0ujoNQ52Nu7MkM_d6usSMkhTl8z939m7JVBSw/gviz/tq?tqx=out:csv&gid=1375840424',
  'https://gustavo1209-ship-it.github.io/site-florescer/mapa-lotes-florescer.html',
  'https://florescerparqueresidencial.com.br/mapa-vendas',
  '/mapa-florescer.jpg',
  '/logo-florescer.png',
  '#5B2166',
  '#C4A550'
);

insert into tabelas_preco
  (empreendimento_id, referencia, condicao_base, vigente_desde, incc_mensal, juros_vp_mensal)
select id, 'R.22/02/26', '40% Entrada + 6x sem juros', date '2026-02-22', 0.005, 0.01
from empreendimentos where slug = 'florescer';

insert into condicoes_pagamento
  (tabela_preco_id, nome, descricao, desconto_pct, ordem, oficial, template)
select t.id, v.nome, v.descricao, v.desconto, v.ordem, true, v.template::jsonb
from (values

  ('40% Entrada + 6x sem juros',
   'Condição de referência — é o valor publicado no espelho e no PDF de vendas.',
   0.0000, 1,
   '[{"rotulo":"Entrada","tipo":"entrada","base_percentual":0.40,"qtd_parcelas":1,"mes_inicio":0,"periodicidade_meses":1,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"},
     {"rotulo":"6x sem juros","tipo":"parcelas","absorve_residuo":true,"qtd_parcelas":6,"mes_inicio":1,"periodicidade_meses":1,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"}]'),

  ('40% Entrada + 12x sem juros',
   'Prazo maior: acréscimo de 6,41% sobre o valor de 6x.',
   -0.0641, 2,
   '[{"rotulo":"Entrada","tipo":"entrada","base_percentual":0.40,"qtd_parcelas":1,"mes_inicio":0,"periodicidade_meses":1,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"},
     {"rotulo":"12x sem juros","tipo":"parcelas","absorve_residuo":true,"qtd_parcelas":12,"mes_inicio":1,"periodicidade_meses":1,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"}]'),

  ('40% Entrada + 18x sem juros',
   'Prazo maior: acréscimo de 12,82% sobre o valor de 6x.',
   -0.1282, 3,
   '[{"rotulo":"Entrada","tipo":"entrada","base_percentual":0.40,"qtd_parcelas":1,"mes_inicio":0,"periodicidade_meses":1,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"},
     {"rotulo":"18x sem juros","tipo":"parcelas","absorve_residuo":true,"qtd_parcelas":18,"mes_inicio":1,"periodicidade_meses":1,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"}]'),

  ('Preço de tabela',
   'O PREÇO cheio da tabela, sem o desconto das condições de pagamento.',
   -0.2821, 4,
   '[{"rotulo":"Pagamento à vista","tipo":"entrada","base_percentual":1.00,"qtd_parcelas":1,"mes_inicio":0,"periodicidade_meses":1,"indexador":"nenhum","juros_mensal":0,"amortizacao":"nenhuma"}]')

) as v(nome, descricao, desconto, ordem, template)
cross join (
  select tp.id from tabelas_preco tp
  join empreendimentos e on e.id = tp.empreendimento_id
  where e.slug = 'florescer' and tp.referencia = 'R.22/02/26'
) t;
