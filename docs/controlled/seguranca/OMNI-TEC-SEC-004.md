# Registro de Incidentes de Segurança

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-SEC-004 |
| Versão / status | v1.0 / Ativo |
| Norma / classificação | LGPD / Uso Interno |
| Público | Técnico / Gestão |
| Responsável / revisão | Técnico / 2026-09-25 |

Não há incidente de segurança confirmado registrado até esta revisão. Vulnerabilidades abertas permanecem em [SEC-002](OMNI-TEC-SEC-002.md) e não são classificadas como incidentes sem evidência de exploração ou exposição.

## Fluxo de resposta

1. registrar horário, origem, ambiente e indício sem copiar dados pessoais;
2. conter acesso ou recurso afetado;
3. preservar evidências e identificar escopo;
4. avaliar confidencialidade, integridade, disponibilidade e obrigação LGPD;
5. corrigir, testar e recuperar;
6. comunicar responsáveis e titulares quando aplicável;
7. registrar causa raiz e prevenção.

## Campos obrigatórios de uma ocorrência

ID, severidade, detecção, ambiente, ativos afetados, dados envolvidos, contenção, responsáveis, linha do tempo, causa, correção, comunicação, evidências e encerramento.

## Severidade

- **Crítica:** exposição confirmada em larga escala, controle administrativo comprometido ou alteração destrutiva.
- **Alta:** acesso não autorizado confirmado, secret válido exposto ou integridade relevante afetada.
- **Média:** incidente limitado, contido e sem alcance ampliado demonstrado.
- **Baixa:** evento suspeito com impacto mínimo confirmado, ainda assim rastreável.

A classificação é provisória até o escopo ser conhecido. Uma vulnerabilidade sem evidência de exploração permanece em SEC-002; ao surgir indício confiável de abuso, abre-se incidente e preserva-se o vínculo.

## Papéis de resposta

O coordenador organiza decisão e comunicação; o responsável técnico contém e recupera; o custodiante de dados avalia informações envolvidas; a gestão decide continuidade e comunicação externa. Apoio jurídico ou encarregado de dados deve ser acionado quando houver possível obrigação legal. A mesma pessoa pode acumular papéis em equipe pequena, mas as decisões permanecem registradas.

## Preservação e análise

Coletar logs, horários, versões, contas e ações com cadeia de custódia proporcional. Não alterar o ativo original além do necessário para contenção. Consultas devem minimizar acesso a conteúdo de alunos. Hipóteses são separadas de fatos confirmados na linha do tempo.

## Comunicação

Somente responsáveis autorizados comunicam externamente. A mensagem informa natureza, impacto conhecido, ação protetiva e canal de suporte, sem detalhes que aumentem exploração. Decisões sobre titulares e autoridade competente consideram avaliação jurídica e requisitos da LGPD; este documento não substitui essa análise.

## Recuperação e encerramento

Antes de restaurar, revogar credenciais afetadas, corrigir a causa e validar autorização, integridade e observabilidade. O encerramento exige escopo consolidado, causa ou melhor hipótese documentada, risco residual aceito e ações preventivas com responsáveis. Incidentes críticos passam por exercício de lições aprendidas e atualização de testes, políticas e continuidade.

## Retenção e revisão

Evidências ficam em local restrito pelo período definido pela organização. O registro controlado evita dados pessoais desnecessários e aponta para o repositório seguro. Mesmo sem incidentes confirmados, o fluxo deve ser testado periodicamente por simulação.
