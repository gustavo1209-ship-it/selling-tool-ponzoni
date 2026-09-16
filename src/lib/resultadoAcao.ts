/**
 * Em produção (nunca em `npm run dev`) o Next.js troca a mensagem de
 * qualquer erro lançado (`throw`) dentro de uma Server Action por um texto
 * genérico — "An error occurred in the Server Components render…" — para
 * não vazar detalhe interno do servidor. Isso vale tanto para o erro real
 * do banco quanto para uma validação de negócio ("cliente tem propostas",
 * "nome não pode ficar vazio"), e a mensagem que a tela precisa mostrar
 * some junto. Só aparece depois do deploy, o que esconde o problema até
 * alguém bater numa validação em produção.
 *
 * `comoResultado` deixa o corpo da action `throw` normalmente — é o jeito
 * mais legível de validar em sequência — e devolve o erro como dado comum
 * em vez de exceção, que o Next não mexe. A exceção é o `redirect()` do
 * próprio Next: ele também é implementado como um erro especial (digest
 * `NEXT_REDIRECT…`) e precisa atravessar sem ser capturado, senão a
 * navegação para de acontecer.
 */
export type ResultadoAcao<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; erro: string };

function ehRedirecionamento(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function comoResultado<T extends object>(
  fn: () => Promise<T>
): Promise<ResultadoAcao<T>> {
  try {
    const dados = await fn();
    return { ok: true, ...dados };
  } catch (e) {
    if (ehRedirecionamento(e)) throw e;
    return { ok: false, erro: e instanceof Error ? e.message : "Falha inesperada." };
  }
}

/**
 * Contraparte do lado do cliente: os helpers `agir(fn)` espalhados pelos
 * componentes (Kanban, telas de admin, ContratoDetalhe…) chamam uma action e
 * só sabem fazer uma coisa com o que ela devolve — mostrar erro ou seguir em
 * frente. Como o retorno agora é dado, não mais uma exceção, esses helpers
 * precisam checar `ok` explicitamente; sem isso o `{ok:false,...}` passa
 * batido e a tela segue como se tivesse dado certo.
 *
 * Não serve para uma chamada cujo resultado a tela usa em seguida (pegar o
 * `id` recém-criado, por exemplo) — aí o `if (!r.ok) throw` precisa ficar no
 * próprio call site, antes de usar o valor.
 */
export function verificarResultado(r: unknown): void {
  if (
    typeof r === "object" &&
    r !== null &&
    "ok" in r &&
    (r as { ok: unknown }).ok === false &&
    "erro" in r
  ) {
    throw new Error(String((r as { erro: unknown }).erro));
  }
}
