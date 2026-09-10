"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BlocoTemplate } from "@/lib/db/tipos";

/**
 * As telas de administração.
 *
 * Tudo aqui já é barrado pela RLS — as policies de escrita de
 * `empreendimentos`, `tabelas_preco`, `condicoes_pagamento`, `perfis`,
 * `corretor_empreendimentos` e `funil_etapas` exigem `is_admin()`. A
 * checagem em `exigirAdmin()` existe para o corretor receber uma frase em
 * português em vez de "new row violates row-level security policy", e para
 * que um update que a policy simplesmente não alcança (zero linhas, sem
 * erro) não seja relatado como sucesso.
 */
async function exigirAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .maybeSingle();

  if (data?.papel !== "admin") {
    throw new Error("Só a administração pode fazer isso.");
  }
  return { supabase, userId: user.id };
}

const limpo = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

/** "Florescer Parque Residencial" → "florescer-parque-residencial". */
function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ------------------------------------------------------ empreendimentos

export interface DadosEmpreendimento {
  nome: string;
  subtitulo: string | null;
  cidade: string | null;
  uf: string | null;
  espelho_csv_url: string | null;
  mapa_url: string | null;
  mapa_publico_url: string | null;
  mapa_imagem_url: string | null;
  logo_url: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  ativo: boolean;
}

/**
 * O `slug` sai do nome e **não muda depois**: ele é o que vai na URL do
 * espelho (`/espelho?e=florescer`) e o que a migration usa para achar o
 * empreendimento. Renomear "Florescer" para "Florescer Parque" não pode
 * quebrar o link que alguém salvou.
 */
export async function criarEmpreendimento(dados: DadosEmpreendimento) {
  const { supabase } = await exigirAdmin();

  const nome = dados.nome.trim();
  if (!nome) throw new Error("O empreendimento precisa de um nome.");

  const slug = aSlug(nome);
  if (!slug) throw new Error("Não consegui derivar um endereço a partir desse nome.");

  const { data: existente } = await supabase
    .from("empreendimentos")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existente) {
    throw new Error(`Já existe um empreendimento com o endereço "${slug}".`);
  }

  const { data, error } = await supabase
    .from("empreendimentos")
    .insert({ ...normalizar(dados), nome, slug })
    .select("id, slug")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/admin/empreendimentos");
  revalidatePath("/");
  return { id: data.id as string, slug: data.slug as string };
}

export async function atualizarEmpreendimento(
  id: string,
  dados: DadosEmpreendimento
) {
  const { supabase } = await exigirAdmin();

  const nome = dados.nome.trim();
  if (!nome) throw new Error("O empreendimento precisa de um nome.");

  const { error } = await supabase
    .from("empreendimentos")
    .update({ ...normalizar(dados), nome })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/empreendimentos");
  revalidatePath("/espelho");
  revalidatePath("/mapa");
  revalidatePath("/");
  return { ok: true };
}

function normalizar(d: DadosEmpreendimento) {
  return {
    subtitulo: limpo(d.subtitulo),
    cidade: limpo(d.cidade),
    uf: limpo(d.uf)?.toUpperCase().slice(0, 2) ?? null,
    espelho_csv_url: limpo(d.espelho_csv_url),
    mapa_url: limpo(d.mapa_url),
    mapa_publico_url: limpo(d.mapa_publico_url),
    mapa_imagem_url: limpo(d.mapa_imagem_url),
    logo_url: limpo(d.logo_url),
    cor_primaria: d.cor_primaria,
    cor_secundaria: d.cor_secundaria,
    ativo: d.ativo,
  };
}

// -------------------------------------------------------- tabela de preço

export interface DadosTabela {
  referencia: string;
  condicao_base: string;
  vigente_desde: string;
  /** Taxas em fração: 0,005 = 0,5% ao mês. */
  incc_mensal: number;
  juros_vp_mensal: number;
}

/**
 * Cria ou atualiza a tabela vigente do empreendimento.
 *
 * Sem tabela e sem condição, o empreendimento existe mas não vende: a tela
 * de nova proposta não tem o que oferecer. É por isso que ela é passo do
 * cadastro e não de uma migration à parte.
 */
export async function salvarTabelaPreco(
  empreendimentoId: string,
  tabelaId: string | null,
  dados: DadosTabela
) {
  const { supabase } = await exigirAdmin();

  const referencia = dados.referencia.trim();
  if (!referencia) throw new Error("A tabela precisa de uma referência.");

  const linha = {
    empreendimento_id: empreendimentoId,
    referencia,
    condicao_base: dados.condicao_base.trim() || "À vista",
    vigente_desde: dados.vigente_desde,
    incc_mensal: dados.incc_mensal,
    juros_vp_mensal: dados.juros_vp_mensal,
    ativa: true,
  };

  const { data, error } = tabelaId
    ? await supabase
        .from("tabelas_preco")
        .update(linha)
        .eq("id", tabelaId)
        .select("id")
        .single()
    : await supabase.from("tabelas_preco").insert(linha).select("id").single();

  if (error) throw new Error(error.message);

  revalidatePath("/admin/empreendimentos");
  revalidatePath("/espelho");
  return { id: data.id as string };
}

// ----------------------------------------------------------- condições

export interface DadosCondicao {
  nome: string;
  descricao: string | null;
  /** Fração sobre o preço de tabela: 0,065 = 6,5% de desconto. */
  desconto_pct: number;
  ordem: number;
  ativa: boolean;
  template: BlocoTemplate[];
}

