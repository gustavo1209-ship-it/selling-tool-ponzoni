import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import { SeloContrato } from "@/components/SeloStatus";
import { createClient } from "@/lib/supabase/server";
import { calcularContrato } from "@/lib/contratos/correcao";
import { carregarIndices, serieDe } from "@/lib/contratos/servidor";
import { mapaDePerfis, nomeCurto } from "@/lib/supabase/perfil";
import type { ContratoParcela } from "@/lib/db/tipos";
import { dataBR, moeda, moedaCurta } from "@/lib/formato";
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

  const [{ data }, indices] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        "id, codigo, titulo, status, criado_por, data_base, valor_total, indexador, defasagem_indice_meses, corrige_primeira_parcela, juros_mora_mensal, multa_atraso_pct, clientes(nome), empreendimentos(nome), contrato_lotes(quadra, numero), contrato_parcelas(*)"
      )
      .order("criado_em", { ascending: false }),
    carregarIndices(),
  ]);

  const contratos = (data ?? []) as unknown as Linha[];
  const autores = await mapaDePerfis();

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

        <section className="cartao overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Comprador</th>
                <th>Lotes</th>
                <th className="num">Valor</th>
                <th className="num">Recebido</th>
                <th className="num">Saldo corrigido</th>
                <th className="num">Parcelas</th>
                <th>Próximo vencimento</th>
                <th className="num">Em atraso</th>
                <th>Cadastrado por</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {calculados.map(({ contrato: c, calculo }) => (
                <tr key={c.id} className="hover:bg-papel-alt">
                  <td className="whitespace-nowrap">
                    <Link href={`/contratos/${c.id}`} className="text-vinho font-semibold">
                      {c.codigo}
                    </Link>
                  </td>
                  <td>{c.clientes?.nome ?? c.titulo ?? "—"}</td>
                  <td className="text-cinza whitespace-nowrap">
                    {c.contrato_lotes.length
                      ? [...c.contrato_lotes]
                          .sort(compararLote)
                          .map((l) => `${l.quadra}-${l.numero}`)
                          .join(", ")
                      : "—"}
                  </td>
                  <td className="num text-cinza">{moeda(Number(c.valor_total))}</td>
                  <td className="num">{moeda(calculo.totalPago)}</td>
                  <td className="num font-semibold">
                    {moeda(calculo.saldoCorrigido)}
                    {calculo.temEstimativa && (
                      <span
                        className="text-cinza ml-1"
                        title="Parte das parcelas depende de índice ainda não lançado"
                      >
                        ~
                      </span>
                    )}
                  </td>
                  <td className="num text-cinza">
                    {calculo.parcelasPagas}/{calculo.parcelasTotal}
                  </td>
                  <td className="whitespace-nowrap">
                    {calculo.proxima ? (
                      <>
                        {dataBR(calculo.proxima.vencimento)}{" "}
                        <span className="text-cinza">
                          · {moeda(calculo.proxima.valorCorrigido)}
                        </span>
                      </>
                    ) : (
                      <span className="text-cinza">—</span>
                    )}
                  </td>
                  <td className="num">
                    {calculo.vencidas.length > 0 ? (
                      <span className="text-vermelho font-semibold inline-flex items-center gap-1">
                        <AlertTriangle size={13} />
                        {moeda(calculo.totalVencido)}
                      </span>
                    ) : (
                      <span className="text-cinza">—</span>
                    )}
                  </td>
                  <td className="text-cinza whitespace-nowrap">
                    {nomeCurto(autores.get(c.criado_por ?? ""))}
                  </td>
                  <td>
                    <SeloContrato status={c.status} />
                  </td>
                </tr>
              ))}
              {calculados.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center text-cinza py-8">
                    Nenhum contrato ainda. Cadastre uma venda já fechada em{" "}
                    <Link href="/contratos/novo" className="text-vinho font-semibold">
                      Novo contrato
                    </Link>
                    , ou gere um a partir de uma proposta aceita.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
