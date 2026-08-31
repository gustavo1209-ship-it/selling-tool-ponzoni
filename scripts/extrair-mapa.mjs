/**
 * Extrai a geometria dos lotes do mapa público para dentro do app.
 *
 * O mapa vive em `site-industrial-ponzoni/mapa-lotes-ponzoni-industrial.html`
 * (publicado no GitHub Pages) e é a fonte da verdade do desenho. A proposta
 * precisa desenhar os mesmos polígonos, mas não pode depender de rede na
 * hora de gerar o PDF — então guardamos uma cópia da geometria e este script
 * a regenera quando o mapa mudar.
 *
 *   npm run mapa:extrair
 *   npm run mapa:extrair -- ../outro/mapa.html src/lib/mapa/outro.ts
 *
 * Não copia a foto aérea: ela é grande e muda pouco, então vai à mão para
 * `public/` (ver CLAUDE.md).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

// O repositório do mapa não é vizinho deste desde que o código saiu do
// OneDrive, então o caminho vem por argumento (ou por MAPA_HTML).
const ORIGEM =
  process.argv[2] ??
  process.env.MAPA_HTML ??
  "../site-industrial-ponzoni/mapa-lotes-ponzoni-industrial.html";
const DESTINO = process.argv[3] ?? "src/lib/mapa/industrial-ponzoni.ts";

let html;
try {
  html = readFileSync(resolve(ORIGEM), "utf8");
} catch {
  console.error(
    [
      `Não achei o mapa em ${ORIGEM}.`,
      "Passe o caminho do HTML do mapa público, por exemplo:",
      '  npm run mapa:extrair -- "C:/Users/<voce>/OneDrive/Desktop/Codes Claude/teste supabase/site-industrial-ponzoni/mapa-lotes-ponzoni-industrial.html"',
    ].join("\n")
  );
  process.exit(1);
}

const svg = html.match(/<svg id="svg-root"[^>]*viewBox="([^"]+)"/);
if (!svg) throw new Error("Não achei o <svg id=\"svg-root\"> com viewBox.");
const [, viewBox] = svg;
const [, , largura, altura] = viewBox.split(/\s+/).map(Number);

const lotes = [];
const re = /<polygon[^>]*data-id="([^"]+)"[^>]*points="([^"]+)"[^>]*\/?>/g;
let m;
while ((m = re.exec(html)) !== null) {
  const [, id, points] = m;
  // o HTML tem um polygon de template com id interpolado pelo JS
  if (!/^[A-Z]\d+$/.test(id)) continue;
  const quadra = id.match(/^[A-Z]+/)[0];
  const numero = String(parseInt(id.slice(quadra.length), 10));
  lotes.push({ id, quadra, numero, points: points.trim().replace(/\s+/g, " ") });
}

if (lotes.length === 0) throw new Error("Nenhum polígono de lote encontrado.");
lotes.sort((a, b) =>
  a.quadra === b.quadra
    ? Number(a.numero) - Number(b.numero)
    : a.quadra.localeCompare(b.quadra)
);

const saida = `// GERADO POR scripts/extrair-mapa.mjs — não editar à mão.
// Origem: ${basename(ORIGEM)}
// ${lotes.length} lotes, viewBox ${viewBox}.

export interface LoteMapa {
  /** Id do mapa: quadra + número com dois dígitos (C11, E06). */
  id: string;
  quadra: string;
  numero: string;
  points: string;
}

export const MAPA_LARGURA = ${largura};
export const MAPA_ALTURA = ${altura};

export const LOTES_MAPA: LoteMapa[] = ${JSON.stringify(lotes, null, 2)};
`;

mkdirSync(dirname(resolve(DESTINO)), { recursive: true });
writeFileSync(resolve(DESTINO), saida, "utf8");

console.log(
  `${lotes.length} lotes extraídos de ${ORIGEM} → ${DESTINO} (viewBox ${viewBox})`
);
