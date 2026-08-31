/**
 * Quando o servidor morre no meio de uma server action, o React devolve
 * "An unexpected response was received from the server" — mensagem que não
 * diz o que interessa: nada foi gravado, o que está na tela não se perdeu, e
 * basta tentar de novo. Ver "Por que o dev roda com webpack" no CLAUDE.md.
 */
export function mensagemDeFalha(e: unknown): string {
  const bruta = e instanceof Error ? e.message : String(e);
  if (/unexpected response|Failed to fetch|fetch failed|NetworkError/i.test(bruta)) {
    return (
      "O servidor não respondeu e nada foi gravado. O que está na tela não " +
      "se perdeu — tente de novo. Se repetir, reinicie o servidor."
    );
  }
  return bruta;
}
