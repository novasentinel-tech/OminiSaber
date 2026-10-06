const clone = value => JSON.parse(JSON.stringify(value));
const string = (value, max, label, minimum = 0) => {
  const result = String(value ?? '').trim();
  if (result.length < minimum || result.length > max) throw new Error(`${label} precisa ter entre ${minimum} e ${max} caracteres. Revise a proposta antes de aplicar.`);
  return result;
};
const TYPES = new Set(['unica_escolha','multipla_escolha','verdadeiro_falso','numerica','calculo','resposta_curta','dissertativa','estudo_caso','associacao','ordenacao','codigo']);

export function hasCurriculumLink(questions = []) {
  return questions.some(question => Array.isArray(question.skillIds) && question.skillIds.length > 0);
}

function activity(value) {
  if (!value || typeof value !== 'object') throw new Error('Cada etapa do percurso precisa de uma atividade completa. Gere uma nova versão para preservar todas as etapas.');
  const title = string(value.title, 140, 'O título', 3);
  const instructions = string(value.instructions, 6000, 'As orientações', 3);
  const duration = Number(value.duration), total = Number(value.value);
  if (!Number.isInteger(duration) || duration < 5 || duration > 300) throw new Error('A duração de cada atividade precisa ficar entre 5 e 300 minutos.');
  if (!Number.isFinite(total) || total < .1 || total > 1000) throw new Error('O valor de cada atividade precisa ficar entre 0,1 e 1000.');
  if (Math.abs(total * 100 - Math.round(total * 100)) > 0.000001) throw new Error('O valor de cada atividade precisa usar no máximo duas casas decimais. Distribua os centavos entre as etapas antes de aplicar.');
  if (!Array.isArray(value.questions) || !value.questions.length || value.questions.length > 100) throw new Error('Cada atividade precisa de 1 a 100 questões.');
  const questions = clone(value.questions).map(question => {
    if (!TYPES.has(question.type) || string(question.statement, 8000, 'O enunciado', 3).length < 3) throw new Error('Uma questão usa um formato ou enunciado inválido.');
    const points = Number(question.points);
    if (!Number.isFinite(points) || points < .01 || points > 1000) throw new Error('Todas as questões precisam de pontos válidos.');
    if (value.scoringMode === 'manual' && Math.abs(points * 100 - Math.round(points * 100)) > 0.000001) throw new Error('A pontuação manual precisa usar no máximo duas casas decimais por questão.');
    const configuration = { ...(question.configuration || {}) };
    if (['numerica','calculo'].includes(question.type) && configuration.tolerance == null) configuration.tolerance = 0;
    return { ...question, points, skillIds: Array.isArray(question.skillIds) ? [...question.skillIds] : [], alternatives: Array.isArray(question.alternatives) ? [...question.alternatives] : [], configuration, answerConfiguration: { ...(question.answerConfiguration || {}) } };
  });
  if (value.scoringMode === 'manual' && questions.reduce((sum, question) => sum + Math.round(question.points * 100), 0) !== Math.round(total * 100)) throw new Error('A soma dos pontos da etapa precisa corresponder ao seu valor.');
  if (value.scoringMode !== 'manual') {
    const cents = Math.round(total * 100), base = Math.floor(cents / questions.length), extra = cents % questions.length;
    if (base < 1) throw new Error('O valor da atividade é pequeno demais para distribuir ao menos 0,01 ponto por questão.');
    questions.forEach((question, index) => { question.points = (base + Number(index < extra)) / 100; });
  }
  return { title, instructions, duration, value: total, scoringMode: value.scoringMode === 'manual' ? 'manual' : 'igual', category: ['atividade','avaliacao','diagnostica','recuperacao'].includes(value.category) ? value.category : 'atividade', secureExam: value.category === 'avaliacao' && value.secureExam === true, questions };
}

export function publicLearningStage(value) {
  if (!value || typeof value !== 'object') return null;
  const order = Number(value.order);
  if (!Number.isInteger(order) || order < 1 || order > 12 || typeof value.id !== 'string' || !value.id || value.id.length > 80) return null;
  return {
    id: value.id, order,
    title: String(value.title || '').slice(0, 140),
    objective: String(value.objective || '').slice(0, 600),
    instructions: String(value.instructions || '').slice(0, 6000),
    interaction: String(value.interaction || '').slice(0, 40),
    phase: String(value.phase || '').slice(0, 40),
    bridge: String(value.bridge || '').slice(0, 600),
  };
}

export function learningStages(questions = []) {
  const stages = new Map();
  for (const question of questions) {
    const stage = publicLearningStage(question.configuration?.learningStage || question.configuracao?.learningStage);
    if (stage && !stages.has(stage.id)) stages.set(stage.id, { ...stage, questionCount: 0 });
    if (stage) stages.get(stage.id).questionCount++;
  }
  return [...stages.values()].sort((left, right) => left.order - right.order);
}

export function learningTrailMetadata(questions, seed = {}) {
  const stages = learningStages(questions);
  if (!stages.length) return null;
  return { version: 1, kind: 'grouped_activity', title: String(seed.title || 'Percurso de aprendizagem').slice(0, 140), description: String(seed.description || '').slice(0, 2000), stages };
}

