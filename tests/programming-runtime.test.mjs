import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RUNTIME_CONFIG, validateRunRequest, normalizeProgramOutput } from '../frontend/shared/programming-lab/runtime-config.js';
import { createSandboxDocument, createProgrammingRunner } from '../frontend/shared/programming-lab/runtime.js';

test('aceita código real somente dos dois runtimes e limita tempo/entrada', () => {
  assert.deepEqual(validateRunRequest({ language: 'PYTHON', code: 'print(1)', stdin: 2, timeoutMs: 1 }), { language: 'python', code: 'print(1)', stdin: '2', timeoutMs: 500 });
  assert.equal(validateRunRequest({ language: 'cpp', code: 'int main(){}', timeoutMs: 999999 }).timeoutMs, 15000);
  assert.throws(() => validateRunRequest({ language: 'javascript', code: 'alert(1)' }), /Python ou C\+\+/);
  assert.throws(() => validateRunRequest({ language: 'python', code: ' ' }), /Escreva/);
  assert.throws(() => validateRunRequest({ language: 'python', code: 'x'.repeat(50001) }), /50 mil/);
  assert.throws(() => validateRunRequest({ language: 'cpp', code: 'int main(){}', stdin: 'x'.repeat(12001) }), /12 mil/);
});

test('comparação tolera fins de linha e espaços finais mas preserva valores e linhas', () => {
  assert.equal(normalizeProgramOutput(' 42  \r\nResultado 5.0 \r\n'), '42\nResultado 5.0');
  assert.notEqual(normalizeProgramOutput('42\n5'), normalizeProgramOutput('42 5'));
  assert.notEqual(normalizeProgramOutput('42'), normalizeProgramOutput('43'));
});

test('documento isolado restringe origens e não deixa fórmulas de código fechar o script', () => {
  const source = createSandboxDocument(RUNTIME_CONFIG, 'test-nonce');
  assert.match(source, /default-src 'none'/);
  assert.match(source, /connect-src https:\/\/cdn\.jsdelivr\.net\/pyodide\/v0\.27\.7\/full\//);
  assert.match(source, /worker-src blob:/);
  assert.equal((source.match(/<script/g) || []).length, 1);
  assert.equal((source.match(/<\/script>/g) || []).length, 1);
  assert.doesNotMatch(source, /allow-same-origin/);
  assert.doesNotMatch(source, /unsafe-inline/);
  assert.throws(() => createSandboxDocument(RUNTIME_CONFIG, '"><script>'), /inválido/);
  const injected = createSandboxDocument({ ...RUNTIME_CONFIG, pythonBase: '</script><script>alert(1)</script>' }, 'test-nonce');
  // Even a developer-provided override cannot alter CSP or break out of a script.
  const script = injected.slice(injected.indexOf('<script nonce='));
  assert.equal((script.match(/<\/script>/g) || []).length, 1);
});

test('falha de ambiente é apresentada sem fingir execução e não abre iframe', async () => {
  const runner = createProgrammingRunner({ document: null });
  assert.equal((await runner.run({ language: 'python', code: 'print(1)' })).status, 'load_error');
  const controller = new AbortController(); controller.abort();
  assert.equal((await runner.run({ language: 'cpp', code: 'int main(){}', signal: controller.signal })).status, 'cancelled');
  runner.dispose();
  assert.equal((await runner.run({ language: 'python', code: 'print(1)' })).status, 'error');
});

test('host protege credenciais: sandbox sem mesma origem e nenhum eval ou executor remoto', async () => {
  const host = await readFile(new URL('../frontend/shared/programming-lab/runtime.js', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../frontend/shared/programming-lab/workers.js', import.meta.url), 'utf8');
  assert.match(host, /setAttribute\('sandbox', 'allow-scripts'\)/);
  assert.doesNotMatch(host, /\beval\s*\(|new Function\s*\(|\.runPython|\.start\(instance\)/);
  assert.doesNotMatch(worker, /supabase|access_token|sessionStorage|localStorage/);
  assert.match(worker, /new shim\.WASI\(\['main'\], \[\], fds\)/);
  assert.match(worker, /--max-memory=/);
  assert.match(worker, /self\.onmessage = null/);
});
