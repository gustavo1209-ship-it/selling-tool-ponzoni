-- ============================================================
-- O preço de lote vendido ou indisponível some para o corretor.
--
-- Vale para os dois empreendimentos: o que o corretor precisa saber é o
-- preço do que ele pode vender. O valor de um lote que já saiu da
-- prateleira é histórico de negociação da casa — e, num lote vendido, é o
-- preço que alguém pagou.
--
-- Mesma mecânica do comprador (migration 28): mascarado na view, não na
-- tela, senão `select=preco_tabela` pela API devolveria tudo.
--
-- `preco_tabela` continua visível ao corretor em lote livre, reservado ou
-- em projeto: é o catálogo de venda. Efeito colateral aceito: ao cadastrar
-- um contrato de venda antiga, o rateio do valor entre lotes deixa de ter
-- preço de tabela como base e divide igual — o valor total do contrato é
-- digitado de qualquer forma.
-- ============================================================

drop view public.lotes_visiveis;

create view public.lotes_visiveis as
select
  l.id,
  l.empreendimento_id,
  l.quadra,
  l.numero,
  l.area_m2,
  case
    when public.is_admin() then l.preco_tabela
    when l.status in ('vendido', 'indisponivel') then null
    else l.preco_tabela
  end as preco_tabela,
  l.status,
  l.tipo,
  l.observacao,
  l.atualizado_em,
  case when public.is_admin() then l.comprador else null end as comprador
from public.lotes l;

comment on view public.lotes_visiveis is
  'Leitura de lotes para a aplicação. Para quem não é admin, esconde o comprador e o preço de lote vendido ou indisponível. A escrita continua em `lotes`.';

grant select on public.lotes_visiveis to authenticated;
