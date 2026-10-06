# Design QA — central de atividades do aluno

final result: passed

## Evidências

- Fontes visuais: `docs/design/evidence/activities-pending-reference.png`, `activities-delivered-reference.png` e `activities-all-reference.png` (1487 × 1058 px cada).
- Implementação renderizada: `http://localhost:4173/tests/student-activities-responsive.html` usando o mesmo JavaScript e CSS da rota de produção.
- Comparação visual conjunta: `http://localhost:4173/tests/student-activities-comparison.html?state=pending`, `state=done` e `state=all`.
- Viewport da comparação desktop: 1440 × 900 CSS px, `devicePixelRatio` 1; o iframe da implementação foi renderizado em 1440 × 1024 e reduzido igualmente apenas para a prancha comparativa.
- Estados: “Para fazer”, “Entregues” e “Todas”, com dados representativos de atividades pendentes, em andamento, enviadas e corrigidas.

## Comparação de vista completa

- “Para fazer” preserva o quadro em três grupos da referência: Hoje, Próximos dias e Sem prazo. Cabeçalhos, contadores, metadados, progresso e ações mantêm a mesma hierarquia.
- “Entregues” preserva o histórico cronológico em linhas compactas, separado em Hoje, Esta semana e Anteriores, com situação de correção, nota e ação.
- “Todas” preserva o agrupamento por disciplina, com resumo de pendências/entregas, progresso e atividades da matéria.
- Busca, filtro de disciplina, métricas e abas ficam acima do conteúdo em todas as variações.

## Comparações focadas

- Controles: abas, busca, seletor de disciplina e ações são interativos e têm estados selecionado, foco e desabilitado.
- Cartões pendentes: títulos longos quebram sem deslocar prazo, progresso ou botão.
- Linhas entregues: em desktop mantêm leitura tabular; abaixo de 520 px reorganizam data e ação sem esconder informações essenciais.
- Grupos por disciplina: progresso e contadores permanecem visíveis; no celular as atividades viram linhas empilhadas com botão em largura total.
- Não foi necessário comparar imagens internas: as referências usam apenas ícones de interface, atendidos pela biblioteca Material Symbols já carregada pelo produto.

## Superfícies de fidelidade

- Tipografia: DM Sans no corpo e Manrope em títulos, pesos 700–800 e quebras compatíveis com as referências.
- Espaçamento e ritmo: grade de três colunas no desktop, duas no tablet, uma até 700 px; raios de 11–20 px e separações de 10–24 px.
- Cores e tokens: fundo claro, azul-marinho nas ações primárias, azul institucional e cores semânticas por disciplina e estado.
- Imagens e ativos: nenhuma imagem raster é exigida dentro da interface; os ícones existentes foram preservados, sem placeholders.
- Cópia e conteúdo: rótulos, estados e ações estão em português e refletem dados reais retornados pelo catálogo.

## Responsividade verificada

- 1440 × 1000: três colunas em “Para fazer”, histórico tabular e grupos compactos por disciplina.
- 768 × 1024: duas colunas, com “Sem prazo” ocupando a linha completa; `scrollWidth` 753 para viewport de 768.
- 520 × 900: uma coluna; busca e disciplina empilhadas; `scrollWidth` 505 para viewport de 520.
- 320 × 800: abas completas com 87 px cada, sem corte; `scrollWidth` 305 para viewport de 320.

## Histórico de achados

- [P2, corrigido] Em 320 px a aba “Todas” ficava parcialmente fora da área visível. Correção: abaixo de 380 px as três abas dividem igualmente a largura e reduzem apenas o padding.
- [P2, corrigido] As ações primárias usavam o roxo legado e se afastavam das referências selecionadas. Correção: ações principais passaram a usar o azul-marinho do token `--nav`; ações secundárias mantêm contorno institucional.
- [P2, corrigido] A primeira prancha comparava referência desktop com uma implementação comprimida em largura de tablet. Correção: o iframe passou a renderizar em 1440 × 1024 e somente a prancha visual é reduzida.

## Testes

- Sintaxe de `frontend/aluno/atividades/script.js`: aprovada.
- Testes automatizados: 6/6 aprovados, incluindo o contrato Supabase de autor e progresso real.
- Busca, filtro de disciplina e troca entre as três abas: validados no navegador.
- Consulta autenticada com a conta de aluno de teste: 5 atividades visíveis, 6 tentativas próprias e nenhuma tentativa de outro aluno exposta pela RLS.
- Contrato aninhado de `avaliacoes_docentes`, questões, tentativas e respostas: validado diretamente no Supabase configurado.
- Autoria: 1 rascunho legado recebeu o snapshot do professor; as 5 publicações antigas foram preservadas pela regra de imutabilidade e usam o fallback por disciplina. Novas atividades já nascem com o nome real do autor.
- Console do navegador: nenhum erro ou aviso.
- Não há achados P0, P1 ou P2 pendentes.

## Integração de dados

- [P3, corrigido] O progresso deixou de usar o valor visual fixo de 50% e agora é calculado pelas respostas salvas da tentativa atual.
- [P3, corrigido] O texto genérico fixo do professor foi substituído pelo snapshot seguro do autor salvo no Supabase; registros antigos mantêm fallback por disciplina.
- O catálogo não consulta `gabaritos_avaliacao` e continua sujeito às políticas RLS do aluno.

