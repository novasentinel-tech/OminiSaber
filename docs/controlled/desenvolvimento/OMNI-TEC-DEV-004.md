# Registro de Débito Técnico

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-DEV-004 |
| Versão | v1.0 |
| Status | Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

| ID | Prioridade | Débito | Risco | Critério de saída |
| --- | --- | --- | --- | --- |
| DT-001 | Alta | versão do SDK Supabase não fixada em páginas CDN | mudança incompatível sem controle | dependência fixada e regressão de login/dados aprovada |
| DT-002 | Alta | `email_por_matricula` exposto antes da autenticação | enumeração de contas | resposta neutra, limitação e teste de abuso |
| DT-003 | Alta | migração de governança ainda não promovida ao remoto | índices e diagnóstico ausentes no ambiente | migration aplicada, advisors revisados e snapshot sem falhas |
| DT-004 | Média | cobertura integrada incompleta para gestor e bibliotecária | falhas de RLS não detectadas | contas de teste e cenários positivos/negativos automatizados |
| DT-005 | Média | frontend principal sem empacotamento | duplicação e caminhos frágeis | decisão arquitetural explícita ou pipeline de build adotado |
| DT-006 | Média | funções privilegiadas herdadas exigem revisão gradual | privilégios excessivos | grants, `search_path` e validação de papel auditados |
| DT-007 | Baixa | documentação histórica volumosa | descoberta difícil | índice, classificação e política de retenção aplicados |

Detalhes e ocorrências ficam em [Problemas conhecidos](../../development/known-issues.md). Dívidas não são encerradas apenas porque o sintoma desapareceu; o critério de saída precisa de evidência.

## Modelo de avaliação

Cada débito recebe origem, domínio, impacto, probabilidade, esforço, dependências,
responsável e data de revisão. Prioridade alta combina risco significativo e jornada
crítica; prioridade média compromete manutenção ou cobertura; prioridade baixa é
melhoria controlável sem impacto imediato.

## Plano de tratamento

DT-001 exige inventariar páginas, fixar uma versão suportada do SDK e executar login,
queries, Realtime e uploads antes da promoção. DT-002 depende de revisão do contrato
de login, mensagens indistinguíveis e limitação de tentativas. DT-003 requer conexão
DDL autorizada, backup, aplicação da migration e advisors. DT-004 precisa de contas
isoladas e matriz de RLS. DT-005 será resolvido por decisão explícita: manter o modelo
estático com disciplina adicional ou adotar build gradual. DT-006 avança função por
função, priorizando as alcançáveis pelo cliente. DT-007 usa o controle documental e
uma política de retenção para auditorias.

## Governança

Um débito pode ser aceito temporariamente, mitigado, resolvido ou substituído por
ADR. Aceitação temporária registra risco residual e data. Correções oportunistas não
devem ampliar o escopo de uma mudança urgente. Se um débito contribuir para
incidente, sua prioridade é reavaliada e a análise de causa referencia este registro.

## Indicadores

Revisar quantidade por prioridade, idade, reincidência e relação com bugs. A métrica
não incentiva encerrar itens sem evidência; o objetivo é reduzir risco e custo de
mudança, não apenas a contagem aberta.
