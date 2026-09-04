-- OminiSaber | Schema completo para instalação limpa no Supabase
-- Gerado por backend/scripts/build-complete-schema.js.
-- Não edite este arquivo diretamente; altere os schemas de origem e gere novamente.
-- A instalação inteira é atômica: qualquer erro desfaz todas as etapas.

begin;

-- ============================================================================
-- ETAPA 1/23: schema/core.sql
-- ============================================================================

-- OminiSaber | Schema Supabase
-- Execute este arquivo no SQL Editor do Supabase.
-- A autenticação continua sendo administrada pelo auth.users nativo.

create extension if not exists pgcrypto;

-- ============================================================
-- 1. ENUMS, TURMAS E PERFIS
-- ============================================================

do $$ begin
  create type public.perfil_role as enum ('aluno', 'professor', 'gestor', 'bibliotecaria');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.tipo_professor as enum (
    'matematica', 'portugues', 'tecnico_administracao', 'tecnico_informatica'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.curso_tecnico as enum ('administracao', 'informatica');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.materia_aluno as enum (
    'matematica', 'fisica', 'portugues', 'redacao',
    'tecnico_administracao', 'tecnico_informatica'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.tipo_trilha as enum ('obrigatoria', 'aprendizagem');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.status_atividade as enum ('rascunho', 'publicada', 'encerrada');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.status_redacao as enum ('rascunho', 'enviada', 'corrigida');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.status_emprestimo as enum (
    'pendente', 'aguardando_retirada', 'ativo', 'devolvido', 'atrasado'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.turmas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ano_letivo smallint not null check (ano_letivo between 2000 and 2100),
  serie text,
  created_at timestamptz not null default now()
);

create index if not exists idx_turmas_ano_letivo on public.turmas (ano_letivo);

create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  matricula text unique,
  role public.perfil_role not null default 'aluno',
  curso_tecnico public.curso_tecnico,
  turma_id uuid references public.turmas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_perfis_turma_id on public.perfis (turma_id);
create index if not exists idx_perfis_role on public.perfis (role);
create index if not exists idx_perfis_curso_tecnico on public.perfis (curso_tecnico) where curso_tecnico is not null;

alter table public.perfis
  add column if not exists tipo_professor public.tipo_professor;

alter table public.perfis
  add column if not exists curso_tecnico public.curso_tecnico;

update public.perfis
set tipo_professor = 'portugues'
where role = 'professor' and tipo_professor is null;

do $$ begin
  alter table public.perfis add constraint perfis_tipo_professor_check check (
    (role = 'professor' and tipo_professor is not null)
    or (role <> 'professor' and tipo_professor is null)
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.perfis add constraint perfis_curso_tecnico_check check (
    (role = 'aluno' and curso_tecnico is not null)
    or (role <> 'aluno' and curso_tecnico is null)
  ) not valid;
exception when duplicate_object then null;
end $$;

create index if not exists idx_perfis_tipo_professor on public.perfis (tipo_professor);

create table if not exists public.professor_turmas (
  professor_id uuid not null references public.perfis(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  materia text,
  created_at timestamptz not null default now(),
  primary key (professor_id, turma_id)
);

create index if not exists idx_professor_turmas_turma on public.professor_turmas (turma_id);

-- Permite que a tela de login aceite matrícula sem expor auth.users ao cliente.
create or replace function public.email_por_matricula(matricula_input text)
returns text
language sql
stable
security definer set search_path = ''
as $$
  select u.email
  from auth.users u
  join public.perfis p on p.id = u.id
  where p.matricula = nullif(pg_catalog.btrim(matricula_input), '')
  limit 1;
$$;

revoke all on function public.email_por_matricula(text) from public;
grant execute on function public.email_por_matricula(text) to anon, authenticated;

-- Cria automaticamente o perfil básico quando um usuário é cadastrado no Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, matricula, role, curso_tecnico)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email, 'Novo usuário'),
    new.raw_user_meta_data ->> 'matricula',
    'aluno',
    case new.raw_user_meta_data ->> 'curso_tecnico'
      when 'administracao' then 'administracao'::public.curso_tecnico
      when 'informatica' then 'informatica'::public.curso_tecnico
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- 2. TABELAS DO PEDAGÓGICO
-- ============================================================

create table if not exists public.trilhas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  materia text not null,
  materia_codigo public.materia_aluno not null,
  descritor_sedu text,
  tipo public.tipo_trilha not null default 'aprendizagem',
  interacao_tipo text not null default 'lista',
  interacao_config jsonb not null default '{}'::jsonb,
  prazo timestamptz,
  professor_id uuid references public.perfis(id) on delete set null,
  turma_id uuid references public.turmas(id) on delete set null,
  publicada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tipo = 'aprendizagem' or prazo is not null)
);

alter table public.trilhas
  add column if not exists interacao_tipo text not null default 'lista';

alter table public.trilhas
  add column if not exists interacao_config jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.trilhas
    add constraint trilhas_interacao_tipo_check check (interacao_tipo in (
      'lista', 'leitura', 'escrita', 'flashcards', 'calculadora', 'formulas',
      'simulacao', 'tabela_periodica', 'diagrama', 'timeline', 'mapa_mental',
      'dialogo', 'movimento'
    ));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.trilhas
    add constraint trilhas_interacao_config_check check (jsonb_typeof(interacao_config) = 'object');
exception when duplicate_object then null;
end $$;

create index if not exists idx_trilhas_materia on public.trilhas (materia);
create index if not exists idx_trilhas_materia_codigo on public.trilhas (materia_codigo, publicada, turma_id);
create index if not exists idx_trilhas_interacao_tipo on public.trilhas (interacao_tipo);
create index if not exists idx_trilhas_descritor on public.trilhas (descritor_sedu);
create index if not exists idx_trilhas_turma on public.trilhas (turma_id);
create index if not exists idx_trilhas_professor on public.trilhas (professor_id) where professor_id is not null;
create index if not exists idx_trilhas_tipo_prazo on public.trilhas (tipo, prazo);

create table if not exists public.atividades (
  id uuid primary key default gen_random_uuid(),
  trilha_id uuid not null references public.trilhas(id) on delete cascade,
  titulo text not null,
  descricao text,
  ordem integer not null default 1 check (ordem > 0),
  status public.status_atividade not null default 'rascunho',
  pontuacao numeric(6,2) check (pontuacao >= 0),
  created_at timestamptz not null default now(),
  unique (trilha_id, ordem)
);

create index if not exists idx_atividades_trilha on public.atividades (trilha_id, ordem);

create table if not exists public.progresso_atividades (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  concluida boolean not null default false,
  nota numeric(6,2) check (nota >= 0),
  concluida_em timestamptz,
  updated_at timestamptz not null default now(),
  unique (atividade_id, aluno_id)
);

create index if not exists idx_progresso_aluno on public.progresso_atividades (aluno_id);

create table if not exists public.progresso_experiencias (
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  materia_codigo public.materia_aluno not null,
  experiencia_codigo text not null check (experiencia_codigo ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  concluida boolean not null default false,
  concluida_em timestamptz,
  updated_at timestamptz not null default now(),
  primary key (aluno_id, materia_codigo, experiencia_codigo)
);

create index if not exists idx_progresso_experiencias_aluno
  on public.progresso_experiencias (aluno_id, materia_codigo, concluida);

create table if not exists public.notas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  atividade_id uuid references public.atividades(id) on delete set null,
  materia text not null,
  materia_codigo public.materia_aluno,
  valor numeric(5,2) not null check (valor between 0 and 10),
  bimestre smallint check (bimestre between 1 and 4),
  professor_id uuid references public.perfis(id) on delete set null,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_notas_aluno on public.notas (aluno_id);
create index if not exists idx_notas_professor on public.notas (professor_id);
create index if not exists idx_notas_materia_codigo on public.notas (aluno_id, materia_codigo, created_at desc);
create index if not exists idx_notas_atividade on public.notas (atividade_id) where atividade_id is not null;

create table if not exists public.propostas_redacao (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria text not null default 'Sociedade',
  comando text not null,
  textos_motivadores jsonb not null default '[]'::jsonb,
  rubrica text not null default 'Matriz ENEM · 5 competências',
  professor_id uuid not null references public.perfis(id) on delete cascade,
  turma_id uuid references public.turmas(id) on delete set null,
  prazo timestamptz,
  publicada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(textos_motivadores) = 'array')
);

create index if not exists idx_propostas_redacao_professor on public.propostas_redacao (professor_id);
create index if not exists idx_propostas_redacao_turma on public.propostas_redacao (turma_id, publicada, prazo);

create table if not exists public.redacoes (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  trilha_id uuid references public.trilhas(id) on delete set null,
  titulo text not null,
  texto text not null default '',
  nota numeric(5,2) check (nota between 0 and 1000),
  status public.status_redacao not null default 'rascunho',
  alerta_ia boolean not null default false,
  feedback text,
  corrigida_por uuid references public.perfis(id) on delete set null,
  enviada_em timestamptz,
  corrigida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.redacoes
  add column if not exists proposta_id uuid references public.propostas_redacao(id) on delete set null;

create index if not exists idx_redacoes_aluno on public.redacoes (aluno_id);
create index if not exists idx_redacoes_status on public.redacoes (status);
create index if not exists idx_redacoes_trilha on public.redacoes (trilha_id) where trilha_id is not null;
create index if not exists idx_redacoes_proposta on public.redacoes (proposta_id) where proposta_id is not null;
create index if not exists idx_redacoes_corrigida_por on public.redacoes (corrigida_por) where corrigida_por is not null;
create index if not exists idx_redacoes_alerta_ia on public.redacoes (alerta_ia) where alerta_ia = true;

-- ============================================================
-- 3. TABELAS DA BIBLIOTECA E ÍNDICE ÚNICO
-- ============================================================

create table if not exists public.livros (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  autor text not null,
  quantidade_total integer not null default 0 check (quantidade_total >= 0),
  quantidade_disponivel integer not null default 0 check (
    quantidade_disponivel >= 0 and quantidade_disponivel <= quantidade_total
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_livros_titulo on public.livros using gin (to_tsvector('portuguese', titulo || ' ' || autor));

create table if not exists public.emprestimos (
  id uuid primary key default gen_random_uuid(),
  livro_id uuid not null references public.livros(id) on delete restrict,
  aluno_id uuid not null references public.perfis(id) on delete restrict,
  status public.status_emprestimo not null default 'pendente',
  solicitado_em timestamptz not null default now(),
  retirada_em timestamptz,
  devolucao_prevista_em timestamptz,
  devolvido_em timestamptz,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (devolvido_em is null or devolvido_em >= solicitado_em)
);

create index if not exists idx_emprestimos_livro on public.emprestimos (livro_id);
create index if not exists idx_emprestimos_aluno on public.emprestimos (aluno_id);
create index if not exists idx_emprestimos_status on public.emprestimos (status);

-- Regra de ouro: cada aluno possui no máximo um empréstimo em aberto.
create unique index if not exists uq_emprestimos_um_aberto_por_aluno
on public.emprestimos (aluno_id)
where status in ('pendente', 'aguardando_retirada', 'ativo', 'atrasado');

-- ============================================================
-- 4. POLÍTICAS RLS
-- ============================================================

create or replace function public.usuario_role()
returns public.perfil_role
language sql
stable
security definer set search_path = ''
as $$
  select role from public.perfis where id = (select auth.uid());
$$;

create or replace function public.usuario_turma_id()
returns uuid
language sql
stable
security definer set search_path = ''
as $$
  select turma_id from public.perfis where id = (select auth.uid());
$$;

create or replace function public.usuario_tipo_professor()
returns public.tipo_professor
language sql
stable
security definer set search_path = ''
as $$
  select tipo_professor from public.perfis where id = (select auth.uid());
$$;

create or replace function public.professor_pode_gerenciar_materia(materia_input text)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select case public.usuario_tipo_professor()
    when 'matematica' then lower(materia_input) like any (array['%matem%', '%geometr%', '%estatíst%', '%estatist%'])
    when 'portugues' then lower(materia_input) like any (array['%portugu%', '%literat%', '%redaç%', '%redac%', '%linguag%'])
    when 'tecnico_administracao' then lower(materia_input) like any (array['%admin%', '%gest%', '%empreend%', '%marketing%', '%finan%'])
    when 'tecnico_informatica' then lower(materia_input) like any (array['%inform%', '%program%', '%tecnolog%', '%banco de dados%', '%redes%'])
    else false
  end;
$$;

create or replace function public.eh_gestor_ou_professor()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select public.usuario_role() in ('gestor', 'professor');
$$;

create or replace function public.aluno_pode_acessar_materia(materia_input public.materia_aluno)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis p
    where p.id = (select auth.uid())
      and p.role = 'aluno'
      and (
        materia_input in ('matematica', 'fisica', 'portugues', 'redacao')
        or (materia_input = 'tecnico_administracao' and p.curso_tecnico = 'administracao')
        or (materia_input = 'tecnico_informatica' and p.curso_tecnico = 'informatica')
      )
  );
$$;

-- RLS habilitado em todas as tabelas de domínio.
alter table public.turmas enable row level security;
alter table public.perfis enable row level security;
alter table public.professor_turmas enable row level security;
alter table public.trilhas enable row level security;
alter table public.atividades enable row level security;
alter table public.progresso_atividades enable row level security;
alter table public.progresso_experiencias enable row level security;
alter table public.notas enable row level security;
alter table public.propostas_redacao enable row level security;
alter table public.redacoes enable row level security;
alter table public.livros enable row level security;
alter table public.emprestimos enable row level security;

-- Perfis: o próprio usuário vê seu perfil; equipe pedagógica vê perfis da turma;
-- gestores têm visão global.
drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis for select to authenticated
using (
  id = auth.uid()
  or public.usuario_role() = 'gestor'
  or (public.usuario_role() = 'professor' and exists (
    select 1 from public.professor_turmas pt
    where pt.professor_id = auth.uid() and pt.turma_id = perfis.turma_id
  ))
);

drop policy if exists perfis_update_proprio on public.perfis;
drop policy if exists perfis_update_gestor on public.perfis;
create policy perfis_update_proprio on public.perfis for update to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = public.usuario_role()
  and turma_id is not distinct from public.usuario_turma_id()
);
create policy perfis_update_gestor on public.perfis for update to authenticated
using (public.usuario_role() = 'gestor')
with check (public.usuario_role() = 'gestor');

-- Turmas e trilhas.
drop policy if exists professor_turmas_select on public.professor_turmas;
create policy professor_turmas_select on public.professor_turmas for select to authenticated
using (professor_id = auth.uid() or public.usuario_role() = 'gestor');

drop policy if exists professor_turmas_manage on public.professor_turmas;
create policy professor_turmas_manage on public.professor_turmas for all to authenticated
using (public.usuario_role() = 'gestor')
with check (public.usuario_role() = 'gestor');

drop policy if exists turmas_select on public.turmas;
create policy turmas_select on public.turmas for select to authenticated
using (
  public.usuario_role() in ('gestor', 'bibliotecaria')
  or id = public.usuario_turma_id()
  or exists (select 1 from public.professor_turmas pt where pt.professor_id = auth.uid() and pt.turma_id = id)
);

drop policy if exists turmas_manage on public.turmas;
create policy turmas_manage on public.turmas for all to authenticated
using (public.usuario_role() = 'gestor')
with check (public.usuario_role() = 'gestor');

drop policy if exists trilhas_select on public.trilhas;
create policy trilhas_select on public.trilhas for select to authenticated
using (
  public.usuario_role() = 'gestor'
  or professor_id = auth.uid()
  or (public.usuario_role() = 'professor' and exists (
    select 1 from public.professor_turmas pt
    where pt.professor_id = auth.uid() and pt.turma_id = trilhas.turma_id
  ))
  or (
    publicada = true
    and (turma_id is null or turma_id = public.usuario_turma_id())
    and public.aluno_pode_acessar_materia(materia_codigo)
  )
);

drop policy if exists trilhas_manage on public.trilhas;
create policy trilhas_manage on public.trilhas for all to authenticated
using (
  public.usuario_role() = 'gestor'
  or (professor_id = auth.uid() and public.professor_pode_gerenciar_materia(materia))
)
with check (
  public.usuario_role() = 'gestor'
  or (professor_id = auth.uid() and public.professor_pode_gerenciar_materia(materia))
);

drop policy if exists atividades_select on public.atividades;
create policy atividades_select on public.atividades for select to authenticated
using (
  exists (
    select 1 from public.trilhas t
    where t.id = trilha_id
      and (
        t.publicada = true
        or public.usuario_role() = 'gestor'
        or t.professor_id = auth.uid()
        or (public.usuario_role() = 'professor' and t.turma_id = public.usuario_turma_id())
      )
  )
);

drop policy if exists atividades_manage on public.atividades;
create policy atividades_manage on public.atividades for all to authenticated
using (
  public.usuario_role() = 'gestor'
  or exists (select 1 from public.trilhas t where t.id = trilha_id and t.professor_id = auth.uid())
)
with check (
  public.usuario_role() = 'gestor'
  or exists (select 1 from public.trilhas t where t.id = trilha_id and t.professor_id = auth.uid())
);

-- Notas: alunos só consultam as próprias notas; professores consultam a turma;
-- gestores consultam tudo. Inserção/edição fica com professor ou gestor.
drop policy if exists notas_select on public.notas;
create policy notas_select on public.notas for select to authenticated
using (
  aluno_id = auth.uid()
  or public.usuario_role() = 'gestor'
  or (public.usuario_role() = 'professor' and exists (
    select 1 from public.perfis p
    join public.professor_turmas pt on pt.turma_id = p.turma_id
    where p.id = aluno_id and pt.professor_id = auth.uid()
  ))
);

drop policy if exists notas_manage on public.notas;
create policy notas_manage on public.notas for all to authenticated
using (
  public.usuario_role() = 'gestor'
  or (professor_id = auth.uid() and public.professor_pode_gerenciar_materia(materia))
)
with check (
  public.usuario_role() = 'gestor'
  or (public.usuario_role() = 'professor' and professor_id = auth.uid() and public.professor_pode_gerenciar_materia(materia))
);

-- Redações: alunos só veem as próprias; professores veem alunos da turma;
-- gestor tem visão global e bibliotecária não acessa dados pedagógicos.
drop policy if exists propostas_redacao_select on public.propostas_redacao;
create policy propostas_redacao_select on public.propostas_redacao for select to authenticated
using (
  public.usuario_role() = 'gestor'
  or (professor_id = auth.uid() and public.usuario_tipo_professor() = 'portugues')
  or (publicada = true and (turma_id is null or turma_id = public.usuario_turma_id()))
);

drop policy if exists propostas_redacao_manage on public.propostas_redacao;
create policy propostas_redacao_manage on public.propostas_redacao for all to authenticated
using (public.usuario_role() = 'gestor' or (professor_id = auth.uid() and public.usuario_tipo_professor() = 'portugues'))
with check (
  public.usuario_role() = 'gestor'
  or (public.usuario_role() = 'professor' and public.usuario_tipo_professor() = 'portugues' and professor_id = auth.uid() and (
    turma_id is null or exists (
      select 1 from public.professor_turmas pt
      where pt.professor_id = auth.uid() and pt.turma_id = propostas_redacao.turma_id
    )
  ))
);

drop policy if exists redacoes_select on public.redacoes;
create policy redacoes_select on public.redacoes for select to authenticated
using (
  aluno_id = auth.uid()
  or public.usuario_role() = 'gestor'
  or (public.usuario_role() = 'professor' and public.usuario_tipo_professor() = 'portugues' and exists (
    select 1 from public.perfis p
    join public.professor_turmas pt on pt.turma_id = p.turma_id
    where p.id = aluno_id and pt.professor_id = auth.uid()
  ))
);

drop policy if exists redacoes_insert_proprias on public.redacoes;
create policy redacoes_insert_proprias on public.redacoes for insert to authenticated
with check (aluno_id = auth.uid());

drop policy if exists redacoes_update on public.redacoes;
create policy redacoes_update on public.redacoes for update to authenticated
using (
  aluno_id = auth.uid()
  or public.usuario_role() = 'gestor'
  or (public.usuario_role() = 'professor' and public.usuario_tipo_professor() = 'portugues' and exists (
    select 1 from public.perfis p
    join public.professor_turmas pt on pt.turma_id = p.turma_id
    where p.id = aluno_id and pt.professor_id = auth.uid()
  ))
)
with check (
  aluno_id = auth.uid()
  or public.usuario_role() = 'gestor'
  or (public.usuario_role() = 'professor' and public.usuario_tipo_professor() = 'portugues' and exists (
    select 1
    from public.perfis p
    join public.professor_turmas pt on pt.turma_id = p.turma_id
    where p.id = aluno_id and pt.professor_id = auth.uid()
  ))
);

-- Progresso: aluno administra apenas seu próprio progresso; equipe pedagógica
-- acompanha a turma e gestores têm visão global.
drop policy if exists progresso_select on public.progresso_atividades;
create policy progresso_select on public.progresso_atividades for select to authenticated
using (
  aluno_id = auth.uid()
  or public.usuario_role() = 'gestor'
  or (public.usuario_role() = 'professor' and exists (
    select 1 from public.perfis p
    join public.professor_turmas pt on pt.turma_id = p.turma_id
    where p.id = aluno_id and pt.professor_id = auth.uid()
  ))
);

drop policy if exists progresso_aluno_manage on public.progresso_atividades;
drop policy if exists progresso_aluno_insert on public.progresso_atividades;
drop policy if exists progresso_aluno_update on public.progresso_atividades;
create policy progresso_aluno_insert on public.progresso_atividades for insert to authenticated
with check (aluno_id = auth.uid() and nota is null);
create policy progresso_aluno_update on public.progresso_atividades for update to authenticated
using (aluno_id = auth.uid())
with check (aluno_id = auth.uid() and nota is null);

drop policy if exists progresso_experiencias_select on public.progresso_experiencias;
create policy progresso_experiencias_select on public.progresso_experiencias for select to authenticated
using (aluno_id = (select auth.uid()));

drop policy if exists progresso_experiencias_insert on public.progresso_experiencias;
create policy progresso_experiencias_insert on public.progresso_experiencias for insert to authenticated
with check (
  aluno_id = (select auth.uid())
  and (select public.aluno_pode_acessar_materia(materia_codigo))
);

drop policy if exists progresso_experiencias_update on public.progresso_experiencias;
create policy progresso_experiencias_update on public.progresso_experiencias for update to authenticated
using (aluno_id = (select auth.uid()))
with check (
  aluno_id = (select auth.uid())
  and (select public.aluno_pode_acessar_materia(materia_codigo))
);

-- Biblioteca: livros são globais para a bibliotecária e gestores; alunos consultam
-- o acervo publicado. Empréstimos ficam restritos ao aluno e à equipe da biblioteca.
drop policy if exists livros_select on public.livros;
create policy livros_select on public.livros for select to authenticated
using (true);

drop policy if exists livros_manage on public.livros;
create policy livros_manage on public.livros for all to authenticated
using (public.usuario_role() in ('bibliotecaria', 'gestor'))
with check (public.usuario_role() in ('bibliotecaria', 'gestor'));

drop policy if exists emprestimos_select on public.emprestimos;
create policy emprestimos_select on public.emprestimos for select to authenticated
using (
  aluno_id = auth.uid()
  or public.usuario_role() in ('bibliotecaria', 'gestor')
);

drop policy if exists emprestimos_insert on public.emprestimos;
create policy emprestimos_insert on public.emprestimos for insert to authenticated
with check (
  (aluno_id = auth.uid() and public.usuario_role() = 'aluno')
  or public.usuario_role() in ('bibliotecaria', 'gestor')
);

drop policy if exists emprestimos_update on public.emprestimos;
create policy emprestimos_update on public.emprestimos for update to authenticated
using (
  public.usuario_role() in ('bibliotecaria', 'gestor')
  or (aluno_id = auth.uid() and status in ('pendente', 'aguardando_retirada'))
)
with check (
  public.usuario_role() in ('bibliotecaria', 'gestor')
  or (aluno_id = auth.uid() and status in ('pendente', 'aguardando_retirada'))
);

-- Mantém updated_at consistente para as tabelas editáveis.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_turmas_updated_at on public.turmas;
drop trigger if exists set_perfis_updated_at on public.perfis;
drop trigger if exists set_trilhas_updated_at on public.trilhas;
drop trigger if exists set_progresso_updated_at on public.progresso_atividades;
drop trigger if exists set_progresso_experiencias_updated_at on public.progresso_experiencias;
drop trigger if exists set_redacoes_updated_at on public.redacoes;
drop trigger if exists set_propostas_redacao_updated_at on public.propostas_redacao;
drop trigger if exists set_livros_updated_at on public.livros;
drop trigger if exists set_emprestimos_updated_at on public.emprestimos;

-- turmas não possui updated_at; o trigger abaixo só é criado nas tabelas compatíveis.
create trigger set_perfis_updated_at before update on public.perfis for each row execute function public.set_updated_at();
create trigger set_trilhas_updated_at before update on public.trilhas for each row execute function public.set_updated_at();
create trigger set_progresso_updated_at before update on public.progresso_atividades for each row execute function public.set_updated_at();
create trigger set_progresso_experiencias_updated_at before update on public.progresso_experiencias for each row execute function public.set_updated_at();
create trigger set_redacoes_updated_at before update on public.redacoes for each row execute function public.set_updated_at();
create trigger set_propostas_redacao_updated_at before update on public.propostas_redacao for each row execute function public.set_updated_at();
create trigger set_livros_updated_at before update on public.livros for each row execute function public.set_updated_at();
create trigger set_emprestimos_updated_at before update on public.emprestimos for each row execute function public.set_updated_at();

-- Privilégios mínimos para o cliente autenticado usar as tabelas via Supabase.
-- As políticas RLS continuam sendo a barreira de autorização por registro.
grant usage on schema public to authenticated;
grant select on public.turmas, public.perfis, public.professor_turmas,
  public.trilhas, public.atividades, public.progresso_atividades, public.progresso_experiencias, public.notas,
  public.propostas_redacao, public.redacoes, public.livros, public.emprestimos
  to authenticated;
grant insert, update, delete on public.turmas, public.professor_turmas, public.trilhas,
  public.atividades, public.notas, public.propostas_redacao, public.livros
  to authenticated;
grant insert, update on public.perfis, public.progresso_atividades, public.progresso_experiencias,
  public.redacoes, public.emprestimos to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.usuario_role() from public, anon, authenticated;
revoke all on function public.usuario_turma_id() from public, anon, authenticated;
revoke all on function public.usuario_tipo_professor() from public, anon, authenticated;
revoke all on function public.professor_pode_gerenciar_materia(text) from public, anon, authenticated;
revoke all on function public.eh_gestor_ou_professor() from public, anon, authenticated;
revoke all on function public.aluno_pode_acessar_materia(public.materia_aluno) from public, anon, authenticated;
grant execute on function public.usuario_role() to authenticated;
grant execute on function public.usuario_turma_id() to authenticated;
grant execute on function public.usuario_tipo_professor() to authenticated;
grant execute on function public.professor_pode_gerenciar_materia(text) to authenticated;
grant execute on function public.eh_gestor_ou_professor() to authenticated;
grant execute on function public.aluno_pode_acessar_materia(public.materia_aluno) to authenticated;

-- A instalação funcional dos quatro espaços docentes continua em:
-- backend/schema/espacos-docentes.sql
-- O arquivo separado permite atualizar bases existentes sem recriar o schema principal.

-- ============================================================================
-- ETAPA 2/23: migrations/20260831_acesso_materias_aluno.sql
-- ============================================================================

do $$ begin
  create type public.curso_tecnico as enum ('administracao', 'informatica');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.materia_aluno as enum (
    'matematica', 'fisica', 'portugues', 'redacao',
    'tecnico_administracao', 'tecnico_informatica'
  );
exception when duplicate_object then null;
end $$;

alter table public.perfis
  add column if not exists curso_tecnico public.curso_tecnico;

alter table public.trilhas
  add column if not exists materia_codigo public.materia_aluno;

alter table public.notas
  add column if not exists materia_codigo public.materia_aluno;

-- Normaliza somente as matérias mantidas oficialmente pelo produto.
update public.trilhas
set materia_codigo = case
  when lower(materia) like any (array['%redaç%', '%redac%']) then 'redacao'::public.materia_aluno
  when lower(materia) like any (array['%portugu%', '%literat%', '%linguag%']) then 'portugues'::public.materia_aluno
  when lower(materia) like any (array['%físic%', '%fisic%']) then 'fisica'::public.materia_aluno
  when lower(materia) like any (array['%matem%', '%álgebr%', '%algebr%', '%geometr%', '%estatíst%', '%estatist%']) then 'matematica'::public.materia_aluno
  when lower(materia) like any (array['%admin%', '%gest%', '%empreend%', '%marketing%', '%finan%']) then 'tecnico_administracao'::public.materia_aluno
  when lower(materia) like any (array['%inform%', '%program%', '%tecnolog%', '%banco de dados%', '%redes%']) then 'tecnico_informatica'::public.materia_aluno
  else null
end
where materia_codigo is null;

update public.notas
set materia_codigo = case
  when lower(materia) like any (array['%redaç%', '%redac%']) then 'redacao'::public.materia_aluno
  when lower(materia) like any (array['%portugu%', '%literat%', '%linguag%']) then 'portugues'::public.materia_aluno
  when lower(materia) like any (array['%físic%', '%fisic%']) then 'fisica'::public.materia_aluno
  when lower(materia) like any (array['%matem%', '%álgebr%', '%algebr%', '%geometr%', '%estatíst%', '%estatist%']) then 'matematica'::public.materia_aluno
  when lower(materia) like any (array['%admin%', '%gest%', '%empreend%', '%marketing%', '%finan%']) then 'tecnico_administracao'::public.materia_aluno
  when lower(materia) like any (array['%inform%', '%program%', '%tecnolog%', '%banco de dados%', '%redes%']) then 'tecnico_informatica'::public.materia_aluno
  else null
end
where materia_codigo is null;

do $$ begin
  alter table public.perfis add constraint perfis_curso_tecnico_check check (
    (role = 'aluno' and curso_tecnico is not null)
    or (role <> 'aluno' and curso_tecnico is null)
  ) not valid;
exception when duplicate_object then null;
end $$;

create index if not exists idx_perfis_curso_tecnico on public.perfis (curso_tecnico) where curso_tecnico is not null;
create index if not exists idx_trilhas_materia_codigo on public.trilhas (materia_codigo, publicada, turma_id);
create index if not exists idx_notas_materia_codigo on public.notas (aluno_id, materia_codigo, created_at desc);

create table if not exists public.progresso_experiencias (
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  materia_codigo public.materia_aluno not null,
  experiencia_codigo text not null check (experiencia_codigo ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  concluida boolean not null default false,
  concluida_em timestamptz,
  updated_at timestamptz not null default now(),
  primary key (aluno_id, materia_codigo, experiencia_codigo)
);

create index if not exists idx_progresso_experiencias_aluno
  on public.progresso_experiencias (aluno_id, materia_codigo, concluida);

alter table public.progresso_experiencias enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, matricula, role, curso_tecnico)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email, 'Novo usuário'),
    new.raw_user_meta_data ->> 'matricula',
    'aluno',
    case new.raw_user_meta_data ->> 'curso_tecnico'
      when 'administracao' then 'administracao'::public.curso_tecnico
      when 'informatica' then 'informatica'::public.curso_tecnico
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.aluno_pode_acessar_materia(materia_input public.materia_aluno)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis p
    where p.id = (select auth.uid())
      and p.role = 'aluno'
      and (
        materia_input in ('matematica', 'fisica', 'portugues', 'redacao')
        or (materia_input = 'tecnico_administracao' and p.curso_tecnico = 'administracao')
        or (materia_input = 'tecnico_informatica' and p.curso_tecnico = 'informatica')
      )
  );
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.aluno_pode_acessar_materia(public.materia_aluno) from public, anon, authenticated;
grant execute on function public.aluno_pode_acessar_materia(public.materia_aluno) to authenticated;

