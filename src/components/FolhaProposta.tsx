"use client";

import { Printer } from "lucide-react";
import type { Resultado } from "@/lib/calc/tipos";
import type { Cliente, Empreendimento, Proposta, PropostaLote } from "@/lib/db/tipos";
import { area, dataBR, moeda, num, pct, precoM2, rotuloMes } from "@/lib/formato";

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

  const correcao =
    bloco.indexador !== "nenhum" && bloco.amortizacao === "nenhuma"
      ? " corrigidas pelo INCC"
      : "";

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

export default function FolhaProposta({
  proposta,
  empreendimento,
  cliente,
  lotes,
  resultado,
}: {
  proposta: Proposta;
  empreendimento: Empreendimento;
  cliente: Cliente | null;
  lotes: PropostaLote[];
  resultado: Resultado;
}) {
  const validade = new Date(`${proposta.data_base}T12:00:00`);
  validade.setDate(validade.getDate() + proposta.validade_dias);

  const temDesconto = resultado.descontoValor > 0.5;
  const vencimentos = resultado.fluxo.filter((f) => f.mes > 0);
  const colunas = 3;
  const porColuna = Math.ceil(vencimentos.length / colunas);

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

      <article className="folha">
        <div className="topo" />

        <header className="cabecalho">
          <div>
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
            <span className="num-secao">1</span> Objeto da proposta
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
                <td className="d">{area(resultado.areaTotal)}</td>
                <td className="d">{precoM2(resultado.precoM2Negociado)}</td>
                <td className="d">
                  {moeda(lotes.reduce((s, l) => s + Number(l.valor_negociado), 0))}
                </td>
              </tr>
            </tfoot>
          </table>

          {temDesconto && (
            <table className="t t-resumo">
              <tbody>
                <tr>
                  <td>Valor de tabela</td>
                  <td className="d">{moeda(resultado.valorTabela)}</td>
                </tr>
                <tr>
                  <td>
                    Condição especial desta proposta
                    {proposta.desconto_motivo ? ` — ${proposta.desconto_motivo}` : ""}
                  </td>
                  <td className="d desconto">
                    − {moeda(resultado.descontoValor)} ({pct(resultado.descontoEfetivoPct, 2)})
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
        </section>

        {/* ---------------------------------------------------- pagamento */}
        <section>
          <h2>
            <span className="num-secao">2</span> Condições de pagamento
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

          <div className="totais">
            <div>
              <span>Entrada</span>
              <strong>{moeda(resultado.entrada)}</strong>
              <em>{pct(resultado.entradaPct, 1)} do valor</em>
            </div>
            <div>
              <span>Prazo total</span>
              <strong>{resultado.prazoMeses} meses</strong>
              <em>{vencimentos.length} vencimentos</em>
            </div>
            <div>
              <span>Maior parcela</span>
              <strong>{moeda(resultado.maiorParcela)}</strong>
              <em>no mês de maior soma</em>
            </div>
            <div className="destaque-caixa">
              <span>Total do investimento</span>
              <strong>{moeda(resultado.totalNominal)}</strong>
              <em>valor nominal, já com correção projetada</em>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- observações */}
        {proposta.observacoes && (
          <section>
            <h2>
              <span className="num-secao">3</span> Observações
            </h2>
            <p className="texto">{proposta.observacoes}</p>
          </section>
        )}

        {/* ---------------------------------------------------- cronograma */}
        {vencimentos.length > 0 && (
          <section className="quebra">
            <h2>
              <span className="num-secao">{proposta.observacoes ? 4 : 3}</span> Cronograma de
              vencimentos
            </h2>
            <p className="texto nota">
              Valores projetados com correção de {pct(Number(proposta.incc_mensal), 3)} ao mês
              (INCC estimado). As parcelas indexadas são reajustadas pelo índice efetivamente
              apurado.
            </p>

            <div className="cronograma">
              {Array.from({ length: colunas }, (_, c) => (
                <table className="t t-mini" key={c}>
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Venc.</th>
                      <th className="d">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vencimentos.slice(c * porColuna, (c + 1) * porColuna).map((f) => (
                      <tr key={f.mes}>
                        <td>{f.mes}</td>
                        <td>{rotuloMes(f.mes, proposta.data_base)}</td>
                        <td className="d">{num(f.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
            </div>
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
}
h2 .num-secao{ color:var(--ouro); margin-right:2mm; }

.t{ width:100%; border-collapse:collapse; font-size:9.5pt; }
.t th{
  text-align:left; font-size:7.5pt; letter-spacing:.09em; text-transform:uppercase;
  color:var(--cinza); font-weight:bold; padding:1.6mm 2mm;
  border-bottom:.4mm solid var(--linha-forte); background:var(--papel);
}
.t td{ padding:1.8mm 2mm; border-bottom:.25mm solid var(--linha); }
.t tfoot td{ border-top:.4mm solid var(--linha-forte); border-bottom:none; font-weight:bold; }
.t .d{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }

.t-resumo{ margin-top:4mm; }
.t-resumo td{ border-bottom:none; padding:1.2mm 2mm; }
.t-resumo .desconto{ color:var(--verm); }
.t-resumo tfoot .destaque td{
  background:var(--vinho-fraco); color:var(--vinho); font-size:11pt;
  padding:2.4mm 2mm; border-top:.5mm solid var(--vinho);
}

.blocos{ list-style:none; margin:0; padding:0; counter-reset:b; }
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

.texto{ margin:0; font-size:9.5pt; white-space:pre-wrap; }
.nota{ color:var(--cinza); font-size:8.5pt; margin-bottom:3mm; }

.quebra{ break-before:page; }
.cronograma{ display:flex; gap:4mm; align-items:flex-start; }
.t-mini{ font-size:8pt; }
.t-mini th, .t-mini td{ padding:.9mm 1.6mm; }

.rodape{
  border-top:.4mm solid var(--linha-forte); padding-top:3mm; margin-top:8mm;
  font-size:7.5pt; color:var(--cinza); line-height:1.55;
}
.rodape p{ margin:0 0 1.6mm; }
.rodape .assinatura{ color:var(--vinho); font-weight:bold; letter-spacing:.06em; text-transform:uppercase; }

@media print{
  body{ background:#fff; }
  .sem-impressao{ display:none !important; }
  .folha{ width:auto; min-height:0; margin:0; padding:0 16mm; box-shadow:none; }
  .topo{ margin-top:-12mm; }
  section{ break-inside:avoid; }
}
`;
