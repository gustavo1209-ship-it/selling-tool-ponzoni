import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcularContrato } from "@/lib/contratos/correcao";
import {
  competencia,
  competenciaPorExtenso,
  hojeISO,
} from "@/lib/contratos/mes";
import { carregarIndices, serieDe } from "@/lib/contratos/servidor";
import type { ParcelaCalculada } from "@/lib/contratos/tipos";
import type { ContratoParcela } from "@/lib/db/tipos";
import { ROTULO_INDEXADOR, ROTULO_SITUACAO_PARCELA } from "@/lib/formato";

const VINHO = "FF7C2A28";
const PAPEL = "FFF3F1EF";
const MOEDA = 'R$ #,##0.00;[Red]-R$ #,##0.00';
const DATA = "dd/mm/yyyy";

interface Linha {
  id: string;
  codigo: string;
  titulo: string | null;
  data_base: string;
  valor_total: number;
  indexador: string;
  defasagem_indice_meses: number;
  corrige_primeira_parcela: boolean;
  juros_mora_mensal: number;
  multa_atraso_pct: number;
  empreendimento_id: string;
  clientes: {
    nome: string;
    documento: string | null;
    email: string | null;
    telefone: string | null;
  } | null;
  empreendimentos: { nome: string } | null;
  contrato_lotes: { quadra: string; numero: string }[];
  contrato_parcelas: ContratoParcela[];
}

