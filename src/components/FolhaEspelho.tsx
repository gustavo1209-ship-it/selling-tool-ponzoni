"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import type { Empreendimento, Lote } from "@/lib/db/tipos";
import { clarear, escurecer } from "@/lib/cores";
import { ROTULO_STATUS_LOTE, area, dataBR, moeda, moedaCurta, num, precoM2 } from "@/lib/formato";

const ROTULO: Record<string, string> = ROTULO_STATUS_LOTE;

const CLASSE_STATUS: Record<string, string> = {
  livre: "livre",
  reservado: "reservado",
  vendido: "vendido",
  projeto: "projeto",
  indisponivel: "indisponivel",
};

type ColunaOpcional =
  | "tipo"
  | "area"
  | "precoTabela"
  | "precoM2"
  | "status"
  | "comprador"
  | "observacao";

export default function FolhaEspelho({
  empreendimento,
  lotes,
  mostrarComprador,
  mostrarVgv,
}: {
  empreendimento: Empreendimento;
  lotes: Lote[];
  /** Por padrão só admin; Admin > Configurações pode liberar pro corretor. */
  mostrarComprador: boolean;
  /** Idem, pro cartão de VGV (`corretor_ve_vgv`). */
  mostrarVgv: boolean;
}) {
  const temTipo = lotes.some((l) => l.tipo);

  const colunasDisponiveis: { chave: ColunaOpcional; rotulo: string }[] = [
    ...(temTipo ? ([{ chave: "tipo", rotulo: "Tipo" }] as const) : []),
    { chave: "area", rotulo: "Área" },
    { chave: "precoTabela", rotulo: "Preço de tabela" },
    { chave: "precoM2", rotulo: "R$/m²" },
    { chave: "status", rotulo: "Status" },
    // comprador é dado da casa — a view já devolve null pra essa coluna
    // quando corretor_ve_comprador está desligada (migrations 28 e 38)
    ...(mostrarComprador ? ([{ chave: "comprador", rotulo: "Comprador" }] as const) : []),
    { chave: "observacao", rotulo: "Observação" },
  ];

  const [colunas, setColunas] = useState<Record<ColunaOpcional, boolean>>({
    tipo: true,
    area: true,
    precoTabela: true,
    precoM2: true,
    status: true,
    comprador: true,
    observacao: true,
  });

  const mostrar = (c: ColunaOpcional) =>
    colunas[c] && (c !== "comprador" || mostrarComprador) && (c !== "tipo" || temTipo);
  const livres = lotes.filter((l) => l.status === "livre");
  const resumo = {
    livre: livres.length,
    reservado: lotes.filter((l) => l.status === "reservado").length,
    vendido: lotes.filter((l) => l.status === "vendido").length,
    projeto: lotes.filter((l) => l.status === "projeto").length,
    indisponivel: lotes.filter((l) => l.status === "indisponivel").length,
    vgv: livres.reduce((s, l) => s + Number(l.preco_tabela ?? 0), 0),
    areaLivre: livres.reduce((s, l) => s + Number(l.area_m2), 0),
  };

  const hoje = new Date().toISOString().slice(0, 10);

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

      <div className="colunas sem-impressao">
        <span className="colunas-titulo">Colunas na impressão:</span>
        {colunasDisponiveis.map((c) => (
          <label key={c.chave} className="colunas-item">
            <input
              type="checkbox"
              checked={colunas[c.chave]}
              onChange={(e) =>
                setColunas((atual) => ({ ...atual, [c.chave]: e.target.checked }))
              }
            />
            {c.rotulo}
          </label>
        ))}
      </div>

      <article className="folha">
        <div className="topo" />
        <header className="cabecalho">
          {empreendimento.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="marca" src={empreendimento.logo_url} alt="" />
          )}
          <div className="titulo">
            <p className="eyebrow-p">Espelho de vendas</p>
            <h1>{empreendimento.nome}</h1>
          </div>
          <div className="protocolo">
            <p>
              <strong>{dataBR(hoje)}</strong>
            </p>
            <p>{lotes.length} lote(s) no total</p>
          </div>
        </header>

        <section className="resumo">
          {[
            ["Livres", resumo.livre],
            ["Reservados", resumo.reservado],
            ["Vendidos", resumo.vendido],
            ...(resumo.projeto > 0 ? ([["Em projeto", resumo.projeto]] as const) : []),
            ["Não disponíveis", resumo.indisponivel],
          ].map(([rotulo, valor]) => (
            <div key={rotulo as string} className="caixa">
              <span>{rotulo}</span>
              <strong>{valor}</strong>
            </div>
          ))}
          <div className="caixa">
            <span>Área livre</span>
            <strong>{num(resumo.areaLivre)} m²</strong>
          </div>
          {mostrarVgv && (
            <div className="caixa destaque">
              <span>VGV disponível</span>
              <strong>{moedaCurta(resumo.vgv)}</strong>
            </div>
          )}
        </section>

        <table className="t">
          <thead>
            <tr>
              <th>Lote</th>
              {mostrar("tipo") && <th>Tipo</th>}
              {mostrar("area") && <th className="d">Área</th>}
              {mostrar("precoTabela") && <th className="d">Preço de tabela</th>}
              {mostrar("precoM2") && <th className="d">R$/m²</th>}
              {mostrar("status") && <th>Status</th>}
              {mostrar("comprador") && <th>Comprador</th>}
              {mostrar("observacao") && <th>Observação</th>}
            </tr>
          </thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={l.id}>
                <td className="forte">
                  {l.quadra}-{l.numero}
                </td>
                {mostrar("tipo") && <td className="fraco">{l.tipo ?? "—"}</td>}
                {mostrar("area") && <td className="d">{area(Number(l.area_m2))}</td>}
                {mostrar("precoTabela") && (
                  <td className="d">
                    {l.preco_tabela ? moeda(Number(l.preco_tabela)) : "—"}
                  </td>
                )}
                {mostrar("precoM2") && (
                  <td className="d fraco">
                    {l.preco_tabela
                      ? precoM2(Number(l.preco_tabela) / Number(l.area_m2))
                      : "—"}
                  </td>
                )}
                {mostrar("status") && (
                  <td>
                    <span className={`selo-status ${CLASSE_STATUS[l.status] ?? ""}`}>
                      {ROTULO[l.status] ?? l.status}
                    </span>
                  </td>
                )}
                {mostrar("comprador") && (
                  <td className="fraco">{l.comprador ?? "—"}</td>
                )}
                {mostrar("observacao") && (
                  <td className="fraco">{l.observacao ?? "—"}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="rodape">
          <p>
            {empreendimento.nome} · espelho de vendas emitido em {dataBR(hoje)}. O
            status é o mesmo mantido na ferramenta e no Google Sheets de
            origem.
          </p>
        </footer>
      </article>
    </>
  );
}

