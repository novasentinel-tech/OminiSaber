# Agenda

## Objetivo

Publicar aulas, provas, atividades e compromissos por turma.

## Estrutura

Professor: `frontend/professor/agenda/`. Aluno: `frontend/aluno/agenda/`. Backend: `eventos_agenda`, notificações e realtime no cliente Supabase.

## Funcionamento

O professor cria, atualiza ou cancela eventos das turmas vinculadas. Alunos veem
eventos publicados de sua turma. Eventos relevantes e atividades publicadas pelo
motor de avaliações geram notificações persistentes para a turma.

## Banco de dados

`eventos_agenda` possui FKs para turma e professor; `notificacoes` possui destino,
criador e vínculo opcional com evento ou avaliação; `notificacoes_lidas` registra
a leitura individual. O gatilho de avaliação mantém uma única notificação por
publicação e a remove se o registro deixar o estado publicado.

## Permissões

RLS limita criação ao professor autenticado e à combinação ativa em
`professor_turma_materias`; leitura considera papel, turma e status publicado.
`professor_turmas` permanece apenas como compatibilidade sincronizada.
