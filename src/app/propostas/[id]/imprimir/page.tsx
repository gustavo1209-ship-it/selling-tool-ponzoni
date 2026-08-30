import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcular } from "@/lib/calc";
import type { Bloco, Resultado } from "@/lib/calc/tipos";
import { compararLote } from "@/lib/ordenacao";
import type {
  Cliente,
  Empreendimento,
  Proposta,
  PropostaBloco,
  PropostaCenario,
  PropostaLote,
} from "@/lib/db/tipos";
import FolhaProposta from "@/components/FolhaProposta";

export const dynamic = "force-dynamic";

export default async function ImprimirPage({
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

  const lotesOrdenados = [...(lotes ?? [])].sort(compararLote);

  const premissas = {
    incc_mensal: Number(proposta.incc_mensal),
    juros_vp_mensal: Number(proposta.juros_vp_mensal),
    correcao_primeira_parcela: proposta.correcao_primeira_parcela,
  };

  const lotesCalc = lotesOrdenados.map((l) => ({
    quadra: l.quadra,
    numero: l.numero,
    area_m2: Number(l.area_m2),
    preco_tabela: Number(l.preco_tabela),
    valor_negociado: Number(l.valor_negociado),
  }));

  const opcoes: { cenario: PropostaCenario; resultado: Resultado }[] = [
    ...(cenarios ?? []),
  ]
    .sort((a, b) => a.ordem - b.ordem)
    .map(({ proposta_blocos, ...c }) => ({
      cenario: c,
      resultado: calcular({
        lotes: lotesCalc,
        blocos: [...(proposta_blocos ?? [])].sort(
          (x, y) => x.ordem - y.ordem
        ) as unknown as Bloco[],
        premissas,
        desconto_pct: Number(c.desconto_pct),
        desconto_valor: Number(c.desconto_valor),
      }),
    }));

  return (
    <FolhaProposta
      proposta={proposta}
      empreendimento={empreendimento}
      cliente={cliente}
      lotes={lotesOrdenados}
      opcoes={opcoes}
    />
  );
}
