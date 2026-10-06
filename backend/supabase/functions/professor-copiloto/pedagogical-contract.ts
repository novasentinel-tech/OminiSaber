import { normalizeVisualResources, visualResourcesSchema } from './visual-contract.ts';
type JsonObject = Record<string, unknown>;

export const QUESTION_TYPES = ["unica_escolha", "verdadeiro_falso", "resposta_curta", "dissertativa", "numerica", "calculo", "codigo", "estudo_caso"];
export const TRAIL_INTERACTIONS = ["lista", "leitura", "escrita", "flashcards", "calculadora", "formulas", "simulacao", "tabela_periodica", "diagrama", "timeline", "mapa_mental", "dialogo"];
export const LEARNING_PHASES = ["diagnostico", "modelagem", "pratica_guiada", "pratica_autonoma", "transferencia"];
export const PROMPT_VERSION = "copiloto-pedagogico-2026-10-04-visuais";
const categories = ["atividade", "avaliacao", "diagnostica", "recuperacao"];
const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const comparable = (value: string) => value.normalize("NFKC").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
const distinctAlternative = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();
const requiredText = (value: unknown, label: string, min: number, max: number) => {
  if (typeof value !== "string" || value.trim().length < min || value.length > max)
    throw new Error(`A proposta precisa de ${label} claro, dentro do limite permitido.`);
  return value.trim();
};
const curriculum = (value: unknown, allowed: Set<string>) => {
  const ids = Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))] : [];
  if (ids.some((id) => !allowed.has(id)) && allowed.size)
    throw new Error("A proposta usa habilidades que não foram autorizadas para esta matéria.");
  const valid = ids.filter((id) => allowed.has(id));
  if (allowed.size && !valid.length) throw new Error("Uma questão não está vinculada às habilidades escolhidas.");
  return valid;
};
const finite = (value: unknown, min: number, max: number, label: string) => {
  if (value === null || value === "" || typeof value === "boolean" || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max)
    throw new Error(`A proposta retornou ${label} inválido.`);
  return Number(value);
};
const skillSchema = (allowed: Set<string>) => ({ type: "array", ...(allowed.size ? { minItems: 1, maxItems: 20 } : { maxItems: 0 }), items: allowed.size ? { type: "string", enum: [...allowed] } : { type: "string" } });
// Gemini supports a subset of JSON Schema. Length and uniqueness are checked by the server.
const stringSchema = (minLength: number, maxLength: number) => ({ type: "string", description: `Texto claro em português, entre ${minLength} e ${maxLength} caracteres.` });

function activitySchema(allowed: Set<string>, types: string[], quantity: number) {
  return {
    type: "object", additionalProperties: false,
    required: ["titulo", "orientacoes", "categoria", "duracao_minutos", "valor_total", "modo_pontuacao", "questoes"],
    properties: {
      titulo: stringSchema(3, 140), orientacoes: stringSchema(12, 6000),
      categoria: { type: "string", enum: categories }, duracao_minutos: { type: "integer", minimum: 5, maximum: 300 },
      valor_total: { type: "number", minimum: 0.1, maximum: 1000 }, modo_pontuacao: { type: "string", enum: ["igual", "manual"] },
      questoes: { type: "array", minItems: 1, maxItems: quantity, items: {
        type: "object", additionalProperties: false,
        required: ["tipo", "enunciado", "alternativas", "resposta", "explicacao", "pontos", "habilidade_ids", "obrigatoria"],
        properties: {
          tipo: { type: "string", enum: types }, enunciado: stringSchema(12, 4000),
          alternativas: { type: "array", maxItems: 8, items: stringSchema(1, 500) },
          resposta: stringSchema(1, 4000), explicacao: stringSchema(10, 4000),
          pontos: { type: "number", minimum: 0.01, maximum: 1000 }, habilidade_ids: skillSchema(allowed), obrigatoria: { type: "boolean" },
          recursos: visualResourcesSchema(),
        },
      } },
    },
  };
}

