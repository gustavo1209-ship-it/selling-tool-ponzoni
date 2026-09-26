"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BlocoTemplate, CampanhaModo, Configuracoes } from "@/lib/db/tipos";
import { comoResultado, type ResultadoAcao } from "@/lib/resultadoAcao";
import { erroTamanhoArquivo } from "@/lib/uploads";

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
  logo_url: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  ativo: boolean;
  /** true = casa/apartamento único; false (padrão) = loteamento com espelho. */
  imovel_unico: boolean;
  /** true (padrão) = lotes.descricao sai na proposta e no contrato. */
  mostrar_descricao_documento: boolean;
  /** true (padrão) = mapa_localizacao_url sai na proposta e no contrato. */
  mostrar_localizacao_documento: boolean;
  /** Opcional — sai no cabeçalho da proposta e do contrato, junto do nome. */
  endereco: string | null;
  /** Opcional — sai no rodapé da proposta e do contrato. */
  site_url: string | null;
  /** Opcional — usuário ou link, sai no rodapé da proposta e do contrato. */
  instagram: string | null;
}

/**
 * Quadra/lote, área, área construída, preço e descrição de um
 * empreendimento `imovel_unico` — os únicos campos que fariam sentido
 * preencher pela planilha do Sheets num loteamento, aqui vêm direto na
 * tela. Quadra/lote nascem "ÚNICO"/"1" mas são editáveis — é o rótulo que
 * sai na proposta e no contrato, e "ÚNICO-1" não serve pra toda casa.
 */
export interface DadosLoteUnico {
  quadra: string;
  numero: string;
  area_m2: number;
  area_construida_m2: number | null;
  preco_tabela: number | null;
  descricao: string | null;
}

/**
 * O `slug` sai do nome e **não muda depois**: ele é o que vai na URL do
 * espelho (`/espelho?e=florescer`) e o que a migration usa para achar o
 * empreendimento. Renomear "Florescer" para "Florescer Parque" não pode
 * quebrar o link que alguém salvou.
 */
export async function criarEmpreendimento(
  dados: DadosEmpreendimento,
  loteUnico?: DadosLoteUnico
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

    // valida antes de criar o empreendimento — sem isso, um erro só no
    // lote (ex.: área zerada) deixava o empreendimento criado e órfão,
    // sem lote nenhum e sem jeito de arrumar pela tela.
    if (dados.imovel_unico && loteUnico && loteUnico.area_m2 <= 0) {
      throw new Error("Informe a área do terreno (maior que zero).");
    }

    const { data, error } = await supabase
      .from("empreendimentos")
      .insert({ ...normalizar(dados), nome, slug, organizacao_id: organizacaoId })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

    // imóvel único já nasce com o lote que ele é — sem isso a proposta não
    // teria o que vender até alguém passar por /espelho, que nem existe
    // pra esse caso.
    if (dados.imovel_unico && loteUnico) {
      const { error: erroLote } = await supabase.from("lotes").insert({
        empreendimento_id: data.id,
        quadra: loteUnico.quadra.trim() || "ÚNICO",
        numero: loteUnico.numero.trim() || "1",
        area_m2: loteUnico.area_m2,
        area_construida_m2: loteUnico.area_construida_m2,
        preco_tabela: loteUnico.preco_tabela,
        descricao: loteUnico.descricao,
        status: "livre",
      });
      if (erroLote) throw new Error(erroLote.message);
    }

    revalidatePath("/admin/empreendimentos");
    revalidatePath("/");
    return { id: data.id as string, slug: data.slug as string };
  });
}

/**
 * Edita o lote único de um empreendimento `imovel_unico`. Não existe
 * escolha de qual lote — por definição só tem um. Se por algum motivo o
 * lote não existir ainda (ex.: falhou na criação, antes da validação de
 * área acima existir), cria em vez de tentar um update que não acha nada
 * pra atualizar e "dá certo" sem gravar nada.
 */
