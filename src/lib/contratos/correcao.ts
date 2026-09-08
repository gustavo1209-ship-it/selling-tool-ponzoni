import type { Indexador } from "@/lib/calc/tipos";
import {
  competencia,
  diasEntre,
  hojeISO,
  mesesEntre,
  somarMeses,
} from "./mes";
import type {
  ContratoCalculado,
  EncargosAtraso,
  FatorAcumulado,
  IndiceMensal,
  ParcelaCalculada,
  SituacaoParcela,
} from "./tipos";

const cent = (v: number) => Math.round(v * 100) / 100;

/** Série de um índice indexada por competência ("2026-09" → 0.0085). */
export type Serie = Map<string, number>;

/** Agrupa as linhas do banco por indexador, prontas para consulta. */
export function montarSeries(linhas: IndiceMensal[]): Map<Indexador, Serie> {
  const series = new Map<Indexador, Serie>();
  for (const l of linhas) {
    const comp = competencia(l.competencia);
    const serie = series.get(l.indexador) ?? new Map<string, number>();
    serie.set(comp, Number(l.variacao));
    series.set(l.indexador, serie);
  }
  return series;
}

/**
 * Fator de correção de uma parcela que vence em `vencimento`, num contrato
 * com data-base `dataBase`.
 *
 * A conta é a do contrato de loteamento: acumula um índice por mês
 * decorrido desde a data-base. A defasagem não muda QUANTOS índices entram
 * — muda QUAIS. Com defasagem 1, a parcela do mês M usa os índices de
 * (base − 1 + 1) até (M − 1), que é o mesmo número de meses, só que todos
 * já publicados quando o boleto é emitido. É por isso que a defasagem
 * existe: o INCC-M de outubro sai no fim de outubro, e o boleto que vence
 * no dia 10 precisa ter saído antes.
 *
 * `corrigePrimeira` é a mesma convenção de `propostas.correcao_primeira_parcela`
 * e precisa ser a mesma no contrato: desligada, a parcela do mês M acumula
 * M − 1 índices, que é o fator (1+i)^(m−1) das planilhas "Propostas de
 * Parcelamento". Sem esse alinhamento, um contrato gerado de uma proposta
 * cobraria um mês de INCC a mais do que foi vendido.
 *
 * Competência sem índice lançado entra pela taxa de referência do índice e
 * o resultado sai marcado `estimado` — número de projeção, que a tela
 * mostra em cinza e o relatório de cobrança recusa como valor de boleto.
 */
export function fatorAcumulado(
  serie: Serie | undefined,
  dataBase: string,
  vencimento: string,
  defasagemMeses: number,
  taxaFallback: number | null,
  corrigePrimeira = true
): FatorAcumulado {
  const base = competencia(dataBase);
  const venc = competencia(vencimento);
  const meses = mesesEntre(base, venc) - (corrigePrimeira ? 0 : 1);

  if (meses <= 0) {
    return { fator: 1, competencias: [], aplicados: [], faltantes: [], estimado: false };
  }

  // primeira competência = base − defasagem + 1; são `meses` competências
  const inicio = somarMeses(base, 1 - defasagemMeses);
  const competencias = Array.from({ length: meses }, (_, k) => somarMeses(inicio, k));

  let fator = 1;
  const faltantes: string[] = [];
  const aplicados: FatorAcumulado["aplicados"] = [];
  for (const comp of competencias) {
    const v = serie?.get(comp);
    if (v === undefined) {
      faltantes.push(comp);
      const estimada = taxaFallback ?? 0;
      fator *= 1 + estimada;
      aplicados.push({ competencia: comp, variacao: estimada, estimado: true });
    } else {
      fator *= 1 + v;
      aplicados.push({ competencia: comp, variacao: v, estimado: false });
    }
  }

  return { fator, competencias, aplicados, faltantes, estimado: faltantes.length > 0 };
}

/**
 * Multa e juros de mora sobre uma parcela vencida.
 *
 * Multa é percentual fixo sobre o corrigido; o juro de mora corre pro rata
 * die a partir do dia seguinte ao vencimento, na convenção de 30 dias que
 * o contrato usa. Enquanto a parcela está em dia, não há encargo nenhum —
 * a função devolve `null` e o valor a cobrar é o corrigido puro.
 */
export function encargosAtraso(
  valorCorrigido: number,
  vencimento: string,
  hoje: string,
  multaPct: number,
  jurosMoraMensal: number
): EncargosAtraso | null {
  const dias = diasEntre(vencimento, hoje);
  if (dias <= 0) return null;

  const multa = cent(valorCorrigido * multaPct);
  const juros = cent(valorCorrigido * jurosMoraMensal * (dias / 30));
  return { diasAtraso: dias, multa, juros, total: cent(valorCorrigido + multa + juros) };
}

