import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

async function walk(directory, extension = ".html") {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(relative, extension)));
    else if (entry.name.endsWith(extension)) files.push(relative);
  }
  return files;
}

test("OminiStudio fits the complete journey instead of using a fixed viewport", async () => {
  const source = await read("engine/src/components/MapCanvas.jsx");
  assert.match(source, /fitView\(\{/);
  assert.match(source, /aria-label="Enquadrar todas as etapas no mapa"/);
  assert.doesNotMatch(source, /instance\.setViewport/);
});

test("OminiStudio explains local and expired-session states", async () => {
  const source = await read("engine/src/App.jsx");
  assert.match(source, /function CloudNotice/);
  assert.match(source, /Sua sessão terminou/);
  assert.match(source, /trabalhando somente neste navegador/);
  assert.match(source, /Entrar novamente/);
});

test("password reset validates recovery before showing password fields", async () => {
  const source = await read("frontend/redefinir-senha/index.html");
  assert.match(source, /<form id="resetForm" novalidate hidden>/);
  assert.match(source, /event === "PASSWORD_RECOVERY"/);
  assert.match(source, /Este link de recuperação é inválido ou expirou/);
});

test("critical text fields expose programmatic labels", async () => {
  const [writing, loans] = await Promise.all([
    read("frontend/aluno/modulo_de_trilhas/redacao/index.html"),
    read("frontend/bibliotecaria/gestao_emprestimos/index.html"),
  ]);
  assert.match(writing, /<label class="writing-label" for="thesisDraft">/);
  assert.match(writing, /<textarea\s+id="thesisDraft"/);
  assert.match(loans, /<label class="sr-only" for="loanSearch">/);
  assert.match(loans, /id="loanSearch"/);
});

test("frontend no longer depends on runtime Tailwind or Supabase CDNs", async () => {
  const pages = await walk("frontend");
  const content = (await Promise.all(pages.map(read))).join("\n");
  assert.doesNotMatch(content, /cdn\.tailwindcss\.com/);
  assert.doesNotMatch(content, /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/);
  assert.match(content, /\/backend\/vendor\/supabase-2\.112\.3\.js/);
});

test("optimized learning artwork stays below 400 KiB", async () => {
  const assets = [
    "frontend/login/assets/jornada-ominisaber-3d.jpg",
    "frontend/aluno/modulo_de_trilhas/matematica/assets/01-1o-ano-maquina-de-padroes.jpg",
    "frontend/aluno/modulo_de_trilhas/matematica/assets/02-2o-ano-estudio-de-areas.jpg",
    "frontend/aluno/modulo_de_trilhas/matematica/assets/03-3o-ano-reta-em-movimento.jpg",
    "frontend/aluno/modulo_de_trilhas/portugues/assets/mapa-linguistico-brasil.jpg",
    "frontend/aluno/modulo_de_trilhas/portugues/assets/brasil-em-contraste.jpg",
  ];
  for (const asset of assets) {
    const info = await stat(path.join(root, asset));
    assert.ok(info.size < 400 * 1024, `${asset} is ${info.size} bytes`);
  }
});
