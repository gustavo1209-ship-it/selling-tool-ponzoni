"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2, X } from "lucide-react";
import {
  apagarCampanha,
  atualizarCampanha,
  criarCampanha,
  type DadosCampanha,
} from "@/app/admin/acoes";
import CampoNumero from "./CampoNumero";
import type { Campanha, CampanhaModo, Empreendimento } from "@/lib/db/tipos";
import { hojeISO } from "@/lib/contratos/mes";
import { mensagemDeFalha } from "@/lib/erros";
import { verificarResultado } from "@/lib/resultadoAcao";

const MODOS: { valor: CampanhaModo; rotulo: string; ajuda: string }[] = [
  {
    valor: "substituir",
    rotulo: "Substitui o desconto da condição",
    ajuda: "O percentual da campanha vira o desconto do cenário, por cima do parcelamento da condição escolhida — ignora o desconto que a condição já tinha.",
  },
  {
    valor: "somar",
    rotulo: "Soma com o desconto da condição",
    ajuda: "O percentual da campanha se soma ao desconto que a condição escolhida já tem.",
  },
];

function vigencia(c: Campanha): { rotulo: string; selo: string } {
  if (!c.ativa) return { rotulo: "desativada", selo: "selo-neutro" };
  const hoje = hojeISO();
  if (hoje < c.inicio) return { rotulo: "agendada", selo: "selo-neutro" };
  if (hoje > c.fim) return { rotulo: "encerrada", selo: "selo-neutro" };
  return { rotulo: "vigente agora", selo: "selo-livre" };
}

/**
 * Campanhas de desconto por tempo determinado, de um empreendimento. O
 * corretor não vê esta tela — ele só escolhe aplicar (ou não) a campanha
 * vigente dentro do Simulador da proposta.
 */
