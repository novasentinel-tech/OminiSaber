import { graphExpression, normalizeGraphSettings, visualFormula, visualText } from './visual-contract.ts';
type JsonObject = Record<string, unknown>;

export const STUDIO_TYPES = ["content", "choice", "number", "text", "ordering", "matching", "formula", "graph", "table"];
const RESPONSE_TYPES = ['choice', 'number', 'text', 'ordering', 'matching'];
const text = (value: unknown, max = 2500) => String(value ?? "").trim().slice(0, max);
const lines = (value: unknown) => text(value, 4000).split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};

export function studioOutputSchema(allowedSkillIds: Set<string>, quantity: number) {
  return {
    type: "object", additionalProperties: false, required: ["resumo", "avisos", "experiencia"],
    properties: {
      resumo: { type: "string" },
      avisos: { type: "array", items: { type: "string" }, maxItems: 8 },
      experiencia: {
        type: "object", additionalProperties: false, required: ["titulo", "objetivo", "blocos"],
        properties: {
          titulo: { type: "string" }, objetivo: { type: "string" },
          blocos: {
            type: "array", minItems: 2, maxItems: quantity + 4,
            items: {
              type: "object", additionalProperties: false,
              required: ["tipo", "titulo", "instrucoes", "pontos", "habilidade_ids", "feedback"],
              properties: {
                tipo: { type: "string", enum: STUDIO_TYPES },
                titulo: { type: "string" }, instrucoes: { type: "string" },
                pontos: { type: "number", minimum: 0, maximum: 1000 },
                habilidade_ids: { type: "array", maxItems: 20, items: allowedSkillIds.size ? { type: "string", enum: [...allowedSkillIds] } : { type: "string" }, ...(allowedSkillIds.size ? {} : { maxItems: 0 }) },
                feedback: { type: "string" },
                alternativas: { type: "array", minItems: 2, maxItems: 8, items: { type: "string" } },
                correta: { type: "integer", minimum: 0, maximum: 7 },
                minimo: { type: "number" }, maximo: { type: "number" },
                criterios: { type: "string" }, itens: { type: "string" },
                formula_apoio: { type: "string", description: "Exemplo independente e público, até 2000 caracteres; não incluir o gabarito do desafio." }, passos_exemplo: { type: "string", description: "Orientações de um exemplo independente e público, até 8000 caracteres." },
                expressao: { type: 'string', description: 'Fórmula matemática ou de uma a três funções separadas por linha; nenhuma instrução executável.' },
                plano_cartesiano: { type: 'object', additionalProperties: false, properties: { xMin: { type: 'number' }, xMax: { type: 'number' }, yMin: { type: 'number' }, yMax: { type: 'number' }, autoY: { type: 'boolean' }, showTable: { type: 'boolean' }, variables: { type: 'object', properties: Object.fromEntries(Array.from('abcdefghijklmnopqrstuvwxyz', key => [key, { type: 'number' }])) } } },
                colunas: { type: 'string', description: 'Cabeçalhos de duas a oito colunas separados por ponto e vírgula.' },
                linhas: { type: 'string', description: 'Duas a 24 linhas de dados, com células separadas por ponto e vírgula; somente texto e números.' },
              },
            },
          },
        },
      },
    },
  };
}

