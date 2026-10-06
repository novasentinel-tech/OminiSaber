# Copiloto docente — conversa e proposta ao vivo

## Objetivo

O Copiloto reduz o trabalho de preparar atividades sem retirar a decisão pedagógica do professor. A experiência escolhida em 3 de outubro de 2026 coloca a conversa à esquerda e o rascunho editável ou a prévia interativa do aluno à direita. O contexto vem do construtor; não há botão flutuante sobre os campos nem um segundo assistente de etapas.

O recurso não publica atividades, não entrega notas, não acessa respostas individuais de alunos e não substitui a revisão docente.

## Escopo

- Geração de rascunhos de atividades alinhadas a descritores.
- Revisão de um rascunho que já esteja no construtor.
- Refinamentos com histórico limitado da conversa e a proposta atual.
- Percursos progressivos com todas as atividades de suas etapas preservadas.
- Ideias com intenção pedagógica, ação do aluno, evidência de aprendizagem, materiais e adaptações.
- Edição direta da proposta, prévia do aluno, aplicação explícita e opção de desfazer.
- Questões objetivas, curtas, dissertativas, numéricas, de cálculo, código e estudo de caso.
- Registro da execução, consumo, latência, resultado e feedback do professor.
- Ativação gradual por ambiente e por usuário.

A sugestão de recuperação com base em resultados agregados está prevista no contrato do backend, mas só deve ser exposta na interface de resultados depois da validação do primeiro ciclo de geração.

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
        |-- valida feature flag e limites
        |-- busca descritores autorizados
        |-- remove dados pessoais do objetivo
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

A migration cria o flag `professor_copiloto` com `habilitada_global = false`. Assim, instalar o schema não ativa a função para beta-testers.

## Fluxo do professor

1. O professor entra em **Avaliações** e informa turma e contexto.
2. Pode selecionar habilidades curriculares; elas são opcionais.
3. Abre **Copiloto** no cabeçalho do construtor.
4. Escolhe atividade, percurso, revisão ou ideias e descreve seu pedido.
5. Conversa para refinar, edita a proposta e testa a **Visão do aluno**.
6. Clica em **Aplicar ao rascunho**.
7. Ajusta questões, gabaritos, pontos e orientações.
8. Publica usando o fluxo transacional existente da Fase 2.

Na base comum, o vínculo curricular é necessário para publicar, conforme a regra existente do banco. Preparar questões, navegar pelo construtor e salvar rascunhos continuam permitidos sem esse vínculo.

Aplicar altera apenas o rascunho em edição. Salvar e publicar continuam ações próprias do construtor. As solicitações da IA e o feedback mantêm o registro de execução existente.

Um percurso é aplicado como **uma atividade agrupada em etapas**, usando o contrato transacional existente. As questões mantêm `configuration.learningStage` público e a atividade mantém `configuration.learningTrail`. A sequência preserva todas as etapas, apresenta orientações ao aluno e desativa o embaralhamento de questões. Limites excedidos bloqueiam a aplicação inteira, sem cortar etapas. Não cria várias avaliações remotas nem uma trilha independente no catálogo.

## Segurança e privacidade

- JWT obrigatório na Edge Function e validação da sessão com `auth.getUser`.
- Perfil precisa ser `professor`.
- Turma, matéria e descritores são conferidos no servidor.
- O vínculo ativo em `professor_turma_materias` é obrigatório.
- Feature flag é revalidado no servidor; esconder o botão não é a barreira de segurança.
- Limites por minuto e por dia reduzem abuso e custos inesperados.
- E-mail, CPF e telefone são removidos do texto livre antes do envio.
- `store: false` impede o armazenamento da resposta pela API para este fluxo.
- A saída usa JSON Schema estrito e é normalizada novamente no servidor.
- IDs de descritores retornados são limitados ao conjunto autorizado.
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
- `OPENAI_MODEL`
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

O provedor e o modelo continuam configurados na função existente. Este rework melhora o contexto, as instruções pedagógicas, os contratos de saída e a validação; não troca credenciais nem ativa recursos remotamente. Os testes locais usam conteúdo sintético e não demonstram, por si só, a qualidade de uma geração real do provedor. A migration incremental e a função precisam ser implantadas para ativar os novos contratos no ambiente remoto.

A revisão de uma trilha atua sobre a etapa aberta: a IA recebe as questões e o orçamento daquela etapa, e a interface conserva todas as demais na nova versão. A pontuação é validada e exibida em centavos, inclusive quando o valor não se divide igualmente pelo número de questões. Os testes de contrato e do handler usam dependências simuladas; o teste PostgreSQL da migration é separado e foi mantido sem dispensas, mas sua última execução local não inicializou o WASM por falta de memória. A sintaxe SQL e a governança do schema foram aprovadas.
