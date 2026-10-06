# Banco de dados do OminiSaber

## Instalação nova

No SQL Editor do Supabase, execute somente:

1. `ominisaber-schema-completo.sql`

O arquivo consolida todas as fontes listadas em
`scripts/build-complete-schema.js`, dentro de uma transação. Não execute também os
arquivos individuais na mesma instalação.

## Atualização de banco existente

1. confirme o project ref do destino;
2. consulte as migrations já aplicadas;
3. aplique apenas arquivos ausentes de `migrations/`, em ordem cronológica;
4. rode os verificadores do domínio alterado;
5. consulte advisors de segurança e desempenho.

Não use o schema completo para “forçar” a atualização de uma base com dados sem
antes validar compatibilidade. Não use `DROP` destrutivo como procedimento comum.

## Alterar o schema

1. edite o schema modular ou crie uma nova migration;
2. inclua a migration na ordem de `scripts/build-complete-schema.js`;
3. regenere o arquivo consolidado;
4. execute as validações.

```powershell
npm run schema:build
npm run sql:check
npm run database:governance:check
npm run docs:check
```

O arquivo `ominisaber-schema-completo.sql` é gerado. Não o edite diretamente.

`database:governance:check` também confirma que toda migration está incluída no
schema completo, que as tabelas públicas possuem RLS e que o frontend não referencia
tabelas ausentes. `schema/professor.sql` é uma referência legada e não compõe novas
instalações.

## Garantias esperadas

- migrations estruturais transacionais;
- tabelas públicas com RLS;
- grants mínimos para `anon` e `authenticated`;
- gabaritos e rotinas internas sem acesso indevido do cliente;
- funções privilegiadas com `search_path` e autorização explícitos;
- índices em FKs e filtros frequentes;
- nenhuma chave privada escrita em SQL.

## Fases recentes

- Fases 2.1–2.4: motor de atividades, construtor, execução, correção, resultados e
  recuperação.
- Fase 3.0: tabelas e policies do Copiloto presentes no código, mas sem ambiente
  remoto ativo depois da remoção do projeto temporário.

O inventário cronológico fica em
[Migrations](../docs/database/migrations.md) e a separação de projetos em
[Ambientes e deploy](../docs/development/ambientes-e-deploy.md).
