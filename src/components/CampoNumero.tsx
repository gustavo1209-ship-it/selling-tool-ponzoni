"use client";

import { useState } from "react";
import { paraNumero } from "@/lib/formato";

/**
 * Input numérico que aceita a digitação brasileira ("1.234,56") sem brigar
 * com o usuário: guarda o texto cru enquanto o campo está focado e só
 * reformata ao sair.
 */
export default function CampoNumero({
  valor,
  aoMudar,
  sufixo,
  prefixo,
  casas = 2,
  className = "",
  disabled,
  placeholder,
}: {
  valor: number | null;
  aoMudar: (v: number | null) => void;
  sufixo?: string;
  prefixo?: string;
  casas?: number;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const formatar = (v: number | null) =>
    v === null || v === undefined
      ? ""
      : v.toLocaleString("pt-BR", {
          minimumFractionDigits: casas,
          maximumFractionDigits: casas,
        });

  const [texto, setTexto] = useState(() => formatar(valor));
  const [focado, setFocado] = useState(false);
  const [ultimoExterno, setUltimoExterno] = useState(valor);

  // Reformata durante a renderização quando o valor muda por fora (aplicar
  // uma condição, recalcular um bloco) — nunca enquanto o campo tem foco,
  // para não brigar com quem está digitando.
  if (!focado && valor !== ultimoExterno) {
    setUltimoExterno(valor);
    setTexto(formatar(valor));
  }

  return (
    <span className={`relative inline-flex items-center w-full ${className}`}>
      {prefixo && (
        <span className="absolute left-2.5 text-xs text-cinza pointer-events-none">
          {prefixo}
        </span>
      )}
      <input
        className={`campo text-right ${prefixo ? "pl-8" : ""} ${sufixo ? "pr-8" : ""}`}
        value={texto}
        disabled={disabled}
        placeholder={placeholder}
        inputMode="decimal"
        onFocus={() => setFocado(true)}
        onChange={(e) => {
          setTexto(e.target.value);
          const limpo = e.target.value.trim();
          aoMudar(limpo === "" ? null : paraNumero(limpo));
        }}
        onBlur={() => {
          setFocado(false);
          setTexto(formatar(texto.trim() === "" ? null : paraNumero(texto)));
        }}
      />
      {sufixo && (
        <span className="absolute right-2.5 text-xs text-cinza pointer-events-none">
          {sufixo}
        </span>
      )}
    </span>
  );
}
