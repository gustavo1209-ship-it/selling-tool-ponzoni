import { redirect } from "next/navigation";
import Cabecalho from "@/components/Cabecalho";
import AdminCorretores from "@/components/AdminCorretores";
import ConvidarForm from "@/components/ConvidarForm";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/supabase/perfil";
import type { Empreendimento, Perfil } from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function AdminCorretoresPage() {
  const perfil = await perfilAtual();
  if (!perfil?.ehAdmin) redirect("/");

  const supabase = await createClient();
  const [{ data: perfis }, { data: empreendimentos }, { data: vinculos }] =
    await Promise.all([
      supabase
        .from("perfis")
        .select("id, nome, email, papel, empreendimentos_restritos")
        .order("nome"),
      supabase.from("empreendimentos").select("*").order("ordem"),
      supabase
        .from("corretor_empreendimentos")
        .select("perfil_id, empreendimento_id"),
    ]);

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1100px] mx-auto px-5 py-8 flex flex-col gap-6">
        <ConvidarForm />
        <AdminCorretores
          eu={perfil.id}
          perfis={(perfis ?? []) as Perfil[]}
          empreendimentos={(empreendimentos ?? []) as Empreendimento[]}
          vinculos={
            (vinculos ?? []) as { perfil_id: string; empreendimento_id: string }[]
          }
        />
      </main>
    </>
  );
}
