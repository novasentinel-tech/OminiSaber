# Procedimento de Deploy

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-OPS-001 |
| Versão / status | v1.0 / Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

## Preparação

1. identificar ambiente, project ref e responsável;
2. revisar mudanças, migrations e impactos;
3. sincronizar somente configuração pública;
4. executar checks de código, banco, módulos e documentação;
5. confirmar backup e reversão quando houver DDL ou dados.

## Ordem

Banco e migrations compatíveis, Edge Functions e secrets, frontend estático, smoke tests e monitoramento. Uma instalação existente nunca recebe o schema completo para forçar atualização.

## Verificação

Testar login, rota protegida, jornada alterada, desktop e celular, console/rede, RLS permitido e negado. Registrar a implantação em [OPS-002](OMNI-TEC-OPS-002.md). Detalhes de ambiente estão em [Ambientes e deploy](../../development/ambientes-e-deploy.md).

## Papéis e autorização

O solicitante define escopo e urgência; o executor aplica a versão; o revisor confirma checks e risco; o aprovador autoriza produção. Em equipe pequena, acúmulo de papel é registrado. Acesso de deploy é nominal, temporário quando possível e regido por SEC-003.

## Checklist detalhado

- identificar commit/ref, changelog e artefatos;
- confirmar variáveis públicas, secrets e origens por ambiente;
- reconciliar migrations aplicadas e pendentes;
- validar backup e procedimento de restauração;
- executar `docs:check`, `system:audit`, governança do banco e checks dos módulos afetados;
- registrar avisos aceitos, responsável e prazo;
- publicar na ordem de dependência e evitar janela acadêmica crítica;
- executar smoke tests com pelo menos um papel permitido e um negado.

## Banco e compatibilidade

Preferir mudanças compatíveis em duas fases: adicionar antes de exigir e remover somente após consumidores migrarem. DDL destrutivo requer análise de dados, backup e plano de reversão; migrations já aplicadas não são reescritas silenciosamente. O schema consolidado é atualizado junto com a migration.

## Rollback

O gatilho inclui falha de login, erro relevante, perda de autorização, inconsistência ou degradação sem correção segura. Reverter frontend e function para versão conhecida; banco usa rollback transacional ou migration corretiva conforme risco. Não apagar dados gerados durante a janela sem reconciliação.

## Comunicação e encerramento

Antes da janela, comunicar escopo, impacto e contato. Durante incidente, informar fatos e decisão. O deploy encerra após checklist pós-deploy, registro em OPS-002 e ausência de alerta bloqueante na janela inicial. Falhas seguem INF-004 ou SEC-004.

## Deploy emergencial

Pode reduzir etapas de aprovação, mas nunca dispensa identificação da versão, backup quando aplicável, validação mínima e registro posterior. A revisão retrospectiva deve ocorrer no próximo dia útil e produzir ação preventiva quando o atalho revelar lacuna de processo.
