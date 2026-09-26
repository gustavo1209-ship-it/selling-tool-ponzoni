"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, ShieldCheck, User, X } from "lucide-react";
import {
  definirAcessoEmpreendimentos,
  definirAcessoEmpreendimentosEmMassa,
  definirPapel,
  renomearCorretor,
} from "@/app/admin/acoes";
import type { Empreendimento, Perfil } from "@/lib/db/tipos";
import { mensagemDeFalha } from "@/lib/erros";
import { verificarResultado } from "@/lib/resultadoAcao";

/**
 * Quem é admin e quem vê o quê.
 *
 * A trava de empreendimento é **opt-in por pessoa**: o padrão continua sendo
 * ver todos, e o admin liga a restrição em quem precisa. É por isso que são
 * duas coisas na tela — um interruptor e uma lista — em vez de só a lista:
 * "nenhum marcado" não pode virar "vê tudo de novo" por acidente.
 *
 * Quem separa de verdade é a RLS (`pode_ver_empreendimento`, migration 31).
 * Esta tela só grava o que ela lê.
 *
 * As contas continuam nascendo no painel do Supabase (Authentication →
 * Users → Add user): o cadastro aberto foi fechado de propósito, e criar
 * usuário daqui exigiria a chave de serviço no servidor da aplicação.
 */
