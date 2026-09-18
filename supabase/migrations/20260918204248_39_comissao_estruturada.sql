-- ============================================================
-- Comissão mais explícita pro corretor: forma de pagamento estruturada
-- (em vez de só texto livre) e o valor que a permuta efetivamente abate
-- do que se recebe em dinheiro.
--
-- `forma_pagamento` (texto livre) continua existindo, mas vira observação
-- complementar — o que explica o "como" principal agora são os três campos
-- novos, que dão pra descrever sozinhos ("3x de R$X, a primeira em 30 dias,
-- a cada 30 dias" ou "à vista, no ato").
--
-- `permuta_valor_abatido` é diferente de `permuta_valor_mercado`: o de
-- mercado é só informativo (quanto vale o bem permutado); o abatido é
-- quanto disso efetivamente desconta do valor em dinheiro da comissão —
-- os dois podem ser números bem diferentes (o corretor pode topar receber
-- menos em dinheiro do que o bem vale, ou vice-versa).
-- ============================================================

alter table contrato_comissoes add column comissao_parcelas integer not null default 1
  check (comissao_parcelas >= 1);
alter table contrato_comissoes add column comissao_primeiro_pagamento_dias integer not null default 0
  check (comissao_primeiro_pagamento_dias >= 0);
alter table contrato_comissoes add column comissao_intervalo_dias integer not null default 30
  check (comissao_intervalo_dias >= 1);
alter table contrato_comissoes add column permuta_valor_abatido numeric(14,2);

comment on column contrato_comissoes.comissao_parcelas is
  'Em quantas vezes a comissão é paga. 1 = à vista.';
comment on column contrato_comissoes.comissao_primeiro_pagamento_dias is
  'Dias após a data do contrato até o primeiro pagamento da comissão. 0 = no ato.';
comment on column contrato_comissoes.comissao_intervalo_dias is
  'Dias entre uma parcela e a próxima, quando comissao_parcelas > 1.';
comment on column contrato_comissoes.permuta_valor_abatido is
  'Quanto da comissão é quitado via a permuta, abatendo do valor em dinheiro. Diferente de permuta_valor_mercado, que é só o valor do bem — os dois podem divergir.';
comment on column contrato_comissoes.forma_pagamento is
  'Observação complementar, texto livre — o "como" principal agora são comissao_parcelas/comissao_primeiro_pagamento_dias/comissao_intervalo_dias.';
