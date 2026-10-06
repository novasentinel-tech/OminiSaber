# Auditoria do layout docente — plano e resultados

Atualizado em 24/09/2026. Estado: **em andamento**, com primeira rodada de correções locais verificada. Não significa que todas as páginas foram aprovadas.

## Objetivo e limites

Permitir que o professor prepare aulas e avaliações, acompanhe entregas e faça devolutivas em celular, tablet e desktop, mantendo os componentes azuis de `frontend/Parties`. Revisão combinada de usabilidade, responsividade e acessibilidade; não é certificação WCAG.

A sessão disponível foi redirecionada de Avaliações de Português para `erro/index.html?code=forbidden`. [Evidência do bloqueio](acesso-docente.png). Não houve tentativa de contornar permissões. Os testes abaixo usam os renderizadores reais com dados fictícios em `tests/teacher-evaluations.html`; não comprovam integrações autenticadas, publicação ou persistência de notas.

## Planejamento de identificação

1. Inventariar rotas e identificar componentes compartilhados, antes de aplicar correções globais.
2. Reproduzir o problema e registrar página, estado, largura, passos, resultado esperado e evidência. Não classificar uma hipótese de código como bug visual confirmado.
3. Priorizar P0 (perda de dados/ação principal bloqueada), P1 (navegação, controles inacessíveis, sobreposição), P2 (hierarquia, alinhamento, espaçamento).
4. Corrigir na fonte compartilhada quando a causa for comum; evitar remendos por página e não ocultar conteúdo para disfarçar overflow.
5. Reexecutar o cenário original e testar páginas que reutilizam o componente. Acrescentar regressão automatizada quando possível.
6. Regenerar Parties, atualizar versões dos arquivos modificados e conferir carregamento sem cache antigo.
7. Aprovar cada rota somente depois de testes autenticados. Registrar separadamente: identificado, reproduzido, corrigido localmente, validado em conta docente e publicado.

### Matriz de dispositivos e estados

| Dimensão | Cenários obrigatórios |
| --- | --- |
| Celular | 320 e 390px; retrato e paisagem; teclado aberto; ações no fim da página |
| Tablet | 768 e 1024px; alternância de orientação; transição menu lateral/mobile |
| Desktop | 1440px; janela estreita; zoom 200%; conteúdo longo |
| Navegação | menu abrir/fechar, Escape, Tab/Shift+Tab, retorno de foco, navegação inferior, troca de página sem flashes |
| Conteúdo | carregando, vazio, erro recuperável, poucos/muitos registros, nomes e títulos longos |
| Formulários | obrigatórios, mensagens de erro, seleção, voltar/avançar, cancelamento sem salvar, proteção contra perda de edição |
| Acessibilidade | nomes dos controles, etapa atual, foco visível, contraste, ícones, alvos de toque e movimento reduzido |

Critérios: nenhuma rolagem horizontal do documento; tabelas extensas podem ter região própria de rolagem acessível; botões não se sobrepõem; nomes não desaparecem; ações importantes permanecem alcançáveis; fechar nunca exige preencher um formulário. Não considerar apenas `scrollWidth`: verificar também conteúdo cortado por `overflow:hidden`.

## Inventário e ordem de execução

17 documentos HTML encontrados em `frontend/professor`. Alguns são entradas legadas; confirmar redirecionamentos antes de tratá-los como telas distintas.

| Grupo de rotas | Quantidade | Fluxo a revisar | Estado nesta rodada |
| --- | ---: | --- | --- |
| `professor_{portugues,matematica,tecnico_administracao,tecnico_informatica}/dashboard/index.html` | 4 | visão geral → aula/avaliação/agenda; métricas, listas e ações | Inventariado; teste autenticado pendente |
| mesmas especialidades em `laboratorio/index.html` | 4 | listar → preparar → revisar; formulários e ações | Inventariado; teste autenticado pendente |
| mesmas especialidades em `avaliacoes/index.html` | 4 | listar → contexto → currículo → experiência → revisão → acompanhamento/correção | Componentes testados em ambiente isolado; rotas reais pendentes |
| `professor_portugues/redacoes/index.html` | 1 | fila → leitura → critérios → devolutiva | Pendente |
| `agenda/index.html` | 1 | mês/dia → detalhes → formulário; filtros e datas | Pendente |
| `dashboard/index.html`, `dashboard/code.html`, `redacoes/index.html` | 3 | entradas legadas e destino correto por perfil | Pendente |

