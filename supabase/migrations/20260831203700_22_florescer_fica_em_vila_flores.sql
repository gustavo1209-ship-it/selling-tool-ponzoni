-- O Florescer é em Vila Flores/RS, não Nova Prata: é o que diz o cabeçalho
-- do mapa público, que é a fonte que o cliente vê. A cidade sai impressa na
-- folha da proposta, então errar aqui vira erro no papel.
update empreendimentos
set cidade = 'Vila Flores',
    subtitulo = 'Loteamento residencial — Vila Flores/RS'
where slug = 'florescer';
