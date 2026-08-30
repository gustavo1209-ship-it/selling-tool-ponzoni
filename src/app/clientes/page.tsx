import { revalidatePath } from "next/cache";
import Link from "next/link";
import Cabecalho from "@/components/Cabecalho";
import { createClient } from "@/lib/supabase/server";
import { dataBR } from "@/lib/formato";

export const dynamic = "force-dynamic";

async function criarCliente(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return;

  const { error } = await supabase.from("clientes").insert({
    nome,
    empresa: String(formData.get("empresa") ?? "").trim() || null,
    documento: String(formData.get("documento") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    telefone: String(formData.get("telefone") ?? "").trim() || null,
    criado_por: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/clientes");
}

interface LinhaCliente {
  id: string;
  nome: string;
  empresa: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  criado_em: string;
  propostas: { id: string; codigo: string }[];
}

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clientes")
    .select("*, propostas(id, codigo)")
    .order("nome");

  const clientes = (data ?? []) as unknown as LinhaCliente[];

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1200px] mx-auto px-5 py-8 flex flex-col gap-6">
        <div>
          <p className="eyebrow">Comercial</p>
          <h1 className="serif text-3xl mt-1">Clientes</h1>
        </div>

        <form action={criarCliente} className="cartao p-4 grid gap-3 md:grid-cols-6 items-end">
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

        <section className="cartao overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Empresa</th>
                <th>Documento</th>
                <th>Contato</th>
                <th>Propostas</th>
                <th>Cadastrado</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.nome}</td>
                  <td className="text-cinza">{c.empresa ?? "—"}</td>
                  <td className="text-cinza">{c.documento ?? "—"}</td>
                  <td className="text-cinza">
                    {[c.telefone, c.email].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td>
                    {c.propostas.length === 0 ? (
                      <span className="text-cinza">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {c.propostas.map((p) => (
                          <Link
                            key={p.id}
                            href={`/propostas/${p.id}`}
                            className="selo selo-marca"
                          >
                            {p.codigo}
                          </Link>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="text-cinza">{dataBR(c.criado_em)}</td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-cinza py-8">
                    Nenhum cliente cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
