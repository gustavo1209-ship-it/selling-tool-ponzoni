-- ============================================================
-- Marcar proposta e contrato como teste.
--
-- Um contrato de teste (feito pra experimentar a ferramenta, treinar
-- alguém, ou conferir uma conta) tinha as mesmas parcelas de um contrato de
-- verdade — apareciam na "A receber" (/cobranca) do mês e entravam nos
-- totais financeiros de /contratos junto com venda real.
--
-- A marcação nasce na proposta (o corretor sabe desde o início que é
-- teste) e o contrato gerado dela copia o valor. Também dá pra marcar
-- direto no contrato — é o caso da venda antiga cadastrada manualmente em
-- /contratos/novo, que não tem proposta de origem nenhuma.
--
-- Continua contando pra tudo o mais (a RLS não muda, o contrato aparece
-- normalmente na listagem com um selo "Teste") — só sai da soma do
-- dinheiro e da lista de boletos.
-- ============================================================

alter table propostas add column teste boolean not null default false;
alter table contratos add column teste boolean not null default false;

comment on column propostas.teste is
  'Proposta de teste/treino, não uma venda real. O contrato gerado dela copia esta marcação.';
comment on column contratos.teste is
  'Contrato de teste/treino: fora dos totais financeiros de /contratos e da lista de boletos em /cobranca. Continua listado normalmente, com selo.';
