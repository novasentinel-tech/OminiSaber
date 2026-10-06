# Permissões e Row Level Security

## Princípio

Toda tabela exposta pela Data API deve ter RLS. A regra efetiva combina grants e
policies; filtros do frontend existem apenas para experiência de uso.

## Escopos

| Papel         | Escopo principal                                                      |
| ------------- | --------------------------------------------------------------------- |
| Aluno         | Perfil e produção próprios; conteúdo publicado para sua turma         |
| Professor     | Perfil próprio; turmas e matérias vinculadas; produção de sua autoria |
| Gestor        | Administração institucional autorizada e auditoria                    |
| Bibliotecária | Acervo, exemplares e circulação, sem acesso pedagógico indevido       |

## Vínculo docente canônico

`professor_turma_materias` é a fonte atual para autorização por disciplina. A tabela
`professor_turmas` permanece para compatibilidade e sincronização de módulos antigos,
mas código novo não deve inferir autorização apenas dela nem de `perfis.turma_id`.

## Funções auxiliares

Policies e RPCs usam `auth.uid()`, `usuario_role()`, `usuario_turma_id()`,
`usuario_tipo_professor()` e verificações de vínculo. Funções `SECURITY DEFINER`
devem definir `search_path`, validar a sessão e receber apenas os grants necessários.

## PostgREST

Quando duas ou mais FKs ligam as mesmas tabelas, a consulta deve indicar a constraint
explicitamente. Isso evita o erro de relacionamento ambíguo e impede que uma página
dependa de heurística do cache do schema.

## Regras operacionais

- não desligar RLS para corrigir uma tela;
- testar leitura e escrita permitidas e negadas;
- nunca conceder `service_role` ou secret key ao navegador;
- revisar advisors após migrations;
- tratar dados de teste com as mesmas policies usadas no fluxo real.
