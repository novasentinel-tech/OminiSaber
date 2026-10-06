# Estrutura de Projeto

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-DEV-002 |
| Versão | v1.0 |
| Status | Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Criação / revisão | 2026-09-25 |

```text
OminiSaber/
├─ frontend/              páginas por papel e recursos compartilhados
├─ backend/
│  ├─ schema/             estruturas-base por domínio
│  ├─ migrations/         evolução incremental do banco
│  ├─ scripts/            geração, auditoria e verificadores
│  └─ supabase/functions/ Edge Functions
├─ engine/                autoria interativa isolada
├─ docs/                  contratos, guias, registros e evidências
└─ tests/                 fixtures e regressões de interface
```

## Fonte de verdade

- comportamento executável: `frontend`, `backend` e `engine`;
- banco novo: `backend/ominisaber-schema-completo.sql`;
- banco existente: migrations pendentes;
- contratos atuais: `docs` fora de `legacy`;
- histórico: `docs/legacy` e auditorias datadas.

Não duplique contratos extensos em READMEs locais. Eles devem apontar para a documentação controlada e para o guia do módulo correspondente. Veja [estrutura detalhada](../../development/estrutura-de-pastas.md).

## Responsabilidade por diretório

`frontend` contém artefatos públicos e não recebe secrets ou ferramentas
administrativas. `backend` reúne fontes do banco, clientes compartilhados, scripts e
Edge Functions; o schema consolidado é gerado e não editado diretamente. `engine`
mantém build e testes próprios para não impor dependências ao frontend estático.
`docs` separa contratos atuais, registros controlados, guias de módulo, auditorias e
histórico. `tests` concentra fixtures e páginas de regressão que não devem ser
publicadas como produto.

## Convenções de localização

Uma página possui `index.html`, estilo e script no mesmo domínio quando não houver
componente compartilhado. Recursos usados por vários perfis ficam em `frontend/shared`.
SQL base fica em `backend/schema`; mudanças após a instalação inicial entram em
`backend/migrations`. Um novo script de verificação pertence a `backend/scripts` e
ganha comando no `package.json`.

## Arquivos gerados e temporários

`backend/ominisaber-schema-completo.sql` é gerado. Builds da engine ficam em
`engine/dist`. Credenciais permanecem em `.env` ignorado. Capturas de auditoria
podem ficar em diretório datado dentro de `docs`, acompanhadas por relatório que
explique cenário e estado. Artefatos temporários não entram em caminhos públicos.

## Regras para criação e remoção

Antes de criar nova pasta, confirme se o domínio existente atende. Ao mover uma
página, ajuste rotas, imports, navegação, documentação e auditor de referências. Não
remova migrations incorporadas nem documentação histórica necessária para entender
decisões. Conteúdo obsoleto passa para `legacy` com contexto, em vez de continuar
parecendo contrato atual.

## Verificação estrutural

`system:audit` percorre HTML, CSS e JavaScript; `docs:check` percorre Markdown;
`database:governance:check` cruza schema, migrations e tabelas usadas. A estrutura só
está consistente quando os três passam e os fluxos alterados foram abertos por HTTP.
