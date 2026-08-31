/**
 * Registro dos mapas embutidos, um por empreendimento.
 *
 * A geometria de cada um é gerada por `scripts/extrair-mapa.mjs` a partir do
 * HTML do mapa público. Guardamos uma cópia para que a folha da proposta
 * desenhe os lotes sem depender de rede na hora de virar PDF.
 */
import * as industrialPonzoni from "./industrial-ponzoni";
import * as florescer from "./florescer";

export type { LoteMapa } from "./industrial-ponzoni";

export interface MapaEmpreendimento {
  largura: number;
  altura: number;
  lotes: industrialPonzoni.LoteMapa[];
}

const MAPAS: Record<string, MapaEmpreendimento> = {
  "industrial-ponzoni": {
    largura: industrialPonzoni.MAPA_LARGURA,
    altura: industrialPonzoni.MAPA_ALTURA,
    lotes: industrialPonzoni.LOTES_MAPA,
  },
  florescer: {
    largura: florescer.MAPA_LARGURA,
    altura: florescer.MAPA_ALTURA,
    lotes: florescer.LOTES_MAPA,
  },
};

/** `null` quando o empreendimento ainda não teve o mapa extraído. */
export function mapaDe(slug: string | null | undefined): MapaEmpreendimento | null {
  return (slug && MAPAS[slug]) || null;
}
