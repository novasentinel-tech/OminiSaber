import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const frontendRoot = path.join(repositoryRoot, "frontend");

const walk = (directory, predicate) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "tmp") return [];
      return walk(absolute, predicate);
    }
    return entry.isFile() && predicate(absolute) ? [absolute] : [];
  });

const relative = (file) =>
  path.relative(repositoryRoot, file).replaceAll("\\", "/");

const findings = [];
const add = (severity, code, file, message) => {
  findings.push({ severity, code, file: relative(file), message });
};

const ignoredReference = (value) =>
  !value ||
  /^(?:https?:|mailto:|tel:|data:|javascript:|#|about:|blob:)/i.test(value) ||
  value.includes("${") ||
  value.includes("{{");

const resolveReference = (sourceFile, rawValue) => {
  let value = rawValue.trim().split(/[?#]/, 1)[0];
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (value.startsWith("/")) return path.join(repositoryRoot, value.slice(1));
  return path.resolve(path.dirname(sourceFile), value);
};

const rootIndex = path.join(repositoryRoot, "index.html");
const htmlFiles = [
  ...(fs.existsSync(rootIndex) ? [rootIndex] : []),
  ...walk(frontendRoot, (file) => file.endsWith(".html")),
];
const cssFiles = walk(frontendRoot, (file) => file.endsWith(".css"));
const jsFiles = walk(frontendRoot, (file) => file.endsWith(".js"));
let unpinnedSupabaseCdnPages = 0;

for (const file of htmlFiles) {
  const source = fs.readFileSync(file, "utf8");

  if (
    /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2(?:["'/])/i.test(source)
  ) {
    unpinnedSupabaseCdnPages += 1;
  }

  if (!/<html\b[^>]*\blang=["']pt-BR["']/i.test(source)) {
    add("warning", "HTML_LANG", file, "idioma pt-BR não declarado");
  }
  if (!/<meta\b[^>]*name=["']viewport["']/i.test(source)) {
    add("error", "HTML_VIEWPORT", file, "meta viewport ausente");
  }
  if (!/<title>\s*[^<]+\s*<\/title>/i.test(source)) {
    add("warning", "HTML_TITLE", file, "título de página ausente ou vazio");
  }

  const ids = [...source.matchAll(/\bid=["']([^"']+)["']/gi)].map(
    (match) => match[1],
  );
  for (const id of new Set(
    ids.filter((id, index) => ids.indexOf(id) !== index),
  )) {
    add("error", "HTML_DUPLICATE_ID", file, `id duplicado: ${id}`);
  }

  for (const match of source.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    const reference = match[1];
    if (ignoredReference(reference)) continue;
    const resolved = resolveReference(file, reference);
    if (!resolved || !fs.existsSync(resolved)) {
      add(
        "error",
        "BROKEN_REFERENCE",
        file,
        `recurso local ausente: ${reference}`,
      );
    }
  }

  for (const match of source.matchAll(/<a\b([^>]*)>/gi)) {
    const attributes = match[1];
    if (
      /target=["']_blank["']/i.test(attributes) &&
      !/rel=["'][^"']*noopener/i.test(attributes)
    ) {
      add(
        "warning",
        "TARGET_BLANK",
        file,
        "link target=_blank sem rel=noopener",
      );
    }
  }

  const forms = [...source.matchAll(/<form\b[\s\S]*?<\/form>/gi)];
  for (const form of forms) {
    if (/^<form\b[^>]*\bmethod=["']dialog["']/i.test(form[0])) continue;
    for (const button of form[0].matchAll(/<button\b([^>]*)>/gi)) {
      if (!/\btype=["'](?:button|submit|reset)["']/i.test(button[1])) {
        add(
          "warning",
          "FORM_BUTTON_TYPE",
          file,
          "botão dentro de formulário sem type explícito",
        );
      }
    }
  }
}

if (unpinnedSupabaseCdnPages) {
  add(
    "warning",
    "UNPINNED_SUPABASE_CDN",
    path.join(repositoryRoot, "frontend"),
    `${unpinnedSupabaseCdnPages} página(s) carregam supabase-js@2 sem versão exata`,
  );
}

for (const file of cssFiles) {
  const source = fs.readFileSync(file, "utf8");
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const opening = (withoutComments.match(/{/g) || []).length;
  const closing = (withoutComments.match(/}/g) || []).length;
  if (opening !== closing) {
    add(
      "error",
      "CSS_BRACES",
      file,
      `chaves desbalanceadas: ${opening} aberturas e ${closing} fechamentos`,
    );
  }
  for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    const reference = match[1];
    if (ignoredReference(reference) || reference.startsWith("var(")) continue;
    const resolved = resolveReference(file, reference);
    if (!resolved || !fs.existsSync(resolved)) {
      add("error", "BROKEN_CSS_URL", file, `recurso CSS ausente: ${reference}`);
    }
  }
}

for (const file of jsFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(
    /(?:\bfrom\s*|\bimport\s*\(|\bimport\s+)["']([^"']+)["']/g,
  )) {
    const reference = match[1];
    if (ignoredReference(reference) || !reference.startsWith(".")) continue;
    const resolved = resolveReference(file, reference);
    if (!resolved || !fs.existsSync(resolved)) {
      add(
        "error",
        "BROKEN_JS_IMPORT",
        file,
        `import local ausente: ${reference}`,
      );
    }
  }
}

const bySeverity = Object.groupBy(findings, (finding) => finding.severity);
const errors = bySeverity.error || [];
const warnings = bySeverity.warning || [];

console.log(
  JSON.stringify(
    {
      pages: htmlFiles.length,
      javascriptFiles: jsFiles.length,
      cssFiles: cssFiles.length,
      errors: errors.length,
      warnings: warnings.length,
      findings,
    },
    null,
    2,
  ),
);

process.exitCode = errors.length ? 1 : 0;
