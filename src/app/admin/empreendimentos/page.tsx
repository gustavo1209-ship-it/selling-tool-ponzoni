import { redirect } from "next/navigation";
import Cabecalho from "@/components/Cabecalho";
import AdminEmpreendimentos from "@/components/AdminEmpreendimentos";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/supabase/perfil";
import type {
  CondicaoPagamento,
  Empreendimento,
  IndexadorRef,
  TabelaPreco,
} from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function AdminEmpreendimentosPage() {
  const perfil = await perfilAtual();
  if (!perfil?.ehAdmin) redirect("/");

  const supabase = await createClient();
  const [{ data: empreendimentos }, { data: tabelas }, { data: indexadores }] =
    await Promise.all([
      supabase.from("empreendimentos").select("*").order("nome"),
      supabase
        .from("tabelas_preco")
        .select("*")
        .eq("ativa", true)
        .order("vigente_desde", { ascending: false }),
      supabase.from("indexadores").select("*").order("ordem"),
    ]);

  const listaTabelas = (tabelas ?? []) as TabelaPreco[];

  const { data: condicoes } = listaTabelas.length
    ? await supabase
        .from("condicoes_pagamento")
        .select("*")
        .in("tabela_preco_id", listaTabelas.map((t) => t.id))
        .order("ordem")
    : { data: [] };

  // uma tabela vigente por empreendimento: a mais recente ganha, que é a
  // mesma escolha do espelho
  const vigentes = new Map<string, TabelaPreco>();
  for (const t of listaTabelas) {
    if (!vigentes.has(t.empreendimento_id)) vigentes.set(t.empreendimento_id, t);
  }

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1200px] mx-auto px-5 py-8">
        <AdminEmpreendimentos
          empreendimentos={(empreendimentos ?? []) as Empreendimento[]}
          tabelas={[...vigentes.values()]}
          condicoes={(condicoes ?? []) as unknown as CondicaoPagamento[]}
          indexadores={(indexadores ?? []) as unknown as IndexadorRef[]}
        />
      </main>
    </>
  );
}
