import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import ConfiguracoesForm from "@/components/ConfiguracoesForm";
import { perfilAtual } from "@/lib/supabase/perfil";
import { obterConfiguracoes } from "@/lib/configuracoes";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const perfil = await perfilAtual();
  if (!perfil?.ehAdmin) redirect("/");

  const configuracoes = await obterConfiguracoes();

  return (
    <>
      <Cabecalho />
      <main className="max-w-[700px] mx-auto px-5 py-8 flex flex-col gap-6">
        <div>
          <Link
            href="/admin"
            className="text-sm text-cinza inline-flex items-center gap-1 mb-4"
          >
            <ArrowLeft size={14} /> Admin
          </Link>
          <p className="eyebrow">Administração</p>
          <h1 className="serif text-3xl mt-1">Configurações</h1>
          <p className="text-sm text-cinza mt-1">
            Opções que valem para a casa inteira. Desligadas, a ferramenta volta
            a se comportar como antes dessas features.
          </p>
        </div>

        <ConfiguracoesForm configuracoes={configuracoes} />
      </main>
    </>
  );
}
