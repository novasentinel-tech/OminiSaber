import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

// Run the production contracts without initializing the UI or contacting the AI.
const sourceUrl = new URL(
  "../frontend/professor/specialty/teacher-copilot.js",
  import.meta.url,
);
const sandbox = { window: {} };
vm.runInNewContext(await readFile(sourceUrl, "utf8"), sandbox, {
  filename: sourceUrl.pathname,
});
const {
  activitiesOf,
  accessPreferences,
  boundedMessages,
  contextKeyOf,
  creationAction,
  pointsOf,
  preserveReviewedTrail,
  previewEvaluation,
  suggestionIssue,
  validateSuggestion,
} = sandbox.window.OminiTeacherCopilotContracts;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("Acesso Total não herda restrições manuais de formato ou panorama", () => {
  const preferences = plain(accessPreferences({
    fullAccess: true,
    types: ["unica_escolha"],
    useClassContext: false,
  }));
  assert.equal(preferences.questionTypes.length, 8);
  assert.ok(preferences.questionTypes.includes("calculo"));
  assert.ok(preferences.questionTypes.includes("codigo"));
  assert.equal(preferences.allFormatsEnabled, true);
  assert.equal(preferences.classContextMode, "auto");
  assert.equal(preferences.useClassContext, true);
});

test("Personalizar mantém os formatos e a decisão explícita sobre panorama", () => {
  const off = plain(accessPreferences({
    fullAccess: false,
    types: ["resposta_curta", "calculo"],
    useClassContext: false,
  }));
  assert.deepEqual(off.questionTypes, ["resposta_curta", "calculo"]);
  assert.equal(off.allFormatsEnabled, false);
  assert.equal(off.classContextMode, "off");
  assert.equal(off.useClassContext, false);
  assert.equal(accessPreferences({ fullAccess: false, useClassContext: true }).classContextMode, "always");
});

test("Prova e Diagnóstica usam a ação existente de geração de atividade", () => {
  assert.equal(creationAction("gerar_prova"), "gerar_atividade");
  assert.equal(creationAction("gerar_diagnostico"), "gerar_atividade");
  assert.equal(creationAction("gerar_trilha"), "gerar_trilha");
  assert.equal(creationAction("revisar_atividade"), "revisar_atividade");
});

const question = (changes = {}) => ({
  type: "unica_escolha",
  statement: "Qual alternativa apresenta uma evidência verificável?",
  alternatives: ["Um dado observado", "Uma suposição"],
  answer: "Um dado observado",
  explanation: "Uma evidência pode ser conferida por outra pessoa.",
  points: 1,
  skillIds: [],
  ...changes,
});
const activity = (changes = {}) => ({
  title: "Observar e justificar",
  instructions: "Compare as informações e justifique sua escolha.",
  duration: 10,
  value: 1,
  scoringMode: "igual",
  questions: [question()],
  ...changes,
});
const trail = (changes = {}) => {
  const steps = ["Observar", "Comparar", "Transferir"].map((title, index) => ({
    title,
    objective: `Use evidências na etapa ${index + 1}.`,
    phase: ["diagnostico", "pratica_guiada", "transferencia"][index],
    bridge: index ? "Use o que você construiu na etapa anterior." : "",
    activity: activity({ title }),
  }));
  return {
    summary: "Uma proposta com progressão e evidências de aprendizagem.",
    warnings: ["Confira os materiais antes da aula."],
    activity: steps[0].activity,
    trail: {
      title: "De observação a argumento",
      description: "Compare evidências e formule uma conclusão fundamentada.",
      steps,
      ...changes,
    },
  };
};
const idea = (index = 1, changes = {}) => ({
  id: `idea-${index}`,
  title: `Investigação ${index}`,
  objective: "Justificar uma interpretação com evidências verificáveis.",
  hook: "Duas fontes apresentam interpretações diferentes.",
  studentAction: `Compare a fonte ${index}, selecione uma evidência e justifique.`,
  evidence: "Uma afirmação justificada com informação da fonte.",
  interaction: "dialogo",
  duration: 20,
  difficulty: "equilibrada",
  materials: ["Texto curto"],
  adaptations: ["Ofereça leitura compartilhada em dupla."],
  teacherPrompt:
    "Prepare uma investigação de fontes e uma conclusão justificada.",
  skillIds: [],
  ...changes,
});

