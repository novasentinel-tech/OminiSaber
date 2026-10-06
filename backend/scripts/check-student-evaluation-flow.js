import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const migration = read(
  "backend",
  "migrations",
  "20260908_execucao_correcao_atividades_fase2_3.sql",
);
const client = read("backend", "ominisaber-supabase-client.js");
const page = read("frontend", "aluno", "atividades", "script.js");
const html = read("frontend", "aluno", "atividades", "index.html");
const css = read("frontend", "aluno", "atividades", "style.css");
const dashboard = read("frontend", "aluno", "dashboard_principal", "script.js");
const shell = read("frontend", "aluno", "shared", "account-shell.js");
const notificationMigration = read(
  "backend",
  "migrations",
  "20260909122618_atividades_aluno_dashboard_notificacoes.sql",
);
const formatIntegrityMigration = read(
  "backend",
  "migrations",
  "20260910_integridade_formatos_atividade.sql",
);
const geometryMigration = read(
  "backend",
  "migrations",
  "20260910_laboratorio_medidas_geometricas.sql",
);
const geometryProtectionMigration = read(
  "backend",
  "migrations",
  "20260910_proteger_gabarito_geometria.sql",
);
const studentHardeningMigration = read(
  "backend",
  "migrations",
  "20260917_endurecer_execucao_atividades_aluno.sql",
);
const associationHydrationMigration = read(
  "backend",
  "migrations",
  "20260917_endurecer_execucao_atividades_aluno_ajuste_associacao.sql",
);
const studentPermissionMigration = read(
  "backend",
  "migrations",
  "20260917_endurecer_execucao_atividades_aluno_ajuste_permissoes.sql",
);
const checks = [
  [
    "RPC inicia tentativa",
    /rpc\(["']iniciar_tentativa_avaliacao["']/.test(client),
  ],
  [
    "RPC salva resposta por questão",
    /rpc\(["']salvar_resposta_avaliacao["']/.test(client),
  ],
  [
    "RPC entrega tentativa",
    /rpc\(["']entregar_tentativa_avaliacao["']/.test(client),
  ],
  [
    "correção automática fica no banco",
    migration.includes("private.corrigir_entrega_avaliacao"),
  ],
  [
    "correção aplica tolerância e respostas curtas alternativas",
    formatIntegrityMigration.includes("v_tolerancia") &&
      formatIntegrityMigration.includes("acceptedAnswers"),
  ],
  [
    "formatos interativos possuem validação no banco",
    formatIntegrityMigration.includes("private.validar_questao_avaliacao") &&
      formatIntegrityMigration.includes("private.validar_gabarito_avaliacao") &&
      [
        "plano_cartesiano",
        "reta_numerica",
        "pitagoras",
        "geometria_medidas",
        "grafico_barras",
        "associacao",
        "ordenacao",
      ].every((value) =>
        `${formatIntegrityMigration}\n${geometryMigration}`.includes(value),
      ),
  ],
  [
    "laboratório geométrico é manipulável e salva resposta numérica",
    page.includes("geometryResponseInput") &&
      page.includes("data-geometry-rotation") &&
      page.includes("data-geometry-scale") &&
      page.includes("data-toggle-geometry-measures") &&
      css.includes(".interactive-geometry") &&
      geometryMigration.includes(
        "O laboratorio de medidas deve usar resposta numerica",
      ),
  ],
  [
    "aluno recebe experiências próprias para os novos blocos",
    [
      "data-chemical-builder",
      "data-searchable-table",
      "data-math-keypad",
      "data-coordinate-plane",
    ].every((value) => page.includes(value)),
  ],
  [
    "tabela permite busca e ordenação responsivas",
    page.includes("data-table-search") &&
      page.includes("data-sort-column") &&
      css.includes(".responsive-data-table"),
  ],
  [
    "cartões do aluno respeitam teclado e movimento reduzido",
    page.includes("data-learning-card") &&
      page.includes("learningCard.tabIndex = 0") &&
      css.includes(".learning-interactive-card") &&
      css.includes("prefers-reduced-motion: reduce"),
  ],
  [
    "devolutiva do aluno mostra andamento e comentários por questão",
    page.includes("result-timeline") &&
      page.includes("student-feedback-item") &&
      page.includes("teacher-feedback") &&
      css.includes(".feedback-center"),
  ],
  [
    "nova tentativa aguarda o fim da revisão docente",
    page.includes("!attempt.requer_revisao && attemptsRemaining > 0"),
  ],
  [
    "gabarito geométrico não permanece na configuração pública",
    geometryProtectionMigration.includes(
      "new.configuracao - 'target' - 'solution'",
    ) &&
      geometryProtectionMigration.includes(
        "aa_hidratar_configuracao_geometria",
      ) &&
      geometryProtectionMigration.includes(
        "zz_proteger_configuracao_geometria",
      ),
  ],
  [
    "ajuste de nota confere tentativa, avaliação e aluno",
    formatIntegrityMigration.includes(
      "t.avaliacao_id = ajustes_notas_avaliacao.avaliacao_id",
    ) &&
      formatIntegrityMigration.includes(
        "t.aluno_id = ajustes_notas_avaliacao.aluno_id",
      ),
  ],
  [
    "gabarito não é consultado pelo aluno",
    !/gabaritos_avaliacao/.test(page) && !/gabaritos_avaliacao/.test(html),
  ],
  ["página não contém dados mockados", !/mock|demonstra[cç][aã]o/i.test(page)],
  [
    "autosalvamento é drenado antes da entrega",
    page.includes("flushPendingSaves") &&
      page.includes("persistQueuedAnswer") &&
      /await flushPendingSaves\(\)[\s\S]*submitStudentEvaluationAttempt/.test(
        page,
      ),
  ],
  [
    "falha de rede mantém resposta na fila",
    page.includes("saveQueue.set(questionId, queued)") &&
      page.includes("Falha ao salvar · tentaremos novamente"),
  ],
  [
    "obrigatórias são validadas individualmente",
    page.includes("unansweredRequired") &&
      page.includes("question.obrigatoria && !answerIsComplete"),
  ],
  [
    "respostas vazias são normalizadas e recusadas pelo banco",
    client.includes("normalizedAnswer") &&
      studentHardeningMigration.includes(
        "respostas_avaliacao_resposta_preenchida_check",
      ) &&
      studentPermissionMigration.includes(
        "grant execute on function private.resposta_avaliacao_preenchida(jsonb)",
      ),
  ],
  [
    "associação e ordenação possuem interação própria",
    page.includes('question.tipo === "associacao"') &&
      page.includes('question.tipo === "ordenacao"') &&
      css.includes(".association-answer") &&
      css.includes(".ordering-answer"),
  ],
  [
    "associação e ordenação não expõem a sequência correta",
    studentHardeningMigration.includes("associationOptions") &&
      studentHardeningMigration.includes("sanitizar_questao_apos_gabarito") &&
      associationHydrationMigration.includes(
        "new.tipo = 'associacao' and jsonb_typeof(v_resposta) = 'array'",
      ) &&
      associationHydrationMigration.includes(
        "new.configuracao->'associationLeft'",
      ) &&
      associationHydrationMigration.includes(
        "jsonb_array_elements(new.configuracao->'pairs')",
      ) &&
      page.includes("config.associationOptions"),
  ],
  [
    "modelos matemáticos possuem interação própria",
    [
      "data-coordinate-plane",
      "data-number-line",
      "interactive-triangle",
      "data-bar-option",
    ].every((value) => page.includes(value)) &&
      css.includes(".interactive-coordinate") &&
      css.includes(".interactive-number-line") &&
      css.includes(".interactive-bars"),
  ],
  [
    "triângulo do aluno fecha a hipotenusa de forma responsiva",
    page.includes('d="M42 24 V154 H232 Z"') &&
      css.includes(".triangle-figure .right-angle-mark") &&
      !css.includes("skewY(-31deg)"),
  ],
  [
    "Prova Segura tem entrada transparente e controles locais",
    page.includes("requestFullscreen") &&
      page.includes("visibilitychange") &&
      page.includes("O navegador não bloqueia DevTools"),
  ],
  [
    "entrega exige confirmação",
    page.includes("Depois do envio as respostas não poderão ser alteradas"),
  ],
  [
    "prazos encerrados e futuros não contam como pendência",
    page.includes('access.state === "expired"') &&
      page.includes('access.state === "scheduled"') &&
      dashboard.includes("getStudentEvaluationAvailability") &&
      dashboard.includes("const actionable") &&
      client.includes("getStudentEvaluationAvailability"),
  ],
  [
    "novas tentativas respeitam limite e período",
    page.includes("attemptsRemaining") &&
      page.includes("data-retry-attempt") &&
      page.includes("forceNew"),
  ],
  ["layout possui ajustes móveis", /@media\s*\(max-width:\s*560px\)/.test(css)],
  [
    "CSS com chaves balanceadas",
    (css.match(/{/g) || []).length === (css.match(/}/g) || []).length,
  ],
  [
    "funções públicas usam security invoker",
    (migration.match(/security invoker/g) || []).length >= 3,
  ],
  [
    "acesso anônimo revogado",
    (migration.match(/from public, anon/g) || []).length >= 3,
  ],
  [
    "dashboard recebe avaliações reais",
    client.includes("const getStudentDashboard") &&
      client.includes("listStudentEvaluations()") &&
      client.includes("descriptorPerformance: descriptorPerformanceResult.data || []") &&
      dashboard.includes("data?.evaluations"),
  ],
  [
    "dashboard prioriza atividade docente pendente",
    dashboard.includes("Sua próxima atividade") &&
      dashboard.includes("../atividades/index.html?atividade="),
  ],
  [
    "sidebar exibe contadores reais",
    (shell.includes("listStudentEvaluations") ||
      client.includes("refreshStudentSidebarCounters")) &&
      shell.includes("listNotifications") &&
      shell.includes("data-shell-activity-count") &&
      client.includes('navItem("atividades"'),
  ],
  [
    "publicação gera notificação para a turma",
    notificationMigration.includes("trg_sincronizar_notificacao_avaliacao") &&
      notificationMigration.includes("destino_turma_id") &&
      notificationMigration.includes("avaliacao_id"),
  ],
  [
    "atividades publicadas são retroalimentadas",
    /from public\.avaliacoes_docentes a[\s\S]*where a\.status = 'publicado'/i.test(
      notificationMigration,
    ),
  ],
];
for (const [label, ok] of checks)
  console.log(`${ok ? "OK  " : "ERRO"} ${label}`);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
