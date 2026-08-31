"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcular } from "@/lib/calc";
import type { Bloco, Resultado } from "@/lib/calc/tipos";
import type {
  BlocoTemplate,
  PropostaBloco,
  PropostaCenario,
  PropostaLote,
} from "@/lib/db/tipos";
import { compararLote } from "@/lib/ordenacao";
import type { DadosCliente } from "@/app/clientes/acoes";

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

function linhasDeBloco(cenarioId: string, template: BlocoTemplate[]) {
  return (template.length ? template : TEMPLATE_PADRAO).map((b, i) => ({
    cenario_id: cenarioId,
    ordem: i,
    rotulo: b.rotulo,
    tipo: b.tipo,
    base_percentual: b.base_percentual ?? null,
    base_valor: b.base_valor ?? null,
    absorve_residuo: b.absorve_residuo ?? false,
    qtd_parcelas: b.qtd_parcelas,
    mes_inicio: b.mes_inicio,
    periodicidade_meses: b.periodicidade_meses ?? 1,
    indexador: b.indexador,
    taxa_indexador_mensal: b.taxa_indexador_mensal ?? null,
    juros_mensal: b.juros_mensal,
    amortizacao: b.amortizacao,
    parcela_fixa: b.parcela_fixa ?? null,
    observacao: b.observacao ?? null,
  }));
}

