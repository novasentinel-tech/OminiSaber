import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const migration = read(
  "backend/migrations/20260909_copiloto_docente_fase3_0.sql",
);
const advisorAdjustments = read(
  "backend/migrations/20260909081800_fase3_advisors_ajustes.sql",
);
const edge = read("backend/supabase/functions/professor-copiloto/index.ts");
const pedagogicalContract = read(
  "backend/supabase/functions/professor-copiloto/pedagogical-contract.ts",
);
const integratedMigration = read(
  "backend/migrations/20261003_copiloto_ideias_trilhas.sql",
);
const portuguesePromptLibrary = read(
  "backend/supabase/functions/professor-copiloto/portuguese-prompt-library.ts",
);
const client = read("backend/ominisaber-supabase-client.js");
const ui = read("frontend/professor/specialty/teacher-copilot.js");
const evaluationsLoader = read("frontend/Parties/teacher-evaluations.js");
const config = read("backend/supabase/config.toml");

for (const token of [
  "feature_flags",
  "feature_flag_usuarios",
  "copiloto_sessoes",
  "copiloto_execucoes",
  "copiloto_feedback",
  "habilitada_global, configuracao",
  "false,",
  "enable row level security",
  "revoke all on table public.copiloto_execucoes from anon",
]) {
  if (!migration.toLowerCase().includes(token.toLowerCase()))
    throw new Error(`Migration da Fase 3.0 sem ${token}.`);
}

const portuguesePromptCount = (
  portuguesePromptLibrary.match(/^\s*\["[a-z0-9-]+",/gm) || []
).length;
if (portuguesePromptCount < 70)
  throw new Error(
    `Biblioteca de Português possui somente ${portuguesePromptCount} casos.`,
  );
const portuguesePromptIds = [
  ...portuguesePromptLibrary.matchAll(/^\s*\["([a-z0-9-]+)",/gm),
].map((match) => match[1]);
if (new Set(portuguesePromptIds).size !== portuguesePromptIds.length)
  throw new Error("Biblioteca de Português possui identificadores duplicados.");
for (const token of [
  "PORTUGUESE_PROMPT_CASES",
  "selectPortuguesePromptCases",
  "allFormatsEnabled",
  "Nenhuma habilidade curricular foi selecionada",
  "etapa interna adicional de planejamento",
]) {
  if (!edge.includes(token))
    throw new Error(`Copiloto sem biblioteca pedagógica: ${token}.`);
}
for (const token of [
  "maxItems: 0",
  "normalizeTeacherSuggestion",
  "cleanRefinementContext",
  "generateValidatedSuggestion",
  "phase: String(step.fase)",
  "totalDuration",
  "totalValue",
])
  if (!pedagogicalContract.includes(token))
    throw new Error(`Contrato pedagógico sem ${token}.`);
for (const action of [
  "gerar_atividade",
  "gerar_trilha",
  "gerar_ideias",
  "revisar_atividade",
  "sugerir_recuperacao",
])
  if (
    !edge.includes(`"${action}"`) ||
    !integratedMigration.includes(`'${action}'`)
  )
    throw new Error(`Ação ${action} não está alinhada entre servidor e banco.`);
if (
  !portuguesePromptLibrary.includes("title: string") ||
  !portuguesePromptLibrary.includes("prompt: string")
)
  throw new Error("Biblioteca pedagógica sem estrutura de prompts tipada.");

for (const token of [
  "alter function public.set_updated_at() set search_path = ''",
  "feature_flags_insert_gestor",
  "feature_flags_update_gestor",
  "feature_flag_usuarios_concedida_por_idx",
]) {
  if (!advisorAdjustments.includes(token))
    throw new Error(`Ajustes dos advisors sem ${token}.`);
}

for (const token of [
  "scoped.auth.getUser(token)",
  'if (!token)\n    return reply(origin, { error: "Sessão ausente." }, 401, requestId)',
  'profile.role !== "professor" || profile.ativo === false',
  "professor_turma_materias",
  "habilidades_curriculares",
  "limite_por_minuto",
  "limite_diario",
  'env("GEMINI_API_KEY")',
  'env("GEMINI_MODEL") || "gemini-3.5-flash-lite"',
  'provedor: "google-gemini"',
  '"x-goog-api-key": geminiKey',
  'mime_type: "application/json"',
  'fetch(\n      "https://generativelanguage.googleapis.com/v1beta/interactions"',
  'from("turmas")',
  'from("avaliacoes_docentes")',
  'from("trilhas")',
  'from("tentativas_avaliacao")',
  "contexto_docente_supabase",
  "contextSummary",
  "includesStudentPersonalData: false",
  'import { createClient } from "npm:@supabase/supabase-js@2.112.3"',
  'import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js@2.112.3/cors"',
  "...supabaseCorsHeaders",
  "AbortSignal.timeout(timeoutMs)",
  "prompt_versao: PROMPT_VERSION",
  "conversa_recente: refinement.messages",
  "sugestao_anterior: refinement.currentSuggestion",
]) {
  if (!edge.includes(token)) throw new Error(`Edge Function sem ${token}.`);
}

const aggregateAttemptQuery = edge.match(
  /\.from\("tentativas_avaliacao"\)[\s\S]*?\.in\("avaliacao_id", activityIds\)/,
)?.[0];
if (!aggregateAttemptQuery)
  throw new Error("Consulta agregada das tentativas não foi localizada.");
if (/aluno_id|respostas|feedback/.test(aggregateAttemptQuery))
  throw new Error(
    "O contexto do Copiloto está selecionando dados pessoais ou respostas de alunos.",
  );

for (const token of [
  "isFeatureEnabled",
  "requestTeacherCopilot",
  "listTeacherCopilotHistory",
  "sendTeacherCopilotFeedback",
  'client.functions.invoke(\n      "professor-copiloto"',
]) {
  if (!client.includes(token)) throw new Error(`Cliente sem ${token}.`);
}

for (const token of [
  'isFeatureEnabled("professor_copiloto")',
  "Aplicar ao rascunho",
  "Revise antes de aplicar.",
  "sendTeacherCopilotFeedback",
  "state.questions = activity.questions",
  "Habilitar tudo",
  "allFormatsEnabled",
  "copilot-workspace",
  "data-copilot-consent",
  "Considerar o panorama da turma",
  "data-copilot-drafts",
  "data-copilot-view",
  "Visão do aluno",
  "currentActivity:",
  "currentSuggestion:",
  "gerar_trilha",
  "gerar_ideias",
  "revisar_atividade",
  "Selecione uma turma no contexto da atividade para continuar.",
]) {
  if (!ui.includes(token)) throw new Error(`Interface sem ${token}.`);
}
if (/<input\b[^>]*\bdata-copilot-consent\b[^>]*\bchecked\b/.test(ui))
  throw new Error(
    "O contexto agregado exige consentimento, desativado por padrão.",
  );
if (!/\bmessages\s*:\s*boundedMessages\s*\(/.test(ui))
  throw new Error(
    "A conversa enviada precisa passar pelo limitador de contexto.",
  );
const uiScope = { window: {} };
vm.runInNewContext(ui, uiScope);
const boundedMessages =
  uiScope.window.OminiTeacherCopilotContracts?.boundedMessages;
if (typeof boundedMessages !== "function")
  throw new Error(
    "A interface não expõe o contrato de conversa para verificação.",
  );
const conversation = boundedMessages([
  { role: "system", content: "não enviar" },
  ...Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: "x".repeat(3000),
    studentId: "não enviar",
  })),
]);
if (
  conversation.length !== 8 ||
  conversation.some(
    (message) =>
      !["user", "assistant"].includes(message.role) ||
      message.content.length > 2000 ||
      Object.keys(message).some((key) => !["role", "content"].includes(key)),
  )
)
  throw new Error(
    "O histórico deve conter apenas oito mensagens limitadas, sem metadados individuais.",
  );

