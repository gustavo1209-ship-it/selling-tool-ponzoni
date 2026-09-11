import { redirect } from "next/navigation";
import Cabecalho from "@/components/Cabecalho";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/supabase/perfil";
import { hojeISO, paraData } from "@/lib/contratos/mes";
import { dataBR } from "@/lib/formato";

export const dynamic = "force-dynamic";

interface Contagem {
  clientes: number;
  propostas: number;
  contratos: number;
  perdidos: number;
}

interface Linha extends Contagem {
  id: string;
  nome: string;
  papel: string;
}

const ZERO: Contagem = { clientes: 0, propostas: 0, contratos: 0, perdidos: 0 };

/** "2026-09-15" menos `n` dias, são seguro contra virada de mês/ano. */
function diasAntes(iso: string, n: number): string {
  const d = paraData(iso);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const PRESETS: { valor: string; rotulo: string }[] = [
  { valor: "7d", rotulo: "7 dias" },
  { valor: "30d", rotulo: "30 dias" },
  { valor: "mes", rotulo: "Este mês" },
  { valor: "ano", rotulo: "Este ano" },
  { valor: "tudo", rotulo: "Tudo" },
];

export default async function DesempenhoPage({
  searchParams,
}: {
  searchParams: Promise<{
    de?: string;
    ate?: string;
    preset?: string;
    u?: string | string[];
    filtro_enviado?: string;
  }>;
}) {
  const perfil = await perfilAtual();
  if (!perfil?.ehAdmin) redirect("/");

  const filtros = await searchParams;
  const hoje = hojeISO();

  let de = filtros.de;
  let ate = filtros.ate;
  if (filtros.preset) {
    ate = hoje;
    if (filtros.preset === "7d") de = diasAntes(hoje, 6);
    else if (filtros.preset === "30d") de = diasAntes(hoje, 29);
    else if (filtros.preset === "mes") de = `${hoje.slice(0, 7)}-01`;
    else if (filtros.preset === "ano") de = `${hoje.slice(0, 4)}-01-01`;
    else if (filtros.preset === "tudo") de = "2000-01-01";
  }
  if (!de || !/^\d{4}-\d{2}-\d{2}$/.test(de)) de = `${hoje.slice(0, 7)}-01`;
  if (!ate || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) ate = hoje;
  const ateFimDoDia = `${ate}T23:59:59.999`;

  // Checkbox de GET não manda nada quando desmarcada — sem este marcador,
  // "nenhuma marcada" e "formulário nunca enviado" chegam do mesmo jeito
  // (nenhum "u" na URL), e o filtro padrão (todo mundo) não distinguiria
  // desmarcar tudo de propósito da primeira visita à página.
  const filtroFoiEnviado = filtros.filtro_enviado === "1";
  const idsMarcados = filtros.u
    ? Array.isArray(filtros.u)
      ? filtros.u
      : [filtros.u]
    : [];

  const supabase = await createClient();
  const [{ data: perfis }, { data: clientes }, { data: propostas }, { data: contratos }, { data: negociacoes }] =
    await Promise.all([
      supabase.from("perfis").select("id, nome, papel").order("nome"),
      supabase
        .from("clientes")
        .select("criado_por, criado_em")
        .gte("criado_em", de)
        .lte("criado_em", ateFimDoDia),
      supabase
        .from("propostas")
        .select("criado_por, criado_em")
        .gte("criado_em", de)
        .lte("criado_em", ateFimDoDia),
      supabase
        .from("contratos")
        .select("criado_por, data_contrato")
        .gte("data_contrato", de)
        .lte("data_contrato", ate),
      supabase
        .from("negociacoes")
        .select("criado_por, fechada_em, funil_etapas(desfecho)")
        .not("fechada_em", "is", null)
        .gte("fechada_em", de)
        .lte("fechada_em", ateFimDoDia),
    ]);

  const porUsuario = new Map<string, Contagem>();
  function soma(id: string | null, campo: keyof Contagem) {
    if (!id) return;
    const atual = porUsuario.get(id) ?? { ...ZERO };
    atual[campo]++;
    porUsuario.set(id, atual);
  }
  (clientes ?? []).forEach((c) => soma(c.criado_por, "clientes"));
  (propostas ?? []).forEach((p) => soma(p.criado_por, "propostas"));
  (contratos ?? []).forEach((c) => soma(c.criado_por, "contratos"));
  (
    (negociacoes ?? []) as unknown as {
      criado_por: string | null;
      funil_etapas: { desfecho: string } | null;
    }[]
  )
    .filter((n) => n.funil_etapas?.desfecho === "perdida")
    .forEach((n) => soma(n.criado_por, "perdidos"));

  const todos: Linha[] = (perfis ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    papel: p.papel,
    ...(porUsuario.get(p.id) ?? ZERO),
  }));

  const linhas = (
    filtroFoiEnviado ? todos.filter((l) => idsMarcados.includes(l.id)) : todos
  ).sort(
    (a, b) =>
      b.contratos - a.contratos ||
      b.propostas - a.propostas ||
      b.clientes - a.clientes ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );

  const totais = linhas.reduce(
    (s, l) => ({
      clientes: s.clientes + l.clientes,
      propostas: s.propostas + l.propostas,
      contratos: s.contratos + l.contratos,
      perdidos: s.perdidos + l.perdidos,
    }),
    { ...ZERO }
  );

  const params = new URLSearchParams({ de, ate });

  return (
    <>
      <Cabecalho />
      <main className="max-w-[1200px] mx-auto px-5 py-8 flex flex-col gap-6">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="serif text-3xl mt-1">Desempenho da equipe</h1>
          <p className="text-sm text-cinza mt-1">
            Clientes cadastrados, propostas criadas, contratos firmados e
            negociações perdidas por corretor, de {dataBR(de)} a {dataBR(ate)}.
          </p>
        </div>

        <form className="cartao p-4 flex flex-col gap-4" method="get">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="rotulo">De</label>
              <input type="date" name="de" className="campo w-40" defaultValue={de} />
            </div>
            <div>
              <label className="rotulo">Até</label>
              <input type="date" name="ate" className="campo w-40" defaultValue={ate} />
            </div>
            <div className="flex gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.valor}
                  type="submit"
                  name="preset"
                  value={p.valor}
                  className="btn btn-fantasma text-xs py-1.5"
                >
                  {p.rotulo}
                </button>
              ))}
            </div>
            <button className="btn btn-primario ml-auto">Aplicar</button>
          </div>

          <div>
            <label className="rotulo">Corretores</label>
            <div className="flex flex-wrap gap-3 mt-1.5">
              <input type="hidden" name="filtro_enviado" value="1" />
              {todos.map((l) => (
                <label
                  key={l.id}
                  className="flex items-center gap-1.5 text-sm rounded-md border border-linha px-2.5 py-1.5"
                >
                  <input
                    type="checkbox"
                    name="u"
                    value={l.id}
                    defaultChecked={
                      filtroFoiEnviado ? idsMarcados.includes(l.id) : true
                    }
                  />
                  {l.nome}
                  {l.papel === "admin" && (
                    <span className="selo selo-marca text-[10px]">admin</span>
                  )}
                </label>
              ))}
              {todos.length === 0 && (
                <p className="text-sm text-cinza">Nenhum usuário cadastrado.</p>
              )}
            </div>
          </div>
        </form>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="cartao p-4">
            <p className="eyebrow">Clientes cadastrados</p>
            <p className="serif text-2xl tabular mt-1">{totais.clientes}</p>
          </div>
          <div className="cartao p-4">
            <p className="eyebrow">Propostas criadas</p>
            <p className="serif text-2xl tabular mt-1">{totais.propostas}</p>
          </div>
          <div className="cartao p-4">
            <p className="eyebrow">Contratos firmados</p>
            <p className="serif text-2xl tabular mt-1 text-vinho">
              {totais.contratos}
            </p>
          </div>
          <div className="cartao p-4">
            <p className="eyebrow">Clientes perdidos</p>
            <p
              className={`serif text-2xl tabular mt-1 ${
                totais.perdidos ? "text-vermelho" : ""
              }`}
            >
              {totais.perdidos}
            </p>
          </div>
        </section>

        <section className="cartao overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>#</th>
                <th>Corretor</th>
                <th className="num">Clientes</th>
                <th className="num">Propostas</th>
                <th className="num">Contratos</th>
                <th className="num">Perdidos</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.id} className="hover:bg-papel-alt">
                  <td className="text-cinza">{i + 1}</td>
                  <td className="font-semibold whitespace-nowrap">
                    {l.nome}
                    {l.papel === "admin" && (
                      <span className="selo selo-marca text-[10px] ml-1.5">
                        admin
                      </span>
                    )}
                  </td>
                  <td className="num">{l.clientes}</td>
                  <td className="num">{l.propostas}</td>
                  <td className="num font-semibold text-vinho">{l.contratos}</td>
                  <td className={`num ${l.perdidos ? "text-vermelho" : "text-cinza"}`}>
                    {l.perdidos}
                  </td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-cinza py-8">
                    Nenhum corretor selecionado.
                  </td>
                </tr>
              )}
            </tbody>
            {linhas.length > 0 && (
              <tfoot>
                <tr className="bg-papel-alt font-semibold">
                  <td colSpan={2} className="text-right">
                    Total
                  </td>
                  <td className="num">{totais.clientes}</td>
                  <td className="num">{totais.propostas}</td>
                  <td className="num text-vinho">{totais.contratos}</td>
                  <td className={`num ${totais.perdidos ? "text-vermelho" : ""}`}>
                    {totais.perdidos}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </section>

        <p className="text-xs text-cinza">
          &quot;Clientes perdidos&quot; conta as negociações do{" "}
          <a href={`/funil?${params}`} className="underline">
            funil de vendas
          </a>{" "}
          que chegaram numa coluna marcada como perdida dentro do período. Um
          corretor sem cadastro no funil sempre aparece com 0 aqui, mesmo que
          tenha perdido cliente na conversa — o funil é onde isso se registra.
        </p>
      </main>
    </>
  );
}
