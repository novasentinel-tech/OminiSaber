import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { cleanCurrentStudio, normalizeStudioSuggestion, studioOutputSchema } from '../supabase/functions/professor-copiloto/studio-contract.ts';
import { QUESTION_TYPES, normalizeTeacherSuggestion } from '../supabase/functions/professor-copiloto/pedagogical-contract.ts';

const allowedId = '00000000-0000-4000-8000-000000000001';
const allowed = new Set([allowedId]);
const block = (tipo, extra = {}) => ({ tipo, titulo: 'Uma etapa', instrucoes: 'Observe e responda ao desafio.', pontos: tipo === 'content' ? 0 : 2, habilidade_ids: tipo === 'content' ? [] : [allowedId], feedback: 'Use as evidências para revisar.', ...extra });
const response = (...blocos) => ({ resumo: 'Uma investigação progressiva.', avisos: [], experiencia: { titulo: 'Investigar dados', objetivo: 'Comparar evidências e explicar uma conclusão.', blocos: [block('content'), ...blocos] } });

test('gera etapas executáveis com identificadores e percurso completos', () => {
  const normalized = normalizeStudioSuggestion(response(
    block('choice', { alternativas: ['Mais', 'Menos'], correta: 1 }),
    block('number', { minimo: 2, maximo: 2.5 }),
    block('ordering', { itens: 'Observar\nComparar\nConcluir' }),
    block('matching', { itens: 'Dado | Evidência\nConclusão | Interpretação' }),
    block('text', { criterios: 'Argumentar usando dados e reconhecer os limites.' }),
  ), allowed, 5);
  const work = normalized.studioExperience;
  assert.equal(work.blocks.length, 6);
  assert.equal(new Set(work.blocks.map(item => item.id)).size, 6);
  assert.equal(work.edges.length, 5);
  assert.equal(work.start, work.blocks[0].id);
  work.edges.forEach((edge, index) => {
    assert.equal(edge.source, work.blocks[index].id);
    assert.equal(edge.target, work.blocks[index + 1].id);
  });
});

test('fórmulas e orientações de exemplo têm contrato público limitado e revisável', () => {
  const suggestion = normalizeStudioSuggestion(response(block('number', { minimo: 4, maximo: 4, formula_apoio: '(2+4)/3', passos_exemplo: 'Calcule primeiro a soma.\nDepois divida.' })), allowed, 1);
  assert.equal(suggestion.studioExperience.blocks[1].mathExpression, '(2+4)/3');
  assert.match(suggestion.studioExperience.blocks[1].solutionSteps, /divida/);
  assert.throws(() => normalizeStudioSuggestion(response(block('number', { minimo: 4, maximo: 4, formula_apoio: 'x'.repeat(2001) })), allowed, 1));
  const cleaned = cleanCurrentStudio({ blocks: [{ mathExpression: '2x+1', solutionSteps: 'Observe os termos.', resposta: 'Privada' }] }, value => String(value || ''));
  assert.equal(cleaned.blocks[0].mathExpression, '2x+1');
  assert.equal('resposta' in cleaned.blocks[0], false);
});

test('rejeita gabaritos, intervalos, rubricas e associações inconsistentes', () => {
  for (const invalid of [
    block('choice', { alternativas: ['A', 'B'], correta: 2 }),
    block('choice', { alternativas: ['A', 'A'], correta: 0 }),
    block('choice', { alternativas: ['A', 'B'], correta: null }),
    block('number', { minimo: 3, maximo: 2 }),
    block('number', { minimo: '', maximo: 2 }),
    block('text', { criterios: '' }),
    block('ordering', { itens: 'Único' }),
    block('matching', { itens: 'A | X\nB | X' }),
    block('image', { url: 'javascript:alert(1)' }),
    block('text', { criterios: 'Uma rubrica adequada', habilidade_ids: ['não autorizado'] }),
  ]) assert.throws(() => normalizeStudioSuggestion(response(invalid), allowed, 1));
});

test('exige que os limites de quantidade sejam respeitados e não inventa currículo', () => {
  assert.throws(() => normalizeStudioSuggestion(response(block('text', { criterios: 'Critérios claros' }), block('text', { criterios: 'Critérios claros' })), allowed, 1));
  const withoutCurriculum = response(block('text', { criterios: 'Critérios claros', habilidade_ids: [allowedId] }));
  const normalized = normalizeStudioSuggestion(withoutCurriculum, new Set(), 1);
  assert.deepEqual(normalized.studioExperience.blocks[1].skillIds, []);
  assert.equal(studioOutputSchema(new Set(), 1).properties.experiencia.properties.blocos.items.properties.habilidade_ids.maxItems, 0);
});

test('a revisão envia apenas campos pedagógicos permitidos', () => {
  const cleaned = cleanCurrentStudio({ title: 'Meu trabalho', objective: 'Meu objetivo', aluno_id: 'privado', answers: { aluno: 'privado' }, blocks: [{ type: 'text', title: 'Análise', instructions: 'Explique', rubric: 'Argumentar', answers: 'não enviar', url: 'não enviar', feedback: 'Orientação' }] }, value => String(value ?? '').trim());
  assert.equal(JSON.stringify(cleaned).includes('privado'), false);
  assert.equal(JSON.stringify(cleaned).includes('não enviar'), false);
  assert.equal(cleaned.blocks[0].rubric, 'Argumentar');
});

