import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDashboardSummary, dashboardDeadlineLabel, latestEvaluationAttempts } from '../frontend/professor/specialty/dashboard-data.js';

const now = new Date('2026-10-04T12:00:00-03:00');
const classes = [{ id: 'class-a', nome: '1º ano A', serie: '1' }, { id: 'class-b', nome: '1º ano B', serie: '1' }];
const evaluation = (id = 'activity-a', extra = {}) => ({ id, turma_id: 'class-a', titulo: 'Investigar argumentos', status: 'publicado', valor: 10, tentativas_avaliacao: [], ...extra });
const corrected = (aluno_id = 'student-a', extra = {}) => ({ tentativa_id: `attempt-${aluno_id}`, aluno_id, aluno_nome: 'Aluno de teste', numero_tentativa: 1, status: 'corrigida', requer_revisao: false, nota: 5, corrigida_em: '2026-10-02T13:00:00-03:00', enviada_em: '2026-10-02T12:00:00-03:00', ...extra });
const summarize = (extra = {}) => buildDashboardSummary({ classes, now, ...extra });
const withResults = (students, activity = evaluation(), extra = {}) => summarize({ evaluations: [activity], evaluationResults: [{ evaluation: activity, results: students }], ...extra });

test('estado vazio não fabrica dados de desempenho, apoio ou prazos', () => {
  const data = summarize();
  assert.equal(data.pending.total, 0);
  assert.deepEqual(data.support, []);
  assert.equal(data.assessedStudents, 0);
  assert.equal(data.chart.count, 0);
  assert.deepEqual(data.chart.series, []);
  assert.equal(data.nextDeadline, null);
  assert.equal(data.classes[0].activityCount, 0);
  assert.equal(Object.hasOwn(data.classes[0], 'studentCount'), false, 'o contrato não tem contagem de alunos por turma');
});

test('retentativa mais recente prevalece sem depender da ordem do RPC', () => {
  const old = corrected('student-a', { nota: 2, numero_tentativa: 1 });
  const recent = corrected('student-a', { nota: 9, numero_tentativa: 2, corrigida_em: '2026-10-03T13:00:00-03:00' });
  assert.deepEqual(latestEvaluationAttempts([recent, old]), [recent]);
  assert.deepEqual(latestEvaluationAttempts([old, recent]), [recent]);
  const data = withResults([recent, old]);
  assert.equal(data.assessedStudents, 1);
  assert.equal(data.chart.count, 1);
  assert.deepEqual(data.support, [], 'uma tentativa antiga não mantém o aluno no sinal de apoio após recuperação');
});

test('retentativa aberta impede que uma nota anterior seja tratada como resultado final dessa atividade', () => {
  const data = withResults([corrected(), corrected('student-a', { numero_tentativa: 2, status: 'em_andamento', nota: null, corrigida_em: null })]);
  assert.equal(data.assessedStudents, 0);
  assert.equal(data.chart.count, 0);
  assert.deepEqual(data.support, []);
});

test('notas ausentes, inválidas ou pendentes de revisão não produzem diagnóstico de apoio', () => {
  const invalid = [null, undefined, '', '   ', false, true, 'não avaliado', NaN, Infinity, -1, 11];
  for (const nota of invalid) {
    const data = withResults([corrected('student-a', { nota })]);
    assert.equal(data.assessedStudents, 0, `nota inválida: ${String(nota)}`);
    assert.equal(data.chart.count, 0);
  }
  for (const extra of [{ status: 'enviada' }, { requer_revisao: true }, { status: 'em_andamento' }]) {
    assert.equal(withResults([corrected('student-a', extra)]).assessedStudents, 0);
  }
});

test('zero corrigido é evidência válida e nota numérica em texto é aceita', () => {
  const data = withResults([corrected('student-a', { nota: 0 }), corrected('student-b', { nota: '8.5' })]);
  assert.equal(data.assessedStudents, 2);
  assert.equal(data.chart.count, 2);
  assert.deepEqual(data.support.map(item => item.aluno_id), ['student-a']);
  assert.equal(data.support[0].percentage, 0);
});

test('atividades sem valor positivo e rascunhos ficam fora de desempenho', () => {
  for (const extra of [{ valor: 0 }, { valor: -1 }, { valor: null }, { valor: 'texto' }, { status: 'rascunho' }]) {
    assert.equal(withResults([corrected()], evaluation('activity-a', extra)).assessedStudents, 0);
  }
});

test('datas ausentes, inválidas ou futuras não são evidência corrigida na data do painel', () => {
  for (const corrigida_em of [null, '', 'data inválida', '2026-10-05T13:00:00-03:00']) {
    const data = withResults([corrected('student-a', { corrigida_em })]);
    assert.equal(data.assessedStudents, 0, `data da correção: ${corrigida_em}`);
    assert.equal(data.chart.count, 0);
  }
});

test('aluno aparece uma vez no apoio e a correção mais recente entre atividades prevalece', () => {
  const older = evaluation('older'), newer = evaluation('newer', { valor: 20 });
  const data = summarize({ evaluations: [older, newer], evaluationResults: [
    { evaluation: older, results: [corrected('student-a', { nota: 1 }), corrected('student-b', { nota: 2 })] },
    { evaluation: newer, results: [corrected('student-a', { nota: 18, corrigida_em: '2026-10-03T13:00:00-03:00' }), corrected('student-b', { nota: 11, corrigida_em: '2026-10-03T13:00:00-03:00' })] },
  ] });
  assert.equal(data.assessedStudents, 2);
  assert.deepEqual(data.support.map(item => item.aluno_id), ['student-b']);
  assert.ok(Math.abs(data.support[0].percentage - 55) < 1e-9);
});

