"use client";

import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { clarear, escurecer } from "@/lib/cores";
import { colunasAtivas } from "@/lib/contratos/colunas";
import { rotuloCompetencia } from "@/lib/contratos/mes";
import type { ContratoCalculado, ParcelaCalculada } from "@/lib/contratos/tipos";
import FotosDoDocumento from "./FotosDoDocumento";
import type {
  Cliente,
  Contrato,
  ContratoLote,
  Empreendimento,
} from "@/lib/db/tipos";
import {
  ROTULO_INDEXADOR,
  ROTULO_SITUACAO_PARCELA,
  area,
  dataBR,
  fator,
  moeda,
} from "@/lib/formato";

/**
 * Demonstrativo de pagamentos para entregar ao cliente.
 *
 * Mesmo padrão da folha da proposta: HTML autocontido que o navegador
 * imprime, sem biblioteca de PDF e sem depender de rede na hora de gerar.
 *
 * O que ele mostra é o que o cliente tem direito de conferir: quanto pagou,
 * quanto falta, e — parcela a parcela — de onde veio a correção. Um extrato
 * que esconde o fator de correção não resolve a ligação de quem quer saber
 * por que a parcela subiu.
 *
 * Quais colunas do cronograma saem é escolha do contrato
 * (`colunas_documento`, ver `@/lib/contratos/colunas`) — o caso que motivou
 * isso é o contrário do parágrafo acima: quando o cliente só quer o número
 * que paga, mostrar valor de origem e corrigido lado a lado gera dúvida.
 */
