import Cabecalho from "@/components/Cabecalho";
import NovaPropostaForm from "@/components/NovaPropostaForm";
import { createClient } from "@/lib/supabase/server";
import type {
  Cliente,
  IndexadorRef,
  CondicaoPagamento,
  Empreendimento,
  Lote,
  TabelaPreco,
} from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function NovaPropostaPage() {
  const supabase = await createClient();

  const [{ data: empreendimentos }, { data: lotes }, { data: tabelas }, { data: clientes }] =
    await Promise.all([
      supabase.from("empreendimentos").select("*").eq("ativo", true).order("nome"),
      supabase
        .from("lotes")
        .select("*")
        .in("status", ["livre", "reservado"]),
      supabase.from("tabelas_preco").select("*").eq("ativa", true),
      supabase.from("clientes").select("*").order("nome"),
    ]);

  const [{ data: condicoes }, { data: indexadores }] = await Promise.all([
    supabase.from("condicoes_pagamento").select("*").eq("ativa", true).order("ordem"),
    supabase.from("indexadores").select("*").order("ordem"),
  ]);

  return (
    <>
      <Cabecalho />
      <main className="max-w-4xl mx-auto px-5 py-8">
        <p className="eyebrow">Comercial</p>
        <h1 className="serif text-3xl mt-1 mb-6">Nova proposta</h1>
        <NovaPropostaForm
          empreendimentos={(empreendimentos ?? []) as Empreendimento[]}
          lotes={(lotes ?? []) as Lote[]}
          tabelas={(tabelas ?? []) as TabelaPreco[]}
          condicoes={(condicoes ?? []) as unknown as CondicaoPagamento[]}
          clientes={(clientes ?? []) as Cliente[]}
          indexadores={(indexadores ?? []) as IndexadorRef[]}
        />
      </main>
    </>
  );
}
