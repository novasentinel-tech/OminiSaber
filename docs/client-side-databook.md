# OminiSaber — Databook Client-Side

**Versão:** 1.0 · **Atualizado:** 3 de outubro de 2026 · **Status:** contrato
vigente para o frontend

Este Databook descreve como o navegador lê, transforma e envia dados. Ele não
substitui o schema PostgreSQL nem as policies RLS; serve para manter telas,
clientes e integrações consistentes.

## 1. Princípios

1. O navegador usa somente a chave pública do Supabase (`anonKey` ou
   `publishableKey`). Nunca recebe service-role, secret key ou `GEMINI_API_KEY`.
2. Telas chamam `window.OminiSaber`; não fazem consultas Supabase espalhadas pelo
   HTML. Exceções existentes devem ser migradas para o cliente compartilhado.
3. Toda resposta remota é tratada como não confiável: validar ausência, tipo,
   limites e permissões antes de renderizar.
4. Identificadores são UUIDs. Datas são ISO 8601 em UTC; a apresentação converte
   para `pt-BR`.
5. Estado local é descartável. O banco é a fonte de verdade para sessão,
   perfil, turma, currículo, atividades, trilhas e progresso.

## 2. Inicialização do cliente

```js
const api = window.OminiSaber;
if (!api?.configured) throw new Error("Conexão indisponível");
const session = await api.getSession();
```

O cliente é criado em `backend/ominisaber-supabase-client.js` a partir de
`window.OMINISABER_SUPABASE_CONFIG`. A configuração pública é gerada por
`npm --prefix backend run env:sync` e deve ser revisada antes de cada deploy.

## 3. Contratos centrais

### Sessão e perfil

```ts
type Session = { user: { id: string; email?: string } } | null;
type Profile = {
  id: string; nome: string; role: "aluno" | "professor" | "gestor" | "bibliotecaria";
  turma_id?: string | null; curso_tecnico?: "administracao" | "informatica" | null;
  tipo_professor?: "matematica" | "portugues" | "tecnico_administracao" | "tecnico_informatica" | null;
};
```

Métodos: `getSession()`, `getProfile(id?)`, `getProfileDestination(profile)`,
`signIn()`, `signOut()`, `requestPasswordReset()`.

### Turma e currículo

```ts
type Class = { id: string; nome: string; serie?: number; ano_letivo?: number };
type Skill = { habilidade_id: string; codigo: string; descricao: string; materia_codigo: string };
type Descriptor = { id: string; codigo: string; descricao: string; materia_codigo: string };
```

Métodos: `listTeacherClasses()`, `listCurriculumSkills({ materia, serie,
trimestre, search })`, consultas de descritores do módulo gestor.

### Atividade e avaliação

```ts
type Question = {
  id?: string; tipo: string; enunciado: string; alternativas?: string[];
  resposta?: string; explicacao?: string; pontos: number;
  habilidade_ids?: string[]; obrigatoria?: boolean;
};
type EvaluationDraft = {
  title: string; instructions: string; classId: string; subject: string;
  duration: number; value: number; questions: Question[];
};
```

Métodos principais: `createTeacherEvaluation()`, `listTeacherEvaluations()`,
`listStudentEvaluations()`, `saveEvaluationAttempt()`, `submitEvaluationAttempt()`.

O rascunho não é publicado automaticamente. Publicação é uma ação explícita e
deve possuir `turma_id`, matéria, status e questões válidas.

### Trilha e progresso

```ts
type Trail = {
  id: string; titulo: string; descricao?: string; materia_codigo: string;
  turma_id?: string | null; publicada: boolean; atividades?: TrailActivity[];
};
type TrailActivity = { id: string; trilha_id: string; titulo: string; ordem: number; status: string };
```

Métodos: `listTrilhas()`, `listStudentProgress()`, `getTrailWithActivities()`.
Rascunhos de trilha permanecem privados até publicação do professor.

## 4. Copiloto docente

`requestTeacherCopilot(payload)` chama exclusivamente a Edge Function
`professor-copiloto`. O payload mínimo é:

```ts
{
  action: "gerar_atividade" | "gerar_trilha" | "revisar_atividade" | "sugerir_recuperacao",
  subject: string, classId: string, objective: string,
  skillIds?: string[], skillCandidateIds?: string[],
  useClassContext: boolean, questionCount?: number,
  allFormatsEnabled?: boolean
}
```

A resposta contém `executionId`, `contextSummary` e `suggestion`. Quando a ação
é `gerar_trilha`, a sugestão também contém `trail.title`, `trail.description` e
`trail.steps[]`. A resposta é sempre um rascunho; o cliente nunca deve tratar a
resposta da IA como publicação confirmada.

## 5. Estado de tela

Use um objeto por fluxo e atualize a tela por uma função de renderização. Padrão:

```js
const state = { loading: false, error: null, items: [], selectedId: null };
try { state.loading = true; render(); state.items = await api.listTrilhas(); }
catch (error) { state.error = api.normalizeError?.(error) || error.message; }
finally { state.loading = false; render(); }
```

Nunca use `innerHTML` com texto remoto sem `escapeHtml`. Botões de submit devem
ser desabilitados durante a requisição e reabilitados no `finally`.

## 6. Cache, realtime e navegação

- Cache de tela pode viver somente durante a sessão; invalidar após criar,
  atualizar, publicar ou excluir.
- Use `subscribeToAgenda()` e subscriptions existentes somente em telas que
  precisam de atualização em tempo real; sempre guardar e chamar o unsubscribe.
- Rotas são caminhos relativos à raiz detectada por `frontend/`; não concatenar
  URLs absolutas de localhost.
- Ao publicar no Netlify, `netlify-dist/` deve preservar `frontend/`, `engine/`,
  `backend/`, `_redirects` e `_headers`.

## 7. Erros e estados vazios

Toda tela deve tratar: carregando, vazio, erro de autenticação (401), sem
permissão (403), recurso inexistente (404), conflito de validação (409) e falha
temporária (5xx/offline). Mensagens ao usuário são em português e não exibem
SQL, tokens, stack traces ou dados pessoais.

## 8. Segurança client-side

- RLS é a barreira real; esconder botão não é autorização.
- Não aceitar `role`, `professor_id`, `turma_id` ou `habilidade_ids` vindos da URL
  sem validação no servidor.
- Não guardar tokens ou dados de alunos em `localStorage`.
- Não enviar nomes, matrículas, e-mails, respostas individuais ou notas pessoais
  para o Copiloto.
- Limitar texto livre, quantidade de questões e tamanho de listas antes do envio.

## 9. Checklist de implementação

- [ ] Página carrega `ominisaber-supabase-client.js` antes do script da tela.
- [ ] Rota e papel são verificados antes de renderizar dados protegidos.
- [ ] Todos os listeners são registrados uma vez e removidos quando necessário.
- [ ] Loading, erro, vazio e sucesso têm estados visuais.
- [ ] Desktop, tablet e viewport de 520px foram testados.
- [ ] Nenhuma chave secreta aparece no HTML, JS público ou `netlify-dist/`.
- [ ] O contrato remoto foi atualizado neste Databook quando uma entidade mudou.

## 10. Documentos relacionados

- [Arquitetura](architecture/visao-geral.md)
- [Cliente Supabase](development/supabase-client.md)
- [Runbook atual](development/runbook-atual-2026-10-03.md)
- [Schema do banco](database/schema.md)
- [Contexto do Copiloto](copiloto-docente-contexto-supabase.md)
