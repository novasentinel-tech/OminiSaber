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
const dashboard = read("frontend/aluno/dashboard_principal/script.js");
const difficultyMap = read("frontend/aluno/mapa_dificuldades/script.js");
const migration = read(
  "backend/migrations/20260908_resultados_recuperacao_fase2_4.sql",
);
const repairMigration = read(
  "backend/migrations/20260928_corrigir_recuperacao_ajuste_nota.sql",
);

for (const token of [
  "getTeacherEvaluationAnalytics",
  "adjustTeacherEvaluationGrade",
  "createTeacherRecovery",
  "getStudentDescriptorPerformance",
]) {
  if (!client.includes(token)) throw new Error(`Cliente sem ${token}.`);
}
for (const token of [
  "avaliacoes_auditoria_insert_docente",
  "grant insert on public.avaliacoes_auditoria to authenticated",
  "where tentativa.id = p_tentativa_id",
]) {
  if (!repairMigration.toLowerCase().includes(token.toLowerCase()))
    throw new Error(`Correção de resultados sem ${token}.`);
}
if (/where\s+tentativa\.id\s*=\s*p_tentativa_id\s+for share/i.test(repairMigration))
  throw new Error("A correção de nota ainda exige bloqueio incompatível.");
for (const token of [
  "Questões que mais geraram dificuldade",
  "Todos os alunos da turma",
  "data-adjust-grade",
  "data-recovery-form",
  "Histórico de auditoria",
]) {
  if (!review.includes(token)) throw new Error(`Resultados sem ${token}.`);
}
for (const token of [
  "painel_resultados_avaliacao",
  "ajustar_nota_avaliacao",
  "criar_recuperacao_descritores",
  "desempenho_aluno_descritores",
  "ajustes_notas_avaliacao",
  "security invoker",
]) {
  if (!migration.toLowerCase().includes(token.toLowerCase()))
    throw new Error(`Migration da fase 2.4 sem ${token}.`);
}
if (
  !client.includes('client.rpc("desempenho_aluno_descritores")') ||
  !client.includes("descriptorPerformance: descriptorPerformanceResult.data || []")
)
  throw new Error("Dados reais ponderados não chegam ao painel do aluno.");
if (!difficultyMap.includes("getStudentDescriptorPerformance"))
  throw new Error("Mapa de dificuldades ainda não usa descritores reais.");
if (/data\.notes|data\.essays/.test(dashboard))
  throw new Error(
    "O indicador do dashboard ainda depende de notas ou redações legadas.",
  );

console.log("Fluxo de resultados e recuperação da fase 2.4 validado.");
