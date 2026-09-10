import Cabecalho from "@/components/Cabecalho";
import Kanban from "@/components/Kanban";
import { createClient } from "@/lib/supabase/server";
import { mapaDePerfis, nomeCurto, perfilAtual } from "@/lib/supabase/perfil";
import { ordenarLotes } from "@/lib/ordenacao";
import type {
  Cliente,
  Empreendimento,
  FunilEtapa,
  Lote,
  NegociacaoNoQuadro,
} from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function FunilPage() {
  const supabase = await createClient();
  const perfil = await perfilAtual();

  const [
    { data: etapas },
    { data: negociacoes },
    { data: clientes },
    { data: empreendimentos },
    { data: lotes },
    { data: propostas },
  ] = await Promise.all([
    supabase.from("funil_etapas").select("*").order("ordem"),
    // a RLS já filtra: corretor recebe só as próprias
    supabase
      .from("negociacoes")
      .select(
        "*, cliente:clientes(id, nome, telefone), empreendimento:empreendimentos(id, nome), lote:lotes(id, quadra, numero), proposta:propostas(id, codigo), contrato:contratos(id, codigo)"
      )
      .order("ordem"),
    supabase.from("clientes").select("*").order("nome"),
    supabase.from("empreendimentos").select("*").eq("ativo", true).order("nome"),
    supabase.from("lotes_visiveis").select("*").in("status", ["livre", "reservado"]),
    supabase
      .from("propostas")
      .select("id, codigo, titulo, clientes(nome)")
      .order("criado_em", { ascending: false })
      .limit(200),
  ]);

  // o nome curto é resolvido aqui: `nomeCurto` mora no módulo do cliente
  // Supabase de servidor, e importá-lo do Kanban arrastaria `next/headers`
  // para dentro de um componente cliente
  const autores = await mapaDePerfis();
  const nomes = Object.fromEntries(
    [...autores].map(([id, nome]) => [id, nomeCurto(nome)])
  );

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1600px] mx-auto px-5 py-8">
        <Kanban
          etapas={(etapas ?? []) as FunilEtapa[]}
          negociacoes={(negociacoes ?? []) as unknown as NegociacaoNoQuadro[]}
          clientes={(clientes ?? []) as Cliente[]}
          empreendimentos={(empreendimentos ?? []) as Empreendimento[]}
          lotes={ordenarLotes((lotes ?? []) as Lote[])}
          propostas={
            (propostas ?? []) as unknown as {
              id: string;
              codigo: string;
              titulo: string | null;
              clientes: { nome: string } | null;
            }[]
          }
          autores={nomes}
          ehAdmin={perfil?.ehAdmin ?? false}
        />
      </main>
    </>
  );
}
