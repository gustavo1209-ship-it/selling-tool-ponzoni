"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  FileText,
  Phone,
  Plus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import CampoNumero from "./CampoNumero";
import {
  apagarNegociacao,
  atualizarNegociacao,
  criarNegociacao,
  moverNegociacao,
  promoverACliente,
  type DadosNegociacao,
} from "@/app/funil/acoes";
import { hojeISO } from "@/lib/contratos/mes";
import type {
  Cliente,
  Empreendimento,
  FunilEtapa,
  Lote,
  NegociacaoNoQuadro,
} from "@/lib/db/tipos";
import { mensagemDeFalha } from "@/lib/erros";
import { dataBR, moedaCurta } from "@/lib/formato";

interface PropostaResumo {
  id: string;
  codigo: string;
  titulo: string | null;
  clientes: { nome: string } | null;
}

/** O nome que vai no cartão: o cadastro manda, o apelido é o reserva. */
const nomeDoCartao = (n: NegociacaoNoQuadro) =>
  n.cliente?.nome ?? n.titulo ?? "sem nome";

/**
 * O funil de vendas em quadro.
 *
 * As colunas são dados (`funil_etapas`, editáveis em /admin/funil), não
 * código: a casa muda o funil sem esperar por uma versão nova.
 *
 * O arrastar usa o drag-and-drop do próprio navegador em vez de uma
 * biblioteca. Duas razões: é uma dependência a menos numa ferramenta que
 * hoje tem cinco, e a lista de um corretor cabe na tela — o que faz as
 * bibliotecas ganharem (virtualização, listas de milhares) não se aplica.
 *
 * `ordem` é `numeric` no banco justamente para isto: soltar um cartão entre
 * dois outros grava o ponto médio das duas ordens e não toca em mais nada.
 */
