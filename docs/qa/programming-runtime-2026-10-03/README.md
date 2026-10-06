# Validação do executor Python e C++ — 03/10/2026

O laboratório usa execução real no navegador: CPython 3.12/Pyodide e Clang C++20/WebAssembly. Código e entrada do estudante não são enviados a serviços remotos. Os arquivos públicos dos runtimes são baixados somente no primeiro uso necessário.

## Evidência

- `runtime-results.json`: 11 verificações reais no navegador. Entrada, funções, listas/dicionários/vector/string, erro Python com linha, erro Clang com linha, limite de saída, cancelamento e interrupção de laços em ambos os runtimes. O Python não acessou o DOM/armazenamento; a CSP bloqueou uma tentativa de conexão ao aplicativo.
- `cpp-track-results.json`: **88/88 casos**, com **24 programas C++** compilados e executados (12 soluções principais e 12 variações). Inclui zero, coleções vazias, limites exatos, negativos, repetidos, nomes com espaços e relatórios dos três mini projetos.
- `runtime-browser.jpg` e `cpp-track-browser.jpg`: registros dos resultados na interface de verificação.
- `node --test tests/programming-runtime.test.mjs`: **5/5 testes** para limites, comparação de saída, CSP, serialização, nonce, ambiente não disponível e proteção do host.

Os testes reais podem ser repetidos em `tests/programming-runtime-browser.html` e `tests/programming-tracks-browser.html` com um servidor estático local. A verificação de toda a trilha C++ leva alguns minutos porque cada solução diferente precisa de uma compilação real.

## Comportamento observado

Uma primeira compilação C++ com iostream/vector/string levou aproximadamente 12–14 segundos nesta máquina. As demais entradas da mesma fonte reutilizaram o bytecode e registraram `compileMs: 0`; a execução de um exemplo ficou em aproximadamente 13 ms. O cache contém até quatro programas, mantendo uma nova memória WASM para cada caso. Os binários públicos do compilador também são reutilizados em memória até o laboratório ser fechado.

Laços infinitos foram interrompidos pelo host perto de 500 ms nos testes configurados com esse limite. A saída foi limitada a 32.768 caracteres. Cancelamento devolveu `cancelled`. Erros de compilação e execução permaneceram distintos; nenhuma falha foi substituída por uma saída simulada.

## Limites explícitos

O alvo C++ WASI não fornece exceções, threads, rede ou arquivos do computador. O programa C++ tem limite WASM de 128 MB; Python e o compilador seguem os limites de memória do navegador. Os testes das trilhas são formativos e locais, sem lançamento de nota oficial. O primeiro carregamento requer internet (aproximadamente 15 MB Python / 95 MB C++).

O iframe usa origem opaca (`sandbox="allow-scripts"`, sem `allow-same-origin`), Worker descartável, CSP restrita aos diretórios fixos dos runtimes e um canal privado de comunicação. O host não executa o programa do estudante. O serviço de implantação ou banco remoto não participou destes testes.
