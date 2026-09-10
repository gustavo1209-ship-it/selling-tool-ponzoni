import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcularContrato } from "@/lib/contratos/correcao";
import { colunasAtivas, type ChaveColuna } from "@/lib/contratos/colunas";
import { rotuloCompetencia } from "@/lib/contratos/mes";
import { carregarIndices, serieDe } from "@/lib/contratos/servidor";
import type { ParcelaCalculada } from "@/lib/contratos/tipos";
import type { ContratoCompleto } from "@/lib/db/tipos";
import {
  ROTULO_INDEXADOR,
  ROTULO_SITUACAO_PARCELA,
  ROTULO_STATUS_CONTRATO,
} from "@/lib/formato";

const PAPEL = "FFF3F1EF";
const MOEDA = 'R$ #,##0.00;[Red]-R$ #,##0.00';
const DATA = "dd/mm/yyyy";

/** "#5B2166" → "FF5B2166", que é como o ExcelJS quer a cor. */
const argb = (hex: string | null | undefined) =>
  hex ? "FF" + hex.replace("#", "").toUpperCase().padStart(6, "0") : "FF7C2A28";

/**
 * As colunas do cronograma na planilha, na ordem em que saem.
 *
 * Cabeçalho, valor, formato e largura moram juntos porque saem juntos: com
 * as colunas escolhidas pelo contrato, uma lista de larguras à parte
 * desalinharia na primeira coluna escondida.
 */
interface ColunaXlsx {
  chave: ChaveColuna;
  cabecalho: string;
  valor: (p: ParcelaCalculada) => string | number | Date;
  formato?: string;
  largura: number;
}

const COLUNAS_XLSX: ColunaXlsx[] = [
  { chave: "numero", cabecalho: "#", valor: (p) => p.numero, largura: 5 },
  { chave: "rotulo", cabecalho: "Grupo", valor: (p) => p.rotulo, largura: 22 },
  {
    chave: "grupo",
    cabecalho: "Parcela",
    valor: (p) => (p.total_no_grupo > 1 ? `${p.indice}/${p.total_no_grupo}` : ""),
    largura: 10,
  },
  {
    chave: "vencimento",
    cabecalho: "Vencimento",
    valor: (p) => new Date(`${p.vencimento}T12:00:00`),
    formato: DATA,
    largura: 12,
  },
  {
    chave: "valor_original",
    cabecalho: "Valor original",
    valor: (p) => p.valor_original,
    formato: MOEDA,
    largura: 15,
  },
  {
    chave: "correcao_de",
    cabecalho: "Correção de",
    valor: (p) => {
      const comps = p.correcao.competencias;
      if (!comps.length) return "—";
      return `${rotuloCompetencia(comps[0])} a ${rotuloCompetencia(
        comps[comps.length - 1]
      )}${p.correcao.estimado ? " (parcial)" : ""}`;
    },
    largura: 20,
  },
  {
    chave: "fator",
    cabecalho: "Fator",
    valor: (p) => (p.indexada ? p.correcao.fator : 1),
    formato: "0.00000",
    largura: 12,
  },
  {
    chave: "valor_corrigido",
    cabecalho: "Valor corrigido",
    valor: (p) => p.valorCorrigido,
    formato: MOEDA,
    largura: 15,
  },
  {
    chave: "encargos",
    cabecalho: "Encargos",
    valor: (p) => (p.encargos ? p.encargos.multa + p.encargos.juros : 0),
    formato: MOEDA,
    largura: 13,
  },
  {
    chave: "a_cobrar",
    cabecalho: "A cobrar",
    valor: (p) => (p.situacao === "paga" ? 0 : p.valorACobrar),
    formato: MOEDA,
    largura: 15,
  },
  {
    chave: "situacao",
    cabecalho: "Situação",
    valor: (p) => ROTULO_SITUACAO_PARCELA[p.situacao] ?? p.situacao,
    largura: 12,
  },
  {
    chave: "pago_em",
    cabecalho: "Pago em",
    valor: (p) => (p.pago_em ? new Date(`${p.pago_em}T12:00:00`) : ""),
    formato: DATA,
    largura: 12,
  },
  {
    chave: "valor_pago",
    cabecalho: "Valor pago",
    valor: (p) => p.valor_pago ?? "",
    formato: MOEDA,
    largura: 14,
  },
  {
    chave: "forma",
    cabecalho: "Forma",
    valor: (p) => p.forma_pagamento ?? "",
    largura: 14,
  },
  {
    chave: "boleto",
    cabecalho: "Nº do boleto",
    valor: (p) => p.boleto_numero ?? "",
    largura: 16,
  },
];

