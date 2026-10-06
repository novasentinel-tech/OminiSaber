import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { LEARNING_TRACKS, getLesson, getTrack } from '../frontend/shared/programming-lab/learning-tracks.js';

const tracks = Object.values(LEARNING_TRACKS);
const normalize = value => value.replace(/\r\n/g, '\n').trimEnd();
const pythonProbe = spawnSync(process.env.PROGRAMMING_TEST_PYTHON || 'python', ['--version'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
const hasPython = !pythonProbe.error && pythonProbe.status === 0;
const python = (code, input) => spawnSync(process.env.PROGRAMMING_TEST_PYTHON || 'python', ['-I', '-X', 'utf8', '-c', code], {
  input, encoding: 'utf8', timeout: 3000, windowsHide: true,
});

test('trilhas têm projetos distribuídos, progressão completa e referências válidas', () => {
  assert.deepEqual(Object.keys(LEARNING_TRACKS).sort(), ['cpp', 'python']);
  for (const track of tracks) {
    assert.equal(track.lessons.length, 12, track.id);
    assert.equal(new Set(track.lessons.map(item => item.id)).size, 12);
    assert.deepEqual(track.lessons.filter(item => item.kind === 'project').map(item => item.order), [4, 8, 12]);
    assert.deepEqual(track.projects, track.lessons.filter(item => item.kind === 'project').map(item => item.id));
    assert.ok(track.estimatedMinutes >= 180);
    for (const [index, item] of track.lessons.entries()) {
      assert.equal(item.order, index + 1);
      assert.equal(getLesson(track.id, item.id), item);
      assert.equal(item.language, track.id);
      assert.ok(item.duration > 0);
      assert.equal(item.fileName.split('.').at(-1), track.extension);
      assert.deepEqual(item.checkpoints.map(checkpoint => checkpoint.type), ['prediction', 'code', 'transfer']);
    }
  }
  assert.equal(getTrack('ruby'), null);
  assert.equal(getLesson('python', 'nao-existe'), null);
});

test('cada missão ensina, solicita execução e exige uma nova situação com dados próprios', () => {
  for (const track of tracks) for (const item of track.lessons) {
    const label = `${track.id}/${item.id}`;
    assert.ok(item.learn.length >= 3, label);
    assert.ok(item.concepts.length >= 3, label);
    assert.equal(item.hints.length, 3, label);
    assert.ok(new Set(item.hints).size === 3, label);
    for (const text of [...item.learn, ...item.hints, item.task, item.commonMistake, item.transfer.prompt]) {
      assert.ok(typeof text === 'string' && text.trim().length > 15, label);
    }
    assert.ok(item.starterCode.length > 10 && item.solutionCode.length > 10, label);
    assert.notEqual(item.starterCode, item.solutionCode, label);
    assert.notEqual(item.transfer.prompt, item.task, label);
    assert.ok(item.transfer.solutionCode && item.transfer.starterCode, label);
    assert.notEqual(item.transfer.starterCode, item.transfer.solutionCode, label);
    const prediction = item.prediction;
    assert.ok(prediction.code && prediction.explanation && prediction.prompt, label);
    assert.ok(prediction.choices.length >= 3, label);
    assert.ok(prediction.correctIndex >= 0 && prediction.correctIndex < prediction.choices.length, label);
    assert.equal(new Set(prediction.choices).size, prediction.choices.length, label);
    for (const activity of [item, item.transfer]) {
      assert.ok(activity.cases.length >= (item.order === 1 ? 1 : 2), label);
      assert.equal(new Set(activity.cases.map(scenario => scenario.input)).size, activity.cases.length, `${label}: cenários repetidos`);
      for (const scenario of activity.cases) {
        assert.ok(scenario.label.trim().length > 0, label);
        assert.equal(typeof scenario.input, 'string', label);
        assert.equal(typeof scenario.expectedOutput, 'string', label);
        assert.ok(scenario.expectedOutput.length > 0, label);
      }
    }
  }
});

test('soluções Python produzem de verdade todas as saídas do catálogo e das variações', { skip: !hasPython && 'Python local indisponível; validar pelo runtime de navegador' }, () => {
  for (const item of LEARNING_TRACKS.python.lessons) for (const [phase, activity] of [['missão', item], ['variação', item.transfer]]) {
    for (const scenario of activity.cases) {
      const result = python(activity.solutionCode, scenario.input);
      assert.equal(result.status, 0, `${item.id}/${phase}/${scenario.label}: ${result.stderr || result.error}`);
      assert.equal(normalize(result.stdout), normalize(scenario.expectedOutput), `${item.id}/${phase}/${scenario.label}`);
    }
  }
});

test('previsões Python são verificadas pela execução e rascunhos iniciais precisam ser modificados', { skip: !hasPython && 'Python local indisponível; validar pelo runtime de navegador' }, () => {
  for (const item of LEARNING_TRACKS.python.lessons) {
    const predicted = python(item.prediction.code, '');
    assert.equal(predicted.status, 0, `${item.id}: ${predicted.stderr}`);
    assert.equal(normalize(predicted.stdout), normalize(item.prediction.choices[item.prediction.correctIndex]), item.id);
    for (const [phase, activity] of [['missão', item], ['variação', item.transfer]]) {
      const alreadyComplete = activity.cases.every(scenario => {
        const result = python(activity.starterCode, scenario.input);
        return result.status === 0 && normalize(result.stdout) === normalize(scenario.expectedOutput);
      });
      assert.equal(alreadyComplete, false, `${item.id}/${phase}: rascunho já resolve todos os casos`);
    }
  }
});

test('projetos cobrem cenários vazios, igualdade de limites e dados repetidos', () => {
  for (const track of tracks) {
    const projects = track.lessons.filter(item => item.kind === 'project');
    assert.ok(projects.every(item => item.cases.length >= 4));
    const cantina = getLesson(track.id, 'cantina');
    assert.ok(cantina.cases.some(scenario => scenario.input === '0\n0\n250\n'));
    assert.ok(cantina.cases.some(scenario => scenario.input === '2\n2\n400\n'));
    const estufa = getLesson(track.id, 'estufa');
    assert.ok(estufa.cases.some(scenario => scenario.input === '0\n'));
    assert.ok(estufa.cases.some(scenario => scenario.input === '1\n30\n' && normalize(scenario.expectedOutput) === 'OK'));
    assert.ok(estufa.cases.some(scenario => scenario.input === '1\n31\n' && normalize(scenario.expectedOutput) === 'ALERTA 1'));
  }
});
