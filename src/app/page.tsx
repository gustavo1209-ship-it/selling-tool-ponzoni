import Link from "next/link";
import { ArrowRight, FileText, Map, Plus } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import { SeloProposta } from "@/components/SeloStatus";
import { createClient } from "@/lib/supabase/server";
import { dataBR, moeda, moedaCurta, num } from "@/lib/formato";

export const dynamic = "force-dynamic";

interface LinhaProposta {
  id: string;
  codigo: string;
  titulo: string | null;
  status: string;
  criado_em: string;
  resultado: { valorNegociado?: number; totalVP?: number } | null;
  clientes: { nome: string } | null;
  empreendimentos: { nome: string } | null;
}

export default async function Inicio() {
  const supabase = await createClient();

  const [{ data: empreendimentos }, { data: lotes }, { data: propostas }] =
    await Promise.all([
      supabase.from("empreendimentos").select("*").eq("ativo", true).order("nome"),
      supabase.from("lotes").select("status, preco_tabela, area_m2, empreendimento_id"),
      supabase
        .from("propostas")
        .select(
          "id, codigo, titulo, status, criado_em, resultado, clientes(nome), empreendimentos(nome)"
        )
        .order("criado_em", { ascending: false })
        .limit(8),
    ]);

  const recentes = (propostas ?? []) as unknown as LinhaProposta[];

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1400px] mx-auto px-5 py-8 flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Painel</p>
            <h1 className="serif text-3xl mt-1">Ferramenta de vendas</h1>
          </div>
          <Link href="/propostas/nova" className="btn btn-primario">
            <Plus size={16} /> Nova proposta
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(empreendimentos ?? []).map((e) => {
            const meus = (lotes ?? []).filter((l) => l.empreendimento_id === e.id);
            const livres = meus.filter((l) => l.status === "livre");
            const vgv = livres.reduce((s, l) => s + Number(l.preco_tabela ?? 0), 0);
            const areaLivre = livres.reduce((s, l) => s + Number(l.area_m2), 0);

            return (
              <article key={e.id} className="cartao p-5 flex flex-col gap-4">
                <div>
                  <h2 className="serif text-xl">{e.nome}</h2>
                  <p className="text-sm text-cinza">{e.subtitulo ?? "—"}</p>
                </div>

                <dl className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <dt className="eyebrow">Livres</dt>
                    <dd className="text-2xl tabular">{livres.length}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Total</dt>
                    <dd className="text-2xl tabular">{meus.length}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Área livre</dt>
                    <dd className="text-2xl tabular">{num(areaLivre / 1000)}k</dd>
                  </div>
                </dl>

                <div className="bg-vinho-fraco rounded-md px-3 py-2">
                  <p className="eyebrow">VGV disponível (tabela)</p>
                  <p className="serif text-xl text-vinho tabular">{moedaCurta(vgv)}</p>
                </div>

                <div className="flex gap-2 mt-auto">
                  <Link href="/espelho" className="btn btn-secundario flex-1">
                    <Map size={15} /> Espelho
                  </Link>
                  <Link href="/propostas/nova" className="btn btn-secundario flex-1">
                    <FileText size={15} /> Simular
                  </Link>
                </div>
              </article>
            );
          })}
        </section>

        <section className="cartao">
          <div className="cartao-titulo">
            <h2 className="serif text-lg">Propostas recentes</h2>
            <Link
              href="/propostas"
              className="text-sm text-vinho font-semibold inline-flex items-center gap-1"
            >
              ver todas <ArrowRight size={14} />
            </Link>
          </div>

          {recentes.length === 0 ? (
            <p className="p-6 text-sm text-cinza">
              Nenhuma proposta ainda. Comece por{" "}
              <Link href="/propostas/nova" className="text-vinho font-semibold">
                uma nova proposta
              </Link>
              .
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cliente</th>
                    <th>Empreendimento</th>
                    <th className="num">Valor</th>
                    <th className="num">Valor presente</th>
                    <th>Status</th>
                    <th>Criada</th>
                  </tr>
                </thead>
                <tbody>
                  {recentes.map((p) => (
                    <tr key={p.id} className="hover:bg-papel-alt">
                      <td>
                        <Link href={`/propostas/${p.id}`} className="text-vinho font-semibold">
                          {p.codigo}
                        </Link>
                      </td>
                      <td>{p.clientes?.nome ?? p.titulo ?? "—"}</td>
                      <td className="text-cinza">{p.empreendimentos?.nome ?? "—"}</td>
                      <td className="num">{moeda(p.resultado?.valorNegociado ?? 0)}</td>
                      <td className="num text-cinza">{moeda(p.resultado?.totalVP ?? 0)}</td>
                      <td>
                        <SeloProposta status={p.status} />
                      </td>
                      <td className="text-cinza">{dataBR(p.criado_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
