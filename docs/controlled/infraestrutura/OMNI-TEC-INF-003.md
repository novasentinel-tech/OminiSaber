# Controle de Recursos

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-INF-003 |
| Versão / status | v1.0 / Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

| Recurso | Unidade de controle | Revisão | Ação diante de desvio |
| --- | --- | --- | --- |
| Banco | tamanho, conexões, consultas lentas | semanal em produção | otimizar query/índice e investigar crescimento |
| Auth | usuários, falhas e bloqueios | semanal | investigar abuso e configuração |
| Storage | volume e arquivos órfãos | mensal | reconciliar referências e retenção |
| Edge Functions | invocações, erros e duração | após deploy e semanal | rollback, correção ou limite |
| Frontend | tamanho e cache dos artefatos | por deploy | remover duplicação e revisar cache |
| Copiloto | limites por usuário e consumo | diário quando habilitado | reduzir escopo ou desativar flag |

Não registrar tokens, conteúdo pessoal ou respostas de alunos neste controle. Métricas operacionais devem usar agregados.

## Objetivo

O controle evita indisponibilidade, custo inesperado e degradação silenciosa. Ele combina limites contratados, tendência de consumo e indicadores de experiência. A ausência de um painel automatizado não elimina a revisão: enquanto necessário, as medições podem ser coletadas manualmente com data, fonte e responsável.

## Coleta e baseline

Para cada recurso, registrar valor atual, média, pico, limite contratado e variação desde a última revisão. A primeira medição validada constitui o baseline; mudanças de plano, arquitetura ou volume escolar criam uma nova referência sem apagar o histórico. Dados pessoais são substituídos por contagens e percentis.

## Limiares de ação

- **Atenção:** tendência de crescimento ou uso acima de 70% do limite; analisar causa e previsão.
- **Alerta:** uso acima de 85%, erro recorrente ou latência prejudicial; abrir ação com responsável e prazo.
- **Crítico:** esgotamento iminente, perda de dados ou bloqueio de jornada; conter, escalar e avaliar rollback.

Percentuais são referências operacionais e devem ser ajustados quando o provedor tiver comportamento diferente. Consultas lentas são avaliadas pelo impacto e plano de execução, não apenas pela duração isolada.

## Governança e otimização

O técnico coleta e investiga; a gestão aprova aumento de custo e mudanças de capacidade. Antes de ampliar recursos, revisar índices, paginação, retenção, cache, arquivos órfãos e chamadas duplicadas. Redução de plano exige margem comprovada e plano de reversão.

## Evidência e revisão

Cada revisão registra período, ambiente, fonte, anomalias, decisão e próximo acompanhamento. Eventos que afetem usuários seguem INF-004; consumo relacionado a abuso ou acesso indevido também segue SEC-004. O histórico deve permitir explicar por que uma capacidade foi mantida, ampliada ou reduzida.
