-- OminiSaber | Schema Supabase
-- Execute este arquivo no SQL Editor do Supabase.
-- A autenticação continua sendo administrada pelo auth.users nativo.

begin;

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
    'matematica', 'fisica', 'quimica', 'biologia', 'portugues', 'redacao',
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

commit;
