# Execução do laboratório de programação

O navegador executa **CPython 3.12 via Pyodide 0.27.7** e compila **C++20 via Clang/WebAssembly**. Não há tradutor de sintaxe, pseudocódigo ou executor remoto. Somente arquivos públicos dos runtimes são baixados; código e entrada do estudante permanecem no navegador.

```js
import { createProgrammingRunner, normalizeProgramOutput } from './runtime.js';
const runner = createProgrammingRunner();
const result = await runner.run({
  language: 'python', // ou 'cpp'
  code: 'n = int(input())\nprint(n * 2)',
  stdin: '7\n',
  timeoutMs: 5000,
  onStatus: ({ phase, message }) => console.log(phase, message),
});
// result: { status, exitCode, stdout, stderr, elapsedMs, error?, compileMs? }
console.log(normalizeProgramOutput(result.stdout)); // '14'
runner.stop(); // interrompe a execução atual
runner.dispose(); // interrompe, limpa o cache e fecha o laboratório
```

`onStatus` comunica `loading`, `compiling` (C++) e `running`. Resultados usam `success`, `compile_error`, `runtime_error`, `load_error`, `timeout` ou `cancelled`; `error` indica dados inválidos ou uma instância já fechada. `signal` aceita um `AbortSignal`. Uma nova chamada interrompe a anterior.

Cada execução usa um iframe oculto com `sandbox="allow-scripts"`, **sem `allow-same-origin`**, e um Worker descartável criado dentro dessa origem opaca. O contexto não recebe o DOM, armazenamento, tokens ou dados da conta. Sua CSP permite apenas os diretórios públicos e versionados dos três runtimes. O programa C++ recebe somente os descritores de entrada, saída e erro; nenhum diretório, socket ou acesso ao computador é fornecido. O Python dispõe de arquivos virtuais que desaparecem com o Worker.

O host controla o tempo e descarta o contexto mesmo se o programa estiver preso em um laço. Código: 50 mil caracteres; entrada: 12 mil; saída conjunta: 32 mil; execução: 500 ms a 15 s (padrão 5 s); download: até 120 s; compilação: até 90 s. O programa C++ tem memória WASM limitada a 128 MB. Python e o compilador dependem dos limites de memória do navegador, sem promessa de uma quota geral. Exceções C++, threads, sockets e arquivos do computador não são suportados pelo alvo WASI deste laboratório.

O primeiro uso baixa aproximadamente 15 MB para Python ou 95 MB para C++. Cache HTTP pode evitar novos downloads. O runner mantém em memória os três arquivos binários públicos do compilador, evitando novos downloads a cada edição. Nenhum código do estudante é executado nesse cache ou no host; o compilador e o programa executam dentro do Worker isolado. Uma instância do runner guarda também até quatro programas C++ compilados, com no máximo 8 MB por programa, para executar a mesma solução com outras entradas. Guarda-se bytecode, sem memória ou variáveis do estudante; cada caso recebe uma nova instância WASM. Os caches são apagados por `dispose()` e não ficam em armazenamento persistente. Interromper um programa permite que o download público já iniciado termine para a próxima tentativa; fechar o laboratório cancela esse download.

As verificações são formativas e locais; não substituem uma avaliação protegida no servidor. O estudante pode consultar os próprios exemplos e casos. Nenhuma nota oficial é enviada por este módulo.

Fontes primárias: [Web Workers no Pyodide](https://pyodide.org/en/0.27.7/usage/webworker.html), [entrada e saída do Pyodide](https://pyodide.org/en/0.27.7/usage/streams.html), [browsercc](https://github.com/BertalanD/browsercc), [browser_wasi_shim](https://github.com/bjorn3/browser_wasi_shim).

Verificação local: `node --test tests/programming-runtime.test.mjs` e `tests/programming-runtime-browser.html` (programas reais, duas entradas C++ com cache, erros de sintaxe/compilação, limite de saída, isolamento e interrupção dos dois tipos de laço).