---

# Atualização de Design QA — destinos prioritários do aluno

Data: 30 de setembro de 2026  
Resultado final: **passed**

## Escopo validado

- Avaliações, Trilhas e Matérias aparecem antes dos destinos secundários.
- Vermelho representa pendência fora do prazo; amarelo representa conteúdo não concluído dentro do prazo; verde representa conclusão ou ausência de pendências.
- A precedência visual é vermelho, depois amarelo e por fim verde.
- A situação é recalculada com avaliações, trilhas e filtro de matéria retornados pelo Supabase.

## Inspeção no navegador

- desktop/painel padrão: três cartões prioritários com preenchimento forte, texto e ícones contrastantes;
- tablet em 820 × 900: grade em duas colunas sem perda da ordem de prioridade;
- celular em 375 × 812: cartões empilhados, etiquetas visíveis e ações tocáveis;
- rota compilada `netlify-dist/oministudio/index.html`: abriu o aplicativo e carregou seus assets corretamente.

## Achados

- [P1, corrigido] O pacote manual publicado não garantia uma rota física curta para o OmniStudio. Correção: cópia compilada em `oministudio/`, compatibilidade em `engine/dist/client/` e `_redirects` dentro do pacote.
- [P2, corrigido] Destinos principais tinham o mesmo peso dos atalhos secundários. Correção: primeira linha exclusiva e cores semânticas com contraste.
- P0, P1 e P2 pendentes: 0.

---

# Atualização de Design QA — Turma no Copiloto e descritores opcionais

Data: 2 de outubro de 2026  
final result: passed

## Fonte e implementação

- Fontes visuais: `C:\Users\CLEVER~1\AppData\Local\Temp\codex-clipboard-263ce295-a69c-4e32-9e94-817056e1e5e6.png` e `C:\Users\CLEVER~1\AppData\Local\Temp\codex-clipboard-9b1a4c52-7c22-4d37-891c-33400c420ecf.png`.
- Implementação validada no Codex in-app Browser, aba 4, rota `http://127.0.0.1:4173/frontend/professor/professor_portugues/avaliacoes/index.html?layout=20261002-12#view=create`.
- Evidência renderizada capturada inline no navegador; o controlador não expôs caminho persistente para a captura.
- Estado comparado: Copiloto na etapa **Pedido**, turma selecionada dentro do diálogo e avanço para **Contexto** com zero descritores.

## Evidência comparativa

- [P0, corrigido] O fluxo bloqueava qualquer pedido sem descritores. Agora somente a turma é obrigatória e a interface informa claramente que descritores são opcionais.
- [P1, corrigido] O cartão apenas informava “Não selecionada”, sem oferecer ação. A primeira etapa agora possui um seletor de turma com as turmas reais do professor.
- [P1, corrigido] A escolha feita no Copiloto não existia no formulário principal. Agora os dois campos ficam sincronizados e respeitam a confirmação existente ao trocar uma turma com conteúdo já preenchido.
- [P1, corrigido] A função segura também exigia habilidade. O contrato agora aceita `skillIds` vazio, impede códigos inventados e exige `habilidade_ids: []` na saída sem descritores.

## Superfícies obrigatórias

- Tipografia: rótulo, valor e texto auxiliar seguem os pesos e tamanhos dos demais campos do Copiloto.
- Espaçamento e ritmo: seletor ocupa a largura útil do corpo e os três cartões de contexto permanecem alinhados.
- Cores e tokens: campo branco, borda azul-cinza e foco azul institucional preservados.
- Imagens e ícones: seletor reutiliza Material Symbols e o componente de opções existente, sem novos ativos artificiais.
- Cópia: “Os descritores são opcionais” aparece antes do envio e o resumo usa “sem descritor específico”.

## Responsividade e interação

- Desktop: turma real aberta e selecionada; o campo principal foi sincronizado; avanço para **Contexto** sem erro.
- Celular 390 × 844: seletor com 351 px dentro da área útil; `bodyOverflow = 0`, `pageOverflow = 0` e `dialogScrollLeft = 0`.
- Console do navegador: nenhum erro ou aviso.
- P0, P1 e P2 pendentes: 0.

---

# Atualização de Design QA — seletores e formatos do Copiloto

Data: 2 de outubro de 2026  
final result: passed

## Fonte e evidência renderizada

- Fontes visuais do defeito: `C:\Users\CLEVER~1\AppData\Local\Temp\codex-clipboard-e941c169-30df-42fe-9e9f-1c2b35691a89.png` (810 × 772 px) e `C:\Users\CLEVER~1\AppData\Local\Temp\codex-clipboard-6bdee610-7c3f-4229-b2d3-a9e4aef48d11.png` (795 × 251 px), densidade 1x.
- Implementação validada no Codex in-app Browser, aba 11, rota `http://127.0.0.1:4173/frontend/professor/professor_portugues/avaliacoes/index.html?layout=20261002-8#view=create`.
- Captura renderizada inline no navegador em desktop e em viewport CSS de 520 × 900; o controlador desta sessão não expôs caminho persistente para a captura.
- Estado comparado: Copiloto aberto na etapa **Pedido**, menus **Tipo de ajuda** e **Prioridade** abertos e grupo **Formatos permitidos** expandido.