export async function atualizarLoteUnico(
  empreendimentoId: string,
  dados: DadosLoteUnico
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase } = await exigirAdmin();

    const quadra = dados.quadra.trim();
    const numero = dados.numero.trim();
    if (!quadra || !numero) throw new Error("Quadra e lote não podem ficar vazios.");
    if (dados.area_m2 <= 0) throw new Error("Informe a área do terreno (maior que zero).");

    const linha = {
      quadra,
      numero,
      area_m2: dados.area_m2,
      area_construida_m2: dados.area_construida_m2,
      preco_tabela: dados.preco_tabela,
      descricao: dados.descricao,
    };

    const { data: existente } = await supabase
      .from("lotes")
      .select("id")
      .eq("empreendimento_id", empreendimentoId)
      .maybeSingle();

    const { error } = existente
      ? await supabase.from("lotes").update(linha).eq("id", existente.id)
      : await supabase
          .from("lotes")
          .insert({ ...linha, empreendimento_id: empreendimentoId, status: "livre" });
    if (error) throw new Error(error.message);

    revalidatePath("/admin/empreendimentos");
    revalidatePath("/espelho");
    return {};
  });
}

const MAX_FOTOS = 5;

/**
 * Galeria de fotos do empreendimento — até 5, cada uma podendo entrar na
 * lista de até 3 fotos da proposta e/ou do contrato
 * (empreendimentos.fotos_proposta_ids/fotos_contrato_ids). Sem escolha
 * nenhuma feita, a folha usa só a primeira por ordem — ver os selects nas
 * páginas de impressão.
 */
export async function adicionarFotoEmpreendimento(
  empreendimentoId: string,
  formData: FormData
): Promise<ResultadoAcao<{ id: string; url: string }>> {
  return comoResultado(async () => {
    const { supabase, organizacaoId } = await exigirAdmin();

    const arquivo = formData.get("foto") as File | null;
    if (!arquivo || arquivo.size === 0) throw new Error("Escolha um arquivo de imagem.");
    const erroTamanho = erroTamanhoArquivo(arquivo);
    if (erroTamanho) throw new Error(erroTamanho);

    const { count } = await supabase
      .from("empreendimento_fotos")
      .select("id", { count: "exact", head: true })
      .eq("empreendimento_id", empreendimentoId);
    if ((count ?? 0) >= MAX_FOTOS) {
      throw new Error(`Máximo de ${MAX_FOTOS} fotos por empreendimento. Apague uma antes.`);
    }

    const ext = arquivo.name.split(".").pop() || "jpg";
    const caminho = `${organizacaoId}/${empreendimentoId}/${randomUUID()}.${ext}`;
    const { error: erroUpload } = await supabase.storage
      .from("empreendimentos")
      .upload(caminho, arquivo, { contentType: arquivo.type });
    if (erroUpload) throw new Error(erroUpload.message);

    const { data: publica } = supabase.storage.from("empreendimentos").getPublicUrl(caminho);

    const { data, error } = await supabase
      .from("empreendimento_fotos")
      .insert({
        empreendimento_id: empreendimentoId,
        url: publica.publicUrl,
        ordem: count ?? 0,
      })
      .select("id, url")
      .single();
    if (error) throw new Error(error.message);

    // a primeira foto do empreendimento já entra como padrão dos dois
    // documentos — sem isso, quem sobe uma foto só continuaria sem ver
    // nada na proposta até escolher manualmente.
    if ((count ?? 0) === 0) {
      await supabase
        .from("empreendimentos")
        .update({ fotos_proposta_ids: [data.id], fotos_contrato_ids: [data.id] })
        .eq("id", empreendimentoId);
    }

    revalidatePath("/admin/empreendimentos");
    return { id: data.id as string, url: data.url as string };
  });
}

/** Extrai o caminho dentro do bucket a partir da URL pública, pra apagar o arquivo junto da linha. */
function caminhoNoBucket(url: string): string | null {
  const marcador = "/object/public/empreendimentos/";
  const i = url.indexOf(marcador);
  return i < 0 ? null : url.slice(i + marcador.length);
}

