# Instalação e atualização do Supabase

## Requisitos atuais

- Node.js 22 ou superior para os clientes e verificadores;
- grants explícitos para tabelas acessadas pela Data API;
- RLS e policies continuam obrigatórios depois do grant.

O Supabase deixou de expor novas tabelas automaticamente à Data API em novos
projetos a partir de 30 de maio de 2026 e aplicará a mudança a todos os projetos em
30 de outubro de 2026. Por isso, uma tabela com RLS correta ainda pode parecer
“inexistente” para o frontend se faltar `GRANT` para `anon` ou `authenticated`.
Consulte o
[aviso oficial da Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

O suporte a Node.js 20 nos clientes Supabase terminou em 30 de junho de 2026.
Consulte o
[aviso oficial de Node.js](https://supabase.com/changelog/45715-deprecation-notice-dropping-support-for-node-js-20).

## Antes de executar SQL

1. confirme o nome e o project ref do destino;
2. determine se o banco está vazio ou já possui o OminiSaber;
3. faça backup quando houver dados relevantes;
4. não execute scripts de limpeza como parte de uma atualização comum.

## Instalação limpa

No SQL Editor, execute somente:

`backend/ominisaber-schema-completo.sql`

O arquivo reúne schema, migrations, funções, triggers, índices, grants e policies em
uma transação. Não execute também os arquivos modulares na mesma instalação.

## Banco existente

Use `backend/migrations/` como histórico incremental. Compare migrations aplicadas,
execute somente as ausentes em ordem cronológica e valide o módulo afetado.

## Regenerar e validar o schema

Na pasta `backend`:

```powershell
npm run schema:build
npm run sql:check
npm run database:governance:check
```

O consolidado é gerado por `scripts/build-complete-schema.js`; não deve ser editado
diretamente.

Após aplicar migrations, execute no SQL Editor, usando uma sessão administrativa:

```sql
select private.database_health_snapshot();
```

O diagnóstico retorna somente metadados e só pode ser executado por `service_role`.
As listas `rls_disabled` e `foreign_keys_without_index` devem permanecer vazias.

## Edge Functions

Funções ficam em `backend/supabase/functions/`. Publique cada função no mesmo
projeto do banco correspondente e configure seus secrets separadamente. Funções
chamadas por usuários devem validar autenticação e autorização, não apenas confiar
na presença de um header.

## Segurança mínima

- RLS em todas as tabelas expostas;
- grants mínimos para `anon` e `authenticated`;
- publishable key no navegador;
- secret/service role apenas no servidor;
- `search_path` definido em funções privilegiadas;
- teste positivo e negativo de cada policy nova;
- execução dos advisors depois de mudanças DDL.

Não use um grant para contornar RLS nem desative RLS para fazer uma tela carregar.
Grant determina se o objeto pode ser alcançado pela API; policy determina quais
linhas o usuário pode acessar.

Consulte [Permissões e RLS](../architecture/permissoes-rls.md) e
[Ambientes e deploy](../development/ambientes-e-deploy.md).
