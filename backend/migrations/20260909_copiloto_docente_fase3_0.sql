-- OminiSaber | Fase 3.0 - Copiloto docente isolado por feature flag

begin;

create table if not exists public.feature_flags (
  chave text primary key check (chave ~ '^[a-z0-9_]{3,80}$'),
  nome text not null check (char_length(nome) between 3 and 120),
  descricao text not null default '',
  habilitada_global boolean not null default false,
  configuracao jsonb not null default '{}'::jsonb check (jsonb_typeof(configuracao) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flag_usuarios (
  feature_chave text not null references public.feature_flags(chave) on delete cascade,
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  habilitada boolean not null default true,
  concedida_por uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (feature_chave, usuario_id)
);

create table if not exists public.copiloto_sessoes (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.perfis(id) on delete cascade,
  turma_id uuid references public.turmas(id) on delete set null,
  materia_codigo public.materia_aluno not null,
  titulo text not null default 'Nova conversa' check (char_length(titulo) between 3 and 140),
  contexto jsonb not null default '{}'::jsonb check (jsonb_typeof(contexto) = 'object'),
  status text not null default 'ativa' check (status in ('ativa', 'arquivada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.copiloto_execucoes (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid references public.copiloto_sessoes(id) on delete set null,
  professor_id uuid not null references public.perfis(id) on delete cascade,
  turma_id uuid references public.turmas(id) on delete set null,
  acao text not null check (acao in ('gerar_atividade', 'revisar_atividade', 'sugerir_recuperacao')),
  status text not null default 'processando' check (status in ('processando', 'concluida', 'falhou', 'bloqueada')),
  materia_codigo public.materia_aluno not null,
  habilidade_ids uuid[] not null default '{}',
  solicitacao_resumo jsonb not null default '{}'::jsonb check (jsonb_typeof(solicitacao_resumo) = 'object'),
  resultado jsonb check (resultado is null or jsonb_typeof(resultado) = 'object'),
  provedor text,
  modelo text,
  prompt_versao text not null default 'fase3.0-v1',
  tokens_entrada integer check (tokens_entrada is null or tokens_entrada >= 0),
  tokens_saida integer check (tokens_saida is null or tokens_saida >= 0),
  latencia_ms integer check (latencia_ms is null or latencia_ms >= 0),
  codigo_erro text,
  created_at timestamptz not null default now(),
  concluida_em timestamptz
);

create table if not exists public.copiloto_feedback (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references public.copiloto_execucoes(id) on delete cascade,
  professor_id uuid not null references public.perfis(id) on delete cascade,
  util boolean not null,
  comentario text check (comentario is null or char_length(comentario) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (execucao_id, professor_id)
);

create index if not exists feature_flag_usuarios_usuario_idx
  on public.feature_flag_usuarios (usuario_id, feature_chave);
create index if not exists copiloto_sessoes_professor_idx
  on public.copiloto_sessoes (professor_id, updated_at desc);
create index if not exists copiloto_sessoes_turma_idx
  on public.copiloto_sessoes (turma_id) where turma_id is not null;
create index if not exists copiloto_execucoes_professor_idx
  on public.copiloto_execucoes (professor_id, created_at desc);
create index if not exists copiloto_execucoes_sessao_idx
  on public.copiloto_execucoes (sessao_id, created_at desc) where sessao_id is not null;
create index if not exists copiloto_execucoes_turma_idx
  on public.copiloto_execucoes (turma_id) where turma_id is not null;
create index if not exists copiloto_execucoes_limite_idx
  on public.copiloto_execucoes (professor_id, created_at desc)
  where status in ('processando', 'concluida');
create index if not exists copiloto_feedback_professor_idx
  on public.copiloto_feedback (professor_id, created_at desc);

drop trigger if exists feature_flags_updated_at on public.feature_flags;
create trigger feature_flags_updated_at before update on public.feature_flags
for each row execute function public.set_updated_at();
drop trigger if exists feature_flag_usuarios_updated_at on public.feature_flag_usuarios;
create trigger feature_flag_usuarios_updated_at before update on public.feature_flag_usuarios
for each row execute function public.set_updated_at();
drop trigger if exists copiloto_sessoes_updated_at on public.copiloto_sessoes;
create trigger copiloto_sessoes_updated_at before update on public.copiloto_sessoes
for each row execute function public.set_updated_at();
drop trigger if exists copiloto_feedback_updated_at on public.copiloto_feedback;
create trigger copiloto_feedback_updated_at before update on public.copiloto_feedback
for each row execute function public.set_updated_at();

alter table public.feature_flags enable row level security;
alter table public.feature_flag_usuarios enable row level security;
alter table public.copiloto_sessoes enable row level security;
alter table public.copiloto_execucoes enable row level security;
alter table public.copiloto_feedback enable row level security;

drop policy if exists feature_flags_select_authenticated on public.feature_flags;
create policy feature_flags_select_authenticated on public.feature_flags
for select to authenticated using (true);
drop policy if exists feature_flags_manage_gestor on public.feature_flags;
create policy feature_flags_manage_gestor on public.feature_flags
for all to authenticated
using ((select public.usuario_role()) = 'gestor')
with check ((select public.usuario_role()) = 'gestor');

drop policy if exists feature_flag_usuarios_select on public.feature_flag_usuarios;
create policy feature_flag_usuarios_select on public.feature_flag_usuarios
for select to authenticated using (
  usuario_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor'
);
drop policy if exists feature_flag_usuarios_manage_gestor on public.feature_flag_usuarios;
create policy feature_flag_usuarios_manage_gestor on public.feature_flag_usuarios
for all to authenticated
using ((select public.usuario_role()) = 'gestor')
with check ((select public.usuario_role()) = 'gestor');

drop policy if exists copiloto_sessoes_select on public.copiloto_sessoes;
create policy copiloto_sessoes_select on public.copiloto_sessoes
for select to authenticated using (
  professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor'
);

drop policy if exists copiloto_execucoes_select on public.copiloto_execucoes;
create policy copiloto_execucoes_select on public.copiloto_execucoes
for select to authenticated using (
  professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor'
);

drop policy if exists copiloto_feedback_select on public.copiloto_feedback;
create policy copiloto_feedback_select on public.copiloto_feedback
for select to authenticated using (
  professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor'
);
drop policy if exists copiloto_feedback_insert on public.copiloto_feedback;
create policy copiloto_feedback_insert on public.copiloto_feedback
for insert to authenticated with check (
  professor_id = (select auth.uid())
  and exists (
    select 1 from public.copiloto_execucoes ce
    where ce.id = execucao_id and ce.professor_id = (select auth.uid())
  )
);
drop policy if exists copiloto_feedback_update on public.copiloto_feedback;
create policy copiloto_feedback_update on public.copiloto_feedback
for update to authenticated
using (professor_id = (select auth.uid()))
with check (professor_id = (select auth.uid()));

revoke all on table public.feature_flags from anon;
revoke all on table public.feature_flag_usuarios from anon;
revoke all on table public.copiloto_sessoes from anon;
revoke all on table public.copiloto_execucoes from anon;
revoke all on table public.copiloto_feedback from anon;

grant select on table public.feature_flags to authenticated;
grant select on table public.feature_flag_usuarios to authenticated;
grant select on table public.copiloto_sessoes to authenticated;
grant select on table public.copiloto_execucoes to authenticated;
grant select, insert, update on table public.copiloto_feedback to authenticated;

insert into public.feature_flags (chave, nome, descricao, habilitada_global, configuracao)
values (
  'professor_copiloto',
  'Ajudante Copiloto docente',
  'Geração e revisão assistida de atividades com aprovação obrigatória do professor.',
  false,
  jsonb_build_object(
    'limite_por_minuto', 3,
    'limite_diario', 40,
    'max_questoes', 12,
    'ambiente_beta', false
  )
)
on conflict (chave) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  configuracao = excluded.configuracao,
  updated_at = now();

notify pgrst, 'reload schema';

commit;
