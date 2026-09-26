import Cabecalho from "@/components/Cabecalho";
import ClientesTabela, {
  type ClienteComPropostas,
} from "@/components/ClientesTabela";
import NovoClienteForm from "@/components/NovoClienteForm";
import { createClient } from "@/lib/supabase/server";
import { mapaDePerfis, nomeCurto } from "@/lib/supabase/perfil";
import type { Empreendimento, FunilEtapa, Lote } from "@/lib/db/tipos";
import { ordenarLotes } from "@/lib/ordenacao";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const supabase = await createClient();
  const [
    { data },
    { data: etapas },
    { data: empreendimentos },
    { data: lotes },
    autores,
  ] = await Promise.all([
    supabase
      .from("clientes")
      .select("*, propostas(id, codigo), contratos(id, codigo)")
      .order("nome"),
    supabase.from("funil_etapas").select("*").eq("ativa", true).order("ordem"),
    supabase.from("empreendimentos").select("*").eq("ativo", true).order("ordem"),
    supabase.from("lotes_visiveis").select("*"),
    mapaDePerfis(),
  ]);

  const clientes = ((data ?? []) as unknown as ClienteComPropostas[]).map((c) => ({
    ...c,
    autorNome: nomeCurto(autores.get(c.criado_por ?? "")),
  }));

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1300px] mx-auto px-5 py-8 flex flex-col gap-6">
        <div>
          <p className="eyebrow">Comercial</p>
          <h1 className="serif text-3xl mt-1">Clientes</h1>
          <p className="text-sm text-cinza mt-1">
            Clique no lápis para editar. Os dados também podem ser ajustados de
            dentro da proposta.
          </p>
        </div>

        <NovoClienteForm
          etapas={(etapas ?? []) as FunilEtapa[]}
          empreendimentos={(empreendimentos ?? []) as Empreendimento[]}
          lotes={ordenarLotes((lotes ?? []) as Lote[])}
        />

        <ClientesTabela clientes={clientes} />
      </main>
    </>
  );
}
