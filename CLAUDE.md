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
npm run replicar    # copia o código-fonte para a pasta do OneDrive
```

`npm run verificar` é o teste que importa: ele reproduz números que já
existem em planilha (aba `20%+25%12xINCC+55%36xINCC`, abas `IND ...`, a
escada de desconto do espelho, as identidades fechadas do SAC e do Price) e
falha com exit 1 se o motor divergir. **Rodar depois de qualquer mexida em
`src/lib/calc/`.**

São dois arquivos: `src/lib/calc/verificar.ts` (o motor de proposta) e
`src/lib/contratos/verificar.ts` (a correção de contrato, os encargos de
atraso e a conferência que liga as duas metades — um contrato gerado de
proposta tem de reproduzir os valores do simulador no centavo). **Rodar
também depois de mexer em `src/lib/contratos/`.**

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

### A réplica em `codigo/`

`npm run replicar` copia o código-fonte para
`selling-tool-florescer/codigo/`, junto das fontes de dados, mais os manuais
em PDF em `manuais/`. Serve para ter tudo num lugar só e com backup do
OneDrive.

A réplica leva **só o que `git ls-files` devolve** — nada de `node_modules`,
`.next` ou `.git`, que é o que tornaria a sincronização um problema. Ela é
refeita do zero a cada execução, para não deixar para trás arquivo
renomeado ou apagado.

**É uma foto, não um segundo lugar para trabalhar.** Rodar `npm run dev` de
dentro dela traz de volta exatamente o problema que a mudança de pasta
resolveu. O `LEIA-ME` gerado na pasta diz isso a quem chegar por lá.

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

O usuário nasce como `corretor` e vê só o que ele mesmo criar. Para
promover (ver "Quem vê o quê"):

```sql
update perfis set papel = 'admin' where email = 'gustavo1209@gmail.com';
```

Só `admin` edita empreendimentos, tabelas de preço, condições, espelho e
índices. O corretor lê o catálogo inteiro e cria as próprias propostas,
clientes e contratos — e enxerga só esses. Ver **"Quem vê o quê
(corretores)"**, que substitui o arranjo de "leitura do time" da migration
02. Um cliente com proposta continua não podendo ser apagado.

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
entrada % + parcelas + reforços periódicos. Ele aparece nos **dois** lugares
onde a condição é escolhida — na criação da proposta e no simulador — porque
montar bloco a bloco é preciso mas lento, e o vendedor monta condição nova no
meio da conversa com o cliente.

**As parcelas também têm frequência**, não só os reforços: um select ao lado
da quantidade escolhe mensal (padrão), bimestral, trimestral, quadrimestral
ou semestral, e vira `periodicidade_meses` do bloco de parcelas — o mesmo
campo genérico que já existia para reforço (ver "Reforços periódicos"). O
rótulo da opção só cita o adjetivo quando não é mensal ("12x trimestrais
corrigidas pelo IGP-M"), para não mudar o texto do caso comum. Editar um
bloco já criado com qualquer periodicidade (inclusive bimestral e
quadrimestral) sempre foi possível pelo `BlocoEditor`; o que faltava era o
atalho na hora de montar a condição do zero.

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

## Campanhas de desconto (`/admin/campanhas`)

`campanhas` (migration 41) é um desconto promocional por tempo determinado,
sempre de **um** empreendimento: `percentual_desconto`, `inicio`/`fim` e
`ativa`. RLS no mesmo molde de `indexadores` — leitura para qualquer
autenticado, escrita só admin. Admin cadastra em `/admin/campanhas`
(`src/components/AdminCampanhas.tsx`, ações em `src/app/admin/acoes.ts`).

Uma campanha sozinha não tem estrutura de parcelamento — só o percentual.
Por isso ela não é uma condição independente: o Simulador (`/propostas/[id]`)
a oferece como opção extra **combinada com uma condição já existente da
tabela**, enquanto estiver vigente (hoje entre `inicio` e `fim`, `ativa =
true`, checado por `campanhasVigentes()` em `src/lib/campanhas.ts`). O
seletor "+ opção a partir da tabela…" ganha um `<optgroup>` "Campanhas
ativas" com uma opção por combinação condição×campanha; escolher gera um
cenário com `campanha_id` preenchido e o selo "Campanha: <nome>" ao lado do
nome da opção.

`modo` decide como o desconto da campanha se combina com o da condição
escolhida — é campo da campanha, não regra fixa do sistema:

- **`substituir`** — o percentual da campanha vira o desconto do cenário,
  ignorando o da condição (mas fica com o parcelamento dela).
- **`somar`** — soma ao `desconto_pct` da condição.

O **limite de desconto do corretor** (`desconto_maximo_corretor_pct`, ver
"Configurações") não vale para cenário com `campanha_id`: quem libera o
percentual ali é o admin ao cadastrar a campanha, não o corretor escolhendo
livre.

`campanha_id` (nullable, `on delete set null`) viaja de `proposta_cenarios`
até `contratos` quando o cenário vira venda (`gerarContratoDaProposta`), só
para rastreabilidade — aparece como o mesmo selo no cabeçalho de
`/contratos/[id]`. Campanha é feature só do Simulador: `/propostas/nova` e
`/contratos/novo` não a oferecem.

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

`/propostas/nova` e `/contratos/novo` também cadastram cliente novo, e
desde que passaram a coletar empresa/CPF/telefone/e-mail (não só o nome)
correm a mesma checagem de "Cliente duplicado entre corretores" antes de
inserir — o cliente nasce completo, sem precisar passar por `/clientes`
depois.

`/clientes` lista, pra cada um, as colunas "Propostas" e "Contratos" (selo
com link — dourado nos contratos, pra diferenciar venda fechada de
projeção) e "Cadastrado por". `apagarCliente` trava se o cliente tiver
proposta **ou** contrato vinculado, mesma mensagem e mesma ideia:
reatribuir antes de apagar. Sem a segunda checagem, apagar um cliente com
contrato apagaria em silêncio o vínculo do comprador num terreno já
vendido, porque `contratos.cliente_id` também é `on delete set null`.

Apagar cliente zera junto `negociacoes.cliente_id` do cartão do funil
vinculado a ele (mesmo `on delete set null`) — e como `negociacoes.titulo`
fica vazio assim que `cliente_id` está preenchido (é o apelido, não o nome
principal), zerar os dois de uma vez deixaria uma linha sem nome nenhum, o
que a constraint `negociacoes_tem_nome` recusa. `apagarCliente` copia o
nome do cliente pro título de qualquer negociação órfã antes de apagar,
exatamente pra não estourar essa constraint.

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

## `redirect()` não sobrevive a um try/catch

`redirect()` do Next funciona lançando um erro especial, que o runtime
intercepta para navegar. Numa server action chamada por `<form action={...}>`
isso é invisível e funciona. Mas quando a tela chama a action dentro de um
`try/catch` — como faz o `agir()` do `ContratoDetalhe`, para exibir a
mensagem de falha —, **o catch engole o redirect**: a navegação não acontece
e o usuário vê um erro para uma operação que deu certo.

Foi o que aconteceu com `apagarContrato`: o contrato era apagado e a tela
dizia que falhou. A regra que ficou: **action chamada de dentro de
`try/catch` não redireciona**; ela devolve e quem navega é o cliente, com
`router.push`. As actions que redirecionam (`criarProposta`,
`criarContrato`) são as que viajam por `<form action>`.

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

## Funil de vendas (`/funil`)

O que existe **antes** da proposta. A ferramenta começava quando o cliente já
tinha escolhido lote e condição; o que vinha antes — o lead que ligou, a
visita marcada, o "ele ficou de responder na segunda" — vivia no WhatsApp de
cada corretor.

Duas tabelas (migration 30):

- **`funil_etapas`** são as colunas do quadro, e são **dados**: o admin
  renomeia, recolore, reordena e arquiva em `/admin/funil`, sem versão nova.
  O campo que não é decoração é `desfecho` (`aberta` / `ganha` / `perdida`) —
  é dele que sai a contagem de negociações em andamento, e é ele que faz o
  cartão carimbar `fechada_em` ao chegar numa coluna terminal.
- **`negociacoes`** são os cartões. Um por oportunidade, **não** um por
  cliente: o mesmo comprador pode estar negociando dois lotes em momentos
  diferentes. Por isso não é uma coluna em `clientes`.

O cartão **nasce solto** — um nome e um telefone, que é o que se tem depois
de uma ligação — e vai ganhando vínculo: cliente cadastrado, empreendimento,
lote, proposta, contrato. Nenhum é obrigatório de propósito: se exigisse
cliente cadastrado, ninguém registraria a ligação de quinta-feira. O botão
"Cadastrar como cliente" no cartão fecha o caminho de volta, que senão seria
cadastrar em `/clientes` e lembrar de voltar ao quadro para vincular.

`fechada_em` é **derivado da coluna, nunca digitado** — quem arrasta para
"Fechado" não vai carimbar a data, e quem arrasta de volta deixaria a data
velha lá, com o cartão contando como fechado para sempre.

### O quadro cabe na tela

Sem rolagem lateral: o quadro é uma grade de **N colunas iguais**, com N vindo
do número de etapas no quadro (`--colunas`, uma variável CSS inline, porque o
Tailwind não gera classe a partir de valor dinâmico). `minmax(0, 1fr)` é a
peça que importa — é ela que faz a coluna encolher em vez de empurrar a
vizinha para fora. Com largura fixa, acrescentar etapa escondia a última,
justamente onde a negociação fecha.

Dez colunas cabem em ~135px cada num monitor de 1512px, e a essa largura um
nome de uma palavra só não cabe inteiro: por isso o título da coluna tem
`hyphens-auto`, que parte na sílaba (o documento é `lang="pt-BR"`) em vez de
cortar no meio da letra.

Abaixo de `md` vira coluna única, empilhada. Sete faixas de 40px não seriam um
quadro.

### Arrastar

Drag-and-drop do próprio navegador, sem biblioteca: é uma dependência a menos
numa ferramenta que tem cinco, e a lista de um corretor cabe na tela — o que
faz as bibliotecas ganharem (virtualização, listas de milhares) não se
aplica aqui.

`negociacoes.ordem` é `numeric` por causa disso: soltar um cartão entre dois
outros grava o **ponto médio** das duas ordens e não reescreve mais nada.
Soltar sobre um cartão insere antes dele; soltar no vazio da coluna manda
para o fim.

O cartão se move na tela antes da resposta do servidor via `useOptimistic` —
e volta sozinho ao que o banco disser se a gravação falhar. **Não trocar por
um `useState` sincronizado por `useEffect`**: além de ser o padrão que o
React desaconselha, o lint da casa (`react-hooks/set-state-in-effect`)
recusa.

Uma coluna arquivada some do quadro, mas **só quando esvazia** — senão os
cartões que ficaram nela sumiriam junto. Pelo mesmo motivo `apagarEtapa`
conta os cartões antes e sugere arquivar; o banco impede com
`on delete restrict`, mas a mensagem dele é a de chave estrangeira.

## Administração pela tela (`/admin`)

Três telas, todas atrás de `perfilAtual()?.ehAdmin` **e** da RLS:

| Rota | Para quê |
|---|---|
| `/admin/empreendimentos` | cadastrar loteamento, apontar o espelho do Sheets, montar tabela de preço e condições, sincronizar lotes |
| `/admin/corretores` | promover a admin e restringir empreendimentos |
| `/admin/funil` | as colunas do kanban |
| `/admin/campanhas` | desconto promocional por tempo determinado, por empreendimento (ver "Campanhas de desconto") |

O `redirect("/")` nas páginas e o `exigirAdmin()` das ações são cortesia: as
policies já recusariam. O que `exigirAdmin()` acrescenta é a frase em
português no lugar de "new row violates row-level security policy" — e evitar
que um update que a policy simplesmente não alcança (zero linhas, sem erro)
seja relatado como sucesso.

## Configurações (`/admin/configuracoes`)

Opções da casa, numa linha única (`configuracoes`, id fixo = 1 — não é
catálogo, é configuração global, migrations 37 e 38).
`src/lib/configuracoes.ts` → `obterConfiguracoes()` lê essa linha em
qualquer server component ou action que precise saber o que está ligado;
`src/components/ConfiguracoesForm.tsx` é o formulário, dividido nas mesmas
seções da tela.

**Financeiro do corretor, granular** (`corretor_ve_valor_contrato`,
`corretor_ve_recebido`, `corretor_ve_saldo_e_atraso`) — por padrão os três
desligados: o corretor vê em `/contratos` só a própria comissão, não o
financeiro da casa. Cada opção liga um pedaço de volta (Valor, Recebido,
ou Saldo corrigido/Parcelas/Próximo vencimento/Em atraso); admin sempre vê
tudo, os interruptores só ampliam o que o corretor enxerga, nunca
restringem o admin.

**Limite de desconto do corretor** (`desconto_maximo_corretor_pct`,
fração — `null` é sem limite) — bloqueio duro em `criarProposta` e
`salvarProposta` (`src/app/propostas/acoes.ts`): se `!ehAdmin` e o
`descontoEfetivoPct` de qualquer cenário passar do limite, a ação lança
erro antes de gravar (em `criarProposta`, que já tem a proposta inserida
nesse ponto do fluxo, ela é apagada de novo — `on delete cascade` limpa os
lotes junto, sem deixar proposta órfã). Vale para qualquer cenário,
oficial ou montado: isentar condição oficial exigiria guardar o desconto
"original" da condição pra comparar contra o que foi editado depois, e o
schema não guarda isso. Se a escada oficial já tiver um degrau maior que o
limite configurado, é o número que precisa subir, não o cenário que devia
ser isentado. A exceção deliberada é o cenário com `campanha_id` (ver
"Campanhas de desconto") — ali quem liberou o percentual foi o admin ao
cadastrar a campanha, não o corretor escolhendo livre, então o limite não
se aplica.

**`corretor_monta_opcao_livre`** — desligado, esconde o botão "Montar
opção" (`NovaPropostaForm`, `Simulador`) do corretor. É só cortesia de
tela, no mesmo espírito do resto do app: a API não recusa um payload
customizado que chegue de outro jeito.

**`nivel_duplicidade_cliente`** — ver "Cliente duplicado entre corretores".

**`clientes_compartilhados`** — ver "O cliente deixou de ser do time".

**Padrões de contrato novo** (`dia_vencimento_padrao`,
`juros_mora_padrao`, `multa_atraso_padrao`) — usados como valor inicial
tanto no formulário manual (`NovoContratoForm`) quanto em
`gerarContratoDaProposta`, que passou a gravar esses três campos
explicitamente em vez de cair no default fixo da coluna (10 / 1% / 2%).
Cada contrato continua editável individualmente depois — isso é só o
ponto de partida.

**`corretor_ve_vgv`, `corretor_ve_comprador`, `corretor_ve_preco_vendido`**
— os três desligados por padrão, mesma regra de "O comprador e o VGV são
da casa". Os dois últimos mudam a própria view `lotes_visiveis` (migration
38: `create or replace view`, mesmas colunas da 31, só troca os
`case when` pra checar a configuração além de `is_admin()`) — continua
SECURITY DEFINER, então o `revoke`/`grant` de coluna da migration 28 não
entra em conflito, é só uma trava a mais contra `select *` direto em
`lotes`. VGV é interface pura (não passa por `lotes_visiveis`): o dado já
chega sem máscara, o que muda é só o `{mostrarVgv && (...)}` no card, na
home e no espelho.

**Alertas em app** (`alertar_parcela_atrasada`, `alertar_proposta_vencendo`
+ `dias_aviso_proposta_vencendo`) — banners de contagem, sem valor em R$,
então não vazam o que os interruptores de financeiro escondem. O de atraso
aparece em `/contratos` só pro corretor (admin já tem o cartão detalhado);
o de proposta vencendo aparece em `/propostas` pros dois papéis, calculado
sobre `data_base + validade_dias` com `diasEntre`/`hojeISO` de
`src/lib/contratos/mes.ts`.

## Adicionar um empreendimento (o caminho do Florescer)

Quase tudo é dado, não código. Desde a migration 31 os passos 1, 2 e 3 têm
tela: **`/admin/empreendimentos`** faz o cadastro, a tabela de preço, as
condições e o Sincronizar, na ordem abaixo. O SQL continua valendo para
quando a origem dos preços não é o Sheets — foi o caso do Florescer, cuja
migration 19 cruza planilha e PDF.

A ordem que funciona:

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
código — junto dos dois arquivos de `public/`, que são arquivo no
repositório e não linha no banco. É por isso que a tela de administração
pede o **caminho** do logo e da foto aérea em vez de aceitar upload.

**6. Conferir.** `npm run verificar` continua passando (o motor não depende do
empreendimento) — e vale acrescentar ali um punhado de conferências contra a
tabela nova, como as do Florescer que checam os quatro valores do lote A-1
contra o PDF. Depois abrir uma proposta de teste e o PDF antes de soltar.

**7. Olhar o texto do PDF.** Frases escritas quando só existia o Industrial
assumiam correção pelo INCC ("valor nominal, já com correção projetada", a
nota do cronograma, o parágrafo legal do rodapé). Todas passaram a depender de
`temCorrecao()`; se aparecer outra promessa de reajuste num empreendimento sem
indexador, é do mesmo tipo.

## Quem vê o quê (corretores)

Dois papéis, e a regra é uma só: **vê quem criou; admin vê tudo.**

| Papel | Enxerga |
|---|---|
| `corretor` (padrão de todo cadastro novo) | as propostas, os clientes e os contratos que ele mesmo criou. No espelho, tudo menos o nome do comprador e o VGV; a própria comissão em `/cobranca`, não o financeiro da casa em `/contratos` (ver "`/cobranca` é telas diferentes por papel") |
| `admin` | tudo, e é o único que edita tabela de preço, espelho e índices |

O financeiro do corretor, o comprador, o VGV e o preço de lote vendido têm
interruptor em `/admin/configuracoes` (ver "Configurações") — o padrão de
cada um é o que esta tabela descreve, mas o admin pode ligar de volta.

Hoje os admins são Gustavo e Gelson. Para promover alguém:

```sql
update perfis set papel = 'admin' where email = 'fulano@exemplo.com';
```

**A RLS é quem separa** (migration 26); a interface só evita oferecer o que
o banco recusaria. Menu, botões do espelho e a página `/indices` olham
`perfilAtual()` de `src/lib/supabase/perfil.ts` — isso é cortesia, não
controle de acesso. Ao escrever tela nova, a pergunta certa continua sendo
"a policy deixa?".

**Armadilha: subquery na própria tabela recursiona a RLS.** A migration 43
escreveu o `with check` de "perfis: edita o próprio" com três subselects
direto em `perfis` (`select p.papel from perfis p where p.id = auth.uid()`).
Isso estoura `infinite recursion detected in policy for relation "perfis"`
em qualquer update — mesmo a subquery sendo trivial, o Postgres detecta que
a RLS de `perfis` já está em avaliação para a linha e recusa entrar de novo.
A correção (migration 59) foi a mesma receita de sempre: uma função
`security definer` (`meu_perfil_atual()`, molde de `is_admin()` e
`minha_organizacao()`) para ler o próprio perfil sem passar pela RLS de
novo. **Nunca fazer `select ... from perfis where id = auth.uid()` dentro de
uma policy de `perfis`** — sempre por função.

### Quais empreendimentos cada corretor vê

**O padrão continua sendo ver todos** — a restrição é opt-in, pessoa a
pessoa, em `/admin/corretores`. São duas peças (migration 31):
`perfis.empreendimentos_restritos` liga a trava e `corretor_empreendimentos`
diz o que fica visível. Duas em vez de uma porque "lista vazia" seria
ambíguo: desmarcar o último empreendimento não pode significar "vê tudo de
novo".

Quem separa é a RLS. `pode_ver_empreendimento()` entra nas policies de
leitura de `empreendimentos`, `lotes`, `tabelas_preco` e
`condicoes_pagamento` — e **também no `where` da view `lotes_visiveis`**,
porque ela é SECURITY DEFINER e não aplica a RLS da tabela. É exatamente o
caso que o comentário da migration 28 antecipou ("se um dia a leitura de
lotes for restringida, a view precisa repetir o filtro"); ao mexer nessa
view, repetir o filtro de novo.

Efeito colateral conhecido: uma proposta ou contrato antigo de um
empreendimento que o corretor deixou de ver continua na carteira dele, mas o
join com `empreendimentos` volta nulo. Restringir quem já tem histórico é
decisão da casa, não acidente.

Em `/admin/corretores`, "Aplicar em massa" grava a mesma trava e a mesma
lista de empreendimentos para vários corretores de uma vez
(`definirAcessoEmpreendimentosEmMassa`), em vez de repetir "Salvar acesso"
pessoa a pessoa. Admin nunca entra: a ação recusa qualquer id de admin na
lista, porque admin enxerga tudo por definição e a trava não se aplicaria.

### O que continua compartilhado

O catálogo, porque é dele que se vende: empreendimentos, lotes, tabelas de
preço e condições — inclusive as favoritas do time. Um corretor lê o
espelho inteiro e o mapa; só não altera.

**E a série de índices, que é a pegadinha.** `indices_mensais` continua
legível por qualquer autenticado de propósito: a correção das parcelas é
calculada no servidor com o cliente Supabase **do usuário**, e um corretor
que não pudesse ler a série veria o próprio contrato com fator 1 em toda
parcela — sem erro, sem aviso, só com o valor errado. Não é dado sensível: é
o número que a FGV publica. O que se restringe é escrever, e a tela some do
menu de quem não é admin.

### O comprador e o VGV são da casa

Duas informações somem para o corretor no espelho e na página inicial: o
**nome do comprador** de cada lote e o **VGV**.

O comprador é mascarado no banco, não na tela — a mesma chave que a página
usa serve para chamar a API REST, e `select=comprador` devolveria a lista
inteira. Como Postgres não tem RLS por coluna, a migration 28 faz o
seguinte:

1. `authenticated` perde o SELECT na coluna `comprador` de `lotes`. Não
   adianta revogar só a coluna: o Supabase concede SELECT na tabela toda por
   padrão, então é preciso derrubar e devolver coluna a coluna, sem essa;
2. a view **`lotes_visiveis`** devolve todas as colunas, com o comprador
   preenchido só quando `is_admin()`.

**Toda leitura de lote na aplicação passa por `lotes_visiveis`; a escrita
continua em `lotes`.** Um `select("*")` na tabela agora estoura "permission
denied for table lotes" — se aparecer esse erro, é isto. Escrever continua
funcionando porque UPDATE não exige SELECT na coluna; o que não funciona
mais é ler a coluna dentro do próprio UPDATE (`set comprador = comprador`),
nem para admin.

A view é SECURITY DEFINER, e precisa ser: com `security_invoker = on` ela
rodaria com os privilégios de quem chama — justamente quem não pode ler a
coluna. Em troca ela não aplica a RLS de `lotes`, o que hoje dá no mesmo
(a policy de leitura é `using (true)`). **Se um dia a leitura de lotes for
restringida, a view precisa repetir o filtro.**

A mesma view esconde o **preço de lote vendido ou indisponível** (migration
29), nos dois empreendimentos: o que o corretor precisa saber é o preço do
que ele pode vender, e num lote vendido aquele número é o que alguém pagou.
Livre, reservado e em projeto continuam com preço — é o catálogo. Efeito
colateral aceito: ao cadastrar contrato de venda antiga, o rateio entre
lotes perde a base de preço de tabela e divide igual; o valor total do
contrato é digitado de qualquer forma.

O VGV é só interface: `ehAdmin` esconde o cartão no espelho e na home.

### O cliente deixou de ser do time

A migration 09 abriu `clientes` para todo mundo porque prender a edição ao
autor gerava cadastro duplicado quando outra pessoa atendia o mesmo
comprador. A 26 reverte isso: com corretores, a carteira de contatos de um
não pode aparecer para o outro. **O duplicado volta a ser possível, e é o
preço combinado** — se um dia a casa voltar a ser uma equipe só, é a
primeira policy a revisitar. `configuracoes.clientes_compartilhados` (ver
"Configurações") é justamente esse dia, se ele chegar, sem precisar mexer
em RLS de novo.

### Cliente duplicado entre corretores

`configuracoes.nivel_duplicidade_cliente` decide o que acontece quando um
CPF, um nome+telefone ou um e-mail batem com o cliente de **outro**
corretor: `desligado` não checa nada, `avisar` (padrão) cadastra e mostra
um aviso âmbar, `bloquear` recusa o cadastro. A checagem roda pela função
`cliente_duplicado` (migrations 34, 35 e 38 — a 38 acrescentou o e-mail),
SECURITY DEFINER que só devolve um boolean: nunca revela quem é o outro
corretor nem o cadastro dele, preservando o combinado desta seção mesmo no
nível "bloquear". `revoke ... from anon` (migration 35) é de propósito —
diferente das outras `pode_ver_*`, esta recebe CPF/telefone/e-mail livres
como parâmetro, e sem a revogação um anônimo sem login conseguiria varrer
CPFs pela API REST.

Vale nos lugares que criam cliente com dados completos: `/clientes`,
dentro do Simulador (cartão Cliente da proposta), e desde que
`/propostas/nova` e `/contratos/novo` passaram a coletar
empresa/CPF/telefone/e-mail (não só o nome) também neles.

### Autoria na tela

As listagens de propostas e contratos trazem a coluna "Criada por" /
"Cadastrado por", e o mesmo nome aparece no topo do simulador e do contrato.
`criado_por` referencia `auth.users`, não `perfis`, então o PostgREST não faz
o join sozinho: `mapaDePerfis()` carrega os poucos usuários de uma vez e
resolve em memória.

### Contas

O cadastro aberto foi fechado — as contas dos corretores são criadas pelo
painel do Supabase (Authentication → Users → Add user). Manter o **provedor
Email ligado** e desligar só o *Allow new users to sign up*: são dois
interruptores na mesma tela, e trocar um pelo outro derruba o login de todo
mundo (ver "O que fica exposto").

## Marcar como teste

Checkbox no Simulador (proposta) e em "Editar contrato"
(`ContratoDetalhe`). Nasce na proposta — o corretor sabe desde o início
que é treino ou teste — e o contrato gerado dela
(`gerarContratoDaProposta`) copia a marcação sozinho; também dá pra marcar
direto num contrato cadastrado manualmente, que não tem proposta de
origem.

Um contrato de teste continua listado em `/contratos`, com um selo cinza
"Teste" — dá pra gerenciar e apagar sem procurar em outro lugar — mas fica
de fora de `/cobranca` (a query já filtra `teste = false`, inclusive na
exportação XLSX) e de qualquer soma de dinheiro em `/contratos` (cartões
de KPI, coluna "Comissão"): a lista de contratos reais
(`src/app/contratos/page.tsx`) exclui teste antes de qualquer `reduce`.

## Depois da venda: contratos, índices e cobrança

A ferramenta ia até a proposta. `contratos` é a outra metade: o que já foi
vendido, o que já foi pago e quanto cobrar neste mês.

A diferença entre as duas metades é o que explica quase todas as decisões
daqui. **A proposta é projeção** — o motor monta o fluxo a partir de blocos e
de uma taxa estimada. **O contrato é fato** — o cronograma está fechado, cada
parcela tem data e valor de origem, e a correção que vale é a que os índices
publicados mandarem. Por isso as parcelas do contrato são LINHAS
(`contrato_parcelas`) e não blocos: cronograma de contrato se edita parcela a
parcela — o cliente antecipa, renegocia um vencimento, paga um valor
diferente — e nada disso cabe num template.

### `valor_corrigido` não é coluna

É derivado, em `src/lib/contratos/correcao.ts`, e muda toda vez que um índice
novo é lançado. Gravar seria congelar um número que ainda vai mudar. O que se
grava é o que aconteceu de fato: `valor_pago` e `pago_em`.

O único número que não se recalcula é o `valor_pago`: o corrigido de hoje
muda quando entra índice novo, e o que o cliente pagou naquele dia não muda
mais.

### A série mensal dos índices

`indexadores` guarda a taxa de **referência** — um número só, derivado do
acumulado em 12 meses, para projetar proposta. Não serve para cobrar.
`indices_mensais` guarda a **série**: uma linha por índice por mês, com a
variação do mês em fração (`0.0085` = 0,85%). A correção acumulada é o
produto dos `(1 + variacao)`, nunca a soma.

Lançada em `/indices`, na grade ano × mês. Lançar de novo o mesmo mês
substitui o número — é assim que a prévia do INCC-M vira o índice fechado, e
por isso a ação é `upsert`.

Ao lançar, `recalcularReferencia()` refaz sozinha a taxa de projeção em
`indexadores` a partir dos últimos 12 meses — **só quando há 12 meses
seguidos, sem buraco**. Um acumulado de três meses anualizado é pior que o
número que veio da fonte.

Índices sem série lançada continuam funcionando: a parcela é estimada pela
taxa de referência e sai marcada `estimado`. A tela mostra `~`, e a tela de
cobrança avisa em barra âmbar — **não emitir boleto de linha estimada**, o
valor ainda vai mudar.

### O botão que puxa os índices (`src/lib/indices/bcb.ts`)

"Atualizar pelo Banco Central" busca a série no SGS — API aberta, sem chave,
que espelha o número publicado pela FGV.

**Os códigos foram conferidos contra o seed da migration 11, não são chute.**
O acumulado em 12 meses até ago/2026 calculado da série 7456 dá 6,5542%
contra os 6,56% do INCC-M cadastrado; a 189 dá 2,1782% contra os 2,16% do
IGP-M; a 433 dá 4,4430% contra os 4,44% do IPCA.

| Índice | Série SGS |
|---|---|
| INCC-M | 7456 — **é esta**, não a 192 |
| IGP-M / IPCA / INPC / IGP-DI | 189 / 433 / 188 / 190 |
| Selic / CDI (acumulados no mês) | 4390 / 4391 |
| TR, CUB-RS | não têm série mensal utilizável |

A 192 é o **INCC-DI**, irmão do M com outra janela de coleta: em ago/2026 deu
0,66% contra os 0,85% do INCC-M. Trocar um pelo outro erra o boleto sem
avisar. A **TR** existe no SGS (série 226), mas é **diária** — uma linha por
dia, com `dataFim` —, e importá-la produziria competências repetidas. O
**CUB-RS** é do Sinduscon e não está no SGS. Os dois continuam manuais.

**O mês corrente nunca entra.** As séries acumuladas no mês trazem o parcial
até hoje: em 08/09/2026 a Selic de setembro aparecia como 0,21% enquanto
agosto, fechado, tinha 1,09%. Gravar isso como "a variação de setembro"
corrigiria parcela com um número que ainda vai crescer. Nos índices de
inflação o corte não custa nada — o INCC de setembro entra na primeira
atualização feita em outubro, que é quando o boleto de outubro sai.

Por padrão o botão **só completa lacunas**: mês já lançado fica como está.
Quem lançou à mão pode ter corrigido um número contra o comunicado da FGV, e
sobrescrever calado desfaria a correção. O checkbox "substituir os meses já
lançados" liga o outro modo.

### Como a parcela é corrigida

`fatorAcumulado()`, e são três parâmetros que precisam andar juntos:

- **quantos índices entram** — um por mês decorrido desde `data_base`;
- **`defasagem_indice_meses`** — quais índices, não quantos. Com defasagem 1,
  a parcela do mês M usa de (base − 1 + 1) até (M − 1): o mesmo número de
  meses, todos já publicados quando o boleto sai. O INCC-M de outubro é
  divulgado no fim de outubro, e o boleto que vence no dia 10 saiu antes;
- **`corrige_primeira_parcela`** — a mesma convenção de
  `propostas.correcao_primeira_parcela`. Desligada, a parcela do mês M
  acumula M − 1 índices, que é o fator `(1+i)^(m−1)` das planilhas
  "Propostas de Parcelamento".

**O terceiro não é detalhe.** Sem ele, um contrato gerado de uma proposta
cobraria um mês de INCC a mais do que foi vendido — diferença que só
apareceria no boleto, contra o papel que o cliente assinou. `gerarContratoDaProposta`
copia a convenção da proposta; o cadastro manual nasce com `true`, que é o
que o contrato de loteamento diz.

`npm run verificar` cobre isso: a última seção monta uma proposta no motor,
gera o contrato dela, alimenta uma série com o mesmo INCC que a projeção usou
e confere que a 1ª e a 36ª parcela batem **no centavo** com o simulador.

### O principal gravado é o nominal

`cronogramaDeResultado` grava `valor − correcao`, e não o valor que o
simulador mostra: guardar o número projetado embutiria a estimativa no
principal e corrigiria duas vezes o mesmo mês. Bloco com SAC ou Price é a
exceção — ali o indexador entrou como juro dentro da parcela, o valor já é
final e a linha nasce sem indexação.

Tirar a correção parcela a parcela deixa alguns centavos de sobra contra o
valor negociado. O rateio é **de um centavo por parcela, a partir da
primeira**, e não uma sobra jogada na última: a última parcela é a que o
cliente confere contra o papel da proposta.

### Encargos de atraso

Multa percentual fixa sobre o corrigido, mais juros de mora pro rata die na
convenção de 30 dias. Só no que já venceu e não foi pago. A baixa sugere o
valor com encargos, mas o campo é editável — quando houve acordo, o que vale
é o que entrou.

### Baixa em lote

Um contrato antigo entra na ferramenta com anos de parcelas já quitadas, e
dar baixa em trinta delas uma a uma não é trabalho de gente. A tabela do
cronograma tem seleção múltipla, um atalho "selecionar as N vencidas" e uma
barra de ação com dois modos de datar:

- **cada uma no seu vencimento** (o padrão) — é o certo para o contrato
  antigo. Datar tudo com hoje marcaria como paga hoje uma parcela quitada em
  2024, e o contrato passaria a exibir encargos de atraso que nunca
  existiram;
- **uma data para todas** — quando o cliente quitou um bloco de uma vez.

O valor gravado é o que a parcela valia **na data do pagamento**: o cálculo
roda uma vez por data, com `hoje` fixado nela, então quem pagou em dia tem o
corrigido do vencimento e quem pagou depois tem o corrigido com multa e
juros. A exceção é a parcela cuja correção depende de mês sem índice
lançado — ali o valor fica `null` em vez de gravar uma estimativa como se
fosse dinheiro que entrou.

O lápis numa parcela **já paga** reabre a baixa preenchida, para corrigir
data, valor ou forma sem ter de desfazer e refazer.

### As telas

| Rota | Para quê |
|---|---|
| `/contratos` | carteira: saldo corrigido, recebido, em atraso |
| `/contratos/novo` | venda antiga, montada como o papel: entrada + mensais + reforços |
| `/contratos/[id]` | cronograma, correção parcela a parcela e baixa de pagamento |
| `/contratos/[id]/demonstrativo` | folha A4 para o cliente, com o fator de cada parcela |
| `/cobranca` | admin: **o que cobrar** — a lista dos boletos. Corretor: a própria comissão a receber (ver "`/cobranca` é telas diferentes por papel") |
| `/indices` | a série mensal, grade ano × mês |

A lista de lotes em `/contratos/novo` traz **todos os status**, inclusive
vendido: é justamente onde estão as vendas antigas. E o cadastro **não mexe
em `lotes.status` nem em `lotes.comprador`** — a fonte de verdade desses dois
continua sendo o Google Sheets, e a próxima sincronização sobrescreveria.

O formulário segue a soma da tabela dos terrenos marcados até alguém
digitar um valor manualmente (`valorTotalManual` — derivado a cada
render, não um `useEffect` com `setState`, que o lint da casa recusa pelo
mesmo motivo do arrastar do funil); "Entrada" é percentual, igual ao
Simulador e ao "Montar opção", em vez de um campo aberto em R$; e o card
de cada lote mostra o preço e o selo de status colorido, no mesmo padrão
de `/propostas/nova`.

`/cobranca` mostra os vencimentos da janela escolhida **mais o que ficou em
atraso antes** — quem emite boleto precisa das duas coisas na mesma tela. A
janela é "De"/"Até" (não só um mês): sem "Até" preenchido diferente de "De" é
um mês só, igual sempre foi; com ele, soma vários meses de uma vez (atalhos
de 1/3/6/12 meses, e "anterior"/"próximo" preservam o tamanho da janela —
`mesesEntre`/`somarMeses` de `src/lib/contratos/mes.ts`). O filtro que tira
as atrasadas é `so_mes=1`, e não um `atrasadas=0`, porque checkbox de GET não
manda nada quando é desmarcado: a informação tem de viajar na exceção.

Uma parcela paga **continua na lista do período** em vez de sumir assim que
alguém dá baixa — antes, dar baixa também tirava a parcela da tela, e não
dava pra ver junto o que já entrou e o que ainda falta no mesmo período.
Agora ela aparece com selo "Paga", fundo verde e o valor realmente pago (não
o projetado), e o cartão "Recebido no período" soma essas à parte de "Total
a cobrar" — que continua só com o que falta receber, igual à exportação
XLSX (nada de boleto pra quem já pagou).

O XLSX de `/cobranca` (só admin) é a planilha que vai para o banco: uma
linha por boleto, com sacado, documento, vencimento e valor, mais as
colunas de origem do número, para o mesmo período da tela. A coluna
**"índice estimado"** é a que impede o erro caro.

### `/cobranca` é telas diferentes por papel

Pro admin, `/cobranca` sempre foi a tabela de boletos do comprador —
financeiro da casa, sem mudança. Pro corretor, virou a tela da **comissão
dele**: parcela por parcela de `contrato_comissao_parcelas`, na mesma
janela De/Até e mesmo filtro de empreendimento, com cartões "Recebido no
período" / "Comissão a receber" / "Do período" / "Em atraso de antes". Ele
não vê o financeiro do comprador ali — é o mesmo espírito de "Financeiro do
corretor, granular" (ver "Configurações"), só que pra comissão em vez do
contrato.

Contratos com comissão **definida mas sem cronograma gerado ainda** entram
num aviso à parte (nome, valor, link pro contrato) em vez de sumir da tela
— antes disso existir, o corretor simplesmente não via nada sobre uma
comissão que já tinha valor certo.

`src/app/cobranca/page.tsx` implementa as duas com funções separadas —
`TabelaDeBoletos` (admin) e `TabelaDeComissao` (corretor) — escolhidas por
`perfilAtual()?.ehAdmin` dentro da mesma rota. A coluna e os cartões de
"Comissão" saíram de `/contratos` pro corretor nessa mudança (viraram
admin-only em `ContratosTabela.tsx`) — antes ficavam duplicados nas duas
telas.

### Quais colunas saem no documento

`contratos.colunas_documento` (migration 32) escolhe as colunas do
cronograma, e vale para as duas saídas — o demonstrativo em PDF e o XLSX. O
catálogo é um só, em `src/lib/contratos/colunas.ts`; cada coluna declara em
qual das duas sabe se desenhar, e as que só existem na planilha (`encargos`,
`a cobrar`, `forma`, `boleto`) a folha ignora.

**`null` é "todas"**, e é o que todo contrato antigo é: sem configurar nada, o
documento sai como sempre saiu. Marcar todas grava `null` de novo, e uma
lista que zerou também vira "todas" — um cronograma sem coluna nenhuma seria
uma folha em branco, não um documento. O efeito é que contrato configurado no
padrão e contrato nunca tocado são a mesma linha no banco.

O caso que pediu isso é o inverso do que a folha assumia: ela mostrava valor
de origem e valor corrigido lado a lado para explicar a correção, e o cliente
que só quer saber quanto paga liga perguntando qual dos dois vale. Desmarcar
"Valor de origem" resolve.

A escolha fica **gravada no contrato**, não é feita na hora de imprimir: quem
entrega o documento entrega mais de uma vez, e a segunda via tem de sair
igual à primeira. Configura-se em `/contratos/[id]`, no botão "Colunas do
documento".

Ao acrescentar coluna nova, o lugar é o catálogo — a folha
(`montarColunas` em `FolhaDemonstrativo`) e a rota do XLSX (`COLUNAS_XLSX`)
leem dele, e o rodapé "Total do cronograma" calcula o `colSpan` a partir da
primeira coluna que tem total. Não voltar a escrever `colSpan` na mão.

### Contrato é dado do escritório

A RLS segue `clientes`, não `propostas`: o time lê e escreve, e só o autor ou
um admin apaga. Quem dá baixa num pagamento raramente é quem fechou a venda.

### Qual opção virou contrato

"Gerar contrato", no Simulador, pergunta qual das opções de pagamento da
proposta o cliente fechou — abre uma janela listando todas (a recomendada
marcada, com um resumo de valor/entrada/parcela) em vez de assumir a aba
que estava aberta. Com mais de uma opção, quem clicava enquanto olhava um
comparativo podia gerar o contrato da opção errada sem perceber.

### Comissão do corretor

`contrato_comissoes` (migrations 33 e 39) é opcional e nasce **pendente**:
sem linha pra um contrato, é "aguardando o admin definir" — a tela mostra
o selo "Pendente de definição" e só admin tem o botão pra preencher (RLS:
`insert`/`update` exigem `is_admin()`, o corretor só lê).

`valor_absoluto` é o total da comissão. A forma de pagamento é
**estruturada**, não texto livre: `comissao_parcelas`,
`comissao_primeiro_pagamento_dias` e `comissao_intervalo_dias` bastam pra
`descreverFormaPagamento()` (`src/lib/comissao.ts`) montar sozinha a frase
que o corretor vê — "À vista, no ato" ou "3x de R$ 6.666,67, a primeira em
30 dias, a cada 30 dias". `forma_pagamento` (o campo de texto que existia
antes) virou observação complementar, pra quando os três campos não
bastam.

**Permuta tem dois números que não são o mesmo:** `permuta_valor_mercado`
é só informativo (quanto vale o bem trocado) e `permuta_valor_abatido` é
quanto disso desconta de verdade do dinheiro que o corretor recebe —
`valorComissaoEmDinheiro()` faz `valor_absoluto − permuta_valor_abatido`.
Os dois podem divergir (o corretor pode topar receber menos em dinheiro do
que o bem vale, ou o contrário), por isso são campos separados em vez de
um só.

### Cronograma de pagamento da comissão

`contrato_comissao_parcelas` (migration 40) é a mesma ideia de
`contrato_parcelas`, sem correção nem encargos — a comissão não é
indexada. As linhas nascem a partir dos três campos estruturados acima,
aplicados sobre `contrato.data_contrato`; cada parcela tem baixa própria
(`darBaixaComissaoParcela`/`desfazerBaixaComissaoParcela`, em
`src/app/contratos/acoes.ts`), e uma parcela paga **continua aparecendo**
na lista, com selo "Paga", em vez de sumir.

**`definirComissao` gera o cronograma sozinha logo depois de salvar** —
não precisa mais do clique separado em "Gerar cronograma de pagamento"
(um passo fácil de esquecer, que deixava a comissão "sem data nenhuma" até
alguém lembrar). A geração só é pulada quando já existe alguma parcela
baixada: editar o percentual ou a forma de pagamento depois de já ter
recebido de verdade não pode apagar esse histórico sem avisar. Nesse caso
continua exigindo o clique explícito em **"Recriar cronograma"**, que
confirma antes, com uma frase diferente quando já existe baixa dada. A
lógica de gerar as linhas é uma função interna só
(`gerarLinhasDeComissao`), chamada tanto por `definirComissao` quanto pela
action `gerarParcelasComissao` do botão manual.

Em `/contratos`, "Comissão a receber" soma as parcelas ainda não pagas (ou
o valor em dinheiro inteiro, pra comissão que ainda não tem cronograma
gerado) e "Comissão recebida" soma as já pagas — os dois cartões existem
justamente pra separar o que já entrou do que ainda falta, o mesmo par que
"Já recebido" / "Carteira a receber" já fazia pro financeiro do cliente.

## Tema escuro

Uma segunda pele sobre os mesmos tokens: `globals.css` redefine os
`--color-*` de `@theme` e pronto. O Tailwind v4 gera os utilitários como
`var(--color-…)`, então trocar o valor troca `bg-papel`, `text-cinza`,
`.cartao` e o resto de uma vez. **Nenhum componente ganhou variante `dark:`**,
e ao escrever tela nova a regra continua sendo usar os tokens da casa — quem
escreve `bg-white` no meio do caminho é quem quebra o escuro.

O tema mora em `data-tema` no `<html>`, com três valores: `claro`, `escuro` e
`sistema` (o padrão). O `sistema` não é um terceiro visual — é "não escolhi",
e aí decide o `prefers-color-scheme`. É o único que precisa de media query.

**O cookie existe para o servidor mandar a página já pintada.** Com o tema só
no `localStorage`, toda navegação abriria clara e viraria escura no primeiro
frame de JavaScript. O layout raiz lê o cookie e estampa o atributo; o botão
do cabeçalho (`TemaBotao`) troca o atributo na hora e grava o cookie para a
próxima visita — sem server action e sem `router.refresh()`, porque tema é
preferência de quem olha, não dado da aplicação. O preço é que `/login`
deixou de ser estática.

### `--color-sobre-vinho`

O vinho da marca (#7c2a28) é escuro demais para ser lido sobre fundo escuro,
então no escuro ele clareia — e, clareado, deixa de aceitar texto branco em
cima. Daí o token: é a cor do texto **sobre** fundo vinho, `#fff` no claro e
quase preto no escuro. `.btn-primario` usa ele; se aparecer `text-white` em
cima de `bg-vinho`, é bug.