/** Treat the model's JSON as untrusted input; only executable, reviewed blocks survive. */
export function normalizeStudioSuggestion(value: JsonObject, allowedSkillIds: Set<string>, quantity = 12, options: { category?: string; secureExam?: boolean } = {}) {
  const secureExam = options.secureExam === true || options.category === 'avaliacao';
  const experience = object(value.experiencia);
  const raw = Array.isArray(experience.blocos) ? experience.blocos : [];
  if (!text(experience.titulo, 140) || !text(experience.objetivo, 2000) || raw.length < 2 || raw.length > quantity + 4) {
    throw new Error("A IA não retornou um percurso completo. Ajuste o pedido e tente novamente.");
  }
  const blocks = raw.map((item, index) => {
    const source = object(item);
    const type = text(source.tipo, 30);
    const title = text(source.titulo, 100);
    const instructions = text(source.instrucoes);
    if (!STUDIO_TYPES.includes(type) || !title || instructions.length < 3) throw new Error("A IA retornou uma etapa sem instruções válidas.");
    const skillIds = [...new Set((Array.isArray(source.habilidade_ids) ? source.habilidade_ids : []).map(String))].filter((id) => allowedSkillIds.has(id));
    if (RESPONSE_TYPES.includes(type) && allowedSkillIds.size && !skillIds.length) throw new Error("Uma etapa não está vinculada ao currículo escolhido. Gere uma nova proposta.");
    const points = Number(source.pontos);
    if (typeof source.pontos !== "number" || !Number.isFinite(points) || points < 0 || points > 1000) throw new Error("A IA retornou uma pontuação inválida.");
    if (text(source.feedback, 1200).length < 10) throw new Error("Cada etapa precisa de feedback pedagógico que ajude o aluno a avançar.");
    const block: JsonObject = {
      id: crypto.randomUUID(), type, title, instructions, points: RESPONSE_TYPES.includes(type) ? points : 0,
      skillIds, feedback: text(source.feedback, 1200), position: { x: index * 260, y: 180 },
    };
    if (source.formula_apoio != null) {
      if (typeof source.formula_apoio !== 'string' || source.formula_apoio.length > 2000) throw new Error('A fórmula de apoio retornada pela IA é inválida.');
      if (!secureExam) block.mathExpression = visualFormula(source.formula_apoio);
    }
    if (source.passos_exemplo != null) {
      if (typeof source.passos_exemplo !== 'string' || source.passos_exemplo.length > 8000) throw new Error('As orientações matemáticas retornadas pela IA são inválidas.');
      if (!secureExam) block.solutionSteps = text(source.passos_exemplo, 8000);
    }
    if (type === 'formula') block.expression = visualFormula(source.expressao);
    if (type === 'graph') {
      const expressions = visualText(source.expressao, 2000, true).split(/\r?\n/).map(expression => expression.trim()).filter(Boolean);
      if (expressions.length < 1 || expressions.length > 3) throw new Error('Use de uma a três funções no gráfico, uma por linha.');
      block.expression = expressions.map(graphExpression).join('\n');
      block.graphSettings = normalizeGraphSettings(source.plano_cartesiano);
    }
    if (type === 'table') {
      const columns = visualText(source.colunas, 1000, true).split(';').map(cell => cell.trim());
      const rows = visualText(source.linhas, 3000, true).split(/\r?\n/).map(row => row.split(';').map(cell => cell.trim()));
      if (columns.length < 2 || columns.length > 8 || columns.some(cell => !cell || cell.length > 100) || new Set(columns).size !== columns.length || rows.length < 2 || rows.length > 24 || rows.some(row => row.length !== columns.length || row.some(cell => !cell || cell.length > 200))) throw new Error('A tabela precisa de cabeçalhos únicos e linhas completas de dados.');
      block.columns = columns.join(';'); block.rows = rows.map(row => row.join(';')).join('\n');
    }
    if (type === "choice") {
      const options = Array.isArray(source.alternativas) ? source.alternativas.map((option) => text(option, 500)) : [];
      const correct = Number(source.correta);
      if (options.length < 2 || options.length > 8 || options.some((option) => !option) || new Set(options).size !== options.length || typeof source.correta !== "number" || !Number.isInteger(correct) || correct < 0 || correct >= options.length) throw new Error("A IA retornou alternativas ou gabarito inconsistentes.");
      Object.assign(block, { options, correct });
    }
    if (type === "number") {
      const min = Number(source.minimo), max = Number(source.maximo);
      if (typeof source.minimo !== "number" || typeof source.maximo !== "number" || !Number.isFinite(min) || !Number.isFinite(max) || min > max) throw new Error("A IA retornou um intervalo numérico inválido.");
      Object.assign(block, { min, max });
    }
    if (type === "text") {
      const rubric = text(source.criterios, 2000);
      if (rubric.length < 5) throw new Error("A resposta aberta precisa de critérios claros para sua revisão.");
      block.rubric = rubric;
    }
    if (type === "ordering" || type === "matching") {
      const items = lines(source.itens);
      if (items.length < 2 || items.length > 10 || new Set(items).size !== items.length) throw new Error("A IA retornou itens insuficientes ou repetidos para a interação.");
      if (type === "matching") {
        const pairs = items.map((item) => item.split("|").map((part) => part.trim()));
        if (pairs.some((pair) => pair.length !== 2 || pair.some((part) => !part)) || new Set(pairs.map((pair) => pair[0])).size !== pairs.length || new Set(pairs.map((pair) => pair[1])).size !== pairs.length) throw new Error("As associações precisam de pares únicos no formato termo | correspondente.");
      }
      block.items = items.join("\n");
    }
    return block;
  });
  const responses = blocks.filter((block) => RESPONSE_TYPES.includes(String(block.type)));
  if (blocks.length - responses.length > 4) throw new Error('Use até quatro etapas de contexto visual ou orientação.');
  if (responses.length !== quantity) throw new Error("O percurso precisa respeitar a quantidade de etapas de resposta solicitada.");
  return {
    summary: text(value.resumo, 1200),
    warnings: (Array.isArray(value.avisos) ? value.avisos : []).map((warning) => text(warning, 500)).filter(Boolean).slice(0, 8),
    studioExperience: {
      title: text(experience.titulo, 140), objective: text(experience.objetivo, 2000), blocks,
      start: blocks[0].id,
      edges: blocks.slice(1).map((block, index) => ({ id: crypto.randomUUID(), source: blocks[index].id, target: block.id })),
      assessment: { secureExam, immediateFeedback: false, showAnswerKey: false, hints: !secureExam, workedExamples: !secureExam },
    },
  };
}

export function cleanCurrentStudio(value: unknown, clean: (value: unknown, max?: number) => string) {
  const work = object(value);
  const blocks = Array.isArray(work.blocks) ? work.blocks : [];
  // Whitelist pedagogical fields. Student answers, URLs, names and arbitrary nested data are excluded.
  return {
    title: clean(work.title, 140), objective: clean(work.objective, 2000),
    blocks: blocks.slice(0, 30).map((item) => {
      const block = object(item);
      return {
        type: text(block.type, 30), title: clean(block.title, 100), instructions: clean(block.instructions, 2500),
        points: Number(block.points) || 0,
        options: (Array.isArray(block.options) ? block.options : []).slice(0, 8).map((option) => clean(option, 500)),
        correct: Number.isInteger(Number(block.correct)) ? Number(block.correct) : null,
        min: Number.isFinite(Number(block.min)) && block.min != null ? Number(block.min) : null,
        max: Number.isFinite(Number(block.max)) && block.max != null ? Number(block.max) : null,
        rubric: clean(block.rubric, 2000), items: clean(block.items, 4000), feedback: clean(block.feedback, 1200),
        expression: clean(block.expression, 1000), columns: clean(block.columns, 1000), rows: clean(block.rows, 3000),
        mathExpression: clean(block.mathExpression, 2000), solutionSteps: clean(block.solutionSteps, 8000),
        graphSettings: block.graphSettings === undefined ? {} : normalizeGraphSettings(block.graphSettings),
        summary: clean(block.summary, 2000), alt: clean(block.alt, 1000),
      };
    }),
  };
}
