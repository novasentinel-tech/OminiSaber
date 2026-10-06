# Auditoria do OminiSaber — 23/09/2026

## Conclusão

Há problemas funcionais que devem ser corrigidos antes do acabamento visual. As prioridades são preservar textos e rascunhos, impedir alterações involuntárias em cadastros e fazer o mini IDE refletir o código do aluno.

**Esta é uma auditoria estática ampla com validação visual amostral, não uma certificação de todos os fluxos.** Foram inspecionadas estruturalmente 97 páginas (incluindo a entrada da raiz), 78 arquivos JavaScript e 89 CSS. As páginas restritas de professor, gestor e bibliotecária negaram acesso à sessão de aluno; seus fluxos internos foram revisados pelo código, sem trocar credenciais ou contornar permissões.

Nenhum arquivo funcional do app, cadastro, avaliação, redação ou configuração do banco foi alterado nesta auditoria. Somente este relatório, capturas e dois testes isolados foram criados nesta pasta.

## Cobertura e verificações

- 96 páginas de frontend: 54 aluno, 17 professor, 11 gestor, 7 bibliotecária, 7 públicas.
- Auditoria estática de referências: zero recursos locais ausentes detectados, zero IDs duplicados detectados e zero desequilíbrios de chaves CSS detectados.
- Sintaxe: 78 arquivos JS passaram em `node --check`.
- Componentes Parties: 96 páginas passaram na verificação estrutural.
- Matemática: 3 testes automatizados passaram, incluindo 5.775 combinações de coeficientes quadráticos.
- Checks estáticos de construção de atividades, execução pelo aluno, revisão docente, resultados/recuperação e segurança curricular passaram. Esses scripts verificam padrões de código/SQL; NÃO comprovam execução correta no banco.
- Dois testes isolados reproduziram defeitos reais na lógica existente: salvamento concorrente de redação e pseudoexecução do IDE.
- Layouts observados: desktop, prévia mobile de 320/390 px e tablet de 768 px. Na prévia com scrollbar, larguras úteis foram 301, 371 e 749 px.
- Não foram executados scripts de teste que criam usuários, empréstimos ou dados remotos. Não foram iniciadas novas tentativas nem enviados formulários.

## Prioridades

| ID | Prioridade | Área | Problema | Evidência |
|---|---|---|---|---|
| B01 | P1 — alta | Redação | Uma edição pode não ser salva, enquanto a interface informa “Salvo” | Código + reprodução isolada |
| B02 | P1 — alta | Gestão | Edição repõe série/trimestre/status em valores iniciais | Código; interface administrativa bloqueada |
| B03 | P1 — alta | Mini IDE | “Executar” não executa o pseudocódigo escrito | Código + reprodução isolada |
| B04 | P1 — alta | Mini IDE | Rascunho local não separa alunos no mesmo navegador | Código; troca de contas não realizada |
| B05 | P2 — média | Evolução/Atividades | Matéria e habilidade do atalho são ignoradas | Interface + código |
| B06 | P2 — média | Agenda | Calendário sai da largura útil em tela estreita | Screenshot + medidas DOM |
| B07 | P2 — média | Professor/Redação | Botão de fechar proposta depende dos campos obrigatórios | Markup; reprodução autenticada pendente |
| B08 | P2 — média | Biblioteca | Erro ao consultar PDFs aparece como catálogo vazio | Código; falha de rede não injetada |
| B09 | P2 — média | Biblioteca | Inicialização dispara duas cargas de dados | Código; quantidade de requests não medida |
| A01 | P2 — média | Acessibilidade | Modal da gestão sem gerenciamento de foco; busca da biblioteca anunciada como “search” | Código + árvore de acessibilidade |
| M01 | Melhoria funcional | Resultados | Resultado mostra nota, mas não explica respostas e correção | Interface + código |
| M02 | Prevenção | Dependências | 85 páginas usam supabase-js@2 sem versão exata | Auditoria estática |

P1 não significa exploração ou perda de dados observada em produção. Significa impacto potencial alto demonstrado pela lógica local.

## Bugs e correções propostas

### B01 — Salvamento automático da redação perde a última edição

**O que acontece:** `saveDraft` retorna imediatamente se já existe uma gravação. Uma segunda alteração cujo debounce termine durante a primeira requisição não entra em fila. A primeira resposta marca “Salvo”, embora represente um texto antigo. O planejamento usa o mesmo padrão. “Abrir revisão” também pode prosseguir sem aguardar a gravação em andamento.