## Comparação integral e focada

- [P1, corrigido] A seta do seletor mudava, porém a lista era adicionada fora da camada superior do diálogo modal e ficava invisível atrás dele. O popover e seu backdrop agora são montados dentro do diálogo aberto.
- [P2, corrigido] No celular não havia confirmação visual de que o seletor funcionava. Em 520 px ele abre como folha inferior, com fundo de foco, opção selecionada e fechamento acessível.
- [P2, corrigido] A seleção de formatos não oferecia uma ação global. **Habilitar tudo** foi adicionado ao final, com estado misto, seleção/desseleção sincronizada e texto explicativo.

## Superfícies obrigatórias

- Tipografia: hierarquia, peso e legibilidade originais preservados; o novo texto auxiliar usa o mesmo tamanho e cor dos textos de suporte.
- Espaçamento e ritmo: o controle global ocupa uma nova linha no fim dos chips e não altera a largura do modal.
- Cores e tokens: estados usam o azul institucional e mantêm contraste branco/azul; estado parcial continua distinguível.
- Imagens e ícones: Material Symbols já adotado pelo produto (`select_all`), sem novo ativo raster ou desenho improvisado.
- Cópia: rótulos e mensagens estão em português brasileiro e explicam a consequência de habilitar todos os formatos.

## Interações e responsividade testadas

- Desktop: abrir **Tipo de ajuda** → visualizar duas opções → selecionar **Revisar o rascunho atual**; abrir **Prioridade** → visualizar três opções → selecionar **Aprofundamento**.
- 520 × 900: abrir **Tipo de ajuda** → folha inferior inteiramente visível, sem ficar atrás do diálogo.
- Formatos: estado inicial 4/8 → **Habilitar tudo** → 8/8 e mensagem de planejamento ampliado.
- Console do navegador: nenhum erro ou aviso.
- P0, P1 e P2 pendentes: 0.

---

# Atualização de Design QA — Remoção do header docente

Data: 2 de outubro de 2026  
final result: passed

## Fonte e implementação

- Fonte visual: `C:\Users\CLEVER~1\AppData\Local\Temp\codex-clipboard-b7cf844e-c959-406d-9198-e16d13880b60.png` (1314 × 126 px, densidade 1x).
- Implementação validada no Codex in-app Browser, aba 10, em `http://127.0.0.1:4173/frontend/professor/professor_portugues/avaliacoes/index.html?layout=20261002-7#view=create`.
- Viewport desktop validado: 1265 px de largura; captura renderizada inline no navegador, pois o controlador desta sessão não expôs caminho local para a imagem.
- Estado: criação de avaliação, topo da página, sidebar compacta.

## Comparação e achados

- [P1, corrigido] O header destacado na referência ocupava 120 px, repetia o contexto já presente na sidebar e reduzia a área útil do construtor.
- O elemento `.portal-topbar.portal-commandbar` foi removido do template docente, não apenas ocultado; contagem renderizada: `0`.
- O conteúdo principal começa em `top: 0`, com o espaçamento interno próprio de `.portal-content`.
- Agenda, laboratórios, avaliações e criação continuam acessíveis pela sidebar; em telas móveis, a gaveta continua disponível pela navegação inferior.

## Superfícies obrigatórias

- Tipografia e cópia: nenhuma informação funcional do fluxo foi perdida; o primeiro título útil agora é **Da proposta à devolutiva**.
- Espaçamento: a faixa redundante e sua borda foram eliminadas sem deixar lacuna.
- Cores: preservados os tokens institucionais do conteúdo e da sidebar.
- Ícones e imagens: nenhuma substituição ou perda de recurso visual; os atalhos permanecem na navegação lateral.
- Responsividade: largura do documento e largura útil permanecem iguais, sem transbordamento horizontal.
- Console do navegador: nenhum erro ou aviso.
- P0, P1 e P2 pendentes: 0.

---

# Atualização de Design QA — Sidebar, perfil e atalho móvel do professor

Data: 2 de outubro de 2026  
final result: passed

## Fonte e implementação

- Verdade visual do atalho: `C:\Users\CLEVER~1\AppData\Local\Temp\codex-clipboard-f2a9b56e-129f-4b07-8bc7-6d5c113e5251.png` (240 × 196).
- Verdade visual da sidebar: `C:\Users\CLEVER~1\AppData\Local\Temp\codex-clipboard-70043157-9c96-4b1a-9f9d-e5fb3a0e97bc.png` (787 × 767).
- Captura desktop final: `C:\Users\CLEVERSON\Downloads\OminiSaber-main\OminiSaber-main\tmp\teacher-sidebar-copilot-final.png` (1265 × 712).
- Captura do perfil e preferências: `C:\Users\CLEVERSON\Downloads\OminiSaber-main\OminiSaber-main\tmp\teacher-profile-settings-final.png` (1265 × 712).
- Viewports validados: desktop 1280 × 720 e celular 390 × 844, densidade padrão do navegador.

## Comparação visual

