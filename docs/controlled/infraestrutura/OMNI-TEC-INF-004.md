# Registro de Incidentes de Infraestrutura

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-INF-004 |
| Versão / status | v1.0 / Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

| ID | Data | Incidente | Impacto | Estado / ação |
| --- | --- | --- | --- | --- |
| INF-2026-001 | 2026-09-09 | projeto temporário da Fase 3 removido | Copiloto sem ambiente remoto | Encerrado; recriar ambiente isolado antes da promoção |
| INF-2026-002 | 2026-09-25 | auditor Node falha de forma intermitente atrás do proxy | auditoria remota incompleta | Aberto; Data API validada por cliente alternativo, revisar transporte Node |
| INF-2026-003 | 2026-09-25 | DDL remoto sem conexão PostgreSQL/Management API | migration de governança pendente | Aberto; conectar CLI autorizada antes de aplicar |

Cada incidente novo registra detecção, ambiente, duração, impacto, contenção, causa, correção, evidência e prevenção. Incidentes de confidencialidade seguem também [SEC-004](../seguranca/OMNI-TEC-SEC-004.md).

## Classificação de impacto

- **Crítico:** indisponibilidade ampla, perda/corrupção de dados ou risco à segurança; resposta imediata.
- **Alto:** jornada principal bloqueada para uma turma ou papel, sem alternativa segura.
- **Médio:** degradação relevante com alternativa temporária documentada.
- **Baixo:** impacto restrito, sem perda e sem bloqueio operacional.

A severidade pode subir ou descer conforme novas evidências. Incidentes com dados pessoais são avaliados também pelo processo de segurança, independentemente do número de usuários afetados.

## Fluxo operacional

1. detectar e abrir identificador único;
2. confirmar ambiente, início, sintomas e serviços relacionados;
3. conter sem destruir evidências;
4. comunicar impacto e alternativa aos responsáveis;
5. restaurar serviço com mudança reversível;
6. validar jornadas críticas e integridade;
7. investigar causa raiz e registrar prevenção;
8. encerrar somente após aprovação do responsável.

## Comunicação

A atualização informa fato confirmado, impacto, ação em andamento e próximo marco, evitando estimativas não sustentadas. Dados pessoais, detalhes exploráveis e secrets não entram em canais gerais. Quando o incidente afeta uma rotina escolar, a comunicação funcional deve explicar o que professores e alunos podem ou não fazer com segurança.

## Pós-incidente e evidências

Incidentes críticos ou recorrentes exigem análise de causa raiz, linha do tempo, controles que falharam, ações com prazo e critério de eficácia. Logs, comandos, versões e capturas são preservados em local restrito. O registro resumido pode apontar para a evidência sem incorporá-la. Reincidência antes da conclusão das ações reabre o incidente original ou cria vínculo explícito.

## Indicadores

Revisar tempo de detecção, contenção, recuperação, reincidência e ações vencidas. Esses indicadores servem para melhorar o processo, não para omitir ocorrências ou atribuir culpa individual.
