import type {
  Amortizacao,
  BlocoTipo,
  Indexador,
  LoteStatus,
  PropostaStatus,
  Resultado,
} from "@/lib/calc/tipos";

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  papel: "vendedor" | "admin";
}

export interface Empreendimento {
  id: string;
  slug: string;
  nome: string;
  subtitulo: string | null;
  cidade: string | null;
  uf: string | null;
  espelho_csv_url: string | null;
  /** HTML do mapa que a aba embute (o mapa puro, sem o site em volta). */
  mapa_url: string | null;
  /** Página pública do mapa, para mandar ao cliente. */
  mapa_publico_url: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  ativo: boolean;
}

export interface Lote {
  id: string;
  empreendimento_id: string;
  quadra: string;
  numero: string;
  area_m2: number;
  preco_tabela: number | null;
  status: LoteStatus;
  comprador: string | null;
  observacao: string | null;
  atualizado_em: string;
}

export interface TabelaPreco {
  id: string;
  empreendimento_id: string;
  referencia: string;
  condicao_base: string;
  vigente_desde: string;
  incc_mensal: number;
  juros_vp_mensal: number;
  ativa: boolean;
}

/** Um bloco como vem do `template` da condição — sem id e sem proposta. */
export interface BlocoTemplate {
  rotulo: string;
  tipo: BlocoTipo;
  base_percentual?: number | null;
  base_valor?: number | null;
  absorve_residuo?: boolean;
  qtd_parcelas: number;
  mes_inicio: number;
  indexador: Indexador;
  taxa_indexador_mensal?: number | null;
  juros_mensal: number;
  amortizacao: Amortizacao;
  parcela_fixa?: number | null;
  observacao?: string | null;
}

export interface CondicaoPagamento {
  id: string;
  tabela_preco_id: string;
  nome: string;
  descricao: string | null;
  desconto_pct: number;
  ordem: number;
  template: BlocoTemplate[];
  ativa: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  observacao: string | null;
  criado_por: string | null;
  criado_em: string;
}

export interface PropostaLote {
  id: string;
  proposta_id: string;
  lote_id: string | null;
  quadra: string;
  numero: string;
  area_m2: number;
  preco_tabela: number;
  valor_negociado: number;
  ordem: number;
}

export interface PropostaBloco {
  id: string;
  cenario_id: string;
  ordem: number;
  rotulo: string;
  tipo: BlocoTipo;
  base_percentual: number | null;
  base_valor: number | null;
  absorve_residuo: boolean;
  qtd_parcelas: number;
  mes_inicio: number;
  indexador: Indexador;
  taxa_indexador_mensal: number | null;
  juros_mensal: number;
  amortizacao: Amortizacao;
  parcela_fixa: number | null;
  observacao: string | null;
}

export interface Proposta {
  id: string;
  codigo: string;
  empreendimento_id: string;
  cliente_id: string | null;
  tabela_preco_id: string | null;
  titulo: string | null;
  status: PropostaStatus;
  data_base: string;
  validade_dias: number;
  incc_mensal: number;
  juros_vp_mensal: number;
  correcao_primeira_parcela: boolean;
  observacoes: string | null;
  /** Snapshot do cenário recomendado — é o que as listagens leem. */
  resultado: Resultado | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

/**
 * Uma opção de parcelamento dentro da proposta. Os lotes são da proposta;
 * o desconto e os blocos são do cenário, porque mudam de opção para opção.
 */
export interface PropostaCenario {
  id: string;
  proposta_id: string;
  ordem: number;
  nome: string;
  condicao_origem: string | null;
  desconto_pct: number;
  desconto_valor: number;
  desconto_motivo: string | null;
  recomendado: boolean;
  resultado: Resultado | null;
}

export interface CenarioComBlocos extends PropostaCenario {
  blocos: PropostaBloco[];
}

/** Proposta com tudo que a tela do simulador precisa. */
export interface PropostaCompleta extends Proposta {
  empreendimento: Empreendimento;
  cliente: Cliente | null;
  lotes: PropostaLote[];
  cenarios: CenarioComBlocos[];
}
