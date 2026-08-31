-- ============================================================
-- Taxas de referência dos indexadores, apuradas em 30/08/2026.
--
-- A taxa mensal é derivada do ACUMULADO EM 12 MESES, não do último mês:
-- taxa = (1 + acum12)^(1/12) − 1. Usar o número do mês em projeção de 36
-- ou 120 parcelas produz absurdo — o IGP-M de agosto/2026 foi NEGATIVO
-- (−0,22%), e projetar isso por dez anos derrubaria o saldo a zero.
--
-- São sugestões: o vendedor pode sobrescrever a taxa em cada bloco.
-- Revisar estes números quando a tabela de preços for revisada.
-- ============================================================

insert into indexadores
  (codigo, nome, descricao, taxa_mensal_referencia, acumulado_12m, variacao_mes, fonte, referencia, ordem)
values
  ('incc', 'INCC-M',
   'Custo da construção civil. É o índice padrão de contrato de loteamento e de parcela na planta — o que a casa usa.',
   0.005308, 0.065600, 0.008500, 'FGV', 'ago/2026', 1),

  ('igpm', 'IGP-M',
   'Índice geral de preços. Tradicional em aluguel; em venda parcelada aparece quando o comprador pede algo menos volátil que o INCC.',
   0.001782, 0.021600, -0.002200, 'FGV', 'ago/2026', 2),

  ('ipca', 'IPCA',
   'Inflação oficial. Costuma ser o pedido do comprador quando o INCC está acima da inflação geral.',
   0.003627, 0.044400, 0.000700, 'IBGE', 'jul/2026', 3),

  ('inpc', 'INPC',
   'Inflação das famílias de renda mais baixa. Aparece em contrato com faixa de financiamento habitacional.',
   null, null, null, 'IBGE', null, 4),

  ('igpdi', 'IGP-DI',
   'Irmão do IGP-M, com janela de coleta do dia 1 ao 30. Uso residual.',
   null, null, null, 'FGV', null, 5),

  ('cub', 'CUB-RS',
   'Custo unitário básico da construção no RS. Usado quando o contrato quer amarrar a parcela ao custo de obra local.',
   null, null, null, 'Sinduscon-RS', null, 6),

  ('tr', 'TR',
   'Taxa referencial. Aparece em financiamento bancário do SFH, quase nunca em venda direta.',
   null, null, null, 'Banco Central', null, 7),

  ('cdi', 'CDI',
   'Pós-fixado dos financiamentos. A linha do Sicredi é CDI + 0,35% a.m.',
   0.010979, 0.140000, null, 'Premissa do deck de lançamento (CDI 14% a.a.)', 'ago/2026', 8),

  ('selic', 'Selic',
   'Taxa básica. Anda colada no CDI; entra como alternativa quando o contrato indexa à Selic.',
   0.010979, 0.140000, null, 'Premissa do deck de lançamento (Selic 14% a.a.)', 'ago/2026', 9);
