"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Table2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import type {
  CondicaoPagamento,
  Empreendimento,
  Lote,
  TabelaPreco,
} from "@/lib/db/tipos";
import { area, moeda, moedaCurta, num, pct, precoM2 } from "@/lib/formato";
import { mensagemDeFalha } from "@/lib/erros";
import type { LoteStatus } from "@/lib/calc/tipos";

const STATUS: LoteStatus[] = ["livre", "reservado", "vendido", "indisponivel"];

export default function EspelhoTabela({
  empreendimentos,
  empreendimento,
  lotes,
  tabela,
  condicoes,
}: {
  empreendimentos: Empreendimento[];
  empreendimento: Empreendimento;
  lotes: Lote[];
  tabela: TabelaPreco | null;
  condicoes: CondicaoPagamento[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [sincronizando, setSincronizando] = useState(false);
  const [recado, setRecado] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [filtro, setFiltro] = useState<LoteStatus | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [mostrarCondicoes, setMostrarCondicoes] = useState(true);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lotes.filter((l) => {
      if (filtro !== "todos" && l.status !== filtro) return false;
      if (!termo) return true;
      return (
        `${l.quadra}${l.numero}`.toLowerCase().includes(termo) ||
        `${l.quadra}-${l.numero}`.toLowerCase().includes(termo) ||
        (l.comprador ?? "").toLowerCase().includes(termo)
      );
    });
  }, [lotes, filtro, busca]);

  const resumo = useMemo(() => {
    const conta = (s: LoteStatus) => lotes.filter((l) => l.status === s).length;
    const livres = lotes.filter((l) => l.status === "livre");
    return {
      livre: conta("livre"),
      reservado: conta("reservado"),
      vendido: conta("vendido"),
      indisponivel: conta("indisponivel"),
      vgv: livres.reduce((s, l) => s + Number(l.preco_tabela ?? 0), 0),
      areaLivre: livres.reduce((s, l) => s + Number(l.area_m2), 0),
    };
  }, [lotes]);

  async function sincronizar() {
    setSincronizando(true);
    setRecado(null);
    try {
      const r = await fetch("/api/espelho/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empreendimentoId: empreendimento.id }),
      });
      const corpo = await r.json();
      if (!r.ok) {
        setRecado({ tipo: "erro", texto: corpo.erro ?? "Falha ao sincronizar." });
      } else {
        const n = corpo.alteracoes.length;
        setRecado({
          tipo: "ok",
          texto:
            n === 0
              ? `${corpo.lidos} lotes lidos — nada mudou.`
              : `${corpo.lidos} lotes lidos, ${n} alteração(ões): ${corpo.alteracoes.slice(0, 6).join("; ")}${n > 6 ? "…" : ""}`,
        });
        router.refresh();
      }
    } catch (e) {
      setRecado({ tipo: "erro", texto: mensagemDeFalha(e) });
    }
    setSincronizando(false);
  }

  async function alterar(lote: Lote, patch: Partial<Lote>) {
    const supabase = createClient();
    const { error } = await supabase.from("lotes").update(patch).eq("id", lote.id);
    if (error) {
      setRecado({ tipo: "erro", texto: error.message });
      return;
    }
    iniciar(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Espelho de vendas</p>
          <h1 className="serif text-3xl mt-1">{empreendimento.nome}</h1>
          <p className="text-sm text-cinza">
            {tabela
              ? `Tabela ${tabela.referencia} — preço de referência: ${tabela.condicao_base}`
              : "Sem tabela de preços vigente"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {empreendimentos.length > 1 && (
            <select
              className="campo w-auto"
              value={empreendimento.slug}
              onChange={(e) => router.push(`/espelho?e=${e.target.value}`)}
            >
              {empreendimentos.map((e) => (
                <option key={e.id} value={e.slug}>
                  {e.nome}
                </option>
              ))}
            </select>
          )}
          <button
            className="btn btn-secundario"
            onClick={sincronizar}
            disabled={sincronizando || !empreendimento.espelho_csv_url}
            title={
              empreendimento.espelho_csv_url
                ? "Puxa status, comprador e preço da planilha publicada"
                : "Sem URL de planilha configurada"
            }
          >
            <RefreshCw size={15} className={sincronizando ? "animate-spin" : ""} />
            {sincronizando ? "Sincronizando…" : "Sincronizar com o Sheets"}
          </button>
        </div>
      </div>

      {recado && (
        <p
          className={`text-sm rounded-md px-3 py-2 ${
            recado.tipo === "ok"
              ? "bg-verde-fraco text-verde"
              : "bg-vermelho-fraco text-vermelho"
          }`}
        >
          {recado.texto}
        </p>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        {(
          [
            ["Livres", resumo.livre, "selo-livre"],
            ["Reservados", resumo.reservado, "selo-reservado"],
            ["Vendidos", resumo.vendido, "selo-vendido"],
            ["Não disponíveis", resumo.indisponivel, "selo-indisponivel"],
          ] as const
        ).map(([rotulo, valor, classe]) => (
          <div key={rotulo} className="cartao p-4">
            <p className="eyebrow">{rotulo}</p>
            <p className="text-3xl tabular mt-1">{valor}</p>
            <span className={`selo ${classe} mt-2`}>{lotes.length} no total</span>
          </div>
        ))}
        <div className="cartao p-4">
          <p className="eyebrow">VGV disponível</p>
          <p className="serif text-2xl text-vinho tabular mt-1">{moedaCurta(resumo.vgv)}</p>
          <p className="text-xs text-cinza mt-1">a preço de tabela</p>
        </div>
        <div className="cartao p-4">
          <p className="eyebrow">Área livre</p>
          <p className="serif text-2xl tabular mt-1">{num(resumo.areaLivre)}</p>
          <p className="text-xs text-cinza mt-1">
            m² · média {precoM2(resumo.areaLivre ? resumo.vgv / resumo.areaLivre : 0)}
          </p>
        </div>
      </div>

      {condicoes.length > 0 && (
        <section className="cartao">
          <div className="cartao-titulo">
            <h2 className="serif text-lg flex items-center gap-2">
              <Table2 size={17} className="text-vinho" /> Condições de pagamento
            </h2>
            <button
              className="btn btn-fantasma"
              onClick={() => setMostrarCondicoes((v) => !v)}
            >
              {mostrarCondicoes ? "ocultar" : "mostrar"}
            </button>
          </div>
          {mostrarCondicoes && (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Condição</th>
                    <th className="num">Desconto</th>
                    <th className="num">Fator sobre o preço</th>
                    <th>Como fica</th>
                  </tr>
                </thead>
                <tbody>
                  {condicoes.map((c) => (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.nome}</td>
                      <td className="num">
                        {c.desconto_pct > 0 ? `−${pct(c.desconto_pct)}` : "—"}
                      </td>
                      <td className="num tabular">
                        ×{(1 - c.desconto_pct).toLocaleString("pt-BR", {
                          minimumFractionDigits: 3,
                          maximumFractionDigits: 4,
                        })}
                      </td>
                      <td className="text-cinza">{c.descricao ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="cartao">
        <div className="cartao-titulo flex-wrap">
          <h2 className="serif text-lg">Lotes</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className="campo w-44"
              placeholder="Buscar lote ou comprador"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select
              className="campo w-auto"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as LoteStatus | "todos")}
            >
              <option value="todos">Todos os status</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {s === "indisponivel" ? "Não disponível" : s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Lote</th>
                <th className="num">Área</th>
                <th className="num">Preço de tabela</th>
                <th className="num">R$/m²</th>
                <th>Status</th>
                <th>Comprador</th>
                <th className="w-56">Observação</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.id} className={pendente ? "opacity-60" : ""}>
                  <td className="font-semibold whitespace-nowrap">
                    {l.quadra}-{l.numero}
                  </td>
                  <td className="num">{area(Number(l.area_m2))}</td>
                  <td className="num">
                    {l.preco_tabela ? moeda(Number(l.preco_tabela)) : "—"}
                  </td>
                  <td className="num text-cinza">
                    {l.preco_tabela
                      ? precoM2(Number(l.preco_tabela) / Number(l.area_m2))
                      : "—"}
                  </td>
                  <td>
                    <select
                      className="campo w-auto py-1 text-xs"
                      value={l.status}
                      onChange={(e) =>
                        alterar(l, { status: e.target.value as LoteStatus })
                      }
                    >
                      {STATUS.map((s) => (
                        <option key={s} value={s}>
                          {s === "indisponivel"
                            ? "Não disponível"
                            : s[0].toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-cinza">{l.comprador ?? "—"}</td>
                  <td>
                    {/* grava ao sair do campo, não a cada tecla */}
                    <input
                      key={`${l.id}-${l.observacao ?? ""}`}
                      className="campo py-1 text-xs"
                      defaultValue={l.observacao ?? ""}
                      placeholder="—"
                      onBlur={(e) => {
                        const novo = e.target.value.trim() || null;
                        if (novo !== (l.observacao ?? null)) {
                          alterar(l, { observacao: novo });
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
              {visiveis.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-cinza py-6">
                    Nenhum lote com esse filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-cinza">
        O status também é mantido no{" "}
        <a
          href="https://docs.google.com/spreadsheets/d/1KAKfuVyV3T6IoLI2FrxANUv1h12knJS9gDbMxJqXiS0/edit"
          target="_blank"
          rel="noreferrer"
          className="text-vinho font-semibold"
        >
          Espelho de Vendas no Google Sheets
        </a>
        , que alimenta o mapa público. Sincronizar traz de lá; editar aqui não
        escreve na planilha.
      </p>
    </div>
  );
}
