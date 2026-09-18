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
import { obterConfiguracoes } from "@/lib/configuracoes";
import { valorComissaoEmDinheiro } from "@/lib/comissao";
import { checarDuplicidade } from "@/lib/clientes/duplicidade";
import { comoResultado, type ResultadoAcao } from "@/lib/resultadoAcao";

/** Anexa dias a uma data, com a mesma âncora ao meio-dia que evita o dia
 * escorregar por fuso horário (ver `paraData` em `@/lib/contratos/mes`). */
function somarDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

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
/**
 * Assinatura `(estadoAnterior, formData)` de propósito: é o formato que
 * `useActionState` exige, e é o `useActionState` que faz o formulário
 * (`NovoContratoForm`) mostrar a mensagem de erro sem cair na tela genérica
 * de erro do Next — ver `comoResultado` em `@/lib/resultadoAcao`.
 */
export async function criarContrato(
  _estadoAnterior: ResultadoAcao | null,
  formData: FormData
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const empreendimentoId = String(formData.get("empreendimento_id") ?? "");
    const loteIds = formData.getAll("lote_id").map(String).filter(Boolean);
    const clienteExistente = String(formData.get("cliente_id") ?? "").trim();
    const nomeCliente = String(formData.get("cliente_nome") ?? "").trim();
    const empresaCliente = String(formData.get("cliente_empresa") ?? "").trim() || null;
    const documentoCliente = String(formData.get("cliente_documento") ?? "").trim() || null;
    const telefoneCliente = String(formData.get("cliente_telefone") ?? "").trim() || null;
    const emailCliente = String(formData.get("cliente_email") ?? "").trim() || null;

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
      const duplicidade = await checarDuplicidade(supabase, {
        nome: nomeCliente,
        documento: documentoCliente,
        telefone: telefoneCliente,
        email: emailCliente,
      });
      if (duplicidade.duplicado && duplicidade.bloqueado) {
        throw new Error(duplicidade.mensagem);
      }

      const { data: novo, error } = await supabase
        .from("clientes")
        .insert({
          nome: nomeCliente,
          empresa: empresaCliente,
          documento: documentoCliente,
          telefone: telefoneCliente,
          email: emailCliente,
          criado_por: user.id,
        })
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
  });
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
): Promise<ResultadoAcao<{ id: string }>> {
  return comoResultado(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado.");

    const { data: proposta, error } = await supabase
      .from("propostas")
      .select(
        "id, empreendimento_id, cliente_id, data_base, incc_mensal, correcao_primeira_parcela, observacoes, teste, proposta_lotes(*), proposta_cenarios(id, nome, recomendado, resultado)"
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
    const {
      dia_vencimento_padrao: diaVencimentoPadrao,
      juros_mora_padrao: jurosMoraPadrao,
      multa_atraso_padrao: multaAtrasoPadrao,
    } = await obterConfiguracoes();
    const parcelas = cronogramaDeResultado(cenario.resultado, dataBase, diaVencimentoPadrao);

    const { data: contrato, error: erroContrato } = await supabase
      .from("contratos")
      .insert({
        empreendimento_id: proposta.empreendimento_id,
        cliente_id: proposta.cliente_id,
        proposta_id: proposta.id,
        cenario_origem: cenario.nome,
        data_contrato: hojeISO(),
        data_base: dataBase,
        dia_vencimento: diaVencimentoPadrao,
        juros_mora_mensal: jurosMoraPadrao,
        multa_atraso_pct: multaAtrasoPadrao,
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
        // copia da proposta: se ela nasceu de teste, o contrato também é
        teste: proposta.teste ?? false,
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
    return { id: contrato.id as string };
  });
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
  teste: boolean;
}

export async function atualizarContrato(
  id: string,
  dados: DadosContrato
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("contratos").update(dados).eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/contratos");
    revalidatePath(`/contratos/${id}`);
    revalidatePath("/cobranca");
    return {};
  });
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
export async function definirColunasDoDocumento(
  id: string,
  colunas: string[]
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
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
    return {};
  });
}

