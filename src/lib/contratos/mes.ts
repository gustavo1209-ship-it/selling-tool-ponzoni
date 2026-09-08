/**
 * Aritmética de competência. Uma competência é um mês — "2026-09" —, não um
 * intervalo de dias, e é assim que os índices são publicados e que o
 * acumulado se conta.
 *
 * Datas vindas do Postgres chegam como "YYYY-MM-DD". Elas são convertidas
 * com hora fixa ao meio-dia: `new Date("2026-09-01")` é meia-noite UTC, que
 * no fuso de Brasília cai no dia 31 de agosto — e a competência sairia um
 * mês errada em todo lançamento.
 */

/** "2026-09-15" ou Date → "2026-09". */
export function competencia(valor: string | Date): string {
  if (typeof valor === "string") return valor.slice(0, 7);
  return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" → "2026-09-01", que é como a competência é gravada. */
export function primeiroDia(comp: string): string {
  return `${comp}-01`;
}

/** Converte "YYYY-MM-DD" em Date ao meio-dia local. */
export function paraData(valor: string | Date): Date {
  if (valor instanceof Date) return valor;
  return new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
}

/** "2026-09" + 4 → "2027-01". Aceita n negativo. */
export function somarMeses(comp: string, n: number): string {
  const [ano, mes] = comp.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + n;
  const a = Math.floor(total / 12);
  const m = total - a * 12;
  return `${a}-${String(m + 1).padStart(2, "0")}`;
}

/** Meses de "2026-01" a "2026-07" = 6. Negativo se `ate` vier antes. */
export function mesesEntre(de: string, ate: string): number {
  const [a1, m1] = de.split("-").map(Number);
  const [a2, m2] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

/** ["2026-01", "2026-02", "2026-03"] — inclusive nas duas pontas. */
export function intervaloDeCompetencias(de: string, ate: string): string[] {
  const n = mesesEntre(de, ate);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, k) => somarMeses(de, k));
}

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "2026-09" → "set/26". */
export function rotuloCompetencia(comp: string): string {
  const [ano, mes] = comp.split("-").map(Number);
  return `${MESES[mes - 1]}/${String(ano).slice(2)}`;
}

/** "2026-09" → "setembro de 2026", para texto corrido. */
const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function competenciaPorExtenso(comp: string): string {
  const [ano, mes] = comp.split("-").map(Number);
  return `${MESES_LONGOS[mes - 1]} de ${ano}`;
}

/**
 * Data de vencimento no mês `comp`, no dia pedido. Dia 31 em fevereiro vira
 * o último dia do mês — um cronograma com vencimento no 31 não pode pular
 * fevereiro nem escorregar para março.
 */
export function vencimentoNoMes(comp: string, dia: number): string {
  const [ano, mes] = comp.split("-").map(Number);
  const ultimo = new Date(ano, mes, 0).getDate();
  const d = Math.min(Math.max(1, dia), ultimo);
  return `${comp}-${String(d).padStart(2, "0")}`;
}

/** Dias corridos entre duas datas. Positivo quando `ate` é posterior. */
export function diasEntre(de: string | Date, ate: string | Date): number {
  const d1 = paraData(de).setHours(12, 0, 0, 0);
  const d2 = paraData(ate).setHours(12, 0, 0, 0);
  return Math.round((d2 - d1) / 86_400_000);
}

/** "YYYY-MM-DD" de hoje, no fuso local. */
export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
