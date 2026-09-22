-- ============================================================
-- Segunda ponta do mesmo bug: /admin/empreendimentos lia `lotes` com
-- select("*") direto na tabela, que SEMPRE falha por causa de `comprador`
-- (sem SELECT pra authenticated desde a migration 28) — "permission
-- denied for table lotes", engolido em silêncio pelo mesmo padrão de não
-- checar `error`. Corrige trocando pra `lotes_visiveis` (o caminho que o
-- resto do app já usa pra ler lote) e adiciona area_construida_m2/
-- descricao na view, que nasceu antes dessas colunas existirem.
--
-- As duas colunas novas vão no FIM da lista — create or replace view não
-- deixa mudar a ordem/posição de colunas existentes, só acrescentar.
-- ============================================================

create or replace view public.lotes_visiveis as
 select id,
    empreendimento_id,
    quadra,
    numero,
    area_m2,
    case
      when is_admin() then preco_tabela
      when status = any (array['vendido'::lote_status, 'indisponivel'::lote_status])
        and not (select coalesce(configuracoes.corretor_ve_preco_vendido, false)
                 from configuracoes where configuracoes.organizacao_id = minha_organizacao())
        then null::numeric
      else preco_tabela
    end as preco_tabela,
    status,
    tipo,
    observacao,
    atualizado_em,
    case
      when is_admin() then comprador
      when (select coalesce(configuracoes.corretor_ve_comprador, false)
            from configuracoes where configuracoes.organizacao_id = minha_organizacao())
        then comprador
      else null::text
    end as comprador,
    area_construida_m2,
    descricao
   from lotes l
  where pode_ver_empreendimento(empreendimento_id);