test('corte de apoio é abaixo de 60%, não inclui o limite e usa valor da atividade', () => {
  const activity = evaluation('activity-a', { valor: 20 });
  const data = withResults([corrected('student-a', { nota: 12 }), corrected('student-b', { nota: 11.8 })], activity);
  assert.deepEqual(data.support.map(item => item.aluno_id), ['student-b']);
  assert.ok(Math.abs(data.support[0].percentage - 59) < 1e-9);
});

test('média do gráfico compara percentuais e preserva lacunas sem amostra', () => {
  const data = withResults([corrected('student-a', { nota: 5 }), corrected('student-b', { nota: 10 })]);
  const points = data.chart.series[0].points;
  const measured = points.filter(point => point.count);
  assert.deepEqual(measured, [{ value: 75, count: 2 }]);
  assert.equal(points.filter(point => point.value === null && point.count === 0).length, 5);
});

test('resultados de turma não vinculada não contaminam contagens ou gráfico', () => {
  const foreign = evaluation('foreign', { turma_id: 'foreign-class', tentativas_avaliacao: [{ status: 'enviada' }], encerra_em: '2026-10-05T13:00:00-03:00' });
  const data = withResults([corrected()], foreign, { labs: [{ turma_id: 'foreign-class', entregas_laboratorio: [{ status: 'enviada' }] }] });
  assert.equal(data.pending.total, 0);
  assert.equal(data.assessedStudents, 0);
  assert.deepEqual(data.deadlines, []);
});

test('entregas pendentes mantêm a unidade de entrega entre atividades, laboratórios e redações', () => {
  const data = summarize({ evaluations: [evaluation('activity-a', { tentativas_avaliacao: [{ status: 'enviada' }, { status: 'corrigida' }, { status: 'em_andamento' }] })],
    labs: [{ turma_id: 'class-a', entregas_laboratorio: [{ status: 'enviada' }, { status: 'corrigida' }] }],
    essays: [{ status: 'enviada', perfis: { turma_id: 'class-a' } }, { status: 'corrigida', perfis: { turma_id: 'class-a' } }, { status: 'enviada', perfis: { turma_id: 'foreign-class' } }] });
  assert.deepEqual(data.pending, { evaluations: 1, labs: 1, essays: 1, total: 3 });
});

test('próxima entrega contém somente prazo futuro publicado para turma vinculada, em ordem', () => {
  const data = summarize({ evaluations: [
    evaluation('late', { encerra_em: '2026-10-04T10:00:00-03:00' }),
    evaluation('draft', { status: 'rascunho', encerra_em: '2026-10-05T13:00:00-03:00' }),
    evaluation('closed', { status: 'encerrado', encerra_em: '2026-10-05T13:00:00-03:00' }),
    evaluation('model', { turma_id: null, encerra_em: '2026-10-05T13:00:00-03:00' }),
    evaluation('invalid', { encerra_em: 'inválido' }),
    evaluation('later', { encerra_em: '2026-10-20T13:00:00-03:00' }),
  ], labs: [{ id: 'lab-next', status: 'publicado', turma_id: 'class-b', prazo: '2026-10-05T13:00:00-03:00' }] });
  assert.deepEqual(data.deadlines.map(item => item.id), ['lab-next', 'later']);
  assert.equal(data.nextDeadline.kind, 'lab');
  assert.deepEqual(data.dueSoon.map(item => item.id), ['lab-next']);
});

test('sinal de prazo considera dia de calendário e suporta datas inválidas', () => {
  assert.equal(dashboardDeadlineLabel('inválido', now), 'Sem prazo');
  assert.equal(dashboardDeadlineLabel(null, now), 'Sem prazo');
  assert.equal(dashboardDeadlineLabel('2026-10-03T12:00:00-03:00', now), 'Prazo encerrado');
  assert.equal(dashboardDeadlineLabel('2026-10-04T20:00:00-03:00', now), 'Hoje');
  assert.equal(dashboardDeadlineLabel('2026-10-05T12:00:00-03:00', now), 'Amanhã');
  assert.equal(dashboardDeadlineLabel('2026-10-09T12:00:00-03:00', now), 'Em 5 dias');
});

test('erro parcial preserva informação de indisponibilidade em vez de afirmar resultado saudável', () => {
  const data = summarize({ resultsUnavailable: true, essaysUnavailable: true, studentCount: 8 });
  assert.equal(data.resultsUnavailable, true);
  assert.equal(data.essaysUnavailable, true);
  assert.equal(data.studentCount, 8);
  assert.equal(data.assessedStudents, 0);
});

test('resumo conserva os registros de entrada', () => {
  const input = { classes, evaluations: [evaluation()], evaluationResults: [{ evaluation: evaluation(), results: [corrected()] }], now };
  const before = structuredClone(input);
  buildDashboardSummary(input);
  assert.deepEqual(input, before);
});