export function teacherOutputSchema(action: string, allowed: Set<string>, types: string[], quantity: number) {
  const common = { resumo: stringSchema(10, 1200), avisos: { type: "array", maxItems: 8, items: stringSchema(1, 500) } };
  if (action === "gerar_ideias") return {
    type: "object", additionalProperties: false, required: ["resumo", "avisos", "ideias"],
    properties: { ...common, ideias: { type: "array", minItems: 3, maxItems: 6, items: {
      type: "object", additionalProperties: false,
      required: ["titulo", "objetivo", "gancho", "acao_aluno", "evidencia", "interacao_tipo", "duracao_minutos", "dificuldade", "materiais", "adaptacoes", "pedido_professor", "habilidade_ids"],
      properties: {
        titulo: stringSchema(3, 140), objetivo: stringSchema(15, 600), gancho: stringSchema(10, 600),
        acao_aluno: stringSchema(15, 1200), evidencia: stringSchema(10, 600), interacao_tipo: { type: "string", enum: TRAIL_INTERACTIONS },
        duracao_minutos: { type: "integer", minimum: 5, maximum: 300 }, dificuldade: { type: "string", enum: ["introducao", "equilibrada", "aprofundamento"] },
        materiais: { type: "array", maxItems: 6, items: stringSchema(1, 150) },
        adaptacoes: { type: "array", minItems: 1, maxItems: 3, items: stringSchema(10, 500) },
        pedido_professor: stringSchema(30, 2000), habilidade_ids: skillSchema(allowed),
      },
    } } },
  };
  if (action === "gerar_trilha") return {
    type: "object", additionalProperties: false, required: ["resumo", "avisos", "trilha"],
    properties: { ...common, trilha: {
      type: "object", additionalProperties: false, required: ["titulo", "descricao", "etapas"],
      properties: {
        titulo: stringSchema(3, 140), descricao: stringSchema(15, 2000),
        etapas: { type: "array", minItems: 2, maxItems: Math.min(12, quantity), items: {
          type: "object", additionalProperties: false, required: ["titulo", "objetivo", "interacao_tipo", "fase", "ponte", "atividade"],
          properties: { titulo: stringSchema(3, 140), objetivo: stringSchema(15, 600),
            interacao_tipo: { type: "string", enum: TRAIL_INTERACTIONS }, fase: { type: "string", enum: LEARNING_PHASES },
            ponte: stringSchema(10, 600), atividade: activitySchema(allowed, types, quantity) },
        } },
      },
    } },
  };
  const activity = activitySchema(allowed, types, quantity);
  activity.properties.questoes.minItems = quantity;
  return { type: "object", additionalProperties: false, required: ["resumo", "avisos", "atividade"], properties: { ...common, atividade: activity } };
}

export function classAnalysisOutputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["resumo", "dificuldades_recorrentes", "recuperacao"],
    properties: {
      resumo: stringSchema(10, 1200),
      dificuldades_recorrentes: { type: "array", minItems: 1, maxItems: 6, items: stringSchema(10, 500) },
      recuperacao: {
        type: "object",
        additionalProperties: false,
        required: ["objetivo", "etapas"],
        properties: {
          objetivo: stringSchema(15, 600),
          etapas: { type: "array", minItems: 2, maxItems: 5, items: stringSchema(10, 500) },
        },
      },
    },
  };
}

export function normalizeClassAnalysis(value: JsonObject, criticalSkills: JsonObject[]) {
  const summary = requiredText(value.resumo, "síntese da turma", 10, 1200);
  const difficulties = Array.isArray(value.dificuldades_recorrentes)
    ? value.dificuldades_recorrentes.map((item) => requiredText(item, "dificuldade recorrente", 10, 500)).slice(0, 6)
    : [];
  if (!difficulties.length) throw new Error("A análise precisa identificar ao menos uma dificuldade recorrente.");
  const recovery = object(value.recuperacao);
  const steps = Array.isArray(recovery.etapas)
    ? recovery.etapas.map((item) => requiredText(item, "etapa de recuperação", 10, 500)).slice(0, 5)
    : [];
  if (steps.length < 2) throw new Error("A sugestão de recuperação precisa conter ao menos duas etapas.");
  return {
    summary,
    criticalSkills: criticalSkills.slice(0, 12).map((skill) => ({
      id: text(skill.id, 80),
      code: text(skill.code, 80),
      description: text(skill.description, 500),
      performancePercent: finite(skill.performancePercent, 0, 100, "desempenho da habilidade"),
      evidenceCount: Math.max(0, Math.round(Number(skill.evidenceCount) || 0)),
      descriptors: (Array.isArray(skill.descriptors) ? skill.descriptors : []).slice(0, 8).map((descriptor) => ({
        code: text(object(descriptor).code, 80),
        description: text(object(descriptor).description, 500),
      })),
    })),
    recurringDifficulties: difficulties,
    recovery: {
      objective: requiredText(recovery.objetivo, "objetivo da recuperação", 15, 600),
      steps,
    },
  };
}

