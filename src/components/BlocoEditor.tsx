"use client";

import { ChevronDown, ChevronUp, Copy, Trash2 } from "lucide-react";
import CampoNumero from "./CampoNumero";
import type { IndexadorRef, PropostaBloco } from "@/lib/db/tipos";
import type {
  Amortizacao,
  BlocoCalculado,
  BlocoTipo,
  Indexador,
} from "@/lib/calc/tipos";
import {
  moeda,
  pct,
  rotuloMes,
  rotuloPeriodicidade,
  ROTULO_AMORTIZACAO,
  ROTULO_INDEXADOR,
  ROTULO_TIPO_BLOCO,
} from "@/lib/formato";

type Calculado = Omit<BlocoCalculado, "bloco">;

const TIPOS: BlocoTipo[] = ["entrada", "sinal", "parcelas", "balao", "financiamento"];
const AMORTIZACOES: Amortizacao[] = ["nenhuma", "sac", "price", "americano"];
const INDEXADORES: Indexador[] = [
  "nenhum", "incc", "igpm", "ipca", "inpc", "igpdi", "cub", "tr", "cdi", "selic",
];

const PERIODICIDADES = [1, 2, 3, 4, 6, 12];

/** Como a base do bloco está definida agora. */
function modoBase(b: PropostaBloco): "percentual" | "valor" | "parcela" | "residuo" {
  if (b.absorve_residuo) return "residuo";
  if (b.base_valor !== null) return "valor";
  if (b.base_percentual !== null) return "percentual";
  return "parcela";
}

