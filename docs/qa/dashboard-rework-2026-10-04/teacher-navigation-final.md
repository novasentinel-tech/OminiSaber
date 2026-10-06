# Navegação docente e pacote de publicação — 4 de outubro de 2026

## Resultado

Home, atividades, laboratórios, redações, agenda e perfil usam o mesmo componente de navegação por especialidade. O menu fecha completamente no desktop, preserva a preferência e pode ser reaberto pelo cabeçalho. A navegação móvel usa um único drawer até 900 px, com X, Escape, backdrop, foco circular e restauração de foco. O controlador universal concorrente foi desativado nas páginas docentes que carregam Parties.

A barra de navegação das páginas de atividades fica separada do título. O resumo, os filtros e a lista de correções têm 24 px de distância no desktop e 20 px no celular. As abas usam seleção discreta, sem blocos azuis grandes, e as estatísticas não repetem ícones decorativos. As barras de rolagem nativas ficam ocultas apenas na área docente; a rolagem e o teclado continuam funcionando.

O cartão de turmas usa colunas com largura mínima zero, texto que pode quebrar linha e nenhum deslocamento horizontal no hover. O estilo do seletor compartilhado foi incluído na fonte do bundle, corrigindo campos duplicados após reconstruções.

## Evidências verificadas

- Navegador autenticado de Português: Home, perfil, agenda, criação de atividade, entrada e retorno do Copiloto e central de correções. Nenhuma avaliação foi salva ou publicada nesta rodada.
- Larguras 320, 390, 834 e 1280 px: largura do documento igual à janela e cartão de turmas sem transbordamento. No celular, o título da Home começa abaixo do cabeçalho, com margem lateral e espaço inferior para a navegação.
- Home móvel: abertura leva o foco ao X; Shift+Tab vai para Sair; Tab retorna ao X; Escape fecha e devolve o foco ao acionador; o fundo volta a aceitar interação. PageDown deslocou o documento mesmo com as barras ocultas.
- Desktop: X fecha completamente, a região principal começa em x=0 e o botão de reabertura permanece visível. A navegação mantém os mesmos destinos entre Home, perfil, agenda e atividades.
- Central de correções: distâncias medidas de 24 px entre resumo, filtros e estado vazio. Os seletores nativos ficam ocultos e o controle compartilhado aparece uma única vez.
- Copiloto: a área de criação abre e retorna ao construtor com o menu comum, sem criar rolagem horizontal. A geração remota já validada está registrada separadamente em `ai-integration.md`.

Capturas: `dashboard-mobile-final.png`, `teacher-sidebar-mobile-final.png`, `dashboard-sidebar-final.png`, `dashboard-closed-final.png` e `corrections-sidebar-final.png`.

## Pacote e verificações

`netlify-dist` foi reconstruído depois das alterações finais. A verificação comparou 77 arquivos públicos por SHA-256: 77 idênticos, incluindo as quatro especialidades, navegação, dashboard, correção, Copiloto, construtor, cliente, imagem e rota compilada `/oministudio/`.

Uma prévia independente servindo `netlify-dist` como raiz na porta 4174 também passou: os 77 arquivos HTTP coincidem com o pacote. O verificador evita reutilizar conexões e tenta novamente uma única vez em falhas de transporte; arquivo ausente ou conteúdo divergente sempre falha. O servidor antigo na porta 4173 serve o workspace. As verificações autenticadas do pacote usaram `/netlify-dist/frontend/...` nessa origem; os recursos absolutos compartilhados foram conferidos por hash na prévia independente. Não houve publicação remota do frontend nesta rodada.

- `node frontend/Parties/check.mjs --role teacher`: 18 páginas, nenhuma falha.
- `node scripts/verify-professor-package.mjs --url http://127.0.0.1:4174/`: 77 cópias e 77 recursos HTTP idênticos; bundle igual às fontes; nenhuma pasta privada detectada no pacote.
- CSS final analisado pelo PostCSS e sintaxe dos módulos/controladores validada.
- 16 testes semânticos do dashboard aprovados. O agente de navegação também verificou preferência, breakpoint, foco, inert, montagem idempotente e os guards de professor/gestor.

A validação global anterior ainda lista imports ausentes em páginas fora do escopo docente. A checagem docente foi executada separadamente; este relatório não declara essas outras áreas aprovadas. O fluxo do gestor na agenda recebeu reconciliação e o marcador do drawer, mas não foi navegado com uma conta de gestor nesta rodada.