drop policy if exists progresso_experiencias_select on public.progresso_experiencias;
create policy progresso_experiencias_select on public.progresso_experiencias for select to authenticated
using (aluno_id = (select auth.uid()));

drop policy if exists progresso_experiencias_insert on public.progresso_experiencias;
create policy progresso_experiencias_insert on public.progresso_experiencias for insert to authenticated
with check (
  aluno_id = (select auth.uid())
  and (select public.aluno_pode_acessar_materia(materia_codigo))
);

drop policy if exists progresso_experiencias_update on public.progresso_experiencias;
create policy progresso_experiencias_update on public.progresso_experiencias for update to authenticated
using (aluno_id = (select auth.uid()))
with check (
  aluno_id = (select auth.uid())
  and (select public.aluno_pode_acessar_materia(materia_codigo))
);

grant select, insert, update on public.progresso_experiencias to authenticated;

drop trigger if exists set_progresso_experiencias_updated_at on public.progresso_experiencias;
create trigger set_progresso_experiencias_updated_at
before update on public.progresso_experiencias
for each row execute function public.set_updated_at();

drop policy if exists trilhas_select on public.trilhas;
create policy trilhas_select on public.trilhas for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or professor_id = (select auth.uid())
  or (
    (select public.usuario_role()) = 'professor'
    and turma_id in (
      select pt.turma_id from public.professor_turmas pt
      where pt.professor_id = (select auth.uid())
    )
  )
  or (
    publicada = true
    and (turma_id is null or turma_id = (select public.usuario_turma_id()))
    and (select public.aluno_pode_acessar_materia(materia_codigo))
  )
);

-- ============================================================================
-- ETAPA 3/23: schema/configuracoes.sql
-- ============================================================================

-- Preferencias e dados editaveis do perfil do aluno.
-- Execute depois de backend/schema/core.sql.

alter table public.perfis
  add column if not exists tema_preferido text not null default 'light'
    check (tema_preferido in ('light', 'dark')),
  add column if not exists avatar_url text;

alter table public.perfis enable row level security;

-- Evita que um cliente altere role, matricula ou turma_id pela API.
revoke update on public.perfis from authenticated;
grant update (nome, avatar_url, tema_preferido) on public.perfis to authenticated;

-- Remove políticas antigas que eram redundantes com perfis_select e
-- perfis_update_proprio do schema principal. Políticas permissivas são somadas
-- com OR, portanto duplicá-las enfraquece futuras regras de perfil.
drop policy if exists "Alunos podem consultar o proprio perfil" on public.perfis;
drop policy if exists "Alunos podem atualizar o proprio perfil" on public.perfis;
-- Remove o trigger legado; set_perfis_updated_at já é instalado pelo schema base.
drop trigger if exists perfis_updated_at on public.perfis;
drop function if exists public.atualizar_perfil_updated_at();

-- ============================================================================
-- ETAPA 4/23: schema/biblioteca.sql
-- ============================================================================

-- OminiSaber | Biblioteca digital e leituras do aluno
-- Execute depois de backend/schema/core.sql.

