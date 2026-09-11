"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CloudDownload, Trash2 } from "lucide-react";
import {
  apagarIndice,
  importarSerieBcb,
  importarTodasAsSeries,
  lancarIndice,
  type ResultadoImportacao,
} from "@/app/indices/acoes";
import CampoNumero from "@/components/CampoNumero";
import type { Indexador } from "@/lib/calc/tipos";
import { competencia, hojeISO, somarMeses } from "@/lib/contratos/mes";
import { SERIE_SGS } from "@/lib/indices/bcb";
import type { IndiceMensal } from "@/lib/contratos/tipos";
import type { IndexadorRef } from "@/lib/db/tipos";
import { mensagemDeFalha } from "@/lib/erros";
import { indiceMes, pct, ROTULO_INDEXADOR } from "@/lib/formato";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Acumulado de uma lista de variações: produto dos (1 + v), nunca a soma. */
function acumular(variacoes: number[]): number {
  return variacoes.reduce((f, v) => f * (1 + v), 1) - 1;
}

export default function IndicesPainel({
  indexadores,
  series,
  ehAdmin,
}: {
  indexadores: IndexadorRef[];
  series: IndiceMensal[];
  ehAdmin: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [codigo, setCodigo] = useState<Indexador>("incc");
  // o mês passado: o índice de um mês só existe depois que ele fecha
  const [mes, setMes] = useState(() => somarMeses(competencia(hojeISO()), -1));
  const [variacao, setVariacao] = useState<number | null>(null);
  const [fonte, setFonte] = useState("");

  // cinco anos cobrem com folga o contrato mais antigo da casa; quem
  // precisar de mais é só mudar o mês
  const [desde, setDesde] = useState(() => somarMeses(competencia(hojeISO()), -60));
  const [substituir, setSubstituir] = useState(false);
  const [importacao, setImportacao] = useState<ResultadoImportacao[] | null>(null);

  const doIndice = useMemo(
    () =>
      series
        .filter((s) => s.indexador === codigo)
        .map((s) => ({ ...s, comp: competencia(s.competencia) }))
        .sort((a, b) => b.comp.localeCompare(a.comp)),
    [series, codigo]
  );

  const porCompetencia = useMemo(
    () => new Map(doIndice.map((s) => [s.comp, s])),
    [doIndice]
  );

  const anos = useMemo(() => {
    const lista = [...new Set(doIndice.map((s) => Number(s.comp.slice(0, 4))))];
    const anoAtual = new Date().getFullYear();
    if (!lista.includes(anoAtual)) lista.push(anoAtual);
    return lista.sort((a, b) => b - a);
  }, [doIndice]);

  const ref = indexadores.find((i) => i.codigo === codigo);

  // Últimos 12 meses seguidos a partir do mais recente lançado. Sem os 12
  // completos a referência não se recalcula — a tela diz quantos faltam em
  // vez de mostrar um acumulado que não cobre um ano.
  const doze = useMemo(() => {
    if (doIndice.length === 0) return null;
    const esperadas = Array.from({ length: 12 }, (_, k) =>
      somarMeses(doIndice[0].comp, -k)
    );
    const faltam = esperadas.filter((c) => !porCompetencia.has(c));
    if (faltam.length > 0) return { completo: false, faltam: faltam.length };
    const acumulado = acumular(
      esperadas.map((c) => Number(porCompetencia.get(c)!.variacao))
    );
    return {
      completo: true as const,
      acumulado,
      mensal: Math.pow(1 + acumulado, 1 / 12) - 1,
      ate: doIndice[0].comp,
    };
  }, [doIndice, porCompetencia]);

  function lancar() {
    if (variacao === null) {
      setErro("Informe a variação do mês.");
      return;
    }
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      try {
        await lancarIndice({
          indexador: codigo,
          competencia: mes,
          variacao: variacao / 100,
          fonte: fonte || null,
          observacao: null,
        });
        setVariacao(null);
        setMes((m) => somarMeses(m, 1));
        setAviso(`${ROTULO_INDEXADOR[codigo]} de ${mes} lançado.`);
        router.refresh();
      } catch (e) {
        setErro(mensagemDeFalha(e));
      }
    });
  }

  function importar(todos: boolean) {
    setErro(null);
    setAviso(null);
    setImportacao(null);
    iniciar(async () => {
      try {
        const r = todos
          ? await importarTodasAsSeries(desde, substituir)
          : [await importarSerieBcb(codigo, desde, substituir)];
        setImportacao(r);
        router.refresh();
      } catch (e) {
        setErro(mensagemDeFalha(e));
      }
    });
  }

  function editar(comp: string) {
    const linha = porCompetencia.get(comp);
    setMes(comp);
    setVariacao(linha ? Number(linha.variacao) * 100 : null);
    setFonte(linha?.fonte ?? "");
    setAviso(null);
    setErro(null);
  }

  function remover(comp: string) {
    const linha = porCompetencia.get(comp);
    if (!linha) return;
    if (!confirm(`Apagar o ${ROTULO_INDEXADOR[codigo]} de ${comp}?`)) return;
    setErro(null);
    iniciar(async () => {
      try {
        await apagarIndice(linha.id);
        router.refresh();
      } catch (e) {
        setErro(mensagemDeFalha(e));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap gap-1.5">
        {indexadores.map((i) => {
          const qtd = series.filter((s) => s.indexador === i.codigo).length;
          const ativo = i.codigo === codigo;
          return (
            <button
              key={i.codigo}
              onClick={() => setCodigo(i.codigo)}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold border ${
                ativo
                  ? "bg-vinho text-sobre-vinho border-vinho"
                  : "bg-superficie text-tinta-suave border-linha-forte hover:bg-papel-alt"
              }`}
            >
              {i.nome}
              <span className={`ml-2 text-xs ${ativo ? "opacity-80" : "text-cinza"}`}>
                {qtd}
              </span>
            </button>
          );
        })}
      </nav>

      {ref?.descricao && <p className="text-sm text-cinza -mt-2">{ref.descricao}</p>}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="cartao p-4">
          <p className="eyebrow">Acumulado 12 meses</p>
          <p className="serif text-2xl tabular mt-1">
            {doze?.completo ? pct(doze.acumulado, 2) : "—"}
          </p>
          <p className="text-xs text-cinza mt-1">
            {doze?.completo
              ? `12 meses até ${doze.ate}, calculado da série`
              : doze
                ? `Faltam ${doze.faltam} ${doze.faltam === 1 ? "mês" : "meses"} para fechar 12`
                : "Nenhum mês lançado ainda"}
          </p>
        </div>

        <div className="cartao p-4">
          <p className="eyebrow">Taxa mensal de projeção</p>
          <p className="serif text-2xl tabular mt-1">
            {ref?.taxa_mensal_referencia !== null && ref?.taxa_mensal_referencia !== undefined
              ? indiceMes(ref.taxa_mensal_referencia)
              : "—"}
          </p>
          <p className="text-xs text-cinza mt-1">
            {ref?.fonte ?? "sem fonte"}
            {ref?.referencia ? ` · ${ref.referencia}` : ""} · usada nas propostas
          </p>
        </div>

        <div className="cartao p-4">
          <p className="eyebrow">Último mês lançado</p>
          <p className="serif text-2xl tabular mt-1">
            {doIndice[0] ? indiceMes(Number(doIndice[0].variacao)) : "—"}
          </p>
          <p className="text-xs text-cinza mt-1">
            {doIndice[0] ? doIndice[0].comp : "lance o primeiro mês abaixo"}
          </p>
        </div>
      </section>

      {/* ------------------------------------------- importação do BCB */}
      {ehAdmin && (
        <section className="cartao p-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="rotulo">Buscar a série desde</label>
              <input
                type="month"
                className="campo w-40"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primario"
              onClick={() => importar(false)}
              disabled={pendente || !SERIE_SGS[codigo]}
              title={
                SERIE_SGS[codigo]
                  ? `Série ${SERIE_SGS[codigo]!.codigo} do SGS`
                  : "O Banco Central não publica série mensal deste índice"
              }
            >
              <CloudDownload size={16} />
              {pendente ? "Buscando…" : `Atualizar ${ROTULO_INDEXADOR[codigo]}`}
            </button>

            <button
              className="btn btn-secundario"
              onClick={() => importar(true)}
              disabled={pendente}
            >
              Atualizar todos os índices
            </button>

            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={substituir}
                onChange={(e) => setSubstituir(e.target.checked)}
              />
              Substituir os meses já lançados
            </label>
          </div>

          <p className="text-xs text-cinza">
            Busca no Banco Central (SGS), que espelha o número publicado pela
            FGV. O <strong>mês corrente nunca entra</strong>: as séries
            acumuladas no mês trazem o parcial até hoje, que não é a variação
            do mês fechado. Sem marcar &ldquo;substituir&rdquo;, meses já
            lançados ficam como estão — uma correção sua não é desfeita.
            {!SERIE_SGS[codigo] && (
              <>
                {" "}
                <strong>
                  O {ROTULO_INDEXADOR[codigo]} não tem série mensal no Banco
                  Central e continua sendo lançado à mão.
                </strong>
              </>
            )}
          </p>

          {importacao && (
            <div className="rounded-md bg-papel-alt p-3 flex flex-col gap-1">
              {importacao.map((r) => (
                <p key={r.indexador} className="text-sm">
                  <strong>{r.nome}</strong>{" "}
                  {r.erro ? (
                    <span className="text-vermelho">{r.erro}</span>
                  ) : r.novos === 0 && r.atualizados === 0 ? (
                    <span className="text-cinza">
                      já estava em dia
                      {r.ultimo ? ` até ${r.ultimo}` : ""} · {r.mantidos} meses
                      conferidos
                    </span>
                  ) : (
                    <span className="text-verde">
                      {r.novos > 0 &&
                        `${r.novos} ${r.novos === 1 ? "mês novo" : "meses novos"}`}
                      {r.novos > 0 && r.atualizados > 0 && ", "}
                      {r.atualizados > 0 &&
                        `${r.atualizados} ${r.atualizados === 1 ? "mês corrigido" : "meses corrigidos"}`}
                      {r.primeiro && r.ultimo ? ` · de ${r.primeiro} a ${r.ultimo}` : ""}
                    </span>
                  )}
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {ehAdmin && (
        <section className="cartao p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="rotulo">Competência</label>
            <input
              type="month"
              className="campo w-40"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
            />
          </div>
          <div className="w-36">
            <label className="rotulo">Variação do mês</label>
            <CampoNumero
              valor={variacao}
              aoMudar={setVariacao}
              casas={4}
              sufixo="%"
              placeholder="0,8500"
            />
          </div>
          <div className="w-48">
            <label className="rotulo">Fonte</label>
            <input
              className="campo"
              value={fonte}
              onChange={(e) => setFonte(e.target.value)}
              placeholder={ref?.fonte ?? "FGV"}
            />
          </div>
          <button className="btn btn-primario" onClick={lancar} disabled={pendente}>
            <Check size={16} /> Lançar {ROTULO_INDEXADOR[codigo]}
          </button>
          <p className="text-xs text-cinza flex-1 min-w-[240px]">
            Lançar de novo o mesmo mês substitui o número — é assim que a
            prévia vira o índice fechado.
          </p>
        </section>
      )}

      {erro && (
        <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2">{erro}</p>
      )}
      {aviso && !erro && (
        <p className="text-sm text-verde bg-verde-fraco rounded-md px-3 py-2">{aviso}</p>
      )}

      <section className="cartao overflow-x-auto">
        <div className="cartao-titulo">
          <h2 className="serif text-lg">Série do {ROTULO_INDEXADOR[codigo]}</h2>
          {ehAdmin && (
            <span className="text-xs text-cinza">
              clique num mês para corrigir o número
            </span>
          )}
        </div>
        <table className="tabela">
          <thead>
            <tr>
              <th>Ano</th>
              {MESES.map((m) => (
                <th key={m} className="num">
                  {m}
                </th>
              ))}
              <th className="num">No ano</th>
            </tr>
          </thead>
          <tbody>
            {anos.map((ano) => {
              const doAno = MESES.map((_, i) => {
                const comp = `${ano}-${String(i + 1).padStart(2, "0")}`;
                return { comp, linha: porCompetencia.get(comp) };
              });
              const lancados = doAno
                .filter((c) => c.linha)
                .map((c) => Number(c.linha!.variacao));

              return (
                <tr key={ano}>
                  <td className="font-semibold">{ano}</td>
                  {doAno.map(({ comp, linha }) => {
                    const numeroFormatado = linha
                      ? (Number(linha.variacao) * 100).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "·";
                    const classe = `w-full px-2 py-1.5 text-right tabular text-xs ${
                      linha
                        ? Number(linha.variacao) < 0
                          ? "text-vermelho font-semibold"
                          : "text-tinta"
                        : "text-linha-forte"
                    }`;
                    return (
                      <td key={comp} className="num p-0">
                        {ehAdmin ? (
                          <button
                            onClick={() => editar(comp)}
                            onDoubleClick={() => remover(comp)}
                            title={
                              linha
                                ? `${linha.fonte ?? "sem fonte"} · clique para corrigir, duplo clique para apagar`
                                : "clique para lançar este mês"
                            }
                            className={`${classe} hover:bg-papel-alt ${comp === mes ? "bg-dourado-fraco" : ""}`}
                          >
                            {numeroFormatado}
                          </button>
                        ) : (
                          <span
                            title={linha?.fonte ?? undefined}
                            className={`${classe} block`}
                          >
                            {numeroFormatado}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="num font-semibold">
                    {lancados.length === 12
                      ? pct(acumular(lancados), 2)
                      : lancados.length
                        ? `${pct(acumular(lancados), 2)} (${lancados.length}m)`
                        : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {doIndice.length > 0 && (
        <section className="cartao overflow-x-auto">
          <div className="cartao-titulo">
            <h2 className="serif text-lg">Lançamentos</h2>
          </div>
          <table className="tabela">
            <thead>
              <tr>
                <th>Competência</th>
                <th className="num">Variação</th>
                <th>Fonte</th>
                <th>Observação</th>
                {ehAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {doIndice.slice(0, 24).map((s) => (
                <tr key={s.id} className="hover:bg-papel-alt">
                  <td className="font-semibold">{s.comp}</td>
                  <td
                    className={`num ${Number(s.variacao) < 0 ? "text-vermelho" : ""}`}
                  >
                    {indiceMes(Number(s.variacao))}
                  </td>
                  <td className="text-cinza">{s.fonte ?? "—"}</td>
                  <td className="text-cinza">{s.observacao ?? "—"}</td>
                  {ehAdmin && (
                    <td className="num">
                      <button
                        className="btn btn-fantasma px-2 py-1"
                        onClick={() => remover(s.comp)}
                        disabled={pendente}
                        title="Apagar lançamento"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
