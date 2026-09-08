import type { BlocoTipo } from "@/lib/calc/tipos";
import type { Resultado } from "@/lib/calc/tipos";
import { adjetivoPeriodicidade } from "@/lib/formato";
import { competencia, somarMeses, vencimentoNoMes } from "./mes";

const cent = (v: number) => Math.round(v * 100) / 100;

/** Uma parcela a inserir em `contrato_parcelas`. */
export interface NovaParcela {
  numero: number;
  rotulo: string;
  tipo: BlocoTipo;
  indice: number;
  total_no_grupo: number;
  vencimento: string;
  valor_original: number;
  indexada: boolean;
}

/** Um grupo antes de virar linha: mesma ideia dos blocos da proposta. */
interface Grupo {
  rotulo: string;
  tipo: BlocoTipo;
  quantidade: number;
  valorUnitario: number;
  primeiroMes: number;
  periodicidade: number;
  indexada: boolean;
  /** O grupo que fica com os centavos que o arredondamento deixou. */
  absorveResiduo: boolean;
}

/**
 * Numera o cronograma e resolve as datas.
 *
 * A numeração segue o vencimento, não o grupo: é o número que vai no carnê
 * e o cliente conta do primeiro ao último. Um reforço que cai no mês 6 fica
 * entre a 6ª e a 7ª mensais, como no papel.
 *
 * O resíduo de centavos vai para a última parcela do grupo marcado — a
 * mesma regra do motor de proposta em bloco sem correção: o cliente soma a
 * coluna à mão e o total precisa fechar com o valor do contrato.
 */
function montar(
  grupos: Grupo[],
  valorTotal: number,
  dataBase: string,
  diaVencimento: number
): NovaParcela[] {
  const base = competencia(dataBase);
  const linhas: Omit<NovaParcela, "numero">[] = [];

  for (const g of grupos) {
    if (g.quantidade <= 0) continue;
    for (let k = 1; k <= g.quantidade; k++) {
      const mes = g.primeiroMes + (k - 1) * g.periodicidade;
      linhas.push({
        rotulo: g.rotulo,
        tipo: g.tipo,
        indice: k,
        total_no_grupo: g.quantidade,
        // mês 0 é o ato: vence na própria data-base, não no dia do carnê
        vencimento:
          mes === 0 ? dataBase : vencimentoNoMes(somarMeses(base, mes), diaVencimento),
        valor_original: cent(g.valorUnitario),
        indexada: g.indexada,
      });
    }
  }

  const alvo = grupos.find((g) => g.absorveResiduo) ?? grupos[grupos.length - 1];
  if (alvo) {
    const soma = cent(linhas.reduce((s, l) => s + l.valor_original, 0));
    const sobra = cent(valorTotal - soma);
    if (sobra !== 0) {
      const doGrupo = linhas.filter((l) => l.rotulo === alvo.rotulo);
      const ultima = doGrupo[doGrupo.length - 1];
      if (ultima) ultima.valor_original = cent(ultima.valor_original + sobra);
    }
  }

  return linhas
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.indice - b.indice)
    .map((l, i) => ({ ...l, numero: i + 1 }));
}

export interface ParametrosCronograma {
  valorTotal: number;
  dataBase: string;
  diaVencimento: number;
  /** Valor da entrada em reais. 0 = sem entrada. */
  entrada: number;
  /** Entrada parcelada: 1 é o normal, 2 ou 3 aparecem em venda de terreno. */
  entradaParcelas: number;
  qtdParcelas: number;
  /** Meses da data-base até o 1º vencimento das mensais. Normalmente 1. */
  primeiroVencimentoMes: number;
  /** Se as mensais corrigem pelo índice do contrato. */
  mensaisIndexadas: boolean;
  reforco: {
    quantidade: number;
    valor: number;
    /** 6 = semestral, 12 = anual. */
    periodicidade: number;
    primeiroMes: number;
  } | null;
}

/**
 * Cronograma no formato que o mercado usa: entrada + mensais + reforços
 * periódicos. É o mesmo desenho de `MontarOpcao.tsx` no simulador, e de
 * propósito — quem cadastra um contrato antigo está lendo um papel escrito
 * exatamente assim.
 *
 * As mensais absorvem o resíduo: entrada e reforços são valores redondos
 * negociados, e o que sobra é o que se divide.
 */
