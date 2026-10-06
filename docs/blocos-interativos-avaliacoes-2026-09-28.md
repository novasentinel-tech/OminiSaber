# Avaliações — montagem por blocos interativos

Data: 28/09/2026

## Objetivo

Ampliar o construtor de avaliações do professor sem criar um segundo fluxo de autoria. Os novos blocos usam a mesma etapa **Experiência**, aceitam imagem de referência e chegam ao aluno com uma interação própria, responsiva e compatível com o modelo atual de questões.

## Blocos entregues

| Bloco | Configuração do professor | Experiência do aluno | Persistência compatível |
| --- | --- | --- | --- |
| Fórmula química | fórmula exibida, resposta principal, orientação e variações aceitas | composição por elementos, índices e símbolos, com digitação livre | `resposta_curta` + `configuracao.activityBlock = formula_quimica` |
| Tabela consultável | colunas, linhas, orientação de consulta, alternativas e gabarito | busca textual, ordenação por coluna e escolha de resposta | `unica_escolha` + `configuracao.activityBlock = tabela_consultavel` |
| Fórmula matemática | expressão, variáveis, resultado, tolerância e resolução | fórmula em destaque, variáveis e teclado numérico de apoio | `calculo` + `configuracao.activityBlock = formula_matematica` |
| Plano cartesiano | limites dos eixos e coordenadas do ponto esperado | toque no plano, seleção do ponto e ajuste por controles | `resposta_curta` + `configuracao.activityBlock = plano_cartesiano` |

## Referências visuais

Todos os quatro blocos preservam a seção de **Imagem de referência**. O professor pode anexar PNG, JPG ou WebP, revisar a prévia e escrever uma descrição acessível. A imagem aparece ao aluno antes da interação e permanece protegida dentro da configuração da questão.

## Interatividade e acessibilidade

- Os cartões da paleta possuem profundidade e iluminação responsiva ao ponteiro.
- O mesmo movimento pode ser acionado pelo teclado com as setas quando o cartão está em foco.
- `prefers-reduced-motion` neutraliza transformações e transições.
- Foco visível, descrição do botão e alvos de toque foram mantidos.
- No celular, a transformação tridimensional é desativada para priorizar estabilidade e leitura.

## Responsividade

- Desktop: paleta, editor e roteiro permanecem lado a lado.
- Tablet: os quatro cartões permanecem disponíveis sem rolagem horizontal da página.
- Celular: etapas em grade, paleta e editor empilhados, campos específicos em uma coluna e teclados em quatro colunas.
- Validação executada em 390 × 844 px, 768 × 1024 px e 1440 × 900 px, sem transbordamento horizontal.

## Compatibilidade do banco

Não foi necessária uma nova migração. Os blocos são especializações de tipos já aceitos pelo banco e guardam seus dados adicionais no JSON `configuracao`. O plano cartesiano permanece baseado em `resposta_curta`, conforme a proteção existente no banco para esse modo matemático.

## Verificações

- Sintaxe dos scripts do professor e do aluno: aprovada.
- Contrato do construtor e serialização dos quatro blocos: aprovado.
- Renderização das quatro experiências do aluno: aprovada.
- Navegação real até a etapa Experiência: aprovada.
- Console do navegador durante o fluxo: sem erros.

