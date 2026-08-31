import { ExternalLink } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import { createClient } from "@/lib/supabase/server";
import type { Empreendimento } from "@/lib/db/tipos";
import MapaSeletor from "@/components/MapaSeletor";

export const dynamic = "force-dynamic";

export default async function MapaPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e: slug } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("empreendimentos")
    .select("*")
    .eq("ativo", true)
    .order("nome");

  const lista = (data ?? []) as Empreendimento[];
  const atual = lista.find((x) => x.slug === slug) ?? lista[0];

  if (!atual?.mapa_url) {
    return (
      <>
        <Cabecalho />
        <main className="max-w-[1400px] mx-auto px-5 py-10">
          <p className="eyebrow">Mapa de lotes</p>
          <h1 className="serif text-3xl mt-1 mb-3">
            {atual?.nome ?? "Sem empreendimento"}
          </h1>
          <p className="text-sm text-cinza">
            Este empreendimento ainda não tem mapa configurado. Preencha{" "}
            <code className="text-vinho">empreendimentos.mapa_url</code> com o
            endereço do HTML do mapa.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1600px] mx-auto px-5 py-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            {atual.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={atual.logo_url}
                alt={atual.nome}
                className="w-12 h-12 rounded object-contain shrink-0"
              />
            )}
            <div>
            <p className="eyebrow">Mapa de lotes</p>
            <h1 className="serif text-3xl mt-1">{atual.nome}</h1>
            <p className="text-sm text-cinza">
              O mesmo mapa do site, com os status vindos do espelho no Google
              Sheets.
            </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapaSeletor empreendimentos={lista} atual={atual} />
            {atual.mapa_publico_url && (
              <a
                href={atual.mapa_publico_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secundario"
              >
                <ExternalLink size={15} /> Página pública
              </a>
            )}
          </div>
        </div>

        <div className="cartao overflow-hidden">
          <iframe
            src={atual.mapa_url}
            title={`Mapa de lotes — ${atual.nome}`}
            className="w-full block border-0"
            style={{ height: "calc(100dvh - 230px)", minHeight: 520 }}
            /* o mapa é o conteúdo da página: carregar já, não em lazy */
            loading="eager"
          />
        </div>
      </main>
    </>
  );
}
