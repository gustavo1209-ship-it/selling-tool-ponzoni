"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BlocoTemplate, CampanhaModo, Configuracoes } from "@/lib/db/tipos";
import { comoResultado, type ResultadoAcao } from "@/lib/resultadoAcao";

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
    .select("papel, organizacao_id")
    .eq("id", user.id)
    .maybeSingle();

  if (data?.papel !== "admin") {
    throw new Error("Só a administração pode fazer isso.");
  }
  return { supabase, userId: user.id, organizacaoId: data.organizacao_id as string };
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
export async function criarEmpreendimento(
  dados: DadosEmpreendimento
): Promise<ResultadoAcao<{ id: string; slug: string }>> {
  return comoResultado(async () => {
    const { supabase, organizacaoId } = await exigirAdmin();

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
      .insert({ ...normalizar(dados), nome, slug, organizacao_id: organizacaoId })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

    revalidatePath("/admin/empreendimentos");
    revalidatePath("/");
    return { id: data.id as string, slug: data.slug as string };
  });
}

export async function atualizarEmpreendimento(
  id: string,
  dados: DadosEmpreendimento
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
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
    return {};
  });
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
): Promise<ResultadoAcao<{ id: string }>> {
  return comoResultado(async () => {
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
  });
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
export async function criarCondicao(
  tabelaId: string,
  dados: DadosCondicao
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
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
    return {};
  });
}

export async function atualizarCondicao(
  id: string,
  dados: Omit<DadosCondicao, "template">
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
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
    return {};
  });
}

export async function apagarCondicao(id: string): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase } = await exigirAdmin();
    const { error } = await supabase.from("condicoes_pagamento").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/empreendimentos");
    revalidatePath("/espelho");
    return {};
  });
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
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase, organizacaoId } = await exigirAdmin();

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
          organizacao_id: organizacaoId,
        }))
      );
      if (error) throw new Error(error.message);
    }

    revalidatePath("/admin/corretores");
    return {};
  });
}

/**
 * Corrige o nome de exibição de um corretor. A conta nasce com o nome
 * digitado na hora de criar o usuário no painel do Supabase — errar ou
 * digitar um apelido ali não deveria exigir voltar lá para corrigir.
 */
export async function renomearCorretor(
  perfilId: string,
  nome: string
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase } = await exigirAdmin();

    const nomeLimpo = nome.trim();
    if (!nomeLimpo) throw new Error("O nome não pode ficar vazio.");

    const { error } = await supabase
      .from("perfis")
      .update({ nome: nomeLimpo })
      .eq("id", perfilId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/corretores");
    revalidatePath("/admin/desempenho");
    revalidatePath("/propostas");
    revalidatePath("/contratos");
    return {};
  });
}

/**
 * Promove ou rebaixa. Ninguém muda o próprio papel: um admin que se
 * rebaixasse por engano ficaria sem quem o promovesse de volta sem passar
 * pelo SQL do painel do Supabase.
 */
export async function definirPapel(
  perfilId: string,
  papel: "corretor" | "admin"
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
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
    return {};
  });
}

// --------------------------------------------------------- etapas do funil

export interface DadosEtapa {
  nome: string;
  cor: string;
  ordem: number;
  desfecho: "aberta" | "ganha" | "perdida";
  ativa: boolean;
}

export async function criarEtapa(dados: DadosEtapa): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase, organizacaoId } = await exigirAdmin();

    const nome = dados.nome.trim();
    if (!nome) throw new Error("A etapa precisa de um nome.");

    const { error } = await supabase
      .from("funil_etapas")
      .insert({ ...dados, nome, organizacao_id: organizacaoId });
    if (error) throw new Error(error.message);

    revalidatePath("/admin/funil");
    revalidatePath("/funil");
    return {};
  });
}

export async function atualizarEtapa(
  id: string,
  dados: DadosEtapa
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
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
    return {};
  });
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
export async function apagarEtapa(id: string): Promise<ResultadoAcao> {
  return comoResultado(async () => {
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
    return {};
  });
}

// -------------------------------------------------------------- campanhas

export interface DadosCampanha {
  empreendimento_id: string;
  nome: string;
  percentual_desconto: number;
  modo: CampanhaModo;
  inicio: string;
  fim: string;
  ativa: boolean;
}

export async function criarCampanha(dados: DadosCampanha): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase, userId, organizacaoId } = await exigirAdmin();

    const nome = dados.nome.trim();
    if (!nome) throw new Error("A campanha precisa de um nome.");
    if (dados.percentual_desconto <= 0) {
      throw new Error("O desconto da campanha precisa ser maior que zero.");
    }
    if (dados.fim < dados.inicio) {
      throw new Error("A data de fim não pode vir antes da data de início.");
    }

    const { error } = await supabase
      .from("campanhas")
      .insert({ ...dados, nome, criado_por: userId, organizacao_id: organizacaoId });
    if (error) throw new Error(error.message);

    revalidatePath("/admin/campanhas");
    return {};
  });
}

