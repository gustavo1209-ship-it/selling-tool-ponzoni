"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Indexador, Resultado } from "@/lib/calc/tipos";
import {
  cronogramaDeResultado,
  cronogramaManual,
  type NovaParcela,
} from "@/lib/contratos/cronograma";
import { TODAS_AS_COLUNAS } from "@/lib/contratos/colunas";
import { calcularContrato, type ParcelaBruta } from "@/lib/contratos/correcao";
import { hojeISO } from "@/lib/contratos/mes";
import { carregarIndices, serieDe } from "@/lib/contratos/servidor";
import { compararLote } from "@/lib/ordenacao";

const texto = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

/** Aceita "1.234,56" e "1234.56" — o formulário manda o texto do campo. */
const numero = (v: FormDataEntryValue | null, padrao = 0): number => {
  const s = String(v ?? "").trim();
  if (s === "") return padrao;
  const limpo = s
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : padrao;
};

const inteiro = (v: FormDataEntryValue | null, padrao = 0) =>
  Math.trunc(numero(v, padrao));

async function inserirParcelas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contratoId: string,
  parcelas: NovaParcela[]
) {
  if (parcelas.length === 0) return;
  const { error } = await supabase.from("contrato_parcelas").insert(
    parcelas.map((p) => ({
      contrato_id: contratoId,
      numero: p.numero,
      rotulo: p.rotulo,
      tipo: p.tipo,
      indice: p.indice,
      total_no_grupo: p.total_no_grupo,
      vencimento: p.vencimento,
      valor_original: p.valor_original,
      indexada: p.indexada,
    }))
  );
  if (error) throw new Error(error.message);
}

/**
 * Cadastro de uma venda que já aconteceu.
 *
 * O caminho das vendas antigas, que nunca passaram pela ferramenta: o
 * cronograma é montado a partir do que está escrito no contrato de papel —
 * entrada, mensais, reforços — e a data-base é a que manda na correção,
 * normalmente a assinatura.
 */
export async function criarContrato(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const empreendimentoId = String(formData.get("empreendimento_id") ?? "");
  const loteIds = formData.getAll("lote_id").map(String).filter(Boolean);
  const clienteExistente = String(formData.get("cliente_id") ?? "").trim();
  const nomeCliente = String(formData.get("cliente_nome") ?? "").trim();

  if (!empreendimentoId) throw new Error("Escolha o empreendimento.");
  if (!clienteExistente && !nomeCliente) {
    throw new Error("Informe o comprador.");
  }

  const dataBase = String(formData.get("data_base") ?? "") || hojeISO();
  const dataContrato = String(formData.get("data_contrato") ?? "") || dataBase;
  const valorTotal = numero(formData.get("valor_total"));
  if (valorTotal <= 0) throw new Error("Informe o valor total do contrato.");

  const diaVencimento = Math.min(31, Math.max(1, inteiro(formData.get("dia_vencimento"), 10)));
  const indexador = (String(formData.get("indexador") ?? "incc") || "incc") as Indexador;

  const parcelas = cronogramaManual({
    valorTotal,
    dataBase,
    diaVencimento,
    entrada: numero(formData.get("entrada")),
    entradaParcelas: Math.max(1, inteiro(formData.get("entrada_parcelas"), 1)),
    qtdParcelas: Math.max(0, inteiro(formData.get("qtd_parcelas"), 0)),
    primeiroVencimentoMes: Math.max(0, inteiro(formData.get("primeiro_mes"), 1)),
    mensaisIndexadas: indexador !== "nenhum",
    reforco:
      inteiro(formData.get("reforco_qtd"), 0) > 0
        ? {
            quantidade: inteiro(formData.get("reforco_qtd"), 0),
            valor: numero(formData.get("reforco_valor")),
            periodicidade: Math.max(1, inteiro(formData.get("reforco_periodicidade"), 6)),
            primeiroMes: Math.max(1, inteiro(formData.get("reforco_primeiro_mes"), 6)),
          }
        : null,
  });

  if (parcelas.length === 0) {
    throw new Error(
      "O cronograma ficou vazio. Informe a entrada, o número de parcelas ou os reforços."
    );
  }

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

  const { data: contrato, error: erroContrato } = await supabase
    .from("contratos")
    .insert({
      empreendimento_id: empreendimentoId,
      cliente_id: clienteId,
      titulo: texto(formData.get("titulo")),
      data_contrato: dataContrato,
      data_base: dataBase,
      valor_total: valorTotal,
      indexador,
      defasagem_indice_meses: Math.max(
        0,
        inteiro(formData.get("defasagem_indice_meses"), 1)
      ),
      dia_vencimento: diaVencimento,
      corrige_primeira_parcela:
        String(formData.get("corrige_primeira_parcela") ?? "1") !== "0",
      juros_mora_mensal: numero(formData.get("juros_mora_mensal"), 1) / 100,
      multa_atraso_pct: numero(formData.get("multa_atraso_pct"), 2) / 100,
      observacoes: texto(formData.get("observacoes")),
      criado_por: user.id,
    })
    .select("id")
    .single();
  if (erroContrato) throw new Error(erroContrato.message);

  if (loteIds.length) {
    const { data: lotes } = await supabase
      .from("lotes_visiveis")
      .select("*")
      .in("id", loteIds);
    const ordenados = [...(lotes ?? [])].sort(compararLote);
    // O valor por lote é rateado pela participação no preço de tabela: o
    // contrato negocia um total, e é ele que manda. Sem preço de tabela em
    // nenhum lote, divide igual.
    const somaTabela = ordenados.reduce((s, l) => s + Number(l.preco_tabela ?? 0), 0);
    const { error } = await supabase.from("contrato_lotes").insert(
      ordenados.map((l, i) => ({
        contrato_id: contrato.id,
        lote_id: l.id,
        quadra: l.quadra,
        numero: l.numero,
        area_m2: l.area_m2,
        valor:
          somaTabela > 0
            ? Math.round(valorTotal * (Number(l.preco_tabela ?? 0) / somaTabela) * 100) / 100
            : Math.round((valorTotal / ordenados.length) * 100) / 100,
        ordem: i,
      }))
    );
    if (error) throw new Error(error.message);
  }

  await inserirParcelas(supabase, contrato.id, parcelas);

  revalidatePath("/contratos");
  redirect(`/contratos/${contrato.id}`);
}