export default function BlocoEditor({
  bloco,
  calculado,
  dataBase,
  inccProposta,
  indexadores,
  primeiro,
  ultimo,
  aoMudar,
  aoRemover,
  aoDuplicar,
  aoMover,
}: {
  bloco: PropostaBloco;
  calculado: Calculado | undefined;
  dataBase: string;
  inccProposta: number;
  indexadores: IndexadorRef[];
  primeiro: boolean;
  ultimo: boolean;
  aoMudar: (patch: Partial<PropostaBloco>) => void;
  aoRemover: () => void;
  aoDuplicar: () => void;
  aoMover: (direcao: -1 | 1) => void;
}) {
  const modo = modoBase(bloco);
  const comAmortizacao = bloco.amortizacao !== "nenhuma";
  const noAto = bloco.mes_inicio === 0;
  const passo = bloco.periodicidade_meses || 1;
  const ref = indexadores.find((i) => i.codigo === bloco.indexador);
  const taxaSugerida = ref?.taxa_mensal_referencia ?? null;
  const usandoSugerida =
    bloco.taxa_indexador_mensal === null ||
    (taxaSugerida !== null &&
      Math.abs(bloco.taxa_indexador_mensal - taxaSugerida) < 1e-9);

  return (
    <article className="border border-linha rounded-lg bg-superficie">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-linha bg-papel-alt rounded-t-lg">
        <input
          className="campo font-semibold flex-1 min-w-0"
          value={bloco.rotulo}
          onChange={(e) => aoMudar({ rotulo: e.target.value })}
        />
        <select
          className="campo w-auto text-xs"
          value={bloco.tipo}
          onChange={(e) => aoMudar({ tipo: e.target.value as BlocoTipo })}
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO_BLOCO[t]}
            </option>
          ))}
        </select>
        <div className="flex items-center">
          <button
            className="btn btn-fantasma px-2"
            onClick={() => aoMover(-1)}
            disabled={primeiro}
            title="Subir"
            type="button"
          >
            <ChevronUp size={15} />
          </button>
          <button
            className="btn btn-fantasma px-2"
            onClick={() => aoMover(1)}
            disabled={ultimo}
            title="Descer"
            type="button"
          >
            <ChevronDown size={15} />
          </button>
          <button
            className="btn btn-fantasma px-2"
            onClick={aoDuplicar}
            title="Duplicar bloco"
            type="button"
          >
            <Copy size={15} />
          </button>
          <button
            className="btn btn-fantasma px-2 text-vermelho"
            onClick={aoRemover}
            title="Remover bloco"
            type="button"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      <div className="p-3 grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="rotulo">Base do bloco</label>
          <div className="flex gap-2">
            <select
              className="campo w-32 shrink-0"
              value={modo}
              onChange={(e) => {
                const m = e.target.value as ReturnType<typeof modoBase>;
                aoMudar({
                  absorve_residuo: m === "residuo",
                  base_percentual: m === "percentual" ? (bloco.base_percentual ?? 0.4) : null,
                  base_valor: m === "valor" ? (bloco.base_valor ?? calculado?.base ?? 0) : null,
                  parcela_fixa:
                    m === "parcela"
                      ? (bloco.parcela_fixa ?? calculado?.primeiraParcela ?? 0)
                      : null,
                });
              }}
            >
              <option value="percentual">% do total</option>
              <option value="valor">Valor R$</option>
              <option value="parcela">Parcela R$</option>
              <option value="residuo">O que sobrar</option>
            </select>

            {modo === "percentual" && (
              <CampoNumero
                valor={bloco.base_percentual === null ? null : bloco.base_percentual * 100}
                aoMudar={(v) => aoMudar({ base_percentual: v === null ? null : v / 100 })}
                sufixo="%"
              />
            )}
            {modo === "valor" && (
              <CampoNumero
                valor={bloco.base_valor}
                aoMudar={(v) => aoMudar({ base_valor: v })}
                prefixo="R$"
              />
            )}
            {modo === "parcela" && (
              <CampoNumero
                valor={bloco.parcela_fixa}
                aoMudar={(v) => aoMudar({ parcela_fixa: v })}
                prefixo="R$"
              />
            )}
            {modo === "residuo" && (
              <span className="campo bg-papel-alt text-cinza text-right">
                {moeda(calculado?.base ?? 0)}
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="rotulo">Parcelas</label>
          <input
            type="number"
            className="campo text-right"
            min={1}
            max={480}
            value={bloco.qtd_parcelas}
            onChange={(e) =>
              aoMudar({ qtd_parcelas: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </div>

        <div>
          <label className="rotulo">Periodicidade</label>
          <select
            className="campo"
            value={passo}
            onChange={(e) =>
              aoMudar({ periodicidade_meses: Number(e.target.value) || 1 })
            }
            disabled={noAto}
          >
            {PERIODICIDADES.map((m) => (
              <option key={m} value={m}>
                {rotuloPeriodicidade(m)}
              </option>
            ))}
          </select>
          {passo > 1 && (
            <p className="text-[11px] text-cinza mt-1">
              vence até o mês {bloco.mes_inicio + (bloco.qtd_parcelas - 1) * passo}
            </p>
          )}
        </div>

        <div>
          <label className="rotulo">1º vencimento</label>
          <input
            type="number"
            className="campo text-right"
            min={0}
            value={bloco.mes_inicio}
            onChange={(e) => aoMudar({ mes_inicio: Math.max(0, Number(e.target.value) || 0) })}
          />
          <p className="text-[11px] text-cinza mt-1">
            mês {bloco.mes_inicio} · {rotuloMes(bloco.mes_inicio, dataBase)}
          </p>
        </div>

        <div>
          <label className="rotulo">Amortização</label>
          <select
            className="campo"
            value={bloco.amortizacao}
            onChange={(e) => aoMudar({ amortizacao: e.target.value as Amortizacao })}
            disabled={noAto}
          >
            {AMORTIZACOES.map((a) => (
              <option key={a} value={a}>
                {ROTULO_AMORTIZACAO[a]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="rotulo">Correção</label>
          <select
            className="campo"
            value={bloco.indexador}
            onChange={(e) => {
              const novo = e.target.value as Indexador;
              const alvo = indexadores.find((i) => i.codigo === novo);
              // trocar de índice troca a taxa junto; só o INCC segue herdando
              // a das premissas, que é o comportamento das condições da tabela
              aoMudar({
                indexador: novo,
                taxa_indexador_mensal:
                  novo === "incc" || novo === "nenhum"
                    ? null
                    : (alvo?.taxa_mensal_referencia ?? null),
              });
            }}
          >
            {INDEXADORES.map((i) => (
              <option key={i} value={i}>
                {ROTULO_INDEXADOR[i]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="rotulo">Taxa do índice a.m.</label>
          <CampoNumero
            valor={
              bloco.indexador === "nenhum"
                ? null
                : bloco.taxa_indexador_mensal === null
                  ? null
                  : bloco.taxa_indexador_mensal * 100
            }
            aoMudar={(v) =>
              aoMudar({ taxa_indexador_mensal: v === null ? null : v / 100 })
            }
            casas={4}
            sufixo="%"
            disabled={bloco.indexador === "nenhum"}
            placeholder={
              bloco.indexador === "nenhum"
                ? "—"
                : taxaSugerida !== null
                  ? `${pct(taxaSugerida, 3)} (${ref?.referencia ?? "referência"})`
                  : `herda ${pct(inccProposta, 3)}`
            }
          />
          {bloco.indexador !== "nenhum" && ref && (
            <p className="text-[11px] text-cinza mt-1">
              {taxaSugerida !== null ? (
                <>
                  {ref.nome} {pct(taxaSugerida, 3)} a.m.
                  {ref.acumulado_12m !== null &&
                    ` (${pct(ref.acumulado_12m, 2)} em 12m, ${ref.fonte} ${ref.referencia})`}
                  {!usandoSugerida && (
                    <button
                      type="button"
                      className="text-vinho font-semibold ml-1 underline"
                      onClick={() => aoMudar({ taxa_indexador_mensal: null })}
                    >
                      usar referência
                    </button>
                  )}
                </>
              ) : (
                <>{ref.nome} sem taxa de referência — informe a taxa.</>
              )}
            </p>
          )}
        </div>

        <div>
          <label className="rotulo">Juros a.m.</label>
          <CampoNumero
            valor={bloco.juros_mensal * 100}
            aoMudar={(v) => aoMudar({ juros_mensal: (v ?? 0) / 100 })}
            casas={4}
            sufixo="%"
            disabled={!comAmortizacao}
          />
        </div>
      </div>

      {calculado && (
        <footer className="px-3 pb-3">
          <div className="grid gap-2 sm:grid-cols-5 text-center bg-papel rounded-md py-2.5 px-2">
            <div>
              <p className="eyebrow">Valor do bloco</p>
              <p className="tabular font-semibold">{moeda(calculado.base)}</p>
            </div>
            <div>
              <p className="eyebrow">
                {passo > 1 ? "1º reforço" : "1ª parcela"}
              </p>
              <p className="tabular font-semibold">{moeda(calculado.primeiraParcela)}</p>
            </div>
            <div>
              <p className="eyebrow">Última</p>
              <p className="tabular">{moeda(calculado.ultimaParcela)}</p>
            </div>
            <div>
              <p className="eyebrow">Total nominal</p>
              <p className="tabular">{moeda(calculado.totalNominal)}</p>
            </div>
            <div>
              <p className="eyebrow">
                {comAmortizacao ? "Juros" : "Correção"}
              </p>
              <p className="tabular text-dourado-escuro">
                {moeda(comAmortizacao ? calculado.totalJuros : calculado.totalCorrecao)}
              </p>
            </div>
          </div>
          {calculado.avisos.map((a: string) => (
            <p key={a} className="text-xs text-ambar mt-2">
              {a}
            </p>
          ))}
        </footer>
      )}
    </article>
  );
}
