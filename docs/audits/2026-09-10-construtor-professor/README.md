# Auditoria visual do construtor de atividades do professor

Data: 10 de setembro de 2026  
Escopo inspecionado: construtor compartilhado de atividades, com validação completa no módulo do professor de Matemática.

## Resumo

O construtor possui quatro formatos pedagógicos, nove estilos de aplicação, onze editores de questão e cinco modelos matemáticos. As visualizações foram abertas em uma sessão real de professor, com turma e habilidade reais selecionadas. Nenhuma atividade foi salva ou publicada durante a auditoria.

Os componentes centrais funcionam, inclusive os previews matemáticos de plano cartesiano, reta numérica, triângulo e gráfico de barras. Os defeitos mais importantes são transversais: a composição de três colunas excede a largura disponível em notebooks e a barra inferior fixa cobre campos, botões e os últimos formatos da lista.

## 1. Formatos pedagógicos

| Formato     | Estilos disponíveis                               | Tipos de questão disponíveis |
| ----------- | ------------------------------------------------- | ---------------------------: |
| Atividade   | Trilha guiada; Oficina interativa; Prática rápida |                           10 |
| Avaliação   | Prova mista; Prova objetiva                       |                            9 |
| Diagnóstica | Sondagem inicial; Mapa de descritores             |                            8 |
| Recuperação | Retomada guiada; Nova oportunidade                |                            8 |

### Avaliação e Prova Segura

A configuração de Avaliação oferece a ativação opcional da Prova Segura. A mensagem atual está tecnicamente correta: solicita tela cheia, restringe copiar/colar, registra troca de aba e deixa explícito que um navegador não consegue bloquear DevTools nem comprovar uso de IA. Sinais suspeitos são enviados para revisão humana e não produzem nota zero automática.

Evidência: [22-avaliacao-prova-segura-detalhe.png](./22-avaliacao-prova-segura-detalhe.png)

## 2. Editores de questão

| Editor              | Grupo        | Correção        | Atividade | Avaliação | Diagnóstica | Recuperação |
| ------------------- | ------------ | --------------- | :-------: | :-------: | :---------: | :---------: |
| Escolha única       | Objetiva     | Automática      |    Sim    |    Sim    |     Sim     |     Sim     |
| Múltipla escolha    | Objetiva     | Automática      |    Sim    |    Sim    |     Sim     |     Não     |
| Verdadeiro ou falso | Objetiva     | Automática      |    Sim    |    Sim    |     Sim     |     Sim     |
| Associação          | Interativa   | Automática      |    Sim    |    Não    |     Sim     |     Sim     |
| Ordenação           | Interativa   | Automática      |    Sim    |    Não    |     Sim     |     Sim     |
| Resposta curta      | Escrita      | Automática      |    Sim    |    Sim    |     Sim     |     Sim     |
| Resposta numérica   | Exata        | Automática      |    Sim    |    Sim    |     Sim     |     Sim     |
| Cálculo             | Exata        | Automática      |    Sim    |    Sim    |     Não     |     Sim     |
| Estudo de caso      | Investigação | Revisão docente |    Sim    |    Sim    |     Sim     |     Sim     |
| Dissertativa        | Escrita      | Revisão docente |    Não    |    Sim    |     Não     |     Não     |
| Código              | Prática      | Revisão docente |    Sim    |    Sim    |     Não     |     Não     |

Evidências individuais:

- [Escolha única](./02-escolha-unica.png)
- [Múltipla escolha](./03-multipla-escolha.png)
- [Verdadeiro ou falso](./04-verdadeiro-falso.png)
- [Associação](./05-associacao.png)
- [Ordenação](./06-ordenacao.png)
- [Resposta curta](./07-resposta-curta.png)
- [Estudo de caso](./08-estudo-caso.png)
- [Resposta numérica](./09-resposta-numerica.png)
- [Cálculo](./10-calculo.png)
- [Código](./11-codigo.png)
- [Dissertativa](./23-dissertativa-avaliacao.png)

## 3. Modelos matemáticos

| Modelo              | Interação esperada do aluno                    | Descritor sugerido | Tipo-base         |
| ------------------- | ---------------------------------------------- | ------------------ | ----------------- |
| Questão livre       | Resolver cálculo, alternativa ou demonstração  | Qualquer descritor | Cálculo           |
| Plano cartesiano    | Marcar um ponto diretamente no plano           | D043_M             | Resposta curta    |
| Reta numérica       | Posicionar um valor em uma reta graduada       | D009_M e D033_M    | Resposta numérica |
| Triângulo e medidas | Interpretar catetos, hipotenusa e unidades     | D049_M             | Resposta numérica |
| Leitura de gráfico  | Ler e selecionar dados de um gráfico de barras | D064_M             | Escolha única     |

Evidências de configuração e preview:

- [Questão livre](./12-matematica-livre.png)
- [Plano cartesiano](./13-plano-cartesiano.png) e [preview](./17-preview-plano-cartesiano.png)
- [Reta numérica](./14-reta-numerica.png) e [preview](./18-preview-reta-numerica.png)
- [Triângulo e medidas](./15-triangulo-medidas.png) e [preview](./19-preview-triangulo-medidas.png)
- [Leitura de gráfico](./16-grafico-barras.png) e [preview](./20-preview-grafico-barras.png)

## 4. Problemas encontrados

### P0 — Bloqueadores de uso

