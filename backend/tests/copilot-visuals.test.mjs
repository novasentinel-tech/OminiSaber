import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVisualResources, graphExpression, visualResourcesSchema } from '../supabase/functions/professor-copiloto/visual-contract.ts';
import { normalizeActivity, cleanCurrentActivity } from '../supabase/functions/professor-copiloto/pedagogical-contract.ts';
import { normalizeStudioSuggestion, studioOutputSchema } from '../supabase/functions/professor-copiloto/studio-contract.ts';
import { parseMathExpression } from '../../engine/src/core/math.js';

const allowed = new Set(['skill']);
const fallback = { category: 'atividade', duration: 20, totalValue: 1 };
const resources = [
  { type: 'formula', expression: '\\frac{3+5}{2}', caption: 'Operações agrupadas', alt: 'Fração com numerador três mais cinco e denominador dois.' },
  { type: 'graph', expressions: ['2x+1', 'x²'], settings: { xMin: -3, xMax: 3, yMin: -5, yMax: 10, autoY: false, variables: { a: 2 } }, caption: 'Compare as curvas', alt: 'Uma função linear e uma função quadrática no mesmo plano.' },
  { type: 'chart', chartType: 'bar', data: [{ label: 'Janeiro', value: 12 }, { label: 'Fevereiro', value: 18 }], caption: 'Registros mensais', alt: 'Doze registros em janeiro e dezoito em fevereiro.' },
  { type: 'figure', kind: 'triangle', values: [3, 4, 5], labels: ['A', 'B', 'C'], unit: 'cm', caption: 'Observe os lados', alt: 'Triângulo com lados de três, quatro e cinco centímetros.' },
];
const question = { tipo: 'numerica', enunciado: 'Compare os dados fornecidos e registre uma diferença.', alternativas: [], resposta: '6', explicacao: 'Compare os dois registros e determine a variação entre eles.', pontos: 1, habilidade_ids: ['skill'], obrigatoria: true, recursos: resources };
const activity = { titulo: 'Investigar os dados', orientacoes: 'Leia os recursos visuais, compare os dados e registre a conclusão.', categoria: 'atividade', duracao_minutos: 20, valor_total: 1, modo_pontuacao: 'manual', questoes: [question] };
const native = (type, extra = {}) => ({ tipo: type, titulo: 'Explorar dados', instrucoes: 'Observe os dados apresentados nesta etapa.', pontos: 0, habilidade_ids: [], feedback: 'Use as evidências para verificar sua conclusão.', ...extra });
const studio = blocks => ({ resumo: 'Um percurso com recursos visuais e resposta registrada.', avisos: [], experiencia: { titulo: 'Comparar evidências', objetivo: 'Comparar duas representações e justificar a conclusão.', blocos: blocks } });

test('recursos completos seguem o contrato público e persistem em configuration.resources', () => {
  const normalized = normalizeActivity(activity, allowed, fallback, ['numerica'], 1);
  assert.equal(normalized.questions[0].configuration.resources.length, 4);
  assert.deepEqual(normalized.questions[0].configuration.resources[2].data, resources[2].data);
  assert.equal(normalized.questions[0].configuration.resources[1].settings.showTable, true);
  assert.equal('answer' in normalized.questions[0].configuration, false);
  const refined = cleanCurrentActivity(normalized, value => String(value || ''), allowed);
  assert.equal(refined.questions[0].configuration.resources[3].kind, 'triangle');
});

test('rejeita dados ativos, campos de gabarito aninhados e estruturas não autorizadas', () => {
  const invalids = [
    { ...resources[0], url: 'https://example.com/image.png' },
    { ...resources[0], answer: '6' },
    { ...resources[0], solution: 'A solução completa' },
    { ...resources[0], expression: '\\href{javascript:alert(1)}{X}' },
    { ...resources[0], expression: 'eval(2)' },
    { ...resources[0], alt: '<svg onload=alert(1)></svg>' },
    { ...resources[2], data: [{ label: 'A', value: 1, answer: 6 }, { label: 'B', value: 2 }] },
    { ...resources[1], settings: { constructor: 1 } },
    { ...resources[1], settings: { variables: { prototype: 1 } } },
  ];
  for (const invalid of invalids) assert.throws(() => normalizeVisualResources([invalid]));
  assert.throws(() => normalizeVisualResources({ resources }));
  assert.throws(() => normalizeVisualResources([...resources, resources[0]]));
});

test('figuras, gráficos e dados têm limites e coerência verificáveis', () => {
  for (const invalid of [
    { ...resources[3], values: [1, 1, 5] },
    { ...resources[3], kind: 'circle', values: [0] },
    { ...resources[2], data: [{ label: 'A', value: Infinity }, { label: 'B', value: 2 }] },
    { ...resources[2], data: [{ label: 'A', value: 1 }, { label: 'A', value: 2 }] },
    { ...resources[1], expressions: ['x', 'x²', 'x³', 'x⁴'] },
    { ...resources[1], settings: { xMin: 2, xMax: 2 } },
    { ...resources[1], settings: { variables: { a: '2' } } },
  ]) assert.throws(() => normalizeVisualResources([invalid]));
});

