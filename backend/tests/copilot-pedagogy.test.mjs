import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUESTION_TYPES, teacherOutputSchema, normalizeTeacherSuggestion, cleanRefinementContext, generateValidatedSuggestion, classAnalysisOutputSchema, normalizeClassAnalysis } from '../supabase/functions/professor-copiloto/pedagogical-contract.ts';

const skillId = '00000000-0000-4000-8000-000000000001';
const allowed = new Set([skillId]);
const fallback = { category: 'atividade', duration: 45, totalValue: 4 };
const question = (index, extra = {}) => ({ tipo: 'unica_escolha', enunciado: `Qual conclusão corresponde à evidência ${index}?`, alternativas: ['Aumentou', 'Diminuiu', 'Permaneceu'], resposta: 'Aumentou', explicacao: 'Compare os valores inicial e final; a diferença positiva indica aumento.', pontos: 1, habilidade_ids: [skillId], obrigatoria: true, ...extra });
const activity = (index, questions = [question(index)], extra = {}) => ({ titulo: `Investigar a situação ${index}`, orientacoes: 'Observe os dados, escolha uma conclusão e confira as evidências antes de responder.', categoria: 'atividade', duracao_minutos: 10, valor_total: questions.length, modo_pontuacao: 'manual', questoes: questions, ...extra });
const rawTrail = () => ({ resumo: 'Um percurso progressivo de comparação de evidências e aplicação em outro contexto.', avisos: [], trilha: { titulo: 'Da observação à decisão', descricao: 'Compare dados e aplique a análise em uma nova situação ao final.', etapas: [
  { titulo: 'Reconhecer evidências', objetivo: 'Identificar uma variação entre dois registros.', fase: 'diagnostico', ponte: 'Esta observação fornece os dados usados na comparação seguinte.', interacao_tipo: 'lista', atividade: activity(1) },
  { titulo: 'Justificar a comparação', objetivo: 'Comparar duas evidências e explicar qual sustenta a conclusão.', fase: 'pratica_guiada', ponte: 'Use a estratégia de comparação para decidir com menos apoio na próxima etapa.', interacao_tipo: 'escrita', atividade: activity(2, [question(2), question(3)]) },
  { titulo: 'Transferir a outro problema', objetivo: 'Aplicar a comparação a novos dados e justificar a decisão.', fase: 'transferencia', ponte: 'Retome o método anterior e ajuste a conclusão ao novo contexto.', interacao_tipo: 'dialogo', atividade: activity(4) },
] } });
const normalizeTrail = raw => normalizeTeacherSuggestion(raw, allowed, fallback, QUESTION_TYPES, 4, 'gerar_trilha');
const rawIdeas = () => ({ resumo: 'Três propostas práticas de comparação, investigação e decisão em aula.', avisos: [], ideias: [1, 2, 3].map(index => ({ titulo: `Investigação ${index}`, objetivo: `Comparar dados da situação ${index} e justificar uma decisão com evidências.`, gancho: `Há um conflito entre dois registros da situação ${index}.`, acao_aluno: `O aluno compara o conjunto ${index}, propõe uma hipótese e explica sua decisão.`, evidencia: 'Uma conclusão acompanhada de duas evidências comparadas.', interacao_tipo: ['lista', 'diagrama', 'dialogo'][index - 1], duracao_minutos: 15, dificuldade: 'equilibrada', materiais: ['Dados fornecidos no enunciado'], adaptacoes: ['Oferecer dados destacados e um modelo de comparação como apoio.'], pedido_professor: `Crie uma atividade interativa sobre a situação ${index}, com dados completos, comparação de evidências, gabarito e feedback.`, habilidade_ids: [skillId] })) });

test('trilha contém todas as atividades e respeita um orçamento total de questões, minutos e pontos', () => {
  const result = normalizeTrail(rawTrail());
  assert.equal(result.trail.steps.length, 3);
  assert.equal(result.trail.steps.flatMap(step => step.activity.questions).length, 4);
  assert.equal(result.trail.totalDuration, 30);
  assert.equal(result.trail.totalValue, 4);
  assert.equal(result.activity, result.trail.steps[0].activity);
  assert.deepEqual(result.trail.steps.map(step => step.order), [1, 2, 3]);
  assert.equal(result.trail.steps.at(-1).phase, 'transferencia');
  assert.equal(result.trail.steps[1].activity.questions[0].skillIds[0], skillId);
});

