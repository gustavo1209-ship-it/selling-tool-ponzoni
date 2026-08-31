"use client";

import { AlertTriangle, Printer } from "lucide-react";
import MapaDaProposta from "./MapaDaProposta";
import type { MetricaParcela, Resultado } from "@/lib/calc/tipos";
import type {
  Cliente,
  Empreendimento,
  Proposta,
  PropostaCenario,
  PropostaLote,
} from "@/lib/db/tipos";
import { valorDaMetrica } from "@/lib/calc";
import {
  adjetivoPeriodicidade,
  NOTA_METRICA_PARCELA,
  ROTULO_INDEXADOR,
  ROTULO_METRICA_PARCELA,
  area,
  dataBR,
  moeda,
  num,
  pct,
  precoM2,
  rotuloMes,
} from "@/lib/formato";

export interface Opcao {
  cenario: PropostaCenario;
  resultado: Resultado;
}

/** Frase de venda de um bloco, do jeito que se lê em voz alta. */
function descreverBloco(
  b: Resultado["blocos"][number],
  dataBase: string
): { titulo: string; detalhe: string; valor: string } {
  const { bloco, parcelas, primeiraParcela, ultimaParcela, totalNominal } = b;
  const n = parcelas.length;
  const venc = rotuloMes(bloco.mes_inicio, dataBase);

  if (bloco.mes_inicio === 0 && n === 1) {
    return {
      titulo: bloco.rotulo,
      detalhe: "pagamento no ato da assinatura",
      valor: moeda(primeiraParcela),
    };
  }

  const passo = bloco.periodicidade_meses || 1;
  const cadencia = adjetivoPeriodicidade(passo);
  const correcao =
    bloco.indexador !== "nenhum" && bloco.amortizacao === "nenhuma"
      ? ` corrigidas pelo ${ROTULO_INDEXADOR[bloco.indexador]}`
      : "";

  // reforço periódico: o que faz a mensal caber no bolso do cliente
  if (passo > 1) {
    return {
      titulo: bloco.rotulo,
      detalhe: `${n} reforços ${cadencia}${correcao}, o primeiro em ${venc} e o último em ${rotuloMes(bloco.mes_inicio + (n - 1) * passo, dataBase)}. ${
        correcao ? `O primeiro de ${moeda(primeiraParcela)} e o último de ${moeda(ultimaParcela)}.` : `De ${moeda(primeiraParcela)} cada.`
      }`,
      valor: moeda(totalNominal),
    };
  }

  if (bloco.amortizacao === "sac") {
    return {
      titulo: bloco.rotulo,
      detalhe: `${n} parcelas mensais pelo sistema SAC, a partir de ${venc}. A primeira de ${moeda(primeiraParcela)} e a última de ${moeda(ultimaParcela)} — a parcela cai todo mês.`,
      valor: moeda(totalNominal),
    };
  }

  if (bloco.amortizacao === "price") {
    return {
      titulo: bloco.rotulo,
      detalhe: `${n} parcelas mensais fixas de ${moeda(primeiraParcela)} (Tabela Price), a partir de ${venc}.`,
      valor: moeda(totalNominal),
    };
  }

  if (bloco.amortizacao === "americano") {
    return {
      titulo: bloco.rotulo,
      detalhe: `${n - 1} parcelas de juros de ${moeda(primeiraParcela)} e quitação do principal em ${rotuloMes(bloco.mes_inicio + n - 1, dataBase)}.`,
      valor: moeda(totalNominal),
    };
  }

  if (n === 1) {
    return {
      titulo: bloco.rotulo,
      detalhe: `parcela única com vencimento em ${venc}`,
      valor: moeda(primeiraParcela),
    };
  }

  return {
    titulo: bloco.rotulo,
    detalhe: `${n} parcelas mensais${correcao}, a partir de ${venc}. A primeira de ${moeda(primeiraParcela)}${correcao ? ` e a última de ${moeda(ultimaParcela)}` : ""}.`,
    valor: moeda(totalNominal),
  };
}

