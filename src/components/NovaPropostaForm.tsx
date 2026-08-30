"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { criarProposta } from "@/app/propostas/acoes";
import type {
  Cliente,
  CondicaoPagamento,
  Empreendimento,
  Lote,
  TabelaPreco,
} from "@/lib/db/tipos";
import { compararLote } from "@/lib/ordenacao";
import { area, moeda, moedaCurta, pct } from "@/lib/formato";

export default function NovaPropostaForm({
  empreendimentos,
  lotes,
  tabelas,
  condicoes,
  clientes,
}: {
  empreendimentos: Empreendimento[];
  lotes: Lote[];
  tabelas: TabelaPreco[];
  condicoes: CondicaoPagamento[];
  clientes: Cliente[];
}) {
  const [empreendimentoId, setEmpreendimentoId] = useState(empreendimentos[0]?.id ?? "");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [clienteId, setClienteId] = useState("");

  const tabela = useMemo(
    () => tabelas.find((t) => t.empreendimento_id === empreendimentoId) ?? null,
    [tabelas, empreendimentoId]
  );

  const condicoesDaTabela = useMemo(
    () => condicoes.filter((c) => c.tabela_preco_id === tabela?.id),
    [condicoes, tabela]
  );

  const [condicoesEscolhidas, setCondicoesEscolhidas] = useState<string[]>([]);
  const efetivas = condicoesEscolhidas.length
    ? condicoesEscolhidas
    : condicoesDaTabela[0]
      ? [condicoesDaTabela[0].id]
      : [];

  const disponiveis = useMemo(
    () => [...lotes].filter((l) => l.empreendimento_id === empreendimentoId).sort(compararLote),
    [lotes, empreendimentoId]
  );

  const escolhidos = disponiveis.filter((l) => selecionados.includes(l.id));
  const somaTabela = escolhidos.reduce((s, l) => s + Number(l.preco_tabela ?? 0), 0);
  const somaArea = escolhidos.reduce((s, l) => s + Number(l.area_m2), 0);

  function alternarLote(id: string) {
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function alternarCondicao(id: string) {
    setCondicoesEscolhidas((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );
  }

  const quadras = [...new Set(disponiveis.map((l) => l.quadra))].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { numeric: true })
  );

  return (
    <form action={criarProposta} className="flex flex-col gap-6">
      <input type="hidden" name="empreendimento_id" value={empreendimentoId} />
      {efetivas.map((id) => (
        <input key={id} type="hidden" name="condicao_id" value={id} />
      ))}
      {selecionados.map((id) => (
        <input key={id} type="hidden" name="lote_id" value={id} />
      ))}

      <section className="cartao p-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo">Empreendimento</label>
          <select
            className="campo"
            value={empreendimentoId}
            onChange={(e) => {
              setEmpreendimentoId(e.target.value);
              setSelecionados([]);
              setCondicoesEscolhidas([]);
            }}
          >
            {empreendimentos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
          {tabela && (
            <p className="text-xs text-cinza mt-1">
              Tabela {tabela.referencia} — INCC {pct(tabela.incc_mensal, 3)} a.m.
            </p>
          )}
        </div>

        <div>
          <label className="rotulo">Cliente já cadastrado</label>
          <select
            className="campo"
            name="cliente_id"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">— novo cliente —</option>
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
            {clienteId ? "Título da proposta (opcional)" : "Nome do cliente"}
          </label>
          <input
            className="campo"
            name={clienteId ? "titulo" : "cliente_nome"}
            placeholder={clienteId ? "Ex.: revisão com prazo maior" : "Ex.: Axel Indústria"}
            required={!clienteId}
          />
        </div>
      </section>

      <section className="cartao">
        <div className="cartao-titulo">
          <h2 className="serif text-lg">
            Opções de parcelamento
            <span className="text-sm text-cinza font-sans ml-2">
              marque quantas quiser; a ordem de clique é a ordem das abas
            </span>
          </h2>
          <span className="text-sm text-cinza">{efetivas.length} selecionada(s)</span>
        </div>

        <div className="p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {condicoesDaTabela.map((c) => {
            const posicao = efetivas.indexOf(c.id);
            const marcado = posicao >= 0;
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => alternarCondicao(c.id)}
                className={`text-left rounded-lg border px-3 py-2.5 transition ${
                  marcado
                    ? "border-vinho bg-vinho-fraco"
                    : "border-linha bg-superficie hover:bg-papel-alt"
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm">
                    {marcado && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-vinho text-white text-[11px] mr-1.5 align-middle">
                        {posicao + 1}
                      </span>
                    )}
                    {c.nome}
                  </span>
                  {marcado && <Check size={14} className="text-vinho shrink-0 mt-0.5" />}
                </span>
                {c.desconto_pct > 0 && (
                  <span className="selo selo-ouro mt-1">−{pct(c.desconto_pct, 2)}</span>
                )}
                {c.descricao && (
                  <span className="block text-xs text-cinza mt-1">{c.descricao}</span>
                )}
              </button>
            );
          })}
          {condicoesDaTabela.length === 0 && (
            <p className="text-sm text-cinza">
              Nenhuma condição cadastrada para a tabela vigente.
            </p>
          )}
        </div>
      </section>

      <section className="cartao">
        <div className="cartao-titulo">
          <h2 className="serif text-lg">Terrenos</h2>
          <span className="text-sm text-cinza">
            {escolhidos.length} selecionado(s) · {area(somaArea)} · {moedaCurta(somaTabela)}
          </span>
        </div>

        <div className="p-4 flex flex-col gap-5">
          {quadras.map((q) => (
            <div key={q}>
              <p className="eyebrow mb-2">Quadra {q}</p>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
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
                              {l.status === "reservado" ? "reservado" : "livre"}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-cinza tabular">
                          {area(Number(l.area_m2))}
                        </span>
                        <span className="block text-xs tabular">
                          {l.preco_tabela ? moeda(Number(l.preco_tabela)) : "sem preço"}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
          {disponiveis.length === 0 && (
            <p className="text-sm text-cinza">
              Nenhum lote livre ou reservado neste empreendimento.
            </p>
          )}
        </div>
      </section>

      {escolhidos.length > 0 && (
        <section className="cartao p-5 grid gap-4 sm:grid-cols-3 text-center">
          <div>
            <p className="eyebrow">Preço de tabela</p>
            <p className="serif text-xl tabular">{moeda(somaTabela)}</p>
          </div>
          <div>
            <p className="eyebrow">Área total</p>
            <p className="serif text-xl tabular">{area(somaArea)}</p>
          </div>
          <div>
            <p className="eyebrow">Opções a montar</p>
            <p className="serif text-xl tabular text-vinho">{efetivas.length}</p>
          </div>
        </section>
      )}

      <div className="flex justify-end gap-2">
        <button className="btn btn-primario" disabled={escolhidos.length === 0}>
          Criar e abrir o simulador
        </button>
      </div>
    </form>
  );
}
