# CLAUDE.md — selling-tool-ponzoni

Ferramenta interna de vendas: espelho de lotes, simulador de condições de
pagamento e proposta pronta para entregar ao cliente (PDF) ou levar para a
mesa (XLSX).

Atende dois empreendimentos — **Industrial Ponzoni** e **Florescer Parque
Residencial** — e o schema é multi-empreendimento de propósito: quase tudo é
dado. Ver [Adicionar um empreendimento](#adicionar-um-empreendimento), que
hoje já tem dois casos reais e bem diferentes para comparar.

## Comandos

```bash
npm run dev         # localhost:3000
npm run dev:webpack # saída de emergência, se o Turbopack der problema
npm run build
npm run lint
npm run typecheck   # tsc --noEmit
npm run verificar   # confere o motor de cálculo contra as planilhas
npm run mapa:extrair -- "<caminho do mapa-lotes-*.html>"   # regenera a geometria
```

`npm run verificar` é o teste que importa: ele reproduz números que já
existem em planilha (aba `20%+25%12xINCC+55%36xINCC`, abas `IND ...`, a
escada de desconto do espelho, as identidades fechadas do SAC e do Price) e
falha com exit 1 se o motor divergir. **Rodar depois de qualquer mexida em
`src/lib/calc/`.**

Ele roda via `tsx`, e não via `node --experimental-strip-types`. A diferença
importa: o `--experimental-strip-types` exige extensão nos imports
(`from "./tipos.ts"`), e essas extensões quebram o resolvedor do Turbopack —
a página que importa `@/lib/calc` fica em branco, e `next build` compila
normalmente, o que despista. Não voltar a pôr `.ts` nos imports nem religar
`allowImportingTsExtensions` no tsconfig.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
Supabase (`@supabase/ssr`) · exceljs · lucide-react.

Mesma stack e mesmas convenções de `controle-gastos/` — inclusive
`src/proxy.ts` (o Next 16 aposentou `middleware.ts`).

## Onde o projeto vive

`C:\Codes\selling-tool-ponzoni` — **fora do OneDrive, de propósito.**

O projeto morava em `OneDrive\Desktop\Codes Claude	este supabase\` e o dev
server caía várias vezes por sessão. A causa: o OneDrive sincroniza `.next` e
`node_modules`, e o Next reescreve centenas de arquivos ali a cada
compilação. Os sintomas variavam com o bundler, mas eram o mesmo problema:

- Turbopack: "Jest worker encountered 2 child process exceptions", tela em
  branco, e — quando morria no meio de uma server action — o React mostrando
  "An unexpected response was received from the server";
- webpack: `EBUSY: resource busy or locked` em `.next/dev/server/*.js`.

`npm run build` sempre passou, porque escreve uma vez só. Foi o que despistou
por várias sessões.

**Não tente resolver com junction de `.next` para fora do OneDrive.** Foi
tentado duas vezes, com os dois bundlers, e quebra a resolução de módulos: o
Node passa a resolver a partir do caminho real em `AppData` e não acha o
`node_modules` (com Turbopack falha o `@tailwindcss/postcss`; com webpack,
`react/jsx-runtime`).

Fora do OneDrive o Turbopack voltou a ser o padrão e nada mais cai.

### O que ficou no OneDrive

Só as **fontes de dados**, que não vão para o git e precisam de backup:

```
OneDrive\Desktop\Codes Claude	este supabase\selling-tool-florescer  Planilha valores Lotes INDUSTRIAL 260813.xlsx
  Propostas de Parcelamento.xlsx
  Valores terrenos 260812.pdf
  Valores terrenos VEND260812.pdf
```

O backup do código é o **GitHub**, não o OneDrive. O `.env.local` é
recriável a partir do `.env.example` com a chave que está na Vercel.

O repositório do mapa (`site-industrial-ponzoni`) continua no OneDrive e não
é mais vizinho deste, então `npm run mapa:extrair` precisa do caminho:

```bash
npm run mapa:extrair -- "C:/Users/gusta/OneDrive/Desktop/Codes Claude/teste supabase/site-industrial-ponzoni/mapa-lotes-ponzoni-industrial.html"
```

## Se o dev server cair

Não deveria mais, depois da mudança de pasta. Se cair, a receita continua:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'next' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Remove-Item -Recurse -Force .next
npm run dev
```

Antes de caçar o bug, rode `npm run build`: se ele passa, é cache.
`npm run dev:webpack` fica como saída de emergência.

## Quando algo falha na tela

Duas peças, e as duas existem por causa das quedas do dev server:

- `src/lib/erros.ts` — `mensagemDeFalha()` traduz "An unexpected response was
  received from the server", "Failed to fetch" e afins para uma frase que diz
  o que interessa: **nada foi gravado e o que está na tela não se perdeu,
  basta tentar de novo**. Usada nos `catch` do simulador, dos clientes e do
  espelho. Ao escrever `catch` novo, use ela em vez de `(e as Error).message`.
- `src/app/error.tsx` — error boundary do app. Sem ela, uma falha de
  renderização dá tela branca sem explicação.

## Hospedagem

Produção em **https://selling-tool-ponzoni.vercel.app** (projeto Vercel
`selling-tool-ponzoni`, time `gustavo-ponzoni-s-projects`, plano Hobby).

O projeto está **conectado ao repositório do GitHub**: todo push em `main`
publica sozinho. Para publicar do zero da máquina, `vercel --prod`.

As duas variáveis (`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
estão nos três ambientes.

**Use `vercel env add NOME ambiente --value "..." --yes`, e o CLI 59 ou mais
novo.** O CLI 54 grava string vazia quando o valor vem por pipe ou por
redirecionamento de arquivo — e ainda imprime "Added Environment Variable",
então o erro passa despercebido. O sintoma na aplicação é um `fetch` do
supabase-js estourando com *"String contains non ISO-8859-1 code point"*,
porque o cliente é construído com URL e chave vazias.

Conferir sempre depois de gravar:

```bash
vercel env pull /tmp/env.txt --environment=production --yes
grep SUPABASE /tmp/env.txt
```

### O que fica exposto

A URL é pública e o cadastro de conta está **aberto** no Supabase
(`disable_signup: false`). Como a RLS deixa qualquer usuário autenticado ler
tudo — lotes, preços, propostas e clientes —, quem descobrir o endereço e
confirmar um e-mail vê a base inteira.

Para um time fechado, o certo é **manter o provedor Email ligado** e desligar
só o *Allow new users to sign up*, criando as contas pelo painel. São dois
interruptores diferentes na mesma tela, e trocar um pelo outro derruba o
login de todo mundo: com o provedor desligado, `auth/v1/settings` passa a
responder `external.email: false` e qualquer tentativa de entrar devolve
"Email logins are disabled".

Para conferir sem abrir o painel:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/settings" -H "apikey: $CHAVE"   | python -c "import sys,json;d=json.load(sys.stdin);print(d['external']['email'], d['disable_signup'])"
```

O primeiro tem de ser `True` (dá para entrar) e o segundo `True` também
(ninguém se cadastra sozinho).

Ao publicar, o **Site URL** do Supabase (Auth → URL Configuration) precisa
apontar para o domínio da Vercel, senão o link de confirmação de e-mail leva
o usuário para `localhost:3000`. Manter as duas URLs na lista de redirect
enquanto o desenvolvimento local continuar.

## Supabase

Projeto **`selling-tool`** (`qemzikxbvzghspltoejn`, região `sa-east-1`).
Variáveis em `.env.local` (ver `.env.example`).

Migrations versionadas em `supabase/migrations/`. **O nome do arquivo carrega
o timestamp exato com que a migration foi aplicada no remoto** — é assim que
o Supabase CLI sabe o que já rodou. Ao mudar o schema: aplicar, conferir o
timestamp em `list_migrations` e gravar o arquivo com esse nome. Se o
timestamp do arquivo não bater com o aplicado, um `supabase db push` tenta
rodar tudo de novo.

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

### A do Florescer é o contrário

No Florescer (`Valores Terrenos Florescer 260226.pdf`) a âncora é o **PREÇO
cheio** e as condições descem dele, todas sem juros e sem indexador:

| Condição | Fator sobre o PREÇO |
|---|---|
| PREÇO | 1,00 |
| 40% + 18x | 0,88 |
| 40% + 12x | 0,83 |
| 40% + 6x | 0,78 ← **é o que sai no PDF de VENDAS** |

O vendedor abre o valor de **6x**, que é o do `Florescer 260226 VENDAS.pdf` —
já descontado como à vista. Por isso `lotes.preco_tabela` guarda esse número,
e não o PREÇO cheio: é ele que aparece no espelho e na primeira frase da
conversa.

A consequência é que **as demais condições entram com `desconto_pct`
negativo** — são acréscimos sobre a base de 6x:

| Condição | `desconto_pct` | Como a tela mostra |
|---|---|---|
| 40% + 6x | 0 | — |
| 40% + 12x | `1 − 0,83/0,78` = −0,064103 | +6,41% |
| 40% + 18x | `1 − 0,88/0,78` = −0,128205 | +12,82% |
| Preço de tabela | `1 − 1/0,78` = −0,282051 | +28,21% |

`descontoOuAcrescimo()` em `src/lib/formato.ts` é quem troca o sinal e o
rótulo; a folha da proposta diz "Ajuste pelo prazo escolhido" no lugar de
"Condição especial" quando o número é negativo.

**Seis casas decimais, não quatro.** `condicoes_pagamento.desconto_pct` e
`proposta_cenarios.desconto_pct` são `numeric(9,6)` desde a migration 20.
Os fatores do Florescer são dízimas; em quatro casas o preço cheio de um lote
de R$ 590 mil saía R$ 22 fora do PDF que o vendedor tem na mão.

**Cuidado com "à vista".** No Florescer à vista é a coluna de 6x, não o PREÇO
cheio. A condição "Preço de tabela" nasceu com o bloco rotulado "Pagamento à
vista" e foi renomeada na migration 21 — do jeito errado, o vendedor cotaria
dinheiro na mão por R$ 589 mil onde o certo são R$ 460 mil.

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

**Exceção: bloco sem correção e sem juros.** Aí `calcularBloco()` joga a sobra
de centavos na última parcela. É o caso do Florescer, onde tudo é "sem juros":
sem esse ajuste o "total do investimento" saía seis centavos abaixo do "valor
da proposta" na mesma página do PDF, e o cliente soma a coluna à mão. Onde há
correção o comportamento antigo continua — a sobra ali não é arredondamento.

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

- `src/lib/mapa/<slug>.ts` — geometria dos polígonos, gerada por
  `npm run mapa:extrair` a partir do HTML do mapa público. **Não editar à
  mão**; se o mapa mudar, rodar o script de novo. Hoje são dois:
  `industrial-ponzoni.ts` (44 lotes, viewBox 3192×1858) e `florescer.ts`
  (127 lotes, viewBox 1920×1080).
- `src/lib/mapa/index.ts` — o registro `slug → mapa`. `MapaDaProposta` recebe
  o slug do empreendimento e pergunta a ele; empreendimento sem mapa extraído
  simplesmente não ganha a seção.
- `public/mapa-<slug>.jpg` — a foto aérea, copiada à mão do site do
  empreendimento (785 KB no Industrial, 481 KB no Florescer; mudam pouco).
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

O destaque veste as cores do empreendimento: `cor_primaria` no preenchimento
(62% de opacidade) e `cor_secundaria` no contorno e na miniatura.

## Marca

`empreendimentos.logo_url` aponta para um arquivo em `public/`, e
`cor_primaria` / `cor_secundaria` guardam as duas cores da marca.

**O cabeçalho do app é sempre Ponzoni.** `Cabecalho.tsx` busca o logo pelo
slug fixo `industrial-ponzoni` (constante `MARCA`): a ferramenta é da casa e
atende vários empreendimentos, então o topo não pode trocar de marca conforme
o que estiver aberto. Antes ele pegava "o primeiro empreendimento ativo em
ordem alfabética", e a entrada do Florescer virou a marca da ferramenta.

O logo do empreendimento aparece **ao lado do título** nas páginas de Espelho
e Mapa, e no topo da folha da proposta.

**A folha da proposta veste as cores do empreendimento.** O CSS dela é uma
função (`estilo(empreendimento)`) e as variáveis `--vinho` / `--ouro`
mantiveram o nome de quando só existia o Industrial: hoje são papéis (cor de
marca e cor de destaque), não tons. `--vinho-fraco` e `--ouro-escuro` saem por
cálculo de `src/lib/cores.ts`, para não virarem mais duas colunas no banco. O
XLSX faz o mesmo com a faixa de cabeçalho das abas.

| Empreendimento | Primária | Secundária |
|---|---|---|
| Industrial Ponzoni | `#7C2A28` vinho | `#E0A221` dourado |
| Florescer | `#5B2166` roxo | `#C4A550` dourado |

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

A fonte de verdade de **status e comprador** continua sendo o Google Sheets
de cada empreendimento — é ele que alimenta o mapa público. A ferramenta
**lê** dele; não escreve. O rodapé do espelho linka a planilha certa,
derivando o `/edit` do `espelho_csv_url` do empreendimento aberto.

- [Espelho Industrial](https://docs.google.com/spreadsheets/d/1KAKfuVyV3T6IoLI2FrxANUv1h12knJS9gDbMxJqXiS0/edit)
- [Espelho Florescer](https://docs.google.com/spreadsheets/d/1o4-YxN0ujoNQ52Nu7MkM_d6usSMkhTl8z939m7JVBSw/edit)

`POST /api/espelho/sync` baixa o CSV publicado (`empreendimentos.espelho_csv_url`,
no formato `gviz/tq?tqx=out:csv`, o mesmo `GS_URL` do mapa) e reconcilia com
a tabela `lotes`. O parser (`src/lib/espelho.ts`) acha as colunas **pelo
nome**, não pela posição — a planilha ganha coluna de tempos em tempos. O
nome do comprador mora numa coluna sem título fixo ("Coluna 1") no
Industrial e numa coluna "Comprador" no Florescer — o parser aceita as duas.

Preço só é sobrescrito quando a planilha traz um: lotes vendidos vêm com a
célula de valor vazia e não podem zerar o preço no banco. **O espelho do
Florescer não tem coluna de valor nenhuma** — os preços vieram do PDF e ficam
intocados pela sincronização, que ali só mexe em status, comprador, área e
tipo.

### Dois campos que nasceram com o Florescer

- **Status `projeto`** (5º valor do enum): lote com projeto em andamento, nem
  livre nem vendido. Os cartões de contagem do espelho só mostram o de
  "Em projeto" onde existe algum, para o Industrial não ganhar uma coluna
  vazia.
- **`lotes.tipo`** — o zoneamento (`Residencial`, `Misto I`, `Misto II`), que
  define o que se pode construir e por isso entra na conversa de venda. A
  coluna aparece na tabela do espelho **só quando algum lote a preenche**, e
  entra na busca junto com lote e comprador. No Industrial fica nula.

`observacao` é **campo livre da ferramenta e a sincronização não encosta
nele** — é editável na própria tabela do espelho, gravando ao sair do campo.
Nasceu preenchido com a coluna "Observação" da planilha de origem (TRAVADO,
Permuta, Lote de entrada…), que era nota interna da tabela de preços e foi
limpa. Os valores originais estão na migration `03_seed_industrial_ponzoni`
se um dia fizerem falta.

Ela aparece **só no espelho**, nunca na proposta do cliente. Quem pode
editar é quem pode editar lote — qualquer usuário do time, mesma regra do
status.

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

## Adicionar um empreendimento (o caminho do Florescer)

Quase tudo é dado, não código. A ordem que funciona:

**1. A linha em `empreendimentos`.** Além de `slug`, `nome` e cidade, são
cinco URLs, e cada uma serve a uma coisa diferente:

| Coluna | Para quê |
|---|---|
| `espelho_csv_url` | CSV publicado do Google Sheets, no formato `gviz/tq?tqx=out:csv` — alimenta o botão Sincronizar |
| `mapa_url` | HTML do mapa interativo, embutido na aba Mapa de lotes |
| `mapa_publico_url` | página do site com o mapa, para mandar ao cliente |
| `mapa_imagem_url` | foto aérea em `public/`, desenhada na folha da proposta |
| `logo_url` | logo em `public/`, no cabeçalho do app e no topo da proposta |

Mais `cor_primaria` e `cor_secundaria`, que vestem a folha da proposta e o
XLSX.

**2. `tabelas_preco` e `condicoes_pagamento`.** Uma tabela vigente com o INCC
e a taxa de valor presente, e uma condição por coluna da tabela de preços. Nas
condições, `oficial = true` e o **último bloco do template absorvendo o
resíduo** (ver "Três armadilhas da estrutura de pagamento").

Aqui mora a decisão que mais custa desfazer depois: **qual coluna vira
`preco_tabela`**. No Industrial é a do meio da escada (40% + 36x INCC) e as
outras são descontos; no Florescer é a ponta de baixo (40% + 6x) e as outras
são acréscimos. A regra é a mesma nos dois: `preco_tabela` é **o número que o
vendedor abre com o cliente**, e todo o resto se conta a partir dele.

`condicao_base` deve dizer qual condição é essa em português — é o que sai no
subtítulo do espelho e no rodapé do seletor de nova proposta.

**3. Os lotes.** Se a planilha traz tudo, pelo botão "Sincronizar com o
Sheets", que cria os que não existirem. Se os preços vierem de fora (o caso do
Florescer, cuja planilha não tem coluna de valor), um `insert` por migration
cruzando as duas fontes — ver a migration 19, que documenta de onde veio cada
campo e o que fazer quando as fontes divergem (o Sheets ganha; o PDF é uma
foto de uma data).

**4. Os dois assets em `public/`.** Logo e foto aérea, copiados do site do
empreendimento — `logo-<slug>.png` e `mapa-<slug>.jpg`.

**5. A geometria do mapa**, se quiser a seção "Localização no parque":

```bash
npm run mapa:extrair -- "C:/.../site-florescer/mapa-lotes-florescer.html"   src/lib/mapa/florescer.ts
```

e registrar o módulo em `src/lib/mapa/index.ts`. É o único ponto que pede
código.

**6. Conferir.** `npm run verificar` continua passando (o motor não depende do
empreendimento) — e vale acrescentar ali um punhado de conferências contra a
tabela nova, como as do Florescer que checam os quatro valores do lote A-1
contra o PDF. Depois abrir uma proposta de teste e o PDF antes de soltar.

**7. Olhar o texto do PDF.** Frases escritas quando só existia o Industrial
assumiam correção pelo INCC ("valor nominal, já com correção projetada", a
nota do cronograma, o parágrafo legal do rodapé). Todas passaram a depender de
`temCorrecao()`; se aparecer outra promessa de reajuste num empreendimento sem
indexador, é do mesmo tipo.

## Fontes de dados

Os arquivos de origem **não vão para o repositório** (`.gitignore` bloqueia
`*.xlsx` e `*.pdf`). Ficam na pasta local:

| Arquivo | O que forneceu |
|---|---|
| `Planilha valores Lotes INDUSTRIAL 260813.xlsx` | áreas, preços e a escada de desconto da tabela R n.º5 |
| `Propostas de Parcelamento.xlsx` | as estruturas de parcelamento e os números de conferência do motor |
| `Valores terrenos 260812.pdf` / `...VEND260812.pdf` | versões impressas da mesma tabela |
| Espelho de Vendas Industrial (Google Sheets) | status, comprador e o valor publicado |
| `Valores Terrenos Florescer 260226.pdf` | a escada completa do Florescer (PREÇO, 18x, 12x, 6x) |
| `Florescer 260226 VENDAS.pdf` | a coluna de 6x — os valores que o vendedor abre |
| Espelho de Vendas Florescer (Google Sheets) | status, comprador, área e tipo dos 127 lotes |

## Projetos vizinhos

- `site-industrial-ponzoni/` — mapa público de lotes, deck de lançamento e o
  memorando de negociação da Quadra C. Lê o mesmo Google Sheets.
- `site-florescer/` — mesmo padrão para o Florescer.
- `controle-gastos/` — origem das convenções de Next + Supabase daqui.
