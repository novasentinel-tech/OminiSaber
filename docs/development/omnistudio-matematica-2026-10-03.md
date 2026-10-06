# OmniStudio — matemática interativa e contrato de publicação

## Autoria com fórmulas reais

`MathInput` oferece botões de fração, potência, raiz, parênteses, multiplicação e pi. Eles inserem a notação no cursor ou aplicam a operação ao trecho selecionado, com prévia imediata. O menu “Modelos” inclui função afim, frações, raiz e potência, equação do primeiro grau, Bhaskara, seno e área do círculo. O professor também pode digitar `2x`, `x²`, `3/4`, `sqrt(9)` ou colar LaTeX. Modelos de equações e fórmulas visuais não implicam que todo cálculo simbólico possa ser resolvido automaticamente.

Nas instruções e nos campos de texto dos tipos, o modo misto conserva a prosa e insere fórmulas entre `$…$`. Os campos de alternativas, itens de ordenação e associação, feedback e células de tabela usam esse mesmo editor. A configuração dos blocos `formula` e `graph` possui ferramentas próprias; os demais tipos podem receber uma fórmula de apoio, valores iniciais de variáveis e orientações públicas de resolução. Fórmulas químicas também recebem apresentação visual, sem converter esse recurso em um balanceador químico automático.

`MathText` apresenta trechos `$…$` na linha e `$$…$$` em destaque. A prosa continua sendo texto escapado pelo React, inclusive um cifrão literal escrito como `\$`. `MathFormula` usa KaTeX com saída visual e MathML acessível, `trust: false`, macros limitadas e bloqueio de comandos de links, HTML, carregamento de arquivos e definições. Fórmulas inválidas retornam texto e orientação, sem aceitar HTML do professor como conteúdo executável.

## Mini resolução e resposta numérica

`MathWorkbench` revela uma operação por vez: expressão inicial, substituição das variáveis e operações na ordem real de avaliação. O estudante pode modificar o cálculo, refazer os passos e consultar as orientações do professor. O rascunho matemático está disponível nas etapas; um resultado numérico pode ser transferido para uma resposta do tipo `number` usando “Usar como resposta”. O rascunho e suas explorações não substituem a confirmação, o salvamento e a entrega da atividade.

O motor calcula operações numéricas, frações, potências, raízes, constantes `pi` e `e`, e `sin`, `cos`, `tan`, `abs`, `ln`, `log` e `exp`. Funções trigonométricas usam radianos. Divisão por zero, resultados fora dos reais e valores não finitos recebem erros explícitos. As expressões calculáveis estão limitadas a 1200 caracteres de entrada, 400 tokens e 64 níveis de aninhamento; a apresentação visual e o contrato de publicação podem aceitar até 2000 caracteres.

A resolução de equações aceita uma igualdade e uma variável, com polinômios de primeiro ou segundo grau. Ela reduz os termos dos dois lados, isola a incógnita ou apresenta discriminante e raízes. Identidades, igualdades impossíveis, raízes repetidas e ausência de solução real têm estados próprios. Coeficientes racionais evitam que cancelamentos decimais criem um termo falso. Graus maiores, sistemas com mais de uma variável, variável no denominador, expoentes variáveis ou negativos e equações com funções como seno ou raiz não são resolvidos por essa ferramenta. Esses formatos podem ser exibidos visualmente e acompanhados de orientações do professor.

O helper “Calcular o gabarito numérico” fica somente na edição docente. Sua expressão é estado local do componente e não é salva como fórmula pública; ao aplicar, somente o intervalo privado `min`/`max` recebe o resultado. `mathAnswerValue` transfere o valor com a mesma precisão de 12 dígitos significativos apresentada no resultado, tanto para esse helper quanto para “Usar como resposta”. O cálculo interno conserva sua precisão numérica; etapas arredondadas usam `≈` quando necessário. Isso evita transferir um valor binário oculto diferente do que a interface apresentou.

## Plano cartesiano compartilhado

`engine/src/components/MathGraph.jsx` é a mesma visualização usada na autoria e na atividade do aluno. Recebe `expression`, rótulos dos eixos e `settings`, com intervalos, escala vertical automática, parâmetros e exibição de tabela. Aceita até três funções em linhas distintas para comparação. O gráfico SVG mantém nitidez em telas de alta densidade e oferece grade graduada, eixos, zoom, restauração, cursor por toque, controle de teclado, entrada de x exato e tabela acessível.

A seleção calcula a função no x escolhido, em vez de aproximar o valor por um ponto amostrado. A visualização respeita o domínio real: não desenha valores ausentes nem conecta segmentos através de polos, como em `1/x`. A escala automática descarta os 2% extremos somente ao determinar a janela vertical; os valores reais continuam disponíveis na exploração e na tabela. “Como este ponto foi calculado” usa o componente compartilhado de resolução para revelar substituições e operações.

O parser de `engine/src/core/math.js` usa uma gramática limitada e não executa o texto do professor como código. Entende multiplicação implícita, expoentes, frações e raízes LaTeX, constantes e funções escolares. Equações que excedem a gramática podem ser apresentadas na fórmula visual, sem prometer resolução algébrica geral.

## Tabelas e associação de expressões

