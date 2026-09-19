import Link from "next/link";
import { Plus } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import ContratosTabela from "@/components/ContratosTabela";
import { createClient } from "@/lib/supabase/server";
import { carregarResumoDeContratos } from "@/lib/contratos/resumo";
import { perfilAtual } from "@/lib/supabase/perfil";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { moedaCurta } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function ContratosPage() {
  const supabase = await createClient();

  const [perfil, configuracoes, resumo] = await Promise.all([
    perfilAtual(),
    obterConfiguracoes(),
    carregarResumoDeContratos(supabase),
  ]);

  const { linhas, reais, ativos, carteira, emAtraso, totalAtraso, comissaoAReceber, comissaoRecebida } =
    resumo;
  const ehAdmin = perfil?.ehAdmin ?? false;
  // admin sempre vê tudo; cada interruptor em Admin > Configurações só
  // amplia o que o corretor enxerga, nunca restringe o admin
  const verValor = ehAdmin || configuracoes.corretor_ve_valor_contrato;
  const verRecebido = ehAdmin || configuracoes.corretor_ve_recebido;
  const verSaldoEAtraso = ehAdmin || configuracoes.corretor_ve_saldo_e_atraso;

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
              {ehAdmin ? "A receber do mês" : "Minha comissão"}
            </Link>
            <Link href="/contratos/novo" className="btn btn-primario">
              <Plus size={16} /> Novo contrato
            </Link>
          </div>
        </div>

        {!ehAdmin && configuracoes.alertar_parcela_atrasada && emAtraso.length > 0 && (
          <p className="text-sm text-ambar bg-ambar-fraco rounded-md px-3 py-2">
            Você tem {emAtraso.length} contrato(s) com parcela em atraso.
          </p>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="cartao p-4">
            <p className="eyebrow">Contratos ativos</p>
            <p className="serif text-2xl tabular mt-1">{ativos.length}</p>
            <p className="text-xs text-cinza mt-1">de {reais.length} no total</p>
          </div>
          {verSaldoEAtraso && (
            <div className="cartao p-4">
              <p className="eyebrow">Carteira a receber</p>
              <p className="serif text-2xl tabular mt-1 text-vinho">
                {moedaCurta(carteira)}
              </p>
              <p className="text-xs text-cinza mt-1">saldo corrigido dos ativos</p>
            </div>
          )}
          {verRecebido && (
            <div className="cartao p-4">
              <p className="eyebrow">Já recebido</p>
              <p className="serif text-2xl tabular mt-1">
                {moedaCurta(reais.reduce((s, c) => s + c.calculo.totalPago, 0))}
              </p>
              <p className="text-xs text-cinza mt-1">
                {reais.reduce((s, c) => s + c.calculo.parcelasPagas, 0)} parcelas
                baixadas
              </p>
            </div>
          )}
          {verSaldoEAtraso && (
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
          )}
          {ehAdmin && (
            <>
              <div className="cartao p-4">
                <p className="eyebrow">Comissão a receber</p>
                <p className="serif text-2xl tabular mt-1 text-vinho">
                  {moedaCurta(comissaoAReceber)}
                </p>
                <p className="text-xs text-cinza mt-1">
                  parcelas ainda não pagas, com cronograma ou não
                </p>
              </div>
              <div className="cartao p-4">
                <p className="eyebrow">Comissão recebida</p>
                <p className="serif text-2xl tabular mt-1 text-verde">
                  {moedaCurta(comissaoRecebida)}
                </p>
                <p className="text-xs text-cinza mt-1">parcelas já dadas como pagas</p>
              </div>
            </>
          )}
        </section>

        <ContratosTabela
          contratos={linhas}
          ehAdmin={ehAdmin}
          verValor={verValor}
          verRecebido={verRecebido}
          verSaldoEAtraso={verSaldoEAtraso}
        />
      </main>
    </>
  );
}
