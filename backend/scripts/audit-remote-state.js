import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const secretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secretKey) {
  throw new Error(
    "SUPABASE_URL e uma chave privada são necessárias para a auditoria somente leitura.",
  );
}

const client = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const issues = [];
const checks = {};
const add = (severity, code, count, message) => {
  if (!count) return;
  issues.push({ severity, code, count, message });
};

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const read = async (table, columns) => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data, error } = await client.from(table).select(columns);
    if (!error) return data || [];

    lastError = error;
    if (attempt < 3 && /fetch failed|network|timeout/i.test(error.message)) {
      await wait(attempt * 350);
      continue;
    }
    break;
  }

  throw new Error(`${table}: ${lastError?.message || "falha desconhecida"}`);
};

const readRequests = [
  ["perfis", "id,role,turma_id,curso_tecnico,tipo_professor,ativo"],
  ["turmas", "id,nome,serie,ano_letivo"],
  ["professor_turma_materias", "professor_id,turma_id,materia_codigo,ativo"],
  ["professor_turmas", "professor_id,turma_id,materia"],
  [
    "avaliacoes_docentes",
    "id,professor_id,turma_id,materia_codigo,status,valor,publicado_em",
  ],
  ["questoes_avaliacao", "id,avaliacao_id,pontos,tipo"],
  ["questoes_avaliacao_habilidades", "questao_id,habilidade_id"],
  [
    "tentativas_avaliacao",
    "id,avaliacao_id,aluno_id,status,nota,requer_revisao,enviada_em,corrigida_em",
  ],
  [
    "respostas_avaliacao",
    "id,tentativa_id,questao_id,status_correcao,pontos_automaticos,pontos_manuais",
  ],
  ["notificacoes", "id,tipo,destino_turma_id,avaliacao_id,evento_agenda_id"],
  ["redacoes", "id,status,nota,corrigida_por,corrigida_em"],
  ["avaliacoes_competencias_redacao", "redacao_id,competencia,nota"],
  ["livros", "id,quantidade_total,quantidade_disponivel"],
  ["exemplares", "id,livro_id,status"],
  ["solicitacoes_emprestimo", "id,livro_id,exemplar_id,aluno_id,status"],
];

const readResults = [];
for (const [table, columns] of readRequests) {
  readResults.push(await read(table, columns));
}

const [
  profiles,
  classes,
  teacherLinks,
  legacyTeacherLinks,
  evaluations,
  questions,
  questionSkills,
  attempts,
  answers,
  notifications,
  essays,
  essayCompetencies,
  books,
  copies,
  requests,
] = readResults;

const by = (rows, key) =>
  Object.groupBy(rows, (row) => String(row[key] ?? "sem_valor"));
const countBy = (rows, key) =>
  Object.fromEntries(
    Object.entries(by(rows, key)).map(([value, items]) => [
      value,
      items.length,
    ]),
  );

checks.host = new URL(url).host;
checks.counts = {
  profiles: profiles.length,
  classes: classes.length,
  teacherLinks: teacherLinks.length,
  legacyTeacherLinks: legacyTeacherLinks.length,
  evaluations: evaluations.length,
  questions: questions.length,
  attempts: attempts.length,
  answers: answers.length,
  notifications: notifications.length,
  essays: essays.length,
  books: books.length,
  copies: copies.length,
  loanRequests: requests.length,
};
checks.profilesByRole = countBy(profiles, "role");
checks.evaluationsByStatus = countBy(evaluations, "status");
checks.attemptsByStatus = countBy(attempts, "status");

const classIds = new Set(classes.map((item) => item.id));
const questionByEvaluation = by(questions, "avaliacao_id");
const skillsByQuestion = by(questionSkills, "questao_id");
const answerByAttempt = by(answers, "tentativa_id");
const competenciesByEssay = by(essayCompetencies, "redacao_id");
const copiesByBook = by(copies, "livro_id");

