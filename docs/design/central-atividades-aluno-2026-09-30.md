# Central de atividades do aluno

Implementação de 30 de setembro de 2026 baseada nas três referências aprovadas.

## Organização

- **Para fazer:** quadro por urgência com Hoje, Próximos dias e Sem prazo.
- **Entregues:** histórico cronológico com situação, nota e acesso ao resultado.
- **Todas:** agrupamento por disciplina, resumo de progresso e atividades relacionadas.

## Comportamento

- Busca por título, instrução ou disciplina.
- Filtro de disciplina conectado ao parâmetro `materia` recebido da página inicial.
- Ações de começar, continuar e ver resultado preservam as rotas existentes.
- Estados de prova agendada, prazo encerrado e Prova Segura continuam respeitados.

## Integração com o Supabase

- A listagem usa `avaliacoes_docentes` e respeita a RLS existente: o aluno recebe somente publicações da própria turma. Atividades encerradas continuam disponíveis no histórico, mas nunca reaparecem como acionáveis.
- Questões vêm de `questoes_avaliacao`; nenhum gabarito é solicitado na tela do aluno.
- A tentativa atual e a nota vêm de `tentativas_avaliacao`.
- O progresso é calculado pela quantidade de questões com resposta efetivamente salva em `respostas_avaliacao`, sem percentual simulado.
- Novas atividades guardam em `configuracao.author` um snapshot mínimo e seguro do autor (`id` e `name`) obtido do perfil autenticado do professor. Isso permite exibir o nome sem liberar a tabela completa de perfis ao aluno.
- Atividades antigas, que não possuem o snapshot, exibem o rótulo neutro `Professor(a) de <disciplina>`.
- O utilitário `backend/scripts/backfill-evaluation-authors.js` preenche esse snapshot nos rascunhos anteriores usando exclusivamente a chave de serviço no ambiente administrativo; essa chave nunca é enviada ao navegador. Publicações antigas permanecem imutáveis por regra do banco e usam o fallback por disciplina.

### Contrato mínimo consumido

```text
avaliacoes_docentes
  ├─ id, titulo, materia_codigo, categoria, duracao_minutos, valor
  ├─ abre_em, encerra_em, configuracao.author
  ├─ questoes_avaliacao[]: id, ordem, tipo, enunciado, pontos
  └─ tentativas_avaliacao[]
       ├─ status, nota, numero_tentativa, enviada_em, corrigida_em
       └─ respostas_avaliacao[]: questao_id, resposta, updated_at
```

O relacionamento aninhado é resolvido pelas chaves estrangeiras do PostgREST. As políticas de `tentativas_avaliacao` e `respostas_avaliacao` limitam os registros ao usuário autenticado.

## Responsividade

- Acima de 1120 px: quadro em três colunas.
- Entre 701 e 1120 px: quadro em duas colunas.
- Até 700 px: conteúdo em uma coluna.
- Até 520 px: controles, linhas e ações empilhados, com botões em largura total.
- Até 380 px: abas dividem igualmente a largura disponível.

## Evidências e QA

- Fixture visual: `tests/student-activities-responsive.html`.
- Comparação conjunta: `tests/student-activities-comparison.html`.
- Testes estáticos: `tests/student-activities-layout.test.mjs`.
- Relatório final: `design-qa.md`.
- Validação remota autenticada: o contrato completo retornou 5 atividades e 6 tentativas próprias para a conta de aluno de teste, sem vazamento de tentativas de terceiros.
