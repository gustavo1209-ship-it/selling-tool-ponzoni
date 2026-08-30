import type { LoteStatus } from "@/lib/calc/tipos";

/** CSV com aspas e vírgulas dentro de campo — o Sheets produz os dois. */
export function lerCSV(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          aspas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }
    if (c === '"') aspas = true;
    else if (c === ",") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else if (c !== "\r") {
      campo += c;
    }
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

export function normalizarStatus(bruto: string): LoteStatus | null {
  const s = semAcento(bruto);
  if (!s) return null;
  if (s.startsWith("livre") || s.startsWith("disponi")) return "livre";
  if (s.startsWith("reserv")) return "reservado";
  if (s.startsWith("vend")) return "vendido";
  if (s.startsWith("nao dispon") || s.startsWith("indispon")) return "indisponivel";
  return null;
}

/** "R$ 466.306,29" → 466306.29. Vazio ou lixo → null. */
export function lerValorBR(bruto: string): number | null {
  const limpo = bruto.replace(/[R$\s.]/g, "").replace(",", ".");
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface LinhaEspelho {
  quadra: string;
  numero: string;
  area_m2: number | null;
  preco_tabela: number | null;
  status: LoteStatus | null;
  comprador: string | null;
}

/**
 * Lê o espelho publicado no Google Sheets. O cabeçalho é localizado pelo
 * nome das colunas, não pela posição — a planilha ganha coluna de tempos
 * em tempos e a posição não é estável.
 */
export function lerEspelho(csv: string): LinhaEspelho[] {
  const linhas = lerCSV(csv).filter((l) => l.some((c) => c.trim() !== ""));
  if (linhas.length === 0) return [];

  const idxCabecalho = linhas.findIndex((l) =>
    l.some((c) => semAcento(c) === "quadra")
  );
  if (idxCabecalho < 0) return [];

  const cab = linhas[idxCabecalho].map(semAcento);
  const acha = (...nomes: string[]) =>
    cab.findIndex((c) => nomes.some((n) => c === n || c.startsWith(n)));

  const cQuadra = acha("quadra");
  const cLote = acha("lote");
  const cArea = acha("area");
  const cValor = acha("valor");
  const cStatus = acha("status");
  // o nome do comprador vive numa coluna sem título fixo ("Coluna 1")
  const cComprador = acha("comprador", "cliente", "coluna 1");

  const saida: LinhaEspelho[] = [];
  for (const l of linhas.slice(idxCabecalho + 1)) {
    const quadra = (l[cQuadra] ?? "").trim();
    const numeroBruto = (l[cLote] ?? "").trim();
    if (!quadra || !numeroBruto) continue;
    // ignora a legenda que mora à direita da tabela ("Livre | 19")
    if (!/^\d+$/.test(numeroBruto.replace(/\D/g, ""))) continue;

    saida.push({
      quadra,
      numero: String(parseInt(numeroBruto.replace(/\D/g, ""), 10)),
      area_m2: cArea >= 0 ? lerValorBR(l[cArea] ?? "") : null,
      preco_tabela: cValor >= 0 ? lerValorBR(l[cValor] ?? "") : null,
      status: cStatus >= 0 ? normalizarStatus(l[cStatus] ?? "") : null,
      comprador:
        cComprador >= 0 && (l[cComprador] ?? "").trim() ? l[cComprador].trim() : null,
    });
  }
  return saida;
}
