import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const client = read("backend/ominisaber-supabase-client.js");
const review = read("frontend/professor/specialty/teacher-review.js");
const evaluationWorkspace = read("frontend/Parties/teacher-evaluations.js");
const portal = read("frontend/professor/specialty/portal.js");
const migration = read(
  "backend/migrations/20260908_correcao_docente_resultados_fase2_3.sql",
);
const pages = [
  "professor_matematica",
  "professor_portugues",
  "professor_tecnico_administracao",
  "professor_tecnico_informatica",
];

for (const token of [
  "listTeacherReviewQueue",
  "gradeTeacherEvaluationResponse",
  "getTeacherEvaluationResults",
  "getTeacherDescriptorResults",
]) {
  if (!client.includes(token)) throw new Error(`Cliente sem ${token}.`);
}
for (const token of [
  "data-grade-response",
  "data-result-evaluation",
  "Desempenho por descritor",
  "Correções pendentes",
  "data-queue-search",
  "data-next-attempt",
  "Salvar e avançar",
]) {
  if (!review.includes(token))
    throw new Error(`Central de correção sem ${token}.`);
}
for (const token of [
  "security definer",
  "set search_path = ''",
  "corrigir_resposta_avaliacao",
  "resultados_avaliacao_docente",
  "resultados_descritores_avaliacao",
  "avaliacoes_auditoria",
]) {
  if (!migration.toLowerCase().includes(token.toLowerCase()))
    throw new Error(`Migration sem ${token}.`);
}
for (const page of pages) {
  const html = read(`frontend/professor/${page}/avaliacoes/index.html`);
  const version = html.match(/portal\.js\?v=(\d{8})-(\d+)/);
  if (
    !version ||
    Number(version[1]) < 20261002 ||
    (Number(version[1]) === 20261002 && Number(version[2]) < 3)
  )
    throw new Error(`Portal sem versão otimizada em ${page}.`);
  if (
    html.includes("teacher-review.js") ||
    html.includes("activity-builder.js")
  )
    throw new Error(`Módulo pesado carregado antes da hora em ${page}.`);
}
for (const asset of [
  "teacher-review.css",
  "teacher-review.js",
  "activity-builder.css",
  "activity-builder.js",
  "teacher-copilot.js",
]) {
  if (!evaluationWorkspace.includes(asset))
    throw new Error(`Carregamento sob demanda sem ${asset}.`);
}
if (!portal.includes('page === "avaliacoes"'))
  throw new Error("Portal não abre o workspace otimizado de avaliações.");

console.log("Fluxo docente da fase 2.3 validado.");
