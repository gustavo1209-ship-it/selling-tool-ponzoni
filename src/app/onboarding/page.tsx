import { redirect } from "next/navigation";
import { perfilAtual } from "@/lib/supabase/perfil";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  if (perfil.organizacaoId) redirect("/");

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
