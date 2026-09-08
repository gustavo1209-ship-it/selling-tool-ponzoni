/**
 * Confere a correção de contrato. Roda junto com `npm run verificar`.
 *
 * A conferência que mais importa é a última: um contrato gerado de uma
 * proposta precisa reproduzir, no centavo, os valores que o simulador
 * mostrou ao cliente — quando o INCC que a projeção usou for o mesmo que a
 * série publicou. Se as duas contas divergirem, o cliente recebe um boleto
 * diferente do papel que assinou, e ninguém percebe até ele ligar.
 */
import { calcular } from "@/lib/calc";
import type { Bloco, Premissas } from "@/lib/calc/tipos";
import { calcularContrato, fatorAcumulado, encargosAtraso, type Serie } from "./correcao";
import { cronogramaDeResultado, cronogramaManual } from "./cronograma";
import { somarMeses, vencimentoNoMes } from "./mes";
import type { ParcelaBruta } from "./correcao";

let falhas = 0;

function conferir(nome: string, obtido: number, esperado: number, tolerancia = 0.02) {
  const diff = Math.abs(obtido - esperado);
  const ok = diff <= tolerancia;
  if (!ok) falhas++;
  console.log(
    `${ok ? "ok  " : "FALHA"} ${nome.padEnd(56)} obtido ${obtido
      .toFixed(5)
      .padStart(14)}  esperado ${esperado.toFixed(5).padStart(14)}  Δ ${diff.toFixed(5)}`
  );
}

