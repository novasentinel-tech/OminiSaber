import { access, cp, lstat, mkdir, readFile, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputRoot = path.join(projectRoot, "netlify-dist");

export const publicCopies = Object.freeze([
  ["index.html"],
  ["frontend"],
  ["engine/dist/client"],
  ["engine/dist/client", "oministudio"],
  ["backend/ominisaber-supabase-config.js"],
  ["backend/ominisaber-supabase-client.js"],
  ["backend/ominisaber-manager-client.js"],
  ["backend/vendor/supabase-2.112.3.js"],
  ["ominisaber-sw.js"],
  ["ominisaber.webmanifest"],
  ["_headers"],
  ["_redirects"],
].map(entry => Object.freeze(entry)));

export const authDestinationPages = [
  "frontend/login/index.html",
  "frontend/aluno/dashboard_principal/index.html",
  "frontend/aluno/perfil/index.html",
  "frontend/redefinir-senha/index.html",
  "frontend/erro/index.html",
  "frontend/gestor/dashboard/index.html",
  "frontend/bibliotecaria/dashboard/index.html",
  ...["matematica", "portugues", "tecnico_administracao", "tecnico_informatica"]
    .map(type => `frontend/professor/professor_${type}/dashboard/index.html`),
];

const within = (base, relative) => {
  const resolved = path.resolve(base, relative);
  const traversal = path.relative(base, resolved);
  if (traversal.startsWith("..") || path.isAbsolute(traversal)) {
    throw new Error("Caminho público fora da pasta permitida.");
  }
  return resolved;
};

// Read the generated data assignment as text; never execute configuration JavaScript.
// Report only the hostname and key type, never a key or environment-file contents.
export const validatePublicSupabaseConfig = source => {
  const content = source.replace(/^\s*\/\/[^\r\n]*/gm, "").trim();
  const match = content.match(/^window\.OMINISABER_SUPABASE_CONFIG\s*=\s*\{\s*url\s*:\s*("(?:[^"\\]|\\.)*")\s*,\s*anonKey\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*\}\s*;?\s*$/);
  if (!match) throw new Error("Configuração pública inválida: use o arquivo gerado por env:sync.");
  let urlValue, key;
  try {
    urlValue = JSON.parse(match[1]);
    key = JSON.parse(match[2]);
  } catch { throw new Error("Valores inválidos no arquivo de configuração pública."); }
  let url;
  try { url = new URL(urlValue); }
  catch { throw new Error("URL pública do Supabase inválida."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      !["", "/"].includes(url.pathname) ||
      /^(localhost|127\.|\[?::1\]?$)/i.test(url.hostname) ||
      /^(?:\d+\.){3}\d+$/.test(url.hostname) ||
      /\.(localhost|local|internal|invalid|test)$/i.test(url.hostname) || !url.hostname.includes(".")) {
    throw new Error("A publicação exige uma URL HTTPS pública do Supabase.");
  }
  if (typeof key !== "string" || key.startsWith("sb_secret_")) {
    throw new Error("Chave secreta proibida no pacote público.");
  }
  let keyType;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    keyType = "publishable";
  } else {
    const parts = key.split(".");
    let claims;
    try {
      if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error();
      claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    } catch { throw new Error("O navegador exige uma chave publishable ou JWT anon válido."); }
    if (claims.role !== "anon") throw new Error("Somente a chave anon legada pode entrar no pacote público.");
    const hostedRef = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
    if (hostedRef && claims.ref && claims.ref !== hostedRef) {
      throw new Error("A URL e a chave pública apontam para projetos diferentes.");
    }
    keyType = "legacy-anon";
  }
  return { hostname: url.hostname, keyType };
};

export const htmlPublicDependencies = async (page, base = projectRoot) => {
  const html = await readFile(within(base, page), "utf8");
  const pageUrl = new URL(page.replaceAll("\\", "/"), "https://package.invalid/");
  const dependencies = [page];
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const reference = match[1].trim();
    if (!reference || reference.startsWith("#")) continue;
    const target = new URL(reference, pageUrl);
    if (target.origin !== pageUrl.origin) continue;
    const relative = decodeURIComponent(target.pathname).replace(/^\//, "");
    within(base, relative);
    dependencies.push(relative.endsWith("/") ? `${relative}index.html` : relative);
  }
  return [...new Set(dependencies)];
};

const rejectPrivateTree = async relative => {
  const absolute = within(projectRoot, relative);
  const info = await lstat(absolute);
  if (info.isSymbolicLink()) throw new Error(`Link simbólico não permitido na cópia pública: ${relative}`);
  if (!info.isDirectory()) return;
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const name = entry.name.toLowerCase();
    if (name.startsWith(".env") || ["node_modules", ".git", ".netlify"].includes(name)) {
      throw new Error(`Arquivo privado dentro de fonte pública: ${path.join(relative, entry.name)}`);
    }
    await rejectPrivateTree(path.join(relative, entry.name));
  }
};

export const preflightPublicSources = async () => {
  const config = validatePublicSupabaseConfig(await readFile(
    path.join(projectRoot, "backend/ominisaber-supabase-config.js"), "utf8",
  ));
  for (const [source] of publicCopies) await rejectPrivateTree(source);
  const dependencies = [...new Set((await Promise.all(authDestinationPages.map(page => htmlPublicDependencies(page)))).flat())];
  await Promise.all(dependencies.map(file => access(within(projectRoot, file))));
  await access(path.join(projectRoot, "engine/dist/client/index.html"));
  return { configuration: config, authenticationFiles: dependencies.length, sources: publicCopies.length };
};

const checkedOutputRoot = async () => {
  const resolvedProject = await realpath(projectRoot);
  const resolvedOutput = path.resolve(resolvedProject, "netlify-dist");
  if (path.dirname(resolvedOutput) !== resolvedProject || path.basename(resolvedOutput) !== "netlify-dist") {
    throw new Error("Destino de publicação inválido; a pasta existente foi preservada.");
  }
  try {
    const info = await lstat(resolvedOutput);
    if (info.isSymbolicLink() || !info.isDirectory() || await realpath(resolvedOutput) !== resolvedOutput) {
      throw new Error("O destino deve ser a pasta netlify-dist local, sem redirecionamentos.");
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  return resolvedOutput;
};

const copy = async (source, destination = source) => {
  const sourcePath = path.join(projectRoot, source);
  const destinationPath = path.join(outputRoot, destination);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath, { recursive: true });
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Complete preflight before touching a previously generated package.
  const preflight = await preflightPublicSources();
  const safeOutput = await checkedOutputRoot();
  if (process.argv.includes("--check-only")) {
    console.log(JSON.stringify({ preflight, packageModified: false }, null, 2));
  } else {
    await rm(safeOutput, { recursive: true, force: true });
    await mkdir(safeOutput, { recursive: true });
    await Promise.all(publicCopies.map(([source, destination]) => copy(source, destination)));
    const publishedEntries = await readdir(outputRoot);
    const forbidden = publishedEntries.filter(name => name.startsWith(".env") || name === "node_modules");
    if (forbidden.length) throw new Error(`Arquivos privados no pacote público: ${forbidden.join(", ")}`);
    console.log(`Pacote público preparado em ${outputRoot}`);
  }
}
