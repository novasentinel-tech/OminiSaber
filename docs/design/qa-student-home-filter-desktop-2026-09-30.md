# Design QA — página inicial do aluno com filtro de matéria

final result: passed

## Evidências

- Verdade visual: `docs/design/evidence/student-home-subject-filter-reference.png` (1487 × 1058 px).
- Implementação: `http://127.0.0.1:4173/frontend/aluno/dashboard_principal/index.html?materia=matematica`.
- Comparação conjunta: `http://127.0.0.1:4173/docs/design/evidence/student-home-subject-filter-comparison.html`.
- Página de comparação: viewport 1280 × 720 CSS px, `devicePixelRatio` 1,25.
- Painéis normalizados: referência e implementação em 1487 × 1058 CSS px, reduzidos visualmente para 594,8 × 423,2 px com escala 0,4.
- Estado: aluno autenticado, filtro Matemática ativo, dados reais carregados.
- Captura responsiva adicional: viewport 390 × 844 CSS px, filtro Matemática e depois Português.

A referência e a implementação foram abertas no mesmo quadro de comparação. O
banner superior apresenta estados de dados diferentes: o mockup contém uma
atividade de Matemática em andamento, enquanto a conta real usada no teste não
possui pendência nessa matéria. A variação foi classificada como comportamento
esperado do produto, pois preserva a mesma posição, hierarquia e ação principal.

## Comparação de vista completa

- A navegação lateral, cabeçalho, banner principal, filtro, grade de destinos e
  faixa semanal ocupam as mesmas regiões visuais da referência.
- A implementação mantém a grade 2–3–3 da referência em desktop e reduz para
  uma coluna no celular.
- O filtro ativo altera contexto, textos e URLs sem recarregar a página.
- Não há vazamento horizontal ou sobreposição entre chips, contexto e ação de
  limpar nos breakpoints verificados.

## Comparação focada

O filtro e o primeiro conjunto de cartões foram avaliados em detalhe porque
concentram a mudança solicitada. Os chips possuem alvo de toque consistente,
estado ativo azul, texto de contexto e ação de limpeza. No celular, os chips
são substituídos por um seletor de largura integral; a troca para Português foi
confirmada visualmente e por URL.

## Superfícies de fidelidade

- Tipografia: Poppins nos títulos e Inter nos textos preservam hierarquia,
  pesos e quebra de linha do mockup. Textos móveis não truncam.
- Espaçamento e ritmo: margens, raios, grid e respiros seguem a referência; o
  ajuste intermediário em 1242 px move o contexto para uma segunda linha.
- Cores e tokens: azul institucional, fundos suaves por destino e estados verde,
  rosa, lilás e âmbar mantêm contraste e semântica.
- Imagens e ícones: a tela não depende de ilustrações raster. Material Symbols
  existentes foram preservados; nenhum ativo da referência foi substituído por
  desenho improvisado.
- Cópia e conteúdo: rótulos aprovados foram mantidos e recebem o nome da matéria
  quando o filtro está ativo, por exemplo “Avaliações de Matemática”.

## Histórico de achados e correções

- [P2, corrigido] Em largura intermediária, o texto “Mostrando conteúdos de
  Matemática” sobrepunha os chips. Correção: a barra passa a quebrar linha até
  1360 px e reserva uma linha própria para contexto e limpeza. Evidência
  posterior: chips completos e contexto alinhado sem colisão.
- [P2, corrigido] Os atalhos de agenda do cabeçalho e da faixa semanal não
  carregavam o parâmetro da matéria. Correção: ambos usam o mesmo resolvedor de
  URL dos cartões. Evidência posterior: os dois apontam para
  `agenda/index.html?materia=matematica` ou para a matéria ativa.
- [P2, corrigido] O filtro do catálogo de atividades dependia de precedência
  implícita entre `&&` e `||`. Correção: a regra foi reescrita com retornos
  explícitos, preservando matéria e estado da atividade.

## Interações e testes

- Chips desktop: Matemática selecionada e persistida na URL.
- Seletor móvel: troca Matemática → Português confirmada.
- Destino Atividades: abriu com título, métricas e lista filtrados.
- URLs de Avaliações, Biblioteca, Exercícios, Trilhas, Fórum, Sites úteis e
  Agenda: receberam `materia=<codigo>`.
- Persistência: filtro salvo em `localStorage` e restaurado após recarregar.
- Console da página principal: sem erros ou avisos.
- Testes automatizados: 7/7 aprovados.
- Verificação de sintaxe: cinco scripts alterados aprovados.

Não há achados P0, P1 ou P2 pendentes. Como refinamento P3 futuro, o banner
poderá exibir uma ilustração específica por matéria quando houver direção de
arte oficial; isso não bloqueia o uso atual.