**Reprodução isolada:** iniciar gravação A, alterar o texto para B antes da resposta, disparar outra gravação, resolver A. Apenas A foi enviada e a interface indicou “Salvo”.

**Fonte:** [frontend/aluno/laboratorio_de_redacao/script.js:203](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/laboratorio_de_redacao/script.js:203), [frontend/aluno/laboratorio_de_redacao/script.js:330](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/laboratorio_de_redacao/script.js:330), [frontend/aluno/laboratorio_de_redacao/script.js:427](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/laboratorio_de_redacao/script.js:427).

**Proposta:** uma fila serial com revisão/dirty flag; após cada resposta, salvar novamente se o conteúdo mudou. Só confirmar “Salvo” para a revisão atual. Drenar a fila antes de revisão/envio e avisar ao sair com alterações pendentes. Considerar recuperação local isolada por aluno, com política explícita para dispositivos compartilhados.

**Aceitação:** rede lenta + digitação contínua; falha e repetição; abrir revisão enquanto salva; saída da página. Texto final persistido deve ser exatamente o último texto digitado.

Teste: `node docs/auditoria-2026-09-23/reproduce-draft-race.cjs`. Nenhum acesso ao banco.

### B02 — Editar cadastro pode alterar outros campos sem intenção

**Turmas:** o formulário não seleciona `x.serie`; abre em “1º ano”.
**Descritores:** série, trimestre e status também não são preenchidos a partir do registro. Podem retornar a 1 / 1 / ativo ao salvar outro campo.

**Fonte:** [frontend/gestor/shared/gestor-app.js:307](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/gestor/shared/gestor-app.js:307) e [frontend/gestor/shared/gestor-app.js:514](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/gestor/shared/gestor-app.js:514). O fluxo envia esses valores para atualização.

**Proposta:** preencher todos os controles com os valores atuais; padronizar o tipo de série; atualizar apenas campos realmente alterados. Preservar formulário aberto e mostrar erro caso a gravação falhe.

**Aceitação:** editar somente o nome de uma turma de 3º ano e somente o título de um descritor arquivado do 3º trimestre; todos os demais valores devem permanecer intactos. Não executei esses salvamentos na base real.

### B03 — Mini IDE simula um resultado fixo, não o algoritmo do aluno

**O que acontece:** checklist usa expressões regulares; o “console” calcula subtotal/desconto dos controles. A atribuição escrita pelo aluno, condições e saídas não são interpretadas.

**Reprodução isolada:** um comentário com as palavras-chave obteve 100%. Alterar o programa para `total <- 999` não alterou a resposta do console, que continuou usando subtotal 24.

**Fonte:** [frontend/aluno/modulo_de_trilhas/shared/study-app.js:402](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/modulo_de_trilhas/shared/study-app.js:402) e [frontend/aluno/modulo_de_trilhas/shared/study-app.js:447](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/modulo_de_trilhas/shared/study-app.js:447).

**Proposta:** implementar um interpretador pequeno e restrito para entrada, atribuição, expressões, SE/SENAO/FIMSE e saída, com erros por linha e limite de passos; não usar `eval`. Até existir interpretação, rotular honestamente a ferramenta como checklist/simulação de cenário, sem dizer que executa o programa.

**Aceitação:** alterar a lógica deve alterar a saída; comentários não devem completar critérios; sintaxe inválida deve gerar erro; testar os dois ramos e desconto.

Teste: `node docs/auditoria-2026-09-23/reproduce-ide.cjs`. API substituída por stub, sem gravações.

### B04 — Rascunhos do IDE não são isolados por usuário

**O que acontece:** chave `ominisaber:pseudo:v2:${idDaAula}` não inclui o aluno. Duas contas na mesma origem/navegador compartilham o armazenamento da mesma aula. Não foi localizada limpeza dessas chaves ao sair.

**Fonte:** [frontend/aluno/modulo_de_trilhas/shared/study-app.js:384](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/modulo_de_trilhas/shared/study-app.js:384).

**Proposta:** chave por usuário autenticado + aula; política de limpeza no logout; migração cuidadosa dos rascunhos legados, sem atribuí-los automaticamente a quem entrar depois. Se houver sincronização remota futura, exigir isolamento por aluno no servidor.

**Aceitação:** A salva, sai; B entra na mesma aula e não vê nem sobrescreve o rascunho de A. Validação com contas de teste ainda necessária.

### B05 — “Ver atividades” perde matéria e habilidade

**O que aconteceu na interface:** ao sair de EM13MAT103, abriu “Para fazer” vazio. Ao selecionar “Todas”, apareceram também atividades de Português. A URL continha matéria/habilidade, mas a página só lê `atividade`.

