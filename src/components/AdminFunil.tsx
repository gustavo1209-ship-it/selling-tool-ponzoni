"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from "lucide-react";
import {
  apagarEtapa,
  atualizarEtapa,
  criarEtapa,
  type DadosEtapa,
} from "@/app/admin/acoes";
import type { FunilEtapa } from "@/lib/db/tipos";
import { mensagemDeFalha } from "@/lib/erros";

const DESFECHOS: { valor: DadosEtapa["desfecho"]; rotulo: string; ajuda: string }[] = [
  {
    valor: "aberta",
    rotulo: "Em andamento",
    ajuda: "A negociação continua viva. É o caso da maioria das colunas.",
  },
  {
    valor: "ganha",
    rotulo: "Fechou",
    ajuda: "Coluna terminal de venda: o cartão que chega aqui é carimbado como fechado.",
  },
  {
    valor: "perdida",
    rotulo: "Perdeu",
    ajuda: "Coluna terminal de desistência. Também carimba a data de fechamento.",
  },
];

/**
 * As colunas do kanban.
 *
 * `desfecho` é o campo que não é decoração: é dele que sai a taxa de
 * conversão do quadro e é ele que faz o cartão parar de contar como
 * negociação aberta. Renomear "Fechado" para "Assinado" não muda nada;
 * trocar o desfecho, sim.
 *
 * Coluna com cartão dentro não se apaga — desmarque "ativa" para tirá-la do
 * quadro sem perder o histórico de quem passou por ela.
 */
