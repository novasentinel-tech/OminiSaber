# Registro de Casos de Teste

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-TST-002 |
| Versão / status | v1.0 / Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

| ID | Jornada | Resultado esperado | Automação/evidência |
| --- | --- | --- | --- |
| CT-AUTH-001 | login válido por papel | rota correta e sessão ativa | `auth:check` |
| CT-AUTH-002 | usuário acessa papel alheio | acesso negado sem vazamento | integração por papel |
| CT-ATV-001 | professor publica atividade | versão e notificação criadas | `activity:builder:check` |
| CT-ATV-002 | aluno salva e entrega | tentativa coerente e imutável após entrega | `activity:student:check` |
| CT-ATV-003 | professor corrige resposta aberta | nota e auditoria atualizadas | `activity:teacher-review:check` |
| CT-ATV-004 | recuperação por descritores | rascunho contém somente habilidades escolhidas | `activity:results:check` |
| CT-BIB-001 | empréstimo completo | exemplar e totais reconciliados | `library:check` |
| CT-DOC-001 | documentação | códigos, links e segredos válidos | `docs:check` |
| CT-DB-001 | governança do banco | migrations incluídas e RLS completo | `database:governance:check` |
| CT-UI-001 | navegação móvel | sem corte, sobreposição ou alvo pequeno | páginas em `tests` e auditorias |

Casos detalhados de formatos interativos permanecem em `docs/audits/2026-09-10-construtor-professor`.

## Estrutura de um caso detalhado

Cada caso deve conter ID estável, requisito ou risco, pré-condições, papel, ambiente, dados, passos, resultado esperado, prioridade, tipo de evidência e estado. Quando automatizado, registrar comando e versão. Quando manual, informar viewport, navegador e data. O texto esperado deve ser observável e não apenas “funciona”.

## Preparação de dados

Criar pelo menos uma turma com professor vinculado, aluno vinculado, atividade em rascunho e publicada, tentativa não iniciada, em andamento e entregue. Para testes negativos, manter usuário sem vínculo, usuário de outro papel e recurso de outra turma. Dados de teste não podem conter nomes, textos ou arquivos de pessoas reais.

## Cenários complementares obrigatórios

- login inválido sem revelar existência de matrícula;
- expiração e encerramento de sessão;
- acesso direto por URL a papel alheio;
- publicação repetida e ação idempotente;
- edição após entrega conforme regra definida;
- nota fora do intervalo e gabarito invisível ao aluno;
- arquivo inválido, indisponibilidade e timeout;
- estado vazio, carregamento lento e erro recuperável;
- teclado, foco, contraste e alvo de toque;
- telas de 320 px, tablet e desktop amplo.

## Execução e estados

O caso pode estar não executado, aprovado, reprovado, bloqueado ou não aplicável. Bloqueado registra impedimento e não conta como aprovado. Reprovação abre bug em TST-003. Nova versão que altera regra invalida a evidência anterior até o caso ser revisado.

## RLS e autorização

Para cada leitura e escrita importante, executar ao menos um cenário permitido e um negado. Validar resultado no banco, não só mensagem da interface. Service role não deve ser usada para simular usuário. Funções privilegiadas precisam testar JWT ausente, papel incorreto, vínculo incorreto e payload inválido.

## Rastreabilidade

O lote de execução registra versão/ref, executor, ambiente, início, fim, totais e decisão. Evidências sensíveis ficam restritas. O registro resumido deve permitir repetir o teste sem depender da memória do executor.