test("aceita atividade, trilha completa e pontuação mínima utilizável", () => {
  assert.equal(validateSuggestion({ activity: activity() }), true);
  assert.equal(validateSuggestion(trail()), true);
  assert.equal(
    validateSuggestion({
      activity: activity({
        value: 0.1,
        questions: [question({ points: 0.01 })],
      }),
    }),
    true,
  );
});

test("não considera saídas incompletas ou formatos desconhecidos como prontas", () => {
  for (const malformed of [
    null,
    {},
    { summary: "Texto sem atividade." },
    { activity: activity({ questions: [] }) },
    { activity: activity({ questions: [null] }) },
    { activity: activity({ title: " " }) },
    { activity: activity({ instructions: " " }) },
    { activity: activity({ questions: [question({ statement: " " })] }) },
    { activity: activity({ questions: [question({ type: "inventado" })] }) },
    { activity: activity({ questions: [question({ answer: "" })] }) },
  ]) {
    assert.equal(validateSuggestion(malformed), false);
    assert.ok(suggestionIssue(malformed).length > 0);
  }
});

test("edição de escolhas exige alternativas distintas e gabarito existente", () => {
  for (const changes of [
    { alternatives: ["Uma única opção"] },
    { alternatives: ["", "Um dado observado"] },
    { alternatives: ["Um dado observado", " um   DADO observado "] },
    { alternatives: Array.from({ length: 9 }, (_, i) => `Opção ${i}`) },
    { answer: "Gabarito que não existe nas alternativas" },
  ]) {
    const proposal = { activity: activity({ questions: [question(changes)] }) };
    assert.equal(validateSuggestion(proposal), false);
    assert.match(suggestionIssue(proposal), /Questão 1/);
  }
});

test("verdadeiro ou falso exige as duas opções correspondentes", () => {
  const correct = question({
    type: "verdadeiro_falso",
    alternatives: ["Verdadeiro", "Falso"],
    answer: "Verdadeiro",
  });
  assert.equal(
    validateSuggestion({ activity: activity({ questions: [correct] }) }),
    true,
  );
  for (const alternatives of [
    ["Sim", "Não"],
    ["Verdadeiro", "Falso", "Depende"],
  ]) {
    assert.equal(
      validateSuggestion({
        activity: activity({
          questions: [{ ...correct, alternatives, answer: alternatives[0] }],
        }),
      }),
      false,
    );
  }
});

test("pontuação manual precisa somar o valor da atividade", () => {
  const proposal = {
    activity: activity({
      scoringMode: "manual",
      value: 1,
      questions: [question({ points: 0.01 }), question({ points: 0.99 })],
    }),
  };
  assert.equal(validateSuggestion(proposal), true);
  proposal.activity.questions[1].points = 0.97;
  assert.equal(validateSuggestion(proposal), false);
  assert.match(suggestionIssue(proposal), /soma dos pontos/);
  for (const points of [0, 0.009, -1, Infinity, NaN, 1001]) {
    assert.equal(
      validateSuggestion({
        activity: activity({ questions: [question({ points })] }),
      }),
      false,
    );
  }
});

test("pontuação igual preserva pelo menos um centésimo por questão", () => {
  const proposal = {
    activity: activity({
      value: 0.1,
      questions: Array.from({ length: 11 }, () => question({ points: 0.01 })),
    }),
  };
  assert.equal(validateSuggestion(proposal), false);
  assert.match(suggestionIssue(proposal), /distribuir pelo menos 0,01/);
});

test("gabarito numérico aceita vírgula e rejeita unidades ou valores não finitos", () => {
  for (const answer of ["3,14", "-2.5", "0", "+2", "1e2"]) {
    assert.equal(
      validateSuggestion({
        activity: activity({
          questions: [question({ type: "numerica", alternatives: [], answer })],
        }),
      }),
      true,
    );
  }
  for (const answer of ["3 kg", "Infinity", "NaN", "1/2", "1e309"]) {
    const proposal = {
      activity: activity({
        questions: [question({ type: "numerica", alternatives: [], answer })],
      }),
    };
    assert.equal(validateSuggestion(proposal), false);
    assert.match(suggestionIssue(proposal), /numérico finito/);
  }
});