export function cronogramaManual(p: ParametrosCronograma): NovaParcela[] {
  const entrada = Math.max(0, p.entrada);
  const nEntrada = Math.max(1, Math.trunc(p.entradaParcelas));
  const totalReforco = p.reforco ? p.reforco.quantidade * p.reforco.valor : 0;
  const restante = Math.max(0, p.valorTotal - entrada - totalReforco);
  const n = Math.max(0, Math.trunc(p.qtdParcelas));

  const grupos: Grupo[] = [];

  if (entrada > 0) {
    grupos.push({
      rotulo: nEntrada > 1 ? `Entrada em ${nEntrada}x` : "Entrada",
      tipo: "entrada",
      quantidade: nEntrada,
      valorUnitario: entrada / nEntrada,
      primeiroMes: 0,
      periodicidade: 1,
      // entrada se paga no ato ou logo em seguida: não corrige
      indexada: false,
      absorveResiduo: false,
    });
  }

  if (n > 0) {
    grupos.push({
      rotulo: `${n}x mensais`,
      tipo: "parcelas",
      quantidade: n,
      valorUnitario: restante / n,
      primeiroMes: Math.max(0, p.primeiroVencimentoMes),
      periodicidade: 1,
      indexada: p.mensaisIndexadas,
      absorveResiduo: true,
    });
  }

  if (p.reforco && p.reforco.quantidade > 0 && p.reforco.valor > 0) {
    grupos.push({
      rotulo: `Reforços ${adjetivoPeriodicidade(p.reforco.periodicidade)}`,
      tipo: "balao",
      quantidade: p.reforco.quantidade,
      valorUnitario: p.reforco.valor,
      primeiroMes: p.reforco.primeiroMes,
      periodicidade: p.reforco.periodicidade,
      indexada: p.mensaisIndexadas,
      absorveResiduo: false,
    });
  }

  return montar(grupos, p.valorTotal, p.dataBase, p.diaVencimento);
}

/**
 * Cronograma a partir de um cenário já calculado da proposta.
 *
 * O valor gravado é o NOMINAL na data-base — `valor − correcao`, e não o
 * valor que o simulador mostra. A projeção do simulador usa a taxa
 * estimada; o contrato vai ser corrigido pelos índices que a FGV publicar
 * de verdade, e guardar o número projetado embutiria a estimativa no
 * principal, corrigindo duas vezes o mesmo mês.
 *
 * Bloco com sistema de amortização (SAC, Price) é a exceção: ali o
 * indexador entrou como juro dentro da parcela, então o valor já é final e
 * a linha nasce sem indexação.
 */
export function cronogramaDeResultado(
  resultado: Resultado,
  dataBase: string,
  diaVencimento: number
): NovaParcela[] {
  const base = competencia(dataBase);
  const linhas: Omit<NovaParcela, "numero">[] = [];

  for (const bc of resultado.blocos) {
    const comJuros = bc.bloco.amortizacao !== "nenhuma";
    const indexada = !comJuros && bc.bloco.indexador !== "nenhum";
    const total = bc.parcelas.length;

    for (const parcela of bc.parcelas) {
      linhas.push({
        rotulo: bc.bloco.rotulo,
        tipo: bc.bloco.tipo,
        indice: parcela.indice,
        total_no_grupo: total,
        vencimento:
          parcela.mes === 0
            ? dataBase
            : vencimentoNoMes(somarMeses(base, parcela.mes), diaVencimento),
        valor_original: cent(indexada ? parcela.valor - parcela.correcao : parcela.valor),
        indexada,
      });
    }
  }

  const ordenadas = linhas.sort(
    (a, b) => a.vencimento.localeCompare(b.vencimento) || a.indice - b.indice
  );

  // Tirar a correção parcela a parcela deixa alguns centavos de sobra contra
  // o valor negociado — cada linha arredondou por conta própria. Sem fechar
  // isso, todo contrato gerado de proposta nasceria com o aviso de "a conta
  // não fecha" por quatro centavos.
  //
  // O rateio é de um centavo por parcela, a partir da primeira, e não uma
  // sobra jogada na última: a última parcela é a que o cliente confere
  // contra o papel da proposta, e precisa continuar batendo no centavo.
  const soma = cent(ordenadas.reduce((s, l) => s + l.valor_original, 0));
  const sobraCentavos = Math.round((resultado.valorNegociado - soma) * 100);
  if (sobraCentavos !== 0 && ordenadas.length > 0) {
    const passo = Math.sign(sobraCentavos) / 100;
    for (let k = 0; k < Math.abs(sobraCentavos); k++) {
      const alvo = ordenadas[k % ordenadas.length];
      alvo.valor_original = cent(alvo.valor_original + passo);
    }
  }

  return ordenadas.map((l, i) => ({ ...l, numero: i + 1 }));
}