type ActivityFallback = { category: string; duration: number; totalValue: number; secureExam?: boolean };
export function normalizeActivity(value: unknown, allowed: Set<string>, fallback: ActivityFallback, types = QUESTION_TYPES, quantity = 12) {
  const raw = object(value);
  const secureExam = fallback.secureExam === true || fallback.category === 'avaliacao';
  const rawQuestions = Array.isArray(raw.questoes) ? raw.questoes : [];
  if (!rawQuestions.length || rawQuestions.length > quantity)
    throw new Error("A sugestão recebida não contém questões válidas ou excede a quantidade solicitada.");
  const questions = rawQuestions.map((value) => {
    const question = object(value);
    const type = String(question.tipo);
    if (!types.includes(type)) throw new Error("A IA retornou um formato que não foi autorizado no pedido.");
    const statement = requiredText(question.enunciado, "enunciado", 12, 4000);
    const alternatives = Array.isArray(question.alternativas) ? question.alternativas.map((item) => requiredText(item, "alternativas", 1, 500)) : [];
    let answer = requiredText(question.resposta, "gabarito ou critérios de correção", 1, 4000);
    const explanation = requiredText(question.explicacao, "feedback pedagógico", 10, 4000);
    if (["unica_escolha", "verdadeiro_falso"].includes(type)) {
      // Case may be the subject of a language or code question; preserve that distinction.
      if (alternatives.length < 2 || alternatives.length > 8 || new Set(alternatives.map(distinctAlternative)).size !== alternatives.length || !alternatives.includes(answer))
        throw new Error("A IA retornou alternativas ou gabarito inconsistentes. Peça uma nova versão.");
      if (type === "verdadeiro_falso" && (alternatives.length !== 2 || !["verdadeiro", "falso"].every((item) => alternatives.map(comparable).includes(item))))
        throw new Error("Uma questão de verdadeiro ou falso precisa das duas alternativas correspondentes.");
    } else if (alternatives.length) throw new Error("O formato solicitado não utiliza alternativas.");
    if (["numerica", "calculo"].includes(type)) {
      if (!/^[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[-+]?\d+)?$/i.test(answer) || !Number.isFinite(Number(answer.replace(",", "."))))
        throw new Error("A resposta numérica ou de cálculo precisa de um gabarito numérico claro, sem unidades.");
      // Classic authoring, publishing and grading use Number(answer); store one canonical finite number.
      answer = String(Number(answer.replace(",", ".")));
    }
    if (["dissertativa", "codigo", "estudo_caso"].includes(type) && (answer.length < 20 || !/crit[eé]rios?|rubrica|cr[eé]dito|pontua[cç][aã]o/i.test(answer)))
      throw new Error("Uma questão aberta precisa de resposta esperada e critérios observáveis para revisão humana.");
    if (comparable(explanation) === comparable(answer) || comparable(answer) === comparable(statement))
      throw new Error("O feedback precisa explicar a resposta, sem apenas repetir o gabarito ou o enunciado.");
    const resources = normalizeVisualResources(question.recursos);
    return { type, statement, alternatives, answer, explanation, points: finite(question.pontos, 0.01, 1000, "pontuação"), skillIds: curriculum(question.habilidade_ids, allowed), required: question.obrigatoria !== false, ...(resources.length ? { configuration: { resources } } : {}) };
  });
  if (new Set(questions.map((item) => comparable(item.statement))).size !== questions.length)
    throw new Error("A proposta repete a mesma questão; varie as evidências de aprendizagem.");
  const valueTotal = finite(raw.valor_total ?? fallback.totalValue, 0.1, 1000, "valor total");
  const scoringMode = raw.modo_pontuacao === "manual" ? "manual" : "igual";
  if (Math.abs(valueTotal * 100 - Math.round(valueTotal * 100)) > 0.000001)
    throw new Error("O valor de cada atividade precisa usar no máximo duas casas decimais.");
  if (scoringMode === "manual" && questions.some((question) => Math.abs(question.points * 100 - Math.round(question.points * 100)) > 0.000001))
    throw new Error("Os pontos manuais de cada questão precisam usar no máximo duas casas decimais.");
  if (scoringMode === "manual" && questions.reduce((sum, item) => sum + Math.round(item.points * 100), 0) !== Math.round(valueTotal * 100))
    throw new Error("A soma dos pontos sugeridos precisa corresponder ao valor da atividade.");
  return {
    title: requiredText(raw.titulo, "título", 3, 140), instructions: requiredText(raw.orientacoes, "orientações", 12, 6000),
    category: categories.includes(fallback.category) ? fallback.category : categories.includes(String(raw.categoria)) ? String(raw.categoria) : 'atividade',
    duration: Math.round(finite(raw.duracao_minutos ?? fallback.duration, 5, 300, "tempo de atividade")), value: valueTotal, scoringMode, questions,
    configuration: { secureExam: { enabled: secureExam }, learningSupport: { hints: !secureExam, workedExamples: !secureExam } },
    immediateFeedback: !secureExam, showAnswerKey: false,
  };
}

