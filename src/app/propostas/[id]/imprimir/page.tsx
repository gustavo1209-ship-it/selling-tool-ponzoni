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

  // Sem escolha em Admin > Empreendimentos (fotos_proposta_ids), cai na
  // primeira foto da galeria por ordem — mesmo comportamento de quando só
  // existia mapa_imagem_url, agora explícito.
  const { data: fotos } = await supabase
    .from("empreendimento_fotos")
    .select("id, url")
    .eq("empreendimento_id", empreendimento.id)
    .order("ordem");
  const escolhidas = empreendimento.fotos_proposta_ids.length
    ? empreendimento.fotos_proposta_ids
    : fotos?.[0]
      ? [fotos[0].id]
      : [];
  const fotoUrls = escolhidas
    .map((id) => (fotos ?? []).find((f) => f.id === id)?.url)
    .filter((url): url is string => !!url);

  // área construída e descrição não são snapshot da proposta (só existem em
  // `lotes`, não em `proposta_lotes`) — busca ao vivo pelos lote_id. Um lote
  // apagado depois de a proposta ser criada (lote_id nulo) simplesmente não
  // ganha esses dois campos, sem erro.
  const idsLote = (lotes ?? []).map((l) => l.lote_id).filter((v): v is string => !!v);
  const { data: detalhesLote } = idsLote.length
    ? await supabase.from("lotes").select("id, area_construida_m2, descricao").in("id", idsLote)
    : { data: [] };
  const porLoteId = new Map((detalhesLote ?? []).map((d) => [d.id, d]));

  const lotesOrdenados = [...(lotes ?? [])]
    .sort(compararLote)
    .map((l) => ({
      ...l,
      area_construida_m2: l.lote_id ? (porLoteId.get(l.lote_id)?.area_construida_m2 ?? null) : null,
      descricao: l.lote_id ? (porLoteId.get(l.lote_id)?.descricao ?? null) : null,
    }));

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
      fotoUrls={fotoUrls}
    />
  );
}
