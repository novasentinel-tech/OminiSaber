import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const frontend = path.join(root, "frontend");
const base = "http://127.0.0.1:4173/";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (/\.html?$/i.test(entry.name)) files.push(absolute);
  }
  return files;
}

const pages = await walk(frontend);
const results = [];
for (const file of pages) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const url = new URL(relative, base).href;
  try {
    const response = await fetch(url, { redirect: "manual" });
    results.push({ relative, url, status: response.status, location: response.headers.get("location") });
  } catch (error) {
    results.push({ relative, url, status: 0, error: error.message });
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  total: results.length,
  ok: results.filter((item) => item.status >= 200 && item.status < 400).length,
  failures: results.filter((item) => item.status < 200 || item.status >= 400),
  results,
};

await writeFile(
  path.join(root, "Auditoria de fluxo", "UX-COMPLETA-2026-10-01", "dados", "route-health.json"),
  JSON.stringify(payload, null, 2),
);
console.log(JSON.stringify({ total: payload.total, ok: payload.ok, failures: payload.failures.length }));
