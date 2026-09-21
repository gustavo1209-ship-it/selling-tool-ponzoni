import { redirect } from "next/navigation";
import { perfilAtual } from "@/lib/supabase/perfil";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  if (perfil.organizacaoId) redirect("/");

  // Quem tem convite pendente vai direto aceitar ele, nunca vê o formulário
  // de "criar organização" — sem essa checagem, alguém que loga direto em
  // vez de abrir o link do convite (aconteceu na prática) cria uma
  // organização própria por engano em vez de entrar na do time que a
  // convidou.
  const supabase = await createClient();
  const { data: token } = await supabase.rpc("meu_convite_pendente");
  if (token) redirect(`/convite/${token}`);

  return (
    <main className="min-h-dvh grid place-items-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="cartao overflow-hidden">
          <div className="faixa-topo" />
          <div className="p-7">
            <p className="eyebrow">Quase lá</p>
            <h1 className="serif text-3xl mt-1 mb-1">Crie sua organização</h1>
            <p className="text-sm text-cinza mb-6">
              É o espaço só seu — seus empreendimentos, sua marca, seu time. Comece grátis
              por 30 dias, sem cartão de crédito.
            </p>
            <OnboardingForm />
          </div>
        </div>
      </div>
    </main>
  );
}
