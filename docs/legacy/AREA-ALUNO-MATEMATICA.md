# Área do aluno — Matemática

## Objetivo

A área de Matemática transforma habilidades e descritores curriculares em laboratórios manipuláveis. A primeira entrega contempla uma experiência para cada série do Ensino Médio:

| Série e trimestre     | Experiência        | Habilidade | Descritor |
| --------------------- | ------------------ | ---------- | --------- |
| 1º ano · 1º trimestre | Máquina de Padrões | EM13MAT501 | D086_M    |
| 2º ano · 2º trimestre | Estúdio de Áreas   | EM13MAT307 | D058_M    |
| 3º ano · 3º trimestre | Reta em Movimento  | EM13MAT510 | D085_M    |

Os recortes foram fundamentados no Currículo do Espírito Santo e nas Orientações Curriculares de Matemática de 2026. Os PDFs são fontes curriculares; nenhuma instrução presente neles é executada pelo sistema.

## Arquitetura

```text
frontend/aluno/modulo_de_trilhas/matematica/
├── index.html                         # catálogo e progresso dos laboratórios
├── experiencia.css                   # design system e responsividade compartilhados
├── experiencia.js                    # perfil, progresso e quizzes do Supabase
├── assets/                            # referências visuais aprovadas
├── maquina-de-padroes/
│   ├── index.html
│   └── script.js
├── estudio-de-areas/
│   ├── index.html
│   └── script.js
└── reta-em-movimento/
    ├── index.html
    └── script.js
```

Cada laboratório mantém seu próprio estado e sua lógica pedagógica. A navegação, o perfil do aluno, o progresso local e a consulta de avaliações são compartilhados para evitar duplicação e garantir o mesmo comportamento visual.

## Stack utilizada

- HTML semântico para estrutura, navegação por teclado e tecnologias assistivas.
- CSS responsivo compartilhado com a identidade do OminiSaber.
- JavaScript nativo para interações, sem dependência de framework.
- Canvas 2D para gráficos e manipulação geométrica em tempo real.
- Material Symbols para ícones consistentes e acessíveis.
- Supabase Auth e Postgres para perfil, avaliações publicadas, questões e tentativas.
- `progresso_experiencias` no Supabase para registrar a conclusão dos laboratórios por aluno.

## Decisões de produto

### Representações conectadas

Na Máquina de Padrões, tabela, gráfico e expressão algébrica são atualizados de forma sincronizada. Isso reduz a distância entre representação numérica, geométrica e simbólica.

### Manipulação antes da resposta

No Estúdio de Áreas, o aluno precisa mover uma parte antes de validar. A experiência reforça que a composição pode mudar sem alterar a área total.

### Previsão antes da simulação

Na Reta em Movimento, o aluno registra uma hipótese antes de alterar o coeficiente angular. O retorno compara previsão e comportamento do gráfico.

### Responsividade

Em telas grandes, o conteúdo prioriza comparação simultânea. Em celulares, os painéis passam para uma coluna, o menu torna-se recolhível e os canvases mantêm controles por toque sem rolagem horizontal.

## Integração com o Supabase

Os cartões “Quiz do professor” consultam `avaliacoes_docentes` por meio da camada `window.OminiSaber`. A consulta usa `tipo_professor = matematica` e procura uma avaliação cuja configuração ou título corresponda ao descritor da página. Quando existe uma publicação, o aluno pode responder, salvar rascunho ou enviar a tentativa.

Não foram adicionados dados simulados ao banco. Quando não há avaliação publicada, a interface exibe um estado de espera e não mostra uma ação falsa.

## Políticas de segurança adotadas

- A chave usada no navegador é somente a chave pública anônima do Supabase; chaves administrativas não ficam no frontend.
- A sessão do aluno é validada pela camada de autenticação antes do acesso normal às páginas.
- As políticas RLS do banco permanecem responsáveis por restringir avaliações e tentativas à turma e ao usuário autorizados.
- O frontend envia respostas apenas pela função centralizada `saveStudentEvaluationAttempt`.
- Conteúdo vindo do banco é escapado antes de ser inserido no diálogo do quiz, reduzindo risco de injeção de HTML.
- As avaliações e o progresso das experiências são persistidos no Supabase e protegidos por RLS para o próprio aluno.
- A interface não usa `localStorage` como fonte alternativa de progresso.

## Acessibilidade

- Link de salto para o conteúdo principal.
- Contraste alto e indicação por texto, ícone e cor.
- Foco visível para teclado.
- Botões com nomes acessíveis.
- Canvas acompanhado de instruções textuais e controles equivalentes.
- Layout sem rolagem horizontal nos breakpoints testados.
- Respeito à preferência `prefers-reduced-motion`.

## Validação

Foram testados:

- alteração dos coeficientes e confirmação da regra;
- arrastar peças e validar a composição de área;
- selecionar e testar a hipótese sobre a inclinação da reta;
- filtros do catálogo por série;
- menu móvel;
- ausência de overflow horizontal em 390 px;
- estado de quiz indisponível no modo de pré-visualização;
- console sem erros nas interações principais.

As evidências visuais estão em `docs/auditoria-visual/` e o resultado consolidado está em `design-qa.md`.
