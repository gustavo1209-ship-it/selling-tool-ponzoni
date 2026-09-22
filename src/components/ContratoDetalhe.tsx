"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCheck,
  FileSpreadsheet,
  Image as ImageIcon,
  Pencil,
  Percent,
  Printer,
  RotateCcw,
  Settings2,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import {
  apagarContrato,
  atualizarContrato,
  atualizarParcela,
  darBaixa,
  darBaixaComissaoParcela,
  darBaixaEmLote,
  definirColunasDoDocumento,
  definirComissao,
  definirFotosDoContrato,
  definirMostrarMapaDoContrato,
  desfazerBaixa,
  desfazerBaixaComissaoParcela,
  desfazerBaixaEmLote,
  gerarParcelasComissao,
  type ModoBaixa,
} from "@/app/contratos/acoes";
import CampoNumero from "./CampoNumero";
import FotosEMapaDoDocumento from "./FotosEMapaDoDocumento";
import { SeloContrato, SeloParcela } from "./SeloStatus";
import type { Indexador } from "@/lib/calc/tipos";
import { descreverFormaPagamento, valorComissaoEmDinheiro } from "@/lib/comissao";
import { COLUNAS_DOC, TODAS_AS_COLUNAS } from "@/lib/contratos/colunas";
import { hojeISO, rotuloCompetencia } from "@/lib/contratos/mes";
import type { ContratoCalculado, ParcelaCalculada } from "@/lib/contratos/tipos";
import type {
  Cliente,
  ComissaoContrato,
  ComissaoParcela,
  Contrato,
  ContratoLote,
  Empreendimento,
  EmpreendimentoFoto,
  IndexadorRef,
} from "@/lib/db/tipos";
import { mensagemDeFalha } from "@/lib/erros";
import {
  area,
  dataBR,
  fator,
  indiceMes,
  moeda,
  moedaCurta,
  pct,
  ROTULO_INDEXADOR,
} from "@/lib/formato";
import { verificarResultado } from "@/lib/resultadoAcao";