test('não aceita roteiro vazio, regressão de dificuldade, questões repetidas ou estouro de orçamento', () => {
  const invalids = [];
  const missing = rawTrail(); delete missing.trilha.etapas[1].atividade; invalids.push(missing);
  const regress = rawTrail(); regress.trilha.etapas[1].fase = 'modelagem'; regress.trilha.etapas[0].fase = 'pratica_autonoma'; invalids.push(regress);
  const noTransfer = rawTrail(); noTransfer.trilha.etapas[2].fase = 'pratica_autonoma'; invalids.push(noTransfer);
  const duplicate = rawTrail(); duplicate.trilha.etapas[2].atividade.questoes[0].enunciado = duplicate.trilha.etapas[0].atividade.questoes[0].enunciado; invalids.push(duplicate);
  const sameGoal = rawTrail(); sameGoal.trilha.etapas[1].objetivo = sameGoal.trilha.etapas[0].objetivo; invalids.push(sameGoal);
  const long = rawTrail(); long.trilha.etapas[0].atividade.duracao_minutos = 300; invalids.push(long);
  const excessive = rawTrail(); excessive.trilha.etapas[0].atividade.valor_total = 3; excessive.trilha.etapas[0].atividade.questoes[0].pontos = 3; invalids.push(excessive);
  const wrongQuantity = rawTrail(); wrongQuantity.trilha.etapas[1].atividade.questoes.pop(); wrongQuantity.trilha.etapas[1].atividade.valor_total = 1; invalids.push(wrongQuantity);
  for (const invalid of invalids) assert.throws(() => normalizeTrail(invalid));
});

test('pontuação em centavos preserva o valor total ao aplicar todas as etapas', () => {
  const valid = rawTrail();
  for (const [step, total, points] of [[0, 1.34, [1.34]], [1, 1.33, [0.66, 0.67]], [2, 1.33, [1.33]]]) {
    valid.trilha.etapas[step].atividade.valor_total = total;
    valid.trilha.etapas[step].atividade.questoes.forEach((question, index) => { question.pontos = points[index]; });
  }
  assert.equal(normalizeTrail(valid).trail.totalValue, 4);
  const fractional = rawTrail(); fractional.trilha.etapas[0].atividade.valor_total = 1.001; fractional.trilha.etapas[0].atividade.questoes[0].pontos = 1.001;
  assert.throws(() => normalizeTrail(fractional), /duas casas/);
  const partial = rawTrail(); partial.trilha.etapas[0].atividade.questoes[0].pontos = 1.001;
  assert.throws(() => normalizeTrail(partial), /duas casas/);
  const missingCent = rawTrail(); missingCent.trilha.etapas[1].atividade.questoes[0].pontos = 0.99;
  assert.throws(() => normalizeTrail(missingCent), /soma dos pontos/);
});

test('ideias úteis têm ação, evidência, adaptação e pedido reutilizável; descarta campos arbitrários', () => {
  const raw = rawIdeas(); raw.ideias[0].alunos = ['dado privado']; raw.ideias[0].url = 'javascript:alert(1)';
  const result = normalizeTeacherSuggestion(raw, allowed, fallback, QUESTION_TYPES, 4, 'gerar_ideias');
  assert.equal(result.ideas.length, 3);
  assert.equal(result.ideas[0].id, 'ideia-1');
  assert.equal(result.ideas[0].interaction, 'lista');
  assert.match(result.ideas[0].teacherPrompt, /atividade interativa/);
  assert.equal(JSON.stringify(result).includes('dado privado'), false);
  assert.equal(JSON.stringify(result).includes('javascript:'), false);
  const duplicate = rawIdeas(); duplicate.ideias[1].titulo = duplicate.ideias[0].titulo;
  assert.throws(() => normalizeTeacherSuggestion(duplicate, allowed, fallback, QUESTION_TYPES, 4, 'gerar_ideias'), /distintos/);
  const noAdaptation = rawIdeas(); noAdaptation.ideias[1].adaptacoes = [];
  assert.throws(() => normalizeTeacherSuggestion(noAdaptation, allowed, fallback, QUESTION_TYPES, 4, 'gerar_ideias'), /adaptação/);
});

