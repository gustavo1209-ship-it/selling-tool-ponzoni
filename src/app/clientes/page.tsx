import Cabecalho from "@/components/Cabecalho";
import ClientesTabela, {
  type ClienteComPropostas,
} from "@/components/ClientesTabela";
import { createClient } from "@/lib/supabase/server";
import { criarCliente } from "./acoes";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clientes")
    .select("*, propostas(id, codigo)")
    .order("nome");

  const clientes = (data ?? []) as unknown as ClienteComPropostas[];

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1300px] mx-auto px-5 py-8 flex flex-col gap-6">
        <div>
          <p className="eyebrow">Comercial</p>
          <h1 className="serif text-3xl mt-1">Clientes</h1>
          <p className="text-sm text-cinza mt-1">
            Clique no lápis para editar. Os dados também podem ser ajustados de
            dentro da proposta.
          </p>
        </div>

        <form
          action={criarCliente}
          className="cartao p-4 grid gap-3 md:grid-cols-6 items-end"
        >
          <div className="md:col-span-2">
            <label className="rotulo">Nome</label>
            <input name="nome" className="campo" required />
          </div>
          <div>
            <label className="rotulo">Empresa</label>
            <input name="empresa" className="campo" />
          </div>
          <div>
            <label className="rotulo">CPF / CNPJ</label>
            <input name="documento" className="campo" />
          </div>
          <div>
            <label className="rotulo">Telefone</label>
            <input name="telefone" className="campo" />
          </div>
          <button className="btn btn-primario">Adicionar</button>
        </form>

        <ClientesTabela clientes={clientes} />
      </main>
    </>
  );
}
