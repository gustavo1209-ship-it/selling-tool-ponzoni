const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const brlCurto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const numero = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const moeda = (v: number | null | undefined) => brl.format(v ?? 0);
export const moedaCurta = (v: number | null | undefined) => brlCurto.format(v ?? 0);
export const num = (v: number | null | undefined) => numero.format(v ?? 0);

/** 0,065 → "6,5%". `casas` controla as decimais. */
export function pct(v: number | null | undefined, casas = 2): string {
  const n = (v ?? 0) * 100;
  const s = n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  });
  return `${s}%`;
}

export const area = (v: number | null | undefined) => `${num(v)} m²`;

/**
 * Desconto e acréscimo saem do mesmo número: o Florescer guarda o preço à
 * vista como preço de tabela, então prazos maiores entram com percentual
 * negativo. "−12,82%", "+12,82%" ou "—".
 */
export function descontoOuAcrescimo(
  v: number | null | undefined,
  casas = 2
): string {
  const n = v ?? 0;
  if (Math.abs(n) < 0.0001) return "—";
  return `${n > 0 ? "−" : "+"}${pct(Math.abs(n), casas)}`;
}

export const precoM2 = (v: number | null | undefined) => `${moeda(v)}/m²`;

/** Aceita "1.234,56", "1234.56" e "R$ 1.234,56". */
export function paraNumero(texto: string): number {
  const limpo = texto
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Mês 0 = "no ato"; mês 7 a partir de 2026-08 = "mar/27". */
export function rotuloMes(mes: number, dataBase: string | Date): string {
  if (mes === 0) return "no ato";
  const base = typeof dataBase === "string" ? new Date(`${dataBase}T12:00:00`) : dataBase;
  const d = new Date(base.getFullYear(), base.getMonth() + mes, 1);
  return `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

export function dataBR(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  const d = typeof valor === "string" ? new Date(valor.length === 10 ? `${valor}T12:00:00` : valor) : valor;
  return d.toLocaleDateString("pt-BR");
}

export const ROTULO_STATUS_LOTE: Record<string, string> = {
  livre: "Livre",
  reservado: "Reservado",
  vendido: "Vendido",
  projeto: "Projeto",
  indisponivel: "Não disponível",
};

export const ROTULO_STATUS_PROPOSTA: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  em_negociacao: "Em negociação",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
};

export const ROTULO_AMORTIZACAO: Record<string, string> = {
  nenhuma: "Sem juros",
  sac: "SAC",
  price: "Price",
  americano: "Americano",
};

export const ROTULO_INDEXADOR: Record<string, string> = {
  nenhum: "Sem correção",
  incc: "INCC-M",
  igpm: "IGP-M",
  ipca: "IPCA",
  inpc: "INPC",
  igpdi: "IGP-DI",
  cub: "CUB-RS",
  tr: "TR",
  cdi: "CDI",
  selic: "Selic",
};

/** Reforço semestral vira "a cada 6 meses" na tela e "semestrais" no texto. */
export const ROTULO_PERIODICIDADE: Record<number, string> = {
  1: "Mensal",
  2: "Bimestral",
  3: "Trimestral",
  4: "Quadrimestral",
  6: "Semestral",
  12: "Anual",
};

export const ADJETIVO_PERIODICIDADE: Record<number, string> = {
  1: "mensais",
  2: "bimestrais",
  3: "trimestrais",
  4: "quadrimestrais",
  6: "semestrais",
  12: "anuais",
};

export function rotuloPeriodicidade(meses: number): string {
  return ROTULO_PERIODICIDADE[meses] ?? `A cada ${meses} meses`;
}

export function adjetivoPeriodicidade(meses: number): string {
  return ADJETIVO_PERIODICIDADE[meses] ?? `a cada ${meses} meses`;
}

export const ROTULO_METRICA_PARCELA: Record<string, string> = {
  inicial: "Parcela inicial",
  media: "Parcela média",
  final: "Parcela final",
  maior: "Maior parcela",
};

/** Explica cada métrica onde ela aparece — nenhuma é óbvia sozinha. */
export const NOTA_METRICA_PARCELA: Record<string, string> = {
  inicial: "1º vencimento",
  media: "média dos vencimentos",
  final: "último vencimento",
  maior: "mês de maior soma",
};

export const METRICAS_PARCELA = ["inicial", "media", "final", "maior"] as const;

export const ROTULO_TIPO_BLOCO: Record<string, string> = {
  entrada: "Entrada",
  sinal: "Sinal",
  parcelas: "Parcelas",
  balao: "Balão",
  financiamento: "Financiamento",
};
