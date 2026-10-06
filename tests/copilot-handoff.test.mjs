import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCopilotHandoff, learningStages, learningTrailMetadata, publicLearningStage, buildIdeaContext, hasCurriculumLink } from '../frontend/professor/specialty/copilot-handoff.js';

const question = (statement, points = 1) => ({ type: 'unica_escolha', statement, alternatives: ['A', 'B'], answer: 'A', explanation: 'Compare as evidências para escolher a alternativa.', points, skillIds: ['skill-a'], required: true });
const activity = (title, count = 2, extra = {}) => ({ title, instructions: 'Observe os dados, registre sua decisão e explique o raciocínio.', category: 'atividade', duration: 10, value: 10, scoringMode: 'igual', questions: Array.from({ length: count }, (_, index) => question(`${title} · comando ${index + 1}`)), ...extra });
const suggestion = () => ({ activity: activity('Primeira proposta'), trail: { title: 'Investigar e aplicar', description: 'Comece pela observação e transfira o que aprendeu para uma situação nova.', steps: ['Observar', 'Praticar', 'Transferir'].map((title, index) => ({ order: index + 1, title, objective: `Desenvolver a habilidade de ${title.toLowerCase()} com evidências.`, interaction: 'lista', phase: ['diagnostico', 'pratica_guiada', 'transferencia'][index], bridge: index ? `Use a etapa ${index} para justificar o próximo passo.` : '', activity: activity(title, index + 1, { value: 6 + index }) })) } });

test('prova segura e recursos públicos chegam ao rascunho sem perder a revisão docente',()=>{
  const source=activity('Prova de função',1,{category:'avaliacao'});
  source.questions[0].configuration={resources:[{type:'formula',expression:'x^2'}]};
  const result=buildCopilotHandoff({activity:source},{},{secureExam:true});
  assert.equal(result.secureExam,true);assert.deepEqual(result.questions[0].configuration.resources,source.questions[0].configuration.resources);
  assert.equal(buildCopilotHandoff({activity:activity('Prática')},{},{secureExam:true}).secureExam,false);
});

test('aplica todas as atividades do percurso, conserva fases e distribui os pontos de cada etapa', () => {
  const source = suggestion(), before = structuredClone(source), result = buildCopilotHandoff(source);
  assert.equal(result.questions.length, 6);
  assert.equal(result.duration, 30);
  assert.equal(result.value, 21);
  assert.equal(result.scoringMode, 'manual');
  assert.deepEqual(learningStages(result.questions).map(stage => stage.questionCount), [1, 2, 3]);
  assert.deepEqual(learningStages(result.questions).map(stage => stage.phase), ['diagnostico', 'pratica_guiada', 'transferencia']);
  for (const [index, stage] of learningStages(result.questions).entries()) {
    const points = result.questions.filter(item => item.configuration.learningStage.id === stage.id).reduce((sum, item) => sum + item.points, 0);
    assert.ok(Math.abs(points - (6 + index)) < .00001);
  }
  assert.equal(result.learningTrail.kind, 'grouped_activity');
  assert.deepEqual(source, before, 'preparar o percurso não modifica a resposta original');
});

test('recusa etapas incompletas, excesso de etapas, duração e pontos sem cortar conteúdo', () => {
  const cases = [
    source => { delete source.trail.steps[1].activity; },
    source => { source.trail.steps[0].activity.duration = 300; },
    source => { source.trail.steps[0].activity.value = 1000; },
    source => { source.trail.steps = Array.from({ length: 13 }, () => structuredClone(source.trail.steps[0])); },
    source => { source.trail.steps = Array.from({ length: 12 }, (_, index) => ({ ...structuredClone(source.trail.steps[0]), title: 'Etapa ' + index, activity: activity('Atividade ' + index, 10) })); },
  ];
  for (const change of cases) {
    const source = suggestion(); change(source); const before = structuredClone(source);
    assert.throws(() => buildCopilotHandoff(source));
    assert.deepEqual(source, before);
  }
});

test('adicionar um percurso conserva o rascunho existente e torna sua atividade uma etapa anterior', () => {
  const current = activity('Rascunho já criado', 2, { value: 5 }), before = structuredClone(current);
  const result = buildCopilotHandoff(suggestion(), current, { append: true });
  assert.equal(result.title, current.title);
  assert.equal(result.questions.length, 8);
  assert.equal(result.duration, 40);
  assert.equal(result.value, 26);
  assert.deepEqual(learningStages(result.questions).map(stage => stage.order), [1, 2, 3, 4]);
  assert.equal(result.questions[0].statement, current.questions[0].statement);
  assert.deepEqual(current, before);
});

