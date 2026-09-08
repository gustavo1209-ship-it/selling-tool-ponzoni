import { createClient } from "@/lib/supabase/server";
import type { Indexador } from "@/lib/calc/tipos";
import { montarSeries, type Serie } from "./correcao";
import type { IndiceMensal } from "./tipos";

/**
 * A série de índices e a taxa de projeção de cada um, que é o que toda
 * conta de contrato precisa junto: a série para o que já foi publicado, a
 * taxa para estimar o mês que ainda não saiu.
 *
 * Uma consulta só, carregada por página — a série inteira da casa são
 * algumas centenas de linhas, e paginar por contrato faria N consultas para
 * montar a mesma tabela.
 */
export interface ContextoDeIndices {
  series: Map<Indexador, Serie>;
  taxas: Map<Indexador, number | null>;
}

export async function carregarIndices(): Promise<ContextoDeIndices> {
  const supabase = await createClient();

  const [{ data: linhas }, { data: indexadores }] = await Promise.all([
    supabase.from("indices_mensais").select("*").order("competencia"),
    supabase.from("indexadores").select("codigo, taxa_mensal_referencia"),
  ]);

  return {
    series: montarSeries((linhas ?? []) as IndiceMensal[]),
    taxas: new Map(
      (indexadores ?? []).map((i) => [
        i.codigo as Indexador,
        i.taxa_mensal_referencia === null ? null : Number(i.taxa_mensal_referencia),
      ])
    ),
  };
}

export function serieDe(ctx: ContextoDeIndices, indexador: Indexador) {
  return {
    serie: ctx.series.get(indexador),
    taxa: ctx.taxas.get(indexador) ?? null,
  };
}
