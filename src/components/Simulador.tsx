"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Plus,
  Printer,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react";
import BlocoEditor from "./BlocoEditor";
import MontarOpcao from "./MontarOpcao";
import CampoNumero from "./CampoNumero";
import { SeloProposta } from "./SeloStatus";
import {
  apagarProposta,
  duplicarProposta,
  favoritarCenario,
  salvarProposta,
  type CenarioPayload,
} from "@/app/propostas/acoes";
import { calcular, valorDaMetrica } from "@/lib/calc";
import type {
  Bloco,
  MetricaParcela,
  PropostaStatus,
  Resultado,
} from "@/lib/calc/tipos";
import type {
  BlocoTemplate,
  CenarioComBlocos,
  Cliente,
  IndexadorRef,
  CondicaoPagamento,
  Empreendimento,
  Lote,
  Proposta,
  PropostaBloco,
  PropostaLote,
} from "@/lib/db/tipos";
import { mensagemDeFalha } from "@/lib/erros";
import { compararLote } from "@/lib/ordenacao";
import {
  area,
  METRICAS_PARCELA,
  moeda,
  NOTA_METRICA_PARCELA,
  num,
  pct,
  precoM2,
  ROTULO_METRICA_PARCELA,
  rotuloMes,
} from "@/lib/formato";

const STATUS: PropostaStatus[] = [
  "rascunho",
  "enviada",
  "em_negociacao",
  "aceita",
  "recusada",
  "expirada",
];

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * O nome da opção vira o título da seção no PDF, e ele nasce da condição da
 * tabela ("40% Entrada + 36x INCC"). Se o vendedor mexe na entrada, o nome
 * passa a mentir justamente no número que o cliente lê primeiro.
 */
function nomeDesatualizado(nome: string, entradaPct: number): number | null {
  const m = nome.match(/(\d{1,3})\s*%/);
  if (!m) return null;
  const noNome = Number(m[1]) / 100;
  return Math.abs(noNome - entradaPct) > 0.005 ? noNome : null;
}

function corrigirPercentualNoNome(nome: string, entradaPct: number): string {
  return nome.replace(/(\d{1,3})\s*%/, `${Math.round(entradaPct * 100)}%`);
}

