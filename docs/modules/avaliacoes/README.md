# Avaliações

## Objetivo

Criar, publicar e acompanhar avaliações docentes.

## Estrutura

Páginas em `frontend/professor/*/avaliacoes/`; execução do aluno em `frontend/aluno/` e cliente compartilhado em `backend/`.

## Funcionamento

O professor monta avaliação, adiciona questões, salva rascunho ou publica para uma turma. Alunos acessam avaliações publicadas e registram tentativas.

## Banco de dados

`avaliacoes_docentes` é o registro canônico do motor para atividades, avaliações,
diagnósticos e recuperações. As questões ficam em `questoes_avaliacao`, os gabaritos
em `gabaritos_avaliacao`, as versões publicadas em `avaliacoes_versoes`, as tentativas
em `tentativas_avaliacao` e cada resposta em `respostas_avaliacao`.

O vínculo `professor_turma_materias` define quais matérias um professor pode aplicar
em cada turma. A autorização não depende mais somente do tipo visual do professor.

## Regras da fase 2.1

- Uma avaliação nasce como rascunho e só pode ser editada enquanto estiver nesse estado.
- Publicar cria um snapshot sem gabarito, preservando o conteúdo recebido pelo aluno.
- Atividades publicadas não voltam a rascunho; alterações estruturais exigem nova versão.
- O aluno só inicia tentativas da própria turma, dentro da janela e do limite definido.
- O aluno não possui permissão direta para alterar nota, feedback ou estado de correção.
- Gabaritos são visíveis apenas ao professor autor e ao gestor.
- Todas as tabelas expostas usam RLS e grants mínimos explícitos.

## Construtor docente — fase 2.2

As quatro especialidades usam o mesmo construtor responsivo em
`frontend/professor/specialty/activity-builder.js`. A identidade visual de cada
professor continua sendo definida por `configs.js`, mas as regras de negócio são
únicas para impedir diferenças de comportamento entre disciplinas.

O fluxo possui quatro etapas:

1. contexto: turma, modalidade, trimestre, duração, valor e orientações;
2. currículo: pesquisa e seleção de habilidades e descritores publicados;
3. questões: onze formatos, gabarito, explicação, ordenação e vínculo curricular;
4. revisão: pontuação igual ou manual, tentativas, janela, embaralhamento e feedback.

Ao salvar, o frontend envia um único payload para a função
`criar_atividade_docente`. A função confere o perfil, o vínculo entre professor,
turma e matéria, os descritores, os pontos e as datas. Avaliação, questões,
gabaritos e vínculos são gravados na mesma transação: qualquer falha desfaz o
conjunto inteiro. Na publicação, o snapshot imutável da fase 2.1 é criado.

Não existe catálogo ou avaliação de demonstração no construtor. Turmas,
descritores e histórico são carregados do projeto Supabase configurado. Sem um
vínculo ativo, a página orienta o professor a solicitar a associação ao gestor.

Atividades já existentes podem ser duplicadas. A cópia é sempre um novo rascunho,
preservando a versão que já foi entregue aos alunos e permitindo que o professor
adapte questões, turma, prazo ou pontuação com segurança.

## Execução do aluno — fase 2.3

A página `frontend/aluno/atividades/` lista somente atividades publicadas para a
turma autenticada. O aluno pode iniciar até o limite definido pelo professor,
responder em celular ou computador e continuar uma tentativa em andamento.

Cada resposta é salva individualmente por `salvar_resposta_avaliacao`. A entrega
usa `entregar_tentativa_avaliacao`, bloqueia alterações posteriores e aciona uma
rotina do banco que:

- corrige automaticamente escolha única, múltipla escolha, verdadeiro/falso,
  respostas curtas, numéricas, ordenação, associação e cálculos;
- envia questões dissertativas, código e estudos de caso para revisão docente;
- registra pontuação automática, estado de revisão e auditoria;
- nunca devolve o gabarito ao navegador do aluno.

As tentativas são numeradas e preservam a versão publicada da atividade. O aluno
não pode definir nota, marcar resposta como correta ou alterar o estado da
correção diretamente.

## Correção docente e resultados — fase 2.3

As quatro especialidades compartilham a central responsiva implementada em
`frontend/professor/specialty/teacher-review.js`. Ela possui duas áreas:

- fila de correção, ordenada pela data de entrega, somente com tentativas que
  realmente possuem questões abertas pendentes;
- resultados, com notas por aluno, situação da tentativa e domínio agregado por
  habilidade/descritor associado às questões.

O professor registra pontos e devolutiva por resposta pela função
`corrigir_resposta_avaliacao`. A função valida autoria, estado da entrega e limite
de pontos, recalcula as parcelas automática e manual e registra auditoria. Ao
finalizar a última resposta aberta, a tentativa muda para `corrigida` e a nota é
liberada automaticamente.

Os relatórios usam `resultados_avaliacao_docente` e
`resultados_descritores_avaliacao`. Eles leem apenas avaliações autorizadas pelas
políticas do banco e não mantêm cópias ou métricas mockadas no navegador.

## Permissões

O professor gerencia e corrige avaliações próprias e de suas turmas conforme
especialidade. O aluno consulta e responde avaliações publicadas autorizadas. O
gestor pode consultar resultados institucionais, mas não existe acesso anônimo às
rotinas de correção.

## Resultados e recuperação — fase 2.4

O painel de resultados passou a usar `painel_resultados_avaliacao`, que calcula
diretamente no PostgreSQL a média da turma, entregas, pendências, acertos por
questão e desempenho ponderado por habilidade/descritor. A lista inclui todos os
alunos vinculados à turma, inclusive quem ainda não iniciou a atividade.

Uma nota corrigida pode ser ajustada por professor autor ou gestor somente com
justificativa. `ajustar_nota_avaliacao` registra a alteração em
`ajustes_notas_avaliacao`, atualiza a tentativa por gatilho interno protegido e
mantém o antes, o depois, o responsável, o motivo e a data na auditoria.

O professor pode selecionar os descritores com menor desempenho e executar
`criar_recuperacao_descritores`. A rotina cria um novo rascunho de recuperação,
duplica somente as questões relacionadas às habilidades escolhidas e preserva a
avaliação original. O professor revisa o rascunho antes de publicar.

No painel do aluno, `desempenho_aluno_descritores` considera apenas a tentativa
corrigida mais recente de cada avaliação. O indicador “Geral” é a soma real dos
pontos obtidos dividida pela soma dos pontos possíveis em todos os descritores;
trilhas concluídas, notas legadas e valores locais não entram nesse percentual.
