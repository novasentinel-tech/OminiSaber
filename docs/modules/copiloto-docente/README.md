# Copiloto docente — conversa e proposta ao vivo

## Objetivo

O Copiloto reduz o trabalho de preparar atividades sem retirar a decisão pedagógica do professor. A experiência escolhida em 3 de outubro de 2026 coloca a conversa à esquerda e o rascunho editável ou a prévia interativa do aluno à direita. O contexto vem do construtor; não há botão flutuante sobre os campos nem um segundo assistente de etapas.

O recurso não publica atividades, não entrega notas, não acessa respostas individuais de alunos e não substitui a revisão docente.

## Escopo

- `generate_activity`: gera atividade, prova ou diagnóstico; `ideas` é uma variante que propõe ideias convertíveis em atividade.
- `adapt_question`: simplifica, aumenta a dificuldade, cria uma alternativa ou executa uma revisão personalizada de uma questão selecionada.
- `analyze_class`: identifica descritores abaixo do critério de desempenho, resume dificuldades agregadas e sugere recuperação.
- Edição direta da proposta, prévia do aluno, aplicação explícita e opção de desfazer.
- Questões objetivas, curtas, dissertativas, numéricas, de cálculo, código e estudo de caso.
- Registro da execução, consumo, latência, resultado e feedback do professor.
- Ativação gradual por ambiente e por usuário.

Trilhas continuam implementadas e preservadas para compatibilidade/histórico, mas estão fora do fluxo principal do piloto. Nenhuma migration ou registro legado é removido.

## Arquitetura

```text
Professor autenticado
        |
        v
Construtor de atividades
        |
        | JWT + turma + matéria + descritores
        v
Supabase Edge Function professor-copiloto
        |-- valida perfil e vínculo docente
        |-- valida feature flag e reserva quota atomicamente
        |-- usa cliente JWT/RLS para leituras de autorização e contexto
        |-- calcula desempenho por habilidade sem enviar respostas
        v
Gemini Interactions API com saída JSON estruturada
        |
        v
Prévia revisável -> Aplicar ao rascunho -> publicação manual existente
```

O navegador usa apenas a chave pública do Supabase. `GEMINI_API_KEY` e a chave secreta do Supabase ficam exclusivamente nos secrets da Edge Function.

## Dados

| Tabela                  | Finalidade                                              |
| ----------------------- | ------------------------------------------------------- |
| `feature_flags`         | Configuração global e limites do recurso.               |
| `feature_flag_usuarios` | Liberação ou bloqueio explícito por conta.              |
| `copiloto_sessoes`      | Contexto resumido de uma sequência de pedidos.          |
| `copiloto_execucoes`    | Auditoria de solicitações, estado, resultado e consumo. |
| `copiloto_feedback`     | Avaliação útil/não útil feita pelo professor.           |
| `reservar_execucao_copiloto` | Serializa quota e cria a reserva na mesma transação. |
| `resumo_habilidades_copiloto` | Calcula desempenho crítico por habilidade/descritor no escopo do professor. |

A migration cria o flag `professor_copiloto` com `habilitada_global = false`. Assim, instalar o schema não ativa a função para beta-testers.

## Fluxo do professor

1. O professor entra em **Avaliações** e informa turma e contexto.
2. Pode selecionar habilidades curriculares; elas são opcionais.
3. Abre **Copiloto** no cabeçalho do construtor.
4. Escolhe uma das três operações. Geração distingue atividade/prova/diagnóstica e ideias; adaptação exige ação e questão-alvo; análise consulta somente indicadores agregados.
5. Revisa a resposta estruturada. Geração/adaptação permite editar e testar a **Visão do aluno**; análise apresenta descritores, dificuldades e recuperação.
6. Em geração/adaptação, clica em **Aplicar ao rascunho**. Na análise, pode pedir uma atividade de recuperação, que volta como nova proposta revisável.
7. Ajusta questões, gabaritos, pontos e orientações.
8. Publica usando o fluxo transacional existente da Fase 2.

Na base comum, o vínculo curricular é necessário para publicar, conforme a regra existente do banco. Preparar questões, navegar pelo construtor e salvar rascunhos continuam permitidos sem esse vínculo.

Aplicar altera apenas o rascunho em edição. Salvar e publicar continuam ações próprias do construtor. As solicitações da IA e o feedback mantêm o registro de execução existente.

Trilhas continuam preservadas no código, nas migrations e nos registros anteriores, mas estão **experimentais e fora do fluxo do piloto**. O caminho principal não oferece criação, adaptação ou publicação de trilhas.

## Segurança e privacidade

