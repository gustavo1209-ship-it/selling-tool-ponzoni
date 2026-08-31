# CLAUDE.md — selling-tool-ponzoni

Ferramenta interna de vendas: espelho de lotes, simulador de condições de
pagamento e proposta pronta para entregar ao cliente (PDF) ou levar para a
mesa (XLSX).

Nasceu para o **Industrial Ponzoni**, mas o schema é multi-empreendimento de
propósito — o Florescer entra depois sem tocar em código. Ver
[Adicionar um empreendimento](#adicionar-um-empreendimento).

## Comandos

```bash
npm run dev         # localhost:3000 (webpack — ver abaixo)
npm run dev:turbo   # o mesmo, com Turbopack
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

## Por que o dev roda com webpack

`npm run dev` é `next dev --webpack`, de propósito. O `build` continua com
Turbopack (o padrão do Next 16); só o desenvolvimento saiu dele.

O Turbopack derrubava o dev server várias vezes por sessão, sempre com um de
dois sintomas: página em branco com "Jest worker encountered 2 child process
exceptions", ou — quando o processo morria durante uma server action — o
React mostrando **"An unexpected response was received from the server"**.
Nos dois casos sem erro real no log, e com `npm run build` passando.

A causa é o projeto viver dentro do **OneDrive**: `.next` e `node_modules`
são reparse points do Files On-Demand, e o Turbopack reescreve centenas de
arquivos em `.next` a cada compilação enquanto o OneDrive tenta sincronizá-los
— o worker morre com `EPIPE`. Explica por que o `build` (escreve uma vez)
sempre passou e o `dev` (escreve o tempo todo) quebrava.

O que já foi tentado antes de trocar o bundler:

- limpar `.next` e reiniciar — resolve na hora, volta depois;
- `attrib +P -U node_modules /s /d`, para o OneDrive não desidratar um módulo
  no meio do build (mantido, ajuda, não basta);
- **junction de `.next` para fora do OneDrive — não funciona**: o Turbopack
  passa a resolver o PostCSS a partir do caminho real em `AppData`, não acha
  `@tailwindcss/postcss` e o app não sobe.

Se o dev travar mesmo assim, a receita continua valendo:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'next' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Remove-Item -Recurse -Force .next
npm run dev
```

Use `npm run dev:turbo` quando quiser reproduzir em desenvolvimento algo que
só aparece no bundler do `build`. A solução definitiva é mover o projeto para
fora do OneDrive.

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
vendedor lê tudo, edita status de lote e **clientes**, e cria/edita as
próprias propostas (RLS em `supabase/migrations/*_02_rls.sql`).

Cliente é dado compartilhado de propósito: prender a edição a quem cadastrou
só gerava cliente duplicado quando outra pessoa atendia. Apagar continua
restrito ao autor ou a um admin, e um cliente com proposta não pode ser
apagado.

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

`ordem` é a ordem das abas no simulador **e** a ordem em que as opções saem
no PDF e no XLSX. Na criação ela vem da ordem de clique nas condições; depois
o vendedor rearruma pelas setas na aba ativa.

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

### Reforços periódicos

`periodicidade_meses` no bloco é o intervalo entre vencimentos: 1 mensal, 3
trimestral, 6 semestral, 12 anual. O vencimento sai de
`mes_inicio + (indice − 1) × periodicidade`.

O efeito comercial é o que importa: entrada e reforços são percentuais fixos
do valor e **as mensais absorvem o resíduo**, então acrescentar reforço
derruba a mensal sem mudar o total — o principal só muda de lugar no
calendário. Num terreno de R$ 341.957,94 com 30% de entrada e 36x, tirar 20%
para 6 reforços semestrais leva a mensal de R$ 6.649 para R$ 4.749.

O comparativo continua honesto porque a coluna "maior parcela" pega o mês em
que a mensal e o reforço caem juntos — que é o mês que o cliente precisa
conseguir pagar.

### Qual parcela a proposta mostra

`propostas.metricas_parcela` escolhe entre `inicial`, `media`, `final` e
`maior`, e vale para o comparativo, a folha e o XLSX. O padrão é só a
**inicial**.

A "maior parcela" era a única e é a métrica errada para abrir a conversa: com
reforço periódico ela é o mês em que a mensal e o reforço caem juntos, um
número que assusta e que não é o que o cliente paga na maioria dos meses.

As quatro se separam justamente quando há reforço ou correção. Numa proposta
real com 36x e reforços: inicial R$ 6.499,83, média R$ 9.978,57, final
R$ 26.314,38. Cada uma responde a uma pergunta diferente — quanto começo
pagando, quanto pago em média, quanto termino pagando — e a "maior" continua
disponível para a pergunta que o crédito faz: qual é o pior mês.

Todas saem do **fluxo consolidado**, não de um bloco: é a soma do que vence
no mês, que é o que o cliente efetivamente paga.

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

Essa herança só faz sentido para o próprio INCC. Por isso a tela grava a taxa
**explicitamente** ao escolher qualquer outro índice: um bloco de IPCA com
taxa nula acabaria corrigido pelo INCC, e a conta sairia errada sem nenhum
aviso.

### Indexadores

A tabela `indexadores` guarda a taxa de referência de cada índice com a fonte
e a data — INCC-M, IGP-M, IPCA, INPC, IGP-DI, CUB-RS, TR, CDI e Selic. A taxa
mensal é derivada do **acumulado em 12 meses**, não da variação do mês:

```
taxa_mensal = (1 + acumulado_12m)^(1/12) − 1
```

Isso não é preciosismo. O IGP-M de agosto/2026 fechou em **−0,22%**; projetar
esse número por 36 parcelas zeraria o saldo devedor. O acumulado suaviza a
volatilidade, que é o que se quer numa projeção longa.

Índices sem taxa apurada (INPC, IGP-DI, CUB, TR) ficam com `null` de
propósito — a tela diz "sem taxa de referência" em vez de inventar um número.
Ao revisar a tabela de preços, revisar também estas taxas.

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

## Montar opção personalizada

`MontarOpcao.tsx` gera os blocos a partir do formato que o mercado usa:
entrada % + mensais + reforços periódicos. Ele aparece nos **dois** lugares
onde a condição é escolhida — na criação da proposta e no simulador — porque
montar bloco a bloco é preciso mas lento, e o vendedor monta condição nova no
meio da conversa com o cliente.

Na tela de criação a opção montada não existe como condição salva, então
viaja no `<form>` como JSON num `input[name=opcao_custom]` — um formulário só
carrega texto. `criarProposta` desserializa e cria um cenário para cada uma,
depois das escolhidas na tabela.

A prévia é sem correção e sem juros de propósito: é a conta que o vendedor
faz de cabeça e precisa bater. Os valores com correção aparecem no
comparativo depois de criar.

## Condições oficiais × favoritas

`condicoes_pagamento.oficial` separa duas coisas que pareciam uma só:

- **oficial = true** — veio do seed da tabela de preços. É política
  comercial (a escada de desconto do R n.º5) e só admin mexe.
- **oficial = false** — favorita: o time salvou uma estrutura que deu certo
  para reusar. Quem criou edita e apaga; admin também.

O botão de favoritar fica no cabeçalho da opção no simulador e chama
`favoritarCenario`, que copia os blocos para o `template` da condição. A
favorita nasce sempre `oficial = false` — sem isso, um vendedor conseguiria
criar uma "condição da tabela" com o desconto que quisesse.

Na tela de criação as duas listas aparecem separadas, "Da tabela" e
"Favoritas do time".

## Mapa na proposta

A folha traz uma seção "Localização no parque" com a foto aérea, os lotes da
proposta destacados e uma miniatura do parque inteiro no canto marcando de
onde saiu o recorte.

O desenho é **SVG local, não iframe**: o PDF é gerado pelo navegador e não
pode depender de rede na hora de imprimir. São duas peças:

- `src/lib/mapa/industrial-ponzoni.ts` — geometria dos 44 polígonos, gerada
  por `npm run mapa:extrair` a partir do HTML do mapa público. **Não editar à
  mão**; se o mapa mudar, rodar o script de novo.
- `public/mapa-industrial-ponzoni.jpg` — a foto aérea, copiada à mão de
  `site-industrial-ponzoni/ponzoni-mapa-bg.jpg` (785 KB, muda pouco).
  `empreendimentos.mapa_imagem_url` aponta para ela.

O id do mapa é quadra + número com dois dígitos (`C11`), enquanto o banco
guarda `quadra` e `numero` separados — `idDoMapa()` faz a ponte.

`enquadrar()` calcula o recorte: bounding box dos lotes escolhidos, mais uma
folga de 55% da maior dimensão, ajustada para 16:9 e presa dentro da imagem.
A folga é proporcional de propósito — um lote de 900 m² e uma quadra inteira
precisam de margens diferentes para "ver a rua" em volta. Com lotes em pontas
opostas do parque o recorte cresce até virar o mapa inteiro, que é o
comportamento certo.

**Os demais lotes saem só em contorno branco translúcido, sem cor de
status.** É deliberado: a proposta não deve informar ao cliente o que está
livre ou vendido.

## Marca

`empreendimentos.logo_url` aponta para um arquivo em `public/`. Aparece no
cabeçalho do app e no topo da folha da proposta (mais um selo pequeno na
assinatura do rodapé). O do Industrial é o mesmo `ponzoni-logo.jpg` do
`site-industrial-ponzoni` — marca branca sobre quadrado vinho, que funciona
como selo sem precisar de versão negativa.

## Cliente

Os dados do cliente são editáveis em dois lugares, e os dois gravam na mesma
linha de `clientes`: a tela `/clientes` (edição em linha) e o cartão Cliente
dentro do simulador. Salvar a proposta grava o cliente antes do cabeçalho,
para que a listagem já apareça com o nome novo.

O seletor do cartão faz três coisas: troca qual cliente a proposta aponta,
desvincula (`— sem cliente —`) e cadastra um novo (`+ cadastrar novo
cliente`). No modo "novo", `salvarProposta` recebe `criar_cliente: true`,
insere o cadastro e devolve o `cliente_id` para a tela adotar — assim dá para
corrigir um cliente errado sem sair da proposta, que é como o erro costuma
aparecer.

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

## O PDF só mostra o que está salvo

A folha de impressão e o XLSX são rotas próprias que leem do banco; o
simulador calcula no navegador. Enquanto houver alteração não salva, os
botões de PDF e XLSX somem e dão lugar a "Salve para gerar PDF/XLSX". Sem
essa trava o vendedor mexia na entrada, abria o PDF e via o número antigo,
sem nada indicando o porquê.

## Três armadilhas da estrutura de pagamento

**O nome da opção é texto, não é derivado.** Ele nasce da condição da tabela
("40% Entrada + 36x INCC") e vira o título da seção no PDF. Mudar a entrada
não muda o nome. O simulador compara o percentual escrito no nome com a
entrada calculada e oferece "Corrigir nome" quando divergem.

**A conta precisa fechar.** Se os blocos não somam o valor negociado, o
cronograma não quita o terreno. O aviso traz "Fechar a conta", que faz o
último bloco que não é entrada absorver a diferença. A folha de impressão
repete o alerta em barra amarela **só na tela** — nunca no papel, para não ir
para o cliente.

**Os templates das condições já vêm com o último bloco absorvendo o
resíduo**, então mexer na entrada rebalanceia sozinho. Propostas criadas
antes disso guardam cópia própria dos blocos e mantêm o percentual travado —
use "Fechar a conta" nelas.

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