**Fonte:** [frontend/aluno/atividades/script.js:802](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/atividades/script.js:802). Também afeta links do mapa de dificuldades e a recomendação na nova Evolução.

**Proposta:** consumir e validar filtros da URL, mostrar o contexto ativo e permitir limpar. Se não houver atividade praticável, explicar e oferecer revisão do conteúdo em vez de recomendar uma tarefa indisponível.

**Aceitação:** atalho de uma habilidade de Matemática não pode listar Português; links diretos e voltar/avançar devem preservar o filtro. Capturas 01–02.

### B06 — Agenda com transbordamento no mobile estreito

**Medida:** prévia de 320 px, largura útil 301 px, documento com 340 px. O calendário termina fora da tela; toolbar/filtro e coluna final ficam cortados. A própria seção de calendário mediu 326 px.

**Fonte:** [frontend/aluno/agenda/style.css:43](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/agenda/style.css:43) e [frontend/aluno/agenda/style.css:336](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/agenda/style.css:336); interação com regras compartilhadas em Parties/mobile.css.

**Proposta:** `minmax(0,1fr)` no contêiner, `min-width:0` nos filhos e toolbar reorganizada sem soma de larguras mínimas. Avaliar lista de eventos como alternativa em telas muito estreitas. Não mascarar com `overflow-x:hidden`.

**Aceitação:** larguras 320, 360, 390, 768 e desktop sem corte; todas as sete colunas e controles acessíveis; repetir com zoom. Captura 04.

### B07 — “Fechar” da proposta docente está dentro da validação do formulário

**O que o markup demonstra:** botão `value="cancel"` não tem `type="button"` nem `formnovalidate`, dentro de formulário com campos obrigatórios. O tratamento de cancelamento só está no evento submit, que a validação nativa pode impedir.

**Fonte:** [frontend/professor/professor_portugues/redacoes/script.js:93](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/professor/professor_portugues/redacoes/script.js:93) e [frontend/professor/professor_portugues/redacoes/script.js:293](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/professor/professor_portugues/redacoes/script.js:293).

**Proposta:** botão explícito que chama `dialog.close()`, com confirmação separada apenas se houver alterações. Alternativa: submit de cancelamento com `formnovalidate`.

**Aceitação:** fechar uma proposta vazia, parcialmente preenchida e inválida deve funcionar; validar Escape e retorno de foco. Reprodução no perfil docente pendente.

### B08 — Falha de PDFs confundida com ausência de materiais

**O que o código faz:** transforma `digitalResult.error` em array vazio, enquanto erros das outras consultas são lançados. O aluno pode receber “nenhum material” durante falha de permissão/rede/consulta.

**Fonte:** [frontend/aluno/biblioteca_digital/script.js:304](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/biblioteca_digital/script.js:304).

**Proposta:** estados independentes para livro/PDF/pedidos, com erro e botão de repetir na seção afetada. Não zerar um catálogo válido por falha de atualização.

**Aceitação:** falhar somente a consulta digital deve mostrar indisponibilidade, sem afirmar que existem zero PDFs. Não foi provocada falha na base.

### B09 — Biblioteca consulta dados duas vezes na inicialização

**O que o código faz:** `init` chama `loadData` tanto em DOMContentLoaded quanto em ominisaber:ready. A proteção existente impede repetir o canal realtime, mas não as consultas. Cada carga busca livros, materiais, pedidos e perfil.

**Fonte:** [frontend/aluno/biblioteca_digital/script.js:346](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/biblioteca_digital/script.js:346) e [frontend/aluno/biblioteca_digital/script.js:375](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/biblioteca_digital/script.js:375).

**Proposta:** iniciar pela prontidão da sessão e deduplicar a promessa em andamento; agrupar atualizações realtime. Verificar o mesmo padrão nos demais módulos.

**Aceitação:** uma carga inicial por recurso; rajadas de eventos não devem multiplicar requisições ou aplicar respostas antigas. Contagem de rede não medida nesta passagem.

## Acessibilidade e melhorias, separadas dos bugs

### A01 — Semântica/foco

- Modal compartilhado da gestão é um div/form sem papel de diálogo, foco inicial, contenção de foco ou Escape explícito: [frontend/gestor/shared/gestor-app.js:77](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/gestor/shared/gestor-app.js:77). Risco confirmado na implementação; teste assistivo no perfil gestor pendente. Preferir dialog nativo e restaurar foco.
- Busca da biblioteca aparece na árvore acessível como “search”, nome do ícone, em vez de “Buscar no acervo”: [frontend/aluno/biblioteca_digital/index.html:130](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/biblioteca_digital/index.html:130). Adicionar rótulo textual e ocultar o ícone de leitores.
- Abas docentes marcam seleção por classe visual, sem aria-selected atualizado. Conferir teclado e relações tab/panel.
- Não foi realizada certificação WCAG, auditoria exaustiva de contraste ou teste com leitor de tela real.

