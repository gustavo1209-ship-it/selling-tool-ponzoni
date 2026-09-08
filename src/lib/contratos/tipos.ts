import type { BlocoTipo, Indexador } from "@/lib/calc/tipos";

export type ContratoStatus = "ativo" | "quitado" | "distratado" | "suspenso";

/** Onde a parcela está hoje. Derivada de `pago_em` e do vencimento. */
export type SituacaoParcela = "paga" | "a_vencer" | "vence_hoje" | "vencida";

/** Uma linha da série histórica: a variação de um índice num mês. */
export interface IndiceMensal {
  id: string;
  indexador: Indexador;
  /** Sempre o dia 1 do mês, como o banco grava. */
  competencia: string;
  /** Fração: 0.0085 = 0,85% no mês. Pode ser negativa. */
  variacao: number;
  fonte: string | null;
  observacao: string | null;
  criado_por: string | null;
  criado_em: string;
}

/**
 * O resultado de acumular a série entre duas datas.
 *
 * `estimado` é a informação que decide se o número pode virar boleto: com
 * ele ligado, alguma competência do caminho não tem índice lançado e entrou
 * pela taxa de referência — projeção, não cobrança.
 */
export interface FatorAcumulado {
  fator: number;
  /** Competências que entraram na conta, na ordem. */
  competencias: string[];
  /**
   * Cada índice que entrou, com o número usado. É o que permite mostrar de
   * onde o fator veio — um "1,01475" sozinho não deixa ver que o INCC de
   * agosto está lá dentro, e é essa a primeira dúvida de quem confere o
   * boleto contra o comunicado da FGV.
   */
  aplicados: { competencia: string; variacao: number; estimado: boolean }[];
  /** As que não tinham índice lançado e entraram estimadas. */
  faltantes: string[];
  estimado: boolean;
}

export interface EncargosAtraso {
  diasAtraso: number;
  multa: number;
  juros: number;
  /** Corrigido + multa + juros. */
  total: number;
}

/** Uma parcela do cronograma com tudo que a tela e o boleto precisam. */
export interface ParcelaCalculada {
  id: string;
  numero: number;
  rotulo: string;
  tipo: BlocoTipo;
  indice: number;
  total_no_grupo: number;
  vencimento: string;
  valor_original: number;
  indexada: boolean;
  pago_em: string | null;
  valor_pago: number | null;
  forma_pagamento: string | null;
  boleto_numero: string | null;
  observacao: string | null;

  /** Fator do índice acumulado entre a data-base e este vencimento. */
  correcao: FatorAcumulado;
  /** `valor_original` × fator. É o valor do boleto quando em dia. */
  valorCorrigido: number;
  /** valorCorrigido − valor_original. */
  valorCorrecao: number;
  situacao: SituacaoParcela;
  encargos: EncargosAtraso | null;
  /** O que cobrar hoje: corrigido, mais encargos se estiver vencida. */
  valorACobrar: number;
}

/** O contrato com o cronograma já calculado — o que as telas consomem. */
export interface ContratoCalculado {
  parcelas: ParcelaCalculada[];
  /** Soma dos `valor_original`. Confere contra `contratos.valor_total`. */
  totalOriginal: number;
  totalPago: number;
  /** Original das parcelas ainda em aberto, sem correção. */
  saldoOriginal: number;
  /** Corrigido das parcelas em aberto — o saldo devedor de hoje. */
  saldoCorrigido: number;
  /** Correção embutida no que ainda vai vencer. */
  totalCorrecao: number;
  parcelasPagas: number;
  parcelasTotal: number;
  vencidas: ParcelaCalculada[];
  /** Soma do que cobrar nas vencidas, já com multa e juros. */
  totalVencido: number;
  proxima: ParcelaCalculada | null;
  /** true se alguma parcela em aberto dependeu de índice estimado. */
  temEstimativa: boolean;
  /** Diferença entre a soma das parcelas e `valor_total`, se houver. */
  residuo: number;
}
