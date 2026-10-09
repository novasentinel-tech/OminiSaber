// Versioned public language runtimes. Student source never goes to these CDNs.
export const RUNTIME_CONFIG = Object.freeze({
  pythonBase: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/',
  cppBase: 'https://cdn.jsdelivr.net/npm/browsercc@0.1.1/dist/',
  wasiBase: 'https://cdn.jsdelivr.net/npm/@bjorn3/browser_wasi_shim@0.4.2/dist/',
  maxCodeLength: 50000,
  maxInputLength: 12000,
  maxOutputLength: 32768,
  maxCachedBytecodeBytes: 8388608,
  maxMemoryBytes: 134217728,
  loadTimeoutMs: 120000,
  compileTimeoutMs: 90000,
  defaultTimeoutMs: 5000,
});

export const RUNTIME_INFO = Object.freeze({
  python: { name: 'Python 3.12', engine: 'CPython / Pyodide 0.27.7', firstDownload: 'Cerca de 15 MB no primeiro uso.', limitations: 'Biblioteca padrão de Python. Arquivos ficam somente na memória desta execução.' },
  cpp: { name: 'C++20', engine: 'Clang / WebAssembly', firstDownload: 'Cerca de 95 MB no primeiro uso; o navegador pode guardar o download.', limitations: 'Biblioteca padrão de C++. Sem exceções, threads, rede ou arquivos do computador.' },
});

export function validateRunRequest(request = {}) {
  const language = String(request.language || '').toLowerCase();
  if (!['python', 'cpp'].includes(language)) throw new Error('Escolha Python ou C++.');
  if (typeof request.code !== 'string' || !request.code.trim()) throw new Error('Escreva seu código antes de executar.');
  if (request.code.length > RUNTIME_CONFIG.maxCodeLength) throw new Error('O código ultrapassa o limite de 50 mil caracteres.');
  const stdin = request.stdin == null ? '' : String(request.stdin);
  if (stdin.length > RUNTIME_CONFIG.maxInputLength) throw new Error('A entrada ultrapassa o limite de 12 mil caracteres.');
  const timeout = Number(request.timeoutMs);
  const timeoutMs = Number.isFinite(timeout) ? Math.max(500, Math.min(15000, timeout)) : RUNTIME_CONFIG.defaultTimeoutMs;
  return { language, code: request.code, stdin, timeoutMs };
}

export function normalizeProgramOutput(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').split('\n').map(line => line.trimEnd()).join('\n').trim();
}
