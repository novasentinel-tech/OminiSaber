# Relacionamentos críticos

## Identidade

- `perfis.id -> auth.users.id`;
- `perfis.turma_id -> turmas.id` para a turma principal do aluno;
- `professor_turma_materias.professor_id -> perfis.id`;
- `professor_turma_materias.turma_id -> turmas.id`.

## Currículo e atividades

- períodos pertencem a currículos;
- habilidades e descritores se relacionam por `habilidade_descritores`;
- questões se ligam a habilidades por `questoes_avaliacao_habilidades`;
- avaliações pertencem ao professor e apontam para turma e matéria;
- versões, questões e tentativas pertencem a uma avaliação;
- respostas pertencem simultaneamente à tentativa, questão e aluno.

## Resultados

`ajustes_notas_avaliacao` referencia tentativa, avaliação, aluno e responsável pelo
ajuste. A recuperação guarda a avaliação de origem na configuração e copia somente
questões vinculadas às habilidades selecionadas.

## PostgREST e FKs ambíguas

`perfis`, `turmas` e outras tabelas aparecem em mais de um papel na mesma entidade.
Quando houver múltiplas FKs para o mesmo destino, use o nome exato da constraint no
select, por exemplo `perfis!eventos_agenda_professor_id_fkey(...)`. Não dependa da
inferência automática do cache do schema.

## Regra de autorização

Não confunda `perfis.turma_id` do aluno, `professor_turmas` legado e
`professor_turma_materias` canônico. Para atividades novas, o último define a
combinação autorizada de docente, turma e disciplina.