/**
 * Gera o contrato a partir de uma proposta.
 *
 * O cronograma sai do cenário escolhido — por padrão o recomendado, que é o
 * que a proposta expõe. Os valores gravados são os NOMINAIS na data-base:
 * ver `cronogramaDeResultado`, que é onde a correção projetada é removida.
 */
export async function gerarContratoDaProposta(
  propostaId: string,
  cenarioId?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: proposta, error } = await supabase
    .from("propostas")
    .select(
      "id, empreendimento_id, cliente_id, data_base, incc_mensal, correcao_primeira_parcela, observacoes, proposta_lotes(*), proposta_cenarios(id, nome, recomendado, resultado)"
    )
    .eq("id", propostaId)
    .single();
  if (error) throw new Error(error.message);

  const { data: jaExiste } = await supabase
    .from("contratos")
    .select("id, codigo")
    .eq("proposta_id", propostaId)
    .maybeSingle();
  if (jaExiste) {
    throw new Error(
      `Esta proposta já virou o contrato ${jaExiste.codigo}. Abra o contrato para acompanhar os pagamentos.`
    );
  }

  const cenarios = (proposta.proposta_cenarios ?? []) as {
    id: string;
    nome: string;
    recomendado: boolean;
    resultado: Resultado | null;
  }[];

  const cenario =
    (cenarioId ? cenarios.find((c) => c.id === cenarioId) : null) ??
    cenarios.find((c) => c.recomendado) ??
    cenarios[0];

  if (!cenario?.resultado) {
    throw new Error(
      "A opção escolhida não tem cálculo salvo. Abra a proposta, salve e tente de novo."
    );
  }

  const dataBase = proposta.data_base ?? hojeISO();
  const parcelas = cronogramaDeResultado(cenario.resultado, dataBase, 10);

  const { data: contrato, error: erroContrato } = await supabase
    .from("contratos")
    .insert({
      empreendimento_id: proposta.empreendimento_id,
      cliente_id: proposta.cliente_id,
      proposta_id: proposta.id,
      cenario_origem: cenario.nome,
      data_contrato: hojeISO(),
      data_base: dataBase,
      // a convenção da proposta vem junto: sem isso o contrato cobraria um
      // mês de INCC a mais do que o cliente viu no papel
      corrige_primeira_parcela: proposta.correcao_primeira_parcela ?? true,
      valor_total: cenario.resultado.valorNegociado,
      // o indexador do contrato é o dos blocos que corrigem; sem nenhum
      // bloco indexado o contrato nasce sem correção, como no Florescer
      indexador: cenario.resultado.blocos.some(
        (b) => b.bloco.indexador !== "nenhum" && b.bloco.amortizacao === "nenhuma"
      )
        ? "incc"
        : "nenhum",
      observacoes: proposta.observacoes,
      criado_por: user.id,
    })
    .select("id")
    .single();
  if (erroContrato) throw new Error(erroContrato.message);

  const lotes = (proposta.proposta_lotes ?? []) as {
    lote_id: string | null;
    quadra: string;
    numero: string;
    area_m2: number;
    valor_negociado: number;
    ordem: number;
  }[];

  if (lotes.length) {
    const { error: erroLotes } = await supabase.from("contrato_lotes").insert(
      lotes.map((l, i) => ({
        contrato_id: contrato.id,
        lote_id: l.lote_id,
        quadra: l.quadra,
        numero: l.numero,
        area_m2: l.area_m2,
        valor: l.valor_negociado,
        ordem: l.ordem ?? i,
      }))
    );
    if (erroLotes) throw new Error(erroLotes.message);
  }

  await inserirParcelas(supabase, contrato.id, parcelas);

  revalidatePath("/contratos");
  revalidatePath(`/propostas/${propostaId}`);
  return { id: contrato.id };
}

