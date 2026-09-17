"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { apagarContratos } from "@/app/contratos/acoes";
import { mensagemDeFalha } from "@/lib/erros";
import { SeloContrato } from "@/components/SeloStatus";
import { dataBR, moeda, pct } from "@/lib/formato";

export interface ContratoLinha {
  id: string;
  codigo: string;
  compradorNome: string;
  lotesTexto: string;
  valorTotal: number;
  totalPago: number;
  saldoCorrigido: number;
  temEstimativa: boolean;
  parcelasPagas: number;
  parcelasTotal: number;
  proximaVencimento: string | null;
  proximaValor: number | null;
  totalVencido: number;
  temVencidas: boolean;
  autorNome: string;
  status: string;
  comissaoPercentual: number | null;
  comissaoValor: number | null;
}

export default function ContratosTabela({
  contratos,
  ehAdmin,
}: {
  contratos: ContratoLinha[];
  ehAdmin: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  function alternar(id: string) {
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function apagarSelecionados() {
    const plural = selecionados.length > 1;
    if (
      !confirm(
        `Apagar ${selecionados.length} contrato${plural ? "s" : ""}? Não dá para desfazer.`
      )
    ) {
      return;
    }
    setErro(null);
    iniciar(async () => {
      try {
        const resultado = await apagarContratos(selecionados);
        if (!resultado.ok) throw new Error(resultado.erro);
        setSelecionados([]);
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

      {ehAdmin && selecionados.length > 0 && (
        <div className="border-b border-linha bg-dourado-fraco px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold">
            {selecionados.length} contrato(s) marcado(s)
          </p>
          <button
            className="btn btn-secundario text-vermelho"
            onClick={apagarSelecionados}
            disabled={pendente}
          >
            <Trash2 size={15} /> Apagar selecionados
          </button>
          <button className="btn btn-fantasma" onClick={() => setSelecionados([])}>
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
                  title="Marcar todos"
                  checked={
                    selecionados.length > 0 && selecionados.length === contratos.length
                  }
                  onChange={(e) =>
                    setSelecionados(e.target.checked ? contratos.map((c) => c.id) : [])
                  }
                />
              </th>
            )}
            <th>Contrato</th>
            <th>Comprador</th>
            <th>Lotes</th>
            {ehAdmin && (
              <>
                <th className="num">Valor</th>
                <th className="num">Recebido</th>
                <th className="num">Saldo corrigido</th>
                <th className="num">Parcelas</th>
                <th>Próximo vencimento</th>
                <th className="num">Em atraso</th>
              </>
            )}
            <th className="num">Comissão</th>
            <th>Cadastrado por</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {contratos.map((c) => (
            <tr
              key={c.id}
              className={`hover:bg-papel-alt ${pendente && selecionados.includes(c.id) ? "opacity-60" : ""}`}
            >
              {ehAdmin && (
                <td>
                  <input
                    type="checkbox"
                    checked={selecionados.includes(c.id)}
                    onChange={() => alternar(c.id)}
                  />
                </td>
              )}
              <td className="whitespace-nowrap">
                <Link href={`/contratos/${c.id}`} className="text-vinho font-semibold">
                  {c.codigo}
                </Link>
              </td>
              <td>{c.compradorNome}</td>
              <td className="text-cinza whitespace-nowrap">{c.lotesTexto}</td>
              {ehAdmin && (
                <>
                  <td className="num text-cinza">{moeda(c.valorTotal)}</td>
                  <td className="num">{moeda(c.totalPago)}</td>
                  <td className="num font-semibold">
                    {moeda(c.saldoCorrigido)}
                    {c.temEstimativa && (
                      <span
                        className="text-cinza ml-1"
                        title="Parte das parcelas depende de índice ainda não lançado"
                      >
                        ~
                      </span>
                    )}
                  </td>
                  <td className="num text-cinza">
                    {c.parcelasPagas}/{c.parcelasTotal}
                  </td>
                  <td className="whitespace-nowrap">
                    {c.proximaVencimento ? (
                      <>
                        {dataBR(c.proximaVencimento)}{" "}
                        <span className="text-cinza">
                          · {moeda(c.proximaValor ?? 0)}
                        </span>
                      </>
                    ) : (
                      <span className="text-cinza">—</span>
                    )}
                  </td>
                  <td className="num">
                    {c.temVencidas ? (
                      <span className="text-vermelho font-semibold inline-flex items-center gap-1">
                        <AlertTriangle size={13} />
                        {moeda(c.totalVencido)}
                      </span>
                    ) : (
                      <span className="text-cinza">—</span>
                    )}
                  </td>
                </>
              )}
              <td className="num whitespace-nowrap">
                {c.comissaoValor != null ? (
                  <>
                    {moeda(c.comissaoValor)}
                    {c.comissaoPercentual != null && (
                      <span className="text-cinza"> · {pct(c.comissaoPercentual)}</span>
                    )}
                  </>
                ) : (
                  <span className="text-cinza">Pendente</span>
                )}
              </td>
              <td className="text-cinza whitespace-nowrap">{c.autorNome}</td>
              <td>
                <SeloContrato status={c.status} />
              </td>
            </tr>
          ))}
          {contratos.length === 0 && (
            <tr>
              <td colSpan={ehAdmin ? 13 : 6} className="text-center text-cinza py-8">
                Nenhum contrato ainda. Cadastre uma venda já fechada em{" "}
                <Link href="/contratos/novo" className="text-vinho font-semibold">
                  Novo contrato
                </Link>
                , ou gere um a partir de uma proposta aceita.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
