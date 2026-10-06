# Controle de Vulnerabilidades

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-SEC-002 |
| Versão / status | v1.0 / Ativo |
| Norma / classificação | LGPD / Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

| ID | Severidade | Superfície | Situação | Tratamento esperado |
| --- | --- | --- | --- | --- |
| VUL-001 | Alta | login por matrícula | RPC pode facilitar enumeração | resposta neutra, rate limit e teste de abuso |
| VUL-002 | Alta | Auth | proteção contra senhas vazadas não confirmada | habilitar e validar fluxo |
| VUL-003 | Alta | banco | funções privilegiadas herdadas | revisar grants, `search_path` e checagem de papel |
| VUL-004 | Média | frontend | SDK Supabase sem versão exata | fixar versão e testar regressão |
| VUL-005 | Média | RLS | cobertura negativa incompleta por papel | automatizar matriz aluno/professor/gestor/biblioteca |
| VUL-006 | Média | implantação | migration de governança pendente no remoto | aplicar por conexão DDL autorizada e rodar advisors |

O registro contém apenas descrição e tratamento, nunca PoC sensível ou segredo. Encerramento exige evidência de correção e teste de regressão.

## Fontes e admissão

Vulnerabilidades podem surgir de revisão de código, scanners, advisors do provedor, testes de autorização, dependências, relato interno ou divulgação responsável. Antes do registro, confirmar superfície e ambiente sem explorar dados reais. Duplicatas são vinculadas ao item principal; falso positivo exige justificativa verificável.

## Priorização

A severidade considera impacto sobre confidencialidade, integridade e disponibilidade, facilidade de exploração, alcance, privilégio necessário e existência de mitigação. Como metas internas, itens críticos devem ter contenção imediata; altos, plano iniciado no mesmo ciclo; médios, tratamento planejado; baixos, revisão no backlog. Prazos finais dependem do risco e são registrados por item.

## Tratamento

1. atribuir proprietário e ambiente afetado;
2. conter exposição sem apagar evidência;
3. corrigir a causa no código, configuração ou processo;
4. testar cenário positivo e negativo;
5. promover pelos ambientes controlados;
6. anexar evidência e revisar risco residual;
7. encerrar ou aceitar formalmente a exceção.

Correções em funções privilegiadas incluem grants, papel executor, `search_path`, validação de vínculo e chamadas anônimas. Correções de frontend não são consideradas suficientes para falhas de autorização.

## Exceções e risco aceito

Um item só pode permanecer aberto por decisão consciente quando houver justificativa, controle compensatório, prazo e aprovador. Aceite não transforma a falha em segura. Mudança de exposição, dado ou ameaça força reavaliação.

## Métricas e revisão

Revisar itens abertos por severidade, idade, recorrência, tempo de correção e falhas reabertas. O registro é revisado mensalmente e antes de produção. Evidências sensíveis ficam em armazenamento restrito; este documento conserva apenas identificação, situação e decisão de tratamento.
