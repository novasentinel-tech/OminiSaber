# Registro de Bugs e Falhas

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-TST-003 |
| Versão / status | v1.0 / Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

## Fontes canônicas

- [Problemas conhecidos](../../development/known-issues.md): riscos técnicos ativos;
- [Auditoria do aluno](../../auditoria-2026-09-23/RELATORIO.md): evidências funcionais e visuais;
- [Auditoria docente](../../auditoria-docente-2026-09-24/PLANO-E-RESULTADOS.md): lote de correções móveis e desktop;
- [Auditoria geral](../../development/auditoria-sistema-2026-09-09.md): integridade e segurança;
- `docs/auditoria-visual`: comparações e regressões de layout.

## Severidade

Crítica: exposição ou indisponibilidade ampla. Alta: jornada principal bloqueada ou integridade comprometida. Média: função degradada com alternativa. Baixa: inconsistência visual ou operacional limitada.

Cada bug deve registrar ambiente, rota, papel, reprodução, esperado, obtido, evidência, causa, correção, regressão e estado. Não marcar como resolvido sem reproduzir o cenário original.

## Entrada e triagem

Relatos vindos de usuário, teste, monitoramento ou auditoria recebem identificador, data e responsável por triagem. Antes de classificar, confirmar se é defeito, requisito ausente, problema de dados, configuração ou limitação conhecida. Itens duplicados são vinculados; não devem desaparecer do histórico.

## Prioridade e impacto

Severidade descreve impacto técnico e funcional. Prioridade define ordem de tratamento considerando número de usuários, calendário escolar, risco de dados, existência de alternativa e custo de atraso. Um erro visual pode receber prioridade alta se impedir uso móvel; uma falha grave em função desativada pode ter tratamento planejado, mas mantém sua severidade.

## Ciclo de vida

1. aberto e triado;
2. reproduzido ou aguardando informação;
3. em correção;
4. pronto para reteste;
5. validado em ambiente definido;
6. encerrado, rejeitado ou aceito como risco.

Reabertura ocorre quando a falha persiste, retorna ou a correção produz efeito equivalente. Estados e responsáveis devem ser atualizados, evitando itens “em andamento” sem ação concreta.

## Investigação e correção

A análise separa sintoma, causa direta e causa sistêmica. A correção deve incluir proteção contra repetição: teste, validação, constraint, observabilidade ou atualização de processo. Alterações emergenciais também entram no fluxo de versão e deploy.

## Evidência de encerramento

Anexar resultado do cenário original, regressão adjacente, versão corrigida e ambiente. Bugs de layout incluem comparação em viewport relevante; bugs de autorização incluem consulta negada e ausência de vazamento; bugs de dados incluem reconciliação do estado persistido.

## Indicadores e revisão

Acompanhar abertos por severidade, idade, tempo de correção, reincidência e origem. Revisar semanalmente durante fase ativa e antes de release. Métricas servem para orientar prevenção, sem incentivar encerramento sem validação.
