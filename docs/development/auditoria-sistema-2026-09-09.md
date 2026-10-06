# Auditoria geral do sistema — 9 de setembro de 2026

## Objetivo e escopo

O pente-fino cobriu o repositório inteiro e o projeto Supabase configurado no
`.env`, sem alterar dados de beta-testers. Foram inspecionados:

- 92 documentos HTML, 75 arquivos JavaScript e 71 folhas CSS;
- 49 arquivos SQL e as 77 tabelas públicas protegidas por RLS;
- login, gestor, professor de Português, aluno, redações, agenda, biblioteca,
  motor de atividades, resultados, recuperação e Copiloto;
- integridade dos dados reais disponíveis no projeto Supabase;
- advisors de segurança e desempenho do Supabase;
- links locais, sintaxe JavaScript, documentação e segredos expostos.

Esta auditoria separa três conceitos:

- **bug confirmado:** comportamento incorreto reproduzido ou inconsistência real;
- **risco:** condição técnica que pode causar falha ou vulnerabilidade;
- **lacuna de cobertura:** fluxo que ainda não pôde ser validado ponta a ponta.

## Resultado executivo

| ID       | Prioridade | Tipo               | Situação                                                                                              | Resumo                                                                                       |
| -------- | ---------- | ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| BUG-001  | P0         | Bug confirmado     | Resolvido                                                                                             | Correção exige cinco competências e soma coerente; registro saneado para 760/1000            |
| SEC-001  | P0         | Risco confirmado   | Aberto                                                                                                | `email_por_matricula(text)` é executável por `anon` e pode permitir enumeração de matrículas |
| SEC-002  | P0         | Configuração       | Aberto                                                                                                | Proteção contra senhas vazadas está desativada no Supabase Auth                              |
| BUG-002  | P1         | Bug de verificador | Resolvido                                                                                             | Verificador falha sem contas, storage, tabelas, RLS ou RPC obrigatórios                      |
| COV-001  | P1         | Lacuna             | Aberto                                                                                                | Projeto de teste não possui conta `gestor`                                                   |
| COV-002  | P1         | Lacuna             | Projeto de teste não possui conta `bibliotecaria`                                                     |
| COV-003  | P1         | Lacuna             | Acervo físico está vazio; reserva, separação, entrega e devolução não foram exercitados ponta a ponta |
| SEC-003  | P1         | Risco              | Em triagem                                                                                            | Advisor sinaliza 23 funções `SECURITY DEFINER` executáveis por autenticados                  |
| PERF-001 | P1         | Desempenho         | Aberto                                                                                                | 18 chaves estrangeiras não possuem índice de apoio                                           |
| PERF-002 | P1         | Desempenho         | Aberto                                                                                                | 17 policies repetem avaliação de funções de autenticação por linha                           |
| PERF-003 | P1         | Desempenho         | Em triagem                                                                                            | 29 tabelas têm múltiplas policies permissivas para a mesma ação/papel                        |
| BUG-003  | P2         | Robustez           | Resolvido                                                                                             | Turma, curso e especialidade são persistidos em uma única atualização atômica                |
| SEC-004  | P2         | Supply chain       | Aberto                                                                                                | Páginas carregam `@supabase/supabase-js@2` sem versão exata no CDN                           |
| BUG-004  | P2         | Responsividade     | Resolvido                                                                                             | Redirecionamentos legados agora declaram viewport e preservam fallback navegável             |
| BUG-005  | P3         | Manutenção         | Resolvido                                                                                             | Cliente discente morto e suas rotas desatualizadas foram removidos                           |
| BUG-006  | P3         | Acessibilidade     | Resolvido                                                                                             | Entrada raiz agora é um documento semântico com idioma, viewport, título e link alternativo  |

## Bugs confirmados

### BUG-001 — rubrica de redação incompatível com a nota final

**Resolvido em 9 de setembro de 2026.** A migration
`20260909194704_corrigir_integridade_redacoes.sql` exige cinco competências, soma
idêntica à nota e metadados de correção. O registro de demonstração foi saneado
para 760/1000 e a tela confirmou C1–C4 = 160 e C5 = 120.

Uma redação do ambiente está com `status = corrigida`, `nota = 780` e devolutiva,
mas não possui cinco registros em `avaliacoes_competencias_redacao`. A listagem
mostra 780, enquanto o painel de correção preenche C1–C5 com zero e calcula 0/1000.

**Impacto:** professor e aluno recebem duas notas conflitantes para a mesma redação.