- A comparação integral colocou a referência da sidebar e a implementação no mesmo passe visual. A largura, fundo branco, navegação vertical, estado ativo azul e área de conta foram preservados.
- O rótulo “Ajuda para planejar” da referência foi removido; o orbe continua identificável e mantém `aria-label` para tecnologia assistiva.
- A implementação acrescenta hierarquia com os grupos **Ensinar** e **Planejar**, mantendo a mesma linguagem visual do produto.
- A comparação focada do atalho confirmou a preservação do ícone, borda branca, azul institucional e sombra, sem o título inferior solicitado para remoção.

## Superfícies obrigatórias

- Tipografia: Manrope/Inter, pesos e hierarquia consistentes com a área docente; nomes longos quebram sem invadir controles.
- Espaçamento e ritmo: navegação agrupada, perfil separado por divisor e alvos de toque com pelo menos 44 px; painel móvel ocupa largura segura.
- Cores e tokens: azul institucional, branco e cinzas compartilhados; foco visível e contraste preservados.
- Imagens e recursos: não há imagens raster ou ilustrações a reproduzir; ícones usam Material Symbols já adotado no produto.
- Cópia: nomes das áreas foram preservados; “Perfil e configurações” e as preferências do Copiloto usam linguagem direta.

## Interações e responsividade

- Perfil inferior da sidebar abre a página real de perfil e configurações.
- Nome e e-mail podem ser atualizados pela API existente do Supabase.
- O botão do Copiloto pode ser ocultado, reativado e ter sua posição restaurada.
- O orbe pode ser movido por arraste e pelas setas do teclado; a posição normalizada persiste após recarregar e é limitada à área útil do viewport.
- Sidebar móvel abre e fecha com foco e controles nomeados; desktop e celular não apresentam transbordamento horizontal.
- Console do navegador: nenhum erro ou aviso na rota final de atividades.

## Histórico de correções

- [P2, corrigido] O `main` somava largura total à margem da sidebar e criava rolagem horizontal; passou a usar `calc(100% - 248px)` no desktop e `100%` com precedência no celular.
- [P2, corrigido] O checkbox visualmente oculto do Copiloto herdava largura de página e expandia o documento; foi limitado a 1 × 1 px.
- [P2, corrigido] A primeira validação móvel comprimia o conteúdo para 127 px por conflito de especificidade; a regra móvel agora sobrescreve largura e largura máxima.
- P0, P1 e P2 pendentes: 0.

---

# Atualização de Design QA — Copiloto docente flutuante (opção 3)

Data: 2 de outubro de 2026  
final result: passed

## Fonte e implementação

- Referência selecionada: `C:\Users\CLEVERSON\.codex\generated_images\01a0bd78-5646-7ba0-87a4-e03c33a505a7\exec-36a830fa-6411-4184-a769-a260050f7721.png` (1487 × 1058).
- Captura da implementação: `C:\Users\CLEVERSON\Downloads\OminiSaber-main\OminiSaber-main\tmp\copilot-option3-implementation.png` (1425 × 1013).
- Comparação lado a lado: `C:\Users\CLEVERSON\Downloads\OminiSaber-main\OminiSaber-main\tmp\copilot-option3-comparison.png`.
- Captura móvel final: `C:\Users\CLEVERSON\Downloads\OminiSaber-main\OminiSaber-main\tmp\copilot-option3-mobile-final.png` (375 × 811).

## Estado e estrutura comparados

- Viewport desktop validado em 1440 × 1024, com a etapa **Contexto** aberta sobre a criação de avaliação.
- A implementação preserva o botão-orbe, o painel elevado, a progressão **Pedido → Contexto → Rascunho**, o pedido do professor, as duas escolhas de consentimento, o resumo dos dados e a garantia de revisão antes da publicação.
- O painel usa a superfície real do OmniSaber como fundo; densidade e largura foram ajustadas para conviver com a navegação e com o editor existente.
- A visualização focada não exigiu recorte adicional: o painel ocupa a maior parte de ambos os quadros e todos os rótulos essenciais permanecem legíveis na comparação integral.

## Tipografia, espaçamento, cor e recursos

- Tipografia e pesos seguem os tokens existentes da área do professor.
- Azul institucional e superfícies brancas substituem o roxo conceitual da referência para manter consistência com o produto.
- Espaçamento, raios, estados de foco e alvos de toque foram conferidos no desktop e no celular.
- O ícone usa Material Symbols já carregado no produto, evitando SVG duplicado ou recurso raster de baixa qualidade.
- A cópia informa de forma direta o que será analisado, o que não será usado e que a sugestão nunca é publicada sem revisão.

## Responsividade e interação

- Desktop em 1440 × 1024: painel ancorado ao botão, corpo rolável e ausência de transbordamento horizontal.
- Celular em 390 × 844: margem segura de 12 px, painel limitado ao viewport, rodapé fixo dentro do diálogo e botão acima da navegação inferior.
- Preferência de movimento reduzido: paralaxe e transições decorativas são desativadas.
- Teclado, foco visível, fechamento por `Escape`, rótulos acessíveis e estado `aria-pressed` foram preservados.
- Console do navegador: nenhum erro ou aviso durante abertura, avanço de etapa e troca de consentimento.