export default function ContratoDetalhe({
  contrato,
  empreendimento,
  cliente,
  lotes,
  calculo,
  indexadores,
  clientes,
  fotos,
  autor,
  ehAdmin,
  verValor,
  verRecebido,
  verSaldoEAtraso,
  comissao,
  parcelasComissao,
  campanhaNome,
}: {
  contrato: Contrato;
  empreendimento: Empreendimento;
  cliente: Cliente | null;
  lotes: ContratoLote[];
  calculo: ContratoCalculado;
  indexadores: IndexadorRef[];
  /** Para trocar o comprador do contrato sem refazer o cadastro. */
  clientes: Cliente[];
  /** Galeria de fotos do empreendimento — pra escolher quais saem NESTE contrato. */
  fotos: EmpreendimentoFoto[];
  /** Quem cadastrou o contrato — com corretores, deixa de ser óbvio. */
  autor: string | null;
  /** Só admin define ou muda a comissão — a RLS de contrato_comissoes barra o resto. */
  ehAdmin: boolean;
  /** Financeiro do contrato (não a comissão) — admin sempre; corretor, só se ligado em Configurações. */
  verValor: boolean;
  verRecebido: boolean;
  verSaldoEAtraso: boolean;
  comissao: ComissaoContrato | null;
  parcelasComissao: ComissaoParcela[];
  /** Nome da campanha usada no cenário que virou este contrato, se alguma. */
  campanhaNome: string | null;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [baixando, setBaixando] = useState<string | null>(null);
  const [pagoEm, setPagoEm] = useState(hojeISO());
  const [valorPago, setValorPago] = useState<number | null>(null);
  const [forma, setForma] = useState("");
  const [boleto, setBoleto] = useState("");

  const [baixandoComissao, setBaixandoComissao] = useState<string | null>(null);
  const [pagoEmComissao, setPagoEmComissao] = useState(hojeISO());
  const [valorPagoComissao, setValorPagoComissao] = useState<number | null>(null);

  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [modoLote, setModoLote] = useState<ModoBaixa>("no_vencimento");
  const [dataLote, setDataLote] = useState(hojeISO());
  const [formaLote, setFormaLote] = useState("");

  const [editandoParcela, setEditandoParcela] = useState<string | null>(null);
  const [rascunhoParcela, setRascunhoParcela] = useState<{
    vencimento: string;
    valor_original: number | null;
    rotulo: string;
    observacao: string;
  } | null>(null);

  // `null` no banco significa "todas" — a tela abre com tudo marcado, que é
  // o que o documento mostra hoje.
  const [colunas, setColunas] = useState(false);
  const [colunasEscolhidas, setColunasEscolhidas] = useState<string[]>(
    contrato.colunas_documento?.length
      ? contrato.colunas_documento
      : [...TODAS_AS_COLUNAS]
  );

  const [fotosMapa, setFotosMapa] = useState(false);
  const padraoFotos = empreendimento.fotos_contrato_ids.length
    ? empreendimento.fotos_contrato_ids
    : fotos[0]
      ? [fotos[0].id]
      : [];

  const [ajustes, setAjustes] = useState(false);
  const [cfg, setCfg] = useState({
    titulo: contrato.titulo ?? "",
    cliente_id: contrato.cliente_id ?? "",
    status: contrato.status as string,
    data_base: contrato.data_base,
    data_contrato: contrato.data_contrato,
    valor_total: Number(contrato.valor_total) as number | null,
    indexador: contrato.indexador as Indexador,
    defasagem_indice_meses: contrato.defasagem_indice_meses as number | null,
    corrige_primeira_parcela: contrato.corrige_primeira_parcela,
    dia_vencimento: contrato.dia_vencimento as number | null,
    juros_mora_mensal: Number(contrato.juros_mora_mensal) * 100 as number | null,
    multa_atraso_pct: Number(contrato.multa_atraso_pct) * 100 as number | null,
    observacoes: contrato.observacoes ?? "",
    teste: contrato.teste,
  });

  const [comissaoAberta, setComissaoAberta] = useState(false);
  const [cfgComissao, setCfgComissao] = useState({
    percentual:
      comissao?.percentual != null ? (Number(comissao.percentual) * 100 as number | null) : null,
    valor_absoluto:
      comissao?.valor_absoluto != null ? (Number(comissao.valor_absoluto) as number | null) : null,
    comissao_parcelas: comissao?.comissao_parcelas ?? 1,
    comissao_primeiro_pagamento_dias: comissao?.comissao_primeiro_pagamento_dias ?? 0,
    comissao_intervalo_dias: comissao?.comissao_intervalo_dias ?? 30,
    forma_pagamento: comissao?.forma_pagamento ?? "",
    permuta: comissao?.permuta ?? false,
    permuta_descricao: comissao?.permuta_descricao ?? "",
    permuta_valor_mercado:
      comissao?.permuta_valor_mercado != null
        ? (Number(comissao.permuta_valor_mercado) as number | null)
        : null,
    permuta_valor_abatido:
      comissao?.permuta_valor_abatido != null
        ? (Number(comissao.permuta_valor_abatido) as number | null)
        : null,
  });

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

  function alternar(id: string) {
    setSelecionadas((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const emAberto = calculo.parcelas.filter((p) => p.situacao !== "paga");
  const vencidasEmAberto = emAberto.filter((p) => p.situacao === "vencida");
  const escolhidas = calculo.parcelas.filter((p) => selecionadas.includes(p.id));
  const escolhidasPagas = escolhidas.filter((p) => p.situacao === "paga");
  const escolhidasEmAberto = escolhidas.filter((p) => p.situacao !== "paga");

  function baixarSelecionadas() {
    if (escolhidasEmAberto.length === 0) return;
    agir(async () => {
      const resultado = await darBaixaEmLote(
        escolhidasEmAberto.map((p) => p.id),
        {
          modo: modoLote,
          data: modoLote === "data_unica" ? dataLote : undefined,
          forma_pagamento: formaLote || null,
        }
      );
      if (!resultado.ok) throw new Error(resultado.erro);
      setSelecionadas([]);
    });
  }

  function desfazerSelecionadas() {
    if (escolhidasPagas.length === 0) return;
    if (
      !confirm(
        `Desfazer a baixa de ${escolhidasPagas.length} parcela(s)? Elas voltam a aparecer como em aberto.`
      )
    ) {
      return;
    }
    agir(async () => {
      const resultado = await desfazerBaixaEmLote(escolhidasPagas.map((p) => p.id));
      if (!resultado.ok) throw new Error(resultado.erro);
      setSelecionadas([]);
    });
  }

  /**
   * Abre o formulário de baixa. Numa parcela já paga ele vem preenchido com
   * o que está gravado — é assim que se corrige uma data ou um valor sem ter
   * de desfazer a baixa e refazer.
   */
  function abrirBaixa(p: ParcelaCalculada) {
    setBaixando(p.id);
    setPagoEm(p.pago_em ?? hojeISO());
    setValorPago(p.valor_pago ?? p.valorACobrar);
    setForma(p.forma_pagamento ?? "");
    setBoleto(p.boleto_numero ?? "");
    setErro(null);
  }

  function confirmarBaixa(p: ParcelaCalculada) {
    agir(async () => {
      const resultado = await darBaixa(p.id, {
        pago_em: pagoEm,
        valor_pago: valorPago,
        forma_pagamento: forma || null,
        boleto_numero: boleto || null,
        observacao: null,
      });
      if (!resultado.ok) throw new Error(resultado.erro);
      setBaixando(null);
    });
  }

  function abrirEdicao(p: ParcelaCalculada) {
    setEditandoParcela(p.id);
    setRascunhoParcela({
      vencimento: p.vencimento,
      valor_original: p.valor_original,
      rotulo: p.rotulo,
      observacao: p.observacao ?? "",
    });
    setErro(null);
  }

  function salvarParcela(p: ParcelaCalculada) {
    if (!rascunhoParcela) return;
    agir(async () => {
      const resultado = await atualizarParcela(p.id, {
        vencimento: rascunhoParcela.vencimento,
        valor_original: rascunhoParcela.valor_original ?? 0,
        indexada: p.indexada,
        rotulo: rascunhoParcela.rotulo,
        boleto_numero: p.boleto_numero,
        observacao: rascunhoParcela.observacao || null,
      });
      if (!resultado.ok) throw new Error(resultado.erro);
      setEditandoParcela(null);
      setRascunhoParcela(null);
    });
  }

  function salvarAjustes() {
    agir(async () => {
      const resultado = await atualizarContrato(contrato.id, {
        titulo: cfg.titulo.trim() || null,
        cliente_id: cfg.cliente_id || null,
        status: cfg.status,
        data_contrato: cfg.data_contrato,
        data_base: cfg.data_base,
        valor_total: cfg.valor_total ?? 0,
        indexador: cfg.indexador,
        defasagem_indice_meses: cfg.defasagem_indice_meses ?? 1,
        corrige_primeira_parcela: cfg.corrige_primeira_parcela,
        dia_vencimento: cfg.dia_vencimento ?? 10,
        juros_mora_mensal: (cfg.juros_mora_mensal ?? 0) / 100,
        multa_atraso_pct: (cfg.multa_atraso_pct ?? 0) / 100,
        observacoes: cfg.observacoes || null,
        teste: cfg.teste,
      });
      if (!resultado.ok) throw new Error(resultado.erro);
      setAjustes(false);
    });
  }

  function salvarComissao() {
    agir(async () => {
      const resultado = await definirComissao(contrato.id, {
        percentual: cfgComissao.percentual != null ? cfgComissao.percentual / 100 : null,
        valor_absoluto: cfgComissao.valor_absoluto,
        comissao_parcelas: cfgComissao.comissao_parcelas || 1,
        comissao_primeiro_pagamento_dias: cfgComissao.comissao_primeiro_pagamento_dias ?? 0,
        comissao_intervalo_dias: cfgComissao.comissao_intervalo_dias || 30,
        forma_pagamento: cfgComissao.forma_pagamento.trim() || null,
        permuta: cfgComissao.permuta,
        permuta_descricao: cfgComissao.permuta_descricao.trim() || null,
        permuta_valor_mercado: cfgComissao.permuta_valor_mercado,
        permuta_valor_abatido: cfgComissao.permuta ? cfgComissao.permuta_valor_abatido : null,
      });
      if (!resultado.ok) throw new Error(resultado.erro);
      setComissaoAberta(false);
    });
  }

  function gerarCronogramaComissao() {
    if (!comissao) return;
    const temBaixa = parcelasComissao.some((p) => p.pago_em);
    if (
      parcelasComissao.length > 0 &&
      !confirm(
        temBaixa
          ? "Já existe baixa dada nesse cronograma. Recriar apaga o histórico de pagamento da comissão. Continuar?"
          : "Recriar o cronograma de pagamento da comissão?"
      )
    ) {
      return;
    }
    agir(() => gerarParcelasComissao(comissao.id));
  }

  function iniciarBaixaComissao(p: ComissaoParcela) {
    setBaixandoComissao(p.id);
    setPagoEmComissao(p.pago_em ?? hojeISO());
    setValorPagoComissao(p.valor_pago != null ? Number(p.valor_pago) : Number(p.valor));
  }

  function confirmarBaixaComissao(p: ComissaoParcela) {
    agir(async () => {
      const resultado = await darBaixaComissaoParcela(p.id, {
        pago_em: pagoEmComissao,
        valor_pago: valorPagoComissao ?? Number(p.valor),
      });
      if (!resultado.ok) throw new Error(resultado.erro);
      setBaixandoComissao(null);
    });
  }

  const semCorrecao = contrato.indexador === "nenhum";

  return (
    <div className="flex flex-col gap-6">
      {/* --------------------------------------------------------- topo */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {empreendimento.nome} · contrato de {dataBR(contrato.data_contrato)}
            {autor ? ` · cadastrado por ${autor}` : ""}
          </p>
          <h1 className="serif text-3xl mt-1 flex items-center gap-3">
            {contrato.codigo}
            <SeloContrato status={contrato.status} />
            {contrato.teste && <span className="selo selo-neutro">Teste</span>}
            {campanhaNome && (
              <span className="selo selo-ouro">Campanha: {campanhaNome}</span>
            )}
          </h1>
          <p className="text-sm text-tinta-suave mt-1">
            {cliente?.nome ?? contrato.titulo ?? "sem comprador vinculado"}
            {cliente?.documento && (
              <span className="text-cinza"> · {cliente.documento}</span>
            )}
            {lotes.length > 0 && (
              <span className="text-cinza">
                {" "}
                · {lotes.map((l) => `${l.quadra}-${l.numero}`).join(", ")} ·{" "}
                {area(lotes.reduce((s, l) => s + Number(l.area_m2), 0))}
              </span>
            )}
          </p>
          {contrato.proposta_id && (
            <p className="text-xs text-cinza mt-1">
              Gerado da proposta{" "}
              <Link
                href={`/propostas/${contrato.proposta_id}`}
                className="text-vinho font-semibold"
              >
                ver proposta
              </Link>
              {contrato.cenario_origem ? ` · opção "${contrato.cenario_origem}"` : ""}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-secundario"
            onClick={() => setAjustes((a) => !a)}
          >
            <Settings2 size={15} /> Editar contrato
          </button>
          <button
            className="btn btn-secundario"
            onClick={() => setColunas((c) => !c)}
          >
            <Table2 size={15} /> Colunas do documento
          </button>
          <button
            className="btn btn-secundario"
            onClick={() => setFotosMapa((f) => !f)}
          >
            <ImageIcon size={15} /> Fotos e mapa
          </button>
          <a
            className="btn btn-secundario"
            href={`/api/contratos/${contrato.id}/xlsx`}
          >
            <FileSpreadsheet size={15} /> XLSX
          </a>
          <Link
            className="btn btn-primario"
            href={`/contratos/${contrato.id}/demonstrativo`}
          >
            <Printer size={15} /> Demonstrativo
          </Link>
        </div>
      </div>

      {erro && (
        <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2">
          {erro}
        </p>
      )}

      {verSaldoEAtraso && calculo.residuo !== 0 && (
        <p className="text-sm text-ambar bg-ambar-fraco rounded-md px-3 py-2">
          A soma das parcelas ({moeda(calculo.totalOriginal)}) não fecha com o
          valor do contrato ({moeda(Number(contrato.valor_total))}) — diferença de{" "}
          {moeda(Math.abs(calculo.residuo))}. Ajuste uma parcela ou o valor total
          em Ajustes.
        </p>
      )}

      {verSaldoEAtraso && calculo.temEstimativa && (
        <p className="text-sm text-tinta-suave bg-papel-alt rounded-md px-3 py-2">
          Parcelas marcadas com <span className="text-cinza font-semibold">~</span>{" "}
          dependem de meses sem índice lançado e estão estimadas pela taxa de
          projeção. Para emitir boleto, lance os meses que faltam em{" "}
          <Link href="/indices" className="text-vinho font-semibold">
            Índices mensais
          </Link>
          .
        </p>
      )}

      {/* ------------------------------------------------------- números */}
      {(verValor || verRecebido || verSaldoEAtraso) && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {verValor && (
            <div className="cartao p-4">
              <p className="eyebrow">Valor do contrato</p>
              <p className="serif text-xl tabular mt-1">
                {moeda(Number(contrato.valor_total))}
              </p>
              <p className="text-xs text-cinza mt-1">
                base {dataBR(contrato.data_base)}
              </p>
            </div>
          )}
          {verRecebido && (
            <div className="cartao p-4">
              <p className="eyebrow">Recebido</p>
              <p className="serif text-xl tabular mt-1 text-verde">
                {moeda(calculo.totalPago)}
              </p>
              <p className="text-xs text-cinza mt-1">
                {calculo.parcelasPagas} de {calculo.parcelasTotal} parcelas
              </p>
            </div>
          )}
          {verSaldoEAtraso && (
            <>
              <div className="cartao p-4">
                <p className="eyebrow">Saldo corrigido</p>
                <p className="serif text-xl tabular mt-1 text-vinho">
                  {moeda(calculo.saldoCorrigido)}
                </p>
                <p className="text-xs text-cinza mt-1">
                  {semCorrecao
                    ? "sem correção"
                    : `${moedaCurta(calculo.totalCorrecao)} de correção`}
                </p>
              </div>
              <div className="cartao p-4">
                <p className="eyebrow">Em atraso</p>
                <p
                  className={`serif text-xl tabular mt-1 ${
                    calculo.totalVencido > 0 ? "text-vermelho" : ""
                  }`}
                >
                  {moeda(calculo.totalVencido)}
                </p>
                <p className="text-xs text-cinza mt-1">
                  {calculo.vencidas.length} parcela(s) vencida(s)
                </p>
              </div>
              <div className="cartao p-4">
                <p className="eyebrow">Próximo vencimento</p>
                <p className="serif text-xl tabular mt-1">
                  {calculo.proxima ? moeda(calculo.proxima.valorCorrigido) : "—"}
                </p>
                <p className="text-xs text-cinza mt-1">
                  {calculo.proxima ? dataBR(calculo.proxima.vencimento) : "contrato quitado"}
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {/* ------------------------------------------ comissão do corretor */}
      <section className="cartao p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="serif text-lg">Comissão do corretor</h2>
            <p className="text-sm text-cinza mt-1">
              {comissao
                ? "Definida pelo escritório."
                : "Pendente — o escritório ainda vai definir o percentual e a forma de pagamento."}
            </p>
          </div>
          {ehAdmin && (
            <button
              className="btn btn-secundario"
              onClick={() => setComissaoAberta((a) => !a)}
            >
              <Percent size={15} /> {comissao ? "Editar comissão" : "Definir comissão"}
            </button>
          )}
        </div>

        {!comissaoAberta &&
          (comissao ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="eyebrow">Percentual</p>
                <p className="serif text-xl tabular mt-1">
                  {pct(comissao.percentual != null ? Number(comissao.percentual) : null)}
                </p>
              </div>
              <div>
                <p className="eyebrow">
                  {comissao.permuta ? "Valor total" : "Valor"}
                </p>
                <p className="serif text-xl tabular mt-1">
                  {moeda(comissao.valor_absoluto != null ? Number(comissao.valor_absoluto) : null)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="eyebrow">Como vai ser pago</p>
                <p className="text-sm mt-1 font-semibold">
                  {descreverFormaPagamento(comissao)}
                </p>
                {comissao.forma_pagamento && (
                  <p className="text-xs text-cinza mt-1">{comissao.forma_pagamento}</p>
                )}
              </div>
              {comissao.permuta && (
                <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-linha px-3 py-2 flex flex-col gap-1">
                  <p className="eyebrow">Permuta</p>
                  <p className="text-sm">
                    {comissao.permuta_descricao || "sem descrição"}
                    {comissao.permuta_valor_mercado != null && (
                      <span className="text-cinza">
                        {" "}
                        · valor de mercado {moeda(Number(comissao.permuta_valor_mercado))}
                      </span>
                    )}
                  </p>
                  <p className="text-sm">
                    Abate {moeda(Number(comissao.permuta_valor_abatido))} da comissão ·{" "}
                    <span className="font-semibold">
                      resta {moeda(valorComissaoEmDinheiro(comissao))} em dinheiro
                    </span>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <span className="selo selo-reservado w-fit">Pendente de definição</span>
          ))}

        {comissaoAberta && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="rotulo">Percentual</label>
              <CampoNumero
                valor={cfgComissao.percentual}
                aoMudar={(v) =>
                  setCfgComissao((atual) => ({
                    ...atual,
                    percentual: v,
                    // sugere o valor a partir do percentual; o campo continua
                    // editável depois, para quando o combinado não bate exato
                    valor_absoluto:
                      v != null
                        ? Math.round(Number(contrato.valor_total) * (v / 100) * 100) / 100
                        : atual.valor_absoluto,
                  }))
                }
                sufixo="%"
              />
            </div>
            <div>
              <label className="rotulo">Valor</label>
              <CampoNumero
                valor={cfgComissao.valor_absoluto}
                aoMudar={(v) => setCfgComissao({ ...cfgComissao, valor_absoluto: v })}
                prefixo="R$"
              />
              <p className="text-xs text-cinza mt-1">
                Sugerido a partir do percentual sobre {moeda(Number(contrato.valor_total))}
                ; pode ajustar à mão.
              </p>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-linha px-3 py-3">
              <p className="rotulo mb-2">Como vai ser pago</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-cinza">Em quantas vezes</label>
                  <CampoNumero
                    valor={cfgComissao.comissao_parcelas}
                    aoMudar={(v) =>
                      setCfgComissao({ ...cfgComissao, comissao_parcelas: v ?? 1 })
                    }
                    casas={0}
                  />
                </div>
                <div>
                  <label className="text-xs text-cinza">1º pagamento em (dias)</label>
                  <CampoNumero
                    valor={cfgComissao.comissao_primeiro_pagamento_dias}
                    aoMudar={(v) =>
                      setCfgComissao({
                        ...cfgComissao,
                        comissao_primeiro_pagamento_dias: v ?? 0,
                      })
                    }
                    casas={0}
                    sufixo=" dias"
                  />
                  <p className="text-xs text-cinza mt-1">0 = no ato</p>
                </div>
                {cfgComissao.comissao_parcelas > 1 && (
                  <div>
                    <label className="text-xs text-cinza">Intervalo entre parcelas</label>
                    <CampoNumero
                      valor={cfgComissao.comissao_intervalo_dias}
                      aoMudar={(v) =>
                        setCfgComissao({
                          ...cfgComissao,
                          comissao_intervalo_dias: v ?? 30,
                        })
                      }
                      casas={0}
                      sufixo=" dias"
                    />
                  </div>
                )}
              </div>
              <p className="text-sm mt-2 text-vinho font-semibold">
                {descreverFormaPagamento({
                  ...cfgComissao,
                  valor_absoluto: cfgComissao.valor_absoluto,
                })}
              </p>
              <div className="mt-3">
                <label className="rotulo">Observação (opcional)</label>
                <input
                  className="campo"
                  value={cfgComissao.forma_pagamento}
                  onChange={(e) =>
                    setCfgComissao({ ...cfgComissao, forma_pagamento: e.target.value })
                  }
                  placeholder="Algo que os campos acima não cobrem"
                />
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="comissao-permuta"
                checked={cfgComissao.permuta}
                onChange={(e) =>
                  setCfgComissao({ ...cfgComissao, permuta: e.target.checked })
                }
              />
              <label htmlFor="comissao-permuta" className="text-sm cursor-pointer">
                Envolve permuta
              </label>
            </div>
            {cfgComissao.permuta && (
              <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-linha px-3 py-3 grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="rotulo">O que é a permuta</label>
                  <input
                    className="campo"
                    value={cfgComissao.permuta_descricao}
                    onChange={(e) =>
                      setCfgComissao({ ...cfgComissao, permuta_descricao: e.target.value })
                    }
                    placeholder="Ex.: apartamento no bairro X"
                  />
                </div>
                <div>
                  <label className="rotulo">Valor de mercado do bem</label>
                  <CampoNumero
                    valor={cfgComissao.permuta_valor_mercado}
                    aoMudar={(v) =>
                      setCfgComissao({ ...cfgComissao, permuta_valor_mercado: v })
                    }
                    prefixo="R$"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="rotulo">Valor abatido da comissão</label>
                  <CampoNumero
                    valor={cfgComissao.permuta_valor_abatido}
                    aoMudar={(v) =>
                      setCfgComissao({ ...cfgComissao, permuta_valor_abatido: v })
                    }
                    prefixo="R$"
                  />
                  <p className="text-xs text-cinza mt-1">
                    Diferente do valor de mercado — é quanto isso desconta do
                    dinheiro que o corretor recebe.
                  </p>
                </div>
                <p className="sm:col-span-3 text-sm font-semibold">
                  Resta{" "}
                  {moeda(
                    valorComissaoEmDinheiro({
                      valor_absoluto: cfgComissao.valor_absoluto,
                      permuta: true,
                      permuta_valor_abatido: cfgComissao.permuta_valor_abatido,
                    })
                  )}{" "}
                  em dinheiro.
                </p>
              </div>
            )}
            <div className="flex items-end gap-2">
              <button
                className="btn btn-primario flex-1"
                onClick={salvarComissao}
                disabled={pendente}
              >
                <Check size={15} /> Salvar
              </button>
              <button
                className="btn btn-secundario"
                disabled={pendente}
                onClick={() => setComissaoAberta(false)}
              >
                <X size={15} /> Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------- cronograma de pagamento */}
        {comissao && parcelasComissao.length === 0 && ehAdmin && !comissaoAberta && (
          <div className="border-t border-linha pt-4">
            <button className="btn btn-secundario" onClick={gerarCronogramaComissao}>
              <RotateCcw size={15} /> Gerar cronograma de pagamento
            </button>
          </div>
        )}

        {comissao && parcelasComissao.length > 0 && (
          <div className="border-t border-linha pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Cronograma de pagamento</h3>
              {ehAdmin && (
                <button
                  className="btn btn-fantasma text-xs"
                  onClick={gerarCronogramaComissao}
                >
                  <RotateCcw size={13} /> Recriar cronograma
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Vencimento</th>
                    <th className="num">Valor</th>
                    <th>Situação</th>
                    <th>Pagamento</th>
                    {ehAdmin && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {parcelasComissao.map((p) => {
                    const paga = Boolean(p.pago_em);
                    const hoje = hojeISO();
                    const situacao = paga
                      ? "paga"
                      : p.vencimento < hoje
                        ? "vencida"
                        : p.vencimento === hoje
                          ? "vence_hoje"
                          : "a_vencer";
                    const emBaixa = baixandoComissao === p.id;

                    return (
                      <Fragment key={p.id}>
                        <tr className={situacao === "vencida" ? "bg-vermelho-fraco/40" : ""}>
                          <td className="text-cinza">{p.numero}</td>
                          <td className="whitespace-nowrap">{dataBR(p.vencimento)}</td>
                          <td className="num">{moeda(Number(p.valor))}</td>
                          <td>
                            <SeloParcela situacao={situacao} />
                          </td>
                          <td className="text-cinza text-xs whitespace-nowrap">
                            {paga
                              ? `${dataBR(p.pago_em as string)} · ${moeda(Number(p.valor_pago))}`
                              : "—"}
                          </td>
                          {ehAdmin && (
                            <td className="whitespace-nowrap">
                              {paga ? (
                                <button
                                  className="btn btn-fantasma px-2 text-xs"
                                  disabled={pendente}
                                  onClick={() =>
                                    agir(() => desfazerBaixaComissaoParcela(p.id))
                                  }
                                >
                                  Desfazer
                                </button>
                              ) : (
                                <button
                                  className="btn btn-fantasma px-2 text-xs"
                                  onClick={() => iniciarBaixaComissao(p)}
                                >
                                  Dar baixa
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                        {emBaixa && (
                          <tr>
                            <td colSpan={ehAdmin ? 6 : 5} className="bg-papel-alt">
                              <div className="flex flex-wrap items-end gap-2 py-2">
                                <div>
                                  <label className="rotulo">Pago em</label>
                                  <input
                                    type="date"
                                    className="campo py-1 text-xs"
                                    value={pagoEmComissao}
                                    onChange={(e) => setPagoEmComissao(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="rotulo">Valor pago</label>
                                  <CampoNumero
                                    valor={valorPagoComissao}
                                    aoMudar={setValorPagoComissao}
                                    prefixo="R$"
                                  />
                                </div>
                                <button
                                  className="btn btn-primario"
                                  disabled={pendente}
                                  onClick={() => confirmarBaixaComissao(p)}
                                >
                                  <Check size={14} /> Confirmar
                                </button>
                                <button
                                  className="btn btn-secundario"
                                  onClick={() => setBaixandoComissao(null)}
                                >
                                  <X size={14} /> Cancelar
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-papel-alt font-semibold">
                    <td colSpan={2}>Total</td>
                    <td className="num">
                      {moeda(parcelasComissao.reduce((s, p) => s + Number(p.valor), 0))}
                    </td>
                    <td colSpan={ehAdmin ? 3 : 2} className="text-xs text-cinza font-normal">
                      {moeda(
                        parcelasComissao
                          .filter((p) => p.pago_em)
                          .reduce((s, p) => s + Number(p.valor_pago), 0)
                      )}{" "}
                      já recebido
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------- colunas do documento */}
      {colunas && (
        <section className="cartao p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="serif text-lg">Colunas do documento</h2>
              <p className="text-sm text-cinza mt-1">
                Vale para o demonstrativo em PDF e para o XLSX. Fica gravado no
                contrato, então a reimpressão sai igual à via que o cliente já
                recebeu.
              </p>
            </div>
            <button className="btn btn-fantasma" onClick={() => setColunas(false)}>
              <X size={15} />
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {COLUNAS_DOC.filter((c) => !c.soComCorrecao || !semCorrecao).map((c) => {
              const marcada = colunasEscolhidas.includes(c.chave);
              return (
                <label
                  key={c.chave}
                  className="flex gap-2.5 items-start rounded-md border border-linha px-3 py-2 cursor-pointer hover:bg-papel-alt"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={marcada}
                    onChange={() =>
                      setColunasEscolhidas((atual) =>
                        marcada
                          ? atual.filter((x) => x !== c.chave)
                          : [...atual, c.chave]
                      )
                    }
                  />
                  <span>
                    <span className="text-sm font-semibold block">
                      {c.rotulo}
                      <span className="text-cinza font-normal">
                        {" "}
                        · {c.pdf && c.xlsx ? "PDF e XLSX" : c.pdf ? "só PDF" : "só XLSX"}
                      </span>
                    </span>
                    <span className="text-xs text-cinza">{c.ajuda}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn btn-primario"
              disabled={pendente}
              onClick={() =>
                agir(async () => {
                  const resultado = await definirColunasDoDocumento(
                    contrato.id,
                    colunasEscolhidas
                  );
                  if (!resultado.ok) throw new Error(resultado.erro);
                  setColunas(false);
                })
              }
            >
              <Check size={15} /> Salvar
            </button>
            <button
              className="btn btn-secundario"
              onClick={() => setColunasEscolhidas([...TODAS_AS_COLUNAS])}
            >
              <RotateCcw size={15} /> Marcar todas
            </button>
            <span className="text-xs text-cinza">
              {colunasEscolhidas.length === 0
                ? "Nenhuma marcada — o documento sai com todas as colunas."
                : `${colunasEscolhidas.length} de ${TODAS_AS_COLUNAS.length} marcadas.`}
            </span>
          </div>
        </section>
      )}

      {/* --------------------------------------------- fotos e mapa */}
      {fotosMapa && (
        <section className="cartao p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="serif text-lg">Fotos e mapa deste contrato</h2>
              <p className="text-sm text-cinza mt-1">
                Vale só pra esse contrato — não muda o padrão do empreendimento nem a
                proposta que deu origem a ele.
              </p>
            </div>
            <button className="btn btn-fantasma" onClick={() => setFotosMapa(false)}>
              <X size={15} />
            </button>
          </div>

          <FotosEMapaDoDocumento
            fotos={fotos}
            fotosIds={contrato.fotos_ids}
            fotosPadrao={padraoFotos}
            mostrarMapa={contrato.mostrar_mapa}
            mapaPadrao={empreendimento.mostrar_localizacao_documento}
            temMapa={!!empreendimento.mapa_localizacao_url}
            pendente={pendente}
            aoDefinirFotos={(ids) =>
              agir(async () => {
                const resultado = await definirFotosDoContrato(contrato.id, ids);
                if (!resultado.ok) throw new Error(resultado.erro);
              })
            }
            aoDefinirMapa={(valor) =>
              agir(async () => {
                const resultado = await definirMostrarMapaDoContrato(contrato.id, valor);
                if (!resultado.ok) throw new Error(resultado.erro);
              })
            }
          />
        </section>
      )}

      {/* -------------------------------------------------------- ajustes */}
      {ajustes && (
        <section className="cartao p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between">
            <h2 className="serif text-lg">Editar contrato</h2>
            <button className="btn btn-fantasma" onClick={() => setAjustes(false)}>
              <X size={15} />
            </button>
          </div>

          <div className="sm:col-span-2">
            <label className="rotulo">Comprador</label>
            <select
              className="campo"
              value={cfg.cliente_id}
              onChange={(e) => setCfg({ ...cfg, cliente_id: e.target.value })}
            >
              <option value="">— sem comprador vinculado —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.empresa ? ` · ${c.empresa}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="rotulo">Identificação do contrato</label>
            <input
              className="campo"
              value={cfg.titulo}
              onChange={(e) => setCfg({ ...cfg, titulo: e.target.value })}
              placeholder="Ex.: contrato de 12/2024, quadra C"
            />
          </div>

          <div>
            <label className="rotulo">Situação</label>
            <select
              className="campo"
              value={cfg.status}
              onChange={(e) => setCfg({ ...cfg, status: e.target.value })}
            >
              <option value="ativo">Ativo</option>
              <option value="quitado">Quitado</option>
              <option value="suspenso">Suspenso</option>
              <option value="distratado">Distratado</option>
            </select>
          </div>
          <div>
            <label className="rotulo">Data do contrato</label>
            <input
              type="date"
              className="campo"
              value={cfg.data_contrato}
              onChange={(e) => setCfg({ ...cfg, data_contrato: e.target.value })}
            />
          </div>
          <div>
            <label className="rotulo">Data-base da correção</label>
            <input
              type="date"
              className="campo"
              value={cfg.data_base}
              onChange={(e) => setCfg({ ...cfg, data_base: e.target.value })}
            />
          </div>
          <div>
            <label className="rotulo">Valor total</label>
            <CampoNumero
              valor={cfg.valor_total}
              aoMudar={(v) => setCfg({ ...cfg, valor_total: v })}
              prefixo="R$"
            />
          </div>

          <div>
            <label className="rotulo">Índice</label>
            <select
              className="campo"
              value={cfg.indexador}
              onChange={(e) =>
                setCfg({ ...cfg, indexador: e.target.value as Indexador })
              }
            >
              <option value="nenhum">Sem correção</option>
              {indexadores.map((i) => (
                <option key={i.codigo} value={i.codigo}>
                  {i.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo">Defasagem</label>
            <CampoNumero
              valor={cfg.defasagem_indice_meses}
              aoMudar={(v) => setCfg({ ...cfg, defasagem_indice_meses: v })}
              casas={0}
              sufixo="m"
            />
            {/* Trocar 1 por 0 aqui move a régua inteira um mês para frente e
                muda o valor de todo boleto — sem uma frase dizendo o que o
                número faz, o erro passa despercebido até o cliente ligar. */}
            <p
              className={`text-xs mt-1 ${
                cfg.defasagem_indice_meses === 0 ? "text-ambar" : "text-cinza"
              }`}
            >
              {cfg.defasagem_indice_meses === 0
                ? "usa o índice do próprio mês do vencimento — só serve se a FGV publicar antes de o boleto sair"
                : cfg.defasagem_indice_meses === 1
                  ? "usa os índices até o mês anterior ao vencimento (o usual)"
                  : `usa os índices até ${cfg.defasagem_indice_meses} meses antes do vencimento`}
            </p>
          </div>
          <div>
            <label className="rotulo">Primeira parcela</label>
            <select
              className="campo"
              value={cfg.corrige_primeira_parcela ? "sim" : "nao"}
              onChange={(e) =>
                setCfg({ ...cfg, corrige_primeira_parcela: e.target.value === "sim" })
              }
            >
              <option value="sim">Já vem corrigida</option>
              <option value="nao">Sai sem correção</option>
            </select>
          </div>
          <div>
            <label className="rotulo">Juros de mora ao mês</label>
            <CampoNumero
              valor={cfg.juros_mora_mensal}
              aoMudar={(v) => setCfg({ ...cfg, juros_mora_mensal: v })}
              sufixo="%"
            />
          </div>
          <div>
            <label className="rotulo">Multa por atraso</label>
            <CampoNumero
              valor={cfg.multa_atraso_pct}
              aoMudar={(v) => setCfg({ ...cfg, multa_atraso_pct: v })}
              sufixo="%"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="rotulo">Observações</label>
            <input
              className="campo"
              value={cfg.observacoes}
              onChange={(e) => setCfg({ ...cfg, observacoes: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="contrato-teste"
              checked={cfg.teste}
              onChange={(e) => setCfg({ ...cfg, teste: e.target.checked })}
            />
            <label htmlFor="contrato-teste" className="text-sm cursor-pointer">
              Isto é teste — fora de &quot;A receber&quot; e dos totais de Contratos
            </label>
          </div>
          <div className="flex items-end gap-2">
            <button
              className="btn btn-primario flex-1"
              onClick={salvarAjustes}
              disabled={pendente}
            >
              <Check size={15} /> Salvar
            </button>
            <button
              className="btn btn-secundario text-vermelho"
              disabled={pendente}
              onClick={() => {
                if (
                  confirm(
                    `Apagar o contrato ${contrato.codigo} e todo o histórico de pagamentos? Não dá para desfazer.`
                  )
                ) {
                  // a navegação é daqui: a action não redireciona, senão o
                  // try/catch de `agir` engoliria o redirect do Next
                  setErro(null);
                  iniciar(async () => {
                    try {
                      const resultado = await apagarContrato(contrato.id);
                      if (!resultado.ok) throw new Error(resultado.erro);
                      router.push("/contratos");
                    } catch (e) {
                      setErro(mensagemDeFalha(e));
                    }
                  });
                }
              }}
            >
              <Trash2 size={15} /> Apagar contrato
            </button>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------- parcelas */}
      {verSaldoEAtraso && (
      <section className="cartao overflow-x-auto">
        <div className="cartao-titulo flex-wrap">
          <h2 className="serif text-lg">Cronograma</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {vencidasEmAberto.length > 0 && (
              <button
                className="btn btn-secundario py-1 px-2 text-xs"
                onClick={() => setSelecionadas(vencidasEmAberto.map((p) => p.id))}
              >
                <CheckCheck size={14} /> Selecionar as {vencidasEmAberto.length} vencidas
              </button>
            )}
            <span className="text-cinza">
              {semCorrecao
                ? "contrato sem correção monetária"
                : `${ROTULO_INDEXADOR[contrato.indexador]} acumulado desde ${dataBR(contrato.data_base)}` +
                  (contrato.defasagem_indice_meses === 0
                    ? ", até o índice do próprio mês do vencimento"
                    : contrato.defasagem_indice_meses === 1
                      ? ", até o índice do mês anterior a cada vencimento"
                      : `, até ${contrato.defasagem_indice_meses} meses antes de cada vencimento`)}
            </span>
          </div>
        </div>

        {/* ------------------------------------------- ações em lote */}
        {selecionadas.length > 0 && (
          <div className="border-b border-linha bg-dourado-fraco px-4 py-3 flex flex-wrap items-end gap-3">
            <p className="text-sm font-semibold pb-2">
              {selecionadas.length} parcela(s) marcada(s)
            </p>

            {escolhidasEmAberto.length > 0 && (
              <>
                <div>
                  <label className="rotulo">Data do pagamento</label>
                  <select
                    className="campo w-56"
                    value={modoLote}
                    onChange={(e) => setModoLote(e.target.value as ModoBaixa)}
                  >
                    <option value="no_vencimento">Cada uma no seu vencimento</option>
                    <option value="data_unica">Uma data para todas</option>
                  </select>
                </div>
                {modoLote === "data_unica" && (
                  <div>
                    <label className="rotulo">Data</label>
                    <input
                      type="date"
                      className="campo w-40"
                      value={dataLote}
                      onChange={(e) => setDataLote(e.target.value)}
                    />
                  </div>
                )}
                <div className="w-40">
                  <label className="rotulo">Forma</label>
                  <input
                    className="campo"
                    value={formaLote}
                    onChange={(e) => setFormaLote(e.target.value)}
                    placeholder="Boleto, PIX"
                  />
                </div>
                <button
                  className="btn btn-primario"
                  onClick={baixarSelecionadas}
                  disabled={pendente}
                >
                  <Check size={15} /> Marcar {escolhidasEmAberto.length} como paga(s)
                </button>
              </>
            )}

            {escolhidasPagas.length > 0 && (
              <button
                className="btn btn-secundario"
                onClick={desfazerSelecionadas}
                disabled={pendente}
              >
                <RotateCcw size={15} /> Desfazer {escolhidasPagas.length} baixa(s)
              </button>
            )}

            <button className="btn btn-fantasma" onClick={() => setSelecionadas([])}>
              Limpar seleção
            </button>

            {escolhidasEmAberto.length > 0 && (
              <p className="text-xs text-tinta-suave w-full">
                No modo &ldquo;cada uma no seu vencimento&rdquo; cada parcela é
                datada com o próprio vencimento — é o certo para um contrato
                antigo, que não deve nascer com encargos de atraso que nunca
                existiram. O valor gravado é o que a parcela valia naquele dia.
              </p>
            )}
          </div>
        )}

        <table className="tabela">
          <thead>
            <tr>
              <th className="w-8">
                <input
                  type="checkbox"
                  title="Marcar todas"
                  checked={
                    selecionadas.length > 0 &&
                    selecionadas.length === calculo.parcelas.length
                  }
                  onChange={(e) =>
                    setSelecionadas(
                      e.target.checked ? calculo.parcelas.map((p) => p.id) : []
                    )
                  }
                />
              </th>
              <th>#</th>
              <th>Grupo</th>
              <th>Vencimento</th>
              <th className="num">Original</th>
              <th className="num">Fator</th>
              <th className="num">Corrigido</th>
              <th className="num">A cobrar</th>
              <th>Situação</th>
              <th>Pagamento</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {calculo.parcelas.map((p) => {
              const editando = editandoParcela === p.id;
              const emBaixa = baixando === p.id;

              return (
                <Fragment key={p.id}>
                  <tr
                    className={`hover:bg-papel-alt ${
                      p.situacao === "vencida" ? "bg-vermelho-fraco/40" : ""
                    }`}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selecionadas.includes(p.id)}
                        onChange={() => alternar(p.id)}
                      />
                    </td>
                    <td className="text-cinza">{p.numero}</td>
                    <td>
                      {editando ? (
                        <input
                          className="campo py-1 text-xs"
                          value={rascunhoParcela?.rotulo ?? ""}
                          onChange={(e) =>
                            setRascunhoParcela((r) =>
                              r ? { ...r, rotulo: e.target.value } : r
                            )
                          }
                        />
                      ) : (
                        <>
                          <span className="font-semibold">{p.rotulo}</span>
                          {p.total_no_grupo > 1 && (
                            <span className="text-cinza text-xs">
                              {" "}
                              {p.indice}/{p.total_no_grupo}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {editando ? (
                        <input
                          type="date"
                          className="campo py-1 text-xs"
                          value={rascunhoParcela?.vencimento ?? ""}
                          onChange={(e) =>
                            setRascunhoParcela((r) =>
                              r ? { ...r, vencimento: e.target.value } : r
                            )
                          }
                        />
                      ) : (
                        dataBR(p.vencimento)
                      )}
                    </td>
                    <td className="num">
                      {editando ? (
                        <CampoNumero
                          valor={rascunhoParcela?.valor_original ?? null}
                          aoMudar={(v) =>
                            setRascunhoParcela((r) =>
                              r ? { ...r, valor_original: v } : r
                            )
                          }
                        />
                      ) : (
                        moeda(p.valor_original)
                      )}
                    </td>
                    {/* O fator sozinho não deixa ver quais índices entraram,
                        e é essa a primeira dúvida de quem confere o boleto
                        contra o comunicado da FGV. O título abre a conta. */}
                    <td
                      className="num text-cinza"
                      title={
                        p.correcao.aplicados.length
                          ? p.correcao.aplicados
                              .map(
                                (a) =>
                                  `${rotuloCompetencia(a.competencia)}  ${indiceMes(a.variacao)}${a.estimado ? "  (estimado)" : ""}`
                              )
                              .join("\n") + `\n= ${fator(p.correcao.fator)}`
                          : "sem correção nesta parcela"
                      }
                    >
                      {p.indexada ? (
                        <>
                          {fator(p.correcao.fator)}
                          {p.correcao.estimado && <span className="ml-0.5">~</span>}
                          {p.correcao.aplicados.length > 0 && (
                            <span className="block text-[10px] text-cinza font-normal">
                              {p.correcao.aplicados.length === 1
                                ? rotuloCompetencia(p.correcao.aplicados[0].competencia)
                                : `${rotuloCompetencia(p.correcao.aplicados[0].competencia)}–${rotuloCompetencia(
                                    p.correcao.aplicados[p.correcao.aplicados.length - 1].competencia
                                  )}`}
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num">{moeda(p.valorCorrigido)}</td>
                    <td className="num font-semibold">
                      {p.situacao === "paga" ? (
                        <span className="text-cinza">—</span>
                      ) : (
                        <>
                          {moeda(p.valorACobrar)}
                          {p.encargos && (
                            <span
                              className="block text-[10px] text-vermelho font-normal"
                              title={`multa ${moeda(p.encargos.multa)} + juros ${moeda(p.encargos.juros)}`}
                            >
                              +{moeda(p.encargos.multa + p.encargos.juros)} de encargos
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      <SeloParcela situacao={p.situacao} />
                      {p.situacao === "vencida" && p.encargos && (
                        <span className="block text-[10px] text-cinza mt-0.5">
                          {p.encargos.diasAtraso} dias
                        </span>
                      )}
                    </td>
                    <td className="text-cinza whitespace-nowrap text-xs">
                      {p.pago_em ? (
                        <>
                          {dataBR(p.pago_em)}
                          {p.valor_pago !== null && (
                            <span className="block">{moeda(p.valor_pago)}</span>
                          )}
                          {p.forma_pagamento && (
                            <span className="block">{p.forma_pagamento}</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num whitespace-nowrap">
                      {editando ? (
                        <>
                          <button
                            className="btn btn-fantasma px-2 py-1 text-verde"
                            onClick={() => salvarParcela(p)}
                            disabled={pendente}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            className="btn btn-fantasma px-2 py-1"
                            onClick={() => {
                              setEditandoParcela(null);
                              setRascunhoParcela(null);
                            }}
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : p.situacao === "paga" ? (
                        <>
                          <button
                            className="btn btn-fantasma px-2 py-1"
                            title="Corrigir a baixa (data, valor, forma)"
                            onClick={() => abrirBaixa(p)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="btn btn-fantasma px-2 py-1"
                            title="Desfazer baixa"
                            onClick={() => agir(() => desfazerBaixa(p.id))}
                            disabled={pendente}
                          >
                            <RotateCcw size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-fantasma px-2 py-1"
                            title="Editar parcela"
                            onClick={() => abrirEdicao(p)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="btn btn-secundario px-2 py-1 text-xs"
                            onClick={() => abrirBaixa(p)}
                          >
                            Baixar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>

                  {emBaixa && (
                    <tr className="bg-papel-alt">
                      <td colSpan={11}>
                        <div className="flex flex-wrap items-end gap-3 py-2">
                          <div>
                            <label className="rotulo">Pago em</label>
                            <input
                              type="date"
                              className="campo w-40"
                              value={pagoEm}
                              onChange={(e) => setPagoEm(e.target.value)}
                            />
                          </div>
                          <div className="w-40">
                            <label className="rotulo">Valor recebido</label>
                            <CampoNumero
                              valor={valorPago}
                              aoMudar={setValorPago}
                              prefixo="R$"
                            />
                          </div>
                          <div className="w-40">
                            <label className="rotulo">Forma</label>
                            <input
                              className="campo"
                              value={forma}
                              onChange={(e) => setForma(e.target.value)}
                              placeholder="Boleto, PIX, TED"
                            />
                          </div>
                          <div className="w-44">
                            <label className="rotulo">Nº do boleto</label>
                            <input
                              className="campo"
                              value={boleto}
                              onChange={(e) => setBoleto(e.target.value)}
                            />
                          </div>
                          <button
                            className="btn btn-primario"
                            onClick={() => confirmarBaixa(p)}
                            disabled={pendente}
                          >
                            <Check size={15} /> Confirmar
                          </button>
                          <button
                            className="btn btn-fantasma"
                            onClick={() => setBaixando(null)}
                          >
                            Cancelar
                          </button>
                          {p.encargos && (
                            <p className="text-xs text-cinza flex-1 min-w-[200px]">
                              Sugerido com multa de {pct(Number(contrato.multa_atraso_pct), 2)}{" "}
                              e juros de {pct(Number(contrato.juros_mora_mensal), 2)} ao mês
                              sobre {p.encargos.diasAtraso} dias. Se houve acordo,
                              digite o valor recebido.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </section>
      )}

      {contrato.observacoes && (
        <p className="text-sm text-cinza">{contrato.observacoes}</p>
      )}
    </div>
  );
}
