import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ferramenta de Vendas — Ponzoni",
  description:
    "Espelho de vendas e simulador de condições de pagamento dos empreendimentos Ponzoni.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