export interface DadosContrato {
  titulo: string | null;
  cliente_id: string | null;
  status: string;
  data_contrato: string;
  data_base: string;
  valor_total: number;
  indexador: Indexador;
  defasagem_indice_meses: number;
  corrige_primeira_parcela: boolean;
  dia_vencimento: number;
  juros_mora_mensal: number;
  multa_atraso_pct: number;
  observacoes: string | null;
}

export async function atualizarContrato(id: string, dados: DadosContrato) {
  const supabase = await createClient();
  const { error } = await supabase.from("contratos").update(dados).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/contratos");
  revalidatePath(`/contratos/${id}`);
  revalidatePath("/cobranca");
  return { ok: true };
}

/**
 * Quais colunas do cronograma saem no demonstrativo e no XLSX.
 *
 * Fica gravado no contrato, e não escolhido na hora de imprimir, porque
 * quem entrega o documento entrega mais de uma vez: reimprimir tem de sair
 * igual ao que o cliente já recebeu.
 *
 * Lista vazia **e lista completa** são gravadas como `null` — as duas
 * significam "todas", e guardar o padrão como `null` é o que faz um contrato
 * configurado e um nunca tocado serem a mesma coisa no banco.
 */
export async function definirColunasDoDocumento(id: string, colunas: string[]) {
  const supabase = await createClient();
  const validas = colunas.filter((c) =>
    (TODAS_AS_COLUNAS as readonly string[]).includes(c)
  );
  const ehPadrao = validas.length === 0 || validas.length === TODAS_AS_COLUNAS.length;

  const { error } = await supabase
    .from("contratos")
    .update({ colunas_documento: ehPadrao ? null : validas })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/contratos/${id}`);
  revalidatePath(`/contratos/${id}/demonstrativo`);
  return { ok: true };
}

export interface Baixa {
  pago_em: string;
  valor_pago: number | null;
  forma_pagamento: string | null;
  boleto_numero: string | null;
  observacao: string | null;
}

/**
 * Registra o pagamento de uma parcela.
 *
 * `valor_pago` fica gravado porque é o único número que não se recalcula: o
 * corrigido de hoje muda quando um índice novo entra, e o que o cliente
 * pagou naquele dia não muda mais. Sem valor informado, a tela assume o
 * corrigido — o caso normal de boleto pago em dia.
 */
export async function darBaixa(parcelaId: string, baixa: Baixa) {
  const supabase = await createClient();

  const { data: parcela, error: erroBusca } = await supabase
    .from("contrato_parcelas")
    .select("contrato_id")
    .eq("id", parcelaId)
    .single();
  if (erroBusca) throw new Error(erroBusca.message);

  const { error } = await supabase
    .from("contrato_parcelas")
    .update({
      pago_em: baixa.pago_em,
      valor_pago: baixa.valor_pago,
      forma_pagamento: baixa.forma_pagamento?.trim() || null,
      boleto_numero: baixa.boleto_numero?.trim() || null,
      observacao: baixa.observacao?.trim() || null,
    })
    .eq("id", parcelaId);
  if (error) throw new Error(error.message);

  await quitarSeFechou(parcela.contrato_id);

  revalidatePath(`/contratos/${parcela.contrato_id}`);
  revalidatePath("/contratos");
  revalidatePath("/cobranca");
  return { ok: true };
}

export async function desfazerBaixa(parcelaId: string) {
  const supabase = await createClient();

  const { data: parcela, error: erroBusca } = await supabase
    .from("contrato_parcelas")
    .select("contrato_id")
    .eq("id", parcelaId)
    .single();
  if (erroBusca) throw new Error(erroBusca.message);

  const { error } = await supabase
    .from("contrato_parcelas")
    .update({ pago_em: null, valor_pago: null, forma_pagamento: null })
    .eq("id", parcelaId);
  if (error) throw new Error(error.message);

  // um contrato marcado quitado volta a ativo quando uma baixa é desfeita
  const { data: contrato } = await supabase
    .from("contratos")
    .select("status")
    .eq("id", parcela.contrato_id)
    .single();
  if (contrato?.status === "quitado") {
    await supabase
      .from("contratos")
      .update({ status: "ativo" })
      .eq("id", parcela.contrato_id);
  }

  revalidatePath(`/contratos/${parcela.contrato_id}`);
  revalidatePath("/contratos");
  revalidatePath("/cobranca");
  return { ok: true };
}

export interface DadosParcela {
  vencimento: string;
  valor_original: number;
  indexada: boolean;
  rotulo: string;
  boleto_numero: string | null;
  observacao: string | null;
}

export async function atualizarParcela(parcelaId: string, dados: DadosParcela) {
  const supabase = await createClient();

  const { data: parcela, error: erroBusca } = await supabase
    .from("contrato_parcelas")
    .select("contrato_id")
    .eq("id", parcelaId)
    .single();
  if (erroBusca) throw new Error(erroBusca.message);

  const { error } = await supabase
    .from("contrato_parcelas")
    .update({
      vencimento: dados.vencimento,
      valor_original: dados.valor_original,
      indexada: dados.indexada,
      rotulo: dados.rotulo.trim() || "Parcelas",
      boleto_numero: dados.boleto_numero?.trim() || null,
      observacao: dados.observacao?.trim() || null,
    })
    .eq("id", parcelaId);
  if (error) throw new Error(error.message);

  revalidatePath(`/contratos/${parcela.contrato_id}`);
  revalidatePath("/cobranca");
  return { ok: true };
}

/** Marca o contrato como quitado quando não sobrou parcela em aberto. */
async function quitarSeFechou(contratoId: string) {
  const supabase = await createClient();

  const { count } = await supabase
    .from("contrato_parcelas")
    .select("id", { count: "exact", head: true })
    .eq("contrato_id", contratoId)
    .is("pago_em", null);

  if (count === 0) {
    await supabase.from("contratos").update({ status: "quitado" }).eq("id", contratoId);
  }
}

/**
 * Apaga o contrato e todo o histórico de pagamento (as parcelas e os lotes
 * saem por cascade).
 *
 * **Sem `redirect()` aqui.** A tela chama esta ação dentro de um try/catch,
 * e o redirect do Next é um erro especial: o catch o engolia, a navegação
 * não acontecia e o usuário via uma mensagem de falha para uma exclusão que
 * tinha funcionado. Quem navega é o cliente, depois que a promessa resolve.
 */
export async function apagarContrato(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contratos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contratos");
  revalidatePath("/cobranca");
  return { ok: true };
}

/**
 * Apaga vários contratos de uma vez, pela seleção da listagem — o mesmo
 * padrão de `apagarPropostas` em `propostas/acoes.ts`. Chamada de dentro de
 * um try/catch no cliente (ver ContratosTabela), por isso não redireciona
 * (ver "redirect() não sobrevive a um try/catch" no CLAUDE.md). A RLS de
 * `contratos` é quem decide o que cada usuário pode apagar.
 */
export async function apagarContratos(ids: string[]) {
  if (!ids.length) return;
  const supabase = await createClient();
  const { error } = await supabase.from("contratos").delete().in("id", ids);
  if (error) throw new Error(error.message);
  revalidatePath("/contratos");
  revalidatePath("/cobranca");
}

/**
 * Como datar a baixa de um lote de parcelas.
 *
 * `no_vencimento` é o caso do contrato antigo que entra na ferramenta com
 * anos de pagamento para trás: cada parcela recebe a data do próprio
 * vencimento, e não uma data comum. Datar tudo com o dia de hoje marcaria
 * como paga hoje uma parcela quitada em 2024, e o contrato passaria a exibir
 * encargos de atraso que nunca existiram.
 */
export type ModoBaixa = "no_vencimento" | "data_unica";

export interface BaixaEmLote {
  modo: ModoBaixa;
  /** Só usada no modo `data_unica`. */
  data?: string;
  forma_pagamento: string | null;
}

/**
 * Dá baixa em várias parcelas de uma vez.
 *
 * O valor gravado é o que a parcela valia **na data do pagamento** — o
 * corrigido do vencimento, quando paga em dia, ou o corrigido com multa e
 * juros, quando a baixa é posterior. Por isso o cálculo roda uma vez por
 * data, com `hoje` fixado nela.
 *
 * A exceção é a parcela cuja correção depende de mês sem índice lançado:
 * aí o valor fica `null` em vez de gravar uma estimativa como se fosse
 * dinheiro que entrou. A tela continua mostrando o corrigido, e o número
 * certo pode ser anotado depois de o índice sair.
 */
export async function darBaixaEmLote(parcelaIds: string[], baixa: BaixaEmLote) {
  if (parcelaIds.length === 0) return { ok: true, baixadas: 0 };

  const supabase = await createClient();

  const { data: alvos, error: erroBusca } = await supabase
    .from("contrato_parcelas")
    .select("*")
    .in("id", parcelaIds);
  if (erroBusca) throw new Error(erroBusca.message);
  if (!alvos || alvos.length === 0) return { ok: true, baixadas: 0 };

  const contratoId = alvos[0].contrato_id as string;
  if (alvos.some((p) => p.contrato_id !== contratoId)) {
    throw new Error("A baixa em lote é de um contrato por vez.");
  }

  const [{ data: contrato, error: erroContrato }, { data: todas }, indices] =
    await Promise.all([
      supabase.from("contratos").select("*").eq("id", contratoId).single(),
      supabase.from("contrato_parcelas").select("*").eq("contrato_id", contratoId),
      carregarIndices(),
    ]);
  if (erroContrato) throw new Error(erroContrato.message);

  const { serie, taxa } = serieDe(indices, contrato.indexador as Indexador);
  const parametros = {
    data_base: contrato.data_base as string,
    indexador: contrato.indexador as Indexador,
    defasagem_indice_meses: contrato.defasagem_indice_meses as number,
    corrige_primeira_parcela: contrato.corrige_primeira_parcela as boolean,
    juros_mora_mensal: Number(contrato.juros_mora_mensal),
    multa_atraso_pct: Number(contrato.multa_atraso_pct),
    valor_total: Number(contrato.valor_total),
  };

  const brutas = (todas ?? []) as unknown as ParcelaBruta[];
  const escolhidas = new Set(parcelaIds);

  // uma passada de cálculo por data de pagamento: parcelas baixadas no
  // próprio vencimento têm cada uma a sua
  const porData = new Map<string, Map<string, number | null>>();
  const datas = new Set(
    alvos.map((p) =>
      baixa.modo === "no_vencimento" ? (p.vencimento as string) : baixa.data ?? hojeISO()
    )
  );
  for (const data of datas) {
    const calculo = calcularContrato(parametros, brutas, serie, taxa, data);
    porData.set(
      data,
      new Map(
        calculo.parcelas
          .filter((p) => escolhidas.has(p.id))
          .map((p) => [p.id, p.correcao.estimado ? null : p.valorACobrar])
      )
    );
  }

  const linhas = alvos.map((p) => {
    const pagoEm =
      baixa.modo === "no_vencimento"
        ? (p.vencimento as string)
        : baixa.data ?? hojeISO();
    return {
      ...p,
      pago_em: pagoEm,
      valor_pago: porData.get(pagoEm)?.get(p.id as string) ?? null,
      forma_pagamento: baixa.forma_pagamento?.trim() || (p.forma_pagamento as string | null),
    };
  });

  const { error } = await supabase.from("contrato_parcelas").upsert(linhas);
  if (error) throw new Error(error.message);

  await quitarSeFechou(contratoId);

  revalidatePath(`/contratos/${contratoId}`);
  revalidatePath("/contratos");
  revalidatePath("/cobranca");
  return { ok: true, baixadas: linhas.length };
}

/** Desfaz a baixa de várias parcelas — o desfazer do botão de lote. */
export async function desfazerBaixaEmLote(parcelaIds: string[]) {
  if (parcelaIds.length === 0) return { ok: true };

  const supabase = await createClient();

  const { data: alvos } = await supabase
    .from("contrato_parcelas")
    .select("contrato_id")
    .in("id", parcelaIds);

  const { error } = await supabase
    .from("contrato_parcelas")
    .update({ pago_em: null, valor_pago: null, forma_pagamento: null })
    .in("id", parcelaIds);
  if (error) throw new Error(error.message);

  const contratoId = alvos?.[0]?.contrato_id as string | undefined;
  if (contratoId) {
    const { data: contrato } = await supabase
      .from("contratos")
      .select("status")
      .eq("id", contratoId)
      .single();
    if (contrato?.status === "quitado") {
      await supabase.from("contratos").update({ status: "ativo" }).eq("id", contratoId);
    }
    revalidatePath(`/contratos/${contratoId}`);
  }

  revalidatePath("/contratos");
  revalidatePath("/cobranca");
  return { ok: true };
}