export async function criarProposta(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const empreendimentoId = String(formData.get("empreendimento_id") ?? "");
  const condicaoIds = formData.getAll("condicao_id").map(String).filter(Boolean);
  const loteIds = formData.getAll("lote_id").map(String).filter(Boolean);
  const nomeCliente = String(formData.get("cliente_nome") ?? "").trim();
  const clienteExistente = String(formData.get("cliente_id") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim() || null;

  if (!empreendimentoId || loteIds.length === 0) {
    throw new Error("Escolha o empreendimento e ao menos um lote.");
  }

  const [{ data: lotes }, { data: condicoes }, { data: tabela }] = await Promise.all([
    supabase.from("lotes").select("*").in("id", loteIds),
    condicaoIds.length
      ? supabase.from("condicoes_pagamento").select("*").in("id", condicaoIds)
      : Promise.resolve({ data: [] }),
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

  const { data: proposta, error: erroProposta } = await supabase
    .from("propostas")
    .insert({
      empreendimento_id: empreendimentoId,
      cliente_id: clienteId,
      tabela_preco_id: tabela?.id ?? null,
      titulo,
      incc_mensal: tabela?.incc_mensal ?? 0.005,
      juros_vp_mensal: tabela?.juros_vp_mensal ?? 0.01,
      criado_por: user.id,
    })
    .select("id")
    .single();
  if (erroProposta) throw new Error(erroProposta.message);

  const ordenados = [...lotes].sort(compararLote);
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

  // Uma opção de parcelamento por condição escolhida, na ordem em que foram
  // marcadas na tela — é a ordem das abas e a ordem em que saem no PDF, e o
  // vendedor pode rearrumar depois no simulador.
  const escolhidas = condicaoIds
    .map((id) => (condicoes ?? []).find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const aCriar = escolhidas.length
    ? escolhidas.map((c, i) => ({
        proposta_id: proposta.id,
        ordem: i,
        nome: c.nome,
        condicao_origem: c.nome,
        desconto_pct: Number(c.desconto_pct),
        recomendado: i === 0,
        template: (c.template as BlocoTemplate[] | null) ?? TEMPLATE_PADRAO,
      }))
    : [
        {
          proposta_id: proposta.id,
          ordem: 0,
          nome: "Opção A",
          condicao_origem: null,
          desconto_pct: 0,
          recomendado: true,
          template: TEMPLATE_PADRAO,
        },
      ];

  const { data: cenarios, error: erroCenarios } = await supabase
    .from("proposta_cenarios")
    .insert(
      aCriar.map((c) => ({
        proposta_id: c.proposta_id,
        ordem: c.ordem,
        nome: c.nome,
        condicao_origem: c.condicao_origem,
        desconto_pct: c.desconto_pct,
        recomendado: c.recomendado,
      }))
    )
    .select("id, ordem");
  if (erroCenarios) throw new Error(erroCenarios.message);

  const blocos = (cenarios ?? []).flatMap((c) => {
    const origem = aCriar.find((x) => x.ordem === c.ordem);
    return linhasDeBloco(c.id, origem?.template ?? TEMPLATE_PADRAO);
  });

  const { error: erroBlocos } = await supabase.from("proposta_blocos").insert(blocos);
  if (erroBlocos) throw new Error(erroBlocos.message);

  revalidatePath("/propostas");
  redirect(`/propostas/${proposta.id}`);
}

export interface CenarioPayload extends PropostaCenario {
  blocos: PropostaBloco[];
}

export interface PayloadSalvar {
  id: string;
  titulo: string | null;
  cliente_id: string | null;
  /** Dados do cliente, editáveis de dentro da proposta. */
  cliente: DadosCliente | null;
  /** true = `cliente` é um cadastro novo, a ser criado ao salvar. */
  criar_cliente: boolean;
  status: string;
  data_base: string;
  validade_dias: number;
  incc_mensal: number;
  juros_vp_mensal: number;
  correcao_primeira_parcela: boolean;
  observacoes: string | null;
  lotes: PropostaLote[];
  cenarios: CenarioPayload[];
}

/**
 * Grava a proposta inteira: cabeçalho, lotes, cenários e blocos, com o
 * snapshot do cálculo de cada cenário. Cenários e blocos são reescritos do
 * zero — a lista é pequena e assim não sobra órfão de linha removida na tela.
 */
export async function salvarProposta(payload: PayloadSalvar) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const premissas = {
    incc_mensal: payload.incc_mensal,
    juros_vp_mensal: payload.juros_vp_mensal,
    correcao_primeira_parcela: payload.correcao_primeira_parcela,
  };

  const lotes = payload.lotes.map((l) => ({
    quadra: l.quadra,
    numero: l.numero,
    area_m2: Number(l.area_m2),
    preco_tabela: Number(l.preco_tabela),
    valor_negociado: Number(l.valor_negociado),
  }));

  const resultados = new Map<string, Resultado>();
  for (const c of payload.cenarios) {
    resultados.set(
      c.id,
      calcular({
        lotes,
        blocos: c.blocos as unknown as Bloco[],
        premissas,
        desconto_pct: Number(c.desconto_pct),
        desconto_valor: Number(c.desconto_valor),
      })
    );
  }

  const recomendado =
    payload.cenarios.find((c) => c.recomendado) ?? payload.cenarios[0];

  // o cliente é gravado antes: se o nome mudou, a listagem já reflete
  let clienteId = payload.cliente_id;

  if (payload.cliente) {
    const nome = payload.cliente.nome.trim();
    if (!nome) throw new Error("O nome do cliente não pode ficar vazio.");
    const campos = {
      nome,
      empresa: payload.cliente.empresa?.trim() || null,
      documento: payload.cliente.documento?.trim() || null,
      email: payload.cliente.email?.trim() || null,
      telefone: payload.cliente.telefone?.trim() || null,
      observacao: payload.cliente.observacao?.trim() || null,
    };

    if (payload.criar_cliente) {
      const { data: novo, error } = await supabase
        .from("clientes")
        .insert({ ...campos, criado_por: user.id })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      clienteId = novo.id;
    } else if (clienteId) {
      const { error } = await supabase
        .from("clientes")
        .update(campos)
        .eq("id", clienteId);
      if (error) throw new Error(error.message);
    }
  }

  const { error: erroCabecalho } = await supabase
    .from("propostas")
    .update({
      titulo: payload.titulo,
      cliente_id: clienteId,
      status: payload.status,
      data_base: payload.data_base,
      validade_dias: payload.validade_dias,
      incc_mensal: payload.incc_mensal,
      juros_vp_mensal: payload.juros_vp_mensal,
      correcao_primeira_parcela: payload.correcao_primeira_parcela,
      observacoes: payload.observacoes,
      resultado: recomendado ? resultados.get(recomendado.id) : null,
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

  // apagar o cenário leva os blocos junto (cascade)
  await supabase.from("proposta_cenarios").delete().eq("proposta_id", payload.id);

  for (const [i, c] of payload.cenarios.entries()) {
    const { data: novo, error } = await supabase
      .from("proposta_cenarios")
      .insert({
        proposta_id: payload.id,
        ordem: i,
        nome: c.nome,
        condicao_origem: c.condicao_origem,
        desconto_pct: c.desconto_pct,
        desconto_valor: c.desconto_valor,
        desconto_motivo: c.desconto_motivo,
        recomendado: c.recomendado,
        resultado: resultados.get(c.id) ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (c.blocos.length) {
      const { error: erroBlocos } = await supabase.from("proposta_blocos").insert(
        c.blocos.map((b, k) => ({
          cenario_id: novo.id,
          ordem: k,
          rotulo: b.rotulo,
          tipo: b.tipo,
          base_percentual: b.base_percentual,
          base_valor: b.base_valor,
          absorve_residuo: b.absorve_residuo,
          qtd_parcelas: b.qtd_parcelas,
          mes_inicio: b.mes_inicio,
          periodicidade_meses: b.periodicidade_meses,
          indexador: b.indexador,
          taxa_indexador_mensal: b.taxa_indexador_mensal,
          juros_mensal: b.juros_mensal,
          amortizacao: b.amortizacao,
          parcela_fixa: b.parcela_fixa,
          observacao: b.observacao,
        }))
      );
      if (erroBlocos) throw new Error(erroBlocos.message);
    }
  }

  revalidatePath(`/propostas/${payload.id}`);
  revalidatePath("/propostas");
  revalidatePath("/clientes");
  return { ok: true, cliente_id: clienteId };
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
    .select("*, proposta_lotes(*), proposta_cenarios(*, proposta_blocos(*))")
    .eq("id", id)
    .single();
  if (!origem) throw new Error("Proposta não encontrada.");

  const {
    proposta_lotes: lotes,
    proposta_cenarios: cenarios,
    ...cabecalho
  } = origem;
  for (const campo of ["id", "codigo", "criado_em", "atualizado_em"]) {
    delete (cabecalho as Record<string, unknown>)[campo];
  }

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

  for (const c of (cenarios ?? []) as (PropostaCenario & {
    proposta_blocos: PropostaBloco[];
  })[]) {
    const { id: _id, proposta_id: _p, proposta_blocos: blocos, ...resto } = c;
    void _id;
    void _p;
    const { data: novoCenario } = await supabase
      .from("proposta_cenarios")
      .insert({ ...resto, proposta_id: nova.id })
      .select("id")
      .single();
    if (novoCenario && blocos?.length) {
      await supabase.from("proposta_blocos").insert(
        blocos.map((b) => {
          const { id: _bid, cenario_id: _c, ...restoBloco } = b;
          void _bid;
          void _c;
          return { ...restoBloco, cenario_id: novoCenario.id };
        })
      );
    }
  }

  revalidatePath("/propostas");
  redirect(`/propostas/${nova.id}`);
}
