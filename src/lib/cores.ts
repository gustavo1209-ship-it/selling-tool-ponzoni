/**
 * Tons derivados da cor do empreendimento.
 *
 * Cada empreendimento guarda só duas cores no banco (`cor_primaria` e
 * `cor_secundaria`); o fundo claro e o tom escuro que a folha da proposta
 * usa saem daqui, para não virar mais duas colunas para manter à mão.
 */

function partes(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const cheio = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(cheio, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const paraHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

/** Mistura com branco. `f` 0 = a cor, 1 = branco. */
export function clarear(hex: string, f: number): string {
  const [r, g, b] = partes(hex);
  return paraHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
}

/** Mistura com preto. `f` 0 = a cor, 1 = preto. */
export function escurecer(hex: string, f: number): string {
  const [r, g, b] = partes(hex);
  return paraHex(r * (1 - f), g * (1 - f), b * (1 - f));
}

/** `rgba()` a partir do hex, para preenchimentos translúcidos em SVG. */
export function transparente(hex: string, alfa: number): string {
  const [r, g, b] = partes(hex);
  return `rgba(${r},${g},${b},${alfa})`;
}
