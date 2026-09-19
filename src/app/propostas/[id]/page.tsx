import { notFound } from "next/navigation";
import Cabecalho from "@/components/Cabecalho";
import Simulador from "@/components/Simulador";
import { mapaDePerfis, perfilAtual } from "@/lib/supabase/perfil";
import { createClient } from "@/lib/supabase/server";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { campanhasVigentes } from "@/lib/campanhas";
import { compararLote } from "@/lib/ordenacao";
import type {
  CenarioComBlocos,
  IndexadorRef,
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

  const autores = await mapaDePerfis();
  const perfil = await perfilAtual();
  const configuracoes = await obterConfiguracoes();
  const podeMontarOpcao = (perfil?.ehAdmin ?? false) || configuracoes.corretor_monta_opcao_livre;

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

  const [
    { data: disponiveis },
    { data: condicoes },
    { data: clientes },
    { data: indexadores },
    campanhas,
  ] = await Promise.all([
      supabase
        .from("lotes_visiveis")
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
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("indexadores").select("*").order("ordem"),
      campanhasVigentes(supabase, proposta.empreendimento_id),
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
          autor={autores.get(proposta.criado_por ?? "") ?? null}
          proposta={proposta}
          empreendimento={empreendimento}
          cliente={cliente}
          clientes={(clientes ?? []) as Cliente[]}
          lotesIniciais={[...(lotes ?? [])].sort(compararLote)}
          cenariosIniciais={cenariosOrdenados}
          lotesDisponiveis={(disponiveis ?? []) as Lote[]}
          condicoes={(condicoes ?? []) as unknown as CondicaoPagamento[]}
          campanhas={campanhas}
          indexadores={(indexadores ?? []) as IndexadorRef[]}
          podeMontarOpcao={podeMontarOpcao}
        />
      </main>
    </>
  );
}
