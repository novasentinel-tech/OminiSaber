# Runbook atual — 3 de outubro de 2026

Este documento é o ponto de partida operacional para desenvolver, testar e
publicar o OminiSaber. Ele complementa os documentos de arquitetura e substitui
instruções antigas que apontem para um projeto Supabase diferente ou para o
provedor de IA anterior do Copiloto.

## Mapa rápido

| Área | Fonte de verdade |
| --- | --- |
| Frontend | `frontend/` |
| Cópia publicável | `netlify-dist/` |
| Cliente Supabase | `backend/ominisaber-supabase-client.js` |
| Edge Function do Copiloto | `backend/supabase/functions/professor-copiloto/` |
| Schema completo | `backend/ominisaber-schema-completo.sql` |
| Migrations | `backend/migrations/` |
| Documentação normativa | `docs/` |
| Histórico | `docs/legacy/` |

## Estado verificado do ambiente de testes

Projeto Supabase: `mvnuhwlnbhijjlosmnfv`.

- 1 turma preservada: `1º Ano A · Informática`;
- 4 professores preservados;
- 30 alunos sintéticos na turma do professor de Português;
- 153 habilidades curriculares e 55 descritores preservados;
- 0 trilhas, atividades, avaliações, laboratórios e propostas de redação após a
  limpeza controlada.

Contas sintéticas usam `aluno01@teste.ominisaber.com` até
`aluno30@teste.ominisaber.com`, com a senha temporária `Teste@12345`. Nunca use
essas credenciais em produção.

### Acessos corrigidos e verificados em 4 de outubro de 2026

As 30 identidades dos alunos já estavam em `auth.users`, mas tinham
`instance_id` nulo e quatro campos internos de texto nulos. O serviço de
autenticação não conseguia carregar essas contas. Além disso, os e-mails dos
alunos 01 a 09 tinham um espaço no lugar do zero inicial.

A correção preservou os 30 IDs, nomes, matrículas, curso, turma e hashes de
senha existentes. Foram normalizados apenas a instância e os quatro campos
internos comprovadamente nulos; os nove e-mails malformados foram corrigidos
pela API administrativa oficial, junto dos respectivos e-mails de contato.
Não houve criação, exclusão ou redefinição de senha de contas.

As identidades de e-mail foram completadas pela API oficial: nove durante a
correção dos endereços e 21 usando exatamente o e-mail já existente, sem
alteração de senha ou papel de acesso. A verificação final confirmou as 30
identidades de e-mail.

- **Alunos:** `aluno01@teste.ominisaber.com` até
  `aluno30@teste.ominisaber.com`; senha `Teste@12345`.
- **Professor de Português:** matrícula `userprofportugues`, ou e-mail
  `professor.portugues.teste@ominisaber.com.br`; senha
  `senha123profportugues`.
- As matrículas existentes dos alunos foram preservadas. Por exemplo,
  `TEST-PT- 1` tem um espaço após o último hífen; use o e-mail para evitar
  ambiguidades ao digitar.

Foi verificado o carregamento das 30 identidades de aluno na autenticação,
o login do primeiro aluno por e-mail e por matrícula, o login do aluno 30,
o acesso aos respectivos perfis protegidos e o login dos quatro professores
com suas respectivas especialidades.
A conferência posterior dos e-mails não encontrou mais valores malformados.

Verificadores sem alteração de contas:

```powershell
node --use-system-ca backend/scripts/repair-student-test-auth-emails.js
node --use-system-ca backend/scripts/restore-student-test-access.js --verify-only
node --use-system-ca backend/scripts/audit-auth-live-readonly.mjs
```

O parâmetro `--use-system-ca` utiliza os certificados confiáveis do Windows,
mantendo a validação TLS ativa. A evidência detalhada está em
[Verificação de autenticação](../qa/netlify-auth-2026-10-04/README.md).

## Copiloto docente

O fluxo é **Pedido → Contexto → Rascunho**. A função valida JWT, professor,
vínculo de turma/matéria e habilidades. O consentimento de contexto determina se
indicadores agregados são consultados; nomes, e-mails, matrículas e respostas
individuais não são enviados à IA.

O contrato piloto oferece `generate_activity` (atividade, prova, diagnóstica e
variante de ideias), `adapt_question` (simplificar, aumentar dificuldade, gerar
alternativa ou revisão personalizada) e `analyze_class` (descritores críticos,
dificuldades agregadas e recuperação). Trilhas seguem preservadas como recurso
experimental fora do fluxo principal.

A análise consulta respostas corrigidas somente no escopo professor/turma/matéria,
agrega pontos por habilidade e nunca envia resposta, feedback ou identidade de
aluno ao Gemini. A aplicação continua sendo uma ação separada do professor.

Secrets necessários na Edge Function:

```text
GEMINI_API_KEY
GEMINI_MODEL
ALLOWED_ORIGINS
```

Nunca coloque `GEMINI_API_KEY`, service role key ou secret key em `frontend/` ou
`netlify-dist/`.

## Verificações locais

```powershell
node --check frontend\professor\specialty\teacher-copilot.js
node --test backend\tests\copilot-handler.test.mjs
node --test backend\tests\copilot-migration.test.mjs
node --check frontend\professor\specialty\activity-builder.js
node --check backend\ominisaber-supabase-client.js
node scripts\prepare-netlify-site.mjs
```

Se o ambiente permitir os scripts do backend, execute também os verificadores
descritos no [checklist de desenvolvimento](checklist-de-desenvolvimento.md).

## Deploy do frontend

1. Gere a cópia publicada: `node scripts\prepare-netlify-site.mjs`.
2. Publique o conteúdo de `netlify-dist/` no Netlify.
3. Confirme que o site contém `frontend/`, `engine/`, `backend/` e os arquivos de
   roteamento `_redirects` e `_headers`.
4. Teste login, uma rota protegida, OmniStudio e Copiloto em desktop, tablet e
   viewport de 520px.

## Deploy da Edge Function

No diretório `backend/`:

```powershell
npx supabase@latest functions deploy professor-copiloto `
  --project-ref mvnuhwlnbhijjlosmnfv --use-api --yes
```

Se o npm apresentar `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, é um problema de cadeia
de certificados da máquina local. Corrija o certificado/proxy do ambiente e
repita o comando; não desative a validação TLS permanentemente.

## Teste de aceite mínimo

1. Entrar como professor de Português.
2. Abrir o Copiloto e selecionar a turma.
3. Gerar atividade sem selecionar descritor e confirmar que a IA vincula
   habilidades compatíveis.
4. Gerar trilha e conferir título, etapas e interações.
5. Escolher “usar dados agregados” e “criar sem analisar”; ambos devem concluir.
6. Aplicar somente ao rascunho e confirmar que nada é publicado sem ação explícita.
7. Publicar uma atividade para uma turma e, separadamente, para todas as turmas.
8. Repetir em 520px e tablet, verificando rolagem, sidebar e modal.

## Regras de segurança

- Faça qualquer limpeza destrutiva somente em ambiente de testes e com backup ou
  confirmação explícita.
- Preserve professores, turmas, currículo e descritores ao resetar dados sintéticos.
- Não registre dados pessoais de alunos em prompts, logs ou screenshots.
- Mantenha a flag global do Copiloto desligada até concluir o aceite com a conta
  piloto.
