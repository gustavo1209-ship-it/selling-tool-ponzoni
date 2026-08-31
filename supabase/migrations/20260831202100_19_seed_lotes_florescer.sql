-- ============================================================
-- Os 127 lotes do Florescer.
--
-- Cruzamento de duas fontes, cada uma mandando no que é dela:
--   • Espelho de Vendas (Google Sheets): status, comprador, área e tipo —
--     é a fonte viva, a mesma que alimenta o mapa público.
--   • "Florescer 260226 VENDAS.pdf": o preço, que é a coluna 40% + 6x
--     (−22% sobre o PREÇO cheio) — o número que o vendedor abre.
--
-- As duas divergiam em 4 status e 1 área (F-15). Valeu o espelho: o PDF é
-- de 22/02 e o Sheets é atualizado. Lote vendido ou indisponível vem sem
-- preço no PDF e fica com `preco_tabela` nulo, como no Industrial.
--
-- `tipo` vai codificado ('1','2','R') só para caber; a expansão é abaixo.
-- ============================================================

insert into lotes (empreendimento_id, quadra, numero, area_m2, preco_tabela, status, comprador, tipo)
select
  e.id, v.quadra, v.numero, v.area_m2, v.preco, v.status::lote_status, v.comprador,
  case v.tipo when '1' then 'Misto I' when '2' then 'Misto II' else 'Residencial' end