export function normalizeTeacherSuggestion(value: JsonObject, allowed: Set<string>, fallback: ActivityFallback, types = QUESTION_TYPES, quantity = 12, action = "gerar_atividade") {
  const summary = requiredText(value.resumo, "resumo", 10, 1200);
  const warnings = Array.isArray(value.avisos) ? value.avisos.map((item) => text(item, 500)).filter(Boolean).slice(0, 8) : [];
  if (action === "gerar_ideias") {
    const rawIdeas = Array.isArray(value.ideias) ? value.ideias : [];
    if (rawIdeas.length < 3 || rawIdeas.length > 6) throw new Error("O copiloto precisa entregar de três a seis ideias completas.");
    const ideas = rawIdeas.map((value, index) => {
      const idea = object(value);
      if (!TRAIL_INTERACTIONS.includes(String(idea.interacao_tipo))) throw new Error("A ideia utiliza uma interação não suportada.");
      const adaptations = Array.isArray(idea.adaptacoes) ? idea.adaptacoes.map((item) => requiredText(item, "adaptação de acesso ou desafio", 10, 500)) : [];
      if (adaptations.length < 1 || adaptations.length > 3) throw new Error("Cada ideia precisa de uma adaptação pedagógica viável.");
      const materials = Array.isArray(idea.materiais) ? idea.materiais.map((item) => requiredText(item, "materiais", 1, 150)) : [];
      if (materials.length > 6) throw new Error("A lista de materiais da ideia excede o limite.");
      if (!["introducao", "equilibrada", "aprofundamento"].includes(String(idea.dificuldade))) throw new Error("A ideia precisa indicar uma dificuldade válida.");
      return {
        id: `ideia-${index + 1}`, title: requiredText(idea.titulo, "título da ideia", 3, 140), objective: requiredText(idea.objetivo, "objetivo observável", 15, 600),
        hook: requiredText(idea.gancho, "situação inicial", 10, 600), studentAction: requiredText(idea.acao_aluno, "ação concreta do aluno", 15, 1200), evidence: requiredText(idea.evidencia, "evidência de aprendizagem", 10, 600),
        interaction: String(idea.interacao_tipo), duration: Math.round(finite(idea.duracao_minutos, 5, 300, "tempo da ideia")), difficulty: String(idea.dificuldade),
        materials, adaptations, teacherPrompt: requiredText(idea.pedido_professor, "pedido reutilizável pelo professor", 30, 2000), skillIds: curriculum(idea.habilidade_ids, allowed),
      };
    });
    if (new Set(ideas.map((idea) => comparable(idea.title))).size !== ideas.length || new Set(ideas.map((idea) => comparable(idea.studentAction))).size !== ideas.length)
      throw new Error("As ideias precisam apresentar desafios distintos, sem repetição de títulos ou ações.");
    return { summary, warnings, ideas };
  }
  if (action === "gerar_trilha") {
    const trail = object(value.trilha);
    const rawSteps = Array.isArray(trail.etapas) ? trail.etapas : [];
    if (rawSteps.length < 2 || rawSteps.length > 12) throw new Error("Uma trilha precisa de duas a doze etapas completas.");
    const steps = rawSteps.map((value, index) => {
      const step = object(value);
      if (!TRAIL_INTERACTIONS.includes(String(step.interacao_tipo)) || !LEARNING_PHASES.includes(String(step.fase)))
        throw new Error("Uma etapa da trilha utiliza interação ou fase pedagógica inválida.");
      return { order: index + 1, title: requiredText(step.titulo, "título da etapa", 3, 140), objective: requiredText(step.objetivo, "objetivo da etapa", 15, 600),
        interaction: String(step.interacao_tipo), phase: String(step.fase), bridge: requiredText(step.ponte, "conexão entre etapas", 10, 600),
        activity: normalizeActivity(step.atividade, allowed, fallback, types, quantity) };
    });
    const ranks = steps.map((step) => LEARNING_PHASES.indexOf(step.phase));
    if (ranks[0] > 1 || ranks.at(-1)! !== 4 || ranks.some((rank, index) => index > 0 && rank < ranks[index - 1]) || new Set(ranks).size < 2)
      throw new Error("A trilha precisa avançar do diagnóstico ou modelagem para uma tarefa de transferência.");
    const allQuestions = steps.flatMap((step) => step.activity.questions);
    if (allQuestions.length > 100 || allQuestions.length !== quantity)
      throw new Error("A trilha precisa distribuir a quantidade total de questões solicitada entre as etapas, até cem questões.");
    if (new Set(allQuestions.map((item) => comparable(item.statement))).size !== allQuestions.length)
      throw new Error("A trilha repete questões; use novos problemas para verificar a progressão.");
    if (new Set(steps.map((step) => comparable(step.objective))).size !== steps.length)
      throw new Error("Cada etapa precisa de um objetivo próprio e progressivo.");
    const totalDuration = steps.reduce((sum, step) => sum + step.activity.duration, 0);
    const totalValue = Math.round(steps.reduce((sum, step) => sum + step.activity.value, 0) * 100) / 100;
    if (totalDuration > Math.min(300, fallback.duration) || totalValue > 1000 || Math.round(totalValue * 100) !== Math.round(fallback.totalValue * 100))
      throw new Error("A trilha precisa respeitar o tempo total pedido e distribuir exatamente o valor total entre as etapas.");
    return { summary, warnings, activity: steps[0].activity, trail: { title: requiredText(trail.titulo, "título da trilha", 3, 140), description: requiredText(trail.descricao, "descrição da trilha", 15, 2000), steps, totalDuration, totalValue } };
  }
  const activity = normalizeActivity(value.atividade, allowed, fallback, types, quantity);
  if (activity.questions.length !== quantity) throw new Error("A atividade precisa conter a quantidade de questões solicitada.");
  return { summary, warnings, activity, trail: null };
}

