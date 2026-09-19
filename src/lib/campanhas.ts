import { hojeISO } from "@/lib/contratos/mes";
import type { Campanha } from "@/lib/db/tipos";
import type { createClient } from "@/lib/supabase/server";

/** Campanhas de um empreendimento com desconto liberado hoje. */
export async function campanhasVigentes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empreendimentoId: string
): Promise<Campanha[]> {
  const hoje = hojeISO();
  const { data } = await supabase
    .from("campanhas")
    .select("*")
    .eq("empreendimento_id", empreendimentoId)
    .eq("ativa", true)
    .lte("inicio", hoje)
    .gte("fim", hoje)
    .order("nome");
  return (data ?? []) as Campanha[];
}
