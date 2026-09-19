import { redirect } from "next/navigation";
import Cabecalho from "@/components/Cabecalho";
import AdminCampanhas from "@/components/AdminCampanhas";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/supabase/perfil";
import type { Campanha, Empreendimento } from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function AdminCampanhasPage() {
  const perfil = await perfilAtual();
  if (!perfil?.ehAdmin) redirect("/");

  const supabase = await createClient();
  const [{ data: campanhas }, { data: empreendimentos }] = await Promise.all([
    supabase.from("campanhas").select("*").order("inicio", { ascending: false }),
    supabase.from("empreendimentos").select("*").order("nome"),
  ]);

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1100px] mx-auto px-5 py-8">
        <AdminCampanhas
          campanhas={(campanhas ?? []) as Campanha[]}
          empreendimentos={(empreendimentos ?? []) as Empreendimento[]}
        />
      </main>
    </>
  );
}
