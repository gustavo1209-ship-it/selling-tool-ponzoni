import type { Amortizacao } from "./tipos.ts";

export interface LinhaAmortizacao {
  indice: number;
  parcela: number;
  juros: number;
  amortizacao: number;
  saldo: number;
}

const cent = (v: number) => Math.round(v * 100) / 100;

/**
 * SAC — amortização constante. A parcela cai todo mês porque o juro incide
 * sobre um saldo que só diminui. É o sistema das linhas do Sicredi.
 */
export function sac(base: number, n: number, i: number): LinhaAmortizacao[] {
  const a = base / n;
  const linhas: LinhaAmortizacao[] = [];
  let saldo = base;
  for (let k = 1; k <= n; k++) {
    const juros = saldo * i;
    // a última parcela zera o saldo, absorvendo o arredondamento acumulado
    const amort = k === n ? saldo : a;
    saldo -= amort;
    linhas.push({
      indice: k,
      parcela: cent(amort + juros),
      juros: cent(juros),
      amortizacao: cent(amort),
      saldo: cent(Math.max(saldo, 0)),
    });
  }
  return linhas;
}

/** PRICE — parcela constante; a amortização é que cresce. */
export function price(base: number, n: number, i: number): LinhaAmortizacao[] {
  const parcela = i === 0 ? base / n : (base * i) / (1 - Math.pow(1 + i, -n));
  const linhas: LinhaAmortizacao[] = [];
  let saldo = base;
  for (let k = 1; k <= n; k++) {
    const juros = saldo * i;
    let amort = parcela - juros;
    if (k === n) amort = saldo;
    saldo -= amort;
    linhas.push({
      indice: k,
      parcela: cent(amort + juros),
      juros: cent(juros),
      amortizacao: cent(amort),
      saldo: cent(Math.max(saldo, 0)),
    });
  }
  return linhas;
}

/**
 * Americano — só juros durante o prazo e o principal inteiro no vencimento.
 * Útil para estruturar carência antes de um balão.
 */
export function americano(base: number, n: number, i: number): LinhaAmortizacao[] {
  const juros = base * i;
  const linhas: LinhaAmortizacao[] = [];
  for (let k = 1; k <= n; k++) {
    const ultimo = k === n;
    linhas.push({
      indice: k,
      parcela: cent(ultimo ? base + juros : juros),
      juros: cent(juros),
      amortizacao: cent(ultimo ? base : 0),
      saldo: cent(ultimo ? 0 : base),
    });
  }
  return linhas;
}

/**
 * Parcelas iguais, sem juros. A correção monetária entra fora daqui.
 *
 * A parcela fica em `base / n` sem arredondar: quem arredonda é a exibição,
 * depois de aplicado o fator de correção. Arredondar aqui e jogar a sobra na
 * última parcela afastaria o resultado das planilhas da casa em alguns
 * centavos justamente na última linha, que é a que mais se olha.
 */
export function linear(base: number, n: number): LinhaAmortizacao[] {
  const a = base / n;
  const linhas: LinhaAmortizacao[] = [];
  for (let k = 1; k <= n; k++) {
    linhas.push({
      indice: k,
      parcela: a,
      juros: 0,
      amortizacao: a,
      saldo: cent(Math.max(base - a * k, 0)),
    });
  }
  return linhas;
}

export function tabela(
  sistema: Amortizacao,
  base: number,
  n: number,
  i: number
): LinhaAmortizacao[] {
  switch (sistema) {
    case "sac":
      return sac(base, n, i);
    case "price":
      return price(base, n, i);
    case "americano":
      return americano(base, n, i);
    default:
      return linear(base, n);
  }
}

/**
 * Base que produz uma parcela de valor `parcela` — o caminho inverso,
 * usado quando o vendedor trava a prestação em vez do percentual.
 */
export function baseParaParcela(
  sistema: Amortizacao,
  parcela: number,
  n: number,
  i: number
): number {
  switch (sistema) {
    case "price":
      return i === 0 ? parcela * n : (parcela * (1 - Math.pow(1 + i, -n))) / i;
    case "sac":
      // no SAC a parcela varia; travamos a PRIMEIRA: P1 = base/n + base*i
      return parcela / (1 / n + i);
    case "americano":
      // só juros: a parcela corrente é base*i
      return i === 0 ? parcela * n : parcela / i;
    default:
      return parcela * n;
  }
}

export const arredonda = cent;
