import { notFound } from "next/navigation";
import FolhaDemonstrativo from "@/components/FolhaDemonstrativo";
import { createClient } from "@/lib/supabase/server";
import { calcularContrato } from "@/lib/contratos/correcao";
import { carregarIndices, serieDe } from "@/lib/contratos/servidor";
import type { ContratoCompleto } from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function DemonstrativoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data }, indices] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        "*, empreendimento:empreendimentos(*), cliente:clientes(*), lotes:contrato_lotes(*), parcelas:contrato_parcelas(*)"
      )
      .eq("id", id)
      .maybeSingle(),
    carregarIndices(),
  ]);

  if (!data) notFound();
  const contrato = data as unknown as ContratoCompleto;

  // Sem escolha em Admin > Empreendimentos (fotos_contrato_ids), cai na
  // primeira foto da galeria por ordem.
  const { data: fotos } = await supabase
    .from("empreendimento_fotos")
    .select("id, url")
    .eq("empreendimento_id", contrato.empreendimento.id)
    .order("ordem");
  const escolhidas = contrato.empreendimento.fotos_contrato_ids.length
    ? contrato.empreendimento.fotos_contrato_ids
    : fotos?.[0]
      ? [fotos[0].id]
      : [];
  const fotoUrls = escolhidas
    .map((id) => (fotos ?? []).find((f) => f.id === id)?.url)
    .filter((url): url is string => !!url);

  const { serie, taxa } = serieDe(indices, contrato.indexador);
  const calculo = calcularContrato(
    {
      data_base: contrato.data_base,
      indexador: contrato.indexador,
      defasagem_indice_meses: contrato.defasagem_indice_meses,
      corrige_primeira_parcela: contrato.corrige_primeira_parcela,
      juros_mora_mensal: Number(contrato.juros_mora_mensal),
      multa_atraso_pct: Number(contrato.multa_atraso_pct),
      valor_total: Number(contrato.valor_total),
    },
    contrato.parcelas,
    serie,
    taxa
  );

  return (
    <FolhaDemonstrativo
      contrato={contrato}
      empreendimento={contrato.empreendimento}
      cliente={contrato.cliente}
      lotes={[...contrato.lotes].sort((a, b) => a.ordem - b.ordem)}
      calculo={calculo}
      fotoUrls={fotoUrls}
    />
  );
}
