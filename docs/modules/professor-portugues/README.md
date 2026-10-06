# Professor de Português

## Objetivo

Concentrar a experiência de linguagem, oficina, avaliações e correção de redações.

## Estrutura

- `frontend/professor/professor_portugues/dashboard/`
- `frontend/professor/professor_portugues/laboratorio/`
- `frontend/professor/professor_portugues/avaliacoes/`
- `frontend/professor/professor_portugues/redacoes/`
- `frontend/professor/specialty/`

## Funcionamento

A área valida `tipo_professor = portugues`, carrega turmas reais e restringe propostas, submissões e correções aos alunos das turmas vinculadas.

As telas não mantêm listas simuladas no JavaScript. Para preparar um ambiente de desenvolvimento com registros persistidos no Supabase, execute `npm run teacher:demo:seed` dentro de `backend/`. O seed é idempotente e cria uma professora, uma turma, três alunos, uma avaliação objetiva com tentativas, dois laboratórios, duas redações e três compromissos de agenda.

## Banco de dados

Usa propostas, redações, competências, comentários, rascunhos de correção, avaliações e agenda.

## Pontos de atenção

O vínculo canônico por disciplina é `professor_turma_materias`. `professor_turmas` é mantida por compatibilidade com módulos antigos; nenhuma tela deve inferir o vínculo docente apenas por `perfis.turma_id`.
