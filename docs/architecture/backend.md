# Backend Supabase

## Componentes

- `backend/schema/`: estruturas por domínio usadas como fonte humana.
- `backend/migrations/`: mudanças incrementais e versionadas.
- `backend/ominisaber-schema-completo.sql`: instalação limpa gerada.
- `backend/ominisaber-supabase-client.js`: gateway consumido pelas páginas.
- `backend/supabase/functions/`: lógica de servidor e integrações privadas.
- `backend/scripts/`: geração, seeds controlados e verificações.

## Responsabilidades do PostgreSQL

- relacionar Auth, perfil, turma, curso e especialidade;
- validar vínculos professor–turma–matéria;
- proteger linhas e operações com RLS e grants mínimos;
- executar transações compostas em RPCs;
- versionar atividades publicadas sem expor gabaritos;
- corrigir respostas determinísticas;
- registrar revisão, ajuste de nota e auditoria;
- calcular resultados e evolução diretamente das evidências.

## Edge Functions

| Função               | Responsabilidade                                         |
| -------------------- | -------------------------------------------------------- |
| `gestor-contas`      | Operações administrativas que exigem credencial elevada  |
| `curriculo-upload`   | Entrada controlada para documentos curriculares          |
| `professor-copiloto` | Mediação autenticada e limitada entre professor e Google Gemini |

Chaves secretas existem somente no ambiente dessas funções ou em scripts locais
administrativos. Elas nunca são copiadas para o frontend.

## Fonte do schema

O arquivo completo é produzido por `npm run schema:build`. Altere os arquivos de
origem, regenere o consolidado e rode `npm run sql:check`. Não edite o consolidado
manualmente.

## Erros e observabilidade

RPCs devem falhar com mensagens compreensíveis, sem vazar gabaritos ou dados de
outros usuários. Eventos pedagógicos sensíveis são registrados nas tabelas de
auditoria; segredos, tokens e conteúdo pessoal desnecessário não devem ser logados.
