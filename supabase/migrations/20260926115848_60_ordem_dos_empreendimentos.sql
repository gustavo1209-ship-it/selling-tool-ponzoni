-- ============================================================
-- Ordem dos empreendimentos deixa de ser fixa (alfabética, via
-- `.order("nome")` espalhado pela aplicação) e vira dado: o admin escolhe,
-- pelas setas na tela de /admin/empreendimentos, igual já funciona para as
-- colunas do funil (`funil_etapas.ordem`) e para as abas do simulador
-- (`proposta_cenarios.ordem`).
--
-- Backfill por `criado_em` dentro de cada organização — não por nome —
-- para não reordenar silenciosamente o que já existe: quem cadastrou
-- primeiro continua vindo primeiro até alguém mexer nas setas.
-- ============================================================

alter table empreendimentos add column ordem integer not null default 0;

with numerados as (
  select id, row_number() over (partition by organizacao_id order by criado_em) * 10 as n
  from empreendimentos
)
update empreendimentos e
set ordem = numerados.n
from numerados
where numerados.id = e.id;
