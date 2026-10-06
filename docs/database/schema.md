# Schema do banco

## Fonte de verdade

- instalação limpa: `backend/ominisaber-schema-completo.sql`;
- evolução: `backend/migrations/`;
- estruturas-base por domínio: `backend/schema/`;
- ordem de composição: `backend/scripts/build-complete-schema.js`.

O schema completo é gerado e transacional. Altere as fontes, execute
`npm run schema:build` e valide com `npm run sql:check` e
`npm run database:governance:check`.

`backend/schema/professor.sql` é mantido somente como referência de compatibilidade
para bancos antigos. Ele não compõe instalações novas; o núcleo docente canônico
está distribuído entre `core.sql`, `espacos-docentes.sql` e as migrations do motor.

## Domínios

| Domínio      | Conteúdo principal                                                    |
| ------------ | --------------------------------------------------------------------- |
| Identidade   | perfis, papéis, turmas, cursos e vínculos docentes                    |
| Currículo    | currículos, períodos, habilidades, descritores, objetos e importações |
| Aprendizagem | trilhas, conteúdos, progresso, histórico, favoritos e evolução        |
| Atividades   | avaliações, questões, gabaritos, versões, tentativas e respostas      |
| Redação      | propostas, planejamento, repertórios, versões e correções             |
| Agenda       | eventos, notificações e leituras                                      |
| Biblioteca   | materiais, livros, exemplares, solicitações e empréstimos             |
| Gestão       | acessos, conteúdos publicados e auditoria                             |
| Copiloto     | flags, sessões, execuções e feedback                                  |

## Convenções essenciais

- UUID em entidades de domínio; identity bigint apenas quando adequado a logs;
- timestamps com fuso (`timestamptz`);
- FKs com comportamento de exclusão explícito;
- checks para estados, limites e formato JSON;
- índices nas relações e filtros frequentes;
- RLS e grants explícitos em tabelas públicas.