### M01 — Resultado pouco útil para aprender

Na avaliação concluída observada, a tela exibe nota 2,5, percentual 25%, tentativa 3/3 e retorno. Não mostra respostas, pontos por questão nem devolutiva. Não é falha de cálculo demonstrada, mas uma lacuna pedagógica importante.

Fonte: [frontend/aluno/atividades/script.js:541](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/frontend/aluno/atividades/script.js:541). Proposta: revisão por questão e critérios/feedback, respeitando a política docente de liberação do gabarito e o período da avaliação. Captura 03.

### M02 — Dependência sem versão exata

85 páginas carregam supabase-js@2. Isso permite atualização fora de uma entrega controlada. Proposta: fixar versão exata validada ou servir bundle versionado; testar autenticação, consultas e realtime antes de atualizar. É risco preventivo, não incidente comprovado.

### Acabamento visual

Biblioteca e página de acesso negado ainda apresentam roxo/gradiente diferente do azul compartilhado. Corrigir após os problemas funcionais. Não redesenhar todo o app antes de estabilizar os fluxos.

## Percurso visual desta execução

1. **Desempenho — parcial:** conteúdo e filtros presentes; atalho de atividade não mantém contexto.
2. **Atividades — problema confirmado:** destino abre filtro padrão vazio; “Todas” inclui matérias não solicitadas.
3. **Resultado — funciona com limitação:** nota aparece, mas sem revisão detalhada.
4. **Agenda mobile — problema confirmado:** calendário excede a largura útil.
5. **Acesso restrito — bloqueio esperado:** sessão de aluno não entra em professor/gestor/bibliotecária. Fluxos internos não auditados visualmente.
6. **Biblioteca mobile — layout sem overflow na amostra:** catálogo vazio; não foi possível avaliar pedidos/devoluções com dados. Busca tem problema de nome acessível.
7. **Redação mobile — apresentação inicial sem overflow na amostra:** texto não editado; defeito de gravação testado isoladamente.
8. **Dashboard tablet — apresentação sem overflow na amostra:** conteúdo e navegação presentes; não acionei conclusão de aula.

## Capturas aceitas

### 01 — Desempenho
![Desempenho](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/docs/auditoria-2026-09-23/01-desempenho.png)

### 02 — Destino do atalho
![Atividades sem contexto do filtro](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/docs/auditoria-2026-09-23/02-atividades-sem-filtro.png)

### 03 — Resultado
![Resultado sem revisão detalhada](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/docs/auditoria-2026-09-23/03-resultado.png)

### 04 — Agenda estreita
![Agenda com calendário cortado](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/docs/auditoria-2026-09-23/04-agenda-mobile.png)

### 05 — Acesso restrito
![Bloqueio esperado por perfil](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/docs/auditoria-2026-09-23/05-acesso-restrito.png)

### 06 — Biblioteca
![Biblioteca no celular](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/docs/auditoria-2026-09-23/06-biblioteca-mobile.png)

### 07 — Redação
![Entrada da redação no celular](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/docs/auditoria-2026-09-23/07-redacao-mobile.png)

### 08 — Dashboard
![Dashboard no tablet](C:/Users/CLEVERSON/Downloads/OminiSaber-main/OminiSaber-main/docs/auditoria-2026-09-23/08-dashboard-tablet.png)

## Ordem recomendada de execução

1. **Integridade e privacidade:** B01, B02 e B04. Testes de regressão antes de mexer no visual.
2. **Verdade funcional do IDE:** B03, com escopo de linguagem documentado e casos positivos/negativos.
3. **Navegação e confiabilidade:** B05, B07, B08 e B09.
4. **Responsividade/acessibilidade:** B06 e A01, com verificação de teclado e zoom.
5. **Melhorias:** M01, M02 e consistência de cores.

Para fechar a auditoria comportamental das outras áreas, serão necessárias sessões de teste autorizadas de professor, gestor e bibliotecária, preferencialmente em ambiente separado. Não é necessário enviar senhas no chat. RLS efetiva, permissões de Storage, Edge Functions implantadas, e operações reais de envio/correção/empréstimo permanecem fora da validação executada.

