"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface DadosCliente {
  nome: string;
  empresa: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  observacao: string | null;
}

const limpo = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

export async function criarCliente(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const nome = limpo(formData.get("nome"));
  if (!nome) return;

  const { error } = await supabase.from("clientes").insert({
    nome,
    empresa: limpo(formData.get("empresa")),
    documento: limpo(formData.get("documento")),
    email: limpo(formData.get("email")),
    telefone: limpo(formData.get("telefone")),
    criado_por: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/clientes");
}

export async function atualizarCliente(id: string, dados: DadosCliente) {
  const supabase = await createClient();
  const nome = dados.nome.trim();
  if (!nome) throw new Error("O nome do cliente não pode ficar vazio.");

  const { error } = await supabase
    .from("clientes")
    .update({
      nome,
      empresa: dados.empresa?.trim() || null,
      documento: dados.documento?.trim() || null,
      email: dados.email?.trim() || null,
      telefone: dados.telefone?.trim() || null,
      observacao: dados.observacao?.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/clientes");
  revalidatePath("/propostas");
  return { ok: true };
}

export async function apagarCliente(id: string) {
  const supabase = await createClient();

  const { count } = await supabase
    .from("propostas")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", id);

  if (count && count > 0) {
    throw new Error(
      `Este cliente tem ${count} proposta(s). Apague ou reatribua as propostas antes.`
    );
  }

  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/clientes");
}
