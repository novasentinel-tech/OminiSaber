# Motor de atividades — Fases 2.1 a 2.4

> Integração de autoria: o OminiStudio está disponível nos quatro painéis docentes pelo shell compartilhado em `frontend/professor/specialty/portal.js`. A engine mantém build separado, recuperação local e persistência no Supabase. Publicações geram versões imutáveis por turma; tentativas, respostas, correção e auditoria são protegidas por RLS e RPCs autenticadas.

## Objetivo

Fechar o ciclo entre currículo, professor, aluno, correção e recuperação usando um
único contrato de dados para todas as matérias.

## Fluxo funcional

```text
Catálogo curricular
       ↓
Construtor docente → rascunho → publicação versionada
       ↓
Notificação da turma + destaque no painel do aluno
       ↓
Lista do aluno → tentativa → respostas salvas → entrega bloqueada
       ↓
Correção automática + fila de questões abertas
       ↓
Resultados da turma → ajuste auditável → recuperação focada
       ↓
Desempenho real do aluno por habilidade/descritor
```

## Fase 2.1 — fundação

- `avaliacoes_docentes` é o registro canônico para atividade, avaliação,
  diagnóstica e recuperação.
- `professor_turma_materias` autoriza a combinação exata de professor, turma e
  matéria.
- `avaliacoes_versoes` preserva o snapshot publicado sem gabarito.
- `respostas_avaliacao` normaliza uma resposta por questão e tentativa.
- `avaliacoes_auditoria` registra eventos relevantes do ciclo.
- Conteúdo publicado é imutável; mudanças pedagógicas exigem novo rascunho ou nova
  versão.

## Fase 2.2 — construtor docente

O construtor compartilhado oferece contexto, currículo, questões e revisão. A RPC
`criar_atividade_docente(jsonb)` valida e grava o conjunto em uma transação.

Formatos aceitos:

- escolha única e múltipla escolha;
- verdadeiro ou falso;
- resposta curta, numérica e cálculo;
- associação e ordenação;
- dissertativa, código e estudo de caso.

O professor pode distribuir pontos igualmente ou definir pesos. Turma, matéria,
habilidades, descritores, datas, limite de tentativas e soma dos pontos são
validados no banco.

### Ateliê matemático

O construtor de Matemática oferece experiências próprias para os descritores mais
recorrentes no material de referência do PAEBES, sem copiar enunciados da prova:

- plano cartesiano clicável para localização de pontos (`D043_M`);
- reta numérica com marcador graduado (`D009_M` e `D033_M`);
- triângulo retângulo com medidas e resolução de referência (`D049_M`);
- laboratório de medidas com figuras 2D, sólidos 3D e formas personalizadas;
- gráfico de barras clicável para leitura e comparação (`D064_M`);
- questão livre para cálculo, alternativa ou demonstração.

O professor escolhe o modelo, configura os dados e acompanha uma prévia visual ao
vivo. A experiência escolhida é gravada em
`questoes_avaliacao.configuracao.mathMode`; limites, medidas, séries e rótulos
permanecem no mesmo JSON. No painel do aluno, o motor reconstrói o controle
interativo, salva cada resposta pela RPC existente e mantém o gabarito fora do
navegador. As coordenadas do plano usam valores inteiros, coerentes com o seletor
por toque e teclado.

No laboratório geométrico, `dimension`, `shape`, medidas, unidade, objetivo do
cálculo, tolerância e controles permitidos são persistidos no mesmo contrato. A
visualização do aluno permite rotação, ampliação e alternância dos rótulos sem
alterar os dados usados pela correção.

O roteiro deixou de ser uma coluna fixa do compositor: fica ao final da etapa 3,
pode ser minimizado e continua responsável por edição, ordenação, exclusão e soma
dos pontos.

## Fase 2.3 — aluno e correção

- Ao publicar, o banco cria ou atualiza uma notificação vinculada à atividade e à
  turma. Atividades já publicadas são retroalimentadas pela migration.
- O dashboard e a Central de Atividades usam a mesma fonte canônica,
  `avaliacoes_docentes`, e consideram a tentativa mais recente do aluno.
- O dashboard prioriza primeiro uma tentativa em andamento e depois o prazo mais
  próximo. Os contadores de atividades e notificações vêm do Supabase.
