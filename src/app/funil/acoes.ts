"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { organizacaoIdDoUsuario } from "@/lib/supabase/perfil";
import { comoResultado, type ResultadoAcao } from "@/lib/resultadoAcao";

/**
 * O quadro de negociações.
 *
 * A RLS de `negociacoes` é a mesma da carteira (migration 30): vê e mexe
 * quem criou, e admin em tudo. Nenhuma ação aqui precisa checar papel — o
 * que um corretor não pode tocar simplesmente não volta do banco.
 */

const limpo = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

export interface DadosNegociacao {
  etapa_id: string;
  cliente_id: string | null;
  titulo: string | null;
  telefone: string | null;
  empreendimento_id: string | null;
  lote_id: string | null;
  proposta_id: string | null;
  contrato_id: string | null;
  valor_estimado: number | null;
  origem: string | null;
  proximo_contato: string | null;
  observacao: string | null;
}

/**
 * `fechada_em` é derivado da coluna, não digitado.
 *
 * Quem move o cartão para "Fechado" não vai lembrar de carimbar a data, e
 * quem move de volta para "Em negociação" ia deixar a data velha lá — o
 * cartão apareceria como fechado para sempre em qualquer contagem futura.
 */
async function carimbo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  etapaId: string,
  fechadaEm: string | null
) {
  const { data } = await supabase
    .from("funil_etapas")
    .select("desfecho")
    .eq("id", etapaId)
    .maybeSingle();

  const terminal = data?.desfecho === "ganha" || data?.desfecho === "perdida";
  if (terminal) return fechadaEm ?? new Date().toISOString();
  return null;
}

export async function criarNegociacao(
  dados: DadosNegociacao
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado.");

    if (!dados.cliente_id && !limpo(dados.titulo)) {
      throw new Error("Dê um nome ao prospecto, ou vincule um cliente já cadastrado.");
    }

    // entra no topo da coluna: o lead novo é o que se olha primeiro
    const { data: primeiro } = await supabase
      .from("negociacoes")
      .select("ordem")
      .eq("etapa_id", dados.etapa_id)
      .order("ordem")
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("negociacoes").insert({
      ...normalizar(dados),
      ordem: Number(primeiro?.ordem ?? 0) - 10,
      fechada_em: await carimbo(supabase, dados.etapa_id, null),
      criado_por: user.id,
      organizacao_id: await organizacaoIdDoUsuario(supabase, user.id),
    });
    if (error) throw new Error(error.message);

    revalidatePath("/funil");
    return {};
  });
}

export async function atualizarNegociacao(
  id: string,
  dados: DadosNegociacao
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const supabase = await createClient();

    if (!dados.cliente_id && !limpo(dados.titulo)) {
      throw new Error("Dê um nome ao prospecto, ou vincule um cliente já cadastrado.");
    }

    const { data: atual } = await supabase
      .from("negociacoes")
      .select("fechada_em")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("negociacoes")
      .update({
        ...normalizar(dados),
        fechada_em: await carimbo(
          supabase,
          dados.etapa_id,
          (atual?.fechada_em as string | null) ?? null
        ),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/funil");
    return {};
  });
}

function normalizar(d: DadosNegociacao) {
  return {
    etapa_id: d.etapa_id,
    cliente_id: d.cliente_id || null,
    titulo: limpo(d.titulo),
    telefone: limpo(d.telefone),
    empreendimento_id: d.empreendimento_id || null,
    lote_id: d.lote_id || null,
    proposta_id: d.proposta_id || null,
    contrato_id: d.contrato_id || null,
    valor_estimado: d.valor_estimado,
    origem: limpo(d.origem),
    proximo_contato: d.proximo_contato || null,
    observacao: limpo(d.observacao),
  };
}

/**
 * Solta o cartão numa coluna, na posição que a tela calculou.
 *
 * `ordem` é numérico justamente para isso: a tela manda o ponto médio entre
 * os dois vizinhos e nenhum outro cartão precisa ser reescrito.
 */
export async function moverNegociacao(
  id: string,
  etapaId: string,
  ordem: number
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const supabase = await createClient();

    const { data: atual } = await supabase
      .from("negociacoes")
      .select("fechada_em")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("negociacoes")
      .update({
        etapa_id: etapaId,
        ordem,
        fechada_em: await carimbo(
          supabase,
          etapaId,
          (atual?.fechada_em as string | null) ?? null
        ),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/funil");
    return {};
  });
}

export async function apagarNegociacao(id: string): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("negociacoes").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/funil");
    return {};
  });
}

/**
 * O lead vira cadastro.
 *
 * O prospecto entra no quadro com um nome e um telefone — é o que se tem
 * depois de uma ligação. Quando a conversa avança, esse mesmo nome precisa
 * virar cliente para poder receber proposta. Fazer isso pelo cartão evita o
 * caminho de hoje, que é cadastrar de novo em /clientes e depois lembrar de
 * voltar aqui para vincular.
 */
export async function promoverACliente(
  id: string
): Promise<ResultadoAcao<{ clienteId: string }>> {
  return comoResultado(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado.");

    const { data: negociacao } = await supabase
      .from("negociacoes")
      .select("titulo, telefone, cliente_id, observacao")
      .eq("id", id)
      .maybeSingle();

    if (!negociacao) throw new Error("Negociação não encontrada.");
    if (negociacao.cliente_id) throw new Error("Esta negociação já tem cliente.");

    const nome = limpo(negociacao.titulo as string | null);
    if (!nome) throw new Error("Sem nome para cadastrar.");

    const { data: cliente, error } = await supabase
      .from("clientes")
      .insert({
        nome,
        telefone: negociacao.telefone,
        observacao: negociacao.observacao,
        criado_por: user.id,
        organizacao_id: await organizacaoIdDoUsuario(supabase, user.id),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: erroVinculo } = await supabase
      .from("negociacoes")
      .update({ cliente_id: cliente.id })
      .eq("id", id);
    if (erroVinculo) throw new Error(erroVinculo.message);

    revalidatePath("/funil");
    revalidatePath("/clientes");
    return { clienteId: cliente.id as string };
  });
}
