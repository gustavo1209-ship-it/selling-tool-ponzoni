alter table empreendimentos add column mostrar_descricao_documento boolean not null default true;
comment on column empreendimentos.mostrar_descricao_documento is
  'true (padrão) = a descrição do lote/imóvel (lotes.descricao) sai na proposta e no contrato. false = fica só interna.';
