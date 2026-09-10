import type { Metadata } from "next";
import { cookies } from "next/headers";
import { COOKIE_TEMA, lerTema } from "@/lib/tema";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ferramenta de Vendas — Ponzoni",
  description:
    "Espelho de vendas e simulador de condições de pagamento dos empreendimentos Ponzoni.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // O tema sai do cookie aqui, e não do localStorage no cliente, para o HTML
  // já chegar com `data-tema` — senão toda página abriria clara e viraria
  // escura no primeiro frame de JavaScript.
  const tema = lerTema((await cookies()).get(COOKIE_TEMA)?.value);

  return (
    <html lang="pt-BR" data-tema={tema}>
      <body>{children}</body>
    </html>
  );
}