export async function apagarFotoEmpreendimento(fotoId: string): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase } = await exigirAdmin();

    const { data: foto } = await supabase
      .from("empreendimento_fotos")
      .select("url, empreendimento_id")
      .eq("id", fotoId)
      .maybeSingle();

    const { error } = await supabase.from("empreendimento_fotos").delete().eq("id", fotoId);
    if (error) throw new Error(error.message);

    // arrays não têm FK — sem isso, um id apagado ficaria apontado em
    // fotos_proposta_ids/fotos_contrato_ids e a folha tentaria mostrar uma
    // foto que não existe mais.
    if (foto?.empreendimento_id) {
      const { data: emp } = await supabase
        .from("empreendimentos")
        .select("fotos_proposta_ids, fotos_contrato_ids")
        .eq("id", foto.empreendimento_id)
        .maybeSingle();
      if (emp) {
        await supabase
          .from("empreendimentos")
          .update({
            fotos_proposta_ids: (emp.fotos_proposta_ids ?? []).filter((id: string) => id !== fotoId),
            fotos_contrato_ids: (emp.fotos_contrato_ids ?? []).filter((id: string) => id !== fotoId),
          })
          .eq("id", foto.empreendimento_id);
      }
    }

    // best-effort: se o arquivo não sumir do storage não é motivo pra
    // reportar falha — a linha (que é o que importa pra tela) já foi.
    const caminho = foto?.url ? caminhoNoBucket(foto.url) : null;
    if (caminho) await supabase.storage.from("empreendimentos").remove([caminho]);

    revalidatePath("/admin/empreendimentos");
    return {};
  });
}

const MAX_FOTOS_DOCUMENTO = 3;

export async function definirFotosProposta(
  empreendimentoId: string,
  fotoIds: string[]
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase } = await exigirAdmin();
    if (fotoIds.length > MAX_FOTOS_DOCUMENTO) {
      throw new Error(`No máximo ${MAX_FOTOS_DOCUMENTO} fotos na proposta.`);
    }
    const { error } = await supabase
      .from("empreendimentos")
      .update({ fotos_proposta_ids: fotoIds })
      .eq("id", empreendimentoId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/empreendimentos");
    return {};
  });
}

export async function definirFotosContrato(
  empreendimentoId: string,
  fotoIds: string[]
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase } = await exigirAdmin();
    if (fotoIds.length > MAX_FOTOS_DOCUMENTO) {
      throw new Error(`No máximo ${MAX_FOTOS_DOCUMENTO} fotos no contrato.`);
    }
    const { error } = await supabase
      .from("empreendimentos")
      .update({ fotos_contrato_ids: fotoIds })
      .eq("id", empreendimentoId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/empreendimentos");
    return {};
  });
}

/**
 * Foto de capa que aparece no card do empreendimento na página inicial —
 * uma foto só da galeria, independente das listas de proposta/contrato.
 * `null` volta ao padrão (a primeira foto por ordem).
 */
export async function definirFotoCapa(
  empreendimentoId: string,
  fotoId: string | null
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase } = await exigirAdmin();
    const { error } = await supabase
      .from("empreendimentos")
      .update({ foto_capa_id: fotoId })
      .eq("id", empreendimentoId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/empreendimentos");
    revalidatePath("/");
    return {};
  });
}

/**
 * Print do Google Maps/Apple Maps com a localização — um slot só, separado
 * da galeria de fotos do imóvel. Mesmo bucket `empreendimentos`, caminho
 * fixo (upsert), então subir de novo substitui em vez de acumular.
 */
