import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const partiesDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.dirname(partiesDir);
const partiesVersion = "20261004-8";
const backendClientVersion = "20261004-7";

// Keep editable modules in Parties; serve one cached stylesheet, without a
// serial chain of local CSS @imports on every navigation.
let bundle = await fs.readFile(path.join(partiesDir, "styles.entry.css"), "utf8");
for (const match of [...bundle.matchAll(/@import url\("(\.\/[^"?]+)(?:\?[^" ]*)?"\);/g)]) {
  const css = await fs.readFile(path.join(partiesDir, match[1]), "utf8");
  bundle = bundle.replace(match[0], () => `\n/* ${match[1]} */\n${css}`);
}
await fs.writeFile(path.join(partiesDir, "parties.css"), bundle, "utf8");
if (process.argv.includes("--css-only")) {
  console.log("Bundle CSS compartilhado atualizado.");
  process.exit(0);
}
const shellInit = await fs.readFile(path.join(partiesDir, "shell-init.js"), "utf8");
const shellCritical = await fs.readFile(path.join(partiesDir, "shell-critical.css"), "utf8");

const listHtml = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listHtml(absolute)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(absolute);
    }
  }
  return files;
};

const htmlFiles = await listHtml(frontendDir);
let changed = 0;

for (const file of htmlFiles) {
  let source = await fs.readFile(file, "utf8");
  const original = source;
  const relative = path
    .relative(path.dirname(file), partiesDir)
    .split(path.sep)
    .join("/");
  const base = relative || ".";

  if (path.relative(frontendDir, file).split(path.sep)[0] === "aluno") {
    // These navigation blocks were replaced at runtime. Remove them at build
    // time so their markup and avatar images are never loaded in the first place.
    source = source.replace(/<aside\b([^>]*)>[\s\S]*?<\/aside>/gi, (block, attributes) => {
      const classes = attributes.match(/class=["']([^"']*)["']/i)?.[1].split(/\s+/) || [];
      return classes.some((name) => ["sidebar", "app-sidebar", "study-sidebar", "library-sidebar"].includes(name)) ? "" : block;
    });
    source = source.replace(/\s*<!-- Parties initial shell -->[\s\S]*?<!-- \/Parties initial shell -->/g, "");
    source = source.replace(/(<meta\s+charset=["'][^"']+["']\s*\/?>)/i,
      `$1\n    <!-- Parties initial shell -->\n    <script>${shellInit}</script>\n    <style>${shellCritical}</style>\n    <!-- /Parties initial shell -->`);
  }

  source = source.replace(
    /\s*<link\s+rel=["']stylesheet["']\s+href=["']redesign\.css(?:\?[^"']*)?["']\s*\/?>/gi,
    "",
  );

  source = source.replace(
    /(parties\.(?:css|js)\?v=)[^"']+/gi,
    `$1${partiesVersion}`,
  );
  source = source.replace(/(study-app\.js\?v=)[^"']+/gi, (_, prefix) => `${prefix}20260922-1`);

  source = source.replace(
    /(ominisaber-supabase-client\.js)(?:\?v=[^"']*)?/gi,
    `$1?v=${backendClientVersion}`,
  );

  const stylesheet = `<link rel="stylesheet" href="${base}/parties.css?v=${partiesVersion}" />`;
  const runtime = `<script defer src="${base}/parties.js?v=${partiesVersion}"></script>`;
  const additions = [];
  if (!/\/Parties\/parties\.css|(?:^|["'])parties\.css/i.test(source))
    additions.push(stylesheet);
  if (!/\/Parties\/parties\.js|(?:^|["'])parties\.js/i.test(source))
    additions.push(runtime);

  if (additions.length) {
    source = source.replace(
      /\s*<\/head>/i,
      `\n    <!-- OminiSaber Parties: sistema visual compartilhado -->\n    ${additions.join("\n    ")}\n  </head>`,
    );
  }

  if (source !== original) {
    await fs.writeFile(file, source, "utf8");
    changed += 1;
  }
}

const missing = [];
for (const file of htmlFiles) {
  const source = await fs.readFile(file, "utf8");
  if (!source.includes("parties.css") || !source.includes("parties.js")) {
    missing.push(path.relative(frontendDir, file));
  }
}

console.log(
  JSON.stringify(
    {
      scanned: htmlFiles.length,
      changed,
      missing,
    },
    null,
    2,
  ),
);

if (missing.length) process.exitCode = 1;