## Achados corrigidos durante a validação

- [P2, corrigido] O botão flutuante colidia com a navegação móvel; foi elevado para respeitar a área segura e a barra inferior.
- [P2, corrigido] A ação **Continuar** permanecia visível na etapa de consentimento; o estado `hidden` agora prevalece sobre o layout do rodapé.
- [P2, corrigido] A rolagem interna permanecia na mesma posição ao mudar de etapa; o corpo retorna ao topo em cada transição.
- P0, P1 e P2 pendentes: 0.

---

# Atualização de Design QA — Mesa de Montagem por receitas

Data: 30 de setembro de 2026  
final result: passed

## Fonte e implementação

- Referência selecionada: `C:\Users\CLEVERSON\.codex\generated_images\01a0bd78-5646-7ba0-87a4-e03c33a505a7\exec-b6f425c6-fb2c-4328-adf1-76d471713f04.png`.
- Implementação: `engine/src/App.jsx`, `engine/src/styles.css` e `engine/src/core/work.js`.
- Prévia validada: `http://127.0.0.1:4173/netlify-dist/engine/dist/client/index.html?teacherType=portugues#blocks`.

## Comparação de estrutura

- A coluna compacta preserva as ações Adicionar, Buscar e os cinco blocos recentes.
- O catálogo preserva o título orientado à intenção, três receitas pedagógicas, categorias e blocos individuais.
- A seleção visual usa azul institucional e mantém hierarquia, densidade e ritmo próximos da referência.
- Por decisão explícita do produto, o inspetor lateral da referência foi substituído por uma página própria de configuração.

## Página separada de configuração

- Cabeçalho com retorno para a Mesa, nome do bloco, estado de salvamento e conclusão explícita.
- Formulário com espaço integral para instruções, critérios, recursos e percurso.
- Guia lateral “Como o aluno verá” com checklist; em telas pequenas ele aparece antes do formulário.
- Blocos de imagem, fórmula, plano cartesiano, tabela, química, ordenação e associação possuem campos próprios.

## Responsividade verificada

- Desktop padrão: catálogo com rail + superfície principal; receitas exibem a composição dos blocos.
- Tablet em 820 × 1000: receitas simplificam a composição visual, categorias permanecem acessíveis e o catálogo não transborda horizontalmente.
- Celular em 520 × 900: rail vira barra compacta; configuração usa uma coluna, ações ocupam toda a largura e o guia antecede o formulário.
- Console do navegador: nenhum erro ou aviso.

## Testes

- Build de produção do `engine`: aprovado.
- Empacotamento de `netlify-dist`: atualizado.
- Testes de hospedagem: 5/5 aprovados.
- Fluxo validado no navegador: abrir catálogo → selecionar receita → adicionar três blocos conectados → abrir página de configuração → voltar à Mesa.
- P0, P1 e P2 pendentes: 0.

---

# Atualização de Design QA — Sidebar docente v2 e correção do Copiloto

Data: 2 de outubro de 2026  
final result: passed

## Fonte e evidência renderizada

- Fonte visual do defeito: `C:\Users\CLEVER~1\AppData\Local\Temp\codex-clipboard-c6198f30-8b15-4266-8479-5da49ea85da2.png` (810 × 778 px, densidade 1x).
- Implementação validada no Codex in-app Browser, aba 9, rota `http://127.0.0.1:4173/frontend/professor/professor_portugues/avaliacoes/index.html?layout=20261002-6#view=create`.
- Evidências renderizadas foram capturadas inline no navegador em desktop (1150 × 844) e celular (390 × 844); o controlador de navegador desta sessão não expôs caminho de arquivo para as capturas.
- Estado comparado: sidebar expandida/recolhida e Copiloto aberto na etapa **Pedido**.

## Comparação integral e focada

- Comparação integral: a faixa branca de 78 px à direita da barra de rolagem foi eliminada; diálogo e superfície interna agora terminam no mesmo limite (`rightGap: 0`).
- Comparação focada do Copiloto: fundo externo transparente, `padding: 0`, sem âncora duplicada, cabeçalho e rodapé contidos na mesma superfície e somente o corpo central rolável.
- Comparação focada da sidebar: navegação anterior foi substituída por marca compacta, ação primária **Criar atividade**, grupos **Principal/Ferramentas**, perfil e saída no rodapé e controle único de recolhimento.

## Superfícies obrigatórias

- Tipografia: Manrope/Inter e pesos do sistema mantidos; rótulos da sidebar não quebram e ficam ocultos somente no modo compacto.
- Espaçamento e ritmo: sidebar de 272 px expandida e 84 px recolhida; o conteúdo acompanha a largura sem saltos ou rolagem horizontal.
- Cores e tokens: azul institucional `#1557ef`, superfícies brancas e estados suaves de seleção; contraste preservado.
- Imagens e ícones: Material Symbols existentes, sem rasterização, SVG artesanal ou marcador provisório.
- Cópia: grupos, criação, perfil, OminiStudio e ações continuam claros em português.

## Responsividade e interações testadas

