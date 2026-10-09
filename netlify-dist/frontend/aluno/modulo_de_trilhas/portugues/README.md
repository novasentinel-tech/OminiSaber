# Língua Portuguesa

Área curricular responsiva do aluno, organizada por descritor e por experiência de aprendizagem.

## Rotas

- `index.html`: catálogo das experiências e progresso local.
- `mapa-da-lingua/index.html`: 1º ano, 1º trimestre, `EM13LP10` e `D103_P`.
- `investigacao-argumentativa/index.html`: 2º ano, 3º trimestre, `EM13LP05` e `D055_P`.
- `interpretacao-visual/index.html`: 3º ano, 1º trimestre, `EM13LP48` e `D057_P`.

## Recursos compartilhados

- `experiencia.css`: shell, sidebar, componentes pedagógicos e breakpoints.
- `experiencia.js`: perfil, menu móvel, progresso da experiência e quiz docente.
- `assets/`: mapa linguístico e colagem editorial gerados especificamente para as atividades.

## Dados

O conteúdo pedagógico-base é autoral e permanece no frontend. Perfil, avaliações publicadas, questões e tentativas são carregados ou gravados pelo gateway `window.OminiSaber` no Supabase.

O quiz docente usa:

- `listStudentEvaluations({ tipoProfessor: 'portugues' })`;
- `getStudentEvaluationAttempt(avaliacaoId)`;
- `saveStudentEvaluationAttempt({ evaluationId, responses, submit })`.

Na ausência de configuração ou publicação, a interface apresenta um estado explícito e não injeta registros demonstrativos.

## Acessibilidade

- menu adaptado para toque;
- navegação por teclado e foco visível;
- `skip-link` em todas as páginas;
- textos alternativos nos recursos gráficos;
- descrição da imagem por síntese de voz quando suportada;
- pistas com texto e forma, sem depender apenas de cor;
- respeito a `prefers-reduced-motion`.
