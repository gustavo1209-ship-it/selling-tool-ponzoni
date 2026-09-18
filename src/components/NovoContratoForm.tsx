"use client";

import { useActionState, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { criarContrato } from "@/app/contratos/acoes";
import CampoNumero from "./CampoNumero";
import type { Indexador } from "@/lib/calc/tipos";
import { cronogramaManual } from "@/lib/contratos/cronograma";
import { hojeISO } from "@/lib/contratos/mes";
import type { Cliente, Empreendimento, IndexadorRef, Lote } from "@/lib/db/tipos";
import {
  area,
  dataBR,
  moeda,
  moedaCurta,
  ROTULO_INDEXADOR,
  ROTULO_STATUS_LOTE,
} from "@/lib/formato";
import { compararLote } from "@/lib/ordenacao";

export default function NovoContratoForm({
  empreendimentos,
  lotes,
  clientes,
  indexadores,
  diaVencimentoPadrao,
  jurosMoraPadrao,
  multaAtrasoPadrao,
}: {
  empreendimentos: Empreendimento[];
  lotes: Lote[];
  clientes: Cliente[];
  indexadores: IndexadorRef[];
  /** Vêm de Admin > Configurações — só o ponto de partida, editável abaixo. */
  diaVencimentoPadrao: number;
  jurosMoraPadrao: number;
  multaAtrasoPadrao: number;
}) {
  const [empreendimentoId, setEmpreendimentoId] = useState(empreendimentos[0]?.id ?? "");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [clienteId, setClienteId] = useState("");

  const hoje = hojeISO();
  const [dataContrato, setDataContrato] = useState(hoje);
  const [dataBase, setDataBase] = useState(hoje);
  // Sozinho segue a soma da tabela dos terrenos marcados — vira manual
  // assim que alguém edita o campo, e volta a seguir se o botão "usar da
  // tabela" for clicado (ver `valorTotal` abaixo, derivado dos dois).
  const [valorTotalManual, setValorTotalManual] = useState<number | null>(null);
  const [diaVencimento, setDiaVencimento] = useState<number | null>(diaVencimentoPadrao);
  const [indexador, setIndexador] = useState<Indexador>("incc");
  const [defasagem, setDefasagem] = useState<number | null>(1);

  // Entrada é percentual, igual ao resto da ferramenta (Simulador, Montar
  // opção) — o valor em R$ é derivado, não digitado direto. 0,4 é o degrau
  // mais comum das duas tabelas (Industrial e Florescer têm "40% entrada"
  // como âncora da escada).
  const [entradaPct, setEntradaPct] = useState(0.4);
  const [entradaParcelas, setEntradaParcelas] = useState<number | null>(1);
  const [qtdParcelas, setQtdParcelas] = useState<number | null>(36);
  const [primeiroMes, setPrimeiroMes] = useState<number | null>(1);

  const [reforcoQtd, setReforcoQtd] = useState<number | null>(0);
  const [reforcoValor, setReforcoValor] = useState<number | null>(null);
  const [reforcoPeriodicidade, setReforcoPeriodicidade] = useState<number | null>(6);
  const [reforcoPrimeiroMes, setReforcoPrimeiroMes] = useState<number | null>(6);

  const [corrigePrimeira, setCorrigePrimeira] = useState(true);
  const [jurosMora, setJurosMora] = useState<number | null>(jurosMoraPadrao);
  const [multa, setMulta] = useState<number | null>(multaAtrasoPadrao);

  const [estado, formAction, enviando] = useActionState(criarContrato, null);

  const disponiveis = useMemo(
    () =>
      [...lotes]
        .filter((l) => l.empreendimento_id === empreendimentoId)
        .sort(compararLote),
    [lotes, empreendimentoId]
  );

  const escolhidos = useMemo(
    () => disponiveis.filter((l) => selecionados.includes(l.id)),
    [disponiveis, selecionados]
  );
  const somaTabela = useMemo(
    () => escolhidos.reduce((s, l) => s + Number(l.preco_tabela ?? 0), 0),
    [escolhidos]
  );
  const somaArea = useMemo(
    () => escolhidos.reduce((s, l) => s + Number(l.area_m2), 0),
    [escolhidos]
  );

  // Segue a soma da tabela dos terrenos marcados até alguém digitar um
  // valor manualmente — sem isso, o "negócio" inteiro (entrada, parcelas,
  // prévia) ficava em branco até alguém achar o botão "usar da tabela".
  const valorTotal = useMemo(
    () => valorTotalManual ?? (somaTabela > 0 ? somaTabela : null),
    [valorTotalManual, somaTabela]
  );
  const entrada = useMemo(
    () => (valorTotal ? Math.round(valorTotal * entradaPct * 100) / 100 : null),
    [valorTotal, entradaPct]
  );

  // A prévia roda no navegador com a mesma função que o servidor usa para
  // gravar: o cronograma que aparece aqui é o que vai para o banco.
  const previa = useMemo(() => {
    if (!valorTotal || valorTotal <= 0) return [];
    return cronogramaManual({
      valorTotal,
      dataBase,
      diaVencimento: diaVencimento ?? 10,
      entrada: entrada ?? 0,
      entradaParcelas: entradaParcelas ?? 1,
      qtdParcelas: qtdParcelas ?? 0,
      primeiroVencimentoMes: primeiroMes ?? 1,
      mensaisIndexadas: indexador !== "nenhum",
      reforco:
        (reforcoQtd ?? 0) > 0
          ? {
              quantidade: reforcoQtd ?? 0,
              valor: reforcoValor ?? 0,
              periodicidade: reforcoPeriodicidade ?? 6,
              primeiroMes: reforcoPrimeiroMes ?? 6,
            }
          : null,
    });
  }, [
    valorTotal, dataBase, diaVencimento, entrada, entradaParcelas, qtdParcelas,
    primeiroMes, indexador, reforcoQtd, reforcoValor, reforcoPeriodicidade,
    reforcoPrimeiroMes,
  ]);

  const somaPrevia = previa.reduce((s, p) => s + p.valor_original, 0);
  // a data que o "meses da data-base" produz, mostrada ao lado do campo:
  // é um número abstrato que já colocou as mensais um mês fora do contrato
  const primeiraMensal = previa.find((p) => p.tipo === "parcelas")?.vencimento;
  const primeiroReforco = previa.find((p) => p.tipo === "balao")?.vencimento;
  const mensal = previa.find((p) => p.tipo === "parcelas")?.valor_original ?? 0;

  // agrupa a prévia por rótulo: o cronograma tem 40 linhas e o que interessa
  // conferir são os três ou quatro grupos
  const grupos = useMemo(() => {
    const mapa = new Map<
      string,
      { rotulo: string; qtd: number; valor: number; primeiro: string; ultimo: string }
    >();
    for (const p of previa) {
      const g = mapa.get(p.rotulo);
      if (g) {
        g.qtd += 1;
        g.valor += p.valor_original;
        g.ultimo = p.vencimento;
      } else {
        mapa.set(p.rotulo, {
          rotulo: p.rotulo,
          qtd: 1,
          valor: p.valor_original,
          primeiro: p.vencimento,
          ultimo: p.vencimento,
        });
      }
    }
    return [...mapa.values()];
  }, [previa]);

  function alternarLote(id: string) {
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const quadras = [...new Set(disponiveis.map((l) => l.quadra))].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { numeric: true })
  );

  const numero = (v: number | null) => (v === null ? "" : String(v));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {estado && !estado.ok && (
        <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2">
          {estado.erro}
        </p>
      )}
      {selecionados.map((id) => (
        <input key={id} type="hidden" name="lote_id" value={id} />
      ))}
      <input type="hidden" name="valor_total" value={numero(valorTotal)} />
      <input type="hidden" name="entrada" value={numero(entrada)} />
      <input type="hidden" name="entrada_parcelas" value={numero(entradaParcelas)} />
      <input type="hidden" name="qtd_parcelas" value={numero(qtdParcelas)} />
      <input type="hidden" name="primeiro_mes" value={numero(primeiroMes)} />
      <input type="hidden" name="reforco_qtd" value={numero(reforcoQtd)} />
      <input type="hidden" name="reforco_valor" value={numero(reforcoValor)} />
      <input
        type="hidden"
        name="reforco_periodicidade"
        value={numero(reforcoPeriodicidade)}
      />
      <input
        type="hidden"
        name="reforco_primeiro_mes"
        value={numero(reforcoPrimeiroMes)}
      />
      <input type="hidden" name="dia_vencimento" value={numero(diaVencimento)} />
      <input type="hidden" name="defasagem_indice_meses" value={numero(defasagem)} />
      <input
        type="hidden"
        name="corrige_primeira_parcela"
        value={corrigePrimeira ? "1" : "0"}
      />
      <input type="hidden" name="juros_mora_mensal" value={numero(jurosMora)} />
      <input type="hidden" name="multa_atraso_pct" value={numero(multa)} />

      {/* ------------------------------------------------- quem e o quê */}
      <section className="cartao p-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo">Empreendimento</label>
          <select
            className="campo"
            name="empreendimento_id"
            value={empreendimentoId}
            onChange={(e) => {
              setEmpreendimentoId(e.target.value);
              setSelecionados([]);
            }}
          >
            {empreendimentos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="rotulo">Comprador já cadastrado</label>
          <select
            className="campo"
            name="cliente_id"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">— cadastrar novo —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.empresa ? ` · ${c.empresa}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="rotulo">
            {clienteId ? "Identificação do contrato (opcional)" : "Nome do comprador"}
          </label>
          <input
            className="campo"
            name={clienteId ? "titulo" : "cliente_nome"}
            placeholder={
              clienteId ? "Ex.: contrato de 12/2024, quadra C" : "Ex.: João da Silva"
            }
            required={!clienteId}
          />
        </div>

        {!clienteId && (
          <>
            <div>
              <label className="rotulo">Empresa</label>
              <input className="campo" name="cliente_empresa" />
            </div>
            <div>
              <label className="rotulo">CPF / CNPJ</label>
              <input className="campo" name="cliente_documento" />
            </div>
            <div>
              <label className="rotulo">Telefone</label>
              <input className="campo" name="cliente_telefone" />
            </div>
            <div>
              <label className="rotulo">E-mail</label>
              <input className="campo" name="cliente_email" />
            </div>
          </>
        )}
      </section>

      {/* -------------------------------------------------------- terrenos */}
      <section className="cartao">
        <div className="cartao-titulo">
          <h2 className="serif text-lg">Terrenos vendidos</h2>
          <span className="text-sm text-cinza">
            {escolhidos.length} selecionado(s) · {area(somaArea)}
            {somaTabela > 0 && ` · tabela ${moedaCurta(somaTabela)}`}
          </span>
        </div>

        <div className="p-4 flex flex-col gap-5">
          <p className="text-xs text-cinza">
            A lista traz todos os lotes, inclusive os já marcados como vendidos
            no espelho — é justamente onde estão as vendas antigas. Vincular o
            lote é opcional: o contrato funciona sem ele, e o vínculo só serve
            para achar o contrato a partir do terreno.
          </p>
          {quadras.map((q) => (
            <div key={q}>
              <p className="eyebrow mb-2">Quadra {q}</p>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                {disponiveis
                  .filter((l) => l.quadra === q)
                  .map((l) => {
                    const marcado = selecionados.includes(l.id);
                    return (
                      <button
                        type="button"
                        key={l.id}
                        onClick={() => alternarLote(l.id)}
                        className={`text-left rounded-lg border px-3 py-2 transition ${
                          marcado
                            ? "border-vinho bg-vinho-fraco"
                            : "border-linha bg-superficie hover:bg-papel-alt"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm">
                            {l.quadra}-{l.numero}
                          </span>
                          {marcado ? (
                            <Check size={14} className="text-vinho" />
                          ) : (
                            <span className={`selo selo-${l.status} text-[10px]`}>
                              {ROTULO_STATUS_LOTE[l.status] ?? l.status}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-cinza tabular">
                          {area(Number(l.area_m2))}
                        </span>
                        <span className="block text-xs tabular">
                          {l.preco_tabela ? moeda(Number(l.preco_tabela)) : "sem preço"}
                        </span>
                        {l.comprador && (
                          <span className="block text-xs text-cinza truncate">
                            {l.comprador}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------- o negócio */}
      <section className="cartao p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <h2 className="serif text-lg">O negócio</h2>
        </div>

        <div>
          <label className="rotulo">Data do contrato</label>
          <input
            type="date"
            className="campo"
            name="data_contrato"
            value={dataContrato}
            onChange={(e) => setDataContrato(e.target.value)}
          />
        </div>
        <div>
          <label className="rotulo">Data-base da correção</label>
          <input
            type="date"
            className="campo"
            name="data_base"
            value={dataBase}
            onChange={(e) => setDataBase(e.target.value)}
          />
          <p className="text-xs text-cinza mt-1">
            marco zero do índice acumulado
          </p>
        </div>
        <div>
          <label className="rotulo">Valor total do contrato</label>
          <CampoNumero valor={valorTotal} aoMudar={setValorTotalManual} prefixo="R$" />
          {somaTabela > 0 && valorTotal !== somaTabela && (
            <button
              type="button"
              className="text-xs text-vinho font-semibold mt-1"
              onClick={() => setValorTotalManual(null)}
            >
              usar {moeda(somaTabela)} da tabela
            </button>
          )}
        </div>
        <div>
          <label className="rotulo">Dia do vencimento</label>
          <CampoNumero valor={diaVencimento} aoMudar={setDiaVencimento} casas={0} />
        </div>
      </section>

      {/* ------------------------------------------------------ cronograma */}
      <section className="cartao p-5 flex flex-col gap-4">
        <h2 className="serif text-lg">Cronograma de pagamento</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="rotulo">Entrada</label>
            <CampoNumero
              valor={entradaPct * 100}
              aoMudar={(v) => setEntradaPct((v ?? 0) / 100)}
              sufixo="%"
            />
            <p className="text-xs text-cinza mt-1">
              {valorTotal ? moeda(entrada ?? 0) : "defina o valor total"}
            </p>
          </div>
          <div>
            <label className="rotulo">Entrada em quantas vezes</label>
            <CampoNumero valor={entradaParcelas} aoMudar={setEntradaParcelas} casas={0} />
          </div>
          <div>
            <label className="rotulo">Parcelas mensais</label>
            <CampoNumero valor={qtdParcelas} aoMudar={setQtdParcelas} casas={0} />
          </div>
          <div>
            <label className="rotulo">1ª mensal (meses da data-base)</label>
            <CampoNumero valor={primeiroMes} aoMudar={setPrimeiroMes} casas={0} />
            <p className="text-xs text-cinza mt-1">
              {primeiraMensal
                ? `vence em ${dataBR(primeiraMensal)}`
                : "0 = no mesmo mês da entrada"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-linha pt-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="eyebrow">Reforços periódicos (opcional)</p>
          </div>
          <div>
            <label className="rotulo">Quantidade</label>
            <CampoNumero valor={reforcoQtd} aoMudar={setReforcoQtd} casas={0} />
          </div>
          <div>
            <label className="rotulo">Valor de cada um</label>
            <CampoNumero valor={reforcoValor} aoMudar={setReforcoValor} prefixo="R$" />
          </div>
          <div>
            <label className="rotulo">A cada quantos meses</label>
            <CampoNumero
              valor={reforcoPeriodicidade}
              aoMudar={setReforcoPeriodicidade}
              casas={0}
            />
          </div>
          <div>
            <label className="rotulo">1º reforço (mês)</label>
            <CampoNumero
              valor={reforcoPrimeiroMes}
              aoMudar={setReforcoPrimeiroMes}
              casas={0}
            />
            {primeiroReforco && (
              <p className="text-xs text-cinza mt-1">
                vence em {dataBR(primeiroReforco)}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- correção */}
      <section className="cartao p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <h2 className="serif text-lg">Correção e encargos</h2>
        </div>

        <div>
          <label className="rotulo">Índice do contrato</label>
          <select
            className="campo"
            name="indexador"
            value={indexador}
            onChange={(e) => setIndexador(e.target.value as Indexador)}
          >
            <option value="nenhum">Sem correção</option>
            {indexadores.map((i) => (
              <option key={i.codigo} value={i.codigo}>
                {i.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="rotulo">Defasagem do índice</label>
          <CampoNumero valor={defasagem} aoMudar={setDefasagem} casas={0} sufixo="m" />
          <p className="text-xs text-cinza mt-1">
            1 = usa o índice do mês anterior
          </p>
        </div>
        <div>
          <label className="rotulo">Primeira parcela</label>
          <select
            className="campo"
            value={corrigePrimeira ? "sim" : "nao"}
            onChange={(e) => setCorrigePrimeira(e.target.value === "sim")}
          >
            <option value="sim">Já vem corrigida</option>
            <option value="nao">Sai sem correção</option>
          </select>
        </div>
        <div>
          <label className="rotulo">Juros de mora ao mês</label>
          <CampoNumero valor={jurosMora} aoMudar={setJurosMora} sufixo="%" />
        </div>
        <div>
          <label className="rotulo">Multa por atraso</label>
          <CampoNumero valor={multa} aoMudar={setMulta} sufixo="%" />
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <label className="rotulo">Observações</label>
          <input
            className="campo"
            name="observacoes"
            placeholder="Ex.: escritura prevista para a quitação; cláusula de reajuste anual"
          />
        </div>
      </section>

      {/* ---------------------------------------------------------- prévia */}
      {previa.length > 0 && (
        <section className="cartao">
          <div className="cartao-titulo flex-wrap">
            <h2 className="serif text-lg">
              Prévia do cronograma
              <span className="text-sm text-cinza font-sans ml-2">
                {previa.length} parcelas · 1ª mensal de {moeda(mensal)}
              </span>
            </h2>
            <span
              className={`text-sm tabular ${
                Math.abs(somaPrevia - (valorTotal ?? 0)) > 0.01
                  ? "text-vermelho font-semibold"
                  : "text-cinza"
              }`}
            >
              soma {moeda(somaPrevia)} de {moeda(valorTotal ?? 0)}
            </span>
          </div>
          <table className="tabela">
            <thead>
              <tr>
                <th>Grupo</th>
                <th className="num">Parcelas</th>
                <th className="num">Valor cada</th>
                <th className="num">Total</th>
                <th>Do primeiro ao último</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.rotulo}>
                  <td className="font-semibold">{g.rotulo}</td>
                  <td className="num">{g.qtd}</td>
                  <td className="num">{moeda(g.valor / g.qtd)}</td>
                  <td className="num">{moeda(g.valor)}</td>
                  <td className="text-cinza whitespace-nowrap">
                    {dataBR(g.primeiro)} → {dataBR(g.ultimo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-cinza border-t border-linha">
            Os valores acima são nominais na data-base. A correção pelo{" "}
            {ROTULO_INDEXADOR[indexador]} entra parcela a parcela, pelos índices
            que estiverem lançados quando o boleto for emitido. Depois de criar
            o contrato, qualquer parcela pode ser ajustada individualmente.
          </p>
        </section>
      )}

      <div className="flex justify-end gap-3">
        <button
          className="btn btn-primario"
          disabled={!valorTotal || previa.length === 0 || enviando}
        >
          {enviando ? "Criando…" : "Criar contrato"}
        </button>
      </div>
    </form>
  );
}
