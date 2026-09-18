import type { ComissaoContrato } from "@/lib/db/tipos";
import { moeda } from "@/lib/formato";

/**
 * O que sobra em dinheiro depois da permuta abater. `valor_absoluto`
 * continua sendo o total da comissão — a permuta desconta a partir dele,
 * nunca o substitui.
 */
export function valorComissaoEmDinheiro(c: {
  valor_absoluto: number | null;
  permuta: boolean;
  permuta_valor_abatido: number | null;
}): number {
  const total = Number(c.valor_absoluto ?? 0);
  const abatido = c.permuta ? Number(c.permuta_valor_abatido ?? 0) : 0;
  return Math.max(total - abatido, 0);
}

/**
 * "À vista, no ato", "À vista, em 30 dias" ou "3x de R$ 6.666,67, a
 * primeira em 30 dias, a cada 30 dias" — descreve sozinho o cronograma da
 * comissão a partir dos três campos estruturados, sobre o valor em
 * dinheiro (já com a permuta abatida, se houver).
 */
export function descreverFormaPagamento(
  c: Pick<
    ComissaoContrato,
    | "comissao_parcelas"
    | "comissao_primeiro_pagamento_dias"
    | "comissao_intervalo_dias"
    | "valor_absoluto"
    | "permuta"
    | "permuta_valor_abatido"
  >
): string {
  const parcelas = c.comissao_parcelas ?? 1;
  const primeiroDias = c.comissao_primeiro_pagamento_dias ?? 0;
  const quando = primeiroDias === 0 ? "no ato" : `em ${primeiroDias} dias`;

  if (parcelas <= 1) return `À vista, ${quando}`;

  const valorParcela = valorComissaoEmDinheiro(c) / parcelas;
  const intervalo = c.comissao_intervalo_dias ?? 30;
  return `${parcelas}x de ${moeda(valorParcela)}, a primeira ${quando}, a cada ${intervalo} dias`;
}
