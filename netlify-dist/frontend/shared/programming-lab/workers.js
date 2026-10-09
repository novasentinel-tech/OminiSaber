/** This function is serialized into an opaque-origin Web Worker.
 * It has no access to the application, credentials, DOM, or browser storage.
 * Keep dependencies inside the function; only the fixed config is transferred.
 */
export function programmingWorker(config) {
  const send = self.postMessage.bind(self);
  const decoders = { stdout: new TextDecoder('utf-8'), stderr: new TextDecoder('utf-8') };
  const encoder = new TextEncoder();
  let stdout = '', stderr = '', pendingOutput = [], phase = 'loading';
  let outputSize = 0, pendingSize = 0, outputExceeded = false;
  const flush = () => {
    if (pendingOutput.length) send({ type: 'output', chunks: pendingOutput });
    pendingOutput = []; pendingSize = 0;
  };
  const append = (stream, value) => {
    const text = typeof value === 'string' ? value : decoders[stream].decode(value, { stream: true });
    const available = config.maxOutputLength - outputSize;
    const allowed = text.slice(0, Math.max(0, available));
    if (stream === 'stdout') stdout += allowed; else stderr += allowed;
    if (allowed) { pendingOutput.push({ stream, text: allowed }); pendingSize += allowed.length; }
    outputSize += text.length;
    if (pendingSize >= 1024) flush();
    if (outputSize > config.maxOutputLength) {
      outputExceeded = true;
      throw new Error('A saída excedeu 32 mil caracteres. Confira seus laços de repetição.');
    }
  };
  const status = (nextPhase, message) => { phase = nextPhase; send({ type: 'status', phase, message }); };
  const finish = (result) => {
    flush();
    send({ type: 'result', stdout, stderr, ...result });
  };
  const errorMessage = error => String(error?.message || error || 'Não foi possível executar o programa.').slice(-8000);

  async function python(request) {
    status('loading', 'Preparando o Python. O primeiro uso precisa baixar o interpretador.');
    const { loadPyodide } = await import(config.pythonBase + 'pyodide.mjs');
    const interpreter = await loadPyodide({ indexURL: config.pythonBase, stdout: () => {}, stderr: () => {} });
    const inputBytes = encoder.encode(request.stdin);
    let inputOffset = 0;
    interpreter.setStdin({ read(buffer) {
      const length = Math.min(buffer.length, inputBytes.length - inputOffset);
      if (length <= 0) return 0;
      buffer.set(inputBytes.subarray(inputOffset, inputOffset + length));
      inputOffset += length;
      return length;
    }, isatty: false });
    interpreter.setStdout({ write(buffer) { append('stdout', buffer); return buffer.length; }, isatty: false });
    interpreter.setStderr({ write(buffer) { append('stderr', buffer); return buffer.length; }, isatty: false });
    // A fresh interpreter and namespace are created for every run, including tests.
    const globals = interpreter.toPy({ __name__: '__main__' });
    status('running', 'Executando seu programa Python…');
    const start = performance.now();
    try {
      const result = await interpreter.runPythonAsync(request.code, { globals, filename: 'main.py' });
      if (result && typeof result.destroy === 'function') result.destroy();
      finish({ status: 'success', exitCode: 0, elapsedMs: performance.now() - start });
    } catch (error) {
      const message = outputExceeded ? 'A saída excedeu 32 mil caracteres. Confira seus laços de repetição.' : errorMessage(error);
      // SystemExit(0) is a successful Python program termination.
      const exitMatch = !outputExceeded && message.match(/SystemExit:\s*(-?\d+)\s*$/);
      if (exitMatch && Number(exitMatch[1]) === 0) finish({ status: 'success', exitCode: 0, elapsedMs: performance.now() - start });
      else finish({ status: 'runtime_error', exitCode: exitMatch ? Number(exitMatch[1]) : 1, error: message, elapsedMs: performance.now() - start });
    } finally { globals.destroy(); }
  }

  async function cpp(request) {
    status('loading', 'Preparando o C++20. O compilador precisa de cerca de 95 MB no primeiro uso.');
    const shim = await import(config.wasiBase + 'index.js');
    let program;
    let compileMs = 0;
    if (request.compiledBytes instanceof ArrayBuffer) {
      program = await WebAssembly.compile(request.compiledBytes);
      if (request.compileDiagnostics) append('stderr', request.compileDiagnostics);
    } else {
    const { Clang, LLD, setUpSysroot } = await import(config.cppBase + 'index.js');
    // Compiler assets are fixed public downloads; source is never submitted.
    const assets = request.compilerAssets || await Promise.all(['clang.wasm', 'lld.wasm', 'sysroot.tar'].map(async name => {
      const response = await fetch(config.cppBase + name, { credentials: 'omit' });
      if (!response.ok) throw new Error('Não foi possível baixar o compilador C++. Confira sua conexão e tente novamente.');
      return response.arrayBuffer();
    }));
    const [clangBinary, lldBinary, sysroot] = assets;
    const [clangModule, lldModule] = await Promise.all([WebAssembly.compile(clangBinary), WebAssembly.compile(lldBinary)]);
    const instantiate = module => (imports, receive) => {
      WebAssembly.instantiate(module, imports).then(instance => receive(instance, module));
      return {};
    };
    const flags = ['-std=c++20', '-O0', '-Wall', '-Wextra', '-fno-exceptions', '-ferror-limit=8', '-fdiagnostics-color=never', '-Wl,--max-memory=' + config.maxMemoryBytes];
    status('compiling', 'Compilando seu programa C++20…');
    const start = performance.now();
    let driverOutput = '', diagnostics = '';
    const collect = data => { diagnostics = (diagnostics + data + '\n').slice(0, config.maxOutputLength); };
    const driver = await Clang({ thisProgram: 'clang++', instantiateWasm: instantiate(clangModule), print: () => {}, printErr: data => { driverOutput = (driverOutput + data + '\n').slice(0, 50000); } });
    driver.FS.writeFile('main.cpp', request.code);
    driver.FS.mkdirTree('/lib/wasm32-wasi');
    driver.FS.mkdirTree('/include/c++/v1');
    driver.FS.writeFile('/lib/wasm32-wasi/crt1-command.o', new Uint8Array(0));
    driver.FS.writeFile('/lib/wasm32-wasi/crt1-reactor.o', new Uint8Array(0));
    if (driver.callMain(['main.cpp', ...flags, '-###']) !== 0) {
      append('stderr', driverOutput); finish({ status: 'compile_error', exitCode: 1, error: 'O compilador não conseguiu preparar o programa.', elapsedMs: performance.now() - start }); return;
    }
    const getInvocation = key => {
      const line = driverOutput.split('\n').find(line => line.includes(key));
      if (!line) throw new Error('Não foi possível preparar a compilação C++.');
      const args = [...line.matchAll(/"([^\"]*)"/g)].map(match => match[1]).slice(1);
      return { args, output: args[args.indexOf('-o') + 1] };
    };
    const invocation = getInvocation('-cc1');
    const linkerInvocation = getInvocation('wasm-ld');
    const compiler = await Clang({ thisProgram: 'clang++', instantiateWasm: instantiate(clangModule), print: () => {}, printErr: collect });
    compiler.FS.writeFile('main.cpp', request.code);
    setUpSysroot(compiler, sysroot);
    let exitCode = compiler.callMain(invocation.args);
    if (exitCode !== 0) {
      append('stderr', diagnostics); finish({ status: 'compile_error', exitCode, error: 'O C++ encontrou erros de compilação. Veja a linha indicada no console.', elapsedMs: performance.now() - start }); return;
    }
    const artifact = compiler.FS.readFile(invocation.output, { encoding: 'binary' });
    const linker = await LLD({ thisProgram: 'wasm-ld', instantiateWasm: instantiate(lldModule), print: () => {}, printErr: collect });
    linker.FS.writeFile(invocation.output, artifact);
    setUpSysroot(linker, sysroot);
    exitCode = linker.callMain(linkerInvocation.args);
    if (exitCode !== 0) {
      append('stderr', diagnostics); finish({ status: 'compile_error', exitCode, error: 'Não foi possível montar o programa. Exceções e threads não estão disponíveis neste laboratório.', elapsedMs: performance.now() - start }); return;
    }
    if (diagnostics.trim()) append('stderr', diagnostics);
    const bytes = linker.FS.readFile(linkerInvocation.output, { encoding: 'binary' });
    program = await WebAssembly.compile(bytes);
    compileMs = performance.now() - start;
    // Cache bytecode only, never an instance or a student's execution memory.
    if (bytes.length <= config.maxCachedBytecodeBytes) send({ type: 'compiled', bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), diagnostics });
    }
    const fds = [new shim.OpenFile(new shim.File(encoder.encode(request.stdin))), new shim.ConsoleStdout(data => append('stdout', data)), new shim.ConsoleStdout(data => append('stderr', data))];
    const wasi = new shim.WASI(['main'], [], fds);
    const instance = await WebAssembly.instantiate(program, { wasi_snapshot_preview1: wasi.wasiImport });
    // Only stdin/stdout/stderr are provided. No preopened directory or sockets.
    status('running', 'Executando seu programa C++…');
    const executionStart = performance.now();
    const exitCode = wasi.start(instance);
    finish({ status: exitCode === 0 ? 'success' : 'runtime_error', exitCode, elapsedMs: performance.now() - executionStart, compileMs, ...(exitCode !== 0 ? { error: 'O programa terminou com código ' + exitCode + '.' } : {}) });
  }

  self.onmessage = async event => {
    const request = event.data;
    if (!request || !['python', 'cpp'].includes(request.language) || typeof request.code !== 'string') return;
    // Accept exactly one execution per worker; the host destroys it afterwards.
    self.onmessage = null;
    try { if (request.language === 'python') await python(request); else await cpp(request); }
    catch (error) {
      finish({ status: phase === 'running' ? 'runtime_error' : phase === 'compiling' ? 'compile_error' : 'load_error', exitCode: 1, error: errorMessage(error), elapsedMs: 0 });
    }
  };
}