function Cronograma({
  resultado,
  dataBase,
}: {
  resultado: Resultado;
  dataBase: string;
}) {
  const vencimentos = resultado.fluxo.filter((f) => f.mes > 0);
  if (vencimentos.length === 0) return null;
  const colunas = 3;
  const porColuna = Math.ceil(vencimentos.length / colunas);

  return (
    <div className="cronograma">
      {Array.from({ length: colunas }, (_, c) => {
        const fatia = vencimentos.slice(c * porColuna, (c + 1) * porColuna);
        if (fatia.length === 0) return <div key={c} style={{ flex: 1 }} />;
        return (
          <table className="t t-mini" key={c}>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Venc.</th>
                <th className="d">Valor</th>
              </tr>
            </thead>
            <tbody>
              {fatia.map((f) => (
                <tr key={f.mes}>
                  <td>{f.mes}</td>
                  <td>{rotuloMes(f.mes, dataBase)}</td>
                  <td className="d">{num(f.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}

export default function FolhaProposta({
  proposta,
  empreendimento,
  cliente,
  lotes,
  opcoes,
}: {
  proposta: Proposta;
  empreendimento: Empreendimento;
  cliente: Cliente | null;
  lotes: PropostaLote[];
  opcoes: Opcao[];
}) {
  const validade = new Date(`${proposta.data_base}T12:00:00`);
  validade.setDate(validade.getDate() + proposta.validade_dias);

  const varias = opcoes.length > 1;
  const referencia = opcoes.find((o) => o.cenario.recomendado) ?? opcoes[0];
  const somaLotes = lotes.reduce((s, l) => s + Number(l.valor_negociado), 0);

  // uma opção cujos blocos não somam o valor negociado não pode ir para o
  // cliente sem que o vendedor veja; o aviso fica só na tela, não no papel
  const naoFecham = opcoes.filter(
    (o) => Math.abs(o.resultado.residuo) >= 0.5
  );

  const metricas: MetricaParcela[] = proposta.metricas_parcela?.length
    ? proposta.metricas_parcela
    : ["inicial"];

  let secao = 0;
  const n = () => ++secao;

  return (
    <>
      <style>{estilo}</style>

      <div className="barra-acao sem-impressao">
        <button className="btn-imprimir" onClick={() => window.print()}>
          <Printer size={15} /> Imprimir / salvar em PDF
        </button>
        <span className="dica">
          Na caixa de impressão: papel A4, margens padrão e &ldquo;Gráficos de fundo&rdquo; ligado.
        </span>
      </div>

      {naoFecham.length > 0 && (
        <div className="alerta sem-impressao">
          <AlertTriangle size={17} />
          <div>
            <strong>
              {naoFecham.length === 1
                ? "Uma opção não fecha a conta."
                : `${naoFecham.length} opções não fecham a conta.`}
            </strong>{" "}
            Os blocos não somam o valor negociado, então o cronograma abaixo não
            quita o terreno. Volte ao simulador e use &ldquo;Fechar a conta&rdquo;
            antes de enviar.
            <ul>
              {naoFecham.map(({ cenario, resultado }) => (
                <li key={cenario.id}>
                  {cenario.nome}:{" "}
                  {resultado.residuo > 0
                    ? `faltam ${moeda(resultado.residuo)}`
                    : `sobram ${moeda(Math.abs(resultado.residuo))}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <article className="folha">
        <div className="topo" />

        <header className="cabecalho">
          {empreendimento.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="marca" src={empreendimento.logo_url} alt={empreendimento.nome} />
          )}
          <div className="titulo">
            <p className="eyebrow-p">
              {empreendimento.nome}
              {empreendimento.cidade ? ` · ${empreendimento.cidade}/${empreendimento.uf}` : ""}
            </p>
            <h1>Proposta comercial</h1>
            <p className="sub">
              {cliente?.nome ?? proposta.titulo ?? "—"}
              {cliente?.empresa ? ` · ${cliente.empresa}` : ""}
            </p>
          </div>
          <div className="protocolo">
            <p>
              <strong>{proposta.codigo}</strong>
            </p>
            <p>Emitida em {dataBR(proposta.data_base)}</p>
            <p>Válida até {validade.toLocaleDateString("pt-BR")}</p>
          </div>
        </header>

        {/* ------------------------------------------------------- terrenos */}
        <section>
          <h2>
            <span className="num-secao">{n()}</span> Objeto da proposta
          </h2>

          <table className="t">
            <thead>
              <tr>
                <th>Lote</th>
                <th className="d">Área</th>
                <th className="d">R$/m²</th>
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
                  <td className="d">
                    {precoM2(Number(l.valor_negociado) / Number(l.area_m2))}
                  </td>
                  <td className="d">{moeda(Number(l.valor_negociado))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  {lotes.length} {lotes.length === 1 ? "terreno" : "terrenos"}
                </td>
                <td className="d">{area(referencia?.resultado.areaTotal ?? 0)}</td>
                <td className="d">
                  {precoM2(somaLotes / (referencia?.resultado.areaTotal || 1))}
                </td>
                <td className="d">{moeda(somaLotes)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ----------------------------------------------------------- mapa */}
        {empreendimento.mapa_imagem_url && (
          <section>
            <h2>
              <span className="num-secao">{n()}</span> Localização no parque
            </h2>
            <MapaDaProposta
              lotes={lotes}
              imagem={empreendimento.mapa_imagem_url}
            />
            <p className="texto nota" style={{ marginTop: "2.5mm" }}>
              Em destaque, {lotes.length === 1 ? "o lote desta proposta" : "os lotes desta proposta"}.
              Os demais contornos são as divisas do parque e não indicam
              disponibilidade.
            </p>
          </section>
        )}

        {/* --------------------------------------------------- comparativo */}
        {varias && (
          <section>
            <h2>
              <span className="num-secao">{n()}</span> Opções de pagamento
            </h2>
            <p className="texto nota">
              As {opcoes.length} opções abaixo se referem aos mesmos terrenos. Mudam a
              entrada, o prazo e o preço final.
            </p>
            <table className="t">
              <thead>
                <tr>
                  <th>Opção</th>
                  <th className="d">Entrada</th>
                  <th className="d">Parcelas</th>
                  {metricas.map((m) => (
                    <th key={m} className="d">
                      {ROTULO_METRICA_PARCELA[m]}
                    </th>
                  ))}
                  <th className="d">Valor da proposta</th>
                </tr>
              </thead>
              <tbody>
                {opcoes.map(({ cenario, resultado }) => (
                  <tr key={cenario.id} className={cenario.recomendado ? "recomendada" : ""}>
                    <td>
                      <strong>{cenario.nome}</strong>
                      {cenario.recomendado && <span className="tag">recomendada</span>}
                    </td>
                    <td className="d">{moeda(resultado.entrada)}</td>
                    <td className="d">
                      {resultado.prazoMeses > 0 ? `${resultado.prazoMeses} meses` : "—"}
                    </td>
                    {metricas.map((m) => {
                      const v = valorDaMetrica(resultado, m);
                      return (
                        <td key={m} className="d">
                          {v > 0 ? moeda(v) : "—"}
                        </td>
                      );
                    })}
                    <td className="d">{moeda(resultado.valorNegociado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ------------------------------------------------ cada opção */}
        {opcoes.map(({ cenario, resultado }, idx) => {
          const temDesconto = resultado.descontoValor > 0.5;
          const vencimentos = resultado.fluxo.filter((f) => f.mes > 0);
          return (
            <section key={cenario.id} className={varias && idx > 0 ? "quebra-leve" : ""}>
              <h2>
                <span className="num-secao">{varias ? "" : n()}</span>
                {varias ? cenario.nome : "Condições de pagamento"}
                {varias && cenario.recomendado && (
                  <span className="tag-h2">recomendada</span>
                )}
              </h2>

              <ol className="blocos">
                {resultado.blocos.map((b) => {
                  const d = descreverBloco(b, proposta.data_base);
                  return (
                    <li key={b.bloco.id}>
                      <div className="bloco-topo">
                        <strong>{d.titulo}</strong>
                        <span className="bloco-valor">{d.valor}</span>
                      </div>
                      <p>{d.detalhe}</p>
                    </li>
                  );
                })}
              </ol>

              {temDesconto && (
                <table className="t t-resumo">
                  <tbody>
                    <tr>
                      <td>Valor de tabela</td>
                      <td className="d">{moeda(resultado.valorTabela)}</td>
                    </tr>
                    <tr>
                      <td>
                        Condição especial desta opção
                        {cenario.desconto_motivo ? ` — ${cenario.desconto_motivo}` : ""}
                      </td>
                      <td className="d desconto">
                        − {moeda(resultado.descontoValor)} (
                        {pct(resultado.descontoEfetivoPct, 2)})
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="destaque">
                      <td>Valor da proposta</td>
                      <td className="d">{moeda(resultado.valorNegociado)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}

              <div className="totais">
                <div>
                  <span>Entrada</span>
                  <strong>{moeda(resultado.entrada)}</strong>
                  <em>{pct(resultado.entradaPct, 1)} do valor</em>
                </div>
                <div>
                  <span>Prazo total</span>
                  <strong>
                    {resultado.prazoMeses > 0 ? `${resultado.prazoMeses} meses` : "à vista"}
                  </strong>
                  <em>{vencimentos.length} vencimentos</em>
                </div>
                {metricas.map((m) => {
                  const v = valorDaMetrica(resultado, m);
                  return (
                    <div key={m}>
                      <span>{ROTULO_METRICA_PARCELA[m]}</span>
                      <strong>{v > 0 ? moeda(v) : "—"}</strong>
                      <em>{NOTA_METRICA_PARCELA[m]}</em>
                    </div>
                  );
                })}
                <div className="destaque-caixa">
                  <span>Total do investimento</span>
                  <strong>{moeda(resultado.totalNominal)}</strong>
                  <em>valor nominal, já com correção projetada</em>
                </div>
              </div>
            </section>
          );
        })}

        {/* ---------------------------------------------------- observações */}
        {proposta.observacoes && (
          <section>
            <h2>
              <span className="num-secao">{n()}</span> Observações
            </h2>
            <p className="texto">{proposta.observacoes}</p>
          </section>
        )}

        {/* ---------------------------------------------------- cronogramas */}
        {opcoes.some((o) => o.resultado.fluxo.some((f) => f.mes > 0)) && (
          <section className="quebra">
            <h2>
              <span className="num-secao">{n()}</span> Cronograma de vencimentos
            </h2>
            <p className="texto nota">
              Valores projetados com a correção informada em cada bloco (padrão:{" "}
              {pct(Number(proposta.incc_mensal), 3)} ao mês). As parcelas indexadas são
              reajustadas pelo índice efetivamente apurado no período.
            </p>

            {opcoes.map(({ cenario, resultado }) => {
              if (!resultado.fluxo.some((f) => f.mes > 0)) return null;
              return (
                <div key={cenario.id} className="crono-bloco">
                  {varias && <h3>{cenario.nome}</h3>}
                  <Cronograma resultado={resultado} dataBase={proposta.data_base} />
                </div>
              );
            })}
          </section>
        )}

        <footer className="rodape">
          <p>
            Esta proposta é uma simulação comercial e <strong>não constitui reserva do
            imóvel nem vinculação contratual</strong>. A reserva se dá por instrumento
            próprio e a venda fica sujeita à aprovação da diretoria e, quando houver
            financiamento, à análise de crédito da instituição financeira.
          </p>
          <p>
            Parcelas indicadas como corrigidas são reajustadas mensalmente pelo INCC; os
            valores acima usam a projeção informada e podem variar. Proposta válida até{" "}
            {validade.toLocaleDateString("pt-BR")}.
          </p>
          <p className="assinatura">
            {empreendimento.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="selo-rodape" src={empreendimento.logo_url} alt="" />
            )}
            {empreendimento.nome} · {proposta.codigo} · emitida em{" "}
            {dataBR(proposta.data_base)}
          </p>
        </footer>
      </article>
    </>
  );
}

const estilo = `
:root{
  --vinho:#7C2A28; --vinho-fraco:#F4E7E5; --ouro:#E0A221; --ouro-escuro:#A3730F;
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
  display:flex; gap:10px; align-items:flex-start;
  max-width:210mm; margin:16px auto -8px; padding:12px 16px;
  background:#F7ECD8; color:#8A5B0B; border-radius:6px; font-size:13px;
  line-height:1.5;
}
.alerta ul{ margin:6px 0 0; padding-left:18px; }

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
.cabecalho h1{ font-size:23pt; line-height:1.05; margin:1.5mm 0 0; letter-spacing:-.01em; }
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
h2 .tag-h2{
  margin-left:auto; background:var(--ouro); color:#3a2a06;
  border-radius:1mm; padding:.4mm 1.8mm; font-size:7pt; letter-spacing:.1em;
}

h3{ font-size:9.5pt; margin:0 0 2mm; color:var(--vinho); }

.t{ width:100%; border-collapse:collapse; font-size:9.5pt; }
.t th{
  text-align:left; font-size:7.5pt; letter-spacing:.09em; text-transform:uppercase;
  color:var(--cinza); font-weight:bold; padding:1.6mm 2mm;
  border-bottom:.4mm solid var(--linha-forte); background:var(--papel);
}
.t td{ padding:1.8mm 2mm; border-bottom:.25mm solid var(--linha); }
.t tfoot td{ border-top:.4mm solid var(--linha-forte); border-bottom:none; font-weight:bold; }
.t .d{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.t .recomendada td{ background:var(--vinho-fraco); }
.t .tag{
  display:inline-block; margin-left:2mm; background:var(--ouro); color:#3a2a06;
  border-radius:1mm; padding:.2mm 1.4mm; font-size:6.5pt; font-weight:bold;
  letter-spacing:.08em; text-transform:uppercase; vertical-align:1px;
}

.t-resumo{ margin-top:4mm; }
.t-resumo td{ border-bottom:none; padding:1.2mm 2mm; }
.t-resumo .desconto{ color:var(--verm); }
.t-resumo tfoot .destaque td{
  background:var(--vinho-fraco); color:var(--vinho); font-size:11pt;
  padding:2.4mm 2mm; border-top:.5mm solid var(--vinho);
}

.blocos{ list-style:none; margin:0; padding:0; }
.blocos li{
  border-left:.9mm solid var(--ouro); padding:0 0 0 3.5mm; margin-bottom:3.5mm;
}
.bloco-topo{ display:flex; justify-content:space-between; gap:6mm; align-items:baseline; }
.bloco-topo strong{ font-size:10.5pt; }
.bloco-valor{
  font-variant-numeric:tabular-nums; font-weight:bold; color:var(--vinho); white-space:nowrap;
}
.blocos p{ margin:.6mm 0 0; font-size:9pt; color:var(--cinza); }

.totais{ display:flex; gap:3mm; margin-top:5mm; }
.totais > div{
  flex:1; border:.25mm solid var(--linha-forte); border-radius:1.5mm;
  padding:2.5mm 3mm; background:var(--papel);
}
.totais span{ display:block; font-size:7.5pt; letter-spacing:.09em; text-transform:uppercase; color:var(--cinza); font-weight:bold; }
.totais strong{ display:block; font-size:13pt; margin-top:1mm; font-variant-numeric:tabular-nums; }
.totais em{ display:block; font-size:7.5pt; color:var(--cinza); font-style:normal; margin-top:.6mm; }
.totais .destaque-caixa{ background:var(--vinho); border-color:var(--vinho); }
.totais .destaque-caixa span, .totais .destaque-caixa em{ color:#F0DCDA; }
.totais .destaque-caixa strong{ color:#fff; }

.mapa-proposta{ position:relative; }
.mapa-principal{
  display:block; width:100%; height:auto; aspect-ratio:16/9;
  border-radius:1.5mm; overflow:hidden; background:var(--papel);
}
.mapa-mini{
  position:absolute; right:3mm; bottom:3mm;
  width:34mm; height:auto; aspect-ratio:3192/1858;
  border:.5mm solid #fff; border-radius:1mm;
  box-shadow:0 1mm 3mm rgba(0,0,0,.35);
}

.texto{ margin:0; font-size:9.5pt; white-space:pre-wrap; }
.nota{ color:var(--cinza); font-size:8.5pt; margin-bottom:3mm; }

.quebra{ break-before:page; }
.crono-bloco{ margin-bottom:5mm; break-inside:avoid; }
.cronograma{ display:flex; gap:4mm; align-items:flex-start; }
.t-mini{ font-size:8pt; }
.t-mini th, .t-mini td{ padding:.9mm 1.6mm; }

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
  section{ break-inside:avoid; }
  .quebra-leve{ break-inside:avoid; }
}
`;