test("todas as ideias precisam estar completas, inclusive a última", () => {
  const proposal = { ideas: [idea(1), idea(2), idea(3)] };
  assert.equal(validateSuggestion(proposal), true);
  for (const field of [
    "title",
    "objective",
    "hook",
    "studentAction",
    "evidence",
    "interaction",
    "teacherPrompt",
  ]) {
    assert.equal(
      validateSuggestion({
        ideas: [idea(1), idea(2), idea(3, { [field]: " " })],
      }),
      false,
    );
  }
  for (const changes of [
    { duration: 4 },
    { duration: 301 },
    { duration: 20.5 },
    { adaptations: [] },
    { materials: null },
  ]) {
    assert.equal(
      validateSuggestion({ ideas: [idea(1), idea(2), idea(3, changes)] }),
      false,
    );
  }
});

test("ideias respeitam o intervalo de três a seis propostas", () => {
  for (const count of [0, 1, 2, 7]) {
    assert.equal(
      validateSuggestion({
        ideas: Array.from({ length: count }, (_, index) => idea(index + 1)),
      }),
      false,
    );
  }
  assert.equal(
    validateSuggestion({ ideas: Array.from({ length: 6 }, (_, i) => idea(i)) }),
    true,
  );
});

test("uma trilha parcial não é reduzida silenciosamente às etapas válidas", () => {
  const proposal = trail();
  delete proposal.trail.steps[1].activity;
  assert.equal(activitiesOf(proposal).length, 3);
  assert.equal(activitiesOf(proposal)[1], undefined);
  assert.equal(validateSuggestion(proposal), false);
  assert.match(suggestionIssue(proposal), /todas as etapas/);
  for (const count of [1, 13]) {
    assert.equal(
      validateSuggestion(
        trail({
          steps: Array.from({ length: count }, () => trail().trail.steps[0]),
        }),
      ),
      false,
    );
  }
});

test("limites do percurso são conferidos sobre o conjunto das etapas", () => {
  for (const changes of [{ duration: 110 }, { value: 400 }]) {
    const proposal = trail();
    proposal.trail.steps.forEach((step) =>
      Object.assign(step.activity, changes),
    );
    assert.equal(validateSuggestion(proposal), false);
    assert.match(suggestionIssue(proposal), /percurso completo/);
  }
  const tooMany = trail();
  tooMany.trail.steps.forEach((step) => {
    step.activity.value = 1;
    step.activity.questions = Array.from({ length: 34 }, (_, index) =>
      question({ statement: `Questão ${index + 1} da etapa ${step.title}.` }),
    );
  });
  assert.equal(validateSuggestion(tooMany), false);
  assert.match(suggestionIssue(tooMany), /percurso completo/);
});

test("revisar qualquer etapa conserva as demais e a proposta anterior", () => {
  for (const index of [0, 1, 2]) {
    const previous = trail();
    const original = structuredClone(previous);
    const response = {
      summary: "A etapa foi ajustada para explicitar as evidências.",
      activity: activity({ title: "Argumentar com evidências" }),
    };
    const revised = preserveReviewedTrail(response, previous, index);
    assert.equal(validateSuggestion(revised), true);
    assert.equal(revised.trail.steps.length, original.trail.steps.length);
    assert.equal(
      revised.trail.steps[index].activity.title,
      response.activity.title,
    );
    for (let other = 0; other < original.trail.steps.length; other++) {
      if (other !== index) {
        assert.deepEqual(
          plain(revised.trail.steps[other]),
          original.trail.steps[other],
        );
      }
    }
    assert.deepEqual(previous, original);
    assert.equal(revised.activity.title, revised.trail.steps[0].activity.title);
    assert.match(
      revised.warnings.at(-1),
      new RegExp(`Somente a etapa ${index + 1}`),
    );
    revised.trail.steps[index].activity.title = "Edição posterior";
    assert.equal(response.activity.title, "Argumentar com evidências");
  }
});

