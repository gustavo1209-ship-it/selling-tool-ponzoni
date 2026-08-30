import { arredonda, baseParaParcela, tabela } from "./amortizacao.ts";
import type {
  Bloco,
  BlocoCalculado,
  EntradaCalculo,
  Parcela,
  Premissas,
  Resultado,
} from "./tipos.ts";

export * from "./tipos.ts";
export * from "./amortizacao.ts";

/** Taxa mensal do indexador do bloco, caindo para o INCC da proposta. */
export function taxaIndexador(bloco: Bloco, premissas: Premissas): number {
  if (bloco.indexador === "nenhum") return 0;
  if (bloco.taxa_indexador_mensal !== null) return bloco.taxa_indexador_mensal;
  return premissas.incc_mensal;
}

/**
 * Fator de correção aplicado a uma parcela que vence no mês `mes`.
 * Com `correcao_primeira_parcela` desligado a 1ª parcela sai sem correção,
 * que é a convenção das planilhas de "Propostas de Parcelamento".
 */
function fatorCorrecao(taxa: number, mes: number, premissas: Premissas): number {
  if (taxa === 0) return 1;
  const expoente = Math.max(0, mes - (premissas.correcao_primeira_parcela ? 0 : 1));
  return Math.pow(1 + taxa, expoente);
}

/**
 * Resolve o principal de cada bloco. A ordem importa: primeiro os blocos com
 * base explícita, depois os que absorvem o que sobrou.
 */
function resolverBases(
  blocos: Bloco[],
  valorNegociado: number,
  premissas: Premissas
): Map<string, number> {
  const bases = new Map<string, number>();
  const residuais: Bloco[] = [];

  for (const b of blocos) {
    if (b.absorve_residuo) {
      residuais.push(b);
      continue;
    }
    if (b.base_valor !== null) {
      bases.set(b.id, b.base_valor);
    } else if (b.base_percentual !== null) {
      bases.set(b.id, valorNegociado * b.base_percentual);
    } else if (b.parcela_fixa !== null) {
      const i = b.juros_mensal + taxaIndexador(b, premissas);
      bases.set(b.id, baseParaParcela(b.amortizacao, b.parcela_fixa, b.qtd_parcelas, i));
    } else {
      bases.set(b.id, 0);
    }
  }

  if (residuais.length > 0) {
    const usado = [...bases.values()].reduce((s, v) => s + v, 0);
    const sobra = valorNegociado - usado;
    const fatia = sobra / residuais.length;
    for (const b of residuais) bases.set(b.id, fatia);
  }

  return bases;
}

function calcularBloco(
  bloco: Bloco,
  base: number,
  premissas: Premissas
): BlocoCalculado {
  const avisos: string[] = [];
  const n = Math.max(1, Math.trunc(bloco.qtd_parcelas));
  const taxaIdx = taxaIndexador(bloco, premissas);
  const comJuros = bloco.amortizacao !== "nenhuma";

  if (bloco.parcela_fixa !== null && bloco.base_valor !== null) {
    avisos.push(
      `"${bloco.rotulo}": valor do bloco e parcela fixa definidos ao mesmo tempo — o valor do bloco prevalece.`
    );
  }

  // Com sistema de amortização, o indexador entra como juro (pós-fixado):
  // a taxa efetiva é juros + indexador. Sem sistema, o indexador corrige a
  // parcela por fora, que é como as tabelas INCC da casa funcionam.
  const i = comJuros ? bloco.juros_mensal + taxaIdx : 0;
  const linhas = tabela(bloco.amortizacao, Math.max(base, 0), n, i);

  const parcelas: Parcela[] = linhas.map((l) => {
    const mes = bloco.mes_inicio + l.indice - 1;
    const fator = comJuros ? 1 : fatorCorrecao(taxaIdx, mes, premissas);
    const valor = arredonda(l.parcela * fator);
    const correcao = arredonda(valor - l.parcela);
    return {
      blocoId: bloco.id,
      rotulo: bloco.rotulo,
      mes,
      indice: l.indice,
      valor,
      amortizacao: arredonda(l.amortizacao),
      juros: arredonda(l.juros),
      correcao,
      saldo: l.saldo,
      vp: arredonda(valor / Math.pow(1 + premissas.juros_vp_mensal, mes)),
    };
  });

  const soma = (f: (p: Parcela) => number) =>
    arredonda(parcelas.reduce((s, p) => s + f(p), 0));

  return {
    bloco,
    base: arredonda(base),
    parcelas,
    totalNominal: soma((p) => p.valor),
    totalVP: soma((p) => p.vp),
    totalJuros: soma((p) => p.juros),
    totalCorrecao: soma((p) => p.correcao),
    primeiraParcela: parcelas[0]?.valor ?? 0,
    ultimaParcela: parcelas[parcelas.length - 1]?.valor ?? 0,
    avisos,
  };
}