export default function AdminCorretores({
  eu,
  perfis,
  empreendimentos,
  vinculos,
}: {
  eu: string;
  perfis: Perfil[];
  empreendimentos: Empreendimento[];
  vinculos: { perfil_id: string; empreendimento_id: string }[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

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
      <div>
        <p className="eyebrow">Administração</p>
        <h1 className="serif text-3xl mt-1">Corretores</h1>
        <p className="text-sm text-cinza mt-1">
          Por padrão todo mundo vê todos os empreendimentos. A restrição é
          ligada pessoa a pessoa.
        </p>
      </div>

      {erro && (
        <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2">
          {erro}
        </p>
      )}

      <AcessoEmMassa
        corretores={perfis.filter((p) => p.papel !== "admin")}
        empreendimentos={empreendimentos}
        pendente={pendente}
        agir={agir}
      />

      {perfis.map((p) => {
        const marcados = vinculos
          .filter((v) => v.perfil_id === p.id)
          .map((v) => v.empreendimento_id);
        return (
          <LinhaPerfil
            // a chave muda quando a trava vem de fora (ex.: aplicar em
            // massa), remontando a linha e evitando estado preso — sem
            // isso a lista mostrada continuaria a de antes até um F5.
            key={`${p.id}:${p.empreendimentos_restritos}:${marcados.join(",")}`}
            perfil={p}
            souEu={p.id === eu}
            empreendimentos={empreendimentos}
            marcados={marcados}
            pendente={pendente}
            agir={agir}
          />
        );
      })}

      <p className="text-xs text-cinza">
        Contas novas são criadas no painel do Supabase, em Authentication →
        Users → Add user. Elas nascem como corretor.
      </p>
    </div>
  );
}

/**
 * Aplica a mesma trava a vários corretores de uma vez — sem isso, "só o
 * Florescer para o time todo" exigia repetir a mesma marcação corretor a
 * corretor. Admin nunca aparece aqui: enxerga tudo por definição, e a ação
 * do servidor recusa a chamada se algum id passado for de admin.
 */
function AcessoEmMassa({
  corretores,
  empreendimentos,
  pendente,
  agir,
}: {
  corretores: Perfil[];
  empreendimentos: Empreendimento[];
  pendente: boolean;
  agir: (fn: () => Promise<unknown>) => void;
}) {
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [restrito, setRestrito] = useState(true);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);

  const alternarCorretor = (id: string) =>
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    );
  const alternarEmpreendimento = (id: string) =>
    setEscolhidos((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    );

  if (corretores.length === 0) return null;

  const todosMarcados = selecionados.length === corretores.length;

  return (
    <section className="cartao p-5 flex flex-col gap-4 border-vinho">
      <div>
        <h2 className="serif text-lg">Aplicar em massa</h2>
        <p className="text-sm text-cinza">
          Escolhe os corretores e os empreendimentos de uma vez, em vez de
          repetir corretor a corretor.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="rotulo">Corretores</label>
          <button
            type="button"
            className="text-xs text-vinho underline"
            onClick={() =>
              setSelecionados(todosMarcados ? [] : corretores.map((c) => c.id))
            }
          >
            {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {corretores.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2.5 rounded-md border border-linha px-3 py-2 text-sm cursor-pointer hover:bg-papel-alt"
            >
              <input
                type="checkbox"
                checked={selecionados.includes(c.id)}
                onChange={() => alternarCorretor(c.id)}
              />
              <span>{c.nome}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={restrito}
          onChange={(e) => setRestrito(e.target.checked)}
        />
        Restringir a empreendimentos específicos
      </label>

      {restrito && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {empreendimentos.map((e) => (
            <label
              key={e.id}
              className="flex items-center gap-2.5 rounded-md border border-linha px-3 py-2 text-sm cursor-pointer hover:bg-papel-alt"
            >
              <input
                type="checkbox"
                checked={escolhidos.includes(e.id)}
                onChange={() => alternarEmpreendimento(e.id)}
              />
              <span>
                {e.nome}
                {!e.ativo && <span className="text-cinza"> · inativo</span>}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn btn-primario"
          disabled={pendente || selecionados.length === 0}
          onClick={() =>
            agir(() =>
              definirAcessoEmpreendimentosEmMassa(selecionados, restrito, escolhidos)
            )
          }
        >
          <Check size={15} /> Aplicar aos selecionados
        </button>
        <span className="text-xs text-cinza">
          {selecionados.length === 0
            ? "Selecione ao menos um corretor."
            : restrito
              ? escolhidos.length === 0
                ? `${selecionados.length} corretor(es) não verão empreendimento nenhum.`
                : `${selecionados.length} corretor(es) verão ${escolhidos.length} de ${empreendimentos.length}.`
              : `${selecionados.length} corretor(es) verão todos os empreendimentos.`}
        </span>
      </div>
    </section>
  );
}

function LinhaPerfil({
  perfil,
  souEu,
  empreendimentos,
  marcados,
  pendente,
  agir,
}: {
  perfil: Perfil;
  souEu: boolean;
  empreendimentos: Empreendimento[];
  marcados: string[];
  pendente: boolean;
  agir: (fn: () => Promise<unknown>) => void;
}) {
  const [restrito, setRestrito] = useState(perfil.empreendimentos_restritos);
  const [escolhidos, setEscolhidos] = useState<string[]>(marcados);
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeRascunho, setNomeRascunho] = useState(perfil.nome);
  const ehAdmin = perfil.papel === "admin";

  function salvarNome() {
    agir(async () => {
      const resultado = await renomearCorretor(perfil.id, nomeRascunho);
      if (!resultado.ok) throw new Error(resultado.erro);
      setEditandoNome(false);
    });
  }

  const alternar = (id: string) =>
    setEscolhidos((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    );

  return (
    <section className="cartao p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {ehAdmin ? (
          <ShieldCheck size={20} className="text-vinho" />
        ) : (
          <User size={20} className="text-cinza" />
        )}
        <div className="flex-1">
          {editandoNome ? (
            <div className="flex items-center gap-1.5">
              <input
                className="campo py-1 text-sm w-56"
                value={nomeRascunho}
                onChange={(e) => setNomeRascunho(e.target.value)}
                disabled={pendente}
                autoFocus
              />
              <button
                className="btn btn-fantasma px-2 text-verde"
                disabled={pendente}
                onClick={salvarNome}
                title="Salvar"
              >
                <Check size={15} />
              </button>
              <button
                className="btn btn-fantasma px-2"
                disabled={pendente}
                onClick={() => {
                  setEditandoNome(false);
                  setNomeRascunho(perfil.nome);
                }}
                title="Cancelar"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <h2 className="serif text-lg flex items-center gap-1.5">
              {perfil.nome}
              {ehAdmin && <span className="selo selo-marca align-middle">admin</span>}
              <button
                className="btn btn-fantasma px-1.5 py-0.5"
                onClick={() => setEditandoNome(true)}
                title="Renomear"
              >
                <Pencil size={13} className="text-cinza" />
              </button>
            </h2>
          )}
          <p className="text-xs text-cinza">{perfil.email}</p>
        </div>

        {souEu ? (
          <span className="text-xs text-cinza">
            é você — o papel só muda por outro admin
          </span>
        ) : (
          <button
            className="btn btn-secundario"
            disabled={pendente}
            onClick={() =>
              agir(() => definirPapel(perfil.id, ehAdmin ? "corretor" : "admin"))
            }
          >
            {ehAdmin ? "Rebaixar a corretor" : "Promover a admin"}
          </button>
        )}
      </div>

      {ehAdmin ? (
        <p className="text-sm text-cinza">
          Admin vê todos os empreendimentos — a restrição não se aplica.
        </p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={restrito}
              onChange={(e) => setRestrito(e.target.checked)}
            />
            Restringir a empreendimentos específicos
          </label>

          {restrito && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {empreendimentos.map((e) => (
                <label
                  key={e.id}
                  className="flex items-center gap-2.5 rounded-md border border-linha px-3 py-2 text-sm cursor-pointer hover:bg-papel-alt"
                >
                  <input
                    type="checkbox"
                    checked={escolhidos.includes(e.id)}
                    onChange={() => alternar(e.id)}
                  />
                  <span>
                    {e.nome}
                    {!e.ativo && <span className="text-cinza"> · inativo</span>}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="btn btn-primario"
              disabled={pendente}
              onClick={() =>
                agir(() =>
                  definirAcessoEmpreendimentos(perfil.id, restrito, escolhidos)
                )
              }
            >
              <Check size={15} /> Salvar acesso
            </button>
            <span className="text-xs text-cinza">
              {restrito
                ? escolhidos.length === 0
                  ? "Nenhum marcado: este corretor não verá empreendimento nenhum."
                  : `Vê ${escolhidos.length} de ${empreendimentos.length}.`
                : "Vê todos os empreendimentos."}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
