# Indicadores de Qualidade Técnica

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-TST-004 |
| Versão / status | v1.0 / Ativo |
| Classificação | Uso Interno |
| Público | Técnico / Gestão |
| Responsável / revisão | Técnico / 2026-09-25 |

## Baseline atual

| Indicador | Resultado em 2026-09-25 | Meta |
| --- | --- | --- |
| Tabelas públicas com RLS | 77 de 77 | 100% |
| Migrations no schema consolidado | 52 de 52 | 100% |
| Referências locais quebradas na auditoria | 0 | 0 |
| Documentos controlados presentes | 28 de 28 | 100% |
| Aviso de SDK Supabase CDN sem versão | 85 páginas | 0 |
| Cobertura integrada por todos os papéis | incompleta | aluno, professor, gestor e bibliotecária |

Indicadores são recalculados por verificadores quando possível. Contagens manuais precisam de data e fonte. Resultado aprovado não equivale a prontidão para produção sem testes integrados e revisão de segurança.

## Finalidade e interpretação

Os indicadores mostram tendência e lacunas; não substituem análise de risco. Uma taxa de 100% significa somente que o denominador declarado foi atendido. Por exemplo, RLS em todas as tabelas não prova que todas as policies estejam corretas. Cada número precisa de definição, fonte e período.

## Definições

- **Cobertura RLS:** tabelas públicas com RLS habilitada dividido pelo total de tabelas públicas.
- **Cobertura de migration:** arquivos esperados representados no schema consolidado dividido pelo total inventariado.
- **Integridade documental:** referências locais válidas e documentos controlados presentes.
- **Regressão por papel:** papéis com lote integrado aprovado dividido pelos papéis em escopo.
- **Dívida de dependência:** páginas ou bundles com dependência não fixada ou fora da política.

## Coleta e qualidade do dado

Preferir verificadores reproduzíveis e conservar saída resumida com data e commit/ref. Contagem manual deve informar método e responsável. Alteração no método cria nova baseline. Resultado desconhecido não é zero e deve aparecer como “não medido”.

## Portões de qualidade

Um release não pode avançar com erro crítico/alto aberto no escopo, falha no checker obrigatório, migration não reconciliada ou autorização negativa não testada. Avisos aceitos precisam de justificativa e prazo. Metas podem evoluir, mas não devem ser reduzidas apenas para acomodar resultado ruim.

## Cadência e responsabilidades

O técnico recalcula a cada release e após mudança estrutural. Gestão revisa tendência mensal e aprova risco residual. Segurança revisa autorização e vulnerabilidades. Indicadores pedagógicos são separados dos técnicos para não confundir desempenho de alunos com qualidade do software.

## Limitações atuais e próximos passos

A baseline atual é forte em verificações estáticas e governança de schema, porém incompleta em integração por todos os papéis e pinagem do SDK. As próximas medições devem incluir duração dos checks, casos automatizados, acessibilidade, desempenho móvel e restauração de backup. Até isso ocorrer, a prontidão de produção permanece condicionada.
