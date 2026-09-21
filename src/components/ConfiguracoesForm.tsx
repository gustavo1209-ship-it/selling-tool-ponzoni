"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { atualizarConfiguracoes } from "@/app/admin/acoes";
import CampoNumero from "./CampoNumero";
import { mensagemDeFalha } from "@/lib/erros";
import { ITENS_MENU_OPCIONAIS } from "@/lib/menu";
import type { Configuracoes, NivelDuplicidadeCliente } from "@/lib/db/tipos";

function Toggle({
  titulo,
  ajuda,
  marcado,
  aoMudar,
}: {
  titulo: string;
  ajuda: string;
  marcado: boolean;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-linha px-3 py-3 cursor-pointer hover:bg-papel-alt">
      <input
        type="checkbox"
        className="mt-1"
        checked={marcado}
        onChange={(e) => aoMudar(e.target.checked)}
      />
      <span>
        <span className="text-sm font-semibold block">{titulo}</span>
        <span className="text-xs text-cinza">{ajuda}</span>
      </span>
    </label>
  );
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="eyebrow mb-1">{titulo}</legend>
      {children}
    </fieldset>
  );
}

export default function ConfiguracoesForm({
  configuracoes,
}: {
  configuracoes: Configuracoes;
}) {
  const router = useRouter();
  const [cfg, setCfg] = useState(configuracoes);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  function salvar() {
    setErro(null);
    setSalvo(false);
    iniciar(async () => {
      try {
        const resultado = await atualizarConfiguracoes(cfg);
        if (!resultado.ok) throw new Error(resultado.erro);
        setSalvo(true);
        router.refresh();
      } catch (e) {
        setErro(mensagemDeFalha(e));
      }
    });
  }

  return (
    <div className="cartao p-5 flex flex-col gap-6">
      {erro && (
        <p className="text-sm text-vermelho bg-vermelho-fraco rounded-md px-3 py-2">
          {erro}
        </p>
      )}
      {salvo && !erro && (
        <p className="text-sm text-verde bg-verde-fraco rounded-md px-3 py-2">
          Salvo.
        </p>
      )}

      <Secao titulo="Financeiro do corretor, em Contratos">
        <Toggle
          titulo="Vê o valor do contrato"
          ajuda="Desligado (padrão), a coluna e o cartão de Valor somem pro corretor — só admin vê."
          marcado={cfg.corretor_ve_valor_contrato}
          aoMudar={(v) => setCfg({ ...cfg, corretor_ve_valor_contrato: v })}
        />
        <Toggle
          titulo="Vê o recebido"
          ajuda="Desligado (padrão), a coluna e o cartão de Já recebido somem pro corretor."
          marcado={cfg.corretor_ve_recebido}
          aoMudar={(v) => setCfg({ ...cfg, corretor_ve_recebido: v })}
        />
        <Toggle
          titulo="Vê saldo corrigido e em atraso"
          ajuda="Desligado (padrão), saldo corrigido, parcelas, próximo vencimento e em atraso somem pro corretor. Ele continua vendo a própria comissão a receber."
          marcado={cfg.corretor_ve_saldo_e_atraso}
          aoMudar={(v) => setCfg({ ...cfg, corretor_ve_saldo_e_atraso: v })}
        />
      </Secao>

      <Secao titulo="Comercial">
        <div className="rounded-md border border-linha px-3 py-3">
          <label className="text-sm font-semibold block mb-1">
            Limite de desconto do corretor
          </label>
          <div className="flex items-center gap-2">
            <CampoNumero
              valor={
                cfg.desconto_maximo_corretor_pct != null
                  ? cfg.desconto_maximo_corretor_pct * 100
                  : null
              }
              aoMudar={(v) =>
                setCfg({
                  ...cfg,
                  desconto_maximo_corretor_pct: v != null ? v / 100 : null,
                })
              }
              sufixo="%"
              className="w-32"
              placeholder="sem limite"
            />
          </div>
          <p className="text-xs text-cinza mt-1">
            Vazio = sem limite (padrão). Acima disso, o corretor não consegue
            salvar a proposta — vale pra qualquer opção, oficial ou montada.
            Se a escada oficial já tiver um degrau maior que o limite, suba o
            número pra acomodar.
          </p>
        </div>
        <Toggle
          titulo="Corretor pode montar opção livre"
          ajuda="Ligado (padrão), o corretor vê o botão 'Montar opção' e monta entrada/parcelas/reforços do zero. Desligado, ele só escolhe condições já cadastradas — é só cortesia de tela, não trava no servidor."
          marcado={cfg.corretor_monta_opcao_livre}
          aoMudar={(v) => setCfg({ ...cfg, corretor_monta_opcao_livre: v })}
        />
      </Secao>

      <Secao titulo="Clientes">
        <div className="rounded-md border border-linha px-3 py-3">
          <label className="text-sm font-semibold block mb-1">
            Cliente duplicado entre corretores
          </label>
          <select
            className="campo w-56"
            value={cfg.nivel_duplicidade_cliente}
            onChange={(e) =>
              setCfg({
                ...cfg,
                nivel_duplicidade_cliente: e.target.value as NivelDuplicidadeCliente,
              })
            }
          >
            <option value="desligado">Desligado — não checa</option>
            <option value="avisar">Avisar — cadastra e mostra aviso</option>
            <option value="bloquear">Bloquear — recusa o cadastro</option>
          </select>
          <p className="text-xs text-cinza mt-1">
            Checa CPF, telefone+nome ou e-mail contra o cadastro de outro
            corretor, sem nunca revelar quem é.
          </p>
        </div>
        <Toggle
          titulo="Carteira de clientes compartilhada"
          ajuda="Desligado (padrão), cada corretor só vê os próprios clientes. Ligado, qualquer corretor vê e edita cliente de outro — reabre o risco de cadastro duplicado."
          marcado={cfg.clientes_compartilhados}
          aoMudar={(v) => setCfg({ ...cfg, clientes_compartilhados: v })}
        />
      </Secao>

      <Secao titulo="Contrato — padrões pra um contrato novo">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="rotulo">Dia de vencimento</label>
            <CampoNumero
              valor={cfg.dia_vencimento_padrao}
              aoMudar={(v) => setCfg({ ...cfg, dia_vencimento_padrao: v ?? 10 })}
              casas={0}
            />
          </div>
          <div>
            <label className="rotulo">Juros de mora ao mês</label>
            <CampoNumero
              valor={cfg.juros_mora_padrao * 100}
              aoMudar={(v) => setCfg({ ...cfg, juros_mora_padrao: (v ?? 0) / 100 })}
              sufixo="%"
            />
          </div>
          <div>
            <label className="rotulo">Multa por atraso</label>
            <CampoNumero
              valor={cfg.multa_atraso_padrao * 100}
              aoMudar={(v) => setCfg({ ...cfg, multa_atraso_padrao: (v ?? 0) / 100 })}
              sufixo="%"
            />
          </div>
        </div>
        <p className="text-xs text-cinza">
          Só o ponto de partida — cada contrato continua editável na própria
          tela, individualmente.
        </p>
      </Secao>

      <Secao titulo="Visibilidade do espelho, pro corretor">
        <Toggle
          titulo="Vê o VGV"
          ajuda="Desligado (padrão), o cartão de VGV some da home e do espelho pro corretor."
          marcado={cfg.corretor_ve_vgv}
          aoMudar={(v) => setCfg({ ...cfg, corretor_ve_vgv: v })}
        />
        <Toggle
          titulo="Vê o comprador"
          ajuda="Desligado (padrão), o nome do comprador some do espelho e da folha impressa pro corretor."
          marcado={cfg.corretor_ve_comprador}
          aoMudar={(v) => setCfg({ ...cfg, corretor_ve_comprador: v })}
        />
        <Toggle
          titulo="Vê o preço de lote vendido"
          ajuda="Desligado (padrão), o preço de um lote já vendido ou indisponível fica escondido pro corretor. Livre, reservado e em projeto continuam com preço — é o catálogo."
          marcado={cfg.corretor_ve_preco_vendido}
          aoMudar={(v) => setCfg({ ...cfg, corretor_ve_preco_vendido: v })}
        />
      </Secao>

      <Secao titulo="Menu">
        <p className="text-xs text-cinza -mt-1 mb-1">
          Some do menu de todo mundo (admin e corretor) — quem já tem o link salvo, ou
          digita a URL direto, continua entrando normalmente.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ITENS_MENU_OPCIONAIS.map((item) => (
            <label
              key={item.href}
              className="flex items-center gap-2 text-sm rounded-md border border-linha px-3 py-2 cursor-pointer hover:bg-papel-alt"
            >
              <input
                type="checkbox"
                checked={!cfg.menu_oculto.includes(item.href)}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    menu_oculto: e.target.checked
                      ? cfg.menu_oculto.filter((h) => h !== item.href)
                      : [...cfg.menu_oculto, item.href],
                  })
                }
              />
              {item.rotulo}
            </label>
          ))}
        </div>
      </Secao>

      <Secao titulo="Alertas dentro do app">
        <Toggle
          titulo="Avisar sobre parcela em atraso"
          ajuda="Ligado (padrão), o corretor vê um aviso de contagem em Contratos quando tem parcela vencida — sem mostrar valor em R$."
          marcado={cfg.alertar_parcela_atrasada}
          aoMudar={(v) => setCfg({ ...cfg, alertar_parcela_atrasada: v })}
        />
        <Toggle
          titulo="Avisar sobre proposta perto de vencer"
          ajuda="Ligado (padrão), aviso de contagem em Propostas — para todo mundo, não só corretor."
          marcado={cfg.alertar_proposta_vencendo}
          aoMudar={(v) => setCfg({ ...cfg, alertar_proposta_vencendo: v })}
        />
        <div className="rounded-md border border-linha px-3 py-3">
          <label className="text-sm font-semibold block mb-1">
            Avisar com quantos dias de antecedência
          </label>
          <CampoNumero
            valor={cfg.dias_aviso_proposta_vencendo}
            aoMudar={(v) => setCfg({ ...cfg, dias_aviso_proposta_vencendo: v ?? 7 })}
            sufixo=" dias"
            className="w-32"
          />
        </div>
      </Secao>

      <button
        className="btn btn-primario w-fit"
        onClick={salvar}
        disabled={pendente}
      >
        <Check size={15} /> Salvar
      </button>
    </div>
  );
}
