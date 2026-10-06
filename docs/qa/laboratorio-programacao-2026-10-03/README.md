# Laboratório de programação e correção das fórmulas

Data: 3 de outubro de 2026. Verificação na versão local do OminiSaber.

## Resultado

O laboratório compartilhado oferece Python e C++ reais, editor com linhas e indentação, entradas, terminal, cancelamento, testes com diferenças entre saídas e recuperação de rascunhos. As duas trilhas têm 24 etapas, seis mini projetos e 24 variações.

A mesma linguagem e etapa podem ser abertas pelo professor e aluno. O professor prepara uma orientação a partir da etapa, escolhe a turma e usa o formulário existente para salvar ou publicar. Preparar a orientação não publica automaticamente. O catálogo do aluno oferece as trilhas, inclusive quando ainda não existem conteúdos publicados pela turma. O IDE preserva acesso ao pseudocódigo anterior com mode=pseudo.

Uma etapa só fica validada quando a previsão foi conferida e o código atual passou nos cenários da missão e da variação. Editar o código invalida sua evidência. A prática não atribui nota escolar.

## Fórmulas da imagem enviada

Uma aba carregava index-CkGhdHCX.js, uma versão anterior ao renderizador matemático e à resolução interativa. A aba foi atualizada para a compilação atual. A prévia agora renderiza frações e raízes, permite editar a expressão e revelar operações reais. As instruções no mapa também usam o renderizador matemático compartilhado.

Novas compilações incluem identificação e release.json. O estúdio verifica atualizações ao recuperar foco, conexão ou visibilidade e periodicamente. O aviso pede um clique para atualizar e respeita respostas aguardando salvamento; não recarrega sozinho. Os sete testes desse comportamento passaram.

## Verificação

- 110 testes da suíte completa passaram, incluindo atividades, matemática, copiloto, publicação e respostas em PostgreSQL local. Mais três testes de caminhos e isolamento do laboratório e um teste de preservação dos rascunhos de outras etapas entre abas passaram.
- 171 cenários das soluções das trilhas passaram: 83 Python executados pelo interpretador e 88 C++ executados por Clang/WASM no navegador. As previsões Python e a necessidade de editar os rascunhos também foram verificadas.
- 11 verificações reais do ambiente passaram: entrada, recursos das linguagens, erros de sintaxe/compilação, cancelamento, tempo limite, limite de saída e isolamento.
- 38 verificações funcionais da integração passaram com API em memória e dados inventados, carregando os scripts reais de professor e aluno. Não se alterou a autenticação da aplicação. O teste inclui remover os metadados de programação quando o professor troca o formato para redes.
- Na aplicação aberta, a primeira missão Python falhou com o rascunho inicial, passou após edição e exigiu a variação antes de avançar. Alterar a variação retirou a validação; recarregar preservou os códigos; restaurar o exemplo permitiu recuperar o rascunho.
- O mini projeto C++ da cantina passou em seus cinco cenários, incluindo igualdade, falta de estoque, zero e total grande. A variação de reserva passou nos quatro cenários e liberou a próxima etapa após a previsão correta.
- O layout real foi inspecionado em iframes de 390 e 820 pixels. A largura útil foi 375 e 805 pixels com a barra de rolagem. Nenhuma dessas páginas teve transbordamento horizontal; os botões Executar, Parar e Validar mantiveram 44 pixels de altura. Isso verifica os pontos de adaptação do layout, não dispositivos móveis físicos.
- O pacote público foi regenerado e os arquivos compartilhados e do portal coincidem com a fonte por hash. Python executou uma saudação com nome composto diretamente no pacote; navegar para outra página e voltar preservou o código e permitiu executar novamente.

## Evidências

- [Editor C++](cpp-editor-validado.png)
- [Terminal, testes e conclusão da variação](cpp-resultados.png)
- [Fórmulas corrigidas com operação revelada](formulas-corrigidas.png)
- [Editor em tela pequena](telas-pequenas.png)
- [Resultado da integração](integracao-resultados.txt)
- [Captura da integração](integracao.png)
- [Execução e isolamento dos ambientes](../programming-runtime-2026-10-03/README.md)
- [Catálogo e critérios pedagógicos](../../development/programacao-trilhas-2026-10-03.md)

## Limites atuais

Os rascunhos e as evidências de prática são guardados por usuário e papel neste navegador; não há sincronização de progresso entre dispositivos ou lançamento de notas escolares. A primeira preparação do C++ baixa aproximadamente 95 MB; os arquivos públicos e programas compilados são reutilizados durante a sessão. Python e C++ precisam de conexão para preparar seus ambientes na primeira execução.

O portal real manteve sua exigência de especialidade docente. A sessão disponível não autorizou a página técnica, por isso o fluxo do formulário foi verificado com a fixture isolada, sem publicar conteúdo real para uma turma. As alterações foram compiladas e incluídas no pacote local; este trabalho não confirma uma publicação remota.
