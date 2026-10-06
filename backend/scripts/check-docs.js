import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const docsRoot = path.join(repositoryRoot, "docs");

const requiredFiles = [
  "README.md",
  "docs/README.md",
  "docs/architecture/visao-geral.md",
  "docs/architecture/fluxogramas.md",
  "docs/development/status-do-projeto.md",
  "docs/development/ambientes-e-deploy.md",
  "docs/development/auditoria-sistema-2026-09-09.md",
  "docs/modules/motor-atividades/README.md",
  "docs/modules/copiloto-docente/README.md",
  "docs/security/security-policy-pt-br.md",
  "docs/governance/controle-de-formularios.md",
];

const controlledDocuments = [
  "ARC-001", "ARC-002", "ARC-003", "ARC-004",
  "DEV-001", "DEV-002", "DEV-003", "DEV-004", "DEV-005", "DEV-006", "DEV-007",
  "INF-001", "INF-002", "INF-003", "INF-004", "INF-005",
  "SEC-001", "SEC-002", "SEC-003", "SEC-004",
  "TST-001", "TST-002", "TST-003", "TST-004",
  "OPS-001", "OPS-002", "OPS-003", "OPS-004",
].map((suffix) => `OMNI-TEC-${suffix}`);

const walkMarkdown = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkMarkdown(absolute);
    return entry.isFile() && entry.name.endsWith(".md") ? [absolute] : [];
  });

const markdownFiles = [
  path.join(repositoryRoot, "README.md"),
  ...walkMarkdown(docsRoot),
  path.join(repositoryRoot, "backend/README.md"),
  path.join(repositoryRoot, "backend/README-SQL.md"),
].filter(fs.existsSync);

const failures = [];
const warn = (file, message) => {
  failures.push(`${path.relative(repositoryRoot, file)}: ${message}`);
};

for (const required of requiredFiles) {
  if (!fs.existsSync(path.join(repositoryRoot, required))) {
    failures.push(`${required}: documento obrigatório ausente`);
  }
}

const controlledRoot = path.join(docsRoot, "controlled");
const controlledFiles = fs.existsSync(controlledRoot)
  ? walkMarkdown(controlledRoot)
  : [];
for (const code of controlledDocuments) {
  const matches = controlledFiles.filter((file) =>
    fs.readFileSync(file, "utf8").includes(`| Código | ${code} |`),
  );
  if (matches.length !== 1) {
    failures.push(
      `${code}: esperado exatamente um documento controlado, encontrados ${matches.length}`,
    );
    continue;
  }

  const contents = fs.readFileSync(matches[0], "utf8");
  if (!/\| Versão(?: \/ status)? \| v\d+\.\d+/.test(contents)) {
    warn(matches[0], "versão controlada ausente");
  }
  if (!/\| (?:Versão \/ status|Status) \| (?:v\d+\.\d+ \/ )?Ativo \|/.test(contents)) {
    warn(matches[0], "status controlado ausente");
  }
  if (!/\| Classificação \| Uso Interno \|/.test(contents) &&
      !/\| Norma \/ classificação \| LGPD \/ Uso Interno \|/.test(contents)) {
    warn(matches[0], "classificação controlada ausente");
  }

  const words = contents.match(/[\p{L}\p{N}_-]+/gu) ?? [];
  const sections = contents.match(/^##\s+.+$/gm) ?? [];
  if (words.length < 280) {
    warn(
      matches[0],
      `conteúdo insuficiente: ${words.length} palavras; mínimo controlado é 280`,
    );
  }
  if (sections.length < 3) {
    warn(
      matches[0],
      `estrutura insuficiente: ${sections.length} seções de nível 2; mínimo controlado é 3`,
    );
  }
}

for (const file of markdownFiles) {
  const contents = fs.readFileSync(file, "utf8");
  const relative = path.relative(repositoryRoot, file).replaceAll("\\", "/");
  const isLegacy = relative.startsWith("docs/legacy/");

  if (!isLegacy && /\bOmniSaber\b/.test(contents)) {
    warn(file, "grafia antiga da marca; use OminiSaber");
  }

  const secretPatterns = [
    /sb_secret_[A-Za-z0-9_-]{8,}/g,
    /SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY\s*=\s*(?!$|<|YOUR_|SEU_|\[)[^\s]+/gm,
    /OPENAI_API_KEY\s*=\s*(?!$|<|YOUR_|SEU_|\[)[^\s]+/gm,
  ];
  for (const pattern of secretPatterns) {
    if (pattern.test(contents))
      warn(file, "possível segredo escrito na documentação");
  }

  const links = contents.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g);
  for (const match of links) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }
    if (/^(?:https?:|mailto:|data:|#|codex:|plugin:)/i.test(target)) continue;

    target = target.split("#", 1)[0];
    if (!target || path.isAbsolute(target)) continue;

    let decoded = target;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      warn(file, `link com codificação inválida: ${target}`);
      continue;
    }

    const resolved = path.resolve(path.dirname(file), decoded);
    if (!fs.existsSync(resolved)) warn(file, `link local quebrado: ${target}`);
  }
}

if (failures.length) {
  console.error("Documentação inválida:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(
  `Documentação validada: ${markdownFiles.length} arquivos Markdown, ${controlledDocuments.length} documentos controlados com profundidade mínima, links locais e segredos.`,
);
