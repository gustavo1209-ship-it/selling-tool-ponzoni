import Link from "next/link";
import { AlertTriangle, FileSpreadsheet } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import { SeloParcela } from "@/components/SeloStatus";
import { createClient } from "@/lib/supabase/server";
import { calcularContrato } from "@/lib/contratos/correcao";
import { perfilAtual } from "@/lib/supabase/perfil";
import {
  competencia,
  competenciaPorExtenso,
  hojeISO,
  mesesEntre,
  somarMeses,
} from "@/lib/contratos/mes";
import { carregarIndices, serieDe } from "@/lib/contratos/servidor";
import type { ParcelaCalculada } from "@/lib/contratos/tipos";
import type { ContratoParcela } from "@/lib/db/tipos";
import { dataBR, fator, moeda, moedaCurta } from "@/lib/formato";

export const dynamic = "force-dynamic";

interface ContratoLinha {
  id: string;
  codigo: string;
  titulo: string | null;
  status: string;
  data_base: string;
  valor_total: number;
  indexador: string;
  defasagem_indice_meses: number;
  corrige_primeira_parcela: boolean;
  juros_mora_mensal: number;
  multa_atraso_pct: number;
  empreendimento_id: string;
  teste: boolean;
  clientes: { nome: string; email: string | null; telefone: string | null } | null;
  empreendimentos: { nome: string } | null;
  contrato_lotes: { quadra: string; numero: string }[];
  contrato_parcelas: ContratoParcela[];
}

interface ParcelaComissaoLinha {
  id: string;
  numero: number;
  vencimento: string;
  valor: number;
  pago_em: string | null;
  valor_pago: number | null;
  comissao: {
    contrato: {
      id: string;
      codigo: string;
      titulo: string | null;
      teste: boolean;
      empreendimento_id: string;
      cliente: { nome: string } | null;
    } | null;
  } | null;
}

