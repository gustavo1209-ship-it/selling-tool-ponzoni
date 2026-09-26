import { redirect } from "next/navigation";
import Cabecalho from "@/components/Cabecalho";
import AdminEmpreendimentos from "@/components/AdminEmpreendimentos";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/supabase/perfil";
import type {
  CondicaoPagamento,
  Empreendimento,
  EmpreendimentoFoto,
  IndexadorRef,
  Lote,
  TabelaPreco,
} from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function AdminEmpreendimentosPage() {
  const perfil = await perfilAtual();
  if (!perfil?.ehAdmin) redirect("/");

  const supabase = await createClient();
  const [{ data: empreendimentos }, { data: tabelas }, { data: indexadores }] =
    await Promise.all([
      supabase.from("empreendimentos").select("*").order("ordem"),
      supabase
        .from("tabelas_preco")
        .select("*")
        .eq("ativa", true)
        .order("vigente_desde", { ascending: false }),
      supabase.from("indexadores").select("*").order("ordem"),
    ]);

  const listaTabelas = (tabelas ?? []) as TabelaPreco[];

  const { data: condicoes } = listaTabelas.length
    ? await supabase
        .from("condicoes_pagamento")
        .select("*")
        .in("tabela_preco_id", listaTabelas.map((t) => t.id))
        .order("ordem")
    : { data: [] };

  // uma tabela vigente por empreendimento: a mais recente ganha, que é a
  // mesma escolha do espelho
  const vigentes = new Map<string, TabelaPreco>();
  for (const t of listaTabelas) {
    if (!vigentes.has(t.empreendimento_id)) vigentes.set(t.empreendimento_id, t);
  }

  // imóvel único não passa pelo espelho — o lote (só um) é editado direto
  // nesta tela, então precisa vir junto. Lê de `lotes_visiveis`, não de
  // `lotes` direto: um select("*") na tabela sempre falha por causa da
  // coluna `comprador`, sem SELECT pra authenticated desde a migration 28.
  const idsImovelUnico = (empreendimentos ?? [])
    .filter((e) => e.imovel_unico)
    .map((e) => e.id);
  const { data: lotesUnicos, error: erroLotesUnicos } = idsImovelUnico.length
    ? await supabase.from("lotes_visiveis").select("*").in("empreendimento_id", idsImovelUnico)
    : { data: [], error: null };
  // sem isso, uma falha aqui (ex.: permissão) fica muda — a tela mostra os
  // campos vazios como se nada tivesse sido salvo, em vez de avisar.
  if (erroLotesUnicos) console.error("lotes_visiveis (imóvel único):", erroLotesUnicos.message);

  const idsEmpreendimentos = (empreendimentos ?? []).map((e) => e.id);
  const { data: fotos } = idsEmpreendimentos.length
    ? await supabase
        .from("empreendimento_fotos")
        .select("*")
        .in("empreendimento_id", idsEmpreendimentos)
        .order("ordem")
    : { data: [] };

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1200px] mx-auto px-5 py-8">
        <AdminEmpreendimentos
          empreendimentos={(empreendimentos ?? []) as Empreendimento[]}
          tabelas={[...vigentes.values()]}
          condicoes={(condicoes ?? []) as unknown as CondicaoPagamento[]}
          indexadores={(indexadores ?? []) as unknown as IndexadorRef[]}
          lotesUnicos={(lotesUnicos ?? []) as Lote[]}
          fotos={(fotos ?? []) as EmpreendimentoFoto[]}
        />
      </main>
    </>
  );
}