test('questões exigem gabaritos válidos, feedback explicativo e critérios para revisão humana', () => {
  const normalize = (q, types = QUESTION_TYPES) => normalizeTeacherSuggestion({ resumo: 'Uma atividade para justificar uma conclusão.', avisos: [], atividade: activity(1, [q]) }, allowed, fallback, types, 1);
  for (const q of [question(1, { alternativas: ['A', ' A '], resposta: 'A' }), question(1, { resposta: 'Não existe' }), question(1, { explicacao: '' }), question(1, { pontos: NaN }), question(1, { habilidade_ids: ['outro-id'] }), question(1, { tipo: 'numerica', alternativas: [], resposta: '1e999' }), question(1, { tipo: 'dissertativa', alternativas: [], resposta: 'Compare os registros e diga que o primeiro aumentou.' })]) assert.throws(() => normalize(q));
  assert.deepEqual(normalize(question(1, { alternativas: ['Paulo', 'paulo'], resposta: 'Paulo' })).activity.questions[0].alternatives, ['Paulo', 'paulo']);
  for (const resposta of ['.5', '-0,5', '1e3']) assert.equal(Number(normalize(question(1, { tipo: 'numerica', alternativas: [], resposta })).activity.questions[0].answer), Number(resposta.replace(',', '.')));
  const calculation = normalize(question(1, { tipo: 'calculo', alternativas: [], resposta: '0,5', explicacao: 'Divida 1 por 2 para obter 0,5. Confira multiplicando 0,5 por 2: o resultado retorna 1.' }));
  assert.equal(calculation.activity.questions[0].answer, '0.5');
  assert.ok(Number.isFinite(Number(calculation.activity.questions[0].answer)));
  assert.match(calculation.activity.questions[0].explanation, /Divida/);
  assert.throws(() => normalize(question(1, { tipo: 'calculo', alternativas: [], resposta: 'Resultado esperado: 4. Critérios: aplicar a operação.' })), /numérico/);
  const open = normalize(question(1, { tipo: 'dissertativa', alternativas: [], resposta: 'Conclusão esperada: aumentou. Critérios: comparar valores (0,5 ponto) e justificar a conclusão (0,5 ponto).' }));
  assert.match(open.activity.questions[0].answer, /Critérios/);
  assert.throws(() => normalize(question(1), ['numerica']), /autorizado/);
});

test('schemas separados não obrigam gerar uma atividade quando o professor quer ideias', () => {
  const ideas = teacherOutputSchema('gerar_ideias', new Set(), QUESTION_TYPES, 4);
  assert.deepEqual(ideas.required, ['resumo', 'avisos', 'ideias']);
  assert.equal(ideas.properties.ideias.items.properties.habilidade_ids.maxItems, 0);
  const trail = teacherOutputSchema('gerar_trilha', allowed, QUESTION_TYPES, 4);
  assert.equal(trail.properties.trilha.properties.etapas.maxItems, 4);
  assert.equal(trail.properties.trilha.properties.etapas.items.properties.atividade.properties.questoes.maxItems, 4);
  assert.equal(teacherOutputSchema('gerar_atividade', allowed, ['numerica'], 3).properties.atividade.properties.questoes.minItems, 3);
  // Use only the documented Gemini schema subset; all deeper checks are in the application.
  assert.equal(/minLength|maxLength|uniqueItems|\$ref/.test(JSON.stringify(trail)), false);
});