test("a revisão reúne avisos existentes e novos sem duplicar ou alterar a resposta", () => {
  const previous = trail();
  const response = {
    summary: "Revise a clareza do enunciado.",
    warnings: [...previous.warnings, "Confira a linguagem com a turma."],
    activity: activity({ title: "Uma etapa revisada" }),
  };
  const originalResponse = structuredClone(response);
  const revised = preserveReviewedTrail(response, previous, 1);
  assert.equal(
    revised.warnings.filter((warning) => warning === previous.warnings[0])
      .length,
    1,
  );
  assert.ok(revised.warnings.includes("Confira a linguagem com a turma."));
  assert.equal(revised.summary, response.summary);
  assert.deepEqual(response, originalResponse);
  assert.equal(
    preserveReviewedTrail(response, { activity: activity() }, 0),
    response,
  );
  assert.equal(preserveReviewedTrail(previous, previous, 0), previous);
});

test("prévia numérica confere decimal, zero, tolerância e entradas inválidas", () => {
  const numeric = {
    type: "numerica",
    answer: "3,14",
    configuration: { tolerance: 0.01 },
  };
  assert.equal(previewEvaluation(numeric, "3.145").kind, "correct");
  assert.equal(previewEvaluation(numeric, "3,16").kind, "incorrect");
  assert.equal(
    previewEvaluation({ type: "numerica", answer: "0" }, "0").kind,
    "correct",
  );
  assert.equal(
    previewEvaluation({ type: "numerica", answer: "-2" }, "-2,0").kind,
    "correct",
  );
  assert.equal(
    previewEvaluation(
      {
        type: "numerica",
        answer: "2",
        answerConfiguration: { tolerance: 0.1 },
      },
      "2.05",
    ).kind,
    "correct",
  );
  for (const response of ["Infinity", "NaN", "3,14 kg", "1e309"]) {
    assert.equal(previewEvaluation(numeric, response).kind, "incorrect");
  }
});

test("prévia de resposta curta normaliza espaços e caixa, com variantes explícitas", () => {
  const short = {
    type: "resposta_curta",
    answer: "Fato",
    configuration: { acceptedAnswers: ["Evidência textual"] },
  };
  assert.equal(previewEvaluation(short, " fato ").kind, "correct");
  assert.equal(
    previewEvaluation(short, " EVIDÊNCIA   TEXTUAL ").kind,
    "correct",
  );
  assert.equal(
    previewEvaluation(short, "Uma evidência textual qualquer").kind,
    "incorrect",
  );
  assert.equal(previewEvaluation(short, "fáto").kind, "incorrect");
  assert.equal(
    previewEvaluation(
      {
        type: "resposta_curta",
        answer: "Fato",
        answerConfiguration: { acceptedAnswers: ["Evidência"] },
      },
      "evidência",
    ).kind,
    "correct",
  );
});

test("prévia diferencia correção automática de revisão humana", () => {
  assert.equal(
    previewEvaluation(question(), "Um dado observado").kind,
    "correct",
  );
  assert.equal(
    previewEvaluation(question(), "Uma suposição").kind,
    "incorrect",
  );
  assert.match(
    previewEvaluation(question(), "Uma suposição").feedback,
    /pode ser conferida/,
  );
  assert.equal(
    previewEvaluation({ type: "calculo", answer: "2" }, "2,0").kind,
    "correct",
  );
  for (const type of ["dissertativa", "estudo_caso", "codigo", "calculo"]) {
    const result = previewEvaluation(
      { type, answer: "Critérios observáveis para revisão." },
      "Minha resposta.",
    );
    assert.equal(result.kind, "manual");
    assert.match(result.feedback, /professor revisará/);
  }
  const empty = previewEvaluation(question(), " ");
  assert.equal(empty.kind, "empty");
  assert.ok(!empty.feedback.includes(question().answer));
});

test("histórico conserva somente as oito mensagens pedagógicas mais recentes", () => {
  const messages = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `Mensagem ${index}`,
    createdAt: index,
    contextKey: "turma-interna",
  }));
  messages.splice(10, 0, {
    role: "system",
    content: "Conteúdo não autorizado.",
  });
  messages.push({ role: "tool", content: "Saída de ferramenta." });
  const original = structuredClone(messages);
  const bounded = boundedMessages(messages);
  assert.equal(bounded.length, 8);
  assert.equal(bounded[0].content, "Mensagem 4");
  assert.equal(bounded.at(-1).content, "Mensagem 11");
  assert.ok(
    bounded.every((message) => ["user", "assistant"].includes(message.role)),
  );
  assert.deepEqual(Object.keys(bounded[0]), ["role", "content"]);
  assert.deepEqual(messages, original);
});

