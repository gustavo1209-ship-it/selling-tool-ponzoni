import Link from "next/link";
import { Plus } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import ContratosTabela, { type ContratoLinha } from "@/components/ContratosTabela";
import { createClient } from "@/lib/supabase/server";
import { calcularContrato } from "@/lib/contratos/correcao";
import { carregarIndices, serieDe } from "@/lib/contratos/servidor";
import { mapaDePerfis, nomeCurto, perfilAtual } from "@/lib/supabase/perfil";
import type { ContratoParcela } from "@/lib/db/tipos";
import { moedaCurta } from "@/lib/formato";
import { compararLote } from "@/lib/ordenacao";

export const dynamic = "force-dynamic";

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
  clientes: { nome: string } | null;
  empreendimentos: { nome: string } | null;
  contrato_lotes: { quadra: string; numero: string }[];
  contrato_parcelas: ContratoParcela[];
}

export default async function ContratosPage() {
  const supabase = await createClient();

  const [{ data }, indices, autores, perfil] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        "id, codigo, titulo, status, criado_por, data_base, valor_total, indexador, defasagem_indice_meses, corrige_primeira_parcela, juros_mora_mensal, multa_atraso_pct, clientes(nome), empreendimentos(nome), contrato_lotes(quadra, numero), contrato_parcelas(*)"
      )
      .order("criado_em", { ascending: false }),
    carregarIndices(),
    mapaDePerfis(),
    perfilAtual(),
  ]);

  const contratos = (data ?? []) as unknown as Linha[];
  const ehAdmin = perfil?.ehAdmin ?? false;

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

  const ativos = calculados.filter((c) => c.contrato.status === "ativo");
  const carteira = ativos.reduce((s, c) => s + c.calculo.saldoCorrigido, 0);
  const emAtraso = calculados.filter((c) => c.calculo.vencidas.length > 0);
  const totalAtraso = emAtraso.reduce((s, c) => s + c.calculo.totalVencido, 0);

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
  }));

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1500px] mx-auto px-5 py-8 flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Financeiro</p>
            <h1 className="serif text-3xl mt-1">Contratos</h1>
            <p className="text-sm text-cinza mt-1">
              Terrenos vendidos e o que ainda há para receber deles.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/cobranca" className="btn btn-secundario">
              A receber do mês
            </Link>
            <Link href="/contratos/novo" className="btn btn-primario">
              <Plus size={16} /> Novo contrato
            </Link>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="cartao p-4">
            <p className="eyebrow">Contratos ativos</p>
            <p className="serif text-2xl tabular mt-1">{ativos.length}</p>
            <p className="text-xs text-cinza mt-1">de {calculados.length} no total</p>
          </div>
          <div className="cartao p-4">
            <p className="eyebrow">Carteira a receber</p>
            <p className="serif text-2xl tabular mt-1 text-vinho">
              {moedaCurta(carteira)}
            </p>
            <p className="text-xs text-cinza mt-1">saldo corrigido dos ativos</p>
          </div>
          <div className="cartao p-4">
            <p className="eyebrow">Já recebido</p>
            <p className="serif text-2xl tabular mt-1">
              {moedaCurta(calculados.reduce((s, c) => s + c.calculo.totalPago, 0))}
            </p>
            <p className="text-xs text-cinza mt-1">
              {calculados.reduce((s, c) => s + c.calculo.parcelasPagas, 0)} parcelas
              baixadas
            </p>
          </div>
          <div className="cartao p-4">
            <p className="eyebrow">Em atraso</p>
            <p
              className={`serif text-2xl tabular mt-1 ${
                totalAtraso > 0 ? "text-vermelho" : ""
              }`}
            >
              {moedaCurta(totalAtraso)}
            </p>
            <p className="text-xs text-cinza mt-1">
              {emAtraso.length} contrato(s) com parcela vencida
            </p>
          </div>
        </section>

        <ContratosTabela contratos={linhas} ehAdmin={ehAdmin} />
      </main>
    </>
  );
}
