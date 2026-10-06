# Fluxo de correção, devolutiva e recuperação — MVP

Data: 29/09/2026  
Escopo: avaliações do professor e retorno pedagógico ao aluno.

## Objetivo

Fechar o ciclo iniciado pela entrega do aluno: localizar pendências rapidamente, corrigir respostas abertas, registrar uma devolutiva útil, devolver o resultado ao estudante e manter a recuperação como próximo passo pedagógico.

## Fluxo do professor

1. O professor abre a **Central de correções**.
2. Os indicadores mostram entregas na fila, respostas que exigem revisão e o estado da correção automática.
3. A busca encontra aluno, matrícula ou atividade; o filtro restringe a uma avaliação.
4. Ao abrir uma entrega, o professor vê o placar automático/manual e o progresso da revisão.
5. Cada resposta reúne enunciado, imagem de referência quando houver, resposta do aluno, referência de correção e explicação.
6. Em questões abertas, o professor define a pontuação e registra uma devolutiva obrigatória com orientação de próximo passo.
7. **Salvar e avançar** persiste a correção e move o foco para a próxima entrega disponível.
8. A aba **Resultados e recuperação** permanece responsável pelo panorama da turma, ajuste auditável de nota e criação de recuperação focada.

## Fluxo do aluno

1. Depois de entregar, o aluno vê a linha de progresso **Entregue → Em revisão → Corrigida**.
2. Enquanto houver revisão manual, uma nova tentativa não é liberada.
3. Após a correção, o resultado apresenta nota, tentativa utilizada e comentários por questão.
4. Cada questão informa se a correção foi automática ou docente, a pontuação obtida, a resposta enviada e a devolutiva.
5. Quando permitida, a nova tentativa aparece somente após a conclusão da revisão.

## Dados e segurança

- O fluxo reutiliza `tentativas_avaliacao`, `respostas_avaliacao`, `avaliacoes` e `questoes_avaliacao`; não foi necessária nova migração.
- A consulta docente passou a carregar `configuracao` da questão para exibir imagens e referências no momento da correção.
- O gabarito permanece restrito à experiência docente e não é mostrado na devolutiva do aluno.
- Escritas continuam passando pelas operações já protegidas pelas políticas de acesso do Supabase.
- Nenhuma chave, política ampla ou exceção de RLS foi adicionada.

## Responsividade e acessibilidade

- Indicadores, busca, filtro, placar, cartões de resposta e ações se reorganizam em uma coluna em celulares.
- Estados de correção usam texto e ícone, sem depender somente de cor.
- Campos de devolutiva têm rótulo, limite e validação mínima.
- A fila vazia foi compactada para evitar uma tela extensa sem conteúdo.

## Verificação

- Verificadores de correção docente, atividade do aluno e recuperação aprovados.
- Fixture docente cobre fila, pesquisa, atalhos de nota, progresso e avanço.
- Fixture do aluno cobre nota, linha de progresso e comentários automáticos/docentes.
- Nenhum dado fictício é persistido pelas fixtures.

final result: passed
