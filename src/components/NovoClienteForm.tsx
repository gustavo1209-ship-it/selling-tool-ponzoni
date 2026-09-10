"use client";

import { useState } from "react";
import { criarCliente } from "@/app/clientes/acoes";
import type { Empreendimento, FunilEtapa, Lote } from "@/lib/db/tipos";
import { ROTULO_STATUS_LOTE } from "@/lib/formato";

/**
 * Cadastro de cliente que já nasce dentro do funil de vendas.
 *
 * A etapa padrão é a primeira coluna ativa ("Novo lead" no funil de
 * fábrica) — o corretor troca no seletor quando o cadastro já chega mais
 * adiante na conversa. Empreendimento e lote são para o caso do terreno que
 * já foi vendido: a lista inclui lotes de qualquer status (não só livre e
 * reservado, como no "lote de interesse" do funil), porque é justamente o
 * já vendido que se quer registrar aqui.
 */
export default function NovoClienteForm({
  etapas,
  empreendimentos,
  lotes,
}: {
  etapas: FunilEtapa[];
  empreendimentos: Empreendimento[];
  lotes: Lote[];
}) {
  const [empreendimentoId, setEmpreendimentoId] = useState("");

  const lotesDoEmpreendimento = empreendimentoId
    ? lotes.filter((l) => l.empreendimento_id === empreendimentoId)
    : [];

  return (
    <form action={criarCliente} className="cartao p-4 flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-6 items-end">
        <div className="md:col-span-2">
          <label className="rotulo">Nome</label>
          <input name="nome" className="campo" required />
        </div>
        <div>
          <label className="rotulo">Empresa</label>
          <input name="empresa" className="campo" />
        </div>
        <div>
          <label className="rotulo">CPF / CNPJ</label>
          <input name="documento" className="campo" />
        </div>
        <div>
          <label className="rotulo">Telefone</label>
          <input name="telefone" className="campo" />
        </div>
        <button className="btn btn-primario">Adicionar</button>
      </div>

      {etapas.length > 0 && (
        <div className="grid gap-3 md:grid-cols-6 items-end border-t border-linha pt-4">
          <div className="md:col-span-2">
            <label className="rotulo">Etapa do funil</label>
            <select name="etapa_id" className="campo" defaultValue={etapas[0].id}>
              {etapas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="rotulo">Empreendimento</label>
            <select
              name="empreendimento_id"
              className="campo"
              value={empreendimentoId}
              onChange={(e) => setEmpreendimentoId(e.target.value)}
            >
              <option value="">— indefinido —</option>
              {empreendimentos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="rotulo">Lote</label>
            <select
              key={empreendimentoId}
              name="lote_id"
              className="campo"
              disabled={!empreendimentoId}
              defaultValue=""
            >
              <option value="">— indefinido —</option>
              {lotesDoEmpreendimento.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.quadra}-{l.numero} · {ROTULO_STATUS_LOTE[l.status] ?? l.status}
                </option>
              ))}
            </select>
          </div>
          <p className="md:col-span-6 text-xs text-cinza -mt-1">
            O cliente já entra no funil nesta etapa. Para dar entrada num
            terreno que já foi vendido, escolha a etapa de fechamento e o
            lote correspondente.
          </p>
        </div>
      )}
    </form>
  );
}
