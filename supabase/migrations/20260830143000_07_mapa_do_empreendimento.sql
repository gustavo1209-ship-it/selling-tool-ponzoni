-- O mapa de lotes vira uma aba da ferramenta. São duas URLs porque servem a
-- coisas diferentes: `mapa_url` é o HTML que a gente embute (o mapa puro,
-- sem o cabeçalho do site) e `mapa_publico_url` é a página que se manda
-- para o cliente.
alter table empreendimentos
  add column mapa_url text,
  add column mapa_publico_url text;

update empreendimentos
set mapa_url = 'https://gustavo1209-ship-it.github.io/site-industrial-ponzoni/mapa-lotes-ponzoni-industrial.html',
    mapa_publico_url = 'https://florescerparqueresidencial.com.br/ponzoni-industrial-vendas'
where slug = 'industrial-ponzoni';
