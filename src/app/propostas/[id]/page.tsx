import { notFound } from "next/navigation";
import Cabecalho from "@/components/Cabecalho";
import Simulador from "@/components/Simulador";
import { createClient } from "@/lib/supabase/server";
import { compararLote } from "@/lib/ordenacao";
import type {
  CenarioComBlocos,
  Cliente,
  CondicaoPagamento,
  Empreendimento,
  Lote,
  Proposta,
  PropostaBloco,
  PropostaCenario,
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
      "*, empreendimentos(*), clientes(*), proposta_lotes(*), proposta_cenarios(*, proposta_blocos(*))"
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const {
    empreendimentos: empreendimento,
    clientes: cliente,
    proposta_lotes: lotes,
    proposta_cenarios: cenarios,
    ...proposta
  } = data as unknown as Proposta & {
    empreendimentos: Empreendimento;
    clientes: Cliente | null;
    proposta_lotes: PropostaLote[];
    proposta_cenarios: (PropostaCenario & { proposta_blocos: PropostaBloco[] })[];
  };

  const [{ data: disponiveis }, { data: condicoes }] = await Promise.all([
    supabase
      .from("lotes")
      .select("*")
      .eq("empreendimento_id", proposta.empreendimento_id),
    proposta.tabela_preco_id
      ? supabase
          .from("condicoes_pagamento")
          .select("*")
          .eq("tabela_preco_id", proposta.tabela_preco_id)
          .eq("ativa", true)
          .order("ordem")
      : Promise.resolve({ data: [] }),
  ]);

  const cenariosOrdenados: CenarioComBlocos[] = [...(cenarios ?? [])]
    .sort((a, b) => a.ordem - b.ordem)
    .map(({ proposta_blocos, ...c }) => ({
      ...c,
      blocos: [...(proposta_blocos ?? [])].sort((x, y) => x.ordem - y.ordem),
    }));

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1500px] mx-auto px-5 py-8">
        <Simulador
          proposta={proposta}
          empreendimento={empreendimento}
          cliente={cliente}
          lotesIniciais={[...(lotes ?? [])].sort(compararLote)}
          cenariosIniciais={cenariosOrdenados}
          lotesDisponiveis={(disponiveis ?? []) as Lote[]}
          condicoes={(condicoes ?? []) as unknown as CondicaoPagamento[]}
        />
      </main>
    </>
  );
}
