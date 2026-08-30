import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SairBotao from "./SairBotao";

const LINKS = [
  { href: "/", rotulo: "Início" },
  { href: "/espelho", rotulo: "Espelho de vendas" },
  { href: "/propostas", rotulo: "Propostas" },
  { href: "/clientes", rotulo: "Clientes" },
];

export default async function Cabecalho() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = user
    ? await supabase.from("perfis").select("nome, papel").eq("id", user.id).single()
    : { data: null };

  return (
    <header className="bg-superficie border-b border-linha sticky top-0 z-30">
      <div className="faixa-topo" />
      <div className="max-w-[1400px] mx-auto px-5 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-baseline gap-2 shrink-0">
          <span className="serif text-lg leading-none text-vinho font-semibold">
            Ponzoni
          </span>
          <span className="eyebrow hidden sm:inline">Vendas</span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-tinta-suave px-3 py-1.5 rounded-md hover:bg-papel-alt whitespace-nowrap"
            >
              {l.rotulo}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <span className="text-sm text-cinza hidden md:inline">
            {perfil?.nome ?? user?.email}
          </span>
          <SairBotao />
        </div>
      </div>
    </header>
  );
}
