import { transparente } from "@/lib/cores";
import { mapaDe, type LoteMapa, type MapaEmpreendimento } from "@/lib/mapa";

/** No mapa o lote é C11; no banco é quadra "C" + numero "11". */
function idDoMapa(quadra: string, numero: string): string {
  return `${quadra}${numero.padStart(2, "0")}`;
}

interface Caixa {
  x: number;
  y: number;
  w: number;
  h: number;
}

function pontos(points: string): [number, number][] {
  return points
    .split(" ")
    .map((p) => p.split(",").map(Number) as [number, number]);
}

/**
 * Enquadra os lotes escolhidos com folga em volta, na proporção pedida.
 *
 * A folga é proporcional ao tamanho do conjunto (não fixa): um lote de 900 m²
 * e a quadra inteira precisam de margens diferentes para "ver a rua" em volta.
 */
function enquadrar(
  destacados: LoteMapa[],
  proporcao: number,
  mapa: MapaEmpreendimento
): Caixa {
  const todos = destacados.flatMap((l) => pontos(l.points));
  const xs = todos.map((p) => p[0]);
  const ys = todos.map((p) => p[1]);

  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);

  const folga = Math.max((x1 - x0), (y1 - y0)) * 0.55;
  x0 -= folga;
  x1 += folga;
  y0 -= folga;
  y1 += folga;

  let w = x1 - x0;
  let h = y1 - y0;

  // ajusta para a proporção do quadro, crescendo o lado que falta
  if (w / h < proporcao) {
    const novo = h * proporcao;
    x0 -= (novo - w) / 2;
    w = novo;
  } else {
    const novo = w / proporcao;
    y0 -= (novo - h) / 2;
    h = novo;
  }

  // não deixa o recorte sair da imagem
  if (w > mapa.largura) {
    w = mapa.largura;
    h = w / proporcao;
  }
  if (h > mapa.altura) {
    h = mapa.altura;
    w = h * proporcao;
  }
  x0 = Math.min(Math.max(x0, 0), mapa.largura - w);
  y0 = Math.min(Math.max(y0, 0), mapa.altura - h);

  return { x: x0, y: y0, w, h };
}

function centro(l: LoteMapa): [number, number] {
  const ps = pontos(l.points);
  const n = ps.length;
  return [
    ps.reduce((s, p) => s + p[0], 0) / n,
    ps.reduce((s, p) => s + p[1], 0) / n,
  ];
}

export default function MapaDaProposta({
  slug,
  lotes,
  imagem,
  corPreenchimento,
  corContorno,
  proporcao = 16 / 9,
}: {
  /** Slug do empreendimento; escolhe qual mapa desenhar. */
  slug: string;
  lotes: { quadra: string; numero: string }[];
  imagem: string;
  corPreenchimento: string;
  corContorno: string;
  proporcao?: number;
}) {
  const mapa = mapaDe(slug);
  if (!mapa) return null;

  const ids = new Set(lotes.map((l) => idDoMapa(l.quadra, l.numero)));
  const destacados = mapa.lotes.filter((l) => ids.has(l.id));
  if (destacados.length === 0) return null;

  const caixa = enquadrar(destacados, proporcao, mapa);
  // o rótulo tem de continuar legível depois do recorte, então acompanha o zoom
  const escala = caixa.w / mapa.largura;
  const fonte = Math.round(46 * escala + 14);
  const traco = Math.max(2, 7 * escala + 2);

  return (
    <div className="mapa-proposta">
      <svg
        viewBox={`${caixa.x} ${caixa.y} ${caixa.w} ${caixa.h}`}
        className="mapa-principal"
        role="img"
        aria-label={`Localização dos lotes ${destacados.map((l) => l.id).join(", ")}`}
      >
        <image
          href={imagem}
          x={0}
          y={0}
          width={mapa.largura}
          height={mapa.altura}
          preserveAspectRatio="none"
        />

        {/* demais lotes: só o contorno, sem cor de status */}
        {mapa.lotes
          .filter((l) => !ids.has(l.id))
          .map((l) => (
            <polygon
              key={l.id}
              points={l.points}
              fill="rgba(255,255,255,0.06)"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={Math.max(1, traco * 0.4)}
            />
          ))}

        {destacados.map((l) => (
          <polygon
            key={l.id}
            points={l.points}
            fill={transparente(corPreenchimento, 0.62)}
            stroke={corContorno}
            strokeWidth={traco}
            strokeLinejoin="round"
          />
        ))}

        {destacados.map((l) => {
          const [cx, cy] = centro(l);
          return (
            <text
              key={l.id}
              x={cx}
              y={cy + fonte * 0.34}
              textAnchor="middle"
              fontSize={fonte}
              fontWeight="700"
              fill="#fff"
              stroke={transparente(corPreenchimento, 0.8)}
              strokeWidth={fonte * 0.13}
              paintOrder="stroke"
              fontFamily="Arial, Helvetica, sans-serif"
            >
              {l.quadra}-{l.numero}
            </text>
          );
        })}
      </svg>

      {/* miniatura do parque inteiro, marcando de onde saiu o recorte */}
      <svg
        viewBox={`0 0 ${mapa.largura} ${mapa.altura}`}
        className="mapa-mini"
        role="img"
        aria-label="Posição no parque"
      >
        <image
          href={imagem}
          x={0}
          y={0}
          width={mapa.largura}
          height={mapa.altura}
          preserveAspectRatio="none"
        />
        <rect
          x={0}
          y={0}
          width={mapa.largura}
          height={mapa.altura}
          fill="rgba(34,32,31,0.45)"
        />
        {destacados.map((l) => (
          <polygon key={l.id} points={l.points} fill={corContorno} />
        ))}
        <rect
          x={caixa.x}
          y={caixa.y}
          width={caixa.w}
          height={caixa.h}
          fill="none"
          stroke={corContorno}
          strokeWidth={10}
        />
      </svg>
    </div>
  );
}
