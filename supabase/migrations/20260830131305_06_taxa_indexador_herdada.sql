-- taxa_indexador_mensal precisa aceitar null: null significa "herda a taxa
-- do indexador definida na proposta" (é assim que os templates das condições
-- deixam os blocos INCC seguirem o INCC da proposta em vez de congelar 0,5%).
alter table proposta_blocos
  alter column taxa_indexador_mensal drop not null,
  alter column taxa_indexador_mensal drop default;

update proposta_blocos
set taxa_indexador_mensal = null
where indexador <> 'nenhum' and taxa_indexador_mensal = 0;
