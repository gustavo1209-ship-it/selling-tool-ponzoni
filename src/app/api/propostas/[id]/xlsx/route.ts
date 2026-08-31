import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcular, valorDaMetrica } from "@/lib/calc";
import type { Bloco, MetricaParcela, Resultado } from "@/lib/calc/tipos";
import { compararLote } from "@/lib/ordenacao";
import type {
  Cliente,
  Empreendimento,
  Proposta,
  PropostaBloco,
  PropostaCenario,
  PropostaLote,
} from "@/lib/db/tipos";
import {
  ROTULO_AMORTIZACAO,
  ROTULO_METRICA_PARCELA,
  ROTULO_INDEXADOR,
  ROTULO_TIPO_BLOCO,
  rotuloMes,
  rotuloPeriodicidade,
} from "@/lib/formato";

/** Fallback quando o empreendimento não tem cor cadastrada. */
const VINHO = "FF7C2A28";

/** "#5B2166" → "FF5B2166", que é como o ExcelJS quer a cor. */
const argb = (hex: string | null | undefined) =>
  hex ? "FF" + hex.replace("#", "").toUpperCase().padStart(6, "0") : VINHO;
const PAPEL = "FFF3F1EF";
const MOEDA = 'R$ #,##0.00;[Red]-R$ #,##0.00';
const PORCENTO = "0.000%";

function cabecalhoDaAba(
  ws: ExcelJS.Worksheet,
  titulo: string,
  largura: number,
  cor: string
) {
  const linha = ws.addRow([titulo]);
  ws.mergeCells(linha.number, 1, linha.number, largura);
  linha.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" }, name: "Arial" };
  linha.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cor } };
  linha.height = 22;
  linha.alignment = { vertical: "middle", indent: 1 };
  ws.addRow([]);
}

function tituloTabela(ws: ExcelJS.Worksheet, colunas: string[]) {
  const linha = ws.addRow(colunas);
  linha.font = { bold: true, size: 9, name: "Arial" };
  linha.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAPEL } };
  linha.eachCell((c) => {
    c.border = { bottom: { style: "thin", color: { argb: "FFC9C2BB" } } };
  });
  return linha;
}

