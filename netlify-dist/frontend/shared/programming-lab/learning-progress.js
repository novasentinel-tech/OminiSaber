/** Practice evidence is local and never becomes a school grade. */
export function normalizeOutput(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/[ \t]+$/g, '')).join('\n').replace(/\n+$/g, '');
}
/** Preserve other lessons saved by another tab while keeping this tab's edit. */
export function mergeSavedDrafts(memory, persisted, currentKey) {
  const stored = persisted && typeof persisted === 'object' && !Array.isArray(persisted) ? persisted : {};
  return { ...memory, ...stored, ...(memory[currentKey] ? { [currentKey]: memory[currentKey] } : {}) };
}
export function assessCase(result, testCase) {
  const actual = normalizeOutput(result.stdout), expected = normalizeOutput(testCase.expectedOutput);
  const passed = result.status === 'success' && result.exitCode === 0 && actual === expected;
  return { label: testCase.label, input: testCase.input, expected, actual, passed, error: result.error || result.stderr || '', status: result.status };
}
export function verifiedStage(draft, stage = 'lesson') {
  const prefix = stage === 'transfer' ? 'transfer' : 'lesson';
  const code = stage === 'transfer' ? draft.transferCode : draft.code;
  const results = draft[prefix + 'Results'];
  return Boolean(typeof code === 'string' && code.trim() && draft[prefix + 'VerifiedCode'] === code && Array.isArray(results) && results.length && results.every(result => result?.passed === true));
}
export function lessonComplete(draft) {
  return Boolean(draft.predictionVerified && verifiedStage(draft) && verifiedStage(draft, 'transfer'));
}
export function freshDraft(lesson) {
  return { code: lesson.starterCode, transferCode: lesson.transfer.starterCode, stdin: lesson.cases[0]?.input || '', transferStdin: lesson.transfer.cases[0]?.input || '', prediction: null, predictionVerified: false, hints: 0 };
}
export function invalidateStage(draft, stage) {
  const prefix = stage === 'transfer' ? 'transfer' : 'lesson';
  delete draft[prefix + 'VerifiedCode'];
  delete draft[prefix + 'Results'];
}
