"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { criarNegociacao } from "@/app/funil/acoes";

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

  const telefone = limpo(formData.get("telefone"));

  const { data: cliente, error } = await supabase
    .from("clientes")
    .insert({
      nome,
      empresa: limpo(formData.get("empresa")),
      documento: limpo(formData.get("documento")),
      email: limpo(formData.get("email")),
      telefone,
      criado_por: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // O cliente nasce dentro do funil de vendas. A tela sempre manda uma
  // etapa (padrão a primeira coluna ativa); sem etapa — funil vazio, sem
  // colunas — o cadastro segue sem cartão, porque não há onde colocá-lo.
  const etapaId = limpo(formData.get("etapa_id"));
  if (etapaId) {
    await criarNegociacao({
      etapa_id: etapaId,
      cliente_id: cliente.id,
      titulo: null,
      telefone,
      empreendimento_id: limpo(formData.get("empreendimento_id")),
      lote_id: limpo(formData.get("lote_id")),
      proposta_id: null,
      contrato_id: null,
      valor_estimado: null,
      origem: null,
      proximo_contato: null,
      observacao: null,
    });
  }

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
