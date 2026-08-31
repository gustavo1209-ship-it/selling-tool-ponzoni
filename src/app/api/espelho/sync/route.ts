import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerEspelho } from "@/lib/espelho";

/**
 * Puxa o espelho publicado no Google Sheets e reconcilia com a tabela
 * `lotes`. O Sheets é a fonte de verdade de status e comprador; o preço só
 * é sobrescrito quando a planilha traz um (lotes vendidos vêm sem valor).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { empreendimentoId } = (await request.json().catch(() => ({}))) as {
    empreendimentoId?: string;
  };
  if (!empreendimentoId) {
    return NextResponse.json({ erro: "Informe o empreendimento" }, { status: 400 });
  }

  const { data: emp } = await supabase
    .from("empreendimentos")
    .select("id, nome, espelho_csv_url")
    .eq("id", empreendimentoId)
    .single();

  if (!emp?.espelho_csv_url) {
    return NextResponse.json(
      { erro: "Este empreendimento não tem URL de espelho configurada." },
      { status: 400 }
    );
  }

  let csv: string;
  try {
    const resposta = await fetch(emp.espelho_csv_url, { cache: "no-store" });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    csv = await resposta.text();
  } catch (e) {
    return NextResponse.json(
      { erro: `Não consegui ler a planilha: ${(e as Error).message}` },
      { status: 502 }
    );
  }

  const linhas = lerEspelho(csv);
  if (linhas.length === 0) {
    return NextResponse.json(
      { erro: "A planilha veio vazia ou sem a coluna Quadra." },
      { status: 422 }
    );
  }

  const { data: atuais } = await supabase
    .from("lotes")
    .select("id, quadra, numero, area_m2, preco_tabela, status, comprador, tipo")
    .eq("empreendimento_id", empreendimentoId);

  const porChave = new Map((atuais ?? []).map((l) => [`${l.quadra}|${l.numero}`, l]));

  const alteracoes: string[] = [];
  const novos: Record<string, unknown>[] = [];

  for (const linha of linhas) {
    const chave = `${linha.quadra}|${linha.numero}`;
    const atual = porChave.get(chave);

    if (!atual) {
      novos.push({
        empreendimento_id: empreendimentoId,
        quadra: linha.quadra,
        numero: linha.numero,
        area_m2: linha.area_m2 ?? 0,
        preco_tabela: linha.preco_tabela,
        status: linha.status ?? "livre",
        comprador: linha.comprador,
        tipo: linha.tipo,
      });
      alteracoes.push(`${chave.replace("|", "-")}: novo lote`);
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (linha.status && linha.status !== atual.status) {
      patch.status = linha.status;
      alteracoes.push(`${linha.quadra}-${linha.numero}: ${atual.status} → ${linha.status}`);
    }
    if (linha.comprador !== atual.comprador) {
      patch.comprador = linha.comprador;
    }
    if (linha.preco_tabela !== null && Number(atual.preco_tabela) !== linha.preco_tabela) {
      patch.preco_tabela = linha.preco_tabela;
      alteracoes.push(`${linha.quadra}-${linha.numero}: preço atualizado`);
    }
    if (linha.area_m2 !== null && Number(atual.area_m2) !== linha.area_m2) {
      patch.area_m2 = linha.area_m2;
    }
    if (linha.tipo !== null && linha.tipo !== atual.tipo) {
      patch.tipo = linha.tipo;
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("lotes").update(patch).eq("id", atual.id);
      if (error) {
        return NextResponse.json({ erro: error.message }, { status: 500 });
      }
    }
  }

  if (novos.length > 0) {
    const { error } = await supabase.from("lotes").insert(novos);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({
    lidos: linhas.length,
    novos: novos.length,
    alteracoes,
  });
}
