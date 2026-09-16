"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { criarNegociacao } from "@/app/funil/acoes";
import { comoResultado, type ResultadoAcao } from "@/lib/resultadoAcao";

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

/**
 * Assinatura `(estadoAnterior, formData)` de propósito: é o formato que
 * `useActionState` exige — ver `comoResultado` em `@/lib/resultadoAcao`.
 * Sem isso, uma validação daqui (ou o erro real do banco) chegava à tela
 * como "An error occurred in the Server Components render…" em produção,
 * nunca em `npm run dev`, o que escondeu o problema por um tempo.
 */
export async function criarCliente(
  _estadoAnterior: ResultadoAcao | null,
  formData: FormData
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado.");

    const nome = limpo(formData.get("nome"));
    if (!nome) throw new Error("Informe o nome do cliente.");

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
      const resultado = await criarNegociacao({
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
      if (!resultado.ok) throw new Error(resultado.erro);
    }

    revalidatePath("/clientes");
    return {};
  });
}

export async function atualizarCliente(
  id: string,
  dados: DadosCliente
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
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
    return {};
  });
}

export async function apagarCliente(id: string): Promise<ResultadoAcao> {
  return comoResultado(async () => {
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
    return {};
  });
}
