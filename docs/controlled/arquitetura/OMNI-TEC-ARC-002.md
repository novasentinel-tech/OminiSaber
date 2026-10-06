# Diagrama de Componentes

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-ARC-002 |
| Versão | v1.0 |
| Status | Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Criação / revisão | 2026-09-25 |

```mermaid
flowchart LR
  U[Usuários] --> FE[Frontend estático]
  FE --> SC[Cliente Supabase compartilhado]
  SC --> AUTH[Supabase Auth]
  SC --> API[Data API]
  SC --> RPC[RPCs PostgreSQL]
  SC --> EF[Edge Functions]
  API --> DB[(PostgreSQL)]
  RPC --> DB
  EF --> DB
  DB --> RLS[RLS, constraints e triggers]
  TE[Engine de trabalhos] --> SC
  CI[Scripts de verificação] --> SQL[Schema e migrations]
  SQL --> DB
```

## Responsabilidades

| Componente | Responsabilidade | Não deve fazer |
| --- | --- | --- |
| Frontend | interação, validação de entrada e apresentação | decidir autorização ou conter secrets |
| Cliente compartilhado | sessão e acesso consistente aos contratos | contornar RLS |
| Auth | identidade e tokens | armazenar regras pedagógicas em metadata editável pelo usuário |
| Data API | acesso às tabelas com grants e RLS | expor tabelas internas |
| RPCs | operações atômicas e validações de domínio | confiar apenas em parâmetros do cliente |
| Edge Functions | integrações e operações com secrets | devolver chaves ou dados excessivos |
| PostgreSQL | integridade, autorização e auditoria | depender de filtros do frontend |

Detalhes de sequência estão em [Fluxogramas](../../architecture/fluxogramas.md).

## Visões por contexto

**Contexto de identidade.** O navegador autentica no Supabase Auth. O JWT identifica
o usuário, enquanto `perfis`, vínculos docentes e policies definem seu escopo. Uma
rota visível não concede permissão por si mesma.

**Contexto pedagógico.** Currículo, avaliações, tentativas, respostas e resultados
formam o núcleo transacional. Gabaritos ficam separados de questões públicas. Uma
publicação produz uma versão estável para evitar que edições futuras alterem uma
tentativa já iniciada.

**Contexto operacional.** Agenda e notificações divulgam compromissos e publicações.
Biblioteca controla material digital, exemplares e solicitações. Edge Functions
executam operações que precisam de secrets ou privilégios administrativos.

## Sequência de publicação

```mermaid
sequenceDiagram
  actor P as Professor
  participant F as Frontend
  participant R as RPC
  participant D as PostgreSQL
  actor A as Aluno
  P->>F: revisa e publica atividade
  F->>R: envia payload validado e JWT
  R->>D: valida vínculo, questões e pontos
  D->>D: grava versão e notificação
  R-->>F: confirma identificadores
  A->>F: abre atividade publicada
  F->>D: consulta sob RLS
  D-->>F: devolve conteúdo permitido
```

## Sequência de correção

```mermaid
sequenceDiagram
  actor A as Aluno
  participant F as Frontend
  participant D as PostgreSQL
  actor P as Professor
  A->>F: entrega tentativa
  F->>D: RPC de entrega
  D->>D: corrige formatos objetivos
  D-->>P: disponibiliza fila de revisão
  P->>D: corrige resposta aberta
  D->>D: recalcula nota e registra auditoria
  D-->>A: resultado permitido por RLS
```

## Dependências e falhas

Se Auth estiver indisponível, novas sessões e operações protegidas param. Se a Data
API falhar, a interface deve mostrar erro e preservar entradas locais que possam ser
reenviadas com segurança. Falha de Edge Function não autoriza fallback no navegador
com uma chave elevada. Falha de notificação não deve desfazer a publicação; deve ser
detectável e reconciliável.

## Regras de alteração

Novos componentes devem declarar responsável, dados tratados, autenticação,
dependências, comportamento de falha, logs e testes. Qualquer nova seta que atravesse
um limite de confiança exige revisão de segurança e atualização deste diagrama.
