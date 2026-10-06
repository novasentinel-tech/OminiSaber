# Documento de Arquitetura do Sistema

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-ARC-001 |
| Versão | v1.0 |
| Status | Ativo |
| Classificação | Uso Interno |
| Público | Técnico / Gestão |
| Responsável | Técnico |
| Criação / revisão | 2026-09-25 |

## Objetivo e contexto

O OminiSaber é uma plataforma educacional para gestão acadêmica, autoria docente, aprendizagem do aluno, biblioteca e acompanhamento por evidências. O ciclo central liga catálogo curricular, atividade, tentativa, correção, resultado e recuperação.

## Arquitetura lógica

- **Apresentação:** HTML, CSS e JavaScript sem framework no frontend principal. Áreas separadas por aluno, professor, gestor e bibliotecária.
- **Serviços compartilhados:** cliente Supabase, sessão, navegação, componentes visuais e contratos comuns em `frontend/shared` e `backend/ominisaber-supabase-client.js`.
- **Persistência e autorização:** PostgreSQL/Supabase com migrations, constraints, triggers, RPCs e Row Level Security.
- **Autenticação:** Supabase Auth; `perfis` estende o usuário autenticado e define papel e contexto escolar.
- **Processamento protegido:** Edge Functions para operações com secrets ou integrações externas, incluindo gestão de contas, importação curricular e Copiloto docente.
- **Motor experimental:** aplicação separada em `engine/`, voltada à autoria e avaliação de trabalhos interativos. Ainda não substitui o motor canônico de atividades.

## Domínios

Identidade e vínculos, currículo, atividades, redação, agenda, biblioteca, gestão, copiloto, evolução do aluno e autoria interativa. Cada domínio mantém documentação em `docs/modules`; o banco canônico está em `backend/schema` e `backend/migrations`.

## Limites de confiança

O navegador recebe somente chave pública. Secrets permanecem em ambiente servidor ou Edge Function. A interface nunca é barreira de autorização: grants e RLS restringem linhas e operações, e funções privilegiadas validam sessão e papel.

## Qualidades e restrições

- responsividade para celular, tablet e desktop;
- funcionamento progressivo sem bundler no frontend principal;
- dados reais do Supabase, sem mocks silenciosos;
- mudanças de banco incrementais e transacionais;
- rastreabilidade de publicações, correções e ajustes;
- implantação estática do frontend e implantação separada de banco e Edge Functions.

## Referências

[Visão geral](../../architecture/visao-geral.md), [backend](../../architecture/backend.md), [frontend](../../architecture/frontend.md), [fluxo de dados](../../architecture/fluxo-de-dados.md), [banco](../../database/schema.md) e [módulos](../../README.md#modulos).

## Escopo funcional

O escopo cobre quatro perfis. O aluno consulta atividades, trilhas, resultados,
redações, agenda, biblioteca e evolução. O professor planeja conteúdo, cria e
publica avaliações, acompanha entregas, corrige produções e agenda compromissos. O
gestor administra contas, turmas, vínculos e catálogo curricular. A bibliotecária
controla acervo, exemplares e circulação. O sistema também mantém notificações,
auditoria, importação curricular e recursos experimentais de autoria.

Ficam fora do escopo arquitetural atual integrações financeiras, prontuários,
responsáveis externos e operação multi-escola em produção. A engine de trabalhos é
um laboratório separado: só passa a integrar o núcleo quando contratos de dados,
RLS, testes e critérios de promoção forem aprovados.

## Fluxos essenciais

1. O gestor cria a turma e vincula professor, matéria e currículo.
2. O professor seleciona turma e habilidades, monta uma atividade e publica uma
   versão imutável.
3. O aluno recebe a notificação, inicia uma tentativa, salva respostas e entrega.
4. O banco corrige formatos objetivos e separa respostas que exigem revisão.
5. O professor corrige, registra devolutiva e, quando necessário, cria recuperação.
6. O aluno consulta nota, evidências e evolução por descritor.

Agenda, redação e biblioteca reutilizam identidade, turmas, notificações e trilhas
de auditoria, mas conservam regras próprias de domínio.

## Modelo de dados e consistência

O banco usa UUIDs para entidades expostas, `timestamptz` para eventos e constraints
para estados e relações. O schema `public` contém objetos alcançáveis pela Data API;
rotinas auxiliares sensíveis ficam em `private`. Toda tabela pública precisa de RLS.
Grants determinam quais operações o papel pode tentar e policies determinam quais
linhas podem ser alcançadas. Triggers são usados para timestamps, auditoria,
versionamento e integridade que não pode depender do navegador.

`backend/schema` descreve bases de uma instalação limpa. `backend/migrations`
preserva a evolução incremental. O gerador compõe ambos em um schema transacional;
o verificador de governança impede migrations esquecidas e tabelas públicas sem
RLS.

## Requisitos não funcionais

- **Segurança:** menor privilégio, isolamento por usuário/turma e ausência de
  secrets no cliente.
- **Disponibilidade:** frontend estático degradável e operações críticas
  transacionais.
- **Desempenho:** índices em FKs e filtros usados por RLS e jornadas principais.
- **Usabilidade:** navegação por teclado, foco visível, contraste e layout entre
  320 px e desktop.
- **Manutenibilidade:** documentos, migrations, verificadores e registros de
  decisão versionados junto do código.
- **Privacidade:** coletar somente dados necessários e evitar conteúdo pessoal em
  logs, Copiloto e documentos técnicos.

## Responsabilidades e aprovação

O responsável técnico mantém arquitetura, migrations e verificadores. Gestão
aprova mudanças com efeito em ambiente, capacidade, risco ou tratamento de dados.
Desenvolvedores implementam e registram evidências. Segurança revisa ameaças,
acessos e incidentes. Uma alteração arquitetural relevante requer ADR, teste de
regressão, atualização dos documentos afetados e plano de reversão.

## Riscos arquiteturais

Os riscos principais são configuração incorreta de RLS, divergência entre schema
local e remoto, duplicação de clientes, dependências CDN não fixadas, cobertura
integrada incompleta e crescimento sem métricas de capacidade. As mitigações são
migrations aditivas, checks automatizados, ambiente isolado, testes positivos e
negativos por papel, registro de débito técnico e monitoramento após deploy.