/** Extrato do contrato: posição de hoje e o cronograma parcela a parcela. */
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

  const [{ data }, indices] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        "*, empreendimento:empreendimentos(*), cliente:clientes(*), lotes:contrato_lotes(*), parcelas:contrato_parcelas(*)"
      )
      .eq("id", id)
      .maybeSingle(),
    carregarIndices(),
  ]);

  if (!data) return NextResponse.json({ erro: "Contrato não encontrado" }, { status: 404 });
  const contrato = data as unknown as ContratoCompleto;

  const { serie, taxa } = serieDe(indices, contrato.indexador);
  const calculo = calcularContrato(
    {
      data_base: contrato.data_base,
      indexador: contrato.indexador,
      defasagem_indice_meses: contrato.defasagem_indice_meses,
      corrige_primeira_parcela: contrato.corrige_primeira_parcela,
      juros_mora_mensal: Number(contrato.juros_mora_mensal),
      multa_atraso_pct: Number(contrato.multa_atraso_pct),
      valor_total: Number(contrato.valor_total),
    },
    contrato.parcelas,
    serie,
    taxa
  );

  // O contrato escolhe quais colunas do cronograma saem (migration 32); o
  // padrão continua sendo todas. Cabeçalho, células e largura vêm da mesma
  // lista, senão uma coluna escondida desalinha o resto.
  const ativas = colunasAtivas(
    contrato.colunas_documento,
    "xlsx",
    contrato.indexador !== "nenhum"
  );
  const colunas = COLUNAS_XLSX.filter((c) => ativas.has(c.chave));

  const cor = argb(contrato.empreendimento.cor_primaria);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ponzoni — ferramenta de vendas";
  const ws = wb.addWorksheet("Contrato");

  const titulo = ws.addRow([
    `${contrato.codigo} — ${contrato.cliente?.nome ?? contrato.titulo ?? "sem comprador"}`,
  ]);
  ws.mergeCells(titulo.number, 1, titulo.number, Math.max(2, colunas.length));
  titulo.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" }, name: "Arial" };
  titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cor } };
  titulo.height = 22;
  titulo.alignment = { vertical: "middle", indent: 1 };
  ws.addRow([]);

  const info: [string, string | number | Date][] = [
    ["Empreendimento", contrato.empreendimento.nome],
    ["Lotes", contrato.lotes.map((l) => `${l.quadra}-${l.numero}`).join(", ") || "—"],
    ["Situação", ROTULO_STATUS_CONTRATO[contrato.status] ?? contrato.status],
    ["Data do contrato", new Date(`${contrato.data_contrato}T12:00:00`)],
    ["Data-base da correção", new Date(`${contrato.data_base}T12:00:00`)],
    ["Índice", ROTULO_INDEXADOR[contrato.indexador] ?? contrato.indexador],
    ["Defasagem do índice (meses)", contrato.defasagem_indice_meses],
    ["Valor do contrato", Number(contrato.valor_total)],
    ["Recebido", calculo.totalPago],
    ["Saldo corrigido de hoje", calculo.saldoCorrigido],
    ["Em atraso", calculo.totalVencido],
    ["Parcelas pagas", `${calculo.parcelasPagas} de ${calculo.parcelasTotal}`],
  ];

  for (const [rotulo, valor] of info) {
    const linha = ws.addRow([rotulo, valor]);
    linha.getCell(1).font = { bold: true, size: 10, name: "Arial" };
    if (valor instanceof Date) linha.getCell(2).numFmt = DATA;
    if (typeof valor === "number" && rotulo !== "Defasagem do índice (meses)") {
      linha.getCell(2).numFmt = MOEDA;
    }
  }

  if (calculo.temEstimativa) {
    const aviso = ws.addRow([
      "Atenção",
      "Parte das parcelas depende de meses sem índice lançado e está estimada pela taxa de projeção.",
    ]);
    aviso.getCell(1).font = { bold: true, color: { argb: "FF8A5B0B" }, name: "Arial" };
    aviso.getCell(2).font = { italic: true, color: { argb: "FF8A5B0B" }, name: "Arial" };
  }

  ws.addRow([]);

  const cab = ws.addRow(colunas.map((c) => c.cabecalho));
  cab.font = { bold: true, size: 9, name: "Arial" };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAPEL } };
  cab.eachCell((c) => {
    c.border = { bottom: { style: "thin", color: { argb: "FFC9C2BB" } } };
  });

  for (const p of calculo.parcelas) {
    const linha = ws.addRow(colunas.map((c) => c.valor(p)));
    colunas.forEach((c, i) => {
      if (c.formato) linha.getCell(i + 1).numFmt = c.formato;
      if (c.chave === "situacao" && p.situacao === "vencida") {
        linha.getCell(i + 1).font = {
          bold: true,
          color: { argb: "FF96262C" },
          name: "Arial",
        };
      }
    });
  }

  ws.columns.forEach((coluna, i) => {
    coluna.width = colunas[i]?.largura ?? 14;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const nome = `${contrato.codigo}-${(contrato.cliente?.nome ?? "contrato")
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
