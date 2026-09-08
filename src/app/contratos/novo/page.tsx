import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import NovoContratoForm from "@/components/NovoContratoForm";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Empreendimento, IndexadorRef, Lote } from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function NovoContratoPage() {
  const supabase = await createClient();

  const [{ data: empreendimentos }, { data: lotes }, { data: clientes }, { data: indexadores }] =
    await Promise.all([
      supabase.from("empreendimentos").select("*").eq("ativo", true).order("nome"),
      // todos os status: um contrato antigo é justamente de um lote que já
      // está marcado como vendido no espelho
      supabase.from("lotes_visiveis").select("*"),
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("indexadores").select("*").order("ordem"),
    ]);

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1300px] mx-auto px-5 py-8 flex flex-col gap-6">
        <div>
          <Link
            href="/contratos"
            className="text-sm text-cinza inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft size={14} /> Contratos
          </Link>
          <p className="eyebrow">Financeiro</p>
          <h1 className="serif text-3xl mt-1">Novo contrato</h1>
          <p className="text-sm text-cinza mt-1 max-w-3xl">
            Para uma venda que já aconteceu. Se a venda saiu de uma proposta
            desta ferramenta, é melhor gerar o contrato de dentro dela — o
            cronograma vem pronto, sem redigitar.
          </p>
        </div>

        <NovoContratoForm
          empreendimentos={(empreendimentos ?? []) as Empreendimento[]}
          lotes={(lotes ?? []) as Lote[]}
          clientes={(clientes ?? []) as Cliente[]}
          indexadores={(indexadores ?? []) as IndexadorRef[]}
        />
      </main>
    </>
  );
}