export interface DadosComissao {
  percentual: number | null;
  valor_absoluto: number | null;
  comissao_parcelas: number;
  comissao_primeiro_pagamento_dias: number;
  comissao_intervalo_dias: number;
  forma_pagamento: string | null;
  permuta: boolean;
  permuta_descricao: string | null;
  permuta_valor_mercado: number | null;
  permuta_valor_abatido: number | null;
}

/**
 * Só admin chega até aqui de verdade — a RLS de `contrato_comissoes`
 * (migration 33) recusa a escrita de quem não é admin. A interface só evita
 * oferecer o botão a quem não é; não checamos `ehAdmin` aqui, mesmo idioma
 * de `/indices`.
 */
export async function definirComissao(
  contratoId: string,
  dados: DadosComissao
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado.");

    const { error } = await supabase.from("contrato_comissoes").upsert(
      { contrato_id: contratoId, ...dados, definido_por: user.id },
      { onConflict: "contrato_id" }
    );
    if (error) throw new Error(error.message);

    revalidatePath("/contratos");
    revalidatePath(`/contratos/${contratoId}`);
    return {};
  });
}

/**
 * (Re)gera o cronograma de pagamento da comissão a partir de
 * `comissao_parcelas`/`comissao_primeiro_pagamento_dias`/`comissao_intervalo_dias`.
 *
 * Apaga as linhas antigas e recria do zero — inclusive as já baixadas. É
 * ação explícita do admin (a tela confirma antes de chamar quando já existe
 * baixa), não algo que `definirComissao` dispara sozinho: mudar o
 * percentual depois de já ter dado baixa numa parcela não deveria apagar
 * esse histórico sem avisar.
 */
export async function gerarParcelasComissao(comissaoId: string): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const supabase = await createClient();

    const { data: comissao, error } = await supabase
      .from("contrato_comissoes")
      .select(
        "id, contrato_id, valor_absoluto, permuta, permuta_valor_abatido, comissao_parcelas, comissao_primeiro_pagamento_dias, comissao_intervalo_dias, contratos(data_contrato)"
      )
      .eq("id", comissaoId)
      .single();
    if (error) throw new Error(error.message);

    const contrato = comissao.contratos as unknown as { data_contrato: string } | null;
    const dataBase = contrato?.data_contrato ?? hojeISO();
    const total = valorComissaoEmDinheiro({
      valor_absoluto: comissao.valor_absoluto,
      permuta: comissao.permuta,
      permuta_valor_abatido: comissao.permuta_valor_abatido,
    });
    const parcelas = Math.max(comissao.comissao_parcelas ?? 1, 1);
    const valorParcela = Math.round((total / parcelas) * 100) / 100;
    // a última parcela absorve o resíduo de centavos, mesmo idioma do
    // cronograma do contrato — ver cronogramaManual em src/lib/contratos
    const residuo = Math.round((total - valorParcela * parcelas) * 100) / 100;

    await supabase.from("contrato_comissao_parcelas").delete().eq("comissao_id", comissaoId);

    const linhas = Array.from({ length: parcelas }, (_, i) => ({
      comissao_id: comissaoId,
      numero: i + 1,
      vencimento: somarDias(
        dataBase,
        (comissao.comissao_primeiro_pagamento_dias ?? 0) +
          i * (comissao.comissao_intervalo_dias ?? 30)
      ),
      valor: i === parcelas - 1 ? valorParcela + residuo : valorParcela,
    }));

    const { error: erroInsert } = await supabase
      .from("contrato_comissao_parcelas")
      .insert(linhas);
    if (erroInsert) throw new Error(erroInsert.message);

    revalidatePath(`/contratos/${comissao.contrato_id}`);
    revalidatePath("/contratos");
    return {};
  });
}

export interface BaixaComissao {
  pago_em: string;
  valor_pago: number;
}

