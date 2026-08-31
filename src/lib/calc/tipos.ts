export type Amortizacao = "nenhuma" | "sac" | "price" | "americano";
export type Indexador =
  | "nenhum"
  | "incc"
  | "igpm"
  | "ipca"
  | "inpc"
  | "igpdi"
  | "cub"
  | "tr"
  | "cdi"
  | "selic";
export type BlocoTipo = "entrada" | "sinal" | "parcelas" | "balao" | "financiamento";
/** "projeto" = lote com projeto aprovado/em obra, fora da prateleira de venda. */
export type LoteStatus =
  | "livre"
  | "reservado"
  | "vendido"
  | "projeto"
  | "indisponivel";

/** Qual parcela a proposta expõe. Ver `metricas_parcela` em `propostas`. */
export type MetricaParcela = "inicial" | "media" | "final" | "maior";
export type PropostaStatus =
  | "rascunho"
  | "enviada"
  | "em_negociacao"
  | "aceita"
  | "recusada"
  | "expirada";

/**
 * Um trecho do fluxo de pagamento. A proposta é uma lista de blocos:
 * entrada, 2x de R$ 30.000, 36x corrigidas pelo INCC, 120x SAC no Sicredi…
 *
 * A base do bloco (o principal que ele quita) vem, nesta ordem:
 *   1. `absorve_residuo` — o que sobrar do valor negociado;
 *   2. `base_valor`      — valor absoluto em reais;
 *   3. `base_percentual` — fração do valor negociado;
 *   4. `parcela_fixa`    — deriva a base a partir da parcela.
 */
export interface Bloco {
  id: string;
  ordem: number;
  rotulo: string;
  tipo: BlocoTipo;
  base_percentual: number | null;
  base_valor: number | null;
  absorve_residuo: boolean;
  qtd_parcelas: number;
  /** Mês do primeiro vencimento. 0 = no ato (entrada). */
  mes_inicio: number;
  /**
   * Meses entre vencimentos: 1 mensal, 3 trimestral, 6 semestral, 12 anual.
   * É o que transforma um bloco de parcelas num bloco de reforços.
   */
  periodicidade_meses: number;
  indexador: Indexador;
  /** null significa "herda a taxa do indexador definida na proposta". */
  taxa_indexador_mensal: number | null;
  juros_mensal: number;
  amortizacao: Amortizacao;
  parcela_fixa: number | null;
  observacao?: string | null;
}

export interface Premissas {
  /** Correção monetária das parcelas indexadas (INCC ao mês). */
  incc_mensal: number;
  /** Taxa usada só para trazer o fluxo a valor presente. */
  juros_vp_mensal: number;
  /** true = a 1ª parcela já vem corrigida ((1+i)^m em vez de (1+i)^(m-1)). */
  correcao_primeira_parcela: boolean;
}

export interface Parcela {
  blocoId: string;
  rotulo: string;
  /** Mês absoluto do vencimento, contado da data-base. 0 = no ato. */
  mes: number;
  /** Posição dentro do bloco (1..n). */
  indice: number;
  valor: number;
  amortizacao: number;
  juros: number;
  /** Parcela indexada menos a parcela nominal — a parte de correção. */
  correcao: number;
  /** Saldo devedor do bloco depois deste pagamento. */
  saldo: number;
  vp: number;
}

export interface BlocoCalculado {
  bloco: Bloco;
  base: number;
  parcelas: Parcela[];
  totalNominal: number;
  totalVP: number;
  totalJuros: number;
  totalCorrecao: number;
  primeiraParcela: number;
  ultimaParcela: number;
  /** Avisos de configuração (ex.: parcela fixa ignorada no SAC). */
  avisos: string[];
}

export interface LoteResumo {
  quadra: string;
  numero: string;
  area_m2: number;
  preco_tabela: number;
  valor_negociado: number;
}

export interface EntradaCalculo {
  lotes: LoteResumo[];
  blocos: Bloco[];
  premissas: Premissas;
  desconto_pct: number;
  desconto_valor: number;
}

export interface Resultado {
  areaTotal: number;
  valorTabela: number;
  descontoPct: number;
  descontoValor: number;
  /** Desconto percentual efetivo, somando o de % e o de valor. */
  descontoEfetivoPct: number;
  valorNegociado: number;

  blocos: BlocoCalculado[];
  /** Fluxo consolidado: uma linha por mês com vencimento. */
  fluxo: { mes: number; valor: number; vp: number; itens: Parcela[] }[];

  alocado: number;
  /** valorNegociado − alocado. Diferente de zero = estrutura não fecha. */
  residuo: number;
  entrada: number;
  entradaPct: number;
  totalNominal: number;
  totalVP: number;
  totalJuros: number;
  totalCorrecao: number;
  prazoMeses: number;
  /** 1º vencimento depois do ato — a parcela com que se abre a conversa. */
  parcelaInicial: number;
  /** Média dos vencimentos; com reforço, dilui o mês de pico. */
  parcelaMedia: number;
  /** Último vencimento; em parcela corrigida é bem maior que a inicial. */
  parcelaFinal: number;
  /** Mês de maior soma — é o que o cliente precisa conseguir pagar. */
  maiorParcela: number;
  precoM2Tabela: number;
  precoM2Negociado: number;
  precoM2VP: number;
  avisos: string[];
}