export function calcular(entrada: EntradaCalculo): Resultado {
  const { lotes, premissas, desconto_pct, desconto_valor } = entrada;
  const blocos = [...entrada.blocos].sort((a, b) => a.ordem - b.ordem);

  const areaTotal = arredonda(lotes.reduce((s, l) => s + l.area_m2, 0));
  const valorTabela = arredonda(lotes.reduce((s, l) => s + l.preco_tabela, 0));
  const somaLotes = arredonda(lotes.reduce((s, l) => s + l.valor_negociado, 0));
  const valorNegociado = arredonda(
    Math.max(somaLotes * (1 - desconto_pct) - desconto_valor, 0)
  );
  const descontoValorTotal = arredonda(valorTabela - valorNegociado);

  const bases = resolverBases(blocos, valorNegociado, premissas);
  const calculados = blocos.map((b) =>
    calcularBloco(b, bases.get(b.id) ?? 0, premissas)
  );

  const todas = calculados.flatMap((c) => c.parcelas);
  const meses = [...new Set(todas.map((p) => p.mes))].sort((a, b) => a - b);
  const fluxo = meses.map((mes) => {
    const itens = todas.filter((p) => p.mes === mes);
    return {
      mes,
      valor: arredonda(itens.reduce((s, p) => s + p.valor, 0)),
      vp: arredonda(itens.reduce((s, p) => s + p.vp, 0)),
      itens,
    };
  });

  const alocado = arredonda(calculados.reduce((s, c) => s + c.base, 0));
  const entradaValor = arredonda(
    fluxo.filter((f) => f.mes === 0).reduce((s, f) => s + f.valor, 0)
  );
  const parcelasFuturas = fluxo.filter((f) => f.mes > 0);

  const avisos = calculados.flatMap((c) => c.avisos);
  const residuo = arredonda(valorNegociado - alocado);
  if (Math.abs(residuo) >= 0.5) {
    avisos.push(
      residuo > 0
        ? `Faltam ${residuo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} para fechar o valor negociado.`
        : `Os blocos somam ${Math.abs(residuo).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} a mais que o valor negociado.`
    );
  }

  const totalNominal = arredonda(fluxo.reduce((s, f) => s + f.valor, 0));
  const totalVP = arredonda(fluxo.reduce((s, f) => s + f.vp, 0));

  return {
    areaTotal,
    valorTabela,
    descontoPct: desconto_pct,
    descontoValor: descontoValorTotal,
    descontoEfetivoPct: valorTabela > 0 ? 1 - valorNegociado / valorTabela : 0,
    valorNegociado,
    blocos: calculados,
    fluxo,
    alocado,
    residuo,
    entrada: entradaValor,
    entradaPct: valorNegociado > 0 ? entradaValor / valorNegociado : 0,
    totalNominal,
    totalVP,
    totalJuros: arredonda(calculados.reduce((s, c) => s + c.totalJuros, 0)),
    totalCorrecao: arredonda(calculados.reduce((s, c) => s + c.totalCorrecao, 0)),
    prazoMeses: meses.length ? Math.max(...meses) : 0,
    maiorParcela: parcelasFuturas.length
      ? Math.max(...parcelasFuturas.map((f) => f.valor))
      : 0,
    precoM2Tabela: areaTotal > 0 ? arredonda(valorTabela / areaTotal) : 0,
    precoM2Negociado: areaTotal > 0 ? arredonda(valorNegociado / areaTotal) : 0,
    precoM2VP: areaTotal > 0 ? arredonda(totalVP / areaTotal) : 0,
    avisos,
  };
}