type Cleaner = (value: unknown, max?: number) => string;
export function cleanCurrentActivity(value: unknown, clean: Cleaner, allowed = new Set<string>()) {
  const activity = object(value);
  return {
    title: clean(activity.title, 140), instructions: clean(activity.instructions, 6000), category: categories.includes(String(activity.category)) ? String(activity.category) : "atividade",
    duration: Math.min(300, Math.max(5, Number(activity.duration) || 50)), value: Math.min(1000, Math.max(0.1, Number(activity.value) || 10)), scoringMode: activity.scoringMode === "manual" ? "manual" : "igual",
    questions: (Array.isArray(activity.questions) ? activity.questions : []).slice(0, 12).map((value) => {
      const question = object(value);
      return { type: QUESTION_TYPES.includes(String(question.type)) ? String(question.type) : "resposta_curta", statement: clean(question.statement, 4000),
        alternatives: (Array.isArray(question.alternatives) ? question.alternatives : []).slice(0, 8).map((item) => clean(item, 500)),
        answer: clean(question.answer, 4000), explanation: clean(question.explanation, 4000), points: Math.min(1000, Math.max(0, Number(question.points) || 0)),
        skillIds: (Array.isArray(question.skillIds) ? question.skillIds : []).filter((id): id is string => typeof id === "string" && allowed.has(id)).slice(0, 20), required: question.required !== false,
        configuration: { resources: normalizeVisualResources(object(question.configuration).resources).map(resource => {
          const cleaned = JSON.parse(JSON.stringify(resource, (_key, value) => typeof value === 'string' ? clean(value, 1200) : value));
          return cleaned;
        }) } };
    }),
  };
}