create table if not exists public.livros (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  autor text not null,
  genero varchar(80) not null default 'Didático',
  categoria text not null default 'Didáticos',
  capa_url text,
  pdf_url text,
  sinopse text,
  paginas integer check (paginas is null or paginas > 0),
  palavras_chave text,
  quantidade_total integer not null default 0 check (quantidade_total >= 0),
  quantidade_disponivel integer not null default 0 check (quantidade_disponivel >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'livros' and column_name = 'materia'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'livros' and column_name = 'genero'
  ) then
    alter table public.livros rename column materia to genero;
  end if;
end $$;

alter table public.livros add column if not exists genero varchar(80) default 'Didático';
update public.livros set genero = 'Didático' where genero is null or trim(genero) = '';
alter table public.livros alter column genero set not null;
alter table public.livros alter column genero set default 'Didático';
alter table public.livros add column if not exists categoria text default 'Didáticos';
update public.livros set categoria = 'Didáticos' where categoria is null or btrim(categoria) = '';
alter table public.livros alter column categoria set not null;
alter table public.livros add column if not exists capa_url text;
alter table public.livros add column if not exists pdf_url text;
alter table public.livros add column if not exists sinopse text;
alter table public.livros add column if not exists paginas integer;
alter table public.livros add column if not exists palavras_chave text;
alter table public.livros add column if not exists isbn text;

create table if not exists public.secoes_biblioteca (
  id uuid primary key default gen_random_uuid(),
  nome varchar(100) not null unique,
  materia_associada varchar(80),
  capacidade_maxima integer not null check (capacidade_maxima > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exemplares (
  id uuid primary key default gen_random_uuid(),
  livro_id uuid not null references public.livros(id) on delete cascade,
  numero_serie varchar(40) not null unique,
  isbn_individual varchar(20),
  secao_id uuid references public.secoes_biblioteca(id) on delete set null,
  status text not null default 'disponivel'
    check (status in ('disponivel', 'emprestado', 'manutencao')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_exemplares_livro on public.exemplares (livro_id);
create index if not exists idx_exemplares_secao on public.exemplares (secao_id);
create index if not exists idx_exemplares_status on public.exemplares (status);

alter table public.secoes_biblioteca enable row level security;
alter table public.exemplares enable row level security;

grant select on table public.secoes_biblioteca, public.exemplares to authenticated;
grant insert, update, delete on table public.secoes_biblioteca, public.exemplares to authenticated;

drop policy if exists secoes_biblioteca_staff_select on public.secoes_biblioteca;
create policy secoes_biblioteca_staff_select
  on public.secoes_biblioteca for select to authenticated
  using (public.usuario_role() in ('bibliotecaria', 'gestor'));

drop policy if exists secoes_biblioteca_staff_write on public.secoes_biblioteca;
create policy secoes_biblioteca_staff_write
  on public.secoes_biblioteca for all to authenticated
  using (public.usuario_role() in ('bibliotecaria', 'gestor'))
  with check (public.usuario_role() in ('bibliotecaria', 'gestor'));

drop policy if exists exemplares_staff_select on public.exemplares;
create policy exemplares_staff_select
  on public.exemplares for select to authenticated
  using (public.usuario_role() in ('bibliotecaria', 'gestor'));

drop policy if exists exemplares_staff_write on public.exemplares;
create policy exemplares_staff_write
  on public.exemplares for all to authenticated
  using (public.usuario_role() in ('bibliotecaria', 'gestor'))
  with check (public.usuario_role() in ('bibliotecaria', 'gestor'));

create table if not exists public.leituras_aluno (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  livro_id uuid not null references public.livros(id) on delete cascade,
  status text not null default 'lendo' check (status in ('lendo', 'concluido')),
  progresso_pct integer not null default 0 check (progresso_pct between 0 and 100),
  atualizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (aluno_id, livro_id)
);

create index if not exists idx_livros_genero on public.livros (genero);
create index if not exists idx_livros_categoria on public.livros (categoria);
create index if not exists idx_leituras_aluno on public.leituras_aluno (aluno_id, atualizado_em desc);
create index if not exists idx_leituras_livro on public.leituras_aluno (livro_id);

alter table public.livros enable row level security;
alter table public.leituras_aluno enable row level security;

grant select on table public.livros to anon, authenticated;
grant select, insert, update on table public.leituras_aluno to authenticated;

drop policy if exists livros_public_select on public.livros;
create policy livros_public_select
  on public.livros
  for select
  to anon, authenticated
  using (true);

drop policy if exists leituras_aluno_own_select on public.leituras_aluno;
create policy leituras_aluno_own_select
  on public.leituras_aluno
  for select
  to authenticated
  using (auth.uid() = aluno_id);

drop policy if exists leituras_aluno_own_insert on public.leituras_aluno;
create policy leituras_aluno_own_insert
  on public.leituras_aluno
  for insert
  to authenticated
  with check (auth.uid() = aluno_id);

drop policy if exists leituras_aluno_own_update on public.leituras_aluno;
create policy leituras_aluno_own_update
  on public.leituras_aluno
  for update
  to authenticated
  using (auth.uid() = aluno_id)
  with check (auth.uid() = aluno_id);

revoke insert, update, delete on table public.livros from anon, authenticated;

-- ============================================================
-- Operacao da biblioteca: solicitacoes, regras e transacoes
-- ============================================================
create table if not exists public.configuracoes_biblioteca (
  id boolean primary key default true check (id),
  prazo_dias integer not null default 15 check (prazo_dias in (15, 30)),
  limite_livros integer not null default 1 check (limite_livros between 1 and 10),
  updated_at timestamptz not null default now()
);

insert into public.configuracoes_biblioteca (id) values (true) on conflict (id) do nothing;

create table if not exists public.solicitacoes_emprestimo (
  id uuid primary key default gen_random_uuid(),
  livro_id uuid not null references public.livros(id) on delete restrict,
  exemplar_id uuid references public.exemplares(id) on delete set null,
  aluno_id uuid not null references public.perfis(id) on delete restrict,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'emprestado', 'devolvido', 'recusado')),
  solicitado_em timestamptz not null default now(),
  aprovado_em timestamptz,
  retirada_em timestamptz,
  devolucao_prevista_em timestamptz,
  devolvido_em timestamptz,
  aprovado_por uuid references public.perfis(id) on delete set null,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (devolvido_em is null or devolvido_em >= retirada_em)
);

alter table public.solicitacoes_emprestimo
  add column if not exists exemplar_id uuid references public.exemplares(id) on delete set null;

create index if not exists idx_solicitacoes_status on public.solicitacoes_emprestimo(status);
create index if not exists idx_solicitacoes_aluno on public.solicitacoes_emprestimo(aluno_id);
create index if not exists idx_solicitacoes_livro on public.solicitacoes_emprestimo(livro_id);
create index if not exists idx_solicitacoes_exemplar on public.solicitacoes_emprestimo(exemplar_id);
create index if not exists idx_solicitacoes_aprovado_por on public.solicitacoes_emprestimo(aprovado_por) where aprovado_por is not null;

drop trigger if exists solicitacoes_updated_at on public.solicitacoes_emprestimo;
create trigger solicitacoes_updated_at before update on public.solicitacoes_emprestimo
for each row execute function public.set_updated_at();
drop trigger if exists configuracoes_biblioteca_updated_at on public.configuracoes_biblioteca;
create trigger configuracoes_biblioteca_updated_at before update on public.configuracoes_biblioteca
for each row execute function public.set_updated_at();
drop function if exists public.atualizar_biblioteca_updated_at();

create or replace function public.biblioteca_pode_solicitar(p_aluno_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare limite integer; quantidade integer;
begin
  if p_aluno_id <> (select auth.uid()) and public.usuario_role() not in ('bibliotecaria', 'gestor') then
    return false;
  end if;
  select limite_livros into limite from public.configuracoes_biblioteca where id = true;
  select count(*) into quantidade from public.solicitacoes_emprestimo
  where aluno_id = p_aluno_id and status in ('pendente', 'aprovado', 'emprestado');
  return quantidade < coalesce(limite, 1) and not exists (
    select 1 from public.solicitacoes_emprestimo
    where aluno_id = p_aluno_id and status = 'emprestado' and devolucao_prevista_em < now()
  );
end; $$;

create or replace function public.biblioteca_aprovar_solicitacao(p_solicitacao_id uuid, p_aprovado_por uuid)
returns public.solicitacoes_emprestimo language plpgsql security definer set search_path = '' as $$
declare resultado public.solicitacoes_emprestimo;
begin
  if public.usuario_role() not in ('bibliotecaria', 'gestor') then raise exception 'Sem permissao'; end if;
  if p_aprovado_por is distinct from (select auth.uid()) then raise exception 'Responsável inválido'; end if;
  update public.solicitacoes_emprestimo set status = 'aprovado', aprovado_em = now(), aprovado_por = (select auth.uid())
  where id = p_solicitacao_id and status = 'pendente' returning * into resultado;
  if resultado.id is null then raise exception 'Solicitacao indisponivel'; end if;
  return resultado;
end; $$;

create or replace function public.biblioteca_confirmar_entrega(p_solicitacao_id uuid)
returns public.solicitacoes_emprestimo language plpgsql security definer set search_path = '' as $$
declare resultado public.solicitacoes_emprestimo; prazo integer; exemplar uuid;
begin
  if public.usuario_role() not in ('bibliotecaria', 'gestor') then raise exception 'Sem permissao'; end if;
  select prazo_dias into prazo from public.configuracoes_biblioteca where id = true;
  select id into exemplar from public.exemplares
  where livro_id = (select livro_id from public.solicitacoes_emprestimo where id = p_solicitacao_id)
    and status = 'disponivel'
  order by numero_serie
  for update skip locked limit 1;
  if exemplar is null then raise exception 'Livro sem exemplar disponivel'; end if;
  update public.solicitacoes_emprestimo set status = 'emprestado', exemplar_id = exemplar, retirada_em = now(),
    observacao = concat(
      'Retirar na ', coalesce((select s.nome from public.secoes_biblioteca s
        join public.exemplares e on e.secao_id = s.id where e.id = exemplar), 'seção não definida'),
      ' | Exemplar N° ', (select e.numero_serie from public.exemplares e where e.id = exemplar),
      ' | ISBN: ', coalesce((select e.isbn_individual from public.exemplares e where e.id = exemplar), 'não informado')
    ),
    devolucao_prevista_em = now() + make_interval(days => coalesce(prazo, 15))
  where id = p_solicitacao_id and status = 'aprovado' returning * into resultado;
  if resultado.id is null then raise exception 'Solicitacao nao esta aguardando retirada'; end if;
  update public.exemplares set status = 'emprestado' where id = exemplar;
  update public.livros set quantidade_disponivel = quantidade_disponivel - 1
  where id = resultado.livro_id and quantidade_disponivel > 0;
  if not found then raise exception 'Livro sem exemplar disponivel'; end if;
  return resultado;
end; $$;

create or replace function public.biblioteca_registrar_devolucao(p_solicitacao_id uuid)
returns public.solicitacoes_emprestimo language plpgsql security definer set search_path = '' as $$
declare resultado public.solicitacoes_emprestimo;
begin
  if public.usuario_role() not in ('bibliotecaria', 'gestor') then raise exception 'Sem permissao'; end if;
  update public.solicitacoes_emprestimo set status = 'devolvido', devolvido_em = now()
  where id = p_solicitacao_id and status = 'emprestado' returning * into resultado;
  if resultado.id is null then raise exception 'Emprestimo nao esta ativo'; end if;
  if resultado.exemplar_id is not null then
    update public.exemplares set status = 'disponivel' where id = resultado.exemplar_id;
  end if;
  update public.livros set quantidade_disponivel = least(quantidade_total, quantidade_disponivel + 1)
  where id = resultado.livro_id;
  return resultado;
end; $$;

alter table public.solicitacoes_emprestimo enable row level security;
alter table public.configuracoes_biblioteca enable row level security;
grant select, insert, update, delete on table public.livros to authenticated;
grant select, insert on table public.solicitacoes_emprestimo to authenticated;
grant select, update on table public.configuracoes_biblioteca to authenticated;
revoke all on function public.biblioteca_pode_solicitar(uuid) from public, anon, authenticated;
revoke all on function public.biblioteca_aprovar_solicitacao(uuid, uuid) from public, anon, authenticated;
revoke all on function public.biblioteca_confirmar_entrega(uuid) from public, anon, authenticated;
revoke all on function public.biblioteca_registrar_devolucao(uuid) from public, anon, authenticated;
grant execute on function public.biblioteca_pode_solicitar(uuid) to authenticated;
grant execute on function public.biblioteca_aprovar_solicitacao(uuid, uuid) to authenticated;
grant execute on function public.biblioteca_confirmar_entrega(uuid) to authenticated;
grant execute on function public.biblioteca_registrar_devolucao(uuid) to authenticated;

drop policy if exists solicitacoes_select on public.solicitacoes_emprestimo;
create policy solicitacoes_select on public.solicitacoes_emprestimo for select to authenticated
using (aluno_id = auth.uid() or public.usuario_role() in ('bibliotecaria', 'gestor'));
drop policy if exists solicitacoes_insert on public.solicitacoes_emprestimo;
create policy solicitacoes_insert on public.solicitacoes_emprestimo for insert to authenticated
with check (
  aluno_id = (select auth.uid()) and public.usuario_role() = 'aluno'
  and status = 'pendente' and exemplar_id is null and aprovado_por is null
  and aprovado_em is null and retirada_em is null and devolucao_prevista_em is null and devolvido_em is null
  and public.biblioteca_pode_solicitar((select auth.uid()))
);
drop policy if exists configuracoes_biblioteca_select on public.configuracoes_biblioteca;
create policy configuracoes_biblioteca_select on public.configuracoes_biblioteca for select to authenticated using (true);
drop policy if exists configuracoes_biblioteca_update on public.configuracoes_biblioteca;
create policy configuracoes_biblioteca_update on public.configuracoes_biblioteca for update to authenticated
using (public.usuario_role() in ('bibliotecaria', 'gestor')) with check (public.usuario_role() in ('bibliotecaria', 'gestor'));

drop trigger if exists set_secoes_biblioteca_updated_at on public.secoes_biblioteca;
create trigger set_secoes_biblioteca_updated_at before update on public.secoes_biblioteca
for each row execute function public.set_updated_at();
drop trigger if exists set_exemplares_updated_at on public.exemplares;
create trigger set_exemplares_updated_at before update on public.exemplares
for each row execute function public.set_updated_at();

-- ============================================================================
-- ETAPA 5/23: schema/estoque-etapa1.sql
-- ============================================================================

-- OminiSaber | Migracao da Etapa 1: autores, obras e exemplares
-- Execute depois de backend/schema/biblioteca.sql no SQL Editor do Supabase.

create table if not exists public.autores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint autores_nome_nao_vazio check (length(trim(nome)) > 0)
);

create unique index if not exists autores_nome_normalizado_idx
  on public.autores (lower(regexp_replace(trim(nome), '\s+', ' ', 'g')));

alter table public.livros add column if not exists autor_id uuid references public.autores(id) on delete restrict;
alter table public.livros add column if not exists isbn text;
alter table public.livros add column if not exists prefixo_serie varchar(4);
alter table public.exemplares add column if not exists isbn text;
create index if not exists livros_autor_id_idx on public.livros (autor_id) where autor_id is not null;

update public.exemplares
set isbn = isbn_individual
where isbn is null and isbn_individual is not null;

-- Converte o formato anterior 9842-001 para o novo formato 98420001.
update public.exemplares
set numero_serie = left(numero_serie, 4) || lpad(right(numero_serie, 3), 4, '0')
where numero_serie ~ '^[0-9]{4}-[0-9]{3}$';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'exemplares_numero_serie_oito_digitos'
      and conrelid = 'public.exemplares'::regclass
  ) then
    alter table public.exemplares add constraint exemplares_numero_serie_oito_digitos
      check (numero_serie ~ '^[0-9]{8}$');
  end if;
end $$;

alter table public.autores enable row level security;
grant select on public.autores to authenticated;
grant insert on public.autores to authenticated;

drop policy if exists autores_staff_select on public.autores;
create policy autores_staff_select on public.autores
  for select to authenticated
  using (public.usuario_role() in ('bibliotecaria', 'gestor'));

drop policy if exists autores_staff_insert on public.autores;
create policy autores_staff_insert on public.autores
  for insert to authenticated
  with check (public.usuario_role() in ('bibliotecaria', 'gestor'));

-- Uma unica transacao cria a obra e todas as copias. p_isbns e indexado por copia.
create or replace function public.biblioteca_cadastrar_lote_livros(
  p_titulo text,
  p_autor_id uuid,
  p_genero text,
  p_isbn text default null,
  p_prefixo text default '9842',
  p_isbns text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_livro public.livros;
  v_autor public.autores;
  v_prefixo text := left(lpad(regexp_replace(coalesce(p_prefixo, ''), '[^0-9]', '', 'g'), 4, '0'), 4);
  v_quantidade integer := greatest(coalesce(array_length(p_isbns, 1), 0), 1);
begin
  if public.usuario_role() not in ('bibliotecaria', 'gestor') then
    raise exception 'Sem permissao';
  end if;
  if length(trim(coalesce(p_titulo, ''))) = 0 then raise exception 'Titulo obrigatorio'; end if;
  if length(trim(coalesce(p_genero, ''))) = 0 then raise exception 'Genero obrigatorio'; end if;
  if length(v_prefixo) <> 4 or v_prefixo !~ '^[0-9]{4}$' then raise exception 'Prefixo deve ter 4 digitos'; end if;
  if v_quantidade > 9999 then raise exception 'O lote aceita no máximo 9999 exemplares'; end if;
  select * into v_autor from public.autores where id = p_autor_id;
  if v_autor.id is null then raise exception 'Autor nao encontrado'; end if;
  if exists (select 1 from public.exemplares where left(numero_serie, 4) = v_prefixo) then
    raise exception 'O prefixo informado ja possui uma serie cadastrada';
  end if;

  insert into public.livros (titulo, autor, autor_id, genero, isbn, prefixo_serie, quantidade_total, quantidade_disponivel)
  values (trim(p_titulo), v_autor.nome, v_autor.id, trim(p_genero), nullif(regexp_replace(coalesce(p_isbn, ''), '[^0-9]', '', 'g'), ''), v_prefixo, v_quantidade, v_quantidade)
  returning * into v_livro;

  insert into public.exemplares (livro_id, numero_serie, isbn, isbn_individual, status)
  select v_livro.id,
    v_prefixo || lpad(series.numero::text, 4, '0'),
    nullif(regexp_replace(coalesce(p_isbns[series.numero], p_isbn, ''), '[^0-9]', '', 'g'), ''),
    nullif(regexp_replace(coalesce(p_isbns[series.numero], p_isbn, ''), '[^0-9]', '', 'g'), ''),
    'disponivel'
  from generate_series(1, v_quantidade) as series(numero);

  return jsonb_build_object('livro_id', v_livro.id, 'quantidade', v_quantidade, 'prefixo', v_prefixo);
end;
$$;

revoke all on function public.biblioteca_cadastrar_lote_livros(text, uuid, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.biblioteca_cadastrar_lote_livros(text, uuid, text, text, text, text[]) to authenticated;

drop trigger if exists set_autores_updated_at on public.autores;
create trigger set_autores_updated_at before update on public.autores
for each row execute function public.set_updated_at();

-- ============================================================================
-- ETAPA 6/23: schema/estoque-etapa2.sql
-- ============================================================================

-- OminiSaber | Migracao da Etapa 2: secoes fisicas e alocacao
-- Execute depois de backend/schema/biblioteca.sql e backend/schema/estoque-etapa1.sql.

create table if not exists public.secoes_fisicas (
  id uuid primary key default gen_random_uuid(),
  nome varchar(100) not null,
  genero_associado varchar(80) not null,
  capacidade_maxima integer not null check (capacidade_maxima > 0),
  ocupacao_atual integer not null default 0 check (ocupacao_atual >= 0 and ocupacao_atual <= capacidade_maxima),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint secoes_fisicas_nome_unico unique (nome)
);

alter table public.exemplares add column if not exists secao_fisica_id uuid references public.secoes_fisicas(id) on delete set null;
create index if not exists idx_exemplares_secao_fisica on public.exemplares (secao_fisica_id);

alter table public.secoes_fisicas enable row level security;
grant select, insert, update on public.secoes_fisicas to authenticated;
grant update on public.exemplares to authenticated;

drop policy if exists secoes_fisicas_staff_select on public.secoes_fisicas;
create policy secoes_fisicas_staff_select on public.secoes_fisicas for select to authenticated
  using (public.usuario_role() in ('bibliotecaria', 'gestor'));
drop policy if exists secoes_fisicas_staff_insert on public.secoes_fisicas;
create policy secoes_fisicas_staff_insert on public.secoes_fisicas for insert to authenticated
  with check (public.usuario_role() in ('bibliotecaria', 'gestor'));
drop policy if exists secoes_fisicas_staff_update on public.secoes_fisicas;
create policy secoes_fisicas_staff_update on public.secoes_fisicas for update to authenticated
  using (public.usuario_role() in ('bibliotecaria', 'gestor'))
  with check (public.usuario_role() in ('bibliotecaria', 'gestor'));

-- Mantém a ocupação consistente mesmo quando um exemplar é realocado, inserido
-- ou excluído por outro fluxo administrativo.
create or replace function public.sincronizar_ocupacao_secoes_fisicas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE')
    and old.secao_fisica_id is not null
    and (tg_op = 'DELETE' or new.secao_fisica_id is distinct from old.secao_fisica_id) then
    update public.secoes_fisicas
    set ocupacao_atual = greatest(ocupacao_atual - 1, 0), updated_at = now()
    where id = old.secao_fisica_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE')
    and new.secao_fisica_id is not null
    and (tg_op = 'INSERT' or new.secao_fisica_id is distinct from old.secao_fisica_id) then
    update public.secoes_fisicas
    set ocupacao_atual = ocupacao_atual + 1, updated_at = now()
    where id = new.secao_fisica_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.sincronizar_ocupacao_secoes_fisicas() from public, anon, authenticated;
drop trigger if exists trg_sincronizar_ocupacao_secoes_fisicas on public.exemplares;
create trigger trg_sincronizar_ocupacao_secoes_fisicas
after insert or delete or update of secao_fisica_id on public.exemplares
for each row execute function public.sincronizar_ocupacao_secoes_fisicas();

-- Aloca em uma transacao; o trigger acima atualiza a ocupação.
create or replace function public.biblioteca_alocar_exemplares(p_secao_fisica_id uuid, p_exemplar_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_secao public.secoes_fisicas;
  v_quantidade integer := coalesce(array_length(p_exemplar_ids, 1), 0);
  v_novos_livros integer;
begin
  if public.usuario_role() not in ('bibliotecaria', 'gestor') then raise exception 'Sem permissao'; end if;
  select * into v_secao from public.secoes_fisicas where id = p_secao_fisica_id for update;
  if v_secao.id is null then raise exception 'Secao fisica nao encontrada'; end if;
  if v_quantidade = 0 then raise exception 'Selecione ao menos um exemplar'; end if;
  if v_quantidade > v_secao.capacidade_maxima - v_secao.ocupacao_atual then raise exception 'Capacidade da secao excedida'; end if;
  select count(*) into v_novos_livros from public.exemplares where id = any(p_exemplar_ids) and secao_fisica_id is null;
  if v_novos_livros <> v_quantidade then raise exception 'Um ou mais exemplares ja foram alocados'; end if;
  update public.exemplares set secao_fisica_id = p_secao_fisica_id where id = any(p_exemplar_ids) and secao_fisica_id is null;
  return jsonb_build_object('secao_id', p_secao_fisica_id, 'quantidade', v_quantidade);
end;
$$;
revoke all on function public.biblioteca_alocar_exemplares(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.biblioteca_alocar_exemplares(uuid, uuid[]) to authenticated;

-- Consulta opcional para conferir a ocupacao real e corrigir dados legados.
update public.secoes_fisicas section
set ocupacao_atual = (select count(*) from public.exemplares copy where copy.secao_fisica_id = section.id);

drop trigger if exists set_secoes_fisicas_updated_at on public.secoes_fisicas;
create trigger set_secoes_fisicas_updated_at before update on public.secoes_fisicas
for each row execute function public.set_updated_at();

-- ============================================================================
-- ETAPA 7/23: schema/conquistas.sql
-- ============================================================================

-- OminiSaber | Catálogo e progresso de conquistas
-- Execute depois de backend/schema/core.sql.

create table if not exists public.conquistas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text not null,
  requisito text not null,
  categoria text not null default 'geral' check (categoria in ('trilhas', 'redacao', 'leitura', 'geral')),
  xp integer not null default 0 check (xp >= 0),
  icone text not null default 'workspace_premium',
  created_at timestamptz not null default now()
);

create table if not exists public.conquistas_aluno (
  id uuid primary key default gen_random_uuid(),
  conquista_id uuid not null references public.conquistas(id) on delete cascade,
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  desbloqueado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (conquista_id, aluno_id)
);

create index if not exists idx_conquistas_categoria
  on public.conquistas (categoria);

create index if not exists idx_conquistas_aluno_aluno
  on public.conquistas_aluno (aluno_id, desbloqueado_em desc);

alter table public.conquistas enable row level security;
alter table public.conquistas_aluno enable row level security;

grant select on table public.conquistas to anon, authenticated;
grant select on table public.conquistas_aluno to authenticated;

drop policy if exists conquistas_public_select on public.conquistas;
create policy conquistas_public_select
  on public.conquistas
  for select
  to anon, authenticated
  using (true);

drop policy if exists conquistas_aluno_own_select on public.conquistas_aluno;
create policy conquistas_aluno_own_select
  on public.conquistas_aluno
  for select
  to authenticated
  using ((select auth.uid()) = aluno_id);

insert into public.conquistas (id, nome, descricao, requisito, categoria, xp, icone)
values
  ('00000000-0000-0000-0000-000000000001', 'Primeira Redação', 'Sua primeira produção foi enviada para avaliação.', 'Envie sua primeira redação.', 'redacao', 150, 'edit_note'),
  ('00000000-0000-0000-0000-000000000002', 'Leitor Assíduo', 'Você concluiu seu primeiro empréstimo na biblioteca.', 'Conclua um empréstimo de livro.', 'leitura', 200, 'menu_book'),
  ('00000000-0000-0000-0000-000000000003', 'Explorador de Trilhas', 'Você iniciou sua jornada de atividades.', 'Conclua sua primeira atividade.', 'trilhas', 100, 'route'),
  ('00000000-0000-0000-0000-000000000004', 'Foco Total', 'Sua consistência trouxe uma média de excelência.', 'Alcance média acima de 8 em uma matéria.', 'geral', 250, 'local_fire_department')
on conflict (id) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  requisito = excluded.requisito,
  categoria = excluded.categoria,
  xp = excluded.xp,
  icone = excluded.icone;

-- Atribuições em conquistas_aluno devem ser feitas por uma função segura
-- ou por um processo administrativo. O aluno só pode consultar as próprias.
revoke insert, update, delete on table public.conquistas from anon, authenticated;
revoke insert, update, delete on table public.conquistas_aluno from anon, authenticated;

-- ============================================================================
-- ETAPA 8/23: schema/espacos-docentes.sql
-- ============================================================================

-- OminiSaber | Espaços funcionais por especialidade docente
-- Migração idempotente para bancos existentes. Não remove tabelas ou dados.

do $$ begin
  create type public.status_conteudo_docente as enum ('rascunho', 'publicado', 'encerrado');
exception when duplicate_object then null;
end $$;

create table if not exists public.laboratorios_docentes (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.perfis(id) on delete cascade,
  turma_id uuid references public.turmas(id) on delete set null,
  tipo_professor public.tipo_professor not null,
  titulo text not null check (char_length(titulo) between 3 and 140),
  descricao text not null default '',
  formato text not null,
  configuracao jsonb not null default '{}'::jsonb check (jsonb_typeof(configuracao) = 'object'),
  status public.status_conteudo_docente not null default 'rascunho',
  prazo timestamptz,
  publicado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.avaliacoes_docentes (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.perfis(id) on delete cascade,
  turma_id uuid references public.turmas(id) on delete set null,
  tipo_professor public.tipo_professor not null,
  titulo text not null check (char_length(titulo) between 3 and 140),
  instrucoes text not null default '',
  duracao_minutos integer check (duracao_minutos between 5 and 300),
  valor numeric(6,2) not null default 10 check (valor > 0),
  configuracao jsonb not null default '{}'::jsonb check (jsonb_typeof(configuracao) = 'object'),
  status public.status_conteudo_docente not null default 'rascunho',
  abre_em timestamptz,
  encerra_em timestamptz,
  publicado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (encerra_em is null or abre_em is null or encerra_em > abre_em)
);

create table if not exists public.questoes_avaliacao (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references public.avaliacoes_docentes(id) on delete cascade,
  ordem integer not null check (ordem > 0),
  tipo text not null check (tipo in ('multipla_escolha','verdadeiro_falso','dissertativa','calculo','codigo','estudo_caso')),
  enunciado text not null check (char_length(enunciado) >= 3),
  alternativas jsonb not null default '[]'::jsonb check (jsonb_typeof(alternativas) = 'array'),
  pontos numeric(6,2) not null default 1 check (pontos > 0),
  created_at timestamptz not null default now(),
  unique (avaliacao_id, ordem)
);

create table if not exists public.gabaritos_avaliacao (
  questao_id uuid primary key references public.questoes_avaliacao(id) on delete cascade,
  resposta_esperada jsonb not null default '{}'::jsonb check (jsonb_typeof(resposta_esperada) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entregas_laboratorio (
  id uuid primary key default gen_random_uuid(),
  laboratorio_id uuid not null references public.laboratorios_docentes(id) on delete cascade,
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  conteudo jsonb not null default '{}'::jsonb check (jsonb_typeof(conteudo) = 'object'),
  status text not null default 'rascunho' check (status in ('rascunho','enviada','avaliada')),
  nota numeric(6,2) check (nota >= 0),
  feedback text,
  enviada_em timestamptz,
  avaliada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (laboratorio_id, aluno_id)
);

create table if not exists public.tentativas_avaliacao (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references public.avaliacoes_docentes(id) on delete cascade,
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  respostas jsonb not null default '{}'::jsonb check (jsonb_typeof(respostas) = 'object'),
  status text not null default 'em_andamento' check (status in ('em_andamento','enviada','corrigida')),
  nota numeric(6,2) check (nota >= 0),
  feedback text,
  iniciada_em timestamptz not null default now(),
  enviada_em timestamptz,
  corrigida_em timestamptz,
  updated_at timestamptz not null default now(),
  unique (avaliacao_id, aluno_id)
);

create index if not exists idx_laboratorios_professor_status on public.laboratorios_docentes (professor_id, status, created_at desc);
create index if not exists idx_laboratorios_turma on public.laboratorios_docentes (turma_id, status);
create index if not exists idx_avaliacoes_professor_status on public.avaliacoes_docentes (professor_id, status, created_at desc);
create index if not exists idx_avaliacoes_turma on public.avaliacoes_docentes (turma_id, status);
create index if not exists idx_questoes_avaliacao on public.questoes_avaliacao (avaliacao_id, ordem);
create index if not exists idx_entregas_laboratorio on public.entregas_laboratorio (laboratorio_id, status);
create index if not exists idx_entregas_aluno_status on public.entregas_laboratorio (aluno_id, status);
create index if not exists idx_tentativas_avaliacao on public.tentativas_avaliacao (avaliacao_id, status);
create index if not exists idx_tentativas_aluno_status on public.tentativas_avaliacao (aluno_id, status);

alter table public.laboratorios_docentes enable row level security;
alter table public.avaliacoes_docentes enable row level security;
alter table public.questoes_avaliacao enable row level security;
alter table public.gabaritos_avaliacao enable row level security;
alter table public.entregas_laboratorio enable row level security;
alter table public.tentativas_avaliacao enable row level security;

drop policy if exists laboratorios_select on public.laboratorios_docentes;
create policy laboratorios_select on public.laboratorios_docentes for select to authenticated using (
  (select public.usuario_role()) = 'gestor' or professor_id = (select auth.uid()) or
  (status = 'publicado' and turma_id = (select public.usuario_turma_id()))
);
drop policy if exists laboratorios_insert on public.laboratorios_docentes;
create policy laboratorios_insert on public.laboratorios_docentes for insert to authenticated with check (
  professor_id = (select auth.uid()) and (select public.usuario_role()) = 'professor' and
  tipo_professor = (select public.usuario_tipo_professor()) and
  status = 'rascunho' and publicado_em is null and
  (turma_id is null or exists (select 1 from public.professor_turmas pt where pt.professor_id = (select auth.uid()) and pt.turma_id = laboratorios_docentes.turma_id))
);
drop policy if exists laboratorios_update on public.laboratorios_docentes;
create policy laboratorios_update on public.laboratorios_docentes for update to authenticated
using ((select public.usuario_role()) = 'gestor' or professor_id = (select auth.uid()))
with check ((select public.usuario_role()) = 'gestor' or (
  professor_id = (select auth.uid()) and tipo_professor = (select public.usuario_tipo_professor()) and
  (turma_id is null or exists (select 1 from public.professor_turmas pt where pt.professor_id = (select auth.uid()) and pt.turma_id = laboratorios_docentes.turma_id))
));
drop policy if exists laboratorios_delete on public.laboratorios_docentes;
create policy laboratorios_delete on public.laboratorios_docentes for delete to authenticated
using ((select public.usuario_role()) = 'gestor' or (professor_id = (select auth.uid()) and status = 'rascunho'));

drop policy if exists avaliacoes_select on public.avaliacoes_docentes;
create policy avaliacoes_select on public.avaliacoes_docentes for select to authenticated using (
  (select public.usuario_role()) = 'gestor' or professor_id = (select auth.uid()) or
  (status = 'publicado' and turma_id = (select public.usuario_turma_id()) and (abre_em is null or abre_em <= now()) and (encerra_em is null or encerra_em >= now()))
);
drop policy if exists avaliacoes_insert on public.avaliacoes_docentes;
create policy avaliacoes_insert on public.avaliacoes_docentes for insert to authenticated with check (
  professor_id = (select auth.uid()) and (select public.usuario_role()) = 'professor' and
  tipo_professor = (select public.usuario_tipo_professor()) and
  status = 'rascunho' and publicado_em is null and
  (turma_id is null or exists (select 1 from public.professor_turmas pt where pt.professor_id = (select auth.uid()) and pt.turma_id = avaliacoes_docentes.turma_id))
);
drop policy if exists avaliacoes_update on public.avaliacoes_docentes;
create policy avaliacoes_update on public.avaliacoes_docentes for update to authenticated
using ((select public.usuario_role()) = 'gestor' or professor_id = (select auth.uid()))
with check ((select public.usuario_role()) = 'gestor' or (
  professor_id = (select auth.uid()) and tipo_professor = (select public.usuario_tipo_professor()) and
  (turma_id is null or exists (select 1 from public.professor_turmas pt where pt.professor_id = (select auth.uid()) and pt.turma_id = avaliacoes_docentes.turma_id))
));
drop policy if exists avaliacoes_delete on public.avaliacoes_docentes;
create policy avaliacoes_delete on public.avaliacoes_docentes for delete to authenticated
using ((select public.usuario_role()) = 'gestor' or (professor_id = (select auth.uid()) and status = 'rascunho'));

drop policy if exists questoes_select on public.questoes_avaliacao;
create policy questoes_select on public.questoes_avaliacao for select to authenticated using (
  exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id)
);
drop policy if exists questoes_manage on public.questoes_avaliacao;
create policy questoes_manage on public.questoes_avaliacao for all to authenticated
using ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho'))
with check ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho'));

drop policy if exists gabaritos_select on public.gabaritos_avaliacao;
create policy gabaritos_select on public.gabaritos_avaliacao for select to authenticated using (
  (select public.usuario_role()) = 'gestor' or exists (
    select 1 from public.questoes_avaliacao q join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where q.id = questao_id and a.professor_id = (select auth.uid())
  )
);
drop policy if exists gabaritos_manage on public.gabaritos_avaliacao;
create policy gabaritos_manage on public.gabaritos_avaliacao for all to authenticated
using ((select public.usuario_role()) = 'gestor' or exists (
  select 1 from public.questoes_avaliacao q join public.avaliacoes_docentes a on a.id = q.avaliacao_id
  where q.id = questao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho'
))
with check ((select public.usuario_role()) = 'gestor' or exists (
  select 1 from public.questoes_avaliacao q join public.avaliacoes_docentes a on a.id = q.avaliacao_id
  where q.id = questao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho'
));

drop policy if exists entregas_select on public.entregas_laboratorio;
create policy entregas_select on public.entregas_laboratorio for select to authenticated using (
  aluno_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor' or
  exists (select 1 from public.laboratorios_docentes l where l.id = laboratorio_id and l.professor_id = (select auth.uid()))
);
drop policy if exists entregas_insert on public.entregas_laboratorio;
create policy entregas_insert on public.entregas_laboratorio for insert to authenticated with check (
  aluno_id = (select auth.uid()) and status = 'rascunho'
  and nota is null and feedback is null and enviada_em is null and avaliada_em is null
  and exists (
    select 1 from public.laboratorios_docentes l where l.id = laboratorio_id and l.status = 'publicado' and l.turma_id = (select public.usuario_turma_id())
  )
);
drop policy if exists entregas_update on public.entregas_laboratorio;
create policy entregas_update on public.entregas_laboratorio for update to authenticated
using (aluno_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor' or exists (select 1 from public.laboratorios_docentes l where l.id = laboratorio_id and l.professor_id = (select auth.uid())))
with check (aluno_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor' or exists (select 1 from public.laboratorios_docentes l where l.id = laboratorio_id and l.professor_id = (select auth.uid())));

drop policy if exists tentativas_select on public.tentativas_avaliacao;
create policy tentativas_select on public.tentativas_avaliacao for select to authenticated using (
  aluno_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor' or
  exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()))
);
drop policy if exists tentativas_insert on public.tentativas_avaliacao;
create policy tentativas_insert on public.tentativas_avaliacao for insert to authenticated with check (
  aluno_id = (select auth.uid()) and status = 'em_andamento'
  and nota is null and feedback is null and enviada_em is null and corrigida_em is null
  and exists (
    select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.status = 'publicado' and a.turma_id = (select public.usuario_turma_id())
  )
);
drop policy if exists tentativas_update on public.tentativas_avaliacao;
create policy tentativas_update on public.tentativas_avaliacao for update to authenticated
using (aluno_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor' or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid())))
with check (aluno_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor' or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid())));

-- Conteúdo publicado vira um registro pedagógico estável: o professor pode encerrá-lo,
-- mas precisa duplicar/criar um novo rascunho para alterar enunciados ou configuração.
create or replace function public.validar_ciclo_laboratorio_docente()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id or new.created_at is distinct from old.created_at then
    raise exception 'A identidade e a data de criação do laboratório são imutáveis.';
  end if;
  if (select public.usuario_role()) = 'professor' then
    if new.professor_id <> old.professor_id or new.tipo_professor <> old.tipo_professor then
      raise exception 'A autoria e a especialidade do laboratório são imutáveis.';
    end if;
    if old.status <> 'rascunho' and (
      old.status <> 'publicado' or new.status <> 'encerrado'
      or new.turma_id is distinct from old.turma_id
      or new.titulo is distinct from old.titulo
      or new.descricao is distinct from old.descricao
      or new.formato is distinct from old.formato
      or new.configuracao is distinct from old.configuracao
      or new.prazo is distinct from old.prazo
      or new.publicado_em is distinct from old.publicado_em
    ) then
      raise exception 'Um laboratório publicado só pode ser encerrado.';
    end if;
    if old.status = 'rascunho' and new.status = 'publicado' then
      new.publicado_em := coalesce(new.publicado_em, now());
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.validar_ciclo_avaliacao_docente()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id or new.created_at is distinct from old.created_at then
    raise exception 'A identidade e a data de criação da avaliação são imutáveis.';
  end if;
  if (select public.usuario_role()) = 'professor' then
    if new.professor_id <> old.professor_id or new.tipo_professor <> old.tipo_professor then
      raise exception 'A autoria e a especialidade da avaliação são imutáveis.';
    end if;
    if old.status = 'rascunho' and new.status = 'publicado' and not exists (
      select 1 from public.questoes_avaliacao q where q.avaliacao_id = old.id
    ) then
      raise exception 'Adicione ao menos uma questão antes de publicar.';
    end if;
    if old.status <> 'rascunho' and (
      old.status <> 'publicado' or new.status <> 'encerrado'
      or new.turma_id is distinct from old.turma_id
      or new.titulo is distinct from old.titulo
      or new.instrucoes is distinct from old.instrucoes
      or new.duracao_minutos is distinct from old.duracao_minutos
      or new.valor is distinct from old.valor
      or new.configuracao is distinct from old.configuracao
      or new.abre_em is distinct from old.abre_em
      or new.encerra_em is distinct from old.encerra_em
      or new.publicado_em is distinct from old.publicado_em
    ) then
      raise exception 'Uma avaliação publicada só pode ser encerrada.';
    end if;
    if old.status = 'rascunho' and new.status = 'publicado' then
      new.publicado_em := coalesce(new.publicado_em, now());
    end if;
  end if;
  return new;
end;
$$;

-- Impede que um aluno atribua a própria nota ou altere uma entrega já enviada.
-- Também preserva a autoria: professores corrigem, mas não reescrevem o conteúdo do aluno.
create or replace function public.validar_atualizacao_entrega_docente()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  papel public.perfil_role := (select public.usuario_role());
begin
  if new.id <> old.id or new.created_at is distinct from old.created_at then
    raise exception 'A identidade e a data de criação da entrega são imutáveis.';
  end if;
  if papel = 'aluno' then
    if old.aluno_id <> (select auth.uid())
      or new.aluno_id <> old.aluno_id
      or new.laboratorio_id <> old.laboratorio_id
      or old.status <> 'rascunho'
      or new.status not in ('rascunho', 'enviada')
      or new.nota is distinct from old.nota
      or new.feedback is distinct from old.feedback
      or new.avaliada_em is distinct from old.avaliada_em then
      raise exception 'O aluno não pode alterar autoria, correção ou uma entrega já enviada.';
    end if;
    if new.status = 'enviada' and old.status = 'rascunho' then
      new.enviada_em := coalesce(new.enviada_em, now());
    end if;
  elsif papel = 'professor' then
    if new.aluno_id <> old.aluno_id
      or new.laboratorio_id <> old.laboratorio_id
      or new.conteudo is distinct from old.conteudo
      or new.enviada_em is distinct from old.enviada_em then
      raise exception 'O professor pode corrigir a entrega, mas não alterar a resposta do aluno.';
    end if;
  elsif papel <> 'gestor' then
    raise exception 'Perfil sem permissão para atualizar entregas.';
  end if;
  return new;
end;
$$;

create or replace function public.validar_atualizacao_tentativa_docente()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  papel public.perfil_role := (select public.usuario_role());
begin
  if new.id <> old.id then
    raise exception 'A identidade da tentativa é imutável.';
  end if;
  if papel = 'aluno' then
    if old.aluno_id <> (select auth.uid())
      or new.aluno_id <> old.aluno_id
      or new.avaliacao_id <> old.avaliacao_id
      or old.status <> 'em_andamento'
      or new.status not in ('em_andamento', 'enviada')
      or new.nota is distinct from old.nota
      or new.feedback is distinct from old.feedback
      or new.corrigida_em is distinct from old.corrigida_em then
      raise exception 'O aluno não pode alterar autoria, correção ou uma tentativa já enviada.';
    end if;
    if new.status = 'enviada' and old.status = 'em_andamento' then
      new.enviada_em := coalesce(new.enviada_em, now());
    end if;
  elsif papel = 'professor' then
    if new.aluno_id <> old.aluno_id
      or new.avaliacao_id <> old.avaliacao_id
      or new.respostas is distinct from old.respostas
      or new.iniciada_em is distinct from old.iniciada_em
      or new.enviada_em is distinct from old.enviada_em then
      raise exception 'O professor pode corrigir a tentativa, mas não alterar as respostas do aluno.';
    end if;
  elsif papel <> 'gestor' then
    raise exception 'Perfil sem permissão para atualizar tentativas.';
  end if;
  return new;
end;
$$;

revoke all on function public.validar_atualizacao_entrega_docente() from public, anon, authenticated;
revoke all on function public.validar_atualizacao_tentativa_docente() from public, anon, authenticated;
revoke all on function public.validar_ciclo_laboratorio_docente() from public, anon, authenticated;
revoke all on function public.validar_ciclo_avaliacao_docente() from public, anon, authenticated;

drop trigger if exists set_laboratorios_updated_at on public.laboratorios_docentes;
drop trigger if exists set_avaliacoes_updated_at on public.avaliacoes_docentes;
drop trigger if exists set_entregas_updated_at on public.entregas_laboratorio;
drop trigger if exists set_tentativas_updated_at on public.tentativas_avaliacao;
drop trigger if exists validar_entrega_docente on public.entregas_laboratorio;
drop trigger if exists validar_tentativa_docente on public.tentativas_avaliacao;
drop trigger if exists validar_ciclo_laboratorio_docente on public.laboratorios_docentes;
drop trigger if exists validar_ciclo_avaliacao_docente on public.avaliacoes_docentes;
create trigger set_laboratorios_updated_at before update on public.laboratorios_docentes for each row execute function public.set_updated_at();
create trigger set_avaliacoes_updated_at before update on public.avaliacoes_docentes for each row execute function public.set_updated_at();
create trigger validar_ciclo_laboratorio_docente before update on public.laboratorios_docentes for each row execute function public.validar_ciclo_laboratorio_docente();
create trigger validar_ciclo_avaliacao_docente before update on public.avaliacoes_docentes for each row execute function public.validar_ciclo_avaliacao_docente();
create trigger validar_entrega_docente before update on public.entregas_laboratorio for each row execute function public.validar_atualizacao_entrega_docente();
create trigger validar_tentativa_docente before update on public.tentativas_avaliacao for each row execute function public.validar_atualizacao_tentativa_docente();
create trigger set_entregas_updated_at before update on public.entregas_laboratorio for each row execute function public.set_updated_at();
create trigger set_tentativas_updated_at before update on public.tentativas_avaliacao for each row execute function public.set_updated_at();
drop trigger if exists set_gabaritos_updated_at on public.gabaritos_avaliacao;
create trigger set_gabaritos_updated_at before update on public.gabaritos_avaliacao for each row execute function public.set_updated_at();

revoke all on public.laboratorios_docentes, public.avaliacoes_docentes, public.questoes_avaliacao, public.gabaritos_avaliacao, public.entregas_laboratorio, public.tentativas_avaliacao from anon;
grant select, insert, update, delete on public.laboratorios_docentes, public.avaliacoes_docentes, public.questoes_avaliacao, public.gabaritos_avaliacao, public.entregas_laboratorio, public.tentativas_avaliacao to authenticated;

-- ============================================================================
-- ETAPA 9/23: migrations/20260831_trilhas_estudos_completos.sql
-- ============================================================================

create schema if not exists private authorization postgres;
revoke all on schema private from public, anon, authenticated;

alter table public.trilhas
  add column if not exists area_conhecimento text,
  add column if not exists serie smallint,
  add column if not exists trimestre smallint,
  add column if not exists dificuldade text not null default 'inicial',
  add column if not exists duracao_estimada_min integer not null default 0,
  add column if not exists recompensa_xp integer not null default 0,
  add column if not exists capa_url text,
  add column if not exists tags text[] not null default '{}';

alter table public.atividades
  add column if not exists tipo_conteudo text not null default 'aula',
  add column if not exists conteudo jsonb not null default '{}'::jsonb,
  add column if not exists video_url text,
  add column if not exists duracao_minutos integer not null default 0,
  add column if not exists recompensa_xp integer not null default 0,
  add column if not exists obrigatoria boolean not null default true,
  add column if not exists prerequisito_atividade_id uuid references public.atividades(id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trilhas_serie_check' and conrelid = 'public.trilhas'::regclass) then
    alter table public.trilhas add constraint trilhas_serie_check check (serie is null or serie between 1 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trilhas_trimestre_check' and conrelid = 'public.trilhas'::regclass) then
    alter table public.trilhas add constraint trilhas_trimestre_check check (trimestre is null or trimestre between 1 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trilhas_dificuldade_check' and conrelid = 'public.trilhas'::regclass) then
    alter table public.trilhas add constraint trilhas_dificuldade_check check (dificuldade in ('inicial','intermediaria','avancada'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trilhas_duracao_check' and conrelid = 'public.trilhas'::regclass) then
    alter table public.trilhas add constraint trilhas_duracao_check check (duracao_estimada_min >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trilhas_recompensa_check' and conrelid = 'public.trilhas'::regclass) then
    alter table public.trilhas add constraint trilhas_recompensa_check check (recompensa_xp >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'atividades_tipo_conteudo_check' and conrelid = 'public.atividades'::regclass) then
    alter table public.atividades add constraint atividades_tipo_conteudo_check check (tipo_conteudo in ('aula','atividade','quiz','projeto'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'atividades_conteudo_check' and conrelid = 'public.atividades'::regclass) then
    alter table public.atividades add constraint atividades_conteudo_check check (jsonb_typeof(conteudo) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'atividades_duracao_check' and conrelid = 'public.atividades'::regclass) then
    alter table public.atividades add constraint atividades_duracao_check check (duracao_minutos >= 0);
  end if;
end $$;

create table if not exists public.trilhas_prerequisitos (
  trilha_id uuid not null references public.trilhas(id) on delete cascade,
  prerequisito_trilha_id uuid not null references public.trilhas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trilha_id, prerequisito_trilha_id),
  check (trilha_id <> prerequisito_trilha_id)
);

create table if not exists public.materiais_aula (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 2 and 120),
  tipo text not null check (tipo in ('pdf','video','link','imagem','audio','arquivo')),
  url text not null,
  ordem integer not null default 1 check (ordem > 0),
  created_at timestamptz not null default now(),
  unique (atividade_id, ordem)
);

create table if not exists public.questoes_atividades (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  enunciado text not null check (char_length(btrim(enunciado)) >= 3),
  tipo text not null default 'multipla_escolha' check (tipo in ('multipla_escolha','verdadeiro_falso','resposta_curta')),
  alternativas jsonb not null default '[]'::jsonb check (jsonb_typeof(alternativas) = 'array'),
  dica text,
  pontos numeric(7,2) not null default 1 check (pontos > 0),
  ordem integer not null default 1 check (ordem > 0),
  created_at timestamptz not null default now(),
  unique (atividade_id, ordem)
);

create table if not exists private.gabaritos_questoes (
  questao_id uuid primary key references public.questoes_atividades(id) on delete cascade,
  resposta_correta jsonb not null,
  explicacao text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.tentativas_atividades (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  status text not null default 'em_andamento' check (status in ('em_andamento','concluida')),
  acertos integer not null default 0 check (acertos >= 0),
  pontuacao_obtida numeric(8,2) not null default 0 check (pontuacao_obtida >= 0),
  pontuacao_maxima numeric(8,2) not null default 0 check (pontuacao_maxima >= 0),
  iniciada_em timestamptz not null default now(),
  concluida_em timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.respostas_questoes (
  id uuid primary key default gen_random_uuid(),
  tentativa_id uuid not null references public.tentativas_atividades(id) on delete cascade,
  questao_id uuid not null references public.questoes_atividades(id) on delete cascade,
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  resposta jsonb not null,
  correta boolean not null default false,
  pontos_obtidos numeric(7,2) not null default 0 check (pontos_obtidos >= 0),
  explicacao_snapshot text,
  respondida_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tentativa_id, questao_id)
);

create table if not exists public.conteudos_salvos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  trilha_id uuid references public.trilhas(id) on delete cascade,
  atividade_id uuid references public.atividades(id) on delete cascade,
  nota_pessoal text,
  created_at timestamptz not null default now(),
  check ((trilha_id is not null)::integer + (atividade_id is not null)::integer = 1)
);

create table if not exists public.anotacoes_aula (
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  texto text not null default '' check (char_length(texto) <= 10000),
  updated_at timestamptz not null default now(),
  primary key (aluno_id, atividade_id)
);

create table if not exists public.historico_estudos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  trilha_id uuid references public.trilhas(id) on delete set null,
  atividade_id uuid references public.atividades(id) on delete set null,
  evento text not null check (evento in ('iniciou_trilha','abriu_aula','concluiu_aula','iniciou_atividade','respondeu','concluiu_atividade','salvou','removeu_salvo','anotou')),
  detalhes jsonb not null default '{}'::jsonb check (jsonb_typeof(detalhes) = 'object'),
  duracao_segundos integer check (duracao_segundos is null or duracao_segundos >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.xp_movimentos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  origem_tipo text not null check (origem_tipo in ('atividade','trilha','conquista','ajuste')),
  origem_id uuid not null,
  xp integer not null check (xp >= 0),
  descricao text not null,
  created_at timestamptz not null default now(),
  unique (aluno_id, origem_tipo, origem_id)
);

create index if not exists trilhas_catalogo_idx on public.trilhas (publicada, materia, serie, trimestre);
create index if not exists trilhas_area_idx on public.trilhas (area_conhecimento) where publicada = true;
create index if not exists atividades_trilha_status_ordem_idx on public.atividades (trilha_id, status, ordem);
create index if not exists atividades_prerequisito_idx on public.atividades (prerequisito_atividade_id) where prerequisito_atividade_id is not null;
create index if not exists trilhas_prerequisitos_requisito_idx on public.trilhas_prerequisitos (prerequisito_trilha_id);
create index if not exists materiais_aula_atividade_idx on public.materiais_aula (atividade_id, ordem);
create index if not exists questoes_atividade_idx on public.questoes_atividades (atividade_id, ordem);
create index if not exists tentativas_aluno_atividade_idx on public.tentativas_atividades (aluno_id, atividade_id, created_at desc);
create index if not exists tentativas_atividade_idx on public.tentativas_atividades (atividade_id);
create index if not exists respostas_aluno_tentativa_idx on public.respostas_questoes (aluno_id, tentativa_id);
create index if not exists respostas_questao_idx on public.respostas_questoes (questao_id);
create unique index if not exists conteudos_salvos_trilha_unique on public.conteudos_salvos (aluno_id, trilha_id) where trilha_id is not null;
create unique index if not exists conteudos_salvos_atividade_unique on public.conteudos_salvos (aluno_id, atividade_id) where atividade_id is not null;
create index if not exists conteudos_salvos_trilha_fk_idx on public.conteudos_salvos (trilha_id) where trilha_id is not null;
create index if not exists conteudos_salvos_atividade_fk_idx on public.conteudos_salvos (atividade_id) where atividade_id is not null;
create index if not exists anotacoes_aula_atividade_idx on public.anotacoes_aula (atividade_id);
create index if not exists historico_aluno_data_idx on public.historico_estudos (aluno_id, created_at desc);
create index if not exists historico_trilha_idx on public.historico_estudos (trilha_id, created_at desc) where trilha_id is not null;
create index if not exists historico_atividade_idx on public.historico_estudos (atividade_id, created_at desc) where atividade_id is not null;
create index if not exists xp_movimentos_aluno_data_idx on public.xp_movimentos (aluno_id, created_at desc);

alter table public.trilhas_prerequisitos enable row level security;
alter table public.materiais_aula enable row level security;
alter table public.questoes_atividades enable row level security;
alter table public.tentativas_atividades enable row level security;
alter table public.respostas_questoes enable row level security;
alter table public.conteudos_salvos enable row level security;
alter table public.anotacoes_aula enable row level security;
alter table public.historico_estudos enable row level security;
alter table public.xp_movimentos enable row level security;

drop policy if exists trilhas_select on public.trilhas;
create policy trilhas_select on public.trilhas for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or professor_id = (select auth.uid())
  or (
    (select public.usuario_role()) = 'professor'
    and turma_id in (select pt.turma_id from public.professor_turmas pt where pt.professor_id = (select auth.uid()))
  )
  or (
    publicada = true
    and (turma_id is null or turma_id = (select p.turma_id from public.perfis p where p.id = (select auth.uid())))
    and (select public.aluno_pode_acessar_materia(materia_codigo))
  )
);

drop policy if exists atividades_select on public.atividades;
create policy atividades_select on public.atividades for select to authenticated using (
  exists (select 1 from public.trilhas t where t.id = trilha_id)
);

-- O aluno marca diretamente apenas aulas publicadas. Notas e conclusão de quizzes
-- são calculadas pelas funções privadas após a resposta das questões.
drop policy if exists progresso_aluno_manage on public.progresso_atividades;
drop policy if exists progresso_aluno_insert on public.progresso_atividades;
drop policy if exists progresso_aluno_update on public.progresso_atividades;
create policy progresso_aluno_insert on public.progresso_atividades for insert to authenticated
with check (
  aluno_id = (select auth.uid())
  and nota is null
  and exists (
    select 1 from public.atividades a
    join public.trilhas t on t.id = a.trilha_id
    where a.id = atividade_id and a.tipo_conteudo = 'aula'
      and a.status = 'publicada' and t.publicada = true
  )
);
create policy progresso_aluno_update on public.progresso_atividades for update to authenticated
using (aluno_id = (select auth.uid()))
with check (
  aluno_id = (select auth.uid())
  and nota is null
  and exists (
    select 1 from public.atividades a
    join public.trilhas t on t.id = a.trilha_id
    where a.id = atividade_id and a.tipo_conteudo = 'aula'
      and a.status = 'publicada' and t.publicada = true
  )
);

revoke all on public.trilhas_prerequisitos, public.materiais_aula, public.questoes_atividades,
  public.tentativas_atividades, public.respostas_questoes, public.conteudos_salvos,
  public.anotacoes_aula, public.historico_estudos, public.xp_movimentos from anon;
grant select on public.trilhas_prerequisitos, public.materiais_aula, public.questoes_atividades,
  public.tentativas_atividades, public.respostas_questoes, public.conteudos_salvos,
  public.anotacoes_aula, public.historico_estudos, public.xp_movimentos to authenticated;
grant insert on public.tentativas_atividades, public.respostas_questoes, public.conteudos_salvos,
  public.anotacoes_aula, public.historico_estudos to authenticated;
grant update on public.respostas_questoes, public.conteudos_salvos, public.anotacoes_aula to authenticated;
grant delete on public.conteudos_salvos to authenticated;
grant insert, update, delete on public.trilhas_prerequisitos, public.materiais_aula, public.questoes_atividades to authenticated;

drop policy if exists trilhas_prerequisitos_select on public.trilhas_prerequisitos;
create policy trilhas_prerequisitos_select on public.trilhas_prerequisitos for select to authenticated using (
  exists (select 1 from public.trilhas t where t.id = trilha_id)
);
drop policy if exists trilhas_prerequisitos_manage on public.trilhas_prerequisitos;
create policy trilhas_prerequisitos_manage on public.trilhas_prerequisitos for all to authenticated
using ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.trilhas t where t.id = trilha_id and t.professor_id = (select auth.uid())))
with check ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.trilhas t where t.id = trilha_id and t.professor_id = (select auth.uid())));

drop policy if exists materiais_aula_select on public.materiais_aula;
create policy materiais_aula_select on public.materiais_aula for select to authenticated using (
  exists (select 1 from public.atividades a where a.id = atividade_id)
);
drop policy if exists materiais_aula_manage on public.materiais_aula;
create policy materiais_aula_manage on public.materiais_aula for all to authenticated
using ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.atividades a join public.trilhas t on t.id = a.trilha_id where a.id = atividade_id and t.professor_id = (select auth.uid())))
with check ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.atividades a join public.trilhas t on t.id = a.trilha_id where a.id = atividade_id and t.professor_id = (select auth.uid())));

drop policy if exists questoes_atividades_select on public.questoes_atividades;
create policy questoes_atividades_select on public.questoes_atividades for select to authenticated using (
  exists (select 1 from public.atividades a where a.id = atividade_id)
);
drop policy if exists questoes_atividades_manage on public.questoes_atividades;
create policy questoes_atividades_manage on public.questoes_atividades for all to authenticated
using ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.atividades a join public.trilhas t on t.id = a.trilha_id where a.id = atividade_id and t.professor_id = (select auth.uid())))
with check ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.atividades a join public.trilhas t on t.id = a.trilha_id where a.id = atividade_id and t.professor_id = (select auth.uid())));

drop policy if exists tentativas_atividades_select on public.tentativas_atividades;
create policy tentativas_atividades_select on public.tentativas_atividades for select to authenticated using (
  aluno_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor'
  or ((select public.usuario_role()) = 'professor' and exists (
    select 1 from public.perfis p join public.professor_turmas pt on pt.turma_id = p.turma_id
    where p.id = aluno_id and pt.professor_id = (select auth.uid())
  ))
);
drop policy if exists tentativas_atividades_insert on public.tentativas_atividades;
create policy tentativas_atividades_insert on public.tentativas_atividades for insert to authenticated with check (
  aluno_id = (select auth.uid()) and status = 'em_andamento'
  and exists (select 1 from public.atividades a join public.trilhas t on t.id = a.trilha_id where a.id = atividade_id and a.status = 'publicada' and t.publicada = true)
);

drop policy if exists respostas_questoes_select on public.respostas_questoes;
create policy respostas_questoes_select on public.respostas_questoes for select to authenticated using (
  aluno_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor'
  or ((select public.usuario_role()) = 'professor' and exists (
    select 1 from public.perfis p join public.professor_turmas pt on pt.turma_id = p.turma_id
    where p.id = aluno_id and pt.professor_id = (select auth.uid())
  ))
);
drop policy if exists respostas_questoes_insert on public.respostas_questoes;
create policy respostas_questoes_insert on public.respostas_questoes for insert to authenticated with check (
  aluno_id = (select auth.uid()) and exists (
    select 1 from public.tentativas_atividades ta join public.questoes_atividades q on q.atividade_id = ta.atividade_id
    where ta.id = tentativa_id and ta.aluno_id = (select auth.uid()) and ta.status = 'em_andamento' and q.id = questao_id
  )
);
drop policy if exists respostas_questoes_update on public.respostas_questoes;
create policy respostas_questoes_update on public.respostas_questoes for update to authenticated
using (aluno_id = (select auth.uid())) with check (
  aluno_id = (select auth.uid()) and exists (select 1 from public.tentativas_atividades ta where ta.id = tentativa_id and ta.aluno_id = (select auth.uid()) and ta.status = 'em_andamento')
);

drop policy if exists conteudos_salvos_own on public.conteudos_salvos;
create policy conteudos_salvos_own on public.conteudos_salvos for all to authenticated
using (aluno_id = (select auth.uid())) with check (aluno_id = (select auth.uid()));
drop policy if exists anotacoes_aula_own on public.anotacoes_aula;
create policy anotacoes_aula_own on public.anotacoes_aula for all to authenticated
using (aluno_id = (select auth.uid())) with check (aluno_id = (select auth.uid()));

drop policy if exists historico_estudos_select on public.historico_estudos;
create policy historico_estudos_select on public.historico_estudos for select to authenticated using (
  aluno_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor'
  or ((select public.usuario_role()) = 'professor' and exists (
    select 1 from public.perfis p join public.professor_turmas pt on pt.turma_id = p.turma_id
    where p.id = aluno_id and pt.professor_id = (select auth.uid())
  ))
);
drop policy if exists historico_estudos_insert on public.historico_estudos;
create policy historico_estudos_insert on public.historico_estudos for insert to authenticated with check (aluno_id = (select auth.uid()));

drop policy if exists xp_movimentos_select on public.xp_movimentos;
create policy xp_movimentos_select on public.xp_movimentos for select to authenticated using (
  aluno_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor'
  or ((select public.usuario_role()) = 'professor' and exists (
    select 1 from public.perfis p join public.professor_turmas pt on pt.turma_id = p.turma_id
    where p.id = aluno_id and pt.professor_id = (select auth.uid())
  ))
);

create or replace function private.avaliar_resposta_questao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_gabarito jsonb; v_explicacao text; v_pontos numeric(7,2);
begin
  if new.aluno_id <> (select auth.uid()) then raise exception 'Resposta inválida para o usuário atual'; end if;
  select g.resposta_correta, g.explicacao, q.pontos into v_gabarito, v_explicacao, v_pontos
  from private.gabaritos_questoes g join public.questoes_atividades q on q.id = g.questao_id
  where g.questao_id = new.questao_id;
  if v_gabarito is null then raise exception 'Gabarito não configurado'; end if;
  new.correta := new.resposta = v_gabarito;
  new.pontos_obtidos := case when new.correta then v_pontos else 0 end;
  new.explicacao_snapshot := v_explicacao;
  new.updated_at := now();
  return new;
end $$;

create or replace function private.recalcular_tentativa_atividade()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_total integer; v_respondidas integer; v_acertos integer; v_obtida numeric(8,2); v_maxima numeric(8,2); v_atividade uuid; v_trilha uuid; v_xp integer; v_ja_concluida boolean;
begin
  select ta.atividade_id, ta.status = 'concluida' into v_atividade, v_ja_concluida from public.tentativas_atividades ta where ta.id = new.tentativa_id;
  select count(*), coalesce(sum(q.pontos),0) into v_total, v_maxima from public.questoes_atividades q where q.atividade_id = v_atividade;
  select count(*), count(*) filter (where r.correta), coalesce(sum(r.pontos_obtidos),0) into v_respondidas, v_acertos, v_obtida from public.respostas_questoes r where r.tentativa_id = new.tentativa_id;
  update public.tentativas_atividades set acertos = v_acertos, pontuacao_obtida = v_obtida, pontuacao_maxima = v_maxima,
    status = case when v_total > 0 and v_respondidas >= v_total then 'concluida' else 'em_andamento' end,
    concluida_em = case when v_total > 0 and v_respondidas >= v_total then coalesce(concluida_em,now()) else null end,
    updated_at = now()
  where id = new.tentativa_id;
  if v_total > 0 and v_respondidas >= v_total and not v_ja_concluida then
    select a.trilha_id, a.recompensa_xp into v_trilha, v_xp from public.atividades a where a.id = v_atividade;
    insert into public.progresso_atividades (atividade_id, aluno_id, concluida, nota, concluida_em)
    values (v_atividade, new.aluno_id, true, case when v_maxima > 0 then round((v_obtida / v_maxima) * 10,2) else 0 end, now())
    on conflict (atividade_id, aluno_id) do update set concluida = true, nota = excluded.nota, concluida_em = excluded.concluida_em, updated_at = now();
    insert into public.xp_movimentos (aluno_id, origem_tipo, origem_id, xp, descricao)
    values (new.aluno_id, 'atividade', v_atividade, coalesce(v_xp,0), 'Atividade concluída') on conflict do nothing;
    insert into public.historico_estudos (aluno_id, trilha_id, atividade_id, evento, detalhes)
    values (new.aluno_id, v_trilha, v_atividade, 'concluiu_atividade', jsonb_build_object('pontuacao_obtida',v_obtida,'pontuacao_maxima',v_maxima,'acertos',v_acertos));
  end if;
  return new;
end $$;

create or replace function private.registrar_conclusao_aula()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_trilha uuid; v_xp integer; v_tipo text;
begin
  if new.concluida and tg_op = 'INSERT' then
    select a.trilha_id, a.recompensa_xp, a.tipo_conteudo into v_trilha, v_xp, v_tipo from public.atividades a where a.id = new.atividade_id;
    if v_tipo = 'aula' then
      insert into public.xp_movimentos (aluno_id, origem_tipo, origem_id, xp, descricao)
      values (new.aluno_id, 'atividade', new.atividade_id, coalesce(v_xp,0), 'Aula concluída') on conflict do nothing;
      insert into public.historico_estudos (aluno_id, trilha_id, atividade_id, evento)
      values (new.aluno_id, v_trilha, new.atividade_id, 'concluiu_aula');
    end if;
  elsif new.concluida and not old.concluida then
    select a.trilha_id, a.recompensa_xp, a.tipo_conteudo into v_trilha, v_xp, v_tipo from public.atividades a where a.id = new.atividade_id;
    if v_tipo = 'aula' then
      insert into public.xp_movimentos (aluno_id, origem_tipo, origem_id, xp, descricao)
      values (new.aluno_id, 'atividade', new.atividade_id, coalesce(v_xp,0), 'Aula concluída') on conflict do nothing;
      insert into public.historico_estudos (aluno_id, trilha_id, atividade_id, evento)
      values (new.aluno_id, v_trilha, new.atividade_id, 'concluiu_aula');
    end if;
  end if;
  return new;
end $$;

revoke all on function private.avaliar_resposta_questao() from public, anon, authenticated;
revoke all on function private.recalcular_tentativa_atividade() from public, anon, authenticated;
revoke all on function private.registrar_conclusao_aula() from public, anon, authenticated;

drop trigger if exists trg_avaliar_resposta_questao on public.respostas_questoes;
create trigger trg_avaliar_resposta_questao before insert or update of resposta on public.respostas_questoes for each row execute function private.avaliar_resposta_questao();
drop trigger if exists trg_recalcular_tentativa_atividade on public.respostas_questoes;
create trigger trg_recalcular_tentativa_atividade after insert or update of resposta on public.respostas_questoes for each row execute function private.recalcular_tentativa_atividade();
drop trigger if exists trg_registrar_conclusao_aula on public.progresso_atividades;
create trigger trg_registrar_conclusao_aula after insert or update of concluida on public.progresso_atividades for each row execute function private.registrar_conclusao_aula();

drop trigger if exists set_anotacoes_aula_updated_at on public.anotacoes_aula;
create trigger set_anotacoes_aula_updated_at before update on public.anotacoes_aula
for each row execute function public.set_updated_at();

-- ============================================================================
-- ETAPA 10/23: migrations/20260831_redacao_jornada_completa.sql
-- ============================================================================

create schema if not exists private authorization postgres;
revoke all on schema private from public, anon, authenticated;

alter table public.propostas_redacao
  add column if not exists fixada boolean not null default false,
  add column if not exists resumo text,
  add column if not exists eixo_tematico text,
  add column if not exists dificuldade text not null default 'intermediaria',
  add column if not exists tempo_estimado_min integer not null default 90,
  add column if not exists palavras_chave text[] not null default '{}',
  add column if not exists imagem_url text,
  add column if not exists detalhes jsonb not null default '{}'::jsonb;

alter table public.redacoes
  add column if not exists tema_codigo text,
  add column if not exists planejamento_id uuid,
  add column if not exists enviada_para_revisao_em timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'propostas_redacao_dificuldade_check' and conrelid = 'public.propostas_redacao'::regclass) then
    alter table public.propostas_redacao add constraint propostas_redacao_dificuldade_check check (dificuldade in ('inicial','intermediaria','avancada'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'propostas_redacao_tempo_check' and conrelid = 'public.propostas_redacao'::regclass) then
    alter table public.propostas_redacao add constraint propostas_redacao_tempo_check check (tempo_estimado_min between 10 and 360);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'propostas_redacao_detalhes_check' and conrelid = 'public.propostas_redacao'::regclass) then
    alter table public.propostas_redacao add constraint propostas_redacao_detalhes_check check (jsonb_typeof(detalhes) = 'object');
  end if;
