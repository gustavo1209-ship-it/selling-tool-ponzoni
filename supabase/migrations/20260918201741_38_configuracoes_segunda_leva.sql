-- ============================================================
-- Configurações, segunda leva: nove opções novas.
--
-- Duas trocam colunas que a migration 37 criou nesta mesma sessão (linha
-- única, sem dado real a preservar):
--
-- - `corretor_ve_financeiro_completo` vira três booleans granulares
--   (valor, recebido, saldo/atraso) — dá pra liberar só uma parte.
-- - `avisar_cliente_duplicado` vira `nivel_duplicidade_cliente`, com um
--   terceiro estado ("bloquear") além de desligado/avisar.
-- ============================================================

-- ---------------------------------------------- financeiro granular
alter table configuracoes drop column corretor_ve_financeiro_completo;
alter table configuracoes add column corretor_ve_valor_contrato boolean not null default false;
alter table configuracoes add column corretor_ve_recebido boolean not null default false;
alter table configuracoes add column corretor_ve_saldo_e_atraso boolean not null default false;

comment on column configuracoes.corretor_ve_valor_contrato is
  'Coluna/cartão "Valor" em /contratos, pro corretor.';
comment on column configuracoes.corretor_ve_recebido is
  'Coluna "Recebido" e cartão "Já recebido" em /contratos, pro corretor.';
comment on column configuracoes.corretor_ve_saldo_e_atraso is
  'Saldo corrigido, parcelas, próximo vencimento e em atraso em /contratos, pro corretor.';

-- ---------------------------------------------- duplicidade em 3 níveis
alter table configuracoes drop column avisar_cliente_duplicado;
alter table configuracoes add column nivel_duplicidade_cliente text not null default 'avisar'
  check (nivel_duplicidade_cliente in ('desligado', 'avisar', 'bloquear'));

comment on column configuracoes.nivel_duplicidade_cliente is
  'desligado = não checa. avisar = cadastra e mostra aviso. bloquear = recusa o cadastro.';

-- ---------------------------------------------- limite de desconto
alter table configuracoes add column desconto_maximo_corretor_pct numeric(9,6);

comment on column configuracoes.desconto_maximo_corretor_pct is
  'Fração (0.10 = 10%) do maior descontoEfetivoPct que um corretor pode salvar sem ser admin. null = sem limite. Vale pra qualquer cenário, oficial ou não — se a escada oficial já tiver um degrau maior, suba o limite pra acomodar.';

-- ---------------------------------------------- montar opção livre
alter table configuracoes add column corretor_monta_opcao_livre boolean not null default true;

comment on column configuracoes.corretor_monta_opcao_livre is
  'Desligado, esconde o botão "Montar opção" do corretor — só cortesia de tela, a API não recusa um payload customizado.';

-- ---------------------------------------------- carteira compartilhada
alter table configuracoes add column clientes_compartilhados boolean not null default false;

comment on column configuracoes.clientes_compartilhados is
  'Ligado, reabre o que a migration 26 fechou: qualquer corretor vê e edita cliente de outro. Reabre também o risco de cadastro duplicado que a 26 resolveu.';

-- ---------------------------------------------- padrões de contrato
alter table configuracoes add column dia_vencimento_padrao integer not null default 10
  check (dia_vencimento_padrao between 1 and 31);
alter table configuracoes add column juros_mora_padrao numeric(8,6) not null default 0.01;
alter table configuracoes add column multa_atraso_padrao numeric(8,6) not null default 0.02;

comment on column configuracoes.dia_vencimento_padrao is
  'Sugerido em contrato novo (manual ou gerado de proposta). Editável por contrato, isso é só o ponto de partida.';

-- ---------------------------------------------- visibilidade do espelho
alter table configuracoes add column corretor_ve_vgv boolean not null default false;
alter table configuracoes add column corretor_ve_comprador boolean not null default false;
alter table configuracoes add column corretor_ve_preco_vendido boolean not null default false;

comment on column configuracoes.corretor_ve_comprador is
  'Ligado, a view lotes_visiveis passa a devolver o comprador pro corretor também, não só pro admin.';
comment on column configuracoes.corretor_ve_preco_vendido is
  'Ligado, lotes_visiveis para de esconder o preço de lote vendido/indisponível do corretor.';

-- ---------------------------------------------- alertas em app
alter table configuracoes add column alertar_parcela_atrasada boolean not null default true;
alter table configuracoes add column alertar_proposta_vencendo boolean not null default true;
alter table configuracoes add column dias_aviso_proposta_vencendo integer not null default 7;

