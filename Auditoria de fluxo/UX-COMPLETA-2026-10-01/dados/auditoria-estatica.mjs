import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const frontend = path.join(root, 'frontend');
const pages = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'index.html') pages.push(full);
  }
}

function lineAt(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function textOnly(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&\w+;/g, ' ').replace(/\s+/g, ' ').trim();
}

walk(frontend);
const findings = [];
const pageResults = [];

for (const file of pages.sort()) {
  const html = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const add = (severity, rule, message, index = 0) => findings.push({ severity, rule, page: relative, line: lineAt(html, index), message });
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  for (const id of duplicates) add('P1', 'duplicate-id', `ID duplicado: ${id}`, html.indexOf(`id="${id}"`));
  if (!/<html[^>]+lang=["'][^"']+["']/i.test(html)) add('P2', 'document-language', 'Documento sem atributo lang.');
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) add('P1', 'viewport', 'Página sem meta viewport responsiva.');
  if (!/<title>[^<]+<\/title>/i.test(html)) add('P2', 'page-title', 'Página sem título descritivo.');
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) if (!/\balt=["'][^"']*["']/i.test(match[0])) add('P1', 'image-alt', 'Imagem sem atributo alt.', match.index);
  for (const match of html.matchAll(/<a\b[^>]*href=["']#["'][^>]*>([\s\S]*?)<\/a>/gi)) add('P2', 'empty-link', `Link sem destino: ${textOnly(match[1]) || 'sem nome'}`, match.index);
  for (const match of html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const attrs = match[2];
    if (/type=["']hidden["']/i.test(attrs)) continue;
    const id = attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
    const labelled = /\baria-label(?:ledby)?=["'][^"']+["']/i.test(attrs) || (id && new RegExp(`<label[^>]+for=["']${id}["']`, 'i').test(html));
    const before = html.slice(Math.max(0, match.index - 200), match.index);
    const wrapped = /<label\b[^>]*>(?:(?!<\/label>)[\s\S])*$/i.test(before);
    if (!labelled && !wrapped) add('P1', 'form-label', `${match[1]} sem rótulo programático.`, match.index);
  }
  for (const match of html.matchAll(/<(?:script|img)\b[^>]+src=["']([^"']+)["']|<link\b[^>]+href=["']([^"']+)["']|<a\b[^>]+href=["']([^"']+)["']/gi)) {
    const raw = match[1] || match[2] || match[3];
    if (!raw || /^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(raw)) continue;
    const clean = raw.split(/[?#]/)[0];
    if (!clean) continue;
    const target = clean.startsWith('/') ? path.join(root, clean.slice(1)) : path.resolve(path.dirname(file), clean);
    let exists = fs.existsSync(target);
    if (!exists && clean.endsWith('/')) exists = fs.existsSync(path.join(target, 'index.html'));
    if (!exists && !path.extname(clean)) exists = fs.existsSync(`${target}.html`) || fs.existsSync(path.join(target, 'index.html'));
    if (!exists) add('P1', 'broken-local-reference', `Referência local inexistente: ${raw}`, match.index);
  }
  pageResults.push({ page: relative, bytes: Buffer.byteLength(html), ids: ids.length });
}

const summary = {
  generatedAt: new Date().toISOString(),
  pagesScanned: pages.length,
  findings: findings.length,
  bySeverity: Object.fromEntries(['P0', 'P1', 'P2', 'P3'].map(level => [level, findings.filter(item => item.severity === level).length])),
  byRule: Object.fromEntries([...new Set(findings.map(item => item.rule))].sort().map(rule => [rule, findings.filter(item => item.rule === rule).length])),
};

const report = { summary, pages: pageResults, findings };
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'auditoria-estatica.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(summary, null, 2));
