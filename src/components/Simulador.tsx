"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Copy,
  Download,
  Plus,
  Printer,
  Save,
  Trash2,
} from "lucide-react";
import BlocoEditor from "./BlocoEditor";
import CampoNumero from "./CampoNumero";
import { SeloProposta } from "./SeloStatus";
import {
  apagarProposta,
  duplicarProposta,
  salvarProposta,
} from "@/app/propostas/acoes";
import { calcular } from "@/lib/calc";
import type { Bloco, PropostaStatus } from "@/lib/calc/tipos";
import type {
  Cliente,
  CondicaoPagamento,
  Empreendimento,
  Lote,
  Proposta,
  PropostaBloco,
  PropostaLote,
} from "@/lib/db/tipos";
import { area, moeda, num, pct, precoM2, rotuloMes } from "@/lib/formato";

const STATUS: PropostaStatus[] = [
  "rascunho",
  "enviada",
  "em_negociacao",
  "aceita",
  "recusada",
  "expirada",
];

const idLocal = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tmp-${Math.random().toString(36).slice(2)}`;

export default function Simulador({
  proposta,
  empreendimento,
  cliente,
  lotesIniciais,
  blocosIniciais,
  lotesDisponiveis,
  condicoes,
}: {
  proposta: Proposta;
  empreendimento: Empreendimento;
  cliente: Cliente | null;
  lotesIniciais: PropostaLote[];
  blocosIniciais: PropostaBloco[];
  lotesDisponiveis: Lote[];
  condicoes: CondicaoPagamento[];
}) {
  const [titulo, setTitulo] = useState(proposta.titulo ?? "");
  const [status, setStatus] = useState<PropostaStatus>(proposta.status);
  const [dataBase, setDataBase] = useState(proposta.data_base);
  const [validade, setValidade] = useState(proposta.validade_dias);
  const [incc, setIncc] = useState(Number(proposta.incc_mensal));
  const [jurosVP, setJurosVP] = useState(Number(proposta.juros_vp_mensal));
  const [corrigeprimeira, setCorrigePrimeira] = useState(
    proposta.correcao_primeira_parcela
  );
  const [descontoPct, setDescontoPct] = useState(Number(proposta.desconto_pct));
  const [descontoValor, setDescontoValor] = useState(Number(proposta.desconto_valor));
  const [descontoMotivo, setDescontoMotivo] = useState(proposta.desconto_motivo ?? "");
  const [observacoes, setObservacoes] = useState(proposta.observacoes ?? "");
  const [lotes, setLotes] = useState<PropostaLote[]>(lotesIniciais);
  const [blocos, setBlocos] = useState<PropostaBloco[]>(blocosIniciais);
  const [mostrarFluxo, setMostrarFluxo] = useState(false);

  const [salvando, iniciarSalvar] = useTransition();
  const [recado, setRecado] = useState<string | null>(null);
  const [sujo, setSujo] = useState(false);

  const marcar = () => setSujo(true);

  const resultado = useMemo(
    () =>
      calcular({
        lotes: lotes.map((l) => ({
          quadra: l.quadra,
          numero: l.numero,
          area_m2: Number(l.area_m2),
          preco_tabela: Number(l.preco_tabela),
          valor_negociado: Number(l.valor_negociado),
        })),
        blocos: blocos as unknown as Bloco[],
        premissas: {
          incc_mensal: incc,
          juros_vp_mensal: jurosVP,
          correcao_primeira_parcela: corrigeprimeira,
        },
        desconto_pct: descontoPct,
        desconto_valor: descontoValor,
      }),
    [lotes, blocos, incc, jurosVP, corrigeprimeira, descontoPct, descontoValor]
  );

  const porBloco = useMemo(
    () => new Map(resultado.blocos.map((b) => [b.bloco.id, b])),
    [resultado]
  );

  const naoUsados = lotesDisponiveis.filter(
    (l) => !lotes.some((pl) => pl.lote_id === l.id)
  );

  function salvar() {
    setRecado(null);
    iniciarSalvar(async () => {
      try {
        await salvarProposta({
          id: proposta.id,
          titulo: titulo || null,
          status,
          data_base: dataBase,
          validade_dias: validade,
          incc_mensal: incc,
          juros_vp_mensal: jurosVP,
          correcao_primeira_parcela: corrigeprimeira,
          desconto_pct: descontoPct,
          desconto_valor: descontoValor,
          desconto_motivo: descontoMotivo || null,
          observacoes: observacoes || null,
          lotes,
          blocos,
        });
        setSujo(false);
        setRecado("Proposta salva.");
      } catch (e) {
        setRecado((e as Error).message);
      }
    });
  }

  function aplicarCondicao(id: string) {
    const c = condicoes.find((x) => x.id === id);
    if (!c) return;
    setDescontoPct(Number(c.desconto_pct));
    setBlocos(
      c.template.map((b, i) => ({
        id: idLocal(),
        proposta_id: proposta.id,
        ordem: i,
        rotulo: b.rotulo,
        tipo: b.tipo,
        base_percentual: b.base_percentual ?? null,
        base_valor: b.base_valor ?? null,
        absorve_residuo: b.absorve_residuo ?? false,
        qtd_parcelas: b.qtd_parcelas,
        mes_inicio: b.mes_inicio,
        indexador: b.indexador,
        taxa_indexador_mensal: b.taxa_indexador_mensal ?? null,
        juros_mensal: b.juros_mensal,
        amortizacao: b.amortizacao,
        parcela_fixa: b.parcela_fixa ?? null,
        observacao: b.observacao ?? null,
      }))
    );
    marcar();
  }

  function adicionarBloco() {
    setBlocos((b) => [
      ...b,
      {
        id: idLocal(),
        proposta_id: proposta.id,
        ordem: b.length,
        rotulo: `Bloco ${b.length + 1}`,
        tipo: "parcelas",
        base_percentual: null,
        base_valor: null,
        absorve_residuo: true,
        qtd_parcelas: 12,
        mes_inicio: (b[b.length - 1]?.mes_inicio ?? 0) + (b[b.length - 1]?.qtd_parcelas ?? 1),
        indexador: "incc",
        taxa_indexador_mensal: null,
        juros_mensal: 0,
        amortizacao: "nenhuma",
        parcela_fixa: null,
        observacao: null,
      },
    ]);
    marcar();
  }

  function mudarBloco(id: string, patch: Partial<PropostaBloco>) {
    setBlocos((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    marcar();
  }

  function moverBloco(id: string, direcao: -1 | 1) {
    setBlocos((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + direcao;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const copia = [...bs];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia.map((b, k) => ({ ...b, ordem: k }));
    });
    marcar();
  }

  function adicionarLote(loteId: string) {
    const l = lotesDisponiveis.find((x) => x.id === loteId);
    if (!l) return;
    setLotes((ls) => [
      ...ls,
      {
        id: idLocal(),
        proposta_id: proposta.id,
        lote_id: l.id,
        quadra: l.quadra,
        numero: l.numero,
        area_m2: Number(l.area_m2),
        preco_tabela: Number(l.preco_tabela ?? 0),
        valor_negociado: Number(l.preco_tabela ?? 0),
        ordem: ls.length,
      },
    ]);
    marcar();
  }

  const validadeAte = useMemo(() => {
    const d = new Date(`${dataBase}T12:00:00`);
    d.setDate(d.getDate() + validade);
    return d.toLocaleDateString("pt-BR");
  }, [dataBase, validade]);

  return (
    <div className="flex flex-col gap-6">
      {/* ------------------------------------------------------- cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {empreendimento.nome} · {proposta.codigo}
          </p>
          <h1 className="serif text-3xl mt-1">
            {cliente?.nome ?? (titulo || "Proposta sem cliente")}
          </h1>
          <p className="text-sm text-cinza mt-1">
            {proposta.condicao_origem
              ? `Partiu de: ${proposta.condicao_origem}`
              : "Estrutura montada do zero"}
            {" · "}
            válida até {validadeAte}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sem-impressao">
          <SeloProposta status={status} />
          <Link
            href={`/propostas/${proposta.id}/imprimir`}
            target="_blank"
            className="btn btn-secundario"
          >
            <Printer size={15} /> Proposta em PDF
          </Link>
          <a
            href={`/api/propostas/${proposta.id}/xlsx`}
            className="btn btn-secundario"
            title="Planilha com o fluxo completo, para uso interno"
          >
            <Download size={15} /> XLSX
          </a>
          <button
            className="btn btn-fantasma"
            onClick={() => duplicarProposta(proposta.id)}
            title="Duplicar"
          >
            <Copy size={15} />
          </button>
          <button
            className="btn btn-fantasma text-vermelho"
            onClick={() => {
              if (confirm("Apagar esta proposta? Não dá para desfazer.")) {
                apagarProposta(proposta.id);
              }
            }}
            title="Apagar"
          >
            <Trash2 size={15} />
          </button>
          <button className="btn btn-primario" onClick={salvar} disabled={salvando}>
            <Save size={15} />
            {salvando ? "Salvando…" : sujo ? "Salvar alterações" : "Salvo"}
          </button>
        </div>
      </div>

      {recado && (
        <p className="text-sm rounded-md px-3 py-2 bg-papel-alt text-tinta-suave">
          {recado}
        </p>
      )}

      {resultado.avisos.length > 0 && (
        <div className="rounded-md px-3 py-2.5 bg-ambar-fraco text-ambar flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <ul className="text-sm flex flex-col gap-0.5">
            {resultado.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* --------------------------------------------------------- resumo */}
      <section className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        {[
          ["Preço de tabela", moeda(resultado.valorTabela), precoM2(resultado.precoM2Tabela)],
          [
            "Valor negociado",
            moeda(resultado.valorNegociado),
            `−${pct(resultado.descontoEfetivoPct, 2)} · ${precoM2(resultado.precoM2Negociado)}`,
          ],
          [
            "Entrada",
            moeda(resultado.entrada),
            `${pct(resultado.entradaPct, 1)} do negociado`,
          ],
          [
            "Total nominal",
            moeda(resultado.totalNominal),
            `${resultado.prazoMeses} meses`,
          ],
          [
            "Valor presente",
            moeda(resultado.totalVP),
            `a ${pct(jurosVP, 2)} a.m. · ${precoM2(resultado.precoM2VP)}`,
          ],
          [
            "Maior parcela",
            moeda(resultado.maiorParcela),
            `juros + correção ${moeda(resultado.totalJuros + resultado.totalCorrecao)}`,
          ],
        ].map(([rotulo, valor, nota], i) => (
          <div key={rotulo} className={`cartao p-4 ${i === 1 ? "border-vinho" : ""}`}>
            <p className="eyebrow">{rotulo}</p>
            <p
              className={`serif text-xl tabular mt-1 ${i === 1 ? "text-vinho" : ""}`}
            >
              {valor}
            </p>
            <p className="text-[11px] text-cinza mt-1">{nota}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        {/* ------------------------------------------------------- blocos */}
        <div className="flex flex-col gap-4">
          <section className="cartao">
            <div className="cartao-titulo flex-wrap">
              <h2 className="serif text-lg">Terrenos</h2>
              {naoUsados.length > 0 && (
                <select
                  className="campo w-auto text-xs"
                  value=""
                  onChange={(e) => e.target.value && adicionarLote(e.target.value)}
                >
                  <option value="">+ adicionar terreno</option>
                  {naoUsados.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.quadra}-{l.numero} · {num(Number(l.area_m2))} m² ·{" "}
                      {moeda(Number(l.preco_tabela ?? 0))}
                      {l.status !== "livre" ? ` (${l.status})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th className="num">Área</th>
                    <th className="num">Tabela</th>
                    <th className="num">Valor negociado</th>
                    <th className="num">R$/m²</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lotes.map((l) => (
                    <tr key={l.id}>
                      <td className="font-semibold whitespace-nowrap">
                        {l.quadra}-{l.numero}
                      </td>
                      <td className="num">{area(Number(l.area_m2))}</td>
                      <td className="num text-cinza">{moeda(Number(l.preco_tabela))}</td>
                      <td className="num w-40">
                        <CampoNumero
                          valor={Number(l.valor_negociado)}
                          aoMudar={(v) => {
                            setLotes((ls) =>
                              ls.map((x) =>
                                x.id === l.id ? { ...x, valor_negociado: v ?? 0 } : x
                              )
                            );
                            marcar();
                          }}
                          prefixo="R$"
                        />
                      </td>
                      <td className="num text-cinza">
                        {precoM2(Number(l.valor_negociado) / Number(l.area_m2))}
                      </td>
                      <td>
                        <button
                          className="btn btn-fantasma px-2 text-vermelho"
                          onClick={() => {
                            setLotes((ls) => ls.filter((x) => x.id !== l.id));
                            marcar();
                          }}
                          title="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {lotes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-cinza py-5">
                        Nenhum terreno na proposta.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="cartao">
            <div className="cartao-titulo flex-wrap">
              <h2 className="serif text-lg">Estrutura de pagamento</h2>
              <div className="flex gap-2 items-center flex-wrap">
                {condicoes.length > 0 && (
                  <select
                    className="campo w-auto text-xs"
                    value=""
                    onChange={(e) => {
                      if (
                        e.target.value &&
                        confirm("Substituir os blocos atuais pelo modelo da condição?")
                      ) {
                        aplicarCondicao(e.target.value);
                      }
                    }}
                  >
                    <option value="">aplicar condição da tabela…</option>
                    {condicoes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                )}
                <button className="btn btn-secundario" onClick={adicionarBloco}>
                  <Plus size={15} /> Bloco
                </button>
              </div>
            </div>

            <div className="p-3 flex flex-col gap-3">
              {blocos.map((b, i) => (
                <BlocoEditor
                  key={b.id}
                  bloco={b}
                  calculado={porBloco.get(b.id)}
                  dataBase={dataBase}
                  inccProposta={incc}
                  primeiro={i === 0}
                  ultimo={i === blocos.length - 1}
                  aoMudar={(patch) => mudarBloco(b.id, patch)}
                  aoRemover={() => {
                    setBlocos((bs) => bs.filter((x) => x.id !== b.id));
                    marcar();
                  }}
                  aoDuplicar={() => {
                    setBlocos((bs) => {
                      const copia = { ...b, id: idLocal(), rotulo: `${b.rotulo} (cópia)` };
                      const out = [...bs];
                      out.splice(i + 1, 0, copia);
                      return out.map((x, k) => ({ ...x, ordem: k }));
                    });
                    marcar();
                  }}
                  aoMover={(d) => moverBloco(b.id, d)}
                />
              ))}
              {blocos.length === 0 && (
                <p className="text-sm text-cinza text-center py-5">
                  Sem blocos. Adicione um ou aplique uma condição da tabela.
                </p>
              )}
            </div>
          </section>

          <section className="cartao">
            <div className="cartao-titulo">
              <h2 className="serif text-lg">Fluxo consolidado</h2>
              <button
                className="btn btn-fantasma"
                onClick={() => setMostrarFluxo((v) => !v)}
              >
                {mostrarFluxo ? "ocultar" : `mostrar ${resultado.fluxo.length} vencimentos`}
              </button>
            </div>
            {mostrarFluxo && (
              <div className="overflow-x-auto max-h-[520px]">
                <table className="tabela">
                  <thead className="sticky top-0">
                    <tr>
                      <th>Mês</th>
                      <th>Vencimento</th>
                      <th>Composição</th>
                      <th className="num">Valor</th>
                      <th className="num">Valor presente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.fluxo.map((f) => (
                      <tr key={f.mes}>
                        <td className="tabular">{f.mes}</td>
                        <td className="text-cinza">{rotuloMes(f.mes, dataBase)}</td>
                        <td className="text-cinza text-xs">
                          {f.itens
                            .map((it) =>
                              f.itens.length > 1
                                ? `${it.rotulo} ${moeda(it.valor)}`
                                : `${it.rotulo} (${it.indice}/${
                                    blocos.find((b) => b.id === it.blocoId)?.qtd_parcelas ?? 1
                                  })`
                            )
                            .join(" + ")}
                        </td>
                        <td className="num font-semibold">{moeda(f.valor)}</td>
                        <td className="num text-cinza">{moeda(f.vp)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-papel-alt font-semibold">
                      <td colSpan={3}>Total</td>
                      <td className="num">{moeda(resultado.totalNominal)}</td>
                      <td className="num">{moeda(resultado.totalVP)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* -------------------------------------------------- lateral */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <section className="cartao p-4 flex flex-col gap-3">
            <h2 className="serif text-lg">Negociação</h2>

            <div>
              <label className="rotulo">Desconto sobre os terrenos</label>
              <CampoNumero
                valor={descontoPct * 100}
                aoMudar={(v) => {
                  setDescontoPct((v ?? 0) / 100);
                  marcar();
                }}
                sufixo="%"
              />
            </div>

            <div>
              <label className="rotulo">Desconto em valor</label>
              <CampoNumero
                valor={descontoValor}
                aoMudar={(v) => {
                  setDescontoValor(v ?? 0);
                  marcar();
                }}
                prefixo="R$"
              />
            </div>

            <div>
              <label className="rotulo">Motivo do desconto</label>
              <input
                className="campo"
                value={descontoMotivo}
                onChange={(e) => {
                  setDescontoMotivo(e.target.value);
                  marcar();
                }}
                placeholder="Ex.: compra dos dois lotes"
              />
            </div>

            <div className="bg-papel rounded-md p-3 text-sm flex flex-col gap-1">
              <span className="flex justify-between">
                <span className="text-cinza">Soma dos terrenos</span>
                <span className="tabular">
                  {moeda(lotes.reduce((s, l) => s + Number(l.valor_negociado), 0))}
                </span>
              </span>
              <span className="flex justify-between">
                <span className="text-cinza">Desconto</span>
                <span className="tabular text-vermelho">
                  −{moeda(resultado.descontoValor)}
                </span>
              </span>
              <span className="flex justify-between font-semibold border-t border-linha pt-1 mt-1">
                <span>Valor negociado</span>
                <span className="tabular">{moeda(resultado.valorNegociado)}</span>
              </span>
              <span className="flex justify-between">
                <span className="text-cinza">Alocado nos blocos</span>
                <span
                  className={`tabular ${
                    Math.abs(resultado.residuo) >= 0.5 ? "text-ambar font-semibold" : ""
                  }`}
                >
                  {moeda(resultado.alocado)}
                </span>
              </span>
            </div>
          </section>

          <section className="cartao p-4 flex flex-col gap-3">
            <h2 className="serif text-lg">Premissas</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="rotulo">INCC a.m.</label>
                <CampoNumero
                  valor={incc * 100}
                  aoMudar={(v) => {
                    setIncc((v ?? 0) / 100);
                    marcar();
                  }}
                  casas={3}
                  sufixo="%"
                />
              </div>
              <div>
                <label className="rotulo">Taxa p/ valor presente</label>
                <CampoNumero
                  valor={jurosVP * 100}
                  aoMudar={(v) => {
                    setJurosVP((v ?? 0) / 100);
                    marcar();
                  }}
                  casas={3}
                  sufixo="%"
                />
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={corrigeprimeira}
                onChange={(e) => {
                  setCorrigePrimeira(e.target.checked);
                  marcar();
                }}
              />
              <span>
                Corrigir já a 1ª parcela
                <span className="block text-xs text-cinza">
                  Desligado: fator 1 no 1º mês (convenção das propostas de
                  parcelamento). Ligado: (1+i) já no 1º mês.
                </span>
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="rotulo">Data-base</label>
                <input
                  type="date"
                  className="campo"
                  value={dataBase}
                  onChange={(e) => {
                    setDataBase(e.target.value);
                    marcar();
                  }}
                />
              </div>
              <div>
                <label className="rotulo">Validade (dias)</label>
                <input
                  type="number"
                  className="campo text-right"
                  value={validade}
                  min={1}
                  onChange={(e) => {
                    setValidade(Number(e.target.value) || 1);
                    marcar();
                  }}
                />
              </div>
            </div>
          </section>

          <section className="cartao p-4 flex flex-col gap-3">
            <h2 className="serif text-lg">Proposta</h2>
            <div>
              <label className="rotulo">Título interno</label>
              <input
                className="campo"
                value={titulo}
                onChange={(e) => {
                  setTitulo(e.target.value);
                  marcar();
                }}
                placeholder="Ex.: contraproposta B"
              />
            </div>
            <div>
              <label className="rotulo">Status</label>
              <select
                className="campo"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as PropostaStatus);
                  marcar();
                }}
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="rotulo">Observações (saem na proposta)</label>
              <textarea
                className="campo min-h-24"
                value={observacoes}
                onChange={(e) => {
                  setObservacoes(e.target.value);
                  marcar();
                }}
                placeholder="Condições especiais, prazos, o que ficou combinado…"
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
