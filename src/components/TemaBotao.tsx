"use client";

import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  COOKIE_TEMA,
  ROTULO_TEMA,
  proximoTema,
  type Tema,
} from "@/lib/tema";

const ICONE = { sistema: Monitor, claro: Sun, escuro: Moon };

/**
 * Roda claro → escuro → automático, num clique.
 *
 * A troca é feita **no atributo do `<html>`, na hora** — não há server action
 * nem `router.refresh()`. O tema é uma preferência de quem olha, não um dado
 * da aplicação: esperar uma ida ao servidor para a tela mudar de cor seria
 * lentidão sem contrapartida.
 *
 * O cookie é gravado junto, só para a **próxima** visita já nascer pintada
 * (é ele que o layout lê no servidor). Um ano, `SameSite=Lax`, sem nada de
 * sensível dentro.
 */
export default function TemaBotao({ inicial }: { inicial: Tema }) {
  const [tema, setTema] = useState<Tema>(inicial);
  const Icone = ICONE[tema];

  function alternar() {
    const novo = proximoTema(tema);
    setTema(novo);
    document.documentElement.dataset.tema = novo;
    document.cookie = `${COOKIE_TEMA}=${novo};path=/;max-age=31536000;samesite=lax`;
  }

  return (
    <button
      onClick={alternar}
      className="text-tinta-suave p-1.5 rounded-md hover:bg-papel-alt shrink-0"
      title={`Tema: ${ROTULO_TEMA[tema].toLowerCase()}. Clique para ${ROTULO_TEMA[
        proximoTema(tema)
      ].toLowerCase()}.`}
      aria-label={`Tema ${ROTULO_TEMA[tema].toLowerCase()}. Trocar para ${ROTULO_TEMA[
        proximoTema(tema)
      ].toLowerCase()}.`}
    >
      <Icone size={17} />
    </button>
  );
}
