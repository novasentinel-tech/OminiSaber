# Backend Supabase do OminiSaber

O backend reúne schema PostgreSQL, migrations, cliente compartilhado, Edge
Functions e verificadores. Autenticação e persistência usam Supabase; autorização
permanece no banco por RLS e funções validadas.

Use Node.js 22 ou superior para os scripts deste diretório.

## Configuração

Preencha `.env` na raiz e gere a configuração pública:

```powershell
npm run env:sync
```

O script copia somente `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` ou a chave
`anon` legada. `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e
`GEMINI_API_KEY` nunca são copiadas para o navegador.

Consulte [ambientes e deploy](../docs/development/ambientes-e-deploy.md) antes de
alternar entre beta e Fase 3.

## Instalação do banco

Para um banco novo, execute apenas `ominisaber-schema-completo.sql`. Para um banco
existente, aplique somente migrations ausentes em ordem cronológica. Instruções
detalhadas estão em [README-SQL.md](README-SQL.md).

## Cadastro e perfis

O cadastro público usa `auth.signUp` e cria somente `role = aluno`. Contas de
professor, gestor e bibliotecária são administrativas. O login aceita matrícula ou
e-mail; o perfil define a rota e as policies definem o acesso real.

## Dados de teste

O seed docente de Português é opcional, idempotente e grava dados no projeto
selecionado pelo `.env`:

```powershell
npm run teacher:demo:seed
```

Ele exige secret/service role key e deve ser usado somente em ambiente de teste.
Nunca execute seeds em produção ou em um projeto cujo destino não tenha sido
confirmado.

## Verificações

```powershell
npm run schema:build
npm run sql:check
npm run docs:check
npm run auth:check
npm run manager:check
npm run curriculum:check
npm run curriculum:security:check
npm run library:check
npm run teacher:portuguese:check
npm run activity:builder:check
npm run activity:student:check
npm run activity:teacher-review:check
npm run activity:results:check
npm run copilot:check
npm run system:audit
npm run system:audit:remote
```

Cada verificador cobre um contrato específico. Aprovação local não substitui teste
integrado com usuários e RLS no projeto Supabase de destino.

`system:audit` valida arquivos locais. `system:audit:remote` é somente leitura e
confere integridade do projeto selecionado pelo `.env`; sempre confira o host
impresso. O teste integrado da biblioteca aceita `TEST_STUDENT_PASSWORD` e
`TEST_LIBRARIAN_PASSWORD` no ambiente para não gravar credenciais no código.

## Documentação relacionada

- [Arquitetura do backend](../docs/architecture/backend.md)
- [Motor de atividades](../docs/modules/motor-atividades/README.md)
- [Copiloto docente](../docs/modules/copiloto-docente/README.md)
- [Permissões e RLS](../docs/architecture/permissoes-rls.md)
- [Fluxogramas](../docs/architecture/fluxogramas.md)
- [Auditoria geral](../docs/development/auditoria-sistema-2026-09-09.md)
- [Controle documental](../docs/governance/controle-de-formularios.md)
