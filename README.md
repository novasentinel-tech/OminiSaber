# OminiSaber

O OminiSaber é uma plataforma educacional para conectar gestão acadêmica, trabalho
docente, aprendizagem do aluno e operação da biblioteca. O produto usa dados reais
do Supabase e organiza o ensino por turma, matéria, habilidade e descritor
curricular.

## Ciclo principal

```text
Gestor cataloga currículo e cria vínculos
                  ↓
Professor monta e publica uma atividade por descritor
                  ↓
Aluno recebe, responde, salva e entrega
                  ↓
Banco corrige respostas objetivas e separa questões abertas
                  ↓
Professor revisa, ajusta com justificativa e cria recuperação
                  ↓
Aluno acompanha resultado e evolução real por descritor
```

## Perfis e módulos

- **Aluno:** atividades, trilhas, redação, evolução, biblioteca, agenda,
  notificações, perfil e ajuda.
- **Professor:** experiências diferentes para Matemática, Português, Técnico em
  Administração e Técnico em Informática, apoiadas pelo mesmo motor de atividades.
- **Gestor:** contas, turmas, alunos, professores, vínculos, currículo, conteúdos,
  acessos e auditoria.
- **Bibliotecária:** acervo físico e digital, exemplares, solicitações, separação,
  entrega, devolução e histórico.

## Stack

- HTML, CSS e JavaScript sem framework ou bundler no frontend;
- Supabase Auth e cliente JavaScript compartilhado;
- PostgreSQL com Row Level Security, funções, triggers e auditoria;
- Supabase Storage, Realtime e Edge Functions quando o domínio exige;
- Google Gemini no Copiloto docente, sempre por uma Edge Function Supabase;
- scripts Node.js e Python para geração e validação do schema.

Os utilitários do backend exigem **Node.js 22 ou superior**. O frontend continua
sem etapa de build.

As decisões e seus motivos estão em [Arquitetura](docs/architecture/visao-geral.md).

## Execução local

1. Copie `.env.example` para `.env` e preencha somente as variáveis do ambiente
   escolhido.
2. Gere a configuração pública do navegador:

   ```powershell
   npm --prefix backend run env:sync
   ```

3. Sirva a raiz do repositório por HTTP:

   ```powershell
   python -m http.server 4173
   ```

4. Abra `http://127.0.0.1:4173/frontend/login/index.html`.

Não abra as páginas com `file://`: sessão, módulos JavaScript e requisições podem
falhar fora de uma origem HTTP.

## Banco de dados

- Instalação limpa: execute apenas
  [`backend/ominisaber-schema-completo.sql`](backend/ominisaber-schema-completo.sql).
- Atualização de banco existente: aplique as migrations ainda não instaladas, em
  ordem cronológica.
- Fonte de edição: schemas e migrations em `backend/`; o arquivo completo é gerado,
  não editado manualmente.

Consulte [Instalação do Supabase](docs/getting-started/supabase.md) antes de alterar
um ambiente.

## Ambientes atuais

| Ambiente | Finalidade               | Estado                                  |
| -------- | ------------------------ | --------------------------------------- |
| Testes   | Testes funcionais e Copiloto | `mvnuhwlnbhijjlosmnfv`, dados sintéticos controlados |
| Netlify  | Frontend publicado          | `netlify-dist/`, sem secrets no cliente |

O mapa completo, o identificador do projeto ativo e a estratégia de deploy estão em
[Ambientes e deploy](docs/development/ambientes-e-deploy.md).

## Verificações

Na pasta `backend`:

```powershell
npm run schema:build
npm run sql:check
npm run docs:check
npm run activity:builder:check
npm run activity:student:check
npm run activity:teacher-review:check
npm run activity:results:check
npm run copilot:check
npm run system:audit
npm run system:audit:remote
```

## Documentação

Comece pelo [índice central](docs/README.md) e pelo
[status do projeto](docs/development/status-do-projeto.md). A documentação normativa
fica em `docs/`; `docs/legacy/` preserva decisões e inventários históricos, mas não
deve ser usada como contrato atual sem confirmação no código.

O [controle documental](docs/governance/controle-de-formularios.md) organiza os
documentos técnicos canônicos conforme `OMNI-FRM-000-002`.

Para uma operação completa, consulte o [runbook atual de testes, Copiloto e
deploy](docs/development/runbook-atual-2026-10-03.md). Ele registra o estado
verificado do Supabase, as contas sintéticas e a ordem segura de publicação.

O resultado mais recente do pente-fino está em
[Auditoria geral do sistema](docs/development/auditoria-sistema-2026-09-09.md), e os
fluxos completos estão em [Fluxogramas](docs/architecture/fluxogramas.md).
