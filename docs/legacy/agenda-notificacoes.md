# Agenda compartilhada e Central de Notificações

## Objetivo

Este módulo conecta o planejamento dos professores à rotina dos alunos. Um professor publica um compromisso para uma turma; todos os alunos daquela turma passam a vê-lo na agenda. Provas, recuperações, trabalhos e atividades também geram uma notificação automática.

## Experiência por perfil

### Professor

- Acessa **Agenda das turmas** a partir de qualquer um dos quatro portais docentes.
- Visualiza compromissos publicados por outros professores das turmas às quais está vinculado.
- Escolhe turma, tipo, data, horário, matéria, local e orientações.
- Pode salvar um rascunho ou publicar imediatamente.
- Pode cancelar ou excluir somente compromissos próprios. O gestor pode administrar todos.

### Aluno

- Acessa uma agenda mensal responsiva, com visão detalhada do dia selecionado.
- Pode filtrar provas, recuperações, trabalhos e atividades.
- Recebe atualizações sem recarregar a página.
- Vê provas e recuperações em destaque, tanto na agenda quanto nas notificações.
- Pode marcar uma notificação ou todas as notificações como lidas.

## Arquitetura

```text
Professor publica um evento
          │
          ▼
eventos_agenda ── trigger transacional ──► notificacoes
          │                                   │
          ├──────── Supabase Realtime ────────┤
          │                                   │
          ▼                                   ▼
Agenda do aluno                    Central de notificações
                                              │
                                              ▼
                                  notificacoes_lidas
```

O calendário usa `eventos_agenda` como fonte única. A notificação relacionada é criada ou atualizada na mesma transação do evento, o que evita uma prova aparecer na agenda sem seu aviso correspondente. Ao cancelar o evento, o aviso é removido automaticamente.

## Estrutura de dados

### `eventos_agenda`

Armazena o compromisso, tipo, período, turma, professor responsável, matéria, local e estado de publicação.

### `notificacoes`

Armazena o conteúdo comum do aviso. Uma única linha atende toda a turma; não há duplicação de uma notificação para cada aluno.

### `notificacoes_lidas`

Registra apenas a relação entre usuário e notificação lida. Essa separação mantém a consulta simples e preserva o estado individual.

O schema completo está em [`../../backend/migrations/20260831_agenda_notificacoes.sql`](../../backend/migrations/20260831_agenda_notificacoes.sql).

## Segurança

- Todas as tabelas novas têm Row Level Security habilitado.
- O papel `anon` não recebe acesso às tabelas.
- Um aluno lê somente eventos publicados e avisos da própria turma.
- Um professor cria eventos somente para turmas presentes em `professor_turmas`.
- Professores podem ler o calendário compartilhado das turmas vinculadas, mas alteram apenas eventos próprios.
- O estado de leitura pertence exclusivamente ao usuário autenticado.
- As políticas usam `auth.uid()` e filtros explícitos no cliente; nenhuma chave administrativa é enviada ao navegador.
- Colunas usadas por turma, professor, data e estado de leitura possuem índices.

## Atualização em tempo real

`eventos_agenda` e `notificacoes` entram na publicação `supabase_realtime`. O frontend assina alterações via Postgres Changes e refaz consultas com os mesmos limites de turma impostos pelo RLS. Assim, uma publicação docente aparece para os alunos que estiverem com a agenda ou a central aberta.

## Páginas

- `frontend/aluno/agenda`: calendário mensal e visão do dia.
- `frontend/aluno/notificacoes`: filtros, busca e leitura individual.
- `frontend/aluno/perfil`: identidade e informações escolares.
- `frontend/aluno/configuracoes`: dados pessoais, senha e tema.
- `frontend/aluno/ajuda-suporte`: perguntas frequentes e diagnóstico local.
- `frontend/professor/agenda`: criação e gestão de compromissos.

## Implantação

1. Confirme que o projeto Supabase configurado no frontend é o mesmo disponível para migrações administrativas.
2. Aplique `20260831_agenda_notificacoes.sql` no projeto correto.
3. Execute os advisors de segurança e desempenho do Supabase.
4. Valide com uma conta de professor vinculada a uma turma e uma conta de aluno da mesma turma.

O frontend é gerado a partir do `.env` pelo comando `npm --prefix backend run env:sync`. Em 09/09/2026, a configuração foi sincronizada com o projeto de testes atual e o fluxo foi validado com eventos persistidos no mesmo banco.