### O papel impresso não tem tema

A folha da proposta, o demonstrativo e os manuais trazem a própria paleta num
`<style>` **fora de camada**, que por isso vence o `@layer base` do
`globals.css`. Continuam pretos sobre branco em qualquer tema — é o que sai na
impressora e o que o cliente recebe. Ao mexer nessas folhas, não trocar as
cores literais por tokens da aplicação: seria justamente perder isso.

## Cabeçalho

Dez abas no menu do admin, e a barra **não rola na horizontal**: `flex-wrap`
no `<nav>`, e a barra cresce em altura quando precisa. Rolagem lateral
escondia justamente as últimas abas (Índices e Admin) sem dar sinal de que
existiam.

Abaixo de `lg` o `<nav>` toma a linha inteira (`order-3 w-full`). Disputando
largura com o logo e com os botões da direita, ele chegava a um link por
linha no celular — e o cabeçalho é fixo, então comia meia tela.

Os rótulos são curtos pelo mesmo motivo: "Mapa" e "Espelho", não "Mapa de
lotes" e "Espelho de vendas". Ao acrescentar aba nova, conferir que os dez
itens ainda cabem numa linha por volta de 1170px — é aí que o menu do admin
está no limite.

## Manuais

`public/manual-corretor.html` e `public/manual-admin.html` — HTML autocontido,
mesmo padrão da folha da proposta, servidos estaticamente e linkados no
cabeçalho conforme o papel de quem está logado.

**A fonte é o HTML; os PDFs em `manuais/` são impressos à mão** pelo botão
"Imprimir / salvar em PDF" da própria página (A4, margens padrão, gráficos de
fundo ligados). Não há script que os gere. Depois de mexer num manual, os PDFs
ficam velhos até alguém reimprimir — e é `npm run replicar` que os copia para
a pasta do OneDrive.

As seções são numeradas à mão (`<h2><span class="n">4</span>`). Ao inserir uma
seção no meio, renumerar as seguintes de trás para frente, senão a nova colide
com a que já tinha aquele número.

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