function situacaoDe(
  pagoEm: string | null,
  vencimento: string,
  hoje: string
): SituacaoParcela {
  if (pagoEm) return "paga";
  const dias = diasEntre(vencimento, hoje);
  if (dias > 0) return "vencida";
  if (dias === 0) return "vence_hoje";
  return "a_vencer";
}

export interface ParametrosContrato {
  data_base: string;
  indexador: Indexador;
  defasagem_indice_meses: number;
  /** Mesma convenção de `propostas.correcao_primeira_parcela`. */
  corrige_primeira_parcela: boolean;
  juros_mora_mensal: number;
  multa_atraso_pct: number;
  valor_total: number;
}

/** Só o que a conta precisa de uma linha de `contrato_parcelas`. */
export interface ParcelaBruta {
  id: string;
  numero: number;
  rotulo: string;
  tipo: ParcelaCalculada["tipo"];
  indice: number;
  total_no_grupo: number;
  vencimento: string;
  valor_original: number | string;
  indexada: boolean;
  pago_em: string | null;
  valor_pago: number | string | null;
  forma_pagamento: string | null;
  boleto_numero: string | null;
  observacao: string | null;
}

/**
 * Calcula o cronograma inteiro: correção de cada parcela, encargos do que
 * está vencido, saldo devedor de hoje.
 *
 * Função pura, como o motor de proposta — roda no servidor (listagens,
 * XLSX), no cliente (a tela do contrato) e na folha do demonstrativo.
 */
export function calcularContrato(
  contrato: ParametrosContrato,
  parcelas: ParcelaBruta[],
  serie: Serie | undefined,
  taxaFallback: number | null,
  hoje: string = hojeISO()
): ContratoCalculado {
  const calculadas: ParcelaCalculada[] = [...parcelas]
    .sort((a, b) => a.numero - b.numero)
    .map((p) => {
      const original = Number(p.valor_original);
      const correcao =
        p.indexada && contrato.indexador !== "nenhum"
          ? fatorAcumulado(
              serie,
              contrato.data_base,
              p.vencimento,
              contrato.defasagem_indice_meses,
              taxaFallback,
              contrato.corrige_primeira_parcela
            )
          : { fator: 1, competencias: [], aplicados: [], faltantes: [], estimado: false };

      const valorCorrigido = cent(original * correcao.fator);
      const situacao = situacaoDe(p.pago_em, p.vencimento, hoje);
      const encargos =
        situacao === "vencida"
          ? encargosAtraso(
              valorCorrigido,
              p.vencimento,
              hoje,
              contrato.multa_atraso_pct,
              contrato.juros_mora_mensal
            )
          : null;

      return {
        id: p.id,
        numero: p.numero,
        rotulo: p.rotulo,
        tipo: p.tipo,
        indice: p.indice,
        total_no_grupo: p.total_no_grupo,
        vencimento: p.vencimento,
        valor_original: original,
        indexada: p.indexada,
        pago_em: p.pago_em,
        valor_pago: p.valor_pago === null ? null : Number(p.valor_pago),
        forma_pagamento: p.forma_pagamento,
        boleto_numero: p.boleto_numero,
        observacao: p.observacao,
        correcao,
        valorCorrigido,
        valorCorrecao: cent(valorCorrigido - original),
        situacao,
        encargos,
        valorACobrar: encargos ? encargos.total : valorCorrigido,
      };
    });

  const emAberto = calculadas.filter((p) => p.situacao !== "paga");
  const vencidas = calculadas.filter((p) => p.situacao === "vencida");
  const soma = (xs: number[]) => cent(xs.reduce((s, v) => s + v, 0));

  const totalOriginal = soma(calculadas.map((p) => p.valor_original));
  const saldoOriginal = soma(emAberto.map((p) => p.valor_original));
  const saldoCorrigido = soma(emAberto.map((p) => p.valorCorrigido));

  return {
    parcelas: calculadas,
    totalOriginal,
    // o que entrou no caixa é o que foi pago de fato; sem valor anotado,
    // vale o corrigido do dia do vencimento
    totalPago: soma(
      calculadas
        .filter((p) => p.situacao === "paga")
        .map((p) => p.valor_pago ?? p.valorCorrigido)
    ),
    saldoOriginal,
    saldoCorrigido,
    totalCorrecao: cent(saldoCorrigido - saldoOriginal),
    parcelasPagas: calculadas.length - emAberto.length,
    parcelasTotal: calculadas.length,
    vencidas,
    totalVencido: soma(vencidas.map((p) => p.valorACobrar)),
    proxima: emAberto.find((p) => p.situacao !== "vencida") ?? null,
    temEstimativa: emAberto.some((p) => p.correcao.estimado),
    residuo: cent(Number(contrato.valor_total) - totalOriginal),
  };
}
