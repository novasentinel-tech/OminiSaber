# Módulo do professor

## Objetivo

Reduzir o trabalho operacional do professor para planejar, publicar, acompanhar e
recuperar aprendizagem por descritor.

## Especialidades

- Matemática;
- Português;
- Técnico em Administração;
- Técnico em Informática.

Cada especialidade tem dashboard, linguagem visual, laboratório e sugestões de
formatos próprios. Sidebar, sessão, vínculos, atividade, correção e resultados usam
componentes e regras compartilhadas.

## Permissão

`perfis.tipo_professor` identifica a experiência visual. A autorização pedagógica
vem de `professor_turma_materias`, que precisa conter a combinação ativa de
professor, turma e matéria. Um professor pode ter vários vínculos.

## Fluxos

- visão geral de turmas e pendências;
- laboratórios ou oficinas por especialidade;
- construtor de atividades baseado em currículo;
- avaliações e publicação;
- fila de correção de questões abertas;
- resultados por aluno, questão e descritor;
- ajuste de nota auditável;
- criação de recuperação focada;
- agenda das turmas;
- redações na especialidade de Português.

## Componentes compartilhados

`frontend/professor/specialty/` contém portal, configurações, construtor, correção,
resultados e Copiloto. A identidade pode variar, mas pontuação, validação, auditoria
e segurança não variam por disciplina.

## Copiloto

Na Fase 3, o professor pode pedir uma sugestão no construtor. O resultado é uma
prévia editável: não publica, não corrige alunos e não altera notas. O recurso usa
ambiente e feature flag separados durante a validação.

## Dados principais

`perfis`, `turmas`, `professor_turma_materias`, catálogo curricular,
`laboratorios_docentes`, `avaliacoes_docentes`, questões, versões, tentativas,
respostas, auditoria, redações e agenda.
