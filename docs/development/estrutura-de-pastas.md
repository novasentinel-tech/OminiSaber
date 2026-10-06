# Estrutura de pastas

## Objetivo

Localizar rapidamente código, SQL e documentação.

## Estrutura

- `frontend/aluno/`: módulos do aluno.
- `frontend/professor/`: área docente.
- `frontend/gestor/`: administração.
- `frontend/bibliotecaria/`: biblioteca.
- `frontend/shared/` e `frontend/*/shared/`: recursos visuais e shells.
- `backend/`: cliente, configuração, schemas, migrations, scripts e functions.
- `engine/`: aplicação isolada para autoria e avaliação de trabalhos interativos.
- `docs/`: documentação organizada por assunto.
  - `docs/controlled/`: 28 documentos técnicos canônicos identificados por código.
  - `docs/governance/`: controle documental e regras de manutenção.
  - `docs/modules/`: contratos detalhados por domínio.
  - `docs/legacy/`: histórico não normativo.

## Pontos de atenção

Mantenha documentação normativa em `docs/`; README local deve apontar para ela sem duplicar contratos extensos. Todo documento controlado precisa constar em `OMNI-FRM-000-002` e passar por `npm --prefix backend run docs:check`.