**Causa provável:** o seed `backend/scripts/seed-portuguese-teacher-demo.js` grava a
nota final sem criar a rubrica. O fluxo SQL normal de correção cria as competências.

**Correção proposta:** tornar a correção transacional e impedir `corrigida` sem
cinco competências; ajustar o seed e criar uma rotina de saneamento dos registros
incompletos.

### BUG-002 — verificador da biblioteca produz falso positivo

**Resolvido em 9 de setembro de 2026.** O comando agora encerra com falha quando
faltar conta de aluno ou bibliotecária, bucket privado, tabelas/colunas, acesso do
aluno ou disponibilidade da RPC. No ambiente atual ele falha corretamente porque
`userbibliotecaria` ainda não existe.

O verificador encontrou `librarianLookup = registration_not_found` e não executou
`biblioteca_separar_solicitacao`, mas encerrou com código de sucesso.

**Impacto:** o pipeline pode informar que a biblioteca passou sem testar o principal
fluxo da bibliotecária.

**Correção proposta:** falhar quando a conta obrigatória não existir ou declarar
explicitamente modo estrutural; exigir resultado de cada RPC no modo integrado.

### BUG-003 — edição de perfil não é atômica

**Resolvido em 9 de setembro de 2026.** `updateManagerProfile` agora filtra os
campos permitidos e envia turma, curso e especialidade em uma única operação que
também devolve o perfil atualizado. O verificador do gestor confirma que não há
mais uma segunda atualização independente.

`updateManagerProfile` grava campos centrais e opcionais em duas requisições. Se a
segunda falhar, turma/curso podem ser alterados sem os demais dados, ou o inverso.

**Impacto:** perfil parcialmente atualizado e difícil de reconciliar.

**Correção proposta:** uma RPC transacional de gestão de perfil ou uma única
atualização depois de detectar as colunas disponíveis.

### BUG-004 — redirecionamentos sem viewport

**Resolvido em 9 de setembro de 2026.** Os sete documentos passaram a declarar
`width=device-width, initial-scale=1` e foram marcados como redirecionamentos não
indexáveis, preservando o link manual para o destino.

Os seguintes documentos falham na validação responsiva:

- `frontend/aluno/biblioteca_digital/code.html`;
- `frontend/aluno/minha_evolucao/code.html`;
- `frontend/aluno/modulo_de_trilhas/code.html`;
- `frontend/cadastro/code.html`;
- `frontend/erro/code.html`;
- `frontend/gestor/dashboard/code.html`;
- `frontend/professor/dashboard/code.html`.

### BUG-005 — cliente discente morto e desatualizado

**Resolvido em 9 de setembro de 2026.** O arquivo não era referenciado por nenhuma
página atual e foi removido, eliminando a segunda implementação de dashboard,
trilhas, biblioteca, redação e evolução.

`frontend/aluno/shared/student-data.js` não é importado pelas páginas atuais e ainda
aponta para arquivos `code.html`. Manter duas fontes de rotas aumenta o risco de
regressão quando a navegação mudar.

### BUG-006 — entrada raiz frágil

**Resolvido em 9 de setembro de 2026.** A raiz mantém o redirecionamento para o
login, mas agora oferece estrutura HTML completa, idioma, viewport, título e link
alternativo utilizável por teclado ou quando o redirecionamento for bloqueado.

`index.html` na raiz contém somente redirecionamento por meta. Falta estrutura HTML,
idioma, viewport e um link utilizável quando o redirecionamento automático é
bloqueado.

## Segurança e banco

### SEC-001 — consulta de e-mail por matrícula antes do login

`email_por_matricula(text)` precisa existir para a experiência atual de login, mas o
advisor confirma execução por `anon`. Mesmo sem mensagem explícita de “usuário
existe”, diferenças de resposta ou tempo podem permitir enumeração.

Antes de produção, substituir por endpoint com limitação de tentativas e resposta
uniforme, ou exigir e-mail para autenticação. Não expor `auth.users` ao navegador.

### SEC-002 — proteção de senhas vazadas

O advisor do Supabase informa que a proteção contra senhas comprometidas está
desativada. Deve ser habilitada antes de produção e testada com o processo de criação
e troca de senha do gestor.

### SEC-003 — funções privilegiadas expostas a autenticados

O advisor sinaliza 23 funções `SECURITY DEFINER`. Várias contêm validação de papel e
podem ser APIs intencionais, portanto o alerta não prova exploração. Ainda assim,
cada função deve receber uma revisão de `EXECUTE`, `search_path`, `auth.uid()`, papel
e escopo da linha antes de ser considerada segura.

