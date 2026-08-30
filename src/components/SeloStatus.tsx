import { ROTULO_STATUS_LOTE, ROTULO_STATUS_PROPOSTA } from "@/lib/formato";

const CLASSE_PROPOSTA: Record<string, string> = {
  rascunho: "selo-neutro",
  enviada: "selo-marca",
  em_negociacao: "selo-reservado",
  aceita: "selo-livre",
  recusada: "selo-vendido",
  expirada: "selo-indisponivel",
};

export function SeloLote({ status }: { status: string }) {
  return <span className={`selo selo-${status}`}>{ROTULO_STATUS_LOTE[status] ?? status}</span>;
}

export function SeloProposta({ status }: { status: string }) {
  return (
    <span className={`selo ${CLASSE_PROPOSTA[status] ?? "selo-neutro"}`}>
      {ROTULO_STATUS_PROPOSTA[status] ?? status}
    </span>
  );
}
