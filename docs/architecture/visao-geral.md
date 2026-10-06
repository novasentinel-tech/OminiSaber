# Visão geral da arquitetura

O OminiSaber é uma aplicação web estática por perfil, conectada a um backend
Supabase. A interface apresenta as ações; PostgreSQL decide autorização, valida
regras de negócio e persiste o estado.

## Componentes

```text
Navegador
├── frontend/aluno
├── frontend/professor
├── frontend/gestor
└── frontend/bibliotecaria
          │
          v
backend/ominisaber-supabase-client.js
          │
          v
Supabase Auth + Data API + PostgreSQL/RLS
          │
          ├── Storage e Realtime
          └── Edge Functions
              ├── gestor-contas
              ├── curriculo-upload
              └── professor-copiloto → OpenAI API
```

## Decisões e motivos

### Frontend estático sem framework

Mantém implantação simples, compatibilidade com a estrutura já criada e baixo
custo operacional. Em troca, componentes compartilhados, caminhos relativos e
estado de tela precisam de disciplina adicional.

### Cliente Supabase compartilhado

As páginas não repetem acesso ao banco. O gateway
`backend/ominisaber-supabase-client.js` normaliza sessão, perfil, consultas, RPCs e
mensagens de erro.

### Autorização no banco

Ocultar um botão não é segurança. RLS, grants, constraints e funções validam cada
operação usando usuário, papel, turma, matéria e vínculo persistido.

### Motor único, experiências docentes diferentes

As quatro especialidades possuem identidade e ferramentas próprias, mas usam o
mesmo contrato para avaliações, questões, tentativas, correção e resultados. Isso
evita regras de nota divergentes entre matérias.

### Operações compostas em RPCs

Criação de atividade, entrega, correção, ajuste e recuperação atravessam várias
tabelas. Funções PostgreSQL mantêm essas operações atômicas e auditáveis.

### IA isolada por Edge Function e feature flag

O navegador nunca acessa a OpenAI diretamente. A função valida sessão e escopo,
reduz dados, limita consumo e devolve somente uma sugestão revisável. A separação de
ambiente e o flag desligado protegem o beta durante a Fase 3.

## Princípios

- dados reais ou estados vazios explícitos; sem mocks como fallback;
- responsividade para desktop e celular;
- separação entre configuração pública e segredos;
- publicação intencional e conteúdo versionado;
- auditoria em decisões que alteram nota ou acesso;
- migrations incrementais e schema completo regenerável.

## Limites atuais

Não há bundler nem API própria fora do Supabase. A aplicação depende de caminhos
relativos corretos e deve ser servida por HTTP. O estado de cada fase está em
[Status do projeto](../development/status-do-projeto.md).
