# Laboratório de Redação

Jornada de escrita do aluno em três etapas:

1. Exploração de propostas e textos fixados pela professora, seguida do banco completo de temas.
2. Planejamento guiado pelo **Mapa da Redação**, com anotações, tese, dois argumentos, repertório e intervenção.
3. Editor focado somente na redação, com planejamento recolhível, salvamento automático e atalhos de parágrafo.

Depois da terceira etapa, o aluno passa pela revisão estrutural antes de enviar. O histórico preserva versões; quando a professora corrige, a devolutiva mostra nota geral, competências e comentários por trecho.

## Rotas

- `index.html`: proposta e planejamento.
- `escrita/index.html`: sala de escrita focada, sem sidebar, com textos de apoio,
  planejamento consultável, folha de caderno com 30 linhas numeradas e salvamento automático por palavra.
- `revisao/index.html`: checklist antes do envio.
- `corrigida/index.html`: texto, comentários e competências.
- `historico/index.html`: rascunhos, envios, correções e versões.

## Persistência

Supabase é a fonte única de propostas, materiais, repertórios, planejamentos, redações, versões e correções. Falhas de salvamento são exibidas ao aluno e nunca são substituídas por dados locais. Na sala de escrita, uma fila serializada salva ao concluir cada palavra e após uma curta pausa, impedindo que respostas lentas sobrescrevam conteúdo mais recente.

O editor cria um novo parágrafo com `Tab` no início de uma linha ou `Shift + Enter`. Esse comportamento é explicado na etapa 2 e repetido na barra do editor.

### Folha de redação e limite de linhas

A sala de escrita reproduz uma folha pautada com 30 linhas numeradas. A quantidade usada é calculada pelas quebras explícitas e pela quebra visual provocada pela largura disponível. O editor bloqueia qualquer alteração que aumentaria o texto para 31 linhas, preserva a última versão válida e anuncia o limite de forma acessível. Textos antigos acima do limite podem ser reduzidos, mas não ampliados.

No desktop, a base de consulta ocupa aproximadamente 28% da largura e pode ser minimizada para uma faixa lateral ou reaberta a qualquer momento. Um clique ou toque em qualquer bloco — comando, contexto, anotação, tese, argumento, repertório ou intervenção — isola esse conteúdo em modo de leitura. No celular, a mesma base permanece em um painel inferior flutuante para consulta durante a escrita.

Repertórios genéricos não fazem parte do fluxo. Cada referência precisa informar categoria, fonte e aplicação específica ao tema; o banco exige `contextualizado = true`.

## Modos de escrita

Depois de escolher a proposta, o aluno decide como quer trabalhar:

- **Montar por blocos:** abre um tutorial curto e o mapa interativo com seis etapas: tema, tese, argumento 1, repertório, argumento 2 e intervenção.
- **Escrever livremente:** leva diretamente ao editor completo, mantendo o planejamento disponível na lateral.

Os dois modos usam os mesmos campos e registros de planejamento. O aluno pode alternar entre o mapa e o texto livre sem perder o conteúdo. No mapa, o progresso é calculado a partir dos blocos preenchidos; os cartões aceitam clique, toque e navegação pelas setas do teclado.

Em telas pequenas, a trilha de blocos passa a ser horizontal e rolável. A experiência respeita `prefers-reduced-motion`, desativando inclinações e animações para quem solicita movimento reduzido.

O shell foi validado em 320, 390, 768, 1024, 1440 px e desktop amplo. A página usa toda a largura disponível até 1720 px; ao abrir ou recolher a sidebar, o conteúdo se recompõe sem overflow. No celular, o stepper vira uma régua compacta, as ações ocupam a largura disponível e o editor fica em uma única coluna acima da navegação inferior.
