-- ============================================================
-- O nome do comprador some para o corretor.
--
-- Esconder a coluna na tela não bastaria: a mesma chave que a página usa
-- serve para chamar a API REST, e `select=comprador` devolveria a lista
-- inteira. O nome de quem comprou é dado pessoal do cliente da casa, e a
-- ferramenta passa a tratá-lo como tal.
--
-- Postgres não tem RLS por coluna, então a proteção é feita em duas peças:
--
-- 1. `authenticated` perde o SELECT na coluna `comprador` da tabela. Como o
--    Supabase concede SELECT na tabela inteira por padrão, não adianta
--    revogar só a coluna — é preciso derrubar o SELECT e devolvê-lo coluna
--    a coluna, sem essa.
-- 2. A view `lotes_visiveis` devolve tudo, com o comprador aparecendo só
--    para admin. É dela que a aplicação lê daqui em diante; a escrita
--    continua indo direto na tabela (UPDATE não exige SELECT na coluna, e é
--    por isso que a sincronização com o Sheets continua gravando o nome).
--
-- A view é SECURITY DEFINER (o padrão), e tem de ser: com
-- `security_invoker = on` ela rodaria com os privilégios de quem chama, que
-- é justamente quem não pode ler a coluna. A consequência é que ela NÃO
-- aplica a RLS de `lotes` — hoje dá no mesmo, porque a policy de leitura de
-- lote é `using (true)` para qualquer autenticado. **Se um dia a leitura de
-- lotes for restringida, esta view precisa repetir o filtro.**
--
-- Consequência prática no código: `select("*")` em `lotes` passa a estourar
-- "permission denied". Toda leitura da aplicação usa `lotes_visiveis`.
-- ============================================================

create view public.lotes_visiveis as
select
  l.id,
  l.empreendimento_id,
  l.quadra,
  l.numero,
  l.area_m2,
  l.preco_tabela,
  l.status,
  l.tipo,
  l.observacao,
  l.atualizado_em,
  case when public.is_admin() then l.comprador else null end as comprador
from public.lotes l;

comment on view public.lotes_visiveis is
  'Leitura de lotes com o comprador mascarado para quem não é admin. Toda leitura da aplicação passa por aqui; a escrita continua em `lotes`.';

revoke select on public.lotes from authenticated, anon;

grant select (
  id, empreendimento_id, quadra, numero, area_m2, preco_tabela,
  status, tipo, observacao, atualizado_em
) on public.lotes to authenticated;

grant select on public.lotes_visiveis to authenticated;