Grupos afetados:

- biblioteca: 10 funções de solicitação, separação, entrega, devolução e estoque;
- currículo: 8 funções de importação, aprovação, edição, reprocessamento e cobertura;
- autorização: `usuario_role`, `usuario_tipo_professor`, `usuario_turma_id`,
  `aluno_pode_acessar_materia`, `professor_pode_gerenciar_materia` e
  `eh_gestor_ou_professor`.

`private.gabaritos_questoes` possui RLS sem policy. Como está em schema privado e
sem acesso aos papéis do navegador, isso pode ser defesa em profundidade; confirmar
os grants antes de encerrar o alerta.

### SEC-004 — SDK Supabase sem versão exata no navegador

O auditor encontrou 81 páginas usando
`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`. Isso permite troca de versão
menor sem alteração no repositório. Fixar uma versão exata, ou centralizar um
arquivo versionado e submetido a revisão.

## Desempenho

### PERF-001 — chaves estrangeiras sem índice

O advisor encontrou 18 relações sem índice nas tabelas de currículo, importação,
auditoria, materiais e solicitações de acesso. Isso pode degradar exclusões,
atualizações e joins quando o catálogo crescer.

### PERF-002 — avaliação repetida em policies

Há 17 alertas `auth_rls_initplan`. Policies de `perfis`, `professor_turmas`,
`trilhas`, `atividades`, `notas`, `propostas_redacao`, `redacoes`,
`progresso_atividades`, `emprestimos`, `leituras_aluno` e
`solicitacoes_emprestimo` devem usar chamadas estáveis no formato `(select ...)`
quando semanticamente equivalente.

### PERF-003 — policies permissivas sobrepostas

O advisor detectou 29 tabelas com mais de uma policy permissiva para a mesma ação e
papel. Isso aumenta custo e complexidade. Revisar tabela por tabela; não consolidar
automaticamente sem preservar as regras de aluno, professor, gestor e bibliotecária.

O advisor também lista 66 índices não usados. Isso **não é tratado como bug** neste
momento, pois o ambiente tem pouco tráfego e a medição não representa produção.

## Lacunas de cobertura

O projeto remoto possui quatro perfis: um professor e três alunos. Não há gestor nem
bibliotecária. Existem duas atividades publicadas, quatro questões, três tentativas
corrigidas, sete respostas, cinco notificações e duas redações. Não há livro,
exemplar ou solicitação de empréstimo.

Consequências:

- telas do gestor têm validação estrutural, mas não um ensaio completo com RLS;
- a biblioteca não foi validada do cadastro à devolução;
- os quatro tipos de professor ainda não têm a mesma profundidade de teste real;
- responsividade foi validada por regras estáticas e amostras visuais, não por uma
  matriz automatizada completa de resoluções/dispositivos.

## Verificações que passaram

- schema consolidado e referências SQL;
- autenticação e roteamento estrutural;
- catálogo curricular e segurança estática da importação;
- módulo de Português com dados reais;
- construtor, execução discente, revisão docente, resultados e recuperação;
- contrato do Copiloto e feature flags;
- sintaxe dos 101 arquivos JavaScript verificados;
- links locais de HTML/CSS/JS e documentação;
- ausência de secret/service-role/OpenAI key no frontend.

“Passou” significa que o contrato coberto pelo verificador está íntegro. Não
significa que todos os papéis e cenários foram exercitados no banco remoto.

## Ordem recomendada de correção

1. BUG-001, para remover notas contraditórias.
2. SEC-001 e SEC-002, antes de ampliar o beta.
3. BUG-002 + COV-002 + COV-003, fechando o ciclo da biblioteca.
4. COV-001, adicionando cobertura integrada de gestão de perfis e vínculos.
5. SEC-003, começando pelas funções que alteram estoque, empréstimos e currículo.
6. PERF-001 e PERF-002; medir antes e depois.
7. SEC-004 e os débitos de redirects/arquivos legados.

## Como repetir o diagnóstico

Na pasta `backend`:

```powershell
npm run sql:check
npm run auth:check
npm run manager:check
npm run library:check
npm run teacher:portuguese:check
npm run activity:builder:check
npm run activity:student:check
npm run activity:teacher-review:check
npm run activity:results:check
npm run copilot:check
npm run system:audit
npm run system:audit:remote
npm run docs:check
```

O diagnóstico remoto usa o projeto apontado no `.env` e é somente leitura. Confirme
o host exibido antes de interpretar os resultados.
