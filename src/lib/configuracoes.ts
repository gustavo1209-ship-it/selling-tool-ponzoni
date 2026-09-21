import { createClient } from "@/lib/supabase/server";
import type { Configuracoes } from "@/lib/db/tipos";

/**
 * Iguais ao default das migrations 37/38 — usados só se a linha única sumir
 * por algum motivo, o que não deveria acontecer.
 */
const PADRAO: Configuracoes = {
  corretor_ve_valor_contrato: false,
  corretor_ve_recebido: false,
  corretor_ve_saldo_e_atraso: false,
  nivel_duplicidade_cliente: "avisar",
  desconto_maximo_corretor_pct: null,
  corretor_monta_opcao_livre: true,
  clientes_compartilhados: false,
  dia_vencimento_padrao: 10,
  juros_mora_padrao: 0.01,
  multa_atraso_padrao: 0.02,
  corretor_ve_vgv: false,
  corretor_ve_comprador: false,
  corretor_ve_preco_vendido: false,
  alertar_parcela_atrasada: true,
  alertar_proposta_vencendo: true,
  dias_aviso_proposta_vencendo: 7,
  menu_oculto: [],
};

const COLUNAS = Object.keys(PADRAO).join(", ");

/**
 * Sem filtro por id: a RLS ("configuracoes: leitura", migration 44) já
 * restringe a linha visível à organização de quem está logado — uma linha
 * por organização (unique em organizacao_id), então a consulta sem filtro
 * devolve exatamente a linha certa. Antes das organizações a linha era
 * única de verdade (id = 1); agora quem separa é a RLS, não o id.
 */
export async function obterConfiguracoes(): Promise<Configuracoes> {
  const supabase = await createClient();
  const { data } = await supabase.from("configuracoes").select(COLUNAS).maybeSingle();

  return data ? (data as unknown as Configuracoes) : PADRAO;
}
