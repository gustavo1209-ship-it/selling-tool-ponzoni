import type { Indexador } from "@/lib/calc/tipos";
import { competencia } from "@/lib/contratos/mes";

/**
 * Importação da série mensal a partir do SGS do Banco Central.
 *
 * O SGS é o caminho prático para o INCC: a FGV publica o número, o Banco
 * Central espelha numa API aberta, sem chave e sem cadastro, e é ela que o
 * botão "Atualizar pelo Banco Central" consulta.
 *
 * Os códigos abaixo foram conferidos contra os números que já estavam no
 * seed da migration 11 — não são chute. O acumulado em 12 meses até
 * ago/2026 calculado da série 7456 dá 6,5542%, contra os 6,56% do INCC-M
 * cadastrado; a 189 dá 2,1782% contra os 2,16% do IGP-M; a 433 dá 4,4430%
 * contra os 4,44% do IPCA.
 */
export const SERIE_SGS: Partial<Record<Indexador, { codigo: number; nome: string }>> = {
  // INCC-M, que é o índice de contrato da casa. A 192 é o INCC-DI, irmão
  // com outra janela de coleta — em ago/2026 deu 0,66% contra 0,85% do M.
  incc: { codigo: 7456, nome: "INCC-M" },
  igpm: { codigo: 189, nome: "IGP-M" },
  ipca: { codigo: 433, nome: "IPCA" },
  inpc: { codigo: 188, nome: "INPC" },
  igpdi: { codigo: 190, nome: "IGP-DI" },
  // Acumuladas no mês. Cuidado redobrado com o mês corrente: elas trazem o
  // acumulado parcial até hoje, que não é a variação do mês.
  selic: { codigo: 4390, nome: "Selic acumulada no mês" },
  cdi: { codigo: 4391, nome: "CDI acumulado no mês" },
  // Fora de propósito:
  // - `tr`: a série 226 é DIÁRIA (uma linha por dia, com dataFim), não é a
  //   variação de um mês, e importá-la produziria competências repetidas;
  // - `cub`: é do Sinduscon-RS e não existe no SGS.
};

export interface PontoDaSerie {
  /** "2026-08" */
  competencia: string;
  /** Fração: 0.0085 para os 0,85% que a API devolve como "0.85". */
  variacao: number;
}

interface LinhaSgs {
  data: string;
  valor: string;
}

/** "01/08/2026" → "2026-08". */
function competenciaDoSgs(data: string): string {
  const [, mes, ano] = data.split("/");
  return `${ano}-${mes}`;
}

/**
 * Busca a série de um índice no SGS, do mês `desde` até o último fechado.
 *
 * **O mês corrente fica de fora, sempre.** As séries acumuladas no mês
 * trazem o parcial até hoje — a Selic de setembro apareceu como 0,21%
 * enquanto agosto, fechado, tinha 1,09% —, e gravar isso como "a variação
 * de setembro" corrigiria parcela com um número que ainda vai crescer. Nos
 * índices de inflação o dado só aparece quando o mês fecha, então o corte
 * não custa nada: o INCC de setembro entra na primeira atualização feita em
 * outubro, que é quando o boleto de outubro é emitido.
 */
export async function buscarSerieBcb(
  indexador: Indexador,
  desde: string,
  hoje: string
): Promise<PontoDaSerie[]> {
  const serie = SERIE_SGS[indexador];
  if (!serie) {
    throw new Error(
      `O Banco Central não publica uma série mensal para este índice. Lance os meses à mão.`
    );
  }

  const [ano, mes] = desde.split("-");
  const url =
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie.codigo}/dados` +
    `?formato=json&dataInicial=01/${mes}/${ano}`;

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      // a série inteira do INCC são 384 pontos: é rápido, mas a API do BCB
      // tem dia ruim e uma espera infinita travaria a server action
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "O Banco Central não respondeu. Tente de novo em alguns minutos ou lance o mês à mão."
    );
  }

  if (!resposta.ok) {
    throw new Error(
      `O Banco Central respondeu ${resposta.status}. Tente de novo mais tarde ou lance o mês à mão.`
    );
  }

  const bruto = (await resposta.json()) as LinhaSgs[];
  if (!Array.isArray(bruto)) {
    throw new Error("O Banco Central devolveu uma resposta inesperada.");
  }

  const mesCorrente = competencia(hoje);
  const pontos: PontoDaSerie[] = [];
  const vistas = new Set<string>();

  for (const linha of bruto) {
    const comp = competenciaDoSgs(linha.data);
    if (comp >= mesCorrente) continue;
    if (vistas.has(comp)) continue;
    const n = Number(linha.valor);
    if (!Number.isFinite(n)) continue;
    vistas.add(comp);
    // a API devolve percentual ("0.85"); a série guarda fração
    pontos.push({ competencia: comp, variacao: n / 100 });
  }

  return pontos.sort((a, b) => a.competencia.localeCompare(b.competencia));
}

/** Rótulo da fonte, gravado em cada linha importada. */
export function fonteDoBcb(indexador: Indexador): string {
  const serie = SERIE_SGS[indexador];
  return serie ? `Banco Central · SGS ${serie.codigo}` : "Banco Central";
}

/** Os índices que o botão consegue atualizar sozinho. */
export const INDICES_AUTOMATICOS = Object.keys(SERIE_SGS) as Indexador[];
