"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { apagarCliente, atualizarCliente } from "@/app/clientes/acoes";
import type { Cliente } from "@/lib/db/tipos";
import { dataBR } from "@/lib/formato";

export interface ClienteComPropostas extends Cliente {
  propostas: { id: string; codigo: string }[];
}

export default function ClientesTabela({
  clientes,
}: {
  clientes: ClienteComPropostas[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<ClienteComPropostas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? clientes.filter((c) =>
        [c.nome, c.empresa, c.documento, c.email, c.telefone]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(termo))
      )
    : clientes;

  function abrir(c: ClienteComPropostas) {
    setEditando(c.id);
    setRascunho({ ...c });
    setErro(null);
  }

  function salvar() {
    if (!rascunho) return;
    setErro(null);
    iniciar(async () => {
      try {
        await atualizarCliente(rascunho.id, {
          nome: rascunho.nome,
          empresa: rascunho.empresa,
          documento: rascunho.documento,
          email: rascunho.email,
          telefone: rascunho.telefone,
          observacao: rascunho.observacao,
        });
        setEditando(null);
        setRascunho(null);
        router.refresh();
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  function remover(c: ClienteComPropostas) {
    if (!confirm(`Apagar o cliente ${c.nome}?`)) return;
    setErro(null);
    iniciar(async () => {
      try {
        await apagarCliente(c.id);
        router.refresh();
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  const campo = (
    chave: "nome" | "empresa" | "documento" | "email" | "telefone",
    placeholder?: string
  ) => (
    <input
      className="campo py-1 text-xs"
      value={rascunho?.[chave] ?? ""}
      placeholder={placeholder}
      onChange={(e) =>
        setRascunho((r) => (r ? { ...r, [chave]: e.target.value || null } : r))
      }
    />
  );

  return (
    <section className="cartao">
      <div className="cartao-titulo flex-wrap">
        <h2 className="serif text-lg">
          {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
        </h2>
        <input
          className="campo w-56"
          placeholder="Buscar por nome, empresa, documento…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {erro && (
        <p className="text-sm bg-vermelho-fraco text-vermelho px-4 py-2.5">{erro}</p>
      )}

      <div className="overflow-x-auto">
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Empresa</th>
              <th>CPF / CNPJ</th>
              <th>Telefone</th>
              <th>E-mail</th>
              <th>Propostas</th>
              <th>Cadastrado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((c) =>
              editando === c.id ? (
                <tr key={c.id} className="bg-vinho-fraco">
                  <td>{campo("nome")}</td>
                  <td>{campo("empresa")}</td>
                  <td>{campo("documento")}</td>
                  <td>{campo("telefone")}</td>
                  <td>{campo("email")}</td>
                  <td className="text-cinza">{c.propostas.length}</td>
                  <td className="text-cinza">{dataBR(c.criado_em)}</td>
                  <td>
                    <span className="flex items-center">
                      <button
                        className="btn btn-fantasma px-2 text-verde"
                        onClick={salvar}
                        disabled={pendente}
                        title="Salvar"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        className="btn btn-fantasma px-2"
                        onClick={() => {
                          setEditando(null);
                          setRascunho(null);
                          setErro(null);
                        }}
                        title="Cancelar"
                      >
                        <X size={15} />
                      </button>
                    </span>
                  </td>
                </tr>
              ) : (
                <tr key={c.id} className={pendente ? "opacity-60" : ""}>
                  <td className="font-semibold">{c.nome}</td>
                  <td className="text-cinza">{c.empresa ?? "—"}</td>
                  <td className="text-cinza">{c.documento ?? "—"}</td>
                  <td className="text-cinza">{c.telefone ?? "—"}</td>
                  <td className="text-cinza">{c.email ?? "—"}</td>
                  <td>
                    {c.propostas.length === 0 ? (
                      <span className="text-cinza">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {c.propostas.map((p) => (
                          <Link
                            key={p.id}
                            href={`/propostas/${p.id}`}
                            className="selo selo-marca"
                          >
                            {p.codigo}
                          </Link>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="text-cinza whitespace-nowrap">{dataBR(c.criado_em)}</td>
                  <td>
                    <span className="flex items-center">
                      <button
                        className="btn btn-fantasma px-2"
                        onClick={() => abrir(c)}
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn btn-fantasma px-2 text-vermelho"
                        onClick={() => remover(c)}
                        title="Apagar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </td>
                </tr>
              )
            )}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-cinza py-8">
                  {clientes.length === 0
                    ? "Nenhum cliente cadastrado."
                    : "Nenhum cliente com esse filtro."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