1. **A barra inferior cobre o editor.** Em telas de notebook, a barra com Voltar, Continuar, Salvar e Publicar sobrepõe campos, botões de remoção e os últimos tipos de questão.
2. **Há rolagem horizontal no desktop.** A composição usa larguras mínimas que ultrapassam a área disponível quando a sidebar está aberta. O professor precisa deslocar a página lateralmente para acessar o roteiro e parte do editor.
3. **Os últimos tipos da paleta ficam difíceis de acessar.** Cálculo e Código podem permanecer escondidos sob a barra inferior; durante a navegação visual, o clique não alterou o editor até a página ser reposicionada.

### P1 — Impacto alto na clareza

4. **O cabeçalho fixo recorta o início do editor.** Ao navegar para um tipo ou modelo, o topo colorido do editor fica parcialmente atrás do cabeçalho.
5. **A etapa 3 tenta exibir conteúdo demais ao mesmo tempo.** Modelos matemáticos, paleta, formulário e roteiro competem pela mesma área. O roteiro desaparece em larguras intermediárias e reaparece abaixo, aumentando muito o percurso vertical.
6. **Ações de publicação aparecem cedo demais.** “Salvar rascunho” e “Publicar para a turma” permanecem visíveis nas etapas 1 a 3, concorrendo com “Continuar” e permitindo uma decisão antes da revisão final.
7. **A paleta não explica o destino do clique.** O professor vê o tipo, mas não se a troca descartará valores já preenchidos no editor atual.

### P2 — Refinamentos de experiência e acessibilidade

8. **Semântica dos modelos matemáticos é ambígua.** Os cartões são botões com `aria-pressed`, mas são anunciados como seleção semelhante a checkbox. O grupo deve se comportar como escolha única clara.
9. **Preview de gráfico vazio é pouco orientativo.** Antes de inserir linhas, há apenas uma mensagem; um esqueleto visual ou exemplo curto ajudaria a compreender o resultado esperado.
10. **A barra inferior pode interceptar foco de teclado.** Campos localizados atrás dela continuam existindo na ordem de foco, mas não ficam visíveis.
11. **Falta confirmação visual persistente da troca de formato.** A cor muda, porém o título principal da página continua “Avaliações de Matemática” mesmo quando o professor está criando Atividade, Diagnóstica ou Recuperação.

## 5. Ordem recomendada de correção

1. Remover a sobreposição da barra inferior e reservar espaço real ao final da etapa.
2. Eliminar a largura mínima que gera rolagem horizontal; adaptar as três colunas por espaço disponível.
3. Garantir rolagem e seleção confiáveis para todos os onze tipos.
4. Corrigir compensação do cabeçalho fixo ao focar ou trocar o editor.
5. Exibir Salvar/Publicar apenas na revisão, mantendo rascunho como ação secundária discreta nas etapas anteriores.
6. Simplificar a etapa 3: modelos recolhíveis, paleta compacta e roteiro sempre acessível.
7. Ajustar semântica, foco, estados vazios e textos de contexto.
8. Revalidar desktop com sidebar aberta/fechada, tablet e celular.

## 6. Limites desta auditoria

A inspeção cobriu renderização, navegação, estados, controles e árvore de acessibilidade exposta pelo navegador. A conformidade WCAG completa exige uma rodada adicional com teclado, leitor de tela e medições de contraste. A persistência no Supabase não foi acionada nesta auditoria para evitar criar atividade de teste no banco.

## 7. Correções aplicadas

Status da rodada concluída em 10 de setembro de 2026:

| Item                   | Correção                                                                                      | Validação                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Barra inferior         | Deixou de sobrepor o conteúdo e passou a ocupar espaço real após a etapa                      | Aprovada nas etapas 1, 3 e 4                                        |
| Ações por etapa        | Voltar, Continuar, Salvar e Publicar respeitam corretamente o atributo `hidden`               | Aprovada: etapa 1 mostra apenas Continuar; etapa 4 oculta Continuar |
| Rolagem horizontal     | Removida a largura indevida dos controles invisíveis e eliminadas larguras mínimas excessivas | Aprovada em 1171 px, com sidebar aberta e fechada                   |
| Composição responsiva  | Duas colunas em notebook, uma coluna em telas menores e três somente em telas amplas          | Aprovada com sidebar aberta: 220 px + coluna fluida                 |
| Paleta de tipos        | Altura limitada ao espaço útil, rolagem interna e acesso confiável aos últimos itens          | Todos os 10 tipos de Atividade trocaram corretamente                |
| Cabeçalho fixo         | Adicionada compensação de rolagem para etapa e editor                                         | Editor não é mais alinhado atrás do cabeçalho                       |
| Modelos matemáticos    | Área passou a ser recolhível e preserva um resumo do modelo selecionado                       | Aprovada nos estados aberto e recolhido                             |
| Segurança contra perda | Troca de editor ou modelo pede confirmação quando há conteúdo não adicionado                  | Implementada                                                        |
| Semântica dos modelos  | Seleção passou a usar grupo e opções de rádio, com navegação pelas setas                      | Implementada                                                        |
| Gráfico vazio          | Incluído esqueleto visual com instrução do formato esperado                                   | Implementada                                                        |
| Contexto da página     | Título e subtítulo agora acompanham Atividade, Avaliação, Diagnóstica e Recuperação           | Quatro formatos aprovados                                           |

Novas evidências:

- [Etapa inicial sem ações antecipadas](./26-correcao-etapa-1.png)
- [Etapa 3 sem rolagem horizontal](./27-correcao-etapa-3.png)
- [Etapa 3 com sidebar aberta](./28-correcao-sidebar-aberta.png)
- [Revisão após a primeira correção](./29-correcao-revisao.png)
- [Validação final da revisão](./30-validacao-final-revisao.png)