end $$;

create table if not exists public.materiais_redacao (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas_redacao(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 2 and 160),
  tipo text not null check (tipo in ('texto_motivador','redacao_modelo','artigo','video','infografico','guia')),
  conteudo text,
  url text,
  autoria text,
  fonte text,
  ano smallint check (ano is null or ano between 1500 and 2200),
  fixado boolean not null default false,
  ordem integer not null default 1 check (ordem > 0),
  created_at timestamptz not null default now(),
  unique (proposta_id, ordem)
);

create table if not exists public.repertorios_redacao (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid references public.propostas_redacao(id) on delete cascade,
  professor_id uuid not null references public.perfis(id) on delete cascade,
  turma_id uuid references public.turmas(id) on delete set null,
  categoria text not null check (categoria in ('cultural','estatistico','historico','cientifico','legal','literario')),
  titulo text not null check (char_length(btrim(titulo)) between 3 and 160),
  referencia text not null check (char_length(btrim(referencia)) >= 10),
  aplicacao text not null check (char_length(btrim(aplicacao)) >= 10),
  fonte_url text,
  contextualizado boolean not null default true check (contextualizado = true),
  publicado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planejamentos_redacao (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  proposta_id uuid references public.propostas_redacao(id) on delete set null,
  tema_codigo text not null,
  anotacoes text not null default '' check (char_length(anotacoes) <= 20000),
  tese text not null default '',
  argumentos jsonb not null default '[]'::jsonb check (jsonb_typeof(argumentos) = 'array'),
  repertorios_contextuais jsonb not null default '[]'::jsonb check (jsonb_typeof(repertorios_contextuais) = 'array'),
  intervencao jsonb not null default '{}'::jsonb check (jsonb_typeof(intervencao) = 'object'),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (aluno_id, tema_codigo)
);

alter table public.redacoes
  drop constraint if exists redacoes_planejamento_id_fkey;
alter table public.redacoes
  add constraint redacoes_planejamento_id_fkey foreign key (planejamento_id) references public.planejamentos_redacao(id) on delete set null;

create table if not exists public.planejamento_repertorios (
  planejamento_id uuid not null references public.planejamentos_redacao(id) on delete cascade,
  repertorio_id uuid not null references public.repertorios_redacao(id) on delete cascade,
  uso_planejado text not null default '' check (char_length(uso_planejado) <= 2000),
  created_at timestamptz not null default now(),
  primary key (planejamento_id, repertorio_id)
);

create table if not exists public.versoes_redacao (
  id uuid primary key default gen_random_uuid(),
  redacao_id uuid not null references public.redacoes(id) on delete cascade,
  numero integer not null check (numero > 0),
  titulo text not null,
  texto text not null,
  motivo text not null check (motivo in ('criacao','salvamento','envio','correcao')),
  autor_id uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (redacao_id, numero)
);

create table if not exists public.comentarios_redacao (
  id uuid primary key default gen_random_uuid(),
  redacao_id uuid not null references public.redacoes(id) on delete cascade,
  professor_id uuid not null references public.perfis(id) on delete cascade,
  inicio_offset integer check (inicio_offset is null or inicio_offset >= 0),
  fim_offset integer check (fim_offset is null or fim_offset >= inicio_offset),
  trecho text,
  comentario text not null check (char_length(btrim(comentario)) >= 2),
  tipo text not null default 'orientacao' check (tipo in ('elogio','orientacao','correcao','atencao')),
  created_at timestamptz not null default now()
);

create table if not exists public.avaliacoes_competencias_redacao (
  redacao_id uuid not null references public.redacoes(id) on delete cascade,
  competencia smallint not null check (competencia between 1 and 5),
  nota smallint not null check (nota in (0,40,80,120,160,200)),
  comentario text,
  professor_id uuid not null references public.perfis(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (redacao_id, competencia)
);

create index if not exists propostas_redacao_catalogo_idx on public.propostas_redacao (publicada, fixada desc, turma_id, prazo);
create index if not exists materiais_redacao_proposta_idx on public.materiais_redacao (proposta_id, fixado desc, ordem);
create index if not exists repertorios_redacao_catalogo_idx on public.repertorios_redacao (publicado, turma_id, categoria);
create index if not exists repertorios_redacao_proposta_idx on public.repertorios_redacao (proposta_id) where proposta_id is not null;
create index if not exists repertorios_redacao_professor_idx on public.repertorios_redacao (professor_id);
create index if not exists repertorios_redacao_turma_idx on public.repertorios_redacao (turma_id) where turma_id is not null;
create index if not exists planejamentos_redacao_aluno_idx on public.planejamentos_redacao (aluno_id, updated_at desc);
create index if not exists planejamentos_redacao_proposta_idx on public.planejamentos_redacao (proposta_id) where proposta_id is not null;
create index if not exists planejamento_repertorios_repertorio_idx on public.planejamento_repertorios (repertorio_id);
create index if not exists redacoes_aluno_status_data_idx on public.redacoes (aluno_id, status, updated_at desc);
create index if not exists redacoes_planejamento_idx on public.redacoes (planejamento_id) where planejamento_id is not null;
create unique index if not exists redacoes_rascunho_tema_unique on public.redacoes (aluno_id, tema_codigo) where status = 'rascunho' and tema_codigo is not null;
create index if not exists versoes_redacao_data_idx on public.versoes_redacao (redacao_id, numero desc);
create index if not exists versoes_redacao_autor_idx on public.versoes_redacao (autor_id) where autor_id is not null;
create index if not exists comentarios_redacao_idx on public.comentarios_redacao (redacao_id, created_at);
create index if not exists comentarios_redacao_professor_idx on public.comentarios_redacao (professor_id);
create index if not exists avaliacoes_competencias_professor_idx on public.avaliacoes_competencias_redacao (professor_id);

alter table public.materiais_redacao enable row level security;
alter table public.repertorios_redacao enable row level security;
alter table public.planejamentos_redacao enable row level security;
alter table public.planejamento_repertorios enable row level security;
alter table public.versoes_redacao enable row level security;
alter table public.comentarios_redacao enable row level security;
alter table public.avaliacoes_competencias_redacao enable row level security;

revoke all on public.materiais_redacao, public.repertorios_redacao, public.planejamentos_redacao,
  public.planejamento_repertorios, public.versoes_redacao, public.comentarios_redacao,
  public.avaliacoes_competencias_redacao from anon;
grant select on public.materiais_redacao, public.repertorios_redacao, public.planejamentos_redacao,
  public.planejamento_repertorios, public.versoes_redacao, public.comentarios_redacao,
  public.avaliacoes_competencias_redacao to authenticated;
grant insert, update on public.planejamentos_redacao, public.planejamento_repertorios to authenticated;
grant delete on public.planejamento_repertorios to authenticated;
grant insert, update, delete on public.materiais_redacao, public.repertorios_redacao,
  public.comentarios_redacao, public.avaliacoes_competencias_redacao to authenticated;

drop policy if exists materiais_redacao_select on public.materiais_redacao;
create policy materiais_redacao_select on public.materiais_redacao for select to authenticated using (
  exists (select 1 from public.propostas_redacao p where p.id = proposta_id)
);
drop policy if exists materiais_redacao_manage on public.materiais_redacao;
create policy materiais_redacao_manage on public.materiais_redacao for all to authenticated
using ((select public.usuario_role()) = 'gestor' or exists (
  select 1 from public.propostas_redacao p where p.id = proposta_id and p.professor_id = (select auth.uid()) and (select public.usuario_tipo_professor()) = 'portugues'
))
with check ((select public.usuario_role()) = 'gestor' or exists (
  select 1 from public.propostas_redacao p where p.id = proposta_id and p.professor_id = (select auth.uid()) and (select public.usuario_tipo_professor()) = 'portugues'
));

drop policy if exists repertorios_redacao_select on public.repertorios_redacao;
create policy repertorios_redacao_select on public.repertorios_redacao for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or professor_id = (select auth.uid())
  or (publicado = true and (turma_id is null or turma_id = (select public.usuario_turma_id())))
);
drop policy if exists repertorios_redacao_manage on public.repertorios_redacao;
create policy repertorios_redacao_manage on public.repertorios_redacao for all to authenticated
using ((select public.usuario_role()) = 'gestor' or (professor_id = (select auth.uid()) and (select public.usuario_tipo_professor()) = 'portugues'))
with check ((select public.usuario_role()) = 'gestor' or (
  professor_id = (select auth.uid()) and (select public.usuario_tipo_professor()) = 'portugues'
  and (turma_id is null or exists (select 1 from public.professor_turmas pt where pt.professor_id = (select auth.uid()) and pt.turma_id = repertorios_redacao.turma_id))
));

drop policy if exists planejamentos_redacao_own on public.planejamentos_redacao;
create policy planejamentos_redacao_own on public.planejamentos_redacao for all to authenticated
using (aluno_id = (select auth.uid())) with check (aluno_id = (select auth.uid()));

drop policy if exists planejamento_repertorios_own on public.planejamento_repertorios;
create policy planejamento_repertorios_own on public.planejamento_repertorios for all to authenticated
using (exists (select 1 from public.planejamentos_redacao p where p.id = planejamento_id and p.aluno_id = (select auth.uid())))
with check (exists (select 1 from public.planejamentos_redacao p where p.id = planejamento_id and p.aluno_id = (select auth.uid())));

drop policy if exists versoes_redacao_select on public.versoes_redacao;
create policy versoes_redacao_select on public.versoes_redacao for select to authenticated using (
  exists (select 1 from public.redacoes r where r.id = redacao_id)
);

drop policy if exists comentarios_redacao_select on public.comentarios_redacao;
create policy comentarios_redacao_select on public.comentarios_redacao for select to authenticated using (
  exists (select 1 from public.redacoes r where r.id = redacao_id)
);
drop policy if exists comentarios_redacao_manage on public.comentarios_redacao;
create policy comentarios_redacao_manage on public.comentarios_redacao for all to authenticated
using ((select public.usuario_role()) = 'gestor' or (
  professor_id = (select auth.uid()) and (select public.usuario_tipo_professor()) = 'portugues'
  and exists (select 1 from public.redacoes r where r.id = redacao_id)
))
with check ((select public.usuario_role()) = 'gestor' or (
  professor_id = (select auth.uid()) and (select public.usuario_tipo_professor()) = 'portugues'
  and exists (select 1 from public.redacoes r where r.id = redacao_id)
));

drop policy if exists avaliacoes_competencias_select on public.avaliacoes_competencias_redacao;
create policy avaliacoes_competencias_select on public.avaliacoes_competencias_redacao for select to authenticated using (
  exists (select 1 from public.redacoes r where r.id = redacao_id)
);
drop policy if exists avaliacoes_competencias_manage on public.avaliacoes_competencias_redacao;
create policy avaliacoes_competencias_manage on public.avaliacoes_competencias_redacao for all to authenticated
using ((select public.usuario_role()) = 'gestor' or (
  professor_id = (select auth.uid()) and (select public.usuario_tipo_professor()) = 'portugues'
  and exists (select 1 from public.redacoes r where r.id = redacao_id)
))
with check ((select public.usuario_role()) = 'gestor' or (
  professor_id = (select auth.uid()) and (select public.usuario_tipo_professor()) = 'portugues'
  and exists (select 1 from public.redacoes r where r.id = redacao_id)
));

drop policy if exists redacoes_update on public.redacoes;
drop policy if exists redacoes_update_aluno on public.redacoes;
drop policy if exists redacoes_update_professor on public.redacoes;
drop policy if exists redacoes_update_gestor on public.redacoes;
create policy redacoes_update_aluno on public.redacoes for update to authenticated
using (aluno_id = (select auth.uid()) and status = 'rascunho')
with check (aluno_id = (select auth.uid()) and status in ('rascunho','enviada'));
create policy redacoes_update_professor on public.redacoes for update to authenticated
using ((select public.usuario_tipo_professor()) = 'portugues' and exists (
  select 1 from public.perfis p join public.professor_turmas pt on pt.turma_id = p.turma_id
  where p.id = aluno_id and pt.professor_id = (select auth.uid())
))
with check ((select public.usuario_tipo_professor()) = 'portugues' and exists (
  select 1 from public.perfis p join public.professor_turmas pt on pt.turma_id = p.turma_id
  where p.id = aluno_id and pt.professor_id = (select auth.uid())
));
create policy redacoes_update_gestor on public.redacoes for update to authenticated
using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');

drop policy if exists redacoes_insert_proprias on public.redacoes;
create policy redacoes_insert_proprias on public.redacoes for insert to authenticated with check (
  aluno_id = (select auth.uid()) and status = 'rascunho'
  and (proposta_id is null or exists (select 1 from public.propostas_redacao p where p.id = proposta_id and p.publicada = true))
);

create or replace function private.registrar_versao_redacao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_numero integer; v_motivo text; v_ultima_id uuid; v_ultima_data timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.titulo is not distinct from old.titulo and new.texto is not distinct from old.texto and new.status is not distinct from old.status then
      return new;
    end if;
  end if;
  select coalesce(max(v.numero), 0) + 1 into v_numero from public.versoes_redacao v where v.redacao_id = new.id;
  if tg_op = 'INSERT' then
    v_motivo := 'criacao';
  elsif new.status = 'corrigida' and old.status is distinct from new.status then
    v_motivo := 'correcao';
  elsif new.status = 'enviada' and old.status is distinct from new.status then
    v_motivo := 'envio';
  else
    v_motivo := 'salvamento';
  end if;
  if v_motivo = 'salvamento' then
    select v.id, v.created_at into v_ultima_id, v_ultima_data
    from public.versoes_redacao v where v.redacao_id = new.id order by v.numero desc limit 1;
    if v_ultima_id is not null and v_ultima_data > now() - interval '2 minutes' then
      update public.versoes_redacao set titulo = new.titulo, texto = new.texto, autor_id = (select auth.uid()), created_at = now() where id = v_ultima_id;
      return new;
    end if;
  end if;
  insert into public.versoes_redacao (redacao_id, numero, titulo, texto, motivo, autor_id)
  values (new.id, v_numero, new.titulo, new.texto, v_motivo, (select auth.uid()));
  return new;
end $$;

create or replace function private.validar_atualizacao_redacao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_papel public.perfil_role := (select public.usuario_role());
begin
  if new.id <> old.id or new.created_at is distinct from old.created_at then
    raise exception 'A identidade e a data de criação da redação são imutáveis.';
  end if;

  if v_papel = 'aluno' then
    if old.aluno_id <> (select auth.uid())
      or new.aluno_id <> old.aluno_id
      or new.proposta_id is distinct from old.proposta_id
      or new.trilha_id is distinct from old.trilha_id
      or new.tema_codigo is distinct from old.tema_codigo
      or old.status <> 'rascunho'
      or new.status not in ('rascunho', 'enviada')
      or new.nota is distinct from old.nota
      or new.feedback is distinct from old.feedback
      or new.corrigida_por is distinct from old.corrigida_por
      or new.corrigida_em is distinct from old.corrigida_em
      or new.alerta_ia is distinct from old.alerta_ia then
      raise exception 'O aluno não pode alterar autoria, avaliação ou uma redação já enviada.';
    end if;
    if new.status = 'enviada' and old.status = 'rascunho' then
      new.enviada_em := coalesce(old.enviada_em, now());
    end if;
  elsif v_papel = 'professor' then
    if (select public.usuario_tipo_professor()) <> 'portugues'
      or old.status not in ('enviada', 'corrigida')
      or new.status not in ('enviada', 'corrigida')
      or new.aluno_id <> old.aluno_id
      or new.proposta_id is distinct from old.proposta_id
      or new.trilha_id is distinct from old.trilha_id
      or new.planejamento_id is distinct from old.planejamento_id
      or new.tema_codigo is distinct from old.tema_codigo
      or new.titulo is distinct from old.titulo
      or new.texto is distinct from old.texto
      or new.enviada_em is distinct from old.enviada_em then
      raise exception 'O professor pode corrigir a redação, mas não alterar o texto ou sua autoria.';
    end if;
    if new.status = 'corrigida' then
      new.corrigida_por := (select auth.uid());
      new.corrigida_em := coalesce(new.corrigida_em, now());
    end if;
  elsif v_papel <> 'gestor' then
    raise exception 'Perfil sem permissão para atualizar redações.';
  end if;
  return new;
end $$;

revoke all on function private.registrar_versao_redacao() from public, anon, authenticated;
revoke all on function private.validar_atualizacao_redacao() from public, anon, authenticated;
drop trigger if exists trg_validar_atualizacao_redacao on public.redacoes;
create trigger trg_validar_atualizacao_redacao
before update on public.redacoes
for each row execute function private.validar_atualizacao_redacao();
drop trigger if exists trg_redacao_versao_insert on public.redacoes;
create trigger trg_redacao_versao_insert after insert on public.redacoes for each row execute function private.registrar_versao_redacao();
drop trigger if exists trg_redacao_versao_update on public.redacoes;
create trigger trg_redacao_versao_update after update of titulo, texto, status on public.redacoes for each row execute function private.registrar_versao_redacao();

drop trigger if exists set_repertorios_redacao_updated_at on public.repertorios_redacao;
create trigger set_repertorios_redacao_updated_at before update on public.repertorios_redacao
for each row execute function public.set_updated_at();
drop trigger if exists set_planejamentos_redacao_updated_at on public.planejamentos_redacao;
create trigger set_planejamentos_redacao_updated_at before update on public.planejamentos_redacao
for each row execute function public.set_updated_at();
drop trigger if exists set_avaliacoes_competencias_redacao_updated_at on public.avaliacoes_competencias_redacao;
create trigger set_avaliacoes_competencias_redacao_updated_at before update on public.avaliacoes_competencias_redacao
for each row execute function public.set_updated_at();

-- ============================================================================
-- ETAPA 11/23: migrations/20260831_agenda_notificacoes.sql
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.eventos_agenda (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  descricao text,
  tipo text not null check (tipo in ('aula', 'prova', 'recuperacao', 'trabalho', 'atividade', 'reuniao', 'outro')),
  inicio timestamptz not null,
  fim timestamptz,
  dia_inteiro boolean not null default false,
  materia text,
  local text,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  professor_id uuid not null references public.perfis(id) on delete cascade,
  status text not null default 'publicado' check (status in ('rascunho', 'publicado', 'cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 3 and 140),
  mensagem text not null check (char_length(btrim(mensagem)) between 3 and 500),
  tipo text not null default 'sistema' check (tipo in ('agenda', 'avaliacao', 'biblioteca', 'progresso', 'sistema')),
  prioridade text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta')),
  destino_turma_id uuid references public.turmas(id) on delete cascade,
  criado_por uuid not null references public.perfis(id) on delete cascade,
  evento_agenda_id uuid unique references public.eventos_agenda(id) on delete cascade,
  link text,
  expira_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notificacoes_lidas (
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  notificacao_id uuid not null references public.notificacoes(id) on delete cascade,
  lida_em timestamptz not null default now(),
  primary key (usuario_id, notificacao_id)
);

create index if not exists eventos_agenda_turma_inicio_idx on public.eventos_agenda (turma_id, inicio);
create index if not exists eventos_agenda_professor_inicio_idx on public.eventos_agenda (professor_id, inicio);
create index if not exists eventos_agenda_publicados_idx on public.eventos_agenda (inicio) where status = 'publicado';
create index if not exists notificacoes_turma_created_idx on public.notificacoes (destino_turma_id, created_at desc);
create index if not exists notificacoes_criador_created_idx on public.notificacoes (criado_por, created_at desc);
create index if not exists notificacoes_lidas_usuario_idx on public.notificacoes_lidas (usuario_id, lida_em desc);
create index if not exists notificacoes_lidas_notificacao_idx on public.notificacoes_lidas (notificacao_id);

alter table public.eventos_agenda enable row level security;
alter table public.notificacoes enable row level security;
alter table public.notificacoes_lidas enable row level security;

revoke all on public.eventos_agenda, public.notificacoes, public.notificacoes_lidas from anon;
grant select, insert, update, delete on public.eventos_agenda, public.notificacoes, public.notificacoes_lidas to authenticated;

drop policy if exists eventos_agenda_select on public.eventos_agenda;
create policy eventos_agenda_select on public.eventos_agenda for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or professor_id = (select auth.uid())
  or turma_id in (select pt.turma_id from public.professor_turmas pt where pt.professor_id = (select auth.uid()))
  or (
    status = 'publicado'
    and turma_id = (select p.turma_id from public.perfis p where p.id = (select auth.uid()))
  )
);

drop policy if exists eventos_agenda_insert on public.eventos_agenda;
create policy eventos_agenda_insert on public.eventos_agenda for insert to authenticated with check (
  professor_id = (select auth.uid())
  and (
    (select public.usuario_role()) = 'gestor'
    or (
      (select public.usuario_role()) = 'professor'
      and turma_id in (select pt.turma_id from public.professor_turmas pt where pt.professor_id = (select auth.uid()))
    )
  )
);

drop policy if exists eventos_agenda_update on public.eventos_agenda;
create policy eventos_agenda_update on public.eventos_agenda for update to authenticated
using ((select public.usuario_role()) = 'gestor' or professor_id = (select auth.uid()))
with check (
  (select public.usuario_role()) = 'gestor'
  or (
    professor_id = (select auth.uid())
    and turma_id in (select pt.turma_id from public.professor_turmas pt where pt.professor_id = (select auth.uid()))
  )
);

drop policy if exists eventos_agenda_delete on public.eventos_agenda;
create policy eventos_agenda_delete on public.eventos_agenda for delete to authenticated
using ((select public.usuario_role()) = 'gestor' or professor_id = (select auth.uid()));

drop policy if exists notificacoes_select on public.notificacoes;
create policy notificacoes_select on public.notificacoes for select to authenticated using (
  (expira_em is null or expira_em > now())
  and (
    (select public.usuario_role()) = 'gestor'
    or criado_por = (select auth.uid())
    or destino_turma_id is null
    or destino_turma_id in (select pt.turma_id from public.professor_turmas pt where pt.professor_id = (select auth.uid()))
    or destino_turma_id = (select p.turma_id from public.perfis p where p.id = (select auth.uid()))
  )
);

drop policy if exists notificacoes_insert on public.notificacoes;
create policy notificacoes_insert on public.notificacoes for insert to authenticated with check (
  criado_por = (select auth.uid())
  and (
    (select public.usuario_role()) = 'gestor'
    or (
      (select public.usuario_role()) = 'professor'
      and destino_turma_id in (select pt.turma_id from public.professor_turmas pt where pt.professor_id = (select auth.uid()))
    )
  )
);

drop policy if exists notificacoes_update on public.notificacoes;
create policy notificacoes_update on public.notificacoes for update to authenticated
using ((select public.usuario_role()) = 'gestor' or criado_por = (select auth.uid()))
with check ((select public.usuario_role()) = 'gestor' or criado_por = (select auth.uid()));

drop policy if exists notificacoes_delete on public.notificacoes;
create policy notificacoes_delete on public.notificacoes for delete to authenticated
using ((select public.usuario_role()) = 'gestor' or criado_por = (select auth.uid()));

drop policy if exists notificacoes_lidas_select on public.notificacoes_lidas;
create policy notificacoes_lidas_select on public.notificacoes_lidas for select to authenticated
using (usuario_id = (select auth.uid()));
drop policy if exists notificacoes_lidas_insert on public.notificacoes_lidas;
create policy notificacoes_lidas_insert on public.notificacoes_lidas for insert to authenticated
with check (usuario_id = (select auth.uid()));
drop policy if exists notificacoes_lidas_update on public.notificacoes_lidas;
create policy notificacoes_lidas_update on public.notificacoes_lidas for update to authenticated
using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
drop policy if exists notificacoes_lidas_delete on public.notificacoes_lidas;
create policy notificacoes_lidas_delete on public.notificacoes_lidas for delete to authenticated
using (usuario_id = (select auth.uid()));

create or replace function public.sincronizar_notificacao_agenda()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_titulo text;
  v_mensagem text;
begin
  if new.status = 'publicado' and new.tipo in ('prova', 'recuperacao', 'trabalho', 'atividade') then
    v_titulo := case new.tipo
      when 'prova' then 'Nova prova na agenda'
      when 'recuperacao' then 'Recuperação agendada'
      when 'trabalho' then 'Novo trabalho na agenda'
      else 'Nova atividade na agenda'
    end;
    v_mensagem := new.titulo || ' · ' || to_char(new.inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY às HH24:MI');
    insert into public.notificacoes (titulo, mensagem, tipo, prioridade, destino_turma_id, criado_por, evento_agenda_id, link, updated_at)
    values (
      v_titulo,
      v_mensagem,
      'agenda',
      case when new.tipo in ('prova', 'recuperacao') then 'alta' else 'normal' end,
      new.turma_id,
      new.professor_id,
      new.id,
      '../agenda/index.html?evento=' || new.id,
      now()
    )
    on conflict (evento_agenda_id) do update set
      titulo = excluded.titulo,
      mensagem = excluded.mensagem,
      prioridade = excluded.prioridade,
      destino_turma_id = excluded.destino_turma_id,
      updated_at = now();
  else
    delete from public.notificacoes where evento_agenda_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sincronizar_notificacao_agenda() from public, anon, authenticated;

drop trigger if exists trg_sincronizar_notificacao_agenda on public.eventos_agenda;
create trigger trg_sincronizar_notificacao_agenda
after insert or update of titulo, tipo, inicio, turma_id, status
on public.eventos_agenda
for each row execute function public.sincronizar_notificacao_agenda();

drop trigger if exists set_eventos_agenda_updated_at on public.eventos_agenda;
create trigger set_eventos_agenda_updated_at
before update on public.eventos_agenda
for each row execute function public.set_updated_at();

drop trigger if exists set_notificacoes_updated_at on public.notificacoes;
create trigger set_notificacoes_updated_at
before update on public.notificacoes
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'eventos_agenda'
  ) then alter publication supabase_realtime add table public.eventos_agenda; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificacoes'
  ) then alter publication supabase_realtime add table public.notificacoes; end if;
end $$;

-- ============================================================================
-- ETAPA 12/23: migrations/20260902_biblioteca_acervo_unificado.sql
-- ============================================================================

-- OminiSaber | Acervo físico, PDFs verificados e reserva transacional
-- Pode ser aplicado sobre uma instalação existente sem apagar dados.

alter table public.exemplares drop constraint if exists exemplares_status_check;
alter table public.exemplares
  add constraint exemplares_status_check
  check (status in ('disponivel', 'reservado', 'emprestado', 'manutencao'));

create table if not exists public.materiais_biblioteca (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  autor text,
  descricao text,
  categoria text not null default 'Material de apoio',
  materia text,
  paginas integer check (paginas is null or paginas > 0),
  capa_url text,
  palavras_chave text,
  storage_bucket text not null default 'biblioteca-pdfs',
  storage_path text not null unique,
  nome_arquivo text not null,
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  tamanho_bytes bigint check (tamanho_bytes is null or tamanho_bytes > 0),
  verificado boolean not null default false,
  verificado_por uuid references public.perfis(id) on delete set null,
  verificado_em timestamptz,
  publicado boolean not null default false,
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not verificado or verificado_em is not null),
  check (not publicado or verificado)
);

alter table public.materiais_biblioteca add column if not exists autor text;
alter table public.materiais_biblioteca add column if not exists descricao text;
alter table public.materiais_biblioteca add column if not exists categoria text default 'Material de apoio';
alter table public.materiais_biblioteca add column if not exists materia text;
alter table public.materiais_biblioteca add column if not exists paginas integer;
alter table public.materiais_biblioteca add column if not exists capa_url text;
alter table public.materiais_biblioteca add column if not exists palavras_chave text;
alter table public.materiais_biblioteca add column if not exists storage_bucket text default 'biblioteca-pdfs';
alter table public.materiais_biblioteca add column if not exists storage_path text;
alter table public.materiais_biblioteca add column if not exists nome_arquivo text;
alter table public.materiais_biblioteca add column if not exists mime_type text default 'application/pdf';
alter table public.materiais_biblioteca add column if not exists tamanho_bytes bigint;
alter table public.materiais_biblioteca add column if not exists verificado boolean default false;
alter table public.materiais_biblioteca add column if not exists verificado_por uuid references public.perfis(id) on delete set null;
alter table public.materiais_biblioteca add column if not exists verificado_em timestamptz;
alter table public.materiais_biblioteca add column if not exists publicado boolean default false;
alter table public.materiais_biblioteca add column if not exists criado_por uuid references public.perfis(id) on delete set null default auth.uid();
alter table public.materiais_biblioteca add column if not exists created_at timestamptz default now();
alter table public.materiais_biblioteca add column if not exists updated_at timestamptz default now();

create index if not exists idx_materiais_biblioteca_publicados
  on public.materiais_biblioteca (materia, categoria, titulo)
  where publicado and verificado;
create unique index if not exists idx_materiais_biblioteca_storage_path
  on public.materiais_biblioteca (storage_path)
  where storage_path is not null;

create unique index if not exists idx_solicitacao_ativa_aluno_livro
  on public.solicitacoes_emprestimo (aluno_id, livro_id)
  where status in ('pendente', 'aprovado', 'emprestado');

alter table public.notificacoes
  add column if not exists destino_usuario_id uuid references public.perfis(id) on delete cascade;
create index if not exists notificacoes_usuario_created_idx
  on public.notificacoes (destino_usuario_id, created_at desc)
  where destino_usuario_id is not null;

drop policy if exists notificacoes_select on public.notificacoes;
create policy notificacoes_select on public.notificacoes for select to authenticated using (
  (expira_em is null or expira_em > now()) and (
    (select public.usuario_role()) = 'gestor'
    or criado_por = (select auth.uid())
    or destino_usuario_id = (select auth.uid())
    or (destino_usuario_id is null and destino_turma_id is null)
    or (destino_usuario_id is null and destino_turma_id in (select pt.turma_id from public.professor_turmas pt where pt.professor_id = (select auth.uid())))
    or (destino_usuario_id is null and destino_turma_id = (select p.turma_id from public.perfis p where p.id = (select auth.uid())))
  )
);

drop policy if exists notificacoes_insert on public.notificacoes;
create policy notificacoes_insert on public.notificacoes for insert to authenticated with check (
  criado_por = (select auth.uid()) and (
    (select public.usuario_role()) = 'gestor'
    or ((select public.usuario_role()) = 'bibliotecaria' and destino_usuario_id is not null and tipo = 'biblioteca')
    or ((select public.usuario_role()) = 'professor' and destino_usuario_id is null and destino_turma_id in (select pt.turma_id from public.professor_turmas pt where pt.professor_id = (select auth.uid())))
  )
);

drop trigger if exists set_materiais_biblioteca_updated_at on public.materiais_biblioteca;
create trigger set_materiais_biblioteca_updated_at
before update on public.materiais_biblioteca
for each row execute function public.set_updated_at();

alter table public.materiais_biblioteca enable row level security;
grant select, insert, update, delete on table public.materiais_biblioteca to authenticated;

drop policy if exists materiais_biblioteca_select on public.materiais_biblioteca;
create policy materiais_biblioteca_select
  on public.materiais_biblioteca for select to authenticated
  using (
    (publicado and verificado)
    or public.usuario_role() in ('bibliotecaria', 'gestor')
  );

drop policy if exists materiais_biblioteca_staff_write on public.materiais_biblioteca;
create policy materiais_biblioteca_staff_write
  on public.materiais_biblioteca for all to authenticated
  using (public.usuario_role() in ('bibliotecaria', 'gestor'))
  with check (public.usuario_role() in ('bibliotecaria', 'gestor'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('biblioteca-pdfs', 'biblioteca-pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists biblioteca_pdfs_read_verified on storage.objects;
create policy biblioteca_pdfs_read_verified
  on storage.objects for select to authenticated
  using (
    bucket_id = 'biblioteca-pdfs'
    and exists (
      select 1 from public.materiais_biblioteca material
      where material.storage_bucket = bucket_id
        and material.storage_path = name
        and material.publicado
        and material.verificado
    )
  );

drop policy if exists biblioteca_pdfs_staff_insert on storage.objects;
create policy biblioteca_pdfs_staff_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'biblioteca-pdfs' and public.usuario_role() in ('bibliotecaria', 'gestor'));

drop policy if exists biblioteca_pdfs_staff_update on storage.objects;
create policy biblioteca_pdfs_staff_update
  on storage.objects for update to authenticated
  using (bucket_id = 'biblioteca-pdfs' and public.usuario_role() in ('bibliotecaria', 'gestor'))
  with check (bucket_id = 'biblioteca-pdfs' and public.usuario_role() in ('bibliotecaria', 'gestor'));

drop policy if exists biblioteca_pdfs_staff_delete on storage.objects;
create policy biblioteca_pdfs_staff_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'biblioteca-pdfs' and public.usuario_role() in ('bibliotecaria', 'gestor'));

create or replace function public.biblioteca_solicitar_livro(p_livro_id uuid)
returns public.solicitacoes_emprestimo
language plpgsql security definer set search_path = '' as $$
declare resultado public.solicitacoes_emprestimo; disponiveis integer; pendentes integer;
begin
  if public.usuario_role() <> 'aluno' then raise exception 'Apenas alunos podem solicitar livros'; end if;
  if not public.biblioteca_pode_solicitar((select auth.uid())) then
    raise exception 'Limite de empréstimos atingido ou existe devolução atrasada';
  end if;
  select quantidade_disponivel into disponiveis from public.livros where id = p_livro_id for update;
  if disponiveis is null then raise exception 'Livro não encontrado'; end if;
  select count(*) into pendentes from public.solicitacoes_emprestimo where livro_id = p_livro_id and status = 'pendente';
  if disponiveis <= pendentes or not exists (
    select 1 from public.exemplares where livro_id = p_livro_id and status = 'disponivel'
  ) then raise exception 'Nenhum exemplar disponível no momento'; end if;

  insert into public.solicitacoes_emprestimo (livro_id, aluno_id, status)
  values (p_livro_id, (select auth.uid()), 'pendente')
  returning * into resultado;
  return resultado;
exception when unique_violation then
  raise exception 'Você já possui uma solicitação ativa para este livro';
end; $$;

create or replace function public.biblioteca_separar_solicitacao(p_solicitacao_id uuid)
returns public.solicitacoes_emprestimo
language plpgsql security definer set search_path = '' as $$
declare
  pedido public.solicitacoes_emprestimo;
  exemplar public.exemplares;
  resultado public.solicitacoes_emprestimo;
  localizacao text;
  titulo_livro text;
begin
  if public.usuario_role() not in ('bibliotecaria', 'gestor') then raise exception 'Sem permissão'; end if;

  select * into pedido from public.solicitacoes_emprestimo
  where id = p_solicitacao_id and status = 'pendente'
  for update;
  if pedido.id is null then raise exception 'Solicitação não está pendente'; end if;

  select * into exemplar from public.exemplares
  where livro_id = pedido.livro_id and status = 'disponivel'
  order by numero_serie for update skip locked limit 1;
  if exemplar.id is null then raise exception 'Livro sem exemplar disponível'; end if;

  update public.exemplares set status = 'reservado' where id = exemplar.id;
  update public.livros
    set quantidade_disponivel = quantidade_disponivel - 1
    where id = pedido.livro_id and quantidade_disponivel > 0;
  if not found then raise exception 'Livro sem disponibilidade registrada'; end if;

  select coalesce(sf.nome, sb.nome), l.titulo into localizacao, titulo_livro
  from public.livros l
  left join public.secoes_fisicas sf on sf.id = exemplar.secao_fisica_id
  left join public.secoes_biblioteca sb on sb.id = exemplar.secao_id
  where l.id = pedido.livro_id;
  update public.solicitacoes_emprestimo set
    status = 'aprovado', exemplar_id = exemplar.id,
    aprovado_em = now(), aprovado_por = (select auth.uid()),
    observacao = concat('Separado em ', coalesce(localizacao, 'localização pendente'),
      ' · Exemplar ', exemplar.numero_serie)
  where id = pedido.id returning * into resultado;
  insert into public.notificacoes (titulo, mensagem, tipo, prioridade, destino_usuario_id, criado_por, link)
  values ('Livro pronto para retirada', concat('O exemplar de “', titulo_livro, '” foi separado em ', coalesce(localizacao, 'localização pendente'), '.'), 'biblioteca', 'alta', pedido.aluno_id, (select auth.uid()), 'frontend/aluno/biblioteca_digital/index.html');
  return resultado;
end; $$;

create or replace function public.biblioteca_aprovar_solicitacao(p_solicitacao_id uuid, p_aprovado_por uuid)
returns public.solicitacoes_emprestimo
language plpgsql security definer set search_path = '' as $$
begin
  if p_aprovado_por is distinct from (select auth.uid()) then raise exception 'Responsável inválido'; end if;
  return public.biblioteca_separar_solicitacao(p_solicitacao_id);
end; $$;

create or replace function public.biblioteca_confirmar_entrega(p_solicitacao_id uuid)
returns public.solicitacoes_emprestimo
language plpgsql security definer set search_path = '' as $$
declare resultado public.solicitacoes_emprestimo; prazo integer; pedido public.solicitacoes_emprestimo;
begin
  if public.usuario_role() not in ('bibliotecaria', 'gestor') then raise exception 'Sem permissão'; end if;
  select * into pedido from public.solicitacoes_emprestimo
    where id = p_solicitacao_id and status = 'aprovado' for update;
  if pedido.id is null or pedido.exemplar_id is null then raise exception 'Separe um exemplar antes da entrega'; end if;
  perform 1 from public.exemplares where id = pedido.exemplar_id and status = 'reservado' for update;
  if not found then raise exception 'O exemplar reservado não está disponível para entrega'; end if;
  select prazo_dias into prazo from public.configuracoes_biblioteca where id = true;
  update public.exemplares set status = 'emprestado' where id = pedido.exemplar_id;
  update public.solicitacoes_emprestimo set status = 'emprestado', retirada_em = now(),
    devolucao_prevista_em = now() + make_interval(days => coalesce(prazo, 15))
  where id = pedido.id returning * into resultado;
  insert into public.notificacoes (titulo, mensagem, tipo, prioridade, destino_usuario_id, criado_por, link)
  values ('Retirada confirmada', concat('Empréstimo confirmado. Devolva até ', to_char(resultado.devolucao_prevista_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), '.'), 'biblioteca', 'normal', pedido.aluno_id, (select auth.uid()), 'frontend/aluno/biblioteca_digital/index.html');
  return resultado;
end; $$;

create or replace function public.biblioteca_recusar_solicitacao(p_solicitacao_id uuid, p_motivo text default null)
returns public.solicitacoes_emprestimo
language plpgsql security definer set search_path = '' as $$
declare pedido public.solicitacoes_emprestimo; resultado public.solicitacoes_emprestimo;
begin
  if public.usuario_role() not in ('bibliotecaria', 'gestor') then raise exception 'Sem permissão'; end if;
  select * into pedido from public.solicitacoes_emprestimo
    where id = p_solicitacao_id and status in ('pendente', 'aprovado') for update;
  if pedido.id is null then raise exception 'Solicitação não pode ser recusada'; end if;
  if pedido.exemplar_id is not null then
    update public.exemplares set status = 'disponivel' where id = pedido.exemplar_id and status = 'reservado';
    if found then update public.livros set quantidade_disponivel = least(quantidade_total, quantidade_disponivel + 1) where id = pedido.livro_id; end if;
  end if;
  update public.solicitacoes_emprestimo set status = 'recusado', observacao = nullif(btrim(p_motivo), '')
    where id = pedido.id returning * into resultado;
  insert into public.notificacoes (titulo, mensagem, tipo, prioridade, destino_usuario_id, criado_por, link)
  values ('Atualização do pedido', coalesce(nullif(btrim(p_motivo), ''), 'A solicitação não pôde ser atendida.'), 'biblioteca', 'normal', pedido.aluno_id, (select auth.uid()), 'frontend/aluno/biblioteca_digital/index.html');
  return resultado;
end; $$;

create or replace function public.biblioteca_atualizar_status_exemplar(p_exemplar_id uuid, p_status text)
returns public.exemplares
language plpgsql security definer set search_path = '' as $$
declare exemplar public.exemplares; resultado public.exemplares;
begin
  if public.usuario_role() not in ('bibliotecaria', 'gestor') then raise exception 'Sem permissão'; end if;
  if p_status not in ('disponivel', 'manutencao') then raise exception 'Status manual inválido'; end if;
  select * into exemplar from public.exemplares where id = p_exemplar_id for update;
  if exemplar.id is null then raise exception 'Exemplar não encontrado'; end if;
  if exemplar.status in ('reservado', 'emprestado') then raise exception 'Finalize a circulação antes de alterar este exemplar'; end if;
  if exemplar.status is distinct from p_status then
    update public.livros set quantidade_disponivel = greatest(0, least(quantidade_total,
      quantidade_disponivel + case when p_status = 'disponivel' then 1 else -1 end))
    where id = exemplar.livro_id;
  end if;
  update public.exemplares set status = p_status where id = exemplar.id returning * into resultado;
  return resultado;
end; $$;

create or replace function public.biblioteca_registrar_devolucao(p_solicitacao_id uuid)
returns public.solicitacoes_emprestimo language plpgsql security definer set search_path = '' as $$
declare resultado public.solicitacoes_emprestimo; titulo_livro text;
begin
  if public.usuario_role() not in ('bibliotecaria', 'gestor') then raise exception 'Sem permissão'; end if;
  update public.solicitacoes_emprestimo set status = 'devolvido', devolvido_em = now()
  where id = p_solicitacao_id and status = 'emprestado' returning * into resultado;
  if resultado.id is null then raise exception 'Empréstimo não está ativo'; end if;
  if resultado.exemplar_id is not null then update public.exemplares set status = 'disponivel' where id = resultado.exemplar_id; end if;
  update public.livros set quantidade_disponivel = least(quantidade_total, quantidade_disponivel + 1)
  where id = resultado.livro_id returning titulo into titulo_livro;
  insert into public.notificacoes (titulo, mensagem, tipo, prioridade, destino_usuario_id, criado_por, link)
  values ('Devolução registrada', concat('A devolução de “', titulo_livro, '” foi concluída. Obrigado!'), 'biblioteca', 'baixa', resultado.aluno_id, (select auth.uid()), 'frontend/aluno/biblioteca_digital/index.html');
  return resultado;
end; $$;

revoke insert on table public.solicitacoes_emprestimo from authenticated;
revoke all on function public.biblioteca_solicitar_livro(uuid) from public, anon, authenticated;
revoke all on function public.biblioteca_separar_solicitacao(uuid) from public, anon, authenticated;
revoke all on function public.biblioteca_recusar_solicitacao(uuid, text) from public, anon, authenticated;
revoke all on function public.biblioteca_aprovar_solicitacao(uuid, uuid) from public, anon, authenticated;
revoke all on function public.biblioteca_confirmar_entrega(uuid) from public, anon, authenticated;
revoke all on function public.biblioteca_atualizar_status_exemplar(uuid, text) from public, anon, authenticated;
revoke all on function public.biblioteca_registrar_devolucao(uuid) from public, anon, authenticated;
grant execute on function public.biblioteca_solicitar_livro(uuid) to authenticated;
grant execute on function public.biblioteca_separar_solicitacao(uuid) to authenticated;
grant execute on function public.biblioteca_recusar_solicitacao(uuid, text) to authenticated;
grant execute on function public.biblioteca_aprovar_solicitacao(uuid, uuid) to authenticated;
grant execute on function public.biblioteca_confirmar_entrega(uuid) to authenticated;
grant execute on function public.biblioteca_atualizar_status_exemplar(uuid, text) to authenticated;
grant execute on function public.biblioteca_registrar_devolucao(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'solicitacoes_emprestimo') then alter publication supabase_realtime add table public.solicitacoes_emprestimo; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'livros') then alter publication supabase_realtime add table public.livros; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'materiais_biblioteca') then alter publication supabase_realtime add table public.materiais_biblioteca; end if;
end $$;

