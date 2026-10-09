import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const partiesDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(partiesDir, "..");

const walk = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) return walk(target);
    return extname(entry.name) === ".html" ? [target] : [];
  });

const htmlFiles = walk(frontendDir);
const required = ["parties.css", "parties.js"];
const failures = [];
const coverage = { student: 0, teacher: 0, manager: 0, library: 0, public: 0 };
const roleArgument = process.argv.indexOf("--role");
const selectedRole = roleArgument >= 0 ? process.argv[roleArgument + 1] : null;
if (roleArgument >= 0 && !Object.hasOwn(coverage, selectedRole)) throw new Error("Perfil de validação inválido.");

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, "utf8");
  const relative = htmlFile.slice(frontendDir.length + 1).replaceAll("\\", "/");
  const role = relative.startsWith("aluno/")
    ? "student"
    : relative.startsWith("professor/")
      ? "teacher"
      : relative.startsWith("gestor/")
        ? "manager"
        : relative.startsWith("bibliotecaria/")
          ? "library"
          : "public";
  if (selectedRole && role !== selectedRole) continue;
  coverage[role] += 1;
  if (role === "student" && !html.includes("<!-- Parties initial shell -->")) {
    failures.push(`${relative}: shell inicial ausente`);
  }

  for (const asset of required) {
    const match = html.match(
      new RegExp(
        `["']([^"']*(?:Parties/)?${asset.replace(".", "\\.")}(?:\\?[^"']*)?)["']`,
        "i",
      ),
    );
    if (!match) {
      failures.push(`${relative}: import de ${asset} ausente`);
      continue;
    }
    const assetPath = match[1].split("?")[0];
    if (!existsSync(resolve(dirname(htmlFile), assetPath))) {
      failures.push(`${relative}: caminho inválido para ${asset}`);
    }
  }

  if (/redesign\.css/i.test(html)) {
    failures.push(`${relative}: ainda referencia o CSS temporário de redesign`);
  }
}

const coreFiles = [
  "tokens.css",
  "foundations.css",
  "components.css",
  "header.css",
  "layouts.css",
  "themes.css",
  "layouts/student-dashboard.css",
  "mobile.css",
  "responsive.css",
  "shell-init.js",
  "shell-critical.css",
  "styles.entry.css",
];

for (const file of coreFiles) {
  if (!existsSync(resolve(partiesDir, file))) failures.push(`Parties/${file}: ausente`);
}

console.log(JSON.stringify({ pages: Object.values(coverage).reduce((sum, count) => sum + count, 0), coverage, failures }, null, 2));
if (failures.length) process.exitCode = 1;
