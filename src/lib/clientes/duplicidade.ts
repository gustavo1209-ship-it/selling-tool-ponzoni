import type { createClient } from "@/lib/supabase/server";
import { obterConfiguracoes } from "@/lib/configuracoes";

export type ResultadoDuplicidade =
  | { duplicado: false }
  | { duplicado: true; bloqueado: boolean; mensagem: string };

/**
 * `configuracoes.nivel_duplicidade_cliente` (migration 38) decide o que
 * acontece: "desligado" nem chama a função; "avisar" (padrão) devolve
 * `duplicado: true, bloqueado: false` pro chamador inserir mesmo assim;
 * "bloquear" devolve `bloqueado: true` — quem chama tem que recusar o
 * insert e propagar `mensagem` como erro.
 *
 * A checagem em si roda via `cliente_duplicado` (migration 34, ganhou
 * e-mail na 38), uma função SECURITY DEFINER que devolve só um boolean:
 * nunca revela quem é o outro corretor nem o cadastro dele — mantém o
 * combinado da migration 26 mesmo no nível "bloquear".
 */
export async function checarDuplicidade(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dados: {
    nome: string;
    documento: string | null;
    telefone: string | null;
    email: string | null;
  }
): Promise<ResultadoDuplicidade> {
  const { nivel_duplicidade_cliente } = await obterConfiguracoes();
  if (nivel_duplicidade_cliente === "desligado") return { duplicado: false };

  const { data } = await supabase.rpc("cliente_duplicado", {
    p_nome: dados.nome,
    p_documento: dados.documento,
    p_telefone: dados.telefone,
    p_email: dados.email,
  });
  if (!data) return { duplicado: false };

  const bloqueado = nivel_duplicidade_cliente === "bloquear";
  return {
    duplicado: true,
    bloqueado,
    mensagem: bloqueado
      ? "Já existe um cliente cadastrado com este CPF, telefone ou e-mail. Fale com a administração antes de recadastrar."
      : "Atenção: já existe um cliente cadastrado com este CPF, nome/telefone ou e-mail, por outro corretor. O cadastro foi criado mesmo assim.",
  };
}
