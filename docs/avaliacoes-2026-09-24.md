# Central docente de avaliações

Implementação inicial compartilhada em `frontend/Parties/teacher-evaluations.js` e `frontend/Parties/layouts/teacher-evaluations.css`, integrada às quatro especialidades existentes.

## Disponível

- Listagem, busca, filtros por turma, trimestre e situação.
- Contexto e área selecionada persistidos no fragmento da URL.
- Construtor existente integrado, recebendo turma e trimestre selecionados.
- Revisão das instruções e questões sem renderização de gabaritos.
- Publicação explícita de rascunhos pela API existente, com confirmação.
- Duplicação sem sobrescrever o original; datas precisam de nova definição.
- Acompanhamento e correção abertos na avaliação escolhida.
- Recuperação por habilidade reutilizando a rotina existente, sem substituir nota original.
- Habilidades sem evidências não são apresentadas como 0% nem pré-selecionadas como dificuldade.

## Validação

`tests/teacher-evaluations.html?test=1` executa doze verificações com dados fictícios e APIs isoladas, sem acesso ao banco. Foram aprovadas listagem, filtro, busca, diálogo, ausência de gabarito, seleção da avaliação, ausência de evidências, recuperação sem seleção indevida, fila, correção limitada à avaliação escolhida, contexto da criação e etapas do construtor. JavaScript verificado com `node --check`; cobertura Parties de 96 páginas sem falhas. Revisão visual desktop e viewport estreito de 320px. Sem overflow horizontal na listagem e criação em 320px e na listagem em 768px.

A sessão disponível é de aluno e foi corretamente bloqueada na rota docente. Publicação, entrega, correção e recuperação com persistência real ainda precisam de validação com conta de professor e turma de teste autorizada. Nenhuma nota ou publicação real foi criada.

## Ainda não implementado nesta etapa

Planejamento/importação do Word; especialidade Química; aplicações externas/presenciais com registro de evidências; grupos e avaliação individual em projeto; seleção individual de destinatários da recuperação; criação automática de eventos de agenda; edição transacional do rascunho original. A criação atual continua baseada em questões e uma turma por avaliação. A revisão é textual e não simula os widgets interativos do aluno.

Não houve alteração de schema, políticas de acesso ou publicação no Netlify.
