"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { comoResultado, type ResultadoAcao } from "@/lib/resultadoAcao";

/**
 * Primeiro passo de quem acabou de se cadastrar: nasce sem organização
 * (perfis.organizacao_id nulo) e fica preso em /onboarding pelo middleware
 * (`atualizarSessao`) até passar por aqui. `criar_organizacao` é uma RPC
 * `security definer` (migration 43) — ela mesma recusa se o usuário já
 * pertence a uma organização, então não precisa checar aqui de novo.
 */
export async function criarOrganizacao(
  _estadoAnterior: ResultadoAcao | null,
  formData: FormData
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const supabase = await createClient();
    const nome = String(formData.get("nome") ?? "").trim();
    if (!nome) throw new Error("Dê um nome para a sua empresa.");

    const { error } = await supabase.rpc("criar_organizacao", { p_nome: nome });
    if (error) throw new Error(error.message);

    revalidatePath("/", "layout");
    redirect("/");
  });
}