comment on column configuracoes.alertar_parcela_atrasada is
  'Banner de contagem (sem valor em R$) pro corretor em /contratos — não depende dos toggles de financeiro.';

-- ============================================================
-- Duplicidade também por e-mail. Assinatura muda (ganha p_email), então
-- precisa dropar a versão de 3 parâmetros antes de criar a de 4.
-- ============================================================

drop function public.cliente_duplicado(text, text, text);

create function public.cliente_duplicado(
  p_nome text, p_documento text, p_telefone text, p_email text
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clientes c
    where c.criado_por is distinct from auth.uid()
      and (
        (
          nullif(regexp_replace(coalesce(p_documento, ''), '\D', '', 'g'), '') is not null
          and regexp_replace(coalesce(c.documento, ''), '\D', '', 'g')
            = regexp_replace(p_documento, '\D', '', 'g')
        )
        or
        (
          nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), '') is not null
          and p_nome is not null
          and regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g')
            = regexp_replace(p_telefone, '\D', '', 'g')
          and lower(btrim(c.nome)) = lower(btrim(p_nome))
        )
        or
        (
          nullif(btrim(coalesce(p_email, '')), '') is not null
          and lower(btrim(c.email)) = lower(btrim(p_email))
        )
      )
  );
$$;

comment on function public.cliente_duplicado is
  'Boolean só: existe cliente de OUTRO corretor batendo CPF, nome+telefone ou e-mail. Não vaza a linha — usado pra avisar ou bloquear, conforme configuracoes.nivel_duplicidade_cliente.';

revoke all on function public.cliente_duplicado(text, text, text, text) from public;
revoke execute on function public.cliente_duplicado(text, text, text, text) from anon;
grant execute on function public.cliente_duplicado(text, text, text, text) to authenticated;

-- ============================================================
-- Carteira de clientes compartilhada: mesma visibilidade condicional que
-- pode_ver_contrato/pode_ver_empreendimento, mas checando a configuração.
-- INSERT e DELETE de clientes não mudam — quem cria continua marcado como
-- autor de verdade, e quem apaga continua sendo só autor ou admin, como
-- guarda de segurança mesmo com a carteira compartilhada.
-- ============================================================

create function public.pode_ver_cliente(p_criado_por uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or p_criado_por = auth.uid()
    or (select coalesce(clientes_compartilhados, false) from public.configuracoes where id = 1);
$$;

comment on function public.pode_ver_cliente is
  'Mesma visibilidade de pode_ver_contrato, mas com uma terceira porta: a carteira compartilhada ligada em Configurações.';

revoke execute on function public.pode_ver_cliente(uuid) from anon;

drop policy "clientes: autor ou admin lê" on clientes;
create policy "clientes: segue configuração" on clientes
  for select to authenticated
  using ((select public.pode_ver_cliente(criado_por)));

drop policy "clientes: autor ou admin edita" on clientes;
create policy "clientes: segue configuração ao editar" on clientes
  for update to authenticated
  using ((select public.pode_ver_cliente(criado_por)))
  with check ((select public.pode_ver_cliente(criado_por)));

-- ============================================================
-- lotes_visiveis: comprador e preço de lote vendido passam a checar
-- configuracoes também, não só is_admin(). Mesmas colunas/tipos da
-- migration 31 — create or replace, sem drop.
-- ============================================================

create or replace view public.lotes_visiveis as
select
  l.id, l.empreendimento_id, l.quadra, l.numero, l.area_m2,
  case
    when public.is_admin() then l.preco_tabela
    when l.status in ('vendido', 'indisponivel')
      and not (select coalesce(corretor_ve_preco_vendido, false) from public.configuracoes where id = 1)
      then null
    else l.preco_tabela
  end as preco_tabela,
  l.status, l.tipo, l.observacao, l.atualizado_em,
  case
    when public.is_admin() then l.comprador
    when (select coalesce(corretor_ve_comprador, false) from public.configuracoes where id = 1) then l.comprador
    else null
  end as comprador
from public.lotes l
where public.pode_ver_empreendimento(l.empreendimento_id);

comment on view public.lotes_visiveis is
  'Leitura de lotes: comprador e preço de vendido seguem is_admin() OU as opções correspondentes em configuracoes; só os empreendimentos que o usuário pode ver. Toda leitura da aplicação passa por aqui; a escrita continua em lotes.';
