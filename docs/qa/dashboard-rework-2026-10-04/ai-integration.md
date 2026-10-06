# Integração real do Copiloto — 4 de outubro de 2026

## Falha confirmada e correção implantada

A função antiga retornava `Request contains an invalid argument.`. Depois de publicar os cinco arquivos atuais e aplicar a migração incremental de ideias/trilhas, o diagnóstico seguro confirmou que a rejeição vinha do Gemini Interactions: HTTP **400**, `error.code: invalid_request`. Auth, vínculo docente e gravação de auditoria estavam funcionando.

A função reconhece tanto esse envelope Interactions quanto o formato RPC `INVALID_ARGUMENT`. Uma rejeição HTTP 400 compatível recebe **uma única tentativa** com um schema compacto. O contrato completo continua orientando a geração, e o servidor conserva todas as verificações de currículo, quantidade, gabarito, progressão, duração e pontuação. A tentativa de compatibilidade compartilha o mesmo limite de tempo; a correção pedagógica continua limitada.

O cliente passou a ler a mensagem JSON antes de aplicar o fallback HTTP 503. Assim, ele preserva o motivo real e os campos `errorCode`, `retryable` e `requestId`, sem afirmar erroneamente que falta publicar a função. O botão de nova tentativa respeita `retryable: false`.

Logs registram somente HTTP, códigos conhecidos, categoria do problema, nomes fixos de campos da API e identificador da requisição. Não registram mensagens brutas do provedor, pedidos, respostas de alunos, cabeçalhos ou credenciais.

## Verificação remota

| Fluxo | Evidência de produção | Resultado |
|---|---|---|
| Gerar atividade | 2026-10-04 14:03:56 UTC / 11:03:56 BRT; versão `copiloto-pedagogico-2026-10-03`; 3 questões; 6.669 ms; 5.049 tokens de entrada e 1.287 de saída; `providerSchemaFallbackCount: 1` | Concluída e exibida na interface real. |
| Gerar trilha | 2026-10-04 14:10:17 UTC / 11:10:17 BRT; 3 etapas e 3 questões; 15 + 15 + 20 = 50 minutos; 3,33 + 3,33 + 3,34 = 10 pontos; 8.050 ms; `providerSchemaFallbackCount: 1` | Concluída e exibida na interface real. |
| Gerar ideias | 2026-10-04 14:11:53 UTC / 11:11:53 BRT; 3 ideias; 6.661 ms; `providerSchemaFallbackCount: 1` | Concluída e exibida na interface real. |
| Gerar trilha após o reforço pedagógico final | 2026-10-04 14:15:11 UTC / 11:15:11 BRT; 3 etapas e 3 questões; 15 + 15 + 20 = 50 minutos; 3 + 3 + 4 = 10 pontos; 14.336 ms; `providerSchemaFallbackCount: 1` | Concluída; diagnóstico → prática guiada → transferência. Resposta curta com alvo único; cenário novo na transferência, com questão dissertativa e revisão humana. |
| Gerar ideias no frontend v6 | 2026-10-04 14:22:00 UTC / 11:22:00 BRT; 3 ideias, cada uma com 1 adaptação; 7.456 ms; `providerSchemaFallbackCount: 1` | Concluída; seção “Adaptações e desafios” visível na interface real. |
| Primeira tentativa de criar atividade a partir de uma ideia | 2026-10-04 14:23:27 UTC / 11:23:27 BRT; pedido do servidor com 3 questões; 11.293 ms; `providerSchemaFallbackCount: 1`; `codigo_erro: provider_unavailable` | A conversa preservou a adaptação da ideia. A validação bloqueou alternativas/gabarito inconsistentes; a proposta inválida não foi aplicada. Histórico preservado; a execução posterior abaixo confirmou o fluxo. |
| Novas ideias após os reforços finais | 2026-10-04 14:33:19 UTC / 11:33:19 BRT; 3 ideias, com 1, 2 e 1 adaptações; 7.570 ms; `providerSchemaFallbackCount: 1` | Concluídas; adaptações visíveis e pedido reutilizável sem quantidade fixa de questões. |
| Criar atividade a partir de uma ideia após os reforços finais | 2026-10-04 14:34:23 UTC / 11:34:23 BRT; quantidade solicitada = gerada = 3; escolha, verdadeiro/falso e resposta curta; 5.982 ms; `providerSchemaFallbackCount: 1`; sem código de erro | Concluída. A conversa preservou leitura ampliada e trabalho em duplas da ideia escolhida; os controles atuais do professor prevaleceram. |