test('análise da turma mantém métricas curriculares calculadas pelo servidor e valida recuperação', () => {
  const criticalSkills = [{ id: skillId, code: 'HAB-01', description: 'Comparar evidências.', performancePercent: 42, evidenceCount: 12, descriptors: [{ code: 'D-01', description: 'Identificar relações.' }] }];
  const schema = classAnalysisOutputSchema();
  assert.deepEqual(schema.required, ['resumo', 'dificuldades_recorrentes', 'recuperacao']);
  const result = normalizeClassAnalysis({ resumo: 'A turma precisa consolidar a comparação de evidências.', dificuldades_recorrentes: ['Distinguir dado observado de conclusão.'], recuperacao: { objetivo: 'Comparar dados antes de formular conclusões.', etapas: ['Modelar uma comparação curta com dados conhecidos.', 'Praticar em duplas com um novo conjunto de dados.'] }, habilidades_criticas: [{ id: 'inventado' }] }, criticalSkills);
  assert.deepEqual(result.criticalSkills, criticalSkills);
  assert.equal(JSON.stringify(result).includes('inventado'), false);
  assert.equal(result.recovery.steps.length, 2);
  for (const invalid of [
    { resumo: 'curto', dificuldades_recorrentes: [], recuperacao: {} },
    { resumo: 'Síntese suficientemente longa para validar.', dificuldades_recorrentes: [], recuperacao: { objetivo: 'Objetivo claro para a recuperação.', etapas: ['Primeira etapa de prática.', 'Segunda etapa de aplicação.'] } },
    { resumo: 'Síntese suficientemente longa para validar.', dificuldades_recorrentes: ['Dificuldade recorrente observável.'], recuperacao: { objetivo: 'Objetivo claro para a recuperação.', etapas: ['Curta', 'Segunda etapa de aplicação.'] } },
  ]) assert.throws(() => normalizeClassAnalysis(invalid, criticalSkills));
});

test('refinamento mantém somente oito mensagens e campos pedagógicos, com orçamento total', () => {
  const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max).replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[e-mail removido]');
  const draft = { title: 'Rascunho atual', instructions: 'Orientações para a turma', studentAnswers: 'privado', questions: [{ type: 'numerica', statement: 'Compare duas quantidades.', answer: '2', explanation: 'Faça a diferença.', skillIds: [skillId, 'não autorizado'], aluno_id: 'privado' }] };
  const context = cleanRefinementContext({ currentActivity: draft, currentSuggestion: { summary: 'Resumo', studentAnswers: 'privado', activity: draft }, messages: [{ role: 'system', content: 'não enviar' }, ...Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `Mensagem ${index} contato@exemplo.com`, aluno_id: 'privado' }))] }, clean, allowed);
  assert.equal(context.messages.length, 8);
  assert.match(context.messages[0].content, /Mensagem 4/);
  assert.equal(JSON.stringify(context).includes('privado'), false);
  assert.equal(JSON.stringify(context).includes('contato@'), false);
  assert.equal(JSON.stringify(context).includes('não enviar'), false);
  assert.deepEqual(context.currentActivity.questions[0].skillIds, [skillId]);
  const huge = structuredClone(draft); huge.questions = Array.from({ length: 12 }, () => ({ ...draft.questions[0], statement: '\\'.repeat(4000), answer: '\\'.repeat(4000), explanation: '\\'.repeat(4000) }));
  const bounded = cleanRefinementContext({ currentActivity: huge, currentSuggestion: { activity: huge }, messages: context.messages }, clean, allowed);
  assert.ok(JSON.stringify(bounded).length <= 48_000);
  assert.equal(bounded.currentSuggestion, null);
});

test('uma falha de validação recebe uma correção limitada, com nova validação completa', async () => {
  const calls = [];
  const generated = await generateValidatedSuggestion(async (repair, timeout) => {
    calls.push({ repair, timeout });
    return { output: calls.length === 1 ? JSON.stringify({ resumo: 'incompleto' }) : JSON.stringify(rawIdeas()), payload: { usage: { input_tokens: 10, output_tokens: 20 } } };
  }, value => normalizeTeacherSuggestion(value, allowed, fallback, QUESTION_TYPES, 4, 'gerar_ideias'));
  assert.equal(calls.length, 2);
  assert.equal(generated.repairCount, 1);
  assert.match(calls[1].repair.feedback, /três a seis/);
  assert.equal(generated.payloads.length, 2);
  assert.ok(calls.every(call => call.timeout <= 60_000));
  let failures = 0;
  await assert.rejects(generateValidatedSuggestion(async () => { failures++; return { output: '{}', payload: {} }; }, () => { throw new Error('Rubrica ausente'); }), /Rubrica ausente/);
  assert.equal(failures, 2);
});

test('erros de transporte e limite não acionam nova chamada ao provedor', async () => {
  let calls = 0;
  await assert.rejects(generateValidatedSuggestion(async () => { calls++; throw new Error('HTTP 429'); }, () => ({})), /HTTP 429/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(generateValidatedSuggestion(async () => { calls++; return { output: '{}', payload: {} }; }, () => ({}), 500), /demorou/);
  assert.equal(calls, 0);
});