test("mensagens longas são limitadas e metadados internos ficam fora do pedido", () => {
  const result = boundedMessages([
    { role: "system", content: "Não enviar." },
    { role: "user", content: "a".repeat(3000), contextKey: "turma" },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].content.length, 2000);
  assert.deepEqual(Object.keys(result[0]), ["role", "content"]);
  assert.equal(boundedMessages([]).length, 0);
});

test("a identidade do contexto muda com turma, trimestre ou categoria", () => {
  const original = contextKeyOf("turma-a", 1, "atividade");
  assert.equal(contextKeyOf("turma-a", "1", "atividade"), original);
  assert.notEqual(contextKeyOf("turma-b", 1, "atividade"), original);
  assert.notEqual(contextKeyOf("turma-a", 2, "atividade"), original);
  assert.notEqual(contextKeyOf("turma-a", 1, "avaliacao"), original);
  assert.equal(activitiesOf({ activity: activity() }).length, 1);
  assert.equal(activitiesOf({}).length, 0);
});

test("pontos exibidos distribuem centavos sem inflar o valor total", () => {
  const proposal = activity({
    value: 3.33,
    questions: [question(), question()],
  });
  const points = proposal.questions.map((_, index) =>
    pointsOf(proposal, index),
  );
  assert.deepEqual(points, [1.67, 1.66]);
  assert.equal(
    points.reduce((sum, value) => sum + Math.round(value * 100), 0),
    333,
  );
  const thirds = activity({
    value: 10,
    questions: [question(), question(), question()],
  });
  assert.deepEqual(
    thirds.questions.map((_, index) => pointsOf(thirds, index)),
    [3.34, 3.33, 3.33],
  );
  const manual = activity({
    scoringMode: "manual",
    value: 3.33,
    questions: [question({ points: 2.33 }), question({ points: 1 })],
  });
  assert.deepEqual(
    manual.questions.map((_, index) => pointsOf(manual, index)),
    [2.33, 1],
  );
});

test("pontuação manual rejeita um centavo de diferença e a terceira casa decimal", () => {
  const exact = {
    activity: activity({
      scoringMode: "manual",
      value: 1,
      questions: [question({ points: 0.5 }), question({ points: 0.5 })],
    }),
  };
  assert.equal(validateSuggestion(exact), true);
  const oneCent = structuredClone(exact);
  oneCent.activity.questions[1].points = 0.49;
  assert.equal(validateSuggestion(oneCent), false);
  assert.match(suggestionIssue(oneCent), /soma dos pontos/);
  const fractionalCents = structuredClone(exact);
  fractionalCents.activity.questions[0].points = 0.495;
  fractionalCents.activity.questions[1].points = 0.505;
  assert.equal(validateSuggestion(fractionalCents), false);
  assert.match(suggestionIssue(fractionalCents), /duas casas decimais/);
  const fractionalTotal = { activity: activity({ value: 1.001 }) };
  assert.equal(validateSuggestion(fractionalTotal), false);
  assert.match(suggestionIssue(fractionalTotal), /duas casas decimais/);
});

test("cálculo exige resultado numérico e não usa a resolução textual como gabarito", () => {
  for (const answer of [
    "2 + 2 = 4. Critérios: apresente as etapas e justifique o resultado.",
    "A resposta é 4.",
    "4 cm",
    "Infinity",
  ]) {
    const proposal = {
      activity: activity({
        questions: [question({ type: "calculo", alternatives: [], answer })],
      }),
    };
    assert.equal(validateSuggestion(proposal), false);
    assert.match(suggestionIssue(proposal), /gabarito numérico finito/);
  }
  const valid = {
    activity: activity({
      questions: [
        question({
          type: "calculo",
          alternatives: [],
          answer: "4,5",
          explanation: "Some as parcelas e confira a unidade no enunciado.",
        }),
      ],
    }),
  };
  assert.equal(validateSuggestion(valid), true);
  assert.equal(
    previewEvaluation(valid.activity.questions[0], "4.5").kind,
    "correct",
  );
});