O modelo configurado `gemini-3.5-flash-lite` produziu a atividade real acima. Não foi trocado por hipótese de indisponibilidade do modelo.

## Verificação local

Os testes do handler e do cliente cobrem o envelope real `invalid_request`, os envelopes RPC, falha persistente, ausência de retry em HTTP 403, preservação do tempo, gabarito inválido após fallback, privacidade dos logs, mensagens JSON em HTTP 503, respostas HTML e transporte. Os 13 testes desse conjunto passaram. Os 22 contratos do workspace também passaram.

A migração foi executada com sucesso em PostgreSQL local em uma rodada anterior. Uma repetição posterior falhou por falta de memória do processo WASM no Windows; nenhuma mudança SQL ocorreu entre essas rodadas.

## Ajuste pedagógico identificado

`resposta_curta` usa comparação exata após normalização de caixa e espaços, com variações opcionais cadastradas pelo professor em `acceptedAnswers`. Ela não avalia semanticamente explicações livres. Pedidos para citar e justificar, explicar com palavras próprias ou argumentar devem usar uma questão dissertativa com revisão humana.

O prompt reforçado em `index.ts` exige um termo, dado ou frase fixa breve com alvo único, proíbe pedidos com várias frases/exemplos válidos e preserva os formatos autorizados pelo professor. A transferência deve aplicar a estratégia a um novo texto, conjunto de dados ou cenário, e cada etapa apresenta o material necessário para responder.

A publicação final foi confirmada na interface administrativa do Supabase em 2026-10-04, sem indicação de arquivo modificado pendente. A trilha gerada às 11:15:11 BRT, após essa publicação, apresentou uma resposta curta com alvo único e uma transferência em um novo material com questão dissertativa e rubrica de quatro níveis. O modelo e o contrato de dados permaneceram iguais.

Após o teste de conversão de uma ideia, foram publicados novos reforços em `index.ts`: prioridade explícita da quantidade e dos formatos selecionados na execução atual; gabarito objetivo copiado literalmente de uma única alternativa; pedidos reutilizáveis de ideias sem números de questões ou formatos fixos que possam contrariar as preferências futuras. A publicação foi confirmada no editor administrativo, sem alterações pendentes, e a evidência `ai-deployed.jpg` foi atualizada. A conversão real concluiu às 11:34:23 BRT, gerando exatamente as três questões selecionadas. A validação permaneceu estrita.

Uma tentativa manual posterior à falha das 11:23 BRT exibiu a mensagem antiga de publicação/reinício, mas não criou um novo registro de execução. A fonte atual já não contém essa mensagem e as referências do cliente foram atualizadas para v5. Essa ausência de registro não estabelece sozinha se houve falha de cache, inicialização, gateway ou outra etapa anterior à gravação; a causa não foi atribuída como definitiva.

Na nova aba usada para a confirmação final, o DOM comprovou os arquivos efetivamente carregados: cliente Supabase `20261004-5`, portal docente `20261004-6` e Copiloto `20261004-6`. Essa verificação evitou depender apenas das versões presentes no arquivo HTML salvo.

Referências oficiais consultadas: [Gemini Interactions API](https://ai.google.dev/api/interactions-api), [saída JSON estruturada](https://ai.google.dev/gemini-api/docs/structured-output).


## Prévia do aluno e aplicação ao rascunho

A atividade final respondeu corretamente a Verdadeiro/Falso e à entrada `OPINIÃO`, com feedback explicativo. A questão dissertativa da trilha mostrou que a resposta seria revista pelo professor, sem atribuir nota automática nem expor a solução privada.

O botão **Aplicar ao rascunho** transferiu as três questões e os 10 pontos ao construtor real, com opção de restaurar o rascunho anterior. A edição da primeira questão conservou enunciado, quatro alternativas, gabarito, 3,34 pontos e feedback. Nenhuma avaliação de teste foi salva ou publicada para alunos. As evidências estão em `ai-activity-final.jpg` e `ai-handoff-final.jpg`.

A rodada final local reuniu 62 testes de dados, workspace, handoff, handler e mensagens de erro aprovados, além dos 46 critérios do fluxo do construtor. O pacote público `netlify-dist/` foi preparado com as versões finais. A implantação remota confirmada nesta tarefa é a função de IA e sua migration; o frontend está atualizado na prévia e no pacote local.
