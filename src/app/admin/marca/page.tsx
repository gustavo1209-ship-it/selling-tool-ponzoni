import { redirect } from "next/navigation";
import Cabecalho from "@/components/Cabecalho";
import MarcaForm from "@/components/MarcaForm";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/supabase/perfil";

export const dynamic = "force-dynamic";

export default async function AdminMarcaPage() {
  const perfil = await perfilAtual();
  if (!perfil?.ehAdmin || !perfil.organizacaoId) redirect("/");

  const supabase = await createClient();
  const { data: organizacao } = await supabase
    .from("organizacoes")
    .select("nome, logo_url, cor_primaria, cor_secundaria")
    .eq("id", perfil.organizacaoId)
    .single();

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1000px] mx-auto px-5 py-8 flex flex-col gap-6">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="serif text-3xl mt-1">Marca</h1>
          <p className="text-sm text-cinza mt-1">
            Nome e logo aparecem no topo da ferramenta para todo o seu time. As cores são o
            padrão de um empreendimento novo — cada empreendimento pode ter as suas.
          </p>
        </div>

        <MarcaForm
          nome={organizacao?.nome ?? ""}
          logoUrl={organizacao?.logo_url ?? null}
          corPrimaria={organizacao?.cor_primaria ?? "#5B2166"}
          corSecundaria={organizacao?.cor_secundaria ?? "#C4A550"}
        />
      </main>
    </>
  );
}
