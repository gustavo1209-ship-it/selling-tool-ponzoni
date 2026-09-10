import type {
  Amortizacao,
  MetricaParcela,
  BlocoTipo,
  Indexador,
  LoteStatus,
  PropostaStatus,
  Resultado,
} from "@/lib/calc/tipos";
import type { ContratoStatus } from "@/lib/contratos/tipos";

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  papel: "corretor" | "admin";
  /** true = vê só os empreendimentos de `corretor_empreendimentos`. */
  empreendimentos_restritos: boolean;
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
  /** Foto aérea servida de `public/`, desenhada na folha da proposta. */
  mapa_imagem_url: string | null;
  /** Logo do empreendimento, servido de `public/`. */
  logo_url: string | null;
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
  /** Zoneamento do lote no espelho: "Residencial", "Misto I", "Misto II". */
  tipo: string | null;
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
  periodicidade_meses?: number;
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
  /** true = veio da tabela de preços; false = favorita montada pelo time. */
  oficial: boolean;
  criado_por: string | null;
}

/** Taxa de referência de um índice, com a fonte — não é número mágico. */
export interface IndexadorRef {
  codigo: Indexador;
  nome: string;
  descricao: string | null;
  taxa_mensal_referencia: number | null;
  acumulado_12m: number | null;
  variacao_mes: number | null;
  fonte: string | null;
  referencia: string | null;
  ordem: number;
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
  periodicidade_meses: number;
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
  metricas_parcela: MetricaParcela[];
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

// ------------------------------------------------------------ contratos

export interface Contrato {
  id: string;
  codigo: string;
  empreendimento_id: string;
  cliente_id: string | null;
  /** De onde veio, quando veio de uma proposta aceita. */
  proposta_id: string | null;
  cenario_origem: string | null;
  titulo: string | null;
  status: ContratoStatus;
  data_contrato: string;
  /** Marco zero da correção monetária. */
  data_base: string;
  valor_total: number;
  indexador: Indexador;
  /** Meses que o contrato anda para trás ao buscar o índice. */
  defasagem_indice_meses: number;
  /** Mesma convenção de `propostas.correcao_primeira_parcela`. */
  corrige_primeira_parcela: boolean;
  dia_vencimento: number;
  juros_mora_mensal: number;
  multa_atraso_pct: number;
  observacoes: string | null;
  /** Colunas do cronograma que saem no demonstrativo e no XLSX. null = todas. */
  colunas_documento: string[] | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ContratoLote {
  id: string;
  contrato_id: string;
  lote_id: string | null;
  quadra: string;
  numero: string;
  area_m2: number;
  valor: number;
  ordem: number;
}

export interface ContratoParcela {
  id: string;
  contrato_id: string;
  numero: number;
  rotulo: string;
  tipo: BlocoTipo;
  indice: number;
  total_no_grupo: number;
  vencimento: string;
  valor_original: number;
  indexada: boolean;
  pago_em: string | null;
  valor_pago: number | null;
  forma_pagamento: string | null;
  boleto_numero: string | null;
  observacao: string | null;
}

/** Contrato com tudo que a tela de acompanhamento precisa. */
export interface ContratoCompleto extends Contrato {
  empreendimento: Empreendimento;
  cliente: Cliente | null;
  lotes: ContratoLote[];
  parcelas: ContratoParcela[];
}

// -------------------------------------------------------------- funil

/** Uma coluna do kanban. O admin renomeia, recolore e reordena. */
export interface FunilEtapa {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  /** `ganha`/`perdida` fecham a negociação e carimbam `fechada_em`. */
  desfecho: "aberta" | "ganha" | "perdida";
  ativa: boolean;
}

/**
 * Uma oportunidade no funil — o que existe antes da proposta.
 *
 * Nasce solta (nome e telefone) e vai ganhando vínculo: cliente, lote,
 * proposta, contrato. Nenhum deles é obrigatório, senão o lead frio não
 * entraria no quadro.
 */
export interface Negociacao {
  id: string;
  codigo: string;
  etapa_id: string;
  cliente_id: string | null;
  titulo: string | null;
  telefone: string | null;
  empreendimento_id: string | null;
  lote_id: string | null;
  proposta_id: string | null;
  contrato_id: string | null;
  valor_estimado: number | null;
  origem: string | null;
  proximo_contato: string | null;
  observacao: string | null;
  ordem: number;
  fechada_em: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Negociação com o que o cartão do kanban mostra sem consulta extra. */
export interface NegociacaoNoQuadro extends Negociacao {
  cliente: { id: string; nome: string; telefone: string | null } | null;
  empreendimento: { id: string; nome: string } | null;
  lote: { id: string; quadra: string; numero: string } | null;
  proposta: { id: string; codigo: string } | null;
  contrato: { id: string; codigo: string } | null;
}
