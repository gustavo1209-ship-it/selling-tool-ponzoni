import Link from "next/link";
import { Plus } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import PropostasTabela, { type PropostaLinha } from "@/components/PropostasTabela";
import { createClient } from "@/lib/supabase/server";
import { mapaDePerfis, nomeCurto, perfilAtual } from "@/lib/supabase/perfil";
import { compararLote } from "@/lib/ordenacao";

export const dynamic = "force-dynamic";

interface Linha {
  id: string;
  codigo: string;
  titulo: string | null;
  status: string;
  criado_em: string;
  criado_por: string | null;
  resultado: {
    valorTabela?: number;
    valorNegociado?: number;
    totalVP?: number;
    totalNominal?: number;
    descontoEfetivoPct?: number;
    prazoMeses?: number;
  } | null;
  clientes: { nome: string } | null;
  empreendimentos: { nome: string } | null;
  proposta_lotes: { quadra: string; numero: string }[];
  proposta_cenarios: { id: string }[];
}

export default async function PropostasPage() {
  const supabase = await createClient();
  const [{ data }, autores, perfil] = await Promise.all([
    supabase
      .from("propostas")
      .select(
        "id, codigo, titulo, status, criado_em, criado_por, resultado, clientes(nome), empreendimentos(nome), proposta_lotes(quadra, numero), proposta_cenarios(id)"
      )
      .order("criado_em", { ascending: false }),
    mapaDePerfis(),
    perfilAtual(),
  ]);

  const propostas = (data ?? []) as unknown as Linha[];
  // a RLS já filtra: corretor recebe só as próprias
  const ehAdmin = perfil?.ehAdmin ?? false;

  const linhas: PropostaLinha[] = propostas.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    clienteNome: p.clientes?.nome ?? p.titulo ?? "—",
    lotesTexto: p.proposta_lotes.length
      ? [...p.proposta_lotes]
          .sort(compararLote)
          .map((l) => `${l.quadra}-${l.numero}`)
          .join(", ")
      : "—",
    valorTabela: p.resultado?.valorTabela ?? 0,
    valorNegociado: p.resultado?.valorNegociado ?? 0,
    descontoEfetivoPct: p.resultado?.descontoEfetivoPct ?? 0,
    totalVP: p.resultado?.totalVP ?? 0,
    prazoMeses: p.resultado?.prazoMeses ?? 0,
    nOpcoes: p.proposta_cenarios.length,
    status: p.status,
    autorNome: nomeCurto(autores.get(p.criado_por ?? "")),
    criadoEm: p.criado_em,
  }));

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1400px] mx-auto px-5 py-8 flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Comercial</p>
            <h1 className="serif text-3xl mt-1">Propostas</h1>
          </div>
          <Link href="/propostas/nova" className="btn btn-primario">
            <Plus size={16} /> Nova proposta
          </Link>
        </div>

        <PropostasTabela propostas={linhas} ehAdmin={ehAdmin} />
      </main>
    </>
  );
}
