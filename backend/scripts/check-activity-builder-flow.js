import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const client = read("backend", "ominisaber-supabase-client.js");
const builder = read(
  "frontend",
  "professor",
  "specialty",
  "activity-builder.js",
);
const configs = read("frontend", "professor", "specialty", "configs.js");
const portal = read("frontend", "professor", "specialty", "portal.js");
const dashboard = read("frontend", "professor", "specialty", "teacher-dashboard.js");
const evaluationsLoader = read(
  "frontend",
  "Parties",
  "teacher-evaluations.js",
);
const studioApp = read("engine", "src", "App.jsx");
const mathStyle = read(
  "frontend",
  "professor",
  "professor_matematica",
  "avaliacoes",
  "style.css",
);
const migration = read(
  "backend",
  "migrations",
  "20260908_construtor_atividades_fase2_2.sql",
);
const executionFix = read(
  "backend",
  "migrations",
  "20260909_atividade_docente_privilegios_minimos.sql",
);
const geometryMigration = read(
  "backend",
  "migrations",
  "20260910_laboratorio_medidas_geometricas.sql",
);
const answerProtectionMigration = read(
  "backend",
  "migrations",
  "20260916_proteger_respostas_construtor_atividades.sql",
);
const teachers = [
  "professor_matematica",
  "professor_portugues",
  "professor_tecnico_administracao",
  "professor_tecnico_informatica",
];
const checks = [
  [
    "cliente usa criação atômica",
    /rpc\(["']criar_atividade_docente["']/.test(client),
  ],
  [
    "cliente lê vínculo por matéria",
    /from\(["']professor_turma_materias["']\)/.test(client),
  ],
  [
    "construtor possui quatro etapas",
    ["Contexto", "Currículo", "Experiência", "Revisão"].every((label) =>
      builder.includes(label),
    ),
  ],
  [
    "formato altera a experiência de autoria",
    builder.includes("CATEGORY_TYPES") &&
      builder.includes("renderFormatPanel") &&
      builder.includes("renderQuestionEditor"),
  ],
  [
    "biblioteca possui quatro novos blocos interativos",
    ["formula_quimica", "tabela_consultavel", "formula_matematica", "plano_cartesiano"].every(
      (value) => builder.includes(value),
    ) && builder.includes("INTERACTIVE_BLOCKS"),
  ],
  [
    "blocos interativos preservam tipos compatíveis com o banco",
    builder.includes('baseType: "resposta_curta"') &&
      builder.includes('baseType: "unica_escolha"') &&
      builder.includes('baseType: "calculo"') &&
      builder.includes("activityBlock"),
  ],
  [
    "cartões interativos possuem profundidade e movimento reduzido",
    builder.includes("--block-rx") &&
      builder.includes("prefers-reduced-motion: reduce") &&
      read("frontend", "professor", "specialty", "activity-builder.css").includes(
        ".interactive-type-card",
      ),
  ],
  [
    "modo de prova monitorada explicita limites do navegador",
    builder.includes("secureExam") &&
      builder.includes("não consegue bloquear DevTools") &&
      builder.includes('aiHandling: "teacher_review"'),
  ],
  [
    "construtor não contém dados mockados",
    !/mock|demonstra[cç][aã]o/i.test(builder),
  ],
  [
    "pontuação igual e manual",
    builder.includes("scoringMode") && builder.includes("manual"),
  ],
  [
    "etapas futuras validam todos os passos anteriores",
    builder.includes("const navigateTo") &&
      builder.includes("for (let step = state.step; step < target; step += 1)"),
  ],
  [
    "contexto, agenda e tentativas possuem validação completa",
    builder.includes("const validateContext") &&
      builder.includes("const validateSchedule") &&
      builder.includes("O encerramento precisa acontecer depois da abertura"),
  ],
  [
    "envio é único e datas locais são convertidas para ISO",
    builder.includes("if (state.submitting) return") &&
      builder.includes("new Date(String(value)).toISOString()") &&
      builder.includes('const intent = submitter?.value === "publish"'),
  ],
  [
    "edição do roteiro protege campos ainda não salvos",
    builder.includes("Há uma questão em preenchimento") &&
      builder.includes("Deseja excluir a questão") &&
      builder.includes("Alterações da questão salvas"),
  ],
  [
    "troca de turma ou trimestre exige novo vínculo curricular",
    builder.includes("curriculumNeedsRelink") &&
      builder.includes('field("trimester").addEventListener("change"'),
  ],
  [
    "duplicação preserva configurações protegidas e regras de aplicação",
    builder.includes("answerConfiguration:") &&
      builder.includes("resposta_esperada?.normalization") &&
      builder.includes('field("attempts").value = source.tentativas_permitidas'),
  ],
  [
    "Matemática possui ateliê com modelos por descritor",
    [
      "plano_cartesiano",
      "reta_numerica",
      "pitagoras",
      "geometria_medidas",
      "grafico_barras",
      "D043_M",
      "D049_M",
      "D064_M",
    ].every((value) => configs.includes(value)) &&
      builder.includes("renderMathTemplateLab"),
  ],
  [
    "laboratório de medidas suporta formas 2D, 3D e personalizadas",
    builder.includes("GEOMETRY_SHAPES") &&
      builder.includes("personalizada_2d") &&
      builder.includes("personalizada_3d") &&
      builder.includes("toggleMeasurements") &&
      mathStyle.includes(".geometry-visual") &&
      geometryMigration.includes("v_modo = 'geometria_medidas'"),
  ],
  [
    "roteiro fica ao final do editor e pode ser minimizado",
    builder.indexOf('data-question-editor') <
      builder.indexOf('data-question-outline') &&
      builder.includes("data-toggle-outline") &&
      builder.includes("outlineCollapsed") &&
      /\.question-outline\s*\{[\s\S]*?position:\s*static/.test(
        read("frontend", "professor", "specialty", "activity-builder.css"),
      ),
  ],
  [
    "editor matemático possui prévia e validação próprias",
    builder.includes("renderMathPreview") &&
      builder.includes("Use coordenadas inteiras") &&
      mathStyle.includes(".math-live-preview") &&
      mathStyle.includes(".math-template-grid"),
  ],
  [
    "triângulo matemático fecha a hipotenusa e identifica o modelo",
    builder.includes('d="M42 24 V154 H232 Z"') &&
      builder.includes("selectedMathTemplate.label") &&
      mathStyle.includes(".right-angle-mark") &&
      !mathStyle.includes("skewY(-31deg)"),
  ],
  [
    "gabaritos matemáticos e resoluções não ficam na configuração pública",
    answerProtectionMigration.includes("- 'targetX' - 'targetY'") &&
      answerProtectionMigration.includes("- 'correctLabel' - 'chartRows'") &&
      answerProtectionMigration.includes("new.configuracao - 'solution'") &&
      builder.includes("answerConfiguration = { solution"),
  ],
  [
    "questões aceitam imagem de referência acessível",
    builder.includes("data-reference-file") &&
      builder.includes("optimizeReferenceImage") &&
      builder.includes("referenceImage"),
  ],
  [
    "questões de cálculo aceitam expressão de referência",
    builder.includes("data-math-expression") &&
      builder.includes("mathExpression"),
  ],
  [
    "publicação valida vínculo docente",
    migration.includes("private.professor_tem_turma_materia"),
  ],
  [
    "função usa privilégios mínimos com rotina privada autorizada",
    /alter function public\.criar_atividade_docente\(jsonb\) security invoker/i.test(
      executionFix,
    ) &&
      /grant usage on schema private to authenticated/i.test(executionFix) &&
      migration.includes("v_professor_id uuid := (select auth.uid())") &&
      migration.includes("private.professor_tem_turma_materia"),
  ],
  [
    "chamadas anônimas revogadas",
    /revoke all on function public\.criar_atividade_docente\(jsonb\) from public, anon/i.test(
      migration,
    ),
  ],
  [
    "OminiStudio aparece no menu, dashboard e ações rápidas docentes",
    portal.includes("portal-studio-link") &&
      portal.includes("./teacher-dashboard.js") &&
      /\['account_tree',\s*'OminiStudio',\s*studioRoute\]/.test(dashboard) &&
      /<a href="\$\{e\(studioRoute\)\}">Abrir(?: o)? OminiStudio/.test(dashboard),
  ],
  [
    "integração do estúdio envia apenas especialidade e retorno",
    portal.includes("teacherType: config.type") &&
      portal.includes("returnTo: window.location.pathname") &&
      studioApp.includes("requestedReturn.startsWith('/frontend/professor/')"),
  ],
  [
    "rascunhos do OminiStudio são separados por especialidade",
    studioApp.includes("oministudio.work.v1.${teacherType || 'geral'}") &&
      studioApp.includes("subject: teacherContext.subject"),
  ],
  ...teachers.map((name) => [
    `${name} carrega o construtor`,
    read("frontend", "professor", name, "avaliacoes", "index.html").includes(
      "specialty/portal.js",
    ) && evaluationsLoader.includes("activity-builder.js"),
  ]),
  ...teachers.flatMap((name) =>
    ["dashboard", "laboratorio", "avaliacoes"].map((page) => [
      `${name}/${page} carrega o portal docente compartilhado`,
      read("frontend", "professor", name, page, "index.html").includes(
        "specialty/portal.js",
      ),
    ]),
  ),
];

for (const [label, ok] of checks)
  console.log(`${ok ? "OK  " : "ERRO"} ${label}`);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
