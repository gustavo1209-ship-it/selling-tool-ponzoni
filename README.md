# Ferramenta de Vendas — Ponzoni

Espelho de lotes, simulador de condições de pagamento e proposta pronta para
o cliente. Feita para o **Industrial Ponzoni**, preparada para receber o
Florescer sem mexer em código.

## O que ela faz

- **Mapa de lotes** — o mesmo mapa interativo do site, dentro da ferramenta.
- **Espelho de vendas** — os 44 lotes com área, preço, status e comprador,
  sincronizáveis com o Google Sheets que já alimenta o mapa público.
- **Simulador** — monta a condição de pagamento em blocos: entrada, parcelas
  corrigidas pelo INCC, balão, financiamento Sicredi em SAC até 120 meses.
  Tudo editável: valor da entrada, percentual de cada bloco, número e valor
  das parcelas, sistema de amortização, índice de correção e taxa.
- **Várias opções na mesma proposta** — à vista, 24x INCC e Sicredi lado a
  lado, com comparativo e uma marcada como recomendada.
- **Vários terrenos numa proposta**, com desconto em percentual ou em reais
  por opção.
- **Valor presente** de cada estrutura, para comparar propostas que têm o
  mesmo nominal mas prazos diferentes.
- **Proposta em PDF** para entregar ao cliente e **planilha XLSX** com o
  fluxo completo para uso interno.

## Rodar

```bash
npm install
cp .env.example .env.local   # e preencher a chave do Supabase
npm run dev                  # http://localhost:3000
```

Primeiro acesso: `/login` → "Criar uma conta" → confirmar pelo e-mail.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verificar` | confere o motor de cálculo contra as planilhas da casa |

## Estrutura

```
src/
  app/
    login/                       entrada
    mapa/                        mapa de lotes (iframe do mapa do site)
    espelho/                     espelho de vendas
    propostas/                   lista, nova, simulador e folha de impressão
    api/espelho/sync/            importa o espelho do Google Sheets
    api/propostas/[id]/xlsx/     exporta a planilha da proposta
  components/                    simulador, editor de blocos, folha A4
  lib/
    calc/                        motor de cálculo (puro, testável)
    espelho.ts                   leitura do CSV do Sheets
    ordenacao.ts                 ordem natural dos lotes (A-2 antes de A-10)
    supabase/                    clients de browser, servidor e sessão
supabase/migrations/             schema versionado
```

Detalhes de arquitetura, das regras da tabela de preços e das convenções de
cálculo estão no [CLAUDE.md](./CLAUDE.md).
