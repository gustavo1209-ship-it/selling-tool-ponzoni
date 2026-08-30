import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcular } from "@/lib/calc";
import type { Bloco } from "@/lib/calc/tipos";
import type {
  Cliente,
  Empreendimento,
  Proposta,
  PropostaBloco,
  PropostaLote,
} from "@/lib/db/tipos";
import {
  ROTULO_AMORTIZACAO,
  ROTULO_INDEXADOR,
  ROTULO_TIPO_BLOCO,
  rotuloMes,
} from "@/lib/formato";

const VINHO = "FF7C2A28";
const PAPEL = "FFF3F1EF";
const MOEDA = 'R$ #,##0.00;[Red]-R$ #,##0.00';
const PORCENTO = "0.000%";

function cabecalhoDaAba(ws: ExcelJS.Worksheet, titulo: string, largura: number) {
  const linha = ws.addRow([titulo]);
  ws.mergeCells(linha.number, 1, linha.number, largura);
  linha.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" }, name: "Arial" };
  linha.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINHO } };
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
    .select("*, empreendimentos(*), clientes(*), proposta_lotes(*), proposta_blocos(*)")
    .eq("id", id)
    .maybeSingle();

  if (!data) return NextResponse.json({ erro: "Proposta não encontrada" }, { status: 404 });

  const {
    empreendimentos: empreendimento,
    clientes: cliente,
    proposta_lotes: lotesBrutos,
    proposta_blocos: blocosBrutos,
    ...proposta
  } = data as unknown as Proposta & {
    empreendimentos: Empreendimento;
    clientes: Cliente | null;
    proposta_lotes: PropostaLote[];
    proposta_blocos: PropostaBloco[];
  };

  const lotes = [...(lotesBrutos ?? [])].sort((a, b) => a.ordem - b.ordem);
  const blocos = [...(blocosBrutos ?? [])].sort((a, b) => a.ordem - b.ordem);

  const resultado = calcular({
    lotes: lotes.map((l) => ({
      quadra: l.quadra,
      numero: l.numero,
      area_m2: Number(l.area_m2),
      preco_tabela: Number(l.preco_tabela),
      valor_negociado: Number(l.valor_negociado),
    })),
    blocos: blocos as unknown as Bloco[],
    premissas: {
      incc_mensal: Number(proposta.incc_mensal),
      juros_vp_mensal: Number(proposta.juros_vp_mensal),
      correcao_primeira_parcela: proposta.correcao_primeira_parcela,
    },
    desconto_pct: Number(proposta.desconto_pct),
    desconto_valor: Number(proposta.desconto_valor),
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Ferramenta de Vendas Ponzoni";
  wb.created = new Date();

  // ------------------------------------------------------------- Resumo
  const resumo = wb.addWorksheet("Resumo", {
    views: [{ showGridLines: false }],
  });
  resumo.columns = [
    { width: 34 },
    { width: 18 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
  ];
  cabecalhoDaAba(resumo, `${proposta.codigo} — ${cliente?.nome ?? proposta.titulo ?? ""}`, 5);

  for (const [rotulo, valor] of [
    ["Empreendimento", empreendimento.nome],
    ["Cliente", cliente?.nome ?? "—"],
    ["Empresa", cliente?.empresa ?? "—"],
    ["Condição de partida", proposta.condicao_origem ?? "montada do zero"],
    ["Status", proposta.status],
    ["Data-base", proposta.data_base],
    ["Validade (dias)", proposta.validade_dias],
  ] as [string, string | number][]) {
    const l = resumo.addRow([rotulo, valor]);
    l.getCell(1).font = { bold: true, size: 10, name: "Arial" };
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
    linha.getCell(3).numFmt = MOEDA;
    linha.getCell(4).numFmt = MOEDA;
    linha.getCell(5).numFmt = MOEDA;
  }

  resumo.addRow([]);
  tituloTabela(resumo, ["Resumo financeiro", "Valor"]);
  for (const [rotulo, valor, formato] of [
    ["Preço de tabela", resultado.valorTabela, MOEDA],
    ["Desconto concedido", -resultado.descontoValor, MOEDA],
    ["Desconto efetivo", resultado.descontoEfetivoPct, PORCENTO],
    ["Valor negociado", resultado.valorNegociado, MOEDA],
    ["Entrada", resultado.entrada, MOEDA],
    ["Entrada (% do negociado)", resultado.entradaPct, PORCENTO],
    ["Total nominal", resultado.totalNominal, MOEDA],
    ["Juros embutidos", resultado.totalJuros, MOEDA],
    ["Correção monetária projetada", resultado.totalCorrecao, MOEDA],
    ["Valor presente do fluxo", resultado.totalVP, MOEDA],
    ["Prazo (meses)", resultado.prazoMeses, "0"],
    ["Maior parcela", resultado.maiorParcela, MOEDA],
    ["Área total (m²)", resultado.areaTotal, "#,##0.00"],
    ["R$/m² negociado", resultado.precoM2Negociado, MOEDA],
    ["R$/m² a valor presente", resultado.precoM2VP, MOEDA],
    ["INCC ao mês (premissa)", Number(proposta.incc_mensal), PORCENTO],
    ["Taxa de desconto ao mês (VP)", Number(proposta.juros_vp_mensal), PORCENTO],
  ] as [string, number, string][]) {
    const l = resumo.addRow([rotulo, valor]);
    l.getCell(1).font = { size: 10, name: "Arial" };
    l.getCell(2).numFmt = formato;
  }

  if (resultado.avisos.length) {
    resumo.addRow([]);
    tituloTabela(resumo, ["Avisos"]);
    for (const a of resultado.avisos) resumo.addRow([a]);
  }

  // ------------------------------------------------------------- Blocos
  const abaBlocos = wb.addWorksheet("Blocos", { views: [{ showGridLines: false }] });
  abaBlocos.columns = [
    { width: 32 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 14 },
    { width: 12 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 },
    { width: 16 }, { width: 16 },
  ];
  cabecalhoDaAba(abaBlocos, "Estrutura de pagamento", 12);
  tituloTabela(abaBlocos, [
    "Bloco", "Tipo", "Parcelas", "1º mês", "Amortização", "Índice", "Taxa índice a.m.",
    "Juros a.m.", "Valor do bloco", "1ª parcela", "Última parcela", "Total nominal",
  ]);

  for (const b of resultado.blocos) {
    const bl = b.bloco;
    const l = abaBlocos.addRow([
      bl.rotulo,
      ROTULO_TIPO_BLOCO[bl.tipo],
      b.parcelas.length,
      bl.mes_inicio,
      ROTULO_AMORTIZACAO[bl.amortizacao],
      ROTULO_INDEXADOR[bl.indexador],
      bl.indexador === "nenhum"
        ? 0
        : (bl.taxa_indexador_mensal ?? Number(proposta.incc_mensal)),
      bl.juros_mensal,
      b.base,
      b.primeiraParcela,
      b.ultimaParcela,
      b.totalNominal,
    ]);
    l.getCell(7).numFmt = PORCENTO;
    l.getCell(8).numFmt = PORCENTO;
    for (const c of [9, 10, 11, 12]) l.getCell(c).numFmt = MOEDA;
  }

  // -------------------------------------------------------------- Fluxo
  const fluxo = wb.addWorksheet("Fluxo", { views: [{ showGridLines: false, state: "frozen", ySplit: 4 }] });
  const rotulosBlocos = resultado.blocos.map((b) => b.bloco.rotulo);
  fluxo.columns = [
    { width: 8 },
    { width: 12 },
    ...rotulosBlocos.map(() => ({ width: 16 })),
    { width: 16 },
    { width: 16 },
  ];
  cabecalhoDaAba(fluxo, "Fluxo consolidado de pagamentos", rotulosBlocos.length + 4);
  tituloTabela(fluxo, ["Mês", "Vencimento", ...rotulosBlocos, "Total", "Valor presente"]);

  for (const f of resultado.fluxo) {
    const porBloco = resultado.blocos.map((b) => {
      const item = f.itens.find((i) => i.blocoId === b.bloco.id);
      return item ? item.valor : null;
    });
    const l = fluxo.addRow([
      f.mes,
      f.mes === 0 ? "no ato" : rotuloMes(f.mes, proposta.data_base),
      ...porBloco,
      f.valor,
      f.vp,
    ]);
    for (let c = 3; c <= rotulosBlocos.length + 4; c++) l.getCell(c).numFmt = MOEDA;
    l.getCell(rotulosBlocos.length + 3).font = { bold: true, name: "Arial", size: 10 };
  }

  const total = fluxo.addRow([
    "",
    "Total",
    ...resultado.blocos.map((b) => b.totalNominal),
    resultado.totalNominal,
    resultado.totalVP,
  ]);
  total.font = { bold: true, name: "Arial", size: 10 };
  total.eachCell((c) => {
    c.border = { top: { style: "thin", color: { argb: "FFC9C2BB" } } };
  });
  for (let c = 3; c <= rotulosBlocos.length + 4; c++) total.getCell(c).numFmt = MOEDA;

  // ------------------------------------------------------ Amortização
  const amort = wb.addWorksheet("Amortização", { views: [{ showGridLines: false }] });
  amort.columns = [
    { width: 30 }, { width: 8 }, { width: 8 }, { width: 12 },
    { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 16 }, { width: 16 },
  ];
  cabecalhoDaAba(amort, "Detalhamento parcela a parcela", 10);
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
