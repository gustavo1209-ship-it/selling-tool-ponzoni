import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import ContratoDetalhe from "@/components/ContratoDetalhe";
import { createClient } from "@/lib/supabase/server";
import { calcularContrato } from "@/lib/contratos/correcao";
import { carregarIndices, serieDe } from "@/lib/contratos/servidor";
import { mapaDePerfis, perfilAtual } from "@/lib/supabase/perfil";
import { obterConfiguracoes } from "@/lib/configuracoes";
import type {
  Cliente,
  ComissaoContrato,
  ComissaoParcela,
  ContratoCompleto,
  EmpreendimentoFoto,
  IndexadorRef,
} from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function ContratoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const perfil = await perfilAtual();
  const ehAdmin = perfil?.ehAdmin ?? false;
  const configuracoes = await obterConfiguracoes();
  // mesmo interruptor granular da listagem — faltava aplicar aqui, e o
  // corretor via o financeiro do contrato inteiro assim que abria um
  const verValor = ehAdmin || configuracoes.corretor_ve_valor_contrato;
  const verRecebido = ehAdmin || configuracoes.corretor_ve_recebido;
  const verSaldoEAtraso = ehAdmin || configuracoes.corretor_ve_saldo_e_atraso;

  const [{ data }, { data: indexadores }, indices, { data: comissao }] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        "*, empreendimento:empreendimentos(*), cliente:clientes(*), lotes:contrato_lotes(*), parcelas:contrato_parcelas(*), campanha:campanhas(nome)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("indexadores").select("*").order("ordem"),
    carregarIndices(),
    supabase
      .from("contrato_comissoes")
      .select("*, parcelas:contrato_comissao_parcelas(*)")
      .eq("contrato_id", id)
      .maybeSingle(),
  ]);

  // a RLS filtra: admin vê todos, corretor só os seus
  const { data: clientes } = await supabase.from("clientes").select("*").order("nome");

  if (!data) notFound();
  const contrato = data as unknown as ContratoCompleto & {
    campanha: { nome: string } | null;
  };

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
  const { data: fotos } = await supabase
    .from("empreendimento_fotos")
    .select("*")
    .eq("empreendimento_id", contrato.empreendimento_id)
    .order("ordem");
  const autores = await mapaDePerfis();
  const comissaoCompleta = comissao as (ComissaoContrato & { parcelas: ComissaoParcela[] }) | null;
  const parcelasComissao = [...(comissaoCompleta?.parcelas ?? [])].sort(
    (a, b) => a.numero - b.numero
  );

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
          fotos={(fotos ?? []) as EmpreendimentoFoto[]}
          autor={autores.get(contrato.criado_por ?? "") ?? null}
          ehAdmin={ehAdmin}
          verValor={verValor}
          verRecebido={verRecebido}
          verSaldoEAtraso={verSaldoEAtraso}
          comissao={comissaoCompleta}
          parcelasComissao={parcelasComissao}
          campanhaNome={contrato.campanha?.nome ?? null}
        />
      </main>
    </>
  );
}
