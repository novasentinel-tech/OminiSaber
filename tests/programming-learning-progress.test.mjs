import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCase, freshDraft, invalidateStage, lessonComplete, mergeSavedDrafts, normalizeOutput, verifiedStage } from '../frontend/shared/programming-lab/learning-progress.js';
import { getLesson } from '../frontend/shared/programming-lab/learning-tracks.js';

test('comparison preserves significant content and indentation while normalizing console endings', () => {
  assert.equal(normalizeOutput('Olá  \r\n42\t\r\n\r\n'), 'Olá\n42');
  assert.notEqual(normalizeOutput(' 42\n'), normalizeOutput('42'));
  assert.notEqual(normalizeOutput('42\n\nx'), normalizeOutput('42\nx'));
  assert.notEqual(normalizeOutput('Olá'), normalizeOutput('Ola'));
});

test('expected stdout alone cannot pass a compile error, runtime error, timeout or cancellation', () => {
  const scenario = {label:'Resultado', input:'', expectedOutput:'42\n'};
  for (const status of ['compile_error','runtime_error','load_error','timeout','cancelled','error']) {
    assert.equal(assessCase({status, exitCode:0, stdout:'42\n'},scenario).passed,false);
  }
  assert.equal(assessCase({status:'success', exitCode:1, stdout:'42\n'},scenario).passed,false);
  assert.equal(assessCase({status:'success', exitCode:0, stdout:'42\r\n'},scenario).passed,true);
  assert.equal(assessCase({status:'success', exitCode:0, stdout:'43\n'},scenario).passed,false);
});

test('completion requires prediction, verified challenge and a separately verified transfer', () => {
  const draft = freshDraft(getLesson('python','mensagem'));
  assert.equal(lessonComplete(draft),false);
  draft.predictionVerified = true;
  draft.lessonVerifiedCode = draft.code;
  draft.lessonResults = [{passed:true}];
  assert.equal(verifiedStage(draft),true);
  assert.equal(lessonComplete(draft),false);
  draft.transferVerifiedCode = draft.transferCode;
  draft.transferResults = [{passed:true}];
  assert.equal(lessonComplete(draft),true);
  draft.transferResults.push({passed:false});
  assert.equal(lessonComplete(draft),false);
});

test('editing a verified source invalidates its evidence and preserves the other stage', () => {
  const draft = { code:'print(42)', transferCode:'print(43)', predictionVerified:true, lessonVerifiedCode:'print(42)', transferVerifiedCode:'print(43)', lessonResults:[{passed:true}], transferResults:[{passed:true}] };
  assert.equal(lessonComplete(draft),true);
  draft.code = 'print(0)';
  assert.equal(verifiedStage(draft),false);
  assert.equal(verifiedStage(draft,'transfer'),true);
  invalidateStage(draft,'lesson');
  assert.equal(draft.lessonResults,undefined);
  assert.equal(draft.lessonVerifiedCode,undefined);
  assert.equal(draft.transferVerifiedCode,'print(43)');
});

test('invalid or empty stored evidence never verifies and does not crash', () => {
  for (const results of [null,'passed',{},[],[{passed:false}], [null]]) {
    assert.equal(verifiedStage({code:'print(1)',lessonVerifiedCode:'print(1)',lessonResults:results}),false);
  }
  assert.equal(verifiedStage({code:42,lessonVerifiedCode:42,lessonResults:[{passed:true}]}),false);
});

test('saving one lesson preserves a different lesson edited in another tab', () => {
  const current = {code:'print("new edit")'};
  const memory = {'python:mensagem':current, 'cpp:entrada':{code:'old'}};
  const persisted = {'python:mensagem':{code:'old copy'}, 'cpp:entrada':{code:'new C++ edit'}, 'python:estufa':{code:'new project'}};
  const merged = mergeSavedDrafts(memory,persisted,'python:mensagem');
  assert.equal(merged['python:mensagem'],current);
  assert.equal(merged['cpp:entrada'].code,'new C++ edit');
  assert.equal(merged['python:estufa'].code,'new project');
  assert.equal(memory['cpp:entrada'].code,'old');
  assert.deepEqual(mergeSavedDrafts(memory,null,'python:mensagem'),memory);
});
