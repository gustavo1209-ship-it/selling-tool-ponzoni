"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const proximo = params.get("proximo") || "/";

  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setCarregando(true);
    const supabase = createClient();

    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        setErro(traduzir(error.message));
        setCarregando(false);
        return;
      }
      router.push(proximo);
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    });
    if (error) {
      setErro(traduzir(error.message));
      setCarregando(false);
      return;
    }
    setAviso(
      "Conta criada. Se a confirmação por e-mail estiver ligada no projeto, confirme o endereço antes de entrar."
    );
    setModo("entrar");
    setCarregando(false);
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      {modo === "criar" && (
        <div>
          <label className="rotulo" htmlFor="nome">
            Nome
          </label>
          <input
            id="nome"
            className="campo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
      )}

      <div>
        <label className="rotulo" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          className="campo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha"
          type="password"
          className="campo"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          minLength={6}
          autoComplete={modo === "entrar" ? "current-password" : "new-password"}
        />
      </div>

      {erro && (
        <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2">
          {erro}
        </p>
      )}
      {aviso && (
        <p className="text-sm text-verde bg-verde-fraco rounded-md px-3 py-2">{aviso}</p>
      )}

      <button className="btn btn-primario w-full" disabled={carregando}>
        {carregando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
      </button>

      <button
        type="button"
        className="btn btn-fantasma w-full"
        onClick={() => {
          setModo(modo === "entrar" ? "criar" : "entrar");
          setErro(null);
          setAviso(null);
        }}
      >
        {modo === "entrar" ? "Criar uma conta" : "Já tenho conta"}
      </button>
    </form>
  );
}

function traduzir(mensagem: string): string {
  if (/Invalid login credentials/i.test(mensagem)) return "E-mail ou senha incorretos.";
  if (/Email not confirmed/i.test(mensagem)) return "E-mail ainda não confirmado.";
  if (/User already registered/i.test(mensagem)) return "Já existe conta com esse e-mail.";
  if (/Password should be/i.test(mensagem)) return "A senha precisa de ao menos 6 caracteres.";
  // as duas abaixo são configuração do projeto, não erro de quem está entrando
  if (/Email logins are disabled/i.test(mensagem)) {
    return (
      "O login por e-mail está desligado no Supabase. Ligue em " +
      "Authentication → Sign In / Providers → Email."
    );
  }
  if (/Signups not allowed|signup is disabled/i.test(mensagem)) {
    return (
      "O cadastro está fechado. Peça a um admin para criar sua conta pelo " +
      "painel do Supabase."
    );
  }
  return mensagem;
}

export default function LoginPage() {
  return (
    <main className="min-h-dvh grid place-items-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="cartao overflow-hidden">
          <div className="faixa-topo" />
          <div className="p-7">
            <p className="eyebrow">Industrial Ponzoni</p>
            <h1 className="serif text-3xl mt-1 mb-1">Ferramenta de vendas</h1>
            <p className="text-sm text-cinza mb-6">
              Espelho de lotes, simulação de condições e proposta pronta para o cliente.
            </p>
            <Suspense fallback={null}>
              <Formulario />
            </Suspense>
          </div>
        </div>
        <p className="text-xs text-cinza text-center mt-4">
          Uso interno. Os dados de venda vêm do espelho no Supabase.
        </p>
      </div>
    </main>
  );
}
