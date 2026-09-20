"use client";

import { useActionState } from "react";
import { criarOrganizacao } from "./acoes";

export default function OnboardingForm() {
  const [estado, formAction, enviando] = useActionState(criarOrganizacao, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {estado && !estado.ok && (
        <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2">
          {estado.erro}
        </p>
      )}
      <div>
        <label className="rotulo" htmlFor="nome">
          Nome da sua empresa
        </label>
        <input
          id="nome"
          name="nome"
          className="campo"
          placeholder="Ex.: Ponzoni Empreendimentos"
          required
          autoFocus
        />
      </div>
      <button className="btn btn-primario w-full" disabled={enviando}>
        {enviando ? "Criando…" : "Começar meus 30 dias grátis"}
      </button>
    </form>
  );
}
