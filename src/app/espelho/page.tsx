import Cabecalho from "@/components/Cabecalho";
import EspelhoTabela from "@/components/EspelhoTabela";
import { createClient } from "@/lib/supabase/server";
import type { Empreendimento, Lote, TabelaPreco } from "@/lib/db/tipos";
import type { CondicaoPagamento } from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function EspelhoPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e: slug } = await searchParams;
  const supabase = await createClient();

  const { data: empreendimentos } = await supabase
    .from("empreendimentos")
    .select("*")
    .eq("ativo", true)
    .order("nome");

  const lista = (empreendimentos ?? []) as Empreendimento[];
  const atual = lista.find((x) => x.slug === slug) ?? lista[0];

  if (!atual) {
    return (
      <>
        <Cabecalho />
        <main className="max-w-[1400px] mx-auto px-5 py-10">
          <p className="text-sm text-cinza">Nenhum empreendimento cadastrado.</p>
        </main>
      </>
    );
  }

  const [{ data: lotes }, { data: tabela }] = await Promise.all([
    supabase
      .from("lotes")
      .select("*")
      .eq("empreendimento_id", atual.id)
      .order("quadra")
      .order("numero"),
    supabase
      .from("tabelas_preco")
      .select("*")
      .eq("empreendimento_id", atual.id)
      .eq("ativa", true)
      .order("vigente_desde", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const { data: condicoes } = tabela
    ? await supabase
        .from("condicoes_pagamento")
        .select("*")
        .eq("tabela_preco_id", (tabela as TabelaPreco).id)
        .eq("ativa", true)
        .order("ordem")
    : { data: [] };

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1400px] mx-auto px-5 py-8">
        <EspelhoTabela
          empreendimentos={lista}
          empreendimento={atual}
          lotes={(lotes ?? []) as Lote[]}
          tabela={(tabela ?? null) as TabelaPreco | null}
          condicoes={(condicoes ?? []) as unknown as CondicaoPagamento[]}
        />
      </main>
    </>
  );
}
