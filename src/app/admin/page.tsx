import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Building2,
  KanbanSquare,
  Percent,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/supabase/perfil";
import { hojeISO } from "@/lib/contratos/mes";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const perfil = await perfilAtual();
  if (!perfil?.ehAdmin) redirect("/");

  const supabase = await createClient();
  const hoje = hojeISO();
  const [{ count: empreendimentos }, { count: pessoas }, { count: etapas }, { count: campanhas }] =
    await Promise.all([
      supabase.from("empreendimentos").select("id", { count: "exact", head: true }),
      supabase.from("perfis").select("id", { count: "exact", head: true }),
      supabase
        .from("funil_etapas")
        .select("id", { count: "exact", head: true })
        .eq("ativa", true),
      supabase
        .from("campanhas")
        .select("id", { count: "exact", head: true })
        .eq("ativa", true)
        .lte("inicio", hoje)
        .gte("fim", hoje),
    ]);

  const telas = [
    {
      href: "/admin/empreendimentos",
      icone: Building2,
      titulo: "Empreendimentos",
      texto:
        "Cadastrar loteamento novo, apontar o espelho do Google Sheets, montar a tabela de preço e as condições de pagamento.",
      rodape: `${empreendimentos ?? 0} cadastrado(s)`,
    },
    {
      href: "/admin/corretores",
      icone: Users,
      titulo: "Corretores",
      texto:
        "Quem é admin, e quais empreendimentos cada corretor enxerga. Por padrão todos veem todos.",
      rodape: `${pessoas ?? 0} cadastrado(s)`,
    },
    {
      href: "/admin/funil",
      icone: KanbanSquare,
      titulo: "Etapas do funil",
      texto:
        "As colunas do quadro de negociações: nome, cor, ordem e o que cada uma significa para o negócio.",
      rodape: `${etapas ?? 0} cadastrado(s)`,
    },
    {
      href: "/admin/desempenho",
      icone: Trophy,
      titulo: "Desempenho da equipe",
      texto:
        "Clientes cadastrados, propostas criadas, contratos firmados e negociações perdidas por corretor, numa janela de tempo escolhida.",
      rodape: "ver painel",
    },
    {
      href: "/admin/campanhas",
      icone: Percent,
      titulo: "Campanhas",
      texto:
        "Descontos promocionais por tempo determinado, por empreendimento. O corretor escolhe aplicar no Simulador enquanto estiverem vigentes.",
      rodape: `${campanhas ?? 0} vigente(s) agora`,
    },
    {
      href: "/admin/configuracoes",
      icone: Settings,
      titulo: "Configurações",
      texto:
        "O que o corretor vê do financeiro em Contratos, e se a ferramenta avisa sobre cliente duplicado entre corretores.",
      rodape: "ver opções",
    },
  ];

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1000px] mx-auto px-5 py-8 flex flex-col gap-6">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="serif text-3xl mt-1">Configuração da ferramenta</h1>
          <p className="text-sm text-cinza mt-1">
            O que muda para a casa inteira. Índices mensais ficam na aba própria.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {telas.map((t) => (
            <Link key={t.href} href={t.href} className="cartao p-5 flex flex-col gap-3 hover:border-vinho">
              <t.icone size={22} className="text-vinho" />
              <div>
                <h2 className="serif text-lg">{t.titulo}</h2>
                <p className="text-sm text-cinza mt-1">{t.texto}</p>
              </div>
              <p className="text-sm text-vinho font-semibold mt-auto flex items-center gap-1.5">
                {t.rodape} <ArrowRight size={14} />
              </p>
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}