Próxima ordem: shell compartilhado com conta docente → avaliações completas → agenda → laboratórios → redações → quatro dashboards → regressão cruzada. Uma alteração de CSS compartilhado exige rechecagem dos demais grupos.

## Achados e correções desta rodada

| ID | Prioridade | Evidência / reprodução | Correção | Verificação |
| --- | --- | --- | --- | --- |
| DOC-001 | P1 | Resultados → Ajustar nota → clicar Fechar com justificativa vazia: modal continuava aberto. Botão era submit de formulário obrigatório. [Antes](modal-fechar-antes.png) | Fechar passou a botão independente, sem submissão/validação | Teste local aprovado e clique manual em 320px confirmado |
| DOC-002 | P1 | O mesmo formulário reutilizava a justificativa digitada ao reabrir o ajuste | Reset do formulário antes de preencher o aluno/nota selecionados | Regressão local verifica justificativa vazia ao reabrir |
| DOC-003 | P2 | Em 320px a árvore acessível do construtor mostrava somente botões 1, 2, 3, 4, pois o CSS ocultava os nomes | Etapas com rótulos visíveis; duas colunas em celular; `aria-current=step` na etapa atual | [Depois em 320px](etapas-320-depois.png); nomes e estado atual inspecionados |
| DOC-004 | P2 | Janela de nota não tinha nome acessível e o X era um alvo pequeno | Nome acessível; alvo 44×44; limite de altura com rolagem; área reservada no cabeçalho | [Janela em 320px](modal-320-depois.png); nome acessível validado no teste |

Fontes alteradas: `frontend/professor/specialty/teacher-review.js`, `activity-builder.js` e `frontend/Parties/layouts/teacher-workspace.css`. Bundle `parties.css` gerado, não editado diretamente. Referências de JS das quatro páginas de avaliações atualizadas para `20260924-3`.

## Resultados verificados

- 16 verificações aprovadas em `tests/teacher-evaluations.html?test=1`: listagem, filtros, busca, prévia sem gabarito, avaliação selecionada, ausência de evidências, recuperação, abertura/fechamento/reset/nome do modal, fila por avaliação e contexto do construtor.
- Em iframe de 320px, construtor com `clientWidth=301` e `scrollWidth=301` (19px de barra vertical). Isso não certifica todos os estados nem simula teclado de aparelho físico.
- Janela de ajuste abriu e fechou manualmente em 320px com campos vazios; nenhuma nota foi enviada.
- Validação sintática dos scripts alterados aprovada.
- `node frontend/Parties/check.mjs`: 96 páginas, incluindo 17 docentes, sem falhas estáticas. Não equivale a 96 testes visuais.
- Não houve publicação no Netlify nem alterações de banco, notas ou permissões.

## Pontos fortes e riscos ainda abertos

Componentes compartilhados e identidade azul já existem; a central distingue listagem, criação e acompanhamento. Os testes isolados permitem reproduzir falhas sem tocar dados escolares.

Continuam pendentes: tabela de resultados e seus cabeçalhos para leitores de tela; estados de erro/carregamento; navegação rápida entre abas; conservação de rascunhos ao sair da página; sidebar durante mudança de largura; formulários da agenda; editor de questões extenso; telas com conteúdo real de cada especialidade. Estes são **cenários de investigação**, não falhas todas confirmadas.

A maior lacuna é a sessão docente: sem ela não se pode concluir a auditoria do produto real nem validar o fluxo professor → aluno. Publicação de conteúdo e correções reais devem ser verificadas em turma/conta de teste apropriada, sem modificar avaliações reais apenas para testar layout.

## Como retomar

Entrar normalmente com uma conta de professor no navegador e começar pelo shell e pela listagem de avaliações. Para cada novo achado, acrescentar uma linha com ID, prioridade, passos, largura, captura antes/depois, arquivos alterados e teste. Só marcar como publicado após implantação e verificação do endereço público.
