import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("student home exposes an accessible responsive subject filter", async () => {
  const html = await read("frontend/aluno/dashboard_principal/index.html");
  const css = await read("frontend/aluno/dashboard_principal/style.css");

  assert.match(html, /data-subject-chips/);
  assert.match(html, /data-subject-filter/);
  assert.match(html, /data-destination-grid/);
  assert.match(html, /data-clear-subject-filter/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.subject-filter-chips\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.subject-filter-mobile\s*\{[^}]*display:\s*none/s);
  assert.match(css, /scroll-snap-type:\s*x proximity/);
  assert.match(css, /@media\s*\(max-width:\s*380px\)[\s\S]*?\.subject-filter-context,[\s\S]*?grid-column:\s*1 \/ -1/s);
});

test("student home persists and propagates the selected subject", async () => {
  const script = await read("frontend/aluno/dashboard_principal/script.js");

  assert.match(script, /ominisaber:student-subject-filter/);
  assert.match(script, /searchParams\.set\("materia", code\)/);
  assert.match(script, /url\.searchParams\.set\("materia", activeSubject\)/);
  assert.match(script, /data-today-agenda-link/);
  assert.match(script, /data-agenda-shortcut/);
});

test("student home prioritizes learning destinations with semantic live states", async () => {
  const [script, css] = await Promise.all([
    read("frontend/aluno/dashboard_principal/script.js"),
    read("frontend/aluno/dashboard_principal/style.css"),
  ]);

  const evaluations = script.indexOf('key: "avaliacoes"');
  const trails = script.indexOf('key: "trilhas"');
  const subjects = script.indexOf('key: "materias"');
  const library = script.indexOf('key: "biblioteca"');
  assert.ok(evaluations < trails && trails < subjects && subjects < library);
  assert.match(script, /getStudentEvaluationAvailability/);
  assert.match(script, /trail\.prazo/);
  assert.match(script, /data-learning-state/);
  assert.match(script, /"expired" \? "danger" : "warning"/);
  assert.match(script, /counts\.danger \? "danger" : counts\.warning \? "warning" : "success"/);
  assert.match(css, /\.destination-card\.priority\.state-danger/);
  assert.match(css, /\.destination-card\.priority\.state-warning/);
  assert.match(css, /\.destination-card\.priority\.state-success/);
});

test("student destinations consume the subject context", async () => {
  const paths = [
    "frontend/aluno/atividades/script.js",
    "frontend/aluno/biblioteca_digital/script.js",
    "frontend/aluno/modulo_de_trilhas/shared/study-app.js",
    "frontend/aluno/agenda/script.js",
  ];

  for (const path of paths) {
    const script = await read(path);
    assert.match(script, /(?:searchParams|pageParams|params|URLSearchParams\(location\.search\))\.get\("materia"\)/, `${path} must read materia`);
  }
});
