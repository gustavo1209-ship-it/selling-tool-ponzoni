"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Indexador } from "@/lib/calc/tipos";
import { competencia, hojeISO, primeiroDia, somarMeses } from "@/lib/contratos/mes";
import {
  buscarSerieBcb,
  fonteDoBcb,
  INDICES_AUTOMATICOS,
  SERIE_SGS,
} from "@/lib/indices/bcb";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "2026-08" → "ago/2026", que é o formato que `indexadores.referencia` usa. */
function rotuloReferencia(comp: string): string {
  const [ano, mes] = comp.split("-").map(Number);
  return `${MESES[mes - 1]}/${ano}`;
}

export interface LancamentoIndice {
  indexador: Indexador;
  /** "2026-09" — o mês, não o dia. */
  competencia: string;
  /** Fração: 0.0085 para 0,85%. */
  variacao: number;
  fonte: string | null;
  observacao: string | null;
}

/**
 * Lança ou corrige o índice de um mês.
 *
 * É upsert de propósito: o INCC-M sai primeiro como prévia e depois como
 * número fechado, e quem lança volta na mesma competência para acertar. Sem
 * o upsert o segundo lançamento batia na unique e a tela dava erro de
 * banco em cima de uma operação de rotina.
 */
export async function lancarIndice(dados: LancamentoIndice) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const comp = competencia(dados.competencia);
  if (!/^\d{4}-\d{2}$/.test(comp)) {
    throw new Error("Competência inválida. Use o mês no formato AAAA-MM.");
  }
  if (!Number.isFinite(dados.variacao)) {
    throw new Error("Informe a variação do mês.");
  }

  const { error } = await supabase.from("indices_mensais").upsert(
    {
      indexador: dados.indexador,
      competencia: primeiroDia(comp),
      variacao: dados.variacao,
      fonte: dados.fonte?.trim() || null,
      observacao: dados.observacao?.trim() || null,
      criado_por: user.id,
    },
    { onConflict: "indexador,competencia" }
  );
  if (error) throw new Error(error.message);

  await recalcularReferencia(dados.indexador);
  revalidatePath("/indices");
  revalidatePath("/cobranca");
  revalidatePath("/contratos");
  return { ok: true };
}

export async function apagarIndice(id: string) {
  const supabase = await createClient();

  const { data: linha } = await supabase
    .from("indices_mensais")
    .select("indexador")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("indices_mensais").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (linha) await recalcularReferencia(linha.indexador as Indexador);
  revalidatePath("/indices");
  revalidatePath("/cobranca");
  revalidatePath("/contratos");
}

/**
 * Refaz a taxa de referência do índice a partir da série lançada.
 *
 * A regra é a da migration 11 e continua valendo: a taxa mensal sai do
 * ACUMULADO EM 12 MESES, não da variação do mês — projetar o número de um
 * mês só por 36 parcelas produz absurdo (o IGP-M de ago/2026 foi negativo).
 * Com menos de 12 meses lançados a série ainda não sustenta a conta, e a
 * referência fica como está: um acumulado de três meses anualizado é pior
 * que o número que veio da fonte.
 */
export async function recalcularReferencia(codigo: Indexador) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("indices_mensais")
    .select("competencia, variacao")
    .eq("indexador", codigo)
    .order("competencia", { ascending: false })
    .limit(12);

  const linhas = data ?? [];
  if (linhas.length < 12) return { atualizado: false, meses: linhas.length };

  // 12 meses seguidos, sem buraco no meio: um acumulado com mês faltando
  // seria um "12 meses" que não cobre 12 meses
  const maisRecente = competencia(linhas[0].competencia);
  const esperadas = Array.from({ length: 12 }, (_, k) => somarMeses(maisRecente, -k));
  const presentes = new Set(linhas.map((l) => competencia(l.competencia)));
  if (esperadas.some((c) => !presentes.has(c))) {
    return { atualizado: false, meses: linhas.length };
  }

  const acumulado =
    linhas.reduce((f, l) => f * (1 + Number(l.variacao)), 1) - 1;
  const mensal = Math.pow(1 + acumulado, 1 / 12) - 1;

  const { error } = await supabase
    .from("indexadores")
    .update({
      acumulado_12m: Number(acumulado.toFixed(6)),
      variacao_mes: Number(Number(linhas[0].variacao).toFixed(6)),
      taxa_mensal_referencia: Number(mensal.toFixed(6)),
      referencia: rotuloReferencia(maisRecente),
    })
    .eq("codigo", codigo);
  if (error) throw new Error(error.message);

  revalidatePath("/indices");
  return { atualizado: true, meses: 12, acumulado, mensal };
}

