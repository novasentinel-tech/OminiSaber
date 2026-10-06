# Status do projeto

Atualizado em **6 de outubro de 2026**.

## Resumo executivo

O ciclo central de atividades está implementado da criação docente até resultados
e recuperação. A Fase 3 adiciona um Copiloto conectado ao Supabase, usando Google
Gemini por Edge Function. O ambiente de testes foi saneado e recebeu dados
sintéticos controlados para validar atividades e trilhas.

Desde a auditoria inicial, as áreas de aluno e professor receberam correções
responsivas documentadas, a engine de trabalhos ganhou uma aplicação separada e o
banco recebeu uma migration local de governança. Essa migration ainda depende de
promoção por uma conexão DDL autorizada no projeto Supabase.

Uma auditoria integral foi executada nesta data. A estrutura do ciclo passou nos
verificadores, porém existem bugs de integridade, riscos de segurança e lacunas de
teste que impedem declarar o sistema pronto para produção. Consulte a
[auditoria geral](auditoria-sistema-2026-09-09.md).

| Entrega                             | Estado                | Evidência principal                                        |
| ----------------------------------- | --------------------- | ---------------------------------------------------------- |
| Catálogo curricular comum           | Implementado          | 153 habilidades e 55 descritores preservados                |
| Fase 2.1 — fundação do motor        | Implementada          | versionamento, gabaritos protegidos, RLS e auditoria       |
| Fase 2.2 — construtor docente       | Implementada          | criação transacional e 11 formatos de questão              |
| Fase 2.3 — execução e correção      | Implementada          | salvamento, entrega, correção automática e revisão manual  |
| Fase 2.4 — resultados e recuperação | Implementada no beta  | métricas reais, ajustes auditáveis e recuperação focada    |
| Descoberta de atividades pelo aluno | Implementada no beta  | dashboard, badges, notificações persistentes e Realtime    |
| Fase 3.0 — Copiloto docente         | Implementada localmente; deploy pendente | Três contratos canônicos, Gemini, agregados e revisão docente |
| Fase 3.1 — construtor adaptativo    | Implementada          | etapa 3 muda por formato e tipo; Prova Segura configurável |
| Layout do professor                 | Revisado               | auditoria desktop/mobile e lote de 27 evidências           |
| Engine de trabalhos interativos     | Protótipo funcional    | seleção de fluxo, criação e documentação própria           |
| Governança do banco                 | Em validação          | 77 tabelas com RLS e migrations consolidadas                 |
| Controle documental                 | Implementado           | 28 documentos controlados por código e versão              |

“Implementada” significa que código, SQL e verificadores automatizados existem. A
liberação para produção continua dependendo de teste de aceitação com contas e
dados representativos da escola.

## O que o beta pode testar

- criação de atividades por turma, matéria, série, trimestre e descritor;
- pontuação igual ou manual;
- publicação e versão imutável para o aluno;
- notificação automática da turma e destaque da pendência no painel do aluno;
- início, salvamento, retomada e entrega da tentativa;
- correção automática de formatos objetivos;
- fila docente para questões abertas;
- nota individual, média da turma e alunos sem entrega;
- acertos por questão e desempenho por descritor;
- ajuste manual de nota com justificativa e histórico;
- geração de rascunho de recuperação pelos descritores de menor desempenho;
- indicador geral do aluno calculado por evidências reais.

## O que ainda não deve ser liberado aos testadores

- a flag global `professor_copiloto` antes do aceite da conta piloto;
- contas sintéticas fora do ambiente de testes;
- publicação automática de rascunhos gerados pela IA.

## Fase 3 — Estado Local e Aceite Remoto

O escopo local do piloto agora tem três contratos: `generate_activity` (atividade,
prova, diagnóstica e ideias), `adapt_question` (simplificar, aumentar dificuldade,
alternativa ou orientação personalizada) e `analyze_class` (habilidades/descritores
críticos, dificuldades agregadas e recuperação). Trilhas permanecem no banco e no
código legado, mas fora do fluxo principal do piloto. Toda proposta exige revisão e
ação explícita do professor; análise de turma não cria nem publica atividade.

Validações locais executadas em 6 de outubro de 2026: 48 testes em
`npm --prefix backend run test:copilot`, 26 testes em
`node --test tests/copilot-workspace.test.mjs`, `npm --prefix backend run
copilot:check`, `npm --prefix backend run sql:check`, `node --check
frontend/professor/specialty/teacher-copilot.js` e testes PGlite das migrations/RPCs.
Esses testes usam dados/provider simulados; não comprovam deploy nem qualidade de
uma chamada Gemini real.

Antes de declarar a Fase 3 liberada remotamente:

1. criar/confirmar um projeto Supabase isolado para a Fase 3;
2. aplicar `20261006_copiloto_operacoes_piloto.sql` e confirmar que o schema
  completo contém essa migration;
3. configurar `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_SECRET_KEY` e
  `ALLOWED_ORIGINS` somente nos secrets do Supabase;
4. implantar a Edge Function e conferir `verify_jwt = true`;
5. liberar a feature flag apenas para professores de teste;
6. testar Professor A e Professor B, dados insuficientes, quota e os três fluxos
  em desktop e celular nas quatro especialidades;
7. verificar logs sem prompts, nomes, respostas ou outros dados pessoais;
8. só então decidir uma liberação gradual.

## Débitos conhecidos

- Uma redação corrigida no ambiente possui nota final sem as cinco competências;
  a rubrica exibe 0/1000 e precisa de saneamento transacional.
- Não há contas de gestor e bibliotecária no projeto atualmente apontado pelo
  `.env`; os respectivos fluxos não têm cobertura integrada completa.
- `email_por_matricula(text)` continua executável anonimamente para sustentar o
  login por matrícula; deve receber análise específica de enumeração e limitação.
- O advisor do Supabase ainda sinaliza funções `SECURITY DEFINER` herdadas. Elas
  precisam de auditoria gradual de grants, `search_path` e validação de papel.
- Alertas de índices não usados no ambiente novo podem ser efeito de ausência de
  tráfego; não devem ser removidos apenas com base nessa medição inicial.
- A biblioteca possui verificador próprio, mas a cobertura de cenários negativos de
  RLS deve ser ampliada antes de produção.
- O SDK Supabase usado por CDN no frontend não está fixado em uma versão exata.

## Fonte de verdade

- Código implantável: `frontend/` e `backend/`.
- Banco para instalação limpa: `backend/ominisaber-schema-completo.sql`.
- Evolução incremental: `backend/migrations/`.
- Estado e contratos: esta documentação.
- Histórico não normativo: `docs/legacy/`.