- JWT obrigatório na Edge Function e validação da sessão com `auth.getUser`.
- Perfil precisa ser `professor`.
- Turma, matéria e descritores são conferidos no servidor.
- O vínculo ativo em `professor_turma_materias` é obrigatório.
- Feature flag é revalidado no servidor; esconder o botão não é a barreira de segurança.
- Limites por minuto e por dia reduzem abuso e custos inesperados.
- Texto livre não é persistido em título, resumo de solicitação, resultado de execução ou memória; e-mail, CPF e telefone recebem sanitização antes do uso.
- A memória retém somente ações e metadados estruturados, nunca nomes, pedidos ou resultados textuais do modelo.
- Análise envia ao Gemini apenas desempenho geral e taxas por habilidade; a resposta individual, texto de resposta e IDs de aluno não são consultados pelo modelo.
- `store: false` impede o armazenamento da resposta pela API para este fluxo.
- A saída usa JSON Schema estrito e é normalizada novamente no servidor.
- IDs de descritores retornados são limitados ao conjunto autorizado.
- `reservar_execucao_copiloto` serializa por professor com advisory lock e grava a execução na mesma transação que verifica os limites.
- O cliente privilegiado é usado somente para escrita de sessões/execuções e para a RPC de reserva, com `EXECUTE` concedido apenas a `service_role`.
- A RPC de análise valida `auth.uid()`, papel/perfil ativo e vínculo ativo professor/turma/matéria; retorna somente habilidades com pelo menos três evidências corrigidas abaixo de 60%, sem nomes, tentativas ou respostas.
- RLS protege histórico e feedback; `anon` não recebe privilégios.
- A interface não contém chaves privadas nem chama o provedor de IA diretamente.

## Isolamento dos testadores

A Fase 3 deve ser validada em um projeto Supabase separado. O projeto usado pelos
testadores continua na Fase 2.0–2.4 e não recebe esta migration nem a Edge Function
enquanto os testes estiverem em andamento.

Além da separação física, o recurso permanece desligado por padrão. Isso fornece duas barreiras independentes:

1. ambientes Supabase diferentes;
2. feature flag desativado.

### Registro remoto anterior

- O ambiente de testes atual usa o projeto `mvnuhwlnbhijjlosmnfv`, com flag controlada.
- O registro anterior apontava ausência de ambiente ativo dedicado à Fase 3 e das tabelas do Copiloto no projeto de testes. Esse diagnóstico não foi reconfirmado pela ferramenta administrativa durante este rework.
- A sessão do professor foi usada para conferir a interface atual. Isso não confirma a implantação dos novos contratos de ideias e trilhas.
- A atualização incremental de 3 de outubro, a Edge Function e seus testes estão no repositório; o deploy desses novos arquivos permanece pendente.

O arquivo público atualmente carregado pelo frontend continua apontando para o
projeto de testes. Essa configuração não deve ser trocada no deploy dos testadores.

## Configuração do ambiente da Fase 3

Defina os secrets da Edge Function com base em `backend/supabase/.env.example`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `ALLOWED_ORIGINS`

O arquivo local `.env.phase3` referencia um ambiente removido e deve ser tratado
como histórico. Ao criar um novo ambiente, gere outro arquivo a partir do contrato
sem reaproveitar chaves antigas.

Para Netlify, crie um contexto de deploy separado apontando para o novo Supabase da
Fase 3. Nunca reutilize a configuração dos testadores na implantação de
desenvolvimento.

`GEMINI_API_KEY` deverá ser cadastrada manualmente nos secrets do projeto. A
função não está publicada em ambiente remoto ativo. Nenhuma chave privada deve ser
escrita nos arquivos públicos do frontend.

## Ativação controlada

Depois de criar o novo ambiente e aplicar a migration, libere apenas contas de teste
inserindo uma atribuição em `feature_flag_usuarios`. Não habilite
`habilitada_global` no primeiro ciclo.

Critérios mínimos antes de ampliar:

- nenhum dado pessoal aparece nos registros de execução;
- uma conta não acessa histórico de outra;
- descritores fora da matéria são rejeitados;
- a função respeita limites e origem permitida;
- o professor consegue revisar e editar toda sugestão;
- nenhuma atividade é publicada sem ação explícita.

## Arquivos principais

- `backend/migrations/20260909_copiloto_docente_fase3_0.sql`
- `backend/migrations/20261003_copiloto_ideias_trilhas.sql`
- `backend/migrations/20261006_copiloto_operacoes_piloto.sql`
- `backend/supabase/functions/professor-copiloto/index.ts`
- `backend/supabase/config.toml`
- `backend/ominisaber-supabase-client.js`
- `frontend/professor/specialty/teacher-copilot.js`
- `frontend/professor/specialty/teacher-copilot.css`
- `frontend/professor/specialty/copilot-handoff.js`
- `backend/supabase/functions/professor-copiloto/pedagogical-contract.ts`
- `backend/scripts/check-copilot-phase3.js`

