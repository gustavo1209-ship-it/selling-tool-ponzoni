/**
 * Confere o motor de cálculo contra números que já existem em planilha.
 * Roda com `npm run verificar` (node --experimental-strip-types).
 *
 * As referências vêm de:
 *  - "Propostas de Parcelamento.xlsx", aba 20%+25%12xINCC+55%36xINCC
 *  - o memorando de negociação da Quadra C (escada de desconto da tabela)
 *  - a premissa SAC do deck de lançamento (slide 32)
 */
import { calcular, sac, price } from "./index";
import type { Bloco, Premissas } from "./tipos";

let falhas = 0;

function conferir(nome: string, obtido: number, esperado: number, tolerancia = 0.02) {
  const diff = Math.abs(obtido - esperado);
  const ok = diff <= tolerancia;
  if (!ok) falhas++;
  const marca = ok ? "ok  " : "FALHA";
  console.log(
    `${marca} ${nome.padEnd(52)} obtido ${obtido.toFixed(2).padStart(14)}` +
      `  esperado ${esperado.toFixed(2).padStart(14)}  Δ ${diff.toFixed(4)}`
  );
}

function bloco(p: Partial<Bloco> & { id: string; rotulo: string }): Bloco {
  return {
    ordem: 0,
    tipo: "parcelas",
    base_percentual: null,
    base_valor: null,
    absorve_residuo: false,
    qtd_parcelas: 1,
    mes_inicio: 1,
    periodicidade_meses: 1,
    indexador: "nenhum",
    taxa_indexador_mensal: null,
    juros_mensal: 0,
    amortizacao: "nenhuma",
    parcela_fixa: null,
    ...p,
  };
}

const premissas: Premissas = {
  incc_mensal: 0.005,
  juros_vp_mensal: 0.01,
  correcao_primeira_parcela: false,
};

console.log("\n— Aba 20% + 25% 12x INCC + 55% 36x INCC, terreno de R$ 250.000 —");

const r = calcular({
  lotes: [
    { quadra: "X", numero: "1", area_m2: 1000, preco_tabela: 250000, valor_negociado: 250000 },
  ],
  blocos: [
    bloco({ id: "e", rotulo: "Entrada", tipo: "entrada", base_percentual: 0.2, mes_inicio: 0 }),
    bloco({ id: "a", rotulo: "12x INCC", base_percentual: 0.25, qtd_parcelas: 12, indexador: "incc", ordem: 1 }),
    bloco({ id: "b", rotulo: "36x INCC", base_percentual: 0.55, qtd_parcelas: 36, indexador: "incc", ordem: 2 }),
  ],
  premissas,
  desconto_pct: 0,
  desconto_valor: 0,
});

const b12 = r.blocos.find((b) => b.bloco.id === "a")!;
const b36 = r.blocos.find((b) => b.bloco.id === "b")!;

conferir("entrada (20%)", r.entrada, 50000);
conferir("12x INCC — 1ª parcela", b12.primeiraParcela, 5208.33);
conferir("12x INCC — 2ª parcela", b12.parcelas[1].valor, 5234.38);
conferir("12x INCC — 12ª parcela", b12.ultimaParcela, 5502.06);
conferir("12x INCC — total nominal", b12.totalNominal, 64247.72, 0.05);
conferir("12x INCC — total a valor presente", b12.totalVP, 60223.8, 0.1);
conferir("36x INCC — 1ª parcela", b36.primeiraParcela, 3819.44);
conferir("36x INCC — 36ª parcela", b36.ultimaParcela, 4547.92);
conferir("36x INCC — total nominal", b36.totalNominal, 150242.07, 0.1);
conferir("36x INCC — total a valor presente", b36.totalVP, 124979.96, 0.2);
conferir("total nominal (entrada + parcelas)", r.totalNominal, 264489.79, 0.2);
conferir("total a valor presente", r.totalVP, 235203.76, 0.3);
conferir("resíduo (a estrutura fecha)", r.residuo, 0, 0.01);

console.log("\n— Aba IND A10 40% + 60% 36x INCC (corrige já a 1ª parcela) —");

const rInd = calcular({
  lotes: [
    { quadra: "A", numero: "10", area_m2: 921.27, preco_tabela: 357022.5552, valor_negociado: 357022.5552 },
  ],
  blocos: [
    bloco({ id: "e", rotulo: "Entrada", tipo: "entrada", base_percentual: 0.4, mes_inicio: 0 }),
    bloco({ id: "p", rotulo: "36x INCC", base_percentual: 0.6, qtd_parcelas: 36, indexador: "incc", ordem: 1 }),
  ],
  premissas: { ...premissas, correcao_primeira_parcela: true },
  desconto_pct: 0,
  desconto_valor: 0,
});
const pInd = rInd.blocos[1];
conferir("entrada (40%)", rInd.entrada, 142809.02);
conferir("36x — 1ª parcela (já corrigida)", pInd.primeiraParcela, 5980.13);
conferir("36x — 36ª parcela", pInd.ultimaParcela, 7120.7);
conferir("36x — total nominal", pInd.totalNominal, 235234.93, 0.1);

