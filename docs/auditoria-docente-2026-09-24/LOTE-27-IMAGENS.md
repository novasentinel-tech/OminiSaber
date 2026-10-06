# Retorno das 27 capturas — primeira rodada

Referência: imagens enviadas em 24/09/2026, na ordem da mensagem. As capturas incluem professor e aluno, com problemas repetidos. Não são 27 causas independentes confirmadas.

| Imagens | Tema | Estado |
| --- | --- | --- |
| 1 | Numeração do IDE desalinhada | CSS ajustado: fonte 16px, linha 28px e padding iguais; linhas sem quebra visual. Falta validar digitação com teclado Android real |
| 2 | Gráfico / cabeçalho | Pendente de reprodução; gráfico visível não prova falha de interação |
| 3, 12, 15, 16 | Ações do cabeçalho sobre o conteúdo | Altura fixa do header mobile removida no shell docente; teste isolado aprovado |
| 4 | Nota 760/1000 quebrada | Valor indivisível e container com quebra entre elementos; teste aprovado |
| 5, 7 | Leitura e fila de redações | Pendente de revisão visual autenticada |
| 6 | Acesso indisponível | Pendente de identificar origem/destino e perfil; permissões não alteradas |
| 8, 9 | Botões gigantes | Corrigido flex-basis de 180px herdado em coluna; agora altura pelo conteúdo; teste aprovado |
| 10 | Espaço vazio na agenda | Corrigido conflito no CSS compartilhado que tornava estático o formulário lateral oculto. Teste isolado aprovado; confirmação na rota autenticada pendente |
| 11, 18 | Filtro Turma espremido | Cabeçalho com quebra e campo em coluna; alteração local, validação real pendente |
| 13 | Ações dos cartões | Pendente de revisão de densidade e alinhamento |
| 14 | Fechar dividido em duas linhas | Botão não encolhe nem quebra palavra; teste aprovado |
| 17 | Atividades no mapa | Pendente de revisão de truncamento e navegação |
| 19, 22, 23, 24, 25 | Descritores longos | Pendente; não ocultar conteúdo sem mecanismo de expansão |
| 20, 21 | Resultado e lista de atividades | Pendente de reprodução; screenshot isolado não confirma falha funcional |
| 26, 27 | Carregamento e vazio de Redação | Pendente de investigar dados/estado vazio; não inventar desempenho |

## Testes desta rodada

`tests/mobile-layout-regressions.html`: 12 verificações aprovadas no navegador, quatro em cada largura 320/390/768px: header contém ações, botões sem altura excessiva, nota indivisível e Fechar sem quebra. Dados e markup isolados, sem acesso ao banco; não substituem a revisão das rotas autenticadas.

`node frontend/Parties/check.mjs`: 96 páginas sem falhas estáticas. Parties regenerado na versão 20260924-5; CSS do IDE versionado em 20260924-4. Nada publicado no Netlify. Nenhuma nota, autorização ou conteúdo escolar foi alterado.

## Continuação — agenda e IDE

O seletor mobile compartilhado aplicava `position: static` tanto ao painel do dia quanto ao formulário lateral da agenda. O formulário oculto por transformação continuava ocupando espaço no documento. Agora apenas o painel do dia fica estático; o formulário permanece fixo até 960px, com altura limitada à viewport, rolagem interna e visibilidade condicionada à classe `form-open`.

`tests/agenda-ide-layout.html`: 15 verificações aprovadas no navegador, cinco por largura (320/390/768px): formulário fora do fluxo, fechado invisível, aberto visível, métricas iguais entre código e numeração, código sem quebra visual. A fixture combina os componentes para verificar CSS; não representa um fluxo integrado nem testa teclado Android.

A tentativa de abrir `/frontend/professor/agenda/index.html` redirecionou para o login. A revisão autenticada de agenda e redações continua pendente; não houve alteração ou contorno de permissões.

Próxima rodada: reproduzir agenda e redações em sessão docente, testar IDE com teclado móvel e revisar mapa de dificuldades com descrições longas. Não marcar todo o lote como resolvido.
