import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import ContratoDetalhe from "@/components/ContratoDetalhe";
import { createClient } from "@/lib/supabase/server";
import { calcularContrato } from "@/lib/contratos/correcao";
import { carregarIndices, serieDe } from "@/lib/contratos/servidor";
import { mapaDePerfis } from "@/lib/supabase/perfil";
import type { Cliente, ContratoCompleto, IndexadorRef } from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function ContratoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data }, { data: indexadores }, indices] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        "*, empreendimento:empreendimentos(*), cliente:clientes(*), lotes:contrato_lotes(*), parcelas:contrato_parcelas(*)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("indexadores").select("*").order("ordem"),
    carregarIndices(),
  ]);

  // a RLS filtra: admin vê todos, corretor só os seus
  const { data: clientes } = await supabase.from("clientes").select("*").order("nome");

  if (!data) notFound();
  const contrato = data as unknown as ContratoCompleto;

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

  const lotes = [...contrato.lotes].sort((a, b) => a.ordem - b.ordem);
  const autores = await mapaDePerfis();

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1500px] mx-auto px-5 py-8">
        <Link
          href="/contratos"
          className="text-sm text-cinza inline-flex items-center gap-1 mb-4"
        >
          <ArrowLeft size={14} /> Contratos
        </Link>

        <ContratoDetalhe
          contrato={contrato}
          empreendimento={contrato.empreendimento}
          cliente={contrato.cliente}
          lotes={lotes}
          calculo={calculo}
          indexadores={(indexadores ?? []) as IndexadorRef[]}
          clientes={(clientes ?? []) as Cliente[]}
          autor={autores.get(contrato.criado_por ?? "") ?? null}
        />
      </main>
    </>
  );
}
