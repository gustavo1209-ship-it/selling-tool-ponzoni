import MapaDaProposta from "./MapaDaProposta";

/**
 * Uma foto só continua podendo usar o SVG de destaque de lote
 * (MapaDaProposta, com a geometria extraída pra Industrial Ponzoni e
 * Florescer) — não faz sentido pra mais de uma foto ao mesmo tempo, então
 * com 2 ou 3 é sempre grade simples, lado a lado.
 */
export default function FotosDoDocumento({
  slug,
  lotes,
  urls,
  corPreenchimento,
  corContorno,
}: {
  slug: string;
  lotes: { quadra: string; numero: string }[];
  urls: string[];
  corPreenchimento: string;
  corContorno: string;
}) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <MapaDaProposta
        slug={slug}
        lotes={lotes}
        imagem={urls[0]}
        corPreenchimento={corPreenchimento}
        corContorno={corContorno}
      />
    );
  }

  return (
    <div
      className="fotos-lado-a-lado"
      style={{ display: "grid", gridTemplateColumns: `repeat(${urls.length}, 1fr)`, gap: "2mm" }}
    >
      {urls.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt={`Foto ${i + 1}`}
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
            objectFit: "cover",
            borderRadius: "1.5mm",
          }}
        />
      ))}
    </div>
  );
}