export function sandboxBridge(workerSource) {
  let port, worker;
  const notify = data => port?.postMessage(data);
  addEventListener('message', event => {
    if (port || event.source !== parent || event.data !== 'ominisaber-lab-connect' || !event.ports[0]) return;
    port = event.ports[0];
    port.onmessage = message => {
      if (message.data?.type === 'stop') { worker?.terminate(); worker = null; return; }
      if (worker || !message.data || message.data.type !== 'run') return;
      const blobUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
      try {
        worker = new Worker(blobUrl);
        worker.onmessage = event => {
          const data = event.data;
          if (data && ['status', 'output', 'result', 'compiled'].includes(data.type)) notify(data);
          if (data?.type === 'result') { worker?.terminate(); worker = null; }
        };
        worker.onerror = event => {
          notify({ type: 'result', status: 'load_error', exitCode: 1, stdout: '', stderr: '', error: 'Não foi possível carregar o ambiente. Confira a conexão e tente novamente. ' + (event.message || '') });
        };
        worker.postMessage(message.data.request);
      } catch (error) {
        notify({ type: 'result', status: 'load_error', exitCode: 1, stdout: '', stderr: '', error: String(error.message || error) });
      } finally { URL.revokeObjectURL(blobUrl); }
    };
    port.start();
    notify({ type: 'ready' });
  }, { once: false });
}
