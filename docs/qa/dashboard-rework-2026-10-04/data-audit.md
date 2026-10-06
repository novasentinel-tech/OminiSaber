# Dashboard docente: fontes e critérios de leitura

Auditoria local de contratos em 4 de outubro de 2026. O painel usa somente dados autorizados pelas APIs existentes; a ausência de dados não representa bom desempenho nem baixo engajamento.

| Informação | Fonte disponível | Leitura segura |
| --- | --- | --- |
| Turmas vinculadas | `getTeacherWorkspace(tipoProfessor).classes` | Turmas da especialidade, obtidas dos vínculos ativos de `professor_turma_materias`, com compatibilidade legada. |
| Total de alunos | `getTeacherWorkspace().studentCount` | Contagem exata de perfis de alunos nas turmas da especialidade. O contrato atual não fornece quantidade por turma. |
| Atividades | `getTeacherWorkspace().evaluations` | Avaliações do professor e especialidade, com status, turma, abertura, encerramento e tentativas. |
| Laboratórios | `getTeacherWorkspace().labs` | Laboratórios do professor e especialidade. Entregas expõem somente `id`, `status`, `nota`; não permitem identificar alunos para apoio. |
| Redações pendentes | `listTeacherEssays()` | Somente Português; redações de alunos vinculados com status `enviada`. |
| Correções de atividades | `listTeacherReviewQueue({tipoProfessor})` | Entregas com `status=enviada` e `requer_revisao=true`. Contar entregas, não confundir com número de respostas abertas. |
| Evidências de desempenho | `getTeacherEvaluationResults(id)` | Todas as tentativas por avaliação. Escolher a maior `numero_tentativa` por aluno e avaliação antes de calcular qualquer indicador. |
| Resultados consolidados | `getTeacherEvaluationAnalytics(id)` | O RPC já escolhe a última tentativa. `media_turma=0` sem correções é um valor de fallback, não evidência de dificuldade. |
| Notificações | `listNotifications()` | Avisos autorizados, até 100, com `readAt`; são mensagens recebidas, não um indicador de desempenho. |
| Experiências do OmniStudio (fora do dashboard atual) | Export ES module `listStudioExperiences(tipoProfessor)` em `engine/src/core/studio-api.js` | Esta função existe no módulo do motor, mas **não** em `window.OminiSaber`. Não pode ser chamada via `api()` do portal. O dashboard atual oferece um atalho para o OmniStudio e não consolida essas experiências. |
| Correções do OmniStudio (fora do dashboard atual) | Export ES module `listStudioReviewQueue(tipoProfessor)` em `engine/src/core/studio-api.js` | Também não integra a API pública `window.OminiSaber`. Sua unidade é resposta; uma futura integração precisa contar entregas por `tentativa_id` distinto. |

## Regras pedagógicas

- Desempenho exige última tentativa corrigida, sem revisão pendente, nota explicitamente válida e valor máximo maior que zero. Notas nulas, vazias ou não numéricas não viram zero.
- Quando houver múltiplas atividades, um aluno aparece uma vez no resumo de apoio. Preferir a evidência corrigida mais recente; não perpetuar um sinal antigo após recuperação.
- Um corte de 60% deve ser identificado como critério de triagem, com período/amostra. Ele não prova uma dificuldade específica de habilidade.
- Ausência de entrega não prova desinteresse. Atividades agendadas, prazos ainda abertos e dados incompletos impedem esse diagnóstico.
- Gráficos devem normalizar `nota/valor`, indicar a quantidade de correções e exibir lacunas sem evidências, sem inventar uma linha mensal.
- RPC indisponível é estado de erro parcial. Mostrar “não foi possível carregar”, nunca “0 alunos precisam de apoio”.

## Prazos e status

- Próximos prazos vêm de `encerra_em` nas atividades e `prazo` nos laboratórios, com data válida, status publicado e turma vinculada.
- `abre_em` no futuro significa atividade agendada. Status publicado sozinho não significa aberta agora.
- Conteúdos encerrados, arquivados, cancelados ou rascunhos não entram em próximos prazos de entrega.
- Prazo vencido pode ser destacado separadamente; não misturar com “próxima entrega”.
- Comparar instantes de data/hora com fuso, não strings nem datas localizadas. O painel apresenta datas e dias restantes no calendário local do navegador, com os mesmos critérios em ambos os rótulos.

## Segurança dos contratos

`resultados_avaliacao_docente` e `painel_resultados_avaliacao` são `security invoker`, limitados ao professor dono ou gestor. A fila de revisão utiliza políticas RLS das tentativas e avaliações. Não ampliar consultas no frontend nem usar credencial administrativa para montar o dashboard.

## Verificação indicada

Testes puros do helper de resumo devem cobrir retentativas, recuperação, notas inválidas, estados parciais, limites de prazo e preservação dos dados de entrada. Depois, verificar a tela autenticada com dados reais e estados vazios, mais uma fixture claramente identificada para demonstrar pendências, gráfico e prazos. Testes de IA continuam separados dos dados do painel.

## Implementação examinada

`teacher-dashboard.js` coleta redações, fila de revisão e notificações de forma independente. A indisponibilidade de uma fonte não elimina o workspace. A fila é limitada às turmas atualmente vinculadas, pelo vínculo da avaliação presente no retorno público. O desempenho consulta até 12 avaliações dessas turmas com tentativas corrigidas, em lotes de três, pela API pública `getTeacherEvaluationResults`. A sinalização de truncamento compara a quantidade de avaliações elegíveis antes do limite, sem incluir rascunhos ou turmas não vinculadas.

`dashboard-data.js` rejeita notas vazias, booleanas, não numéricas ou fora do valor da atividade; ignora correções sem data válida ou com data futura. O gráfico representa somente seis semanas e mantém intervalos sem amostra. O sinal de apoio utiliza a última correção disponível por aluno nas avaliações consultadas; seu horizonte pode ser anterior às seis semanas do gráfico.

Os 16 testes semânticos estão em `tests/teacher-dashboard-data.test.mjs`. O helper fornece contagens básicas de tentativas enviadas; a tela substitui a contagem de avaliações pela fila de revisão autorizada para distinguir entregas que realmente exigem correção manual.

Validação local concluída: `node --test tests/teacher-dashboard-data.test.mjs`, 16 testes aprovados, sem casos dispensados. Verificações existentes de construtor, correção docente e resultados/recuperação também passaram; não substituem a verificação autenticada da tela nem comprovam a publicação remota da IA.
