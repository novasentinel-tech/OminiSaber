# Banco de Dados OmniSaber

## Novo ambiente

Execute somente:

`../ominisaber-schema-completo.sql`

Esse arquivo representa o estado atual completo do banco para uma instalação nova.

## Ambiente existente

Execute apenas as migrations pendentes em:

`../migrations/`

As migrations são o histórico incremental do banco e não devem ser removidas depois de incorporadas ao schema completo.

## Desenvolvimento

Os schemas divididos por domínio estão nesta pasta. Eles são a fonte organizada para manutenção humana e são usados pelo gerador do schema completo.

Arquivos principais:

- `core.sql`: tipos, perfis, turmas e núcleo da aplicação.
- `professor.sql`: referência de compatibilidade para bancos antigos. É legado,
  não compõe o schema completo e não deve receber estruturas novas.
- `biblioteca.sql`: biblioteca e materiais.
- `configuracoes.sql`: configurações.
- `conquistas.sql`: conquistas e medalhas.
- `espacos-docentes.sql`: laboratórios e recursos docentes.
- `estoque-etapa1.sql` e `estoque-etapa2.sql`: estoque e seções físicas.

A ordem operacional completa está em [`../README-SQL.md`](../README-SQL.md). Não execute schemas parciais junto do schema completo no mesmo ambiente novo.
