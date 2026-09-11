import Cabecalho from "@/components/Cabecalho";
import IndicesPainel from "@/components/IndicesPainel";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/supabase/perfil";
import type { IndiceMensal } from "@/lib/contratos/tipos";
import type { IndexadorRef } from "@/lib/db/tipos";

export const dynamic = "force-dynamic";

export default async function IndicesPage() {
  // A série alimenta a correção de todo contrato da casa: quem lança um mês
  // errado muda o boleto de todo mundo, por isso só admin lança e edita. Mas
  // a leitura é aberta — um corretor sem acesso aqui veria o próprio
  // contrato com fator 1 em toda parcela, sem erro e sem aviso (migration 26).
  const perfil = await perfilAtual();
  const ehAdmin = perfil?.ehAdmin ?? false;

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
            {!ehAdmin && " Só a administração lança e corrige os números aqui."}
          </p>
        </div>

        <IndicesPainel
          indexadores={(indexadores ?? []) as IndexadorRef[]}
          series={(series ?? []) as IndiceMensal[]}
          ehAdmin={ehAdmin}
        />
      </main>
    </>
  );
}