export async function atualizarCampanha(
  id: string,
  dados: DadosCampanha
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase } = await exigirAdmin();

    const nome = dados.nome.trim();
    if (!nome) throw new Error("A campanha precisa de um nome.");
    if (dados.percentual_desconto <= 0) {
      throw new Error("O desconto da campanha precisa ser maior que zero.");
    }
    if (dados.fim < dados.inicio) {
      throw new Error("A data de fim não pode vir antes da data de início.");
    }

    const { error } = await supabase
      .from("campanhas")
      .update({ ...dados, nome })
      .eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/campanhas");
    return {};
  });
}

/**
 * Apagar campanha não tem o mesmo perigo do funil: `campanha_id` em
 * `proposta_cenarios`/`contratos` é `on delete set null` — a propostas e
 * contratos já fechados não somem, só perdem o rótulo de qual campanha usaram.
 */
export async function apagarCampanha(id: string): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase } = await exigirAdmin();

    const { error } = await supabase.from("campanhas").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/campanhas");
    return {};
  });
}

// ---------------------------------------------------- configurações

export async function atualizarConfiguracoes(
  dados: Configuracoes
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase, organizacaoId } = await exigirAdmin();

    const { error } = await supabase
      .from("configuracoes")
      .update(dados)
      .eq("organizacao_id", organizacaoId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/configuracoes");
    revalidatePath("/contratos");
    return {};
  });
}

// ---------------------------------------------------------- convites
//
// Substitui "criar conta pelo painel do Supabase": o admin gera um link
// com token (o `default` da coluna, migration 42) e manda por fora (e-mail,
// WhatsApp) — não há provedor de e-mail transacional configurado ainda.
// Quem abre o link vê o convite via a RPC `info_convite` (aberta a `anon`
// de propósito) e entra na organização com `aceitar_convite`.

export interface DadosConvite {
  email: string;
  papel: "corretor" | "admin";
}

export async function convidarUsuario(
  dados: DadosConvite
): Promise<ResultadoAcao<{ token: string }>> {
  return comoResultado(async () => {
    const { supabase, userId, organizacaoId } = await exigirAdmin();

    const email = dados.email.trim().toLowerCase();
    if (!email) throw new Error("Informe o e-mail de quem você quer convidar.");

    const { data, error } = await supabase
      .from("convites")
      .insert({
        organizacao_id: organizacaoId,
        email,
        papel: dados.papel,
        criado_por: userId,
      })
      .select("token")
      .single();
    if (error) throw new Error(error.message);

    revalidatePath("/admin/corretores");
    return { token: data.token as string };
  });
}

// ---------------------------------------------------------- marca
//
// `organizacoes` só concede update de nome/logo_url/cor_primaria/
// cor_secundaria para authenticated (migration 42) — plano e status de
// assinatura não aparecem aqui porque a coluna nem está liberada para
// update direto; só o webhook do Stripe grava aquilo.

export async function atualizarMarca(formData: FormData): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase, organizacaoId } = await exigirAdmin();

    const nome = String(formData.get("nome") ?? "").trim();
    if (!nome) throw new Error("O nome da organização não pode ficar vazio.");
    const cor_primaria = String(formData.get("cor_primaria") ?? "#5B2166");
    const cor_secundaria = String(formData.get("cor_secundaria") ?? "#C4A550");

    const arquivo = formData.get("logo") as File | null;
    let logo_url: string | undefined;
    if (arquivo && arquivo.size > 0) {
      const ext = arquivo.name.split(".").pop() || "png";
      const caminho = `${organizacaoId}/logo.${ext}`;
      const { error: erroUpload } = await supabase.storage
        .from("marca")
        .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
      if (erroUpload) throw new Error(erroUpload.message);
      const { data: publica } = supabase.storage.from("marca").getPublicUrl(caminho);
      // sem isso o navegador serviria a imagem antiga do cache até expirar
      logo_url = `${publica.publicUrl}?v=${Date.now()}`;
    }

    const { error } = await supabase
      .from("organizacoes")
      .update({ nome, cor_primaria, cor_secundaria, ...(logo_url ? { logo_url } : {}) })
      .eq("id", organizacaoId);
    if (error) throw new Error(error.message);

    revalidatePath("/", "layout");
    revalidatePath("/admin/marca");
    return {};
  });
}
