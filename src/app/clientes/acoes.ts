"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { organizacaoIdDoUsuario } from "@/lib/supabase/perfil";
import { criarNegociacao } from "@/app/funil/acoes";
import { checarDuplicidade } from "@/lib/clientes/duplicidade";
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
export type EstadoNovoCliente = ResultadoAcao<{ aviso?: string }>;

export async function criarCliente(
  _estadoAnterior: EstadoNovoCliente | null,
  formData: FormData
): Promise<EstadoNovoCliente> {
  return comoResultado(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado.");

    const nome = limpo(formData.get("nome"));
    if (!nome) throw new Error("Informe o nome do cliente.");

    const telefone = limpo(formData.get("telefone"));
    const documento = limpo(formData.get("documento"));
    const email = limpo(formData.get("email"));

    const duplicidade = await checarDuplicidade(supabase, {
      nome,
      documento,
      telefone,
      email,
    });
    if (duplicidade.duplicado && duplicidade.bloqueado) {
      throw new Error(duplicidade.mensagem);
    }

    const { data: cliente, error } = await supabase
      .from("clientes")
      .insert({
        nome,
        empresa: limpo(formData.get("empresa")),
        documento,
        email,
        telefone,
        criado_por: user.id,
        organizacao_id: await organizacaoIdDoUsuario(supabase, user.id),
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
    return duplicidade.duplicado ? { aviso: duplicidade.mensagem } : {};
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

    // Mesma trava das propostas: contrato.cliente_id é "on delete set null"
    // (migration 24) — sem essa checagem, apagar o cliente apagaria em
    // silêncio o vínculo de um terreno já vendido com o comprador dele.
    const { count: contagemContratos } = await supabase
      .from("contratos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", id);

    if (contagemContratos && contagemContratos > 0) {
      throw new Error(
        `Este cliente tem ${contagemContratos} contrato(s). Reatribua os contratos antes de apagar.`
      );
    }

    // O cartão do funil vinculado a este cliente confia no nome dele pra se
    // identificar — `negociacoes.titulo` fica vazio assim que `cliente_id`
    // é preenchido (comentário na migration 30). Ao apagar o cliente, a FK
    // zera `cliente_id` sozinha (`on delete set null`); sem um título de
    // reserva, a linha vira um cartão sem nome nenhum e a constraint
    // `negociacoes_tem_nome` recusa esse UPDATE, derrubando o DELETE junto.
    const { data: cliente } = await supabase
      .from("clientes")
      .select("nome")
      .eq("id", id)
      .single();

    if (cliente) {
      await supabase
        .from("negociacoes")
        .update({ titulo: cliente.nome })
        .eq("cliente_id", id)
        .is("titulo", null);
    }

    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/clientes");
    revalidatePath("/funil");
    return {};
  });
}
