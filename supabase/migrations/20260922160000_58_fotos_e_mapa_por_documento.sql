-- ============================================================
-- Hoje fotos e mapa de localização são um padrão só por empreendimento
-- (fotos_proposta_ids/fotos_contrato_ids/mostrar_localizacao_documento em
-- empreendimentos), decidido só pelo admin. Agora o corretor também
-- escolhe, proposta a proposta e contrato a contrato — cada documento com
-- sua própria escolha, independente do outro.
--
-- Mesma convenção de null que contratos.colunas_documento já usa: null =
-- "não mexi, usa o padrão do empreendimento"; array (mesmo vazio) ou
-- boolean explícito = escolha do corretor pra ESSE documento. Sem isso um
-- valor default fixo (ex.: '{}') faria toda proposta já existente perder
-- as fotos que já mostrava, sem ninguém ter escolhido isso.
-- ============================================================

alter table propostas add column fotos_ids uuid[];
comment on column propostas.fotos_ids is
  'Fotos da galeria (empreendimento_fotos) escolhidas pro corretor pra ESSA proposta. null = usa o padrão do empreendimento (fotos_proposta_ids); array vazio = explicitamente sem fotos.';

alter table propostas add column mostrar_mapa boolean;
comment on column propostas.mostrar_mapa is
  'null = usa o padrão do empreendimento (mostrar_localizacao_documento); true/false = escolha explícita do corretor pra essa proposta.';

alter table contratos add column fotos_ids uuid[];
comment on column contratos.fotos_ids is
  'Fotos da galeria (empreendimento_fotos) escolhidas pro corretor pra ESSE contrato. null = usa o padrão do empreendimento (fotos_contrato_ids); array vazio = explicitamente sem fotos.';

alter table contratos add column mostrar_mapa boolean;
comment on column contratos.mostrar_mapa is
  'null = usa o padrão do empreendimento (mostrar_localizacao_documento); true/false = escolha explícita do corretor pra esse contrato.';
