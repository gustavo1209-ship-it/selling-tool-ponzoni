-- O logo é do empreendimento, não da ferramenta: o Florescer entra com o
-- dele sem tocar em código. Serve ao cabeçalho do app e ao topo da folha
-- da proposta.
alter table empreendimentos add column logo_url text;

update empreendimentos
set logo_url = '/logo-industrial-ponzoni.jpg'
where slug = 'industrial-ponzoni';
