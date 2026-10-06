# Fluxogramas do OminiSaber

Atualizado em **9 de setembro de 2026**.

Este documento representa os fluxos funcionais vigentes. As setas mostram troca de
dados ou mudança de estado; elas não substituem as permissões do banco. Toda leitura
ou gravação exposta ao navegador continua sujeita a RLS.

## Visão do sistema por perfil

```mermaid
flowchart LR
  G[Gestor] -->|organiza| C[Currículo, turmas e vínculos]
  C -->|habilita contexto| P[Professor]
  P -->|publica| A[Atividade por descritor]
  A -->|notifica e entrega| E[Aluno]
  E -->|respostas| M[Motor de correção]
  M -->|objetivas corrigidas| R[Resultados]
  M -->|abertas pendentes| P
  P -->|revisão e ajustes auditados| R
  R -->|evidências| EV[Evolução por descritor]
  R -->|baixo desempenho| RC[Recuperação]
  RC -->|nova atividade| E
  B[Bibliotecária] -->|acervo, reserva e empréstimo| E
```

## Autenticação, perfil e autorização

```mermaid
sequenceDiagram
  actor U as Usuário
  participant UI as Login
  participant AU as Supabase Auth
  participant PF as perfis
  participant APP as Área do perfil
  participant DB as PostgreSQL + RLS

  U->>UI: Informa matrícula ou e-mail e senha
  UI->>AU: Autentica credenciais
  AU-->>UI: Sessão e JWT
  UI->>PF: Lê perfil da sessão
  PF-->>UI: Papel, turma, curso e especialidade
  UI->>APP: Direciona para a área autorizada
  APP->>DB: Consulta ou alteração com JWT
  DB-->>APP: Apenas dados permitidos pelas policies
```

O redirecionamento melhora a experiência, mas não é uma barreira de segurança. A
autorização real está nas policies e nas funções que validam `auth.uid()`, papel,
turma, matéria e vínculo.

## Criação e publicação de atividade

```mermaid
flowchart TD
  I[Professor inicia o construtor] --> F{Formato}
  F --> AV[Avaliação]
  F --> AT[Atividade]
  F --> DG[Diagnóstica]
  F --> RE[Recuperação]
  AV --> PS{Prova Segura?}
  PS -->|sim| SEG[Configura restrições e registros]
  PS -->|não| CONT[Configuração comum]
  AT --> INT[Escolhe experiência interativa]
  DG --> DIAG[Define diagnóstico e descritores]
  RE --> REC[Prioriza descritores de baixo desempenho]
  SEG --> CUR[Seleciona turma, matéria e currículo]
  CONT --> CUR
  INT --> CUR
  DIAG --> CUR
  REC --> CUR
  CUR --> Q[Cria questões e pesos]
  Q --> RV[Revisa versão do aluno]
  RV --> PUB{Publicar?}
  PUB -->|não| RAS[Rascunho editável]
  PUB -->|sim| TX[Transação no banco]
  TX --> VER[Versão imutável sem gabarito]
  TX --> NOT[Notificação da turma]
```

## Execução, correção e recuperação

```mermaid
stateDiagram-v2
  [*] --> Publicada
  Publicada --> EmAndamento: aluno inicia
  EmAndamento --> EmAndamento: salvamento automático
  EmAndamento --> Entregue: aluno envia
  Entregue --> CorrecaoAutomatica: formatos determinísticos
  Entregue --> RevisaoDocente: respostas abertas
  CorrecaoAutomatica --> RevisaoDocente: se houver pendência
  CorrecaoAutomatica --> Corrigida: sem pendência
  RevisaoDocente --> Corrigida: professor conclui
  Corrigida --> Ajustada: justificativa e auditoria
  Corrigida --> Recuperacao: descritores abaixo do esperado
  Ajustada --> Recuperacao: descritores abaixo do esperado
  Recuperacao --> Publicada: nova atividade vinculada
```

## Resultado agregado do aluno

```mermaid
flowchart LR
  Q1[Resposta corrigida] --> D1[Descritor associado]
  Q2[Resposta corrigida] --> D1
  Q3[Resposta corrigida] --> D2[Outro descritor]
  D1 -->|pontuação ponderada| GERAL[Geral da matéria]
  D2 -->|pontuação ponderada| GERAL
  GERAL --> MAPA[Mapa de dificuldades]
  GERAL --> EVO[Evolução do aluno]
  MAPA --> PRI[Descritores a priorizar]
  PRI --> REC[Recuperação direcionada]
```

Percentuais são calculados somente a partir de respostas reais corrigidas. A
ausência de evidência deve aparecer como “sem evidência”, nunca como zero inventado.

## Biblioteca física e digital

```mermaid
flowchart TD
  AL[Aluno abre a biblioteca] --> T{Tipo de item}
  T -->|PDF verificado| PDF[Detalhes e download seguro]
  T -->|Livro físico| SOL[Solicita empréstimo]
  SOL --> FILA[Fila da bibliotecária]
  FILA --> SEP[Separar exemplar disponível]
  SEP --> N[Notificar aluno]
  N --> ENT[Confirmar entrega]
  ENT --> EMP[Empréstimo ativo]
  EMP --> DEV[Registrar devolução]
  DEV --> DISP[Exemplar disponível]
```

## Copiloto docente

```mermaid
sequenceDiagram
  actor P as Professor
  participant UI as Construtor
  participant EF as Edge Function
  participant DB as Supabase
  participant IA as Google Gemini

  P->>UI: Solicita sugestão pedagógica
  UI->>EF: Contexto + JWT
  EF->>DB: Valida papel, vínculo, flag e limites
  DB-->>EF: Autorização e currículo permitido
  EF->>IA: Contexto pedagógico mínimo
  IA-->>EF: Sugestão estruturada
  EF-->>UI: Prévia editável
  P->>UI: Aceita, altera ou descarta
  Note over P,UI: O Copiloto nunca publica automaticamente
```

## Fontes de verdade

- instalação limpa do banco: `backend/ominisaber-schema-completo.sql`;
- evolução incremental: `backend/migrations/`;
- cliente e páginas: `backend/` e `frontend/`;
- contratos do motor: `docs/modules/motor-atividades/README.md`;
- situação verificada: `docs/development/auditoria-sistema-2026-09-09.md`.