export default function Kanban({
  etapas,
  negociacoes,
  clientes,
  empreendimentos,
  lotes,
  propostas,
  autores,
  ehAdmin,
}: {
  etapas: FunilEtapa[];
  negociacoes: NegociacaoNoQuadro[];
  clientes: Cliente[];
  empreendimentos: Empreendimento[];
  lotes: Lote[];
  propostas: PropostaResumo[];
  /** id → nome curto, já resolvido no servidor. */
  autores: Record<string, string>;
  ehAdmin: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // O cartão troca de coluna na hora, sem esperar o servidor — arrastar uma
  // peça que só se move depois do round-trip não parece arrastar. É o que
  // `useOptimistic` faz: vale enquanto a transição corre e volta sozinho ao
  // que o banco disser, inclusive quando a gravação falha.
  const [itens, moverOtimista] = useOptimistic(
    negociacoes,
    (atual, mov: { id: string; etapaId: string; ordem: number }) =>
      atual.map((n) =>
        n.id === mov.id ? { ...n, etapa_id: mov.etapaId, ordem: mov.ordem } : n
      )
  );

  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [editando, setEditando] = useState<NegociacaoNoQuadro | null>(null);
  const [criandoEm, setCriandoEm] = useState<string | null>(null);

  function agir(fn: () => Promise<unknown>) {
    setErro(null);
    iniciar(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErro(mensagemDeFalha(e));
        router.refresh();
      }
    });
  }

  // uma coluna arquivada some do quadro, mas não pode engolir os cartões que
  // ficaram nela — some só quando esvazia
  const colunas = useMemo(
    () =>
      etapas.filter((e) => e.ativa || itens.some((n) => n.etapa_id === e.id)),
    [etapas, itens]
  );

  const porColuna = (etapaId: string) =>
    itens
      .filter((n) => n.etapa_id === etapaId)
      .sort((a, b) => Number(a.ordem) - Number(b.ordem));

  /**
   * Solta o cartão. `antes` é o cartão em cima do qual se soltou — sem ele,
   * o destino é o fim da coluna.
   */
  function soltar(etapaId: string, antes: NegociacaoNoQuadro | null) {
    const id = arrastando;
    setArrastando(null);
    setAlvo(null);
    if (!id) return;

    const lista = porColuna(etapaId).filter((n) => n.id !== id);
    const i = antes ? lista.findIndex((n) => n.id === antes.id) : lista.length;
    const anterior = i > 0 ? Number(lista[i - 1].ordem) : null;
    const posterior = i < lista.length ? Number(lista[i].ordem) : null;

    const ordem =
      anterior !== null && posterior !== null
        ? (anterior + posterior) / 2
        : posterior !== null
          ? posterior - 10
          : anterior !== null
            ? anterior + 10
            : 0;

    const atual = itens.find((n) => n.id === id);
    if (atual && atual.etapa_id === etapaId && Number(atual.ordem) === ordem) return;

    setErro(null);
    iniciar(async () => {
      moverOtimista({ id, etapaId, ordem });
      try {
        await moverNegociacao(id, etapaId, ordem);
      } catch (e) {
        setErro(mensagemDeFalha(e));
      }
      router.refresh();
    });
  }

  const abertas = itens.filter(
    (n) => etapas.find((e) => e.id === n.etapa_id)?.desfecho === "aberta"
  );
  const valorAberto = abertas.reduce(
    (s, n) => s + Number(n.valor_estimado ?? 0),
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Comercial</p>
          <h1 className="serif text-3xl mt-1">Funil de vendas</h1>
          <p className="text-sm text-cinza mt-1">
            {abertas.length} negociação(ões) em andamento
            {valorAberto > 0 && ` · ${moedaCurta(valorAberto)} em jogo`}
            {ehAdmin && " · você vê as de todo o time"}
          </p>
        </div>
        <button
          className="btn btn-primario"
          onClick={() => setCriandoEm(colunas[0]?.id ?? null)}
          disabled={colunas.length === 0}
        >
          <Plus size={16} /> Novo prospecto
        </button>
      </div>

      {erro && (
        <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2">
          {erro}
        </p>
      )}

      {colunas.length === 0 && (
        <p className="text-sm text-cinza">
          Nenhuma etapa cadastrada. Um admin monta as colunas em{" "}
          <Link href="/admin/funil" className="text-vinho font-semibold">
            Etapas do funil
          </Link>
          .
        </p>
      )}

      {/*
        Todas as colunas na tela, sem rolagem lateral: o quadro é uma grade de
        N colunas iguais, e N vem do número de etapas do quadro.
        `minmax(0, 1fr)` é o que faz cada uma encolher em vez de empurrar a
        vizinha para fora — com largura fixa, acrescentar etapa escondia a
        última, justamente onde a negociação fecha.

        No celular vira coluna única, empilhada: sete faixas de 40px não
        seriam um quadro.
      */}
      <div
        className="grid gap-2 pb-4 items-start grid-cols-1 md:[grid-template-columns:repeat(var(--colunas),minmax(0,1fr))]"
        style={{ "--colunas": colunas.length } as CSSProperties}
      >
        {colunas.map((etapa) => {
          const cartoes = porColuna(etapa.id);
          const soma = cartoes.reduce(
            (s, n) => s + Number(n.valor_estimado ?? 0),
            0
          );

          return (
            <section
              key={etapa.id}
              className={`min-w-0 rounded-lg bg-papel-alt flex flex-col ${
                alvo === etapa.id ? "ring-2 ring-vinho" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setAlvo(etapa.id);
              }}
              onDragLeave={() => setAlvo((a) => (a === etapa.id ? null : a))}
              onDrop={() => soltar(etapa.id, null)}
            >
              <header
                className="px-2.5 py-2 border-b-2 rounded-t-lg bg-superficie"
                style={{ borderColor: etapa.cor }}
              >
                <div className="flex items-start justify-between gap-1">
                  {/*
                    Com dez colunas a faixa fica em ~135px e um nome de uma
                    palavra só ("Documentação") não cabe inteiro. `hyphens`
                    parte na sílaba — o documento é pt-BR, então o navegador
                    sabe onde — em vez de cortar no meio da letra.
                  */}
                  <h2 className="text-[13px] font-semibold leading-tight break-words hyphens-auto min-w-0">
                    {etapa.nome}
                    {!etapa.ativa && (
                      <span className="selo selo-neutro ml-1.5">arquivada</span>
                    )}
                  </h2>
                  <button
                    className="text-cinza hover:text-vinho shrink-0"
                    title="Novo prospecto nesta etapa"
                    onClick={() => setCriandoEm(etapa.id)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <p className="text-xs text-cinza mt-0.5">
                  {cartoes.length}
                  {soma > 0 && ` · ${moedaCurta(soma)}`}
                </p>
              </header>

              <div className="p-1.5 flex flex-col gap-1.5 min-h-[110px]">
                {cartoes.map((n) => (
                  <Cartao
                    key={n.id}
                    negociacao={n}
                    autor={autores[n.criado_por ?? ""]}
                    mostrarAutor={ehAdmin}
                    arrastando={arrastando === n.id}
                    aoArrastar={() => setArrastando(n.id)}
                    aoSoltarAntes={() => soltar(etapa.id, n)}
                    aoAbrir={() => setEditando(n)}
                  />
                ))}
                {cartoes.length === 0 && (
                  <p className="text-xs text-cinza px-1 py-3 leading-snug">
                    Arraste um cartão para cá.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {(editando || criandoEm) && (
        <PainelNegociacao
          negociacao={editando}
          etapaInicial={criandoEm ?? editando?.etapa_id ?? ""}
          etapas={colunas}
          clientes={clientes}
          empreendimentos={empreendimentos}
          lotes={lotes}
          propostas={propostas}
          pendente={pendente}
          agir={agir}
          aoFechar={() => {
            setEditando(null);
            setCriandoEm(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------- o cartão */

function Cartao({
  negociacao: n,
  autor,
  mostrarAutor,
  arrastando,
  aoArrastar,
  aoSoltarAntes,
  aoAbrir,
}: {
  negociacao: NegociacaoNoQuadro;
  autor: string | undefined;
  mostrarAutor: boolean;
  arrastando: boolean;
  aoArrastar: () => void;
  aoSoltarAntes: () => void;
  aoAbrir: () => void;
}) {
  const atrasado =
    n.proximo_contato !== null && n.proximo_contato < hojeISO() && !n.fechada_em;

  return (
    <article
      draggable
      onDragStart={aoArrastar}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.stopPropagation();
        aoSoltarAntes();
      }}
      onClick={aoAbrir}
      className={`cartao p-2.5 cursor-pointer hover:border-vinho break-words ${
        arrastando ? "opacity-40" : ""
      }`}
    >
      <p className="text-sm font-semibold leading-snug">{nomeDoCartao(n)}</p>

      {(n.empreendimento || n.lote) && (
        <p className="text-xs text-cinza mt-1 leading-snug">
          {n.empreendimento?.nome}
          {n.lote && ` · ${n.lote.quadra}-${n.lote.numero}`}
        </p>
      )}

      {n.valor_estimado !== null && (
        <p className="text-sm tabular mt-1.5 text-vinho font-semibold">
          {moedaCurta(Number(n.valor_estimado))}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-xs text-cinza">
        {n.proximo_contato && (
          <span
            className={`flex items-center gap-1 ${atrasado ? "text-vermelho font-semibold" : ""}`}
          >
            <CalendarClock size={12} /> {dataBR(n.proximo_contato)}
          </span>
        )}
        {(n.telefone || n.cliente?.telefone) && (
          <span className="flex items-center gap-1">
            <Phone size={12} /> {n.telefone ?? n.cliente?.telefone}
          </span>
        )}
        {n.proposta && (
          <Link
            href={`/propostas/${n.proposta.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-vinho font-semibold"
          >
            <FileText size={12} /> {n.proposta.codigo}
          </Link>
        )}
        {n.contrato && (
          <Link
            href={`/contratos/${n.contrato.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-verde font-semibold"
          >
            <Check size={12} /> {n.contrato.codigo}
          </Link>
        )}
        {mostrarAutor && autor && <span>{autor}</span>}
      </div>
    </article>
  );
}

/* ---------------------------------------------------------- o painel */

function PainelNegociacao({
  negociacao,
  etapaInicial,
  etapas,
  clientes,
  empreendimentos,
  lotes,
  propostas,
  pendente,
  agir,
  aoFechar,
}: {
  negociacao: NegociacaoNoQuadro | null;
  etapaInicial: string;
  etapas: FunilEtapa[];
  clientes: Cliente[];
  empreendimentos: Empreendimento[];
  lotes: Lote[];
  propostas: PropostaResumo[];
  pendente: boolean;
  agir: (fn: () => Promise<unknown>) => void;
  aoFechar: () => void;
}) {
  const [dados, setDados] = useState<DadosNegociacao>({
    etapa_id: negociacao?.etapa_id ?? etapaInicial,
    cliente_id: negociacao?.cliente_id ?? null,
    titulo: negociacao?.titulo ?? null,
    telefone: negociacao?.telefone ?? null,
    empreendimento_id: negociacao?.empreendimento_id ?? null,
    lote_id: negociacao?.lote_id ?? null,
    proposta_id: negociacao?.proposta_id ?? null,
    contrato_id: negociacao?.contrato_id ?? null,
    valor_estimado:
      negociacao?.valor_estimado !== null && negociacao?.valor_estimado !== undefined
        ? Number(negociacao.valor_estimado)
        : null,
    origem: negociacao?.origem ?? null,
    proximo_contato: negociacao?.proximo_contato ?? null,
    observacao: negociacao?.observacao ?? null,
  });

  const mudar = (patch: Partial<DadosNegociacao>) =>
    setDados((d) => ({ ...d, ...patch }));

  const lotesDoEmpreendimento = dados.empreendimento_id
    ? lotes.filter((l) => l.empreendimento_id === dados.empreendimento_id)
    : [];

  function salvar() {
    agir(async () => {
      if (negociacao) await atualizarNegociacao(negociacao.id, dados);
      else await criarNegociacao(dados);
      aoFechar();
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 flex justify-end"
      onClick={aoFechar}
    >
      <div
        className="bg-superficie w-full max-w-[520px] h-full overflow-y-auto p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              {negociacao ? negociacao.codigo : "Novo prospecto"}
            </p>
            <h2 className="serif text-2xl mt-1">
              {negociacao ? nomeDoCartao(negociacao) : "Quem entrou em contato?"}
            </h2>
          </div>
          <button className="btn btn-fantasma" onClick={aoFechar}>
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="rotulo">Etapa</label>
          <select
            className="campo"
            value={dados.etapa_id}
            onChange={(e) => mudar({ etapa_id: e.target.value })}
          >
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="rotulo">Cliente cadastrado</label>
          <select
            className="campo"
            value={dados.cliente_id ?? ""}
            onChange={(e) => mudar({ cliente_id: e.target.value || null })}
          >
            <option value="">— ainda não cadastrado —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.empresa ? ` · ${c.empresa}` : ""}
              </option>
            ))}
          </select>
        </div>

        {!dados.cliente_id && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="rotulo">Nome do prospecto</label>
              <input
                className="campo"
                value={dados.titulo ?? ""}
                onChange={(e) => mudar({ titulo: e.target.value })}
                placeholder="Quem ligou"
              />
            </div>
            <div>
              <label className="rotulo">Telefone</label>
              <input
                className="campo"
                value={dados.telefone ?? ""}
                onChange={(e) => mudar({ telefone: e.target.value })}
              />
            </div>
          </div>
        )}

        {negociacao && !dados.cliente_id && negociacao.titulo && (
          <button
            className="btn btn-secundario self-start"
            disabled={pendente}
            onClick={() =>
              agir(async () => {
                await promoverACliente(negociacao.id);
                aoFechar();
              })
            }
          >
            <UserPlus size={15} /> Cadastrar como cliente
          </button>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="rotulo">Empreendimento</label>
            <select
              className="campo"
              value={dados.empreendimento_id ?? ""}
              onChange={(e) =>
                mudar({ empreendimento_id: e.target.value || null, lote_id: null })
              }
            >
              <option value="">— indefinido —</option>
              {empreendimentos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo">Lote de interesse</label>
            <select
              className="campo"
              value={dados.lote_id ?? ""}
              onChange={(e) => mudar({ lote_id: e.target.value || null })}
              disabled={!dados.empreendimento_id}
            >
              <option value="">— indefinido —</option>
              {lotesDoEmpreendimento.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.quadra}-{l.numero}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="rotulo">Valor estimado</label>
            <CampoNumero
              valor={dados.valor_estimado}
              aoMudar={(v) => mudar({ valor_estimado: v })}
              prefixo="R$"
            />
          </div>
          <div>
            <label className="rotulo">Próximo contato</label>
            <input
              type="date"
              className="campo"
              value={dados.proximo_contato ?? ""}
              onChange={(e) => mudar({ proximo_contato: e.target.value || null })}
            />
          </div>
        </div>

        <div>
          <label className="rotulo">Origem</label>
          <input
            className="campo"
            value={dados.origem ?? ""}
            onChange={(e) => mudar({ origem: e.target.value })}
            placeholder="Indicação, placa no lote, Instagram…"
          />
        </div>

        <div>
          <label className="rotulo">Proposta vinculada</label>
          <select
            className="campo"
            value={dados.proposta_id ?? ""}
            onChange={(e) => mudar({ proposta_id: e.target.value || null })}
          >
            <option value="">— nenhuma —</option>
            {propostas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} · {p.clientes?.nome ?? p.titulo ?? "sem cliente"}
              </option>
            ))}
          </select>
          <p className="text-xs text-cinza mt-1">
            A proposta é montada em Propostas; aqui só se amarra a ela, para o
            cartão levar ao documento.
          </p>
        </div>

        <div>
          <label className="rotulo">Observação</label>
          <textarea
            className="campo min-h-[90px]"
            value={dados.observacao ?? ""}
            onChange={(e) => mudar({ observacao: e.target.value })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
          <button className="btn btn-primario" disabled={pendente} onClick={salvar}>
            <Check size={15} /> Salvar
          </button>
          <button className="btn btn-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          {negociacao && (
            <button
              className="btn btn-fantasma text-vermelho ml-auto"
              disabled={pendente}
              onClick={() =>
                agir(async () => {
                  await apagarNegociacao(negociacao.id);
                  aoFechar();
                })
              }
            >
              <Trash2 size={15} /> Apagar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
