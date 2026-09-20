import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./server";

export type Papel = "corretor" | "admin";

export interface PerfilAtual {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  /** Admin vê e edita tudo; corretor, só o que criou. */
  ehAdmin: boolean;
  /** Null só entre o signup e o passo de onboarding (criar/entrar numa organização). */
  organizacaoId: string | null;
}

/**
 * Quem está usando a ferramenta, com o papel.
 *
 * A RLS é quem realmente separa os dados — isto aqui serve para a tela não
 * oferecer o que o banco vai recusar: menu, botões de edição do espelho e a
 * página de índices. **Não é controle de acesso**; é cortesia de interface.
 * Toda regra de verdade está nas policies da migration 26.
 */
export async function perfilAtual(): Promise<PerfilAtual | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("perfis")
    .select("id, nome, email, papel, organizacao_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;
  const papel = (data.papel as Papel) ?? "corretor";
  return {
    id: data.id,
    nome: data.nome,
    email: data.email,
    papel,
    ehAdmin: papel === "admin",
    organizacaoId: data.organizacao_id,
  };
}

/**
 * `criado_por` → nome, para as listagens mostrarem quem cadastrou.
 *
 * A coluna referencia `auth.users`, e não `perfis`, então o PostgREST não
 * faz o join sozinho. São poucos usuários: carrega todos de uma vez e
 * resolve em memória, em vez de uma consulta por linha.
 */
export async function mapaDePerfis(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("perfis").select("id, nome");
  return new Map((data ?? []).map((p) => [p.id as string, p.nome as string]));
}

/**
 * Só a organização de um usuário, pra server action que já tem o
 * `supabase`/`user.id` em mãos (via `supabase.auth.getUser()`) e não quer
 * pagar o round-trip extra de `perfilAtual()`. Toda tabela raiz grava
 * `organizacao_id` no insert — é o RLS `with check` de cada uma que garante
 * que só serve a própria (migrations 43/44).
 */
export async function organizacaoIdDoUsuario(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("perfis")
    .select("organizacao_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.organizacao_id) throw new Error("Usuário sem organização.");
  return data.organizacao_id as string;
}

/** Primeiro nome e inicial: "Gustavo P." — cabe na coluna da tabela. */
export function nomeCurto(nome: string | undefined | null): string {
  if (!nome) return "—";
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1][0]}.`;
}