export default async function CobrancaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ate?: string; emp?: string; so_mes?: string }>;
}) {
  const filtros = await searchParams;
  const mes = filtros.mes && /^\d{4}-\d{2}$/.test(filtros.mes)
    ? filtros.mes
    : competencia(hojeISO());
  // "Até" é opcional — sem ele a janela é de um mês só, igual sempre foi.
  // Com ele, a tela passa a somar vários meses de uma vez (o pedido de dar
  // uma janela maior do que só o mês vigente para acompanhar).
  const ate =
    filtros.ate && /^\d{4}-\d{2}$/.test(filtros.ate) && filtros.ate >= mes
      ? filtros.ate
      : mes;
  const janela = mesesEntre(mes, ate);
  // Checkbox de GET não manda nada quando é desmarcado, então quem carrega
  // a informação é a exceção: "só o período" ligado é que tira as atrasadas.
  const incluirAtrasadas = filtros.so_mes !== "1";

  const perfil = await perfilAtual();
  const ehAdmin = perfil?.ehAdmin ?? false;

  const supabase = await createClient();
  const { data: empreendimentos } = await supabase
    .from("empreendimentos")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  const params = new URLSearchParams({ mes });
  if (janela > 0) params.set("ate", ate);
  if (filtros.emp) params.set("emp", filtros.emp);
  if (!incluirAtrasadas) params.set("so_mes", "1");

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1600px] mx-auto px-5 py-8 flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Financeiro</p>
            <h1 className="serif text-3xl mt-1">A receber</h1>
            <p className="text-sm text-cinza mt-1">
              {ehAdmin ? (
                janela > 0 ? (
                  <>
                    O que cobrar entre {competenciaPorExtenso(mes)} e{" "}
                    {competenciaPorExtenso(ate)}, já com a correção aplicada —
                    é a lista para emitir os boletos.
                  </>
                ) : (
                  <>
                    O que cobrar em {competenciaPorExtenso(mes)}, já com a
                    correção aplicada — é a lista para emitir os boletos.
                  </>
                )
              ) : janela > 0 ? (
                <>
                  Sua comissão entre {competenciaPorExtenso(mes)} e{" "}
                  {competenciaPorExtenso(ate)}: o que já caiu e o que ainda
                  vem.
                </>
              ) : (
                <>
                  Sua comissão em {competenciaPorExtenso(mes)}: o que já caiu
                  e o que ainda vem.
                </>
              )}
            </p>
          </div>
          {ehAdmin && (
            <a className="btn btn-primario" href={`/api/cobranca/xlsx?${params}`}>
              <FileSpreadsheet size={16} /> Exportar XLSX
            </a>
          )}
        </div>

        <form className="cartao p-4 flex flex-wrap gap-3 items-end" method="get">
          <div>
            <label className="rotulo">De</label>
            <input type="month" name="mes" className="campo w-40" defaultValue={mes} />
          </div>
          <div>
            <label className="rotulo">Até</label>
            <input type="month" name="ate" className="campo w-40" defaultValue={ate} />
          </div>
          <div>
            <label className="rotulo">Empreendimento</label>
            <select name="emp" className="campo w-56" defaultValue={filtros.emp ?? ""}>
              <option value="">Todos</option>
              {(empreendimentos ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input
              type="checkbox"
              name="so_mes"
              value="1"
              defaultChecked={!incluirAtrasadas}
            />
            Só os vencimentos do período, sem o que ficou em atraso
          </label>
          <button className="btn btn-secundario">Ver</button>
          <div className="flex gap-2 ml-auto text-sm flex-wrap justify-end">
            <div className="flex gap-1 items-center">
              {[
                { rotulo: "1 mês", n: 0 },
                { rotulo: "3 meses", n: 2 },
                { rotulo: "6 meses", n: 5 },
                { rotulo: "12 meses", n: 11 },
              ].map((j) => (
                <Link
                  key={j.n}
                  className={`btn btn-fantasma ${janela === j.n ? "bg-papel-alt font-semibold" : ""}`}
                  href={`/cobranca?mes=${mes}&ate=${somarMeses(mes, j.n)}${filtros.emp ? `&emp=${filtros.emp}` : ""}${!incluirAtrasadas ? "&so_mes=1" : ""}`}
                >
                  {j.rotulo}
                </Link>
              ))}
            </div>
            <Link
              className="btn btn-fantasma"
              href={`/cobranca?mes=${somarMeses(mes, -1)}&ate=${somarMeses(ate, -1)}${filtros.emp ? `&emp=${filtros.emp}` : ""}`}
            >
              ← anterior
            </Link>
            <Link
              className="btn btn-fantasma"
              href={`/cobranca?mes=${somarMeses(mes, 1)}&ate=${somarMeses(ate, 1)}${filtros.emp ? `&emp=${filtros.emp}` : ""}`}
            >
              próximo →
            </Link>
          </div>
        </form>

        {ehAdmin ? (
          <TabelaDeBoletos
            mes={mes}
            ate={ate}
            janela={janela}
            emp={filtros.emp}
            incluirAtrasadas={incluirAtrasadas}
          />
        ) : (
          <TabelaDeComissao
            mes={mes}
            ate={ate}
            janela={janela}
            emp={filtros.emp}
            incluirAtrasadas={incluirAtrasadas}
          />
        )}
      </main>
    </>
  );
}

/**
 * A tabela de boletos: o que cobrar de cada comprador, com a correção
 * aplicada. Só o admin vê — é o financeiro da empresa inteira. O corretor
 * tem sua própria visão abaixo, focada só no que ele mesmo recebe de
 * comissão.
 */
