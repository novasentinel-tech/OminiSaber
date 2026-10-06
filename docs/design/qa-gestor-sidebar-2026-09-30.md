# Design QA — sidebar do gestor e rota do OmniStudio

final result: passed

## Evidências

- Fonte visual 1: `C:/Users/CLEVER~1/AppData/Local/Temp/codex-clipboard-0bea57a0-b216-41f4-be21-e7cefa9a9ac3.png` (284 × 822 px), menu aberto sem rolagem disponível.
- Fonte visual 2: `C:/Users/CLEVER~1/AppData/Local/Temp/codex-clipboard-6fe9396b-7f6e-47a4-896b-96a64c10f7fa.png` (245 × 829 px), menu parcialmente visível após recolher.
- Fonte visual 3: `C:/Users/CLEVER~1/AppData/Local/Temp/codex-clipboard-674b13b3-7465-413f-bc38-e29e2032265d.png`, controle deslocado para dentro do menu e barra nativa visível.
- Implementação aberta: `docs/design/evidence/gestor-sidebar-scrollable.png` (1180 × 500 CSS px).
- Implementação recolhida: `docs/design/evidence/gestor-sidebar-collapsed.png` (1280 × 720 CSS px).
- OmniStudio carregado: `docs/design/evidence/oministudio-route.png`.
- Estado: gestor autenticado, dashboard real, menu aberto/recolhido; engine na etapa `#choose`.

As fontes e a captura final foram abertas em conjunto para comparação. A diferença de altura é intencional: a captura de 500 px força o cenário que exigia rolagem. Não foi aplicada normalização de densidade; a avaliação trata comportamento e ocupação de tela, não equivalência pixel a pixel.

## Superfícies verificadas

- Tipografia e conteúdo: identidade, títulos e rótulos existentes foram preservados.
- Espaçamento e layout: aberto, o menu ocupa 232 px; recolhido, termina fora do viewport e o conteúdo passa a iniciar em `0 px`.
- Cores: paleta institucional branca, azul e marinho preservada. O botão de reabrir continua visível.
- Imagens: a alteração não introduz ou substitui imagens. Ícones continuam na biblioteca Material Symbols já usada pelo projeto.
- Responsividade e acessibilidade: rolagem vertical independente com indicador nativo oculto; `overscroll-behavior`; controles com nomes acessíveis; breakpoint de comportamento alinhado a 900 px.

## Histórico dos achados

- [P1, corrigido] Menu recolhido mantinha uma faixa de 82 px com ícones. Correção: deslocamento integral para fora do viewport e margem principal zerada. Evidência final: borda direita do menu em `-11.6 px`, conteúdo em `0 px` e botão externo com opacidade `1`.
- [P1, corrigido] Menu maior que a altura da janela não rolava. Correção: `overflow-y: auto`, `overflow-x: hidden`, contenção de rolagem e scrollbar visualmente oculto. Teste em tablet: 800 px úteis, 839 px de conteúdo e `scrollTop` chegou a 39,2 px sem exibir a barra nativa.
- [P1, corrigido] O controle do menu ficou solto dentro do painel e acompanhava sua área rolável. Correção: o botão foi movido para fora do sidebar e ancorado com metade de sua largura sobre a borda externa. No desktop, sidebar em `232 px` e controle entre `214–250 px`; no tablet, sidebar em `300 px` e controle entre `281–319 px`.
- [P2, corrigido] CSS escondia o menu em até 900 px, mas o JavaScript só tratava mobile até 760 px. Correção: ambos usam 900 px.
- [P1, corrigido] A URL relativa do OmniStudio dependia da profundidade da página e o deploy não garantia build/publicação da engine. Correção: URL absoluta a partir da origem, configuração Netlify com publicação da raiz e build da engine, além de fallback `/oministudio`.

## Testes

- Recolher e reabrir o menu: aprovado.
- Menu com altura reduzida e conteúdo excedente: aprovado.
- Rota `/engine/dist/client/index.html?...#choose`: carregada e funcional.
- Botão de retorno do OmniStudio: URL correta para o painel docente.
- Console do gestor e do OmniStudio: nenhum erro capturado.
- Build Vite de produção: aprovado.
- Testes da engine: 5/5 aprovados.
- Testes do shell e da configuração Netlify: 4/4 aprovados.

Não há achados P0, P1 ou P2 pendentes. A URL pública da Netlify só poderá ser confirmada depois que estas alterações forem publicadas no site.