const estilo = (e: Empreendimento) => `
:root{
  --vinho:${e.cor_primaria}; --vinho-fraco:${clarear(e.cor_primaria, 0.9)};
  --ouro:${e.cor_secundaria}; --ouro-escuro:${escurecer(e.cor_secundaria, 0.3)};
  --tinta:#22201F; --cinza:#6B6662; --linha:#DDD7D1; --linha-forte:#C9C2BB;
  --papel:#F3F1EF;
  --verde:#276B4C; --verde-fraco:#E0EDE5;
  --ambar:#8A5B0B; --ambar-fraco:#F7ECD8;
  --vermelho:#96262C; --vermelho-fraco:#F5E0E0;
  --roxo:#5B2166; --roxo-fraco:#EFE4F2;
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

.colunas{
  display:flex; flex-wrap:wrap; align-items:center; gap:4px 14px;
  padding:8px 16px; background:#fff; border-bottom:1px solid var(--linha);
  font-size:12.5px; color:var(--cinza);
}
.colunas-titulo{ font-weight:600; color:var(--tinta); }
.colunas-item{ display:inline-flex; align-items:center; gap:5px; cursor:pointer; }

.folha{
  width:210mm; min-height:297mm; margin:16px auto; background:#fff;
  padding:0 16mm 14mm; color:var(--tinta);
  font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;
  font-size:9.5pt; line-height:1.5;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}

.topo{ height:3.2mm; background:var(--vinho); margin:0 -16mm 6mm; }

.cabecalho{
  display:flex; justify-content:space-between; align-items:flex-end; gap:14mm;
  border-bottom:.6mm solid var(--vinho); padding-bottom:3mm; margin-bottom:6mm;
}
.cabecalho .marca{
  width:18mm; height:18mm; object-fit:cover; border-radius:1mm;
  align-self:flex-start; margin-right:5mm;
}
.cabecalho .titulo{ flex:1; }
.eyebrow-p{
  font-size:7.5pt; font-weight:bold; letter-spacing:.16em;
  text-transform:uppercase; color:var(--vinho); margin:0;
}
.cabecalho h1{ font-size:21pt; line-height:1.05; margin:1.5mm 0 0; letter-spacing:-.01em; }
.protocolo{ text-align:right; font-size:8.5pt; color:var(--cinza); line-height:1.7; white-space:nowrap; }
.protocolo strong{ color:var(--vinho); font-size:11pt; letter-spacing:.04em; }
.protocolo p{ margin:0; }

.resumo{ display:flex; flex-wrap:wrap; gap:2.5mm; margin-bottom:6mm; }
.resumo .caixa{
  flex:1; min-width:26mm; border:.25mm solid var(--linha-forte); border-radius:1.5mm;
  padding:2mm 2.6mm; background:var(--papel);
}
.resumo .caixa span{
  display:block; font-size:6.8pt; letter-spacing:.08em; text-transform:uppercase;
  color:var(--cinza); font-weight:bold;
}
.resumo .caixa strong{ display:block; font-size:12.5pt; margin-top:.8mm; font-variant-numeric:tabular-nums; }
.resumo .caixa.destaque{ background:var(--vinho); border-color:var(--vinho); }
.resumo .caixa.destaque span{ color:#F0DCDA; }
.resumo .caixa.destaque strong{ color:#fff; }

.t{ width:100%; border-collapse:collapse; font-size:9pt; }
.t thead{ display:table-header-group; }
.t th{
  text-align:left; font-size:7.2pt; letter-spacing:.08em; text-transform:uppercase;
  color:var(--cinza); font-weight:bold; padding:1.6mm 2mm;
  border-bottom:.4mm solid var(--linha-forte); background:var(--papel);
}
.t td{ padding:1.5mm 2mm; border-bottom:.25mm solid var(--linha); }
.t tr{ break-inside:avoid; }
.t .d{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.t .forte{ font-weight:bold; white-space:nowrap; }
.t .fraco{ color:var(--cinza); }

.selo-status{
  display:inline-block; border-radius:1mm; padding:.5mm 1.8mm; font-size:7.5pt;
  font-weight:bold; white-space:nowrap;
}
.selo-status.livre{ background:var(--verde-fraco); color:var(--verde); }
.selo-status.reservado{ background:var(--ambar-fraco); color:var(--ambar); }
.selo-status.vendido{ background:var(--vermelho-fraco); color:var(--vermelho); }
.selo-status.projeto{ background:var(--roxo-fraco); color:var(--roxo); }
.selo-status.indisponivel{ background:var(--papel); color:var(--cinza); }

.rodape{
  border-top:.4mm solid var(--linha-forte); padding-top:3mm; margin-top:6mm;
  font-size:7.5pt; color:var(--cinza); line-height:1.55;
}
.rodape p{ margin:0; }

@media print{
  body{ background:#fff; }
  .sem-impressao{ display:none !important; }
  .folha{ width:auto; min-height:0; margin:0; padding:0 16mm; box-shadow:none; }
  .topo{ margin-top:-12mm; }
}
`;