## Verificação local

Na pasta `backend`, execute:

```bash
npm run schema:build
npm run sql:check
npm run copilot:check
npm run test:copilot
```

Os testes da Fase 2 também devem continuar verdes para garantir que a integração não alterou criação, execução, correção, resultados ou recuperação.

Na revisão local de 6 de outubro de 2026 passaram os testes dos três contratos,
isolamento entre professores, normalização de respostas, quota concorrente e
migrations/RPCs. Os testes usam dados sintéticos e Gemini simulado; ainda não
comprovam credenciais, deploy ou qualidade de resposta remota.

## Deploy e aceite manual

Use somente o projeto Supabase isolado da Fase 3. Confira o project ref antes de
executar comandos; `db push` aplica todas as migrations pendentes desse projeto.

```bash
cd backend
npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
npx supabase functions deploy professor-copiloto --project-ref "$SUPABASE_PROJECT_REF"
```

Aplique `migrations/20261006_copiloto_operacoes_piloto.sql` ao banco isolado pelo
SQL Editor do Supabase ou com `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f
migrations/20261006_copiloto_operacoes_piloto.sql`. O repositório mantém as
migrations em `backend/migrations/`, separadas da pasta padrão de migrations do
Supabase CLI; por isso `supabase db push` não é o comando para aplicar este arquivo.

Cadastre no painel de secrets do projeto, sem commit ou arquivo versionado:
`GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_SECRET_KEY` e `ALLOWED_ORIGINS`.
`SUPABASE_URL` e `SUPABASE_ANON_KEY` devem corresponder ao mesmo projeto. A flag
global continua desligada; atribua acesso somente às contas piloto.

Checklist manual antes de ampliar o piloto:

- Professor A gera atividade, prova, diagnóstica e variante de ideias; cada saída fica como rascunho.
- Professor A simplifica, aumenta a dificuldade e gera alternativa para uma questão escolhida; outras questões permanecem intactas.
- Professor A analisa uma turma com resultados corrigidos; confira descritores, evidências, dificuldades e recuperação agregada.
- Professor B tenta usar turma/matéria de A; o servidor deve responder 403 sem chamar Gemini.
- Usuário sem sessão recebe 401; turma sem vínculo e habilidades de outra série/trimestre são rejeitadas.
- Turma sem evidência suficiente recebe resposta tratável sem chamada ao Gemini.
- Requisições concorrentes atingem os limites por operação; aguarde a janela e valide a liberação posterior.
- Confirme que “Preparar atividade de recuperação” cria um rascunho e que publicação continua sendo ação docente separada.
- Repita geração, adaptação e análise em desktop e celular nas quatro especialidades docentes.
- Revise logs por request ID e confirme ausência de prompts, nomes, respostas e segredos.

## Última validação do ambiente removido

Os itens abaixo são registro histórico do projeto temporário e não descrevem um
ambiente disponível hoje:

- 77 de 77 tabelas públicas com RLS habilitado.
- `anon` sem permissão de leitura em `copiloto_execucoes`.
- Edge Function ativa com JWT obrigatório.
- Chamadas sem sessão recebem HTTP 401.
- 153 habilidades e 55 descritores disponíveis no catálogo inicial.
- Políticas redundantes e índice apontados especificamente para a Fase 3 foram corrigidos.

O advisor ainda aponta funções `SECURITY DEFINER` herdadas do sistema anterior. A função anônima `email_por_matricula` permanece temporariamente necessária para o login por matrícula. As demais rotinas autenticadas precisam ser auditadas gradualmente, sem alterações durante a janela de testes da Fase 2.

## Referências técnicas

- [Gemini Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview)
- [Gemini — saídas estruturadas](https://ai.google.dev/gemini-api/docs/structured-output)
- [Supabase — API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — secrets de Edge Functions](https://supabase.com/docs/guides/functions/secrets)

O provedor e o modelo continuam configurados na função existente. Esta revisão melhora os contratos, autorização curricular, agregação de resultados, quota e sanitização; não troca credenciais nem ativa recursos remotamente. Os testes locais usam conteúdo sintético e Gemini simulado e não demonstram, por si só, a qualidade de uma geração real. Migration e Edge Function ainda precisam ser implantadas no projeto isolado.

Trilhas permanecem preservadas no legado, mas não fazem parte do fluxo principal do piloto. A quota e a agregação foram exercitadas por testes PostgreSQL locais (PGlite); o deploy e a validação com RLS do projeto remoto continuam pendentes.
