import { notFound } from "next/navigation";
import FolhaEspelho from "@/components/FolhaEspelho";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/supabase/perfil";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { ordenarLotes } from "@/lib/ordenacao";
import type { Empreendimento, Lote } from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function EspelhoImprimirPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e: slug } = await searchParams;
  const supabase = await createClient();
  const perfil = await perfilAtual();
  const configuracoes = await obterConfiguracoes();
  const ehAdmin = perfil?.ehAdmin ?? false;
  const mostrarComprador = ehAdmin || configuracoes.corretor_ve_comprador;
  const mostrarVgv = ehAdmin || configuracoes.corretor_ve_vgv;

  const { data: empreendimentos } = await supabase
    .from("empreendimentos")
    .select("*")
    .eq("ativo", true)
    .order("nome");

  const lista = (empreendimentos ?? []) as Empreendimento[];
  const atual = lista.find((x) => x.slug === slug) ?? lista[0];
  if (!atual) notFound();

  const { data: lotes } = await supabase
    .from("lotes_visiveis")
    .select("*")
    .eq("empreendimento_id", atual.id);

  return (
    <FolhaEspelho
      empreendimento={atual}
      lotes={ordenarLotes((lotes ?? []) as Lote[])}
      mostrarComprador={mostrarComprador}
      mostrarVgv={mostrarVgv}
    />
  );
}
