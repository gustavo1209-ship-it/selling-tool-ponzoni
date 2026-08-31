"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import CampoNumero from "./CampoNumero";
import type { Amortizacao, Indexador } from "@/lib/calc/tipos";
import type { BlocoTemplate, IndexadorRef } from "@/lib/db/tipos";
import {
  adjetivoPeriodicidade,
  moeda,
  pct,
  ROTULO_AMORTIZACAO,
  ROTULO_INDEXADOR,
  rotuloPeriodicidade,
} from "@/lib/formato";

const INDEXADORES: Indexador[] = [
  "nenhum", "incc", "igpm", "ipca", "inpc", "igpdi", "cub", "tr", "cdi", "selic",
];
const PERIODICIDADES = [3, 6, 12];
const AMORTIZACOES: Amortizacao[] = ["nenhuma", "sac", "price"];

/**
 * Monta uma condição do zero sem precisar montar bloco a bloco.
 *
 * O modelo é o que o mercado usa: entrada + reforços periódicos + mensais.
 * Entrada e reforços são percentuais do valor; **as mensais ficam com o que
 * sobrar**. É por isso que acrescentar reforço derruba a mensal sem mudar o
 * total — o principal só muda de lugar no calendário.
 */
export default function MontarOpcao({
  indexadores,
  valorReferencia,
  aoCriar,
  aoFechar,
}: {
  indexadores: IndexadorRef[];
  valorReferencia: number;
  aoCriar: (nome: string, blocos: BlocoTemplate[]) => void;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [entradaPct, setEntradaPct] = useState(0.3);
  const [parcelas, setParcelas] = useState(36);
  const [indexador, setIndexador] = useState<Indexador>("incc");
  const [amortizacao, setAmortizacao] = useState<Amortizacao>("nenhuma");
  const [jurosMensal, setJurosMensal] = useState(0);

  const [comReforco, setComReforco] = useState(false);
  const [reforcos, setReforcos] = useState(6);
  const [periodicidade, setPeriodicidade] = useState(6);
  const [reforcoPct, setReforcoPct] = useState(0.2);

  const ref = indexadores.find((i) => i.codigo === indexador);

  const previa = useMemo(() => {
    const totalReforco = comReforco ? reforcoPct : 0;
    const mensaisPct = Math.max(0, 1 - entradaPct - totalReforco);
    const baseMensais = valorReferencia * mensaisPct;
    const baseReforcos = valorReferencia * totalReforco;
    return {
      entrada: valorReferencia * entradaPct,
      mensaisPct,
      // valor nominal da 1ª parcela, antes de correção
      mensal: parcelas > 0 ? baseMensais / parcelas : 0,
      reforco: comReforco && reforcos > 0 ? baseReforcos / reforcos : 0,
      prazo: Math.max(
        parcelas,
        comReforco ? reforcos * periodicidade : 0
      ),
      excede: entradaPct + totalReforco > 1.0001,
    };
  }, [
    valorReferencia, entradaPct, parcelas, comReforco, reforcos,
    periodicidade, reforcoPct,
  ]);

  function criar() {
    const blocos: BlocoTemplate[] = [];
    // Só o INCC herda a taxa da proposta. Para os outros a taxa vai
    // explícita: herdar o INCC num bloco de IPCA daria o número errado.
    const taxa =
      indexador === "incc" ? null : (ref?.taxa_mensal_referencia ?? null);

    if (entradaPct > 0) {
      blocos.push({
        rotulo: "Entrada",
        tipo: "entrada",
        base_percentual: entradaPct,
        qtd_parcelas: 1,
        mes_inicio: 0,
        periodicidade_meses: 1,
        indexador: "nenhum",
        juros_mensal: 0,
        amortizacao: "nenhuma",
      });
    }

    // as mensais absorvem o resíduo: é o que faz o reforço baratear a parcela
    blocos.push({
      rotulo:
        indexador === "nenhum"
          ? `${parcelas}x sem juros`
          : `${parcelas}x corrigidas pelo ${ROTULO_INDEXADOR[indexador]}`,
      tipo: "parcelas",
      absorve_residuo: true,
      qtd_parcelas: parcelas,
      mes_inicio: 1,
      periodicidade_meses: 1,
      indexador,
      taxa_indexador_mensal: taxa,
      juros_mensal: amortizacao === "nenhuma" ? 0 : jurosMensal,
      amortizacao,
    });

    if (comReforco && reforcos > 0) {
      blocos.push({
        rotulo: `${reforcos} reforços ${adjetivoPeriodicidade(periodicidade)}`,
        tipo: "balao",
        base_percentual: reforcoPct,
        qtd_parcelas: reforcos,
        mes_inicio: periodicidade,
        periodicidade_meses: periodicidade,
        indexador,
        taxa_indexador_mensal: taxa,
        juros_mensal: 0,
        amortizacao: "nenhuma",
      });
    }

    const rotulo =
      nome.trim() ||
      [
        `${pct(entradaPct, 0)} entrada`,
        `${parcelas}x`,
        comReforco
          ? `${reforcos} reforços ${adjetivoPeriodicidade(periodicidade)}`
          : null,
      ]
        .filter(Boolean)
        .join(" + ");

    aoCriar(rotulo, blocos);
  }

  return (
    <div className="border border-vinho rounded-lg bg-vinho-fraco p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="serif text-lg">Montar opção personalizada</h3>
        <button className="btn btn-fantasma px-2" onClick={aoFechar} title="Fechar">
          <X size={16} />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="rotulo">Nome (opcional)</label>
          <input
            className="campo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="deixe vazio e eu monto pelo formato"
          />
        </div>
        <div>
          <label className="rotulo">Entrada</label>
          <CampoNumero
            valor={entradaPct * 100}
            aoMudar={(v) => setEntradaPct((v ?? 0) / 100)}
            sufixo="%"
          />
        </div>
        <div>
          <label className="rotulo">Parcelas mensais</label>
          <input
            type="number"
            className="campo text-right"
            min={1}
            max={480}
            value={parcelas}
            onChange={(e) => setParcelas(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>

        <div>
          <label className="rotulo">Correção</label>
          <select
            className="campo"
            value={indexador}
            onChange={(e) => setIndexador(e.target.value as Indexador)}
          >
            {INDEXADORES.map((i) => (
              <option key={i} value={i}>
                {ROTULO_INDEXADOR[i]}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-cinza mt-1">
            {indexador === "nenhum"
              ? "parcela fixa em reais"
              : indexador === "incc"
                ? "usa o INCC das premissas da proposta"
                : ref?.taxa_mensal_referencia != null
                  ? `${pct(ref.taxa_mensal_referencia, 3)} a.m. · ${ref.fonte} ${ref.referencia}`
                  : "sem taxa de referência — ajuste no bloco depois"}
          </p>
        </div>

        <div>
          <label className="rotulo">Amortização</label>
          <select
            className="campo"
            value={amortizacao}
            onChange={(e) => setAmortizacao(e.target.value as Amortizacao)}
          >
            {AMORTIZACOES.map((a) => (
              <option key={a} value={a}>
                {ROTULO_AMORTIZACAO[a]}
              </option>
            ))}
          </select>
        </div>

        {amortizacao !== "nenhuma" && (
          <div>
            <label className="rotulo">Juros a.m.</label>
            <CampoNumero
              valor={jurosMensal * 100}
              aoMudar={(v) => setJurosMensal((v ?? 0) / 100)}
              casas={4}
              sufixo="%"
            />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={comReforco}
          onChange={(e) => setComReforco(e.target.checked)}
        />
        Incluir reforços periódicos
        <span className="font-normal text-cinza">
          — tiram peso da mensal sem mudar o total
        </span>
      </label>

      {comReforco && (
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="rotulo">Quantos reforços</label>
            <input
              type="number"
              className="campo text-right"
              min={1}
              max={40}
              value={reforcos}
              onChange={(e) => setReforcos(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div>
            <label className="rotulo">A cada</label>
            <select
              className="campo"
              value={periodicidade}
              onChange={(e) => setPeriodicidade(Number(e.target.value))}
            >
              {PERIODICIDADES.map((m) => (
                <option key={m} value={m}>
                  {rotuloPeriodicidade(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo">% do valor nos reforços</label>
            <CampoNumero
              valor={reforcoPct * 100}
              aoMudar={(v) => setReforcoPct((v ?? 0) / 100)}
              sufixo="%"
            />
          </div>
        </div>
      )}

      <div className="bg-superficie rounded-md p-3 grid gap-3 sm:grid-cols-4 text-center">
        <div>
          <p className="eyebrow">Entrada</p>
          <p className="tabular font-semibold">{moeda(previa.entrada)}</p>
        </div>
        <div>
          <p className="eyebrow">Mensal (1ª)</p>
          <p className="tabular font-semibold">{moeda(previa.mensal)}</p>
          <p className="text-[11px] text-cinza">{pct(previa.mensaisPct, 0)} do valor</p>
        </div>
        <div>
          <p className="eyebrow">Cada reforço</p>
          <p className="tabular font-semibold">
            {comReforco ? moeda(previa.reforco) : "—"}
          </p>
        </div>
        <div>
          <p className="eyebrow">Prazo</p>
          <p className="tabular font-semibold">{previa.prazo} meses</p>
        </div>
      </div>

      {previa.excede && (
        <p className="text-sm text-vermelho">
          Entrada + reforços passam de 100% do valor. Reduza um dos dois.
        </p>
      )}

      <p className="text-xs text-cinza">
        Prévia sobre {moeda(valorReferencia)}, sem correção e sem juros — os
        valores finais aparecem no comparativo depois de criar.
      </p>

      <div className="flex justify-end gap-2">
        <button className="btn btn-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button className="btn btn-primario" onClick={criar} disabled={previa.excede}>
          Criar opção
        </button>
      </div>
    </div>
  );
}