test('funções validadas também são aceitas pelo parser seguro do plano cartesiano', () => {
  for (const expression of ['2x+1', 'ax²+bx+c', 'y = \\frac{x+1}{2}', 'sqrt(x)', '\\sin(x)', '1/(x-2)', '1,5x', 'x²', 'exp(-x)']) {
    assert.equal(graphExpression(expression), expression);
    assert.doesNotThrow(() => parseMathExpression(expression));
  }
  for (const expression of ['x+', '((x)', 'window.alert(1)', 'x=>x', 'Math.sin(x)', 'constructor()', 'x'.repeat(1201), 'x^'.repeat(100) + '2']) assert.throws(() => graphExpression(expression));
});

test('quadrinhos são dados locais, com até quatro painéis acessíveis e sem conteúdo ativo', () => {
  const comic = { type: 'comic', caption: 'Uma conversa sobre a evidência', alt: 'Duas pessoas apresentam hipóteses diferentes.', panels: [{ speaker: 'Pessoa A', text: 'Qual registro sustenta a ideia?' }, { speaker: 'Pessoa B', text: 'Vamos comparar os dois valores.' }] };
  assert.equal(normalizeVisualResources([comic])[0].panels.length, 2);
  assert.throws(() => normalizeVisualResources([{ ...comic, panels: [comic.panels[0]] }]));
  assert.throws(() => normalizeVisualResources([{ ...comic, panels: [{ speaker: 'Pessoa A', text: '<img src=x>' }, comic.panels[1]] }]));
});

test('modo seguro é determinado pelo contexto docente e não pela categoria da resposta da IA', () => {
  const normalized = normalizeActivity({ ...activity, categoria: 'atividade', feedback_imediato: true, exibir_gabarito: true, secureExam: false }, allowed, { ...fallback, category: 'avaliacao' }, ['numerica'], 1);
  assert.equal(normalized.category, 'avaliacao');
  assert.equal(normalized.configuration.secureExam.enabled, true);
  assert.equal(normalized.configuration.learningSupport.hints, false);
  assert.equal(normalized.configuration.learningSupport.workedExamples, false);
  assert.equal(normalized.immediateFeedback, false);
  assert.equal(normalized.showAnswerKey, false);
  assert.equal(normalized.questions[0].answer, '6'); // Private teacher-side key is retained for server grading.
  assert.equal(normalized.questions[0].configuration.resources[0].type, 'formula'); // Public problem data remains.
});

test('Studio mantém fórmula, gráfico e tabela como apoios públicos com zero pontos', () => {
  const output = normalizeStudioSuggestion(studio([
    native('content'), native('formula', { expressao: '\\frac{x+1}{2}', pontos: 5 }),
    native('graph', { expressao: '2x+1\nx²', plano_cartesiano: { xMin: -3, xMax: 3 } }),
    native('table', { colunas: 'Mês;Valor', linhas: 'Janeiro;12\nFevereiro;18' }),
    native('number', { pontos: 1, habilidade_ids: ['skill'], minimo: 6, maximo: 6 }),
  ]), allowed, 1);
  assert.deepEqual(output.studioExperience.blocks.map(block => block.type), ['content', 'formula', 'graph', 'table', 'number']);
  assert.equal(output.studioExperience.blocks[1].points, 0);
  assert.equal(output.studioExperience.blocks[2].graphSettings.xMin, -3);
  assert.equal(output.studioExperience.blocks[3].columns, 'Mês;Valor');
  assert.equal(studioOutputSchema(allowed, 1).properties.experiencia.properties.blocos.maxItems, 5);
});

test('Studio de prova remove apoio resolvido mas preserva enunciado visual e chave docente privada', () => {
  const raw = studio([native('formula', { expressao: 'x²+2x+1' }), native('number', { pontos: 1, habilidade_ids: ['skill'], minimo: 6, maximo: 6, formula_apoio: '3+3', passos_exemplo: 'Some três e três para obter seis.' })]);
  const output = normalizeStudioSuggestion(raw, allowed, 1, { category: 'avaliacao' }).studioExperience;
  assert.equal(output.assessment.secureExam, true);
  assert.equal(output.assessment.hints, false);
  assert.equal(output.blocks[0].expression, 'x²+2x+1');
  assert.equal('solutionSteps' in output.blocks[1], false);
  assert.equal('mathExpression' in output.blocks[1], false);
  assert.equal(output.blocks[1].min, 6);
  assert.throws(() => normalizeStudioSuggestion(studio([native('table', { colunas: 'A;B', linhas: '1;2\n3' }), raw.experiencia.blocos[1]]), allowed, 1));
});

test('schema Gemini continua limitado, sem referências recursivas ou validação arbitrária', () => {
  const schema = JSON.stringify(visualResourcesSchema());
  assert.equal(/minLength|maxLength|uniqueItems|\$ref/.test(schema), false);
  assert.ok(schema.includes('comic'));
});
