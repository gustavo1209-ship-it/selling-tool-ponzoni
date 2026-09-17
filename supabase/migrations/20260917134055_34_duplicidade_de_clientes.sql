-- ============================================================
-- Aviso de cliente duplicado entre corretores.
--
-- Desde a migration 26 a carteira de cliente é privada por corretor: só o
-- autor ou admin lê. Efeito colateral: um corretor não tem como saber que
-- outro já cadastrou o mesmo cliente, e cadastra de novo.
--
-- A decisão foi avisar, não bloquear — o cadastro duplicado continua
-- possível (é o preço combinado na 26), mas quem está cadastrando agora
-- fica sabendo. `cliente_duplicado` é SECURITY DEFINER e só devolve um
-- boolean, nunca a linha em si: não revela quem é o outro corretor nem
-- nada do cadastro dele, do mesmo jeito que `pode_ver_contrato` (26) e
-- `pode_ver_empreendimento` (31) não vazam dado da linha que checam.
--
-- Casa por CPF/CNPJ (dígitos, ignorando pontuação) OU por nome + telefone
-- (dígitos) — nunca só pelo nome, que sozinho dá falso positivo em nome
-- comum.
-- ============================================================

create or replace function public.cliente_duplicado(
  p_nome text, p_documento text, p_telefone text
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
      )
  );
$$;

comment on function public.cliente_duplicado is
  'Boolean só: existe cliente de OUTRO corretor batendo CPF ou nome+telefone. Não vaza a linha — usado para avisar, não para bloquear.';

revoke all on function public.cliente_duplicado(text, text, text) from public;
grant execute on function public.cliente_duplicado(text, text, text) to authenticated;