if (
  /OPENAI_API_KEY|GEMINI_API_KEY|api\.openai\.com|generativelanguage\.googleapis\.com/.test(
    ui,
  )
)
  throw new Error("A interface está expondo integração secreta com IA.");
if (
  !config.includes("[functions.professor-copiloto]") ||
  !/\[functions\.professor-copiloto\][\s\S]*?verify_jwt\s*=\s*true/.test(config)
)
  throw new Error("A função professor-copiloto não exige JWT.");
for (const section of config.matchAll(/^\[([^\]]+)\]$/gm)) {
  const count = config.match(
    new RegExp(`^\\[${section[1].replaceAll(".", "\\.")}\\]$`, "gm"),
  )?.length;
  if ((count || 0) > 1)
    throw new Error(`Configuração Supabase duplicada: ${section[1]}.`);
}

for (const specialty of [
  "professor_matematica",
  "professor_portugues",
  "professor_tecnico_administracao",
  "professor_tecnico_informatica",
]) {
  const html = read(`frontend/professor/${specialty}/avaliacoes/index.html`);
  if (!html.includes("specialty/portal.js"))
    throw new Error(`Portal docente ausente nas avaliações de ${specialty}.`);
}
if (
  !evaluationsLoader.includes("teacher-copilot.js") ||
  !evaluationsLoader.includes("teacher-copilot.css")
)
  throw new Error("Carregador compartilhado das avaliações sem o Copiloto.");

const frontendFiles = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else frontendFiles.push(target);
  }
};
walk(path.join(root, "frontend"));
for (const file of frontendFiles) {
  const source = fs.readFileSync(file, "utf8");
  if (
    /OPENAI_API_KEY|GEMINI_API_KEY|sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}/.test(
      source,
    )
  )
    throw new Error(`Possível segredo de IA exposto em ${file}.`);
}

console.log("Fundação isolada do Copiloto docente da Fase 3.0 validada.");