function conferirTexto(nome: string, obtido: string, esperado: string) {
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome.padEnd(56)} ${obtido} / esperado ${esperado}`);
}

/** Série sintética: a mesma variação em todos os meses de um intervalo. */
function serieConstante(de: string, quantos: number, variacao: number): Serie {
  const s: Serie = new Map();
  for (let k = 0; k < quantos; k++) s.set(somarMeses(de, k), variacao);
  return s;
}

console.log("\n— Fator acumulado —");

// base jan/26, um índice de 1% ao mês lançado de dez/25 em diante
const serie = serieConstante("2025-12", 24, 0.01);

{
  // parcela de abr/26 num contrato com base em jan/26 e defasagem 1:
  // três meses decorridos, índices de jan, fev e mar
  const f = fatorAcumulado(serie, "2026-01-15", "2026-04-10", 1, null);
  conferir("3 meses a 1% (defasagem 1)", f.fator, Math.pow(1.01, 3), 1e-9);
  conferirTexto("primeira competência com defasagem 1", f.competencias[0], "2026-01");
  conferirTexto("última competência com defasagem 1", f.competencias[2], "2026-03");
}

{
  // a defasagem não muda quantos índices entram, muda quais
  const f = fatorAcumulado(serie, "2026-01-15", "2026-04-10", 0, null);
  conferir("mesmo número de índices com defasagem 0", f.competencias.length, 3, 0);
  conferirTexto("defasagem 0 anda um mês para frente", f.competencias[0], "2026-02");
}

{
  const f = fatorAcumulado(serie, "2026-01-15", "2026-01-30", 1, null);
  conferir("parcela no próprio mês da data-base não corrige", f.fator, 1, 1e-9);
}

{
  // convenção das planilhas "Propostas de Parcelamento": a 1ª parcela sai
  // sem correção, e a do mês m acumula m − 1 índices
  const f = fatorAcumulado(serie, "2026-01-15", "2026-02-10", 1, null, false);
  conferir("1ª parcela sem correção (convenção da planilha)", f.fator, 1, 1e-9);
  const g = fatorAcumulado(serie, "2026-01-15", "2026-04-10", 1, null, false);
  conferir("mês 3 com a convenção da planilha", g.fator, Math.pow(1.01, 2), 1e-9);
}

{
  // mês sem índice entra pela taxa de referência e marca a parcela
  const curta = serieConstante("2026-01", 2, 0.01);
  const f = fatorAcumulado(curta, "2026-01-15", "2026-05-10", 1, 0.005);
  conferir("mês faltante usa a taxa de projeção", f.fator, 1.01 * 1.01 * 1.005 * 1.005, 1e-9);
  conferir("conta os meses faltantes", f.faltantes.length, 2, 0);
  conferirTexto("marca como estimado", String(f.estimado), "true");
}

console.log("\n— Encargos de atraso —");

{
  const e = encargosAtraso(1000, "2026-08-10", "2026-09-09", 0.02, 0.01);
  conferir("multa de 2% sobre 1.000", e!.multa, 20);
  conferir("juros de 1% ao mês em 30 dias", e!.juros, 10);
  conferir("total com encargos", e!.total, 1030);
  conferirTexto("sem encargo antes do vencimento", String(encargosAtraso(1000, "2026-08-10", "2026-08-01", 0.02, 0.01)), "null");
}

console.log("\n— Cronograma —");

{
  // 100 mil, 20 de entrada, 12 mensais: as mensais absorvem o resíduo
  const p = cronogramaManual({
    valorTotal: 100000,
    dataBase: "2026-01-10",
    diaVencimento: 10,
    entrada: 20000,
    entradaParcelas: 1,
    qtdParcelas: 12,
    primeiroVencimentoMes: 1,
    mensaisIndexadas: true,
    reforco: null,
  });
  conferir("13 linhas (entrada + 12)", p.length, 13, 0);
  conferir("soma fecha o valor do contrato", p.reduce((s, x) => s + x.valor_original, 0), 100000, 0.001);
  conferir("mensal de 80.000 / 12", p[1].valor_original, 6666.67);
  conferirTexto("entrada não é indexada", String(p[0].indexada), "false");
  conferirTexto("entrada vence na data-base", p[0].vencimento, "2026-01-10");
  conferirTexto("1ª mensal em fev", p[1].vencimento, "2026-02-10");
}

{
  // reforço tira principal das mensais sem mudar o total — o efeito que faz
  // a parcela caber no bolso do cliente
  const p = cronogramaManual({
    valorTotal: 100000,
    dataBase: "2026-01-10",
    diaVencimento: 10,
    entrada: 20000,
    entradaParcelas: 1,
    qtdParcelas: 12,
    primeiroVencimentoMes: 1,
    mensaisIndexadas: true,
    reforco: { quantidade: 2, valor: 10000, periodicidade: 6, primeiroMes: 6 },
  });
  conferir("soma continua fechando com reforços", p.reduce((s, x) => s + x.valor_original, 0), 100000, 0.001);
  const mensais = p.filter((x) => x.tipo === "parcelas");
  conferir("mensal cai para 60.000 / 12", mensais[0].valor_original, 5000);
  conferir("2 reforços", p.filter((x) => x.tipo === "balao").length, 2, 0);
  conferir("numeração segue o vencimento", p[p.length - 1].numero, p.length, 0);
}

conferirTexto("dia 31 em fevereiro vira o último dia", vencimentoNoMes("2026-02", 31), "2026-02-28");

console.log("\n— Contrato gerado de proposta reproduz o simulador —");

{
  const premissas: Premissas = {
    incc_mensal: 0.005,
    juros_vp_mensal: 0.01,
    correcao_primeira_parcela: false,
  };

  const blocos: Bloco[] = [
    {
      id: "e", ordem: 0, rotulo: "Entrada", tipo: "entrada",
      base_percentual: 0.4, base_valor: null, absorve_residuo: false,
      qtd_parcelas: 1, mes_inicio: 0, periodicidade_meses: 1,
      indexador: "nenhum", taxa_indexador_mensal: null, juros_mensal: 0,
      amortizacao: "nenhuma", parcela_fixa: null,
    },
    {
      id: "p", ordem: 1, rotulo: "36x INCC", tipo: "parcelas",
      base_percentual: null, base_valor: null, absorve_residuo: true,
      qtd_parcelas: 36, mes_inicio: 1, periodicidade_meses: 1,
      indexador: "incc", taxa_indexador_mensal: null, juros_mensal: 0,
      amortizacao: "nenhuma", parcela_fixa: null,
    },
  ];

  const resultado = calcular({
    lotes: [
      { quadra: "C", numero: "11", area_m2: 1000, preco_tabela: 341957.94, valor_negociado: 341957.94 },
    ],
    blocos,
    premissas,
    desconto_pct: 0,
    desconto_valor: 0,
  });

  const dataBase = "2026-01-10";
  const novas = cronogramaDeResultado(resultado, dataBase, 10);

  conferir("uma linha por parcela do fluxo", novas.length, 37, 0);
  conferir(
    "o principal gravado é o nominal, sem a correção projetada",
    novas.reduce((s, p) => s + p.valor_original, 0),
    resultado.valorNegociado,
    0.05
  );

  // a série publicou exatamente o INCC que a proposta projetou
  const serieIncc = serieConstante("2025-12", 48, 0.005);
  const parcelas: ParcelaBruta[] = novas.map((p, i) => ({
    id: `p${i}`,
    numero: p.numero,
    rotulo: p.rotulo,
    tipo: p.tipo,
    indice: p.indice,
    total_no_grupo: p.total_no_grupo,
    vencimento: p.vencimento,
    valor_original: p.valor_original,
    indexada: p.indexada,
    pago_em: null,
    valor_pago: null,
    forma_pagamento: null,
    boleto_numero: null,
    observacao: null,
  }));

  const calculo = calcularContrato(
    {
      data_base: dataBase,
      indexador: "incc",
      defasagem_indice_meses: 1,
      // a mesma convenção da proposta: é isso que mantém as duas contas juntas
      corrige_primeira_parcela: premissas.correcao_primeira_parcela,
      juros_mora_mensal: 0.01,
      multa_atraso_pct: 0.02,
      valor_total: resultado.valorNegociado,
    },
    parcelas,
    serieIncc,
    null,
    // data anterior a tudo: nada vencido, para comparar valor puro
    "2026-01-01"
  );

  const doMotor = resultado.blocos.find((b) => b.bloco.id === "p")!;
  const doContrato = calculo.parcelas.filter((p) => p.indexada);

  conferir("1ª parcela igual à do simulador", doContrato[0].valorCorrigido, doMotor.primeiraParcela);
  conferir("36ª parcela igual à do simulador", doContrato[35].valorCorrigido, doMotor.ultimaParcela);
  conferir(
    "total das parcelas igual ao do simulador",
    doContrato.reduce((s, p) => s + p.valorCorrigido, 0),
    doMotor.totalNominal,
    0.4
  );
  conferir("entrada não corrige", calculo.parcelas[0].valorCorrigido, resultado.entrada, 0.05);
  conferir("resíduo zerado contra o valor do contrato", calculo.residuo, 0, 0.05);
  conferirTexto("nada estimado com a série completa", String(calculo.temEstimativa), "false");
}

console.log(
  falhas === 0
    ? "\nTodas as conferências de contrato passaram.\n"
    : `\n${falhas} conferência(s) de contrato falharam.\n`
);

if (falhas > 0) process.exit(1);
