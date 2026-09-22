import { RotateCcw } from "lucide-react";
import type { EmpreendimentoFoto } from "@/lib/db/tipos";

const MAX_FOTOS_DOCUMENTO = 3;

/**
 * Fotos e mapa de localização de UM documento (proposta ou contrato) —
 * independente do padrão em Admin > Empreendimentos e independente do
 * outro documento (uma proposta pode mostrar e o contrato gerado dela
 * não, ou vice-versa).
 *
 * `fotosIds`/`mostrarMapa` vêm de `propostas`/`contratos` (`null` = "não
 * mexi, usa o padrão do empreendimento"); `fotosPadrao`/`mapaPadrao` são
 * esse padrão já resolvido, só para mostrar o que está valendo agora.
 * Cada clique salva na hora — não tem botão "Salvar" aqui de propósito,
 * mesma UX da galeria em Admin > Empreendimentos.
 */
export default function FotosEMapaDoDocumento({
  fotos,
  fotosIds,
  fotosPadrao,
  mostrarMapa,
  mapaPadrao,
  temMapa,
  pendente,
  aoDefinirFotos,
  aoDefinirMapa,
}: {
  fotos: EmpreendimentoFoto[];
  fotosIds: string[] | null;
  fotosPadrao: string[];
  mostrarMapa: boolean | null;
  mapaPadrao: boolean;
  temMapa: boolean;
  pendente: boolean;
  aoDefinirFotos: (ids: string[] | null) => void;
  aoDefinirMapa: (valor: boolean | null) => void;
}) {
  const efetivas = fotosIds ?? fotosPadrao;
  const usandoPadraoFotos = fotosIds === null;
  const efetivoMapa = mostrarMapa ?? mapaPadrao;
  const usandoPadraoMapa = mostrarMapa === null;

  function alternar(id: string) {
    if (efetivas.includes(id)) {
      aoDefinirFotos(efetivas.filter((x) => x !== id));
    } else if (efetivas.length < MAX_FOTOS_DOCUMENTO) {
      aoDefinirFotos([...efetivas, id]);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-semibold">
            Fotos neste documento
            <span className="text-cinza font-normal"> · até {MAX_FOTOS_DOCUMENTO}</span>
          </p>
          {!usandoPadraoFotos && (
            <button
              type="button"
              className="btn btn-fantasma text-xs"
              disabled={pendente}
              onClick={() => aoDefinirFotos(null)}
            >
              <RotateCcw size={13} /> Usar padrão do empreendimento
            </button>
          )}
        </div>

        {fotos.length === 0 ? (
          <p className="text-sm text-cinza">
            Esse empreendimento ainda não tem fotos cadastradas (Admin &gt; Empreendimentos).
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {fotos.map((f) => {
                const marcada = efetivas.includes(f.id);
                return (
                  <label
                    key={f.id}
                    className={`flex gap-2.5 items-center rounded-md border px-2.5 py-2 cursor-pointer ${
                      marcada ? "border-vinho bg-vinho-fraco" : "border-linha hover:bg-papel-alt"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={marcada}
                      disabled={pendente || (!marcada && efetivas.length >= MAX_FOTOS_DOCUMENTO)}
                      onChange={() => alternar(f.id)}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt="" className="w-12 h-9 rounded object-cover" />
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-cinza mt-2">
              {efetivas.length === 0
                ? usandoPadraoFotos
                  ? "O padrão do empreendimento também está sem foto marcada."
                  : "Nenhuma marcada — o documento sai sem fotos."
                : `${efetivas.length} marcada(s)${usandoPadraoFotos ? " — padrão do empreendimento." : "."}`}
            </p>
          </>
        )}
      </div>

      {temMapa && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={efetivoMapa}
                disabled={pendente}
                onChange={(e) => aoDefinirMapa(e.target.checked)}
              />
              Mostrar mapa de localização neste documento
            </label>
            {!usandoPadraoMapa && (
              <button
                type="button"
                className="btn btn-fantasma text-xs"
                disabled={pendente}
                onClick={() => aoDefinirMapa(null)}
              >
                <RotateCcw size={13} /> Usar padrão
              </button>
            )}
          </div>
          {usandoPadraoMapa && (
            <p className="text-xs text-cinza mt-1">
              Seguindo o padrão do empreendimento ({mapaPadrao ? "mostrando" : "oculto"}).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
