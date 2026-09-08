import {
  ROTULO_SITUACAO_PARCELA,
  ROTULO_STATUS_CONTRATO,
  ROTULO_STATUS_LOTE,
  ROTULO_STATUS_PROPOSTA,
} from "@/lib/formato";

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

const CLASSE_CONTRATO: Record<string, string> = {
  ativo: "selo-marca",
  quitado: "selo-livre",
  distratado: "selo-vendido",
  suspenso: "selo-reservado",
};

// "vence hoje" é dourado e não vermelho de propósito: ainda dá para emitir
// o boleto sem encargo, e é a linha que precisa ser vista na tela do dia.
const CLASSE_PARCELA: Record<string, string> = {
  paga: "selo-livre",
  a_vencer: "selo-neutro",
  vence_hoje: "selo-ouro",
  vencida: "selo-vendido",
};

export function SeloContrato({ status }: { status: string }) {
  return (
    <span className={`selo ${CLASSE_CONTRATO[status] ?? "selo-neutro"}`}>
      {ROTULO_STATUS_CONTRATO[status] ?? status}
    </span>
  );
}

export function SeloParcela({ situacao }: { situacao: string }) {
  return (
    <span className={`selo ${CLASSE_PARCELA[situacao] ?? "selo-neutro"}`}>
      {ROTULO_SITUACAO_PARCELA[situacao] ?? situacao}
    </span>
  );
}
