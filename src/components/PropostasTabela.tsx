"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { apagarPropostas } from "@/app/propostas/acoes";
import { mensagemDeFalha } from "@/lib/erros";
import { SeloProposta } from "@/components/SeloStatus";
import { dataBR, moeda, pct } from "@/lib/formato";

export interface PropostaLinha {
  id: string;
  codigo: string;
  clienteNome: string;
  lotesTexto: string;
  valorTabela: number;
  valorNegociado: number;
  descontoEfetivoPct: number;
  totalVP: number;
  prazoMeses: number;
  nOpcoes: number;
  status: string;
  autorNome: string;
  criadoEm: string;
}

export default function PropostasTabela({
  propostas,
  ehAdmin,
}: {
  propostas: PropostaLinha[];
  ehAdmin: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  function alternar(id: string) {
    setSelecionadas((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function apagarSelecionadas() {
    const plural = selecionadas.length > 1;
    if (
      !confirm(
        `Apagar ${selecionadas.length} proposta${plural ? "s" : ""}? Não dá para desfazer.`
      )
    ) {
      return;
    }
    setErro(null);
    iniciar(async () => {
      try {
        await apagarPropostas(selecionadas);
        setSelecionadas([]);
        router.refresh();
      } catch (e) {
        setErro(mensagemDeFalha(e));
      }
    });
  }

  return (
    <section className="cartao overflow-x-auto">
      {erro && (
        <p className="text-sm bg-vermelho-fraco text-vermelho px-4 py-2.5">{erro}</p>
      )}

      {ehAdmin && selecionadas.length > 0 && (
        <div className="border-b border-linha bg-dourado-fraco px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold">
            {selecionadas.length} proposta(s) marcada(s)
          </p>
          <button
            className="btn btn-secundario text-vermelho"
            onClick={apagarSelecionadas}
            disabled={pendente}
          >
            <Trash2 size={15} /> Apagar selecionadas
          </button>
          <button className="btn btn-fantasma" onClick={() => setSelecionadas([])}>
            Limpar seleção
          </button>
        </div>
      )}

      <table className="tabela">
        <thead>
          <tr>
            {ehAdmin && (
              <th className="w-8">
                <input
                  type="checkbox"
                  title="Marcar todas"
                  checked={
                    selecionadas.length > 0 && selecionadas.length === propostas.length
                  }
                  onChange={(e) =>
                    setSelecionadas(e.target.checked ? propostas.map((p) => p.id) : [])
                  }
                />
              </th>
            )}
            <th>Código</th>
            <th>Cliente</th>
            <th>Lotes</th>
            <th className="num">Tabela</th>
            <th className="num">Negociado</th>
            <th className="num">Desc.</th>
            <th className="num">Valor presente</th>
            <th className="num">Prazo</th>
            <th className="num">Opções</th>
            <th>Status</th>
            <th>Criada por</th>
            <th>Criada</th>
          </tr>
        </thead>
        <tbody>
          {propostas.map((p) => (
            <tr
              key={p.id}
              className={`hover:bg-papel-alt ${pendente && selecionadas.includes(p.id) ? "opacity-60" : ""}`}
            >
              {ehAdmin && (
                <td>
                  <input
                    type="checkbox"
                    checked={selecionadas.includes(p.id)}
                    onChange={() => alternar(p.id)}
                  />
                </td>
              )}
              <td className="whitespace-nowrap">
                <Link href={`/propostas/${p.id}`} className="text-vinho font-semibold">
                  {p.codigo}
                </Link>
              </td>
              <td>{p.clienteNome}</td>
              <td className="text-cinza whitespace-nowrap">{p.lotesTexto}</td>
              <td className="num text-cinza">{moeda(p.valorTabela)}</td>
              <td className="num font-semibold">{moeda(p.valorNegociado)}</td>
              <td className="num">
                {p.descontoEfetivoPct ? `−${pct(p.descontoEfetivoPct, 1)}` : "—"}
              </td>
              <td className="num">{moeda(p.totalVP)}</td>
              <td className="num text-cinza">{p.prazoMeses ? `${p.prazoMeses}m` : "—"}</td>
              <td className="num text-cinza">{p.nOpcoes}</td>
              <td>
                <SeloProposta status={p.status} />
              </td>
              <td className="text-cinza whitespace-nowrap">{p.autorNome}</td>
              <td className="text-cinza whitespace-nowrap">{dataBR(p.criadoEm)}</td>
            </tr>
          ))}
          {propostas.length === 0 && (
            <tr>
              <td colSpan={ehAdmin ? 13 : 12} className="text-center text-cinza py-8">
                Nenhuma proposta ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