- Desktop: recolher → largura 84 px e `mainLeft: 84`; recarregar → preferência persistida; expandir → largura 272 px.
- Celular 390 × 844: sidebar vira gaveta de 320 px com controle de fechar; documento e conteúdo mantêm largura útil sem transbordamento horizontal.
- Copiloto móvel: ocupa `100vw × 100dvh`, margem zero, barra de rolagem dentro do corpo e `rightGap: 0`.
- Controles legados duplicados da sidebar foram removidos/ocultados; apenas o novo recolhimento permanece no desktop.
- Console do navegador: nenhum erro ou aviso.

## Histórico de correções

- [P1, corrigido] Faixa externa branca e ícone duplicado faziam o diálogo parecer quebrado após a barra de rolagem.
- [P1, corrigido] Sidebar permanecia visualmente igual e carregava um segundo controle legado sobre o novo botão.
- [P2, corrigido] Regra genérica de diálogos limitava o Copiloto móvel a `calc(100vw - 24px)`; a regra específica agora ocupa toda a tela.
- [P2, corrigido] Sidebar recolhida não tinha preferência persistente nem ajuste correspondente da área principal.
- P0, P1 e P2 pendentes: 0.

---

# Atualização de Design QA — Habilitar tudo responsivo

Data: 2 de outubro de 2026  
final result: passed

## Fonte e implementação

- Fonte visual do defeito: `C:\Users\CLEVER~1\AppData\Local\Temp\codex-clipboard-7998d472-bf60-4634-a199-61d26ccdc3aa.png` (820 × 812 px, densidade 1x).
- Implementação validada no Codex in-app Browser, aba 13, rota `http://127.0.0.1:4173/frontend/professor/professor_portugues/avaliacoes/index.html?layout=20261002-10#view=create`.
- Capturas renderizadas inline no navegador em 1280 × 900, 820 × 1000 e 390 × 844; o controlador não expôs caminho persistente para as imagens.
- Estado: Copiloto aberto, **Formatos permitidos** expandido e **Habilitar tudo** ativo.

## Evidência comparativa

- [P1, corrigido] A referência mostrava o controle global ocupando toda a linha como uma barra azul desproporcional. A versão corrigida usa um chip final de 121 px no desktop/tablet e 114 px no celular.
- [P1, corrigido] A regra genérica de `span` atingia também o ícone interno, criando um segundo componente visual dentro do botão. O estilo agora é limitado ao filho direto do rótulo e o ícone mede 16 × 16 px.
- [P2, corrigido] Ao redimensionar o modal aberto, `scrollLeft` podia permanecer deslocado. O diálogo e sua superfície agora usam recorte horizontal e normalizam o deslocamento em abertura e redimensionamento.
- Comparação focada: os chips permanecem na ordem original, quebram linhas naturalmente e a mensagem curta fica abaixo sem ampliar a superfície.

## Superfícies obrigatórias

- Tipografia: tamanhos e pesos dos chips existentes preservados; 0,68 rem no celular e 0,72 rem nos demais layouts.
- Espaçamento e ritmo: gaps de 0,38 rem no celular e 0,45 rem em tablet/desktop; nenhum chip força uma nova linha exclusiva.
- Cores e tokens: azul institucional no estado ativo, fundo branco e contorno azul nos formatos individuais.
- Imagens e ícones: `select_all` do Material Symbols preservado em 16 × 16 px, sem fundo ou borda duplicada.
- Cópia: mensagem reduzida para “Todos os formatos ativos — planejamento ampliado habilitado.”

## Responsividade e interação

- Desktop 1280 × 900: área de tipos `clientWidth = scrollWidth = 575 px`; chip 121 × 33 px.
- Tablet 820 × 1000: área de tipos `clientWidth = scrollWidth = 560 px`; chip 121 × 33 px.
- Celular 390 × 844: área de tipos `clientWidth = scrollWidth = 328 px`; chip 114 × 31 px.
- Corpo do Copiloto sem transbordamento horizontal nos três tamanhos.
- Console do navegador: nenhum erro ou aviso.
- P0, P1 e P2 pendentes: 0.


---

# Design QA — rework do Copiloto, opção 2

Data: 4 de outubro de 2026
final result: passed

Fonte: `docs/qa/copiloto-rework-2026-10-03/referencia-opcao-2.png`. Comparação conjunta e cortes focados em `comparacao-desktop.jpg`, `comparacao-conversa.jpg` e `comparacao-previa.jpg` nessa pasta. O viewport foi 1487 × 1058 CSS pixels, com o estado pós-geração e Visão do aluno aberta. A área útil exportada pelo navegador mede 1472 × 1048; a prancha completa o espaço restante, sem esticar capturas.

A implementação conserva a composição escolhida: navegação docente recolhida, marca e caminho no topo, título e contexto, conversa à esquerda e proposta/prévia à direita, com ações na base. A biblioteca existente de ícones e a tipografia Inter foram reutilizadas. Fundo claro, azul institucional, contornos, raios e ritmo de cartões mantêm a direção visual da referência. Não existem imagens ilustrativas internas a produzir.

A comparação focada conferiu hierarquia e legibilidade da conversa, refinamentos, campo de pedido, título, texto de leitura, opções de resposta, seleção, feedback e ações. As adições funcionais de tipos de ajuda, versões, contexto e avaliação da sugestão usam o mesmo padrão visual. Conteúdo e perfil fictícios da imagem não foram fixados no produto.

