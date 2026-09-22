"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import CampoNumero from "./CampoNumero";
import MontarOpcao from "./MontarOpcao";
import {
  adicionarFotoEmpreendimento,
  apagarCondicao,
  apagarFotoEmpreendimento,
  apagarMapaLocalizacao,
  atualizarCondicao,
  atualizarEmpreendimento,
  atualizarLoteUnico,
  atualizarMapaLocalizacao,
  criarCondicao,
  criarEmpreendimento,
  definirFotosContrato,
  definirFotosProposta,
  salvarTabelaPreco,
  type DadosEmpreendimento,
  type DadosLoteUnico,
} from "@/app/admin/acoes";
import { hojeISO } from "@/lib/contratos/mes";
import type {
  BlocoTemplate,
  CondicaoPagamento,
  Empreendimento,
  EmpreendimentoFoto,
  IndexadorRef,
  Lote,
  TabelaPreco,
} from "@/lib/db/tipos";
import { mensagemDeFalha } from "@/lib/erros";
import { pct } from "@/lib/formato";
import { verificarResultado } from "@/lib/resultadoAcao";

const VAZIO: DadosEmpreendimento = {
  nome: "",
  subtitulo: null,
  cidade: null,
  uf: null,
  espelho_csv_url: null,
  mapa_url: null,
  mapa_publico_url: null,
  logo_url: null,
  cor_primaria: "#7C2A28",
  cor_secundaria: "#E0A221",
  ativo: true,
  imovel_unico: false,
  mostrar_descricao_documento: true,
  mostrar_localizacao_documento: true,
};

const LOTE_UNICO_VAZIO: DadosLoteUnico = {
  quadra: "ÚNICO",
  numero: "1",
  area_m2: 0,
  area_construida_m2: null,
  preco_tabela: null,
  descricao: null,
};

/**
 * Cadastro de empreendimento pela tela, o que antes só existia por migration.
 *
 * A ordem da tela é a ordem que funciona (CLAUDE.md, "Adicionar um
 * empreendimento"): primeiro a linha do empreendimento com as URLs, depois a
 * tabela de preço vigente, depois as condições — e só então "Sincronizar",
 * que é o que traz os lotes do Google Sheets.
 *
 * O que continua fora daqui é a geometria do mapa (`npm run mapa:extrair`) e
 * os arquivos de `public/`: são arquivo no repositório, não linha no banco.
 */
