# CLAUDE.md — selling-tool-ponzoni

Ferramenta interna de vendas: espelho de lotes, simulador de condições de
pagamento e proposta pronta para entregar ao cliente (PDF) ou levar para a
mesa (XLSX).

Nasceu para o **Industrial Ponzoni**, mas o schema é multi-empreendimento de
propósito — o Florescer entra depois sem tocar em código. Ver
[Adicionar um empreendimento](#adicionar-um-empreendimento).

## Comandos

```bash
npm run dev         # localhost:3000
npm run build
npm run lint
npm run typecheck   # tsc --noEmit
npm run verificar   # confere o motor de cálculo contra as planilhas
```

`npm run verificar` é o teste que importa: ele reproduz números que já
existem em planilha (aba `20%+25%12xINCC+55%36xINCC`, abas `IND ...`, a
escada de desconto do espelho, as identidades fechadas do SAC e do Price) e
falha com exit 1 se o motor divergir. **Rodar depois de qualquer mexida em
`src/lib/calc/`.**

Ele roda via `tsx`, e não via `node --experimental-strip-types`. A diferença
importa: o `--experimental-strip-types` exige extensão nos imports
(`from "./tipos.ts"`), e essas extensões **quebram o resolvedor do Turbopack
em modo dev** — a página que importa `@/lib/calc` fica em branco com
"Jest worker encountered 2 child process exceptions" e nenhum erro real no
log, enquanto `next build` compila normalmente. Não voltar a pôr `.ts` nos
imports nem religar `allowImportingTsExtensions` no tsconfig.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
Supabase (`@supabase/ssr`) · exceljs · lucide-react.

Mesma stack e mesmas convenções de `controle-gastos/` — inclusive
`src/proxy.ts` (o Next 16 aposentou `middleware.ts`).

## Supabase

Projeto **`selling-tool`** (`qemzikxbvzghspltoejn`, região `sa-east-1`).
Variáveis em `.env.local` (ver `.env.example`).

Migrations versionadas em `supabase/migrations/`, com o mesmo timestamp
aplicado no projeto remoto. Ao mudar o schema, aplicar **e** gravar o arquivo
— senão o repositório e o banco divergem em silêncio.

### Primeiro acesso

O projeto está com **confirmação de e-mail ligada** (`mailer_autoconfirm:
false`). Criar a conta em `/login` → "Criar uma conta" e clicar no link que
chega por e-mail. Para dispensar isso num time interno: Supabase → Auth →
Providers → Email → desligar "Confirm email".

O primeiro usuário nasce como `vendedor`. Para promover:

```sql
update perfis set papel = 'admin' where email = 'gustavo1209@gmail.com';
```

Só `admin` edita empreendimentos, tabelas de preço e condições. Qualquer
vendedor lê tudo, edita status de lote e cria/edita as próprias propostas
(RLS em `supabase/migrations/*_02_rls.sql`).

## Como a tabela de preços funciona de verdade

Isso não está escrito em lugar nenhum na planilha e é a coisa mais fácil de
errar. Na `Planilha valores Lotes INDUSTRIAL`, aba `Valores terrenos 260812`:

| Coluna | Condição | Fórmula real |
|---|---|---|
| M | 40% + 6x | **valor digitado à mão — é a âncora** |
| F | 40% + 36x INCC | `= M * 1,14` ← **é o PREÇO publicado no espelho** |
| I | 40% + 24x INCC | `= F * 0,965` |
| K | 40% + 12x INCC | `= F * 0,935` |
| L | À vista | `= F * 0,910` |
| G, J, N | 18x / 12x / 3x | apontam para G (vazia) → saem zeradas |

Os rótulos "Desconto -10%" e "-14%" no cabeçalho de M e N **estão
desatualizados**: M é a âncora, não um desconto. O desconto real de M contra
F é `1 − 1/1,14 = 12,28%`, e é esse o valor no seed.

O memorando de negociação da Quadra C (`site-industrial-ponzoni/avaliacao-propostas/`)
chegou à mesma escada por outro caminho e estimou a taxa embutida na tabela
em **~0,9% a.m. real** — é a referência para escolher a taxa de valor
presente quando se quer comparar estruturas.

## Motor de cálculo (`src/lib/calc/`)

Funções puras, sem React e sem Supabase — o mesmo código roda no cliente
(simulador ao vivo), no servidor (snapshot ao salvar), no PDF e no XLSX.

- `tipos.ts` — `Bloco`, `Premissas`, `Parcela`, `Resultado`.
- `amortizacao.ts` — `sac`, `price`, `americano`, `linear` e o inverso
  `baseParaParcela` (quando o vendedor trava a prestação em vez do percentual).
- `index.ts` — `calcular()`: resolve as bases dos blocos, monta o fluxo,
  desconta a valor presente e consolida os totais.
- `verificar.ts` — as conferências contra planilha.

### Uma proposta tem várias opções, cada opção é uma lista de blocos

`propostas` → `proposta_cenarios` → `proposta_blocos`.

Um **cenário** é uma opção de parcelamento: "à vista", "40% + 24x INCC",
"Sicredi 120x SAC". Os lotes são da proposta (todas as opções vendem os
mesmos terrenos); o desconto e os blocos são do cenário, porque mudam de
opção para opção — à vista tem 9% de desconto e o 36x não.

As **premissas** (INCC, taxa de valor presente, convenção da 1ª parcela) são
da proposta, não do cenário. É o que mantém o comparativo honesto: as opções
só podem ser comparadas se estiverem descontadas à mesma taxa.

Um cenário é marcado `recomendado`. Ele define o `propostas.resultado`, que é
o snapshot que as listagens leem sem carregar tudo.

### Cada bloco é um trecho do fluxo

*Entrada*, *2x de R$ 30.000*, *36x corrigidas pelo INCC*, *120x SAC no
Sicredi*. A base (o principal que ele quita) vem, nesta ordem de
precedência:

1. `absorve_residuo` — o que sobrar do valor negociado (só um bloco
   costuma ter isso ligado; se houver vários, a sobra é dividida);
2. `base_valor` — valor absoluto;
3. `base_percentual` — fração do valor negociado;
4. `parcela_fixa` — a base é derivada da parcela.

Blocos podem correr **em paralelo**: `mes_inicio` é o mês do 1º vencimento e
nada impede dois blocos começarem no mês 1. É exatamente assim que a planilha
`20% + 25% 12x + 55% 36x` funciona — nos primeiros 12 meses o cliente paga as
duas parcelas somadas. Não "sequenciar" os blocos automaticamente.

### Correção × juros

São coisas diferentes e não se misturam no mesmo bloco:

- `amortizacao = 'nenhuma'` → parcela é `base / n` corrigida por fora pelo
  fator do indexador. É o comportamento das tabelas INCC da casa.
- `amortizacao = 'sac' | 'price' | 'americano'` → a taxa efetiva é
  `juros_mensal + taxa_indexador_mensal` (pós-fixado tratado como juro) e a
  correção por fora não se aplica.

`taxa_indexador_mensal = null` significa **herda o INCC da proposta** — é o
que faz uma condição salva em 2026 continuar coerente quando o INCC muda.
Não trocar por `0`.

### O fator de correção da 1ª parcela

As duas famílias de planilha discordam, e a diferença aparece no total:

- `Propostas de Parcelamento` (abas sem prefixo): fator `(1+i)^(m-1)` — a 1ª
  parcela sai **sem** correção;
- abas `IND ...`: fator `(1+i)^m` — a 1ª parcela já vem corrigida.

`propostas.correcao_primeira_parcela` escolhe a convenção. Default `false`
(a primeira família). `npm run verificar` cobre as duas.

### Arredondamento

`linear()` mantém `base / n` **sem arredondar**; quem arredonda é a exibição,
depois de aplicado o fator de correção. Arredondar dentro do laço e jogar a
sobra na última parcela afastava o resultado da planilha em alguns centavos
justamente na última linha — que é a que todo mundo confere. `sac()` e
`price()` fazem o contrário de propósito: a última parcela absorve o resíduo
para o saldo devedor zerar exatamente.

## Ordem dos lotes

`numero` é `text` no banco (existe loteamento com "12A"), então a ordenação
do Postgres sai alfabética: A-1, A-10, A-11, A-2. Toda listagem passa por
`compararLote`/`ordenarLotes` de `src/lib/ordenacao.ts`, que usa
`localeCompare(..., { numeric: true })`. **Não ordenar por `numero` no
`.order()` do Supabase** — o resultado fica errado e ninguém percebe até a
quadra passar de nove lotes.

## Mapa de lotes

`/mapa` embute em iframe o mesmo HTML que o site publica. São duas colunas em
`empreendimentos`: `mapa_url` (o HTML puro, do GitHub Pages, que é o que a
aba embute) e `mapa_publico_url` (a página do site, para mandar ao cliente).
A página do Webflow não manda `X-Frame-Options` nem CSP, então embutir
qualquer uma das duas funciona — a do GitHub Pages foi escolhida por não
trazer o cabeçalho do site junto.

O mapa lê o status do mesmo Google Sheets, então os contadores dele batem com
o espelho sem nenhuma integração entre os dois.

## Espelho de vendas

A fonte de verdade de **status e comprador** continua sendo o
[Espelho de Vendas Industrial](https://docs.google.com/spreadsheets/d/1KAKfuVyV3T6IoLI2FrxANUv1h12knJS9gDbMxJqXiS0/edit)
no Google Sheets — é ele que alimenta o mapa público de
`site-industrial-ponzoni`. A ferramenta **lê** dele; não escreve.

`POST /api/espelho/sync` baixa o CSV publicado (`empreendimentos.espelho_csv_url`,
no formato `gviz/tq?tqx=out:csv`, o mesmo `GS_URL` do mapa) e reconcilia com
a tabela `lotes`. O parser (`src/lib/espelho.ts`) acha as colunas **pelo
nome**, não pela posição — a planilha ganha coluna de tempos em tempos. O
nome do comprador mora numa coluna sem título fixo ("Coluna 1").

Preço só é sobrescrito quando a planilha traz um: lotes vendidos vêm com a
célula de valor vazia e não podem zerar o preço no banco.

## CSS: camadas importam

As classes da casa (`.campo`, `.btn`, `.cartao`, `.tabela`…) vivem dentro de
`@layer components` em `globals.css`, e `html`/`body` dentro de `@layer base`.
Fora de camada elas venceriam os utilitários do Tailwind na cascata — foi
assim que um `campo w-auto` ficou preso no `width: 100%` de `.campo` e
colapsou o campo vizinho num flex. Ao acrescentar classe nova, pôr dentro da
camada.

## Proposta para o cliente (PDF)

`/propostas/[id]/imprimir` renderiza uma folha A4 autocontida com **todas as
opções da proposta** (`src/components/FolhaProposta.tsx`) e o navegador gera
o PDF — é o mesmo
padrão de `site-industrial-ponzoni/avaliacao-propostas/` e da manifestação de
interesse do evento. Nada de biblioteca de PDF.

Armadilhas herdadas daquele fluxo, já tratadas no CSS:
`print-color-adjust: exact` (senão os fundos vinho somem na impressão),
`@page { size: A4 portrait }` e `break-inside: avoid` nas seções.

A folha **precisa** manter a cláusula de não vinculação no rodapé: a proposta
não é reserva nem contrato, e a venda depende de aprovação da diretoria e, com
financiamento, de análise de crédito. Ver
`site-industrial-ponzoni/CLAUDE.md` para o que não pode ser prometido.

### Convenções de texto

Português com todos os acentos. Percentuais e decimais com **vírgula**
(`11,4%`). Sem travessões no que vai para o cliente.

## Planilha para uso interno (XLSX)

`GET /api/propostas/[id]/xlsx` monta com `exceljs` uma aba **Resumo**
(cabeçalho, terrenos e o comparativo das opções) e, para cada opção, duas
abas: `▸ nome` (resumo, blocos e fluxo consolidado) e `≡ nome` (amortização
parcela a parcela). Nome de aba do Excel não aceita `/ \ ? * [ ] :` e corta
em 31 caracteres — `nomeDeAba` cuida disso e desambigua repetidos.
`exceljs` está em `serverExternalPackages` no `next.config.ts`.

## Adicionar um empreendimento

Nada de código. Um `insert` em `empreendimentos` (com `espelho_csv_url`
apontando para o CSV publicado da planilha dele), um em `tabelas_preco` e as
linhas de `condicoes_pagamento` com os `template` dos blocos. Os lotes entram
pelo `insert` do seed ou pelo próprio botão "Sincronizar com o Sheets", que
cria os que não existirem.

É assim que o Florescer entra: mesma ferramenta, outra linha em
`empreendimentos`.

## Fontes de dados

Os arquivos de origem **não vão para o repositório** (`.gitignore` bloqueia
`*.xlsx` e `*.pdf`). Ficam na pasta local:

| Arquivo | O que forneceu |
|---|---|
| `Planilha valores Lotes INDUSTRIAL 260813.xlsx` | áreas, preços e a escada de desconto da tabela R n.º5 |
| `Propostas de Parcelamento.xlsx` | as estruturas de parcelamento e os números de conferência do motor |
| `Valores terrenos 260812.pdf` / `...VEND260812.pdf` | versões impressas da mesma tabela |
| Espelho de Vendas Industrial (Google Sheets) | status, comprador e o valor publicado |

## Projetos vizinhos

- `site-industrial-ponzoni/` — mapa público de lotes, deck de lançamento e o
  memorando de negociação da Quadra C. Lê o mesmo Google Sheets.
- `site-florescer/` — mesmo padrão para o Florescer.
- `controle-gastos/` — origem das convenções de Next + Supabase daqui.
