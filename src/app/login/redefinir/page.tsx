"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function traduzir(mensagem: string): string {
  if (/Password should be/i.test(mensagem)) return "A senha precisa de ao menos 6 caracteres.";
  if (/Auth session missing|session.*missing/i.test(mensagem)) {
    return "Este link expirou ou já foi usado. Peça um novo link em \"Esqueci minha senha\".";
  }
  return mensagem;
}

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha !== confirmar) {
      setErro("As duas senhas precisam ser iguais.");
      return;
    }

    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setErro(traduzir(error.message));
      setCarregando(false);
      return;
    }

    setOk(true);
    setCarregando(false);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1500);
  }

  return (
    <main className="min-h-dvh grid place-items-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="cartao overflow-hidden">
          <div className="faixa-topo" />
          <div className="p-7">
            <p className="eyebrow">Industrial Ponzoni</p>
            <h1 className="serif text-3xl mt-1 mb-1">Nova senha</h1>
            <p className="text-sm text-cinza mb-6">
              Escolha a nova senha da sua conta.
            </p>

            {ok ? (
              <p className="text-sm text-verde bg-verde-fraco rounded-md px-3 py-2">
                Senha atualizada. Entrando…
              </p>
            ) : (
              <form onSubmit={enviar} className="flex flex-col gap-4">
                <div>
                  <label className="rotulo" htmlFor="senha">
                    Nova senha
                  </label>
                  <input
                    id="senha"
                    type="password"
                    className="campo"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="rotulo" htmlFor="confirmar">
                    Confirmar senha
                  </label>
                  <input
                    id="confirmar"
                    type="password"
                    className="campo"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>

                {erro && (
                  <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2">
                    {erro}
                  </p>
                )}

                <button className="btn btn-primario w-full" disabled={carregando}>
                  {carregando ? "Aguarde…" : "Trocar senha"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