export default function AdminEmpreendimentos({
  empreendimentos,
  tabelas,
  condicoes,
  indexadores,
  lotesUnicos,
  fotos,
}: {
  empreendimentos: Empreendimento[];
  tabelas: TabelaPreco[];
  condicoes: CondicaoPagamento[];
  indexadores: IndexadorRef[];
  lotesUnicos: Lote[];
  fotos: EmpreendimentoFoto[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  const [novo, setNovo] = useState(false);
  const [rascunho, setRascunho] = useState<DadosEmpreendimento>(VAZIO);
  const [loteUnico, setLoteUnico] = useState<DadosLoteUnico>(LOTE_UNICO_VAZIO);
  const [aberto, setAberto] = useState<string | null>(null);

  function agir(fn: () => Promise<unknown>) {
    setErro(null);
    iniciar(async () => {
      try {
        verificarResultado(await fn());
        router.refresh();
      } catch (e) {
        setErro(mensagemDeFalha(e));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="serif text-3xl mt-1">Empreendimentos</h1>
          <p className="text-sm text-cinza mt-1">
            O espelho de vendas continua sendo o Google Sheets — a ferramenta lê
            dele e não escreve de volta.
          </p>
        </div>
        <button
          className="btn btn-primario"
          onClick={() => {
            setRascunho(VAZIO);
            setLoteUnico(LOTE_UNICO_VAZIO);
            setNovo((n) => !n);
          }}
        >
          <Plus size={16} /> Novo empreendimento
        </button>
      </div>

      {erro && (
        <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2">
          {erro}
        </p>
      )}
      {recado && (
        <p className="text-sm text-tinta-suave bg-papel-alt rounded-md px-3 py-2">
          {recado}
        </p>
      )}

      {novo && (
        <section className="cartao p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="serif text-lg">Novo empreendimento</h2>
            <button className="btn btn-fantasma" onClick={() => setNovo(false)}>
              <X size={15} />
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rascunho.imovel_unico}
              onChange={(e) =>
                setRascunho({ ...rascunho, imovel_unico: e.target.checked })
              }
            />
            Imóvel único (casa, apartamento) — sem espelho de vendas, cadastro direto
          </label>

          <CamposEmpreendimento dados={rascunho} aoMudar={setRascunho} />

          {rascunho.imovel_unico && (
            <div className="border-t border-linha pt-4 flex flex-col gap-3">
              <h3 className="eyebrow">O imóvel</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="rotulo">Quadra</label>
                  <input
                    className="campo"
                    value={loteUnico.quadra}
                    onChange={(e) => setLoteUnico({ ...loteUnico, quadra: e.target.value })}
                  />
                </div>
                <div>
                  <label className="rotulo">Lote</label>
                  <input
                    className="campo"
                    value={loteUnico.numero}
                    onChange={(e) => setLoteUnico({ ...loteUnico, numero: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-cinza -mt-2">
                É o rótulo que sai na proposta e no contrato (&ldquo;Quadra{" "}
                {loteUnico.quadra || "…"} · Lote {loteUnico.numero || "…"}&rdquo;) — troque por
                algo que faça sentido pra uma casa só, como o nome da rua, ou deixe como está.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="rotulo">Área do terreno (m²)</label>
                  <CampoNumero
                    valor={loteUnico.area_m2}
                    aoMudar={(v) => setLoteUnico({ ...loteUnico, area_m2: v ?? 0 })}
                    casas={2}
                  />
                </div>
                <div>
                  <label className="rotulo">Área construída (m²)</label>
                  <CampoNumero
                    valor={loteUnico.area_construida_m2 ?? 0}
                    aoMudar={(v) => setLoteUnico({ ...loteUnico, area_construida_m2: v })}
                    casas={2}
                  />
                </div>
                <div>
                  <label className="rotulo">Preço</label>
                  <CampoNumero
                    valor={loteUnico.preco_tabela ?? 0}
                    aoMudar={(v) => setLoteUnico({ ...loteUnico, preco_tabela: v })}
                    casas={2}
                  />
                </div>
              </div>
              <div>
                <label className="rotulo">Descrição (características, acabamentos)</label>
                <textarea
                  className="campo"
                  rows={3}
                  value={loteUnico.descricao ?? ""}
                  onChange={(e) =>
                    setLoteUnico({ ...loteUnico, descricao: e.target.value || null })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rascunho.mostrar_descricao_documento}
                  onChange={(e) =>
                    setRascunho({ ...rascunho, mostrar_descricao_documento: e.target.checked })
                  }
                />
                Mostrar a descrição na proposta e no contrato
              </label>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              className="btn btn-primario"
              disabled={pendente}
              onClick={() =>
                agir(async () => {
                  const resultado = await criarEmpreendimento(
                    rascunho,
                    rascunho.imovel_unico ? loteUnico : undefined
                  );
                  if (!resultado.ok) throw new Error(resultado.erro);
                  setNovo(false);
                  setAberto(resultado.id);
                  setRecado(
                    rascunho.imovel_unico
                      ? `Empreendimento criado com o endereço "${resultado.slug}" — já aberto abaixo, é onde fica o upload da foto. Falta a tabela de preço e as condições.`
                      : `Empreendimento criado com o endereço "${resultado.slug}" — já aberto abaixo, é onde fica o upload da foto. Falta a tabela de preço, as condições e o primeiro Sincronizar.`
                  );
                })
              }
            >
              <Check size={15} /> Cadastrar
            </button>
            <span className="text-xs text-cinza">
              O endereço na URL sai do nome e não muda depois.
            </span>
          </div>
        </section>
      )}

      {empreendimentos.map((e) => {
        const tabela = tabelas.find((t) => t.empreendimento_id === e.id) ?? null;
        const minhasCondicoes = tabela
          ? condicoes.filter((c) => c.tabela_preco_id === tabela.id)
          : [];
        const expandido = aberto === e.id;

        return (
          <section key={e.id} className="cartao">
            <button
              className="w-full flex items-center gap-3 p-4 text-left"
              onClick={() => setAberto(expandido ? null : e.id)}
            >
              {e.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.logo_url}
                  alt=""
                  className="w-9 h-9 rounded object-cover"
                />
              )}
              <span className="flex-1">
                <span className="serif text-lg block">{e.nome}</span>
                <span className="text-xs text-cinza">
                  /{e.slug}
                  {e.cidade ? ` · ${e.cidade}/${e.uf}` : ""} ·{" "}
                  {tabela
                    ? `${minhasCondicoes.length} condição(ões)`
                    : "sem tabela de preço"}
                  {!e.ativo && " · inativo"}
                </span>
              </span>
              {expandido ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {expandido && (
              <div className="border-t border-linha p-5 flex flex-col gap-6">
                <EditorEmpreendimento
                  empreendimento={e}
                  loteUnico={lotesUnicos.find((l) => l.empreendimento_id === e.id) ?? null}
                  fotos={fotos
                    .filter((f) => f.empreendimento_id === e.id)
                    .sort((a, b) => a.ordem - b.ordem)}
                  pendente={pendente}
                  agir={agir}
                  aoSincronizar={setRecado}
                />
                <EditorTabela
                  empreendimento={e}
                  tabela={tabela}
                  pendente={pendente}
                  agir={agir}
                />
                {tabela && (
                  <EditorCondicoes
                    tabela={tabela}
                    condicoes={minhasCondicoes}
                    indexadores={indexadores}
                    pendente={pendente}
                    agir={agir}
                  />
                )}
              </div>
            )}
          </section>
        );
      })}

      {empreendimentos.length === 0 && (
        <p className="text-sm text-cinza">Nenhum empreendimento cadastrado ainda.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------- os campos */

function CamposEmpreendimento({
  dados,
  aoMudar,
}: {
  dados: DadosEmpreendimento;
  aoMudar: (d: DadosEmpreendimento) => void;
}) {
  const mudar = (patch: Partial<DadosEmpreendimento>) =>
    aoMudar({ ...dados, ...patch });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="lg:col-span-2">
        <label className="rotulo">Nome</label>
        <input
          className="campo"
          value={dados.nome}
          onChange={(ev) => mudar({ nome: ev.target.value })}
        />
      </div>
      <div className="lg:col-span-2">
        <label className="rotulo">Subtítulo</label>
        <input
          className="campo"
          value={dados.subtitulo ?? ""}
          onChange={(ev) => mudar({ subtitulo: ev.target.value })}
          placeholder="Loteamento industrial · 2ª fase"
        />
      </div>
      <div>
        <label className="rotulo">Cidade</label>
        <input
          className="campo"
          value={dados.cidade ?? ""}
          onChange={(ev) => mudar({ cidade: ev.target.value })}
        />
      </div>
      <div>
        <label className="rotulo">UF</label>
        <input
          className="campo"
          maxLength={2}
          value={dados.uf ?? ""}
          onChange={(ev) => mudar({ uf: ev.target.value })}
        />
      </div>
      <div>
        <label className="rotulo">Cor primária</label>
        <div className="flex gap-2">
          <input
            type="color"
            className="campo w-14 p-1"
            value={dados.cor_primaria}
            onChange={(ev) => mudar({ cor_primaria: ev.target.value })}
          />
          <input
            className="campo"
            value={dados.cor_primaria}
            onChange={(ev) => mudar({ cor_primaria: ev.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="rotulo">Cor secundária</label>
        <div className="flex gap-2">
          <input
            type="color"
            className="campo w-14 p-1"
            value={dados.cor_secundaria}
            onChange={(ev) => mudar({ cor_secundaria: ev.target.value })}
          />
          <input
            className="campo"
            value={dados.cor_secundaria}
            onChange={(ev) => mudar({ cor_secundaria: ev.target.value })}
          />
        </div>
      </div>

      <div className="sm:col-span-2 lg:col-span-4">
        <label className="rotulo">
          Espelho de vendas — CSV publicado do Google Sheets
        </label>
        <input
          className="campo"
          value={dados.espelho_csv_url ?? ""}
          onChange={(ev) => mudar({ espelho_csv_url: ev.target.value })}
          placeholder="https://docs.google.com/spreadsheets/d/…/gviz/tq?tqx=out:csv"
        />
        <p className="text-xs text-cinza mt-1">
          É o mesmo endereço que o mapa público usa. Na planilha:{" "}
          <span className="text-tinta-suave">
            Arquivo → Compartilhar → Publicar na web
          </span>
          , e depois troque o final por{" "}
          <code className="text-tinta-suave">/gviz/tq?tqx=out:csv</code>. O parser
          acha as colunas pelo nome (Quadra, Lote, Área, Status, Comprador), não
          pela posição.
        </p>
      </div>

      <div className="sm:col-span-2">
        <label className="rotulo">Mapa — HTML do mapa interativo</label>
        <input
          className="campo"
          value={dados.mapa_url ?? ""}
          onChange={(ev) => mudar({ mapa_url: ev.target.value })}
          placeholder="https://usuario.github.io/mapa/…html"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo">Mapa — página pública, para o cliente</label>
        <input
          className="campo"
          value={dados.mapa_publico_url ?? ""}
          onChange={(ev) => mudar({ mapa_publico_url: ev.target.value })}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo">Logo (arquivo em public/)</label>
        <input
          className="campo"
          value={dados.logo_url ?? ""}
          onChange={(ev) => mudar({ logo_url: ev.target.value })}
          placeholder="/logo-meu-empreendimento.png"
        />
      </div>
      <p className="sm:col-span-2 text-xs text-cinza -mt-1">
        As fotos do empreendimento (até 5, aérea ou do imóvel) e o mapa de localização (print
        do Google Maps ou Apple Maps) se sobem depois de criar o cadastro: clique no nome dele
        na lista abaixo pra abrir o card.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={dados.ativo}
          onChange={(ev) => mudar({ ativo: ev.target.checked })}
        />
        Ativo (aparece no painel e no espelho)
      </label>
    </div>
  );
}

/* --------------------------------------------- editar um existente */

function EditorEmpreendimento({
  empreendimento,
  loteUnico,
  fotos,
  pendente,
  agir,
  aoSincronizar,
}: {
  empreendimento: Empreendimento;
  loteUnico: Lote | null;
  fotos: EmpreendimentoFoto[];
  pendente: boolean;
  agir: (fn: () => Promise<unknown>) => void;
  aoSincronizar: (texto: string) => void;
}) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosEmpreendimento>({
    nome: empreendimento.nome,
    subtitulo: empreendimento.subtitulo,
    cidade: empreendimento.cidade,
    uf: empreendimento.uf,
    espelho_csv_url: empreendimento.espelho_csv_url,
    mapa_url: empreendimento.mapa_url,
    mapa_publico_url: empreendimento.mapa_publico_url,
    logo_url: empreendimento.logo_url,
    cor_primaria: empreendimento.cor_primaria,
    cor_secundaria: empreendimento.cor_secundaria,
    ativo: empreendimento.ativo,
    imovel_unico: empreendimento.imovel_unico,
    mostrar_descricao_documento: empreendimento.mostrar_descricao_documento,
    mostrar_localizacao_documento: empreendimento.mostrar_localizacao_documento,
  });
  const [imovel, setImovel] = useState<DadosLoteUnico>({
    quadra: loteUnico?.quadra ?? "ÚNICO",
    numero: loteUnico?.numero ?? "1",
    area_m2: loteUnico?.area_m2 ?? 0,
    area_construida_m2: loteUnico?.area_construida_m2 ?? null,
    preco_tabela: loteUnico?.preco_tabela ?? null,
    descricao: loteUnico?.descricao ?? null,
  });
  const [sincronizando, setSincronizando] = useState(false);
  const [colarAberto, setColarAberto] = useState(false);
  const [textoColado, setTextoColado] = useState("");
  const [colando, setColando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  async function enviarFoto(arquivo: File) {
    setEnviandoFoto(true);
    try {
      const formData = new FormData();
      formData.append("foto", arquivo);
      verificarResultado(await adicionarFotoEmpreendimento(empreendimento.id, formData));
      router.refresh();
    } catch (e) {
      aoSincronizar(mensagemDeFalha(e));
    }
    setEnviandoFoto(false);
  }

  const [enviandoMapa, setEnviandoMapa] = useState(false);

  async function enviarMapaLocalizacao(arquivo: File) {
    setEnviandoMapa(true);
    try {
      const formData = new FormData();
      formData.append("mapa", arquivo);
      verificarResultado(await atualizarMapaLocalizacao(empreendimento.id, formData));
      router.refresh();
    } catch (e) {
      aoSincronizar(mensagemDeFalha(e));
    }
    setEnviandoMapa(false);
  }

  async function chamarSync(corpoExtra: Record<string, unknown>) {
    const r = await fetch("/api/espelho/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empreendimentoId: empreendimento.id, ...corpoExtra }),
    });
    const corpo = await r.json();
    aoSincronizar(
      r.ok
        ? `${corpo.lidos} lotes lidos, ${corpo.novos} novo(s), ${corpo.alteracoes.length} alteração(ões).`
        : (corpo.erro ?? "Falha ao sincronizar.")
    );
    return r.ok as boolean;
  }

  async function sincronizar() {
    setSincronizando(true);
    try {
      await chamarSync({});
    } catch (e) {
      aoSincronizar(mensagemDeFalha(e));
    }
    setSincronizando(false);
  }

  async function colar() {
    setColando(true);
    try {
      const ok = await chamarSync({ csv: textoColado });
      if (ok) setTextoColado("");
    } catch (e) {
      aoSincronizar(mensagemDeFalha(e));
    }
    setColando(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="eyebrow">Cadastro</h3>
      <CamposEmpreendimento dados={dados} aoMudar={setDados} />

      <GaleriaFotos
        empreendimentoId={empreendimento.id}
        fotos={fotos}
        fotosPropostaIds={empreendimento.fotos_proposta_ids}
        fotosContratoIds={empreendimento.fotos_contrato_ids}
        enviandoFoto={enviandoFoto}
        pendente={pendente}
        agir={agir}
        aoEnviar={enviarFoto}
      />

      <div className="sm:col-span-2 flex flex-col gap-2 border-t border-linha pt-4">
        <label className="rotulo">Mapa de localização (print do Google Maps ou Apple Maps)</label>
        <div className="flex items-center gap-3">
          {empreendimento.mapa_localizacao_url && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={empreendimento.mapa_localizacao_url}
                alt=""
                className="w-24 h-16 rounded object-cover"
              />
              <button
                type="button"
                className="btn btn-fantasma text-vermelho"
                disabled={pendente}
                onClick={() => agir(() => apagarMapaLocalizacao(empreendimento.id))}
              >
                <Trash2 size={13} /> Apagar
              </button>
            </>
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          className="campo"
          disabled={enviandoMapa || pendente}
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) enviarMapaLocalizacao(arquivo);
            e.target.value = "";
          }}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dados.mostrar_localizacao_documento}
            onChange={(e) =>
              setDados({ ...dados, mostrar_localizacao_documento: e.target.checked })
            }
          />
          Mostrar o mapa de localização na proposta e no contrato
        </label>
        <p className="text-xs text-cinza -mt-1">
          Esse checkbox salva com &ldquo;Salvar cadastro&rdquo;; o mapa em si sobe na hora,
          sem precisar clicar em nada.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-primario"
          disabled={pendente}
          onClick={() => agir(() => atualizarEmpreendimento(empreendimento.id, dados))}
        >
          <Check size={15} /> Salvar cadastro
        </button>
        {!dados.imovel_unico && (
          <>
            <button
              className="btn btn-secundario"
              disabled={sincronizando || !empreendimento.espelho_csv_url}
              onClick={sincronizar}
              title={
                empreendimento.espelho_csv_url
                  ? "Lê a planilha e cria ou atualiza os lotes"
                  : "Salve o CSV do espelho antes"
              }
            >
              <RefreshCw size={15} className={sincronizando ? "animate-spin" : ""} />
              {sincronizando ? "Sincronizando…" : "Sincronizar lotes com o Sheets"}
            </button>
            <button
              type="button"
              className="btn btn-fantasma"
              onClick={() => setColarAberto((v) => !v)}
            >
              {colarAberto ? "Fechar" : "Sem Google Sheets? Colar lista de lotes"}
            </button>
          </>
        )}
      </div>

      {dados.imovel_unico && (
        <div className="border-t border-linha pt-4 flex flex-col gap-3">
          <h3 className="eyebrow">O imóvel</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="rotulo">Quadra</label>
              <input
                className="campo"
                value={imovel.quadra}
                onChange={(e) => setImovel({ ...imovel, quadra: e.target.value })}
              />
            </div>
            <div>
              <label className="rotulo">Lote</label>
              <input
                className="campo"
                value={imovel.numero}
                onChange={(e) => setImovel({ ...imovel, numero: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-cinza -mt-2">
            É o rótulo que sai na proposta e no contrato (&ldquo;Quadra {imovel.quadra || "…"} ·
            Lote {imovel.numero || "…"}&rdquo;) — troque por algo que faça sentido pra uma casa
            só, como o nome da rua.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="rotulo">Área do terreno (m²)</label>
              <CampoNumero
                valor={imovel.area_m2}
                aoMudar={(v) => setImovel({ ...imovel, area_m2: v ?? 0 })}
                casas={2}
              />
            </div>
            <div>
              <label className="rotulo">Área construída (m²)</label>
              <CampoNumero
                valor={imovel.area_construida_m2 ?? 0}
                aoMudar={(v) => setImovel({ ...imovel, area_construida_m2: v })}
                casas={2}
              />
            </div>
            <div>
              <label className="rotulo">Preço</label>
              <CampoNumero
                valor={imovel.preco_tabela ?? 0}
                aoMudar={(v) => setImovel({ ...imovel, preco_tabela: v })}
                casas={2}
              />
            </div>
          </div>
          <div>
            <label className="rotulo">Descrição (características, acabamentos)</label>
            <textarea
              className="campo"
              rows={3}
              value={imovel.descricao ?? ""}
              onChange={(e) => setImovel({ ...imovel, descricao: e.target.value || null })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dados.mostrar_descricao_documento}
              onChange={(e) =>
                setDados({ ...dados, mostrar_descricao_documento: e.target.checked })
              }
            />
            Mostrar a descrição na proposta e no contrato
          </label>
          <p className="text-xs text-cinza -mt-1">
            Esse checkbox salva com &ldquo;Salvar cadastro&rdquo; ali em cima; o texto da
            descrição salva com o botão abaixo.
          </p>
          <button
            className="btn btn-primario self-start"
            disabled={pendente}
            onClick={() => agir(() => atualizarLoteUnico(empreendimento.id, imovel))}
          >
            <Check size={15} /> Salvar o imóvel
          </button>
        </div>
      )}

      {colarAberto && !dados.imovel_unico && (
        <div className="border-t border-linha pt-3 flex flex-col gap-2">
          <p className="text-xs text-cinza">
            Cole aqui uma tabela com as colunas <strong>Quadra</strong>, <strong>Lote</strong>,{" "}
            <strong>Área</strong>, <strong>Valor</strong> e <strong>Status</strong> (livre,
            reservado, vendido) — direto do Excel/Google Sheets (selecione as células, Ctrl+C,
            Ctrl+V aqui) ou como CSV. Rodar de novo só atualiza o que mudou; nenhum lote existente
            é apagado.
          </p>
          <textarea
            className="campo font-mono text-xs"
            rows={6}
            placeholder={"Quadra\tLote\tÁrea\tValor\tStatus\nA\t1\t300\t250000\tlivre\nA\t2\t320\t260000\tvendido"}
            value={textoColado}
            onChange={(e) => setTextoColado(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secundario self-start"
            disabled={colando || !textoColado.trim()}
            onClick={colar}
          >
            <RefreshCw size={15} className={colando ? "animate-spin" : ""} />
            {colando ? "Lendo…" : "Criar/atualizar lotes com este texto"}
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------- galeria de fotos */

const MAX_FOTOS_DOCUMENTO = 3;

/**
 * Até 5 fotos por empreendimento. Cada uma pode entrar na lista de até 3
 * fotos da proposta e/ou do contrato — os dois documentos podem usar fotos
 * diferentes, as mesmas, ou qualquer combinação. Sem escolha nenhuma, a
 * folha usa só a primeira por ordem (mesmo comportamento de antes, agora
 * explícito na tela). Mais de uma foto sai lado a lado no documento.
 */
function GaleriaFotos({
  empreendimentoId,
  fotos,
  fotosPropostaIds,
  fotosContratoIds,
  enviandoFoto,
  pendente,
  agir,
  aoEnviar,
}: {
  empreendimentoId: string;
  fotos: EmpreendimentoFoto[];
  fotosPropostaIds: string[];
  fotosContratoIds: string[];
  enviandoFoto: boolean;
  pendente: boolean;
  agir: (fn: () => Promise<unknown>) => void;
  aoEnviar: (arquivo: File) => void;
}) {
  const padrao = fotos[0] ? [fotos[0].id] : [];
  const proposta = fotosPropostaIds.length ? fotosPropostaIds : padrao;
  const contrato = fotosContratoIds.length ? fotosContratoIds : padrao;

  function alternar(lista: string[], id: string): string[] | null {
    if (lista.includes(id)) return lista.filter((x) => x !== id);
    if (lista.length >= MAX_FOTOS_DOCUMENTO) return null; // no máximo, ignora o clique
    return [...lista, id];
  }

  return (
    <div className="sm:col-span-2 flex flex-col gap-2">
      <label className="rotulo">Fotos ({fotos.length}/5)</label>
      <p className="text-xs text-cinza -mt-1">
        Marque até {MAX_FOTOS_DOCUMENTO} pra cada documento — mais de uma sai lado a lado.
      </p>
      {fotos.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fotos.map((f) => (
            <div key={f.id} className="rounded-md border border-linha p-2 flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="" className="w-full h-28 rounded object-cover" />
              <div className="flex flex-col gap-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={proposta.includes(f.id)}
                    disabled={pendente || (!proposta.includes(f.id) && proposta.length >= MAX_FOTOS_DOCUMENTO)}
                    onChange={() => {
                      const nova = alternar(proposta, f.id);
                      if (nova) agir(() => definirFotosProposta(empreendimentoId, nova));
                    }}
                  />
                  Usar na proposta
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contrato.includes(f.id)}
                    disabled={pendente || (!contrato.includes(f.id) && contrato.length >= MAX_FOTOS_DOCUMENTO)}
                    onChange={() => {
                      const nova = alternar(contrato, f.id);
                      if (nova) agir(() => definirFotosContrato(empreendimentoId, nova));
                    }}
                  />
                  Usar no contrato
                </label>
              </div>
              <button
                type="button"
                className="btn btn-fantasma text-vermelho self-start"
                disabled={pendente}
                onClick={() => agir(() => apagarFotoEmpreendimento(f.id))}
              >
                <Trash2 size={13} /> Apagar
              </button>
            </div>
          ))}
        </div>
      )}
      {fotos.length < 5 && (
        <input
          type="file"
          accept="image/*"
          className="campo"
          disabled={enviandoFoto || pendente}
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) aoEnviar(arquivo);
            e.target.value = "";
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------- tabela de preço */

function EditorTabela({
  empreendimento,
  tabela,
  pendente,
  agir,
}: {
  empreendimento: Empreendimento;
  tabela: TabelaPreco | null;
  pendente: boolean;
  agir: (fn: () => Promise<unknown>) => void;
}) {
  const [dados, setDados] = useState({
    referencia: tabela?.referencia ?? `Tabela ${new Date().getFullYear()}`,
    condicao_base: tabela?.condicao_base ?? "",
    vigente_desde: tabela?.vigente_desde ?? hojeISO(),
    incc_mensal: (Number(tabela?.incc_mensal ?? 0.005) * 100) as number | null,
    juros_vp_mensal: (Number(tabela?.juros_vp_mensal ?? 0.01) * 100) as number | null,
  });

  return (
    <div className="flex flex-col gap-3 border-t border-linha pt-5">
      <h3 className="eyebrow">Tabela de preço vigente</h3>
      {!tabela && (
        <p className="text-sm text-cinza">
          Sem tabela, este empreendimento não gera proposta — a tela de nova
          proposta não tem o que oferecer.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="rotulo">Referência</label>
          <input
            className="campo"
            value={dados.referencia}
            onChange={(e) => setDados({ ...dados, referencia: e.target.value })}
          />
        </div>
        <div className="lg:col-span-2">
          <label className="rotulo">Condição base (o preço publicado)</label>
          <input
            className="campo"
            value={dados.condicao_base}
            onChange={(e) => setDados({ ...dados, condicao_base: e.target.value })}
            placeholder="40% Entrada + 36x INCC"
          />
        </div>
        <div>
          <label className="rotulo">Vigente desde</label>
          <input
            type="date"
            className="campo"
            value={dados.vigente_desde}
            onChange={(e) => setDados({ ...dados, vigente_desde: e.target.value })}
          />
        </div>
        <div />
        <div>
          <label className="rotulo">Correção mensal (% a.m.)</label>
          <CampoNumero
            valor={dados.incc_mensal}
            aoMudar={(v) => setDados({ ...dados, incc_mensal: v })}
            casas={4}
          />
        </div>
        <div>
          <label className="rotulo">Taxa de valor presente (% a.m.)</label>
          <CampoNumero
            valor={dados.juros_vp_mensal}
            aoMudar={(v) => setDados({ ...dados, juros_vp_mensal: v })}
            casas={4}
          />
        </div>
      </div>

      <p className="text-xs text-cinza">
        A condição base é o que sai no subtítulo do espelho e no rodapé do
        seletor de nova proposta: é ela que diz de que condição o{" "}
        <span className="text-tinta-suave">preço de tabela</span> do lote fala.
      </p>

      <div>
        <button
          className="btn btn-primario"
          disabled={pendente}
          onClick={() =>
            agir(() =>
              salvarTabelaPreco(empreendimento.id, tabela?.id ?? null, {
                referencia: dados.referencia,
                condicao_base: dados.condicao_base,
                vigente_desde: dados.vigente_desde,
                incc_mensal: (dados.incc_mensal ?? 0) / 100,
                juros_vp_mensal: (dados.juros_vp_mensal ?? 0) / 100,
              })
            )
          }
        >
          <Check size={15} /> {tabela ? "Salvar tabela" : "Criar tabela"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- condições */

function EditorCondicoes({
  tabela,
  condicoes,
  indexadores,
  pendente,
  agir,
}: {
  tabela: TabelaPreco;
  condicoes: CondicaoPagamento[];
  indexadores: IndexadorRef[];
  pendente: boolean;
  agir: (fn: () => Promise<unknown>) => void;
}) {
  const [montando, setMontando] = useState(false);

  return (
    <div className="flex flex-col gap-3 border-t border-linha pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="eyebrow">Condições de pagamento</h3>
        <button className="btn btn-secundario" onClick={() => setMontando(true)}>
          <Plus size={15} /> Montar condição
        </button>
      </div>

      {condicoes.length === 0 && (
        <p className="text-sm text-cinza">
          Uma condição por coluna da sua tabela de preços. A primeira deve ser a
          condição base — aquela de que o preço do lote fala.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {condicoes.map((c) => (
          <LinhaCondicao key={c.id} condicao={c} pendente={pendente} agir={agir} />
        ))}
      </div>

      {montando && (
        <MontarOpcao
          indexadores={indexadores}
          valorReferencia={100000}
          aoFechar={() => setMontando(false)}
          aoCriar={(nome, blocos: BlocoTemplate[]) => {
            setMontando(false);
            agir(() =>
              criarCondicao(tabela.id, {
                nome,
                descricao: null,
                desconto_pct: 0,
                ordem: (condicoes.at(-1)?.ordem ?? 0) + 10,
                ativa: true,
                template: blocos,
              })
            );
          }}
        />
      )}
    </div>
  );
}

function LinhaCondicao({
  condicao,
  pendente,
  agir,
}: {
  condicao: CondicaoPagamento;
  pendente: boolean;
  agir: (fn: () => Promise<unknown>) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [dados, setDados] = useState({
    nome: condicao.nome,
    descricao: condicao.descricao ?? "",
    desconto_pct: (Number(condicao.desconto_pct) * 100) as number | null,
    ordem: condicao.ordem as number | null,
    ativa: condicao.ativa,
  });

  if (!editando) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-linha px-3 py-2">
        <span className="text-sm font-semibold flex-1">
          {condicao.nome}
          {!condicao.ativa && (
            <span className="selo selo-neutro ml-2">inativa</span>
          )}
          <span className="text-cinza font-normal">
            {" "}
            · {condicao.template.length} bloco(s)
            {Number(condicao.desconto_pct) !== 0 &&
              ` · ${pct(Number(condicao.desconto_pct))}`}
          </span>
        </span>
        <button className="btn btn-fantasma" onClick={() => setEditando(true)}>
          Editar
        </button>
        <button
          className="btn btn-fantasma text-vermelho"
          disabled={pendente}
          onClick={() => agir(() => apagarCondicao(condicao.id))}
        >
          <Trash2 size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-vinho p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
      <div className="lg:col-span-2">
        <label className="rotulo">Nome</label>
        <input
          className="campo"
          value={dados.nome}
          onChange={(e) => setDados({ ...dados, nome: e.target.value })}
        />
      </div>
      <div>
        <label className="rotulo">Desconto sobre a tabela (%)</label>
        <CampoNumero
          valor={dados.desconto_pct}
          aoMudar={(v) => setDados({ ...dados, desconto_pct: v })}
          casas={4}
        />
      </div>
      <div>
        <label className="rotulo">Ordem</label>
        <CampoNumero
          valor={dados.ordem}
          aoMudar={(v) => setDados({ ...dados, ordem: v })}
          casas={0}
        />
      </div>
      <label className="flex items-center gap-2 text-sm pb-2">
        <input
          type="checkbox"
          checked={dados.ativa}
          onChange={(e) => setDados({ ...dados, ativa: e.target.checked })}
        />
        Ativa
      </label>
      <div className="sm:col-span-2 lg:col-span-4">
        <label className="rotulo">Descrição</label>
        <input
          className="campo"
          value={dados.descricao}
          onChange={(e) => setDados({ ...dados, descricao: e.target.value })}
        />
      </div>
      <div className="flex gap-2">
        <button
          className="btn btn-primario"
          disabled={pendente}
          onClick={() => {
            agir(() =>
              atualizarCondicao(condicao.id, {
                nome: dados.nome,
                descricao: dados.descricao || null,
                desconto_pct: (dados.desconto_pct ?? 0) / 100,
                ordem: dados.ordem ?? 0,
                ativa: dados.ativa,
              })
            );
            setEditando(false);
          }}
        >
          <Check size={15} />
        </button>
        <button className="btn btn-secundario" onClick={() => setEditando(false)}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
