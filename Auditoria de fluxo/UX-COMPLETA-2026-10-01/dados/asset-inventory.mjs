import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const roots = ["frontend", "engine/dist/client", "netlify-dist"];
const extensions = new Set([".js", ".css", ".html", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".woff", ".woff2"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (extensions.has(path.extname(entry.name).toLowerCase())) {
      const info = await stat(absolute);
      files.push({ path: path.relative(root, absolute).replaceAll("\\", "/"), bytes: info.size });
    }
  }
  return files;
}

const files = [];
for (const candidate of roots) {
  try { files.push(...(await walk(path.join(root, candidate)))); } catch {}
}
files.sort((a, b) => b.bytes - a.bytes);
const payload = {
  generatedAt: new Date().toISOString(),
  scannedFiles: files.length,
  over250KiB: files.filter((file) => file.bytes > 250 * 1024),
  over1MiB: files.filter((file) => file.bytes > 1024 * 1024),
  largest: files.slice(0, 30),
};
await writeFile(
  path.join(root, "Auditoria de fluxo", "UX-COMPLETA-2026-10-01", "dados", "asset-inventory.json"),
  JSON.stringify(payload, null, 2),
);
console.log(JSON.stringify({ scannedFiles: payload.scannedFiles, over250KiB: payload.over250KiB.length, over1MiB: payload.over1MiB.length, largest: payload.largest.slice(0, 5) }));
