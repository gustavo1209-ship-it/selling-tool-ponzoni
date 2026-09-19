import type { ContratoLinha } from "@/components/ContratosTabela";
import { valorComissaoEmDinheiro } from "@/lib/comissao";
import { calcularContrato } from "@/lib/contratos/correcao";
import { carregarIndices, serieDe } from "@/lib/contratos/servidor";
import type { ContratoParcela } from "@/lib/db/tipos";
import { compararLote } from "@/lib/ordenacao";
import { mapaDePerfis, nomeCurto } from "@/lib/supabase/perfil";
import type { createClient } from "@/lib/supabase/server";

interface Linha {
  id: string;
  codigo: string;
  titulo: string | null;
  status: string;
  criado_por: string | null;
  data_base: string;
  valor_total: number;
  indexador: string;
  defasagem_indice_meses: number;
  corrige_primeira_parcela: boolean;
  juros_mora_mensal: number;
  multa_atraso_pct: number;
  teste: boolean;
  clientes: { nome: string } | null;
  empreendimentos: { nome: string } | null;
  contrato_lotes: { quadra: string; numero: string }[];
  contrato_parcelas: ContratoParcela[];
}

/**
 * Busca e calcula a lista de contratos (uma linha por contrato, com o
 * cálculo já feito e a comissão embutida) — usado tanto por `/contratos`
 * quanto pelo bloco "Meus contratos" que o corretor vê em `/cobranca`. A
 * RLS já filtra: admin vê todos, corretor só os seus.
 */
export async function carregarResumoDeContratos(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const [{ data }, indices, autores, { data: comissoesData }] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        "id, codigo, titulo, status, criado_por, data_base, valor_total, indexador, defasagem_indice_meses, corrige_primeira_parcela, juros_mora_mensal, multa_atraso_pct, teste, clientes(nome), empreendimentos(nome), contrato_lotes(quadra, numero), contrato_parcelas(*)"
      )
      .order("criado_em", { ascending: false }),
    carregarIndices(),
    mapaDePerfis(),
    supabase
      .from("contrato_comissoes")
      .select(
        "contrato_id, percentual, valor_absoluto, permuta, permuta_valor_abatido, parcelas:contrato_comissao_parcelas(numero, valor, valor_pago, pago_em)"
      ),
  ]);

  const contratos = (data ?? []) as unknown as Linha[];

  // Com cronograma gerado, recebido/pendente vêm das parcelas (o que foi
  // marcado como pago fica registrado, mês a mês). Sem cronograma ainda,
  // tudo conta como pendente — o valor em dinheiro já com a permuta abatida.
  const comissoes = new Map(
    (comissoesData ?? []).map((c) => {
      const parcelas = (c.parcelas ?? []) as {
        numero: number;
        valor: number;
        valor_pago: number | null;
        pago_em: string | null;
      }[];
      const valorEmDinheiro = valorComissaoEmDinheiro({
        valor_absoluto: c.valor_absoluto as number | null,
        permuta: c.permuta as boolean,
        permuta_valor_abatido: c.permuta_valor_abatido as number | null,
      });
      const recebido = parcelas
        .filter((p) => p.pago_em)
        .reduce((s, p) => s + Number(p.valor_pago ?? p.valor), 0);
      const pendente = parcelas.length
        ? parcelas.filter((p) => !p.pago_em).reduce((s, p) => s + Number(p.valor), 0)
        : valorEmDinheiro;
      // a coluna mostra a próxima parcela (valor + posição, tipo "1/12"),
      // não a soma pendente — é o que responde "quanto e quando vem agora"
      const proxima = [...parcelas]
        .sort((a, b) => a.numero - b.numero)
        .find((p) => !p.pago_em);

      return [
        c.contrato_id as string,
        {
          percentual: c.percentual as number | null,
          pendente,
          recebido,
          definida: c.valor_absoluto != null,
          proximaParcelaValor: proxima ? Number(proxima.valor) : null,
          proximaParcelaNumero: proxima?.numero ?? null,
          parcelasTotal: parcelas.length || null,
        },
      ] as const;
    })
  );

  const calculados = contratos.map((c) => {
    const { serie, taxa } = serieDe(indices, c.indexador as never);
    return {
      contrato: c,
      calculo: calcularContrato(
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
      ),
    };
  });

  // teste fica fora de qualquer soma de dinheiro, mas continua listado —
  // é o combinado: dá para gerenciar/apagar sem sujar o financeiro real
  const reais = calculados.filter((c) => !c.contrato.teste);
  const ativos = reais.filter((c) => c.contrato.status === "ativo");
  const carteira = ativos.reduce((s, c) => s + c.calculo.saldoCorrigido, 0);
  const emAtraso = reais.filter((c) => c.calculo.vencidas.length > 0);
  const totalAtraso = emAtraso.reduce((s, c) => s + c.calculo.totalVencido, 0);
  const comissaoAReceber = reais.reduce(
    (s, c) => s + (comissoes.get(c.contrato.id)?.pendente ?? 0),
    0
  );
  const comissaoRecebida = reais.reduce(
    (s, c) => s + (comissoes.get(c.contrato.id)?.recebido ?? 0),
    0
  );

  const linhas: ContratoLinha[] = calculados.map(({ contrato: c, calculo }) => ({
    id: c.id,
    codigo: c.codigo,
    compradorNome: c.clientes?.nome ?? c.titulo ?? "—",
    lotesTexto: c.contrato_lotes.length
      ? [...c.contrato_lotes]
          .sort(compararLote)
          .map((l) => `${l.quadra}-${l.numero}`)
          .join(", ")
      : "—",
    valorTotal: Number(c.valor_total),
    totalPago: calculo.totalPago,
    saldoCorrigido: calculo.saldoCorrigido,
    temEstimativa: calculo.temEstimativa,
    parcelasPagas: calculo.parcelasPagas,
    parcelasTotal: calculo.parcelasTotal,
    proximaVencimento: calculo.proxima?.vencimento ?? null,
    proximaValor: calculo.proxima?.valorCorrigido ?? null,
    totalVencido: calculo.totalVencido,
    temVencidas: calculo.vencidas.length > 0,
    autorNome: nomeCurto(autores.get(c.criado_por ?? "")),
    status: c.status,
    teste: c.teste,
    comissaoPercentual: comissoes.get(c.id)?.percentual ?? null,
    comissaoValor: comissoes.get(c.id)?.definida
      ? (comissoes.get(c.id)?.pendente ?? null)
      : null,
    comissaoProximaValor: comissoes.get(c.id)?.proximaParcelaValor ?? null,
    comissaoProximaNumero: comissoes.get(c.id)?.proximaParcelaNumero ?? null,
    comissaoParcelasTotal: comissoes.get(c.id)?.parcelasTotal ?? null,
  }));

  return { linhas, reais, ativos, carteira, emAtraso, totalAtraso, comissaoAReceber, comissaoRecebida };
}