export function cleanRefinementContext(body: JsonObject, clean: Cleaner, allowed: Set<string>) {
  const current = object(body.currentSuggestion);
  const trail = object(current.trail);
  const messages = (Array.isArray(body.messages) ? body.messages : []).filter((value) => ["user", "assistant"].includes(String(object(value).role))).slice(-8).map((value) => {
    const message = object(value);
    return { role: String(message.role), content: clean(message.content, 1200) };
  }).filter((message) => message.content);
  const suggestion = {
    summary: clean(current.summary, 1200),
    activity: current.activity ? cleanCurrentActivity(current.activity, clean, allowed) : null,
    ideas: (Array.isArray(current.ideas) ? current.ideas : []).slice(0, 6).map((value) => {
      const idea = object(value);
      return { title: clean(idea.title, 140), objective: clean(idea.objective, 600), studentAction: clean(idea.studentAction, 1200), evidence: clean(idea.evidence, 600), teacherPrompt: clean(idea.teacherPrompt, 2000) };
    }),
    trail: current.trail ? { title: clean(trail.title, 140), description: clean(trail.description, 2000), steps: (Array.isArray(trail.steps) ? trail.steps : []).slice(0, 12).map((value) => {
      const step = object(value);
      return { title: clean(step.title, 140), objective: clean(step.objective, 600), bridge: clean(step.bridge, 600), phase: clean(step.phase, 40), activity: cleanCurrentActivity(step.activity, clean, allowed) };
    }) } : null,
  };
  // Budget entire serialized context, including escaped text. Preserve the current draft before historical suggestions.
  const result: JsonObject = { currentActivity: body.currentActivity ? cleanCurrentActivity(body.currentActivity, clean, allowed) : null, messages, currentSuggestion: body.currentSuggestion ? suggestion : null };
  const size = () => JSON.stringify(result).length;
  if (size() > 48_000) result.currentSuggestion = null;
  while (size() > 48_000 && messages.length) messages.shift();
  const draft = result.currentActivity as ReturnType<typeof cleanCurrentActivity> | null;
  while (size() > 48_000 && draft?.questions.length) draft.questions.pop();
  return result;
}

type ProviderResult = { output: string; payload: JsonObject };
type RepairRequest = { feedback: string; previousOutput: string } | null;
export async function generateValidatedSuggestion<T>(
  request: (repair: RepairRequest, remainingMs: number) => Promise<ProviderResult>,
  normalize: (value: JsonObject) => T,
  budgetMs = 85_000,
  now = () => Date.now(),
) {
  const deadline = now() + budgetMs;
  const payloads: JsonObject[] = [];
  let repair: RepairRequest = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const remainingMs = deadline - now();
    if (remainingMs < 1000) {
      const error = new Error("A IA demorou mais que o esperado. Seu rascunho foi preservado; tente novamente.");
      error.name = "TimeoutError";
      throw error;
    }
    // Transport errors and quota failures escape immediately, without charging for another provider request.
    const result = await request(repair, Math.min(60_000, remainingMs));
    payloads.push(result.payload);
    try {
      if (!result.output || result.output.length > 160_000) throw new Error("A IA retornou uma proposta vazia ou extensa demais.");
      const parsed = JSON.parse(result.output);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("A IA não retornou uma proposta estruturada válida.");
      return { suggestion: normalize(parsed), payloads, repairCount: attempt };
    } catch (error) {
      const feedback = error instanceof SyntaxError ? "A proposta precisa ser um JSON completo que respeite o contrato de saída." : error instanceof Error ? error.message : "A proposta não passou pela verificação pedagógica.";
      if (attempt === 1 || deadline - now() < 1000) throw new Error(feedback);
      repair = { feedback, previousOutput: result.output.slice(0, 60_000) };
    }
  }
  throw new Error("A proposta não passou pela verificação pedagógica.");
}
