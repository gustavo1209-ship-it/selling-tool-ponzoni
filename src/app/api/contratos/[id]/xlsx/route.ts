import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcularContrato } from "@/lib/contratos/correcao";
import { rotuloCompetencia } from "@/lib/contratos/mes";
import { carregarIndices, serieDe } from "@/lib/contratos/servidor";
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

  const cor = argb(contrato.empreendimento.cor_primaria);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ponzoni — ferramenta de vendas";
  const ws = wb.addWorksheet("Contrato");

  const titulo = ws.addRow([
    `${contrato.codigo} — ${contrato.cliente?.nome ?? contrato.titulo ?? "sem comprador"}`,
  ]);
  ws.mergeCells(titulo.number, 1, titulo.number, 11);
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

  const cab = ws.addRow([
    "#",
    "Grupo",
    "Parcela",
    "Vencimento",
    "Valor original",
    "Correção de",
    "Fator",
    "Valor corrigido",
    "Encargos",
    "A cobrar",
    "Situação",
    "Pago em",
    "Valor pago",
    "Forma",
    "Nº do boleto",
  ]);
  cab.font = { bold: true, size: 9, name: "Arial" };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAPEL } };
  cab.eachCell((c) => {
    c.border = { bottom: { style: "thin", color: { argb: "FFC9C2BB" } } };
  });

  for (const p of calculo.parcelas) {
    const comps = p.correcao.competencias;
    const linha = ws.addRow([
      p.numero,
      p.rotulo,
      p.total_no_grupo > 1 ? `${p.indice}/${p.total_no_grupo}` : "",
      new Date(`${p.vencimento}T12:00:00`),
      p.valor_original,
      comps.length
        ? `${rotuloCompetencia(comps[0])} a ${rotuloCompetencia(comps[comps.length - 1])}${p.correcao.estimado ? " (parcial)" : ""}`
        : "—",
      p.indexada ? p.correcao.fator : 1,
      p.valorCorrigido,
      p.encargos ? p.encargos.multa + p.encargos.juros : 0,
      p.situacao === "paga" ? 0 : p.valorACobrar,
      ROTULO_SITUACAO_PARCELA[p.situacao] ?? p.situacao,
      p.pago_em ? new Date(`${p.pago_em}T12:00:00`) : "",
      p.valor_pago ?? "",
      p.forma_pagamento ?? "",
      p.boleto_numero ?? "",
    ]);
    linha.getCell(4).numFmt = DATA;
    linha.getCell(7).numFmt = "0.00000";
    linha.getCell(12).numFmt = DATA;
    for (const col of [5, 8, 9, 10, 13]) linha.getCell(col).numFmt = MOEDA;
    if (p.situacao === "vencida") {
      linha.getCell(11).font = { bold: true, color: { argb: "FF96262C" }, name: "Arial" };
    }
  }

  ws.columns.forEach((coluna, i) => {
    coluna.width = [5, 22, 10, 12, 15, 20, 12, 15, 13, 15, 12, 12, 14, 14, 16][i] ?? 14;
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
