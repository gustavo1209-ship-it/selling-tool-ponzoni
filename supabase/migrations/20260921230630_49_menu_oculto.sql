-- ============================================================
-- Cada organização usa a ferramenta de um jeito diferente — um construtor
-- que vende casa pronta não usa Mapa nem Índices, por exemplo. O menu vira
-- preferência por organização, não trava nada: quem digitar a URL direto
-- continua entrando (a RLS é quem separa de verdade, igual todo o resto da
-- interface — ver perfilAtual()).
-- ============================================================

alter table configuracoes add column menu_oculto text[] not null default '{}';
comment on column configuracoes.menu_oculto is
  'Hrefs escondidos do menu (ex.: {/mapa,/indices}) — cortesia de interface, não trava a rota.';
