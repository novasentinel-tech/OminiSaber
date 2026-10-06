# Controle de Branches e Versionamento

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-DEV-005 |
| Versão | v1.0 |
| Status | Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

## Política

- `main` representa a versão integrável e deve permanecer implantável;
- mudanças usam branches curtas: `feat/`, `fix/`, `docs/`, `refactor/`, `test/` ou `chore/`;
- commits descrevem uma unidade coerente e não misturam correção com limpeza ampla;
- migrations já aplicadas não são reescritas; correções entram em nova migration;
- arquivos gerados, como o schema consolidado, são regenerados junto das fontes;
- releases futuras seguem `MAJOR.MINOR.PATCH`; até a primeira release formal, documentos usam versões próprias.

## Integração

Antes de integrar: revisar diferenças, executar verificadores relevantes, confirmar ausência de segredos, atualizar documentação e registrar alterações operacionais. Mudanças de banco ou autenticação exigem plano de reversão e validação por papel.

## Fluxo de branch

Uma branch parte da referência estável, limita-se a um objetivo e é atualizada antes
da integração. O nome inclui intenção e tema, por exemplo `fix/agenda-mobile` ou
`docs/controle-tecnico`. Mudanças experimentais permanecem isoladas e não são usadas
como dependência silenciosa por código estável.

## Requisitos de revisão

A revisão identifica escopo, risco, arquivos gerados, migrations, efeitos em
configuração e evidências. O autor não omite falhas conhecidas nem mistura segredos.
Conflitos em migration são resolvidos criando sequência determinística, nunca
alterando um arquivo já executado em ambiente compartilhado.

## Versionamento de banco e documentos

Migrations usam timestamp crescente e descrição. O schema consolidado é regenerado
na mesma mudança. Documentos controlados usam versão própria: correção editorial
pode manter a versão; conteúdo material incrementa a revisão; mudança de política ou
escopo incrementa versão conforme decisão do responsável.

## Releases e rollback

Uma release registra referência do código, ambiente, migrations e resultados de
smoke test. Rollback de frontend pode reimplantar artefato anterior. Banco exige
migration reversível ou corretiva compatível com dados já gravados. Nunca usar
`reset --hard`, limpeza ampla ou restauração sem confirmar alvo e backup.

## Proteção da linha principal

Quando o repositório remoto estiver configurado, a linha principal deve exigir
revisão e verificações automatizadas. Acesso de escrita segue menor privilégio e é
revogado quando deixa de ser necessário.