console.log("\n— Escada de desconto da tabela R n.º5 (lote A-1, preço R$ 808.264,23) —");
const precoBase = 808264.2335;
conferir("24x INCC (×0,965)", precoBase * 0.965, 779974.9853, 0.01);
conferir("12x INCC (×0,935)", precoBase * 0.935, 755727.0583, 0.01);
conferir("à vista (×0,910)", precoBase * 0.91, 735520.4525, 0.01);
conferir("6x — âncora (preço / 1,14)", precoBase / 1.14, 709003.7136, 5);

console.log("\n— SAC: identidades fechadas (saldo R$ 600.000, 120x, 1,4479% a.m.) —");
const linhas = sac(600000, 120, 0.014479);
const A = 600000 / 120;
conferir("1ª parcela = A + saldo·i", linhas[0].parcela, A + 600000 * 0.014479);
conferir("última parcela = A·(1+i)", linhas[119].parcela, A * 1.014479, 0.05);
conferir("juros totais = i·saldo·(n+1)/2", linhas.reduce((s, l) => s + l.juros, 0), 0.014479 * 600000 * 121 / 2, 1);
conferir("saldo final zera", linhas[119].saldo, 0);

console.log("\n— Price: parcela constante e saldo zerando —");
const pr = price(600000, 120, 0.014479);
const esperada = (600000 * 0.014479) / (1 - Math.pow(1.014479, -120));
conferir("parcela 1", pr[0].parcela, esperada, 0.02);
conferir("parcela 60", pr[59].parcela, esperada, 0.02);
conferir("saldo final zera", pr[119].saldo, 0);

console.log("\n— Parcela travada: 2x de R$ 30.000 e o resto absorvendo a sobra —");
const rTravado = calcular({
  lotes: [
    { quadra: "C", numero: "8", area_m2: 1780.8, preco_tabela: 621741.72, valor_negociado: 621741.72 },
  ],
  blocos: [
    bloco({ id: "e", rotulo: "Entrada", tipo: "entrada", base_valor: 200000, mes_inicio: 0 }),
    bloco({ id: "s", rotulo: "2x de 30 mil", parcela_fixa: 30000, qtd_parcelas: 2, ordem: 1 }),
    bloco({ id: "r", rotulo: "36x com o que sobrar", absorve_residuo: true, qtd_parcelas: 36, mes_inicio: 3, indexador: "incc", ordem: 2 }),
  ],
  premissas,
  desconto_pct: 0,
  desconto_valor: 0,
});
conferir("entrada travada em valor", rTravado.entrada, 200000);
conferir("bloco de parcela travada = 2 × 30.000", rTravado.blocos[1].base, 60000);
conferir("bloco residual = 621.741,72 − 260.000", rTravado.blocos[2].base, 361741.72, 0.05);
conferir("resíduo zerado", rTravado.residuo, 0, 0.01);

console.log("\n— Reforços semestrais: 20% entrada + 8 semestrais + o resto em 48x —");
const rReforco = calcular({
  lotes: [
    { quadra: "D", numero: "1", area_m2: 915.08, preco_tabela: 400000, valor_negociado: 400000 },
  ],
  blocos: [
    bloco({ id: "e", rotulo: "Entrada", tipo: "entrada", base_percentual: 0.2, mes_inicio: 0 }),
    bloco({ id: "m", rotulo: "48x", absorve_residuo: true, qtd_parcelas: 48, ordem: 1 }),
    bloco({
      id: "r", rotulo: "8 reforços semestrais", tipo: "balao",
      base_percentual: 0.32, qtd_parcelas: 8, mes_inicio: 6,
      periodicidade_meses: 6, ordem: 2,
    }),
  ],
  premissas,
  desconto_pct: 0,
  desconto_valor: 0,
});
const mensais = rReforco.blocos[1];
const reforcos = rReforco.blocos[2];
conferir("entrada 20%", rReforco.entrada, 80000);
conferir("reforços somam 32% do valor", reforcos.base, 128000);
conferir("cada reforço = 128.000 / 8", reforcos.primeiraParcela, 16000);
conferir("mensais ficam com o resíduo (48%)", mensais.base, 192000);
conferir("mensal = 192.000 / 48", mensais.primeiraParcela, 4000);
conferir("1º reforço vence no mês 6", reforcos.parcelas[0].mes, 6);
conferir("8º reforço vence no mês 48", reforcos.parcelas[7].mes, 48);
conferir("prazo total 48 meses", rReforco.prazoMeses, 48);
conferir("resíduo zerado", rReforco.residuo, 0, 0.01);
// o mês 6 acumula mensal + reforço; é o que faz a mensal parecer menor
conferir(
  "no mês de reforço o cliente paga mensal + reforço",
  rReforco.fluxo.find((f) => f.mes === 6)!.valor,
  20000
);

console.log(
  falhas === 0
    ? "\nTodas as conferências passaram.\n"
    : `\n${falhas} conferência(s) falharam.\n`
);

if (falhas > 0) process.exit(1);