Achados corrigidos: controles antigos acima do workspace; textos muito pequenos; abas com fundo escuro herdado; rótulos de alternativas em grid; altura herdada de campos de texto aplicada aos radios; botão de ideia permanentemente desabilitado; pontuação visual arredondada incorretamente; palavra Proposta quebrando no seletor; ações abaixo da área útil; largura deslocada no celular com estado de menu recolhido. Não restam achados P0, P1 ou P2 visuais.

Desktop: aplicação acessível abaixo de 1000 CSS pixels no viewport de referência. Tablet 768 × 1024: painéis empilhados, margem esquerda zero e sem overflow. Celular 390 × 844: largura útil completa, respostas e feedback legíveis, controles principais >=44 pixels e aplicar acima da barra fixa. As capturas finais estão na pasta de evidências.

O portal real carregou o rework. O fluxo completo foi verificado com dados e API inventados: 42 verificações passaram. Ideias, refinamento, revisão de uma etapa preservando as demais, teclado, erro/retry, retorno de turma antiga e saída inválida também foram conferidos. A geração real recebeu recusa do servidor; a implantação da nova Edge Function e da migration continua pendente. Essa limitação funcional é separada da aprovação visual. Detalhes e limites estão em `docs/qa/copiloto-rework-2026-10-03/README.md`.

---

# Design QA — dashboard inicial do professor

Data: 4 de outubro de 2026  
final result: passed

## Fonte visual e implementação comparada

- Referência fornecida pelo usuário: `C:/Users/CLEVER~1/AppData/Local/Temp/codex-clipboard-9a03edc1-c78d-40e5-a663-783e2df156bb.png`; cópia estável em `docs/qa/dashboard-rework-2026-10-04/referencia-dashboard.png`.
- Implementação renderizada no navegador do Codex: `docs/qa/dashboard-rework-2026-10-04/desktop-demo.jpg`.
- Viewport desktop informado pelo agente principal: 1212 × 680 CSS pixels. Referência: 1212 × 680 pixels, densidade 1×. Captura exportada: 1197 × 672 pixels, área útil da captura com a barra de rolagem; nenhuma imagem foi esticada para compensar essa diferença. A prancha conserva os tamanhos originais e completa o espaço externo com fundo neutro.
- Estado: painel docente de Português, navegação compacta com rótulos e três turmas com atividades, resultados corrigidos e prazos. A captura da implementação é uma fixture local de QA, identificada como **DADOS DEMONSTRATIVOS — QA — nenhuma gravação**. A tela autenticada usa dados reais e estados vazios quando não há conteúdo; nomes, resultados e datas da referência não foram fixados no produto.
- Comparação conjunta examinada: `docs/qa/dashboard-rework-2026-10-04/comparison.jpg`. Recortes conjuntos examinados para legibilidade de fontes, marca, rótulos, ações e cartões: `comparison-header.jpg` e `comparison-cards.jpg` na mesma pasta.
- Capturas responsivas examinadas: `mobile.jpg` e `tablet.jpg`, produzidas em 390 × 844 e 834 pixels de largura respectivamente. São capturas de página completa; a extensão vertical registra a rolagem natural.

## Achados e diferenças aceitas

Não restam achados visuais P0, P1 ou P2 nas capturas examinadas.

A implementação mantém os principais limites e relações da referência: cabeçalho horizontal, navegação lateral com texto, título de acompanhamento, saudação e gráfico à esquerda, turmas à direita e quatro cartões operacionais abaixo. A ação de criar atividade fica explícita junto ao título. A ilustração é uma imagem real gerada, transparente e otimizada, com a mesma personagem docente, paleta azul, livros e planta da direção escolhida. Sua escala menor deixa mais área para informações e preserva o foco no acompanhamento.

As diferenças de conteúdo são necessárias para uma tela funcional: o gráfico usa seis semanas com amostras reais, em vez de repetir valores mensais ilustrativos; quantidade de atividades substitui a contagem individual de alunos por turma, que a API atual não fornece; o total exato de alunos é mostrado ao fim da lista. Entregas e atividades têm unidades distintas e o texto usa **entregas para corrigir**. O apoio traz o corte de triagem e a amostra, em vez de afirmar uma dificuldade específica sem evidência. Datas atuais vêm dos prazos publicados. O Copiloto conduz ao planejamento, função atualmente disponível no produto. A navegação usa rotas existentes de oficinas, OminiStudio e agenda, em vez de inventar uma biblioteca docente.

## Cinco superfícies de fidelidade

