import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("activity catalog implements the three selected views", async () => {
  const script = await read("frontend/aluno/atividades/script.js");
  assert.match(script, /renderPending/);
  assert.match(script, /renderDelivered/);
  assert.match(script, /renderAll/);
  assert.match(script, /Hoje/);
  assert.match(script, /Próximos dias/);
  assert.match(script, /Aguardando correção/);
  assert.match(script, /subject-groups/);
});

test("activity catalog has explicit tablet and 520px mobile adaptations", async () => {
  const css = await read("frontend/aluno/atividades/style.css");
  assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.catalog-toolbar/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.pending-board/);
  assert.match(css, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.catalog-controls/);
  assert.match(css, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.delivered-row \.catalog-action/);
  assert.match(css, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.subject-activity-list \.catalog-action/);
});

test("student catalog consumes real Supabase author and answer progress", async () => {
  const [client, script] = await Promise.all([
    read("backend/ominisaber-supabase-client.js"),
    read("frontend/aluno/atividades/script.js"),
  ]);
  assert.match(client, /author:\s*authorSnapshot/);
  assert.match(client, /respostas_avaliacao\(id,questao_id,resposta,updated_at\)/);
  assert.match(client, /\.in\("status", \["publicado", "encerrado"\]\)/);
  assert.match(client, /evaluation\?\.status === "encerrado"/);
  assert.match(script, /const teacherName/);
  assert.match(script, /const activityProgress/);
  assert.doesNotMatch(script, /Professor da turma/);
  assert.doesNotMatch(script, /status === "em_andamento" \? 50 : 0/);
});
