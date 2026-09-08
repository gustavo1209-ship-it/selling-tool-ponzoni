import Cabecalho from "@/components/Cabecalho";
import IndicesPainel from "@/components/IndicesPainel";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/supabase/perfil";
import type { IndiceMensal } from "@/lib/contratos/tipos";
import type { IndexadorRef } from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function IndicesPage() {
  // A série alimenta a correção de todo contrato da casa: quem lança um mês
  // errado muda o boleto de todo mundo. Só admin entra.
  const perfil = await perfilAtual();
  if (!perfil?.ehAdmin) {
    return (
      <>
        <Cabecalho />
        <main className="max-w-[1400px] mx-auto px-5 py-8">
          <p className="eyebrow">Financeiro</p>
          <h1 className="serif text-3xl mt-1">Índices mensais</h1>
          <p className="text-sm text-cinza mt-2 max-w-xl">
            Esta tela é da administração: os índices lançados aqui corrigem as
            parcelas de todos os contratos. Fale com o Gustavo ou o Gelson se
            algum número precisar ser revisto.
          </p>
        </main>
      </>
    );
  }

  const supabase = await createClient();

  const [{ data: indexadores }, { data: series }] = await Promise.all([
    supabase.from("indexadores").select("*").order("ordem"),
    supabase
      .from("indices_mensais")
      .select("*")
      .order("competencia", { ascending: false }),
  ]);

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1400px] mx-auto px-5 py-8 flex flex-col gap-6">
        <div>
          <p className="eyebrow">Financeiro</p>
          <h1 className="serif text-3xl mt-1">Índices mensais</h1>
          <p className="text-sm text-cinza mt-1 max-w-3xl">
            É daqui que sai a correção das parcelas de contrato. Cada mês
            lançado entra no acumulado que corrige o boleto — enquanto um mês
            estiver em branco, as parcelas que dependem dele saem marcadas como
            estimativa, calculadas pela taxa de projeção. O INCC-M costuma ser
            divulgado pela FGV no fim do próprio mês.
          </p>
        </div>

        <IndicesPainel
          indexadores={(indexadores ?? []) as IndexadorRef[]}
          series={(series ?? []) as IndiceMensal[]}
        />
      </main>
    </>
  );
}