export interface ResultadoImportacao {
  indexador: Indexador;
  nome: string;
  /** Meses que não existiam e entraram agora. */
  novos: number;
  /** Meses já lançados que foram substituídos pelo número do BCB. */
  atualizados: number;
  /** Meses já lançados que ficaram como estavam. */
  mantidos: number;
  primeiro: string | null;
  ultimo: string | null;
  erro?: string;
}

/**
 * Puxa a série de um índice no Banco Central e grava o que falta.
 *
 * Por padrão o botão **só completa lacunas**: mês já lançado fica como está.
 * Quem lançou à mão pode ter corrigido um número contra o comunicado da FGV,
 * e uma importação que sobrescreve calada desfaria essa correção sem aviso.
 * `substituir` liga o outro modo, para quando é a série da casa que está
 * errada.
 *
 * Os meses que mudam de valor mexem no boleto de quem já tem contrato, então
 * a função devolve a contagem do que entrou — é o que a tela mostra.
 */
export async function importarSerieBcb(
  indexador: Indexador,
  desde: string,
  substituir = false
): Promise<ResultadoImportacao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const nome = SERIE_SGS[indexador]?.nome ?? indexador;
  const pontos = await buscarSerieBcb(indexador, desde, hojeISO());

  if (pontos.length === 0) {
    return {
      indexador, nome, novos: 0, atualizados: 0, mantidos: 0,
      primeiro: null, ultimo: null,
    };
  }

  const { data: existentes } = await supabase
    .from("indices_mensais")
    .select("competencia, variacao")
    .eq("indexador", indexador)
    .gte("competencia", primeiroDia(pontos[0].competencia));

  const atuais = new Map(
    (existentes ?? []).map((l) => [competencia(l.competencia), Number(l.variacao)])
  );

  const aGravar = pontos.filter((p) => {
    const atual = atuais.get(p.competencia);
    if (atual === undefined) return true;
    if (!substituir) return false;
    // já lançado com o mesmo número não conta como atualização
    return Math.abs(atual - p.variacao) > 1e-9;
  });

  const novos = aGravar.filter((p) => !atuais.has(p.competencia)).length;

  if (aGravar.length > 0) {
    const { error } = await supabase.from("indices_mensais").upsert(
      aGravar.map((p) => ({
        indexador,
        competencia: primeiroDia(p.competencia),
        variacao: p.variacao,
        fonte: fonteDoBcb(indexador),
        criado_por: user.id,
      })),
      { onConflict: "indexador,competencia" }
    );
    if (error) throw new Error(error.message);

    await recalcularReferencia(indexador);
  }

  revalidatePath("/indices");
  revalidatePath("/cobranca");
  revalidatePath("/contratos");

  return {
    indexador,
    nome,
    novos,
    atualizados: aGravar.length - novos,
    mantidos: pontos.length - aGravar.length,
    primeiro: pontos[0].competencia,
    ultimo: pontos[pontos.length - 1].competencia,
  };
}

/**
 * O botão "Atualizar tudo": roda a importação em cada índice que o Banco
 * Central publica.
 *
 * Um índice que falha não derruba os outros — a API do BCB às vezes devolve
 * erro numa série e responde nas demais, e nesse caso o certo é gravar o que
 * deu para gravar e dizer qual ficou de fora.
 */
export async function importarTodasAsSeries(
  desde: string,
  substituir = false
): Promise<ResultadoImportacao[]> {
  const resultados: ResultadoImportacao[] = [];

  for (const codigo of INDICES_AUTOMATICOS) {
    try {
      resultados.push(await importarSerieBcb(codigo, desde, substituir));
    } catch (e) {
      resultados.push({
        indexador: codigo,
        nome: SERIE_SGS[codigo]?.nome ?? codigo,
        novos: 0,
        atualizados: 0,
        mantidos: 0,
        primeiro: null,
        ultimo: null,
        erro: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return resultados;
}
