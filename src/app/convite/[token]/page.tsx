"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface InfoConvite {
  organizacao_nome: string;
  email: string;
  papel: string;
  valido: boolean;
}

/**
 * Quem abre este link pode estar em três estados: sem conta nenhuma (mostra
 * cadastro), logado sem organização (um clique aceita) ou logado numa
 * organização diferente (a RPC recusa — mostra o motivo em vez de tentar).
 *
 * `info_convite` é a única RPC aberta a `anon` de propósito (migration 43):
 * é o que permite mostrar "você foi convidado para X" antes do cadastro.
 */
export default function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = usePromise(params);
  const router = useRouter();
  const supabase = createClient();

  const [info, setInfo] = useState<InfoConvite | null | undefined>(undefined);
  const [logado, setLogado] = useState<boolean | null>(null);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase
      .rpc("info_convite", { p_token: token })
      .single()
      .then(({ data }) => setInfo((data as InfoConvite | null) ?? null));
    supabase.auth.getUser().then(({ data }) => setLogado(!!data.user));
  }, [supabase, token]);

  async function aceitar() {
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.rpc("aceitar_convite", { p_token: token });
    if (error) {
      setErro(traduzir(error.message));
      setEnviando(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function cadastrarEAceitar(e: React.FormEvent) {
    e.preventDefault();
    if (!info) return;
    setErro(null);
    setEnviando(true);
    const { error: erroCadastro } = await supabase.auth.signUp({
      email: info.email,
      password: senha,
      options: { data: { nome } },
    });
    if (erroCadastro) {
      setErro(traduzir(erroCadastro.message));
      setEnviando(false);
      return;
    }
    // Se a confirmação de e-mail estiver ligada, ainda não há sessão aqui —
    // aceitar_convite exige authenticated, então avisa em vez de tentar.
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setErro(
        "Conta criada. Confirme seu e-mail e volte a abrir este mesmo link para entrar na organização."
      );
      setEnviando(false);
      return;
    }
    await aceitar();
  }

  if (info === undefined || logado === null) {
    return (
      <main className="min-h-dvh grid place-items-center px-5 py-12">
        <p className="text-sm text-cinza">Carregando convite…</p>
      </main>
    );
  }

  if (!info || !info.valido) {
    return (
      <main className="min-h-dvh grid place-items-center px-5 py-12">
        <div className="w-full max-w-sm cartao overflow-hidden">
          <div className="faixa-topo" />
          <div className="p-7">
            <h1 className="serif text-2xl mb-2">Convite inválido</h1>
            <p className="text-sm text-cinza">
              Este link já foi usado, expirou, ou não existe. Peça um convite novo para quem
              administra a organização.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh grid place-items-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="cartao overflow-hidden">
          <div className="faixa-topo" />
          <div className="p-7">
            <p className="eyebrow">Convite</p>
            <h1 className="serif text-2xl mt-1 mb-1">{info.organizacao_nome}</h1>
            <p className="text-sm text-cinza mb-6">
              Você foi convidado para entrar como{" "}
              {info.papel === "admin" ? "administrador" : "corretor"}, com o e-mail{" "}
              <strong>{info.email}</strong>.
            </p>

            {erro && (
              <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2 mb-4">
                {erro}
              </p>
            )}

            {logado ? (
              <button
                className="btn btn-primario w-full"
                onClick={aceitar}
                disabled={enviando}
              >
                {enviando ? "Entrando…" : `Entrar em ${info.organizacao_nome}`}
              </button>
            ) : (
              <form onSubmit={cadastrarEAceitar} className="flex flex-col gap-4">
                <div>
                  <label className="rotulo" htmlFor="nome">
                    Seu nome
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
                <div>
                  <label className="rotulo" htmlFor="senha">
                    Crie uma senha
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
                <button className="btn btn-primario w-full" disabled={enviando}>
                  {enviando ? "Aguarde…" : "Criar conta e entrar"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function traduzir(mensagem: string): string {
  if (/Password should be/i.test(mensagem)) return "A senha precisa de ao menos 6 caracteres.";
  if (/User already registered/i.test(mensagem)) {
    return "Já existe conta com esse e-mail — entre em /login e volte a abrir este link.";
  }
  if (/já pertence a uma organiza/i.test(mensagem)) return mensagem;
  if (/Convite/i.test(mensagem)) return mensagem;
  return mensagem;
}
