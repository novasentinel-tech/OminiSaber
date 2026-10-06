# Otimização e responsividade — Avaliações do professor

Data: 29/09/2026  
Superfície: páginas de avaliações de Português, Matemática, Informática e Administração.

## Objetivo

Reduzir o trabalho realizado no primeiro carregamento, evitar renderizações repetidas durante a correção e garantir que cabeçalho, filtros, navegação, cartões e módulos especializados se adaptem de desktop a celulares Android.

## Diagnóstico

- O construtor de avaliações, o Copiloto e a central de correções eram baixados mesmo quando o professor permanecia em **Minhas avaliações**.
- Esses recursos somavam aproximadamente 220,1 KB de CSS e JavaScript locais antes de compressão.
- O cabeçalho móvel repetia ações já oferecidas pela própria página e pela navegação inferior, ocupando 125 px e exigindo rolagem horizontal interna.
- A pesquisa da fila reconstruía toda a área a cada tecla digitada.
- Listas extensas mantinham todos os cartões renderizados mesmo quando estavam longe da área visível.

## Correções aplicadas

### Carregamento sob demanda

- **Minhas avaliações** inicia sem o construtor, Copiloto ou central de correções.
- **Nova avaliação** carrega `activity-builder` e `teacher-copilot` somente quando aberta.
- **Acompanhamento** e **Correção e recuperação** carregam `teacher-review` somente quando abertas.
- Passar o ponteiro ou focar uma aba inicia um pré-carregamento discreto para reduzir a espera percebida.
- Uma tela breve e acessível informa quando um módulo está sendo preparado e oferece nova tentativa em caso de falha.

### Renderização e interação

- Cartões fora da área visível usam `content-visibility: auto` e tamanho intrínseco reservado.
- A busca da fila possui espera de 120 ms, evitando reconstruir toda a interface para cada tecla.
- Título e subtítulo do cabeçalho são restaurados ao sair do construtor, evitando contexto incorreto entre abas.

### Responsividade

- Em celulares de até 540 px, ações duplicadas do cabeçalho são ocultadas; as funções continuam disponíveis nas abas e na navegação inferior.
- O cabeçalho móvel passou de 125 px para 74 px no cenário testado.
- Filtros usam uma única coluna em celulares, com campos de largura total.
- Tablet mantém as três ações do cabeçalho sem rolagem horizontal.
- Desktop, tablet e celular não apresentaram transbordamento horizontal.

## Medidas verificadas

| Estado | Antes | Depois |
|---|---:|---:|
| Módulos especializados no primeiro carregamento | 3 | 0 |
| CSS/JS local adiado | 0 KB | 220,1 KB |
| Altura do cabeçalho em 390 × 844 | 125 px | 74 px |
| Rolagem horizontal em 390, 768 e 1440 px | ausente | ausente |

## Testes

- Fluxo controlado: listagem, filtros, prévia, resultados, correções e construtor.
- Carregamento direto e por navegação dos módulos sob demanda.
- Viewports: 390 × 844, 768 × 1024 e 1440 × 900.
- Verificadores de correção docente, atividade do aluno e recuperação aprovados.
- Console do navegador sem erros na versão final testada.

## Limite conhecido

O arquivo visual compartilhado `Parties/parties.css` ainda reúne estilos de várias áreas do produto. Ele permanece nesta fase para não fragmentar o sistema visual inteiro sem uma validação transversal; a maior economia segura desta página veio dos módulos funcionais carregados sob demanda.

final result: passed
