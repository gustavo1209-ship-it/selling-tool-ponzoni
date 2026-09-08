/**
 * Replica o código-fonte na pasta do OneDrive, junto das fontes de dados.
 *
 *   npm run replicar
 *
 * A cópia serve para ter tudo num lugar só e com backup do OneDrive. O
 * desenvolvimento continua acontecendo em C:\Codes: se o projeto voltar a
 * rodar de dentro do OneDrive, o dev server volta a cair, porque o Next
 * reescreve centenas de arquivos em `.next` a cada compilação e a
 * sincronização trava esses arquivos. Ver "Onde o projeto vive" no CLAUDE.md.
 *
 * Por isso a réplica leva **só o que está versionado no git** — nada de
 * `node_modules`, `.next` ou `.git`. É uma foto do código, não um segundo
 * lugar para trabalhar.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const RAIZ = resolve(import.meta.dirname, "..");
const DESTINO = "C:\\Users\\gusta\\OneDrive\\Desktop\\Codes Claude\\teste supabase\\selling-tool-florescer";
const CODIGO = join(DESTINO, "codigo");
const MANUAIS = join(DESTINO, "manuais");

if (!existsSync(DESTINO)) {
  console.error(`A pasta de destino não existe:\n  ${DESTINO}`);
  process.exit(1);
}

// git ls-files é a lista exata do que está versionado, já respeitando o
// .gitignore — não há como esquecer de excluir node_modules
const versionados = execFileSync("git", ["ls-files"], { cwd: RAIZ, encoding: "utf-8" })
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

if (versionados.length === 0) {
  console.error("git ls-files não devolveu nada. A réplica foi abortada.");
  process.exit(1);
}

// a réplica é refeita do zero para não deixar para trás arquivo que foi
// renomeado ou apagado no repositório
rmSync(CODIGO, { recursive: true, force: true });

for (const arquivo of versionados) {
  const destino = join(CODIGO, arquivo);
  mkdirSync(dirname(destino), { recursive: true });
  cpSync(join(RAIZ, arquivo), destino);
}

// os manuais em PDF não vão para o git (o .gitignore bloqueia *.pdf), então
// entram à parte — é o formato que se manda para o time
const origemManuais = join(RAIZ, "manuais");
let pdfs = 0;
if (existsSync(origemManuais)) {
  mkdirSync(MANUAIS, { recursive: true });
  for (const nome of readdirSync(origemManuais).filter((n) => n.endsWith(".pdf"))) {
    cpSync(join(origemManuais, nome), join(MANUAIS, nome));
    pdfs++;
  }
}

const agora = new Date().toLocaleString("pt-BR");
writeFileSync(
  join(DESTINO, "LEIA-ME - onde o projeto vive.txt"),
  `ONDE O PROJETO VIVE
===================

Codigo (onde se trabalha):  C:\\Codes\\selling-tool-ponzoni
GitHub (o backup de fato):  https://github.com/gustavo1209-ship-it/selling-tool-ponzoni
No ar:                      https://selling-tool-ponzoni.vercel.app

Esta pasta tem tres coisas:

  fontes de dados   as planilhas e os PDFs de valores, que nao vao para o
                    git e precisam do backup do OneDrive
  codigo/           uma REPLICA do codigo-fonte, atualizada em ${agora}
  manuais/          os manuais do corretor e do administrador em PDF

A replica em codigo/ e uma foto, nao um segundo lugar para trabalhar. Nao
rode "npm run dev" a partir dela: o projeto saiu do OneDrive de proposito,
porque o Next reescreve centenas de arquivos em .next a cada compilacao e a
sincronizacao trava esses arquivos, derrubando o servidor varias vezes por
sessao. O detalhe esta em CLAUDE.md, secao "Onde o projeto vive".

Para atualizar a replica depois de mexer no codigo:

    cd C:\\Codes\\selling-tool-ponzoni
    npm run replicar

Gerado por npm run replicar.
`,
  "utf-8"
);

console.log(`Réplica atualizada em ${CODIGO}`);
console.log(`  ${versionados.length} arquivos versionados`);
console.log(`  ${pdfs} manual(is) em PDF`);
console.log(`  LEIA-ME reescrito em ${DESTINO}`);