test('adicionar atividade normal a um percurso preserva os grupos anteriores', () => {
  const current = buildCopilotHandoff(suggestion());
  const result = buildCopilotHandoff({ activity: activity('Novo desafio', 1) }, current, { append: true });
  assert.equal(result.questions.length, 7);
  assert.deepEqual(learningStages(result.questions).map(stage => stage.order), [1, 2, 3, 4]);
  assert.equal(learningStages(result.questions).at(-1).title, 'Novo desafio');
});

test('append inválido não altera o rascunho anterior nem a proposta', () => {
  const current = activity('Rascunho atual', 1, { duration: 300 }), source = suggestion();
  const before = structuredClone([current, source]);
  assert.throws(() => buildCopilotHandoff(source, current, { append: true }), /300/);
  assert.deepEqual([current, source], before);
});

test('append além da etapa 12 é recusado antes de normalizar os metadados públicos', () => {
  const source = suggestion();
  source.trail.steps = Array.from({ length: 12 }, (_, index) => ({ ...structuredClone(source.trail.steps[0]), title: 'Etapa ' + (index + 1), activity: activity('Desafio ' + (index + 1), 1, { duration: 5, value: 1 }) }));
  const current = buildCopilotHandoff(source), added = { activity: activity('Mais um desafio', 1, { duration: 5, value: 1 }) };
  const before = structuredClone([current, added]);
  assert.throws(() => buildCopilotHandoff(added, current, { append: true }), /12 etapas/);
  assert.deepEqual([current, added], before);
});

test('metadados públicos contêm orientações e conexão, sem respostas ou rubricas privadas', () => {
  const source = { id: 'stage-1', order: 1, title: 'Observar', objective: 'Investigar uma ideia', instructions: 'Compare os exemplos.', bridge: 'Retome o que observou.', answer: 'GABARITO', questions: [{ answer: 'SEGREDO' }], rubric: 'RUBRICA' };
  const stage = publicLearningStage(source);
  assert.equal(stage.instructions, source.instructions);
  assert.equal(stage.bridge, source.bridge);
  assert.ok(!JSON.stringify(stage).includes('GABARITO'));
  assert.ok(!JSON.stringify(stage).includes('RUBRICA'));
  const metadata = learningTrailMetadata([{ configuration: { learningStage: source }, answer: 'RESPOSTA' }], { title: 'Percurso', description: 'Descrição', answer: 'OUTRA' });
  assert.ok(!JSON.stringify(metadata).includes('RESPOSTA'));
  assert.ok(!JSON.stringify(metadata).includes('OUTRA'));
});

test('equilíbrio de nota não perde centavos e resposta numérica ganha tolerância explícita', () => {
  const normal = activity('Calcular com dados', 3, { value: 10 });
  normal.questions[0] = { ...question('Qual resultado foi calculado?'), type: 'numerica', answer: '4', alternatives: [] };
  const result = buildCopilotHandoff({ activity: normal });
  assert.deepEqual(result.questions.map(item => item.points), [3.34, 3.33, 3.33]);
  assert.equal(result.questions[0].configuration.tolerance, 0);
});

test('orçamento fracionário não é arredondado silenciosamente nem perde pontos ao persistir', () => {
  const source = suggestion();
  source.trail.steps.forEach(step => { step.activity.value = 3.333; });
  const before = structuredClone(source);
  assert.throws(() => buildCopilotHandoff(source), /duas casas decimais/);
  assert.deepEqual(source, before);
  const manual = activity('Nota manual em centavos', 3, { value: 10, scoringMode: 'manual' });
  manual.questions.forEach(item => { item.points = 3.333; });
  assert.throws(() => buildCopilotHandoff({ activity: manual }), /duas casas decimais/);
});

test('ideia prepara somente contexto, sem inventar questões ou respostas', () => {
  const result = buildIdeaContext({ title: 'Investigar consumo', objective: 'Compare o consumo de água em duas situações.' });
  assert.deepEqual(Object.keys(result), ['title', 'instructions']);
  assert.throws(() => buildIdeaContext({ title: 'Ideia vazia' }));
});

test('publicação exige vínculo em uma questão, sem confundir metadados da etapa com currículo', () => {
  assert.equal(hasCurriculumLink([]), false);
  assert.equal(hasCurriculumLink([{ skillIds: [] }, { configuration: { learningStage: { skillIds: ['somente-metadado'] } } }]), false);
  assert.equal(hasCurriculumLink([{ skillIds: [] }, { skillIds: ['habilidade-vinculada'] }]), true);
});