async function TabelaDeBoletos({
  mes,
  ate,
  janela,
  emp,
  incluirAtrasadas,
}: {
  mes: string;
  ate: string;
  janela: number;
  emp: string | undefined;
  incluirAtrasadas: boolean;
}) {
  const supabase = await createClient();
  const [{ data }, indices] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        "id, codigo, titulo, status, data_base, valor_total, indexador, defasagem_indice_meses, corrige_primeira_parcela, juros_mora_mensal, multa_atraso_pct, empreendimento_id, teste, clientes(nome, email, telefone), empreendimentos(nome), contrato_lotes(quadra, numero), contrato_parcelas(*)"
      )
      .in("status", ["ativo", "suspenso"])
      .eq("teste", false),
    carregarIndices(),
  ]);

  const contratos = ((data ?? []) as unknown as ContratoLinha[]).filter(
    (c) => !emp || c.empreendimento_id === emp
  );

  // Uma linha por parcela que vence dentro da janela (mes..ate) escolhida,
  // mais o que ficou para trás — quem emite boleto precisa das duas coisas
  // na mesma tela. As já pagas dentro da janela entram numa lista à parte:
  // continuam aparecendo (não somem da aba assim que alguém dá baixa), mas
  // não entram na conta do que ainda falta cobrar.
  const linhas: {
    contrato: ContratoLinha;
    parcela: ParcelaCalculada;
    atrasada: boolean;
  }[] = [];
  const recebidasDoPeriodo: { contrato: ContratoLinha; parcela: ParcelaCalculada }[] = [];

  for (const c of contratos) {
    const { serie, taxa } = serieDe(indices, c.indexador as never);
    const calculo = calcularContrato(
      {
        data_base: c.data_base,
        indexador: c.indexador as never,
        defasagem_indice_meses: c.defasagem_indice_meses,
        corrige_primeira_parcela: c.corrige_primeira_parcela,
        juros_mora_mensal: Number(c.juros_mora_mensal),
        multa_atraso_pct: Number(c.multa_atraso_pct),
        valor_total: Number(c.valor_total),
      },
      c.contrato_parcelas,
      serie,
      taxa
    );

    for (const p of calculo.parcelas) {
      const comp = competencia(p.vencimento);
      if (p.situacao === "paga") {
        if (comp >= mes && comp <= ate) recebidasDoPeriodo.push({ contrato: c, parcela: p });
        continue;
      }
      if (comp >= mes && comp <= ate) {
        linhas.push({ contrato: c, parcela: p, atrasada: p.situacao === "vencida" });
      } else if (incluirAtrasadas && comp < mes && p.situacao === "vencida") {
        linhas.push({ contrato: c, parcela: p, atrasada: true });
      }
    }
  }

  linhas.sort(
    (a, b) =>
      a.parcela.vencimento.localeCompare(b.parcela.vencimento) ||
      a.contrato.codigo.localeCompare(b.contrato.codigo)
  );
  recebidasDoPeriodo.sort(
    (a, b) =>
      a.parcela.vencimento.localeCompare(b.parcela.vencimento) ||
      a.contrato.codigo.localeCompare(b.contrato.codigo)
  );

  const doPeriodo = linhas.filter((l) => competencia(l.parcela.vencimento) >= mes);
  const atrasadas = linhas.filter((l) => competencia(l.parcela.vencimento) < mes);
  const total = linhas.reduce((s, l) => s + l.parcela.valorACobrar, 0);
  const recebidoDoPeriodo = recebidasDoPeriodo.reduce(
    (s, l) => s + Number(l.parcela.valor_pago ?? l.parcela.valorCorrigido),
    0
  );
  const estimadas = linhas.filter((l) => l.parcela.correcao.estimado);

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="cartao p-4">
          <p className="eyebrow">Recebido no período</p>
          <p className="serif text-2xl tabular mt-1 text-verde">
            {moedaCurta(recebidoDoPeriodo)}
          </p>
          <p className="text-xs text-cinza mt-1">
            {recebidasDoPeriodo.length} parcela(s) já paga(s)
          </p>
        </div>
        <div className="cartao p-4">
          <p className="eyebrow">Total a cobrar</p>
          <p className="serif text-2xl tabular mt-1 text-vinho">{moedaCurta(total)}</p>
          <p className="text-xs text-cinza mt-1">{linhas.length} boleto(s)</p>
        </div>
        <div className="cartao p-4">
          <p className="eyebrow">Do período</p>
          <p className="serif text-2xl tabular mt-1">
            {moedaCurta(doPeriodo.reduce((s, l) => s + l.parcela.valorACobrar, 0))}
          </p>
          <p className="text-xs text-cinza mt-1">{doPeriodo.length} vencimento(s)</p>
        </div>
        <div className="cartao p-4">
          <p className="eyebrow">Em atraso de antes</p>
          <p
            className={`serif text-2xl tabular mt-1 ${
              atrasadas.length ? "text-vermelho" : ""
            }`}
          >
            {moedaCurta(atrasadas.reduce((s, l) => s + l.parcela.valorACobrar, 0))}
          </p>
          <p className="text-xs text-cinza mt-1">
            {atrasadas.length} parcela(s), com multa e juros
          </p>
        </div>
        <div className="cartao p-4">
          <p className="eyebrow">Índice pendente</p>
          <p
            className={`serif text-2xl tabular mt-1 ${
              estimadas.length ? "text-ambar" : ""
            }`}
          >
            {estimadas.length}
          </p>
          <p className="text-xs text-cinza mt-1">
            {estimadas.length ? (
              <Link href="/indices" className="text-vinho font-semibold">
                lançar os meses que faltam
              </Link>
            ) : (
              "todos os índices lançados"
            )}
          </p>
        </div>
      </section>

      {estimadas.length > 0 && (
        <p className="text-sm text-ambar bg-ambar-fraco rounded-md px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            {estimadas.length} parcela(s) dependem de meses sem índice lançado e
            estão estimadas pela taxa de projeção — o valor pode mudar quando o
            índice sair. Não emita esses boletos antes de lançar o índice em{" "}
            <Link href="/indices" className="font-semibold underline">
              Índices mensais
            </Link>
            .
          </span>
        </p>
      )}

      <section className="cartao overflow-x-auto">
        <table className="tabela">
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Contrato</th>
              <th>Comprador</th>
              <th>Lote</th>
              <th>Parcela</th>
              <th className="num">Original</th>
              <th className="num">Fator</th>
              <th className="num">Corrigido</th>
              <th className="num">Encargos</th>
              <th className="num">Valor do boleto</th>
              <th>Situação</th>
              <th>Contato</th>
            </tr>
          </thead>
          <tbody>
            {[
              ...linhas.map((l) => ({ ...l, paga: false })),
              ...recebidasDoPeriodo.map((l) => ({ ...l, atrasada: false, paga: true })),
            ]
              .sort(
                (a, b) =>
                  a.parcela.vencimento.localeCompare(b.parcela.vencimento) ||
                  a.contrato.codigo.localeCompare(b.contrato.codigo)
              )
              .map(({ contrato: c, parcela: p, paga }) => (
                <tr
                  key={p.id}
                  className={`hover:bg-papel-alt ${
                    paga
                      ? "bg-verde-fraco/40"
                      : p.situacao === "vencida"
                        ? "bg-vermelho-fraco/40"
                        : ""
                  }`}
                >
                  <td className="whitespace-nowrap font-semibold">
                    {dataBR(p.vencimento)}
                  </td>
                  <td className="whitespace-nowrap">
                    <Link href={`/contratos/${c.id}`} className="text-vinho font-semibold">
                      {c.codigo}
                    </Link>
                  </td>
                  <td>{c.clientes?.nome ?? c.titulo ?? "—"}</td>
                  <td className="text-cinza whitespace-nowrap">
                    {c.contrato_lotes.map((l) => `${l.quadra}-${l.numero}`).join(", ") ||
                      "—"}
                  </td>
                  <td className="text-cinza whitespace-nowrap">
                    {p.rotulo}
                    {p.total_no_grupo > 1 && ` ${p.indice}/${p.total_no_grupo}`}
                  </td>
                  <td className="num text-cinza">{moeda(p.valor_original)}</td>
                  <td className="num text-cinza">
                    {p.indexada ? (
                      <>
                        {fator(p.correcao.fator)}
                        {p.correcao.estimado && (
                          <span className="text-ambar font-semibold" title="estimado">
                            ~
                          </span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="num">{moeda(p.valorCorrigido)}</td>
                  <td className="num text-cinza">
                    {p.encargos ? moeda(p.encargos.multa + p.encargos.juros) : "—"}
                  </td>
                  <td className="num font-semibold">
                    {paga ? moeda(Number(p.valor_pago ?? p.valorCorrigido)) : moeda(p.valorACobrar)}
                    {paga && p.pago_em && (
                      <span className="block text-[10px] text-cinza font-normal">
                        pago em {dataBR(p.pago_em)}
                      </span>
                    )}
                  </td>
                  <td>
                    <SeloParcela situacao={p.situacao} />
                  </td>
                  <td className="text-cinza text-xs whitespace-nowrap">
                    {c.clientes?.telefone ?? c.clientes?.email ?? "—"}
                  </td>
                </tr>
              ))}
            {linhas.length === 0 && recebidasDoPeriodo.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center text-cinza py-8">
                  {janela > 0
                    ? `Nada a receber entre ${competenciaPorExtenso(mes)} e ${competenciaPorExtenso(ate)}.`
                    : `Nada a receber em ${competenciaPorExtenso(mes)}.`}
                </td>
              </tr>
            )}
          </tbody>
          {linhas.length > 0 && (
            <tfoot>
              <tr className="bg-papel-alt font-semibold">
                <td colSpan={9} className="text-right">
                  Total
                </td>
                <td className="num">{moeda(total)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>
    </>
  );
}

/**
 * A visão do corretor: só a comissão dele, contrato por contrato, parcela
 * por parcela — sem o financeiro do comprador, que é assunto de admin. É a
 * mesma janela de tempo (De/Até) e o mesmo filtro de empreendimento da
 * tabela de boletos, só que sobre `contrato_comissao_parcelas` em vez de
 * `contrato_parcelas`. A RLS de `contrato_comissao_parcelas`
 * (`pode_ver_comissao`) já garante que só vêm parcelas de contratos deste
 * corretor — não precisa filtrar autor aqui.
 */
async function TabelaDeComissao({
  mes,
  ate,
  janela,
  emp,
  incluirAtrasadas,
}: {
  mes: string;
  ate: string;
  janela: number;
  emp: string | undefined;
  incluirAtrasadas: boolean;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contrato_comissao_parcelas")
    .select(
      "id, numero, vencimento, valor, pago_em, valor_pago, comissao:contrato_comissoes(contrato:contratos(id, codigo, titulo, teste, empreendimento_id, cliente:clientes(nome)))"
    );

  const parcelas = (data ?? []) as unknown as ParcelaComissaoLinha[];
  const hoje = hojeISO();

  const linhas: { parcela: ParcelaComissaoLinha; atrasada: boolean }[] = [];
  const recebidasDoPeriodo: { parcela: ParcelaComissaoLinha }[] = [];

  for (const p of parcelas) {
    const contrato = p.comissao?.contrato;
    if (!contrato || contrato.teste) continue;
    if (emp && contrato.empreendimento_id !== emp) continue;

    const comp = competencia(p.vencimento);
    if (p.pago_em) {
      if (comp >= mes && comp <= ate) recebidasDoPeriodo.push({ parcela: p });
      continue;
    }
    const vencida = p.vencimento < hoje;
    if (comp >= mes && comp <= ate) {
      linhas.push({ parcela: p, atrasada: vencida });
    } else if (incluirAtrasadas && comp < mes && vencida) {
      linhas.push({ parcela: p, atrasada: true });
    }
  }

  linhas.sort((a, b) => a.parcela.vencimento.localeCompare(b.parcela.vencimento));
  recebidasDoPeriodo.sort((a, b) => a.parcela.vencimento.localeCompare(b.parcela.vencimento));

  const doPeriodo = linhas.filter((l) => competencia(l.parcela.vencimento) >= mes);
  const atrasadas = linhas.filter((l) => competencia(l.parcela.vencimento) < mes);
  const total = linhas.reduce((s, l) => s + Number(l.parcela.valor), 0);
  const recebidoDoPeriodo = recebidasDoPeriodo.reduce(
    (s, l) => s + Number(l.parcela.valor_pago ?? l.parcela.valor),
    0
  );

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="cartao p-4">
          <p className="eyebrow">Recebido no período</p>
          <p className="serif text-2xl tabular mt-1 text-verde">
            {moedaCurta(recebidoDoPeriodo)}
          </p>
          <p className="text-xs text-cinza mt-1">
            {recebidasDoPeriodo.length} parcela(s) já paga(s)
          </p>
        </div>
        <div className="cartao p-4">
          <p className="eyebrow">Comissão a receber</p>
          <p className="serif text-2xl tabular mt-1 text-vinho">{moedaCurta(total)}</p>
          <p className="text-xs text-cinza mt-1">{linhas.length} parcela(s)</p>
        </div>
        <div className="cartao p-4">
          <p className="eyebrow">Do período</p>
          <p className="serif text-2xl tabular mt-1">
            {moedaCurta(doPeriodo.reduce((s, l) => s + Number(l.parcela.valor), 0))}
          </p>
          <p className="text-xs text-cinza mt-1">{doPeriodo.length} vencimento(s)</p>
        </div>
        <div className="cartao p-4">
          <p className="eyebrow">Em atraso de antes</p>
          <p
            className={`serif text-2xl tabular mt-1 ${
              atrasadas.length ? "text-vermelho" : ""
            }`}
          >
            {moedaCurta(atrasadas.reduce((s, l) => s + Number(l.parcela.valor), 0))}
          </p>
          <p className="text-xs text-cinza mt-1">{atrasadas.length} parcela(s)</p>
        </div>
      </section>

      <section className="cartao overflow-x-auto">
        <table className="tabela">
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Contrato</th>
              <th>Comprador</th>
              <th>Parcela</th>
              <th className="num">Valor</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {[
              ...linhas.map((l) => ({ ...l, paga: false })),
              ...recebidasDoPeriodo.map((l) => ({ atrasada: false, paga: true, parcela: l.parcela })),
            ]
              .sort((a, b) => a.parcela.vencimento.localeCompare(b.parcela.vencimento))
              .map(({ parcela: p, paga, atrasada }) => {
                const contrato = p.comissao?.contrato;
                const situacao = paga ? "paga" : atrasada ? "vencida" : "a_vencer";
                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-papel-alt ${
                      paga ? "bg-verde-fraco/40" : atrasada ? "bg-vermelho-fraco/40" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap font-semibold">{dataBR(p.vencimento)}</td>
                    <td className="whitespace-nowrap">
                      {contrato ? (
                        <Link href={`/contratos/${contrato.id}`} className="text-vinho font-semibold">
                          {contrato.codigo}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{contrato?.cliente?.nome ?? contrato?.titulo ?? "—"}</td>
                    <td className="text-cinza whitespace-nowrap">{p.numero}ª</td>
                    <td className="num font-semibold">
                      {paga ? moeda(Number(p.valor_pago ?? p.valor)) : moeda(Number(p.valor))}
                      {paga && p.pago_em && (
                        <span className="block text-[10px] text-cinza font-normal">
                          pago em {dataBR(p.pago_em)}
                        </span>
                      )}
                    </td>
                    <td>
                      <SeloParcela situacao={situacao} />
                    </td>
                  </tr>
                );
              })}
            {linhas.length === 0 && recebidasDoPeriodo.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-cinza py-8">
                  {janela > 0
                    ? `Nenhuma comissão entre ${competenciaPorExtenso(mes)} e ${competenciaPorExtenso(ate)}.`
                    : `Nenhuma comissão em ${competenciaPorExtenso(mes)}.`}
                </td>
              </tr>
            )}
          </tbody>
          {linhas.length > 0 && (
            <tfoot>
              <tr className="bg-papel-alt font-semibold">
                <td colSpan={4} className="text-right">
                  Total
                </td>
                <td className="num">{moeda(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>
    </>
  );
}
