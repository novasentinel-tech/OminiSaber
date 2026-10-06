# Verificação do OmniStudio — matemática interativa

Data: 3 de outubro de 2026. Ambiente: prévia local compilada, em `http://127.0.0.1:4173/engine/dist/client/`. A atividade demonstrativa foi criada pela interface e permaneceu no navegador; os trabalhos anteriores foram preservados no histórico local.

## Autoria e aluno

O percurso “Explorar funções e resolver cálculos” foi montado, recarregado e concluído na mesma implementação usada pela prévia docente e pelo runtime publicado. Foram verificados:

- Inserção de fração por botão, texto com fórmulas LaTeX e prévia visual imediata. Campos matemáticos têm nomes acessíveis.
- Resolução de `(3+5)/2`, com três operações e resultado 4; resolução de `x²-5x+6=0`, com coeficientes, discriminante e raízes 2 e 3.
- Função colada como `$f(x)=2x+3$`, com substituição de x=2 e resultado 7, sem confundir atribuição da função com uma equação a resolver.
- Comparação de `f(x)=ax²+b` e `g(x)=2x+1`: em x=2, resultados 4 e 5. Alterar a=2 atualiza o primeiro resultado para 8. O zoom modifica a janela e preserva o cálculo do x exato.
- Explicação do ponto do gráfico: substituição de a=2, b=0 e x=2, potência, multiplicação e soma, com resultado 8.
- Gabarito numérico calculado na edição e aplicado ao intervalo privado; rascunho do aluno com transferência explícita do resultado 4 para a resposta.
- Associação de três equações às soluções, preservando o sinal de igualdade dentro das fórmulas. As três relações receberam 1 ponto na prévia.
- Ordenação de operações por setas e registro da sequência correta, com 1 ponto na prévia.
- Resposta aberta com multiplicação e fração renderizadas na prévia, na revisão e no resultado; permaneceu aguardando professor.
- Tabela editada por células, com fórmulas, inclusão de linha e decimal com vírgula. Ordenação numérica produziu 0,75, 4 e 12; busca por 12 exibiu um dos três registros.
- Revisão e conclusão do percurso completo de sete etapas. Fórmula, gráfico e tabela foram registrados como exploração; as respostas objetivas foram corrigidas e a aberta permaneceu para revisão.

## Responsividade e acessibilidade

Foram inspecionadas telas de 1280×1000 e 390×844. Gráfico e resposta matemática couberam na largura disponível, sem rolagem horizontal da página. Tabelas de autoria usam rolagem local quando necessário. Os eixos do gráfico receberam rótulos maiores no celular, e os botões de zoom/restauração têm área de toque de 44 pixels de altura. Etapas já concluídas mantêm nomes acessíveis mesmo quando o layout compacto oculta seus títulos.

## Testes locais

88 testes passaram na execução conjunta dos testes do engine, portal, contrato do Copiloto e PostgreSQL local. Incluem parser matemático seguro, resolução linear/quadrática, precisão da transferência de respostas, renderização real de gráficos e resolução, matemática em texto, tabelas, associação, publicação, entrega, correção, isolamento entre turmas e remoção de critérios privados do snapshot.

A revisão independente encontrou e corrigiu classificação de funções com delimitadores LaTeX, resíduos decimais ao transferir resultados e descarte de parâmetros após o sexto. A renderização usa HTML/MathML sem confiar em comandos de navegação ou HTML enviados na fórmula. O cálculo automático admite uma gramática escolar limitada; fórmulas gerais podem ser exibidas e acompanhadas de orientações docentes.

As propostas do Copiloto e a revisão docente também usam a apresentação matemática compartilhada. A devolutiva do professor usa o editor com símbolos e prévia. Estas telas foram compiladas; a revisão docente com dados reais e a geração remota de IA dependem de sessão autenticada e implantação, conforme a limitação abaixo.

## Evidências visuais

| Arquivo | Evidência |
| --- | --- |
| `01-equacao-passos-desktop.jpg` | Resolução algébrica em etapas |
| `02-grafico-aluno-desktop.jpg` | Comparação de funções na experiência do aluno |
| `03-entrega-matematica-desktop.jpg` | Conclusão do primeiro percurso matemático |
| `04-tabela-autoria-desktop.jpg` | Edição de células com fórmulas |
| `05-grafico-aluno-mobile.jpg` | Plano cartesiano em tela de celular |
| `06-associacao-aluno-desktop.jpg` | Equações associadas às soluções |
| `07-resposta-aluno-mobile.jpg` | Resposta com fórmulas e prévia |
| `08-tabela-aluno-mobile.jpg` | Dados matemáticos com ordenação |
| `09-autoria-formula-desktop.jpg` | Controles matemáticos ocupando a largura do editor |
| `10-percurso-completo-mobile.jpg` | Resultado das sete etapas |

## Estado de entrega

O frontend compilado e o pacote público local foram preparados. O fluxo remoto depende da aplicação da migration `20261003_omnistudio_matematica.sql` após as migrations anteriores, publicação da Edge Function `professor-copiloto` e deploy do frontend. Não houve alteração do banco remoto, envio para alunos reais ou chamada paga de IA nesta verificação. A autenticação e a IA remotas não foram validadas no navegador local sem sessão.
