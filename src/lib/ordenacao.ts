interface Identificavel {
  quadra: string;
  numero: string;
}

/**
 * Ordena A-1, A-2, … A-9, A-10, A-11 — e não A-1, A-10, A-11, A-2.
 *
 * `numero` é texto no banco (há loteamento com "12A"), então a ordem tem de
 * sair de uma comparação numérica e não da alfabética que o Postgres faz.
 */
export function compararLote(a: Identificavel, b: Identificavel): number {
  const q = a.quadra.localeCompare(b.quadra, "pt-BR", { numeric: true });
  if (q !== 0) return q;
  return a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });
}

export function ordenarLotes<T extends Identificavel>(lotes: T[]): T[] {
  return [...lotes].sort(compararLote);
}