export async function darBaixaComissaoParcela(
  parcelaId: string,
  baixa: BaixaComissao
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const supabase = await createClient();

    const { data: parcela, error: erroBusca } = await supabase
      .from("contrato_comissao_parcelas")
      .select("contrato_comissoes(contrato_id)")
      .eq("id", parcelaId)
      .single();
    if (erroBusca) throw new Error(erroBusca.message);

    const { error } = await supabase
      .from("contrato_comissao_parcelas")
      .update({ pago_em: baixa.pago_em, valor_pago: baixa.valor_pago })
      .eq("id", parcelaId);
    if (error) throw new Error(error.message);

    const contratoId = (
      parcela.contrato_comissoes as unknown as { contrato_id: string } | null
    )?.contrato_id;
    if (contratoId) revalidatePath(`/contratos/${contratoId}`);
    revalidatePath("/contratos");
    return {};
  });
}

export async function desfazerBaixaComissaoParcela(parcelaId: string): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const supabase = await createClient();

    const { data: parcela, error: erroBusca } = await supabase
      .from("contrato_comissao_parcelas")
      .select("contrato_comissoes(contrato_id)")
      .eq("id", parcelaId)
      .single();
    if (erroBusca) throw new Error(erroBusca.message);

    const { error } = await supabase
      .from("contrato_comissao_parcelas")
      .update({ pago_em: null, valor_pago: null })
      .eq("id", parcelaId);
    if (error) throw new Error(error.message);

    const contratoId = (
      parcela.contrato_comissoes as unknown as { contrato_id: string } | null
    )?.contrato_id;
    if (contratoId) revalidatePath(`/contratos/${contratoId}`);
    revalidatePath("/contratos");
    return {};
  });
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
export async function darBaixa(parcelaId: string, baixa: Baixa): Promise<ResultadoAcao> {
  return comoResultado(async () => {
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
    return {};
  });
}

export async function desfazerBaixa(parcelaId: string): Promise<ResultadoAcao> {
  return comoResultado(async () => {
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
    return {};
  });
}

export interface DadosParcela {
  vencimento: string;
  valor_original: number;
  indexada: boolean;
  rotulo: string;
  boleto_numero: string | null;
  observacao: string | null;
}

export async function atualizarParcela(
  parcelaId: string,
  dados: DadosParcela
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
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
    return {};
  });
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
export async function apagarContrato(id: string): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/contratos");
    revalidatePath("/cobranca");
    return {};
  });
}

/**
 * Apaga vários contratos de uma vez, pela seleção da listagem — o mesmo
 * padrão de `apagarPropostas` em `propostas/acoes.ts`. Chamada de dentro de
 * um try/catch no cliente (ver ContratosTabela), por isso não redireciona
 * (ver "redirect() não sobrevive a um try/catch" no CLAUDE.md). A RLS de
 * `contratos` é quem decide o que cada usuário pode apagar.
 */
export async function apagarContratos(ids: string[]): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    if (!ids.length) return {};
    const supabase = await createClient();
    const { error } = await supabase.from("contratos").delete().in("id", ids);
    if (error) throw new Error(error.message);
    revalidatePath("/contratos");
    revalidatePath("/cobranca");
    return {};
  });
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
export async function darBaixaEmLote(
  parcelaIds: string[],
  baixa: BaixaEmLote
): Promise<ResultadoAcao<{ baixadas: number }>> {
  return comoResultado(async () => {
    if (parcelaIds.length === 0) return { baixadas: 0 };

    const supabase = await createClient();

    const { data: alvos, error: erroBusca } = await supabase
      .from("contrato_parcelas")
      .select("*")
      .in("id", parcelaIds);
    if (erroBusca) throw new Error(erroBusca.message);
    if (!alvos || alvos.length === 0) return { baixadas: 0 };

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
    return { baixadas: linhas.length };
  });
}

/** Desfaz a baixa de várias parcelas — o desfazer do botão de lote. */
export async function desfazerBaixaEmLote(parcelaIds: string[]): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    if (parcelaIds.length === 0) return {};

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
    return {};
  });
}
