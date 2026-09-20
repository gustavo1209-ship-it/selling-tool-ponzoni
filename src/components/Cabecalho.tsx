import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_TEMA, lerTema } from "@/lib/tema";
import SairBotao from "./SairBotao";
import TemaBotao from "./TemaBotao";

/**
 * `soAdmin` esconde do corretor o que ele não administra. A RLS é quem de
 * fato barra o acesso (migration 26) — isto evita oferecer uma tela que
 * responderia vazia.
 *
 * Os rótulos são curtos de propósito: o menu do admin tem dez itens e
 * precisa caber sem rolagem. "Mapa" e "Espelho" já dizem o que são dentro da
 * própria ferramenta — o "de lotes" e o "de vendas" só ocupavam largura.
 */
const LINKS = [
  { href: "/", rotulo: "Início" },
  { href: "/mapa", rotulo: "Mapa" },
  { href: "/espelho", rotulo: "Espelho" },
  { href: "/funil", rotulo: "Funil" },
  { href: "/propostas", rotulo: "Propostas" },
  { href: "/contratos", rotulo: "Contratos" },
  { href: "/cobranca", rotulo: "A receber" },
  { href: "/clientes", rotulo: "Clientes" },
  { href: "/indices", rotulo: "Índices" },
  { href: "/admin", rotulo: "Admin", soAdmin: true },
];

export default async function Cabecalho() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tema = lerTema((await cookies()).get(COOKIE_TEMA)?.value);

  const { data: perfil } = user
    ? await supabase
        .from("perfis")
        .select("nome, papel, organizacao_id")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  // A ferramenta é multi-cliente: o topo carrega a marca da organização de
  // quem está logado, não de um empreendimento fixo — cada organização vê
  // o próprio nome e logo (organizacoes.nome/logo_url).
  const { data: marca } = perfil?.organizacao_id
    ? await supabase
        .from("organizacoes")
        .select("nome, logo_url")
        .eq("id", perfil.organizacao_id)
        .maybeSingle()
    : { data: null };

  return (
    <header className="bg-superficie border-b border-linha sticky top-0 z-30">
      <div className="faixa-topo" />
      {/*
        A barra cresce em altura em vez de rolar na horizontal: o menu do
        admin tem dez itens e, em tela estreita, rolagem lateral esconde
        justamente as abas do fim (Índices e Admin) sem dar sinal de que
        existem. `flex-wrap` no <nav> quebra entre os links — cada um
        continua inteiro, com `whitespace-nowrap`.

        Abaixo de `lg` o menu desce para uma linha só dele (`order-3 w-full`).
        Disputando largura com o logo e com os botões da direita, ele chegava
        a um link por linha no celular e o cabeçalho, que é fixo, comia meia
        tela. Com a faixa inteira cabem três ou quatro por linha.
      */}
      <div className="max-w-[1400px] mx-auto px-5 min-h-14 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {marca?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={marca.logo_url}
              alt={marca.nome}
              className="w-8 h-8 rounded object-cover"
            />
          )}
          <span className="flex items-baseline gap-2">
            <span className="serif text-lg leading-none text-vinho font-semibold">
              {marca?.nome ?? "Ferramenta de vendas"}
            </span>
            <span className="eyebrow hidden sm:inline">Vendas</span>
          </span>
        </Link>

        <nav className="order-3 w-full lg:order-none lg:w-auto lg:flex-1 flex flex-wrap items-center gap-x-0.5 gap-y-1">
          {LINKS.filter((l) => !l.soAdmin || perfil?.papel === "admin").map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-tinta-suave px-2.5 py-1.5 rounded-md hover:bg-papel-alt whitespace-nowrap"
            >
              {l.rotulo}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* o manual acompanha o papel de quem está logado */}
          <a
            href={
              perfil?.papel === "admin"
                ? "/manual-admin.html"
                : "/manual-corretor.html"
            }
            target="_blank"
            rel="noreferrer"
            className="text-sm text-tinta-suave px-2.5 py-1.5 rounded-md hover:bg-papel-alt whitespace-nowrap hidden sm:inline"
          >
            Manual
          </a>
          {/*
            O nome sai antes do selo quando a tela aperta: quem está logado é
            uma conferência ocasional, mas o selo de admin muda o que a tela
            oferece e vale a largura que ocupa.
          */}
          <span className="text-sm text-cinza hidden xl:inline">
            {perfil?.nome ?? user?.email}
          </span>
          {perfil?.papel === "admin" && (
            <span className="selo selo-marca">admin</span>
          )}
          <TemaBotao inicial={tema} />
          <SairBotao />
        </div>
      </div>
    </header>
  );
}