export function buildCopilotHandoff(suggestion, current = {}, { append = false, secureExam } = {}) {
  if (!suggestion || typeof suggestion !== 'object') throw new Error('Não há uma proposta válida para aplicar.');
  const trail = suggestion.trail;
  let stages = [];
  let incoming;
  if (trail) {
    if (!Array.isArray(trail.steps) || trail.steps.length < 2 || trail.steps.length > 12) throw new Error('O percurso precisa conter de 2 a 12 etapas completas.');
    const title = string(trail.title, 140, 'O título do percurso', 3);
    const description = string(trail.description, 2000, 'A descrição do percurso', 3);
    stages = trail.steps.map((step, index) => {
      const task = activity(step.activity);
      return { task, stage: { id: `stage-${index + 1}`, order: index + 1, title: string(step.title, 140, 'O título da etapa', 3), objective: string(step.objective, 600, 'O objetivo da etapa', 3), instructions: task.instructions, interaction: string(step.interaction || 'pratica', 40, 'A interação'), phase: string(step.phase || '', 40, 'A fase'), bridge: string(step.bridge || '', 600, 'A conexão da etapa') } };
    });
    incoming = {
      title, instructions: description, category: 'atividade', scoringMode: 'manual',
      duration: stages.reduce((sum, item) => sum + item.task.duration, 0),
      value: stages.reduce((sum, item) => sum + item.task.value, 0),
      questions: stages.flatMap(item => item.task.questions.map(question => ({ ...question, configuration: { ...question.configuration, learningStage: clone(item.stage) } }))),
      learningTrail: { title, description },
    };
  } else incoming = { ...activity(suggestion.activity), learningTrail: null };

  let result = incoming;
  if (append && Array.isArray(current.questions) && current.questions.length) {
    const existing = activity({ ...current, title: current.title || 'Rascunho atual', instructions: current.instructions || 'Continue o trabalho iniciado no rascunho.' });
    const priorStages = learningStages(existing.questions);
    if (incoming.learningTrail || priorStages.length) {
      if (!priorStages.length) {
        const initial = { id: 'stage-1', order: 1, title: existing.title, objective: 'Retome o trabalho que já estava preparado.', instructions: existing.instructions, interaction: 'pratica', bridge: '' };
        existing.questions.forEach(question => { question.configuration.learningStage = clone(initial); });
      }
      const previous = learningStages(existing.questions), offset = Math.max(...previous.map(item => item.order));
      const nextStageCount = incoming.learningTrail ? stages.length : 1;
      if (offset + nextStageCount > 12) throw new Error('O rascunho combinado ultrapassa 12 etapas. Mantenha os percursos separados ou revise a quantidade.');
      if (!incoming.learningTrail) {
        const added = { id: `stage-${offset + 1}`, order: offset + 1, title: incoming.title, objective: 'Aplique o que você construiu nas etapas anteriores.', instructions: incoming.instructions, interaction: 'pratica', bridge: 'Use as etapas anteriores como referência para esta proposta.' };
        incoming.questions.forEach(question => { question.configuration.learningStage = clone(added); });
      } else incoming.questions.forEach(question => {
        const source = question.configuration.learningStage;
        question.configuration.learningStage = { ...source, id: `stage-${source.order + offset}`, order: source.order + offset };
      });
      const totalStages = learningStages([...existing.questions, ...incoming.questions]);
      if (totalStages.length > 12 || totalStages.some(item => item.order > 12)) throw new Error('O rascunho combinado ultrapassa 12 etapas. Mantenha os percursos separados ou revise a quantidade.');
    }
    result = {
      ...existing, scoringMode: 'manual', duration: existing.duration + incoming.duration,
      value: existing.value + incoming.value, questions: [...existing.questions, ...incoming.questions],
      learningTrail: incoming.learningTrail || current.learningTrail || (priorStages.length ? { title: existing.title, description: existing.instructions } : null),
    };
  }
  if (result.questions.length > 100) throw new Error('O percurso completo ultrapassa 100 questões. Nenhuma etapa foi aplicada; revise a quantidade.');
  if (result.duration > 300) throw new Error(`O percurso completo soma ${result.duration} minutos, acima do limite de 300. Nenhuma etapa foi aplicada; ajuste as durações.`);
  if (result.value > 1000) throw new Error('O valor completo ultrapassa 1000 pontos. Nenhuma etapa foi aplicada; ajuste os valores.');
  result.value = Number(result.value.toFixed(2));
  result.secureExam = result.category === 'avaliacao' && (typeof secureExam === 'boolean' ? secureExam : result.secureExam === true);
  result.learningTrail = learningTrailMetadata(result.questions, result.learningTrail || {});
  return result;
}

export function buildIdeaContext(idea) {
  if (!idea || typeof idea !== 'object') throw new Error('Escolha uma ideia para preparar o contexto.');
  return { title: string(idea.title, 140, 'O título da ideia', 3), instructions: string(idea.objective || idea.prompt || idea.description, 6000, 'A intenção da ideia', 3) };
}