- `iniciar_tentativa_avaliacao` cria uma tentativa autorizada e numerada.
- `salvar_resposta_avaliacao` permite retomar o trabalho antes da entrega.
- `entregar_tentativa_avaliacao` bloqueia a tentativa e inicia a correção.
- Questões determinísticas são corrigidas no banco.
- Questões numéricas e de cálculo respeitam a tolerância configurada pelo
  professor; respostas curtas aceitam as variações explicitamente cadastradas.
- Os contratos de plano cartesiano, reta numérica, triângulo, geometria 2D/3D, gráfico,
  associação e ordenação são validados antes de o gabarito ser persistido.
- Dissertativa, código e estudo de caso seguem para revisão docente.
- `corrigir_resposta_avaliacao` limita a pontuação ao valor da questão, registra
  feedback e recalcula a nota.

O gabarito não é enviado ao navegador do aluno e o aluno não recebe permissão para
alterar nota, correção ou auditoria.

O Realtime acompanha a tabela `notificacoes`; uma publicação docente atualiza o
painel aberto sem depender de dados locais ou recarregamento manual.

## Fase 3.1 — autoria adaptativa

O construtor muda conforme a intenção escolhida pelo professor:

- **Avaliação:** prova objetiva ou mista, regras formais e opção de Prova Segura;
- **Atividade:** trilha guiada, oficina interativa ou prática rápida;
- **Diagnóstica:** sondagem inicial ou mapa de descritores;
- **Recuperação:** retomada guiada ou nova oportunidade.

A etapa curricular exibe habilidade completa, série, trimestre e descritores
relacionados em cartões amplos. A etapa de experiência usa editores próprios para
cada tipo de questão; alternativas, pares, sequências, cálculo, código e critérios
de revisão não compartilham mais uma caixa de texto genérica.

`configuracao.experienceStyle` preserva o modelo pedagógico escolhido. As
configurações específicas de cada questão são gravadas em
`questoes_avaliacao.configuracao`. Associação e ordenação também possuem
controles próprios na experiência do aluno.

### Prova Segura

Quando habilitada, `configuracao.secureExam` solicita tela cheia, restringe
copiar, colar e menu de contexto e alerta o aluno quando a página perde o foco.
Esses controles são barreiras e sinalizações no navegador, não garantias
absolutas.

Uma aplicação web não consegue impedir a abertura do DevTools nem identificar
com certeza se uma resposta foi produzida por inteligência artificial. Por isso,
o contrato usa `aiHandling: teacher_review`: sinais suspeitos devem ser revisados
por uma pessoa e não geram nota zero automática sem evidência auditável.

## Fase 2.4 — resultados e recuperação

`painel_resultados_avaliacao(uuid)` retorna:

- nota individual e média da turma;
- entregas, pendências e alunos que não iniciaram;
- acertos e média de pontos por questão;
- desempenho ponderado por habilidade e descritor;
- questões com maior dificuldade;
- histórico recente de auditoria.

`ajustar_nota_avaliacao` exige justificativa, limita a nova nota ao valor da
avaliação e grava o antes, depois, responsável e data em
`ajustes_notas_avaliacao`.

`criar_recuperacao_descritores` duplica para um novo rascunho somente as questões
associadas às habilidades selecionadas. O professor revisa antes de publicar.

`desempenho_aluno_descritores()` usa a tentativa corrigida mais recente de cada
avaliação. O percentual geral é calculado por `soma dos pontos obtidos / soma dos
pontos possíveis`; não usa valores locais, notas fictícias ou fallback visual.

## Responsabilidades por camada

| Camada                | Responsabilidade                                             |
| --------------------- | ------------------------------------------------------------ |
| Frontend              | Coletar intenção, mostrar estados e impedir ações acidentais |
| Cliente compartilhado | Padronizar consultas e chamadas RPC                          |
| PostgreSQL            | Autorizar, validar, persistir, corrigir e auditar            |
| RLS                   | Limitar linhas por usuário, papel, turma e vínculo           |
| Professor             | Revisar questões abertas, notas ajustadas e recuperação      |

## Verificação

Na pasta `backend`:

```powershell
npm run activity:builder:check
npm run activity:student:check
npm run activity:teacher-review:check
npm run activity:results:check
```

Esses verificadores validam contratos locais. O aceite final deve incluir contas
reais de teste no Supabase, uma entrega completa e cenários negativos de acesso.

Em 10/09/2026, o fluxo remoto foi exercitado dentro de uma transação descartada:
os onze formatos foram criados por uma conta docente real, respondidos por uma
conta de aluno e entregues. Os oito formatos determinísticos totalizaram 8 pontos
e os três formatos abertos seguiram para revisão, sem deixar registros de teste.