export default function FolhaDemonstrativo({
  contrato,
  empreendimento,
  cliente,
  lotes,
  calculo,
  fotoUrls,
}: {
  contrato: Contrato;
  empreendimento: Empreendimento;
  cliente: Cliente | null;
  lotes: ContratoLote[];
  calculo: ContratoCalculado;
  /** Até 3 fotos escolhidas em Admin > Empreendimentos (fotos_contrato_ids), ou a primeira da galeria. */
  fotoUrls: string[];
}) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const semCorrecao = contrato.indexador === "nenhum";
  const areaTotal = lotes.reduce((s, l) => s + Number(l.area_m2), 0);
  const temAreaConstruida = lotes.some((l) => l.area_construida_m2 != null);

  let secao = 0;
  const n = () => ++secao;

  // `rotulo` e `grupo` são duas chaves do catálogo mas uma coluna só na
  // folha: "Mensais 3/36" cabe numa célula e economiza largura que o A4 não
  // tem sobrando.
  const ativas = colunasAtivas(contrato.colunas_documento, "pdf", !semCorrecao);
  const colunas = montarColunas(ativas, calculo);
  const primeiroTotal = colunas.findIndex((c) => c.total !== undefined);
  const larguraRotulo = primeiroTotal < 0 ? colunas.length : primeiroTotal;

  return (
    <>
      <style>{estilo(empreendimento)}</style>

      <div className="barra-acao sem-impressao">
        <button className="btn-imprimir" onClick={() => window.print()}>
          <Printer size={15} /> Imprimir / salvar em PDF
        </button>
        <span className="dica">
          Na caixa de impressão: papel A4, margens padrão e &ldquo;Gráficos de
          fundo&rdquo; ligado.
        </span>
      </div>

      {calculo.temEstimativa && (
        <div className="alerta sem-impressao">
          Parte das parcelas ainda depende de meses sem índice lançado e está
          estimada. Lance os índices que faltam antes de entregar este
          demonstrativo ao cliente.
        </div>
      )}

      <article className="folha">
        <div className="topo" />

        <header className="cabecalho">
          {empreendimento.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="marca"
              src={empreendimento.logo_url}
              alt={empreendimento.nome}
            />
          )}
          <div className="titulo">
            <p className="eyebrow-p">
              {empreendimento.nome}
              {empreendimento.cidade
                ? ` · ${empreendimento.cidade}/${empreendimento.uf}`
                : ""}
            </p>
            <h1>Demonstrativo de pagamentos</h1>
            <p className="sub">
              {cliente?.nome ?? contrato.titulo ?? "—"}
              {cliente?.documento ? ` · ${cliente.documento}` : ""}
            </p>
          </div>
          <div className="protocolo">
            <p>
              <strong>{contrato.codigo}</strong>
            </p>
            <p>Contrato de {dataBR(contrato.data_contrato)}</p>
            <p>Posição em {hoje}</p>
          </div>
        </header>

        {/* ------------------------------------------------------- objeto */}
        <section>
          <h2>
            <span className="num-secao">{n()}</span> Objeto
          </h2>
          <table className="t">
            <thead>
              <tr>
                <th>Lote</th>
                <th className="d">Área do terreno</th>
                {temAreaConstruida && <th className="d">Área construída</th>}
                <th className="d">Valor</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>
                      Quadra {l.quadra} · Lote {l.numero}
                    </strong>
                  </td>
                  <td className="d">{area(Number(l.area_m2))}</td>
                  {temAreaConstruida && (
                    <td className="d">
                      {l.area_construida_m2 != null ? area(Number(l.area_construida_m2)) : "—"}
                    </td>
                  )}
                  <td className="d">{moeda(Number(l.valor))}</td>
                </tr>
              ))}
              {lotes.length === 0 && (
                <tr>
                  <td colSpan={temAreaConstruida ? 4 : 3}>{contrato.titulo ?? "—"}</td>
                </tr>
              )}
            </tbody>
            {lotes.length > 1 && (
              <tfoot>
                <tr>
                  <td>
                    {lotes.length} terrenos
                  </td>
                  <td className="d">{area(areaTotal)}</td>
                  {temAreaConstruida && <td className="d" />}
                  <td className="d">{moeda(Number(contrato.valor_total))}</td>
                </tr>
              </tfoot>
            )}
          </table>

          {empreendimento.mostrar_descricao_documento &&
            lotes.some((l) => l.descricao) && (
              <div style={{ marginTop: "2.5mm" }}>
                {lotes
                  .filter((l) => l.descricao)
                  .map((l) => (
                    <p key={l.id} className="texto">
                      <strong>Características:</strong> {l.descricao}
                    </p>
                  ))}
              </div>
            )}
        </section>

        {/* -------------------------------------------------------- foto */}
        {fotoUrls.length > 0 && (
          <section>
            <h2>
              <span className="num-secao">{n()}</span>{" "}
              {fotoUrls.length === 1 ? "Localização" : "Fotos"}
            </h2>
            <FotosDoDocumento
              slug={empreendimento.slug}
              lotes={lotes}
              urls={fotoUrls}
              corPreenchimento={empreendimento.cor_primaria}
              corContorno={empreendimento.cor_secundaria}
            />
          </section>
        )}

        {/* ------------------------------------------------- mapa de local */}
        {empreendimento.mostrar_localizacao_documento &&
          empreendimento.mapa_localizacao_url && (
            <section>
              <h2>
                <span className="num-secao">{n()}</span> Mapa de localização
              </h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={empreendimento.mapa_localizacao_url}
                alt="Mapa de localização"
                style={{
                  width: "100%",
                  maxHeight: "90mm",
                  objectFit: "contain",
                  borderRadius: "1.5mm",
                }}
              />
            </section>
          )}

        {/* ------------------------------------------------------ posição */}
        <section>
          <h2>
            <span className="num-secao">{n()}</span> Posição atual
          </h2>
          <div className="totais">
            <div>
              <span>Valor do contrato</span>
              <strong>{moeda(Number(contrato.valor_total))}</strong>
              <em>base {dataBR(contrato.data_base)}</em>
            </div>
            <div>
              <span>Já pago</span>
              <strong>{moeda(calculo.totalPago)}</strong>
              <em>
                {calculo.parcelasPagas} de {calculo.parcelasTotal} parcelas
              </em>
            </div>
            <div className="destaque-caixa">
              <span>Saldo a pagar</span>
              <strong>{moeda(calculo.saldoCorrigido)}</strong>
              <em>{semCorrecao ? "sem correção" : "já corrigido"}</em>
            </div>
            <div>
              <span>Próximo vencimento</span>
              <strong>
                {calculo.proxima ? moeda(calculo.proxima.valorCorrigido) : "—"}
              </strong>
              <em>
                {calculo.proxima
                  ? dataBR(calculo.proxima.vencimento)
                  : "contrato quitado"}
              </em>
            </div>
          </div>

          {calculo.vencidas.length > 0 && (
            <p className="atencao">
              Há {calculo.vencidas.length}{" "}
              {calculo.vencidas.length === 1 ? "parcela vencida" : "parcelas vencidas"},
              somando {moeda(calculo.totalVencido)} já com multa e juros de mora
              calculados até {hoje}.
            </p>
          )}
        </section>

        {/* --------------------------------------------------- cronograma */}
        <section>
          <h2>
            <span className="num-secao">{n()}</span> Cronograma
          </h2>

          {!semCorrecao && (
            <p className="nota">
              As parcelas são corrigidas pelo {ROTULO_INDEXADOR[contrato.indexador]},
              acumulado desde {dataBR(contrato.data_base)}, com defasagem de{" "}
              {contrato.defasagem_indice_meses}{" "}
              {contrato.defasagem_indice_meses === 1 ? "mês" : "meses"}.
              {ativas.has("fator") && ativas.has("valor_original") && (
                <>
                  {" "}
                  A coluna &ldquo;fator&rdquo; é o índice acumulado aplicado sobre
                  o valor de origem de cada parcela.
                </>
              )}
            </p>
          )}

          <table className="t t-mini">
            <thead>
              <tr>
                {colunas.map((c) => (
                  <th key={c.chave} className={c.numerica ? "d" : undefined}>
                    {c.cabecalho}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calculo.parcelas.map((p) => (
                <tr key={p.id} className={p.situacao === "vencida" ? "vencida" : ""}>
                  {colunas.map((c) => (
                    <td key={c.chave} className={c.numerica ? "d" : undefined}>
                      {c.celula(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={larguraRotulo}>Total do cronograma</td>
                {colunas.slice(larguraRotulo).map((c) => (
                  <td key={c.chave} className={c.numerica ? "d" : undefined}>
                    {c.total ?? ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>

          {!semCorrecao && ativas.has("fator") &&
            calculo.parcelas.some((p) => p.correcao.competencias.length) && (
            <p className="nota">
              A última parcela corrigida usa índices de{" "}
              {(() => {
                const comps = calculo.parcelas
                  .filter((p) => p.correcao.competencias.length)
                  .flatMap((p) => p.correcao.competencias);
                const ordenadas = [...new Set(comps)].sort();
                return `${rotuloCompetencia(ordenadas[0])} a ${rotuloCompetencia(
                  ordenadas[ordenadas.length - 1]
                )}`;
              })()}
              .
            </p>
          )}
        </section>

        <footer className="rodape">
          <p className="assinatura">
            {empreendimento.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="selo-rodape"
                src={empreendimento.logo_url}
                alt=""
              />
            )}
            {empreendimento.nome}
          </p>
          <p>
            Documento informativo, emitido em {hoje} a pedido do titular. Não
            substitui o contrato de compra e venda, não quita débitos e não vale
            como recibo — os valores em aberto são cobrados pelos boletos
            correspondentes.
          </p>
          <p>
            Parcelas vencidas estão acrescidas de multa e de juros de mora
            calculados até a data de emissão; quitações posteriores a esta data
            alteram os valores. Em caso de divergência, prevalece o contrato.
          </p>
        </footer>
      </article>
    </>
  );
}

/** Uma coluna do cronograma, já resolvida para esta folha. */
interface ColunaFolha {
  chave: string;
  cabecalho: string;
  numerica: boolean;
  celula: (p: ParcelaCalculada) => ReactNode;
  /** Preenchido só nas colunas que fecham no rodapé. */
  total?: ReactNode;
}

/**
 * Traduz o conjunto de chaves ativas na lista de colunas da folha.
 *
 * A ordem é a do catálogo, não a da escolha: o cronograma sempre lê da
 * esquerda para a direita na mesma sequência, tenha o contrato quatro
 * colunas ou oito.
 */
function montarColunas(
  ativas: Set<string>,
  calculo: ContratoCalculado
): ColunaFolha[] {
  const colunas: ColunaFolha[] = [];

  if (ativas.has("numero")) {
    colunas.push({
      chave: "numero",
      cabecalho: "#",
      numerica: false,
      celula: (p) => p.numero,
    });
  }

  // as duas chaves dividem uma célula só — ver o comentário na montagem
  const comRotulo = ativas.has("rotulo");
  const comGrupo = ativas.has("grupo");
  if (comRotulo || comGrupo) {
    colunas.push({
      chave: "rotulo",
      cabecalho: comRotulo ? "Parcela" : "Posição",
      numerica: false,
      celula: (p) => (
        <>
          {comRotulo && p.rotulo}
          {comGrupo && p.total_no_grupo > 1 && (
            <span className="indice">
              {comRotulo ? " " : ""}
              {p.indice}/{p.total_no_grupo}
            </span>
          )}
        </>
      ),
    });
  }

  if (ativas.has("vencimento")) {
    colunas.push({
      chave: "vencimento",
      cabecalho: "Vencimento",
      numerica: false,
      celula: (p) => dataBR(p.vencimento),
    });
  }

  if (ativas.has("valor_original")) {
    colunas.push({
      chave: "valor_original",
      cabecalho: "Valor de origem",
      numerica: true,
      celula: (p) => moeda(p.valor_original),
      total: moeda(calculo.totalOriginal),
    });
  }

  if (ativas.has("fator")) {
    colunas.push({
      chave: "fator",
      cabecalho: "Fator",
      numerica: true,
      celula: (p) => (p.indexada ? fator(p.correcao.fator) : "—"),
    });
  }

  if (ativas.has("valor_corrigido")) {
    colunas.push({
      chave: "valor_corrigido",
      cabecalho: "Valor corrigido",
      numerica: true,
      celula: (p) => <strong>{moeda(p.valorCorrigido)}</strong>,
      total: moeda(calculo.totalPago + calculo.saldoCorrigido),
    });
  }

  if (ativas.has("situacao")) {
    colunas.push({
      chave: "situacao",
      cabecalho: "Situação",
      numerica: false,
      celula: (p) => ROTULO_SITUACAO_PARCELA[p.situacao],
    });
  }

  if (ativas.has("pago_em")) {
    colunas.push({
      chave: "pago_em",
      cabecalho: "Pago em",
      numerica: true,
      celula: (p) => (p.pago_em ? dataBR(p.pago_em) : "—"),
    });
  }

  return colunas;
}

const estilo = (e: Empreendimento) => `
:root{
  --vinho:${e.cor_primaria}; --vinho-fraco:${clarear(e.cor_primaria, 0.9)};
  --ouro:${e.cor_secundaria}; --ouro-escuro:${escurecer(e.cor_secundaria, 0.3)};
  --tinta:#22201F; --cinza:#6B6662; --linha:#DDD7D1; --linha-forte:#C9C2BB;
  --papel:#F3F1EF; --verm:#96262C;
}
@page{ size:A4 portrait; margin:12mm 0 10mm; }

body{ background:#e9e6e2; }

.barra-acao{
  position:sticky; top:0; z-index:10;
  display:flex; align-items:center; gap:14px;
  padding:10px 16px; background:#fff; border-bottom:1px solid var(--linha);
}
.btn-imprimir{
  display:inline-flex; align-items:center; gap:7px;
  background:var(--vinho); color:#fff; border:none; border-radius:6px;
  padding:8px 14px; font-size:14px; font-weight:600; cursor:pointer;
}
.barra-acao .dica{ font-size:12px; color:var(--cinza); }

.alerta{
  max-width:210mm; margin:16px auto -8px; padding:12px 16px;
  background:#F7ECD8; color:#8A5B0B; border-radius:6px; font-size:13px;
  line-height:1.5;
}

.folha{
  width:210mm; min-height:297mm; margin:16px auto; background:#fff;
  padding:0 16mm 14mm; box-shadow:0 2px 18px rgba(0,0,0,.12);
  color:var(--tinta);
  font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;
  font-size:10pt; line-height:1.5;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}

.topo{ height:3.2mm; background:var(--vinho); margin:0 -16mm 6mm; }

.cabecalho{
  display:flex; justify-content:space-between; align-items:flex-end; gap:14mm;
  border-bottom:.6mm solid var(--vinho); padding-bottom:3mm; margin-bottom:7mm;
}
.cabecalho .marca{
  width:20mm; height:20mm; object-fit:cover; border-radius:1mm;
  align-self:flex-start; margin-right:5mm;
}
.cabecalho .titulo{ flex:1; }
.eyebrow-p{
  font-size:7.5pt; font-weight:bold; letter-spacing:.16em;
  text-transform:uppercase; color:var(--vinho); margin:0;
}
.cabecalho h1{ font-size:21pt; line-height:1.05; margin:1.5mm 0 0; letter-spacing:-.01em; }
.cabecalho .sub{ font-size:11pt; color:var(--cinza); margin:1.5mm 0 0; }
.protocolo{ text-align:right; font-size:8.5pt; color:var(--cinza); line-height:1.7; white-space:nowrap; }
.protocolo strong{ color:var(--vinho); font-size:11pt; letter-spacing:.04em; }
.protocolo p{ margin:0; }

section{ margin-bottom:7mm; }
h2{
  font-size:8.5pt; font-weight:bold; letter-spacing:.13em; text-transform:uppercase;
  color:#fff; background:var(--vinho); padding:1.6mm 3mm; margin:0 0 3.5mm;
  display:flex; align-items:center; gap:2mm;
}
h2 .num-secao{ color:var(--ouro); }

.t{ width:100%; border-collapse:collapse; font-size:9.5pt; }
.t th{
  text-align:left; font-size:7.5pt; letter-spacing:.09em; text-transform:uppercase;
  color:var(--cinza); font-weight:bold; padding:1.6mm 2mm;
  border-bottom:.4mm solid var(--linha-forte); background:var(--papel);
}
.t td{ padding:1.8mm 2mm; border-bottom:.25mm solid var(--linha); }
.t tfoot td{ border-top:.4mm solid var(--linha-forte); border-bottom:none; font-weight:bold; }
.t .d{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.t-mini{ font-size:8pt; }
.t-mini th, .t-mini td{ padding:1mm 1.6mm; }
.t-mini .indice{ color:var(--cinza); }
.t-mini tr.vencida td{ background:#F5E0E0; color:var(--verm); }

.totais{ display:flex; gap:3mm; margin-top:1mm; }
.totais > div{
  flex:1; border:.25mm solid var(--linha-forte); border-radius:1.5mm;
  padding:2.5mm 3mm; background:var(--papel);
}
.totais span{ display:block; font-size:7.5pt; letter-spacing:.09em; text-transform:uppercase; color:var(--cinza); font-weight:bold; }
.totais strong{ display:block; font-size:12.5pt; margin-top:1mm; font-variant-numeric:tabular-nums; }
.totais em{ display:block; font-size:7.5pt; color:var(--cinza); font-style:normal; margin-top:.6mm; }
.totais .destaque-caixa{ background:var(--vinho); border-color:var(--vinho); }
.totais .destaque-caixa span, .totais .destaque-caixa em{ color:#F0DCDA; }
.totais .destaque-caixa strong{ color:#fff; }

.nota{ color:var(--cinza); font-size:8.5pt; margin:0 0 3mm; }
.atencao{
  margin:4mm 0 0; padding:2.5mm 3mm; background:#F5E0E0; color:var(--verm);
  border-radius:1.5mm; font-size:9pt;
}

.rodape{
  border-top:.4mm solid var(--linha-forte); padding-top:3mm; margin-top:8mm;
  font-size:7.5pt; color:var(--cinza); line-height:1.55;
}
.rodape p{ margin:0 0 1.6mm; }
.rodape .assinatura{
  color:var(--vinho); font-weight:bold; letter-spacing:.06em; text-transform:uppercase;
  display:flex; align-items:center; gap:2mm;
}
.rodape .selo-rodape{ width:5mm; height:5mm; object-fit:cover; border-radius:.6mm; }

@media print{
  body{ background:#fff; }
  .sem-impressao{ display:none !important; }
  .folha{ width:auto; min-height:0; margin:0; padding:0 16mm; box-shadow:none; }
  .topo{ margin-top:-12mm; }
  /* o cronograma tem dezenas de linhas e precisa quebrar entre páginas;
     quem não pode partir no meio é a linha e o cabeçalho da tabela */
  .t-mini tr{ break-inside:avoid; }
  .t thead{ display:table-header-group; }
}
`;
