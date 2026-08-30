import Link from "next/link";
import { Plus } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import { SeloProposta } from "@/components/SeloStatus";
import { createClient } from "@/lib/supabase/server";
import { dataBR, moeda, pct } from "@/lib/formato";

export const dynamic = "force-dynamic";

interface Linha {
  id: string;
  codigo: string;
  titulo: string | null;
  status: string;
  criado_em: string;
  desconto_pct: number;
  resultado: {
    valorTabela?: number;
    valorNegociado?: number;
    totalVP?: number;
    totalNominal?: number;
    descontoEfetivoPct?: number;
    prazoMeses?: number;
  } | null;
  clientes: { nome: string } | null;
  empreendimentos: { nome: string } | null;
  proposta_lotes: { quadra: string; numero: string }[];
}

export default async function PropostasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("propostas")
    .select(
      "id, codigo, titulo, status, criado_em, desconto_pct, resultado, clientes(nome), empreendimentos(nome), proposta_lotes(quadra, numero)"
    )
    .order("criado_em", { ascending: false });

  const propostas = (data ?? []) as unknown as Linha[];

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1400px] mx-auto px-5 py-8 flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Comercial</p>
            <h1 className="serif text-3xl mt-1">Propostas</h1>
          </div>
          <Link href="/propostas/nova" className="btn btn-primario">
            <Plus size={16} /> Nova proposta
          </Link>
        </div>

        <section className="cartao overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Lotes</th>
                <th className="num">Tabela</th>
                <th className="num">Negociado</th>
                <th className="num">Desc.</th>
                <th className="num">Valor presente</th>
                <th className="num">Prazo</th>
                <th>Status</th>
                <th>Criada</th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => (
                <tr key={p.id} className="hover:bg-papel-alt">
                  <td className="whitespace-nowrap">
                    <Link href={`/propostas/${p.id}`} className="text-vinho font-semibold">
                      {p.codigo}
                    </Link>
                  </td>
                  <td>{p.clientes?.nome ?? p.titulo ?? "—"}</td>
                  <td className="text-cinza whitespace-nowrap">
                    {p.proposta_lotes.length
                      ? p.proposta_lotes.map((l) => `${l.quadra}-${l.numero}`).join(", ")
                      : "—"}
                  </td>
                  <td className="num text-cinza">{moeda(p.resultado?.valorTabela ?? 0)}</td>
                  <td className="num font-semibold">
                    {moeda(p.resultado?.valorNegociado ?? 0)}
                  </td>
                  <td className="num">
                    {p.resultado?.descontoEfetivoPct
                      ? `−${pct(p.resultado.descontoEfetivoPct, 1)}`
                      : "—"}
                  </td>
                  <td className="num">{moeda(p.resultado?.totalVP ?? 0)}</td>
                  <td className="num text-cinza">
                    {p.resultado?.prazoMeses ? `${p.resultado.prazoMeses}m` : "—"}
                  </td>
                  <td>
                    <SeloProposta status={p.status} />
                  </td>
                  <td className="text-cinza whitespace-nowrap">{dataBR(p.criado_em)}</td>
                </tr>
              ))}
              {propostas.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-cinza py-8">
                    Nenhuma proposta ainda.
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
