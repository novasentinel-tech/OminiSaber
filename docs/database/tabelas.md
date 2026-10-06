# Tabelas principais

## Identidade e vínculos

- `perfis`: extensão de `auth.users`, com papel, matrícula, turma, curso e
  especialidade.
- `turmas`: grupos letivos.
- `professor_turma_materias`: vínculo canônico entre professor, turma e matéria.
- `professor_turmas`: compatibilidade com módulos antigos.

## Catálogo curricular

- `curriculos` e `curriculo_periodos`;
- `habilidades_curriculares` e `habilidade_curriculo_periodos`;
- `descritores_curriculares` e `descritor_curriculo_periodos`;
- `habilidade_descritores`, `objetos_conhecimento`, `habilidade_objetos` e
  `expectativas_aprendizagem`;
- `documentos_curriculares`, `importacoes_curriculo` e itens de importação.

## Motor de atividades

- `avaliacoes_docentes`: cabeçalho canônico de atividades e avaliações;
- `questoes_avaliacao`: enunciado, formato, configuração e pontos;
- `gabaritos_avaliacao`: resposta esperada, protegida do aluno;
- `questoes_avaliacao_habilidades`: evidência curricular por questão;
- `avaliacoes_versoes`: snapshot entregue;
- `tentativas_avaliacao` e `respostas_avaliacao`: execução do aluno;
- `avaliacoes_auditoria` e `ajustes_notas_avaliacao`: rastreabilidade.

## Jornada do aluno

`trilhas`, etapas, conteúdos, tentativas interativas, favoritos, anotações,
progresso, histórico, XP e conquistas sustentam a experiência de estudo. O painel
de dificuldade do motor usa evidências corrigidas, não percentuais locais.

## Redação, agenda e biblioteca

- redação: propostas, redações, versões, planejamentos, repertórios, comentários,
  competências e rascunhos de correção;
- agenda: `eventos_agenda`, `notificacoes` e `notificacoes_lidas`;
- biblioteca: materiais digitais, livros físicos, exemplares, solicitações,
  empréstimos, seções e operações de estoque.

## Copiloto

- `feature_flags` e `feature_flag_usuarios`;
- `copiloto_sessoes`, `copiloto_execucoes` e `copiloto_feedback`.

Essas tabelas registram contexto e operação; não concedem ao modelo permissão para
publicar atividade ou alterar nota.