export default function AdminFunil({
  etapas,
  contagem,
}: {
  etapas: FunilEtapa[];
  contagem: Record<string, number>;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [nova, setNova] = useState(false);

  function agir(fn: () => Promise<unknown>) {
    setErro(null);
    iniciar(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErro(mensagemDeFalha(e));
      }
    });
  }

  /** Troca a ordem com a vizinha, gravando as duas. */
  function mover(i: number, direcao: -1 | 1) {
    const atual = etapas[i];
    const vizinha = etapas[i + direcao];
    if (!vizinha) return;
    agir(async () => {
      await atualizarEtapa(atual.id, { ...paraDados(atual), ordem: vizinha.ordem });
      await atualizarEtapa(vizinha.id, { ...paraDados(vizinha), ordem: atual.ordem });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="serif text-3xl mt-1">Etapas do funil</h1>
          <p className="text-sm text-cinza mt-1">
            As colunas do quadro de negociações, na ordem em que aparecem.
          </p>
        </div>
        <button className="btn btn-primario" onClick={() => setNova((n) => !n)}>
          <Plus size={16} /> Nova etapa
        </button>
      </div>

      {erro && (
        <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2">
          {erro}
        </p>
      )}

      {nova && (
        <FormularioEtapa
          inicial={{
            nome: "",
            cor: "#6B6662",
            ordem: (etapas.at(-1)?.ordem ?? 0) + 10,
            desfecho: "aberta",
            ativa: true,
          }}
          pendente={pendente}
          aoSalvar={(d) =>
            agir(async () => {
              await criarEtapa(d);
              setNova(false);
            })
          }
          aoCancelar={() => setNova(false)}
        />
      )}

      <div className="flex flex-col gap-2">
        {etapas.map((e, i) => (
          <LinhaEtapa
            key={e.id}
            etapa={e}
            cartoes={contagem[e.id] ?? 0}
            primeira={i === 0}
            ultima={i === etapas.length - 1}
            pendente={pendente}
            agir={agir}
            aoMover={(d) => mover(i, d)}
          />
        ))}
      </div>
    </div>
  );
}

const paraDados = (e: FunilEtapa): DadosEtapa => ({
  nome: e.nome,
  cor: e.cor,
  ordem: e.ordem,
  desfecho: e.desfecho,
  ativa: e.ativa,
});

function LinhaEtapa({
  etapa,
  cartoes,
  primeira,
  ultima,
  pendente,
  agir,
  aoMover,
}: {
  etapa: FunilEtapa;
  cartoes: number;
  primeira: boolean;
  ultima: boolean;
  pendente: boolean;
  agir: (fn: () => Promise<unknown>) => void;
  aoMover: (direcao: -1 | 1) => void;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <FormularioEtapa
        inicial={paraDados(etapa)}
        pendente={pendente}
        aoSalvar={(d) =>
          agir(async () => {
            await atualizarEtapa(etapa.id, d);
            setEditando(false);
          })
        }
        aoCancelar={() => setEditando(false)}
      />
    );
  }

  return (
    <div className="cartao flex flex-wrap items-center gap-3 px-4 py-3">
      <span
        className="w-3 h-8 rounded-sm shrink-0"
        style={{ background: etapa.cor }}
      />
      <span className="flex-1">
        <span className="text-sm font-semibold">
          {etapa.nome}
          {!etapa.ativa && <span className="selo selo-neutro ml-2">fora do quadro</span>}
        </span>
        <span className="text-xs text-cinza block">
          {DESFECHOS.find((d) => d.valor === etapa.desfecho)?.rotulo} ·{" "}
          {cartoes} negociação(ões)
        </span>
      </span>

      <button
        className="btn btn-fantasma"
        disabled={primeira || pendente}
        onClick={() => aoMover(-1)}
        title="Subir"
      >
        <ArrowUp size={15} />
      </button>
      <button
        className="btn btn-fantasma"
        disabled={ultima || pendente}
        onClick={() => aoMover(1)}
        title="Descer"
      >
        <ArrowDown size={15} />
      </button>
      <button className="btn btn-fantasma" onClick={() => setEditando(true)}>
        Editar
      </button>
      <button
        className="btn btn-fantasma text-vermelho"
        disabled={pendente}
        onClick={() => agir(() => apagarEtapa(etapa.id))}
        title={cartoes > 0 ? "Tem cartões dentro" : "Apagar"}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function FormularioEtapa({
  inicial,
  pendente,
  aoSalvar,
  aoCancelar,
}: {
  inicial: DadosEtapa;
  pendente: boolean;
  aoSalvar: (d: DadosEtapa) => void;
  aoCancelar: () => void;
}) {
  const [dados, setDados] = useState(inicial);
  const desfecho = DESFECHOS.find((d) => d.valor === dados.desfecho);

  return (
    <section className="cartao p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
      <div>
        <label className="rotulo">Nome da coluna</label>
        <input
          className="campo"
          value={dados.nome}
          onChange={(e) => setDados({ ...dados, nome: e.target.value })}
        />
      </div>
      <div>
        <label className="rotulo">Cor</label>
        <div className="flex gap-2">
          <input
            type="color"
            className="campo w-14 p-1"
            value={dados.cor}
            onChange={(e) => setDados({ ...dados, cor: e.target.value })}
          />
          <input
            className="campo"
            value={dados.cor}
            onChange={(e) => setDados({ ...dados, cor: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="rotulo">O que significa</label>
        <select
          className="campo"
          value={dados.desfecho}
          onChange={(e) =>
            setDados({ ...dados, desfecho: e.target.value as DadosEtapa["desfecho"] })
          }
        >
          {DESFECHOS.map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.rotulo}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm pb-2">
        <input
          type="checkbox"
          checked={dados.ativa}
          onChange={(e) => setDados({ ...dados, ativa: e.target.checked })}
        />
        Aparece no quadro
      </label>

      <p className="text-xs text-cinza sm:col-span-2 lg:col-span-4">
        {desfecho?.ajuda}
      </p>

      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <button
          className="btn btn-primario"
          disabled={pendente}
          onClick={() => aoSalvar(dados)}
        >
          <Check size={15} /> Salvar
        </button>
        <button className="btn btn-secundario" onClick={aoCancelar}>
          <X size={15} /> Cancelar
        </button>
      </div>
    </section>
  );
}
