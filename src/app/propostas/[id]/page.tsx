import { notFound } from "next/navigation";
import Cabecalho from "@/components/Cabecalho";
import Simulador from "@/components/Simulador";
import { createClient } from "@/lib/supabase/server";
import type {
  Cliente,
  CondicaoPagamento,
  Empreendimento,
  Lote,
  Proposta,
  PropostaBloco,
  PropostaLote,
} from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function PropostaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("propostas")
    .select(
      "*, empreendimentos(*), clientes(*), proposta_lotes(*), proposta_blocos(*)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const {
    empreendimentos: empreendimento,
    clientes: cliente,
    proposta_lotes: lotes,
    proposta_blocos: blocos,
    ...proposta
  } = data as unknown as Proposta & {
    empreendimentos: Empreendimento;
    clientes: Cliente | null;
    proposta_lotes: PropostaLote[];
    proposta_blocos: PropostaBloco[];
  };

  const [{ data: disponiveis }, { data: condicoes }] = await Promise.all([
    supabase
      .from("lotes")
      .select("*")
      .eq("empreendimento_id", proposta.empreendimento_id)
      .order("quadra")
      .order("numero"),
    proposta.tabela_preco_id
      ? supabase
          .from("condicoes_pagamento")
          .select("*")
          .eq("tabela_preco_id", proposta.tabela_preco_id)
          .eq("ativa", true)
          .order("ordem")
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1500px] mx-auto px-5 py-8">
        <Simulador
          proposta={proposta}
          empreendimento={empreendimento}
          cliente={cliente}
          lotesIniciais={(lotes ?? []).sort((a, b) => a.ordem - b.ordem)}
          blocosIniciais={(blocos ?? []).sort((a, b) => a.ordem - b.ordem)}
          lotesDisponiveis={(disponiveis ?? []) as Lote[]}
          condicoes={(condicoes ?? []) as unknown as CondicaoPagamento[]}
        />
      </main>
    </>
  );
}
