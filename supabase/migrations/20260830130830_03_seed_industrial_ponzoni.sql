-- ============================================================
-- Seed: Industrial Ponzoni — espelho de vendas e tabela R n.º5 2026/07
--
-- A tabela ancora no preço de "40% + 6x" (valor digitado na planilha).
-- O PREÇO publicado no espelho é esse valor x 1,14 (condição 40% + 36x
-- INCC); as demais condições são uma escada de desconto sobre ele:
--   24x INCC = x0,965 | 12x INCC = x0,935 | à vista = x0,910 | 6x = /1,14
-- ============================================================

insert into empreendimentos (slug, nome, subtitulo, cidade, uf, espelho_csv_url)
values (
  'industrial-ponzoni',
  'Industrial Ponzoni',
  'Parque Industrial — Nova Prata/RS',
  'Nova Prata', 'RS',
  'https://docs.google.com/spreadsheets/d/1KAKfuVyV3T6IoLI2FrxANUv1h12knJS9gDbMxJqXiS0/gviz/tq?tqx=out:csv&gid=1375840424'
);

insert into tabelas_preco (empreendimento_id, referencia, condicao_base, vigente_desde, incc_mensal, juros_vp_mensal)
select id, 'R n.º5 2026/07', '40% Entrada + 36x INCC', date '2026-07-01', 0.005, 0.01
from empreendimentos where slug = 'industrial-ponzoni';

insert into lotes (empreendimento_id, quadra, numero, area_m2, preco_tabela, status, comprador, observacao)
select e.id, v.quadra, v.numero, v.area_m2, v.preco, v.status, v.comprador, v.obs
from (values
  ('A', '1', 2446.92, 808264.23, 'indisponivel'::lote_status, null, 'TRAVADO'),
  ('A', '2', 1962.69, 688356.90, 'indisponivel'::lote_status, null, 'TRAVADO'),
  ('A', '3', 1481.07, 550685.52, 'indisponivel'::lote_status, null, 'TRAVADO'),
  ('A', '4', 1226.61, 466306.29, 'livre'::lote_status, null, 'Áreas grandes'),
  ('A', '5', 944.19, 399691.10, 'livre'::lote_status, null, 'Lote de entrada'),
  ('A', '6', 935.00, 399691.10, 'vendido'::lote_status, 'Murilo Minozzo', 'Lote de entrada'),
  ('A', '7', 935.00, 388588.57, 'vendido'::lote_status, 'Maico Massignan', 'Lote de entrada'),
  ('A', '8', 1100.00, 388588.57, 'vendido'::lote_status, 'Edir Bonatto', 'Lote de entrada'),
  ('A', '9', 932.81, 277563.27, 'livre'::lote_status, null, 'Formato'),
  ('A', '10', 921.27, 364163.01, 'livre'::lote_status, null, null),
  ('A', '11', 983.09, 355280.98, 'vendido'::lote_status, 'Fabiano Balzan', 'Permuta'),
  ('A', '12', 1013.40, 355280.98, 'vendido'::lote_status, 'Ivan Zampieron', 'Permuta'),
  ('B', '1', 1009.13, 369714.27, 'livre'::lote_status, null, null),
  ('B', '2', 919.07, 338627.19, 'livre'::lote_status, null, null),
  ('B', '3', 916.76, 344178.45, 'livre'::lote_status, null, null),
  ('C', '1', 966.53, 338627.19, 'livre'::lote_status, null, null),
  ('C', '2', 902.00, 338627.19, 'reservado'::lote_status, 'Isomir Zucoloto', null),
  ('C', '3', 902.00, 341957.94, 'vendido'::lote_status, 'Isomir Zucoloto', null),
  ('C', '4', 1050.24, 377486.04, 'livre'::lote_status, null, null),
  ('C', '5', 1085.28, 404132.12, 'livre'::lote_status, null, null),
  ('C', '6', 1085.28, 427824.70, 'vendido'::lote_status, 'Hermes Stormovski', 'TRAVADO'),
  ('C', '7', 1085.28, 467987.84, 'livre'::lote_status, null, 'TRAVADO'),
  ('C', '8', 1780.80, 621741.72, 'reservado'::lote_status, null, null),
  ('C', '9', 1430.88, 544024.00, 'reservado'::lote_status, null, null),
  ('C', '10', 1080.96, 404132.12, 'livre'::lote_status, null, null),
  ('C', '11', 913.77, 341957.94, 'livre'::lote_status, null, null),
  ('D', '1', 915.08, 371934.78, 'livre'::lote_status, null, 'Melhor localização'),
  ('D', '2', 900.38, 377486.04, 'livre'::lote_status, null, 'Melhor localização'),
  ('D', '3', 900.38, 394139.84, 'vendido'::lote_status, 'Arsie (Orivaldo)', 'Melhor localização'),
  ('D', '4', 900.38, 399691.10, 'indisponivel'::lote_status, null, 'TRAVADO'),
  ('D', '5', 900.38, 410793.64, 'indisponivel'::lote_status, null, 'TRAVADO'),
  ('D', '6', 902.64, 441880.72, 'indisponivel'::lote_status, null, 'TRAVADO'),
  ('D', '7', 956.80, 455203.76, 'indisponivel'::lote_status, null, 'TRAVADO'),
  ('D', '8', 900.38, 419675.66, 'indisponivel'::lote_status, null, 'TRAVADO'),
  ('D', '9', 900.38, 419675.66, 'indisponivel'::lote_status, null, 'TRAVADO'),
  ('D', '10', 900.38, 399691.10, 'livre'::lote_status, null, 'TRAVADO'),
  ('D', '11', 900.38, 388588.57, 'livre'::lote_status, null, 'Melhor localização'),
  ('D', '12', 905.34, 377486.04, 'livre'::lote_status, null, 'Melhor localização'),
  ('E', '1', 1032.56, 377486.04, 'vendido'::lote_status, null, null),
  ('E', '2', 1067.74, 383037.31, 'reservado'::lote_status, null, 'TRAVADO'),
  ('E', '3', 1079.46, 383037.31, 'vendido'::lote_status, 'Hermes Domeneghini', 'TRAVADO'),
  ('E', '4', 1091.17, 394139.84, 'indisponivel'::lote_status, null, 'TRAVADO'),
  ('E', '5', 1183.27, 416344.90, 'indisponivel'::lote_status, null, 'TRAVADO'),
  ('E', '6', 1627.89, 499613.88, 'livre'::lote_status, null, null)
) as v(quadra, numero, area_m2, preco, status, comprador, obs)
cross join (select id from empreendimentos where slug = 'industrial-ponzoni') e;
