import { redirect } from "next/navigation";
import Cabecalho from "@/components/Cabecalho";
import AdminFunil from "@/components/AdminFunil";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/supabase/perfil";
import type { FunilEtapa } from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function AdminFunilPage() {
  const perfil = await perfilAtual();
  if (!perfil?.ehAdmin) redirect("/");

  const supabase = await createClient();
  const [{ data: etapas }, { data: negociacoes }] = await Promise.all([
    supabase.from("funil_etapas").select("*").order("ordem"),
    supabase.from("negociacoes").select("etapa_id"),
  ]);

  // quantos cartões cada coluna tem — admin lê todos, então o número é o real
  const contagem: Record<string, number> = {};
  for (const n of negociacoes ?? []) {
    const id = n.etapa_id as string;
    contagem[id] = (contagem[id] ?? 0) + 1;
  }

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1000px] mx-auto px-5 py-8">
        <AdminFunil
          etapas={(etapas ?? []) as FunilEtapa[]}
          contagem={contagem}
        />
      </main>
    </>
  );
}