export default function AdminCampanhas({
  campanhas,
  empreendimentos,
}: {
  campanhas: Campanha[];
  empreendimentos: Empreendimento[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [nova, setNova] = useState(false);

  const nomeDoEmpreendimento = (id: string) =>
    empreendimentos.find((e) => e.id === id)?.nome ?? "—";

  function agir(fn: () => Promise<unknown>) {
    setErro(null);
    iniciar(async () => {
      try {
        verificarResultado(await fn());
        router.refresh();
      } catch (e) {
        setErro(mensagemDeFalha(e));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="serif text-3xl mt-1">Campanhas</h1>
          <p className="text-sm text-cinza mt-1">
            Descontos promocionais por tempo determinado. Enquanto vigente, o
            corretor pode optar por aplicar no Simulador da proposta.
          </p>
        </div>
        <button className="btn btn-primario" onClick={() => setNova((n) => !n)}>
          <Plus size={16} /> Nova campanha
        </button>
      </div>

      {erro && (
        <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2">
          {erro}
        </p>
      )}

      {nova && empreendimentos.length > 0 && (
        <FormularioCampanha
          inicial={{
            empreendimento_id: empreendimentos[0].id,
            nome: "",
            percentual_desconto: 10,
            modo: "substituir",
            inicio: hojeISO(),
            fim: hojeISO(),
            ativa: true,
          }}
          empreendimentos={empreendimentos}
          pendente={pendente}
          aoSalvar={(d) =>
            agir(async () => {
              const resultado = await criarCampanha(d);
              if (!resultado.ok) throw new Error(resultado.erro);
              setNova(false);
            })
          }
          aoCancelar={() => setNova(false)}
        />
      )}

      <div className="flex flex-col gap-2">
        {campanhas.map((c) => (
          <LinhaCampanha
            key={c.id}
            campanha={c}
            nomeEmpreendimento={nomeDoEmpreendimento(c.empreendimento_id)}
            empreendimentos={empreendimentos}
            pendente={pendente}
            agir={agir}
          />
        ))}
        {campanhas.length === 0 && (
          <p className="text-sm text-cinza py-8 text-center">
            Nenhuma campanha cadastrada ainda.
          </p>
        )}
      </div>
    </div>
  );
}

const paraDados = (c: Campanha): DadosCampanha => ({
  empreendimento_id: c.empreendimento_id,
  nome: c.nome,
  percentual_desconto: Number(c.percentual_desconto) * 100,
  modo: c.modo,
  inicio: c.inicio,
  fim: c.fim,
  ativa: c.ativa,
});

function LinhaCampanha({
  campanha,
  nomeEmpreendimento,
  empreendimentos,
  pendente,
  agir,
}: {
  campanha: Campanha;
  nomeEmpreendimento: string;
  empreendimentos: Empreendimento[];
  pendente: boolean;
  agir: (fn: () => Promise<unknown>) => void;
}) {
  const [editando, setEditando] = useState(false);
  const v = vigencia(campanha);

  if (editando) {
    return (
      <FormularioCampanha
        inicial={paraDados(campanha)}
        empreendimentos={empreendimentos}
        pendente={pendente}
        aoSalvar={(d) =>
          agir(async () => {
            const resultado = await atualizarCampanha(campanha.id, d);
            if (!resultado.ok) throw new Error(resultado.erro);
            setEditando(false);
          })
        }
        aoCancelar={() => setEditando(false)}
      />
    );
  }

  return (
    <div className="cartao flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="flex-1 min-w-56">
        <span className="text-sm font-semibold">
          {campanha.nome} <span className={`selo ${v.selo} ml-1`}>{v.rotulo}</span>
        </span>
        <span className="text-xs text-cinza block">
          {nomeEmpreendimento} · {(Number(campanha.percentual_desconto) * 100).toLocaleString("pt-BR")}%
          {" "}
          {campanha.modo === "substituir" ? "(substitui)" : "(soma)"} ·{" "}
          {campanha.inicio.split("-").reverse().join("/")} a{" "}
          {campanha.fim.split("-").reverse().join("/")}
        </span>
      </span>

      <button className="btn btn-fantasma" onClick={() => setEditando(true)}>
        Editar
      </button>
      <button
        className="btn btn-fantasma text-vermelho"
        disabled={pendente}
        onClick={() => agir(() => apagarCampanha(campanha.id))}
        title="Apagar"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function FormularioCampanha({
  inicial,
  empreendimentos,
  pendente,
  aoSalvar,
  aoCancelar,
}: {
  inicial: DadosCampanha;
  empreendimentos: Empreendimento[];
  pendente: boolean;
  aoSalvar: (d: DadosCampanha) => void;
  aoCancelar: () => void;
}) {
  const [dados, setDados] = useState(inicial);
  const modo = MODOS.find((m) => m.valor === dados.modo);

  return (
    <section className="cartao p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
      <div>
        <label className="rotulo">Empreendimento</label>
        <select
          className="campo"
          value={dados.empreendimento_id}
          onChange={(e) => setDados({ ...dados, empreendimento_id: e.target.value })}
        >
          {empreendimentos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="rotulo">Nome da campanha</label>
        <input
          className="campo"
          value={dados.nome}
          onChange={(e) => setDados({ ...dados, nome: e.target.value })}
        />
      </div>
      <div>
        <label className="rotulo">Desconto</label>
        <CampoNumero
          valor={dados.percentual_desconto}
          aoMudar={(v) => setDados({ ...dados, percentual_desconto: v ?? 0 })}
          sufixo="%"
        />
      </div>
      <div>
        <label className="rotulo">Como aplica</label>
        <select
          className="campo"
          value={dados.modo}
          onChange={(e) => setDados({ ...dados, modo: e.target.value as CampanhaModo })}
        >
          {MODOS.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.rotulo}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="rotulo">Início</label>
        <input
          type="date"
          className="campo"
          value={dados.inicio}
          onChange={(e) => setDados({ ...dados, inicio: e.target.value })}
        />
      </div>
      <div>
        <label className="rotulo">Fim</label>
        <input
          type="date"
          className="campo"
          value={dados.fim}
          onChange={(e) => setDados({ ...dados, fim: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm pb-2">
        <input
          type="checkbox"
          checked={dados.ativa}
          onChange={(e) => setDados({ ...dados, ativa: e.target.checked })}
        />
        Ativa
      </label>

      <p className="text-xs text-cinza sm:col-span-2 lg:col-span-4">{modo?.ajuda}</p>

      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <button
          className="btn btn-primario"
          disabled={pendente}
          onClick={() => aoSalvar({ ...dados, percentual_desconto: dados.percentual_desconto / 100 })}
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
