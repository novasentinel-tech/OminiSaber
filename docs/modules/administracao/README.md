# Módulo do gestor

## Objetivo

Administrar identidade, organização acadêmica, currículo e segurança sem exigir
alterações manuais no banco para operações cotidianas.

## Páginas

- Dashboard;
- Turmas;
- Alunos;
- Professores;
- Vínculos;
- Descritores;
- Conteúdos publicados;
- Acessos e senhas;
- Auditoria;
- Perfil.

## Responsabilidades

- criar e acompanhar contas institucionais;
- atribuir turma e curso aos alunos;
- definir especialidade do professor;
- relacionar professor, turma e matéria;
- manter catálogo de habilidades e descritores;
- acompanhar cobertura curricular e conteúdos publicados;
- redefinir acessos pelo fluxo administrativo protegido;
- consultar eventos de auditoria.

## Vínculos

`professor_turma_materias` é o vínculo canônico. Alterar a turma ou o curso de um
aluno deve atualizar o perfil persistido e a leitura subsequente, não apenas o texto
da tabela na interface.

## Operações sensíveis

Criação de contas e redefinição administrativa usam a Edge Function
`gestor-contas`, com sessão e papel validados no servidor. Secret keys não chegam ao
browser. Operações comuns de dados continuam protegidas por RLS.

## Currículo

O gestor pode cadastrar descritores manualmente ou acompanhar a importação
curricular. Habilidades, descritores, série, trimestre e matéria precisam permanecer
rastreáveis para alimentar o construtor docente e os relatórios.

## Dados principais

`perfis`, `turmas`, `professor_turma_materias`, catálogo curricular,
`solicitacoes_acesso`, `gestor_auditoria`, conteúdos publicados e feature flags.
