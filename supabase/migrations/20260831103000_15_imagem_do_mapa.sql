-- A foto aérea que a proposta desenha por baixo dos polígonos. É diferente
-- de `mapa_url` (o HTML interativo da aba) porque aqui o app precisa da
-- imagem servida localmente: o PDF é gerado pelo navegador e não pode
-- depender de rede na hora de imprimir.
alter table empreendimentos add column mapa_imagem_url text;

update empreendimentos
set mapa_imagem_url = '/mapa-industrial-ponzoni.jpg'
where slug = 'industrial-ponzoni';
