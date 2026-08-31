"use client";

import { RefreshCw } from "lucide-react";

/**
 * Tela de erro do app.
 *
 * Existe sobretudo para um caso: o dev server morrer no meio de uma
 * navegação e o Next não conseguir renderizar a página. Sem isto o usuário vê
 * uma tela branca sem explicação. Ver "Por que o dev roda com webpack" no
 * CLAUDE.md.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const servidorCaiu =
    /unexpected response|Failed to fetch|Jest worker|fetch failed/i.test(
      error.message
    );

  return (
    <main className="min-h-dvh grid place-items-center px-5 py-12">
      <div className="w-full max-w-lg cartao overflow-hidden">
        <div className="faixa-topo" />
        <div className="p-7 flex flex-col gap-4">
          <div>
            <p className="eyebrow">Ferramenta de vendas</p>
            <h1 className="serif text-2xl mt-1">
              {servidorCaiu
                ? "O servidor não respondeu"
                : "Algo deu errado nesta tela"}
            </h1>
          </div>

          <p className="text-sm text-tinta-suave">
            {servidorCaiu ? (
              <>
                A página não chegou a carregar. Nada foi apagado — as propostas
                salvas continuam no banco. Tente de novo; se insistir, reinicie
                o servidor de desenvolvimento.
              </>
            ) : (
              <>
                Nada foi apagado. Tente de novo e, se o erro continuar, me
                mande a mensagem técnica abaixo.
              </>
            )}
          </p>

          <pre className="text-xs bg-papel-alt text-cinza rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>

          <div className="flex gap-2">
            <button className="btn btn-primario" onClick={reset}>
              <RefreshCw size={15} /> Tentar de novo
            </button>
            {/* <a> e não <Link>: se o router quebrou, o que salva é uma
                navegação de página inteira, não a do lado do cliente */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/propostas" className="btn btn-secundario">
              Ir para as propostas
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
