"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { atualizarMarca } from "@/app/admin/acoes";

export default function MarcaForm({
  nome,
  logoUrl,
  corPrimaria,
  corSecundaria,
}: {
  nome: string;
  logoUrl: string | null;
  corPrimaria: string;
  corSecundaria: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setErro(null);
    setEnviando(true);
    const r = await atualizarMarca(new FormData(formRef.current));
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={enviar} className="cartao p-5 flex flex-col gap-4 max-w-lg">
      <div>
        <label className="rotulo">Nome da organização</label>
        <input name="nome" className="campo" defaultValue={nome} required />
      </div>

      <div>
        <label className="rotulo">Logo</label>
        <div className="flex items-center gap-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Logo atual" className="w-12 h-12 rounded object-cover" />
          )}
          <input
            type="file"
            name="logo"
            accept="image/*"
            className="campo"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) setPreview(URL.createObjectURL(arquivo));
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="rotulo">Cor primária</label>
          <input
            type="color"
            name="cor_primaria"
            className="campo h-10"
            defaultValue={corPrimaria}
          />
        </div>
        <div>
          <label className="rotulo">Cor secundária</label>
          <input
            type="color"
            name="cor_secundaria"
            className="campo h-10"
            defaultValue={corSecundaria}
          />
        </div>
      </div>

      {erro && (
        <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2">{erro}</p>
      )}

      <button className="btn btn-primario self-start" disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar marca"}
      </button>
    </form>
  );
}