/**
 * A planilha que vai para o banco.
 *
 * Uma linha por boleto a emitir, com o que o registro pede — sacado,
 * documento, vencimento e valor — e as colunas de origem do número
 * (original, fator, encargos) para conferir antes de mandar. A coluna
 * "índice estimado" é a que impede o erro caro: linha marcada SIM depende
 * de mês sem índice lançado e o valor ainda vai mudar.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const paramMes = url.searchParams.get("mes");
  const mes = paramMes && /^\d{4}-\d{2}$/.test(paramMes) ? paramMes : competencia(hojeISO());
  const paramAte = url.searchParams.get("ate");
  const ate = paramAte && /^\d{4}-\d{2}$/.test(paramAte) && paramAte >= mes ? paramAte : mes;
  const emp = url.searchParams.get("emp");
  const incluirAtrasadas = url.searchParams.get("so_mes") !== "1";

  const [{ data }, indices] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        "id, codigo, titulo, data_base, valor_total, indexador, defasagem_indice_meses, corrige_primeira_parcela, juros_mora_mensal, multa_atraso_pct, empreendimento_id, clientes(nome, documento, email, telefone), empreendimentos(nome), contrato_lotes(quadra, numero), contrato_parcelas(*)"
      )
      .in("status", ["ativo", "suspenso"])
      .eq("teste", false),
    carregarIndices(),
  ]);

  const contratos = ((data ?? []) as unknown as Linha[]).filter(
    (c) => !emp || c.empreendimento_id === emp
  );

  const linhas: { contrato: Linha; parcela: ParcelaCalculada }[] = [];
  for (const c of contratos) {
    const { serie, taxa } = serieDe(indices, c.indexador as never);
    const calculo = calcularContrato(
      {
        data_base: c.data_base,
        indexador: c.indexador as never,
        defasagem_indice_meses: c.defasagem_indice_meses,
        corrige_primeira_parcela: c.corrige_primeira_parcela,
        juros_mora_mensal: Number(c.juros_mora_mensal),
        multa_atraso_pct: Number(c.multa_atraso_pct),
        valor_total: Number(c.valor_total),
      },
      c.contrato_parcelas,
      serie,
      taxa
    );
    for (const p of calculo.parcelas) {
      if (p.situacao === "paga") continue;
      const comp = competencia(p.vencimento);
      if (
        (comp >= mes && comp <= ate) ||
        (incluirAtrasadas && comp < mes && p.situacao === "vencida")
      ) {
        linhas.push({ contrato: c, parcela: p });
      }
    }
  }

  linhas.sort(
    (a, b) =>
      a.parcela.vencimento.localeCompare(b.parcela.vencimento) ||
      a.contrato.codigo.localeCompare(b.contrato.codigo)
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "Ponzoni — ferramenta de vendas";
  const ws = wb.addWorksheet("A receber");

  const titulo = ws.addRow([
    `A receber — ${
      ate === mes
        ? competenciaPorExtenso(mes)
        : `${competenciaPorExtenso(mes)} a ${competenciaPorExtenso(ate)}`
    }`,
  ]);
  ws.mergeCells(titulo.number, 1, titulo.number, 15);
  titulo.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" }, name: "Arial" };
  titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINHO } };
  titulo.height = 22;
  titulo.alignment = { vertical: "middle", indent: 1 };

  const nota = ws.addRow([
    `Gerado em ${new Date().toLocaleString("pt-BR")}. Valores corrigidos pelos índices lançados na ferramenta; linhas com "índice estimado = SIM" dependem de mês ainda não publicado.`,
  ]);
  ws.mergeCells(nota.number, 1, nota.number, 15);
  nota.font = { size: 9, italic: true, name: "Arial", color: { argb: "FF6B6662" } };
  ws.addRow([]);

  const colunas = [
    "Vencimento",
    "Contrato",
    "Sacado",
    "CPF / CNPJ",
    "Telefone",
    "E-mail",
    "Empreendimento",
    "Lote",
    "Parcela",
    "Valor original",
    "Fator de correção",
    "Valor corrigido",
    "Encargos de atraso",
    "Valor do boleto",
    "Situação",
    "Índice estimado",
    "Nº do boleto",
  ];
  const cab = ws.addRow(colunas);
  cab.font = { bold: true, size: 9, name: "Arial" };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAPEL } };
  cab.eachCell((c) => {
    c.border = { bottom: { style: "thin", color: { argb: "FFC9C2BB" } } };
  });

  for (const { contrato: c, parcela: p } of linhas) {
    const linha = ws.addRow([
      new Date(`${p.vencimento}T12:00:00`),
      c.codigo,
      c.clientes?.nome ?? c.titulo ?? "",
      c.clientes?.documento ?? "",
      c.clientes?.telefone ?? "",
      c.clientes?.email ?? "",
      c.empreendimentos?.nome ?? "",
      c.contrato_lotes.map((l) => `${l.quadra}-${l.numero}`).join(", "),
      p.total_no_grupo > 1 ? `${p.rotulo} ${p.indice}/${p.total_no_grupo}` : p.rotulo,
      p.valor_original,
      p.indexada ? p.correcao.fator : 1,
      p.valorCorrigido,
      p.encargos ? p.encargos.multa + p.encargos.juros : 0,
      p.valorACobrar,
      ROTULO_SITUACAO_PARCELA[p.situacao] ?? p.situacao,
      p.correcao.estimado ? "SIM" : "não",
      p.boleto_numero ?? "",
    ]);
    linha.getCell(1).numFmt = DATA;
    linha.getCell(11).numFmt = "0.00000";
    for (const col of [10, 12, 13, 14]) linha.getCell(col).numFmt = MOEDA;
    if (p.situacao === "vencida") {
      linha.getCell(15).font = { bold: true, color: { argb: "FF96262C" }, name: "Arial" };
    }
    if (p.correcao.estimado) {
      linha.getCell(16).font = { bold: true, color: { argb: "FF8A5B0B" }, name: "Arial" };
    }
  }

  if (linhas.length) {
    const total = ws.addRow([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "TOTAL",
      linhas.reduce((s, l) => s + l.parcela.valor_original, 0),
      "",
      linhas.reduce((s, l) => s + l.parcela.valorCorrigido, 0),
      linhas.reduce(
        (s, l) => s + (l.parcela.encargos ? l.parcela.encargos.multa + l.parcela.encargos.juros : 0),
        0
      ),
      linhas.reduce((s, l) => s + l.parcela.valorACobrar, 0),
    ]);
    total.font = { bold: true, name: "Arial" };
    for (const col of [10, 12, 13, 14]) total.getCell(col).numFmt = MOEDA;
  }

  ws.columns.forEach((coluna, i) => {
    coluna.width = [12, 12, 30, 18, 15, 26, 20, 12, 20, 15, 15, 15, 15, 15, 12, 14, 16][i] ?? 14;
  });
  ws.views = [{ state: "frozen", ySplit: 4 }];

  // aba de apoio: as premissas de correção de cada contrato que entrou,
  // para quem receber a planilha saber de onde o número saiu
  const wsRef = wb.addWorksheet("Premissas");
  const cabRef = wsRef.addRow([
    "Contrato",
    "Sacado",
    "Data-base",
    "Índice",
    "Defasagem (meses)",
    "Juros de mora ao mês",
    "Multa por atraso",
  ]);
  cabRef.font = { bold: true, size: 9, name: "Arial" };
  cabRef.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAPEL } };

  const vistos = new Set<string>();
  for (const { contrato: c } of linhas) {
    if (vistos.has(c.id)) continue;
    vistos.add(c.id);
    const l = wsRef.addRow([
      c.codigo,
      c.clientes?.nome ?? c.titulo ?? "",
      new Date(`${c.data_base}T12:00:00`),
      ROTULO_INDEXADOR[c.indexador] ?? c.indexador,
      c.defasagem_indice_meses,
      Number(c.juros_mora_mensal),
      Number(c.multa_atraso_pct),
    ]);
    l.getCell(3).numFmt = DATA;
    l.getCell(6).numFmt = "0.000%";
    l.getCell(7).numFmt = "0.000%";
  }
  wsRef.columns.forEach((coluna, i) => {
    coluna.width = [12, 30, 12, 14, 18, 20, 18][i] ?? 14;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="a-receber-${mes}${ate !== mes ? `_a_${ate}` : ""}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
