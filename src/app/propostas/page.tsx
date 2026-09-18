import Link from "next/link";
import { Plus } from "lucide-react";
import Cabecalho from "@/components/Cabecalho";
import PropostasTabela, { type PropostaLinha } from "@/components/PropostasTabela";
import { createClient } from "@/lib/supabase/server";
import { mapaDePerfis, nomeCurto, perfilAtual } from "@/lib/supabase/perfil";
import { obterConfiguracoes } from "@/lib/configuracoes";
import { diasEntre, hojeISO } from "@/lib/contratos/mes";
import { compararLote } from "@/lib/ordenacao";

export const dynamic = "force-dynamic";

interface Linha {
  id: string;
  codigo: string;
  titulo: string | null;
  status: string;
  criado_em: string;
  criado_por: string | null;
  data_base: string;
  validade_dias: number;
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
  const [{ data }, autores, perfil, configuracoes] = await Promise.all([
    supabase
      .from("propostas")
      .select(
        "id, codigo, titulo, status, criado_em, criado_por, data_base, validade_dias, resultado, clientes(nome), empreendimentos(nome), proposta_lotes(quadra, numero), proposta_cenarios(id)"
      )
      .order("criado_em", { ascending: false }),
    mapaDePerfis(),
    perfilAtual(),
    obterConfiguracoes(),
  ]);

  const propostas = (data ?? []) as unknown as Linha[];
  // a RLS já filtra: corretor recebe só as próprias
  const ehAdmin = perfil?.ehAdmin ?? false;

  // proposta perto de vencer: data_base + validade_dias, só as em aberto
  const hoje = hojeISO();
  const vencendo = propostas.filter((p) => {
    if (p.status !== "enviada" && p.status !== "em_negociacao") return false;
    const dataVencimento = new Date(`${p.data_base}T12:00:00`);
    dataVencimento.setDate(dataVencimento.getDate() + p.validade_dias);
    const dias = diasEntre(hoje, dataVencimento.toISOString().slice(0, 10));
    return dias <= configuracoes.dias_aviso_proposta_vencendo;
  });

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

        {configuracoes.alertar_proposta_vencendo && vencendo.length > 0 && (
          <p className="text-sm text-ambar bg-ambar-fraco rounded-md px-3 py-2">
            {vencendo.length} proposta(s) {vencendo.length === 1 ? "vence" : "vencem"} em
            até {configuracoes.dias_aviso_proposta_vencendo} dias (ou já venceu e
            continua em aberto).
          </p>
        )}

        <PropostasTabela propostas={linhas} ehAdmin={ehAdmin} />
      </main>
    </>
  );
}