-- ============================================================================
-- ETAPA 13/23: migrations/20260903_portal_gestor.sql
-- ============================================================================

alter table public.perfis add column if not exists email_contato text;
alter table public.perfis add column if not exists ativo boolean not null default true;
alter table public.perfis add column if not exists primeiro_acesso_pendente boolean not null default false;
alter table public.perfis add column if not exists ultimo_acesso_em timestamptz;

update public.perfis p set email_contato = u.email
from auth.users u where u.id = p.id and p.email_contato is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  nova_role public.perfil_role;
begin
  nova_role := case new.raw_user_meta_data ->> 'role'
    when 'professor' then 'professor'::public.perfil_role
    when 'bibliotecaria' then 'bibliotecaria'::public.perfil_role
    when 'gestor' then 'gestor'::public.perfil_role
    else 'aluno'::public.perfil_role
  end;
  insert into public.perfis (id,nome,matricula,role,curso_tecnico,tipo_professor,email_contato,primeiro_acesso_pendente)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome',new.email,'Novo usuário'),
    new.raw_user_meta_data ->> 'matricula',
    nova_role,
    case when nova_role='aluno' then case new.raw_user_meta_data ->> 'curso_tecnico' when 'administracao' then 'administracao'::public.curso_tecnico when 'informatica' then 'informatica'::public.curso_tecnico end end,
    case when nova_role='professor' then case new.raw_user_meta_data ->> 'tipo_professor' when 'matematica' then 'matematica'::public.tipo_professor when 'portugues' then 'portugues'::public.tipo_professor when 'tecnico_administracao' then 'tecnico_administracao'::public.tipo_professor when 'tecnico_informatica' then 'tecnico_informatica'::public.tipo_professor end end,
    new.email,
    coalesce((new.raw_user_meta_data ->> 'primeiro_acesso_pendente')::boolean,false)
  ) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create unique index if not exists perfis_email_contato_lower_uidx
  on public.perfis (lower(email_contato)) where email_contato is not null;

