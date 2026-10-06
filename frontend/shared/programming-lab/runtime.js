import { RUNTIME_CONFIG, RUNTIME_INFO, validateRunRequest, normalizeProgramOutput } from './runtime-config.js';
import { programmingWorker, sandboxBridge } from './workers.js';
export { RUNTIME_INFO, normalizeProgramOutput };

export function createSandboxDocument(config = RUNTIME_CONFIG, nonce = 'lab-bootstrap') {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(nonce)) throw new Error('Identificador de inicialização inválido.');
  const allowed = [RUNTIME_CONFIG.pythonBase, RUNTIME_CONFIG.cppBase, RUNTIME_CONFIG.wasiBase].join(' ');
  const policy = `default-src 'none'; script-src 'nonce-${nonce}' blob: ${allowed} 'unsafe-eval'; connect-src ${allowed}; worker-src blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  const serialize = value => JSON.stringify(value).replace(/</g, '\\u003c');
  const source = `(${programmingWorker.toString()})(${serialize(config)});`;
  const bootstrap = `(${sandboxBridge.toString()})(${serialize(source)});`;
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}"><script nonce="${nonce}">${bootstrap}</script>`;
}

/** One disposable opaque-origin worker per run. No student's code on the host. */
export function createProgrammingRunner({ document: documentRef = globalThis.document } = {}) {
  let current, disposed = false;
  const cppCache = new Map();
  let cppAssetPromise, cppAssetController;
  const compilerAssets = () => {
    if (cppAssetPromise) return cppAssetPromise;
    cppAssetController = new AbortController();
    const controller = cppAssetController;
    const timer = setTimeout(() => controller.abort(), RUNTIME_CONFIG.loadTimeoutMs);
    const pending = Promise.all(['clang.wasm', 'lld.wasm', 'sysroot.tar'].map(async name => {
      const response = await fetch(RUNTIME_CONFIG.cppBase + name, { credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new Error('Não foi possível baixar o compilador C++. Confira a conexão e tente novamente.');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 80000000) throw new Error('O arquivo do compilador excedeu o tamanho previsto.');
      return bytes;
    })).finally(() => clearTimeout(timer));
    cppAssetPromise = pending;
    pending.catch(() => { if (cppAssetPromise === pending) cppAssetPromise = null; });
    return pending;
  };
  const stop = () => current?.finish({ status: 'cancelled', exitCode: null, error: 'Execução interrompida.' });
  const run = async options => {
    if (disposed) return { stdout: '', stderr: '', status: 'error', exitCode: 1, elapsedMs: 0, error: 'O laboratório foi fechado. Abra novamente para executar.' };
    let request;
    try { request = validateRunRequest(options); } catch (error) { return { stdout: '', stderr: '', status: 'error', exitCode: 1, elapsedMs: 0, error: error.message }; }
    if (request.language === 'cpp' && cppCache.has(request.code)) {
      request.compiledBytes = cppCache.get(request.code).bytes;
      request.compileDiagnostics = cppCache.get(request.code).diagnostics;
    }
    if (options.signal?.aborted) return { stdout: '', stderr: '', status: 'cancelled', exitCode: null, elapsedMs: 0, error: 'Execução interrompida.' };
    if (!documentRef || typeof Worker !== 'function' || typeof MessageChannel !== 'function' || typeof WebAssembly !== 'object') return { stdout: '', stderr: '', status: 'load_error', exitCode: 1, elapsedMs: 0, error: 'Este navegador não suporta o laboratório. Use uma versão recente do Chrome, Edge, Firefox ou Safari.' };
    stop();
    return new Promise(resolve => {
      const iframe = documentRef.createElement('iframe');
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.setAttribute('title', 'Execução isolada do laboratório');
      iframe.hidden = true;
      iframe.referrerPolicy = 'no-referrer';
      const nonce = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `lab${Date.now()}`;
      iframe.srcdoc = createSandboxDocument(RUNTIME_CONFIG, nonce);
      const channel = new MessageChannel();
      let timer, settled = false, stdout = '', stderr = '', runningAt;
      const startedAt = performance.now();
      const finish = result => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
        channel.port1.postMessage({ type: 'stop' });
        channel.port1.close(); channel.port2.close();
        iframe.remove();
        if (current?.finish === finish) current = null;
        resolve({ stdout, stderr, elapsedMs: performance.now() - (runningAt || startedAt), ...result });
      };
      const onAbort = () => finish({ status: 'cancelled', exitCode: null, error: 'Execução interrompida.' });
      const armTimeout = (ms, phase) => {
        clearTimeout(timer);
        timer = setTimeout(() => finish({ status: 'timeout', exitCode: null, error: phase === 'running' ? 'Tempo de execução esgotado. Confira se algum laço precisa de uma condição de parada.' : 'O ambiente demorou para carregar ou compilar. Confira a conexão e tente novamente.' }), ms);
      };
      current = { finish };
      options.signal?.addEventListener('abort', onAbort, { once: true });
      channel.port1.onmessage = event => {
        if (settled || !event.data || typeof event.data !== 'object') return;
        const data = event.data;
        if (data.type === 'ready') {
          if (request.language === 'cpp' && !request.compiledBytes) {
            try { options.onStatus?.({ phase: 'loading', message: 'Preparando o C++20. O primeiro uso baixa cerca de 95 MB; as próximas compilações reutilizam esses arquivos.' }); } catch { /* UI callback */ }
            compilerAssets().then(assets => {
              if (settled) return;
              channel.port1.postMessage({ type: 'run', request: { ...request, compilerAssets: assets } });
            }).catch(error => { if (!settled) finish({ status: 'load_error', exitCode: 1, error: error.name === 'AbortError' ? 'O download do compilador foi interrompido. Confira a conexão e tente novamente.' : error.message }); });
          } else channel.port1.postMessage({ type: 'run', request });
          return;
        }
        if (data.type === 'status') {
          if (!['loading', 'compiling', 'running'].includes(data.phase)) return;
          if (data.phase === 'running') { runningAt = performance.now(); armTimeout(request.timeoutMs, 'running'); }
          else armTimeout(data.phase === 'compiling' ? RUNTIME_CONFIG.compileTimeoutMs : RUNTIME_CONFIG.loadTimeoutMs, data.phase);
          try { options.onStatus?.({ phase: data.phase, message: String(data.message || '').slice(0, 500) }); } catch { /* A UI callback cannot break worker cleanup. */ }
        } else if (data.type === 'output' && Array.isArray(data.chunks)) {
          for (const chunk of data.chunks.slice(0, 1500)) {
            if (typeof chunk.text !== 'string') continue;
            const remaining = RUNTIME_CONFIG.maxOutputLength - stdout.length - stderr.length;
            if (chunk.stream === 'stdout') stdout += chunk.text.slice(0, Math.max(0, remaining));
            else if (chunk.stream === 'stderr') stderr += chunk.text.slice(0, Math.max(0, remaining));
          }
        } else if (data.type === 'compiled' && request.language === 'cpp' && data.bytes instanceof ArrayBuffer && data.bytes.byteLength <= RUNTIME_CONFIG.maxCachedBytecodeBytes) {
          cppCache.set(request.code, { bytes: data.bytes, diagnostics: String(data.diagnostics || '').slice(0, RUNTIME_CONFIG.maxOutputLength) });
          if (cppCache.size > 4) cppCache.delete(cppCache.keys().next().value);
        } else if (data.type === 'result') {
          const status = ['success', 'error', 'compile_error', 'runtime_error', 'load_error', 'timeout', 'cancelled'].includes(data.status) ? data.status : 'error';
          finish({ status, exitCode: Number.isInteger(data.exitCode) ? data.exitCode : null, stdout: String(data.stdout || stdout).slice(0, RUNTIME_CONFIG.maxOutputLength), stderr: String(data.stderr || stderr).slice(0, RUNTIME_CONFIG.maxOutputLength), elapsedMs: Number.isFinite(data.elapsedMs) ? Math.max(0, data.elapsedMs) : performance.now() - startedAt, ...(data.error ? { error: String(data.error).slice(0, 8000) } : {}), ...(Number.isFinite(data.compileMs) ? { compileMs: data.compileMs } : {}) });
        }
      };
      channel.port1.start();
      iframe.addEventListener('load', () => {
        if (!settled) iframe.contentWindow.postMessage('ominisaber-lab-connect', '*', [channel.port2]);
      }, { once: true });
      documentRef.body.append(iframe);
      armTimeout(RUNTIME_CONFIG.loadTimeoutMs, 'loading');
    });
  };
  return { run, stop, dispose() { stop(); cppCache.clear(); cppAssetController?.abort(); cppAssetPromise = null; disposed = true; } };
}