from (values
  ('A','1',653.22,460000,'livre',null,'2'), ('A','2',796.76,540000,'livre',null,'2'), ('A','3',1229.79,650000,'livre',null,'2'), ('A','4',932.03,530000,'livre',null,'2'),
  ('A','5',757.56,440000,'livre',null,'2'), ('A','6',761.31,415000,'livre',null,'2'), ('A','7',714.20,365000,'livre',null,'2'), ('A','8',686.70,430000,'livre',null,'2'),
  ('A','9',800.00,420000,'livre',null,'2'), ('A','10',800.00,410000,'livre',null,'2'), ('A','11',800.00,420000,'livre',null,'2'), ('B','1',1480.88,660000,'livre',null,'2'),
  ('B','2',1071.58,550000,'livre',null,'2'), ('B','3',1432.31,640000,'livre',null,'2'), ('B','4',507.13,279000,'reservado',null,'1'), ('B','5',418.66,268000,'reservado',null,'1'),
  ('B','6',479.60,294000,'reservado',null,'1'), ('C','1',596.40,380000,'livre',null,'2'), ('C','2',767.08,420000,'livre',null,'2'), ('C','3',1219.96,590000,'livre',null,'2'),
  ('C','4',711.09,280000,'livre',null,'2'), ('C','5',1079.41,560000,'livre',null,'2'), ('C','6',1276.11,660000,'projeto','Florescer/Onyline','2'), ('C','7',539.08,268000,'livre',null,'1'),
  ('C','8',464.44,246000,'livre',null,'1'), ('C','9',499.75,null,'vendido','Florescer/Onyline','1'), ('D','1',883.28,520000,'livre',null,'1'), ('D','2',1095.29,595000,'livre',null,'1'),
  ('D','3',650.87,378000,'livre',null,'1'), ('D','4',480.00,295000,'livre',null,'1'), ('D','5',420.00,270000,'projeto','Florescer/Onyline','1'), ('D','6',420.00,285000,'livre',null,'1'),
  ('D','7',474.71,320000,'livre',null,'1'), ('D','8',690.00,440000,'livre',null,'1'), ('E','1',681.64,430000,'livre',null,'1'), ('E','2',690.00,440000,'livre',null,'1'),
  ('E','3',474.57,null,'vendido','Florescer/Onyline','1'), ('E','4',420.00,null,'vendido','Florescer/Onyline','1'), ('E','5',420.00,270000,'reservado',null,'1'), ('E','6',480.00,298000,'projeto','Florescer/Onyline','1'),
  ('E','7',877.16,495000,'livre',null,'1'), ('F','1',497.59,260000,'livre',null,'R'), ('F','2',463.05,240000,'livre',null,'R'), ('F','3',461.74,237000,'livre',null,'R'),
  ('F','4',460.42,237000,'projeto','Florescer/Onyline','R'), ('F','5',459.21,237000,'livre',null,'R'), ('F','6',458.81,237000,'livre',null,'R'), ('F','7',420.81,250000,'reservado',null,'R'),
  ('F','8',420.00,270000,'livre',null,'R'), ('F','9',420.00,255000,'livre',null,'R'), ('F','10',420.00,255000,'livre',null,'R'), ('F','11',420.00,270000,'livre',null,'R'),
  ('F','12',464.00,290000,'livre',null,'R'), ('F','13',406.00,270000,'livre',null,'R'), ('F','14',406.00,285000,'livre',null,'1'), ('F','15',464.00,320000,'projeto','Florescer/Onyline','1'),
  ('F','16',420.00,285000,'livre',null,'1'), ('F','17',420.00,285000,'livre',null,'1'), ('F','18',420.00,285000,'livre',null,'1'), ('F','19',420.00,285000,'vendido','Florescer/Onyline','1'),
  ('G','1',480.00,298000,'livre',null,'R'), ('G','2',420.00,270000,'livre',null,'R'), ('G','3',420.00,285000,'livre',null,'1'), ('G','4',474.71,320000,'indisponivel',null,'1'),
  ('G','5',420.00,290000,'indisponivel',null,'1'), ('G','6',420.00,295000,'livre',null,'1'), ('G','7',474.57,346000,'indisponivel',null,'1'), ('G','8',420.00,326000,'indisponivel',null,'1'),
  ('G','9',420.00,326000,'livre',null,'R'), ('G','10',480.00,330000,'livre',null,'R'), ('G','11',420.00,null,'vendido','Florescer/Onyline','R'), ('G','12',420.00,null,'vendido','Florescer/Onyline','R'),
  ('H','1',452.01,284000,'livre',null,'R'), ('H','2',422.83,263000,'livre',null,'R'), ('H','3',423.76,263000,'reservado',null,'R'), ('H','4',424.69,263000,'reservado',null,'R'),
  ('H','5',425.61,263000,'projeto','Florescer/Onyline','R'), ('H','6',426.54,null,'vendido','Florescer/Onyline','R'), ('H','7',427.47,null,'vendido','Florescer/Onyline','R'), ('H','8',432.52,278000,'reservado',null,'R'),
  ('H','9',433.45,278000,'reservado',null,'R'), ('H','10',434.28,null,'vendido','Florescer/Onyline','R'), ('H','11',435.31,null,'vendido','Florescer/Onyline','R'), ('H','12',436.23,285000,'livre',null,'R'),
  ('H','13',437.16,300000,'livre',null,'1'), ('H','14',438.09,315000,'livre',null,'1'), ('H','15',439.01,null,'indisponivel',null,'1'), ('H','16',439.94,null,'indisponivel',null,'1'),
  ('H','17',440.87,null,'indisponivel',null,'1'), ('H','18',473.09,null,'indisponivel',null,'1'), ('I','1',418.46,220000,'livre',null,'1'), ('I','2',417.51,225000,'livre',null,'1'),
  ('I','3',416.61,230000,'livre',null,'1'), ('I','4',415.92,232000,'livre',null,'1'), ('I','5',415.42,235000,'livre',null,'1'), ('I','6',414.92,238000,'livre',null,'1'),
  ('I','7',1352.82,null,'indisponivel',null,'2'), ('I','8',1555.92,null,'indisponivel',null,'2'), ('I','9',1721.26,null,'indisponivel',null,'2'), ('J','1',474.57,null,'indisponivel',null,'1'),
  ('J','2',420.00,null,'indisponivel',null,'1'), ('J','3',420.00,278000,'projeto','Florescer/Onyline','R'), ('J','4',480.00,298000,'livre',null,'R'), ('J','5',420.00,258000,'livre',null,'R'),
  ('J','6',420.00,270000,'livre',null,'R'), ('J','7',420.00,280000,'livre',null,'1'), ('J','8',420.00,298000,'livre',null,'1'), ('J','9',420.00,null,'indisponivel',null,'1'),
  ('J','10',420.00,null,'indisponivel',null,'1'), ('J','11',420.00,298000,'livre',null,'1'), ('J','12',420.00,298000,'livre',null,'1'), ('K','1',480.00,298000,'livre',null,'R'),
  ('K','2',420.00,278000,'vendido','Florescer/Onyline','R'), ('K','3',420.00,null,'indisponivel',null,'1'), ('K','4',474.71,null,'indisponivel',null,'1'), ('K','5',420.00,298000,'livre',null,'1'),
  ('K','6',420.00,303000,'livre',null,'1'), ('K','7',420.00,null,'vendido','Florescer/Onyline','1'), ('K','8',420.00,null,'vendido','Florescer/Onyline','1'), ('K','9',420.00,null,'indisponivel',null,'1'),
  ('K','10',420.00,null,'indisponivel',null,'1'), ('K','11',420.00,268000,'livre',null,'R'), ('K','12',420.00,null,'vendido','Florescer/Onyline','R'), ('O','1',475.73,null,'indisponivel',null,'1'),
  ('O','2',444.97,null,'indisponivel',null,'1'), ('O','3',445.90,null,'indisponivel',null,'1'), ('O','4',574.67,null,'indisponivel',null,'1')
) as v(quadra, numero, area_m2, preco, status, comprador, tipo)
cross join (select id from empreendimentos where slug = 'florescer') e;
