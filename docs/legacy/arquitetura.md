# Arquitetura do OminiSaber

## Visão geral

O OminiSaber é uma aplicação web estática integrada ao Supabase. O navegador entrega experiências por papel; o gateway JavaScript organiza operações; Auth identifica o usuário; PostgreSQL persiste dados e RLS decide o acesso.

```text
Navegador
  ├─ Login e cadastro
  ├─ Área do aluno
  ├─ Área da bibliotecária
  ├─ Quatro áreas docentes especializadas
  └─ Área do gestor
        │
        ▼
window.OminiSaber
        │
        ▼
Supabase Auth + PostgREST + RPC
        │
        ▼
PostgreSQL + RLS + triggers
```

## Camadas

### Apresentação

frontend contém HTML, CSS e scripts por tela. Aluno prioriza aprendizagem e motivação; bibliotecária prioriza fila e conclusão de tarefas; professor e gestor mantêm visões institucionais.

### Gateway

backend/ominisaber-supabase-client.js expõe sessão, perfil, trilhas, progresso, notas, redações, livros, empréstimos e operações docentes de laboratórios e avaliações.

O gateway reduz duplicação, mas não substitui RLS.

### Dados e autorização

O schema principal contém turmas, perfis, trilhas, atividades, progresso, notas, redações, livros e empréstimos. Schemas complementares adicionam biblioteca digital, estoque, configurações, conquistas e os espaços docentes funcionais.

Policies usam auth.uid, papel e turma. RPCs concentram operações atômicas.

## Autenticação

1. Login recebe e-mail ou matrícula.
2. Supabase Auth cria a sessão.
3. O gateway carrega perfil e papel.
4. A aplicação abre a área correspondente.
   Professores são encaminhados pelo valor de `tipo_professor`.
5. Cada consulta é novamente autorizada por RLS.

## Fluxo do aluno

O painel combina perfil, notas e progresso. O mapa de domínio transforma notas por matéria em indicador navegável. Selecionar uma matéria revela conceito, resultado e prática recomendada. Evolução calcula XP e níveis a partir de ações acadêmicas.

## Fluxo da bibliotecária

O painel resume pendências. Empréstimos seguem aprovar, entregar e devolver. Acervo agrega título, exemplar, ISBN e localização. Regras de prazo e limite ficam separadas da fila diária.

## Fluxo do professor

O professor entra na pasta da própria especialidade. O dashboard consulta turmas, alunos, laboratórios, avaliações e entregas permitidas por RLS. Laboratórios podem ser salvos como rascunho ou publicados. Avaliações são compostas com questões específicas da área e persistidas nas tabelas docentes. Português também acessa o fluxo de propostas e correções de redação.

## Execução

- Todas as áreas: sessão Supabase e dados reais; sem sessão, retorna ao login.
- Falhas de conexão e ausência de conteúdo possuem estados explícitos, sem registros simulados.

## Limites atuais

- Algumas páginas legadas ainda são independentes.
- Parte da biblioteca acessa api.client diretamente e deve migrar ao gateway.
- Não existe pipeline automatizado de testes.
- QA de dados reais exige contas de homologação por papel.