const idLocal = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tmp-${Math.random().toString(36).slice(2)}`;

export default function Simulador({
  proposta,
  empreendimento,
  cliente,
  clientes,
  lotesIniciais,
  cenariosIniciais,
  lotesDisponiveis,
  condicoes,
  indexadores,
}: {
  proposta: Proposta;
  empreendimento: Empreendimento;
  cliente: Cliente | null;
  clientes: Cliente[];
  lotesIniciais: PropostaLote[];
  cenariosIniciais: CenarioComBlocos[];
  lotesDisponiveis: Lote[];
  condicoes: CondicaoPagamento[];
  indexadores: IndexadorRef[];
}) {
  const [titulo, setTitulo] = useState(proposta.titulo ?? "");
  const [status, setStatus] = useState<PropostaStatus>(proposta.status);
  const [dataBase, setDataBase] = useState(proposta.data_base);
  const [validade, setValidade] = useState(proposta.validade_dias);
  const [incc, setIncc] = useState(Number(proposta.incc_mensal));
  const [jurosVP, setJurosVP] = useState(Number(proposta.juros_vp_mensal));
  const [corrigePrimeira, setCorrigePrimeira] = useState(
    proposta.correcao_primeira_parcela
  );
  const [observacoes, setObservacoes] = useState(proposta.observacoes ?? "");
  const [metricas, setMetricas] = useState<MetricaParcela[]>(
    proposta.metricas_parcela?.length ? proposta.metricas_parcela : ["inicial"]
  );
  const [clienteId, setClienteId] = useState(proposta.cliente_id);
  const [criandoCliente, setCriandoCliente] = useState(false);
  const [dadosCliente, setDadosCliente] = useState(() => ({
    nome: cliente?.nome ?? "",
    empresa: cliente?.empresa ?? null,
    documento: cliente?.documento ?? null,
    email: cliente?.email ?? null,
    telefone: cliente?.telefone ?? null,
    observacao: cliente?.observacao ?? null,
  }));
  const [lotes, setLotes] = useState<PropostaLote[]>(lotesIniciais);
  const [cenarios, setCenarios] = useState<CenarioComBlocos[]>(cenariosIniciais);
  const [ativoId, setAtivoId] = useState(cenariosIniciais[0]?.id ?? "");
  const [mostrarFluxo, setMostrarFluxo] = useState(false);
  const [montando, setMontando] = useState(false);

  const [salvando, iniciarSalvar] = useTransition();
  const [favoritando, setFavoritando] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [sujo, setSujo] = useState(false);

  const marcar = () => setSujo(true);

  const lotesCalc = useMemo(
    () =>
      lotes.map((l) => ({
        quadra: l.quadra,
        numero: l.numero,
        area_m2: Number(l.area_m2),
        preco_tabela: Number(l.preco_tabela),
        valor_negociado: Number(l.valor_negociado),
      })),
    [lotes]
  );

  /** Todos os cenários calculados de uma vez — o comparativo depende disso. */
  const resultados = useMemo(() => {
    const mapa = new Map<string, Resultado>();
    for (const c of cenarios) {
      mapa.set(
        c.id,
        calcular({
          lotes: lotesCalc,
          blocos: c.blocos as unknown as Bloco[],
          premissas: {
            incc_mensal: incc,
            juros_vp_mensal: jurosVP,
            correcao_primeira_parcela: corrigePrimeira,
          },
          desconto_pct: Number(c.desconto_pct),
          desconto_valor: Number(c.desconto_valor),
        })
      );
    }
    return mapa;
  }, [cenarios, lotesCalc, incc, jurosVP, corrigePrimeira]);

  const ativo = cenarios.find((c) => c.id === ativoId) ?? cenarios[0];
  const resultado = ativo ? resultados.get(ativo.id) : undefined;

  const porBloco = useMemo(
    () => new Map((resultado?.blocos ?? []).map((b) => [b.bloco.id, b])),
    [resultado]
  );

  const naoUsados = useMemo(
    () =>
      [...lotesDisponiveis]
        .filter((l) => !lotes.some((pl) => pl.lote_id === l.id))
        .sort(compararLote),
    [lotesDisponiveis, lotes]
  );

  const CLIENTE_NOVO = "__novo__";

  function trocarCliente(valor: string) {
    const novo = valor === CLIENTE_NOVO;
    const c = novo ? undefined : clientes.find((x) => x.id === valor);
    setCriandoCliente(novo);
    setClienteId(novo ? null : valor || null);
    setDadosCliente({
      nome: c?.nome ?? "",
      empresa: c?.empresa ?? null,
      documento: c?.documento ?? null,
      email: c?.email ?? null,
      telefone: c?.telefone ?? null,
      observacao: c?.observacao ?? null,
    });
    marcar();
  }

  // ------------------------------------------------------------- cenários
  function mudarCenario(id: string, patch: Partial<CenarioComBlocos>) {
    setCenarios((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    marcar();
  }

  function adicionarCenario(
    condicao?: CondicaoPagamento,
    montada?: { nome: string; blocos: BlocoTemplate[] }
  ) {
    const modelo = montada?.blocos ?? condicao?.template ?? [];
    const novo: CenarioComBlocos = {
      id: idLocal(),
      proposta_id: proposta.id,
      ordem: cenarios.length,
      nome:
        montada?.nome ??
        condicao?.nome ??
        `Opção ${LETRAS[cenarios.length] ?? cenarios.length + 1}`,
      condicao_origem: condicao?.nome ?? null,
      desconto_pct: condicao ? Number(condicao.desconto_pct) : 0,
      desconto_valor: 0,
      desconto_motivo: null,
      recomendado: cenarios.length === 0,
      resultado: null,
      blocos: modelo.map((b, i) => ({
        id: idLocal(),
        cenario_id: "",
        ordem: i,
        rotulo: b.rotulo,
        tipo: b.tipo,
        base_percentual: b.base_percentual ?? null,
        base_valor: b.base_valor ?? null,
        absorve_residuo: b.absorve_residuo ?? false,
        qtd_parcelas: b.qtd_parcelas,
        mes_inicio: b.mes_inicio,
        periodicidade_meses: b.periodicidade_meses ?? 1,
        indexador: b.indexador,
        taxa_indexador_mensal: b.taxa_indexador_mensal ?? null,
        juros_mensal: b.juros_mensal,
        amortizacao: b.amortizacao,
        parcela_fixa: b.parcela_fixa ?? null,
        observacao: b.observacao ?? null,
      })),
    };
    setCenarios((cs) => [...cs, novo]);
    setAtivoId(novo.id);
    marcar();
  }

  function duplicarCenario(id: string) {
    const origem = cenarios.find((c) => c.id === id);
    if (!origem) return;
    const copia: CenarioComBlocos = {
      ...origem,
      id: idLocal(),
      nome: `${origem.nome} (cópia)`,
      recomendado: false,
      blocos: origem.blocos.map((b) => ({ ...b, id: idLocal() })),
    };
    setCenarios((cs) => [...cs, copia]);
    setAtivoId(copia.id);
    marcar();
  }

  function removerCenario(id: string) {
    setCenarios((cs) => {
      const restantes = cs.filter((c) => c.id !== id);
      if (restantes.length && !restantes.some((c) => c.recomendado)) {
        restantes[0] = { ...restantes[0], recomendado: true };
      }
      if (id === ativoId) setAtivoId(restantes[0]?.id ?? "");
      return restantes;
    });
    marcar();
  }

  function moverCenario(id: string, direcao: -1 | 1) {
    setCenarios((cs) => {
      const i = cs.findIndex((c) => c.id === id);
      const j = i + direcao;
      if (i < 0 || j < 0 || j >= cs.length) return cs;
      const out = [...cs];
      [out[i], out[j]] = [out[j], out[i]];
      return out.map((c, k) => ({ ...c, ordem: k }));
    });
    marcar();
  }

  /** Faz o último bloco que não é entrada absorver o que falta ou sobra. */
  function fecharConta(cenarioId: string) {
    setCenarios((cs) =>
      cs.map((c) => {
        if (c.id !== cenarioId) return c;
        const alvo = [...c.blocos].reverse().find((b) => b.tipo !== "entrada");
        if (!alvo) return c;
        return {
          ...c,
          blocos: c.blocos.map((b) =>
            b.id === alvo.id
              ? { ...b, absorve_residuo: true, base_percentual: null, base_valor: null }
              : b
          ),
        };
      })
    );
    marcar();
  }

  /** Guarda a estrutura da opção na tabela para reaparecer em novas propostas. */
  function favoritar(c: CenarioComBlocos) {
    if (!proposta.tabela_preco_id) {
      setRecado("Esta proposta não está ligada a uma tabela de preços.");
      return;
    }
    setRecado(null);
    setFavoritando(c.id);
    iniciarSalvar(async () => {
      try {
        await favoritarCenario({
          tabela_preco_id: proposta.tabela_preco_id!,
          nome: c.nome,
          descricao: `Favorita montada em ${proposta.codigo}.`,
          desconto_pct: Number(c.desconto_pct),
          blocos: c.blocos,
        });
        setRecado(`"${c.nome}" virou favorita e já aparece em novas propostas.`);
      } catch (e) {
        setRecado(mensagemDeFalha(e));
      }
      setFavoritando(null);
    });
  }

  function recomendar(id: string) {
    setCenarios((cs) => cs.map((c) => ({ ...c, recomendado: c.id === id })));
    marcar();
  }

  // --------------------------------------------------------------- blocos
  function mudarBloco(cenarioId: string, blocoId: string, patch: Partial<PropostaBloco>) {
    setCenarios((cs) =>
      cs.map((c) =>
        c.id !== cenarioId
          ? c
          : { ...c, blocos: c.blocos.map((b) => (b.id === blocoId ? { ...b, ...patch } : b)) }
      )
    );
    marcar();
  }

  function alterarBlocos(
    cenarioId: string,
    fn: (blocos: PropostaBloco[]) => PropostaBloco[]
  ) {
    setCenarios((cs) =>
      cs.map((c) =>
        c.id !== cenarioId
          ? c
          : { ...c, blocos: fn(c.blocos).map((b, i) => ({ ...b, ordem: i })) }
      )
    );
    marcar();
  }

  function adicionarBloco(cenarioId: string) {
    alterarBlocos(cenarioId, (bs) => [
      ...bs,
      {
        id: idLocal(),
        cenario_id: cenarioId,
        ordem: bs.length,
        rotulo: `Bloco ${bs.length + 1}`,
        tipo: "parcelas",
        base_percentual: null,
        base_valor: null,
        absorve_residuo: true,
        qtd_parcelas: 12,
        mes_inicio:
          (bs[bs.length - 1]?.mes_inicio ?? 0) + (bs[bs.length - 1]?.qtd_parcelas ?? 1),
        periodicidade_meses: 1,
        indexador: "incc",
        taxa_indexador_mensal: null,
        juros_mensal: 0,
        amortizacao: "nenhuma",
        parcela_fixa: null,
        observacao: null,
      },
    ]);
  }

  // ---------------------------------------------------------------- lotes
  function adicionarLote(loteId: string) {
    const l = lotesDisponiveis.find((x) => x.id === loteId);
    if (!l) return;
    setLotes((ls) =>
      [
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
      ].sort(compararLote)
    );
    marcar();
  }

  function salvar() {
    setRecado(null);
    iniciarSalvar(async () => {
      try {
        const retorno = await salvarProposta({
          id: proposta.id,
          titulo: titulo || null,
          cliente_id: clienteId,
          cliente: clienteId || criandoCliente ? dadosCliente : null,
          criar_cliente: criandoCliente,
          status,
          data_base: dataBase,
          validade_dias: validade,
          incc_mensal: incc,
          juros_vp_mensal: jurosVP,
          correcao_primeira_parcela: corrigePrimeira,
          metricas_parcela: metricas,
          observacoes: observacoes || null,
          lotes,
          cenarios: cenarios as unknown as CenarioPayload[],
        });
        if (criandoCliente && retorno.cliente_id) {
          setClienteId(retorno.cliente_id);
          setCriandoCliente(false);
        }
        setSujo(false);
        setRecado("Proposta salva.");
      } catch (e) {
        setRecado(mensagemDeFalha(e));
      }
    });
  }

  const validadeAte = useMemo(() => {
    const d = new Date(`${dataBase}T12:00:00`);
    d.setDate(d.getDate() + validade);
    return d.toLocaleDateString("pt-BR");
  }, [dataBase, validade]);

  const somaLotes = lotes.reduce((s, l) => s + Number(l.valor_negociado), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* ------------------------------------------------------- cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {empreendimento.nome} · {proposta.codigo}
          </p>
          <h1 className="serif text-3xl mt-1">
            {dadosCliente.nome || titulo || "Proposta sem cliente"}
          </h1>
          <p className="text-sm text-cinza mt-1">
            {cenarios.length === 1
              ? "1 opção de parcelamento"
              : `${cenarios.length} opções de parcelamento`}
            {" · "}válida até {validadeAte}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sem-impressao">
          <SeloProposta status={status} />
          {sujo ? (
            <span
              className="btn btn-secundario opacity-50 cursor-not-allowed"
              title="O PDF e a planilha leem o que está salvo. Salve para gerar."
            >
              <Printer size={15} /> Salve para gerar PDF/XLSX
            </span>
          ) : (
            <>
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
                title="Planilha com o fluxo completo de cada opção"
              >
                <Download size={15} /> XLSX
              </a>
            </>
          )}
          <button
            className="btn btn-fantasma"
            onClick={() => duplicarProposta(proposta.id)}
            title="Duplicar proposta"
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
            title="Apagar proposta"
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

      {/* --------------------------------------------------------- terrenos */}
      <section className="cartao">
        <div className="cartao-titulo flex-wrap">
          <h2 className="serif text-lg">
            Terrenos
            <span className="text-sm text-cinza font-sans ml-2">
              valem para todas as opções
            </span>
          </h2>
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
            {lotes.length > 1 && (
              <tfoot>
                <tr className="bg-papel-alt font-semibold">
                  <td>{lotes.length} terrenos</td>
                  <td className="num">
                    {area(lotes.reduce((s, l) => s + Number(l.area_m2), 0))}
                  </td>
                  <td className="num">
                    {moeda(lotes.reduce((s, l) => s + Number(l.preco_tabela), 0))}
                  </td>
                  <td className="num">{moeda(somaLotes)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------ comparativo */}
      {cenarios.length > 1 && (
        <section className="cartao overflow-x-auto">
          <div className="cartao-titulo">
            <h2 className="serif text-lg">Comparativo das opções</h2>
            <span className="text-xs text-cinza">
              valor presente a {pct(jurosVP, 2)} a.m.
            </span>
          </div>
          <table className="tabela">
            <thead>
              <tr>
                <th>Opção</th>
                <th className="num">Desconto</th>
                <th className="num">Valor negociado</th>
                <th className="num">Entrada</th>
                {metricas.map((m) => (
                  <th key={m} className="num">
                    {ROTULO_METRICA_PARCELA[m]}
                  </th>
                ))}
                <th className="num">Prazo</th>
                <th className="num">Total nominal</th>
                <th className="num">Valor presente</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cenarios.map((c) => {
                const r = resultados.get(c.id);
                if (!r) return null;
                return (
                  <tr
                    key={c.id}
                    className={`cursor-pointer hover:bg-papel-alt ${
                      c.id === ativoId ? "bg-vinho-fraco" : ""
                    }`}
                    onClick={() => setAtivoId(c.id)}
                  >
                    <td className="font-semibold whitespace-nowrap">
                      {c.recomendado && (
                        <Star size={12} className="inline text-dourado-escuro mr-1" />
                      )}
                      {c.nome}
                    </td>
                    <td className="num">
                      {r.descontoEfetivoPct > 0.0001
                        ? `−${pct(r.descontoEfetivoPct, 2)}`
                        : "—"}
                    </td>
                    <td className="num">{moeda(r.valorNegociado)}</td>
                    <td className="num">{moeda(r.entrada)}</td>
                    {metricas.map((m) => (
                      <td key={m} className="num">
                        {moeda(valorDaMetrica(r, m))}
                      </td>
                    ))}
                    <td className="num text-cinza">{r.prazoMeses}m</td>
                    <td className="num">{moeda(r.totalNominal)}</td>
                    <td className="num font-semibold">{moeda(r.totalVP)}</td>
                    <td>
                      {!c.recomendado && (
                        <button
                          className="btn btn-fantasma px-2"
                          title="Marcar como recomendada"
                          onClick={(e) => {
                            e.stopPropagation();
                            recomendar(c.id);
                          }}
                        >
                          <Star size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-cinza px-4 py-2.5 border-t border-linha">
            O valor presente é o que permite comparar estruturas de prazos
            diferentes: traz cada parcela para hoje à taxa das premissas.
          </p>
        </section>
      )}

      {/* ----------------------------------------------------- abas + editor */}
      <section className="cartao">
        <div className="flex items-center gap-1 px-3 pt-3 flex-wrap border-b border-linha">
          {cenarios.map((c, i) => (
            <div
              key={c.id}
              className={`px-2 py-1.5 rounded-t-md border border-b-0 -mb-px flex items-center gap-0.5 ${
                c.id === ativoId
                  ? "bg-superficie border-linha"
                  : "bg-papel-alt border-transparent"
              }`}
            >
              {/* a ordem das abas é a ordem em que as opções saem no PDF */}
              {c.id === ativoId && cenarios.length > 1 && (
                <button
                  className="btn btn-fantasma px-1"
                  onClick={() => moverCenario(c.id, -1)}
                  disabled={i === 0}
                  title="Mover para a esquerda"
                >
                  <ChevronLeft size={14} />
                </button>
              )}
              <button
                onClick={() => setAtivoId(c.id)}
                className={`px-1.5 text-sm font-semibold flex items-center gap-1.5 ${
                  c.id === ativoId ? "text-vinho" : "text-cinza hover:text-tinta"
                }`}
              >
                {c.recomendado && <Star size={12} className="text-dourado-escuro" />}
                {c.nome}
              </button>
              {c.id === ativoId && cenarios.length > 1 && (
                <button
                  className="btn btn-fantasma px-1"
                  onClick={() => moverCenario(c.id, 1)}
                  disabled={i === cenarios.length - 1}
                  title="Mover para a direita"
                >
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          ))}

          <div className="ml-auto flex items-center gap-2 pb-2">
            <select
              className="campo w-auto text-xs"
              value=""
              onChange={(e) => {
                const c = condicoes.find((x) => x.id === e.target.value);
                if (c) adicionarCenario(c);
              }}
            >
              <option value="">+ opção a partir da tabela…</option>
              {condicoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <button
              className="btn btn-secundario"
              onClick={() => setMontando((v) => !v)}
            >
              <Plus size={15} /> Montar opção
            </button>
          </div>
        </div>

        {montando && (
          <div className="p-4 pb-0">
            <MontarOpcao
              indexadores={indexadores}
              valorReferencia={somaLotes}
              aoFechar={() => setMontando(false)}
              aoCriar={(nome, blocos) => {
                adicionarCenario(undefined, { nome, blocos });
                setMontando(false);
              }}
            />
          </div>
        )}

        {ativo && resultado && (
          <div className="p-4 flex flex-col gap-5">
            {/* cabeçalho do cenário */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-56">
                <label className="rotulo">Nome desta opção</label>
                <input
                  className="campo"
                  value={ativo.nome}
                  onChange={(e) => mudarCenario(ativo.id, { nome: e.target.value })}
                />
              </div>
              <div className="w-36">
                <label className="rotulo">Desconto %</label>
                <CampoNumero
                  valor={Number(ativo.desconto_pct) * 100}
                  aoMudar={(v) =>
                    mudarCenario(ativo.id, { desconto_pct: (v ?? 0) / 100 })
                  }
                  sufixo="%"
                />
              </div>
              <div className="w-44">
                <label className="rotulo">Desconto em valor</label>
                <CampoNumero
                  valor={Number(ativo.desconto_valor)}
                  aoMudar={(v) => mudarCenario(ativo.id, { desconto_valor: v ?? 0 })}
                  prefixo="R$"
                />
              </div>
              <div className="flex-1 min-w-48">
                <label className="rotulo">Motivo do desconto</label>
                <input
                  className="campo"
                  value={ativo.desconto_motivo ?? ""}
                  onChange={(e) =>
                    mudarCenario(ativo.id, { desconto_motivo: e.target.value || null })
                  }
                  placeholder="Ex.: compra dos dois lotes"
                />
              </div>
              <div className="flex items-center gap-1">
                {!ativo.recomendado && (
                  <button
                    className="btn btn-fantasma"
                    onClick={() => recomendar(ativo.id)}
                    title="Marcar como recomendada"
                  >
                    <Star size={15} />
                  </button>
                )}
                <button
                  className="btn btn-fantasma"
                  onClick={() => favoritar(ativo)}
                  disabled={favoritando !== null}
                  title="Favoritar: guarda esta estrutura para reusar em novas propostas"
                >
                  <BookmarkPlus size={15} />
                </button>
                <button
                  className="btn btn-fantasma"
                  onClick={() => duplicarCenario(ativo.id)}
                  title="Duplicar opção"
                >
                  <Copy size={15} />
                </button>
                {cenarios.length > 1 && (
                  <button
                    className="btn btn-fantasma text-vermelho"
                    onClick={() => removerCenario(ativo.id)}
                    title="Remover opção"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {resultado.avisos.length > 0 && (
              <div className="rounded-md px-3 py-2.5 bg-ambar-fraco text-ambar flex gap-2 items-start flex-wrap">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <ul className="text-sm flex flex-col gap-0.5 flex-1 min-w-56">
                  {resultado.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                {Math.abs(resultado.residuo) >= 0.5 && (
                  <button
                    className="btn btn-secundario"
                    onClick={() => fecharConta(ativo.id)}
                    title="O último bloco passa a absorver o que falta ou sobra"
                  >
                    Fechar a conta
                  </button>
                )}
              </div>
            )}

            {(() => {
              const noNome = nomeDesatualizado(ativo.nome, resultado.entradaPct);
              if (noNome === null) return null;
              return (
                <div className="rounded-md px-3 py-2.5 bg-ambar-fraco text-ambar flex gap-2 items-center flex-wrap">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span className="text-sm flex-1 min-w-56">
                    O nome diz {pct(noNome, 0)} de entrada, mas esta opção está com{" "}
                    {pct(resultado.entradaPct, 0)}. O nome é o título da seção no PDF.
                  </span>
                  <button
                    className="btn btn-secundario"
                    onClick={() =>
                      mudarCenario(ativo.id, {
                        nome: corrigirPercentualNoNome(ativo.nome, resultado.entradaPct),
                      })
                    }
                  >
                    Corrigir nome
                  </button>
                </div>
              );
            })()}

            {/* resumo do cenário */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
              {(
                [
                  [
                    "Preço de tabela",
                    moeda(resultado.valorTabela),
                    precoM2(resultado.precoM2Tabela),
                  ],
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
                    ROTULO_METRICA_PARCELA[metricas[0]],
                    moeda(valorDaMetrica(resultado, metricas[0])),
                    metricas.length > 1
                      ? metricas
                          .slice(1)
                          .map(
                            (m) =>
                              `${ROTULO_METRICA_PARCELA[m].toLowerCase()} ${moeda(valorDaMetrica(resultado, m))}`
                          )
                          .join(" · ")
                      : NOTA_METRICA_PARCELA[metricas[0]],
                  ],
                ] as const
              ).map(([rotulo, valor, nota], i) => (
                <div
                  key={rotulo}
                  className={`rounded-lg border p-3 ${
                    i === 1 ? "border-vinho bg-vinho-fraco" : "border-linha bg-papel"
                  }`}
                >
                  <p className="eyebrow">{rotulo}</p>
                  <p className={`serif text-lg tabular mt-1 ${i === 1 ? "text-vinho" : ""}`}>
                    {valor}
                  </p>
                  <p className="text-[11px] text-cinza mt-0.5">{nota}</p>
                </div>
              ))}
            </div>

            {/* blocos */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="serif text-lg">Estrutura de pagamento</h3>
                <button
                  className="btn btn-secundario"
                  onClick={() => adicionarBloco(ativo.id)}
                >
                  <Plus size={15} /> Bloco
                </button>
              </div>

              {ativo.blocos.map((b, i) => (
                <BlocoEditor
                  key={b.id}
                  bloco={b}
                  calculado={porBloco.get(b.id)}
                  dataBase={dataBase}
                  inccProposta={incc}
                  indexadores={indexadores}
                  primeiro={i === 0}
                  ultimo={i === ativo.blocos.length - 1}
                  aoMudar={(patch) => mudarBloco(ativo.id, b.id, patch)}
                  aoRemover={() =>
                    alterarBlocos(ativo.id, (bs) => bs.filter((x) => x.id !== b.id))
                  }
                  aoDuplicar={() =>
                    alterarBlocos(ativo.id, (bs) => {
                      const out = [...bs];
                      out.splice(i + 1, 0, {
                        ...b,
                        id: idLocal(),
                        rotulo: `${b.rotulo} (cópia)`,
                      });
                      return out;
                    })
                  }
                  aoMover={(d) =>
                    alterarBlocos(ativo.id, (bs) => {
                      const j = i + d;
                      if (j < 0 || j >= bs.length) return bs;
                      const out = [...bs];
                      [out[i], out[j]] = [out[j], out[i]];
                      return out;
                    })
                  }
                />
              ))}
              {ativo.blocos.length === 0 && (
                <p className="text-sm text-cinza text-center py-5">
                  Sem blocos nesta opção. Adicione um para começar.
                </p>
              )}
            </div>

            {/* fluxo */}
            <div className="border border-linha rounded-lg">
              <div className="cartao-titulo">
                <h3 className="serif text-base">Fluxo consolidado</h3>
                <button
                  className="btn btn-fantasma"
                  onClick={() => setMostrarFluxo((v) => !v)}
                >
                  {mostrarFluxo
                    ? "ocultar"
                    : `mostrar ${resultado.fluxo.length} vencimentos`}
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
                                      ativo.blocos.find((b) => b.id === it.blocoId)
                                        ?.qtd_parcelas ?? 1
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
            </div>
          </div>
        )}

        {cenarios.length === 0 && (
          <p className="p-6 text-sm text-cinza text-center">
            Nenhuma opção de parcelamento. Adicione uma acima.
          </p>
        )}
      </section>

      {/* ------------------------------------------------- cliente e premissas */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="cartao p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="serif text-lg">Cliente</h2>
            <select
              className="campo w-auto text-xs"
              value={criandoCliente ? CLIENTE_NOVO : (clienteId ?? "")}
              onChange={(e) => trocarCliente(e.target.value)}
              title="Trocar o cliente desta proposta"
            >
              <option value="">— sem cliente —</option>
              <option value={CLIENTE_NOVO}>+ cadastrar novo cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.empresa ? ` · ${c.empresa}` : ""}
                </option>
              ))}
            </select>
          </div>

          {clienteId || criandoCliente ? (
            <>
              <div>
                <label className="rotulo">Nome</label>
                <input
                  className="campo"
                  value={dadosCliente.nome}
                  onChange={(e) => {
                    setDadosCliente((d) => ({ ...d, nome: e.target.value }));
                    marcar();
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="rotulo">Empresa</label>
                  <input
                    className="campo"
                    value={dadosCliente.empresa ?? ""}
                    onChange={(e) => {
                      setDadosCliente((d) => ({ ...d, empresa: e.target.value || null }));
                      marcar();
                    }}
                  />
                </div>
                <div>
                  <label className="rotulo">CPF / CNPJ</label>
                  <input
                    className="campo"
                    value={dadosCliente.documento ?? ""}
                    onChange={(e) => {
                      setDadosCliente((d) => ({ ...d, documento: e.target.value || null }));
                      marcar();
                    }}
                  />
                </div>
                <div>
                  <label className="rotulo">Telefone</label>
                  <input
                    className="campo"
                    value={dadosCliente.telefone ?? ""}
                    onChange={(e) => {
                      setDadosCliente((d) => ({ ...d, telefone: e.target.value || null }));
                      marcar();
                    }}
                  />
                </div>
                <div>
                  <label className="rotulo">E-mail</label>
                  <input
                    className="campo"
                    value={dadosCliente.email ?? ""}
                    onChange={(e) => {
                      setDadosCliente((d) => ({ ...d, email: e.target.value || null }));
                      marcar();
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-cinza">
                {criandoCliente
                  ? "O cadastro é criado ao salvar a proposta e passa a aparecer em Clientes."
                  : "Editar aqui altera o cadastro do cliente, não só esta proposta. O nome e a empresa saem no cabeçalho do PDF."}
              </p>
            </>
          ) : (
            <p className="text-sm text-cinza">
              Proposta sem cliente. Escolha um na lista, use{" "}
              <strong>+ cadastrar novo cliente</strong> ou abra{" "}
              <Link href="/clientes" className="text-vinho font-semibold">
                Clientes
              </Link>
              .
            </p>
          )}
        </section>

        <section className="cartao p-4 flex flex-col gap-3">
          <h2 className="serif text-lg">Premissas</h2>
          <p className="text-xs text-cinza -mt-2">
            Valem para todas as opções — é o que mantém o comparativo honesto.
          </p>

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
              checked={corrigePrimeira}
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
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div>
            <label className="rotulo">Parcela mostrada ao cliente</label>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {METRICAS_PARCELA.map((m) => (
                <label key={m} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={metricas.includes(m)}
                    onChange={(e) => {
                      setMetricas((atual) => {
                        const novo = e.target.checked
                          ? METRICAS_PARCELA.filter(
                              (x) => atual.includes(x) || x === m
                            )
                          : atual.filter((x) => x !== m);
                        // sempre sobra ao menos uma; sem isso o comparativo
                        // fica sem coluna de parcela
                        return novo.length ? [...novo] : atual;
                      });
                      marcar();
                    }}
                  />
                  {ROTULO_METRICA_PARCELA[m]}
                </label>
              ))}
            </div>
            <p className="text-xs text-cinza mt-1">
              Vale para o comparativo e para a folha da proposta.
            </p>
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
      </div>
    </div>
  );
}
