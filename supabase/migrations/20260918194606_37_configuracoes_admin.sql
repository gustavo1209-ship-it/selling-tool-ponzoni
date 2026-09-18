-- ============================================================
-- Configurações: opções da casa que o admin liga e desliga.
--
-- Duas das últimas features nasceram fixas e viram interruptor:
--
-- - `corretor_ve_financeiro_completo` — desligado (padrão, é o que já está
--   no ar) o corretor vê só a própria comissão em /contratos, não o
--   financeiro da casa (valor, recebido, saldo corrigido, em atraso).
--   Ligado, volta a ver tudo, como era antes dessa mudança.
-- - `avisar_cliente_duplicado` — ligado (padrão, também já no ar) checa
--   CPF/nome+telefone contra o cadastro de outros corretores ao criar
--   cliente e mostra o aviso âmbar. Desligado, para de checar.
--
-- Uma linha só (`id = 1`, travado pelo check) — não é catálogo, é
-- configuração global da ferramenta.
-- ============================================================

create table configuracoes (
  id                                integer primary key default 1 check (id = 1),
  corretor_ve_financeiro_completo   boolean not null default false,
  avisar_cliente_duplicado          boolean not null default true,
  atualizado_em                     timestamptz not null default now()
);

comment on table configuracoes is
  'Linha única (id = 1). Opções da casa que o admin liga/desliga em Admin > Configurações.';

insert into configuracoes (id) values (1);

create trigger touch_configuracoes before update on configuracoes
  for each row execute function public.touch_atualizado_em();

alter table configuracoes enable row level security;

-- todo autenticado lê: corretor e as próprias actions dependem de saber o
-- que está ligado (mesma razão de indices_mensais continuar legível, 26)
create policy "configuracoes: leitura" on configuracoes
  for select to authenticated using (true);

create policy "configuracoes: admin edita" on configuracoes
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