/** Excel recusa / \ ? * [ ] : em nome de aba, e corta em 31 caracteres. */
function nomeDeAba(base: string, sufixo: string, usados: Set<string>): string {
  const limpo = base.replace(/[\\/?*[\]:]/g, "-").trim() || "Opção";
  let nome = `${sufixo} ${limpo}`.slice(0, 31);
  let i = 2;
  while (usados.has(nome)) {
    const corte = `${sufixo} ${limpo}`.slice(0, 28);
    nome = `${corte} ${i++}`;
  }
  usados.add(nome);
  return nome;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { data } = await supabase
    .from("propostas")
    .select(
      "*, empreendimentos(*), clientes(*), proposta_lotes(*), proposta_cenarios(*, proposta_blocos(*))"
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return NextResponse.json({ erro: "Proposta não encontrada" }, { status: 404 });

  const {
    empreendimentos: empreendimento,
    clientes: cliente,
    proposta_lotes: lotesBrutos,
    proposta_cenarios: cenariosBrutos,
    ...proposta
  } = data as unknown as Proposta & {
    empreendimentos: Empreendimento;
    clientes: Cliente | null;
    proposta_lotes: PropostaLote[];
    proposta_cenarios: (PropostaCenario & { proposta_blocos: PropostaBloco[] })[];
  };

  const lotes = [...(lotesBrutos ?? [])].sort(compararLote);
  // a planilha veste a cor do empreendimento, como a folha da proposta
  const corDaMarca = argb(empreendimento.cor_primaria);

  const premissas = {
    incc_mensal: Number(proposta.incc_mensal),
    juros_vp_mensal: Number(proposta.juros_vp_mensal),
    correcao_primeira_parcela: proposta.correcao_primeira_parcela,
  };

  const lotesCalc = lotes.map((l) => ({
    quadra: l.quadra,
    numero: l.numero,
    area_m2: Number(l.area_m2),
    preco_tabela: Number(l.preco_tabela),
    valor_negociado: Number(l.valor_negociado),
  }));

  const opcoes: { cenario: PropostaCenario; resultado: Resultado }[] = [
    ...(cenariosBrutos ?? []),
  ]
    .sort((a, b) => a.ordem - b.ordem)
    .map(({ proposta_blocos, ...c }) => ({
      cenario: c,
      resultado: calcular({
        lotes: lotesCalc,
        blocos: [...(proposta_blocos ?? [])].sort(
          (x, y) => x.ordem - y.ordem
        ) as unknown as Bloco[],
        premissas,
        desconto_pct: Number(c.desconto_pct),
        desconto_valor: Number(c.desconto_valor),
      }),
    }));

  const metricas: MetricaParcela[] = proposta.metricas_parcela?.length
    ? proposta.metricas_parcela
    : ["inicial"];

  const wb = new ExcelJS.Workbook();
  wb.creator = "Ferramenta de Vendas Ponzoni";
  wb.created = new Date();

  // ------------------------------------------------------------- Resumo
  const resumo = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  resumo.columns = [
    { width: 34 },
    { width: 18 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];
  cabecalhoDaAba(
    resumo,
    `${proposta.codigo} — ${cliente?.nome ?? proposta.titulo ?? ""}`,
    8,
    corDaMarca
  );

  for (const [rotulo, valor] of [
    ["Empreendimento", empreendimento.nome],
    ["Cliente", cliente?.nome ?? "—"],
    ["Empresa", cliente?.empresa ?? "—"],
    ["Status", proposta.status],
    ["Data-base", proposta.data_base],
    ["Validade (dias)", proposta.validade_dias],
    ["INCC ao mês (premissa)", Number(proposta.incc_mensal)],
    ["Taxa de desconto ao mês (VP)", Number(proposta.juros_vp_mensal)],
    [
      "Correção já na 1ª parcela",
      proposta.correcao_primeira_parcela ? "sim" : "não",
    ],
  ] as [string, string | number][]) {
    const l = resumo.addRow([rotulo, valor]);
    l.getCell(1).font = { bold: true, size: 10, name: "Arial" };
    if (typeof valor === "number" && valor < 1) l.getCell(2).numFmt = PORCENTO;
  }

  resumo.addRow([]);
  tituloTabela(resumo, ["Terreno", "Área (m²)", "R$/m²", "Preço de tabela", "Valor negociado"]);
  for (const l of lotes) {
    const linha = resumo.addRow([
      `Quadra ${l.quadra} · Lote ${l.numero}`,
      Number(l.area_m2),
      Number(l.valor_negociado) / Number(l.area_m2),
      Number(l.preco_tabela),
      Number(l.valor_negociado),
    ]);
    linha.getCell(2).numFmt = "#,##0.00";
    for (const c of [3, 4, 5]) linha.getCell(c).numFmt = MOEDA;
  }

  // ------------------------------------------------------- Comparativo
  resumo.addRow([]);
  tituloTabela(resumo, [
    "Opção",
    "Desconto",
    "Valor negociado",
    "Entrada",
    ...metricas.map((m) => ROTULO_METRICA_PARCELA[m]),
    "Prazo (meses)",
    "Total nominal",
    "Valor presente",
  ]);
  for (const { cenario, resultado } of opcoes) {
    const l = resumo.addRow([
      cenario.nome + (cenario.recomendado ? "  ★" : ""),
      resultado.descontoEfetivoPct,
      resultado.valorNegociado,
      resultado.entrada,
      ...metricas.map((m) => valorDaMetrica(resultado, m)),
      resultado.prazoMeses,
      resultado.totalNominal,
      resultado.totalVP,
    ]);
    if (cenario.recomendado) l.font = { bold: true, name: "Arial", size: 10 };
    l.getCell(2).numFmt = "0.00%";
    const ultima = 4 + metricas.length + 3;
    for (let c = 3; c <= ultima; c++) {
      if (c !== 5 + metricas.length) l.getCell(c).numFmt = MOEDA;
    }
  }

  const avisos = opcoes.flatMap(({ cenario, resultado }) =>
    resultado.avisos.map((a) => `${cenario.nome}: ${a}`)
  );
  if (avisos.length) {
    resumo.addRow([]);
    tituloTabela(resumo, ["Avisos"]);
    for (const a of avisos) resumo.addRow([a]);
  }

  // ------------------------------------------ uma aba por opção
  const usados = new Set<string>(["Resumo"]);

  for (const { cenario, resultado } of opcoes) {
    const rotulosBlocos = resultado.blocos.map((b) => b.bloco.rotulo);

    const ws = wb.addWorksheet(nomeDeAba(cenario.nome, "▸", usados), {
      views: [{ showGridLines: false }],
    });
    ws.columns = [
      { width: 32 }, { width: 14 }, { width: 10 }, { width: 14 }, { width: 10 },
      { width: 14 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 16 },
      { width: 16 },
    ];
    cabecalhoDaAba(
      ws,
      `${cenario.nome}${cenario.recomendado ? "  (recomendada)" : ""}`,
      10,
      corDaMarca
    );

    tituloTabela(ws, ["Resumo da opção", "Valor"]);
    for (const [rotulo, valor, formato] of [
      ["Preço de tabela", resultado.valorTabela, MOEDA],
      ["Desconto concedido", -resultado.descontoValor, MOEDA],
      ["Desconto efetivo", resultado.descontoEfetivoPct, "0.00%"],
      ["Valor negociado", resultado.valorNegociado, MOEDA],
      ["Entrada", resultado.entrada, MOEDA],
      ["Entrada (% do negociado)", resultado.entradaPct, "0.00%"],
      ["Total nominal", resultado.totalNominal, MOEDA],
      ["Juros embutidos", resultado.totalJuros, MOEDA],
      ["Correção monetária projetada", resultado.totalCorrecao, MOEDA],
      ["Valor presente do fluxo", resultado.totalVP, MOEDA],
      ["Prazo (meses)", resultado.prazoMeses, "0"],
      ["Parcela inicial", resultado.parcelaInicial, MOEDA],
      ["Parcela média", resultado.parcelaMedia, MOEDA],
      ["Parcela final", resultado.parcelaFinal, MOEDA],
      ["Maior parcela", resultado.maiorParcela, MOEDA],
      ["R$/m² negociado", resultado.precoM2Negociado, MOEDA],
      ["R$/m² a valor presente", resultado.precoM2VP, MOEDA],
    ] as [string, number, string][]) {
      const l = ws.addRow([rotulo, valor]);
      l.getCell(1).font = { size: 10, name: "Arial" };
      l.getCell(2).numFmt = formato;
    }

    ws.addRow([]);
    tituloTabela(ws, [
      "Bloco", "Tipo", "Parcelas", "Periodicidade", "1º mês", "Amortização",
      "Índice", "Taxa índice a.m.", "Juros a.m.", "Valor do bloco", "Total nominal",
    ]);
    for (const b of resultado.blocos) {
      const bl = b.bloco;
      const l = ws.addRow([
        bl.rotulo,
        ROTULO_TIPO_BLOCO[bl.tipo],
        b.parcelas.length,
        rotuloPeriodicidade(bl.periodicidade_meses || 1),
        bl.mes_inicio,
        ROTULO_AMORTIZACAO[bl.amortizacao],
        ROTULO_INDEXADOR[bl.indexador],
        bl.indexador === "nenhum"
          ? 0
          : (bl.taxa_indexador_mensal ?? Number(proposta.incc_mensal)),
        bl.juros_mensal,
        b.base,
        b.totalNominal,
      ]);
      l.getCell(8).numFmt = PORCENTO;
      l.getCell(9).numFmt = PORCENTO;
      l.getCell(10).numFmt = MOEDA;
      l.getCell(11).numFmt = MOEDA;
    }

    ws.addRow([]);
    tituloTabela(ws, ["Mês", "Vencimento", ...rotulosBlocos, "Total", "Valor presente"]);
    for (const f of resultado.fluxo) {
      const porBloco = resultado.blocos.map((b) => {
        const item = f.itens.find((i) => i.blocoId === b.bloco.id);
        return item ? item.valor : null;
      });
      const l = ws.addRow([
        f.mes,
        f.mes === 0 ? "no ato" : rotuloMes(f.mes, proposta.data_base),
        ...porBloco,
        f.valor,
        f.vp,
      ]);
      for (let c = 3; c <= rotulosBlocos.length + 4; c++) l.getCell(c).numFmt = MOEDA;
      l.getCell(rotulosBlocos.length + 3).font = { bold: true, name: "Arial", size: 10 };
    }
    const total = ws.addRow([
      "",
      "Total",
      ...resultado.blocos.map((b) => b.totalNominal),
      resultado.totalNominal,
      resultado.totalVP,
    ]);
    total.font = { bold: true, name: "Arial", size: 10 };
    for (let c = 3; c <= rotulosBlocos.length + 4; c++) total.getCell(c).numFmt = MOEDA;

    // ------------------------------------------------ amortização
    const amort = wb.addWorksheet(nomeDeAba(cenario.nome, "≡", usados), {
      views: [{ showGridLines: false }],
    });
    amort.columns = [
      { width: 30 }, { width: 8 }, { width: 8 }, { width: 12 },
      { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 },
      { width: 16 }, { width: 16 },
    ];
    cabecalhoDaAba(amort, `${cenario.nome} — parcela a parcela`, 10, corDaMarca);
    tituloTabela(amort, [
      "Bloco", "Nº", "Mês", "Vencimento", "Parcela", "Amortização", "Juros",
      "Correção", "Saldo devedor", "Valor presente",
    ]);
    for (const b of resultado.blocos) {
      for (const p of b.parcelas) {
        const l = amort.addRow([
          b.bloco.rotulo,
          p.indice,
          p.mes,
          p.mes === 0 ? "no ato" : rotuloMes(p.mes, proposta.data_base),
          p.valor,
          p.amortizacao,
          p.juros,
          p.correcao,
          p.saldo,
          p.vp,
        ]);
        for (let c = 5; c <= 10; c++) l.getCell(c).numFmt = MOEDA;
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const nome = `${proposta.codigo}-${(cliente?.nome ?? "proposta")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
