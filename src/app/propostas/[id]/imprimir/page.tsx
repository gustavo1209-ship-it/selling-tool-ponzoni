import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcular } from "@/lib/calc";
import type { Bloco } from "@/lib/calc/tipos";
import type {
  Cliente,
  Empreendimento,
  Proposta,
  PropostaBloco,
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
    .select("*, empreendimentos(*), clientes(*), proposta_lotes(*), proposta_blocos(*)")
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

  const ordenados = [...(blocos ?? [])].sort((a, b) => a.ordem - b.ordem);
  const lotesOrdenados = [...(lotes ?? [])].sort((a, b) => a.ordem - b.ordem);

  const resultado = calcular({
    lotes: lotesOrdenados.map((l) => ({
      quadra: l.quadra,
      numero: l.numero,
      area_m2: Number(l.area_m2),
      preco_tabela: Number(l.preco_tabela),
      valor_negociado: Number(l.valor_negociado),
    })),
    blocos: ordenados as unknown as Bloco[],
    premissas: {
      incc_mensal: Number(proposta.incc_mensal),
      juros_vp_mensal: Number(proposta.juros_vp_mensal),
      correcao_primeira_parcela: proposta.correcao_primeira_parcela,
    },
    desconto_pct: Number(proposta.desconto_pct),
    desconto_valor: Number(proposta.desconto_valor),
  });

  return (
    <FolhaProposta
      proposta={proposta}
      empreendimento={empreendimento}
      cliente={cliente}
      lotes={lotesOrdenados}
      resultado={resultado}
    />
  );
}
