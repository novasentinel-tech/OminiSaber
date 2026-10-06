# Trilhas práticas de Python e C++

O catálogo compartilhado está em `frontend/shared/programming-lab/learning-tracks.js`. São duas trilhas independentes, com 12 lições e três mini projetos em cada uma. A mesma missão pode ser explorada pelo aluno e consultada pelo professor. O material é público; soluções didáticas não são gabaritos secretos de uma avaliação do professor.

## Percurso de aprendizagem

Cada lição combina uma explicação breve, uma previsão de saída, um rascunho que precisa ser modificado, execução com entrada real, validação por saídas e uma variação que exige aplicar a ideia em outro problema. Os três projetos aparecem nas posições 4, 8 e 12. Não há conclusão por simples clique, quantidade de texto ou presença de `print`/`cout`.

| Etapa | Python | C++ |
| --- | --- | --- |
| 1–3 | Saída, entrada de texto, conversão e cálculo | Estrutura, compilação, `getline`, tipos e cálculo |
| 4 | Pedido da cantina: entrada, limite e decisão | Pedido da cantina: entrada, limite e decisão |
| 5–7 | Laço, acumulador, listas e funções | Laço, acumulador, `vector` e funções |
| 8 | Guardião da estufa: coleção, contagem e decisão | Guardião da estufa: coleção, função e decisão |
| 9–11 | Normalização de textos, dicionários e depuração | Caracteres, busca linear e depuração |
| 12 | Orçamento da feira: catálogo e pedidos | Placar da equipe: total, maior resultado e meta |

As explicações tratam casos vazios, igualdade no limite, nomes com espaços, dados repetidos e valores ausentes. Valores monetários são centavos inteiros. C++ usa `long long` quando os produtos podem superar um `int`; não há dependência de arredondamento de números decimais ou de cabeçalhos não padronizados.

## Contrato do catálogo

`LEARNING_TRACKS` usa as chaves `python` e `cpp`. `getTrack(language)` devolve a trilha ou `null`; `getLesson(language, id)` devolve a lição ou `null`.

Cada lição contém `id`, `order`, `language`, `title`, `kind`, `duration`, `module`, `fileName`, `summary`, `concepts`, `learn`, `prediction`, `task`, `starterCode`, `solutionCode`, `cases`, `hints`, `commonMistake`, `transfer` e `checkpoints`. `duration` é uma estimativa em minutos, não uma condição de conclusão. `sampleInput` é a primeira entrada de teste e pode ser alterada livremente para exploração.

Cada cenário possui `label`, `input` e `expectedOutput`. A variação contém seu próprio enunciado, rascunho, solução e cenários. `prediction` contém código, pergunta, alternativas, índice da resposta correta e explicação. As três dicas são progressivas: primeiro sugerem uma estratégia, depois uma estrutura, por fim indicam o trecho relevante.

## Evidências de aprendizagem e apresentação

- A previsão deve ser respondida antes de revelar a explicação. Um erro precisa oferecer oportunidade de nova tentativa e de execução do exemplo, sem bloquear a exploração.
- O botão Executar usa a entrada escolhida pela pessoa e serve para experimentar; ele não prova que todos os requisitos foram atendidos.
- A validação executa o programa atual em cada cenário. A interface deve mostrar entrada, resultado esperado, resultado recebido e diagnóstico, preservando espaços internos e ordem das linhas. Uma divergência deve indicar qual cenário precisa ser investigado.
- Concluir uma etapa exige previsão correta e aprovação dos cenários da missão **e** da variação. A variação tem um rascunho próprio para não ser aprovada por um resultado armazenado de outra atividade.
- Exibir ou copiar uma solução didática não marca progresso. Caso a pessoa execute uma solução copiada, a variação continua exigindo um novo programa. O professor pode pedir que ela explique um caso de limite ou modifique uma regra para verificar compreensão.
- Alterar o código de uma etapa aprovada deve invalidar a aprovação daquele código. Dados de progresso e rascunhos pertencem ao usuário e à linguagem; os dois projetos não compartilham aprovação por terem o mesmo identificador curto.

Os testes de saída verificam comportamento, não obrigam uma sintaxe específica. Um aluno pode usar uma estratégia diferente e correta. Quando a lição ensina funções ou coleções, o professor ainda pode revisar a organização e pedir uma explicação; testes de caixa-preta não provam que uma abstração específica foi usada. Todos os cenários são visíveis para favorecer a depuração, portanto aprovação local não equivale a avaliação supervisionada ou domínio comprovado de qualquer programa.

## Verificação do material

`tests/programming-learning-tracks.test.mjs` verifica a coerência da progressão, distribuição dos projetos, referências, alternativas, diversidade dos cenários, necessidade de editar os rascunhos e regras de limite. Quando Python está instalado, executa as 24 soluções Python (missões e variações), além dos 12 programas de previsão, com todos os dados declarados. Não reimplementa os algoritmos em JavaScript para decidir a resposta.

O teste local Python pode usar `PROGRAMMING_TEST_PYTHON` para indicar um executável. Sem esse executável, os dois testes de execução informam explicitamente a ausência e são ignorados; a validação real deve então ocorrer no laboratório de navegador. A disponibilidade de Python local não confirma a compilação de C++; os cenários C++ devem ser verificados pelo compilador real do laboratório.

Não é usada nenhuma biblioteca externa nos programas do catálogo. C++ inclui apenas os cabeçalhos padronizados `iostream`, `string` e `vector`. Python usa recursos da linguagem e biblioteca embutida. Entradas, códigos e testes não exigem consulta ou gravação no banco remoto.
