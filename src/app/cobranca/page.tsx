import Link from "next/link";
import { AlertTriangle, FileSpreadsheet } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import { SeloParcela } from "@/components/SeloStatus";
import { createClient } from "@/lib/supabase/server";
import { calcularContrato } from "@/lib/contratos/correcao";
import {
  competencia,
  competenciaPorExtenso,
  hojeISO,
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

export default async function CobrancaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; emp?: string; so_mes?: string }>;
}) {
  const filtros = await searchParams;
  const mes = filtros.mes && /^\d{4}-\d{2}$/.test(filtros.mes)
    ? filtros.mes
    : competencia(hojeISO());
  // Checkbox de GET não manda nada quando é desmarcado, então quem carrega
  // a informação é a exceção: "só o mês" ligado é que tira as atrasadas.
  const incluirAtrasadas = filtros.so_mes !== "1";

  const supabase = await createClient();
  const [{ data }, { data: empreendimentos }, indices] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        "id, codigo, titulo, status, data_base, valor_total, indexador, defasagem_indice_meses, corrige_primeira_parcela, juros_mora_mensal, multa_atraso_pct, empreendimento_id, teste, clientes(nome, email, telefone), empreendimentos(nome), contrato_lotes(quadra, numero), contrato_parcelas(*)"
      )
      .in("status", ["ativo", "suspenso"])
      .eq("teste", false),
    supabase.from("empreendimentos").select("id, nome").eq("ativo", true).order("nome"),
    carregarIndices(),
  ]);

  const contratos = ((data ?? []) as unknown as ContratoLinha[]).filter(
    (c) => !filtros.emp || c.empreendimento_id === filtros.emp
  );

  // Uma linha por parcela que vence no mês escolhido, mais o que ficou para
  // trás — quem emite boleto precisa das duas coisas na mesma tela. As já
  // pagas do mês entram numa lista à parte: continuam aparecendo (não somem
  // da aba assim que alguém dá baixa), mas não entram na conta do que ainda
  // falta cobrar.
  const linhas: {
    contrato: ContratoLinha;
    parcela: ParcelaCalculada;
    atrasada: boolean;
  }[] = [];
  const recebidasDoMes: { contrato: ContratoLinha; parcela: ParcelaCalculada }[] = [];

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
        if (comp === mes) recebidasDoMes.push({ contrato: c, parcela: p });
        continue;
      }
      if (comp === mes) {
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
  recebidasDoMes.sort(
    (a, b) =>
      a.parcela.vencimento.localeCompare(b.parcela.vencimento) ||
      a.contrato.codigo.localeCompare(b.contrato.codigo)
  );

  const doMes = linhas.filter((l) => competencia(l.parcela.vencimento) === mes);
  const atrasadas = linhas.filter((l) => competencia(l.parcela.vencimento) < mes);
  const total = linhas.reduce((s, l) => s + l.parcela.valorACobrar, 0);
  const recebidoDoMes = recebidasDoMes.reduce(
    (s, l) => s + Number(l.parcela.valor_pago ?? l.parcela.valorCorrigido),
    0
  );
  const estimadas = linhas.filter((l) => l.parcela.correcao.estimado);

  const params = new URLSearchParams({ mes });
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
              O que cobrar em {competenciaPorExtenso(mes)}, já com a correção
              aplicada — é a lista para emitir os boletos.
            </p>
          </div>
          <a className="btn btn-primario" href={`/api/cobranca/xlsx?${params}`}>
            <FileSpreadsheet size={16} /> Exportar XLSX
          </a>
        </div>

        <form className="cartao p-4 flex flex-wrap gap-3 items-end" method="get">
          <div>
            <label className="rotulo">Competência</label>
            <input type="month" name="mes" className="campo w-40" defaultValue={mes} />
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
            Só os vencimentos do mês, sem o que ficou em atraso
          </label>
          <button className="btn btn-secundario">Ver</button>
          <div className="flex gap-2 ml-auto text-sm">
            <Link
              className="btn btn-fantasma"
              href={`/cobranca?mes=${somarMeses(mes, -1)}${filtros.emp ? `&emp=${filtros.emp}` : ""}`}
            >
              ← mês anterior
            </Link>
            <Link
              className="btn btn-fantasma"
              href={`/cobranca?mes=${somarMeses(mes, 1)}${filtros.emp ? `&emp=${filtros.emp}` : ""}`}
            >
              próximo mês →
            </Link>
          </div>
        </form>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="cartao p-4">
            <p className="eyebrow">Recebido no mês</p>
            <p className="serif text-2xl tabular mt-1 text-verde">
              {moedaCurta(recebidoDoMes)}
            </p>
            <p className="text-xs text-cinza mt-1">
              {recebidasDoMes.length} parcela(s) já paga(s)
            </p>
          </div>
          <div className="cartao p-4">
            <p className="eyebrow">Total a cobrar</p>
            <p className="serif text-2xl tabular mt-1 text-vinho">{moedaCurta(total)}</p>
            <p className="text-xs text-cinza mt-1">{linhas.length} boleto(s)</p>
          </div>
          <div className="cartao p-4">
            <p className="eyebrow">Do mês</p>
            <p className="serif text-2xl tabular mt-1">
              {moedaCurta(doMes.reduce((s, l) => s + l.parcela.valorACobrar, 0))}
            </p>
            <p className="text-xs text-cinza mt-1">{doMes.length} vencimento(s)</p>
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
                ...recebidasDoMes.map((l) => ({ ...l, atrasada: false, paga: true })),
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
              {linhas.length === 0 && recebidasDoMes.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center text-cinza py-8">
                    Nada a receber em {competenciaPorExtenso(mes)}.
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
      </main>
    </>
  );
}
