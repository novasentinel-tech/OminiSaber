# Registro de Deploys

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-OPS-002 |
| Versão / status | v1.0 / Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

| Data | Ambiente | Escopo | Banco | Resultado |
| --- | --- | --- | --- | --- |
| 2026-09-25 | Local | organização documental OMNI-FRM-000-002 | sem alteração remota | verificadores locais aprovados |
| 2026-09-25 | Local | governança do banco | migration criada; promoção pendente | SQL e schema consolidados aprovados |

Deploys futuros registram versão/ref, executor, janela, migrations, functions, frontend, smoke tests, ocorrências e rollback. O registro não armazena tokens, URLs secretas ou dados de usuários.

## Finalidade

O registro permite saber exatamente o que foi promovido, por quem, quando e com qual resultado. Ele sustenta diagnóstico, rollback, auditoria e comunicação. Build local, homologação e produção são entradas distintas; uma aprovação em ambiente inferior não deve ser confundida com implantação produtiva.

## Campos obrigatórios

Cada entrada inclui identificador, data/hora, ambiente, commit/ref, solicitante, executor, aprovador, escopo, artefatos, migrations, Edge Functions, alterações de configuração, checks anteriores, início/fim, smoke tests, incidentes e decisão final. Quando não houver alteração em uma camada, registrar “não aplicável” em vez de omitir.

## Estados do deploy

- **Planejado:** escopo e janela aprovados.
- **Em execução:** mudança iniciada e monitorada.
- **Concluído:** artefatos publicados e validação aprovada.
- **Concluído com ressalva:** serviço estável, com aviso e ação registrada.
- **Revertido:** versão anterior restaurada e impacto avaliado.
- **Falhou:** objetivo não alcançado; incidente e próximo passo vinculados.

## Evidências

Guardar saídas resumidas dos checks, lista de migrations, versão das funções, URL pública não sensível e resultado dos smoke tests. Capturas podem comprovar layout, mas não substituem teste de persistência e autorização. Logs extensos ou sensíveis permanecem em local restrito e são referenciados por identificador.

## Correção do registro

Uma entrada histórica não é apagada. Erros de preenchimento recebem retificação datada e motivo. Deploy parcial deve declarar exatamente quais componentes foram promovidos. Alterações manuais no provedor também entram no registro e geram tarefa para refletir a configuração no repositório.

## Revisão e retenção

O executor preenche; o responsável técnico revisa até o encerramento da janela. Registros são revisados mensalmente para identificar falhas, rollback e mudanças fora do processo. O período de retenção deve acompanhar requisitos de auditoria e continuidade definidos pela organização.
