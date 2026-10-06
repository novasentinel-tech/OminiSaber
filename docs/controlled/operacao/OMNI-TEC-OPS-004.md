# Plano de Continuidade e Recuperação

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-OPS-004 |
| Versão / status | v1.0 / Ativo |
| Classificação | Uso Interno |
| Público | Técnico / Gestão |
| Responsável / revisão | Técnico / 2026-09-25 |

## Prioridades

1. identidade e acesso seguro;
2. integridade do banco e evidências escolares;
3. atividades, entregas e correções;
4. agenda e notificações;
5. biblioteca, relatórios e recursos auxiliares.

## Cenários

| Cenário | Contenção | Recuperação |
| --- | --- | --- |
| frontend indisponível | suspender promoção | reimplantar artefato anterior validado |
| migration falha | interromper novas mudanças | rollback transacional ou migration corretiva |
| credencial exposta | revogar imediatamente | rotacionar, auditar uso e reimplantar dependentes |
| corrupção ou exclusão de dados | bloquear escrita afetada | restaurar backup validado e reconciliar auditoria |
| Edge Function com falha | desabilitar feature/rota | reverter função ou configuração |
| provedor indisponível | comunicar impacto e preservar fila manual | retomar após estabilidade e reconciliar operações |

## Requisitos

Backups precisam de retenção definida no ambiente, restauração testada e acesso restrito. Cada recuperação registra tempo, perda de dados estimada, validações e ações preventivas. RTO e RPO formais devem ser aprovados antes da produção com base na capacidade contratada.

## Objetivo e premissas

O plano orienta continuidade mínima segura durante falha e recuperação ordenada. Segurança e integridade prevalecem sobre rapidez: o serviço não deve retornar com autorização quebrada ou dados incoerentes. A capacidade real depende do plano contratado, backups disponíveis e pessoas de resposta.

## Análise de impacto

Identidade e banco são dependências de prioridade máxima. Atividades e correções afetam prazos pedagógicos; agenda e notificações podem operar com comunicação alternativa por período limitado; recursos auxiliares podem ser suspensos. A gestão deve definir tolerância por processo e período escolar antes da produção.

## Estratégia de backup e restauração

Registrar escopo, frequência, retenção, criptografia, responsável e teste de restauração. Backup só é confiável após restauração em ambiente isolado e reconciliação de tabelas, vínculos, arquivos e auditoria. Exports locais com dados reais não são permitidos sem proteção e finalidade aprovada.

## Ativação do plano

O responsável técnico declara o evento, abre linha do tempo e interrompe mudanças concorrentes. A equipe confirma impacto, escolhe contenção, comunica alternativa e executa recuperação pela prioridade definida. Decisões irreversíveis exigem aprovação, salvo ação imediata necessária para impedir dano maior.

## Operação degradada

Quando seguro, registrar compromissos, entregas ou orientações por procedimento temporário aprovado. O material precisa de identificador, proteção e reconciliação posterior. Não criar planilhas informais com dados pessoais sem controle de acesso e descarte.

## Validação de retorno

Após recuperar, verificar login por papel, RLS permitido/negado, integridade referencial, contagens, arquivos, atividades, notas e auditoria. Reabrir gradualmente e monitorar. Comunicar o que foi recuperado, possível intervalo de perda e ações requeridas pelos usuários.

## Exercícios e governança

Executar exercício semestral e após mudança importante de infraestrutura. Medir tempo, lacunas de acesso, dependências e clareza de comunicação. Gestão aprova RTO/RPO; técnico mantém roteiro e evidências; responsáveis funcionais validam processos. Cada exercício atualiza o plano e o inventário INF-001.