// Evaluate the server's pure validation/context layer without starting Deno or making a remote call.
const edgePath = new URL('../supabase/functions/professor-copiloto/index.ts', import.meta.url);
const definitions = fs.readFileSync(edgePath, 'utf8').split('Deno.serve(')[0].replace(/^import[\s\S]*?;\s*/gm, '');
const sandbox = { crypto: globalThis.crypto, Set, Map, performance: globalThis.performance, QUESTION_TYPES, normalizeTeacherSuggestion };
vm.runInNewContext(`${stripTypeScriptTypes(definitions)}\nglobalThis.api = { normalizeSuggestion, buildTeacherContext };`, sandbox);

function mockDatabase(tables) {
  const queries = [];
  return {
    queries,
    from(table) {
      const query = { table, columns: '', filters: [] }; queries.push(query);
      const builder = {
        select(columns) { query.columns = columns; return builder; },
        eq(key, value) { query.filters.push([key, value]); return builder; },
        in(key, values) { query.filters.push([key, values]); return builder; },
        order() { return builder; }, limit() { return builder; },
        single() { return Promise.resolve({ data: tables[table], error: null }); },
        then(resolve, reject) { return Promise.resolve({ data: tables[table] || [], error: null }).then(resolve, reject); },
      };
      return builder;
    },
  };
}

test('o consentimento desativado impede todas as consultas analíticas', async () => {
  const db = mockDatabase({ turmas: { nome: '2ª série', serie: 2, ano_letivo: 2026 } });
  const context = await sandbox.api.buildTeacherContext(db, 'professor', 'turma', 'portugues', null, false);
  assert.deepEqual(db.queries.map(query => query.table), ['turmas']);
  assert.equal(context.summary.analysisAuthorized, false);
  assert.equal(context.summary.includesStudentPersonalData, false);
});

test('médias ignoram notas ainda não corrigidas e contexto do estúdio é agregado', async () => {
  const db = mockDatabase({
    turmas: { nome: 'Turma A', serie: 2, ano_letivo: 2026 },
    avaliacoes_docentes: [{ id: 'atividade', titulo: 'Prática', valor: 10, questoes_avaliacao: [] }],
    tentativas_avaliacao: [{ avaliacao_id: 'atividade', status: 'enviada', nota: null }, { avaliacao_id: 'atividade', status: 'corrigida', nota: 8 }, { avaliacao_id: 'atividade', status: 'enviada', nota: 0 }],
    studio_experiencia_turmas: [{ experiencia_id: 'studio', versao: 1 }],
    studio_experiencias: [{ id: 'studio', titulo: 'Analisar água', objetivo: 'Usar evidências' }],
    studio_experiencia_versoes: [{ experiencia_id: 'studio', versao: 1, snapshot: { title: 'Analisar água', objective: 'Usar evidências', blocks: [{ type: 'choice', points: 10, correct: 0, instructions: 'Gabarito privado' }] } }],
    studio_tentativas: [{ experiencia_id: 'studio', versao: 1, status: 'corrigida', pontuacao_automatica: 5, pontuacao_manual: 0, requer_revisao: false }],
  });
  const result = await sandbox.api.buildTeacherContext(db, 'professor', 'turma', 'portugues', null, true);
  assert.equal(result.context.aggregatePerformance.averagePercent, 80);
  assert.equal(result.context.studio.aggregatePerformance.averagePercent, 50);
  assert.equal(result.summary.recentStudioExperienceCount, 1);
  assert.equal(JSON.stringify(result.context).includes('Gabarito privado'), false);
  for (const query of db.queries.filter(item => ['tentativas_avaliacao', 'studio_tentativas'].includes(item.table))) assert.equal(/aluno_id|resposta|feedback/.test(query.columns), false);
});

test('questões legadas também validam gabarito e soma dos pontos', () => {
  const base = { resumo: 'Uma questão', avisos: [], atividade: { titulo: 'Atividade', orientacoes: 'Responda ao desafio.', categoria: 'atividade', valor_total: 2, modo_pontuacao: 'manual', questoes: [{ tipo: 'unica_escolha', enunciado: 'Qual é a alternativa?', alternativas: ['A', 'B'], resposta: 'A', explicacao: 'Porque é coerente.', pontos: 2, habilidade_ids: [] }] } };
  const normalize = value => sandbox.api.normalizeSuggestion(value, new Set(), { category: 'atividade', duration: 25, totalValue: 2 }, QUESTION_TYPES, 1);
  assert.equal(normalize(base).activity.questions[0].answer, 'A');
  const invalidAnswer = structuredClone(base); invalidAnswer.atividade.questoes[0].resposta = 'C';
  assert.throws(() => normalize(invalidAnswer), /gabarito/);
  const invalidScore = structuredClone(base); invalidScore.atividade.questoes[0].pontos = 1;
  assert.throws(() => normalize(invalidScore), /soma dos pontos/);
});