- **Fontes e tipografia:** Manrope/Inter do sistema existente, hierarquia de títulos fortes e corpo discreto, com pesos e contraste próximos da referência. Os recortes mostram marca, título, perfil e cartões sem truncamento. No celular, títulos e rótulos quebram em linhas legíveis; o menu mantém texto junto aos ícones.
- **Espaçamento e ritmo:** cartões claros com raios suaves, contornos discretos e sombras leves; espaçamento consistente entre cabeçalho, saudação, turmas e ações. No tablet, as regiões principais se empilham antes que os textos fiquem apertados. No celular, saudação/gráfico e turmas usam uma coluna, com cartões operacionais em duas colunas; não há corte horizontal de controles nas capturas finais.
- **Cores e tokens:** azul institucional nas ações e marca, fundo cinza claro, texto azul escuro e branco nos cartões. Coral, âmbar, azul e verde identificam as quatro áreas de atenção. A cor complementa ícone e texto, sem assumir a função de único sinal.
- **Imagem e ícones:** imagem WebP 640 × 640 transparente de aproximadamente 50 KB, com dimensões declaradas e sem distorção. No celular, a personagem decorativa fica pequena e separada dos textos. Ícones da biblioteca Material Symbols existente; sem desenho artesanal, emoji ou imagem provisória usada no lugar dos elementos da referência.
- **Cópia e conteúdo:** linguagem direta, rotas concretas, critério de apoio e amostra identificados. Ausência de dados, consulta parcial e escola sem turmas têm estados próprios. O painel não transforma falta de resultados em desempenho zero ou diagnóstico de dificuldade.

## Histórico de correção e evidência posterior

- [P2, corrigido pelo agente principal] Conflito de margem lateral no tablet: a região principal podia herdar o deslocamento da sidebar antiga. A captura final `tablet.jpg` mostra a região útil alinhada ao novo menu e sem perda de largura.
- [P2, corrigido pelo agente principal] Ilustração e rótulo do gráfico se aproximavam demais no celular. A captura final `mobile.jpg` mostra a personagem na área da saudação e o cabeçalho do gráfico em uma faixa própria, sem sobreposição.
- A prancha conjunta e os recortes foram produzidos após essas correções. As diferenças de 15 pixels de largura e 8 pixels de altura entre exportações foram registradas como recorte de captura, sem gerar achados falsos de espaçamento.

## Interações e limites desta revisão

O agente principal verificou no navegador a seleção de turma no gráfico ampliado, a tabela de dados e os menus responsivos; também mantém a verificação do painel autenticado, ajuda, teclado, console e integração remota separada desta comparação visual. As tabelas expõem valores e amostras como alternativa ao canvas. A interface contém tratamento de movimento reduzido e animações leves, sem biblioteca de animação ou dependência de gráfico.

Esta aprovação cobre fidelidade visual e legibilidade nas evidências apresentadas. Ela não substitui os testes de APIs, permissões, publicação da IA ou resultados pedagógicos. Esses itens ficam registrados na auditoria de dados e no relatório final de integração do agente principal.

## Checklist de implementação

- [x] Referência e implementação abertas e comparadas no mesmo arquivo.
- [x] Marca, títulos, navegação, ações e cartões comparados em recortes legíveis.
- [x] Cinco superfícies de fidelidade examinadas.
- [x] Capturas finais de desktop, tablet e celular examinadas.
- [x] Dados demonstrativos isolados e identificados no ambiente de QA.
- [x] Estados sem dados e critérios de leitura documentados.
- [x] Nenhum achado visual P0/P1/P2 pendente.
- [x] Agente principal verificou ajuda, notificações, foco, teclado, menus, filtro/tabela e console. A função e a migration foram implantadas; atividade, trilha e ideias foram geradas no servidor real. A trilha posterior ao reforço pedagógico usa alvo único na resposta curta e transferência para novo texto em questão dissertativa. Evidências e limites estão em `docs/qa/dashboard-rework-2026-10-04/ai-integration.md`.

## Polimento posterior

- [P3] Os rótulos do gráfico compacto permanecem pequenos para caber no cartão. O gráfico ampliado e a tabela de dados oferecem a leitura detalhada; considerar ampliar a tipografia do resumo numa próxima iteração se houver espaço adicional.


## Iteração final — navegação docente e correções

A revisão das novas capturas corrigiu a divergência entre o menu da Home e o das outras páginas. Todos usam `teacher-navigation.js` e o controlador de Parties, com fechamento completo, reabertura, uma preferência desktop e um breakpoint de 900 px. A área de correção recebeu distâncias de 24 px entre resumo, filtros e lista, abas discretas e estatísticas sem ícones decorativos repetidos.

Na conferência autenticada, também foram corrigidos o acesso ao menu sobrepondo o título no celular, o padding do dashboard vencido pelo shell comum e a perda de foco durante a animação de abertura. A visibilidade do drawer agora muda imediatamente ao abrir; o fechamento conserva uma transição leve. As capturas finais estão em `docs/qa/dashboard-rework-2026-10-04/`; as medidas, interações e limites estão em `teacher-navigation-final.md` nessa pasta.

Home: sem transbordamento em 320, 390, 834 e 1280 px. O menu passou em X, Escape, Tab/Shift+Tab, fundo inerte e retorno de foco; a rolagem por teclado continua funcionando sem barras visíveis. Perfil e agenda usam os mesmos destinos. A criação e a entrada/saída do Copiloto também foram conferidas, sem salvar conteúdo de teste.

O pacote `netlify-dist` foi reconstruído com as versões finais. Os 77 arquivos verificados coincidem com as fontes e com os recursos servidos pela prévia independente do pacote. As 18 páginas docentes passaram na checagem de imports. Não houve publicação remota do frontend nesta iteração.
