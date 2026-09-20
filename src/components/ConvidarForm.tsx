"use client";

import { useState } from "react";
import { convidarUsuario } from "@/app/admin/acoes";

/** Gera o link de convite e deixa pronto pra copiar — sem envio de e-mail. */
export default function ConvidarForm() {
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<"corretor" | "admin">("corretor");
  const [link, setLink] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLink(null);
    setEnviando(true);
    const r = await convidarUsuario({ email, papel });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setLink(`${window.location.origin}/convite/${r.token}`);
    setEmail("");
  }

  return (
    <div className="cartao p-4">
      <h2 className="text-sm font-semibold mb-3">Convidar alguém para o time</h2>
      <form onSubmit={enviar} className="grid gap-3 md:grid-cols-4 items-end">
        <div className="md:col-span-2">
          <label className="rotulo">E-mail</label>
          <input
            type="email"
            className="campo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="rotulo">Papel</label>
          <select
            className="campo"
            value={papel}
            onChange={(e) => setPapel(e.target.value as "corretor" | "admin")}
          >
            <option value="corretor">Corretor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button className="btn btn-primario" disabled={enviando}>
          {enviando ? "Gerando…" : "Gerar convite"}
        </button>
      </form>

      {erro && (
        <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2 mt-3">
          {erro}
        </p>
      )}

      {link && (
        <div className="mt-3 flex items-center gap-2">
          <input className="campo flex-1" readOnly value={link} />
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => {
              navigator.clipboard.writeText(link);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            }}
          >
            {copiado ? "Copiado!" : "Copiar link"}
          </button>
        </div>
      )}
    </div>
  );
}
