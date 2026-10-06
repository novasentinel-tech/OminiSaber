import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(backendRoot, "..");
const buildScriptPath = path.join(scriptDirectory, "build-complete-schema.js");
const buildSource = fs.readFileSync(buildScriptPath, "utf8");

const sourcePaths = [...buildSource.matchAll(/"((?:schema|migrations)\/[^"]+\.sql)"/g)]
  .map((match) => match[1]);
const migrationFiles = fs.readdirSync(path.join(backendRoot, "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => `migrations/${name}`);

const failures = [];
const warnings = [];
const fail = (message) => failures.push(message);
const warn = (message) => warnings.push(message);

for (const source of new Set(sourcePaths)) {
  if (!fs.existsSync(path.join(backendRoot, source))) {
    fail(`fonte ausente no gerador: ${source}`);
  }
}

for (const migration of migrationFiles) {
  if (!sourcePaths.includes(migration)) {
    fail(`migration fora do schema completo: ${migration}`);
  }
}

for (const duplicate of sourcePaths.filter((source, index) => sourcePaths.indexOf(source) !== index)) {
  fail(`fonte duplicada no gerador: ${duplicate}`);
}

const sqlSources = [...new Set(sourcePaths)]
  .filter((source) => fs.existsSync(path.join(backendRoot, source)))
  .map((source) => ({
    source,
    sql: fs.readFileSync(path.join(backendRoot, source), "utf8"),
  }));
const combinedSql = sqlSources.map(({ sql }) => sql).join("\n");

for (const { source, sql } of sqlSources.filter(({ source }) => source.startsWith("migrations/"))) {
  const beginCount = (sql.match(/^\s*begin\s*;/gim) || []).length;
  const commitCount = (sql.match(/^\s*commit\s*;/gim) || []).length;
  if (beginCount !== 1 || commitCount !== 1) {
    fail(`${source}: precisa conter exatamente um BEGIN e um COMMIT`);
  }
}

const publicTables = new Set(
  [...combinedSql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)]
    .map((match) => match[1].toLowerCase()),
);
const rlsTables = new Set(
  [...combinedSql.matchAll(/alter\s+table\s+public\.([a-z0-9_]+)\s+enable\s+row\s+level\s+security/gi)]
    .map((match) => match[1].toLowerCase()),
);
const missingRls = [...publicTables].filter((table) => !rlsTables.has(table)).sort();
if (missingRls.length) fail(`tabelas públicas sem RLS: ${missingRls.join(", ")}`);

const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  if (entry.isDirectory()) {
    if (entry.name === "node_modules" || entry.name === "tmp") return [];
    return walk(absolute);
  }
  return entry.isFile() && /\.(?:js|html)$/.test(entry.name) ? [absolute] : [];
});

const clientRoots = ["frontend", "engine", "backend"]
  .map((name) => path.join(repositoryRoot, name))
  .filter(fs.existsSync);
const clientSource = clientRoots.flatMap(walk)
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
const clientTables = new Set(
  [...clientSource.matchAll(/\.from\(\s*["']([a-z0-9_]+)["']\s*\)/gi)]
    .map((match) => match[1].toLowerCase()),
);
const storageBuckets = new Set(["biblioteca-pdfs"]);
const undefinedClientTables = [...clientTables]
  .filter((table) => !publicTables.has(table) && !storageBuckets.has(table))
  .sort();
if (undefinedClientTables.length) {
  fail(`tabelas usadas pelo cliente sem definição SQL: ${undefinedClientTables.join(", ")}`);
}

if (/SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY\s*=\s*\S+/i.test(combinedSql)) {
  fail("possível chave privada encontrada em SQL");
}
if (/grant\s+.+\s+on\s+all\s+tables/i.test(combinedSql)) {
  fail("GRANT amplo em todas as tabelas encontrado");
}

const legacyProfessorSchema = path.join(backendRoot, "schema", "professor.sql");
if (fs.existsSync(legacyProfessorSchema) && sourcePaths.includes("schema/professor.sql")) {
  warn("schema/professor.sql é legado e não deve compor instalações novas");
}

const report = {
  schemaSources: sourcePaths.length,
  migrations: migrationFiles.length,
  publicTables: publicTables.size,
  tablesWithRls: rlsTables.size,
  clientTables: clientTables.size,
  warnings,
  failures,
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length ? 1 : 0;
