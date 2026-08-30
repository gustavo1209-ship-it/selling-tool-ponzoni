"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcular } from "@/lib/calc";
import type { Bloco } from "@/lib/calc/tipos";
import type { BlocoTemplate, PropostaBloco, PropostaLote } from "@/lib/db/tipos";

/** Blocos default quando a condição escolhida não traz template. */
const TEMPLATE_PADRAO: BlocoTemplate[] = [
  {
    rotulo: "Entrada",
    tipo: "entrada",
    base_percentual: 0.4,
    qtd_parcelas: 1,
    mes_inicio: 0,
    indexador: "nenhum",
    juros_mensal: 0,
    amortizacao: "nenhuma",
  },
  {
    rotulo: "36x corrigidas pelo INCC",
    tipo: "parcelas",
    base_percentual: 0.6,
    qtd_parcelas: 36,
    mes_inicio: 1,
    indexador: "incc",
    juros_mensal: 0,
    amortizacao: "nenhuma",
  },
];

export async function criarProposta(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const empreendimentoId = String(formData.get("empreendimento_id") ?? "");
  const condicaoId = String(formData.get("condicao_id") ?? "");
  const loteIds = formData.getAll("lote_id").map(String).filter(Boolean);
  const nomeCliente = String(formData.get("cliente_nome") ?? "").trim();
  const clienteExistente = String(formData.get("cliente_id") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim() || null;

  if (!empreendimentoId || loteIds.length === 0) {
    throw new Error("Escolha o empreendimento e ao menos um lote.");
  }

  const [{ data: lotes }, { data: condicao }, { data: tabela }] = await Promise.all([
    supabase.from("lotes").select("*").in("id", loteIds),
    condicaoId
      ? supabase.from("condicoes_pagamento").select("*").eq("id", condicaoId).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("tabelas_preco")
      .select("*")
      .eq("empreendimento_id", empreendimentoId)
      .eq("ativa", true)
      .order("vigente_desde", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!lotes || lotes.length === 0) throw new Error("Lotes não encontrados.");

  // cliente: reaproveita o existente ou cria um novo com o nome digitado
  let clienteId: string | null = clienteExistente || null;
  if (!clienteId && nomeCliente) {
    const { data: novo, error } = await supabase
      .from("clientes")
      .insert({ nome: nomeCliente, criado_por: user.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    clienteId = novo.id;
  }

  const descontoPct = condicao ? Number(condicao.desconto_pct) : 0;

  const { data: proposta, error: erroProposta } = await supabase
    .from("propostas")
    .insert({
      empreendimento_id: empreendimentoId,
      cliente_id: clienteId,
      tabela_preco_id: tabela?.id ?? null,
      condicao_origem: condicao?.nome ?? null,
      titulo,
      incc_mensal: tabela?.incc_mensal ?? 0.005,
      juros_vp_mensal: tabela?.juros_vp_mensal ?? 0.01,
      desconto_pct: descontoPct,
      criado_por: user.id,
    })
    .select("id")
    .single();
  if (erroProposta) throw new Error(erroProposta.message);

  const ordenados = loteIds
    .map((id) => lotes.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));

  const { error: erroLotes } = await supabase.from("proposta_lotes").insert(
    ordenados.map((l, i) => ({
      proposta_id: proposta.id,
      lote_id: l.id,
      quadra: l.quadra,
      numero: l.numero,
      area_m2: l.area_m2,
      preco_tabela: l.preco_tabela ?? 0,
      valor_negociado: l.preco_tabela ?? 0,
      ordem: i,
    }))
  );
  if (erroLotes) throw new Error(erroLotes.message);

  const template = (condicao?.template as BlocoTemplate[] | null) ?? TEMPLATE_PADRAO;
  const { error: erroBlocos } = await supabase.from("proposta_blocos").insert(
    (template.length ? template : TEMPLATE_PADRAO).map((b, i) => ({
      proposta_id: proposta.id,
      ordem: i,
      rotulo: b.rotulo,
      tipo: b.tipo,
      base_percentual: b.base_percentual ?? null,
      base_valor: b.base_valor ?? null,
      absorve_residuo: b.absorve_residuo ?? false,
      qtd_parcelas: b.qtd_parcelas,
      mes_inicio: b.mes_inicio,
      indexador: b.indexador,
      taxa_indexador_mensal: b.taxa_indexador_mensal ?? null,
      juros_mensal: b.juros_mensal,
      amortizacao: b.amortizacao,
      parcela_fixa: b.parcela_fixa ?? null,
      observacao: b.observacao ?? null,
    }))
  );
  if (erroBlocos) throw new Error(erroBlocos.message);

  revalidatePath("/propostas");
  redirect(`/propostas/${proposta.id}`);
}

export interface PayloadSalvar {
  id: string;
  titulo: string | null;
  status: string;
  data_base: string;
  validade_dias: number;
  incc_mensal: number;
  juros_vp_mensal: number;
  correcao_primeira_parcela: boolean;
  desconto_pct: number;
  desconto_valor: number;
  desconto_motivo: string | null;
  observacoes: string | null;
  lotes: PropostaLote[];
  blocos: PropostaBloco[];
}

/**
 * Grava a proposta inteira: cabeçalho, lotes, blocos e o snapshot do
 * cálculo. Blocos e lotes são reescritos do zero — a lista é pequena e
 * assim não sobra órfão de linha removida na tela.
 */
export async function salvarProposta(payload: PayloadSalvar) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const resultado = calcular({
    lotes: payload.lotes.map((l) => ({
      quadra: l.quadra,
      numero: l.numero,
      area_m2: Number(l.area_m2),
      preco_tabela: Number(l.preco_tabela),
      valor_negociado: Number(l.valor_negociado),
    })),
    blocos: payload.blocos as unknown as Bloco[],
    premissas: {
      incc_mensal: payload.incc_mensal,
      juros_vp_mensal: payload.juros_vp_mensal,
      correcao_primeira_parcela: payload.correcao_primeira_parcela,
    },
    desconto_pct: payload.desconto_pct,
    desconto_valor: payload.desconto_valor,
  });

  const { error: erroCabecalho } = await supabase
    .from("propostas")
    .update({
      titulo: payload.titulo,
      status: payload.status,
      data_base: payload.data_base,
      validade_dias: payload.validade_dias,
      incc_mensal: payload.incc_mensal,
      juros_vp_mensal: payload.juros_vp_mensal,
      correcao_primeira_parcela: payload.correcao_primeira_parcela,
      desconto_pct: payload.desconto_pct,
      desconto_valor: payload.desconto_valor,
      desconto_motivo: payload.desconto_motivo,
      observacoes: payload.observacoes,
      resultado,
    })
    .eq("id", payload.id);
  if (erroCabecalho) throw new Error(erroCabecalho.message);

  await supabase.from("proposta_lotes").delete().eq("proposta_id", payload.id);
  if (payload.lotes.length) {
    const { error } = await supabase.from("proposta_lotes").insert(
      payload.lotes.map((l, i) => ({
        proposta_id: payload.id,
        lote_id: l.lote_id,
        quadra: l.quadra,
        numero: l.numero,
        area_m2: l.area_m2,
        preco_tabela: l.preco_tabela,
        valor_negociado: l.valor_negociado,
        ordem: i,
      }))
    );
    if (error) throw new Error(error.message);
  }

  await supabase.from("proposta_blocos").delete().eq("proposta_id", payload.id);
  if (payload.blocos.length) {
    const { error } = await supabase.from("proposta_blocos").insert(
      payload.blocos.map((b, i) => ({
        proposta_id: payload.id,
        ordem: i,
        rotulo: b.rotulo,
        tipo: b.tipo,
        base_percentual: b.base_percentual,
        base_valor: b.base_valor,
        absorve_residuo: b.absorve_residuo,
        qtd_parcelas: b.qtd_parcelas,
        mes_inicio: b.mes_inicio,
        indexador: b.indexador,
        taxa_indexador_mensal: b.taxa_indexador_mensal,
        juros_mensal: b.juros_mensal,
        amortizacao: b.amortizacao,
        parcela_fixa: b.parcela_fixa,
        observacao: b.observacao,
      }))
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/propostas/${payload.id}`);
  revalidatePath("/propostas");
  return { ok: true, resultado };
}

export async function apagarProposta(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("propostas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/propostas");
  redirect("/propostas");
}

export async function duplicarProposta(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: origem } = await supabase
    .from("propostas")
    .select("*, proposta_lotes(*), proposta_blocos(*)")
    .eq("id", id)
    .single();
  if (!origem) throw new Error("Proposta não encontrada.");

  const { proposta_lotes: lotes, proposta_blocos: blocos, ...cabecalho } = origem;
  delete (cabecalho as Record<string, unknown>).id;
  delete (cabecalho as Record<string, unknown>).codigo;
  delete (cabecalho as Record<string, unknown>).criado_em;
  delete (cabecalho as Record<string, unknown>).atualizado_em;

  const { data: nova, error } = await supabase
    .from("propostas")
    .insert({
      ...cabecalho,
      status: "rascunho",
      titulo: `${origem.titulo ?? origem.codigo} (cópia)`,
      criado_por: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (lotes?.length) {
    await supabase.from("proposta_lotes").insert(
      lotes.map((l: PropostaLote) => {
        const { id: _id, proposta_id: _p, ...resto } = l;
        void _id;
        void _p;
        return { ...resto, proposta_id: nova.id };
      })
    );
  }
  if (blocos?.length) {
    await supabase.from("proposta_blocos").insert(
      blocos.map((b: PropostaBloco) => {
        const { id: _id, proposta_id: _p, ...resto } = b;
        void _id;
        void _p;
        return { ...resto, proposta_id: nova.id };
      })
    );
  }

  revalidatePath("/propostas");
  redirect(`/propostas/${nova.id}`);
}
