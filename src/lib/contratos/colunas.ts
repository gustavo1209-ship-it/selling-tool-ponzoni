/**
 * Quais colunas do cronograma saem no documento do contrato.
 *
 * O catálogo é um só e vale para as duas saídas — o demonstrativo em PDF e o
 * XLSX —, porque a escolha é sobre o que o cliente vai ver, não sobre o
 * formato. Cada coluna declara onde sabe se desenhar: `encargos` e
 * `a_cobrar` só fazem sentido na planilha, e a folha as ignora.
 *
 * `contratos.colunas_documento` guarda a escolha. **`null` é "todas"**, que é
 * o comportamento de sempre: contrato antigo, ou contrato que ninguém
 * configurou, sai exatamente como saía.
 */

export type ChaveColuna =
  | "numero"
  | "rotulo"
  | "grupo"
  | "vencimento"
  | "valor_original"
  | "correcao_de"
  | "fator"
  | "valor_corrigido"
  | "encargos"
  | "a_cobrar"
  | "situacao"
  | "pago_em"
  | "valor_pago"
  | "forma"
  | "boleto";

export interface ColunaDoc {
  chave: ChaveColuna;
  rotulo: string;
  /** O que ela é, para a tela de configuração explicar sem manual. */
  ajuda: string;
  /** Sai no demonstrativo em PDF. */
  pdf: boolean;
  /** Sai no XLSX. */
  xlsx: boolean;
  /** Só faz sentido em contrato com indexador — some quando não há. */
  soComCorrecao?: boolean;
}

export const COLUNAS_DOC: ColunaDoc[] = [
  { chave: "numero", rotulo: "#", ajuda: "Número sequencial da parcela.", pdf: true, xlsx: true },
  { chave: "rotulo", rotulo: "Parcela", ajuda: "O nome do grupo: entrada, mensais, reforço.", pdf: true, xlsx: true },
  { chave: "grupo", rotulo: "Posição no grupo", ajuda: '"3/36" — em que ponto da série a parcela está.', pdf: true, xlsx: true },
  { chave: "vencimento", rotulo: "Vencimento", ajuda: "Data de vencimento da parcela.", pdf: true, xlsx: true },
  {
    chave: "valor_original",
    rotulo: "Valor de origem",
    ajuda: "O valor na data-base, antes da correção. É a coluna que gera a ligação do cliente perguntando qual dos dois números vale.",
    pdf: true,
    xlsx: true,
  },
  {
    chave: "correcao_de",
    rotulo: "Correção de",
    ajuda: "Quais competências do índice entraram na parcela.",
    pdf: false,
    xlsx: true,
    soComCorrecao: true,
  },
  {
    chave: "fator",
    rotulo: "Fator",
    ajuda: "O índice acumulado aplicado sobre o valor de origem.",
    pdf: true,
    xlsx: true,
    soComCorrecao: true,
  },
  { chave: "valor_corrigido", rotulo: "Valor corrigido", ajuda: "O que a parcela vale hoje. É o número que o cliente paga.", pdf: true, xlsx: true },
  { chave: "encargos", rotulo: "Encargos", ajuda: "Multa e juros de mora das parcelas vencidas.", pdf: false, xlsx: true },
  { chave: "a_cobrar", rotulo: "A cobrar", ajuda: "Corrigido mais encargos, para as parcelas em aberto.", pdf: false, xlsx: true },
  { chave: "situacao", rotulo: "Situação", ajuda: "Paga, a vencer, vence hoje ou vencida.", pdf: true, xlsx: true },
  { chave: "pago_em", rotulo: "Pago em", ajuda: "Data da baixa.", pdf: true, xlsx: true },
  { chave: "valor_pago", rotulo: "Valor pago", ajuda: "Quanto entrou de fato, quando difere do corrigido.", pdf: false, xlsx: true },
  { chave: "forma", rotulo: "Forma", ajuda: "Como o cliente pagou.", pdf: false, xlsx: true },
  { chave: "boleto", rotulo: "Nº do boleto", ajuda: "Identificação do boleto emitido.", pdf: false, xlsx: true },
];

/** Todas as chaves — o padrão de quem nunca configurou nada. */
export const TODAS_AS_COLUNAS = COLUNAS_DOC.map((c) => c.chave);

/**
 * Resolve o que gravado no contrato significa para uma saída.
 *
 * Duas guardas que importam: `null` vira "todas", e uma lista que zerou
 * (alguém desmarcou tudo e salvou) também — um cronograma sem coluna
 * nenhuma não é documento, é uma folha em branco.
 */
export function colunasAtivas(
  escolhidas: string[] | null | undefined,
  saida: "pdf" | "xlsx",
  temCorrecao: boolean
): Set<ChaveColuna> {
  const base = escolhidas?.length ? new Set(escolhidas) : new Set<string>(TODAS_AS_COLUNAS);
  return new Set(
    COLUNAS_DOC.filter(
      (c) =>
        c[saida] &&
        base.has(c.chave) &&
        (temCorrecao || !c.soComCorrecao)
    ).map((c) => c.chave)
  );
}