add(
  "high",
  "STUDENT_WITHOUT_CLASS",
  profiles.filter((item) => item.role === "aluno" && !item.turma_id).length,
  "alunos ativos ou inativos sem turma não recebem corretamente conteúdo por turma",
);
add(
  "high",
  "STUDENT_WITHOUT_COURSE",
  profiles.filter((item) => item.role === "aluno" && !item.curso_tecnico)
    .length,
  "alunos sem curso técnico não recebem a trilha técnica correta",
);
add(
  "high",
  "TEACHER_WITHOUT_SPECIALTY",
  profiles.filter((item) => item.role === "professor" && !item.tipo_professor)
    .length,
  "professores sem especialidade não possuem rota docente determinística",
);
add(
  "high",
  "TEACHER_WITHOUT_CANONICAL_LINK",
  profiles.filter(
    (profile) =>
      profile.role === "professor" &&
      !teacherLinks.some(
        (link) => link.professor_id === profile.id && link.ativo,
      ),
  ).length,
  "professores sem vínculo canônico ativo não conseguem criar ou consultar atividades",
);
add(
  "medium",
  "LEGACY_LINK_WITHOUT_CANONICAL",
  legacyTeacherLinks.filter(
    (legacy) =>
      !teacherLinks.some(
        (link) =>
          link.professor_id === legacy.professor_id &&
          link.turma_id === legacy.turma_id &&
          link.ativo,
      ),
  ).length,
  "vínculos legados não sincronizados podem divergir entre agenda e motor de atividades",
);
add(
  "high",
  "PUBLISHED_WITHOUT_QUESTIONS",
  evaluations.filter(
    (evaluation) =>
      evaluation.status === "publicado" &&
      !(questionByEvaluation[evaluation.id] || []).length,
  ).length,
  "atividades publicadas sem questões aparecem ao aluno mas não podem ser executadas",
);
add(
  "medium",
  "PUBLISHED_WITHOUT_TIMESTAMP",
  evaluations.filter(
    (evaluation) =>
      evaluation.status === "publicado" && !evaluation.publicado_em,
  ).length,
  "atividades publicadas sem data quebram ordenação e auditoria",
);
add(
  "high",
  "EVALUATION_POINTS_MISMATCH",
  evaluations.filter((evaluation) => {
    const total = (questionByEvaluation[evaluation.id] || []).reduce(
      (sum, question) => sum + Number(question.pontos || 0),
      0,
    );
    return (
      (questionByEvaluation[evaluation.id] || []).length &&
      Math.abs(total - Number(evaluation.valor || 0)) > 0.001
    );
  }).length,
  "a soma dos pontos das questões diverge do valor total informado",
);
add(
  "medium",
  "QUESTION_WITHOUT_SKILL",
  questions.filter((question) => !(skillsByQuestion[question.id] || []).length)
    .length,
  "questões sem habilidade não alimentam desempenho por descritor",
);
add(
  "high",
  "SUBMITTED_WITHOUT_ANSWERS",
  attempts.filter(
    (attempt) =>
      ["enviada", "corrigida"].includes(attempt.status) &&
      !(answerByAttempt[attempt.id] || []).length,
  ).length,
  "tentativas entregues sem respostas indicam publicação ou entrega inconsistente",
);
add(
  "high",
  "CORRECTED_WITHOUT_GRADE",
  attempts.filter(
    (attempt) => attempt.status === "corrigida" && attempt.nota === null,
  ).length,
  "tentativas corrigidas sem nota não podem alimentar resultados",
);
add(
  "medium",
  "PUBLISHED_WITHOUT_NOTIFICATION",
  evaluations.filter(
    (evaluation) =>
      evaluation.status === "publicado" &&
      !notifications.some(
        (notification) => notification.avaliacao_id === evaluation.id,
      ),
  ).length,
  "atividades publicadas sem notificação reduzem a descoberta no painel do aluno",
);
add(
  "high",
  "CORRECTED_ESSAY_WITHOUT_COMPETENCIES",
  essays.filter(
    (essay) =>
      essay.status === "corrigida" &&
      (essay.nota !== null || essay.corrigida_em) &&
      (competenciesByEssay[essay.id] || []).length !== 5,
  ).length,
  "redações corrigidas sem cinco competências exibem nota geral incompatível com a rubrica",
);
add(
  "high",
  "BOOK_TOTAL_MISMATCH",
  books.filter(
    (book) =>
      Number(book.quantidade_total) !== (copiesByBook[book.id] || []).length,
  ).length,
  "quantidade_total do livro diverge do número real de exemplares",
);
add(
  "high",
  "BOOK_AVAILABLE_MISMATCH",
  books.filter(
    (book) =>
      Number(book.quantidade_disponivel) !==
      (copiesByBook[book.id] || []).filter(
        (copy) => copy.status === "disponivel",
      ).length,
  ).length,
  "quantidade_disponivel do livro diverge dos exemplares disponíveis",
);
add(
  "high",
  "ACTIVE_LOAN_WITHOUT_COPY",
  requests.filter(
    (request) =>
      ["aprovado", "emprestado"].includes(request.status) &&
      !request.exemplar_id,
  ).length,
  "solicitações aprovadas ou emprestadas sem exemplar impedem rastreabilidade",
);
add(
  "medium",
  "INVALID_CLASS_REFERENCE",
  profiles.filter(
    (profile) => profile.turma_id && !classIds.has(profile.turma_id),
  ).length,
  "perfil referencia turma inexistente",
);

console.log(JSON.stringify({ checks, issues }, null, 2));
process.exitCode = issues.some((issue) => issue.severity === "high") ? 1 : 0;
