import type { createClient } from "@/lib/supabase/server";

/**
 * Só avisa, não bloqueia — o combinado da migration 26 é que a carteira de
 * cada corretor é privada, então o duplicado continua possível. A checagem
 * roda via `cliente_duplicado` (migration 34), uma função SECURITY DEFINER
 * que devolve só um boolean: nunca revela quem é o outro corretor nem o
 * cadastro dele.
 */
export async function avisoDuplicidade(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dados: { nome: string; documento: string | null; telefone: string | null }
): Promise<string | null> {
  const { data } = await supabase.rpc("cliente_duplicado", {
    p_nome: dados.nome,
    p_documento: dados.documento,
    p_telefone: dados.telefone,
  });

  return data
    ? "Atenção: já existe um cliente cadastrado com este CPF ou nome e telefone por outro corretor. O cadastro foi criado mesmo assim."
    : null;
}