create table if not exists public.descritores_curriculares (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  titulo text not null,
  descricao text,
  materia_codigo public.materia_aluno not null,
  serie smallint not null check (serie between 1 and 3),
  trimestre smallint not null check (trimestre between 1 and 3),
  status text not null default 'ativo' check (status in ('ativo','revisao','arquivado')),
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.solicitacoes_acesso (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.perfis(id) on delete cascade,
  solicitado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  tipo text not null check (tipo in ('criacao','redefinicao','bloqueio','desbloqueio')),
  status text not null default 'pendente' check (status in ('pendente','concluida','falhou')),
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  concluida_em timestamptz
);

create table if not exists public.gestor_auditoria (
  id uuid primary key default gen_random_uuid(),
  gestor_id uuid references public.perfis(id) on delete set null default auth.uid(),
  acao text not null,
  recurso text not null,
  recurso_id text,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists descritores_curriculares_filtros_idx on public.descritores_curriculares (materia_codigo, serie, trimestre, status);
create index if not exists solicitacoes_acesso_status_idx on public.solicitacoes_acesso (status, created_at desc);
create index if not exists gestor_auditoria_created_idx on public.gestor_auditoria (created_at desc);

alter table public.descritores_curriculares enable row level security;
alter table public.solicitacoes_acesso enable row level security;
alter table public.gestor_auditoria enable row level security;

drop policy if exists descritores_leitura on public.descritores_curriculares;
create policy descritores_leitura on public.descritores_curriculares for select to authenticated using (true);
drop policy if exists descritores_gestor on public.descritores_curriculares;
create policy descritores_gestor on public.descritores_curriculares for all to authenticated
using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');

drop policy if exists solicitacoes_acesso_gestor on public.solicitacoes_acesso;
create policy solicitacoes_acesso_gestor on public.solicitacoes_acesso for select to authenticated
using ((select public.usuario_role()) = 'gestor');
drop policy if exists solicitacoes_acesso_criar_gestor on public.solicitacoes_acesso;
create policy solicitacoes_acesso_criar_gestor on public.solicitacoes_acesso for insert to authenticated
with check ((select public.usuario_role()) = 'gestor' and solicitado_por = (select auth.uid()));

drop policy if exists gestor_auditoria_leitura on public.gestor_auditoria;
create policy gestor_auditoria_leitura on public.gestor_auditoria for select to authenticated
using ((select public.usuario_role()) = 'gestor');

grant select on public.descritores_curriculares to authenticated;
grant insert, update, delete on public.descritores_curriculares to authenticated;
grant select, insert on public.solicitacoes_acesso to authenticated;
grant select on public.gestor_auditoria to authenticated;

-- ============================================================================
-- ETAPA 14/23: migrations/20260903_importacao_curricular.sql
-- ============================================================================

alter table public.descritores_curriculares
  alter column serie drop not null,
  alter column trimestre drop not null;

create table if not exists public.curriculos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  origem text not null,
  ano_letivo smallint not null check (ano_letivo between 2000 and 2100),
  materia_codigo public.materia_aluno not null,
  modalidade text not null default 'Ensino Médio',
  versao integer not null default 1 check (versao > 0),
  versao_em timestamptz not null default now(),
  status text not null default 'rascunho' check (status in ('rascunho','aprovado','publicado','arquivado')),
  ativo boolean not null default true,
  documento_origem_id uuid,
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (origem, ano_letivo, materia_codigo, versao)
);

create table if not exists public.curriculo_periodos (
  id uuid primary key default gen_random_uuid(),
  curriculo_id uuid not null references public.curriculos(id) on delete cascade,
  serie smallint not null check (serie between 1 and 3),
  trimestre smallint not null check (trimestre between 1 and 3),
  unique (curriculo_id, serie, trimestre)
);

create table if not exists public.habilidades_curriculares (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  descricao text not null,
  materia_codigo public.materia_aluno not null,
  modalidade text not null default 'Ensino Médio',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (codigo, materia_codigo)
);

create table if not exists public.habilidade_curriculo_periodos (
  habilidade_id uuid not null references public.habilidades_curriculares(id) on delete cascade,
  periodo_id uuid not null references public.curriculo_periodos(id) on delete cascade,
  quinzena text,
  semana text,
  source_page integer check (source_page is null or source_page > 0),
  primary key (habilidade_id, periodo_id)
);

create table if not exists public.habilidade_descritores (
  habilidade_id uuid not null references public.habilidades_curriculares(id) on delete cascade,
  descritor_id uuid not null references public.descritores_curriculares(id) on delete restrict,
  periodo_id uuid not null references public.curriculo_periodos(id) on delete cascade,
  primary key (habilidade_id, descritor_id, periodo_id)
);

create table if not exists public.expectativas_aprendizagem (
  id uuid primary key default gen_random_uuid(),
  habilidade_id uuid not null references public.habilidades_curriculares(id) on delete cascade,
  periodo_id uuid not null references public.curriculo_periodos(id) on delete cascade,
  descricao text not null,
  unique (habilidade_id, periodo_id, descricao)
);

create table if not exists public.objetos_conhecimento (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  unique (descricao)
);

create table if not exists public.habilidade_objetos (
  habilidade_id uuid not null references public.habilidades_curriculares(id) on delete cascade,
  objeto_id uuid not null references public.objetos_conhecimento(id) on delete restrict,
  periodo_id uuid not null references public.curriculo_periodos(id) on delete cascade,
  primary key (habilidade_id, objeto_id, periodo_id)
);

create table if not exists public.importacoes_curriculo (
  id uuid primary key default gen_random_uuid(),
  nome_arquivo text not null,
  arquivo_hash_sha256 text not null check (arquivo_hash_sha256 ~ '^[a-f0-9]{64}$'),
  origem text,
  ano_letivo smallint check (ano_letivo is null or ano_letivo between 2000 and 2100),
  materia_codigo public.materia_aluno,
  trimestre smallint check (trimestre is null or trimestre between 1 and 3),
  status text not null default 'upload' check (status in ('upload','processando','revisao','aprovada','rejeitada','erro')),
  erro text,
  resumo jsonb not null default '{}'::jsonb,
  documento_texto_extraido text,
  importado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (arquivo_hash_sha256)
);

create table if not exists public.importacoes_curriculo_itens (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null references public.importacoes_curriculo(id) on delete cascade,
  tipo text not null check (tipo in ('habilidade','descritor','aviso')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  confianca numeric(5,2) not null default 0 check (confianca between 0 and 100),
  status text not null default 'revisar' check (status in ('ok','revisar','rejeitado','aprovado')),
  source_page integer check (source_page is null or source_page > 0),
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists curriculos_filtro_idx on public.curriculos (materia_codigo, ano_letivo, status);
create index if not exists curriculo_periodos_busca_idx on public.curriculo_periodos (curriculo_id, serie, trimestre);
create index if not exists habilidades_codigo_idx on public.habilidades_curriculares (codigo, materia_codigo);
create index if not exists importacoes_status_idx on public.importacoes_curriculo (status, created_at desc);
create index if not exists importacoes_itens_importacao_idx on public.importacoes_curriculo_itens (importacao_id, tipo, status);

alter table public.curriculos enable row level security;
alter table public.curriculo_periodos enable row level security;
alter table public.habilidades_curriculares enable row level security;
alter table public.habilidade_curriculo_periodos enable row level security;
alter table public.habilidade_descritores enable row level security;
alter table public.expectativas_aprendizagem enable row level security;
alter table public.objetos_conhecimento enable row level security;
alter table public.habilidade_objetos enable row level security;
alter table public.importacoes_curriculo enable row level security;
alter table public.importacoes_curriculo_itens enable row level security;

drop policy if exists curriculos_leitura on public.curriculos;
create policy curriculos_leitura on public.curriculos for select to authenticated using (status = 'publicado' or (select public.usuario_role()) = 'gestor');
drop policy if exists curriculos_gestor on public.curriculos;
create policy curriculos_gestor on public.curriculos for all to authenticated using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');
drop policy if exists curriculo_periodos_leitura on public.curriculo_periodos;
create policy curriculo_periodos_leitura on public.curriculo_periodos for select to authenticated using (exists (select 1 from public.curriculos c where c.id = curriculo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists curriculo_periodos_gestor on public.curriculo_periodos;
create policy curriculo_periodos_gestor on public.curriculo_periodos for all to authenticated using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');
drop policy if exists habilidades_leitura on public.habilidades_curriculares;
create policy habilidades_leitura on public.habilidades_curriculares for select to authenticated using ((select public.usuario_role()) is not null);
drop policy if exists habilidades_gestor on public.habilidades_curriculares;
create policy habilidades_gestor on public.habilidades_curriculares for all to authenticated using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');
drop policy if exists habilidade_periodos_leitura on public.habilidade_curriculo_periodos;
create policy habilidade_periodos_leitura on public.habilidade_curriculo_periodos for select to authenticated using (exists (select 1 from public.curriculo_periodos p join public.curriculos c on c.id = p.curriculo_id where p.id = periodo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists habilidade_descritores_leitura on public.habilidade_descritores;
create policy habilidade_descritores_leitura on public.habilidade_descritores for select to authenticated using (exists (select 1 from public.curriculo_periodos p join public.curriculos c on c.id = p.curriculo_id where p.id = periodo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists expectativas_leitura on public.expectativas_aprendizagem;
create policy expectativas_leitura on public.expectativas_aprendizagem for select to authenticated using (exists (select 1 from public.curriculo_periodos p join public.curriculos c on c.id = p.curriculo_id where p.id = periodo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists objetos_leitura on public.objetos_conhecimento;
create policy objetos_leitura on public.objetos_conhecimento for select to authenticated using (exists (select 1 from public.habilidade_objetos ho join public.curriculo_periodos p on p.id = ho.periodo_id join public.curriculos c on c.id = p.curriculo_id where ho.objeto_id = public.objetos_conhecimento.id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists habilidade_objetos_leitura on public.habilidade_objetos;
create policy habilidade_objetos_leitura on public.habilidade_objetos for select to authenticated using (exists (select 1 from public.curriculo_periodos p join public.curriculos c on c.id = p.curriculo_id where p.id = periodo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists importacoes_gestor on public.importacoes_curriculo;
create policy importacoes_gestor on public.importacoes_curriculo for all to authenticated using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');
drop policy if exists importacoes_itens_gestor on public.importacoes_curriculo_itens;
create policy importacoes_itens_gestor on public.importacoes_curriculo_itens for all to authenticated using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');

grant select on public.curriculos, public.curriculo_periodos, public.habilidades_curriculares, public.habilidade_curriculo_periodos, public.habilidade_descritores, public.expectativas_aprendizagem, public.objetos_conhecimento, public.habilidade_objetos to authenticated;
grant select, insert, update, delete on public.curriculos, public.curriculo_periodos, public.habilidades_curriculares, public.habilidade_curriculo_periodos, public.habilidade_descritores, public.expectativas_aprendizagem, public.objetos_conhecimento, public.habilidade_objetos, public.importacoes_curriculo, public.importacoes_curriculo_itens to authenticated;

create or replace function public.aprovar_importacao_curriculo(p_importacao_id uuid)
returns uuid
language plpgsql
 security definer set search_path = ''
as $$
declare
  imp public.importacoes_curriculo;
  curr public.curriculos;
  periodo public.curriculo_periodos;
  habilidade public.habilidades_curriculares;
  descritor public.descritores_curriculares;
  objeto public.objetos_conhecimento;
  item jsonb;
  child jsonb;
  serie_num smallint;
  tri_num smallint;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem aprovar importações'; end if;
  select * into imp from public.importacoes_curriculo where id = p_importacao_id for update;
  if imp.id is null then raise exception 'Importação não encontrada'; end if;
  if imp.status <> 'revisao' then raise exception 'A importação precisa estar em revisão'; end if;

  select * into curr from public.curriculos
    where origem = coalesce(imp.origem, 'Não identificada')
      and ano_letivo = imp.ano_letivo and materia_codigo = imp.materia_codigo
      and status <> 'arquivado'
    order by versao desc limit 1;
  if curr.id is null then
    insert into public.curriculos (nome, origem, ano_letivo, materia_codigo, criado_por)
    values (coalesce(imp.origem, 'Currículo importado') || ' ' || imp.ano_letivo,
      coalesce(imp.origem, 'Não identificada'), imp.ano_letivo, imp.materia_codigo, imp.importado_por)
    returning * into curr;
  end if;

  for item in select payload from public.importacoes_curriculo_itens
    where importacao_id = imp.id and tipo = 'habilidade' and status <> 'rejeitado'
  loop
    serie_num := nullif((item ->> 'serie')::smallint, 0);
    tri_num := coalesce(nullif((item ->> 'trimestre')::smallint, 0), imp.trimestre);
    if serie_num is null or tri_num is null then continue; end if;
    insert into public.curriculo_periodos (curriculo_id, serie, trimestre)
    values (curr.id, serie_num, tri_num)
    on conflict (curriculo_id, serie, trimestre) do update set trimestre = excluded.trimestre
    returning * into periodo;
    insert into public.habilidades_curriculares (codigo, descricao, materia_codigo)
    values (upper(item ->> 'codigo'), coalesce(nullif(item ->> 'descricao', ''), 'Descrição pendente'), imp.materia_codigo)
    on conflict (codigo, materia_codigo) do update set descricao = case when public.habilidades_curriculares.descricao = 'Descrição pendente' then excluded.descricao else public.habilidades_curriculares.descricao end
    returning * into habilidade;
    insert into public.habilidade_curriculo_periodos (habilidade_id, periodo_id, quinzena, semana, source_page)
    values (habilidade.id, periodo.id, item ->> 'quinzena', item ->> 'semana', nullif(item ->> 'source_page', '')::integer)
    on conflict (habilidade_id, periodo_id) do update set quinzena = excluded.quinzena, semana = excluded.semana, source_page = excluded.source_page;
    for child in select value from jsonb_array_elements(coalesce(item -> 'descritores', '[]'::jsonb))
    loop
      insert into public.descritores_curriculares (codigo, titulo, descricao, materia_codigo, serie, trimestre, status)
      values (upper(child ->> 'code'), upper(child ->> 'code'), nullif(child ->> 'descricao', ''), imp.materia_codigo, serie_num, tri_num, 'revisao')
      on conflict (codigo) do update set descricao = coalesce(public.descritores_curriculares.descricao, excluded.descricao)
      returning * into descritor;
      insert into public.habilidade_descritores values (habilidade.id, descritor.id, periodo.id) on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'expectativas', '[]'::jsonb))
    loop
      insert into public.expectativas_aprendizagem (habilidade_id, periodo_id, descricao) values (habilidade.id, periodo.id, child #>> '{}') on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'objetos', '[]'::jsonb))
    loop
      insert into public.objetos_conhecimento (descricao) values (child #>> '{}') on conflict (descricao) do update set descricao = excluded.descricao returning * into objeto;
      insert into public.habilidade_objetos values (habilidade.id, objeto.id, periodo.id) on conflict do nothing;
    end loop;
  end loop;
  update public.importacoes_curriculo set status = 'aprovada', updated_at = now() where id = imp.id;
  update public.curriculos set status = 'aprovado', updated_at = now() where id = curr.id;
  return curr.id;
end;
$$;

revoke all on function public.aprovar_importacao_curriculo(uuid) from public, anon, authenticated;
grant execute on function public.aprovar_importacao_curriculo(uuid) to authenticated;

-- ============================================================================
-- ETAPA 15/23: migrations/20260903_importacao_curricular_fase1.sql
-- ============================================================================

alter table public.importacoes_curriculo
  add column if not exists curriculo_id uuid references public.curriculos(id) on delete set null,
  add column if not exists versao integer;

update public.curriculos
set status = 'publicado', updated_at = now()
where status = 'aprovado';

create or replace function public.aprovar_importacao_curriculo(p_importacao_id uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  imp public.importacoes_curriculo;
  novo_curriculo_id uuid;
  proxima_versao integer;
  periodo public.curriculo_periodos;
  habilidade public.habilidades_curriculares;
  descritor public.descritores_curriculares;
  objeto public.objetos_conhecimento;
  item jsonb;
  child jsonb;
  serie_num smallint;
  tri_num smallint;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem aprovar importações'; end if;
  select * into imp from public.importacoes_curriculo where id = p_importacao_id for update;
  if imp.id is null then raise exception 'Importação não encontrada'; end if;
  if imp.status <> 'revisao' then raise exception 'A importação precisa estar em revisão'; end if;
  if imp.materia_codigo is null then raise exception 'Componente curricular não identificado'; end if;

  select coalesce(max(versao), 0) + 1 into proxima_versao
  from public.curriculos
  where origem = coalesce(imp.origem, 'Não identificada')
    and ano_letivo = imp.ano_letivo
    and materia_codigo = imp.materia_codigo;

  insert into public.curriculos (nome, origem, ano_letivo, materia_codigo, versao, status, criado_por)
  values (
    coalesce(imp.origem, 'Currículo importado') || ' ' || imp.ano_letivo,
    coalesce(imp.origem, 'Não identificada'), imp.ano_letivo,
    imp.materia_codigo, proxima_versao, 'publicado', imp.importado_por
  ) returning id into novo_curriculo_id;

  for item in select payload from public.importacoes_curriculo_itens
    where importacao_id = imp.id and tipo = 'habilidade' and status not in ('rejeitado', 'revisar')
  loop
    serie_num := nullif((item ->> 'serie')::smallint, 0);
    tri_num := coalesce(nullif((item ->> 'trimestre')::smallint, 0), imp.trimestre);
    if serie_num is null or tri_num is null then continue; end if;
    insert into public.curriculo_periodos (curriculo_id, serie, trimestre)
    values (novo_curriculo_id, serie_num, tri_num)
    on conflict (curriculo_id, serie, trimestre) do update set trimestre = excluded.trimestre
    returning * into periodo;
    insert into public.habilidades_curriculares (codigo, descricao, materia_codigo)
    values (upper(item ->> 'codigo'), coalesce(nullif(item ->> 'descricao', ''), 'Descrição pendente'), imp.materia_codigo)
    on conflict (codigo, materia_codigo) do update set descricao = case when public.habilidades_curriculares.descricao = 'Descrição pendente' then excluded.descricao else public.habilidades_curriculares.descricao end
    returning * into habilidade;
    insert into public.habilidade_curriculo_periodos (habilidade_id, periodo_id, quinzena, semana, source_page)
    values (habilidade.id, periodo.id, item ->> 'quinzena', item ->> 'semana', nullif(item ->> 'source_page', '')::integer)
    on conflict (habilidade_id, periodo_id) do update set quinzena = excluded.quinzena, semana = excluded.semana, source_page = excluded.source_page;
    for child in select value from jsonb_array_elements(coalesce(item -> 'descritores', '[]'::jsonb))
    loop
      insert into public.descritores_curriculares (codigo, titulo, descricao, materia_codigo, serie, trimestre, status)
      values (upper(child ->> 'code'), upper(child ->> 'code'), nullif(child ->> 'descricao', ''), imp.materia_codigo, serie_num, tri_num, 'revisao')
      on conflict (codigo) do update set descricao = coalesce(public.descritores_curriculares.descricao, excluded.descricao)
      returning * into descritor;
      insert into public.habilidade_descritores values (habilidade.id, descritor.id, periodo.id) on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'expectativas', '[]'::jsonb))
    loop
      insert into public.expectativas_aprendizagem (habilidade_id, periodo_id, descricao) values (habilidade.id, periodo.id, child #>> '{}') on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'objetos', '[]'::jsonb))
    loop
      insert into public.objetos_conhecimento (descricao) values (child #>> '{}') on conflict (descricao) do update set descricao = excluded.descricao returning * into objeto;
      insert into public.habilidade_objetos values (habilidade.id, objeto.id, periodo.id) on conflict do nothing;
    end loop;
  end loop;
  update public.importacoes_curriculo
  set status = 'aprovada', curriculo_id = novo_curriculo_id, versao = proxima_versao, updated_at = now()
  where id = imp.id;
  return novo_curriculo_id;
end;
$$;

revoke all on function public.aprovar_importacao_curriculo(uuid) from public, anon, authenticated;
grant execute on function public.aprovar_importacao_curriculo(uuid) to authenticated;

-- ============================================================================
-- ETAPA 16/23: migrations/20260903_importacao_curricular_fase2.sql
-- ============================================================================

alter table public.importacoes_curriculo_itens
  drop constraint if exists importacoes_curriculo_itens_tipo_check;
alter table public.importacoes_curriculo_itens
  add constraint importacoes_curriculo_itens_tipo_check
  check (tipo in ('habilidade','referencia_ensino_fundamental','descritor','aviso'));

-- ============================================================================
-- ETAPA 17/23: migrations/20260903_importacao_curricular_fase3.sql
-- ============================================================================

create table if not exists public.documentos_curriculares (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'curriculos-pdfs',
  storage_path text not null unique,
  nome_arquivo text not null,
  mime_type text not null check (mime_type = 'application/pdf'),
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 52428800),
  arquivo_hash_sha256 text not null check (arquivo_hash_sha256 ~ '^[a-f0-9]{64}$'),
  origem text,
  ano_letivo smallint check (ano_letivo is null or ano_letivo between 2000 and 2100),
  materia_codigo public.materia_aluno,
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.importacoes_curriculo
  add column if not exists documento_id uuid references public.documentos_curriculares(id) on delete set null,
  add column if not exists reprocessamento_de_id uuid references public.importacoes_curriculo(id) on delete set null;
alter table public.importacoes_curriculo drop constraint if exists importacoes_curriculo_arquivo_hash_sha256_key;
create unique index if not exists importacoes_curriculo_hash_original_uidx
  on public.importacoes_curriculo (arquivo_hash_sha256)
  where reprocessamento_de_id is null;

alter table public.curriculos
  add column if not exists importacao_id uuid references public.importacoes_curriculo(id) on delete set null;

grant select, insert, update, delete on public.documentos_curriculares to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('curriculos-pdfs', 'curriculos-pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = array['application/pdf'];

drop policy if exists curriculos_leitura on public.curriculos;
create policy curriculos_leitura on public.curriculos for select to authenticated
using (status = 'publicado' or (select public.usuario_role()) = 'gestor');
drop policy if exists curriculos_gestor on public.curriculos;
create policy curriculos_gestor on public.curriculos for all to authenticated
using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');

drop policy if exists descritores_leitura on public.descritores_curriculares;
create policy descritores_leitura on public.descritores_curriculares for select to authenticated
using (status = 'ativo' and exists (
  select 1 from public.habilidade_descritores hd
  join public.curriculo_periodos cp on cp.id = hd.periodo_id
  join public.curriculos c on c.id = cp.curriculo_id
  where hd.descritor_id = descritores_curriculares.id and c.status = 'publicado'
) or (select public.usuario_role()) = 'gestor');
drop policy if exists descritores_gestor on public.descritores_curriculares;
create policy descritores_gestor on public.descritores_curriculares for all to authenticated
using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');

 drop policy if exists habilidades_leitura on public.habilidades_curriculares;
create policy habilidades_leitura on public.habilidades_curriculares for select to authenticated
using (exists (
  select 1 from public.habilidade_curriculo_periodos hcp
  join public.curriculo_periodos cp on cp.id = hcp.periodo_id
  join public.curriculos c on c.id = cp.curriculo_id
  where hcp.habilidade_id = habilidades_curriculares.id and c.status = 'publicado'
) or (select public.usuario_role()) = 'gestor');
drop policy if exists habilidades_gestor on public.habilidades_curriculares;
create policy habilidades_gestor on public.habilidades_curriculares for all to authenticated
using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');

drop policy if exists curriculo_periodos_leitura on public.curriculo_periodos;
create policy curriculo_periodos_leitura on public.curriculo_periodos for select to authenticated
using (exists (select 1 from public.curriculos c where c.id = curriculo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists curriculo_periodos_gestor on public.curriculo_periodos;
create policy curriculo_periodos_gestor on public.curriculo_periodos for all to authenticated using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');

 drop policy if exists habilidade_periodos_leitura on public.habilidade_curriculo_periodos;
create policy habilidade_periodos_leitura on public.habilidade_curriculo_periodos for select to authenticated
using (exists (select 1 from public.curriculo_periodos cp join public.curriculos c on c.id = cp.curriculo_id where cp.id = periodo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists habilidade_descritores_leitura on public.habilidade_descritores;
create policy habilidade_descritores_leitura on public.habilidade_descritores for select to authenticated
using (exists (select 1 from public.curriculo_periodos cp join public.curriculos c on c.id = cp.curriculo_id where cp.id = periodo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists expectativas_leitura on public.expectativas_aprendizagem;
create policy expectativas_leitura on public.expectativas_aprendizagem for select to authenticated
using (exists (select 1 from public.curriculo_periodos cp join public.curriculos c on c.id = cp.curriculo_id where cp.id = periodo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists habilidade_objetos_leitura on public.habilidade_objetos;
create policy habilidade_objetos_leitura on public.habilidade_objetos for select to authenticated
using (exists (select 1 from public.curriculo_periodos cp join public.curriculos c on c.id = cp.curriculo_id where cp.id = periodo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists objetos_leitura on public.objetos_conhecimento;
create policy objetos_leitura on public.objetos_conhecimento for select to authenticated
using (exists (select 1 from public.habilidade_objetos ho join public.curriculo_periodos cp on cp.id = ho.periodo_id join public.curriculos c on c.id = cp.curriculo_id where ho.objeto_id = objetos_conhecimento.id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));

drop policy if exists documentos_curriculares_gestor on public.documentos_curriculares;
create policy documentos_curriculares_gestor on public.documentos_curriculares for all to authenticated
using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');
drop policy if exists importacoes_gestor on public.importacoes_curriculo;
create policy importacoes_gestor on public.importacoes_curriculo for all to authenticated using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');
drop policy if exists importacoes_itens_gestor on public.importacoes_curriculo_itens;
create policy importacoes_itens_gestor on public.importacoes_curriculo_itens for all to authenticated using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');

alter table public.documentos_curriculares enable row level security;
create index if not exists documentos_curriculares_hash_idx on public.documentos_curriculares (arquivo_hash_sha256);
create unique index if not exists documentos_curriculares_hash_uidx on public.documentos_curriculares (arquivo_hash_sha256);
create index if not exists importacoes_curriculo_documento_idx on public.importacoes_curriculo (documento_id, created_at desc);

 drop policy if exists curriculos_pdfs_gestor_insert on storage.objects;
create policy curriculos_pdfs_gestor_insert on storage.objects for insert to authenticated
with check (bucket_id = 'curriculos-pdfs' and (select public.usuario_role()) = 'gestor');
drop policy if exists curriculos_pdfs_gestor_select on storage.objects;
create policy curriculos_pdfs_gestor_select on storage.objects for select to authenticated
using (bucket_id = 'curriculos-pdfs' and (select public.usuario_role()) = 'gestor');
drop policy if exists curriculos_pdfs_gestor_update on storage.objects;
create policy curriculos_pdfs_gestor_update on storage.objects for update to authenticated
using (bucket_id = 'curriculos-pdfs' and (select public.usuario_role()) = 'gestor') with check (bucket_id = 'curriculos-pdfs' and (select public.usuario_role()) = 'gestor');
drop policy if exists curriculos_pdfs_gestor_delete on storage.objects;
create policy curriculos_pdfs_gestor_delete on storage.objects for delete to authenticated
using (bucket_id = 'curriculos-pdfs' and (select public.usuario_role()) = 'gestor');

create or replace function public.criar_importacao_curriculo(
  p_documento_id uuid, p_nome_arquivo text, p_hash text, p_tamanho bigint,
  p_origem text, p_ano smallint, p_materia public.materia_aluno,
  p_trimestre smallint, p_resumo jsonb, p_texto text, p_itens jsonb,
  p_reprocessamento_de_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare novo_id uuid; existente public.importacoes_curriculo; item jsonb;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem criar importações'; end if;
  if not exists (select 1 from public.documentos_curriculares where id = p_documento_id and arquivo_hash_sha256 = p_hash) then raise exception 'Documento de origem inválido'; end if;
  if p_nome_arquivo !~* '\\.pdf' or p_tamanho <= 0 or p_tamanho > 52428800 or p_hash !~ '^[a-f0-9]{64}$' or nullif(btrim(p_texto), '') is null then raise exception 'Metadados do PDF ou texto extraído inválidos'; end if;
  if p_reprocessamento_de_id is null then
    select * into existente from public.importacoes_curriculo where arquivo_hash_sha256 = p_hash and reprocessamento_de_id is null limit 1;
    if existente.id is not null then return existente.id; end if;
  end if;
  insert into public.importacoes_curriculo (nome_arquivo, arquivo_hash_sha256, origem, ano_letivo, materia_codigo, trimestre, status, resumo, documento_texto_extraido, documento_id, reprocessamento_de_id)
  values (p_nome_arquivo, p_hash, p_origem, p_ano, p_materia, p_trimestre, 'revisao', coalesce(p_resumo, '{}'::jsonb), p_texto, p_documento_id, p_reprocessamento_de_id)
  returning id into novo_id;
  for item in select value from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    insert into public.importacoes_curriculo_itens (importacao_id, tipo, payload, confianca, status, source_page)
    values (novo_id, item ->> 'tipo', coalesce(item -> 'payload', '{}'::jsonb), coalesce((item ->> 'confianca')::numeric, 0), coalesce(item ->> 'status', 'revisar'), (item ->> 'source_page')::integer);
  end loop;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes)
  values ((select auth.uid()), 'staging_criado', 'importacao_curriculo', novo_id::text, jsonb_build_object('nome_arquivo', p_nome_arquivo, 'itens', jsonb_array_length(coalesce(p_itens, '[]'::jsonb))));
  return novo_id;
end;
$$;
revoke all on function public.criar_importacao_curriculo(uuid,text,text,bigint,text,smallint,public.materia_aluno,smallint,jsonb,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.criar_importacao_curriculo(uuid,text,text,bigint,text,smallint,public.materia_aluno,smallint,jsonb,text,jsonb,uuid) to authenticated;

create or replace function public.editar_item_importacao_curriculo(p_item_id uuid, p_payload jsonb, p_source_page integer, p_status text)
returns public.importacoes_curriculo_itens language plpgsql security definer set search_path = '' as $$
declare resultado public.importacoes_curriculo_itens; importacao_id uuid;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem editar a revisão'; end if;
  if p_status not in ('ok', 'revisar', 'aprovado', 'rejeitado') then raise exception 'Status de revisão inválido'; end if;
  update public.importacoes_curriculo_itens set payload = coalesce(p_payload, '{}'::jsonb), source_page = p_source_page, status = p_status where id = p_item_id returning * into resultado;
  if resultado.id is null then raise exception 'Item de importação não encontrado'; end if;
  importacao_id := resultado.importacao_id;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes) values ((select auth.uid()), 'edicao_item_importacao', 'importacao_curriculo_item', p_item_id::text, jsonb_build_object('importacao_id', importacao_id, 'status', p_status));
  return resultado;
end;
$$;
revoke all on function public.editar_item_importacao_curriculo(uuid,jsonb,integer,text) from public, anon, authenticated;
grant execute on function public.editar_item_importacao_curriculo(uuid,jsonb,integer,text) to authenticated;

create or replace function public.rejeitar_importacao_curriculo(p_importacao_id uuid)
returns public.importacoes_curriculo language plpgsql security definer set search_path = '' as $$
declare resultado public.importacoes_curriculo;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem rejeitar importações'; end if;
  update public.importacoes_curriculo set status = 'rejeitada', updated_at = now() where id = p_importacao_id and status = 'revisao' returning * into resultado;
  if resultado.id is null then raise exception 'Importação não está em revisão'; end if;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes) values ((select auth.uid()), 'rejeicao_importacao', 'importacao_curriculo', p_importacao_id::text, '{}'::jsonb);
  return resultado;
end;
$$;
revoke all on function public.rejeitar_importacao_curriculo(uuid) from public, anon, authenticated;
grant execute on function public.rejeitar_importacao_curriculo(uuid) to authenticated;

create or replace function public.reprocessar_importacao_curriculo(p_importacao_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare anterior public.importacoes_curriculo; nova_id uuid;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem reprocessar importações'; end if;
  select * into anterior from public.importacoes_curriculo where id = p_importacao_id;
  if anterior.id is null then raise exception 'Importação não encontrada'; end if;
  if anterior.documento_id is null then raise exception 'Importação sem documento de origem'; end if;
  insert into public.importacoes_curriculo (nome_arquivo, arquivo_hash_sha256, origem, ano_letivo, materia_codigo, trimestre, status, resumo, documento_texto_extraido, documento_id, reprocessamento_de_id)
  values (anterior.nome_arquivo, anterior.arquivo_hash_sha256, anterior.origem, anterior.ano_letivo, anterior.materia_codigo, anterior.trimestre, 'revisao', anterior.resumo, anterior.documento_texto_extraido, anterior.documento_id, anterior.id)
  returning id into nova_id;
  insert into public.importacoes_curriculo_itens (importacao_id, tipo, payload, confianca, status, source_page, observacao)
  select nova_id, tipo, payload, confianca, 'revisar', source_page, 'Reprocessado para nova revisão' from public.importacoes_curriculo_itens where importacao_id = anterior.id;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes) values ((select auth.uid()), 'reprocessamento', 'importacao_curriculo', nova_id::text, jsonb_build_object('origem_id', anterior.id));
  return nova_id;
end;
$$;
revoke all on function public.reprocessar_importacao_curriculo(uuid) from public, anon, authenticated;
grant execute on function public.reprocessar_importacao_curriculo(uuid) to authenticated;

create or replace function public.aprovar_importacao_curriculo(p_importacao_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare imp public.importacoes_curriculo; curr_id uuid; periodo public.curriculo_periodos; habilidade public.habilidades_curriculares; descritor public.descritores_curriculares; objeto public.objetos_conhecimento; item jsonb; child jsonb; serie_num smallint; tri_num smallint; versao_num integer;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem aprovar importações'; end if;
  select * into imp from public.importacoes_curriculo where id = p_importacao_id for update;
  if imp.id is null then raise exception 'Importação não encontrada'; end if;
  if imp.status = 'aprovada' and imp.curriculo_id is not null then return imp.curriculo_id; end if;
  if imp.status <> 'revisao' then raise exception 'Importação precisa estar em revisão'; end if;
  if imp.materia_codigo is null then raise exception 'Componente curricular não identificado'; end if;
  if exists (select 1 from public.importacoes_curriculo_itens where importacao_id = imp.id and tipo = 'habilidade' and status in ('revisar', 'rejeitado')) then raise exception 'Existem habilidades pendentes ou rejeitadas'; end if;
  perform pg_advisory_xact_lock(hashtext(coalesce(imp.origem, '') || ':' || imp.ano_letivo || ':' || imp.materia_codigo::text));
  select coalesce(max(versao), 0) + 1 into versao_num from public.curriculos where origem = coalesce(imp.origem, 'Não identificada') and ano_letivo = imp.ano_letivo and materia_codigo = imp.materia_codigo;
  insert into public.curriculos (nome, origem, ano_letivo, materia_codigo, versao, status, criado_por, importacao_id) values (coalesce(imp.origem, 'Currículo importado') || ' ' || imp.ano_letivo, coalesce(imp.origem, 'Não identificada'), imp.ano_letivo, imp.materia_codigo, versao_num, 'publicado', imp.importado_por, imp.id) returning id into curr_id;
  update public.curriculos set status = 'arquivado', ativo = false, updated_at = now() where origem = coalesce(imp.origem, 'Não identificada') and ano_letivo = imp.ano_letivo and materia_codigo = imp.materia_codigo and id <> curr_id and status = 'publicado';
  for item in select payload from public.importacoes_curriculo_itens where importacao_id = imp.id and tipo = 'habilidade' and status in ('ok', 'aprovado') loop
    serie_num := nullif((item ->> 'serie')::smallint, 0); tri_num := coalesce(nullif((item ->> 'trimestre')::smallint, 0), imp.trimestre); if serie_num is null or tri_num is null then raise exception 'Habilidade sem série ou trimestre'; end if;
    insert into public.curriculo_periodos (curriculo_id, serie, trimestre) values (curr_id, serie_num, tri_num) returning * into periodo;
    insert into public.habilidades_curriculares (codigo, descricao, materia_codigo) values (upper(item ->> 'codigo'), coalesce(nullif(item ->> 'descricao', ''), 'Descrição pendente'), imp.materia_codigo) on conflict (codigo, materia_codigo) do update set descricao = case when public.habilidades_curriculares.descricao = 'Descrição pendente' then excluded.descricao else public.habilidades_curriculares.descricao end returning * into habilidade;
    insert into public.habilidade_curriculo_periodos (habilidade_id, periodo_id, quinzena, semana, source_page) values (habilidade.id, periodo.id, item ->> 'quinzena', item ->> 'semana', nullif(item ->> 'source_page', '')::integer);
    for child in select value from jsonb_array_elements(coalesce(item -> 'descritores', '[]'::jsonb)) loop
      insert into public.descritores_curriculares (codigo, titulo, descricao, materia_codigo, serie, trimestre, status) values (upper(child ->> 'code'), upper(child ->> 'code'), nullif(child ->> 'descricao', ''), imp.materia_codigo, serie_num, tri_num, 'ativo') on conflict (codigo) do update set descricao = coalesce(public.descritores_curriculares.descricao, excluded.descricao), status = case when public.descritores_curriculares.status = 'revisao' then 'ativo' else public.descritores_curriculares.status end returning * into descritor;
      insert into public.habilidade_descritores values (habilidade.id, descritor.id, periodo.id) on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'expectativas', '[]'::jsonb)) loop
      insert into public.expectativas_aprendizagem (habilidade_id, periodo_id, descricao)
      values (habilidade.id, periodo.id, child #>> '{}') on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'objetos', '[]'::jsonb)) loop
      insert into public.objetos_conhecimento (descricao)
      values (child #>> '{}') on conflict (descricao) do update set descricao = excluded.descricao returning * into objeto;
      insert into public.habilidade_objetos values (habilidade.id, objeto.id, periodo.id) on conflict do nothing;
    end loop;
  end loop;
  update public.importacoes_curriculo set status = 'aprovada', curriculo_id = curr_id, versao = versao_num, updated_at = now() where id = imp.id;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes) values ((select auth.uid()), 'aprovacao_publicacao', 'curriculo', curr_id::text, jsonb_build_object('importacao_id', imp.id, 'versao', versao_num));
  return curr_id;
end;
$$;
revoke all on function public.aprovar_importacao_curriculo(uuid) from public, anon, authenticated;
grant execute on function public.aprovar_importacao_curriculo(uuid) to authenticated;

-- ============================================================================
-- ETAPA 18/23: migrations/20260903_importacao_curricular_fase3_1.sql
-- ============================================================================

create or replace function public.aprovar_importacao_curriculo(p_importacao_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare imp public.importacoes_curriculo; curr_id uuid; periodo public.curriculo_periodos; habilidade public.habilidades_curriculares; descritor public.descritores_curriculares; objeto public.objetos_conhecimento; item jsonb; child jsonb; serie_num smallint; tri_num smallint; versao_num integer;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem aprovar importações'; end if;
  select * into imp from public.importacoes_curriculo where id = p_importacao_id for update;
  if imp.id is null then raise exception 'Importação não encontrada'; end if;
  if imp.status = 'aprovada' and imp.curriculo_id is not null then return imp.curriculo_id; end if;
  if imp.status <> 'revisao' then raise exception 'Importação precisa estar em revisão'; end if;
  if imp.materia_codigo is null then raise exception 'Componente curricular não identificado'; end if;
  if exists (select 1 from public.importacoes_curriculo_itens where importacao_id = imp.id and tipo = 'habilidade' and status = 'revisar') then raise exception 'Existem habilidades pendentes'; end if;
  perform pg_advisory_xact_lock(hashtext(coalesce(imp.origem, '') || ':' || imp.ano_letivo || ':' || imp.materia_codigo::text));
  select coalesce(max(versao), 0) + 1 into versao_num from public.curriculos where origem = coalesce(imp.origem, 'Não identificada') and ano_letivo = imp.ano_letivo and materia_codigo = imp.materia_codigo;
  insert into public.curriculos (nome, origem, ano_letivo, materia_codigo, versao, status, criado_por, importacao_id) values (coalesce(imp.origem, 'Currículo importado') || ' ' || imp.ano_letivo, coalesce(imp.origem, 'Não identificada'), imp.ano_letivo, imp.materia_codigo, versao_num, 'publicado', imp.importado_por, imp.id) returning id into curr_id;
  update public.curriculos set status = 'arquivado', ativo = false, updated_at = now() where origem = coalesce(imp.origem, 'Não identificada') and ano_letivo = imp.ano_letivo and materia_codigo = imp.materia_codigo and id <> curr_id and status = 'publicado';
  for item in select payload from public.importacoes_curriculo_itens where importacao_id = imp.id and tipo = 'habilidade' and status in ('ok', 'aprovado') loop
    serie_num := nullif((item ->> 'serie')::smallint, 0); tri_num := coalesce(nullif((item ->> 'trimestre')::smallint, 0), imp.trimestre); if serie_num is null or tri_num is null then raise exception 'Habilidade sem série ou trimestre'; end if;
    insert into public.curriculo_periodos (curriculo_id, serie, trimestre) values (curr_id, serie_num, tri_num) on conflict (curriculo_id, serie, trimestre) do update set trimestre = excluded.trimestre returning * into periodo;
    insert into public.habilidades_curriculares (codigo, descricao, materia_codigo) values (upper(item ->> 'codigo'), coalesce(nullif(item ->> 'descricao', ''), 'Descrição pendente'), imp.materia_codigo) on conflict (codigo, materia_codigo) do update set descricao = case when public.habilidades_curriculares.descricao = 'Descrição pendente' then excluded.descricao else public.habilidades_curriculares.descricao end returning * into habilidade;
    insert into public.habilidade_curriculo_periodos (habilidade_id, periodo_id, quinzena, semana, source_page) values (habilidade.id, periodo.id, item ->> 'quinzena', item ->> 'semana', nullif(item ->> 'source_page', '')::integer) on conflict (habilidade_id, periodo_id) do update set quinzena = excluded.quinzena, semana = excluded.semana, source_page = excluded.source_page;
    for child in select value from jsonb_array_elements(coalesce(item -> 'descritores', '[]'::jsonb)) loop
      insert into public.descritores_curriculares (codigo, titulo, descricao, materia_codigo, serie, trimestre, status) values (upper(child ->> 'code'), upper(child ->> 'code'), nullif(child ->> 'descricao', ''), imp.materia_codigo, serie_num, tri_num, 'ativo') on conflict (codigo) do update set descricao = coalesce(public.descritores_curriculares.descricao, excluded.descricao), status = case when public.descritores_curriculares.status = 'revisao' then 'ativo' else public.descritores_curriculares.status end returning * into descritor;
      insert into public.habilidade_descritores values (habilidade.id, descritor.id, periodo.id) on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'expectativas', '[]'::jsonb)) loop
      insert into public.expectativas_aprendizagem (habilidade_id, periodo_id, descricao) values (habilidade.id, periodo.id, child #>> '{}') on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'objetos', '[]'::jsonb)) loop
      insert into public.objetos_conhecimento (descricao) values (child #>> '{}') on conflict (descricao) do update set descricao = excluded.descricao returning * into objeto;
      insert into public.habilidade_objetos values (habilidade.id, objeto.id, periodo.id) on conflict do nothing;
    end loop;
  end loop;
  update public.importacoes_curriculo set status = 'aprovada', curriculo_id = curr_id, versao = versao_num, updated_at = now() where id = imp.id;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes) values ((select auth.uid()), 'aprovacao_publicacao', 'curriculo', curr_id::text, jsonb_build_object('importacao_id', imp.id, 'versao', versao_num));
  return curr_id;
end;
$$;

revoke all on function public.aprovar_importacao_curriculo(uuid) from public, anon, authenticated;
grant execute on function public.aprovar_importacao_curriculo(uuid) to authenticated;

-- ============================================================================
-- ETAPA 19/23: migrations/20260903_redacoes_avaliacoes_portugues.sql
-- ============================================================================

-- Rascunhos privados da devolutiva. A redação do aluno permanece imutável até
-- que o professor conclua a correção e altere seu estado para "corrigida".
create table if not exists public.rascunhos_correcao_redacao (
  redacao_id uuid not null references public.redacoes(id) on delete cascade,
  professor_id uuid not null references public.perfis(id) on delete cascade,
  nota numeric(5,2) check (nota is null or nota between 0 and 1000),
  feedback text not null default '' check (char_length(feedback) <= 20000),
  competencias jsonb not null default '[]'::jsonb check (jsonb_typeof(competencias) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (redacao_id, professor_id)
);

create index if not exists rascunhos_correcao_professor_data_idx
  on public.rascunhos_correcao_redacao (professor_id, updated_at desc);

alter table public.rascunhos_correcao_redacao enable row level security;
revoke all on public.rascunhos_correcao_redacao from anon;
grant select, insert, update, delete on public.rascunhos_correcao_redacao to authenticated;

drop policy if exists rascunhos_correcao_select on public.rascunhos_correcao_redacao;
create policy rascunhos_correcao_select on public.rascunhos_correcao_redacao
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or (
    professor_id = (select auth.uid())
    and (select public.usuario_tipo_professor()) = 'portugues'
    and exists (
      select 1
      from public.redacoes r
      join public.perfis aluno on aluno.id = r.aluno_id
      join public.professor_turmas pt on pt.turma_id = aluno.turma_id
      where r.id = redacao_id and pt.professor_id = (select auth.uid())
    )
  )
);

drop policy if exists rascunhos_correcao_manage on public.rascunhos_correcao_redacao;
create policy rascunhos_correcao_manage on public.rascunhos_correcao_redacao
for all to authenticated
using (
  (select public.usuario_role()) = 'gestor'
  or (
    professor_id = (select auth.uid())
    and (select public.usuario_tipo_professor()) = 'portugues'
    and exists (
      select 1
      from public.redacoes r
      join public.perfis aluno on aluno.id = r.aluno_id
      join public.professor_turmas pt on pt.turma_id = aluno.turma_id
      where r.id = redacao_id and pt.professor_id = (select auth.uid())
    )
  )
)
with check (
  (select public.usuario_role()) = 'gestor'
  or (
    professor_id = (select auth.uid())
    and (select public.usuario_tipo_professor()) = 'portugues'
    and exists (
      select 1
      from public.redacoes r
      join public.perfis aluno on aluno.id = r.aluno_id
      join public.professor_turmas pt on pt.turma_id = aluno.turma_id
      where r.id = redacao_id and pt.professor_id = (select auth.uid())
    )
  )
);

drop trigger if exists set_rascunhos_correcao_updated_at on public.rascunhos_correcao_redacao;
create trigger set_rascunhos_correcao_updated_at
before update on public.rascunhos_correcao_redacao
for each row execute function public.set_updated_at();

-- Publica a devolutiva em uma única transação. SECURITY INVOKER mantém as
-- políticas RLS ativas durante todas as gravações.
create or replace function public.corrigir_redacao(
  redacao_input uuid,
  nota_input numeric,
  feedback_input text,
  competencias_input jsonb default '[]'::jsonb,
  comentarios_input jsonb default '[]'::jsonb
)
returns public.redacoes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resultado public.redacoes;
  item jsonb;
  competencia_numero smallint;
  competencia_nota smallint;
begin
  if nota_input is null or nota_input < 0 or nota_input > 1000 then
    raise exception 'A nota deve estar entre 0 e 1000.';
  end if;
  if char_length(btrim(coalesce(feedback_input, ''))) < 2 then
    raise exception 'A devolutiva precisa ser preenchida.';
  end if;
  if jsonb_typeof(coalesce(competencias_input, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(comentarios_input, '[]'::jsonb)) <> 'array' then
    raise exception 'Competências e comentários devem ser listas.';
  end if;
  if (select public.usuario_role()) <> 'gestor' and not (
    (select public.usuario_tipo_professor()) = 'portugues'
    and exists (
      select 1
      from public.redacoes r
      join public.perfis aluno on aluno.id = r.aluno_id
      join public.professor_turmas pt on pt.turma_id = aluno.turma_id
      where r.id = redacao_input and pt.professor_id = (select auth.uid())
    )
  ) then
    raise exception 'Sem permissão para corrigir esta redação.';
  end if;

  update public.redacoes
  set nota = nota_input,
      feedback = btrim(feedback_input),
      status = 'corrigida',
      corrigida_por = (select auth.uid()),
      corrigida_em = now()
  where id = redacao_input
  returning * into resultado;
  if resultado.id is null then raise exception 'Redação não encontrada.'; end if;

  for item in select value from jsonb_array_elements(coalesce(competencias_input, '[]'::jsonb)) loop
    competencia_numero := (item ->> 'competencia')::smallint;
    competencia_nota := (item ->> 'nota')::smallint;
    if competencia_numero not between 1 and 5 or competencia_nota not in (0,40,80,120,160,200) then
      raise exception 'Competência ou nota inválida.';
    end if;
    insert into public.avaliacoes_competencias_redacao (redacao_id, competencia, nota, comentario, professor_id)
    values (redacao_input, competencia_numero, competencia_nota, nullif(item ->> 'comentario', ''), (select auth.uid()))
    on conflict (redacao_id, competencia) do update
      set nota = excluded.nota, comentario = excluded.comentario, professor_id = excluded.professor_id, updated_at = now();
  end loop;

  for item in select value from jsonb_array_elements(coalesce(comentarios_input, '[]'::jsonb)) loop
    insert into public.comentarios_redacao (redacao_id, professor_id, inicio_offset, fim_offset, trecho, comentario, tipo)
    values (
      redacao_input,
      (select auth.uid()),
      nullif(item ->> 'inicioOffset', '')::integer,
      nullif(item ->> 'fimOffset', '')::integer,
      nullif(item ->> 'trecho', ''),
      item ->> 'comentario',
      coalesce(nullif(item ->> 'tipo', ''), 'orientacao')
    );
  end loop;

  delete from public.rascunhos_correcao_redacao
  where redacao_id = redacao_input and professor_id = (select auth.uid());
  return resultado;
end;
$$;

revoke all on function public.corrigir_redacao(uuid,numeric,text,jsonb,jsonb) from public, anon;
grant execute on function public.corrigir_redacao(uuid,numeric,text,jsonb,jsonb) to authenticated;

-- ============================================================================
-- ETAPA 20/23: migrations/20260904_importacao_curricular_fase3_2.sql
-- ============================================================================

create or replace function public.criar_importacao_curriculo(
  p_documento_id uuid, p_nome_arquivo text, p_hash text, p_tamanho bigint,
  p_origem text, p_ano smallint, p_materia public.materia_aluno,
  p_trimestre smallint, p_resumo jsonb, p_texto text, p_itens jsonb,
  p_reprocessamento_de_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare novo_id uuid; existente public.importacoes_curriculo; item jsonb;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem criar importações'; end if;
  if not exists (select 1 from public.documentos_curriculares where id = p_documento_id and arquivo_hash_sha256 = p_hash) then raise exception 'Documento de origem inválido'; end if;
  if p_nome_arquivo !~* '\\.pdf' or p_tamanho <= 0 or p_tamanho > 52428800 or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Metadados do PDF inválidos'; end if;
  if p_reprocessamento_de_id is null then
    select * into existente from public.importacoes_curriculo where arquivo_hash_sha256 = p_hash and reprocessamento_de_id is null limit 1;
    if existente.id is not null then return existente.id; end if;
  end if;
  insert into public.importacoes_curriculo (nome_arquivo, arquivo_hash_sha256, origem, ano_letivo, materia_codigo, trimestre, status, resumo, documento_texto_extraido, documento_id, reprocessamento_de_id)
  values (p_nome_arquivo, p_hash, p_origem, p_ano, p_materia, p_trimestre, 'revisao', coalesce(p_resumo, '{}'::jsonb), p_texto, p_documento_id, p_reprocessamento_de_id)
  returning id into novo_id;
  for item in select value from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    insert into public.importacoes_curriculo_itens (importacao_id, tipo, payload, confianca, status, source_page)
    values (novo_id, item ->> 'tipo', coalesce(item -> 'payload', '{}'::jsonb), coalesce((item ->> 'confianca')::numeric, 0), coalesce(item ->> 'status', 'revisar'), (item ->> 'source_page')::integer);
  end loop;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes)
  values ((select auth.uid()), 'staging_criado', 'importacao_curriculo', novo_id::text, jsonb_build_object('nome_arquivo', p_nome_arquivo, 'itens', jsonb_array_length(coalesce(p_itens, '[]'::jsonb))));
  return novo_id;
end;
$$;
revoke all on function public.criar_importacao_curriculo(uuid,text,text,bigint,text,smallint,public.materia_aluno,smallint,jsonb,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.criar_importacao_curriculo(uuid,text,text,bigint,text,smallint,public.materia_aluno,smallint,jsonb,text,jsonb,uuid) to authenticated;

create or replace function public.aprovar_importacao_curriculo(p_importacao_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare imp public.importacoes_curriculo; curr_id uuid; periodo public.curriculo_periodos; habilidade public.habilidades_curriculares; descritor public.descritores_curriculares; objeto public.objetos_conhecimento; item jsonb; child jsonb; serie_num smallint; tri_num smallint; versao_num integer;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem aprovar importações'; end if;
  select * into imp from public.importacoes_curriculo where id = p_importacao_id for update;
  if imp.id is null then raise exception 'Importação não encontrada'; end if;
  if imp.status = 'aprovada' and imp.curriculo_id is not null then return imp.curriculo_id; end if;
  if imp.status <> 'revisao' then raise exception 'Importação precisa estar em revisão'; end if;
  if imp.materia_codigo is null then raise exception 'Componente curricular não identificado'; end if;
  if not exists (
    select 1 from public.importacoes_curriculo_itens
    where importacao_id = imp.id and tipo = 'habilidade' and status in ('ok', 'aprovado')
  ) then raise exception 'Nenhuma habilidade aprovada para publicação'; end if;
  if exists (select 1 from public.importacoes_curriculo_itens where importacao_id = imp.id and tipo = 'habilidade' and status = 'revisar') then raise exception 'Existem habilidades pendentes'; end if;
  perform pg_advisory_xact_lock(hashtext(coalesce(imp.origem, '') || ':' || imp.ano_letivo || ':' || imp.materia_codigo::text));
  select coalesce(max(versao), 0) + 1 into versao_num from public.curriculos where origem = coalesce(imp.origem, 'Não identificada') and ano_letivo = imp.ano_letivo and materia_codigo = imp.materia_codigo;
  insert into public.curriculos (nome, origem, ano_letivo, materia_codigo, versao, status, criado_por, importacao_id) values (coalesce(imp.origem, 'Currículo importado') || ' ' || imp.ano_letivo, coalesce(imp.origem, 'Não identificada'), imp.ano_letivo, imp.materia_codigo, versao_num, 'publicado', imp.importado_por, imp.id) returning id into curr_id;
  update public.curriculos set status = 'arquivado', ativo = false, updated_at = now() where origem = coalesce(imp.origem, 'Não identificada') and ano_letivo = imp.ano_letivo and materia_codigo = imp.materia_codigo and id <> curr_id and status = 'publicado';
  for item in select payload from public.importacoes_curriculo_itens where importacao_id = imp.id and tipo = 'habilidade' and status in ('ok', 'aprovado') loop
    serie_num := nullif((item ->> 'serie')::smallint, 0); tri_num := coalesce(nullif((item ->> 'trimestre')::smallint, 0), imp.trimestre); if serie_num is null or tri_num is null then raise exception 'Habilidade sem série ou trimestre'; end if;
    insert into public.curriculo_periodos (curriculo_id, serie, trimestre) values (curr_id, serie_num, tri_num) on conflict (curriculo_id, serie, trimestre) do update set trimestre = excluded.trimestre returning * into periodo;
    insert into public.habilidades_curriculares (codigo, descricao, materia_codigo) values (upper(item ->> 'codigo'), coalesce(nullif(item ->> 'descricao', ''), 'Descrição pendente'), imp.materia_codigo) on conflict (codigo, materia_codigo) do update set descricao = case when public.habilidades_curriculares.descricao = 'Descrição pendente' then excluded.descricao else public.habilidades_curriculares.descricao end returning * into habilidade;
    insert into public.habilidade_curriculo_periodos (habilidade_id, periodo_id, quinzena, semana, source_page) values (habilidade.id, periodo.id, item ->> 'quinzena', item ->> 'semana', nullif(item ->> 'source_page', '')::integer) on conflict (habilidade_id, periodo_id) do update set quinzena = excluded.quinzena, semana = excluded.semana, source_page = excluded.source_page;
    for child in select value from jsonb_array_elements(coalesce(item -> 'descritores', '[]'::jsonb)) loop
      insert into public.descritores_curriculares (codigo, titulo, descricao, materia_codigo, serie, trimestre, status) values (upper(child ->> 'code'), upper(child ->> 'code'), nullif(child ->> 'descricao', ''), imp.materia_codigo, serie_num, tri_num, 'ativo') on conflict (codigo) do update set descricao = coalesce(public.descritores_curriculares.descricao, excluded.descricao), status = case when public.descritores_curriculares.status = 'revisao' then 'ativo' else public.descritores_curriculares.status end returning * into descritor;
      insert into public.habilidade_descritores values (habilidade.id, descritor.id, periodo.id) on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'expectativas', '[]'::jsonb)) loop
      insert into public.expectativas_aprendizagem (habilidade_id, periodo_id, descricao) values (habilidade.id, periodo.id, child #>> '{}') on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'objetos', '[]'::jsonb)) loop
      insert into public.objetos_conhecimento (descricao) values (child #>> '{}') on conflict (descricao) do update set descricao = excluded.descricao returning * into objeto;
      insert into public.habilidade_objetos values (habilidade.id, objeto.id, periodo.id) on conflict do nothing;
    end loop;
  end loop;
  update public.importacoes_curriculo set status = 'aprovada', curriculo_id = curr_id, versao = versao_num, updated_at = now() where id = imp.id;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes) values ((select auth.uid()), 'aprovacao_publicacao', 'curriculo', curr_id::text, jsonb_build_object('importacao_id', imp.id, 'versao', versao_num));
  return curr_id;
end;
$$;
revoke all on function public.aprovar_importacao_curriculo(uuid) from public, anon, authenticated;
grant execute on function public.aprovar_importacao_curriculo(uuid) to authenticated;

-- ============================================================================
-- ETAPA 21/23: migrations/20260904_importacao_curricular_correcao_policy.sql
-- ============================================================================

drop policy if exists objetos_leitura on public.objetos_conhecimento;
create policy objetos_leitura on public.objetos_conhecimento for select to authenticated using (exists (select 1 from public.habilidade_objetos ho join public.curriculo_periodos p on p.id = ho.periodo_id join public.curriculos c on c.id = p.curriculo_id where ho.objeto_id = public.objetos_conhecimento.id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));

-- ============================================================================
-- ETAPA 22/23: migrations/20260904_importacao_curricular_fase3_3.sql
-- ============================================================================

create or replace function public.criar_importacao_curriculo(
  p_documento_id uuid, p_nome_arquivo text, p_hash text, p_tamanho bigint,
  p_origem text, p_ano smallint, p_materia public.materia_aluno,
  p_trimestre smallint, p_resumo jsonb, p_texto text, p_itens jsonb,
  p_reprocessamento_de_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  novo_id uuid;
  existente public.importacoes_curriculo;
  item jsonb;
  payload jsonb;
  codigo text;
  tipo_seguro text;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem criar importações'; end if;
  if not exists (select 1 from public.documentos_curriculares where id = p_documento_id and arquivo_hash_sha256 = p_hash) then raise exception 'Documento de origem inválido'; end if;
  if p_nome_arquivo !~* '\\.pdf' or p_tamanho <= 0 or p_tamanho > 52428800 or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Metadados do PDF inválidos'; end if;
  if p_reprocessamento_de_id is null then
    select * into existente from public.importacoes_curriculo where arquivo_hash_sha256 = p_hash and reprocessamento_de_id is null limit 1;
    if existente.id is not null then return existente.id; end if;
  end if;
  insert into public.importacoes_curriculo (nome_arquivo, arquivo_hash_sha256, origem, ano_letivo, materia_codigo, trimestre, status, resumo, documento_texto_extraido, documento_id, reprocessamento_de_id)
  values (p_nome_arquivo, p_hash, p_origem, p_ano, p_materia, p_trimestre, 'revisao', coalesce(p_resumo, '{}'::jsonb), p_texto, p_documento_id, p_reprocessamento_de_id)
  returning id into novo_id;
  for item in select value from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    payload := coalesce(item -> 'payload', '{}'::jsonb);
    codigo := upper(btrim(payload ->> 'codigo'));
    tipo_seguro := case
      when codigo ~ '^EM\d{2}[A-Z]{2}\d{2}$' then 'habilidade'
      when codigo ~ '^EF\d{2}[A-Z]{2}\d{2}$' then 'referencia_ensino_fundamental'
      else item ->> 'tipo'
    end;
    if codigo ~ '^EM\d{2}[A-Z]{2}\d{2}$' then
      payload := jsonb_set(payload, '{codigo}', to_jsonb(codigo), true);
      payload := jsonb_set(payload, '{etapa}', '"ensino_medio"'::jsonb, true);
    elsif codigo ~ '^EF\d{2}[A-Z]{2}\d{2}$' then
      payload := jsonb_set(payload, '{codigo}', to_jsonb(codigo), true);
      payload := jsonb_set(payload, '{etapa}', '"ensino_fundamental"'::jsonb, true);
    end if;
    insert into public.importacoes_curriculo_itens (importacao_id, tipo, payload, confianca, status, source_page)
    values (novo_id, tipo_seguro, payload, coalesce((item ->> 'confianca')::numeric, 0), case when tipo_seguro = 'referencia_ensino_fundamental' then 'revisar' else coalesce(item ->> 'status', 'revisar') end, (item ->> 'source_page')::integer);
  end loop;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes)
  values ((select auth.uid()), 'staging_criado', 'importacao_curriculo', novo_id::text, jsonb_build_object('nome_arquivo', p_nome_arquivo, 'itens', jsonb_array_length(coalesce(p_itens, '[]'::jsonb))));
  return novo_id;
end;
$$;
revoke all on function public.criar_importacao_curriculo(uuid,text,text,bigint,text,smallint,public.materia_aluno,smallint,jsonb,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.criar_importacao_curriculo(uuid,text,text,bigint,text,smallint,public.materia_aluno,smallint,jsonb,text,jsonb,uuid) to authenticated;

create or replace function public.editar_item_importacao_curriculo(p_item_id uuid, p_payload jsonb, p_source_page integer, p_status text)
returns public.importacoes_curriculo_itens language plpgsql security definer set search_path = '' as $$
declare
  resultado public.importacoes_curriculo_itens;
  importacao_id uuid;
  payload_seguro jsonb := coalesce(p_payload, '{}'::jsonb);
  codigo text := upper(btrim(coalesce(p_payload ->> 'codigo', '')));
  tipo_seguro text;
  status_seguro text := p_status;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem editar a revisão'; end if;
  if p_status not in ('ok', 'revisar', 'aprovado', 'rejeitado') then raise exception 'Status de revisão inválido'; end if;
  tipo_seguro := case
    when codigo ~ '^EM\d{2}[A-Z]{2}\d{2}$' then 'habilidade'
    when codigo ~ '^EF\d{2}[A-Z]{2}\d{2}$' then 'referencia_ensino_fundamental'
    else null
  end;
  if tipo_seguro is not null then
    payload_seguro := jsonb_set(payload_seguro, '{codigo}', to_jsonb(codigo), true);
    payload_seguro := jsonb_set(payload_seguro, '{etapa}', to_jsonb(case when tipo_seguro = 'habilidade' then 'ensino_medio' else 'ensino_fundamental' end), true);
    if tipo_seguro = 'referencia_ensino_fundamental' then status_seguro := 'revisar'; end if;
  end if;
  update public.importacoes_curriculo_itens
  set payload = payload_seguro, tipo = coalesce(tipo_seguro, tipo), source_page = p_source_page, status = status_seguro
  where id = p_item_id
  returning * into resultado;
  if resultado.id is null then raise exception 'Item de importação não encontrado'; end if;
  importacao_id := resultado.importacao_id;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes)
  values ((select auth.uid()), 'edicao_item_importacao', 'importacao_curriculo_item', p_item_id::text, jsonb_build_object('importacao_id', importacao_id, 'status', status_seguro, 'tipo', resultado.tipo));
  return resultado;
end;
$$;
revoke all on function public.editar_item_importacao_curriculo(uuid,jsonb,integer,text) from public, anon, authenticated;
grant execute on function public.editar_item_importacao_curriculo(uuid,jsonb,integer,text) to authenticated;

create or replace function public.aprovar_importacao_curriculo(p_importacao_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare imp public.importacoes_curriculo; curr_id uuid; periodo public.curriculo_periodos; habilidade public.habilidades_curriculares; descritor public.descritores_curriculares; objeto public.objetos_conhecimento; item jsonb; child jsonb; serie_num smallint; tri_num smallint; versao_num integer;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem aprovar importações'; end if;
  select * into imp from public.importacoes_curriculo where id = p_importacao_id for update;
  if imp.id is null then raise exception 'Importação não encontrada'; end if;
  if imp.status = 'aprovada' and imp.curriculo_id is not null then return imp.curriculo_id; end if;
  if imp.status <> 'revisao' then raise exception 'Importação precisa estar em revisão'; end if;
  if imp.materia_codigo is null then raise exception 'Componente curricular não identificado'; end if;
  if not exists (
    select 1 from public.importacoes_curriculo_itens
    where importacao_id = imp.id
      and tipo = 'habilidade'
      and status in ('ok', 'aprovado')
      and upper(payload ->> 'codigo') ~ '^EM\d{2}[A-Z]{2}\d{2}$'
  ) then raise exception 'Nenhuma habilidade aprovada para publicação'; end if;
  if exists (
    select 1 from public.importacoes_curriculo_itens
    where importacao_id = imp.id
      and tipo = 'habilidade'
      and status = 'revisar'
      and upper(payload ->> 'codigo') ~ '^EM\d{2}[A-Z]{2}\d{2}$'
  ) then raise exception 'Existem habilidades pendentes'; end if;
  perform pg_advisory_xact_lock(hashtext(coalesce(imp.origem, '') || ':' || imp.ano_letivo || ':' || imp.materia_codigo::text));
  select coalesce(max(versao), 0) + 1 into versao_num from public.curriculos where origem = coalesce(imp.origem, 'Não identificada') and ano_letivo = imp.ano_letivo and materia_codigo = imp.materia_codigo;
  insert into public.curriculos (nome, origem, ano_letivo, materia_codigo, versao, status, criado_por, importacao_id) values (coalesce(imp.origem, 'Currículo importado') || ' ' || imp.ano_letivo, coalesce(imp.origem, 'Não identificada'), imp.ano_letivo, imp.materia_codigo, versao_num, 'publicado', imp.importado_por, imp.id) returning id into curr_id;
  update public.curriculos set status = 'arquivado', ativo = false, updated_at = now() where origem = coalesce(imp.origem, 'Não identificada') and ano_letivo = imp.ano_letivo and materia_codigo = imp.materia_codigo and id <> curr_id and status = 'publicado';
  for item in select payload from public.importacoes_curriculo_itens where importacao_id = imp.id and tipo = 'habilidade' and status in ('ok', 'aprovado') and upper(payload ->> 'codigo') ~ '^EM\d{2}[A-Z]{2}\d{2}$' loop
    serie_num := nullif((item ->> 'serie')::smallint, 0); tri_num := coalesce(nullif((item ->> 'trimestre')::smallint, 0), imp.trimestre); if serie_num is null or tri_num is null then raise exception 'Habilidade sem série ou trimestre'; end if;
    insert into public.curriculo_periodos (curriculo_id, serie, trimestre) values (curr_id, serie_num, tri_num) on conflict (curriculo_id, serie, trimestre) do update set trimestre = excluded.trimestre returning * into periodo;
    insert into public.habilidades_curriculares (codigo, descricao, materia_codigo) values (upper(item ->> 'codigo'), coalesce(nullif(item ->> 'descricao', ''), 'Descrição pendente'), imp.materia_codigo) on conflict (codigo, materia_codigo) do update set descricao = case when public.habilidades_curriculares.descricao = 'Descrição pendente' then excluded.descricao else public.habilidades_curriculares.descricao end returning * into habilidade;
    insert into public.habilidade_curriculo_periodos (habilidade_id, periodo_id, quinzena, semana, source_page) values (habilidade.id, periodo.id, item ->> 'quinzena', item ->> 'semana', nullif(item ->> 'source_page', '')::integer) on conflict (habilidade_id, periodo_id) do update set quinzena = excluded.quinzena, semana = excluded.semana, source_page = excluded.source_page;
    for child in select value from jsonb_array_elements(coalesce(item -> 'descritores', '[]'::jsonb)) loop
      insert into public.descritores_curriculares (codigo, titulo, descricao, materia_codigo, serie, trimestre, status) values (upper(child ->> 'code'), upper(child ->> 'code'), nullif(child ->> 'descricao', ''), imp.materia_codigo, serie_num, tri_num, 'ativo') on conflict (codigo) do update set descricao = coalesce(public.descritores_curriculares.descricao, excluded.descricao), status = case when public.descritores_curriculares.status = 'revisao' then 'ativo' else public.descritores_curriculares.status end returning * into descritor;
      insert into public.habilidade_descritores values (habilidade.id, descritor.id, periodo.id) on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'expectativas', '[]'::jsonb)) loop
      insert into public.expectativas_aprendizagem (habilidade_id, periodo_id, descricao) values (habilidade.id, periodo.id, child #>> '{}') on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'objetos', '[]'::jsonb)) loop
      insert into public.objetos_conhecimento (descricao) values (child #>> '{}') on conflict (descricao) do update set descricao = excluded.descricao returning * into objeto;
      insert into public.habilidade_objetos values (habilidade.id, objeto.id, periodo.id) on conflict do nothing;
    end loop;
  end loop;
  update public.importacoes_curriculo set status = 'aprovada', curriculo_id = curr_id, versao = versao_num, updated_at = now() where id = imp.id;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes) values ((select auth.uid()), 'aprovacao_publicacao', 'curriculo', curr_id::text, jsonb_build_object('importacao_id', imp.id, 'versao', versao_num));
  return curr_id;
end;
$$;
revoke all on function public.aprovar_importacao_curriculo(uuid) from public, anon, authenticated;
grant execute on function public.aprovar_importacao_curriculo(uuid) to authenticated;

-- ============================================================================
-- ETAPA 23/23: migrations/20260904_importacao_curricular_fase3_4.sql
-- ============================================================================

create or replace function public.aprovar_importacao_curriculo(p_importacao_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  imp public.importacoes_curriculo;
  curr_id uuid;
  periodo public.curriculo_periodos;
  habilidade public.habilidades_curriculares;
  descritor public.descritores_curriculares;
  objeto public.objetos_conhecimento;
  item jsonb;
  child jsonb;
  serie_num smallint;
  tri_num smallint;
  versao_num integer;
  curriculo_novo boolean := false;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem aprovar importações'; end if;
  select * into imp from public.importacoes_curriculo where id = p_importacao_id for update;
  if imp.id is null then raise exception 'Importação não encontrada'; end if;
  if imp.status = 'aprovada' and imp.curriculo_id is not null then return imp.curriculo_id; end if;
  if imp.status <> 'revisao' then raise exception 'Importação precisa estar em revisão'; end if;
  if imp.materia_codigo is null then raise exception 'Componente curricular não identificado'; end if;
  if not exists (
    select 1 from public.importacoes_curriculo_itens
    where importacao_id = imp.id
      and tipo = 'habilidade'
      and status in ('ok', 'aprovado')
      and upper(payload ->> 'codigo') ~ '^EM\d{2}[A-Z]{2}\d{2}$'
  ) then raise exception 'Nenhuma habilidade aprovada para publicação'; end if;
  if exists (
    select 1 from public.importacoes_curriculo_itens
    where importacao_id = imp.id
      and tipo = 'habilidade'
      and status = 'revisar'
      and upper(payload ->> 'codigo') ~ '^EM\d{2}[A-Z]{2}\d{2}$'
  ) then raise exception 'Existem habilidades pendentes'; end if;

  perform pg_advisory_xact_lock(hashtext(coalesce(imp.origem, '') || ':' || imp.ano_letivo || ':' || imp.materia_codigo::text));

  if imp.reprocessamento_de_id is null then
    select id into curr_id
    from public.curriculos
    where origem = coalesce(imp.origem, 'Não identificada')
      and ano_letivo = imp.ano_letivo
      and materia_codigo = imp.materia_codigo
      and status = 'publicado'
      and ativo = true
    order by versao desc
    limit 1;
  end if;

  if curr_id is null then
    select coalesce(max(versao), 0) + 1 into versao_num
    from public.curriculos
    where origem = coalesce(imp.origem, 'Não identificada')
      and ano_letivo = imp.ano_letivo
      and materia_codigo = imp.materia_codigo;
    insert into public.curriculos (nome, origem, ano_letivo, materia_codigo, versao, status, criado_por, importacao_id)
    values (
      coalesce(imp.origem, 'Currículo importado') || ' ' || imp.ano_letivo,
      coalesce(imp.origem, 'Não identificada'), imp.ano_letivo,
      imp.materia_codigo, versao_num, 'publicado', imp.importado_por, imp.id
    ) returning id into curr_id;
    curriculo_novo := true;
  end if;

  if curriculo_novo then
    update public.curriculos
    set status = 'arquivado', ativo = false, updated_at = now()
    where origem = coalesce(imp.origem, 'Não identificada')
      and ano_letivo = imp.ano_letivo
      and materia_codigo = imp.materia_codigo
      and id <> curr_id
      and status = 'publicado';
  end if;

  for item in
    select payload from public.importacoes_curriculo_itens
    where importacao_id = imp.id
      and tipo = 'habilidade'
      and status in ('ok', 'aprovado')
      and upper(payload ->> 'codigo') ~ '^EM\d{2}[A-Z]{2}\d{2}$'
  loop
    serie_num := nullif((item ->> 'serie')::smallint, 0);
    tri_num := coalesce(nullif((item ->> 'trimestre')::smallint, 0), imp.trimestre);
    if serie_num is null or tri_num is null then raise exception 'Habilidade sem série ou trimestre'; end if;
    insert into public.curriculo_periodos (curriculo_id, serie, trimestre)
    values (curr_id, serie_num, tri_num)
    on conflict (curriculo_id, serie, trimestre) do update set trimestre = excluded.trimestre
    returning * into periodo;
    insert into public.habilidades_curriculares (codigo, descricao, materia_codigo)
    values (upper(item ->> 'codigo'), coalesce(nullif(item ->> 'descricao', ''), 'Descrição pendente'), imp.materia_codigo)
    on conflict (codigo, materia_codigo) do update
      set descricao = case when public.habilidades_curriculares.descricao = 'Descrição pendente' then excluded.descricao else public.habilidades_curriculares.descricao end
    returning * into habilidade;
    insert into public.habilidade_curriculo_periodos (habilidade_id, periodo_id, quinzena, semana, source_page)
    values (habilidade.id, periodo.id, item ->> 'quinzena', item ->> 'semana', nullif(item ->> 'source_page', '')::integer)
    on conflict (habilidade_id, periodo_id) do update
      set quinzena = excluded.quinzena, semana = excluded.semana, source_page = excluded.source_page;
    for child in select value from jsonb_array_elements(coalesce(item -> 'descritores', '[]'::jsonb)) loop
      insert into public.descritores_curriculares (codigo, titulo, descricao, materia_codigo, serie, trimestre, status)
      values (upper(child ->> 'code'), upper(child ->> 'code'), nullif(child ->> 'descricao', ''), imp.materia_codigo, serie_num, tri_num, 'ativo')
      on conflict (codigo) do update
        set descricao = coalesce(public.descritores_curriculares.descricao, excluded.descricao),
            status = case when public.descritores_curriculares.status = 'revisao' then 'ativo' else public.descritores_curriculares.status end
      returning * into descritor;
      insert into public.habilidade_descritores values (habilidade.id, descritor.id, periodo.id) on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'expectativas', '[]'::jsonb)) loop
      insert into public.expectativas_aprendizagem (habilidade_id, periodo_id, descricao)
      values (habilidade.id, periodo.id, child #>> '{}') on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'objetos', '[]'::jsonb)) loop
      insert into public.objetos_conhecimento (descricao)
      values (child #>> '{}') on conflict (descricao) do update set descricao = excluded.descricao returning * into objeto;
      insert into public.habilidade_objetos values (habilidade.id, objeto.id, periodo.id) on conflict do nothing;
    end loop;
  end loop;

  update public.importacoes_curriculo
  set status = 'aprovada', curriculo_id = curr_id, versao = (select versao from public.curriculos where id = curr_id), updated_at = now()
  where id = imp.id;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes)
  values (
    (select auth.uid()), 'aprovacao_publicacao', 'curriculo', curr_id::text,
    jsonb_build_object('importacao_id', imp.id, 'versao', (select versao from public.curriculos where id = curr_id), 'curriculo_reutilizado', not curriculo_novo, 'reprocessamento', imp.reprocessamento_de_id is not null)
  );
  return curr_id;
end;
$$;

revoke all on function public.aprovar_importacao_curriculo(uuid) from public, anon, authenticated;
grant execute on function public.aprovar_importacao_curriculo(uuid) to authenticated;

commit;

-- Fim do schema completo do OminiSaber.