`MathTableEditor` permite editar títulos e células individualmente, inserir fórmulas com os botões, adicionar colunas e linhas e remover linhas. O editor oferece até 12 colunas e 200 linhas. Dados colados podem usar tabulação, ponto e vírgula ou vírgula entre células; para decimais com vírgula, a orientação é usar ponto e vírgula como separador. A serialização preserva aspas e fórmulas das células.

Na visão do estudante, `MathTable` apresenta fórmulas nas células, busca textual e ordenação por cabeçalho. Valores numéricos, inclusive decimais com vírgula, recebem ordenação numérica; os demais valores usam comparação textual. Cabeçalhos expõem `aria-sort` e o total de registros informa o resultado da busca.

`MathMatching` apresenta duas colunas: escolher um termo e depois seu correspondente. Os controles são botões operáveis por toque e teclado; relações podem ser desfeitas e opções já usadas em outro termo ficam desabilitadas. Fórmulas permanecem visíveis nas duas colunas e na relação registrada. O formato de autoria usa `termo | correspondente`, permitindo igualdades matemáticas dentro de cada lado sem quebrar o par. A publicação conserva o embaralhamento e a correção por índices privados do fluxo integrado.

## Apoio matemático do Copiloto

O contrato do Copiloto permite `formula_apoio` com até 2000 caracteres e `passos_exemplo` com até 8000. A normalização converte esses campos para `mathExpression` e `solutionSteps`, que chegam ao aluno como conteúdo público e explorável. O pedido enviado à IA orienta fórmulas LaTeX entre cifrões nas instruções, alternativas e itens; os exemplos de apoio devem ser independentes do desafio e não devem copiar seu gabarito.

Essas orientações não constituem uma garantia semântica sobre a saída do modelo. O professor revisa a proposta editável antes de aplicá-la e publica em uma ação separada. A validação técnica rejeita tipos e tamanhos inválidos e conserva a lista de tipos executáveis já suportada pelo Copiloto.

## Metadados públicos por bloco

| Campo opcional | Contrato |
| --- | --- |
| `mathExpression` | Texto com até 2000 caracteres para o cálculo de apoio |
| `mathVariables` | Objeto com até 26 chaves de uma letra minúscula; valores numéricos finitos entre −1000000 e 1000000 |
| `solutionSteps` | Texto com até 8000 caracteres de orientações pedagógicas; não é gabarito privado |
| `graphSettings` | Objeto com `xMin`, `xMax`, `yMin`, `yMax`, `autoY`, `showTable` e `variables` opcionais |

Os limites dos eixos são números entre −1000000 e 1000000. A janela de x exige máximo maior que mínimo e largura mínima de 0,0001. A mesma regra vale para y quando `autoY` é falso. Parâmetros do gráfico seguem a regra de `mathVariables` e as opções são booleanas. Estes campos permanecem no snapshot público por serem conteúdo de apoio ao aluno. Os campos privados de correção continuam removidos, inclusive `correct`, `min`, `max`, `rubric` e índices de embaralhamento.

O campo `expression` dos blocos `formula` e `graph` também exige texto com até 2000 caracteres. Um gráfico aceita no máximo três expressões não vazias, separadas por linhas ou ponto e vírgula. A publicação rejeita uma quarta função para impedir que a visualização a descarte silenciosamente.

## Migração e evidência

Aplicar `backend/migrations/20261003_omnistudio_matematica.sql` depois de `20261003_omnistudio_fluxo_integrado.sql`. A extensão preserva o validador anterior em um helper privado e acrescenta um wrapper `SECURITY INVOKER`, com `search_path` vazio e execução negada a `PUBLIC`, `anon` e `authenticated`. A publicação existente chama o validador internamente. Nenhuma RPC ou permissão de tabela foi acrescentada. O schema consolidado inclui esta migration.

`backend/tests/studio-integrated-flow.test.mjs` aplica as três migrations em PostgreSQL local embarcado. Os doze testes passam, incluindo publicação, snapshot e entrega de atividade matemática, rejeição de configurações inválidas e impossibilidade de chamar os helpers diretamente. `engine/tests/math-graph.test.mjs` verifica a renderização SVG real em seis cenários: eixos e valores, polos de `1/x`, domínio de raiz, comparação parametrizada, mais de seis parâmetros e expressão inválida.

`engine/tests/math.test.mjs` cobre gramática segura, passos, transferência com precisão consistente, domínio e equações lineares e quadráticas. `engine/tests/math-format.test.mjs` cobre apresentação acessível, texto misto, comandos bloqueados, configurações públicas, células e associação com igualdades. `engine/tests/math-workbench.test.mjs` verifica a renderização de funções e equações com delimitadores, além dos estados vazio e não suportado. Estes testes de código e renderização não representam, por si só, uma validação de navegação no navegador.

O teste de renderização precisa das dependências locais de compilação. No Windows, o isolamento do executor pode impedir que o compilador leia os diretórios pais; executar esse teste no ambiente autorizado usado para o build. Não há acesso a banco remoto, credenciais ou geração paga durante esses testes.

O estado documentado é local. Para disponibilizar a atualização online, ainda é necessário aplicar a migration matemática no banco de destino, implantar a Edge Function `professor-copiloto` com os novos campos e publicar o frontend compilado. Esta documentação não confirma nenhuma dessas implantações remotas. Evidências de navegação e aceite visual devem ser registradas separadamente quando executadas.