/**
 * Uma condição do espelho. `oficial = true` porque veio da tabela de preços
 * da casa — o que o time monta na proposta entra como favorita, com
 * `oficial = false` (migration 14).
 *
 * O último bloco do template tem de absorver o resíduo, senão o
 * arredondamento sobra ou falta no fim do fluxo. Ver "Três armadilhas da
 * estrutura de pagamento" no CLAUDE.md — o `MontarOpcao` já entrega assim.
 */
export async function criarCondicao(tabelaId: string, dados: DadosCondicao) {
  const { supabase } = await exigirAdmin();

  const nome = dados.nome.trim();
  if (!nome) throw new Error("A condição precisa de um nome.");
  if (dados.template.length === 0) {
    throw new Error("A condição precisa de pelo menos um bloco de pagamento.");
  }

  const { error } = await supabase.from("condicoes_pagamento").insert({
    tabela_preco_id: tabelaId,
    nome,
    descricao: limpo(dados.descricao),
    desconto_pct: dados.desconto_pct,
    ordem: dados.ordem,
    ativa: dados.ativa,
    oficial: true,
    template: dados.template,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/empreendimentos");
  revalidatePath("/espelho");
  return { ok: true };
}

export async function atualizarCondicao(
  id: string,
  dados: Omit<DadosCondicao, "template">
) {
  const { supabase } = await exigirAdmin();

  const nome = dados.nome.trim();
  if (!nome) throw new Error("A condição precisa de um nome.");

  const { error } = await supabase
    .from("condicoes_pagamento")
    .update({
      nome,
      descricao: limpo(dados.descricao),
      desconto_pct: dados.desconto_pct,
      ordem: dados.ordem,
      ativa: dados.ativa,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/empreendimentos");
  revalidatePath("/espelho");
  return { ok: true };
}

export async function apagarCondicao(id: string) {
  const { supabase } = await exigirAdmin();
  const { error } = await supabase.from("condicoes_pagamento").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/empreendimentos");
  revalidatePath("/espelho");
  return { ok: true };
}

// ---------------------------------------------------------- corretores

/**
 * Quem vê quais empreendimentos.
 *
 * `restrito = false` é o padrão e significa "vê todos" — a lista de marcados
 * fica gravada de qualquer forma, para que desligar e religar a trava não
 * apague a configuração de quem administra.
 */
export async function definirAcessoEmpreendimentos(
  perfilId: string,
  restrito: boolean,
  empreendimentoIds: string[]
) {
  const { supabase } = await exigirAdmin();

  const { error: erroPerfil } = await supabase
    .from("perfis")
    .update({ empreendimentos_restritos: restrito })
    .eq("id", perfilId);
  if (erroPerfil) throw new Error(erroPerfil.message);

  const { error: erroLimpeza } = await supabase
    .from("corretor_empreendimentos")
    .delete()
    .eq("perfil_id", perfilId);
  if (erroLimpeza) throw new Error(erroLimpeza.message);

  if (empreendimentoIds.length > 0) {
    const { error } = await supabase.from("corretor_empreendimentos").insert(
      empreendimentoIds.map((empreendimento_id) => ({
        perfil_id: perfilId,
        empreendimento_id,
      }))
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/corretores");
  return { ok: true };
}

/**
 * Promove ou rebaixa. Ninguém muda o próprio papel: um admin que se
 * rebaixasse por engano ficaria sem quem o promovesse de volta sem passar
 * pelo SQL do painel do Supabase.
 */
export async function definirPapel(perfilId: string, papel: "corretor" | "admin") {
  const { supabase, userId } = await exigirAdmin();

  if (perfilId === userId) {
    throw new Error("Você não pode mudar o próprio papel.");
  }

  const { error } = await supabase
    .from("perfis")
    .update({ papel })
    .eq("id", perfilId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/corretores");
  return { ok: true };
}

// --------------------------------------------------------- etapas do funil

export interface DadosEtapa {
  nome: string;
  cor: string;
  ordem: number;
  desfecho: "aberta" | "ganha" | "perdida";
  ativa: boolean;
}

export async function criarEtapa(dados: DadosEtapa) {
  const { supabase } = await exigirAdmin();

  const nome = dados.nome.trim();
  if (!nome) throw new Error("A etapa precisa de um nome.");

  const { error } = await supabase.from("funil_etapas").insert({ ...dados, nome });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/funil");
  revalidatePath("/funil");
  return { ok: true };
}

export async function atualizarEtapa(id: string, dados: DadosEtapa) {
  const { supabase } = await exigirAdmin();

  const nome = dados.nome.trim();
  if (!nome) throw new Error("A etapa precisa de um nome.");

  const { error } = await supabase
    .from("funil_etapas")
    .update({ ...dados, nome })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/funil");
  revalidatePath("/funil");
  return { ok: true };
}

/**
 * Apagar etapa é o caso perigoso do funil: a coluna some e os cartões dela
 * sumiriam junto. O banco impede (`on delete restrict`), mas a mensagem que
 * ele devolve é a de chave estrangeira. Aqui a conta é feita antes, para
 * dizer quantas negociações estão lá e sugerir arquivar em vez de apagar.
 *
 * A contagem passa pela RLS de quem está olhando: um admin vê tudo, então o
 * número é o real. Se um dia um não-admin chegar aqui, `exigirAdmin` já o
 * terá barrado.
 */
export async function apagarEtapa(id: string) {
  const { supabase } = await exigirAdmin();

  const { count } = await supabase
    .from("negociacoes")
    .select("id", { count: "exact", head: true })
    .eq("etapa_id", id);

  if (count && count > 0) {
    throw new Error(
      `Esta etapa tem ${count} negociação(ões). Mova os cartões para outra coluna, ou desmarque "ativa" para tirá-la do quadro sem perder o histórico.`
    );
  }

  const { error } = await supabase.from("funil_etapas").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/funil");
  revalidatePath("/funil");
  return { ok: true };
}