export async function atualizarMapaLocalizacao(
  empreendimentoId: string,
  formData: FormData
): Promise<ResultadoAcao<{ url: string }>> {
  return comoResultado(async () => {
    const { supabase, organizacaoId } = await exigirAdmin();

    const arquivo = formData.get("mapa") as File | null;
    if (!arquivo || arquivo.size === 0) throw new Error("Escolha um arquivo de imagem.");
    const erroTamanho = erroTamanhoArquivo(arquivo);
    if (erroTamanho) throw new Error(erroTamanho);

    const ext = arquivo.name.split(".").pop() || "jpg";
    const caminho = `${organizacaoId}/${empreendimentoId}/localizacao.${ext}`;
    const { error: erroUpload } = await supabase.storage
      .from("empreendimentos")
      .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
    if (erroUpload) throw new Error(erroUpload.message);

    const { data: publica } = supabase.storage.from("empreendimentos").getPublicUrl(caminho);
    const mapa_localizacao_url = `${publica.publicUrl}?v=${Date.now()}`;

    const { error } = await supabase
      .from("empreendimentos")
      .update({ mapa_localizacao_url })
      .eq("id", empreendimentoId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/empreendimentos");
    return { url: mapa_localizacao_url };
  });
}

export async function apagarMapaLocalizacao(empreendimentoId: string): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase } = await exigirAdmin();
    const { error } = await supabase
      .from("empreendimentos")
      .update({ mapa_localizacao_url: null })
      .eq("id", empreendimentoId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/empreendimentos");
    return {};
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

/**
 * Apaga o empreendimento inteiro — lotes, tabelas de preço, condições de
 * pagamento, fotos e vínculos com corretor caem junto (`on delete cascade`).
 * Proposta e contrato têm FK `on delete restrict` de propósito: existe
 * histórico de venda ali, então o Postgres barra a exclusão sozinho e a
 * mensagem abaixo só traduz esse erro — apagar não é a saída nesse caso,
 * é desativar (`ativo = false`).
 */
export async function apagarEmpreendimento(id: string): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase, organizacaoId } = await exigirAdmin();

    // best-effort: a linha (que é o que a RLS protege e o que importa pra
    // tela) some de qualquer forma, mesmo que sobre lixo no storage.
    const { data: arquivos } = await supabase.storage
      .from("empreendimentos")
      .list(`${organizacaoId}/${id}`);
    if (arquivos?.length) {
      await supabase.storage
        .from("empreendimentos")
        .remove(arquivos.map((a) => `${organizacaoId}/${id}/${a.name}`));
    }

    const { error } = await supabase.from("empreendimentos").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        throw new Error(
          "Esse empreendimento tem proposta ou contrato vinculado — não dá pra apagar. " +
            "Desmarque \"ativo\" no cadastro pra tirar ele de circulação sem perder o histórico."
        );
      }
      throw new Error(error.message);
    }

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
    logo_url: limpo(d.logo_url),
    cor_primaria: d.cor_primaria,
    cor_secundaria: d.cor_secundaria,
    ativo: d.ativo,
    imovel_unico: d.imovel_unico,
    mostrar_descricao_documento: d.mostrar_descricao_documento,
    mostrar_localizacao_documento: d.mostrar_localizacao_documento,
    endereco: limpo(d.endereco),
    site_url: limpo(d.site_url),
    instagram: limpo(d.instagram),
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
/** Grava a trava e a lista de um único perfil — usado pela tela individual e pela em massa. */
async function aplicarAcessoEmpreendimentos(
  supabase: Awaited<ReturnType<typeof exigirAdmin>>["supabase"],
  organizacaoId: string,
  perfilId: string,
  restrito: boolean,
  empreendimentoIds: string[]
) {
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
}

export async function definirAcessoEmpreendimentos(
  perfilId: string,
  restrito: boolean,
  empreendimentoIds: string[]
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    const { supabase, organizacaoId } = await exigirAdmin();
    await aplicarAcessoEmpreendimentos(
      supabase,
      organizacaoId,
      perfilId,
      restrito,
      empreendimentoIds
    );
    revalidatePath("/admin/corretores");
    return {};
  });
}

/**
 * A mesma trava aplicada de uma vez a vários corretores — para não exigir um
 * "Salvar acesso" por pessoa quando o time inteiro entra na mesma regra (ex.:
 * "só o Florescer" para quem não é admin). Admin nunca entra na lista: quem
 * chama esta ação já filtra por papel = 'corretor', e aqui a restrição não
 * faria sentido nenhum — admin enxerga tudo por definição.
 */
export async function definirAcessoEmpreendimentosEmMassa(
  perfilIds: string[],
  restrito: boolean,
  empreendimentoIds: string[]
): Promise<ResultadoAcao> {
  return comoResultado(async () => {
    if (perfilIds.length === 0) throw new Error("Selecione ao menos um corretor.");

    const { supabase, organizacaoId } = await exigirAdmin();

    const { data: alvos, error: erroAlvos } = await supabase
      .from("perfis")
      .select("id, papel")
      .in("id", perfilIds);
    if (erroAlvos) throw new Error(erroAlvos.message);
    if ((alvos ?? []).some((p) => p.papel === "admin")) {
      throw new Error("Admin não entra na restrição — enxerga tudo por definição.");
    }

    for (const perfilId of perfilIds) {
      await aplicarAcessoEmpreendimentos(
        supabase,
        organizacaoId,
        perfilId,
        restrito,
        empreendimentoIds
      );
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
