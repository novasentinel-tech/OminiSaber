-- OminiSaber | Schema completo para instalação limpa no Supabase
-- Gerado por backend/scripts/build-complete-schema.js.
-- Não edite este arquivo diretamente; altere os schemas de origem e gere novamente.
-- A instalação inteira é atômica: qualquer erro desfaz todas as etapas.

begin;

-- ============================================================================
-- ETAPA 1/67: schema/core.sql
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

-- ============================================================================
-- ETAPA 2/67: migrations/20260831_acesso_materias_aluno.sql
-- ============================================================================

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
  when lower(materia) like any (array['%químic%', '%quimic%']) then 'quimica'::public.materia_aluno
  when lower(materia) like any (array['%biolog%', '%genét%', '%genet%', '%ecolog%']) then 'biologia'::public.materia_aluno
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
  when lower(materia) like any (array['%químic%', '%quimic%']) then 'quimica'::public.materia_aluno
  when lower(materia) like any (array['%biolog%', '%genét%', '%genet%', '%ecolog%']) then 'biologia'::public.materia_aluno
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
        materia_input in ('matematica', 'fisica', 'quimica', 'biologia', 'portugues', 'redacao')
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
-- ETAPA 3/67: schema/configuracoes.sql
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
-- ETAPA 4/67: schema/biblioteca.sql
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
-- ETAPA 5/67: schema/estoque-etapa1.sql
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
-- ETAPA 6/67: schema/estoque-etapa2.sql
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
-- ETAPA 7/67: schema/conquistas.sql
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
-- ETAPA 8/67: schema/espacos-docentes.sql
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
-- ETAPA 9/67: migrations/20260831_trilhas_estudos_completos.sql
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
-- ETAPA 10/67: migrations/20260831_redacao_jornada_completa.sql
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
-- ETAPA 11/67: migrations/20260831_agenda_notificacoes.sql
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
-- ETAPA 12/67: migrations/20260902_biblioteca_acervo_unificado.sql
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
-- ETAPA 13/67: migrations/20260903_portal_gestor.sql
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
-- ETAPA 14/67: migrations/20260903_perfis_gestor_rls.sql
-- ============================================================================

alter table public.perfis add column if not exists ativo boolean not null default true;

-- A role do gestor e o status ativo são consultados fora do RLS da própria tabela.
-- Isso evita recursão quando a função é usada nas policies de perfis.
create or replace function public.gestor_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis p
    where p.id = (select auth.uid())
      and p.role = 'gestor'
      and p.ativo = true
  );
$$;

revoke all on function public.gestor_ativo() from public, anon, authenticated;
grant execute on function public.gestor_ativo() to authenticated;

alter table public.perfis enable row level security;

drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis for select to authenticated
using (
  id = (select auth.uid())
  or public.gestor_ativo()
  or (
    (select public.usuario_role()) = 'professor'
    and exists (
      select 1
      from public.professor_turmas pt
      where pt.professor_id = (select auth.uid())
        and pt.turma_id = perfis.turma_id
    )
  )
);

drop policy if exists perfis_update_gestor on public.perfis;
create policy perfis_update_gestor on public.perfis for update to authenticated
using (public.gestor_ativo())
with check (public.gestor_ativo());

-- O frontend do gestor edita apenas estes atributos. Role, ativo e credenciais
-- permanecem protegidos; as duas últimas operações usam a Edge Function.
revoke update on public.perfis from authenticated;
grant update (nome, matricula, curso_tecnico, turma_id, tipo_professor) on public.perfis to authenticated;
grant select on public.perfis to authenticated;
grant usage on schema public to authenticated;

revoke all on public.perfis from anon;

-- ============================================================================
-- ETAPA 15/67: migrations/20260903_importacao_curricular.sql
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
-- ETAPA 16/67: migrations/20260903_importacao_curricular_fase1.sql
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
-- ETAPA 17/67: migrations/20260903_importacao_curricular_fase2.sql
-- ============================================================================

alter table public.importacoes_curriculo_itens
  drop constraint if exists importacoes_curriculo_itens_tipo_check;
alter table public.importacoes_curriculo_itens
  add constraint importacoes_curriculo_itens_tipo_check
  check (tipo in ('habilidade','referencia_ensino_fundamental','descritor','aviso'));

-- ============================================================================
-- ETAPA 18/67: migrations/20260903_importacao_curricular_fase3.sql
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
-- ETAPA 19/67: migrations/20260903_importacao_curricular_fase3_1.sql
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
-- ETAPA 20/67: migrations/20260903_redacoes_avaliacoes_portugues.sql
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
-- ETAPA 21/67: migrations/20260904_importacao_curricular_fase3_2.sql
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
-- ETAPA 22/67: migrations/20260904_importacao_curricular_correcao_policy.sql
-- ============================================================================

drop policy if exists objetos_leitura on public.objetos_conhecimento;
create policy objetos_leitura on public.objetos_conhecimento for select to authenticated using (exists (select 1 from public.habilidade_objetos ho join public.curriculo_periodos p on p.id = ho.periodo_id join public.curriculos c on c.id = p.curriculo_id where ho.objeto_id = public.objetos_conhecimento.id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));

-- ============================================================================
-- ETAPA 23/67: migrations/20260904_importacao_curricular_fase3_3.sql
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
      when codigo ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$' then 'habilidade'
      when codigo ~ '^EF\d{2}[A-Z]{2}\d{2}$' then 'referencia_ensino_fundamental'
      else item ->> 'tipo'
    end;
    if codigo ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$' then
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
    when codigo ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$' then 'habilidade'
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
      and upper(payload ->> 'codigo') ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
  ) then raise exception 'Nenhuma habilidade aprovada para publicação'; end if;
  if exists (
    select 1 from public.importacoes_curriculo_itens
    where importacao_id = imp.id
      and tipo = 'habilidade'
      and status = 'revisar'
      and upper(payload ->> 'codigo') ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
  ) then raise exception 'Existem habilidades pendentes'; end if;
  perform pg_advisory_xact_lock(hashtext(coalesce(imp.origem, '') || ':' || imp.ano_letivo || ':' || imp.materia_codigo::text));
  select coalesce(max(versao), 0) + 1 into versao_num from public.curriculos where origem = coalesce(imp.origem, 'Não identificada') and ano_letivo = imp.ano_letivo and materia_codigo = imp.materia_codigo;
  insert into public.curriculos (nome, origem, ano_letivo, materia_codigo, versao, status, criado_por, importacao_id) values (coalesce(imp.origem, 'Currículo importado') || ' ' || imp.ano_letivo, coalesce(imp.origem, 'Não identificada'), imp.ano_letivo, imp.materia_codigo, versao_num, 'publicado', imp.importado_por, imp.id) returning id into curr_id;
  update public.curriculos set status = 'arquivado', ativo = false, updated_at = now() where origem = coalesce(imp.origem, 'Não identificada') and ano_letivo = imp.ano_letivo and materia_codigo = imp.materia_codigo and id <> curr_id and status = 'publicado';
  for item in select payload from public.importacoes_curriculo_itens where importacao_id = imp.id and tipo = 'habilidade' and status in ('ok', 'aprovado') and upper(payload ->> 'codigo') ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$' loop
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
-- ETAPA 24/67: migrations/20260904_importacao_curricular_fase3_4.sql
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
      and upper(payload ->> 'codigo') ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
  ) then raise exception 'Nenhuma habilidade aprovada para publicação'; end if;
  if exists (
    select 1 from public.importacoes_curriculo_itens
    where importacao_id = imp.id
      and tipo = 'habilidade'
      and status = 'revisar'
      and upper(payload ->> 'codigo') ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
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
      and upper(payload ->> 'codigo') ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
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

-- ============================================================================
-- ETAPA 25/67: migrations/20260904_importacao_curricular_fase3_5.sql
-- ============================================================================

create or replace function public.aprovar_importacao_curriculo(p_importacao_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  imp public.importacoes_curriculo;
  curr_id uuid;
  anterior_id uuid;
  periodo public.curriculo_periodos;
  periodo_anterior public.curriculo_periodos;
  habilidade public.habilidades_curriculares;
  descritor public.descritores_curriculares;
  objeto public.objetos_conhecimento;
  item jsonb;
  child jsonb;
  serie_num smallint;
  tri_num smallint;
  versao_num integer;
  curriculo_novo boolean := false;
  periodo_afetado boolean;
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
      and upper(payload ->> 'codigo') ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
  ) then raise exception 'Nenhuma habilidade aprovada para publicação'; end if;
  if exists (
    select 1 from public.importacoes_curriculo_itens
    where importacao_id = imp.id
      and tipo = 'habilidade'
      and status = 'revisar'
      and upper(payload ->> 'codigo') ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
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
  else
    select id into anterior_id
    from public.curriculos
    where origem = coalesce(imp.origem, 'Não identificada')
      and ano_letivo = imp.ano_letivo
      and materia_codigo = imp.materia_codigo
      and status = 'publicado'
      and ativo = true
    order by versao desc
    limit 1;
  end if;

  if curr_id is null and (imp.reprocessamento_de_id is null or anterior_id is not null) then
    select coalesce(max(versao), 0) + 1 into versao_num
    from public.curriculos
    where origem = coalesce(imp.origem, 'Não identificada')
      and ano_letivo = imp.ano_letivo
      and materia_codigo = imp.materia_codigo;
    insert into public.curriculos (nome, origem, ano_letivo, materia_codigo, versao, status, criado_por, importacao_id)
    values (
      coalesce(imp.origem, 'Currículo importado') || ' ' || imp.ano_letivo,
      coalesce(imp.origem, 'Não identificada'), imp.ano_letivo,
      imp.materia_codigo, versao_num, 'rascunho', imp.importado_por, imp.id
    ) returning id into curr_id;
    curriculo_novo := true;
  elsif anterior_id is not null then
    select coalesce(max(versao), 0) + 1 into versao_num
    from public.curriculos
    where origem = coalesce(imp.origem, 'Não identificada')
      and ano_letivo = imp.ano_letivo
      and materia_codigo = imp.materia_codigo;
    insert into public.curriculos (nome, origem, ano_letivo, materia_codigo, versao, status, criado_por, importacao_id)
    values (
      coalesce(imp.origem, 'Currículo importado') || ' ' || imp.ano_letivo,
      coalesce(imp.origem, 'Não identificada'), imp.ano_letivo,
      imp.materia_codigo, versao_num, 'rascunho', imp.importado_por, imp.id
    ) returning id into curr_id;
    curriculo_novo := true;
  end if;

  if curr_id is null then
    raise exception 'Currículo compatível não encontrado';
  end if;

  if anterior_id is not null then
    for periodo_anterior in
      select cp.*
      from public.curriculo_periodos cp
      where cp.curriculo_id = anterior_id
    loop
      select exists (
        select 1
        from public.importacoes_curriculo_itens i
        where i.importacao_id = imp.id
          and i.tipo = 'habilidade'
          and i.status in ('ok', 'aprovado')
          and upper(i.payload ->> 'codigo') ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
          and nullif(i.payload ->> 'serie', '')::smallint = periodo_anterior.serie
          and coalesce(nullif(i.payload ->> 'trimestre', '')::smallint, imp.trimestre) = periodo_anterior.trimestre
      ) into periodo_afetado;
      if not periodo_afetado then
        insert into public.curriculo_periodos (curriculo_id, serie, trimestre)
        values (curr_id, periodo_anterior.serie, periodo_anterior.trimestre)
        on conflict (curriculo_id, serie, trimestre) do update set trimestre = excluded.trimestre
        returning * into periodo;
        insert into public.habilidade_curriculo_periodos (habilidade_id, periodo_id, quinzena, semana, source_page)
        select hcp.habilidade_id, periodo.id, hcp.quinzena, hcp.semana, hcp.source_page
        from public.habilidade_curriculo_periodos hcp
        where hcp.periodo_id = periodo_anterior.id
        on conflict (habilidade_id, periodo_id) do update
          set quinzena = excluded.quinzena, semana = excluded.semana, source_page = excluded.source_page;
        insert into public.habilidade_descritores (habilidade_id, descritor_id, periodo_id)
        select hd.habilidade_id, hd.descritor_id, periodo.id
        from public.habilidade_descritores hd
        where hd.periodo_id = periodo_anterior.id
        on conflict do nothing;
        insert into public.expectativas_aprendizagem (habilidade_id, periodo_id, descricao)
        select ea.habilidade_id, periodo.id, ea.descricao
        from public.expectativas_aprendizagem ea
        where ea.periodo_id = periodo_anterior.id
        on conflict do nothing;
        insert into public.habilidade_objetos (habilidade_id, objeto_id, periodo_id)
        select ho.habilidade_id, ho.objeto_id, periodo.id
        from public.habilidade_objetos ho
        where ho.periodo_id = periodo_anterior.id
        on conflict do nothing;
      end if;
    end loop;
  end if;

  for item in
    select payload from public.importacoes_curriculo_itens
    where importacao_id = imp.id
      and tipo = 'habilidade'
      and status in ('ok', 'aprovado')
      and upper(payload ->> 'codigo') ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
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

  update public.curriculos
  set status = 'publicado', ativo = true, updated_at = now()
  where id = curr_id;
  if anterior_id is not null then
    update public.curriculos
    set status = 'arquivado', ativo = false, updated_at = now()
    where id = anterior_id;
  end if;
  update public.importacoes_curriculo
  set status = 'aprovada', curriculo_id = curr_id, versao = (select versao from public.curriculos where id = curr_id), updated_at = now()
  where id = imp.id;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes)
  values (
    (select auth.uid()), 'aprovacao_publicacao', 'curriculo', curr_id::text,
    jsonb_build_object('importacao_id', imp.id, 'versao', (select versao from public.curriculos where id = curr_id), 'curriculo_reutilizado', not curriculo_novo, 'reprocessamento', imp.reprocessamento_de_id is not null, 'curriculo_anterior_id', anterior_id)
  );
  return curr_id;
end;
$$;

revoke all on function public.aprovar_importacao_curriculo(uuid) from public, anon, authenticated;
grant execute on function public.aprovar_importacao_curriculo(uuid) to authenticated;

-- ============================================================================
-- ETAPA 26/67: migrations/20260905_integracao_curricular_fase4.sql
-- ============================================================================

create table if not exists public.questoes_avaliacao_habilidades (
  questao_id uuid not null references public.questoes_avaliacao(id) on delete cascade,
  habilidade_id uuid not null references public.habilidades_curriculares(id) on delete restrict,
  primary key (questao_id, habilidade_id)
);

create table if not exists public.laboratorios_docentes_habilidades (
  laboratorio_id uuid not null references public.laboratorios_docentes(id) on delete cascade,
  habilidade_id uuid not null references public.habilidades_curriculares(id) on delete restrict,
  primary key (laboratorio_id, habilidade_id)
);

create table if not exists public.atividades_habilidades (
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  habilidade_id uuid not null references public.habilidades_curriculares(id) on delete restrict,
  primary key (atividade_id, habilidade_id)
);

create table if not exists public.propostas_redacao_habilidades (
  proposta_id uuid not null references public.propostas_redacao(id) on delete cascade,
  habilidade_id uuid not null references public.habilidades_curriculares(id) on delete restrict,
  primary key (proposta_id, habilidade_id)
);

create index if not exists questoes_avaliacao_habilidades_habilidade_idx
  on public.questoes_avaliacao_habilidades (habilidade_id, questao_id);
create index if not exists laboratorios_docentes_habilidades_habilidade_idx
  on public.laboratorios_docentes_habilidades (habilidade_id, laboratorio_id);
create index if not exists atividades_habilidades_habilidade_idx
  on public.atividades_habilidades (habilidade_id, atividade_id);
create index if not exists propostas_redacao_habilidades_habilidade_idx
  on public.propostas_redacao_habilidades (habilidade_id, proposta_id);

alter table public.questoes_avaliacao_habilidades enable row level security;
alter table public.laboratorios_docentes_habilidades enable row level security;
alter table public.atividades_habilidades enable row level security;
alter table public.propostas_redacao_habilidades enable row level security;

create or replace function public.habilidade_curricular_publicada(p_habilidade_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.habilidades_curriculares h
    join public.habilidade_curriculo_periodos hcp on hcp.habilidade_id = h.id
    join public.curriculo_periodos cp on cp.id = hcp.periodo_id
    join public.curriculos c on c.id = cp.curriculo_id
    where h.id = p_habilidade_id
      and h.codigo ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
      and c.status = 'publicado'
      and c.ativo = true
  );
$$;

revoke all on function public.habilidade_curricular_publicada(uuid) from public, anon;
grant execute on function public.habilidade_curricular_publicada(uuid) to authenticated;

create or replace function public.buscar_habilidades_curriculares(
  p_materia public.materia_aluno,
  p_serie smallint default null,
  p_trimestre smallint default null,
  p_busca text default null
)
returns table (
  habilidade_id uuid,
  codigo text,
  descricao text,
  serie smallint,
  trimestre smallint,
  curriculo_id uuid,
  descritores jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    h.id,
    h.codigo,
    h.descricao,
    cp.serie,
    cp.trimestre,
    c.id,
    coalesce(
      jsonb_agg(jsonb_build_object('codigo', d.codigo, 'titulo', d.titulo) order by d.codigo)
        filter (where d.id is not null),
      '[]'::jsonb
    )
  from public.habilidades_curriculares h
  join public.habilidade_curriculo_periodos hcp on hcp.habilidade_id = h.id
  join public.curriculo_periodos cp on cp.id = hcp.periodo_id
  join public.curriculos c on c.id = cp.curriculo_id
  left join public.habilidade_descritores hd
    on hd.habilidade_id = h.id and hd.periodo_id = cp.id
  left join public.descritores_curriculares d on d.id = hd.descritor_id
  where h.materia_codigo = p_materia
    and h.codigo ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
    and c.status = 'publicado'
    and c.ativo = true
    and (p_serie is null or cp.serie = p_serie)
    and (p_trimestre is null or cp.trimestre = p_trimestre)
    and (
      nullif(btrim(coalesce(p_busca, '')), '') is null
      or h.codigo ilike '%' || btrim(p_busca) || '%'
      or h.descricao ilike '%' || btrim(p_busca) || '%'
      or exists (
        select 1
        from public.habilidade_descritores hds
        join public.descritores_curriculares ds on ds.id = hds.descritor_id
        where hds.habilidade_id = h.id
          and hds.periodo_id = cp.id
          and (ds.codigo ilike '%' || btrim(p_busca) || '%' or ds.titulo ilike '%' || btrim(p_busca) || '%')
      )
    )
  group by h.id, h.codigo, h.descricao, cp.serie, cp.trimestre, c.id
  order by h.codigo, cp.serie, cp.trimestre;
$$;

revoke all on function public.buscar_habilidades_curriculares(public.materia_aluno, smallint, smallint, text) from public, anon;
grant execute on function public.buscar_habilidades_curriculares(public.materia_aluno, smallint, smallint, text) to authenticated;

drop policy if exists questoes_avaliacao_habilidades_select on public.questoes_avaliacao_habilidades;
create policy questoes_avaliacao_habilidades_select on public.questoes_avaliacao_habilidades for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.questoes_avaliacao q
    join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where q.id = questao_id and (
      a.professor_id = (select auth.uid())
      or (a.status = 'publicado' and a.turma_id = (select public.usuario_turma_id()))
    )
  )
);
drop policy if exists questoes_avaliacao_habilidades_manage on public.questoes_avaliacao_habilidades;
create policy questoes_avaliacao_habilidades_manage on public.questoes_avaliacao_habilidades for all to authenticated
using (
  (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.questoes_avaliacao q join public.avaliacoes_docentes a on a.id = q.avaliacao_id where q.id = questao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho')
)
with check (
  public.habilidade_curricular_publicada(habilidade_id)
  and (
    (select public.usuario_role()) = 'gestor'
    or exists (
      select 1 from public.questoes_avaliacao q
      join public.avaliacoes_docentes a on a.id = q.avaliacao_id
      where q.id = questao_id
        and a.professor_id = (select auth.uid())
        and a.status = 'rascunho'
        and a.tipo_professor::text = (select public.usuario_tipo_professor())::text
    )
  )
);

drop policy if exists laboratorios_docentes_habilidades_select on public.laboratorios_docentes_habilidades;
create policy laboratorios_docentes_habilidades_select on public.laboratorios_docentes_habilidades for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.laboratorios_docentes l where l.id = laboratorio_id and (l.professor_id = (select auth.uid()) or (l.status = 'publicado' and l.turma_id = (select public.usuario_turma_id()))))
);
drop policy if exists laboratorios_docentes_habilidades_manage on public.laboratorios_docentes_habilidades;
create policy laboratorios_docentes_habilidades_manage on public.laboratorios_docentes_habilidades for all to authenticated
using ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.laboratorios_docentes l where l.id = laboratorio_id and l.professor_id = (select auth.uid()) and l.status = 'rascunho'))
with check (
  public.habilidade_curricular_publicada(habilidade_id)
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.laboratorios_docentes l where l.id = laboratorio_id and l.professor_id = (select auth.uid()) and l.status = 'rascunho' and l.tipo_professor::text = (select public.usuario_tipo_professor())::text))
);

drop policy if exists atividades_habilidades_select on public.atividades_habilidades;
create policy atividades_habilidades_select on public.atividades_habilidades for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.atividades a
    join public.trilhas t on t.id = a.trilha_id
    where a.id = atividade_id and (
      t.professor_id = (select auth.uid())
      or (t.publicada = true and (t.turma_id is null or t.turma_id = (select public.usuario_turma_id())))
    )
  )
);
drop policy if exists atividades_habilidades_manage on public.atividades_habilidades;
create policy atividades_habilidades_manage on public.atividades_habilidades for all to authenticated
using ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.atividades a join public.trilhas t on t.id = a.trilha_id where a.id = atividade_id and t.professor_id = (select auth.uid())))
with check (
  public.habilidade_curricular_publicada(habilidade_id)
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.atividades a join public.trilhas t on t.id = a.trilha_id where a.id = atividade_id and t.professor_id = (select auth.uid()) and t.materia_codigo::text = (select public.usuario_tipo_professor())::text))
);

drop policy if exists propostas_redacao_habilidades_select on public.propostas_redacao_habilidades;
create policy propostas_redacao_habilidades_select on public.propostas_redacao_habilidades for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.propostas_redacao p where p.id = proposta_id and (p.professor_id = (select auth.uid()) or (p.publicada = true and (p.turma_id is null or p.turma_id = (select public.usuario_turma_id())))))
);
drop policy if exists propostas_redacao_habilidades_manage on public.propostas_redacao_habilidades;
create policy propostas_redacao_habilidades_manage on public.propostas_redacao_habilidades for all to authenticated
using ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.propostas_redacao p where p.id = proposta_id and p.professor_id = (select auth.uid()) and p.publicada = false))
with check (
  public.habilidade_curricular_publicada(habilidade_id)
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.propostas_redacao p where p.id = proposta_id and p.professor_id = (select auth.uid()) and p.publicada = false))
);

grant select, insert, update, delete on public.questoes_avaliacao_habilidades, public.laboratorios_docentes_habilidades, public.atividades_habilidades, public.propostas_redacao_habilidades to authenticated;

create or replace function public.cobertura_curricular(
  p_materia public.materia_aluno default null,
  p_serie smallint default null,
  p_trimestre smallint default null,
  p_turma_id uuid default null,
  p_professor_id uuid default null
)
returns table (
  habilidade_id uuid,
  codigo text,
  descricao text,
  serie smallint,
  trimestre smallint,
  utilizada boolean,
  usos jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (public.usuario_role() <> 'gestor') then raise exception 'Apenas gestores podem consultar cobertura'; end if;
  return query
  with base as (
    select distinct h.id, h.codigo, h.descricao, cp.serie, cp.trimestre
    from public.habilidades_curriculares h
    join public.habilidade_curriculo_periodos hcp on hcp.habilidade_id = h.id
    join public.curriculo_periodos cp on cp.id = hcp.periodo_id
    join public.curriculos c on c.id = cp.curriculo_id
    where c.status = 'publicado' and c.ativo = true
      and h.codigo ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
      and (p_materia is null or h.materia_codigo = p_materia)
      and (p_serie is null or cp.serie = p_serie)
      and (p_trimestre is null or cp.trimestre = p_trimestre)
  ), usos as (
    select qh.habilidade_id, 'avaliação'::text as tipo, a.id as recurso_id, a.titulo as recurso
    from public.questoes_avaliacao_habilidades qh join public.questoes_avaliacao q on q.id = qh.questao_id join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where (p_turma_id is null or a.turma_id = p_turma_id) and (p_professor_id is null or a.professor_id = p_professor_id)
    union all
    select lh.habilidade_id, 'laboratório', l.id, l.titulo
    from public.laboratorios_docentes_habilidades lh join public.laboratorios_docentes l on l.id = lh.laboratorio_id
    where (p_turma_id is null or l.turma_id = p_turma_id) and (p_professor_id is null or l.professor_id = p_professor_id)
    union all
    select ah.habilidade_id, 'atividade', a.id, a.titulo
    from public.atividades_habilidades ah join public.atividades a on a.id = ah.atividade_id join public.trilhas t on t.id = a.trilha_id
    where (p_turma_id is null or t.turma_id = p_turma_id) and (p_professor_id is null or t.professor_id = p_professor_id)
    union all
    select ph.habilidade_id, 'redação', p.id, p.titulo
    from public.propostas_redacao_habilidades ph join public.propostas_redacao p on p.id = ph.proposta_id
    where (p_turma_id is null or p.turma_id = p_turma_id) and (p_professor_id is null or p.professor_id = p_professor_id)
  )
  select b.id, b.codigo, b.descricao, b.serie, b.trimestre,
    count(u.habilidade_id) > 0,
    coalesce(jsonb_agg(jsonb_build_object('tipo', u.tipo, 'recurso_id', u.recurso_id, 'recurso', u.recurso) order by u.tipo, u.recurso) filter (where u.habilidade_id is not null), '[]'::jsonb)
  from base b left join usos u on u.habilidade_id = b.id
  group by b.id, b.codigo, b.descricao, b.serie, b.trimestre
  order by b.codigo, b.serie, b.trimestre;
end;
$$;

revoke all on function public.cobertura_curricular(public.materia_aluno, smallint, smallint, uuid, uuid) from public, anon, authenticated;
grant execute on function public.cobertura_curricular(public.materia_aluno, smallint, smallint, uuid, uuid) to authenticated;

-- ============================================================================
-- ETAPA 27/67: migrations/20260905_integracao_curricular_fase4_1.sql
-- ============================================================================

create or replace function public.habilidade_compativel_com_materia(
  p_habilidade_id uuid,
  p_materia public.materia_aluno
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.habilidades_curriculares h
    join public.habilidade_curriculo_periodos hcp on hcp.habilidade_id = h.id
    join public.curriculo_periodos cp on cp.id = hcp.periodo_id
    join public.curriculos c on c.id = cp.curriculo_id
    where h.id = p_habilidade_id
      and h.materia_codigo = p_materia
      and h.codigo ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
      and c.status = 'publicado'
      and c.ativo = true
  );
$$;

revoke all on function public.habilidade_compativel_com_materia(uuid, public.materia_aluno) from public, anon;
grant execute on function public.habilidade_compativel_com_materia(uuid, public.materia_aluno) to authenticated;

drop policy if exists questoes_avaliacao_habilidades_select on public.questoes_avaliacao_habilidades;
create policy questoes_avaliacao_habilidades_select on public.questoes_avaliacao_habilidades for select to authenticated using (
  public.habilidade_compativel_com_materia(
    habilidade_id,
    (select a.tipo_professor::text::public.materia_aluno
     from public.questoes_avaliacao q
     join public.avaliacoes_docentes a on a.id = q.avaliacao_id
     where q.id = questao_id)
  )
  and (
    (select public.usuario_role()) = 'gestor'
    or exists (
      select 1 from public.questoes_avaliacao q
      join public.avaliacoes_docentes a on a.id = q.avaliacao_id
      where q.id = questao_id and (
        a.professor_id = (select auth.uid())
        or (a.status = 'publicado' and a.turma_id = (select public.usuario_turma_id()))
      )
    )
  )
);
drop policy if exists questoes_avaliacao_habilidades_manage on public.questoes_avaliacao_habilidades;
create policy questoes_avaliacao_habilidades_manage on public.questoes_avaliacao_habilidades for all to authenticated
using (
  public.habilidade_compativel_com_materia(
    habilidade_id,
    (select a.tipo_professor::text::public.materia_aluno
     from public.questoes_avaliacao q
     join public.avaliacoes_docentes a on a.id = q.avaliacao_id
     where q.id = questao_id)
  )
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.questoes_avaliacao q join public.avaliacoes_docentes a on a.id = q.avaliacao_id where q.id = questao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho'))
)
with check (
  public.habilidade_compativel_com_materia(
    habilidade_id,
    (select a.tipo_professor::text::public.materia_aluno
     from public.questoes_avaliacao q
     join public.avaliacoes_docentes a on a.id = q.avaliacao_id
     where q.id = questao_id)
  )
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.questoes_avaliacao q join public.avaliacoes_docentes a on a.id = q.avaliacao_id where q.id = questao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho' and a.tipo_professor::text = (select public.usuario_tipo_professor())::text))
);

drop policy if exists laboratorios_docentes_habilidades_select on public.laboratorios_docentes_habilidades;
create policy laboratorios_docentes_habilidades_select on public.laboratorios_docentes_habilidades for select to authenticated using (
  public.habilidade_compativel_com_materia(
    habilidade_id,
    (select l.tipo_professor::text::public.materia_aluno from public.laboratorios_docentes l where l.id = laboratorio_id)
  )
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.laboratorios_docentes l where l.id = laboratorio_id and (l.professor_id = (select auth.uid()) or (l.status = 'publicado' and l.turma_id = (select public.usuario_turma_id())))))
);
drop policy if exists laboratorios_docentes_habilidades_manage on public.laboratorios_docentes_habilidades;
create policy laboratorios_docentes_habilidades_manage on public.laboratorios_docentes_habilidades for all to authenticated
using (
  public.habilidade_compativel_com_materia(
    habilidade_id,
    (select l.tipo_professor::text::public.materia_aluno from public.laboratorios_docentes l where l.id = laboratorio_id)
  )
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.laboratorios_docentes l where l.id = laboratorio_id and l.professor_id = (select auth.uid()) and l.status = 'rascunho'))
)
with check (
  public.habilidade_compativel_com_materia(
    habilidade_id,
    (select l.tipo_professor::text::public.materia_aluno from public.laboratorios_docentes l where l.id = laboratorio_id)
  )
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.laboratorios_docentes l where l.id = laboratorio_id and l.professor_id = (select auth.uid()) and l.status = 'rascunho' and l.tipo_professor::text = (select public.usuario_tipo_professor())::text))
);

drop policy if exists atividades_habilidades_select on public.atividades_habilidades;
create policy atividades_habilidades_select on public.atividades_habilidades for select to authenticated using (
  public.habilidade_compativel_com_materia(
    habilidade_id,
    (select t.materia_codigo from public.atividades a join public.trilhas t on t.id = a.trilha_id where a.id = atividade_id)
  )
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.atividades a join public.trilhas t on t.id = a.trilha_id where a.id = atividade_id and (t.professor_id = (select auth.uid()) or (t.publicada = true and (t.turma_id is null or t.turma_id = (select public.usuario_turma_id()))))))
);
drop policy if exists atividades_habilidades_manage on public.atividades_habilidades;
create policy atividades_habilidades_manage on public.atividades_habilidades for all to authenticated
using (
  public.habilidade_compativel_com_materia(
    habilidade_id,
    (select t.materia_codigo from public.atividades a join public.trilhas t on t.id = a.trilha_id where a.id = atividade_id)
  )
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.atividades a join public.trilhas t on t.id = a.trilha_id where a.id = atividade_id and t.professor_id = (select auth.uid())))
)
with check (
  public.habilidade_compativel_com_materia(
    habilidade_id,
    (select t.materia_codigo from public.atividades a join public.trilhas t on t.id = a.trilha_id where a.id = atividade_id)
  )
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.atividades a join public.trilhas t on t.id = a.trilha_id where a.id = atividade_id and t.professor_id = (select auth.uid()) and t.materia_codigo::text = (select public.usuario_tipo_professor())::text))
);

drop policy if exists propostas_redacao_habilidades_select on public.propostas_redacao_habilidades;
create policy propostas_redacao_habilidades_select on public.propostas_redacao_habilidades for select to authenticated using (
  public.habilidade_compativel_com_materia(habilidade_id, 'portugues'::public.materia_aluno)
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.propostas_redacao p where p.id = proposta_id and (p.professor_id = (select auth.uid()) or (p.publicada = true and (p.turma_id is null or p.turma_id = (select public.usuario_turma_id()))))))
);
drop policy if exists propostas_redacao_habilidades_manage on public.propostas_redacao_habilidades;
create policy propostas_redacao_habilidades_manage on public.propostas_redacao_habilidades for all to authenticated
using (
  public.habilidade_compativel_com_materia(habilidade_id, 'portugues'::public.materia_aluno)
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.propostas_redacao p where p.id = proposta_id and p.professor_id = (select auth.uid()) and p.publicada = false))
)
with check (
  public.habilidade_compativel_com_materia(habilidade_id, 'portugues'::public.materia_aluno)
  and ((select public.usuario_role()) = 'gestor' or exists (select 1 from public.propostas_redacao p where p.id = proposta_id and p.professor_id = (select auth.uid()) and p.publicada = false))
);

-- ============================================================================
-- ETAPA 28/67: migrations/20260905_descritores_manual_fase2.sql
-- ============================================================================

create or replace function public.salvar_descritores_curriculares_lote(p_descritores jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  payload jsonb;
  resultado jsonb := '[]'::jsonb;
  codigos text[] := '{}';
  codigo text;
  titulo text;
  descricao text;
  materia_text text;
  materia public.materia_aluno;
  serie_num smallint;
  trimestre_num smallint;
  status_text text;
  habilidade_id uuid;
  v_descritor_id uuid;
  periodo_id uuid;
  habilidade public.habilidades_curriculares;
  v_periodo public.curriculo_periodos;
  contador integer := 0;
begin
  if (select auth.uid()) is null or public.usuario_role() <> 'gestor' then
    raise exception 'Somente gestores podem cadastrar descritores';
  end if;
  if jsonb_typeof(p_descritores) <> 'array' or jsonb_array_length(p_descritores) not between 1 and 5 then
    raise exception 'O lote deve conter entre 1 e 5 descritores';
  end if;

  for item in select value from jsonb_array_elements(p_descritores) loop
    contador := contador + 1;
    codigo := upper(btrim(item ->> 'codigo'));
    titulo := btrim(item ->> 'titulo');
    descricao := btrim(item ->> 'descricao');
    materia_text := btrim(item ->> 'materia_codigo');
    serie_num := nullif(item ->> 'serie', '')::smallint;
    trimestre_num := nullif(item ->> 'trimestre', '')::smallint;
    status_text := btrim(coalesce(item ->> 'status', 'revisao'));
    habilidade_id := nullif(item ->> 'habilidade_id', '')::uuid;

    if codigo !~ '^D\d{3}(?:_[A-Z])?$' then raise exception 'Código de descritor inválido no item %', contador; end if;
    if titulo is null or char_length(titulo) not between 3 and 180 then raise exception 'Título inválido no item %', contador; end if;
    if descricao is null or char_length(descricao) not between 1 and 20000 then raise exception 'Descrição inválida no item %', contador; end if;
    if materia_text not in ('portugues', 'matematica', 'fisica', 'quimica', 'biologia', 'redacao', 'tecnico_administracao', 'tecnico_informatica') then raise exception 'Matéria inválida no item %', contador; end if;
    materia := materia_text::public.materia_aluno;
    if serie_num not between 1 and 3 or trimestre_num not between 1 and 3 then raise exception 'Série ou trimestre inválido no item %', contador; end if;
    if status_text not in ('ativo', 'revisao', 'arquivado') then raise exception 'Status inválido no item %', contador; end if;
    if codigo = any(codigos) then raise exception 'Código % repetido no lote', codigo; end if;
    if exists (select 1 from public.descritores_curriculares dc where dc.codigo = codigo) then raise exception 'Código % já cadastrado', codigo; end if;
    codigos := array_append(codigos, codigo);

    if habilidade_id is not null then
      select h.* into habilidade from public.habilidades_curriculares h where h.id = habilidade_id;
      if habilidade.id is null then raise exception 'Habilidade selecionada não encontrada'; end if;
      if habilidade.materia_codigo <> materia then raise exception 'Habilidade % não pertence à matéria %', habilidade.codigo, materia_text; end if;
      select cp.* into v_periodo
      from public.habilidade_curriculo_periodos hcp
      join public.curriculo_periodos cp on cp.id = hcp.periodo_id
      join public.curriculos c on c.id = cp.curriculo_id
      where hcp.habilidade_id = habilidade_id and cp.serie = serie_num and cp.trimestre = trimestre_num and c.status = 'publicado' and c.ativo = true
      order by c.versao desc limit 1;
      if v_periodo.id is null then raise exception 'A habilidade % não possui período curricular publicado compatível com %ª série / %º trimestre', habilidade.codigo, serie_num, trimestre_num; end if;
      periodo_id := v_periodo.id;
    end if;

    insert into public.descritores_curriculares (codigo, titulo, descricao, materia_codigo, serie, trimestre, status, criado_por)
    values (codigo, titulo, descricao, materia, serie_num, trimestre_num, status_text, (select auth.uid()))
    returning id into v_descritor_id;

    if habilidade_id is not null then
      insert into public.habilidade_descritores (habilidade_id, descritor_id, periodo_id)
      values (habilidade_id, v_descritor_id, periodo_id);
    end if;
    resultado := resultado || jsonb_build_array(jsonb_build_object('id', v_descritor_id, 'codigo', codigo));
  end loop;

  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes)
  values ((select auth.uid()), 'cadastro_descritores_lote', 'descritores_curriculares', null, jsonb_build_object('quantidade', jsonb_array_length(p_descritores), 'codigos', to_jsonb(codigos)));
  return jsonb_build_object('quantidade', jsonb_array_length(p_descritores), 'descritores', resultado);
end;
$$;

create or replace function public.atualizar_descritor_curricular(p_descritor_id uuid, p_descritor jsonb)
returns public.descritores_curriculares
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resultado public.descritores_curriculares;
  codigo text := upper(btrim(p_descritor ->> 'codigo'));
  titulo text := btrim(p_descritor ->> 'titulo');
  descricao text := btrim(p_descritor ->> 'descricao');
  materia_text text := btrim(p_descritor ->> 'materia_codigo');
  materia public.materia_aluno;
  serie_num smallint := nullif(p_descritor ->> 'serie', '')::smallint;
  trimestre_num smallint := nullif(p_descritor ->> 'trimestre', '')::smallint;
  status_text text := btrim(coalesce(p_descritor ->> 'status', 'revisao'));
  habilidade_id uuid := nullif(p_descritor ->> 'habilidade_id', '')::uuid;
  habilidade public.habilidades_curriculares;
  v_periodo public.curriculo_periodos;
  v_descritor_atual public.descritores_curriculares;
begin
  if (select auth.uid()) is null or public.usuario_role() <> 'gestor' then raise exception 'Somente gestores podem editar descritores'; end if;
  select * into v_descritor_atual from public.descritores_curriculares where id = p_descritor_id for update;
  if v_descritor_atual.id is null then raise exception 'Descritor não encontrado'; end if;
  if codigo !~ '^D\d{3}(?:_[A-Z])?$' then raise exception 'Código de descritor inválido'; end if;
  if titulo is null or char_length(titulo) not between 3 and 180 then raise exception 'Título inválido'; end if;
  if descricao is null or char_length(descricao) not between 1 and 20000 then raise exception 'Descrição inválida'; end if;
  if materia_text not in ('portugues', 'matematica', 'fisica', 'quimica', 'biologia', 'redacao', 'tecnico_administracao', 'tecnico_informatica') then raise exception 'Matéria inválida'; end if;
  materia := materia_text::public.materia_aluno;
  if serie_num not between 1 and 3 or trimestre_num not between 1 and 3 then raise exception 'Série ou trimestre inválido'; end if;
  if status_text not in ('ativo', 'revisao', 'arquivado') then raise exception 'Status inválido'; end if;
  if exists (select 1 from public.descritores_curriculares dc where dc.codigo = upper(btrim(p_descritor ->> 'codigo')) and dc.id <> p_descritor_id) then raise exception 'Código % já cadastrado', codigo; end if;

  if habilidade_id is not null then
    select h.* into habilidade from public.habilidades_curriculares h where h.id = habilidade_id;
    if habilidade.id is null then raise exception 'Habilidade selecionada não encontrada'; end if;
    if habilidade.materia_codigo <> materia then raise exception 'Habilidade % não pertence à matéria %', habilidade.codigo, materia_text; end if;
    select cp.* into v_periodo
    from public.habilidade_curriculo_periodos hcp
    join public.curriculo_periodos cp on cp.id = hcp.periodo_id
    join public.curriculos c on c.id = cp.curriculo_id
    where hcp.habilidade_id = habilidade_id and cp.serie = serie_num and cp.trimestre = trimestre_num and c.status = 'publicado' and c.ativo = true
    order by c.versao desc limit 1;
    if v_periodo.id is null then raise exception 'A habilidade % não possui período curricular publicado compatível com %ª série / %º trimestre', habilidade.codigo, serie_num, trimestre_num; end if;
  end if;

  update public.descritores_curriculares
  set codigo = upper(btrim(p_descritor ->> 'codigo')), titulo = btrim(p_descritor ->> 'titulo'), descricao = btrim(p_descritor ->> 'descricao'), materia_codigo = btrim(p_descritor ->> 'materia_codigo')::public.materia_aluno, serie = nullif(p_descritor ->> 'serie', '')::smallint, trimestre = nullif(p_descritor ->> 'trimestre', '')::smallint, status = btrim(coalesce(p_descritor ->> 'status', 'revisao')), updated_at = now()
  where id = p_descritor_id
  returning * into v_resultado;
  delete from public.habilidade_descritores where descritor_id = p_descritor_id;
  if habilidade_id is not null then
    insert into public.habilidade_descritores (habilidade_id, descritor_id, periodo_id)
    values (habilidade_id, p_descritor_id, v_periodo.id);
  end if;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes)
  values ((select auth.uid()), 'edicao_descritor', 'descritores_curriculares', p_descritor_id::text, jsonb_build_object('codigo', codigo, 'habilidade_id', habilidade_id));
  return v_resultado;
end;
$$;

revoke all on function public.salvar_descritores_curriculares_lote(jsonb) from public, anon;
grant execute on function public.salvar_descritores_curriculares_lote(jsonb) to authenticated;
revoke all on function public.atualizar_descritor_curricular(uuid, jsonb) from public, anon;
grant execute on function public.atualizar_descritor_curricular(uuid, jsonb) to authenticated;

-- ============================================================================
-- ETAPA 29/67: migrations/20260907_base_comum_enum.sql
-- ============================================================================

-- Execute esta migração isoladamente antes do catálogo em bancos existentes.
-- O PostgreSQL exige que novos valores de enum sejam confirmados antes do uso.
alter type public.materia_aluno add value if not exists 'quimica' after 'fisica';
alter type public.materia_aluno add value if not exists 'biologia' after 'quimica';

-- ============================================================================
-- ETAPA 30/67: migrations/20260907_catalogo_curricular_base_comum.sql
-- ============================================================================

alter table public.habilidade_curriculo_periodos
  add column if not exists unidade_tematica text,
  add column if not exists arquivo_fonte text;

create table if not exists public.descritor_curriculo_periodos (
  descritor_id uuid not null references public.descritores_curriculares(id) on delete cascade,
  periodo_id uuid not null references public.curriculo_periodos(id) on delete cascade,
  source_page integer check (source_page is null or source_page > 0),
  arquivo_fonte text,
  primary key (descritor_id, periodo_id)
);

create index if not exists descritor_curriculo_periodos_periodo_idx
  on public.descritor_curriculo_periodos (periodo_id, descritor_id);

alter table public.descritor_curriculo_periodos enable row level security;
drop policy if exists descritor_periodos_leitura on public.descritor_curriculo_periodos;
create policy descritor_periodos_leitura on public.descritor_curriculo_periodos
  for select to authenticated using (true);
drop policy if exists descritor_periodos_gestor on public.descritor_curriculo_periodos;
create policy descritor_periodos_gestor on public.descritor_curriculo_periodos
  for all to authenticated
  using ((select public.usuario_role()) = 'gestor')
  with check ((select public.usuario_role()) = 'gestor');
grant select on public.descritor_curriculo_periodos to authenticated;
grant insert, update, delete on public.descritor_curriculo_periodos to authenticated;

do $seed$
declare
  catalogo jsonb := $catalogo${"versao":"2026.1","origem":"SEDU-ES — Orientações Curriculares 2026 / BNCC","materias":["portugues","matematica","fisica","quimica","biologia"],"fontes":[{"materia_codigo":"portugues","arquivo":"EM_D_LP_26_14_04_26.pdf","trimestre":1},{"materia_codigo":"portugues","arquivo":"OCs-2026-EM-2o-tri.pdf","trimestre":2},{"materia_codigo":"portugues","arquivo":"OCs-2026-EM-3o-tri.pdf","trimestre":3},{"materia_codigo":"matematica","arquivo":"EM_D_MAT_26_14_04_26.pdf","trimestre":1},{"materia_codigo":"matematica","arquivo":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","trimestre":2},{"materia_codigo":"matematica","arquivo":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","trimestre":3},{"materia_codigo":"fisica","arquivo":"fisica-2026.pdf","trimestre":null},{"materia_codigo":"quimica","arquivo":"quimica-2026.pdf","trimestre":null},{"materia_codigo":"biologia","arquivo":"biologia-2026.pdf","trimestre":null}],"habilidades":[{"codigo":"EM13CNT101BIOa/ES","materia_codigo":"biologia","descricao":"Identificar e representar, com ou sem o uso de A dispositivos e de aplicativos digitais específicos, as transformações e conservações matéria e da energia para observações e análises à nível microscópico, relacionados a composição orgânica e inorgânica das células.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":19,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Bioquímica celular – Composição orgânica e inorgânica das células."],"expectativas":["Reconhecer e diferenciar os compostos orgânicos (como carboidratos, lipídios, proteínas e ácidos nucleicos) dos compostos inorgânicos (como água, e minerais) e como ambos os compostos participam dos processos celulares. de","Relacionar os compostos bioquímicos aos processos as de transformação e conservação matéria e da energia.","Realizar observações e análises a nível microscópico de estruturas celulares. das"],"descritores":[]}]},{"codigo":"EM13CNT101BIOb/ES","materia_codigo":"biologia","descricao":"Analisar e representar, com ou sem o uso de dispositivos A e de aplicativos digitais específicos, as transformações e conservações matéria, e da energia para observações e análises a nível macroscópico envolvendo situações cotidianas, como a disponibilidade desses componentes no ambiente, em especial no território capixaba, a relação com a alimentação saudável e em processos produtivos que priorizem o desenvolvimento sustentável, o uso consciente dos recursos naturais e a preservação TI da vida em todas as suas formas.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":27,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Fisiologia Humana - Sistema Digestório e Respiratório"],"expectativas":["Conhecer e analisar a anatomia e a fisiologia órgãos do Sistema Digestório, desde a ingestão até eliminação.","Explicar os processos de digestão mecânica e química, identificando a ação das enzimas e do suco digestivo quebra dos nutrientes (carboidratos, lipídios e proteínas). e","Interpretar o processo de absorção de nutrientes, relacionando-o com a estrutura do intestino delgado sua importância para o metabolismo energético.","Conhecer e analisar a anatomia e a fisiologia a órgãos do Sistema Respiratório, identificando funções na captação de oxigênio e eliminação dióxido de carbono.","Explicar os mecanismos da ventilação pulmonar (inspiração e expiração) e o processo de hematose (troca gasosa) nos alvéolos, relacionando-o com circulação sanguínea.","Avaliar a relação entre nutrição, respiração produção de energia pelo organismo (metabolismo celular).","Identificar doenças e distúrbios comuns relacionados aos sistemas digestório e respiratório, analisando importância de hábitos de vida saudáveis na prevenção."],"descritores":[]}]},{"codigo":"EM13CNT102BIOa/ES","materia_codigo":"biologia","descricao":"Realizar previsões, avaliar intervenções e/ou construir A protótipos de sistemas térmicos, como por exemplo a simulação do funcionamento dos organismos vivos, que visem à sustentabilidade e/ou melhor funcionamento dos órgãos e sistemas, considerando sua composição e os efeitos das variáveis termodinâmicas sobre seu funcionamento, considerando também o uso de tecnologias digitais que auxiliem no cálculo de estimativas e no apoio à construção dos protótipos.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":20,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Bioquímica – Estruturas celulares e processos bioquímicos."],"expectativas":["Conhecer as estruturas celulares (animal e vegetal) para compreender os processos bioquímicos realizados pelas células.","Conhecer a organização corporal (células-órgãos- sistemas) para compreender os processos biológicos celulares. a","Simular o funcionamento dos organismos vivos e discutir que as variáveis (como temperatura, pressão e energia) podem afetar organismos vivos e seus sistemas corporais.","Conhecer os processos bioquímicos envolvidos atividades celulares. uso de"],"descritores":[]}]},{"codigo":"EM13CNT102BIOc/ES","materia_codigo":"biologia","descricao":"Realizar previsões, avaliar intervenções e/ou construir A protótipos de sistemas térmicos, como a exemplo dos Biomas e Ecossistemas, que visem à sustentabilidade, considerando sua composição e os efeitos das variáveis termodinâmicas sobre seu funcionamento, considerando também o uso de tecnologias digitais que auxiliem no cálculo de estimativas e no apoio à construção dos protótipos.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":17,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Ecologia – Sustentabilidade de Biomas e Ecossistemas."],"expectativas":["Conhecer as mudanças e comportamentos sistemas naturais, como biomas e ecossistemas, longo do tempo a partir de variáveis termodinâmicas (como temperatura, pressão e energia térmica) e como elas afetam o equilíbrio desses sistemas.","Compreender como fatores como temperatura dos umidade influenciam os processos biológicos e físicos no ambiente. das","Identificar possíveis ações de conservação e sustentabilidade, a partir de mudanças comportamento dos ecossistemas. à","Compreender os conceitos estudados a partir criação de modelos experimentais ou simulações ou sem o uso de tecnologias digitais)."],"descritores":[]}]},{"codigo":"EM13CNT103BIO/ES","materia_codigo":"biologia","descricao":"Utilizar o conhecimento sobre as radiações e suas A origens para avaliar as potencialidades e os riscos de sua aplicação em equipamentos de uso cotidiano, na saúde, no funcionamento das organelas celulares, no ambiente, na indústria, na agricultura.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":21,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Bioquímica Celular – Organelas Celulares e Núcleo Celular"],"expectativas":["Conhecer as organelas celulares (animal e vegetal) suas funções para compreender como fatores externos, como a radiação, podem afetar (positivamente negativamente) o funcionamento celular.","Compreender como a radiação afeta as organelas suas celulares e o núcleo, interferindo em processos celulares de essenciais. na","Conhecer como a radiação afeta as moléculas no biológicas e sua capacidade de induzir mutações danos celulares.","Compreender o uso de radiação em diagnósticos (radiografia, tomografia) e tratamentos (radioterapia), com foco nos benefícios e riscos."],"descritores":[]}]},{"codigo":"EM13CNT103BIOb/ES","materia_codigo":"biologia","descricao":"Utilizar o conhecimento sobre as radiações e suas A origens para avaliar as potencialidades e os riscos de sua aplicação em equipamentos de uso cotidiano, na saúde, no funcionamento das organelas celulares, no ambiente, na indústria, na agricultura.","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":22,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["Níveis microscópicos de organização estrutural dos seres vivos – Transporte de Substâncias pelas membranas celulares."],"expectativas":["Compreender os processos passivos e ativos transporte de substâncias por membranas celulares.","Compreender os processos de Endocitose e Exocitose. Entender os efeitos das radiações sobre as organelas celulares, especialmente o núcleo. suas","Conhecer os impactos na saúde humana relacionados de à exposição a materiais radioativos e tóxicos. na no"],"descritores":[]}]},{"codigo":"EM13CNT104","materia_codigo":"biologia","descricao":"Avaliar os benefícios e os riscos à saúde e ao ambiente, A considerando a composição, a toxicidade e a reatividade de diferentes materiais e produtos, como também o nível de exposição a eles, posicionando- se criticamente e propondo soluções individuais e/ou coletivas para seus usos e descartes responsáveis.","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":24,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["Níveis microscópicos de organização estrutural dos seres vivos – Mutações Celulares."],"expectativas":["Compreender como a toxicidade de certos produtos pode causar danos diretos ao DNA, causando mutações ou comprometimento de organelas essenciais.","Compreender como a permeabilidade e estabilidade da membrana celular são essenciais a sobrevivência da célula a partir do equilíbrio osmótico a e iônico."],"descritores":[]}]},{"codigo":"EM13CNT105","materia_codigo":"biologia","descricao":"Analisar os ciclos biogeoquímicos e interpretar os efeitos A de fenômenos naturais e da interferência humana sobre esses ciclos, para promover ações individuais e/ ou coletivas que minimizem consequências nocivas à vida.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":15,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Ecologia – Ciclos Biogeoquímicos"],"expectativas":["Conhecer e analisar os ciclos biogeoquímicos.","Interpretar os efeitos de características naturais sobre os ciclos biogeoquímicos.","Interpretar os efeitos da interferência humana sobre ciclos biogeoquímicos.","Promover ações individuais e/ou coletivas minimizem as consequências nocivas à vida a partir e/ possíveis alterações desses ciclos biogeoquímicos. à"],"descritores":[]}]},{"codigo":"EM13CNT106BIO/ES","materia_codigo":"biologia","descricao":"Avaliar, com ou sem o uso de dispositivos e aplicativos A digitais, tecnologias, possíveis soluções para as demandas que envolvem a geração, o transporte, a distribuição e o consumo de energia elétrica, considerando o tipo de matriz utilizada, a disponibilidade de recursos, a eficiência energética, a relação custo/ benefício, as características geográficas e ambientais, a produção de resíduos e os impactos socioambientais e culturais, levando em conta as particularidades no TI território capixaba.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":16,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Ecologia – Exploração dos recursos naturais"],"expectativas":["Conhecer a utilização de diferentes matrizes energéticas e a disponibilidade de recursos para relações custo/benefício","Examinar características geográficas e ambientais, incluindo produção de resíduos e impactos socioambientais econômicos e culturais associados as soluções energéticas.","Conhecer as matrizes energéticas do território capixaba e suas particularidades.","Utilizar dispositivos e aplicativos digitais, quando necessário, para apoiar a análise e avaliação do objeto de conhecimento. no"],"descritores":[]}]},{"codigo":"EM13CNT108BIO/ES","materia_codigo":"biologia","descricao":"Compreender e analisar os processos de divisão celular e A diferenciação para entender a organização dos tecidos nos organismos vivos e a origem dos órgãos e sistemas, que por sua vez atuam de maneira conjunta para um funcionamento equilibrado de todo o organismo.","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":23,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["Níveis microscópicos de organização estrutural dos seres vivos – Divisão Celular e Histologia"],"expectativas":["Compreender os processos celulares de divisão (Mitose e Meiose)","Compreender o processo de diferenciação especialização celular (Histologia)","Entender a organização dos tecidos nos organismos e vivos e a origem dos órgãos e sistemas (organogênese).","Compreender a variedade de vida em todos níveis de organização biológica, incluindo diversidade um genética, de espécies e de ecossistemas."],"descritores":[]}]},{"codigo":"EM13CNT109BIO/ES","materia_codigo":"biologia","descricao":"Aplicar os conceitos básico de ecologia a situações A cotidianas como a construção de terrários, hortas, ou mesmo as interações da espécie humana com as demais espécies de seu convívio diário, visando o desenvolvimento de interações mais saudáveis tanto em seu caráter alimentar como em outras formas de interação.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":12,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Ecologia - Conceitos básicos de Ecologia"],"expectativas":["Compreensão dos conceitos básicos de Ecologia situações cotidianas.","Identificação desses conceitos em situações cotidianas.","Identificação e compreensão dos conceitos básicos de Ecologia nas interações da espécie humana outras espécies. o de"],"descritores":[]}]},{"codigo":"EM13CNT110BIO/ES","materia_codigo":"biologia","descricao":"Analisar e interpretar as interações ecológicas e a sua A importância para a sobrevivência e o equilíbrio das populações e comunidades, sem esquecer que os seres humanos fazem parte do ambiente e se relacionam com outras espécies, para que assim possa propor formas mais harmônicas de interação da espécie humana com os demais seres vivos.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":13,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Ecologia – relações ecológicas"],"expectativas":["Conhecer e analisar as diversas interações ecológicas, intraespecíficas e interespecíficas, harmônicas desarmônicas.","Interpretar a importância das interações ecológicas para a sobrevivência e o equilíbrio das comunidades. sua","Identificação da espécie humana como parte das ambiente e sua relação com outras espécies e com ambiente.","Proposição de formas harmônicas de interação espécie humana com os demais seres vivos e com ambiente.","Análise das interferências antrópicas no ambiente sua interferência nas interações ecológicas."],"descritores":[]}]},{"codigo":"EM13CNT112BIO/ES","materia_codigo":"biologia","descricao":"Compreender e analisar como diferentes contextos A culturais influenciam e geram relações com o meio, para identificação de vantagens e desvantagens de ações que vão desde a agricultura de subsistência até a exploração do meio em larga escala, como a exemplo do plantio de eucalipto no ES, discutindo os componentes históricos sociais e políticos de problemas ambientais, tais como a destruição de ambientes naturais.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":18,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Ecologia – Sustentabilidade"],"expectativas":["Compreender como contextos culturais influenciam relações com o meio ambiente","Analisar as vantagens e desvantagens de práticas variam da agricultura de subsistência à exploração larga escala.","Identificar exemplos regionais e locais de atividades que interferem nos ecossistemas e promover a discussão de dos impactos por elas gerados.","Discutir os diversos componentes históricos, sociais a políticos relacionados a problemas ambientais. os"],"descritores":[]}]},{"codigo":"EM13CNT201","materia_codigo":"biologia","descricao":"Analisar e discutir modelos, teorias e leis propostos em A diferentes épocas e culturas para comparar distintas explicações sobre o surgimento e a evolução da Vida, da Terra e do Universo com as teorias científicas aceitas atualmente.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":42,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["TI Teorias evolutivas"],"expectativas":["Comparar diferentes teorias evolutivas propostas longo da história e em diversas culturas.","Analisar as contribuições das principais teorias evolutivas para o entendimento atual sobre a evolução. Interpretar teorias evolutivas à luz das evidências em científicas atuais.","Desenvolver uma visão crítica sobre a evolução pensamento evolutivo e sua influência cultural."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":42,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["TI Teorias evolutivas"],"expectativas":["Comparar diferentes teorias evolutivas propostas longo da história e em diversas culturas.","Analisar as contribuições das principais teorias evolutivas para o entendimento atual sobre a evolução. Interpretar teorias evolutivas à luz das evidências em científicas atuais.","Desenvolver uma visão crítica sobre a evolução pensamento evolutivo e sua influência cultural."],"descritores":[]},{"serie":3,"trimestre":1,"pagina_fonte":52,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["TI A relação dos povos com a evolução da genética e biotecnologia"],"expectativas":["Comparar diferentes teorias e modelos sobre hereditariedade e genética ao longo da história.","Analisar o impacto cultural e social da evolução conhecimentos em genética e biotecnologia.","Investigar o desenvolvimento histórico em biotecnologias em diferentes culturas.","Discutir os desafios éticos e culturais da aplicação biotecnologia na atualidade."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":52,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["TI A relação dos povos com a evolução da genética e biotecnologia"],"expectativas":["Comparar diferentes teorias e modelos sobre hereditariedade e genética ao longo da história.","Analisar o impacto cultural e social da evolução conhecimentos em genética e biotecnologia.","Investigar o desenvolvimento histórico em biotecnologias em diferentes culturas.","Discutir os desafios éticos e culturais da aplicação biotecnologia na atualidade."],"descritores":[]}]},{"codigo":"EM13CNT202BIO/ES","materia_codigo":"biologia","descricao":"Analisar as diversas formas de manifestação da vida A em seus diferentes níveis de organização (estrutural, fisiológica e/ou taxonômica), bem como as condições ambientais favoráveis e os fatores limitantes a elas, com ou sem o uso de dispositivos e aplicativos digitais (como softwares de simulação e de realidade virtual, entre outros).","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":33,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Genética - Leis de Mendel (Primeira Lei ou Monoibridismo e Segunda Lei ou Diibridismo)"],"expectativas":["Compreender o trabalho experimental de Gregor Mendel e seu significado para o estabelecimento Genética Clássica.","Explicar a Primeira Lei de Mendel (Lei da Segregação dos Fatores), aplicando os conceitos de alelos dominância/recessividade no monoibridismo.","Representar e interpretar cruzamentos genéticos utilizando o Quadro de Punnett para calcular proporções genotípicas e fenotípicas da geração em casos de monoibridismo.","Explicar a Segunda Lei de Mendel (Lei da Segregação Independente dos Caracteres), compreendendo a herança de duas ou mais características simultaneamente (diibridismo).","Representar e interpretar cruzamentos genéticos envolvendo diibridismo, utilizando o Quadro de Punnett ou a multiplicação de probabilidades para calcular as proporções genotípicas e fenotípicas da geração $F_2$.","Aplicar o cálculo de probabilidades a problemas de Genética, prevendo a chance de ocorrência genótipos e fenótipos específicos em cruzamentos simples e duplos."],"descritores":[]},{"serie":3,"trimestre":1,"pagina_fonte":40,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e evolução","objetos":["Sistemas de classificação e organização taxonômica dos seres vivos."],"expectativas":["Compreender os níveis de organização biológica suas aplicações na taxonomia.","Analisar os critérios utilizados nos sistemas classificação dos seres vivos.","Explorar os sistemas de classificação dos seres com o uso de ferramentas digitais.","Identificar condições ambientais e fatores limitantes que influenciam a organização taxonômica. Investigar a importância da taxonomia para conservação e estudo da biodiversidade"],"descritores":[]}]},{"codigo":"EM13CNT203","materia_codigo":"biologia","descricao":"Avaliar e prever efeitos de intervenções nos ecossistemas, A e seus impactos nos seres vivos e no corpo humano, com base nos mecanismos de manutenção da vida, nos ciclos da matéria e nas transformações e transferências de energia, utilizando representações e simulações sobre tais fatores, com ou sem o uso de dispositivos e aplicativos digitais (como softwares de simulação e de realidade virtual, entre outros).","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":14,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Ecologia – Cadeia Alimentar - Ciclos da matéria e fluxo de energia."],"expectativas":["Compreender como acontece o ciclo da matéria fluxo de energia nas cadeias alimentares.","Avaliar e prever efeitos de interações antrópicas ecossistemas e seus impactos nos seres vivos e no corpo humano","Compreender como os mecanismos de manutenção da vida, nos ciclos da matéria e nas transformações nos e transferências de energia são afetadas por impactos.","Retratar esses impactos por meio de representações e e simulações, com ou sem o uso de dispositivos de aplicativos digitais."],"descritores":[]}]},{"codigo":"EM13CNT205","materia_codigo":"biologia","descricao":"Interpretar resultados e realizar previsões sobre atividades A experimentais, fenômenos naturais, fisiológicos e processos tecnológicos, com base nas noções de probabilidade e incerteza, reconhecendo os limites explicativos das ciências.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":28,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Fisiologia Humana - Sistema Circulatório e Sistema Excretor"],"expectativas":["Conhecer e analisar a estrutura e a função componentes do Sistema Circulatório (coração, sanguíneos e sangue).","Explicar os mecanismos da circulação sanguínea (pequena e grande circulação), compreendendo transporte de gases, nutrientes e resíduos metabólicos e pelo corpo. de","Analisar a composição e as funções do sangue (plasma, hemácias, leucócitos e plaquetas), incluindo importância do sistema ABO e Fator Rh.","Identificar os órgãos do Sistema Excretor (rins, ureteres, bexiga e uretra) e descrever suas funções na homeostase do organismo.","Explicar o processo de formação da urina nos néfrons, detalhando as etapas de filtração, reabsorção secreção.","Avaliar a importância da circulação e da excreção na manutenção do equilíbrio interno (homeostase) corpo, incluindo a regulação do volume de água pressão arterial.","Relacionar o mau funcionamento dos Sistemas Circulatório e Excretor com doenças comuns hipertensão, aterosclerose, insuficiência renal), promovendo hábitos preventivos."],"descritores":[]}]},{"codigo":"EM13CNT205BIO/ES","materia_codigo":"biologia","descricao":"Conduzir e analisar atividades experimentais referentes A a fenômenos naturais e fisiológicos, a exemplo dos processos de respiração, digestão e excreção e reprodução, assim como o gasto de energia referentes a esses processos, com base nas noções de probabilidade e incerteza, reconhecendo os limites explicativos das ciências.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":26,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Fisiologia Humana - Sistema Reprodutor"],"expectativas":["Conhecer e analisar a anatomia, a histologia e a fisiologia dos sistemas reprodutores masculino e feminino.","Explicar os processos de gametogênese (espermatogênese e ovulogênese), relacionando-os com a Meiose variabilidade genética.","Interpretar o ciclo menstrual e o ciclo ovariano, identificando a ação dos principais hormônios (FSH, LH, estrogênio dos progesterona) e suas interações. e","Analisar o processo de fecundação, as fases iniciais a desenvolvimento embrionário e a formação dos anexos embrionários durante a gestação. das","Avaliar a importância do planejamento familiar compreender os mecanismos de ação dos diversos métodos contraceptivos disponíveis.","Identificar as principais Infecções Sexualmente Transmissíveis (ISTs), suas formas de prevenção, transmissão e tratamento, promovendo a saúde sexual responsável.","Discutir as implicações éticas e sociais das técnicas Reprodução Assistida.","Debater criticamente as implicações éticas, sociais e culturais decorrentes das diversas manifestações da biologia humana, promovendo o respeito e a valorização das diferenças complexidades inerentes à espécie.","Explicar os mecanismos da ventilação pulmonar (inspiração e expiração) e o processo de hematose (troca gasosa) alvéolos, relacionando-o com a circulação sanguínea.","Avaliar a relação entre nutrição, respiração e a produção de energia pelo organismo (metabolismo celular).","Identificar doenças e distúrbios comuns relacionados sistemas digestório e respiratório, analisando a importância de hábitos de vida saudáveis na prevenção."],"descritores":[]}]},{"codigo":"EM13CNT207","materia_codigo":"biologia","descricao":"Identificar, analisar e discutir vulnerabilidades vinculadas A às vivências e aos desafios contemporâneos aos quais as juventudes estão expostas, considerando os aspectos físico, psicoemocional e social, a fim de desenvolver e divulgar ações de prevenção e de promoção da saúde e do bem-estar.","ocorrencias":[{"serie":2,"trimestre":2,"pagina_fonte":30,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Fisiologia Humana - Sistema Endócrino"],"expectativas":["Conhecer e analisar a estrutura e a função principais glândulas endócrinas (hipófise, tireoide, paratireoides, adrenais, pâncreas e gônadas).","Explicar o conceito de hormônio, seu mecanismo de ação química e sua função como mensageiro coordenação orgânica.","Interpretar a regulação dos níveis hormonais organismo, destacando o papel do mecanismo e feedback (retroalimentação) e o eixo Hipotálamo- Hipófise.","Analisar a função de hormônios específicos regulação do metabolismo (ex: insulina e glucagon), crescimento (ex: GH) e na reprodução (ex: hormônios sexuais).","Comparar a atuação do Sistema Nervoso (coordenação rápida e elétrica) com a do Sistema Endócrino (coordenação lenta e química), compreendendo como ambos trabalham de forma integrada.","Identificar e relacionar desequilíbrios hormonais doenças comuns (ex: diabetes mellitus, hipertireoidismo), valorizando a importância de exames e tratamentos adequados."],"descritores":[]}]},{"codigo":"EM13CNT208","materia_codigo":"biologia","descricao":"Aplicar os princípios da evolução biológica para A analisar a história humana, considerando sua origem, diversificação, dispersão pelo planeta e diferentes formas de interação com a natureza, valorizando e respeitando a diversidade étnica e cultural humana.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":43,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["Teorias evolutivas TI"],"expectativas":["Compreender as principais teorias evolutivas e aplicação na história humana.","Analisar o processo de diversificação humana longo do tempo. Estudar a dispersão da espécie humana pelo planeta partir de uma perspectiva evolutiva.","Explorar as interações entre humanos e o ambiente contexto evolutivo. e","Valorizar a diversidade étnica e cultural humana partir de uma perspectiva evolutiva.","Investigar as teorias evolutivas em relação às variações genéticas na espécie humana.","Desenvolver uma visão crítica sobre o papel das teorias evolutivas na compreensão da história humana."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":43,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["Teorias evolutivas TI"],"expectativas":["Compreender as principais teorias evolutivas e aplicação na história humana.","Analisar o processo de diversificação humana longo do tempo. Estudar a dispersão da espécie humana pelo planeta partir de uma perspectiva evolutiva.","Explorar as interações entre humanos e o ambiente contexto evolutivo. e","Valorizar a diversidade étnica e cultural humana partir de uma perspectiva evolutiva.","Investigar as teorias evolutivas em relação às variações genéticas na espécie humana.","Desenvolver uma visão crítica sobre o papel das teorias evolutivas na compreensão da história humana."],"descritores":[]},{"serie":3,"trimestre":1,"pagina_fonte":53,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["A relação dos povos com a evolução da genética e biotecnologia."],"expectativas":["Analisar a contribuição da evolução biológica a compreensão da diversidade genética e cultural humana.","Investigar a influência da genética e biotecnologia história e evolução das populações humanas.","Discutir o papel da biotecnologia moderna valorização e preservação da diversidade genética humana. e","Refletir sobre as questões éticas e culturais relacionadas ao uso da genética e biotecnologia para entender história humana. e"],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":53,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["A relação dos povos com a evolução da genética e biotecnologia."],"expectativas":["Analisar a contribuição da evolução biológica a compreensão da diversidade genética e cultural humana.","Investigar a influência da genética e biotecnologia história e evolução das populações humanas.","Discutir o papel da biotecnologia moderna valorização e preservação da diversidade genética humana. e","Refletir sobre as questões éticas e culturais relacionadas ao uso da genética e biotecnologia para entender história humana. e"],"descritores":[]}]},{"codigo":"EM13CNT208BIO/ES","materia_codigo":"biologia","descricao":"Aplicar os princípios da evolução biológica para analisar A a história das espécies e a variação da complexidade estrutural dos organismos vivos, considerando sua origem, diversificação, dispersão pelo planeta e diferentes formas de interação com a natureza, valorizando e respeitando a diversidade.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":41,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e evolução","objetos":["Sistemas de classificação e organização Taxonômica dos Seres Vivos"],"expectativas":["Compreender a relação entre evolução e classificação dos seres vivos.","Identificar a variação na complexidade estrutural dos organismos (de unicelulares a multicelulares) compreender como essa diversidade é organizada na taxonomia, classificando os organismos em reinos, domínios e outros níveis hierárquicos. sua","Explorar a origem e dispersão das espécies a partir e uma perspectiva evolutiva e taxonômica.","Reconhecer a importância da classificação compreensão da evolução e diversificação espécies.","Valorizar e respeitar a diversidade biológica com em conhecimentos evolutivos."],"descritores":[]}]},{"codigo":"EM13CNT210BIO/ES","materia_codigo":"biologia","descricao":"Analisar a evolução dos órgãos sensoriais a forma de A percepção do homem em relação ao mundo e universo, do ambiente ao qual está inserido para compreender a sua forma de interação com outros de sua espécie com as demais espécies.","ocorrencias":[{"serie":2,"trimestre":2,"pagina_fonte":29,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Fisiologia Humana - Sistema Nervoso e Sensorial"],"expectativas":["Conhecer e analisar a organização geral do Sistema Nervoso (Central e Periférico) e a estrutura e função neurônio como unidade básica.","Explicar o mecanismo de transmissão do impulso nervoso e a comunicação sináptica, identificando de função dos principais neurotransmissores.","Descrever as principais funções das divisões do Sistema a Nervoso Central (encéfalo e medula espinhal) Sistema Nervoso Periférico (autônomo e somático).","Analisar o arco-reflexo como mecanismo de resposta rápida e involuntária a estímulos externos.","Compreender a estrutura e o funcionamento órgãos dos sentidos (visão, audição, tato, olfato paladar), explicando como a informação sensorial captada e processada pelo sistema nervoso.","Avaliar a importância do Sistema Nervoso e Sensorial na coordenação das demais funções orgânicas adaptação do organismo ao meio ambiente.","Identificar o impacto de substâncias psicoativas e de hábitos inadequados na saúde do Sistema Nervoso, promovendo a prevenção de doenças neurodegenerativas e distúrbios mentais."],"descritores":[]}]},{"codigo":"EM13CNT301","materia_codigo":"biologia","descricao":"Construir questões, elaborar hipóteses, previsões e A estimativas, empregar instrumentos de medição e representar e interpretar modelos explicativos, dados e/ou resultados experimentais para construir, avaliar e justificar conclusões no enfrentamento de situações- problema sob uma perspectiva científica.","ocorrencias":[{"serie":2,"trimestre":2,"pagina_fonte":31,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Sistema locomotor"],"expectativas":["Conhecer e analisar a estrutura e a função componentes do Sistema Esquelético (ossos, cartilagens, articulações e ligamentos).","Descrever a composição e as funções do tecido ósseo, incluindo sua participação na sustentação, proteção e reserva de cálcio. e","Conhecer e analisar a estrutura e a função componentes do Sistema Muscular (músculos e esqueléticos, lisos e cardíaco).","Explicar o mecanismo de contração muscular nível molecular (teoria dos filamentos deslizantes), relacionando-o com a geração de movimento.","Avaliar a importância da integração dos ossos, articulações e músculos na produção de movimento na postura do corpo.","Relacionar a atividade física com a saúde dos sistemas esquelético e muscular, identificando o papel exercícios na prevenção de lesões e na manutenção da massa óssea e muscular.","Identificar doenças e lesões comuns relacionadas ao sistema locomotor (ex: osteoporose, luxações, distensões), e analisar a importância da reabilitação ergonomia."],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":46,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Biotecnologia - Avanços e contribuições e impactos da biotecnologia."],"expectativas":["Construir questões problematizadoras sobre os avanços da biotecnologia e seus impactos sociais e ambientais.","Elaborar hipóteses sobre os benefícios e riscos aplicação de biotecnologias.","Fazer previsões e estimativas sobre o impacto e avanços biotecnológicos. e","Empregar instrumentos de medição e métodos coleta de dados em investigações sobre biotecnologia.","Representar e interpretar modelos explicativos processos biotecnológicos.","Construir conclusões e avaliar de forma crítica implicações éticas e sociais dos avanços biotecnológicos.","Comunicar resultados de análises e experimentos biotecnologia para diferentes públicos. da"],"descritores":[]}]},{"codigo":"EM13CNT302","materia_codigo":"biologia","descricao":"Comunicar, para públicos variados, em diversos A contextos, resultados de análises, pesquisas e/ou experimentos, elaborando e/ou interpretando textos, gráficos, tabelas, símbolos, códigos, sistemas de classificação e equações, por meio de diferentes linguagens, mídias, tecnologias digitais de informação e comunicação (TDIC), de modo a participar e/ou promover debates em torno de temas científicos e/ou tecnológicos de relevância sociocultural e ambiental.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":44,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["A relação dos povos com a evolução da genética e biotecnologia."],"expectativas":["Compreender o impacto da genética e biotecnologia na sociedade e na cultura.","Interpretar e comunicar informações científicas sobre genética e biotecnologia.","Promover debates sobre a relação entre genética, biotecnologia e diversidade cultural.","Utilizar diferentes linguagens para comunicar resultados de análises e pesquisas sobre genética e biotecnologia. de","Refletir criticamente sobre os desafios éticos e sociais das tecnologias genéticas.","Utilizar tecnologias digitais para produzir e compartilhar conteúdo sobre genética e biotecnologia. e"],"descritores":[]}]},{"codigo":"EM13CNT302BIO/ES","materia_codigo":"biologia","descricao":"Interpretar e comunicar, para públicos variados, em A diversos contextos, resultados de análises, pesquisas e/ou experimentos, elaborando e/ou interpretando textos, na área de biotecnologia em diferentes linguagens, mídias, tecnologias digitais de informação e comunicação (TDIC), de modo a participar e/ou promover debates em torno de temas científicos e/ou tecnológicos de relevância sociocultural e ambiental.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":38,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Biotecnologia - Bioética"],"expectativas":["Definir o conceito de Bioética e identificar princípios fundamentais (autonomia, beneficência, maleficência e justiça).","Analisar as questões morais, legais e sociais suscitadas pelo avanço das tecnologias de manipulação genética, em como a edição de genoma (CRISPR-Cas9).","Debater as implicações éticas da utilização de células- tronco em pesquisa e terapia, diferenciando os tipos suas fontes.","Avaliar a legislação de Biossegurança vigente no compreendendo as normas para a pesquisa e uso Organismos Geneticamente Modificados (OGMs) laboratórios e no campo.","Discutir as controvérsias éticas e o impacto social da clonagem (reprodutiva e terapêutica) e Aconselhamento Genético.","Posicionar-se criticamente sobre os dilemas éticos relacionados à Biotecnologia, considerando benefícios potenciais e os riscos para a saúde humana e para o meio ambiente."],"descritores":[]},{"serie":3,"trimestre":1,"pagina_fonte":45,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["A relação dos povos com a evolução da genética e biotecnologia."],"expectativas":["Interpretar informações sobre a evolução da genética e da biotecnologia e seu impacto sociocultural.","Desenvolver a capacidade de comunicar resultados de pesquisas e análises sobre genética e biotecnologia para diferentes públicos. em","Promover e participar de debates sobre os impactos éticos, sociais e ambientais das tecnologias genéticas biotecnológicas.","Utilizar mídias e tecnologias digitais para criar materiais informativos sobre genética e biotecnologia.","Fomentar a conscientização sobre a importância genética e biotecnologia para a sociedade.","Desenvolver uma visão crítica e ética sobre aplicações da biotecnologia e genética. e"],"descritores":[]}]},{"codigo":"EM13CNT303","materia_codigo":"biologia","descricao":"Interpretar textos de divulgação científica que tratem A de temáticas das Ciências da Natureza, disponíveis em diferentes mídias, considerando a apresentação dos dados, tanto na forma de textos como em equações, gráficos e/ou tabelas, a consistência dos argumentos e a coerência das conclusões, visando construir estratégias de seleção de fontes confiáveis de informações.","ocorrencias":[{"serie":3,"trimestre":3,"pagina_fonte":54,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["A relação dos povos com a evolução da genética e biotecnologia."],"expectativas":["Interpretar textos de divulgação científica sobre genética e biotecnologia, analisando a coerência argumentos e a apresentação dos dados.","Avaliar a confiabilidade de fontes de informação científica sobre biotecnologia e genética.","Analisar diferentes perspectivas culturais e científicas em sobre o uso da biotecnologia. dos","Desenvolver uma visão crítica sobre a divulgação temas de genética e biotecnologia em mídias variadas. e a"],"descritores":[]}]},{"codigo":"EM13CNT304","materia_codigo":"biologia","descricao":"Analisar e debater situações controversas sobre a A aplicação de conhecimentos da área de Ciências da Natureza (tais como tecnologias do DNA, tratamentos com células-tronco, neurotecnologias, produção de tecnologias de defesa, estratégias de controle de pragas, entre outros), com base em argumentos consistentes, legais, éticos e responsáveis, distinguindo diferentes pontos de vista.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":34,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Genética Humana"],"expectativas":["Analisar e interpretar um Cariótipo humano, identificando o sexo e possíveis alterações cromossômicas numéricas ou estruturais (ex: Síndrome de Down, Síndrome de Turner).","Diferenciar doenças genéticas monogênicas a (causadas por um único gene, ex: Anemia Falciforme, da Fibrose Cística) de doenças cromossômicas.","Aplicar os conceitos de herança mendeliana e mendeliana na resolução de problemas relacionados às doenças genéticas e à herança de características humanas.","Explicar os mecanismos de herança e as regras transfusão para os sistemas sanguíneos ABO e Fator reconhecendo a importância desses conhecimentos na prática médica.","Interpretar heredogramas (ou árvores genealógicas) para rastrear e prever padrões de herança características e doenças em famílias.","Discutir o conceito de Aconselhamento Genético, compreendendo sua função no diagnóstico, prognóstico e auxílio às famílias em relação aos de doenças hereditárias."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":49,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Biotecnologia moderna"],"expectativas":["Compreender a aplicação da 2ª Lei de Mendel e variações em biotecnologias modernas.","Analisar os aspectos éticos, legais e ambientais biotecnologias baseadas na genética mendeliana.","Distinguir diferentes pontos de vista sobre o uso a conhecimentos genéticos em aplicações práticas. da","Formular argumentos críticos e informações sobre aplicação de tecnologias genéticas, respeitando diversidade de opiniões."],"descritores":[]}]},{"codigo":"EM13CNT305","materia_codigo":"biologia","descricao":"Investigar e discutir o uso indevido de conhecimentos A das Ciências da Natureza na justificativa de processos de discriminação, segregação e privação de direitos individuais e coletivos, em diferentes contextos sociais e históricos, para promover a equidade e o respeito à diversidade.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":35,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Genética Pós-Mendeliana"],"expectativas":["Diferenciar os padrões de herança Pós-Mendeliana em relação aos mendelianos (dominância completa).","Explicar e resolver problemas envolvendo Dominância Incompleta e Codominância, reconhecendo os fenótipos possíveis.","Analisar o sistema de Alelos Múltiplos, aplicando-o para resolver problemas de herança do Sistema ABO Fator Rh em humanos.","Compreender o conceito de Herança Quantitativa à ou Poligênica, reconhecendo a influência de múltiplos genes na determinação de fenótipos com variação contínua (ex: altura, cor da pele).","Determinação do sexo e Heranças ligadas, restritas e influenciadas pelo sexo Explicar o mecanismo determinação do sexo em humanos e as implicações genéticas.","Diferenciar a herança ligada ao sexo (genes cromossomo X, ex: daltonismo e hemofilia), restrita sexo e influenciada pelo sexo.","Resolver e interpretar problemas genéticos envolvem a herança ligada ao cromossomo considerando a frequência diferente entre os sexos.","Mutações (Tipos de mutações e suas consequências) Definir mutação e classificar os diferentes tipos mutações genéticas (pontuais) e cromossômicas (numéricas e estruturais).","Analisar as consequências das mutações no como fonte de variabilidade genética e como causa de doenças (ex: Síndrome de Down, anemia falciforme)."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":55,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["A relação dos povos com a evolução da genética e TI biotecnologia"],"expectativas":["Analisar o uso indevido de conceitos genéticos biotecnológicos na justificativa de discriminação segregação.","Investigar casos históricos de eugenia e outras práticas discriminatórias baseadas em genética.","Discutir as implicações éticas e sociais do uso biotecnologia no contexto da diversidade humana.","Promover o respeito à diversidade e a equidade analisar a evolução dos conhecimentos genéticos. à e"],"descritores":[]}]},{"codigo":"EM13CNT306","materia_codigo":"biologia","descricao":"Avaliar os riscos envolvidos em atividades cotidianas, A aplicando conhecimentos das Ciências da Natureza, para justificar o uso de equipamentos e recursos, bem como comportamentos de segurança, visando à integridade física, individual e coletiva, e socioambiental, podendo fazer uso de dispositivos e aplicativos digitais que viabilizem a estruturação de simulações de tais riscos.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":36,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Biotecnologia - Aplicações"],"expectativas":["Reconhecer as diversas áreas de aplicação Biotecnologia, além da manipulação genética direta, classificando-as por cores (Biotecnologia Vermelha, Verde, Branca, Azul).","Explicar as contribuições da Biotecnologia Vermelha (Saúde) na produção de fármacos, vacinas, anticorpos e no desenvolvimento de métodos de diagnóstico molecular. à","Analisar o uso da Biotecnologia Verde (Agropecuária) para o melhoramento de culturas, desenvolvimento biofertilizantes e controle biológico de pragas. tais","Descrever as aplicações da Biotecnologia Branca (Industrial) na produção de biocombustíveis, enzimas industriais e no desenvolvimento de processos menos poluentes (química verde).","Compreender o papel da Biotecnologia Ambiental (ou Azul) no tratamento de efluentes, biorremediação de áreas contaminadas e no controle da poluição.","Avaliar o impacto socioeconômico e ambiental diferentes aplicações biotecnológicas, promovendo a discussão sobre o uso responsável e ético dessas tecnologias."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":50,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Biotecnologia moderna"],"expectativas":["Avaliar os riscos associados ao uso de biotecnologias modernas em atividades cotidianas.","Justificar o uso de equipamentos e práticas segurança em laboratórios de biotecnologia.","Utilizar tecnologias digitais para simular e prever impactos de atividades biotecnológicas no ambiente na sociedade.","Desenvolver comportamentos de segurança à e responsabilidade socioambiental no uso biotecnologia. tais"],"descritores":[]}]},{"codigo":"EM13CNT310","materia_codigo":"biologia","descricao":"Investigar e analisar os efeitos de programas de A infraestrutura e demais serviços básicos (saneamento, energia elétrica, transporte, telecomunicações, cobertura vacinal, atendimento primário à saúde e produção de alimentos, entre outros) e identificar necessidades locais e/ou regionais em relação a esses serviços, a fim de avaliar e/ou promover ações que contribuam para a melhoria na qualidade de vida e nas condições de saúde da população.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":37,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Biotecnologia - Engenharia Genética"],"expectativas":["Conceituar a Biotecnologia e a Engenharia Genética, diferenciando a manipulação genética moderna técnicas de melhoramento clássicas.","Descrever as etapas e as ferramentas da tecnologia do DNA Recombinante (enzimas de restrição, vetores de como plasmídeos e ligases).","Explicar o processo de obtenção de Organismos Geneticamente Modificados (OGMs) ou Transgênicos e e as aplicações dessa tecnologia na agricultura (resistência, produtividade) e na saúde (produção insulina). que","Compreender o princípio e a utilidade da Reação e em Cadeia da Polimerase (PCR), reconhecendo aplicação em diagnósticos e na ciência forense.","Analisar os conceitos de Clonagem (reprodutiva e terapêutica) e de Terapia Gênica, avaliando potencial e limitações na medicina.","Discutir as implicações éticas, ambientais e sociais uso da Biotecnologia, como a biossegurança, a questão da patente de genes e o debate sobre alimentos transgênicos.","Reconhecer o impacto da Genômica e Sequenciamento de DNA na medicina personalizada no diagnóstico precoce de doenças."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":51,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Biotecnologia moderna."],"expectativas":["Investigar o papel da biotecnologia moderna melhoria de serviços de saneamento e saúde pública.","Analisar a aplicação da biotecnologia na produção de alimentos e sua relação com a segurança alimentar.","Identificar necessidades locais e propor soluções de biotecnológicas para serviços básicos.","Avaliar o impacto socioambiental de biotecnologias aplicadas aos serviços básicos. e que e"],"descritores":[]}]},{"codigo":"EM13CNT311BIO/ES","materia_codigo":"biologia","descricao":"Analisar e discutir a participação dos cromossomos, genes A e alelos nos processos de transmissão de informações genéticas, para compreensão do modo como esses processos influenciam na manutenção das espécies e nas diferenças intraespecíficas e interespecíficas.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":32,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["Genética - Conceitos Fundamentais e Genética Molecular"],"expectativas":["Conhecer e definir os conceitos básicos da Genética, diferenciando Gene, Cromossomo, Alelo, Lócus, Genótipo e Fenótipo. Diferenciar células haploides diploides, e organismos homozigotos e heterozigotos. Aplicar a terminologia genética corretamente na leitura e interpretação de problemas e esquemas de herança. Genética Molecular (Estrutura e Função do DNA RNA, Código Genético, Síntese Proteica: Transcrição e Tradução) Descrever a estrutura da molécula de (dupla hélice, nucleotídeos, pareamento de bases) sua função como material hereditário. Diferenciar tipos de RNA (mensageiro, transportador e ribossômico) e suas funções no processo de síntese proteica. Explicar os processos de Transcrição (síntese de RNA a partir DNA) e Tradução (síntese de proteínas a partir do RNAm). Interpretar o Código Genético, compreendendo relação entre códons, aminoácidos e a universalidade desse código. Relacionar o conceito de Gene (como sequência de DNA) com a produção de proteína específica, que determina uma característica (Fenótipo)."],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":47,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e evolução","objetos":["Genética"],"expectativas":["Compreender o papel dos cromossomos, genes alelos na hereditariedade.","Analisar o processo de transmissão genética e implicações para a manutenção das espécies.","Explorar a relação entre mutação genética diversidade biológica. Interpretar diagramas e modelos que representem transmissão genética e as variações. e","Discutir os processos de seleção natural e seleção artificial com base na variação genética.","Desenvolver uma visão crítica sobre o impacto genética nas diferenças biológicas.","Conhecer e aplicar as Leis de Mendel para analisar padrões de herança genética.","Interpretar cruzamentos genéticos utilizando as Leis Mendel.","Explorar as exceções às Leis de Mendel e sua relação com a diversidade genética."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":47,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e evolução","objetos":["Genética"],"expectativas":["Compreender o papel dos cromossomos, genes alelos na hereditariedade.","Analisar o processo de transmissão genética e implicações para a manutenção das espécies.","Explorar a relação entre mutação genética diversidade biológica. Interpretar diagramas e modelos que representem transmissão genética e as variações. e","Discutir os processos de seleção natural e seleção artificial com base na variação genética.","Desenvolver uma visão crítica sobre o impacto genética nas diferenças biológicas.","Conhecer e aplicar as Leis de Mendel para analisar padrões de herança genética.","Interpretar cruzamentos genéticos utilizando as Leis Mendel.","Explorar as exceções às Leis de Mendel e sua relação com a diversidade genética."],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":48,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["Genética - A 2ª Lei de Mendel e suas variações."],"expectativas":["Compreender a 2ª Lei de Mendel (Lei da Segregação Independente) e sua contribuição para a variabilidade genética.","Investigar a variabilidade intraespecífica gerada 2ª Lei de Mendel.","Comparar variações e exceções à 2ª Lei de Mendel. Interpretar cruzamentos genéticos que demonstram 2ª Lei de Mendel. e","Relacionar a 2ª Lei de Mendel às diferenças interespecíficas.","Construir e interpretar modelos que representem segregação independente dos alelos.","Discutir o impacto da segregação independente evolução e adaptação das espécies."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":48,"arquivo_fonte":"biologia-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["Genética - A 2ª Lei de Mendel e suas variações."],"expectativas":["Compreender a 2ª Lei de Mendel (Lei da Segregação Independente) e sua contribuição para a variabilidade genética.","Investigar a variabilidade intraespecífica gerada 2ª Lei de Mendel.","Comparar variações e exceções à 2ª Lei de Mendel. Interpretar cruzamentos genéticos que demonstram 2ª Lei de Mendel. e","Relacionar a 2ª Lei de Mendel às diferenças interespecíficas.","Construir e interpretar modelos que representem segregação independente dos alelos.","Discutir o impacto da segregação independente evolução e adaptação das espécies."],"descritores":[]}]},{"codigo":"EM13CNT101","materia_codigo":"fisica","descricao":"Analisar e representar, com ou sem o uso de dispositivos e de aplicativos digitais específicos, as transformações e conservações em sistemas que envolvam quantidade de matéria, de energia e de movimento para realizar previsões sobre seus comportamentos em situações cotidianas e em processos produtivos que priorizem o desenvolvimento sustentável, o uso consciente dos recursos naturais e a preservação da vida em todas as suas formas.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":22,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Princípios da Conservação da Energia e da Quantidade de Movimento: TI •Energia mecânica","Energia cinética","Energia potencial gravitacional","Energia Potencia elástica"],"expectativas":["Quantificar a energia mecânica, a energia cinética, a energia potencial gravitacional e Elástica.","Quantificar a quantidade de movimento de um corpo qualquer.","Entender os princípios de conservação da energia e da quantidade de movimento, incluindo como a energia total de um sistema e de fechado é conservada e como a quantidade de movimento preservada em colisões e interações. e","Explicar como esses princípios se aplicam a sistemas cotidianos produtivos, como em colisões de veículos, processos de produção o industrial, e sistemas naturais.","Desenvolver a habilidade de representar graficamente matematicamente as transformações de energia mecânica, a conversão entre energia cinética e potencial, e as transferências de quantidade de movimento em sistemas físicos.","Usar diagramas, gráficos e equações para modelar e prever comportamento de sistemas físicos, incluindo a análise de de energia e movimento.","Aplicar os conceitos de conservação da energia e da quantidade de movimento para analisar e prever o comportamento de sistemas em situações cotidianas, como o movimento de veículos, quedas de objetos, e interações em esportes.","Discutir como a compreensão desses princípios pode ser para melhorar a segurança e a eficiência em contextos transporte e engenharia civil.","Aplicar os princípios de conservação para prever o comportamento de sistemas em processos produtivos, como em máquinas industriais, linhas de montagem, e sistemas de energia, discutindo como conservação da energia pode ser utilizada para otimizar a eficiência desses processos."],"descritores":[]}]},{"codigo":"EM13CNT101FIS/ES","materia_codigo":"fisica","descricao":"Analisar e representar, com ou sem uso de dispositivos e de aplicativos digitais específicos, as transformações e conservações em sistemas que envolvam quantidade de matéria, de energia e de movimento para realizar previsões sobre sua eficiência em situações cotidianas e em processos produtivos que priorizem o desenvolvimento sustentável, o uso consciente dos recursos naturais e a preservação da vida em todas as suas formas.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":26,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Eficiência de diferentes tipos de Motores:","Noções choques mecânicos TI","Trabalho Mecânico","Potência","Potência mecânica","Potência útil e potência total","Eficiência ou rendimento"],"expectativas":["Entender os conceitos fundamentais de potência, energia eficiência, e como eles se aplicam ao funcionamento de diferentes tipos de motores, como motores a combustão interna, motores elétricos e turbinas.","Calcular a potência de um motor a partir de variáveis trabalho e tempo, e compreender como a energia é convertida utilizada dentro desses sistemas.","Analisar as transformações de energia que ocorrem em diferentes tipos de motores, identificando as fontes de energia combustível, eletricidade ou energia cinética) e como essa energia é convertida em trabalho útil.","Discutir as etapas do ciclo de funcionamento de um motor e a energia é conservada ou perdida em cada etapa, considerando fatores como atrito, calor e resistência elétrica.","Avaliar a eficiência energética de diferentes motores, comparando a quantidade de energia fornecida ao sistema com a quantidade de energia útil produzida, e discutindo as razões para as perdas energia.","Calcular a eficiência de um motor usando a relação entre energia útil e energia total, e discutir como melhorar essa eficiência contextos práticos, como veículos, máquinas industriais e sistemas de geração de energia.","Aplicar os conceitos de eficiência energética para o desempenho de motores em situações cotidianas, como aceleração de um carro, o funcionamento de aparelhos domésticos ou a operação de sistemas de climatização."],"descritores":[]}]},{"codigo":"EM13CNT102","materia_codigo":"fisica","descricao":"Realizar previsões, avaliar intervenções e/ou construir protótipos de sistemas térmicos que visem à sustentabilidade, considerando sua composição e os efeitos das variáveis termodinâmicas sobre seu funcionamento, considerando também o uso de tecnologias digitais que auxiliem no cálculo de estimativas e no apoio à construção dos protótipos.","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":32,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Leis da Termodinâmica:","Estudo dos gases","Trabalho termodinâmico TI","Energia interna de um sistema gasoso","Máquinas térmicas","1ª Lei da Termodinâmica","2ª Lei da Termodinâmica","Conceito de Entropia."],"expectativas":["Desenvolver e aplicar simulações que representem os de diferentes poluentes em sistemas gasosos, avaliando como energia interna e o trabalho termodinâmico influenciam a dispersão e a concentração desses poluentes.","Avaliar a eficiência de máquinas térmicas em relação à conversão de de energia e aos impactos ambientais resultantes, empregando sua 1ª e 2ª Leis da Termodinâmica para prever os efeitos de diferentes seu configurações e tecnologias.","Projetar e construir protótipos de sistemas térmicos que minimizem dos os impactos ambientais, utilizando conceitos como trabalho termodinâmico e entropia para otimizar a eficiência energética reduzir a poluição.","Realizar estudos de caso que explorem como a aplicação leis da termodinâmica em processos industriais e naturais os ecossistemas, incluindo a análise dos poluentes gerados consequências para o meio ambiente.","Realizar previsões sobre como a eficiência e o funcionamento máquinas térmicas influenciam a geração e dispersão de poluentes, utilizando o conceito de entropia para modelar a irreversibilidade desses processos e seus impactos ambientais.","Avaliar diferentes tecnologias de controle de poluição em sistemas termodinâmico."],"descritores":[]},{"serie":2,"trimestre":2,"pagina_fonte":47,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Leis da Termodinâmica:","Estudo dos gases","Trabalho termodinâmico TI","Energia interna de um sistema gasoso","Máquinas térmicas","1ª Lei da Termodinâmica","2ª Lei da Termodinâmica","Conceito de Entropia."],"expectativas":["Desenvolver e aplicar simulações que representem os de diferentes poluentes em sistemas gasosos, avaliando como energia interna e o trabalho termodinâmico influenciam a dispersão e a concentração desses poluentes.","Avaliar a eficiência de máquinas térmicas em relação à conversão de de energia e aos impactos ambientais resultantes, empregando sua 1ª e 2ª Leis da Termodinâmica para prever os efeitos de diferentes seu configurações e tecnologias.","Projetar e construir protótipos de sistemas térmicos que minimizem dos os impactos ambientais, utilizando conceitos como trabalho termodinâmico e entropia para otimizar a eficiência energética reduzir a poluição.","Realizar estudos de caso que explorem como a aplicação leis da termodinâmica em processos industriais e naturais os ecossistemas, incluindo a análise dos poluentes gerados consequências para o meio ambiente.","Realizar previsões sobre como a eficiência e o funcionamento máquinas térmicas influenciam a geração e dispersão de poluentes, utilizando o conceito de entropia para modelar a irreversibilidade desses processos e seus impactos ambientais.","Avaliar diferentes tecnologias de controle de poluição em sistemas termodinâmico."],"descritores":[]}]},{"codigo":"EM13CNT102FIS/ES","materia_codigo":"fisica","descricao":"Realizar previsões, avaliar intervenções e/ou construir protótipos de sistemas térmicos que visem à sustentabilidade, considerando sua composição e os efeitos das variáveis termodinâmicas sobre seu funcionamento e reconhecer grandeza significativas, etapas e propriedades térmicas dos materiais relevantes para analisar e compreender os processos de trocas de calor presentes nos sistemas naturais e tecnológicos considerando ou não o uso de tecnologias digitais que auxiliem no cálculo de estimativas e no apoio à construção dos protótipos.","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":29,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["TI Leis da Termodinâmica:","Temperatura x Calor","Escalas termométricas","Dilatação Térmica","Processos de transmissão de calor","Quantidade de Calor Sensível","Quantidade de Calor Latente","Mudança de Fase"],"expectativas":["Diferenciar temperatura de Calor.","Fazer conversões entre diversas escalas de temperatura.","Calcular a dilatação térmica de materiais diversos.","Realizar previsões sobre o comportamento térmico de materiais, considerando a relação entre temperatura e calor, assim como efeitos de variáveis termodinâmicas como pressão e volume.","Construir protótipos de sistemas térmicos sustentáveis, levando em conta a dilatação térmica dos materiais e os processos e transmissão de calor, como condução, convecção e radiação.","Calcular a quantidade de calor cedida ou recebida por um de qualquer.","Avaliar intervenções em sistemas térmicos, considerando de quantidade de calor envolvida e a eficiência dos processos troca de calor, com o objetivo de melhorar o desempenho sustentabilidade dos sistemas.","Aplicar as Leis da Termodinâmica para analisar o funcionamento de sistemas térmicos, reconhecendo grandezas significativas, entropia e energia interna, e como essas leis governam os processos de transformação de energia térmica em trabalho e vice-versa.","Utilizar tecnologias digitais para simular, calcular estimativas e a construção de protótipos de sistemas térmicos, permitindo análise mais precisa dos processos de transmissão e transformação de calor.","Reconhecer as propriedades térmicas dos materiais, capacidade calorífica e condutividade térmica, e avaliar adequação em diferentes aplicações tecnológicas e naturais."],"descritores":[]},{"serie":2,"trimestre":2,"pagina_fonte":44,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["TI Leis da Termodinâmica:","Temperatura x Calor","Escalas termométricas","Dilatação Térmica","Processos de transmissão de calor","Quantidade de Calor Sensível","Quantidade de Calor Latente","Mudança de Fase"],"expectativas":["Diferenciar temperatura de Calor.","Fazer conversões entre diversas escalas de temperatura.","Calcular a dilatação térmica de materiais diversos.","Realizar previsões sobre o comportamento térmico de materiais, considerando a relação entre temperatura e calor, assim como efeitos de variáveis termodinâmicas como pressão e volume.","Construir protótipos de sistemas térmicos sustentáveis, levando em conta a dilatação térmica dos materiais e os processos e transmissão de calor, como condução, convecção e radiação.","Calcular a quantidade de calor cedida ou recebida por um de qualquer.","Avaliar intervenções em sistemas térmicos, considerando de quantidade de calor envolvida e a eficiência dos processos troca de calor, com o objetivo de melhorar o desempenho sustentabilidade dos sistemas.","Aplicar as Leis da Termodinâmica para analisar o funcionamento de sistemas térmicos, reconhecendo grandezas significativas, entropia e energia interna, e como essas leis governam os processos de transformação de energia térmica em trabalho e vice-versa.","Utilizar tecnologias digitais para simular, calcular estimativas e a construção de protótipos de sistemas térmicos, permitindo análise mais precisa dos processos de transmissão e transformação de calor.","Reconhecer as propriedades térmicas dos materiais, capacidade calorífica e condutividade térmica, e avaliar adequação em diferentes aplicações tecnológicas e naturais."],"descritores":[]}]},{"codigo":"EM13CNT103","materia_codigo":"fisica","descricao":"Utilizar o conhecimento sobre radiações e suas origens para avaliar as potencialidades e os riscos de sua aplicação em equipamentos de uso cotidiano, na saúde, no ambiente, na indústria, na agricultura e na geração de energia elétrica.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":49,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Espectro Eletromagnético:","Introdução a Ondulatória: Frequência, Período e Velocidade de uma onda qualquer.","Elementos de uma onda","Classificação das ondas: Mecânica e Eletromagnética. TI","Espectro Eletromagnético.","Elementos de uma onda.","Fenômenos Ondulatórios: Reflexão, Refração, Interferência, difração, Ressonância."],"expectativas":["Reconhecer as características fundamentais das radiações eletromagnéticas, como frequência, período e velocidade, avaliar seus usos em dispositivos de uso cotidiano e suas potenciais implicações na saúde e no ambiente.","Classificar diferentes tipos de radiações eletromagnéticas presentes no espectro eletromagnético e analisar suas aplicações na indústria e na agricultura, considerando os potenciais riscos e benefícios.","Interpretar os fenômenos ondulatórios, como reflexão e refração, ao analisar o funcionamento de equipamentos médicos que utilizam radiações, como máquinas de raios X e aparelhos de ultrassom.","Avaliar a eficiência e segurança de tecnologias que empregam radiações eletromagnéticas na geração de energia elétrica, a energia solar, considerando a classificação das ondas interações com o ambiente. de •Discutir as aplicações das radiações eletromagnéticas equipamentos de comunicação, como celulares e identificando possíveis impactos sociais e ambientais tecnologias.","Investigar como a interferência e difração de eletromagnéticas influenciam a performance de dispositivos eletrônicos, utilizando o conhecimento de fenômenos ondulatórios para propor melhorias.","Analisar os riscos e benefícios do uso de radiações ionizantes, como os raios gama, em tratamentos médicos, relacionando radiações às suas propriedades ondulatórias e classificações espectro eletromagnético."],"descritores":[]}]},{"codigo":"EM13CNT103FIS/ES","materia_codigo":"fisica","descricao":"Analisar diversas possibilidades de geração de energia elétrica para o uso social, avaliando as potencialidades e os riscos de sua aplicação no uso cotidiano, na saúde, no ambiente, na indústria e na agricultura.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":19,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Matriz Energética:","Transformações de energia","Matriz energética","Usinas geradoras de energia elétrica","Riscos associados a cada tipo de geração de energia, incluindo TI os impactos ambientais, sociais e econômicos, como a emissão de poluentes, o uso de recursos hídricos, ou o risco de acidentes nucleares.","Desenvolvimento Sustentável","Política Energética Nacional"],"expectativas":["Explicar os conceitos de energia cinética e potencial, e esses tipos de energia mecânica podem ser convertidos em energia elétrica através de diferentes processos físicos.","Entender a relação entre trabalho e energia, incluindo como aplicação de uma força sobre um objeto pode resultar em mudança na energia mecânica desse objeto. sua","Analisar diferentes métodos de geração de energia elétrica, e como hidrelétricas, eólicas, termelétricas, e usinas nucleares, compreendendo como a energia mecânica é convertida energia elétrica em cada um desses processos.","Avaliar as potencialidades de diferentes fontes de energia mecânica, como a energia potencial gravitacional nas hidrelétricas ou a energia cinética do vento nas turbinas eólicas, discutindo aplicabilidade em contextos como saúde, agricultura e indústria.","Identificar e discutir os riscos associados a cada tipo de geração de energia, incluindo os impactos ambientais, sociais e econômicos, como a emissão de poluentes, o uso de recursos hídricos, ou de acidentes nucleares.","Entender o princípio da conservação da energia mecânica como ele se aplica nos sistemas de geração de energia, onde energia total de um sistema isolado é constante, embora possa transformada de uma forma para outra.","Aplicar os conceitos de trabalho e energia para analisar funcionamento de dispositivos e sistemas que convertem energia mecânica em energia elétrica, como geradores e motores.","Discutir o papel das políticas energéticas na promoção do sustentável de diferentes fontes de energia, considerando conservação da energia e a redução de impactos ambientais."],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":57,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Desenvolvimento e aprimoramento de tecnologias de obtenção de Energia Elétrica:","Quantidade de Carga elétrica.","Noções sobre a física de partículas: Matéria, Átomo, Próton, Nêutron e Quarks (Up e Down). TI •Noções de Campo elétrico e Potencial Elétrico.","Formação de tempestades.","Introdução a eletrodinâmica.","Intensidade de corrente elétrica","Lei de Ohm.","Potência e Energia elétrica","Circuitos elétricos Resistivos: Série, paralelo e misto."],"expectativas":["Quantizar a quantidade de carga elétrica.","Compreender a lei de Ohm.","Compreender os conceitos de potência e energia elétrica.","Calcular a energia consumida pelos aparelhos elétricos.","Identificar os circuitos resistivos Série, Paralelo e Misto.","Utilizar equipamentos para medir a ddp, a resistência elétrica sua materiais e a intensidade de corrente elétrica. e","Analisar como os conceitos de matéria, átomo, próton, nêutron e quarks (Up e Down) influenciam as tecnologias modernas geração de energia elétrica, como a fusão nuclear e outras formas avançadas de produção de energia.","Discutir os desafios e potencialidades das tecnologias baseadas em partículas subatômicas, considerando a sustentabilidade de riscos associados.","Prever como variações na intensidade de corrente podem impactar a eficiência e segurança das tecnologias de geração energia elétrica.","Aplicar a Lei de Ohm para analisar e prever o desempenho diferentes tecnologias de geração de energia elétrica, avaliando resistência e a eficiência dos sistemas.","Desenvolver soluções para melhorar a eficiência dos sistemas de geração de energia com base na aplicação da Lei de considerando os impactos econômicos e ambientais.","Comparar e avaliar a aplicação de circuitos elétricos resistivos (série, paralelo e misto), identificando suas vantagens e limitações.","Projetar e testar circuitos elétricos resistivos aplicados à geração de energia elétrica, considerando a relação custo/benefício sustentabilidade."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":57,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Desenvolvimento e aprimoramento de tecnologias de obtenção de Energia Elétrica:","Quantidade de Carga elétrica.","Noções sobre a física de partículas: Matéria, Átomo, Próton, Nêutron e Quarks (Up e Down). TI •Noções de Campo elétrico e Potencial Elétrico.","Formação de tempestades.","Introdução a eletrodinâmica.","Intensidade de corrente elétrica","Lei de Ohm.","Potência e Energia elétrica","Circuitos elétricos Resistivos: Série, paralelo e misto."],"expectativas":["Quantizar a quantidade de carga elétrica.","Compreender a lei de Ohm.","Compreender os conceitos de potência e energia elétrica.","Calcular a energia consumida pelos aparelhos elétricos.","Identificar os circuitos resistivos Série, Paralelo e Misto.","Utilizar equipamentos para medir a ddp, a resistência elétrica sua materiais e a intensidade de corrente elétrica. e","Analisar como os conceitos de matéria, átomo, próton, nêutron e quarks (Up e Down) influenciam as tecnologias modernas geração de energia elétrica, como a fusão nuclear e outras formas avançadas de produção de energia.","Discutir os desafios e potencialidades das tecnologias baseadas em partículas subatômicas, considerando a sustentabilidade de riscos associados.","Prever como variações na intensidade de corrente podem impactar a eficiência e segurança das tecnologias de geração energia elétrica.","Aplicar a Lei de Ohm para analisar e prever o desempenho diferentes tecnologias de geração de energia elétrica, avaliando resistência e a eficiência dos sistemas.","Desenvolver soluções para melhorar a eficiência dos sistemas de geração de energia com base na aplicação da Lei de considerando os impactos econômicos e ambientais.","Comparar e avaliar a aplicação de circuitos elétricos resistivos (série, paralelo e misto), identificando suas vantagens e limitações.","Projetar e testar circuitos elétricos resistivos aplicados à geração de energia elétrica, considerando a relação custo/benefício sustentabilidade."],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":60,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Desenvolvimento e aprimoramento de tecnologias de obtenção de Energia Elétrica :","Introdução ao magnetismo.","Noções de Força Magnética.","Classificação de materiais magnéticos.","Estado de magnetização: ferromagnetismo, antiferromagnetismo, TI diamagnéticos e paramagnéticos.”","Conceito de campo magnético.","Magnetosfera.","Bússola: O que é? Para que serve? Como é utilizada?","Força sobre carga móvel em campo magnético.","Movimento de uma carga em campo magnético constante.","Força magnética sobre um condutor reto em campo magnético uniforme.","Experimento de Oersted.","Campo magnético: Imã, condutor retilíneo, espira circular, bobina, solenoide.","Noções de indução eletromagnética: Lei de Lenz. 1ª"],"expectativas":["Analisar e comparar diferentes tecnologias de geração de energia elétrica, como geradores e turbinas, com base em princípios magnéticos, como a indução eletromagnética.","Avaliar os riscos e as potencialidades das tecnologias de geração de energia elétrica em relação à saúde e ao meio ambiente, considerando a interação com campos magnéticos e a exposição sua a forças magnéticas. e","Investigar o impacto das tecnologias de geração de energia elétrica na indústria e na agricultura, incluindo a eficiência tecnologias e os efeitos de forças magnéticas em equipamentos processos industriais.","Classificar e analisar a aplicação de materiais magnéticos de tecnologias de geração de energia, considerando suas propriedades magnéticas e estado de magnetização.","Aplicar conceitos de magnetismo, como força magnética e campo magnético, para entender e otimizar os processos de geração energia elétrica em diferentes contextos.","Realizar simulações e experimentos para observar os efeitos forças magnéticas e indução eletromagnética em sistemas geração de energia elétrica, e avaliar os resultados para propor melhorias e inovações tecnológicas."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":60,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Desenvolvimento e aprimoramento de tecnologias de obtenção de Energia Elétrica :","Introdução ao magnetismo.","Noções de Força Magnética.","Classificação de materiais magnéticos.","Estado de magnetização: ferromagnetismo, antiferromagnetismo, TI diamagnéticos e paramagnéticos.”","Conceito de campo magnético.","Magnetosfera.","Bússola: O que é? Para que serve? Como é utilizada?","Força sobre carga móvel em campo magnético.","Movimento de uma carga em campo magnético constante.","Força magnética sobre um condutor reto em campo magnético uniforme.","Experimento de Oersted.","Campo magnético: Imã, condutor retilíneo, espira circular, bobina, solenoide.","Noções de indução eletromagnética: Lei de Lenz. 1ª"],"expectativas":["Analisar e comparar diferentes tecnologias de geração de energia elétrica, como geradores e turbinas, com base em princípios magnéticos, como a indução eletromagnética.","Avaliar os riscos e as potencialidades das tecnologias de geração de energia elétrica em relação à saúde e ao meio ambiente, considerando a interação com campos magnéticos e a exposição sua a forças magnéticas. e","Investigar o impacto das tecnologias de geração de energia elétrica na indústria e na agricultura, incluindo a eficiência tecnologias e os efeitos de forças magnéticas em equipamentos processos industriais.","Classificar e analisar a aplicação de materiais magnéticos de tecnologias de geração de energia, considerando suas propriedades magnéticas e estado de magnetização.","Aplicar conceitos de magnetismo, como força magnética e campo magnético, para entender e otimizar os processos de geração energia elétrica em diferentes contextos.","Realizar simulações e experimentos para observar os efeitos forças magnéticas e indução eletromagnética em sistemas geração de energia elétrica, e avaliar os resultados para propor melhorias e inovações tecnológicas."],"descritores":[]}]},{"codigo":"EM13CNT104FIS/ES","materia_codigo":"fisica","descricao":"Avaliar os benefícios e os riscos à saúde e ao ambiente, considerando a composição, a toxidade e a reatividade de diferentes materiais e produtos, como também o nível de exposição a eles, selecionar procedimentos, testes de controle ou parâmetros de qualidade de produtos, conforme determinados argumentos ou explicações, tendo em vista a defesa do consumidor.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":53,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Isolantes e Condutores Térmicos, Elétricos e Acústicos:","Introdução a acústica: Velocidade, frequência e comprimento das ondas sonoras. TI •Características Fisiológicas do som: Altura, Intensidade e Timbre.","Fenômenos sonoros: Absorção, reflexão, refração, difração, interferência.","Efeito Doppler."],"expectativas":["Reconhecer as características fisiológicas do som.","Identificar os fenômenos acústicos no cotidiano.","Identificar e avaliar as propriedades acústicas de diferentes materiais isolantes e condutores, como absorção, reflexão transmissão do som, relacionando essas propriedades aplicação em ambientes que exigem controle de ruído.","Discutir os benefícios e riscos ambientais do uso de materiais acústicos em construções e produtos, considerando fatores durabilidade, biodegradabilidade e impacto no ciclo de vida materiais.","Avaliar os efeitos da exposição prolongada a diferentes de ruído em ambientes com isolantes e condutores acústicos, identificando possíveis riscos à saúde, como perda auditiva estresse, e propondo medidas de mitigação.","Comparar a eficácia de diferentes materiais acústicos na proteção contra ruídos excessivos, considerando como a composição densidade dos materiais influenciam sua capacidade de isolamento e os efeitos na saúde humana.","Avaliar a toxicidade e a reatividade dos materiais acústicos utilizados em produtos de consumo, propondo alternativas seguras que atendam aos padrões de segurança e qualidade, com foco defesa do consumidor.","Aplicar os conhecimentos sobre isolantes e condutores acústicos para resolver problemas práticos, como o controle de ruído diferentes ambientes, propondo soluções baseadas em critérios técnicos e considerando os impactos na saúde e no ambiente."],"descritores":[]}]},{"codigo":"EM13CNT106","materia_codigo":"fisica","descricao":"Avaliar, com ou sem uso de dispositivos e aplicativos digitais, tecnologias e possíveis soluções para as demandas que envolvem a geração, o transporte, a distribuição e o consumo de energia elétrica, considerando a disponibilidade de recursos, a eficiência energética, a relação custo/benefício, as características geográficas e ambientais, a produção de resíduos e os impactos socioambientais e culturais.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":54,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Isolantes e Condutores Térmicos, Elétricos e Acústicos:","Classificação elétrica dos materiais: condutores e isolantes. TI","Geração, transporte e distribuição de energia elétrica.","Introdução a eletrostática","Processos de eletrização: Atrito contato e Indução.","Lei de Coulomb."],"expectativas":["Compreender os processos de eletrização.","Quantizar a força entre cargas elétricas. Identificar e classificar diferentes materiais quanto à condutividade elétrica, compreendendo como essas propriedades influenciam na eficiência e na segurança das redes de geração, transporte e distribuição de energia elétrica.","Comparar as propriedades elétricas de materiais condutores isolantes, discutindo sua aplicação em diferentes componentes sistemas elétricos, como cabos, transformadores e dispositivos proteção.","Avaliar a eficácia de diferentes tecnologias de geração de energia elétrica (eólica, solar, hidrelétrica, entre outras), considerando condutividade dos materiais utilizados em equipamentos geradores e transformadores, e sua influência na eficiência energética.","Analisar as vantagens e desvantagens de tecnologias de transporte e distribuição de energia, como as redes de alta e baixa tensão, considerando a eficiência dos materiais condutores utilizados possíveis impactos ambientais e socioeconômicos.","Propor soluções para melhorar a eficiência energética em sistemas de geração, transporte e consumo de energia elétrica, levando conta a escolha de materiais condutores e isolantes que minimizem as perdas de energia e maximizem a eficiência do sistema.","Avaliar o impacto da resistência elétrica dos materiais utilizados em diferentes tecnologias de geração e distribuição de energia,"],"descritores":[]}]},{"codigo":"EM13CNT106FIS/ES","materia_codigo":"fisica","descricao":"Comparar e avaliar, com ou sem uso de dispositivos e aplicativos digitais, tecnologias e possíveis soluções para as demandas que envolvem sistemas naturais e tecnológicos em termos de potência útil, dissipação de calor e rendimento, considerando a disponibilidade de recursos, a relação custo/benefício, as características geográficas e ambientais, a produção de resíduos e os impactos socioambientais e culturais.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":27,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Eficiência de diferentes tipos de Motores:","Potência TI","Transformação da energia mecânica em energia térmica","Potência mecânica","Potência útil e potência total","Eficiência ou rendimento"],"expectativas":["Compreender os conceitos de potência útil, dissipação de e rendimento, e como esses fatores influenciam o desempenho sistemas naturais e tecnológicos.","Ler e compreender a classificação (A, B, C, D, E), de eficiência energética dos equipamentos eletroeletrônicos, estipulada Inmetro. que","Calcular a potência e a eficiência de sistemas tecnológicos útil, naturais, aplicando fórmulas e princípios da Física. de","Comparar diferentes tecnologias e soluções para atender e demandas específicas (como geração de energia, transporte climatização), avaliando-as em termos de eficiência energética potência útil.","Identificar como a dissipação de calor afeta a eficiência dos sistemas e discutir estratégias para minimizar essas perdas energéticas.","Avaliar como a disponibilidade de recursos naturais e energéticos influencia a escolha de tecnologias e soluções, considerando fatores como custo de produção, manutenção e operação.","Analisar custo/benefício de diferentes tecnologias, ponderando eficiência energética, o impacto ambiental e o custo econômico.","Analisar como as características geográficas e ambientais clima, relevo e recursos naturais) impactam a eficiência viabilidade de diferentes tecnologias em contextos específicos."],"descritores":[]}]},{"codigo":"EM13CNT107","materia_codigo":"fisica","descricao":"Realizar previsões qualitativas e quantitativas sobre o funcionamento de geradores, motores elétricos e seus componentes, bobinas, transformadores, pilhas, baterias e dispositivos eletrônicos, com base na análise dos processos de transformação e condução de energia envolvidos, com ou sem o uso de dispositivos e aplicativos digitais, para propor ações que visem a sustentabilidade.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":20,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Matriz Energética:","Transformações de energia","Matriz energética TI","Usinas geradoras de energia elétrica","Riscos associados a cada tipo de geração de energia, incluindo os impactos ambientais, sociais e econômicos, como a emissão de poluentes, o uso de recursos hídricos, ou o risco de acidentes nucleares.","Desenvolvimento Sustentável","Política Energética Nacional"],"expectativas":["Explicar como a energia mecânica é transformada em energia elétrica nos geradores e como a energia elétrica é convertida energia mecânica nos motores elétricos, compreendendo o de componentes como bobinas, transformadores, pilhas e baterias nesse processo.","Entender os conceitos de indução eletromagnética, diferença potencial, e corrente elétrica, e como esses princípios se aplicam funcionamento de dispositivos elétricos. base","Os alunos devem aprender a prever qualitativamente comportamento de geradores, motores e outros dispositivos base na análise dos processos de transformação de energia, o efeito de variações na velocidade de rotação de um gerador sobre a tensão gerada.","Compreender como o princípio da conservação da energia aplica ao funcionamento de geradores e motores, reconhecendo que a energia total do sistema é conservada, mesmo que transformações entre diferentes formas de energia.","Utilizar dispositivos e aplicativos digitais, como softwares simulação, para modelar o funcionamento de geradores, motores e outros dispositivos elétricos, testando diferentes parâmetros condições.","Propor ações para aumentar a sustentabilidade na energética, como o uso de fontes renováveis de energia alimentar geradores e a implementação de tecnologias eficientes para reduzir as perdas de energia em motores transformadores.","Propor ideias que contribuam para a transição para uma energética mais sustentável e equitativa."],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":58,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Desenvolvimento e aprimoramento de tecnologias de obtenção de Energia Elétrica:","Geradores e receptores elétricos. TI","Noções sobre transformador: O que é um transformador? Para que serve um transformador? Onde é utilizado o transformador?","Intensidade de corrente elétrica: Contínua e Alternada."],"expectativas":["Identificar e descrever os principais componentes de geradores e motores elétricos, compreendendo suas funções e como contribuem para a transformação e condução de energia elétrica.","Realizar previsões qualitativas sobre o desempenho de geradores e motores elétricos, com base na análise dos processos transformação de energia mecânica em energia elétrica e versa.","Comparar as características e aplicações de correntes elétricas base contínuas e alternadas, analisando como elas impactam funcionamento de diferentes dispositivos elétricos, como geradores e motores.","Realizar cálculos quantitativos sobre a intensidade de corrente elétrica em circuitos que utilizam geradores, motores, pilhas, baterias e transformadores, aplicando as leis de Ohm e Kirchhoff.","Explicar o funcionamento de transformadores, incluindo capacidade de alterar a tensão elétrica para diferentes aplicações em sistemas de transmissão e distribuição de energia. de","Analisar o papel dos transformadores na eficiência energética e sua importância para a sustentabilidade, considerando necessidades de transmissão de energia a longas distâncias que perdas associadas.","Explorar o contexto histórico e as implicações da “Guerra Correntes” entre Thomas Edison e Nikola Tesla, compreendendo diferenças entre corrente contínua e alternada e suas aplicações na sociedade moderna."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":58,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Desenvolvimento e aprimoramento de tecnologias de obtenção de Energia Elétrica:","Geradores e receptores elétricos. TI","Noções sobre transformador: O que é um transformador? Para que serve um transformador? Onde é utilizado o transformador?","Intensidade de corrente elétrica: Contínua e Alternada."],"expectativas":["Identificar e descrever os principais componentes de geradores e motores elétricos, compreendendo suas funções e como contribuem para a transformação e condução de energia elétrica.","Realizar previsões qualitativas sobre o desempenho de geradores e motores elétricos, com base na análise dos processos transformação de energia mecânica em energia elétrica e versa.","Comparar as características e aplicações de correntes elétricas base contínuas e alternadas, analisando como elas impactam funcionamento de diferentes dispositivos elétricos, como geradores e motores.","Realizar cálculos quantitativos sobre a intensidade de corrente elétrica em circuitos que utilizam geradores, motores, pilhas, baterias e transformadores, aplicando as leis de Ohm e Kirchhoff.","Explicar o funcionamento de transformadores, incluindo capacidade de alterar a tensão elétrica para diferentes aplicações em sistemas de transmissão e distribuição de energia. de","Analisar o papel dos transformadores na eficiência energética e sua importância para a sustentabilidade, considerando necessidades de transmissão de energia a longas distâncias que perdas associadas.","Explorar o contexto histórico e as implicações da “Guerra Correntes” entre Thomas Edison e Nikola Tesla, compreendendo diferenças entre corrente contínua e alternada e suas aplicações na sociedade moderna."],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":61,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Desenvolvimento e aprimoramento de tecnologias de obtenção de Energia Elétrica :","Introdução ao magnetismo.","Noções de Força Magnética.","Classificação de materiais magnéticos. TI","Estado de magnetização: ferromagnetismo, antiferromagnetismo, diamagnéticos e paramagnéticos.”","Conceito de campo magnético.","Magnetosfera.","Bússola: O que é? Para que serve? Como é utilizada?","Força sobre carga móvel em campo magnético.","Movimento de uma carga em campo magnético constante.","Força magnética sobre um condutor reto em campo magnético uniforme.","Experimento de Oersted.","Campo magnético: Imã, condutor retilíneo, espira circular, bobina, solenoide.","Noções de indução eletromagnética: Lei de Lenz. 1ª"],"expectativas":["Realizar previsões qualitativas e quantitativas sobre o desempenho e a eficiência de geradores e motores elétricos, considerando princípios do magnetismo e da indução eletromagnética.","Compreender o funcionamento de componentes elétricos como bobinas, transformadores, pilhas e baterias, considerando transformação e condução de energia elétrica.","Utilizar dispositivos e aplicativos digitais para simular e prever base comportamento de sistemas de geração e transformação energia elétrica, analisando os resultados para propor melhorias sustentáveis.","Propor ações que visem a sustentabilidade no desenvolvimento aprimoramento de tecnologias de obtenção de energia elétrica, com base na análise dos processos de transformação e condução de de energia.","Classificar materiais magnéticos de acordo com suas propriedades e estados de magnetização e analisar como esses materiais utilizados em tecnologias de geração e transformação de energia elétrica.","Conduzir experimentos e simulações para observar e prever efeitos de forças magnéticas e indução eletromagnética dispositivos elétricos e sistemas de geração de energia."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":61,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Desenvolvimento e aprimoramento de tecnologias de obtenção de Energia Elétrica :","Introdução ao magnetismo.","Noções de Força Magnética.","Classificação de materiais magnéticos. TI","Estado de magnetização: ferromagnetismo, antiferromagnetismo, diamagnéticos e paramagnéticos.”","Conceito de campo magnético.","Magnetosfera.","Bússola: O que é? Para que serve? Como é utilizada?","Força sobre carga móvel em campo magnético.","Movimento de uma carga em campo magnético constante.","Força magnética sobre um condutor reto em campo magnético uniforme.","Experimento de Oersted.","Campo magnético: Imã, condutor retilíneo, espira circular, bobina, solenoide.","Noções de indução eletromagnética: Lei de Lenz. 1ª"],"expectativas":["Realizar previsões qualitativas e quantitativas sobre o desempenho e a eficiência de geradores e motores elétricos, considerando princípios do magnetismo e da indução eletromagnética.","Compreender o funcionamento de componentes elétricos como bobinas, transformadores, pilhas e baterias, considerando transformação e condução de energia elétrica.","Utilizar dispositivos e aplicativos digitais para simular e prever base comportamento de sistemas de geração e transformação energia elétrica, analisando os resultados para propor melhorias sustentáveis.","Propor ações que visem a sustentabilidade no desenvolvimento aprimoramento de tecnologias de obtenção de energia elétrica, com base na análise dos processos de transformação e condução de de energia.","Classificar materiais magnéticos de acordo com suas propriedades e estados de magnetização e analisar como esses materiais utilizados em tecnologias de geração e transformação de energia elétrica.","Conduzir experimentos e simulações para observar e prever efeitos de forças magnéticas e indução eletromagnética dispositivos elétricos e sistemas de geração de energia."],"descritores":[]}]},{"codigo":"EM13CNT107FIS/ES","materia_codigo":"fisica","descricao":"Realizar previsões qualitativas e quantitativas sobre a eficiência de motores (elétricos ou não) e seus componentes com base na análise dos processos de transformação e condução de energia envolvidos, com ou sem o uso de dispositivos e aplicativos digitais, para propor ações que visem a sustentabilidade.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":28,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Eficiência de diferentes tipos de Motores:","Potência","Transformação da energia mecânica em energia térmica TI •Potência mecânica","Potência útil e potência total","Eficiência ou rendimento"],"expectativas":["Calcular a potência de motores, utilizando a relação entre trabalho realizado e tempo, e entender como a energia é transformada transferida dentro dos sistemas de motores.","Analisar os processos de transformação de energia que ocorrem em motores, identificando as formas de energia envolvidas de energia térmica, elétrica e mecânica) e discutindo como transformações afetam a eficiência do motor.","Investigar os principais fatores que influenciam a condução energia nos motores, como resistência elétrica, atrito mecânico dissipação de calor, e como esses fatores impactam a eficiência total do sistema.","Realizar previsões quantitativas sobre a eficiência de motores, calculando a relação entre a energia útil produzida e a energia total fornecida ao sistema, e identificando possíveis fontes de perdas energéticas.","Utilizar dispositivos e aplicativos digitais, como simuladores softwares de modelagem, para realizar análises detalhadas eficiência de motores, testando diferentes cenários e parâmetros para otimizar o desempenho.","Interpretar os dados obtidos através de simulações e experimentos, utilizando esses resultados para propor melhorias na eficiência motores e redução de perdas energéticas."],"descritores":[]}]},{"codigo":"EM13CNT201/ES","materia_codigo":"fisica","descricao":"Identificar, analisar e discutir transformações de ideias, modelos, teorias e leis propostos em diferentes épocas e culturas para comparar distintas explicações sobre o surgimento e a evolução da Vida, da Terra e do Universo.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":12,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["História e Filosofia da Ciência:","Teorias e leis sobre o surgimento e a evolução da Vida, da Terra e do Universo.","Figuras-chave na História da Ciência e suas contribuições para o desenvolvimento desses modelos e teorias. TI •Modelos, teorias e leis sobre a evolução da Vida, da Terra e do Universo.","Tradições científicas e culturais.","Tradições científicas e culturais Indígenas e Afro-Brasileiras.","Mudanças na ciência impactaram a filosofia, a ética e a sociedade.","Evolução do pensamento científico.","Importância da História e Filosofia da Ciência na formação de uma visão crítica e informada sobre o mundo natural e o Universo."],"expectativas":["Identificar e descrever os principais modelos, teorias e leis o surgimento e a evolução da Vida, da Terra e do Universo desenvolvidos em diferentes períodos históricos.","Reconhecer figuras-chave na História da Ciência e contribuições para o desenvolvimento desses modelos e teorias.","Compreender como o pensamento filosófico influenciou para desenvolvimento da ciência e a formação de modelos sobre da evolução do Universo.","Analisar como e por que as ideias, modelos, teorias e leis sobre evolução da Vida, da Terra e do Universo mudaram ao longo tempo.","Identificar as evidências e os métodos científicos que levaram mudanças e transformações dessas ideias.","Comparar e contrastar explicações científicas sobre o surgimento e e a evolução da Vida, da Terra e do Universo de diferentes épocas e culturas. o","Discutir as semelhanças e diferenças nas abordagens e explicações fornecidas por diversas tradições científicas e culturais. e do","Discutir as implicações filosóficas das transformações de modelos e teorias na compreensão científica do Universo.","Desenvolver a capacidade de avaliar criticamente a validade relevância de diferentes modelos e teorias ao longo da história ciência.","Refletir sobre como as mudanças na ciência impactaram a filosofia, uma a ética e a sociedade.","Argumentar de forma fundamentada sobre a evolução pensamento científico e as razões pelas quais certos modelos aceitos ou rejeitados.","Valorizar a importância da História e Filosofia da Ciência formação de uma visão crítica e informada sobre o mundo natural e o Universo."],"descritores":[]}]},{"codigo":"EM13CNT201FIS/ES","materia_codigo":"fisica","descricao":"Analisar e discutir modelos, teorias e leis propostos em diferentes épocas e culturas para comparar distintas explicações sobre o surgimento da Terra e do Universo, bem como a sua evolução, dando ênfase à Física Moderna e Contemporânea.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Gravitação:","Modelos de sistemas planetários propostos ao longo da história.","Modelo de terra plana, Tales de Mileto;","Modelo geocêntrico de Ptolomeu. TI","Modelo heliocêntrico de Copérnico."],"expectativas":["Compreender os principais modelos de sistemas planetários propostos ao longo da história, como o modelo geocêntrico Ptolomeu e o modelo heliocêntrico de Copérnico, identificando bases observacionais e filosóficas de cada um.","Reconhecer a transição dos modelos antigos para os modelos modernos, como a proposta de Kepler sobre órbitas elípticas o da gravitação universal de Newton.","Comparar as diferentes teorias da gravitação, desde a concepção de Aristóteles até a teoria da relatividade geral de Einstein, discutindo como cada teoria explica o movimento dos corpos celestes estrutura do Universo.","Analisar como essas teorias foram aceitas, modificadas rejeitadas ao longo do tempo, considerando o impacto de descobertas e observações astronômicas.","Explorar os avanços da Física Moderna e Contemporânea entendimento da gravitação, como a teoria da relatividade a expansão do Universo e a teoria do Big Bang.","Analisar como diferentes culturas e épocas influenciaram construção de modelos cosmológicos, reconhecendo a diversidade de explicações para o surgimento e a evolução da Terra Universo.","Discutir como os avanços atuais na astrofísica e na cosmologia continuam a expandir nosso entendimento do Universo e a desafiar os modelos estabelecidos."],"descritores":[]},{"serie":2,"trimestre":1,"pagina_fonte":39,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Astronomia, Modelos Cosmológicos e Evolução Estelar:","Noções de energia e matéria escura.","Modelos cosmológicos.","Noções de evolução estelar.","Noções gerais sobre as Teorias e Modelos para a Origem e Evolução TI do Universo"],"expectativas":["Discutir como diferentes culturas contribuíram para desenvolvimento da Astronomia e da Física, como a astronomia Africana e a cosmologia indígena, e sua relevância para conhecimento atual.","Investigar a evolução das teorias sobre o surgimento do Universo, desde as antigas explicações mitológicas até as teorias científicas o modernas, como a teoria da inflação cósmica, discutindo influência de avanços tecnológicos na formulação dessas teorias.","Discutir a teoria da relatividade geral de Einstein e seu impacto na compreensão da gravidade e na evolução do universo, relacionando-a com observações astronômicas, como a expansão do universo.","Analisar diferentes modelos de evolução estelar, como o de vida das estrelas e a formação de buracos negros, discutindo como essas teorias foram desenvolvidas a partir de observações experimentos em Física.","Discutir as contribuições de modelos estelares para a compreensão da formação de elementos químicos no universo, conectando conceitos com a Física Nuclear e de Partículas.","Explorar teorias modernas e contemporâneas, como a das cordas e a teoria quântica da gravidade, discutindo elas tentam unificar diferentes forças fundamentais da natureza explicar fenômenos cosmológicos.","Compreender conceitos de energia e matéria escura.","Identificar as fases de evolução estelar."],"descritores":[]}]},{"codigo":"EM13CNT203","materia_codigo":"fisica","descricao":"Avaliar e prever efeitos de intervenções nos ecossistemas, e seus impactos nos seres vivos e no corpo humano, com base nos mecanismos de manutenção da vida, nos ciclos da matéria e nas transformações e transferências de energia, utilizando representações e simulações sobre tais fatores, com o sem o uso de dispositivos e aplicativos digitais (como softwares de simulações e de realidade virtual, entre outros).","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":23,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Princípios da Conservação da Energia e da Quantidade de Movimento: TI","Impactos ambientais na geração de energia.","A Física e meio ambiente","A Física e sustentabilidade"],"expectativas":["Entender como os princípios de conservação da energia quantidade de movimento se aplicam aos ciclos naturais da matéria e aos fluxos de energia nos ecossistemas, reconhecendo como leis fundamentais da Física sustentam os processos de vida.","Utilizar simulações digitais e outras ferramentas tecnológicas, e softwares de simulação ecológica e realidade virtual, para modelar nos cenários de intervenções ambientais e prever seus impactos sobre conservação da energia nos ecossistemas.","Refletir sobre a importância de manter o equilíbrio energético de conservação dos recursos naturais para garantir a sustentabilidade e de dos ecossistemas, propondo estratégias para mitigar os impactos negativos das intervenções humanas.","Discutir o papel da conservação da energia e da quantidade movimento na sustentabilidade, considerando como esses princípios podem ser aplicados para promover práticas mais responsáveis sustentáveis em relação ao ambiente. de •Integrar conceitos de Física, como energia mecânica, trabalho, conservação da energia, com princípios ecológicos para entender como os processos físicos influenciam a estrutura e a dinâmica ecossistemas.","Aplicar essas ideias para resolver problemas ambientais reais, a gestão de recursos naturais, a conservação da biodiversidade, mitigação das mudanças climáticas.","Desenvolver a capacidade de pensar criticamente sobre intervenções humanas no ambiente, avaliando seus efeitos a e longo prazo sobre os ecossistemas e a saúde humana, e propondo soluções baseadas nos princípios de conservação de energia movimento."],"descritores":[]}]},{"codigo":"EM13CNT203FIS/ES","materia_codigo":"fisica","descricao":"Avaliar e prever efeitos das diversas possibilidades de geração de energia térmica para o uso social, identificando e comparando as diferentes opções em termos de seus impactos ambiental, social e econômico utilizando representações e simulações sobre tais fatores, com ou sem o uso de dispositivos e aplicativos digitais (como softwares de simulação e de realidade virtual, entre outros).","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":30,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Leis da Termodinâmica:","Temperatura x Calor","Escalas termométricas TI •Dilatação Térmica","Processos de transmissão de calor","Quantidade de Calor Sensível","Quantidade de Calor Latente","Mudança de Fase"],"expectativas":["Diferenciar temperatura de calor.","Realizar conversões de temperatura entre as principais escalas termométricas.","Analisar como a dilatação térmica dos materiais afeta desempenho de sistemas de geração de energia térmica, de considerando os impactos ambientais e econômicos associados. as","Avaliar e prever os efeitos dos diferentes processos de transmissão de calor (condução, convecção e radiação) em sistemas tais geração de energia, utilizando simulações digitais para visualizar impactos sociais, ambientais e econômicos.","Realizar cálculos e interpretar os efeitos da quantidade calor sensível e latente em sistemas térmicos, relacionando quantidades às mudanças de fase e ao desempenho energético.","Propor intervenções sustentáveis baseadas em simulações considerem as variáveis termodinâmicas e as propriedades térmicas dos materiais, avaliando o impacto socioambiental e econômico das diferentes opções de geração de energia térmica.","Reconhecer os estados físicos da matéria.","Compreender as mudanças de fases sofridas pela matéria."],"descritores":[]},{"serie":2,"trimestre":2,"pagina_fonte":45,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Leis da Termodinâmica:","Temperatura x Calor","Escalas termométricas TI •Dilatação Térmica","Processos de transmissão de calor","Quantidade de Calor Sensível","Quantidade de Calor Latente","Mudança de Fase"],"expectativas":["Diferenciar temperatura de calor.","Realizar conversões de temperatura entre as principais escalas termométricas.","Analisar como a dilatação térmica dos materiais afeta desempenho de sistemas de geração de energia térmica, de considerando os impactos ambientais e econômicos associados. as","Avaliar e prever os efeitos dos diferentes processos de transmissão de calor (condução, convecção e radiação) em sistemas tais geração de energia, utilizando simulações digitais para visualizar impactos sociais, ambientais e econômicos.","Realizar cálculos e interpretar os efeitos da quantidade calor sensível e latente em sistemas térmicos, relacionando quantidades às mudanças de fase e ao desempenho energético.","Propor intervenções sustentáveis baseadas em simulações considerem as variáveis termodinâmicas e as propriedades térmicas dos materiais, avaliando o impacto socioambiental e econômico das diferentes opções de geração de energia térmica.","Reconhecer os estados físicos da matéria.","Compreender as mudanças de fases sofridas pela matéria."],"descritores":[]}]},{"codigo":"EM13CNT204","materia_codigo":"fisica","descricao":"Elaborar explicações, previsões e cálculos a respeito dos movimentos de objetos na Terra, no Sistema Solar e no Universo com base na análise das interações gravitacionais, com ou sem o uso de dispositivos e aplicativos digitais (como softwares de simulação e de realidade virtual, entre outros).","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Gravitação:","Leis de Kepler: Lei das órbitas, Lei das áreas, Lei dos Períodos.","Força Gravitacional TI","Noções dos satélites geoestacionários de comunicação global.","Satélites em órbitas Circulares","Frequência e Período Orbital","Velocidade de escape","Velocidade Orbital"],"expectativas":["Compreender Leis de Kepler: Lei das órbitas, Lei das áreas, Lei Períodos.","Compreender como as interações gravitacionais afetam movimentos dos objetos na Terra, no Sistema Solar e no Universo, aplicando as leis de Newton para descrever essas interações.","Explicar como a força gravitacional atua entre corpos celestes base e influencia suas órbitas, incluindo a Terra e os satélites em de geoestacionária. e de","Calcular a Força gravitacional entre dois astros.","Realizar previsões quantitativas e qualitativas sobre o movimento de satélites geoestacionários, utilizando conhecimentos gravitação, velocidade orbital e altitude necessária para manter uma órbita estável.","Calcular a velocidade orbital necessária para que um satélite permaneça em órbita geoestacionária e prever os efeitos variações em massa, altitude ou velocidade.","Analisar as aplicações tecnológicas dos satélites geoestacionários, discutindo sua importância em telecomunicações, meteorologia observação da Terra.","Investigar como a gravitação influencia o posicionamento operação dos satélites, e como essas tecnologias impactam sociedade moderna.","Utilizar dispositivos e aplicativos digitais, como softwares simulação e realidade virtual, para modelar e visualizar o movimento de satélites geoestacionários e outros corpos celestes sob a influência da gravitação.","Calcular o período orbital de satélites, relacionando-o à distância da Terra e à força gravitacional."],"descritores":[]}]},{"codigo":"EM13CNT204FISa/ES","materia_codigo":"fisica","descricao":"Elaborar explicações, previsões e cálculos a respeito dos movimentos de objetos na Terra, com ou sem uso de dispositivos e aplicativos digitais (como softwares de simulação e de realidade virtual, entre outros), como descrever e comparar características físicas e parâmetros de movimentos de veículos ou outros objetos e avaliar propostas ou políticas públicas em que conhecimentos científicos ou tecnológicos estejam a serviço da melhoria das condições de vida e da superação de desigualdades sociais.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":17,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Mecânica Newtoniana:","Conceitos de Cinemática: Ponto Material e Corpo extenso, TI Trajetória; Repouso movimento e referencial, Deslocamento e Espaço Percorrido.","Vetores: Características dos Vetores, Soma e subtração de vetores com mesma direção.","Soma e Subtração de Vetores Perpendiculares, Soma e subtração de vetores oblíquos, Decomposição Vetorial.","Notação Científica","Velocidade Média Escalar.","Velocidade Média Vetorial.","Aceleração.","Noções de Movimento Uniforme e Movimento Uniformemente Variado.","Lançamento Vertical e Queda Livre","Noções de Lançamento horizonta e Lançamento oblíquo. 1ª 2ª Temas integradores 3ª"],"expectativas":["Descrever os movimentos de objetos na Terra, utilizando conceitos da Mecânica Newtoniana, como posição, velocidade, aceleração e força.","Compreender as Leis de Newton e como elas explicam a relação entre força, massa e aceleração em diferentes contextos como o movimento de veículos ou a queda livre de objetos.","Elaborar previsões sobre o movimento de objetos, aplicando as equações da cinemática e da dinâmica, como o Princípio e fundamental da dinâmica e as equações de movimento uniformemente acelerado.","Desenvolver a habilidade de utilizar dispositivos e aplicativos digitais, de como softwares de simulação e realidade virtual, para modelar visualizar o movimento de objetos, testando diferentes condições variáveis.","Interpretar os resultados obtidos nas simulações digitais, comparando-os com previsões teóricas e dados experimentais, para validar suas conclusões sobre o movimento dos objetos. e"],"descritores":[]}]},{"codigo":"EM13CNT204FISb/ES","materia_codigo":"fisica","descricao":"Elaborar explicações, previsões a respeito dos movimentos dos corpos celestes com base na análise das leis físicas, com ou sem o uso de dispositivos e aplicativos digitais (como softwares de simulação e de realidade virtual, entre outros).","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":40,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Astronomia, Modelos Cosmológicos e Evolução Estelar:","Modelos de sistemas planetários propostos ao longo da história.","Modelo geocêntrico de Ptolomeu.","Modelo heliocêntrico de Copérnico.","Leis de Kepler: Lei das órbitas, Lei das áreas, Lei dos Períodos. TI •Noções de energia e matéria escura.","Modelos cosmológicos.","Noções de evolução estelar.","Noções gerais sobre as Teorias e Modelos para a Origem e Evolução do Universo"],"expectativas":["Utilizar software de simulaçãos para compreender as leis de Kepler.","Prever e interpretar as posições dos planetas em diferentes momentos, utilizando software de simulação para visualizar as e comparar os resultados com dados observacionais.","Utilizar a Lei da Gravitação Universal de Newton para calcular dos forças entre corpos celestes, como planetas, luas e estrelas, e discutir sem como essa força influencia seus movimentos. de","Explicar as interações gravitacionais em sistemas binários de estrelas e prever os efeitos dessas interações na evolução das órbitas.","Utilizar aplicativos digitais, como softwares de simulação, analisar e prever trajetórias de corpos celestes, incluindo cometas, asteroides e satélites artificiais.","Elaborar previsões sobre eventos astronômicos, como eclipses trânsitos planetários, e verificar a precisão dessas previsões utilizando ferramentas digitais.","Discutir modelos cosmológicos, como o heliocentrismo geocentrismo, e como as leis físicas, como a inércia e a gravidade, foram aplicadas para justificar esses modelos ao longo da história.","Prever o movimento de corpos celestes em diferentes modelos cosmológicos, utilizando representações digitais para comparar suas trajetórias em cada modelo.","Integrar conceitos de Relatividade Geral na elaboração previsões sobre o movimento de corpos massivos, como buracos negros e estrelas de nêutrons, analisando como a curvatura espaço-tempo afeta essas trajetórias."],"descritores":[]}]},{"codigo":"EM13CNT205FISa/ES","materia_codigo":"fisica","descricao":"Interpretar resultados e realizar previsões sobre atividades experimentais, fenômenos naturais e processos tecnológicos, identificando as transformações de energia e caracterizando os processos pelos quais elas ocorrem.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":24,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Princípios da Conservação da Energia e da Quantidade de Movimento:","Energia mecânica","Energia cinética","Energia potencial gravitacional TI •Energia Potencia elástica","Impactos ambientais na geração de energia.","A Física e meio ambiente","A Física e sustentabilidade"],"expectativas":["Entender como os princípios de conservação da energia quantidade de movimento se aplicam aos ciclos naturais da matéria e aos fluxos de energia nos ecossistemas, reconhecendo como leis fundamentais da Física sustentam os processos de vida.","Utilizar simulações digitais e outras ferramentas tecnológicas, softwares de simulação ecológica e realidade virtual, para modelar cenários de intervenções ambientais e prever seus impactos sobre os conservação da energia nos ecossistemas.","Refletir sobre a importância de manter o equilíbrio energético conservação dos recursos naturais para garantir a sustentabilidade dos ecossistemas, propondo estratégias para mitigar os impactos negativos das intervenções humanas.","Discutir o papel da conservação da energia e da quantidade de movimento na sustentabilidade, considerando como esses princípios podem ser aplicados para promover práticas mais responsáveis sustentáveis em relação ao ambiente.","Integrar conceitos de Física, como energia mecânica, trabalho, conservação da energia, com princípios ecológicos para entender como os processos físicos influenciam a estrutura e a dinâmica ecossistemas.","Aplicar essas ideias para resolver problemas ambientais reais, a gestão de recursos naturais, a conservação da biodiversidade, mitigação das mudanças climáticas.","Desenvolver a capacidade de pensar criticamente sobre intervenções humanas no ambiente, avaliando seus efeitos a e longo prazo sobre os ecossistemas e a saúde humana, e propondo soluções baseadas nos princípios de conservação de energia movimento."],"descritores":[]}]},{"codigo":"EM13CNT205FISb/ES","materia_codigo":"fisica","descricao":"Interpretar resultados e realizar previsões sobre atividades experimentais e compreender a construção de tabelas, gráficos e relações matemáticas para a expressão do saber físico de fenômenos naturais e processos tecnológicos, com base nas noções de probabilidade e incerteza, reconhecendo os limites explicativos das ciências sendo capaz de discriminar e traduzir as linguagens matemática e discursiva entre si.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":18,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Mecânica Newtoniana:","Conceitos de Cinemática: Ponto Material e Corpo extenso, Trajetória; Repouso movimento e referencial, Deslocamento e Espaço Percorrido. TI","Vetores","Notação Científica","Velocidade Média Escalar.","Velocidade Média Vetorial.","Aceleração.","Noções de Movimento Uniforme e Movimento Uniformemente Variado.","Lançamento Vertical e Queda Livre","Noções de Lançamento horizonta e Lançamento obliquo.","Leis de Newton: Inércia, Princípio Fundamental da Dinâmica, Ação e Reação","Aplicações das Leis de Newton","Força: Peso, Normal, Força Elástica, Força de Atrito.","Máquina de Atwood 1ª"],"expectativas":["Interpretar os resultados obtidos em atividades experimentais que envolvam conceitos da Mecânica Newtoniana, como movimento.","Compreender como esses resultados refletem os princípios física, reconhecendo as relações entre as variáveis medidas, a relação entre força e aceleração (2ª Lei de Newton).","Realizar previsões sobre o comportamento de sistemas físicos de base em dados experimentais, utilizando os conceitos de Mecânica Newtoniana para antecipar os resultados de novos experimentos situações.","Aplicar as equações do movimento e as leis de Newton para a trajetória, velocidade e aceleração de objetos em experimentos controlados.","Construir e interpretar tabelas e gráficos que organizem representem dados experimentais, como gráficos de posição- tempo, velocidade-tempo e força-aceleração. e","Identificar padrões e tendências nos dados apresentados gráficos, como a linearidade entre força e aceleração, e usar padrões para validar ou refutar hipóteses.","Utilizar essas relações matemáticas para resolver problemas experimentais, realizando cálculos precisos que envolvam unidades físicas, como Newtons, metros e segundos.","Desenvolver uma compreensão crítica sobre os limites explicações científicas, reconhecendo que as previsões e modelos baseados na Mecânica Newtoniana têm validade dentro de contextos, mas podem ser limitados em outros, como em sistemas quânticos ou relativísticos."],"descritores":[]}]},{"codigo":"EM13CNT205FISc/ES","materia_codigo":"fisica","descricao":"Relacionar as características da luz aos processos de formação de imagem e interpretar resultados e realizar previsões sobre atividades experimentais, fenômenos naturais e processos tecnológicos e comparar exemplos de utilização de tecnologia em diferentes situações culturais, avaliando o papel da tecnologia no processo social e explicando transformações de matéria, energia e vida.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":50,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Espectro Eletromagnético:","Introdução a óptica","Reflexão da Luz: Espelhos planos, formação de imagens no espelho TI plano, a cor de um corpo.","Espelhos esféricos: Formação de imagens nos espelhos esféricos.","Refração da Luz: Lei de Snell","Lentes esféricas: Formação de imagens nas lentes esféricas.","Defeitos de visão: Miopia, Hipermetropia, Presbiopia e Astigmatismo."],"expectativas":["Analisar como a reflexão da luz em espelhos planos é utilizada tecnologias de formação de imagens, como câmeras e sistemas segurança, e avaliar o impacto social dessas tecnologias.","Interpretar os fenômenos de refração da luz e aplicar a Lei de para prever como a luz se comporta ao passar por diferentes de relacionando esses conhecimentos à formação de imagens lentes esféricas. e","Comparar o funcionamento de espelhos esféricos e lentes esféricas na formação de imagens, identificando as diferenças culturais e tecnológicas em sua aplicação em dispositivos ópticos, telescópios e microscópios.","Explorar a relação entre a cor de um corpo e as características da luz incidente, e investigar como essas relações são utilizadas diferentes tecnologias de iluminação e design, considerando impactos sociais e culturais.","Aplicar os conceitos de formação de imagens em espelhos esféricos para explicar o funcionamento de dispositivos ópticos utilizados na medicina, como endoscópios, e avaliar seu papel avanço tecnológico e social.","Prever os efeitos das lentes esféricas na correção de defeitos de visão, como miopia e hipermetropia, relacionando conhecimentos ao desenvolvimento de tecnologias oftalmológicas e suas implicações sociais.","Interpretar o processo de formação de imagens em espelhos e esféricos para explicar fenômenos naturais, como a reflexão em superfícies d’água, e avaliar a influência dessas interpretações em diferentes culturas."],"descritores":[]}]},{"codigo":"EM13CNT205FISd/ES","materia_codigo":"fisica","descricao":"Interpretar resultados e realizar previsões sobre atividades experimentais e processos tecnológicos, com base no papel da Física e das tecnologias a ela associadas nos processos de produção e no desenvolvimento econômico e social contemporâneo.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":55,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Isolantes e Condutores Térmicos, Elétricos e Acústicos:","Introdução a acústica: Velocidade, frequência e comprimento das ondas sonoras.","Características Fisiológicas do som: Altura, Intensidade e Timbre.","Fenômenos sonoros: Absorção, reflexão, refração, difração, TI interferência.","Efeito Doppler.","Classificação elétrica dos materiais: condutores e isolantes.","Classificação acústica dos materiais: refletores, difusores, isolantes e de absorção.","Geração, transporte e distribuição de energia elétrica.","Introdução a eletrostática."],"expectativas":["Conduzir experimentos para medir as propriedades, elétricas acústicas de diferentes materiais, interpretando os resultados determinar se um material é um bom isolante ou condutor contextos específicos.","Analisar os dados obtidos em experimentos para prever desempenho de materiais isolantes e condutores em aplicações da tecnológicas, como na construção de edificações, dispositivos eletrônicos e sistemas de isolamento acústico.","Realizar previsões sobre como a escolha de diferentes materiais condutores ou isolantes pode impactar a eficiência e a segurança em sistemas tecnológicos, como em circuitos elétricos ou proteção térmica de dispositivos.","Utilizar os resultados experimentais para prever a durabilidade eficácia de materiais isolantes e condutores em condições reais uso, considerando fatores como temperatura, umidade e pressão.","Explorar como os princípios da Física, aplicados ao estudo de isolantes e condutores, têm sido fundamentais para o desenvolvimento tecnologias modernas, como sistemas de comunicação, transporte e controle ambiental.","Avaliar como o conhecimento sobre propriedades térmicas, elétricas e acústicas dos materiais tem influenciado o desenvolvimento de tecnologias que impulsionam o crescimento econômico melhoria das condições de vida.","Utilizar softwares de simulação para modelar o comportamento de isolantes e condutores em diferentes condições experimentais, comparando previsões teóricas com resultados práticos e aplicando esses conhecimentos em contextos tecnológicos."],"descritores":[]}]},{"codigo":"EM13CNT208/ES","materia_codigo":"fisica","descricao":"Analisar a história humana, considerando sua origem, diversificação, dispersão pelo planeta e diferentes formas de interação com a natureza compreendendo a Ciência como construção humana.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":13,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["História e Filosofia da Ciência:","Diferentes sociedades ao longo da história e suas contribuições para o desenvolvimento do conhecimento científico.","Descobertas científicas influenciaram a sociedade, a cultura e a visão de mundo das pessoas em diferentes épocas.","A ciência como construção humana, influenciada por contextos históricos, sociais, culturais e econômicos. TI","As diferentes sociedades ao longo da história suas contribuições para o desenvolvimento do conhecimento científico.","Figuras Marcantes, suas descobertas e eventos que marcaram a história da ciência.","Teorias e práticas científicas que mudaram o mundo.","Ética na Ciência.","Fake News na Ciência."],"expectativas":["Compreender que a ciência é uma construção humana, influenciada por contextos históricos, sociais, culturais e econômicos.","Analisar como diferentes sociedades ao longo da história contribuíram para o desenvolvimento do conhecimento científico.","Identificar e analisar as principais figuras, descobertas e eventos que marcaram a história da ciência. a","Discutir as transformações nas teorias e práticas científicas longo do tempo, considerando avanços tecnológicos e mudanças de paradigma.","Refletir sobre como as descobertas científicas influenciaram sociedade, a cultura e a visão de mundo das pessoas em diferentes épocas.","Discutir as implicações éticas, filosóficas e sociais das descobertas e avanços científicos. e a","Integrar conhecimentos históricos e científicos para formar compreensão abrangente da história humana e do desenvolvimento da ciência.","Valorizar a interdisciplinaridade na construção do conhecimento, percebendo a interconexão entre história, filosofia e ciência.","Desenvolver a capacidade de avaliar criticamente as fontes a informação e as interpretações históricas sobre a evolução humana e a ciência.","Argumentar de forma fundamentada sobre a construção conhecimento científico e suas implicações para a compreensão da história humana."],"descritores":[]}]},{"codigo":"EM13CNT209","materia_codigo":"fisica","descricao":"Analisar a evolução estelar associando-a aos modelos de origem e distribuição dos elementos químicos no Universo, compreendendo suas relações com as condições necessárias ao surgimento de sistemas solares e planetários, suas estruturas e composições e as possibilidades de existência de vida, utilizando representações e simulações, com ou sem o uso de dispositivos e aplicativos digitais (como softwares de simulação e de realidade virtual, entre outros).","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":41,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Astronomia, Modelos Cosmológicos e Evolução Estelar:","Evolução estelar","Noções do ciclo de vida de uma estrela: Nuvem de Poeira, TI Protoestrela, Anã Marrom, Estrela de sequência principal, Gigante vermelha, anã Branca, Anã negra, Supernova, estrela de Nêutrons, Buraco negro.","Noções sobre: Fusão e Fissão Nuclear.","Noções de energia e matéria escura.","Modelos cosmológicos.","Noções de evolução estelar.","Noções gerais sobre as Teorias e Modelos para a Origem e Evolução do Universo."],"expectativas":["Explicar os processos de formação estelar que ocorrem diferentes estágios da vida de uma estrela, incluindo a fusão hidrogênio em hélio e a formação de elementos mais pesados estrelas massivas e supernovas.","Utilizar modelos digitais e simulações para representar a evolução e estelar desde a formação de uma estrela na nebulosa até o seu seja como anã branca, estrela de nêutrons ou buraco negro. de","Analisar como diferentes massas estelares influenciam a trajetória e as evolutiva de uma estrela e os tipos de elementos químicos que e formados ao longo dessa trajetória.","Interpretar o ciclo de vida de estrelas de diferentes massas, identificando as etapas de fusão nuclear, e relacionar essas etapas à produção e liberação de elementos químicos no meio interestelar.","Discutir como esses ciclos afetam a composição química do interestelar e, consequentemente, a formação de novas estrelas sistemas planetários.","Analisar o papel das supernovas na formação de elementos pesados que o ferro, utilizando simulações para modelar o processo de explosão e dispersão dos elementos no espaço.","Prever como a ocorrência de supernovas em diferentes regiões da galáxia pode influenciar a formação de sistemas solares possibilidade de vida nesses sistemas.","Avaliar os modelos cosmológicos que explicam a origem distribuição dos elementos químicos no Universo, como Bang e a evolução estelar, utilizando evidências observacionais simulações digitais para apoiar suas análises.","Diferenciar Fusão de Fissão Nuclear."],"descritores":[]}]},{"codigo":"EM13CNT209FIS/ES","materia_codigo":"fisica","descricao":"Utilizar leis físicas para prever e interpretar movimentos e analisar procedimentos em situações de interação física entre corpos celestes e outros objetos além de compreender suas relações com as condições necessárias ao surgimento de sistemas solares e planetários, suas estruturas e composições e as possibilidades de existência de vida, utilizando representações e simulações, com ou sem o uso de dispositivos e aplicativos digitais (como softwares de simulações e de realidade virtual, entre outros).","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":37,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Gravitação:","Introdução a Astronomia TI","Sistema Solar","Eclipses","Movimento das Marés","Características do sol","Características dos planetas do Sistema Solar","Planetas Anões","Cometas, Asteroides, Meteoro e Meteorito.","Constelações"],"expectativas":["Analisar as interações gravitacionais entre diferentes corpos celestes, como a força de atração entre um planeta e seu satélite natural, e discutir como essas forças determinam as órbitas influenciam a estabilidade dos sistemas planetários.","Conhecer as consequências de perturbações gravitacionais, como a passagem de um cometa próximo a um planeta, e essas interações podem alterar órbitas e estruturas dentro de sistema solar.","Explorar as condições físicas necessárias para o surgimento de formação de sistemas solares e planetários, incluindo a análise ou rotação, temperatura, e composição dos corpos celestes. de","Utilizar representações gráficas e simulações digitais para modelar a formação e evolução de sistemas solares, explorando como da física governam esses processos.","Interpretar simulações de interações gravitacionais em sistemas solares para compreender a formação de órbitas estáveis composição dos planetas.","Analisar como as condições físicas, como a distância de uma e a composição atmosférica, podem influenciar a possibilidade existência de vida em outros planetas.","Aplicar conceitos de gravitação e dinâmica para discutir as habitáveis em sistemas planetários e as condições que permitem presença de água líquida e outras condições essenciais para a","Reconhecer os planetas Anões.","Diferenciar os astros: Cometas, Asteroides, Meteoro e Meteorito."],"descritores":[]}]},{"codigo":"EM13CNT301FISa/ES","materia_codigo":"fisica","descricao":"Construir questões, elaborar hipóteses, previsões e estimativas, empregar instrumentos de medição e representar e interpretar modelos explicativos, dados e/ou resultados experimentais para construir, avaliar e justificar conclusões de enfrentamento de situações-problema de comunicação, transporte, saúde, ou outro, com correspondente desenvolvimento científico e tecnológico.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":15,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Mecânica Newtoniana:","Conceitos de Cinemática: Ponto Material e Corpo extenso, Trajetória; Repouso movimento e referencial, Deslocamento e Espaço Percorrido. TI","Vetores.","Notação Científica.","Velocidade Média Escalar.","Velocidade Média Vetorial.","Aceleração.","Noções de Movimento Uniforme e Movimento Uniformemente Variado.","Lançamento Vertical e Queda Livre","Noções de Lançamento horizonta e Lançamento oblíquo."],"expectativas":["Quantificar a velocidade e aceleração.","Formular questões científicas relacionadas a situações-problema que envolvam o estudo do movimento de objetos, como trajetórias, velocidades, acelerações e deslocamentos.","Identificar problemas específicos em áreas como transporte comunicação, onde a cinemática possa ser aplicada para analisar e prever movimentos. para","Prever o comportamento de um objeto em movimento, como de trajetória de um projétil ou o movimento de um veículo, utilizando equações da cinemática.","Utilizar instrumentos de medição para coletar dados movimento, como cronômetros para medir o tempo, réguas métricas para medir distâncias, e sensores de movimento capturar a velocidade e aceleração.","Representar o movimento de objetos através de gráficos posição-tempo, velocidade-tempo e aceleração-tempo, e de diagramas de movimento que ilustrem trajetórias e vetores deslocamento.","Interpretar esses modelos gráficos para analisar o comportamento de objetos em movimento e comparar os resultados com previsões teóricas baseadas nas equações da cinemática.","Analisar dados experimentais coletados em investigações cinemáticas, comparando-os com as previsões teóricas identificando padrões, como movimento uniforme ou uniformemente variado.","Avaliar suas conclusões, considerando a consistência dos experimentais com as previsões teóricas e a adequação modelos cinemáticos utilizados."],"descritores":[]},{"serie":1,"trimestre":2,"pagina_fonte":15,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Mecânica Newtoniana:","Conceitos de Cinemática: Ponto Material e Corpo extenso, Trajetória; Repouso movimento e referencial, Deslocamento e Espaço Percorrido. TI","Vetores.","Notação Científica.","Velocidade Média Escalar.","Velocidade Média Vetorial.","Aceleração.","Noções de Movimento Uniforme e Movimento Uniformemente Variado.","Lançamento Vertical e Queda Livre","Noções de Lançamento horizonta e Lançamento oblíquo."],"expectativas":["Quantificar a velocidade e aceleração.","Formular questões científicas relacionadas a situações-problema que envolvam o estudo do movimento de objetos, como trajetórias, velocidades, acelerações e deslocamentos.","Identificar problemas específicos em áreas como transporte comunicação, onde a cinemática possa ser aplicada para analisar e prever movimentos. para","Prever o comportamento de um objeto em movimento, como de trajetória de um projétil ou o movimento de um veículo, utilizando equações da cinemática.","Utilizar instrumentos de medição para coletar dados movimento, como cronômetros para medir o tempo, réguas métricas para medir distâncias, e sensores de movimento capturar a velocidade e aceleração.","Representar o movimento de objetos através de gráficos posição-tempo, velocidade-tempo e aceleração-tempo, e de diagramas de movimento que ilustrem trajetórias e vetores deslocamento.","Interpretar esses modelos gráficos para analisar o comportamento de objetos em movimento e comparar os resultados com previsões teóricas baseadas nas equações da cinemática.","Analisar dados experimentais coletados em investigações cinemáticas, comparando-os com as previsões teóricas identificando padrões, como movimento uniforme ou uniformemente variado.","Avaliar suas conclusões, considerando a consistência dos experimentais com as previsões teóricas e a adequação modelos cinemáticos utilizados."],"descritores":[]},{"serie":1,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Princípios da Conservação da Energia e da Quantidade de Movimento:","Energia mecânica TI •Energia cinética","Energia potencial gravitacional","Energia Potencia elástica","Impactos ambientais na geração de energia.","A Física e meio ambiente","A Física e sustentabilidade"],"expectativas":["Identificar e descrever as diferentes formas de energia envolvidas em experimentos de Física, como energia cinética, potencial, térmica, e elétrica, e como essas formas de energia se transformam durante os processos observados.","Analisar o comportamento de sistemas físicos em laboratório, reconhecendo as etapas em que ocorrem as transformações energia e relacionando-as aos princípios de conservação. para","Desenvolver a habilidade de prever os resultados esperados de experimentos baseados nos princípios de conservação da energia e da quantidade de movimento, utilizando modelos teóricos cálculos matemáticos para suportar suas previsões.","Utilizar instrumentos de medição, como cronômetros, sensores, e calorímetros, para coletar dados precisos em experimentos relacionados à conservação de energia, analisando e interpretando esses dados para validar os princípios teóricos. de","Empregar ferramentas digitais, como softwares de simulação e modelagem, para representar visualmente os processos transformação de energia observados, facilitando a compreensão e a comunicação dos resultados experimentais.","Compartilhar suas interpretações dos resultados experimentais e considerar como os conceitos de conservação de energia e quantidade de movimento influenciam o entendimento fenômenos físicos e o desenvolvimento de tecnologias sustentáveis.","Usar os dados e resultados experimentais para resolver problemas práticos relacionados à conservação de energia, como a otimização de sistemas energéticos e a minimização de perdas em processos tecnológicos."],"descritores":[]},{"serie":1,"trimestre":2,"pagina_fonte":25,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Princípios da Conservação da Energia e da Quantidade de Movimento:","Energia mecânica TI •Energia cinética","Energia potencial gravitacional","Energia Potencia elástica","Impactos ambientais na geração de energia.","A Física e meio ambiente","A Física e sustentabilidade"],"expectativas":["Identificar e descrever as diferentes formas de energia envolvidas em experimentos de Física, como energia cinética, potencial, térmica, e elétrica, e como essas formas de energia se transformam durante os processos observados.","Analisar o comportamento de sistemas físicos em laboratório, reconhecendo as etapas em que ocorrem as transformações energia e relacionando-as aos princípios de conservação. para","Desenvolver a habilidade de prever os resultados esperados de experimentos baseados nos princípios de conservação da energia e da quantidade de movimento, utilizando modelos teóricos cálculos matemáticos para suportar suas previsões.","Utilizar instrumentos de medição, como cronômetros, sensores, e calorímetros, para coletar dados precisos em experimentos relacionados à conservação de energia, analisando e interpretando esses dados para validar os princípios teóricos. de","Empregar ferramentas digitais, como softwares de simulação e modelagem, para representar visualmente os processos transformação de energia observados, facilitando a compreensão e a comunicação dos resultados experimentais.","Compartilhar suas interpretações dos resultados experimentais e considerar como os conceitos de conservação de energia e quantidade de movimento influenciam o entendimento fenômenos físicos e o desenvolvimento de tecnologias sustentáveis.","Usar os dados e resultados experimentais para resolver problemas práticos relacionados à conservação de energia, como a otimização de sistemas energéticos e a minimização de perdas em processos tecnológicos."],"descritores":[]}]},{"codigo":"EM13CNT301FISb/ES","materia_codigo":"fisica","descricao":"Construir questões, elaborar hipóteses, previsões e estimativas, empregar instrumentos de medição e representar e interpretar modelos explicativos, dados e/ou resultados experimentais nos impactos ambientais, identificando fontes, transporte e destino dos poluentes e seus efeitos nos sistemas naturais, produtivos e sociais.","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":31,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Leis da Termodinâmica:","Estudo dos gases","Trabalho termodinâmico","Energia interna de um sistema gasoso TI","Máquinas térmicas","1ª Lei da Termodinâmica","2ª Lei da Termodinâmica","Conceito de Entropia."],"expectativas":["Conhecer o processo de evolução de máquinas térmicas ao da história da humanidade.","Investigar como o uso de máquinas térmicas contribui para impactos ambientais, incluindo a análise das fontes de poluição, transporte e destino dos poluentes gerados, empregando instrumentos de medição e modelos explicativos.","Prever os efeitos das leis da termodinâmica, especialmente nos relação à energia interna de sistemas gasosos, sobre a dispersão dos poluentes e seus impactos nos sistemas naturais, produtivos e sociais.","Construir modelos e realizar simulações para entender os processos de transporte e destino dos poluentes gerados por sistemas térmicos, utilizando o conceito de entropia para avaliar a irreversibilidade processos e seus impactos ambientais.","Elaborar hipóteses e previsões sobre como o trabalho termodinâmico realizado por sistemas de geração de energia influencia os impactos ambientais, utilizando dados experimentais e modelos explicativos para validar as conclusões.","Analisar como as propriedades dos gases, incluindo a energia interna e o trabalho realizado, afetam o comportamento poluentes atmosféricos, utilizando instrumentos de medição avaliar a dispersão e concentração desses poluentes em diferentes ambientes.","Analisar como a entropia e a irreversibilidade dos processos termodinâmicos estão relacionados à eficiência de sistemas térmicos e aos impactos ambientais, utilizando modelos explicativos para representar esses processos."],"descritores":[]},{"serie":2,"trimestre":2,"pagina_fonte":46,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Leis da Termodinâmica:","Estudo dos gases","Trabalho termodinâmico","Energia interna de um sistema gasoso TI","Máquinas térmicas","1ª Lei da Termodinâmica","2ª Lei da Termodinâmica","Conceito de Entropia."],"expectativas":["Conhecer o processo de evolução de máquinas térmicas ao da história da humanidade.","Investigar como o uso de máquinas térmicas contribui para impactos ambientais, incluindo a análise das fontes de poluição, transporte e destino dos poluentes gerados, empregando instrumentos de medição e modelos explicativos.","Prever os efeitos das leis da termodinâmica, especialmente nos relação à energia interna de sistemas gasosos, sobre a dispersão dos poluentes e seus impactos nos sistemas naturais, produtivos e sociais.","Construir modelos e realizar simulações para entender os processos de transporte e destino dos poluentes gerados por sistemas térmicos, utilizando o conceito de entropia para avaliar a irreversibilidade processos e seus impactos ambientais.","Elaborar hipóteses e previsões sobre como o trabalho termodinâmico realizado por sistemas de geração de energia influencia os impactos ambientais, utilizando dados experimentais e modelos explicativos para validar as conclusões.","Analisar como as propriedades dos gases, incluindo a energia interna e o trabalho realizado, afetam o comportamento poluentes atmosféricos, utilizando instrumentos de medição avaliar a dispersão e concentração desses poluentes em diferentes ambientes.","Analisar como a entropia e a irreversibilidade dos processos termodinâmicos estão relacionados à eficiência de sistemas térmicos e aos impactos ambientais, utilizando modelos explicativos para representar esses processos."],"descritores":[]}]},{"codigo":"EM13CNT301FISc/ES","materia_codigo":"fisica","descricao":"Construir questões, elaborar hipóteses, previsões e estimativas, empregar as leis físicas, representar e interpretar modelos explicativos da Física Moderna e Contemporânea bem como dados e/ou resultados experimentais para construir conclusões no enfrentamento das pseudociências e pseudo informações científicas.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":42,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Astronomia, Modelos Cosmológicos e Evolução Estelar:","Evolução estelar","Noções do ciclo de vida de uma estrela: Nuvem de Poeira, Protoestrela, Anã Marrom, Estrela de sequência principal, Gigante TI vermelha, anã Branca, Anã negra, Supernova, estrela de Nêutrons, Buraco negro.","Noções sobre: Fusão e Fissão Nuclear.","Noções de energia e matéria escura.","Modelos cosmológicos.","Noções de evolução estelar.","Noções gerais sobre as Teorias e Modelos para a Origem e Evolução do Universo","Fake News na Ciência."],"expectativas":["Formular questões e elaborar hipóteses sobre os diferentes modelos cosmológicos, como o Modelo do Big Bang e a Teoria do Multiverso, utilizando leis físicas para explorar suas implicações e previsões.","Compreender as fases de evolução estelar, como o ciclo de de uma estrela desde a nuvem de poeira até possíveis estados como anãs negras ou buracos negros.","Construir e interpretar modelos explicativos da evolução e/ou e do universo, utilizando representações gráficas para explicar fenômenos como supernovas e buracos negros.","Compreender fenômenos estelares e cosmológicos, observações astronômicas e experimentos sobre matéria escura energia escura.","Construir conclusões baseadas em evidências científicas para enfrentar pseudociências e informações falsas, utilizando conhecimentos sólidos da Física Moderna e Contemporânea.","Comparar diferentes teorias sobre a origem e evolução do universo.","Analisar informações confiáveis na área de Ciências."],"descritores":[]}]},{"codigo":"EM13CNT302","materia_codigo":"fisica","descricao":"Comunicar, para públicos variados, em diversos contextos, resultados de análises, pesquisas e/ou experimentos, elaborando e/ ou interpretando textos, gráficos, tabelas, símbolos, códigos, sistemas de classificação e equações, por meio de diferentes linguagens, mídias tecnologias digitais de informações e comunicação (TDIC), de modo a participar e/ou promover debates em torno de temas científicos e/ou tecnológicos de relevância sociocultural e ambiental.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":38,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Gravitação:","Modelos de sistemas planetários propostos ao longo da história.","Leis de Kepler: Lei das órbitas, Lei das áreas, Lei dos Períodos. TI •Força Gravitacional.","Noções dos satélites geoestacionários de comunicação global.","Satélites em órbitas Circulares.","Frequência e Período Orbital.","Velocidade Orbital.","Introdução a Astronomia.","Sistema Solar.","Eclipses.","Movimento das Marés.","Características do sol.","Características dos planetas do Sistema Solar.","Planetas Anões.","Cometas, Asteroides, Meteoro e Meteorito.","Constelações. 1ª"],"expectativas":["Elaborar relatórios científicos detalhados sobre experimentos análises relacionados à gravitação, utilizando uma linguagem e apropriada para diferentes públicos, como colegas de professores e comunidades científicas.","Criar apresentações em formatos variados (slides, vídeos, podcasts) para explicar conceitos de gravitação, como a lei da gravitação e/ universal, de forma acessível para diferentes audiências.","Criar gráficos e tabelas que representem os resultados experimentos relacionados à gravitação, como a variação força gravitacional com a distância, e interpretá-los para comunicar de conclusões a diferentes públicos. e","Utilizar ferramentas digitais, como softwares de simulação planilhas eletrônicas, para criar representações visuais que ilustrem as interações gravitacionais entre corpos celestes.","Aplicar e explicar as equações relacionadas à gravitação a lei da gravitação universal de Newton) em contextos diversos, como a previsão de órbitas planetárias, de forma que pessoas diferentes níveis de conhecimento científico possam compreender.","Resolver problemas envolvendo gravitação e apresentar soluções em discussões em sala de aula ou em debates públicos, utilizando linguagem matemática apropriada.","Desenvolver conteúdo multimídia (animações, infográficos, que expliquem conceitos de gravitação, como a influência gravidade na formação de sistemas planetários, e seus impactos vida cotidiana."],"descritores":[]}]},{"codigo":"EM13CNT303/ES","materia_codigo":"fisica","descricao":"Interpretar textos de divulgação científica que tratem de temáticas relacionadas à História e Filosofia da Ciência, disponíveis em diferentes mídias, considerando a consistência dos argumentos e a coerência das conclusões, visando construir estratégias de seleção de fontes confiáveis de informações.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":14,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["História e Filosofia da Ciência:","Diferentes sociedades ao longo da história e suas contribuições para o desenvolvimento do conhecimento científico.","Descobertas científicas influenciaram a sociedade, a cultura e a visão de mundo das pessoas em diferentes épocas. TI •A ciência como construção humana, influenciada por contextos históricos, sociais, culturais e econômicos.","As diferentes sociedades ao longo da história suas contribuições para o desenvolvimento do conhecimento científico.","Figuras Marcantes, suas descobertas e eventos que marcaram a história da ciência.","Teorias e práticas científicas que mudaram o mundo.","Ética na Ciência.","Fake News na Ciência."],"expectativas":["Ler e compreender textos de divulgação científica relacionados História e Filosofia da Ciência, identificando os principais argumentos e conclusões.","Reconhecer diferentes gêneros de textos científicos e características.","Analisar a consistência dos argumentos apresentados nos em de divulgação científica, avaliando a validade das evidências e a lógica das conclusões.","Distinguir entre argumentos bem fundamentados e aqueles carecem de suporte adequado.","Identificar possíveis falácias, vieses ou lacunas nos argumentos apresentados.","Desenvolver critérios para selecionar fontes confiáveis informações científicas, considerando a reputação dos autores, qualidade das publicações e a relevância dos conteúdos.","Aprender a verificar a credibilidade das fontes, incluindo a revisão e a por pares, a afiliação institucional dos autores e as citações outros trabalhos científicos.","Interpretar textos de divulgação científica disponíveis em diferentes mídias, incluindo artigos, vídeos, podcasts e redes sociais.","Discutir as vantagens e desvantagens de cada mídia em termos clareza, profundidade e acessibilidade das informações. a","Desenvolver estratégias práticas para buscar e selecionar confiáveis de informações científicas, utilizando ferramentas busca acadêmica, bibliotecas digitais e bases de dados científicas."],"descritores":[]}]},{"codigo":"EM13CNT303FISa/ES","materia_codigo":"fisica","descricao":"Interpretar textos de divulgação científica que tratem de temáticas da Mecânica Newtoniana, da Física Moderna e Contemporânea, disponível em diferentes mídias, visando a promoção da divulgação científica na comunidade escolar além de construir estratégias de seleção de fontes confiáveis de informações.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":16,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Mecânica Newtoniana:","Leis de Newton: Inércia, Princípio Fundamental da Dinâmica, Ação e Reação. TI •Aplicações das Leis de Newton.","Força: Peso, Normal, Força Elástica, Força de Atrito.","Máquina de Atwood."],"expectativas":["Formular questões científicas que investiguem como as Leis Newton explicam o movimento e as interações entre corpos, aplicações em situações-problema em comunicação, transporte, saúde ou outras áreas.","Identificar problemas específicos, como a análise de em veículos em movimento, a estabilidade de estruturas, biomecânica do corpo humano, que possam ser resolvidos utilizando as Leis de Newton. de","Elaborar hipóteses sobre como as forças agem sobre os corpos como essas forças influenciam o movimento, utilizando as Leis Newton como base teórica.","Prever os efeitos de diferentes forças sobre um objeto, como aceleração resultante de uma força aplicada.","Usar instrumentos de medição, como dinamômetros para forças, cronômetros para medir o tempo de movimento, e sensores para capturar aceleração e velocidade.","Compreender a importância de calibrar os instrumentos e garantir a precisão das medições ao investigar a dinâmica dos corpos movimento.","Representar sistemas dinâmicos usando diagramas de corpo que ilustram as forças atuando sobre um objeto e o vetor resultante da aceleração, de acordo com a 2ª Lei de Newton.","Interpretar esses modelos para analisar o movimento de corpos a ação de diferentes forças, como atrito, gravidade e forças normais, e para prever como essas forças influenciam o comportamento objetos."],"descritores":[]}]},{"codigo":"EM13CNT303FISb/ES","materia_codigo":"fisica","descricao":"Interpretar textos de divulgação científica que tratem da temática ondas eletromagnéticas, disponíveis em diferentes mídias, considerando as diversas possibilidades para o uso social identificando e comparando as diferentes opções em termos de seus impactos ambiental, social e econômico.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":48,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Espectro Eletromagnético :","Introdução a Ondulatória: Frequência, Período e Velocidade de uma onda qualquer. TI","Elementos de uma onda.","Classificação das ondas: Mecânica e Eletromagnética.","Espectro Eletromagnético.","Elementos de uma onda.","Fenômenos Ondulatórios: Reflexão, Refração, Interferência, difração, Ressonância."],"expectativas":["Reconhecer as principais características das eletromagnéticas, como frequência, período e velocidade, ao interpretar textos de divulgação científica sobre o espectro eletromagnético.","Identificar elementos de uma onda e a classificação das da em mecânicas e eletromagnéticas ao analisar artigos e reportagens que tratam do espectro eletromagnético e suas aplicações.","Comparar diferentes formas de uso das ondas eletromagnéticas de em contextos sociais, ambientais e econômicos, destacando vantagens e desvantagens conforme descritas em textos divulgação científica.","Avaliar os impactos ambientais e sociais das tecnologias utilizam ondas eletromagnéticas, como comunicações e dispositivos médicos, com base em informações retiradas de textos científicos midiáticos.","Interpretar as aplicações do espectro eletromagnético de diferentes mídias, identificando como os fenômenos ondulatórios, como reflexão e refração, são explorados em tecnologias cotidianas.","Explorar as implicações da interferência e difração de eletromagnéticas em sistemas de comunicação, a partir da de artigos científicos e reportagens.","Analisar como a ressonância é utilizada em diferentes tecnologias baseadas em ondas eletromagnéticas, interpretando textos divulgação que tratam dessas aplicações.","Explicar o funcionamento básico das tecnologias que utilizam ondas eletromagnéticas, como micro-ondas e raios X, interpretando informações apresentadas em textos de divulgação científica."],"descritores":[]}]},{"codigo":"EM13CNT304FIS/ES","materia_codigo":"fisica","descricao":"Analisar e debater situações controversas sobre a aplicação de conhecimentos da área de Ciências da Natureza, com base em argumentos consistentes, legais, éticos e responsáveis, distinguindo diferentes pontos de vista.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":43,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Astronomia, Modelos Cosmológicos e Evolução Estelar","Evolução estelar","Noções do ciclo de vida de uma estrela: Nuvem de Poeira, Protoestrela, Anã Marrom, Estrela de sequência principal, Gigante vermelha, anã Branca, Anã negra, Supernova, estrela de Nêutrons, TI Buraco negro.","Noções sobre: Fusão e Fissão Nuclear.","Noções de energia e matéria escura.","Modelos cosmológicos.","Noções de evolução estelar.","Noções gerais sobre as Teorias e Modelos para a Origem e Evolução do Universo."],"expectativas":["Analisar e discutir as implicações dos diferentes modelos cosmológicos, como o Big Bang e o modelo do estado estacionário, considerando tanto as evidências observacionais quanto as físicas subjacentes.","Avaliar questões éticas relacionadas às pesquisas e explorações de astronômicas, como a busca por vida extraterrestre e a exploração em de outros planetas, discutindo os impactos potenciais sobre a os recursos no nosso próprio planeta.","Analisar como avanços tecnológicos na astronomia, telescópios espaciais e satélites, afetam a sociedade e a política, discutindo tanto os benefícios quanto os desafios associados a tecnologias.","Debater o impacto das descobertas astronômicas na cultura filosofia, considerando como elas influenciam nossa visão do cosmos e o papel da humanidade no universo.","Discutir a viabilidade e as implicações éticas da exploração espacial em busca de recursos e novos habitats, considerando o equilíbrio entre os benefícios para a humanidade e os possíveis danos aos ecossistemas espaciais e terrestres.","Comparar e debater diferentes teorias sobre a evolução estelar, como a formação de buracos negros e estrelas de nêutrons, considerando as evidências observacionais e a teoria envolvida.","Analisar como as diferentes explicações para a evolução afetam nossa compreensão da formação de elementos origem dos sistemas planetários, discutindo as implicações para astrobiologia e a busca por vida extraterrestre."],"descritores":[]}]},{"codigo":"EM13CNT307","materia_codigo":"fisica","descricao":"Analisar as propriedades dos materiais para avaliar a adequação de seu uso em diferentes aplicações (industriais, cotidianas, arquitetônicas ou tecnológicas) e/ou propor soluções seguras e sustentáveis considerando seu contexto local e cotidiano.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":56,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Isolantes e Condutores Térmicos, Elétricos e Acústicos:","Noções de resistência elétrica: Resistividade elétrica.","Classificação elétrica dos materiais: condutores e isolantes.","Classificação acústica dos materiais: refletores, difusores, isolantes e de absorção. TI","Introdução a eletrostática.","Processos de eletrização: Atrito contato e Indução.","Noção de campo elétrico."],"expectativas":["Compreender o conceito de Campo Elétrico.","Compreender como são formadas as tempestades.","Classificar materiais como isolantes e condutores elétricos com base em suas propriedades elétricas, como resistividade condutividade, avaliando sua adequação para o uso em circuitos elétricos, dispositivos eletrônicos e infraestrutura energética.","Investigar como o campo elétrico é utilizado em diferentes e tecnologias de geração de energia elétrica, com foco na eficiência e no impacto ambiental.","Interpretar e prever os efeitos do campo elétrico em tecnologias emergentes de geração de energia, considerando as características geográficas e a viabilidade de implementação.","Explorar como o conhecimento sobre a formação de tempestades pode ser aplicado em tecnologias de geração de energia elétrica, como a utilização de raios e outras formas de energia atmosférica.","Avaliar os riscos e benefícios das tecnologias que utilizam tempestades ou fenômenos atmosféricos para a geração energia, considerando sua aplicação em diferentes setores.","Explorar as aplicações de materiais acústicos e elétricos tecnologias arquitetônicas inovadoras, como casas inteligentes edifícios sustentáveis, avaliando o impacto dessas tecnologias qualidade de vida e na preservação do meio ambiente.","Utilizar ferramentas digitais para modelar e simular o comportamento de materiais acústicos e elétricos em diferentes condições, comparando previsões teóricas com resultados experimentais aplicando esses conhecimentos em propostas tecnológicas priorizem a segurança e a sustentabilidade."],"descritores":[]}]},{"codigo":"EM13CNT308","materia_codigo":"fisica","descricao":"Investigar e analisar o funcionamento de equipamentos elétricos e/ou eletrônicos e sistemas de automação para compreender as tecnologias contemporâneas e avaliar seus impactos sociais, culturais e ambientais.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":51,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Espectro Eletromagnético:","Introdução a óptica.","Reflexão da Luz: Espelhos planos, formação de imagens no espelho plano, a cor de um corpo.","Espelhos esféricos: Formação de imagens nos espelhos esféricos. TI","Refração da Luz: Lei de Snell.","Lentes esféricas: Formação de imagens nas lentes esféricas.","Defeitos de visão: Miopia, Hipermetropia, Presbiopia e Astigmatismo."],"expectativas":["Analisar como a reflexão da luz em espelhos planos é utilizada dispositivos eletrônicos, como sensores ópticos, e avaliar os impactos culturais e ambientais dessas tecnologias.","Investigar o uso de espelhos esféricos em sistemas de automação, como câmeras de segurança, compreendendo os princípios formação de imagens e avaliando seus efeitos sociais.","Explorar o papel da refração da luz na operação de equipamentos ópticos, como scanners e leitores de código de barras, e analisar implicações sociais e ambientais dessas tecnologias.","Compreender como a Lei de Snell é aplicada em tecnologias como fibras ópticas e avaliar o impacto dessas tecnologias comunicação moderna e seus efeitos culturais.","Investigar como as lentes esféricas são usadas em equipamentos visão, como microscópios e câmeras, avaliando as consequências sociais e culturais de sua aplicação.","Analisar os impactos ambientais e sociais da automação utiliza dispositivos ópticos, como sensores de presença baseados reflexão e refração da luz.","Explorar o funcionamento de equipamentos que corrigem defeitos de visão, como óculos e lentes de contato, investigando evolução tecnológica e seus impactos na qualidade de vida sociedade.","Compreender como a cor de um corpo e a reflexão da luz usadas em tecnologias de display, como telas de LED e avaliando seus efeitos culturais e ambientais."],"descritores":[]}]},{"codigo":"EM13CNT309FIS/ES","materia_codigo":"fisica","descricao":"Realizar previsões qualitativas e quantitativas sobre o funcionamento de geradores, motores elétricos e seus componentes, bobinas, transformadores, pilhas, baterias e dispositivos eletrônicos, com base na análise dos processos de transformação e condução de energia envolvidos, com ou sem o uso de dispositivos e aplicativos digitais, para propor ações que visem a sustentabilidade.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":21,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Matriz Energética:","Transformações de energia","Matriz energética TI","Usinas geradoras de energia elétrica","Riscos associados a cada tipo de geração de energia, incluindo os impactos ambientais, sociais e econômicos, como a emissão de poluentes, o uso de recursos hídricos, ou o risco de acidentes nucleares.","Desenvolvimento Sustentável","Política Energética Nacional"],"expectativas":["Explicar como a energia mecânica é transformada em energia elétrica nos geradores e como a energia elétrica é convertida energia mecânica nos motores elétricos, compreendendo o de componentes como bobinas, transformadores, pilhas e baterias nesse processo.","Entender os conceitos de indução eletromagnética, diferença potencial, e corrente elétrica, e como esses princípios se aplicam base funcionamento de dispositivos elétricos.","Os alunos devem aprender a prever qualitativamente comportamento de geradores, motores e outros dispositivos base na análise dos processos de transformação de energia, o efeito de variações na velocidade de rotação de um gerador sobre a tensão gerada.","Compreender como o princípio da conservação da energia aplica ao funcionamento de geradores e motores, reconhecendo que a energia total do sistema é conservada, mesmo que transformações entre diferentes formas de energia.","Utilizar dispositivos e aplicativos digitais, como softwares simulação, para modelar o funcionamento de geradores, motores e outros dispositivos elétricos, testando diferentes parâmetros condições.","Propor ações para aumentar a sustentabilidade na energética, como o uso de fontes renováveis de energia alimentar geradores e a implementação de tecnologias eficientes para reduzir as perdas de energia em motores transformadores.","Propor ideias que contribuam para a transição para uma energética mais sustentável e equitativa."],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":59,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Desenvolvimento e aprimoramento de tecnologias de obtenção de Energia Elétrica: TI •Matriz energética do Brasil e do Espírito Santo.","Principais usinas hidrelétricas do Espírito Santo.","Impactos socioambientais","Energia e desenvolvimento sustentável","Energia e mudanças climáticas."],"expectativas":["Identificar as principais usinas hidrelétricas do Espírito Santo.","Analisar os efeitos socioambientais da exploração e uso recursos não renováveis no Espírito Santo e no Brasil, avaliando consequências para o meio ambiente e para as comunidades locais.","Relacionar a dependência dos recursos não renováveis aos problemas como a poluição, a degradação ambiental e a emissão de gases de efeito estufa, utilizando princípios da Física entender processos como a combustão e a liberação de energia.","Identificar e discutir as principais fontes de energia renovável disponíveis no Espírito Santo e no Brasil, como energia solar, eólica, hidráulica e biomassa, analisando sua viabilidade e eficiência comparação com as fontes não renováveis.","Utilizar conceitos de energia, potência e eficiência para avaliar o potencial das matrizes energéticas renováveis, considerando capacidade de geração, armazenamento e distribuição de energia de elétrica de forma sustentável.","Investigar as tecnologias emergentes e os materiais inovadores que podem contribuir para a transição para matrizes energéticas renováveis no Espírito Santo e no Brasil, como células fotovoltaicas avançadas, turbinas eólicas mais eficientes e baterias de capacidade.","Aplicar os princípios da Física para analisar a eficiência sustentabilidade dessas novas tecnologias, considerando fatores como a conversão de energia, a resistência dos materiais perdas de energia."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":59,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Desenvolvimento e aprimoramento de tecnologias de obtenção de Energia Elétrica: TI •Matriz energética do Brasil e do Espírito Santo.","Principais usinas hidrelétricas do Espírito Santo.","Impactos socioambientais","Energia e desenvolvimento sustentável","Energia e mudanças climáticas."],"expectativas":["Identificar as principais usinas hidrelétricas do Espírito Santo.","Analisar os efeitos socioambientais da exploração e uso recursos não renováveis no Espírito Santo e no Brasil, avaliando consequências para o meio ambiente e para as comunidades locais.","Relacionar a dependência dos recursos não renováveis aos problemas como a poluição, a degradação ambiental e a emissão de gases de efeito estufa, utilizando princípios da Física entender processos como a combustão e a liberação de energia.","Identificar e discutir as principais fontes de energia renovável disponíveis no Espírito Santo e no Brasil, como energia solar, eólica, hidráulica e biomassa, analisando sua viabilidade e eficiência comparação com as fontes não renováveis.","Utilizar conceitos de energia, potência e eficiência para avaliar o potencial das matrizes energéticas renováveis, considerando capacidade de geração, armazenamento e distribuição de energia de elétrica de forma sustentável.","Investigar as tecnologias emergentes e os materiais inovadores que podem contribuir para a transição para matrizes energéticas renováveis no Espírito Santo e no Brasil, como células fotovoltaicas avançadas, turbinas eólicas mais eficientes e baterias de capacidade.","Aplicar os princípios da Física para analisar a eficiência sustentabilidade dessas novas tecnologias, considerando fatores como a conversão de energia, a resistência dos materiais perdas de energia."],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":62,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Desenvolvimento e aprimoramento de tecnologias de obtenção de Energia Elétrica :","Introdução ao magnetismo.","Noções de Força Magnética. TI","Classificação de materiais magnéticos.","Estado de magnetização: ferromagnetismo, antiferromagnetismo, diamagnéticos e paramagnéticos.”","Conceito de campo magnético.","Magnetosfera.","Bússola: O que é? Para que serve? Como é utilizada?","Força sobre carga móvel em campo magnético.","Movimento de uma carga em campo magnético constante.","Força magnética sobre um condutor reto em campo magnético uniforme.","Experimento de Oersted.","Campo magnético: Imã, condutor retilíneo, espira circular, bobina, solenoide.","Noções de indução eletromagnética: Lei de Lenz. 1ª"],"expectativas":["Analisar os efeitos socioambientais da exploração e uso recursos não renováveis no Espírito Santo e no Brasil, avaliando consequências para o meio ambiente e para as comunidades locais.","Relacionar a dependência dos recursos não renováveis problemas como a poluição, a degradação ambiental e a emissão de gases de efeito estufa, utilizando princípios da Física aos entender processos como a combustão e a liberação de energia.","Identificar e discutir as principais fontes de energia renovável disponíveis no Espírito Santo e no Brasil, como energia solar, eólica, hidráulica e biomassa, analisando sua viabilidade e eficiência comparação com as fontes não renováveis.","Investigar as tecnologias emergentes e os materiais inovadores que podem contribuir para a transição para matrizes energéticas renováveis no Espírito Santo e no Brasil, como células fotovoltaicas de avançadas, turbinas eólicas mais eficientes e baterias de capacidade.","Debater as implicações econômicas da transição para matrizes energéticas renováveis, considerando os investimentos necessários, os custos de implementação e os benefícios a longo prazo para economia local e nacional.","Analisar as políticas públicas voltadas para a promoção energias renováveis no Espírito Santo e no Brasil, discutindo importância de incentivos governamentais, regulamentações parcerias com o setor privado para o desenvolvimento sustentável.","Avaliar como a diversificação das matrizes energéticas contribuir para a independência energética do Espírito Santo Brasil, reduzindo a vulnerabilidade a crises econômicas e geopolíticas relacionadas ao abastecimento de energia.","Utilizar modelos físicos e simulações para prever o impacto a prazo da transição para energias renováveis, considerando cenários de crescimento populacional, demanda energética e mudanças climáticas."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":62,"arquivo_fonte":"fisica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Desenvolvimento e aprimoramento de tecnologias de obtenção de Energia Elétrica :","Introdução ao magnetismo.","Noções de Força Magnética. TI","Classificação de materiais magnéticos.","Estado de magnetização: ferromagnetismo, antiferromagnetismo, diamagnéticos e paramagnéticos.”","Conceito de campo magnético.","Magnetosfera.","Bússola: O que é? Para que serve? Como é utilizada?","Força sobre carga móvel em campo magnético.","Movimento de uma carga em campo magnético constante.","Força magnética sobre um condutor reto em campo magnético uniforme.","Experimento de Oersted.","Campo magnético: Imã, condutor retilíneo, espira circular, bobina, solenoide.","Noções de indução eletromagnética: Lei de Lenz. 1ª"],"expectativas":["Analisar os efeitos socioambientais da exploração e uso recursos não renováveis no Espírito Santo e no Brasil, avaliando consequências para o meio ambiente e para as comunidades locais.","Relacionar a dependência dos recursos não renováveis problemas como a poluição, a degradação ambiental e a emissão de gases de efeito estufa, utilizando princípios da Física aos entender processos como a combustão e a liberação de energia.","Identificar e discutir as principais fontes de energia renovável disponíveis no Espírito Santo e no Brasil, como energia solar, eólica, hidráulica e biomassa, analisando sua viabilidade e eficiência comparação com as fontes não renováveis.","Investigar as tecnologias emergentes e os materiais inovadores que podem contribuir para a transição para matrizes energéticas renováveis no Espírito Santo e no Brasil, como células fotovoltaicas de avançadas, turbinas eólicas mais eficientes e baterias de capacidade.","Debater as implicações econômicas da transição para matrizes energéticas renováveis, considerando os investimentos necessários, os custos de implementação e os benefícios a longo prazo para economia local e nacional.","Analisar as políticas públicas voltadas para a promoção energias renováveis no Espírito Santo e no Brasil, discutindo importância de incentivos governamentais, regulamentações parcerias com o setor privado para o desenvolvimento sustentável.","Avaliar como a diversificação das matrizes energéticas contribuir para a independência energética do Espírito Santo Brasil, reduzindo a vulnerabilidade a crises econômicas e geopolíticas relacionadas ao abastecimento de energia.","Utilizar modelos físicos e simulações para prever o impacto a prazo da transição para energias renováveis, considerando cenários de crescimento populacional, demanda energética e mudanças climáticas."],"descritores":[]}]},{"codigo":"EM13MAT101","materia_codigo":"matematica","descricao":"Interpretar criticamente situações econômicas, sociais e fatos relativos às Ciências da Natureza que envolvam a variação de grandezas, pela análise dos gráficos das funções representadas e das taxas de variação, com ou sem apoio de tecnologias digitais.","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":9,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Ler e analisar gráficos que representam a variação entre duas grandezas.","Identificar a taxa de variação de crescimento ou decrescimento em funções que descrevem situações relacionadas a fatos da economia, da sociedade e de fenômenos de outras áreas do conhecimento. ■ descritor: ▼Abaixo do básico, Básico, ◆ Proficiente e ★ Avançado."],"descritores":[]}]},{"codigo":"EM13MAT102","materia_codigo":"matematica","descricao":"Analisar tabelas, gráficos e amostras de pesquisas estatísticas apresentadas em relatórios divulgados por diferentes meios de comunicação, identificando, quando for o caso, inadequações que possam induzir a erros de interpretação, como escalas e amostras não apropriadas.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Conceitos estatísticos: população e amostragem.","Gráficos utilizados pela estatística e elementos de um gráfico.","Confiabilidade de fontes de dados.","Correção no traçado de gráficos estatísticos. 1ª"],"expectativas":["Identificar e interpretar diferentes formas apresentação de dados em tabelas, gráficos (barras, setores, linhas, histogramas, entre outros) e relatórios estatísticos.","Reconhecer os elementos essenciais de tabelas não gráficos, como título, eixos, legendas, escalas e unidades de medida.","Compreender os conceitos de amostra e população, analisando se uma amostra é representativa adequada para o contexto do estudo apresentado.","Avaliar a adequação de escalas e intervalos gráficos, identificando possíveis distorções que possam induzir a interpretações equivocadas.","Reconhecer estratégias utilizadas em gráficos e tabelas para enfatizar ou minimizar resultados, como cortes escalas ou uso exagerado de cores e formas.","Verificar a consistência entre os dados apresentados em tabelas e suas representações gráficas. um","Identificar possíveis vieses em pesquisas, como tamanho insuficiente da amostra, falta de diversidade ou métodos inadequados de coleta de dados. Descritor do PAEBES D063_M Corresponder listas e/ou tabelas simples gráficos que as representam. D064_M Utilizar informações apresentadas em tabelas ou gráficos na resolução de problemas."],"descritores":[{"codigo":"D063_M","descricao":"Corresponder listas e/ou tabelas simples gráficos que as representam."},{"codigo":"D064_M","descricao":"Utilizar informações apresentadas em tabelas ou gráficos na resolução de problemas."}]}]},{"codigo":"EM13MAT103","materia_codigo":"matematica","descricao":"Interpretar e compreender textos científicos ou divulgados pelas mídias, que empregam unidades de medida de diferentes grandezas e as conversões possíveis entre elas, adotadas ou não pelo Sistema Internacional (SI), como as de armazenamento e velocidade de transferência de dados, ligadas aos avanços tecnológicos.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":16,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Sistema Internacional de Medidas: principais unidades e conversões.","Principais unidades de armazenamento de dados na informática (bit, byte, kilobyte, megabyte, gigabyte etc.) e transferência de dados (Mbps, Kbps, Gbps etc.). 1ª"],"expectativas":["Converter unidades de medidas relacionadas à ou mesma grandeza a fim de expressar a mesma situação em diferentes escalas.","Comparar diferentes unidades de armazenamento e transmissão de dados em diferentes dispositivos e eletrônicos (físicos e virtuais) a partir da leitura aos manuais técnicos, reportagens e/ou peças publicitárias (panfletos, anúncios etc.). Descritor do PAEBES Não há. na"],"descritores":[]}]},{"codigo":"EM13MAT104","materia_codigo":"matematica","descricao":"Interpretar taxas e índices de natureza socioeconômica (índice de desenvolvimento humano, taxas de inflação, entre outros), investigando os processos de cálculo desses números, para analisar criticamente a realidade e produzir argumentos.","ocorrencias":[{"serie":3,"trimestre":3,"pagina_fonte":30,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Diferenciar taxas, índices e razões em situações contextualizadas.","Identificar as variáveis associadas ao cálculo de um determinado índice, taxa ou coeficiente.","Resolver problemas que envolvam taxas, índices e razões entre duas grandezas de mesma ou de diferentes espécies."],"descritores":[]}]},{"codigo":"EM13MAT201","materia_codigo":"matematica","descricao":"Propor ou participar de ações adequadas às demandas da região, preferencialmente para sua comunidade, envolvendo medições e cálculos de perímetro, de área, de volume, de capacidade ou de massa.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":22,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Selecionar as unidades de medida mais adequadas para determinada situação que envolva as grandezas: comprimento (perímetro), massa, capacidade, área e volume.","Realizar medições para diferentes grandezas em contextos relacionados à saúde, à sustentabilidade, às implicações da tecnologia no mundo do trabalho, entre outros.","Decompor, quando possível, figuras planas em triângulos, quadriláteros ou polígonos regulares para facilitar o cálculo da área.","Calcular volume de um sólido a partir da decomposição em sólidos geométricos para os quais são conhecidas relações de cálculo de volume.","Utilizar artefatos computacionais para planejar e gerenciar projetos (por exemplo, recursos para gestão de cronogramas e equipes, espaços compartilhados para armazenamento de arquivos, uso de ferramentas para videoconferência, artefatos para discussão assíncrona, ferramentas para gestão de dados etc). ■ descritor: ▼Abaixo do básico, Básico, ◆ Proficiente e ★ Avançado."],"descritores":[]}]},{"codigo":"EM13MAT202","materia_codigo":"matematica","descricao":"Planejar e executar pesquisa amostral sobre questões relevantes, usando dados coletados diretamente ou em diferentes fontes, e comunicar os resultados por meio de relatório contendo gráficos e interpretação das medidas de tendência central e das medidas de dispersão (amplitude e desvio padrão), utilizando ou não recursos tecnológicos. (EF09MA25/ES) Reconhecer as razões trigonométricas (seno, cosseno e tangente) e aplicá-las nos cálculos de distâncias inacessíveis e outras situações problemas utilizando instrumento de medidas de comprimento, transferidores, compasso, teodolitos e softwares.","ocorrencias":[{"serie":3,"trimestre":3,"pagina_fonte":30,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Descrever as etapas de uma pesquisa estatística.","Planejar e realizar pesquisa estatística censitária ou amostral.","Reconhecer a relação de semelhança entre triângulos retângulos que possuem ângulos agudos correspondentes congruentes.","Definir seno no triângulo retângulo.","Definir cosseno no triângulo retângulo.","Definir tangente no triângulo retângulo. ■ descritor: ▼Abaixo do básico, Básico, ◆ Proficiente e ★ Avançado."],"descritores":[{"codigo":"D051_M","descricao":"Resolver problema que envolva razões trigonométricas no triângulo retângulo (seno, cosseno, tangente)."}]}]},{"codigo":"EM13MAT301","materia_codigo":"matematica","descricao":"Resolver e elaborar problemas do cotidiano, da Matemática e de outras áreas do conhecimento, que envolvem equações lineares simultâneas, usando técnicas algébricas e gráficas, com ou sem apoio de tecnologias digitais.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":23,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Identificar equações lineares e suas características, como incógnitas, coeficientes e termos independentes.","Compreender o conceito de sistema de equações lineares.","Resolver sistemas lineares utilizando métodos algébricos, como substituição e adição.","Resolver graficamente sistemas lineares 2x2 com solução única, infinitas soluções ou sem solução.","Associar uma matriz a um sistema linear.","Resolver um sistema linear por meio do escalonamento.","Resolver problemas que envolvem sistemas lineares. ■ descritor: ▼Abaixo do básico, Básico, ◆ Proficiente e ★ Avançado."],"descritores":[{"codigo":"D127_M","descricao":"Relacionar a determinação do ponto de intersecção de duas ou mais retas com a resolução de um sistema de equações com duas incógnitas."},{"codigo":"D157_M","descricao":"Determinar a solução de um sistema linear associando-o a uma matriz."}]},{"serie":3,"trimestre":3,"pagina_fonte":29,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Identificar equações lineares e suas características, como incógnitas, coeficientes e termos independentes.","Compreender o conceito de sistema de equações lineares.","Resolver sistemas lineares utilizando métodos algébricos, como substituição e adição.","Resolver graficamente sistemas lineares 2x2 com solução única, infinitas soluções ou sem solução.","Associar uma matriz a um sistema linear.","Resolver um sistema linear por meio do escalonamento.","Resolver problemas que envolvem sistemas lineares. ■ descritor: ▼Abaixo do básico, Básico, ◆ Proficiente e ★ Avançado."],"descritores":[{"codigo":"D127_M","descricao":"Relacionar a determinação do ponto de intersecção de duas ou mais retas com a resolução de um sistema de equações com duas incógnitas."},{"codigo":"D157_M","descricao":"Determinar a solução de um sistema linear associando-o a uma matriz."}]}]},{"codigo":"EM13MAT302","materia_codigo":"matematica","descricao":"Construir modelos empregando as funções polinomiais de 1º ou 2º graus, para resolver problemas em contextos diversos, com ou sem apoio de tecnologias digitais.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":13,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Modelar situações em contextos diversos por funções polinomiais do 1º grau, da linguagem verbal para a linguagem algébrica e geométrica e vice- versa.","Resolver situações-problema envolvendo funções polinomiais do 1º grau.","Modelar situações em contextos diversos por funções polinomiais do 2º grau, da linguagem verbal para a linguagem algébrica e geométrica e vice- versa.","Resolver situações-problema envolvendo funções polinomiais do 2º grau, inclusive as que envolvem cálculo de pontos de máximo ou mínimo de funções quadráticas.","Resolver problemas envolvendo funções do 2º grau por meio da reutilização de soluções existentes (traçado do gráfico, determinação de pontos e de valores de máximo ou mínimo). descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":35,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Interpretar situações que envolvem proporcionalidade direta em contextos matemáticos e em outras áreas do conhecimento, expressando algebricamente essa relação por meio de uma função linear.","Construir gráficos de funções polinomiais do 1º a partir de translações e reflexões aplicadas em funções elementares [f(x) = ax] com ou sem o uso de softwares.","Modelar situações em contextos diversos por funções polinomiais do 1º grau, da linguagem verbal para a linguagem algébrica e geométrica e vice-versa. ■ descritor: ▼Abaixo do básico, Básico, ◆ Proficiente e ★ Avançado."],"descritores":[]}]},{"codigo":"EM13MAT304","materia_codigo":"matematica","descricao":"Resolver e elaborar problemas com Funções Exponenciais nos quais seja necessário compreender e interpretar a variação das grandezas envolvidas, em contextos como o da Matemática Financeira, entre outros.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Funções Exponenciais.","Variação exponencial entre grandezas.","Noções de Matemática Financeira. 1ª"],"expectativas":["Identificar e definir a função exponencial e características, como a base, o expoente comportamento de crescimento ou decrescimento. em •Reconhecer situações, em diferentes contextos práticos, que possuem crescimento ou decrescimento que podem ser modelados por uma função exponencial.","Construir e interpretar gráficos de funções exponenciais.","Analisar o crescimento ou decrescimento exponencial no gráfico, compreendendo como mudanças parâmetros da função (como a base) impactam curva.","Resolver problemas envolvendo funções exponenciais em diferentes contextos, tais como crescimento populacional, decaimento radioativo, juros compostos etc. Descritor do PAEBES D074_M Corresponder as representações algébrica gráfica de uma função exponencial. D088_M Utilizar função exponencial na resolução problemas."],"descritores":[{"codigo":"D074_M","descricao":"Corresponder as representações algébrica gráfica de uma função exponencial."},{"codigo":"D088_M","descricao":"Utilizar função exponencial na resolução problemas."}]},{"serie":3,"trimestre":2,"pagina_fonte":32,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Identificar e definir a função exponencial e suas características, como a base, o expoente e o comportamento de crescimento ou decrescimento.","Reconhecer situações, em diferentes contextos práticos, que possuem crescimento ou decrescimento que podem ser modelados por uma função exponencial.","Construir e interpretar gráficos de funções exponenciais.","Resolver problemas envolvendo funções exponenciais em diferentes contextos, tais como crescimento populacional e decaimento radioativo. descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[{"codigo":"D074_M","descricao":"Corresponder as representações algébrica e gráfica de uma função exponencial."},{"codigo":"D088_M","descricao":"Utilizar função exponencial na resolução de problemas."}]}]},{"codigo":"EM13MAT305","materia_codigo":"matematica","descricao":"Resolver e elaborar problemas com funções logarítmicas nos quais seja necessário compreender e interpretar a variação das grandezas envolvidas, em contextos como os de abalos sísmicos, pH, radioatividade, Matemática Financeira, entre outros.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":27,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Logaritmo.","Função Logarítmica.","Variação entre grandezas: relação entre variação exponencial e logarítmica. 1ª"],"expectativas":["Definir logaritmo como operação matemática determina o expoente de uma potenciação a partir a base e da potência obtida.","Expressar a relação entre potenciação e logaritmo números reais.","Resolver situações-problema em que é necessário cálculo de um logaritmo ou o uso de propriedade(s) logaritmo.","Identificar e descrever as principais características funções logarítmicas, incluindo base, domínio, imagem e comportamento de crescimento.","Construir e interpretar gráficos de funções logarítmicas, reconhecendo como alterações na base e parâmetros impactam a forma da curva.","Resolver problemas envolvendo funções logarítmicas em contextos como os de abalos sísmicos, radioatividade, Matemática Financeira, entre outros. Descritor do PAEBES Não há."],"descritores":[]}]},{"codigo":"EM13MAT306","materia_codigo":"matematica","descricao":"Resolver e elaborar problemas em contextos que envolvem fenômenos periódicos reais (ondas sonoras, fases da lua, movimentos cíclicos, entre outros) e comparar suas representações com as funções seno e cosseno, no plano cartesiano, com ou sem","ocorrencias":[{"serie":3,"trimestre":3,"pagina_fonte":31,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Identificar arcos na circunferência trigonométrica.","Associar a um arco na circunferência trigonométrica uma medida angular.","Escrever a medida angular de um arco na circunferência trigonométrica em graus ou em radianos. em alinhamento com a habilidade EF09MA25/ES será a trigonometria é apresentada no descritor D051_M. Entretanto, entendemos que ela tem ■ descritor: ▼Abaixo do básico, Básico, ◆ Proficiente e ★ Avançado."],"descritores":[{"codigo":"D126_M","descricao":"Identificar gráficos de funções trigonométricas (seno, cosseno, tangente) reconhecendo suas propriedades."}]}]},{"codigo":"EM13MAT307","materia_codigo":"matematica","descricao":"Empregar diferentes métodos para a obtenção da medida da área de uma superfície (reconfigurações, aproximação por cortes etc.) e deduzir expressões de cálculo para aplicá-las em situações reais (como o remanejamento e a distribuição de plantações, entre outros), com ou sem apoio de tecnologias digitais.","ocorrencias":[{"serie":2,"trimestre":2,"pagina_fonte":17,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Compreender o conceito de área de figuras bidimensionais.","Calcular a área de figurais poligonais.","Calcular a área de círculos, semicírculos, setores e coroas circulares.","Utilizar área de figuras bidimensionais na resolução de problema. descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[{"codigo":"D058_M","descricao":"Utilizar área de figuras bidimensionais na resolução de problema."}]},{"serie":3,"trimestre":2,"pagina_fonte":29,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Compreender o conceito de área de figuras bidimensionais.","Calcular a área de figurais poligonais.","Calcular a área de círculos, semicírculos, setores e coroas circulares.","Utilizar área de figuras bidimensionais na resolução de problema. descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[{"codigo":"D058_M","descricao":"Utilizar área de figuras bidimensionais na resolução de problema."}]},{"serie":1,"trimestre":3,"pagina_fonte":11,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Compreender o conceito de área de figuras bidimensionais.","Calcular a área de figurais poligonais.","Calcular a área de círculos, semicírculos, setores e coroas circulares.","Utilizar área de figuras bidimensionais na resolução de problema. ■ descritor: ▼Abaixo do básico, Básico, ◆ Proficiente e ★ Avançado."],"descritores":[{"codigo":"D058_M","descricao":"Utilizar área de figuras bidimensionais na resolução de problema."}]}]},{"codigo":"EM13MAT308","materia_codigo":"matematica","descricao":"Aplicar as relações métricas, incluindo as leis do seno e do cosseno ou as noções de congruência e semelhança, para resolver e elaborar problemas que envolvem triângulos, em variados contextos.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Semelhança entre triângulos (por transformações geométricas homotéticas). 1ª"],"expectativas":["Reconhecer relações de semelhança do triângulos, usando critérios como a congruência e de ângulos correspondentes nos dois triângulos que ou a proporcionalidade entre medidas de correspondentes.","Deduzir experimentalmente as relações métricas triângulo retângulo (inclusive o Teorema de Pitágoras) partir de relações de semelhança de triângulos.","Utilizar as relações métricas no triângulo retângulo (inclusive o Teorema de Pitágoras) na resolução problemas. Descritor do PAEBES D049_M Utilizar relações métricas em um triângulo retângulo na resolução de problemas. D119_M Identificar triângulos semelhantes mediante reconhecimento de relações de proporcionalidade."],"descritores":[{"codigo":"D049_M","descricao":"Utilizar relações métricas em um triângulo retângulo na resolução de problemas."},{"codigo":"D119_M","descricao":"Identificar triângulos semelhantes mediante reconhecimento de relações de proporcionalidade."}]},{"serie":1,"trimestre":3,"pagina_fonte":15,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Reconhecer relações de semelhança entre triângulos, usando critérios como a congruência de ângulos correspondentes nos dois triângulos ou a proporcionalidade entre medidas de lados correspondentes.","Deduzir experimentalmente as relações métricas no triângulo retângulo (inclusive o Teorema de Pitágoras) a partir de relações de semelhança de triângulos.","Utilizar as relações métricas no triângulo retângulo (inclusive o Teorema de Pitágoras) na resolução de problemas. ■ descritor: ▼Abaixo do básico, Básico, ◆ Proficiente e ★ Avançado."],"descritores":[{"codigo":"D119_M","descricao":"Identificar triângulos semelhantes mediante o reconhecimento de relações de proporcionalidade."}]}]},{"codigo":"EM13MAT309","materia_codigo":"matematica","descricao":"Resolver e elaborar problemas que envolvem o cálculo de áreas totais e de volumes de prismas, pirâmides e corpos redondos em situações reais (como o cálculo do gasto de material para revestimento ou pinturas de objetos cujos formatos sejam composições dos sólidos estudados), com ou sem apoio de tecnologias digitais.","ocorrencias":[{"serie":2,"trimestre":2,"pagina_fonte":21,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Relacionar diferentes poliedros ou corpos redondos com suas planificações ou vistas.","Calcular áreas de prismas, pirâmides e corpos redondos.","Calcular volume de prismas, pirâmides e corpos redondos.","Resolver problema envolvendo a área total e/ou volume de um sólido. descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[{"codigo":"D111_M","descricao":"Relacionar diferentes poliedros ou corpos redondos com suas planificações ou vistas."},{"codigo":"D129_M","descricao":"Resolver problema envolvendo a área total e/ou volume de um sólido."}]},{"serie":3,"trimestre":2,"pagina_fonte":30,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Identificar a relação entre o número de vértices, faces e/ou arestas de poliedros expressa em um problema.","Relacionar diferentes poliedros ou corpos redondos com suas planificações ou vistas.","Calcular áreas de prismas, pirâmides e corpos redondos.","Calcular volume de prismas, pirâmides e corpos redondos.","Resolver problema envolvendo a área total e/ou volume de um sólido. descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[{"codigo":"D125_M","descricao":"Identificar a relação entre o número de vértices, faces e/ou arestas de poliedros expressa em um problema."}]}]},{"codigo":"EM13MAT310","materia_codigo":"matematica","descricao":"Resolver e elaborar problemas de contagem envolvendo agrupamentos ordenáveis ou não de elementos, por meio dos princípios multiplicativo e aditivo, recorrendo a estratégias diversas, como o diagrama de árvore.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":30,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Noções de combinatória: agrupamentos ordenáveis (permutações e arranjos) e não ordenáveis (combinações).","Princípio multiplicativo e princípio aditivo.","Modelos para contagem de dados: diagrama de árvore, listas, esquemas, desenhos etc. 1ª"],"expectativas":["Utilizar diagramas de árvore para organizar possibilidades em problemas de contagem, garantindo por que todos os casos sejam considerados.","Diferenciar e aplicar o princípio multiplicativo (casos em que a escolha de um elemento não interfere escolhas subsequentes) e o princípio aditivo (casos que há escolhas mutuamente exclusivas).","Reconhecer situações que envolvem agrupamentos ordenáveis (permutação, arranjo) compreendendo suas características.","Resolver problemas envolvendo agrupamentos ordenáveis.","Reconhecer situações que envolvem agrupamentos não ordenáveis (combinação) compreendendo características.","Resolver problemas envolvendo agrupamentos ordenáveis. de Descritor do PAEBES D042_M Utilizar o princípio multiplicativo de contagem na resolução de problema."],"descritores":[{"codigo":"D042_M","descricao":"Utilizar o princípio multiplicativo de contagem na resolução de problema."}]},{"serie":2,"trimestre":3,"pagina_fonte":20,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Utilizar diagramas de árvore para organizar as possibilidades em problemas de contagem, garantindo que todos os casos sejam considerados. ■ descritor: ▼Abaixo do básico, Básico, ◆ Proficiente e ★ Avançado."],"descritores":[{"codigo":"D042_M","descricao":"Utilizar o princípio multiplicativo de contagem na resolução de problema."}]}]},{"codigo":"EM13MAT311","materia_codigo":"matematica","descricao":"Identificar e descrever o espaço amostral de eventos aleatórios, realizando contagem das possibilidades, para resolver e elaborar problemas que envolvem o cálculo da probabilidade.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":31,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Noções de probabilidade básica: espaço amostral, evento aleatório (equiprovável).","Contagem de possibilidades.","Cálculo de probabilidades simples.","Eventos dependentes. 1ª"],"expectativas":["Identificar e descrever o espaço amostral de experimento aleatório, realizando contagem possibilidades. o •Identificar e descrever um evento em um experimento aleatório.","Calcular a probabilidade de ocorrência de um evento em um experimento aleatório e expressá-la na forma fração, decimal e percentual.","Calcular a probabilidade da união de dois eventos.","Compreender a noção de dependência de eventos (probabilidade condicional) e calcular probabilidades usando esse conceito.","Resolver situações problema envolvendo probabilidade condicional. Descritor do PAEBES D042_M Utilizar o princípio multiplicativo de contagem na resolução de problema. D065_M Resolver problema envolvendo noções probabilidade."],"descritores":[{"codigo":"D042_M","descricao":"Utilizar o princípio multiplicativo de contagem na resolução de problema."},{"codigo":"D065_M","descricao":"Resolver problema envolvendo noções probabilidade."}]},{"serie":2,"trimestre":3,"pagina_fonte":20,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Identificar e descrever o espaço amostral de um experimento aleatório, realizando contagem das possibilidades.","Identificar e descrever um evento em um experimento aleatório.","Calcular a probabilidade de ocorrência de um evento em um experimento aleatório e expressá-"],"descritores":[{"codigo":"D065_M","descricao":"Resolver problema envolvendo noções de probabilidade."}]}]},{"codigo":"EM13MAT312","materia_codigo":"matematica","descricao":"Resolver e elaborar problemas que envolvem o cálculo de probabilidade de eventos em experimentos aleatórios sucessivos.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":32,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Eventos independentes.","Cálculo de probabilidade de eventos relativos a experimentos aleatórios sucessivos. 1ª"],"expectativas":["Calcular a probabilidade de ocorrência de o determinado evento e expressá-la na forma de fração, decimal e percentual.","Compreender a noção de independência de eventos e calcular probabilidades usando esse conceito.","Resolver situações problema envolvendo probabilidade de eventos independentes e consecutivos. Descritor do PAEBES D065_M Resolver problema envolvendo noções a probabilidade."],"descritores":[{"codigo":"D065_M","descricao":"Resolver problema envolvendo noções a probabilidade."}]},{"serie":2,"trimestre":3,"pagina_fonte":20,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["la na forma de fração, decimal e percentual.","Calcular a probabilidade da união de dois eventos.","Compreender a noção de independência de eventos e calcular probabilidades usando esse conceito.","Resolver situações problema envolvendo probabilidade de eventos independentes e consecutivos."],"descritores":[]}]},{"codigo":"EM13MAT313","materia_codigo":"matematica","descricao":"Utilizar, quando necessário, a notação científica para expressar uma medida, compreendendo as noções de algarismos significativos e algarismos duvidosos, e reconhecendo que toda medida é inevitavelmente acompanhada de erro.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":14,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Notação científica.","Algarismos significativos e técnicas de arredondamento.","Estimativa e comparação de valores em notação científica e em arredondamentos.","Noção de erro em medições. 1ª"],"expectativas":["Reconhecer que a notação científica é uma maneira eficiente de expressar números muito grandes ou muito pequenos em diversos contextos. e •Representar números em diferentes contextos utilizando a notação científica.","Conhecer regras de arredondamento, identificando algarismos significativos e duvidosos.","Representar quantidades não inteiras usando técnicas de arredondamento. Descritor do PAEBES Não há."],"descritores":[]}]},{"codigo":"EM13MAT314","materia_codigo":"matematica","descricao":"Resolver e elaborar problemas que envolvem grandezas determinadas pela razão ou pelo produto de outras (velocidade, densidade demográfica, energia elétrica etc.).","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":17,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Grandezas determinadas pela razão ou produto de outras (velocidade, densidade de um corpo, densidade demográfica, potência elétrica, bytes por segundo etc.).","Variação entre grandezas (proporcionalidade e não proporcionalidade).","Conversão entre unidades compostas. 1ª 2ª"],"expectativas":["Identificar que unidades de medida (velocidade média, densidade de um corpo, densidade demográfica, potência elétrica, aceleração média etc.) são definidas pela divisão e/ou pela multiplicação de outras grandezas de mesma natureza ou não.","Solucionar problemas que envolvem grandezas determinadas pela razão ou produto das medidas outras, como o consumo de energia elétrica de aparelho conhecendo sua potência elétrica e período de funcionamento, ou o tempo necessário para que um dado pacote de dados (em Gigabytes, Megabytes etc.) se esgote conhecendo a velocidade de transferência de dados utilizada (kilobytes segundo, megabytes por segundo etc.). de não Descritor do PAEBES Não há."],"descritores":[]}]},{"codigo":"EM13MAT315","materia_codigo":"matematica","descricao":"Investigar e registrar, por meio de um fluxograma, quando possível, um algoritmo que resolve um problema.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":22,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Noções básicas de Matemática Computacional. Algoritmos e sua representação por fluxogramas. 1ª"],"expectativas":["Resolver problemas envolvendo função apresentada algébrica ou graficamente.","Registrar por meio de fluxograma um algoritmo resolve problema envolvendo função afim.","Resolver problemas envolvendo função afim por da reutilização de soluções existentes (traçado gráfico, determinação de pontos e de valores). Descritor do PAEBES Não há."],"descritores":[]}]},{"codigo":"EM13MAT316","materia_codigo":"matematica","descricao":"Resolver e elaborar problemas, em diferentes contextos, que envolvem cálculo e interpretação das medidas de tendência central (média, moda, mediana) e das medidas de dispersão (amplitude, variância e desvio padrão).","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":34,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Medidas de tendência central: média, moda e mediana.","Medidas de dispersão: amplitude, variância e desvio padrão. 1ª"],"expectativas":["Construir e interpretar tabelas de frequências dados agrupados em classes.","Determinar média, moda e mediana de um conjunto das de dados.","Determinar média, moda e mediana a partir de tabela de frequências com dados agrupados em classes.","Identificar entre as medidas de tendência central (média, moda e mediana) a mais adequada de acordo com a característica desejada.","Resolver situações-problema envolvendo medidas tendência central.","Determinar amplitude, variância e desvio padrão um conjunto de dados.","Calcular o desvio-padrão de conjuntos de dados distintos com o auxílio de uma planilha eletrônica, contextos diversos.","Relacionar as medidas de tendência central (média, e moda e mediana) com as medidas de dispersão (amplitude, desvio-padrão ou coeficiente de variação) em uma série de dados.","Resolver situações-problema envolvendo medidas tendência central ou medidas de dispersão. Descritor do PAEBES D066_M Utilizar medidas de tendência central resolução de problemas."],"descritores":[{"codigo":"D066_M","descricao":"Utilizar medidas de tendência central resolução de problemas."}]}]},{"codigo":"EM13MAT401","materia_codigo":"matematica","descricao":"Converter representações algébricas de funções polinomiais de 1º grau em representações geométricas no plano cartesiano, distinguindo os casos nos quais o comportamento é proporcional, recorrendo ou não a softwares ou aplicativos de álgebra e geometria dinâmica.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":21,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Funções afins, lineares, constantes.","Gráficos de funções a partir de transformações no plano.","Proporcionalidade: estudo do crescimento e variação de funções.","Estudo da variação de funções polinomiais de 1º grau: crescimento, decrescimento, taxa de variação da função. 1ª"],"expectativas":["Investigar gráficos de funções polinomiais do 1º a partir de translações e reflexões aplicadas na função elementar [f(x) = a.x]. o •Interpretar situações descritas por função não apresentada algébrica ou graficamente.","Expressar graficamente regularidades em relações apresentam variação constante entre duas grandezas. no Descritor do PAEBES D071_M Analisar crescimento/ decrescimento, zeros funções reais apresentadas em gráficos. 1º D078_M Corresponder uma função polinomial do grau a seu gráfico."],"descritores":[{"codigo":"D071_M","descricao":"Analisar crescimento/ decrescimento, zeros funções reais apresentadas em gráficos."},{"codigo":"D078_M","descricao":"Corresponder uma função polinomial do grau a seu gráfico."}]},{"serie":1,"trimestre":2,"pagina_fonte":7,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Reconhecer as coordenadas de pontos representados num plano cartesiano localizados em quadrantes diferentes do primeiro.","Reconhecer o gráfico de uma função polinomial de primeiro grau por meio de seus coeficientes. descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[{"codigo":"D043_M","descricao":"Identificar a localização de pontos no plano cartesiano."}]},{"serie":3,"trimestre":2,"pagina_fonte":25,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Identificar uma função afim.","Calcular o valor da função para um elemento do domínio.","Construir gráfico de função afim.","Identificar e calcular zero da função afim.","Identificar e calcular a intersecção do gráfico da função afim com o eixo y.","Corresponder uma função polinomial do 1º grau a seu gráfico."],"descritores":[{"codigo":"D071_M","descricao":"Analisar crescimento/decrescimento, zeros de funções reais apresentadas em gráficos."}]}]},{"codigo":"EM13MAT402","materia_codigo":"matematica","descricao":"Converter representações algébricas de funções polinomiais de 2º grau em representações geométricas no plano cartesiano, distinguindo os casos nos quais uma variável for diretamente proporcional ao quadrado da outra, recorrendo ou não a softwares ou aplicativos de álgebra e geometria dinâmica, entre outros materiais.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":11,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Representar graficamente funções do 2º grau com base em sua forma algébrica, identificando o vértice da parábola, o eixo de simetria dessa curva, bem como os pontos de interseção com os eixos x e y, quando existirem.","Identificar a forma geral de uma função quadrática (y=ax²+bx+c) e a relação dos coeficientes a, b e c com a parábola do gráfico.","Identificar o comportamento da função quadrática: intervalos de crescimento ou decrescimento e zero(s) da função."],"descritores":[{"codigo":"D071_M","descricao":"Analisar crescimento/decrescimento, zeros de funções reais apresentadas em gráficos."}]},{"serie":3,"trimestre":2,"pagina_fonte":25,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Analisar crescimento/decrescimento e zero de função afim apresentadas em gráficos.","Representar graficamente funções do 2º grau com base em sua forma algébrica, identificando o vértice da parábola, o eixo de simetria dessa curva, bem como os pontos de interseção com os eixos x e y, quando existirem.","Identificar a forma geral de uma função quadrática (y=ax²+bx+c) e a relação dos coeficientes a, b e c com a parábola do gráfico. descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[{"codigo":"D076_M","descricao":"Corresponder um polinômio fatorado por meio de polinômios de 1º grau às suas raízes."},{"codigo":"D078_M","descricao":"Corresponder uma função polinomial do 1º grau a seu gráfico."}]}]},{"codigo":"EM13MAT403","materia_codigo":"matematica","descricao":"Analisar e estabelecer relações, com ou sem apoio de tecnologias digitais, entre as representações de funções exponencial e logarítmica expressas em tabelas e em plano cartesiano, para identificar as características fundamentais (domínio, imagem, crescimento) de cada função.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":28,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Funções Exponencial e Logarítmica.","Gráfico de funções a partir de transformações no plano.","Estudo do crescimento e análise do comportamento das funções exponenciais e logarítmica em intervalos numéricos. 1ª"],"expectativas":["Construir tabelas de valores para funções exponenciais de e logarítmicas, explorando o comportamento numérico de cada uma. em •Comparar, com ou sem auxílio de software, gráficos de uma função exponencial e sua respectiva inversa de (função logarítmica), expressando a relação potenciação e logaritmo de números reais de mesma base.","Identificar e descrever os conceitos de domínio, imagem e crescimento em funções exponenciais logarítmicas. no Descritor do PAEBES D088_M Utilizar função exponencial na resolução problemas. D080_M Identificar a representação algébrica gráfica de uma função logarítmica, reconhecendo-a como inversa da função exponencial."],"descritores":[{"codigo":"D088_M","descricao":"Utilizar função exponencial na resolução problemas."},{"codigo":"D080_M","descricao":"Identificar a representação algébrica gráfica de uma função logarítmica, reconhecendo-a como inversa da função exponencial."}]}]},{"codigo":"EM13MAT404","materia_codigo":"matematica","descricao":"Analisar funções definidas por uma ou mais sentenças (tabela do Imposto de Renda, contas de luz, água, gás etc.), em suas representações algébrica e gráfica, identificando domínios de validade, imagem, crescimento e decrescimento, e convertendo essas representações de uma para outra, com ou sem apoio de tecnologias digitais.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":12,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Reconhecer situações práticas que podem ser modeladas por funções definidas por partes, como tabelas de tarifas progressivas ou descontos condicionais.","Identificar funções definidas por mais de uma sentença algébrica e compreender o conceito de domínios de validade para cada sentença.","Representar graficamente funções definidas por partes, respeitando os domínios de validade e identificando possíveis descontinuidades ou mudanças de comportamento.","Analisar o crescimento, decrescimento e pontos críticos da função, com base no gráfico.","Converter a representação algébrica de funções definidas por partes em sua forma gráfica e vice- versa.","Interpretar o significado das diferentes partes da função em relação às variáveis envolvidas no contexto.","Resolver problemas envolvendo funções definidas por partes, como cálculo de tarifas progressivas, impostos e contas de consumo.","Utilizar ferramentas digitais para representar e analisar graficamente funções definidas por partes de forma dinâmica. descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[{"codigo":"D082_M","descricao":"Identificar o gráfico que representa uma situação descrita em um texto."}]},{"serie":2,"trimestre":2,"pagina_fonte":19,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Reconhecer situações práticas que podem ser modeladas por funções definidas por partes, como tabelas de tarifas progressivas ou descontos condicionais.","Identificar funções definidas por mais de uma sentença algébrica e compreender o conceito de domínios de validade para cada sentença.","Representar graficamente funções definidas por partes, respeitando os domínios de validade e descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[]}]},{"codigo":"EM13MAT406","materia_codigo":"matematica","descricao":"Construir e interpretar tabelas e gráficos de frequências com base em dados obtidos em pesquisas por amostras estatísticas, incluindo ou não o uso de softwares que inter-relacionem estatística, geometria e álgebra.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":33,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Gráficos e diagramas estatísticos: histogramas, polígonos de frequências.","Medidas de tendência central 1ª"],"expectativas":["Construir e interpretar tabelas de frequências a de dados apresentados.","Construir e interpretar gráficos de frequências a que de dados apresentados.","Determinar média, moda e mediana de um conjunto de dados.","Utilizar recursos digitais para fazer sínteses e correlações entre ideias, como, por exemplo, representar relatório de pesquisa em um infográfico. Descritor do PAEBES D064_M Utilizar informações apresentadas em tabelas ou gráficos na resolução de problemas."],"descritores":[{"codigo":"D064_M","descricao":"Utilizar informações apresentadas em tabelas ou gráficos na resolução de problemas."}]}]},{"codigo":"EM13MAT501","materia_codigo":"matematica","descricao":"Investigar relações entre números expressos em tabelas para representá-los no plano cartesiano, identificando padrões e criando conjecturas para generalizar e expressar algebricamente essa generalização, reconhecendo quando essa representação é de função polinomial de 1º grau.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":20,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Funções polinomiais do 1º grau (função afim, função linear, função constante, função identidade).","Gráficos de funções.","Taxa de variação de funções polinomiais do 1º grau. 1ª"],"expectativas":["Identificar regularidades em relações que apresentam variação constante entre duas grandezas.","Generalizar e expressar algebricamente regularidades em relações que apresentam variação constante duas grandezas. de •Concluir que a taxa de crescimento de uma função afim é constante.","Expressar graficamente regularidades em relações apresentam variação constante entre duas grandezas. Descritor do PAEBES D086_M Reconhecer expressão algébrica representa uma função a partir de uma tabela."],"descritores":[{"codigo":"D086_M","descricao":"Reconhecer expressão algébrica representa uma função a partir de uma tabela."}]},{"serie":1,"trimestre":2,"pagina_fonte":7,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Resolver problemas envolvendo equação do 1º grau.","Resolver problema envolvendo uma função do 1º grau."],"descritores":[{"codigo":"D132_M","descricao":"Resolver problema envolvendo uma função do 1º grau."}]}]},{"codigo":"EM13MAT502","materia_codigo":"matematica","descricao":"Investigar relações entre números expressos em tabelas para representá-los no plano cartesiano, identificando padrões e criando conjecturas para generalizar e expressar algebricamente essa generalização, reconhecendo quando essa representação é de função polinomial de 2º grau do tipo y = ax².","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":10,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Analisar conjuntos de dados numéricos organizados em tabelas, observando a relação entre as duas variáveis.","Identificar padrões de variação de uma variável conforme a outra muda, descrevendo algebricamente esses padrões.","Verificar se uma relação expressa em tabela representa uma função polinomial do 2º grau do tipo y=ax².","Reconhecer casos em que y é diretamente proporcional ao quadrado de x, como y=ax², e compreender o significado dessa relação.","Resolver problemas contextualizados que possam ser modelados por funções do tipo y=ax². descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[]},{"serie":2,"trimestre":2,"pagina_fonte":19,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Analisar conjuntos de dados numéricos organizados em tabelas, observando a relação entre as duas variáveis.","Identificar padrões de variação de uma variável conforme a outra muda, descrevendo algebricamente esses padrões.","Identificar a forma geral de uma função quadrática: y=ax²+bx+c","Reconhecer os zeros de uma função quadrática dada graficamente.","Avaliar o comportamento de uma função quadrática representada graficamente, quanto ao seu crescimento ou decrescimento.","Determinar os zeros de uma função quadrática, a partir de sua lei de formação."],"descritores":[{"codigo":"D071_M","descricao":"Analisar crescimento/decrescimento, zeros de funções reais apresentadas em gráficos."}]}]},{"codigo":"EM13MAT503","materia_codigo":"matematica","descricao":"Investigar pontos de máximo ou de mínimo de funções quadráticas em contextos envolvendo superfícies, Matemática Financeira ou Cinemática, entre outros, com apoio de tecnologias digitais.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":11,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Reconhecer o ponto de máximo ou mínimo de uma função quadrática como o vértice da parábola, compreendendo sua localização em relação ao gráfico.","Determinar a coordenada x (abscissa) do vértice de parábola que representa uma função quadrática, com ou sem uso de fórmula.","Determinar a coordenada y (ordenada) do vértice de parábola que representa uma função quadrática, com ou sem uso de fórmula.","Resolver problemas envolvendo pontos de máximo ou pontos de mínimo de funções quadráticas em diferentes contextos. descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[{"codigo":"D133_M","descricao":"Resolver problemas que envolvam os pontos de máximo ou de mínimo de uma função do 2º grau."}]}]},{"codigo":"EM13MAT504","materia_codigo":"matematica","descricao":"Investigar processos de obtenção da medida do volume de prismas, pirâmides, cilindros e cones, incluindo o princípio de Cavalieri, para a obtenção das fórmulas de cálculo da medida do volume dessas figuras.","ocorrencias":[{"serie":2,"trimestre":2,"pagina_fonte":20,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Compreender que o volume de um sólido é a medida da quantidade de espaço que esse sólido ocupa, utilizando uma unidade de medida de volume.","Calcular o volume de um paralelepípedo.","Utilizar o princípio de Cavalieri para determinar uma relação para o cálculo do volume de prisma, a partir do volume de paralelepípedo.","Reconhecer que duas pirâmides de mesma altura e mesma área da base possuem o mesmo volume.","Determinar uma relação para o cálculo do volume de pirâmide a partir do volume de prisma. descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[]}]},{"codigo":"EM13MAT506","materia_codigo":"matematica","descricao":"Representar graficamente a variação da área e do perímetro de um polígono regular quando os comprimentos de seus lados variam, analisando e classificando as funções envolvidas. (EF05MA16/ES) Associar figuras espaciais a suas planificações (prismas, pirâmides, cilindros e cones) e analisar, nomear e comparar seus atributos utilizando recursos manipuláveis e digitais.","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":13,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Reconhecer que o perímetro de um polígono regular é proporcional ao comprimento de seus lados, sendo calculado pela fórmula P=n⋅l onde n é o número de lados e l, a medida de cada lado.","Compreender que a área de um polígono regular pode ser expressa como uma função do comprimento do lado, considerando a relação com o apótema.","Relacionar diferentes poliedros ou corpos redondos com suas planificações ou vistas. ■ descritor: ▼Abaixo do básico, Básico, ◆ Proficiente e ★ Avançado."],"descritores":[{"codigo":"D111_M","descricao":"Relacionar diferentes poliedros ou corpos redondos com suas planificações ou vistas."}]},{"serie":3,"trimestre":3,"pagina_fonte":34,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Explorar diferentes valores do comprimento do lado de um polígono regular, registrando as variações no perímetro e na área em tabelas e gráficos. ■ descritor: ▼Abaixo do básico, Básico, ◆ Proficiente e ★ Avançado."],"descritores":[]}]},{"codigo":"EM13MAT507","materia_codigo":"matematica","descricao":"Identificar e associar progressões aritméticas (PA) a funções afins de domínios discretos, para análise de propriedades, dedução de algumas fórmulas e resolução de problemas. EF06MA29 Analisar e descrever mudanças que ocorrem no perímetro e na área de um quadrado ao se ampliarem ou reduzirem, igualmente, as medidas de seus lados, para compreender que o perímetro é proporcional à medida do lado, o que não ocorre com a área.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":9,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Identificar a regularidade em uma sequência, seja ela apresentada por uma sequência de figuras ou números que recursivamente aumentam/diminuem em um valor constante, ou seja, uma Progressão Aritmética.","Identificar a regularidade que permite a dedução do Termo Geral de Uma Progressão Aritmética.","Associar os termos de uma progressão aritmética (PA) aos valores de uma função afim de mesmo domínio que a progressão.","Identificar a regularidade que permite a dedução da fórmula para cálculo da Soma dos Termos de uma Progressão Aritmética finita.","Utilizar propriedades de progressões aritméticas na resolução de problemas.","Inferir uma equação polinomial de 2º grau que modela um problema.","Resolver problemas que possam ser representados por equações polinomiais de 2º grau, utilizando inclusive os produtos notáveis e os processos de fatoração. descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[{"codigo":"D096_M","descricao":"Utilizar propriedades de progressões aritméticas na resolução de problemas."},{"codigo":"D087_M","descricao":"Resolver problema envolvendo equação do 2º grau."},{"codigo":"D076_M","descricao":"Corresponder um polinômio fatorado por meio de polinômios de 1º grau às suas raízes."}]},{"serie":3,"trimestre":2,"pagina_fonte":27,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Identificar a regularidade em uma sequência, seja ela apresentada por uma sequência de figuras ou números que recursivamente aumentam/diminuem em um valor constante, ou seja, uma Progressão Aritmética.","Identificar a regularidade que permite a dedução do Termo Geral de Uma Progressão Aritmética.","Associar os termos de uma progressão aritmética (PA) aos valores de uma função afim de mesmo domínio que a progressão.","Resolver problemas envolvendo Progressões Aritméticas.","Identificar a regularidade que permite a dedução da fórmula para cálculo da Soma dos Termos de uma Progressão Aritmética finita.","Compreender o conceito de perímetro de figuras bidimensionais.","Calcular o perímetro de um polígono.","Calcular o comprimento de uma circunferência.","Utilizar o perímetro de uma figura bidimensional na resolução de problema. descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[{"codigo":"D096_M","descricao":"Utilizar propriedades de progressões aritméticas na resolução de problemas."},{"codigo":"D057_M","descricao":"Utilizar o perímetro de uma figura bidimensional na resolução de problema."}]}]},{"codigo":"EM13MAT508","materia_codigo":"matematica","descricao":"Identificar e associar Progressões Geométricas (PG) a Funções Exponenciais de domínios discretos, para análise de propriedades, dedução de algumas fórmulas e resolução de problemas.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":26,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf","unidade_tematica":"","objetos":["Funções Exponenciais.","Progressões Geométricas (P.G.)."],"expectativas":["Identificar a regularidade existente em sequências numéricas ou de figuras, em que, por recursão, cada termo a partir do segundo é obtido pelo produto anterior por um fator constante.","Identificar a regularidade que permite a dedução Termo Geral de Uma Progressão Geométrica.","Corresponder os termos de uma Progressão Geométrica à expressão de uma função exponencial.","Resolver problemas envolvendo Progressões Geométricas.","Resolver problemas envolvendo soma dos termos Progressões Geométricas. Descritor do PAEBES D097_M Utilizar propriedades de progressões geométricas na resolução de problemas."],"descritores":[{"codigo":"D097_M","descricao":"Utilizar propriedades de progressões geométricas na resolução de problemas."}]},{"serie":3,"trimestre":2,"pagina_fonte":33,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Identificar a regularidade existente em sequências numéricas ou de figuras, em que, por recursão, cada termo a partir do segundo é obtido pelo produto do anterior por um fator constante.","Identificar a regularidade que permite a dedução do Termo Geral de Uma Progressão Geométrica.","Corresponder os termos de uma Progressão Geométrica à expressão de uma função exponencial.","Resolver problemas envolvendo Progressões Geométricas.","Resolver problemas envolvendo soma dos termos de Progressões Geométricas. descritor: Abaixo do básico, Básico, Proficiente e Avançado."],"descritores":[{"codigo":"D097_M","descricao":"Utilizar propriedades de progressões geométricas na resolução de problemas."}]}]},{"codigo":"EM13MAT510","materia_codigo":"matematica","descricao":"Investigar conjuntos de dados relativos ao comportamento de duas variáveis numéricas, usando ou não tecnologias da informação, e, quando apropriado, levar em conta a variação e utilizar uma reta para descrever a relação observada.","ocorrencias":[{"serie":3,"trimestre":3,"pagina_fonte":26,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf","unidade_tematica":"","objetos":[],"expectativas":["Localizar pontos em um sistema de coordenadas cartesianas.","Reconhecer as coordenadas de pontos representados em um plano cartesiano","Definir a equação de uma reta (forma geral e forma reduzida).","Calcular o coeficiente angular de uma reta a partir de dois pontos conhecidos, entendendo a sua relação com a variação de y e a variação de x.","Interpretar o coeficiente angular no gráfico de uma reta, entendendo sua relação com a inclinação da reta em relação ao eixo x.","Relacionar alterações no coeficiente linear ao deslocamento vertical da reta no gráfico, mantendo a inclinação constante.","Determinar a inclinação ou coeficiente angular de retas a partir de suas equações.","Determinar a equação de uma reta a partir de dois de seus pontos. ■ descritor: ▼Abaixo do básico, Básico, ◆ Proficiente e ★ Avançado."],"descritores":[{"codigo":"D043_M","descricao":"Identificar a localização de pontos no plano cartesiano."}]}]},{"codigo":"EM13LP01","materia_codigo":"portugues","descricao":"Relacionar o texto, tanto na produção como na leitura/ escuta, com suas condições de produção e seu contexto A sócio-histórico de circulação (leitor/audiência previstos, objetivos, pontos de vista e perspectivas, papel social do autor, época, gênero do discurso etc.), de forma a ampliar as possibilidades de construção de sentidos e de análise crítica e produzir textos adequados a diferentes situações.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Reconstrução das condições de produção de textos;","Contexto sócio-histórico de produção e circulação de textos e práticas relacionadas à defesa de direitos e à participação social."],"expectativas":["Analisar o contexto de produção de obras pré-modernistas.","Ler e compreender textos adequados ao contexto modernista. do as"],"descritores":[{"codigo":"D021_P","descricao":"Localizar informações explícitas em um texto."},{"codigo":"D024_P","descricao":"Identificar efeitos de ironia ou humor em textos variados."},{"codigo":"D062_P","descricao":"Identificar discursos que contribuíram para a formação da identidade nacional em textos da literatura brasileira."},{"codigo":"D043_P","descricao":"Reconhecer o efeito de sentido decorrente da exploração de recursos estilísticos."},{"codigo":"D057_P","descricao":"Interpretar texto com auxílio de material gráfico diverso (propagandas, quadrinhos, foto"},{"codigo":"D023_P","descricao":"Inferir uma informação implícita em um texto."},{"codigo":"D019_P","descricao":"Reconhecer diferentes formas de tratar informação na comparação de textos que tratam do mesmo tema, em função das condições em do ele foi produzido e daquelas em que será recebido."},{"codigo":"D016_P","descricao":"Identificar a finalidade de textos de diferentes gêneros."},{"codigo":"D033_P","descricao":"Reconhecer posições distintas entre duas ou opiniões relativas ao mesmo fato ou ao mesmo"},{"codigo":"D038_P","descricao":"Distinguir um fato da opinião relativa a esse fato."}]},{"serie":1,"trimestre":2,"pagina_fonte":4,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["o contexto de produção EM13CO15 Analisar a diferentes gêneros, em interação entre campos de atuação, na usuários e artefatos computacionais, abordando aspectos da experiência do usuário e promovendo reflexão sobre a qualidade do uso dos artefatos nas esferas do trabalho, do lazer e do estudo."],"descritores":[{"codigo":"D023_P","descricao":"Inferir informações em textos."}]},{"serie":2,"trimestre":2,"pagina_fonte":11,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["Analisar o contexto de EM13CO15 Analisar de diferentes interação entre usuários em diferentes campos artefatos computacionais, atuação, na abordando aspectos experiência do usuário Produzir textos adequados a promovendo reflexão situações e qualidade do uso dos artefatos nas esferas do trabalho, lazer e do estudo."],"descritores":[{"codigo":"D016_P","descricao":"Identificar a finalidade de textos de diferentes gêneros."},{"codigo":"D019_P","descricao":"Reconhecer formas de tratar uma informação na comparação de textos que tratam do mesmo tema."}]},{"serie":1,"trimestre":3,"pagina_fonte":4,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["o contexto de produção EM13CO15 Analisar a gêneros, em interação entre usuários e campos de atuação, na artefatos computacionais, textos adequados a abordando aspectos da situações e contextos. experiência do usuário e promovendo reflexão sobre a qualidade do uso dos artefatos nas esferas do trabalho, do lazer e do estudo."],"descritores":[{"codigo":"D019_P","descricao":"Reconhecer formas de tratar uma informação na comparação"}]}]},{"codigo":"EM13LP02","materia_codigo":"portugues","descricao":"Estabelecer relações entre as partes do texto, tanto na produção como na leitura/escuta, considerando a construção composicional e o estilo do gênero, usando e reconhecendo adequadamente elementos e recursos coesivos diversos que contribuam para a coerência, a continuidade e a progressão temática, tendo em vista as condições de produção e as relações lógico-discursivas envolvidas.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":4,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["as condições de circulação e recepção de recursos da coesão para atribuição/ produção Analisar regularidades - e estilísticas de quanto à coesão e à"],"descritores":[{"codigo":"D027_P","descricao":"Distinguir ideias centrais de secundárias ou tópicos e"}]},{"serie":2,"trimestre":2,"pagina_fonte":11,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["Analisar as condições de circulação e de textos. Reconhecer recursos da textual para atribuição/ de coerência. Analisar regularidades - e estilísticas de quanto à coesão e à"],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":17,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["Analisar as condições de produção, circulação e recepção de textos.","Reconhecer recursos da coesão textual para atribuição/ produção de coerência. -","Analisar regularidades composicionais e estilísticas de gêneros quanto à coesão e à coerência."],"descritores":[]},{"serie":1,"trimestre":3,"pagina_fonte":5,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["as condições de circulação e recepção recursos da coesão para atribuição/ produção - regularidades e estilísticas de quanto à coesão e à"],"descritores":[{"codigo":"D061_P","descricao":"Estabelecer relações causa/consequência entre partes e"}]},{"serie":2,"trimestre":3,"pagina_fonte":11,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["as condições de circulação e recepção de recursos da coesão atribuição/ produção regularidades - e estilísticas de quanto à coesão e à"],"descritores":[{"codigo":"D037_P","descricao":"Reconhecer as relações entre partes de um texto,"}]},{"serie":3,"trimestre":3,"pagina_fonte":18,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["as condições de circulação e recepção de recursos da coesão atribuição/ produção regularidades - e estilísticas de quanto à coesão e à"],"descritores":[{"codigo":"D037_P","descricao":"Reconhecer as relações entre partes de um texto,"}]}]},{"codigo":"EM13LP03","materia_codigo":"portugues","descricao":"Analisar relações de intertextualidade e interdiscursividade que permitam a explicitação de relações dialógicas, a A identificação de posicionamentos ou de perspectivas, a compreensão de paráfrases, paródias e estilizações, entre outras possibilidades.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":15,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Relação entre textos, reconstrução da textualidade e efeitos de sentido provocados pelos usos de recursos linguísticos e multissemióticos. 1ª"],"expectativas":["Analisar as relações de intertextualidade e interdiscursividade em diferentes textos, identificando como essas conexões a estabelecem diálogos entre obras, autores e contextos. a • Reconhecer posicionamentos e perspectivas expressos meio de paráfrases, paródias, estilizações e outros recursos intertextuais.","Identificar e interpretar relações lógico-discursivas texto, por meio de elementos coesivos como conjunções advérbios, que contribuem para a coerência e continuidade textual.","Compreender a intencionalidade comunicativa presente nos textos, considerando os fatores que influenciam produção e recepção das mensagens e"],"descritores":[{"codigo":"D037_P","descricao":"Estabelecer relações entre partes de um identificando repetições ou substituições que contribuem para a continuidade de um texto."}]},{"serie":3,"trimestre":3,"pagina_fonte":18,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["textos e discursos na de um nos textos relações por meio da e da nos textos diferentes e perspectivas."],"descritores":[]}]},{"codigo":"EM13LP05","materia_codigo":"portugues","descricao":"Analisar, em textos argumentativos, os posicionamentos assumidos, os movimentos argumentativos (sustentação, refutação/ contra- argumentação e negociação) e os argumentos utilizados para sustentá-los, para avaliar sua força e eficácia, e posicionar-se criticamente diante da questão discutida e/ou dos argumentos utilizados, recorrendo aos mecanismos linguísticos necessários.","ocorrencias":[{"serie":3,"trimestre":2,"pagina_fonte":18,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["Analisar contextos de EM13CO13 Analisar e produção, circulação e utilizar as diferentes recepção de textos de formas de gêneros do argumentar. representação e","Analisar estratégias e consulta a dados em operadores da argumentação formato digital para e recursos de modalização. pesquisas científicas.","Posicionar-se, oralmente, de forma crítica e ética, diante da questão discutida e/ou dos argumentos utilizados, recorrendo aos mecanismos linguísticos necessários."],"descritores":[{"codigo":"D055_P","descricao":"Estabelecer relação entre a tese e os argumentos oferecidos para sustentá-la."}]},{"serie":1,"trimestre":3,"pagina_fonte":5,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["contextos de produção, EM13CO13 Analisar e e recepção de textos de utilizar as diferentes do argumentar. formas de representação estratégias e operadores e consulta a dados em e recursos de formato digital para pesquisas científicas. oralmente, de e ética, diante da discutida e/ou dos utilizados, recorrendo linguísticos"],"descritores":[{"codigo":"D032_P","descricao":"Identificar a tese de um texto."}]},{"serie":2,"trimestre":3,"pagina_fonte":12,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["contextos de produção, EM13CO13 Analisar e e recepção de textos de utilizar as diferentes formas argumentar. de representação e estratégias e operadores consulta a dados em e recursos de formato digital para pesquisas científicas. oralmente, de e ética, diante da discutida e/ou dos utilizados, recorrendo linguísticos"],"descritores":[{"codigo":"D055_P","descricao":"Estabelecer relação entre a tese e os argumentos oferecidos"}]},{"serie":3,"trimestre":3,"pagina_fonte":19,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["contextos de produção, EM13CO13 Analisar e e recepção de textos de utilizar as diferentes formas argumentar. de representação e estratégias e operadores consulta a dados em e recursos de formato digital para pesquisas científicas. oralmente, de e ética, diante da discutida e/ou dos utilizados, recorrendo linguísticos"],"descritores":[{"codigo":"D032_P","descricao":"Identificar a tese de um texto."}]}]},{"codigo":"EM13LP06","materia_codigo":"portugues","descricao":"Analisar efeitos de sentido decorrentes de usos expressivos da linguagem, da escolha de determinadas palavras ou A expressões e da ordenação, combinação e contraposição de palavras, dentre outros, para ampliar as possibilidades de construção de sentidos e de uso crítico de língua.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":14,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Estilo, efeitos de sentido;","Léxico/morfologia. 1ª Habilidades da computação Não há. 2ª 3ª 14"],"expectativas":["Identificar as funções da linguagem e sua relação com função social do texto. ou • Identificar marcas de opinião.","Relacionar as linguagens verbal e não verbal. de"],"descritores":[{"codigo":"D102_P","descricao":"Reconhecer o efeito de sentido decorrente exploração de recursos ortográficos e/ou morfossintáticos."},{"codigo":"D016_P","descricao":"Identificar a finalidade de textos de diferentes gêneros."},{"codigo":"D017_P","descricao":"Identificar o gênero de textos variados"},{"codigo":"D028_P","descricao":"Identificar o tema de um texto."}]},{"serie":1,"trimestre":1,"pagina_fonte":17,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Estilo, efeitos de sentido;","Léxico/morfologia."],"expectativas":["Analisar os efeitos de sentido produzidos pelo uso expressivo da linguagem, considerando a polissemia e a escolha lexical, ou para ampliar a compreensão crítica dos textos.","Identificar diferentes figuras de linguagem — de metáfora, comparação, metonímia, sinestesia, eufemismo, antítese, paradoxo, personificação, hipérbole e ironia textos variados.","Analisar os efeitos de sentido e os impactos expressivos gerados pelo uso dessas figuras, compreendendo contribuição para a dimensão estética e crítica da linguagem.","Reconhecer como a escolha e a combinação dessas figuras influenciam a construção de sentidos, ampliando interpretação e a apreciação dos textos."],"descritores":[{"codigo":"D023_P","descricao":"Inferir uma informação implícita em um"},{"codigo":"D043_P","descricao":"Reconhecer o efeito de sentido decorrente exploração de recursos estilísticos."},{"codigo":"D053_P","descricao":"Reconhecer o efeito de sentido decorrente escolha de uma determinada palavra ou expressão."}]},{"serie":1,"trimestre":2,"pagina_fonte":5,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["as funções da e sua relação com a social do texto. marcas de opinião. as linguagens verbal e -"],"descritores":[{"codigo":"D022_P","descricao":"Inferir o sentido de palavra ou expressão a partir do contexto."},{"codigo":"D024_P","descricao":"Reconhecer efeito de humor ou de ironia em um texto."}]},{"serie":2,"trimestre":2,"pagina_fonte":12,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["Identificar as funções da e sua relação com a social do texto. marcas de opinião. - Relacionar as linguagens e não verbal."],"descritores":[{"codigo":"D022_P","descricao":"Inferir o sentido de palavra ou expressão a partir do contexto."},{"codigo":"D024_P","descricao":"Reconhecer efeito de humor ou de ironia em um texto."}]},{"serie":3,"trimestre":2,"pagina_fonte":18,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["Identificar as funções da linguagem e sua relação com a função social do texto.","Identificar marcas de opinião. -","Relacionar as linguagens verbal e não verbal."],"descritores":[{"codigo":"D022_P","descricao":"Inferir o sentido de palavra ou expressão a partir do contexto."}]},{"serie":1,"trimestre":3,"pagina_fonte":6,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["as funções da e sua relação com a do texto. marcas de opinião. - as linguagens verbal e"],"descritores":[{"codigo":"D053_P","descricao":"Reconhecer o efeito de sentido decorrente da escolha de uma"}]},{"serie":2,"trimestre":3,"pagina_fonte":12,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["as funções da e sua relação com a do texto. marcas de opinião. - as linguagens verbal e"],"descritores":[{"codigo":"D053_P","descricao":"Reconhecer o efeito de sentido decorrente da escolha de"}]},{"serie":3,"trimestre":3,"pagina_fonte":19,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["as funções da e sua relação com a do texto. marcas de opinião. - as linguagens verbal e"],"descritores":[{"codigo":"D053_P","descricao":"Reconhecer o efeito de sentido decorrente da escolha de"}]}]},{"codigo":"EM13LP07","materia_codigo":"portugues","descricao":"Analisar, em textos de diferentes gêneros, marcas que expressam a posição do enunciador frente àquilo que é A dito: uso de diferentes modalidades (epistêmica, deôntica e apreciativa) e de diferentes recursos gramaticais que operam como modalizadores (verbos modais, tempos e modos verbais, expressões modais, adjetivos, locuções ou orações adjetivas, advérbios, locuções ou orações adverbiais, entonação etc.), uso de estratégias de impessoalização (uso de terceira pessoa e de voz passiva etc.), com vistas ao incremento da compreensão e da criticidade e ao manejo adequado desses elementos nos textos produzidos, considerando os contextos de produção.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":13,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Textualização, tendo em vista suas condições de produção, as características do gênero em questão, o estabelecimento de coesão, adequação à norma-padrão e o uso adequado de ferramentas de edição. 1ª"],"expectativas":["Identificar marcas linguísticas que expressem posição que enunciador em relação ao que diz, com consideração é contexto de produção, circulação e recepção. e • Analisar usos de recursos modalizadores e seus efeitos sentido em textos de gêneros diversos. os"],"descritores":[{"codigo":"D102_P","descricao":"Reconhecer o efeito de sentido decorrente exploração de recursos ortográficos e/ou morfossintáticos."},{"codigo":"D016_P","descricao":"Identificar a finalidade de textos de diferentes gêneros."},{"codigo":"D017_P","descricao":"Identificar o gênero de textos variados"},{"codigo":"D028_P","descricao":"Identificar o tema de um texto."}]},{"serie":3,"trimestre":1,"pagina_fonte":40,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Textualização, tendo em vista suas condições de produção, as características do gênero em questão, o estabelecimento de coesão, adequação à norma-padrão e o uso adequado de ferramentas de edição. 1ª 2ª"],"expectativas":["Identificar marcas linguísticas que expressem posição que enunciador em relação ao que diz, com consideração é contexto de produção, circulação e recepção. e • Analisar usos de recursos modalizadores e seus efeitos sentido em textos de gêneros diversos. os"],"descritores":[{"codigo":"D027_P","descricao":"Diferenciar as partes principais das secundárias um texto."},{"codigo":"D028_P","descricao":"Identificar o tema de um texto."},{"codigo":"D032_P","descricao":"Identificar a tese de um"},{"codigo":"D037_P","descricao":"Estabelecer relações entre partes de texto, identificando repetições ou substituições que contribuem para a continuidade de um"},{"codigo":"D102_P","descricao":"Reconhecer o efeito de sentido decorrente exploração de recursos ortográficos e/ou morfossintáticos."}]},{"serie":1,"trimestre":2,"pagina_fonte":6,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["marcas linguísticas que posição do enunciador ao que diz, com do contexto de circulação e recepção. usos de recursos e seus efeitos de em textos de gêneros -"],"descritores":[{"codigo":"D039_P","descricao":"Reconhecer o sentido das relações lógico-discursivas em um"}]},{"serie":2,"trimestre":2,"pagina_fonte":13,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["marcas linguísticas expressem posição do em relação ao que com consideração do de produção, e recepção. Analisar usos de recursos e seus efeitos de em textos de gêneros -"],"descritores":[{"codigo":"D033_P","descricao":"Reconhecer posições distintas relativas ao mesmo fato ou mesmo tema."}]},{"serie":3,"trimestre":2,"pagina_fonte":19,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["Identificar marcas linguísticas que expressem posição do enunciador em relação ao que diz, com consideração do contexto de produção, circulação e recepção.","Analisar usos de recursos - modalizadores e seus efeitos de sentido em textos de gêneros diversos."],"descritores":[{"codigo":"D039_P","descricao":"Reconhecer o sentido das relações lógico-discursivas em um texto."}]},{"serie":2,"trimestre":3,"pagina_fonte":13,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["marcas linguísticas que posição do enunciador ao que diz, com do contexto de circulação e recepção. usos de recursos e seus efeitos de textos de gêneros -"],"descritores":[{"codigo":"D039_P","descricao":"Reconhecer o sentido das relações lógico-discursivas em"}]}]},{"codigo":"EM13LP08","materia_codigo":"portugues","descricao":"Analisar elementos e aspectos da sintaxe português, como a ordem dos constituintes da sentença (e os efeito que causam sua inversão), a estrutura sintagmas, as categorias sintáticas, os processos coordenação e subordinação (e os efeitos de seus usos) e a sintaxe de concordância e de regência, de modo potencializar os processos de compreensão e produção de textos e a possibilitar escolhas adequadas à situação comunicativa.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":14,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["efeitos de sentido pela variação da ordem dos termos da (inversão sintática, efeitos de sentido pelo uso de voz ativa, impessoais. como diminutivos, - e sufixos avaliativos julgamento, ironia ou a análise ortográfica e ao contexto para o sentido global do"],"descritores":[{"codigo":"D102_P","descricao":"Reconhecer o efeito de sentido decorrente da exploração de"}]},{"serie":3,"trimestre":3,"pagina_fonte":20,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["efeitos de sentido pela variação da ordem dos termos da (inversão sintática, efeitos de sentido pelo uso de voz ativa, - impessoais. como diminutivos, e sufixos avaliativos julgamento, ironia ou a análise ortográfica e ao contexto para o sentido global do"],"descritores":[{"codigo":"D102_P","descricao":"Reconhecer o efeito de sentido decorrente da exploração de"}]}]},{"codigo":"EM13LP10","materia_codigo":"portugues","descricao":"Analisar o fenômeno da variação linguística, em seus diferentes níveis (variações fonético-fonológica, lexical, A sintática, semântica e estilístico-pragmática) e em suas diferentes dimensões (regional, histórica, social, situacional, ocupacional, etária etc.), de forma a ampliar a compreensão sobre a natureza viva e dinâmica da língua e sobre o fenômeno da constituição de variedades linguísticas de prestígio e estigmatizadas, e a fundamentar o respeito às variedades linguísticas e o combate a preconceitos linguísticos.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":12,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Variação linguística;","Elementos notacionais da escrita;","Léxico/morfologia, semântica e estilo."],"expectativas":["Analisar diferentes tipos de variação linguística (fonético- seus fonológica, lexical, sintática, semântica e estilístico- pragmática), reconhecendo suas manifestações suas dimensões regional, histórica, social, situacional, ocupacional e etária.","Compreender a língua como um sistema dinâmico e diverso, identificando o funcionamento das variedades linguísticas e as motivações sociais que produzem o prestígio ou o estigma de determinadas formas de falar.","Identificar as marcas linguísticas que evidenciam o locutor e o interlocutor de um texto, analisando como essas marcas variam conforme o contexto de produção e o tipo variedade linguística utilizada.","Fundamentar o respeito às variedades linguísticas posicionar-se criticamente contra práticas de preconceito linguístico, reconhecendo o valor comunicativo de diferentes formas de expressão."],"descritores":[{"codigo":"D057_P","descricao":"Interpretar texto com auxílio de material gráfico diverso (propagandas, quadrinhos, foto"},{"codigo":"D023_P","descricao":"Inferir uma informação implícita em um texto."},{"codigo":"D022_P","descricao":"Inferir o sentido de uma palavra ou expressão."},{"codigo":"D103_P","descricao":"Identificar as marcas linguísticas que evidenciam locutor e o interlocutor de um texto."},{"codigo":"D016_P","descricao":"Identificar a finalidade de textos de diferentes gêneros."},{"codigo":"D017_P","descricao":"Identificar o gênero de textos variados."},{"codigo":"D028_P","descricao":"Identificarlocutor e o interlocutor de um texto."}]},{"serie":2,"trimestre":3,"pagina_fonte":14,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["condições de produção, e recepção de textos e ocorrências da variação em diferentes níveis. usos das variedades, de a adequação a as relações de poder e os - ideológicos que levam a de valorização de variedades e de outras. em textos do campo preconceitos que o preconceito"],"descritores":[{"codigo":"D103_P","descricao":"Identificar as marcas linguísticas que evidenciam o locutor"}]},{"serie":3,"trimestre":3,"pagina_fonte":20,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["condições de produção, e recepção de textos e ocorrências da variação em diferentes níveis. usos das variedades, de a adequação a as relações de poder e os - ideológicos que levam a de valorização de variedades e de outras. em textos do campo preconceitos que"],"descritores":[{"codigo":"D103_P","descricao":"Identificar as marcas linguísticas que evidenciam o locutor"}]}]},{"codigo":"EM13LP15","materia_codigo":"portugues","descricao":"Planejar, produzir, revisar, editar, reescrever e avaliar textos escritos e multissemióticos, considerando sua adequação às A condições de produção do texto, no que diz respeito ao lugar social a ser assumido e à imagem que se pretende passar a respeito de si mesmo, ao leitor pretendido, ao veículo e mídia em que o texto ou produção cultural vai circular, ao contexto imediato e sócio-histórico mais geral, ao gênero textual em questão e suas regularidades, à variedade linguística apropriada a esse contexto e ao uso do conhecimento dos aspectos notacionais (ortografia padrão, pontuação adequada, mecanismos de concordância nominal e verbal, regência verbal etc.), sempre que o contexto o exigir","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":39,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Textualização, tendo em vista suas condições de produção, as características do gênero em questão, o estabelecimento de coesão, adequação à norma e o uso adequado de ferramentas de edição. 1ª"],"expectativas":["Reconhecer e utilizar as operações e os processos de produção textual (planejar, produzir, revisar, editar, às reescrever), que devem se dar em contextos de produção definidos (interlocutores, intencionalidades etc.). a • Considerar o contexto de produção, circulação e recepção de textos escritos e multissemióticos.","Produzir textos escritos e multissemióticos com o uso processos e procedimentos trazidos pelas novas mídias."],"descritores":[{"codigo":"D027_P","descricao":"Diferenciar as partes principais das secundárias um texto."},{"codigo":"D028_P","descricao":"Identificar o tema de um texto."},{"codigo":"D032_P","descricao":"Identificar a tese de um"},{"codigo":"D037_P","descricao":"Estabelecer relações entre partes de texto, identificando repetições ou substituições de que contribuem para a continuidade de um"},{"codigo":"D102_P","descricao":"Reconhecer o efeito de sentido decorrente exploração de recursos ortográficos e/ou morfossintáticos."}]},{"serie":1,"trimestre":2,"pagina_fonte":6,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["e utilizar as e os processos de textual (planejar, revisar, editar, reescrever), se dar em contextos de definidos (interlocutores, etc.)."],"descritores":[{"codigo":"D025_P","descricao":"Reconhecer efeitos de sentido decorrente do uso da pontuação"}]},{"serie":2,"trimestre":2,"pagina_fonte":13,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["Reconhecer e utilizar as e os processos de textual (planejar, revisar, editar, que devem se dar contextos de produção - (interlocutores, etc.). Considerar o contexto de circulação e de textos escritos e Produzir textos escritos e com o uso de e procedimentos pelas novas mídias."],"descritores":[{"codigo":"D057_P","descricao":"Interpretar textos que articulam elementos verbais e não verbais."}]},{"serie":2,"trimestre":3,"pagina_fonte":15,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["e utilizar as e os processos de textual (planejar, editar, reescrever), se dar em contextos de definidos (interlocutores, etc.). o contexto de circulação e recepção de e multissemióticos. textos escritos e - com o uso de e procedimentos novas mídias."],"descritores":[{"codigo":"D025_P","descricao":"Reconhecer efeitos de sentido decorrente do uso da"}]},{"serie":3,"trimestre":3,"pagina_fonte":21,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["e utilizar as e os processos de textual (planejar, editar, reescrever), se dar em contextos de definidos (interlocutores, etc.). o contexto de circulação e recepção de - e multissemióticos. textos escritos e com o uso de e procedimentos novas mídias."],"descritores":[{"codigo":"D025_P","descricao":"Reconhecer efeitos de sentido decorrente do uso da"}]}]},{"codigo":"EM13LP16","materia_codigo":"portugues","descricao":"Produzir e analisar textos orais, considerando sua adequação aos contextos de produção, à forma composicional e ao estilo do gênero em questão, à clareza, à progressão temática e à variedade linguística empregada, como também aos elementos relacionados à fala (modulação de voz, entonação, ritmo, altura e intensidade, respiração etc.) e à cinestesia (postura corporal, movimentos e gestualidade significativa, expressão facial, contato de olho com plateia etc.).","ocorrencias":[{"serie":2,"trimestre":2,"pagina_fonte":14,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["Analisar o contexto de circulação e de textos orais ou considerando variedade linguística Analisar o uso de recursos paralinguísticos, a elementos de fala (voz, ritmo, altura e respiração etc.) e (postura, movimento, - expressão etc.). Produzir textos orais ou Usar recursos linguísticos, e cinésicos em orais e/ou"],"descritores":[]}]},{"codigo":"EM13LP23","materia_codigo":"portugues","descricao":"Analisar criticamente o histórico e o discurso político de candidatos, propagandas políticas, políticas públicas, programas e propostas de governo, de forma participar do debate político e tomar decisões conscientes e fundamentadas.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":15,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["interesses que motivam políticos, programas e de governo e políticas comparativamente - de programas e de governo. crítica e eticamente da esfera política."],"descritores":[]}]},{"codigo":"EM13LP24","materia_codigo":"portugues","descricao":"Analisar formas não institucionalizadas participação social, sobretudo as vinculadas manifestações artísticas, produções culturais, intervenções urbanas e formas de expressão típica culturas juvenis que pretendam expor uma problemática ou promover uma reflexão/ação, posicionando-se relação a essas produções e manifestações.","ocorrencias":[{"serie":3,"trimestre":3,"pagina_fonte":21,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["práticas de linguagens participação social. temas de interesse especialmente das oralmente, de e crítica, em relação a artísticas, culturais, intervenções formas de expressão das que exponham uma"],"descritores":[]}]},{"codigo":"EM13LP26","materia_codigo":"portugues","descricao":"Relacionar textos e documentos legais normativos de âmbito universal, nacional, local escolar que envolvam a definição de direitos e deveres em especial, os voltados a adolescentes e jovens seus contextos de produção, identificando ou inferindo possíveis motivações e finalidades, como forma ampliar a compreensão desses direitos e deveres.","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":7,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["o contexto de produção, e recepção de textos normativos. regularidades dos textos legais e normativos. - textos legais e direitos e deveres, com textos legais e normativos. a partir do contexto de possíveis motivações e como forma de ampliar desses direitos e"],"descritores":[]}]},{"codigo":"EM13LP29","materia_codigo":"portugues","descricao":"Resumir e resenhar textos, por meio do uso de paráfrases, de marcas do discurso reportado e de citações, para uso em A textos de divulgação de estudos e pesquisas.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":24,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Estratégias de produção;","Marcas linguísticas;","Intertextualidade;","Estratégias de escrita: textualização, revisão e edição. 1ª"],"expectativas":["Utilizar estratégias e mecanismos lexicais e sintáticos de produção de resumos e paráfrases. em • Desenvolver a capacidade de realizar inferências a de elementos contextuais e linguísticos do texto, identificando informações não explicitamente declaradas pelo autor.","Analisar textos que apresentem diferentes pontos de sobre o mesmo tema ou fato, identificando as divergências semelhanças nas opiniões apresentadas."],"descritores":[{"codigo":"D023_P","descricao":"Inferir uma informação implícita em texto."},{"codigo":"D030_P","descricao":"Identificar o conflito gerador do enredo e os elementos que constroem a narrativa."},{"codigo":"D062_P","descricao":"Identificar discursos que contribuíram para a formação da identidade nacional em textos da literatura brasileira"},{"codigo":"D043_P","descricao":"Reconhecer o efeito de sentido decorrente da exploração de recursos estilísticos."},{"codigo":"D017_P","descricao":"Identificar o gênero de textos variados."},{"codigo":"D032_P","descricao":"Identificar a tese de um"},{"codigo":"D033_P","descricao":"Reconhecer posições distintas entre duas ou opiniões relativas ao mesmo fato ou ao mesmo"},{"codigo":"D038_P","descricao":"Distinguir um fato da opinião relativa a esse fato."},{"codigo":"D061_P","descricao":"Estabelecer relação causa/consequência partes e elementos do texto."},{"codigo":"D055_P","descricao":"Estabelecer relação entre a tese e os argumentos oferecidos para sustentá-la."}]},{"serie":1,"trimestre":3,"pagina_fonte":7,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["estratégias e mecanismos e sintáticos na produção de e paráfrases. textos. recursos linguísticos que as vozes introduzidas no -"],"descritores":[]}]},{"codigo":"EM13LP31","materia_codigo":"portugues","descricao":"Compreender criticamente textos divulgação científica orais, escritos e multissemióticos de diferentes áreas do conhecimento, identificando organização tópica e a hierarquização das informações, identificando e descartando fontes não confiáveis problematizando enfoques tendenciosos superficiais.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":16,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["condições de produção, e recepção de textos de divulgação científica. as regularidades dos divulgação científica. em discussões - tendenciosos ou textos de divulgação de diferentes fontes, enfoques ou superficiais; e descartando fontes"],"descritores":[]}]},{"codigo":"EM13LP36","materia_codigo":"portugues","descricao":"Analisar os interesses que movem campo jornalístico, os impactos das novas tecnologias digitais de informação e comunicação da Web 2.0 no campo e as condições que fazem informação, uma mercadoria e da checagem informação, uma prática (e um serviço) essencial, adotando atitude analítica e crítica diante dos textos jornalísticos.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":8,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["o contexto de e circulação dos gêneros jornalístico-midiático. textos jornalísticos de crítica. -"],"descritores":[]}]},{"codigo":"EM13LP38","materia_codigo":"portugues","descricao":"Analisar os diferentes graus de parcialidade/imparcialidade (no limite, a não neutralidade) em textos noticiosos, A comparando relatos de diferentes fontes e analisando o recorte feito de fatos/dados e os efeitos de sentido provocados pelas escolhas realizadas pelo autor do texto, de forma a manter uma atitude crítica diante dos textos jornalísticos e tornar-se consciente das escolhas feitas como produtor.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":31,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Estratégia de leitura: apreender os sentidos globais do texto;","Curadoria de informação;","Participação em discussões orais de temas controversos de interesse da turma e/ou de relevância social;","Consideração das condições de produção;","Relação do texto com o contexto de produção e experimentação de papéis sociais. 1ª"],"expectativas":["Identificar e analisar as estratégias argumentativas utilizadas no editorial, como o uso de dados, exemplificações, apelos à autoridade, analogias concessões, avaliando sua eficácia na defesa da","Comparar editoriais de diferentes fontes sobre um mesmo fato ou tema, analisando o recorte feito, a seleção de dados e os efeitos de sentido produzidos.","Avaliar criticamente a credibilidade de editoriais, distinguindo argumentações bem fundamentadas opiniões genéricas ou enviesadas."],"descritores":[{"codigo":"D016_P","descricao":"Identificar a finalidade de textos de diferentes gêneros."},{"codigo":"D021_P","descricao":"Localizar informações explícitas em um de"},{"codigo":"D027_P","descricao":"Diferenciar as partes principais das secundárias em um"},{"codigo":"D039_P","descricao":"Estabelecer relações lógico-discursivas presentes e no texto, marcadas por conjunções, advérbios"},{"codigo":"D060_P","descricao":"Reconhecer diferentes estratégias de argumentação."},{"codigo":"D102_P","descricao":"Reconhecer o efeito de sentido decorrente exploração de recursos ortográficos e/ou morfossintáticos."}]}]},{"codigo":"EM13LP40","materia_codigo":"portugues","descricao":"Analisar o fenômeno da pós-verdade - discutindo as condições e os mecanismos de disseminação de fake news e A também exemplos, causas e consequências desse fenômeno e da prevalência de crenças e opiniões sobre fatos -, de forma a adotar atitude crítica em relação ao fenômeno e desenvolver uma postura flexível que permita rever crenças e opiniões quando fatos apurados as contradisserem.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":32,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Reconstrução da textualidade e compreensão dos efeitos de sentido provocados pelos usos de recursos linguísticos e multissemióticos;","Reconstrução das condições de produção, circulação e recepção;","Relação do texto com o contexto de produção e experimentação de papéis sociais. 1ª"],"expectativas":["Desenvolver postura investigativa e autocrítica na leitura as e produção de editoriais, reconhecendo a importância e apuração e da responsabilidade argumentativa.","Analisar editoriais à luz do fenômeno da pós-verdade, de identificando como crenças pessoais, posicionamentos e ideológicos e argumentos opinativos podem prevalecer e sobre a apresentação objetiva dos fatos.","Desenvolver postura crítica e reflexiva diante de editoriais, comparando diferentes posicionamentos sobre o mesmo tema, verificando a consistência das fontes e adotando atitude de revisão quando os fatos contradizem crenças pessoais. e e"],"descritores":[{"codigo":"D016_P","descricao":"Identificar a finalidade de textos de diferentes gêneros."},{"codigo":"D021_P","descricao":"Localizar informações explícitas em um"},{"codigo":"D027_P","descricao":"Diferenciar as partes principais das secundárias em um"},{"codigo":"D039_P","descricao":"Estabelecer relações lógico-discursivas presentes no texto, marcadas por conjunções, advérbios"},{"codigo":"D060_P","descricao":"Reconhecer diferentes estratégias de argumentação."},{"codigo":"D102_P","descricao":"Reconhecer o efeito de sentido decorrente exploração de recursos ortográficos e/ou morfossintáticos."}]},{"serie":1,"trimestre":3,"pagina_fonte":8,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["textos e discursos do fenômenos do jornalismo como a de fake news e a pós- posicionamentos e éticos em gêneros como - e carta de leitor. procedimentos de da informação. posicionamentos críticos diante de conteúdos do contemporâneo, com como comentários e carta"],"descritores":[{"codigo":"D038_P","descricao":"Distinguir um fato da opinião."}]},{"serie":3,"trimestre":3,"pagina_fonte":22,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["textos e discursos do fenômenos do jornalismo como a produção e a pós-verdade. posicionamentos éticos em gêneros como e carta de leitor. - procedimentos de da informação. posicionamentos críticos de conteúdos do contemporâneo, com comentários e carta"],"descritores":[{"codigo":"D038_P","descricao":"Distinguir um fato da opinião."}]}]},{"codigo":"EM13LP44","materia_codigo":"portugues","descricao":"Analisar formas contemporâneas de publicidade em contexto digital (advergame, anúncios em vídeos, social advertising, A unboxing, narrativa mercadológica, entre outras), e peças de campanhas publicitárias e políticas (cartazes, folhetos, anúncios, propagandas em diferentes mídias, spots, jingles etc.), identificando valores e representações de situações, grupos e configurações sociais veiculadas, desconstruindo estereótipos, destacando estratégias de engajamento e viralização e explicando os macanismos de persuasão utilizados e os provocados pelas escolhas feitas em termos de elementos e recursos linguístico-discursivos, imagéticos, sonoros, gestuais e espaciais, entre outros.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":16,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Planejamento de textos em contexto digital de peças publicitárias e políticas;","Estratégia de produção: planejamento de textos informativos;","Estratégia de produção: textualização de textos informativos;","Estratégia de produção: planejamento, 1ª textualização, revisão e edição de textos publicitários. 2ª 3ª Habilidades da computação Não há. 16"],"expectativas":["Analisar o contexto de produção, circulação e recepção de textos publicitários.","Analisar peças publicitárias em diferentes mídias.","Reconhecer o mecanismo de persuasão em publicitários.","Relacionar textos e discursos da publicidade.","Analisar escolhas de recursos linguísticos e multissemióticos e seus efeitos de sentido."],"descritores":[{"codigo":"D033_P","descricao":"Reconhecer posições distintas entre duas ou opiniões relativas ao mesmo fato ou ao mesmo"},{"codigo":"D016_P","descricao":"Identificar a finalidade de textos de diferentes gêneros."},{"codigo":"D017_P","descricao":"Identificar o gênero de textos variados."},{"codigo":"D028_P","descricao":"Identificar o tema de um texto."}]}]},{"codigo":"EM13LP45","materia_codigo":"portugues","descricao":"Analisar, discutir, produzir e socializar, tendo em vista temas e acontecimentos de interesse ou global, notícias, fotodenúncias, fotorreportagens, reportagens multimidiáticas, documentários, infográficos, podcasts noticiosos, artigos de opinião, críticas mídia, v l o g s d e o p in i ã o, t e x t o s d e a p r e s e n t a ç ã o e a p r e c i d e p ro d u ç õ e s c u l t u r a i s ( r es e n h a s, e n s a i o s e tc. ) e o gêneros próprios das formas de expressão das culturas juvenis (vlogs e podcasts culturais, gameplay etc.), várias mídias, vivenciando de forma significativa o papel de repórter, analista, crítico, editorialista ou articulista, leitor, vlogueiro e booktuber, entre outros.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":30,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Reconstrução da textualidade e compreensão dos efeitos de sentido provocados pelos usos de recursos linguísticos e multissemióticos. 1ª"],"expectativas":["Analisar e produzir editoriais jornalísticos em diferentes mídias, discutindo temas de interesse social com argumentação consistente e linguagem adequada ao gênero, vivenciando o papel de editorialista por meio da leitura crítica, da reflexão e da autoria.","Identificar a finalidade do editorial jornalístico texto que expressa o posicionamento institucional de veículo de comunicação diante de temas relevantes, distinguindo-o de outros gêneros da esfera jornalística.","Localizar informações explícitas em editoriais jornalísticos, reconhecendo dados, fatos e referências que sustentam argumentação apresentada pelo autor coletivo (o veículo de imprensa).","Diferenciar, em um editorial, a tese principal das informações secundárias.","Reconhecer os mecanismos coesivos (conjunções, advérbios e outros elementos) que organizam a progressão das ideias no editorial, compreendendo como essas relações estruturam a argumentação.","Analisar o uso de recursos ortográficos e morfossintáticos e editoriais (como a escolha de tempos verbais, modalizadores, pontuação e pronomes), reconhecendo os efeitos de sentido produzidos e suas implicações ideológicas e argumentativas."],"descritores":[{"codigo":"D016_P","descricao":"Identificar a finalidade de textos de diferentes gêneros."},{"codigo":"D021_P","descricao":"Localizar informações explícitas em um"},{"codigo":"D027_P","descricao":"Diferenciar as partes principais das secundárias em um"},{"codigo":"D039_P","descricao":"Estabelecer relações lógico-discursivas presentes no texto, marcadas por conjunções, advérbios"},{"codigo":"D060_P","descricao":"Reconhecer diferentes estratégias de argumentação."},{"codigo":"D102_P","descricao":"Reconhecer o efeito de sentido decorrente exploração de recursos ortográficos e/ou morfossintáticos."}]},{"serie":2,"trimestre":2,"pagina_fonte":14,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["Reconhecer contexto de circulação e de textos do campo Analisar recursos linguísticos em textos do jornalístico-midiático, intencionalidade de temas e de interesse ou global. Definir contexto de produção, e recepção de textos - serem produzidos em gêneros campo jornalístico- Produzir individual e textos em do campo artístico- para informar ou na formação de","Usar recursos e multissemióticos intencionalidade."],"descritores":[{"codigo":"D028_P","descricao":"Reconhecer o assunto de um texto lido."}]},{"serie":1,"trimestre":3,"pagina_fonte":8,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["contexto de circulação e recepção do campo jornalístico- recursos linguísticos e em textos do jornalístico-midiático, com n a li d a d e d e d iv u lg a r te m a s - te c i m e n t o s d e i n t e re s se global. contexto de produção, e recepção de textos a em gêneros do individual e textos em do campo artístico- para informar ou na formação de opinião. recursos linguísticos e com"],"descritores":[{"codigo":"D028_P","descricao":"Reconhecer o assunto de um texto lido."}]},{"serie":3,"trimestre":3,"pagina_fonte":22,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["contexto de circulação e recepção de campo jornalístico- recursos linguísticos e - em textos do com de divulgar temas de interesse local contexto de produção, e recepção de textos a em gêneros do individual e textos em do campo artístico- para informar ou na formação de opinião. recursos linguísticos e com"],"descritores":[{"codigo":"D028_P","descricao":"Reconhecer o assunto de um texto lido."}]}]},{"codigo":"EM13LP47","materia_codigo":"portugues","descricao":"Participar de eventos (saraus, competições orais, audições, mostras, festivais, feiras culturais e literárias, rodas e clubes A de leitura, cooperativas culturais, jograis, repentes, slams etc.), inclusive para socializar obras da própria autoria (poemas, contos e suas variedades, roteiros e microrroteiros, videominutos, playlists comentadas de música etc.) e/ou interpretar obras de outros, inserindo-se nas diferentes práticas culturais de seu tempo.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":37,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Recursos linguísticos e semióticos que operam nos textos pertencentes aos gêneros literários dos textos literários das origens à contemporaneidade;","Adesão às práticas de leitura de textos literários das mais diferentes tipologias e manifestações literárias;","Estilo dos textos literários contemporâneos. 1ª"],"expectativas":["Mapear eventos e práticas do campo artístico-literário, considerando contextos locais e digitais.","Relacionar eventos e práticas do campo artístico-literário gostos e interesses.","Analisar modos de participar de práticas do campo artístico- literário, gêneros e linguagens que mobilizam.","Analisar procedimentos poéticos, recursos linguísticos multissemióticos, e seus efeitos de sentido.","Produzir performances com textos linguísticos multissemióticos para participar de eventos e práticas campo artístico-literário."],"descritores":[{"codigo":"D021_P","descricao":"Localizar informações explícitas em um texto."},{"codigo":"D024_P","descricao":"Identificar efeitos de ironia ou humor em textos variados."},{"codigo":"D062_P","descricao":"Identificar discursos que contribuíram para a formação mais da identidade nacional em textos da literatura brasileira."},{"codigo":"D043_P","descricao":"Reconhecer o efeito de sentido decorrente da exploração de recursos estilísticos."},{"codigo":"D057_P","descricao":"Interpretar texto com auxílio de material gráfico diverso (propagandas, quadrinhos, foto"},{"codigo":"D023_P","descricao":"Inferir uma informação implícita em um texto."},{"codigo":"D019_P","descricao":"Reconhecer diferentes formas de tratar informação na comparação de textos que tratam do mesmo tema, em função das condições em ele foi produzido e daquelas em que será recebido."},{"codigo":"D016_P","descricao":"Identificar a finalidade de textos de diferentes gêneros."},{"codigo":"D033_P","descricao":"Reconhecer posições distintas entre duas ou opiniões relativas ao mesmo fato ou ao mesmo"},{"codigo":"D038_P","descricao":"Distinguir um fato da opinião relativa a esse fato."}]}]},{"codigo":"EM13LP48","materia_codigo":"portugues","descricao":"Identificar assimilações, rupturas e permanências no processo de constituição da literatura brasileira e ao longo de sua A trajetória, por meio da leitura e análise de obras fundamentais do cânone ocidental, em especial da literatura portuguesa, para perceber a historicidade de matrizes e procedimentos estéticos.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":20,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["TI","Recursos linguísticos e semióticos que operam nos textos pertencentes aos gêneros literários dos textos literários das origens à contemporaneidade;","Efeito de sentido dos textos literários das origens à contemporaneidade;","Adesão às práticas de leitura de textos literários das mais diversas tipologias."],"expectativas":["Reconhecer, nas obras da 1ª geração da poesia Romântica brasileira, elementos herdados da tradição literária sua portuguesa, bem como rupturas e permanências em relação ao contexto histórico e cultural brasileiro.","Analisar como o Romantismo contribuiu para a construção da identidade nacional, especialmente por meio nacionalismo e do indianismo, e refletir sobre os efeitos sentido produzidos por escolhas lexicais e expressivas textos.","Relacionar textos literários do período a discursos valorização da pátria, da natureza e da figura do indígena idealizado, entendendo esses elementos como parte de projeto estético e político da época. das à"],"descritores":[{"codigo":"D023_P","descricao":"Inferir uma informação implícita em a texto."},{"codigo":"D030_P","descricao":"Identificar o conflito gerador do enredo e os elementos que constroem a narrativa."},{"codigo":"D062_P","descricao":"Identificar discursos que contribuíram para a formação da identidade nacional em textos da literatura brasileira"},{"codigo":"D043_P","descricao":"Reconhecer o efeito de sentido decorrente da exploração de recursos estilísticos."},{"codigo":"D017_P","descricao":"Identificar o gênero de textos variados."},{"codigo":"D032_P","descricao":"Identificar a tese de um"},{"codigo":"D033_P","descricao":"Reconhecer posições distintas entre duas ou opiniões relativas ao mesmo fato ou ao mesmo"},{"codigo":"D038_P","descricao":"Distinguir um fato da opinião relativa a esse fato."},{"codigo":"D061_P","descricao":"Estabelecer relação causa/consequência partes e elementos do texto."},{"codigo":"D055_P","descricao":"Estabelecer relação entre a tese e os argumentos oferecidos para sustentá-la."}]},{"serie":2,"trimestre":1,"pagina_fonte":26,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Recursos linguísticos e semióticos que operam nos textos pertencentes aos gêneros literários dos textos literários das origens à contemporaneidade;","Efeito de sentido dos textos literários das origens à contemporaneidade;","Adesão às práticas de leitura de textos literários das mais diversas tipologias. 1ª"],"expectativas":["Reconhecer, nas obras da 1ª geração do Romantismo brasileiro, elementos herdados da tradição literária sua portuguesa, bem como rupturas e permanências em relação ao contexto histórico e cultural brasileiro.","Analisar como o Romantismo contribuiu para a construção da identidade nacional, especialmente por meio nacionalismo e do indianismo, e refletir sobre os efeitos sentido produzidos por escolhas lexicais e expressivas textos.","Relacionar textos literários do período a discursos valorização da pátria, da natureza e da figura do indígena idealizado, entendendo esses elementos como parte de projeto estético e político da época. das à mais"],"descritores":[{"codigo":"D021_P","descricao":"Localizar informações explícitas em um texto."},{"codigo":"D039_P","descricao":"Estabelecer relações lógico-discursivas presentes no texto, marcadas por conjunções, advérbios"},{"codigo":"D102_P","descricao":"Reconhecer o efeito de sentido decorrente exploração de recursos ortográficos e/ou morfossintáticos."}]},{"serie":3,"trimestre":1,"pagina_fonte":34,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Recursos linguísticos e semióticos que operam nos textos pertencentes aos gêneros literários dos textos literários das origens à contemporaneidade;","Efeito de sentido dos textos literários das origens à contemporaneidade;","Adesão às práticas de leitura de textos literários das mais diversas tipologias. 1ª Habilidades da computação EM13CO20 Criar conteúdos, disponibilizando-os em ambientes virtuais para publicação e compartilhamento, avaliando a 2ª confiabilidade e as consequências da disseminação dessas informações. 3ª 34"],"expectativas":["Localizar informações explícitas em textos literários e críticos sobre o Pré-Modernismo, identificando autores, obras sua características marcantes dessa escola literária.","Inferir informações implícitas em textos pré-modernistas, interpretando significados não ditos que revelam críticas sociais, tensões políticas e posicionamentos ideológicos autor."],"descritores":[{"codigo":"D021_P","descricao":"Localizar informações explícitas em um texto."},{"codigo":"D024_P","descricao":"Identificar efeitos de ironia ou humor em textos variados."},{"codigo":"D062_P","descricao":"Identificar discursos que contribuíram para a formação mais da identidade nacional em textos da literatura brasileira."},{"codigo":"D043_P","descricao":"Reconhecer o efeito de sentido decorrente da exploração de recursos estilísticos."},{"codigo":"D057_P","descricao":"Interpretar texto com auxílio de material gráfico diverso (propagandas, quadrinhos, foto"},{"codigo":"D023_P","descricao":"Inferir uma informação implícita em um texto."},{"codigo":"D019_P","descricao":"Reconhecer diferentes formas de tratar informação na comparação de textos que tratam do mesmo tema, em função das condições em ele foi produzido e daquelas em que será recebido."},{"codigo":"D016_P","descricao":"Identificar a finalidade de textos de diferentes gêneros."},{"codigo":"D033_P","descricao":"Reconhecer posições distintas entre duas ou opiniões relativas ao mesmo fato ou ao mesmo"},{"codigo":"D038_P","descricao":"Distinguir um fato da opinião relativa a esse fato."}]},{"serie":3,"trimestre":2,"pagina_fonte":20,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["Analisar recursos e EM13CO20 Criar procedimentos literários em conteúdos, obras lidas. disponibilizando-os em","Comparar recursos e ambientes virtuais para procedimentos literários em publicação e obras de uma mesma compartilhamento, temporalidade, de diferentes avaliando a temporalidades, confiabilidade e as pertencentes à literatura consequências da brasileira e à ocidental. disseminação dessas informações."],"descritores":[]},{"serie":1,"trimestre":3,"pagina_fonte":8,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["recursos e EM13CO20 Criar literários em obras conteúdos, disponibilizando-os em ambientes virtuais para recursos e publicação e literários em obras compartilhamento,"],"descritores":[]}]},{"codigo":"EM13LP49","materia_codigo":"portugues","descricao":"Perceber as peculiaridades estruturais e estilísticas de diferentes gêneros literários (a apreensão pessoal do cotidiano nas crônicas, a manifestação livre e subjetiva do eu lírico diante do mundo nos poemas, a múltipla perspectiva da vida humana e social dos romances, a dimensão política e social de textos da literatura marginal e da periferia etc.) para experimentar os diferentes ângulos de apreensão do indivíduo e do mundo pela literatura.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":8,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["como escolhas de EM13CO20 Criar dos gêneros conteúdos, e estilísticas) disponibilizando-os em efeitos de sentidos de ambientes virtuais para e expressão de publicação e subjetividades, compartilhamento, identitários e valores. avaliando a confiabilidade e as consequências da disseminação dessas informações."],"descritores":[{"codigo":"D030_P","descricao":"Reconhecer os elementos que compõem uma narrativa e o"}]},{"serie":3,"trimestre":2,"pagina_fonte":20,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["Analisar como escolhas de EM13CO20 Criar regularidades dos gêneros conteúdos, (composicionais e disponibilizando-os em estilísticas) geram efeitos de ambientes virtuais para sentidos de representação e publicação e expressão de diferentes compartilhamento, subjetividades, processos avaliando a identitários e valores. confiabilidade e as consequências da disseminação dessas informações."],"descritores":[{"codigo":"D030_P","descricao":"Reconhecer os elementos que compõem uma narrativa e o conflito gerador."}]}]},{"codigo":"EM13LP50","materia_codigo":"portugues","descricao":"Analisar relações intertextuais e interdiscursivas entre obras de diferentes autores e gêneros literários de um mesmo momento A histórico e de momentos históricos diversos, explorando os modos como a literatura e as artes em geral se constituem, dialogam e se retroalimentam.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":18,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Recursos linguísticos e semióticos que operam nos textos pertencentes aos gêneros literários dos textos literários das origens à contemporaneidade. 1ª 2ª"],"expectativas":["Analisar o contexto de produção, circulação e recepção de de textos literários e artísticos.","Relacionar textos literários e discursos artísticos na leitura/ os escuta/apreciação de um texto literário.","Analisar efeitos de sentidos da intertextualidade."],"descritores":[{"codigo":"D043_P","descricao":"Reconhecer o efeito de sentido decorrente da exploração de recursos estilísticos."},{"codigo":"D053_P","descricao":"Reconhecer o efeito de sentido decorrente escolha de uma determinada palavra ou expressão."},{"codigo":"D019_P","descricao":"Reconhecer diferentes formas de tratar informação na comparação de textos que tratam do mesmo tema, em função das condições em que ele foi produzido daquelas em que será recebido."}]},{"serie":2,"trimestre":1,"pagina_fonte":22,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Recursos linguísticos e semióticos que operam nos textos pertencentes aos gêneros literários dos textos literários das origens à contemporaneidade. 1ª"],"expectativas":["Reconhecer os aspectos temáticos, estilísticos e históricos de característicos da 2ª geração da poesia Romântica, ênfase no ultrarromantismo, como o pessimismo, o escapismo, os a idealização da morte, do amor e da figura feminina.","Estabelecer relações intertextuais entre poemas e textos diferentes gêneros e épocas, identificando permanências rupturas nos modos Romantismo: 2ª GERAÇÃO - Mal do Século (poesia) de representar sentimentos, visões de mundo e valores sociais.","Compreender como diferentes manifestações literárias – canônicas ou populares – dialogam entre si e com outras expressões artísticas (música, cinema, artes visuais contribuindo para a construção da sensibilidade estética crítica dos(as) estudantes.","Valorizar a diversidade cultural e artística presente literatura, reconhecendo a importância da produção literária local, nacional e internacional na formação da identidade das no entendimento da sociedade."],"descritores":[{"codigo":"D023_P","descricao":"Inferir uma informação implícita em texto."},{"codigo":"D030_P","descricao":"Identificar o conflito gerador do enredo e os elementos que constroem a narrativa."},{"codigo":"D062_P","descricao":"Identificar discursos que contribuíram para a formação da identidade nacional em textos da literatura brasileira"},{"codigo":"D043_P","descricao":"Reconhecer o efeito de sentido decorrente da exploração de recursos estilísticos."},{"codigo":"D017_P","descricao":"Identificar o gênero de textos variados."},{"codigo":"D032_P","descricao":"Identificar a tese de um"},{"codigo":"D033_P","descricao":"Reconhecer posições distintas entre duas ou opiniões relativas ao mesmo fato ou ao mesmo"},{"codigo":"D038_P","descricao":"Distinguir um fato da opinião relativa a esse fato."},{"codigo":"D061_P","descricao":"Estabelecer relação causa/consequência partes e elementos do texto."},{"codigo":"D055_P","descricao":"Estabelecer relação entre a tese e os argumentos oferecidos para sustentá-la."}]},{"serie":2,"trimestre":1,"pagina_fonte":28,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Recursos linguísticos e semióticos que operam nos textos pertencentes aos gêneros literários dos textos literários das origens à contemporaneidade. 1ª Habilidades da computação Não há. 2ª 3ª 28"],"expectativas":["Reconhecer os aspectos temáticos, estilísticos e históricos de característicos da 2ª geração do Romantismo, com ênfase no ultrarromantismo, como o pessimismo, o escapismo, os idealização da morte, do amor e da figura feminina.","Estabelecer relações intertextuais entre trechos de obras autores da 2ª geração (como Álvares de Azevedo) e de diferentes gêneros e épocas, identificando permanências e rupturas nos modos de representar sentimentos, visões mundo e valores sociais.","Compreender como diferentes manifestações literárias – canônicas ou populares – dialogam entre si e com outras expressões artísticas (música, cinema, artes visuais contribuindo para a construção da sensibilidade estética crítica dos(as) estudantes.","Valorizar a diversidade cultural e artística presente literatura, reconhecendo a importância da produção literária local, nacional e internacional na formação da identidade das no entendimento da sociedade."],"descritores":[{"codigo":"D021_P","descricao":"Localizar informações explícitas em um texto."},{"codigo":"D039_P","descricao":"Estabelecer relações lógico-discursivas presentes no texto, marcadas por conjunções, advérbios"},{"codigo":"D102_P","descricao":"Reconhecer o efeito de sentido decorrente exploração de recursos ortográficos e/ou morfossintáticos."}]},{"serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Recursos linguísticos e semióticos que operam nos textos pertencentes aos gêneros literários dos textos literários das origens à contemporaneidade."],"expectativas":["Reconhecer os principais movimentos das Vanguardas de Europeias e suas características estéticas e ideológicas.","Estabelecer relações intertextuais e interdiscursivas os entre as manifestações literárias e outras manifestações artísticas das Vanguardas Europeias.","Identificar discursos presentes nas Vanguardas contribuíram para a transformação das linguagens artísticas e para a formação de novas identidades culturais."],"descritores":[{"codigo":"D021_P","descricao":"Localizar informações explícitas em um texto."},{"codigo":"D024_P","descricao":"Identificar efeitos de ironia ou humor em textos variados."},{"codigo":"D062_P","descricao":"Identificar discursos que contribuíram para a formação da identidade nacional em textos da literatura brasileira."},{"codigo":"D043_P","descricao":"Reconhecer o efeito de sentido decorrente da exploração de recursos estilísticos."},{"codigo":"D057_P","descricao":"Interpretar texto com auxílio de material gráfico diverso (propagandas, quadrinhos, foto"},{"codigo":"D023_P","descricao":"Inferir uma informação implícita em um texto."},{"codigo":"D019_P","descricao":"Reconhecer diferentes formas de tratar informação na comparação de textos que tratam do mesmo tema, em função das condições em ele foi produzido e daquelas em que será recebido."},{"codigo":"D016_P","descricao":"Identificar a finalidade de textos de diferentes gêneros."},{"codigo":"D033_P","descricao":"Reconhecer posições distintas entre duas ou opiniões relativas ao mesmo fato ou ao mesmo"},{"codigo":"D038_P","descricao":"Distinguir um fato da opinião relativa a esse fato."}]},{"serie":1,"trimestre":2,"pagina_fonte":8,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["o contexto de produção, e recepção de textos e artísticos. - textos literários e artísticos na leitura/ de um texto efeitos de sentidos da"],"descritores":[]}]},{"codigo":"EM13LP52","materia_codigo":"portugues","descricao":"Analisar obras significativas das literaturas brasileiras e de outros países e povos, em especial a portuguesa, a indígena, a africana e a latino-americana, com base em ferramentas da crítica literária (estrutura da composição, estilo, aspectos discursivos) ou outros critérios relacionados a diferentes matrizes culturais, considerando o contexto de produção (visões de mundo, diálogos com outros textos, inserções em movimentos estéticos e culturais etc.) e o modo como dialogam com o presente. *Legenda de cores por Padrão de Abaixo do básico Básico Proficiente Avançado","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":23,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Estilo dos textos literários das origens à contemporaneidade;","Efeito de sentido dos textos literários das origens à contemporaneidade;","Recursos linguísticos e semióticos que operam nos textos pertencentes aos gêneros literários. 1ª"],"expectativas":["Analisar poemas da 2ª geração do Romantismo brasileiro de à luz de seus aspectos estruturais, temáticos e estilísticos, relacionando-os ao contexto histórico e cultural em foram produzidos.","Identificar traços das visões de mundo românticas (como idealização da morte, do amor e da figura feminina) estabelecer diálogos com produções literárias de outras culturas e épocas, especialmente das literaturas portuguesa, indígena, africana e latino-americana.","Inferir sentidos presentes nos textos literários e comparar diferentes formas de tratar temas universais (como solidão, morte, juventude, melancolia), considerando os contextos socioculturais e os efeitos produzidos pelas escolhas estilísticas dos autores. à Descritores do PAEBES D023_P Inferir uma informação implícita em um D030_P Identificar o conflito gerador do enredo e os elementos que constroem a narrativa. D062_P Identificar discursos que contribuíram para a formação da identidade nacional em textos da literatura brasileira D043_P Reconhecer o efeito de sentido decorrente da exploração de recursos estilísticos. D017_P Identificar o gênero de textos variados. D023_P Inferir uma informação implícita em texto. D032_P Identificar a tese de um D033_P Reconhecer posições distintas entre duas ou a opiniões relativas ao mesmo fato ou ao mesmo D038_P Distinguir um fato da opinião relativa a esse fato. D061_P Estabelecer relação causa/consequência partes e elementos do texto. D055_P Estabelecer relação entre a tese e os argumentos oferecidos para sustentá-la."],"descritores":[{"codigo":"D023_P","descricao":"Inferir uma informação implícita em texto."},{"codigo":"D030_P","descricao":"Identificar o conflito gerador do enredo e os elementos que constroem a narrativa."},{"codigo":"D062_P","descricao":"Identificar discursos que contribuíram para a formação da identidade nacional em textos da literatura brasileira"},{"codigo":"D043_P","descricao":"Reconhecer o efeito de sentido decorrente da exploração de recursos estilísticos."},{"codigo":"D017_P","descricao":"Identificar o gênero de textos variados."},{"codigo":"D032_P","descricao":"Identificar a tese de um"},{"codigo":"D033_P","descricao":"Reconhecer posições distintas entre duas ou a opiniões relativas ao mesmo fato ou ao mesmo"},{"codigo":"D038_P","descricao":"Distinguir um fato da opinião relativa a esse fato."},{"codigo":"D061_P","descricao":"Estabelecer relação causa/consequência partes e elementos do texto."},{"codigo":"D055_P","descricao":"Estabelecer relação entre a tese e os argumentos oferecidos para sustentá-la."}]},{"serie":2,"trimestre":1,"pagina_fonte":29,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Estilo dos textos literários das origens à contemporaneidade;","Efeito de sentido dos textos literários das origens à contemporaneidade;","Recursos linguísticos e semióticos que operam nos textos pertencentes aos gêneros literários. 1ª Habilidades da computação EM13CO20 Criar conteúdos, disponibilizando-os em ambientes virtuais para publicação e compartilhamento, avaliando a 2ª confiabilidade e as consequências da disseminação dessas informações. 3ª 29"],"expectativas":["Analisar trechos de romances, contos e demais narrativas de da 2ª geração do Romantismo brasileiro à luz de aspectos estruturais, temáticos e estilísticos, relacionando-os ao contexto histórico e cultural em que foram produzidos.","Identificar traços das visões de mundo românticas (como idealização da morte, do amor e da figura feminina) estabelecer diálogos com produções literárias de outras culturas e épocas, especialmente das literaturas portuguesa, indígena, africana e latino-americana.","Inferir sentidos presentes nos textos literários e comparar diferentes formas de tratar temas universais (como solidão, morte, juventude, melancolia), considerando os contextos socioculturais e os efeitos produzidos pelas escolhas estilísticas dos autores. à"],"descritores":[{"codigo":"D021_P","descricao":"Localizar informações explícitas em um texto."},{"codigo":"D039_P","descricao":"Estabelecer relações lógico-discursivas presentes no texto, marcadas por conjunções, advérbios"},{"codigo":"D102_P","descricao":"Reconhecer o efeito de sentido decorrente exploração de recursos ortográficos e/ou morfossintáticos."}]},{"serie":1,"trimestre":2,"pagina_fonte":9,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["efeitos de sentidos pelos usos de recursos e multissemióticos. visões de mundo e culturais ficcionalizados em a seus contextos de textos e discursos de das literaturas brasileira, africana, indígenas e -"],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":21,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["Analisar efeitos de sentidos EM13CO20 Criar provocados pelos usos de conteúdos, recursos linguísticos e disponibilizando-os em multissemióticos. ambientes virtuais para Relacionar visões de mundo e publicação e valores culturais compartilhamento, ficcionalizados em textos a avaliando a seus contextos de produção. confiabilidade e as consequências da disseminação dessas informações."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":23,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf","unidade_tematica":"","objetos":[],"expectativas":["efeitos de sentidos EM13CO20 Criar pelos usos de recursos conteúdos, e multissemióticos. disponibilizando-os em visões de mundo e ambientes virtuais para ficcionalizados em publicação e seus contextos de compartilhamento, avaliando a confiabilidade e textos e discursos de as consequências da literaturas brasileira, disseminação dessas africana, indígenas e informações."],"descritores":[]}]},{"codigo":"EM13LP53","materia_codigo":"portugues","descricao":"Produzir apresentações e comentários apreciativos e críticos sobre livros, filmes, discos, canções, espetáculos de teatro e A dança, exposições etc. (resenhas, vlogs e podcasts literários e artísticos, playlists comentadas, fanzines, e-zines etc.).","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf","unidade_tematica":"","objetos":["Apreender o sentido geral dos textos;","Apreciação e réplica dos textos literários das origens à contemporaneidade;","Manifestações literárias."],"expectativas":["Avaliar diferentes objetos do campo artístico-literário (livros, filmes, canções, espetáculos e dança, exposições etc.). e • Produzir textos de apreciação, em diferentes gêneros, e linguagens e mídias.","Inferir posicionamentos e avaliações implícitas na resenha partir do uso de adjetivos, argumentos indiretos e estratégias linguísticas que sugerem opinião sem explicitá-la totalmente.","Identificar a tese central da resenha e avaliar argumentos apresentados ao longo do texto a sustentam forma lógica, coerente e persuasiva.","Compreender a argumentação da resenha por meio relações de causa e consequência."],"descritores":[{"codigo":"D023_P","descricao":"Inferir uma informação implícita em texto."},{"codigo":"D030_P","descricao":"Identificar o conflito gerador do enredo e os elementos que constroem a narrativa."},{"codigo":"D062_P","descricao":"Identificar discursos que contribuíram para a formação da identidade nacional em textos da literatura brasileira"},{"codigo":"D043_P","descricao":"Reconhecer o efeito de sentido decorrente da exploração de recursos estilísticos."},{"codigo":"D017_P","descricao":"Identificar o gênero de textos variados."},{"codigo":"D032_P","descricao":"Identificar a tese de um"},{"codigo":"D033_P","descricao":"Reconhecer posições distintas entre duas ou opiniões relativas ao mesmo fato ou ao mesmo a"},{"codigo":"D038_P","descricao":"Distinguir um fato da opinião relativa a esse fato."},{"codigo":"D061_P","descricao":"Estabelecer relação causa/consequência partes e elementos do texto."},{"codigo":"D055_P","descricao":"Estabelecer relação entre a tese e os argumentos oferecidos para sustentá-la."}]}]},{"codigo":"EM13CNT101","materia_codigo":"quimica","descricao":"Analisar e representar, com ou sem o uso de dispositivos e de aplicativos digitais específicos, as transformações e conservações em sistemas que envolvam quantidade de A matéria, de energia e de movimento para realizar previsões sobre seus comportamentos em situações cotidianas e em processos produtivos que priorizem o desenvolvimento sustentável, o uso consciente dos recursos naturais e a preservação da vida em todas as suas formas.","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":21,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e universo","objetos":["Funções inorgânicas (Compostos inorgânicos)","Funções ácido, base, sal e óxido.","Regras gerais de nomenclatura de ácido, base, sal e óxido.","Reações de neutralização."],"expectativas":["Identificar através dos grupos funcionais os ácidos, as bases, os sais e os óxidos.","Identificar através da composição química os ácidos, bases, os sais e os óxidos.","Compreender como os sais são formados a partir de reações e de neutralização entre ácidos e bases. e de e e a"],"descritores":[]},{"serie":2,"trimestre":3,"pagina_fonte":38,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Matéria e energia","objetos":["Eletroquímica","Eletrólise."],"expectativas":["Compreender o processo de eletrólise.","Analisar as transformações de energia e matéria envolvidas. e e de e"],"descritores":[]}]},{"codigo":"EM13CNT101QUIa/ES","materia_codigo":"quimica","descricao":"Analisar e representar, com ou sem o uso de dispositivos e de aplicativos digitais específicos, as transformações e conservações em sistemas que envolvam quantidade de A matéria e energia, em situações cotidianas, identificando as propriedades físicas e químicas dos materiais e substâncias, assim como relacioná-las à aplicações tecnológicas em processos de extração, separação e purificação de substâncias, priorizando processos produtivos que visem o desenvolvimento sustentável, o uso consciente dos recursos naturais e a preservação da vida em todas as suas formas.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":12,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Matéria e energia","objetos":["Matéria (Propriedades dos materiais e substâncias)","Propriedades físicas (densidade, ponto de fusão, ponto de ebulição, maleabilidade, ductilidade, tenacidade, dureza, solubilidade, condutividade térmica e elétrica, entre outras).","Transformações físicas.","Mudanças de estados físicos.","Ciclo da água."],"expectativas":["Compreender as propriedades físicas dos materiais, densidade, ponto de fusão, ponto de ebulição, maleabilidade, ductilidade, tenacidade, dureza, solubilidade, condutividade térmica e elétrica, entre outras).","Entender as transformações físicas, como mudanças e estado físico e misturas das substâncias. e","Analisar e representar as transformações que ocorrem de ciclo da água. as de o"],"descritores":[]}]},{"codigo":"EM13CNT101QUIb/ES","materia_codigo":"quimica","descricao":"Analisar e representar, com ou sem o uso de dispositivos e de aplicativos digitais específicos, a interação entre matéria e energia, considerando as diferentes ligações químicas, A assim como os compostos moleculares, metálicos e iônicos resultantes dessa combinação.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":17,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e universo","objetos":["Ligações Químicas TI •Regra do octeto.","Ligação iônica.","Ligação covalente.","Ligação metálica."],"expectativas":["Identificar as características das ligações iônicas, covalentes e metálicas.","Prever a formação de ligações iônicas e covalentes base na regra do octeto.","Representar as estruturas dos compostos formados e ligações iônicas, covalentes e metálicas."],"descritores":[]}]},{"codigo":"EM13CNT101QUIc/ES","materia_codigo":"quimica","descricao":"Analisar e representar, com ou sem o uso de dispositivos e de aplicativos digitais específicos, as transformações e conservações em sistemas que envolvam quantidade de A matéria e energia, considerando as mudanças qualitativas envolvidas nas reações químicas, resultante do rearranjo das ligações entre os átomos, assim como as leis que regem essas transformações.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":19,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e universo","objetos":["Transformações químicas TI","Diferença entre transformações físicas e químicas.","Reagentes e produtos de uma reação química.","Representação de reações químicas por meio de equações químicas.","Classificação das Reações Químicas (Síntese, decomposição, substituição e dupla troca).","Lei da conservação das massas (Lei de Lavoisier).","Lei das proporções definidas (Lei de Proust)."],"expectativas":["Compreender o conceito de reações químicas.","Explicar os conceitos de reagentes e produtos em reação química.","Representar as reações químicas por meio de equações químicas. e","Classificar os tipos de reações químicas, como síntese, e decomposição, substituição e dupla troca, oxirredução, de ionização, dissociação.","Compreender a lei da conservação das massas (Lei das Lavoisier) e a lei das proporções definidas (Lei de Proust)."],"descritores":[]}]},{"codigo":"EM13CNT101QUId/ES","materia_codigo":"quimica","descricao":"Analisar e representar, com ou sem o uso de dispositivos e de aplicativos digitais específicos, as transformações e conservações em sistemas que envolvam quantidade de A matéria, considerando a análise quantitativa das substâncias consumidas e formadas em uma reação química.","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":23,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Matéria e energia","objetos":["Cálculo estequiométrico TI •Mol.","Massa molar.","Volume molar","Balanceamento de equações químicas."],"expectativas":["Aplicar conceitos de mol, massa molar e volume molar realizar cálculos.","Balancear equações químicas. e e de"],"descritores":[]},{"serie":2,"trimestre":1,"pagina_fonte":27,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Matéria e energia","objetos":["Cálculo estequiométrico TI","Mol.","Massa molar.","Volume molar","Balanceamento de equações químicas."],"expectativas":["Aplicar conceitos de mol, massa molar e volume molar realizar cálculos.","Balancear equações químicas. e e de"],"descritores":[]}]},{"codigo":"EM13CNT101QUIe/ES","materia_codigo":"quimica","descricao":"Analisar e representar, com ou sem o uso de dispositivos e de aplicativos digitais específicos, as transformações e conservações em sistemas que envolvam quantidade de A matéria e energia, considerando as variáveis que podem modificar a velocidade com que uma transformação química ocorre, reconhecendo a importância do controle, aceleração ou retardamento de processos, da velocidade de transformações que ocorrem na natureza e no sistema produtivo, priorizando processos produtivos que visem o desenvolvimento sustentável, o uso consciente dos recursos naturais e a preservação da vida em todas as suas formas.","ocorrencias":[{"serie":2,"trimestre":2,"pagina_fonte":35,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Cinética química","Velocidade de reação","Teoria das colisões."],"expectativas":["Relacionar a velocidade de reação com a frequência colisões entre as moléculas dos reagentes.","Identificar as principais características da teoria das colisões. e e de"],"descritores":[]}]},{"codigo":"EM13CNT101QUIf/ES","materia_codigo":"quimica","descricao":"Analisar e representar, com ou sem o uso de dispositivos e de aplicativos digitais específicos, as transformações e conservações em sistemas que envolvam quantidade de A matéria e energia, considerando as transformações químicas em que reagentes e produtos coexistem, num estado de equilíbrio químico, identificando variáveis que interferem no equilíbrio químico, prevendo perturbações no estado de equilíbrio e investigando o controle dessas variáveis no sistema produtivo e em sistemas naturais.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":39,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Equilíbrio químico","Definição de equilíbrio químico.","Reações reversíveis e irreversíveis.","Expressão da constante de equilíbrio (Kc) para reações químicas.","Princípio de Le Châtelier.","pH"],"expectativas":["Entender o conceito de equilíbrio dinâmico em reações reversíveis.","Representar a constante de equilíbrio.","Interpretar os valores da constante de equilíbrio para prever a extensão da reação e a predominância de produtos e reagentes. e","Prever o impacto de diferentes perturbações (mudanças de concentração, temperatura, pressão, volume e catalisadores) no estado de equilíbrio químico. de","Classificar soluções como ácidas, neutras ou básicas base no valor do pH. no"],"descritores":[]}]},{"codigo":"EM13CNT101QUIg/ES","materia_codigo":"quimica","descricao":"Analisar e representar, com ou sem o uso de dispositivos e de aplicativos digitais específicos, as transformações e conservações em sistemas que envolvam quantidade de A matéria e energia, energia liberada ou consumida em transformações químicas, a partir do conceito de energia de ligação, e avaliar qualitativamente e quantitativamente valores de energia envolvidos em diferentes processos químicos.","ocorrencias":[{"serie":2,"trimestre":2,"pagina_fonte":31,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Termoquímica","Processos endotérmicos e exotérmicos.","Entalpia.","Equações termoquímicas.","Energia de ligação."],"expectativas":["Entender processos endotérmicos e exotérmicos.","Representar e interpretar equações termoquímicas.","Calcular a variação de entalpia (ΔH) para reações utilizando a energia de ligação. e e de em"],"descritores":[]}]},{"codigo":"EM13CNT101QUIh/ES","materia_codigo":"quimica","descricao":"Analisar e representar, com ou sem o uso de dispositivos e de aplicativos digitais específicos, as transformações e conservações em sistemas que envolvam quantidade de A matéria e energia considerando as mudanças envolvidas nas reações químicas, resultante dos processos nucleares e liberação de partículas, priorizando processos produtivos que visem o desenvolvimento sustentável, o uso consciente dos recursos naturais e a preservação da vida em todas as suas formas.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":41,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Radioatividade","Tipos de radiação (alfa, beta e gama).","1ª e 2ª leis da radioatividade.","Meia-vida.","Fissão Nuclear.","Fusão nuclear."],"expectativas":["Diferenciar os tipos de radiação com base em características, como natureza, carga, poder de penetração e alcance.","Compreender os processos de desintegração radioativa (1ª e 2ª leis da radioatividade) e como cada uma afeta e composição do núcleo atômico. e","Representar os decaimentos dos isótopos radioativos de mudanças que ocorrem na quantidade de matéria e energia durante esse processo. e","Calcular a meia-vida de diferentes isótopos radioativos. que","Diferenciar os processos de fissão e fusão nuclear, explicando dos como cada um ocorre. suas"],"descritores":[]}]},{"codigo":"EM13CNT101QUIi/ES","materia_codigo":"quimica","descricao":"Analisar e representar, com ou sem o uso de dispositivos e de aplicativos digitais específicos, a interação entre matéria e energia, considerando as diferentes ligações químicas A entre carbono e demais elementos químicos, resultando em diferentes compostos químicos, agrupados em funções orgânicas com propriedades e características definidas.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":43,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["TI Estrutura dos compostos orgânicos","O átomo de carbono.","Fórmulas moleculares e estruturais.","Classificação das cadeias carbônicas."],"expectativas":["Reconhecer o carbono como o elemento central compostos orgânicos.","Identificar ligações simples, duplas e triplas.","Interpretar diferentes estruturas de compostos orgânicos, incluindo fórmulas moleculares e estruturais. e","Classificar cadeias carbônicas."],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":43,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["TI Estrutura dos compostos orgânicos","O átomo de carbono.","Fórmulas moleculares e estruturais.","Classificação das cadeias carbônicas."],"expectativas":["Reconhecer o carbono como o elemento central compostos orgânicos.","Identificar ligações simples, duplas e triplas.","Interpretar diferentes estruturas de compostos orgânicos, incluindo fórmulas moleculares e estruturais. e","Classificar cadeias carbônicas."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":43,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["TI Estrutura dos compostos orgânicos","O átomo de carbono.","Fórmulas moleculares e estruturais.","Classificação das cadeias carbônicas."],"expectativas":["Reconhecer o carbono como o elemento central compostos orgânicos.","Identificar ligações simples, duplas e triplas.","Interpretar diferentes estruturas de compostos orgânicos, incluindo fórmulas moleculares e estruturais. e","Classificar cadeias carbônicas."],"descritores":[]},{"serie":3,"trimestre":1,"pagina_fonte":44,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Hidrocarbonetos.","Estrutura básica dos alcanos, alcenos, alcinos, cicloalcanos, cicloalquenos e aromáticos.","Regras de nomenclatura dos hidrocarbonetos."],"expectativas":["Reconhecer a estrutura básica dos hidrocarbonetos.","Classificar hidrocarbonetos em alcanos, alcenos, alcinos, cicloalcanos, cicloalquenos e aromáticos, compreendendo as características estruturais e as diferenças entre grupos. e","Compreender as regras básicas de nomenclatura hidrocarbonetos."],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":44,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Hidrocarbonetos.","Estrutura básica dos alcanos, alcenos, alcinos, cicloalcanos, cicloalquenos e aromáticos.","Regras de nomenclatura dos hidrocarbonetos."],"expectativas":["Reconhecer a estrutura básica dos hidrocarbonetos.","Classificar hidrocarbonetos em alcanos, alcenos, alcinos, cicloalcanos, cicloalquenos e aromáticos, compreendendo as características estruturais e as diferenças entre grupos. e","Compreender as regras básicas de nomenclatura hidrocarbonetos."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":44,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Hidrocarbonetos.","Estrutura básica dos alcanos, alcenos, alcinos, cicloalcanos, cicloalquenos e aromáticos.","Regras de nomenclatura dos hidrocarbonetos."],"expectativas":["Reconhecer a estrutura básica dos hidrocarbonetos.","Classificar hidrocarbonetos em alcanos, alcenos, alcinos, cicloalcanos, cicloalquenos e aromáticos, compreendendo as características estruturais e as diferenças entre grupos. e","Compreender as regras básicas de nomenclatura hidrocarbonetos."],"descritores":[]},{"serie":3,"trimestre":1,"pagina_fonte":46,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["TI Funções orgânicas","Funções oxigenadas (álcool, enol, fenol, aldeído, cetona, ácido carboxílico, éter, éster).","Funções nitrogenadas (amina e amida).","Regras de nomenclatura de funções orgânicas."],"expectativas":["Identificar os grupos funcionais das principais funções orgânicas (álcool, enol, fenol, aldeído, cetona, carboxílico, éter, éster, amina e amidas).","Classificar compostos orgânicos de acordo com funções orgânicas. e","Compreender as regras básicas de nomenclatura diferentes funções orgânicos."],"descritores":[]},{"serie":3,"trimestre":2,"pagina_fonte":46,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["TI Funções orgânicas","Funções oxigenadas (álcool, enol, fenol, aldeído, cetona, ácido carboxílico, éter, éster).","Funções nitrogenadas (amina e amida).","Regras de nomenclatura de funções orgânicas."],"expectativas":["Identificar os grupos funcionais das principais funções orgânicas (álcool, enol, fenol, aldeído, cetona, carboxílico, éter, éster, amina e amidas).","Classificar compostos orgânicos de acordo com funções orgânicas. e","Compreender as regras básicas de nomenclatura diferentes funções orgânicos."],"descritores":[]},{"serie":3,"trimestre":3,"pagina_fonte":46,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["TI Funções orgânicas","Funções oxigenadas (álcool, enol, fenol, aldeído, cetona, ácido carboxílico, éter, éster).","Funções nitrogenadas (amina e amida).","Regras de nomenclatura de funções orgânicas."],"expectativas":["Identificar os grupos funcionais das principais funções orgânicas (álcool, enol, fenol, aldeído, cetona, carboxílico, éter, éster, amina e amidas).","Classificar compostos orgânicos de acordo com funções orgânicas. e","Compreender as regras básicas de nomenclatura diferentes funções orgânicos."],"descritores":[]}]},{"codigo":"EM13CNT103","materia_codigo":"quimica","descricao":"Utilizar o conhecimento sobre as radiações e suas origens para avaliar as potencialidades e os riscos de sua aplicação em equipamentos de uso cotidiano, na saúde, no ambiente, A na indústria, na agricultura e na geração de energia elétrica.","ocorrencias":[{"serie":3,"trimestre":1,"pagina_fonte":42,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Matéria e Energia","objetos":["Radioatividade","Utilização da radiação. TI","Usinas nucleares.","Datação por C-14.","Bombas atômicas.","Acidentes nucleares e vazamentos radioativos."],"expectativas":["Identificar as aplicações da radioatividade em diferentes contextos.","Identificar os riscos da exposição à radiação e as medidas de proteção."],"descritores":[]}]},{"codigo":"EM13CNT104QUI/ES","materia_codigo":"quimica","descricao":"Avaliar os benefícios e os riscos à saúde e ao ambiente dos produtos e materiais usados no cotidiano, considerando sua composição, toxicidade e reatividade, como também A o nível de exposição a eles, posicionando-se criticamente e propondo soluções individuais e/ou coletivas para um consumo consciente, descarte responsável e/ou reciclagem.","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":22,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e universo","objetos":["TI Funções inorgânicas (Compostos inorgânicos)","Regras gerais de nomenclatura de ácido, base, sal e óxido.","Compostos inorgânicos do cotidiano.","Escala de pH."],"expectativas":["Identificar a nomenclatura dos ácidos, das bases, dos dos óxidos.","Compreender as aplicações dos principais ácidos, bases, sais e óxidos.","Identificar através da escola de pH compostos ácidos, dos básicos e neutros. um"],"descritores":[]}]},{"codigo":"EM13CNT107QUI/ES","materia_codigo":"quimica","descricao":"Realizar previsões qualitativas e quantitativas sobre o funcionamento de pilhas e baterias, com base na análise dos processos de transformação e condução de energia A envolvidos – com ou sem o uso de dispositivos e aplicativos digitais –, para propor ações que visem a sustentabilidade, apresentado os impactos causados no ambiente pelo descarte irregular e o correto manejo (descarte e reciclagem) desses materiais.","ocorrencias":[{"serie":2,"trimestre":3,"pagina_fonte":37,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Eletroquímica","Funcionamento e componentes de células galvânicas.","Potencial padrão de eletrodo e cálculo da força eletromotriz (FEM)."],"expectativas":["Compreender o funcionamento de uma célula galvânica.","Utilizar equações químicas para ilustrar a reação oxidação, redução e global em uma célula galvânica.","Calcular a diferença de potencial (força eletromotriz, de uma célula galvânica usando potenciais padrão o eletrodo. pelo"],"descritores":[]}]},{"codigo":"EM13CNT201QUI/ES","materia_codigo":"quimica","descricao":"Analisar e discutir modelos e teorias propostas, em diferentes épocas e culturas, considerando as teorias atômicas desenvolvidas ao longo da história da humanidade, A comparando-os com o modelo atômico moderno.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":15,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Matéria e energia","objetos":["Estrutura da matéria e modelos atômicos.","Modelo atômico de Dalton","Modelo atômico de Thomson","Modelo atômico de Rutherford TI •Modelo atômico de Bohr","Prótons, nêutrons e elétrons: propriedades e localização.","Número atômico (Z), número de massa (A).","Semelhanças atômicas: Isótopos, isótonos, isóbaros e isoeletrônico.","Eletrosfera: níveis e subníveis de energia.","Íons: cátions e ânions.","Configuração eletrônica: distribuição dos elétrons nos níveis e subníveis."],"expectativas":["Entender como cada um dos modelos tentou explicar estrutura da matéria de acordo com as evidências disponíveis em sua época.","Comparar as características dos modelos de Dalton, Thomson, Rutherford e Bohr.","Descrever a estrutura básica do átomo, incluindo prótons, nêutrons e elétrons, e suas respectivas localizações no núcleo e na eletrosfera.","Reconhecer as propriedades das partículas subatômicas (prótons, nêutrons e elétrons), como massa e carga.","Entender os conceitos de massa atômica e número atômico.","Compreender experimentos históricos significativos contribuíram para o desenvolvimento dos modelos atômicos, como o experimento da ampola de crooks, de Rutherford, o experimento de Millikan e o espectro de emissão hidrogênio de Bohr.","Identificar e diferenciar os conceitos de isótopos, isótonos, isóbaros e isoeletrônicos.","Resolver problemas sobre semelhanças atômicas.","Entender como os elétrons se organizam nas camadas e redor do núcleo dos átomos.","Compreender como os átomos se tornam cátions ou ânions por meio da perda ou ganho de elétrons.","Reconhecer que cátions são íons carregados positivamente (perda de elétrons) e ânions são íons carregados negativamente (ganho de elétrons).","Compreender como a distribuição de elétrons pode mudar quando um átomo ganha ou perde elétrons para formar e como isso afeta sua estabilidade."],"descritores":[]}]},{"codigo":"EM13CNT204QUIa/ES","materia_codigo":"quimica","descricao":"Elaborar explicações, previsões e cálculos, relacionando a proporção de reagentes consumidos e produtos formados em uma reação química, com ou sem o uso de dispositivos A e aplicativos digitais (como softwares de simulação e de realidade virtual, entre outros).","ocorrencias":[{"serie":1,"trimestre":3,"pagina_fonte":24,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Matéria e energia","objetos":["TI Cálculo estequiométrico","Cálculo de quantidade de reagentes e produtos.","Coeficientes estequiométricos."],"expectativas":["Calcular e prever as quantidades de reagentes e produtos em uma reação química. a de"],"descritores":[]},{"serie":2,"trimestre":1,"pagina_fonte":28,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Matéria e energia","objetos":["TI Cálculo estequiométrico","Cálculo de quantidade de reagentes e produtos.","Coeficientes estequiométricos."],"expectativas":["Calcular e prever as quantidades de reagentes e produtos em uma reação química. a de"],"descritores":[]}]},{"codigo":"EM13CNT204QUIb/ES","materia_codigo":"quimica","descricao":"Elaborar explicações, previsões e cálculos, envolvidos na formação de soluções, em sistemas naturais e industriais, utilizando unidades de concentração usuais e as que A expressam quantidade de matéria, com ou sem o uso de dispositivos e aplicativos digitais (com softwares de simulação e de realidade virtual, entre outros).","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":29,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["Soluções TI","Soluto e solvente.","Concentração molar.","Concentração comum.","Título em massa e volume.","Concentração em ppm e em ppb.","Densidade."],"expectativas":["Compreender o conceito de solução.","Identificar os componentes de uma solução: soluto solvente.","Calcular diferentes tipos de concentrações (molar, comum, título, ppm, ppb, densidade, dentre outras) de soluções. na que de"],"descritores":[]}]},{"codigo":"EM13CNT205QUIa/ES","materia_codigo":"quimica","descricao":"Conduzir atividades experimentais, interpretar resultados e realizar previsões sobre atividades experimentais relacionadas com os processos tecnológicos de extração, separação A e purificação de substâncias, com base nas noções de probabilidade e incerteza, reconhecendo os limites explicativos das ciências.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":14,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Matéria e energia","objetos":["TI Matéria (Propriedades dos materiais e substâncias)","Técnicas de separação de materiais (filtração, destilação, decantação, cromatografia, cristalização, extração por solvente, centrifugação, entre outros)."],"expectativas":["Identificar e aplicar técnicas de separação de misturas base nas propriedades dos componentes, como filtração, destilação, decantação, cromatografia, cristalização, extração por solvente, centrifugação, entre outros.","Prever resultados em novos cenários para antecipar e comportamento de substâncias em processos de extração, separação e purificação."],"descritores":[]}]},{"codigo":"EM13CNT205QUIb/ES","materia_codigo":"quimica","descricao":"Conduzir atividades experimentais, interpretar resultados e realizar previsões sobre atividades experimentais relacionadas às transformações químicas, com base nas A noções de probabilidade e incerteza, reconhecendo os limites explicativos das ciências.","ocorrencias":[{"serie":1,"trimestre":2,"pagina_fonte":20,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e universo","objetos":["Transformações química TI •Classificação das Reações Químicas (Síntese, decomposição, substituição e dupla troca).","Evidências de uma transformação química (mudanças de cor, formação de precipitados, liberação ou absorção de calor, liberação de luz e mudança de odor)."],"expectativas":["Identificar os tipos de reações químicas (síntese, decomposição, substituição e dupla troca).","Reconhecer as evidências de que uma transformação química ocorreu, como mudanças de cor, formação precipitados, liberação ou absorção de calor, liberação luz e mudança de odor. nas os"],"descritores":[]}]},{"codigo":"EM13CNT205QUIc/ES","materia_codigo":"quimica","descricao":"Conduzir atividades experimentais, interpretar resultados e realizar previsões sobre atividades experimentais relacionadas ao preparo de soluções e cálculo de concentrações usuais A e que expressam quantidade de matéria, com base nas noções de probabilidade e incerteza, reconhecendo os limites explicativos das ciências.","ocorrencias":[{"serie":2,"trimestre":1,"pagina_fonte":30,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Vida e Evolução","objetos":["Soluções TI","Preparo de soluções.","Concentração molar.","Concentração comum.","Título em massa e volume.","Concentração em ppm e em ppb.","Densidade."],"expectativas":["Calcular a quantidade de soluto necessária para preparar soluções com concentrações específicas.","Calcular a composição de soluções em variados contextos químicos. e nas os"],"descritores":[]}]},{"codigo":"EM13CNT205QUId/ES","materia_codigo":"quimica","descricao":"Conduzir atividades experimentais, interpretar resultados e realizar previsões sobre atividades experimentais relacionadas ao controle, aceleração ou retardamento de processos, da A velocidade de transformações que ocorrem na natureza e no sistema produtivo, voltado a otimização de processos e economia de recursos naturais, com base nas noções de probabilidade e incerteza, reconhecendo os limites explicativos das ciências.","ocorrencias":[{"serie":2,"trimestre":2,"pagina_fonte":36,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Cinética química","Fatores que influenciam a velocidade das reações."],"expectativas":["Identificar os fatores que afetam a velocidade das reações químicas, como concentração dos reagentes, temperatura, presença de catalisadores e área de superfícial. e da"],"descritores":[]}]},{"codigo":"EM13CNT205QUIe/ES","materia_codigo":"quimica","descricao":"Conduzir atividades experimentais, interpretar resultados e realizar previsões sobre atividades experimentais relacionadas a energia liberada ou consumida em transformações A químicas, com base nas noções de probabilidade e incerteza, reconhecendo os limites explicativos das ciências.","ocorrencias":[{"serie":2,"trimestre":2,"pagina_fonte":33,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["TI Termoquímica","Entalpia padrão de formação.","Lei de Hess."],"expectativas":["Calcular a variação de entalpia (ΔH) para reações utilizando entalpia de formação e lei de Hess. e"],"descritores":[]}]},{"codigo":"EM13CNT206","materia_codigo":"quimica","descricao":"Discutir a importância da preservação e conservação da biodiversidade, considerando parâmetros qualitativos e quantitativos, e avaliar os efeitos da ação humana e das A políticas ambientais para a garantia da sustentabilidade do planeta.","ocorrencias":[{"serie":2,"trimestre":2,"pagina_fonte":34,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["TI Termoquímica","Reações de combustão.","Entalpia padrão de combustão."],"expectativas":["Representar e interpretar reações de combustão.","Realizar cálculos da variação de entalpia em uma reação de combustão. da e das do"],"descritores":[]}]},{"codigo":"EM13CNT302","materia_codigo":"quimica","descricao":"Comunicar, para públicos variados, em diversos contextos, resultados de análises, pesquisas e/ou experimentos, elaborando e/ou interpretando textos, gráficos, tabelas, A símbolos, códigos, sistemas de classificação e equações, por meio de diferentes linguagens, mídias, tecnologias digitais de informação e comunicação (TDIC), de modo a participar e/ou promover debates em torno de temas científicos e/ou tecnológicos de relevância sociocultural e ambiental.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":13,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Matéria e energia","objetos":["Matéria (Propriedades dos materiais e substâncias)","Substância pura (Simples e composta).","Mistura (homogênea e heterogênea).","Gráficos de aquecimento e resfriamento de substâncias e misturas.","Gráficos de solubilidade."],"expectativas":["Diferenciar materiais e substâncias com base em composição, como substâncias puras (elementos compostos) e misturas (homogêneas – comuns, eutéticas azeotrópicas-e heterogêneas).","Diferenciar substâncias e misturas utilizando dados apresentados em gráficos e tabelas, como dados aquecimento, de resfriamento.","Analisar como variáveis como temperatura, pressão por umidade influenciam as propriedades e o comportamento dos materiais."],"descritores":[]}]},{"codigo":"EM13CNT302QUI/ES","materia_codigo":"quimica","descricao":"Interpretar e comunicar, para públicos variados, em diversos contextos, resultados de análises, pesquisas e/ ou experimentos, elaborando e/ou interpretando textos, A gráficos, tabelas, símbolos, códigos, sistemas de classificação e equações químicas, por meio de diferentes linguagens, mídias, tecnologias digitais de informação e comunicação (TDIC), de modo a participar e/ou promover debates em torno de temas científicos e/ou tecnológicos de relevância sociocultural e ambiental.","ocorrencias":[{"serie":2,"trimestre":2,"pagina_fonte":32,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["Termoquímica","Representação gráfica das curvas de energia de reações endotérmicas e exotérmicas."],"expectativas":["Interpretar diagramas de entalpia (curvas de energia). em e/"],"descritores":[]}]},{"codigo":"EM13CNT307","materia_codigo":"quimica","descricao":"Analisar as propriedades dos materiais para avaliar a adequação de seu uso em diferentes aplicações (industriais, cotidianas, arquitetônicas ou tecnológicas) e/ou propor A soluções seguras e sustentáveis considerando seu contexto local e cotidiano.","ocorrencias":[{"serie":1,"trimestre":1,"pagina_fonte":16,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e universo","objetos":["Tabela periódica","Organização da tabela periódica atual. TI","Classificação dos elementos em metais, ametais e gases nobres.","Elementos representativos e elementos de transição.","Relação da configuração eletrônica dos elementos com a sua posição na tabela.","Propriedades periódicas."],"expectativas":["Compreender a organização da tabela em ordem crescente de número atômico, em famílias (ou grupos) e em períodos.","Identificar as principais famílias de elementos (metais alcalinos, metais alcalinos-terrosos, calcogênios, halogênios gases nobres). a","Classificar os elementos em metais, ametais e gases nobres de acordo com suas propriedades.","Diferenciar elementos representativos (blocos s e p) elementos de transição (blocos d e f).","Entender como a configuração eletrônica dos elementos está relacionada à sua posição na tabela.","Compreender as propriedades periódicas e suas variações ao longo dos grupos e períodos na Tabela Periódica.","Prever a reatividade com base em suas propriedades periódicas."],"descritores":[]},{"serie":1,"trimestre":2,"pagina_fonte":16,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e universo","objetos":["Tabela periódica","Organização da tabela periódica atual. TI","Classificação dos elementos em metais, ametais e gases nobres.","Elementos representativos e elementos de transição.","Relação da configuração eletrônica dos elementos com a sua posição na tabela.","Propriedades periódicas."],"expectativas":["Compreender a organização da tabela em ordem crescente de número atômico, em famílias (ou grupos) e em períodos.","Identificar as principais famílias de elementos (metais alcalinos, metais alcalinos-terrosos, calcogênios, halogênios gases nobres). a","Classificar os elementos em metais, ametais e gases nobres de acordo com suas propriedades.","Diferenciar elementos representativos (blocos s e p) elementos de transição (blocos d e f).","Entender como a configuração eletrônica dos elementos está relacionada à sua posição na tabela.","Compreender as propriedades periódicas e suas variações ao longo dos grupos e períodos na Tabela Periódica.","Prever a reatividade com base em suas propriedades periódicas."],"descritores":[]},{"serie":1,"trimestre":1,"pagina_fonte":18,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e universo","objetos":["TI Ligações Químicas","Propriedades dos compostos moleculares, metálicos e iônicos."],"expectativas":["Identificar as propriedades dos compostos moleculares, metálicos e iônicos.","Prever o comportamento químico e físico dos compostos com base no tipo de ligação presente. a"],"descritores":[]},{"serie":1,"trimestre":2,"pagina_fonte":18,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e universo","objetos":["TI Ligações Químicas","Propriedades dos compostos moleculares, metálicos e iônicos."],"expectativas":["Identificar as propriedades dos compostos moleculares, metálicos e iônicos.","Prever o comportamento químico e físico dos compostos com base no tipo de ligação presente. a"],"descritores":[]}]},{"codigo":"EM13CNT309","materia_codigo":"quimica","descricao":"Analisar questões socioambientais, políticas e econômicas relativas à dependência do mundo atual em relação aos recursos não renováveis e discutir a necessidade de A introdução de alternativas e novas tecnologias energéticas e de materiais, comparando diferentes tipos de motores e processos de produção de novos materiais.","ocorrencias":[{"serie":3,"trimestre":2,"pagina_fonte":45,"arquivo_fonte":"quimica-2026.pdf","unidade_tematica":"Terra e Universo","objetos":["TI Hidrocarbonetos:","Combustíveis.","Impactos ambientais."],"expectativas":["Identificar os principais hidrocarbonetos utilizados combustíveis.","Avaliar os impactos ambientais associados ao uso hidrocarbonetos, como a poluição atmosférica aquecimento global, incentivando práticas de consumo responsável e sustentável. de e"],"descritores":[]}]}],"descritores_avaliativos":[{"codigo":"D016_P","materia_codigo":"portugues","descricao":"Identificar a finalidade de textos de diferentes gêneros.","ocorrencias":[{"habilidade_codigo":"EM13LP10","serie":1,"trimestre":1,"pagina_fonte":12,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP07","serie":1,"trimestre":1,"pagina_fonte":13,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP06","serie":1,"trimestre":1,"pagina_fonte":14,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP44","serie":1,"trimestre":1,"pagina_fonte":16,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP45","serie":2,"trimestre":1,"pagina_fonte":30,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP38","serie":2,"trimestre":1,"pagina_fonte":31,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP40","serie":2,"trimestre":1,"pagina_fonte":32,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":3,"trimestre":1,"pagina_fonte":34,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP01","serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP47","serie":3,"trimestre":1,"pagina_fonte":37,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP01","serie":2,"trimestre":2,"pagina_fonte":11,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"}]},{"codigo":"D017_P","materia_codigo":"portugues","descricao":"Identificar o gênero de textos variados.","ocorrencias":[{"habilidade_codigo":"EM13LP10","serie":1,"trimestre":1,"pagina_fonte":12,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP07","serie":1,"trimestre":1,"pagina_fonte":13,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP06","serie":1,"trimestre":1,"pagina_fonte":14,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP44","serie":1,"trimestre":1,"pagina_fonte":16,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":2,"trimestre":1,"pagina_fonte":20,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":2,"trimestre":1,"pagina_fonte":22,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP52","serie":2,"trimestre":1,"pagina_fonte":23,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP29","serie":2,"trimestre":1,"pagina_fonte":24,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP53","serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"}]},{"codigo":"D019_P","materia_codigo":"portugues","descricao":"Reconhecer diferentes formas de tratar informação na comparação de textos que tratam do mesmo tema, em função das condições em do ele foi produzido e daquelas em que será recebido.","ocorrencias":[{"habilidade_codigo":"EM13LP50","serie":1,"trimestre":1,"pagina_fonte":18,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":3,"trimestre":1,"pagina_fonte":34,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP01","serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP47","serie":3,"trimestre":1,"pagina_fonte":37,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP01","serie":2,"trimestre":2,"pagina_fonte":11,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"},{"habilidade_codigo":"EM13LP01","serie":1,"trimestre":3,"pagina_fonte":4,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"}]},{"codigo":"D021_P","materia_codigo":"portugues","descricao":"Localizar informações explícitas em um texto.","ocorrencias":[{"habilidade_codigo":"EM13LP48","serie":2,"trimestre":1,"pagina_fonte":26,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":2,"trimestre":1,"pagina_fonte":28,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP52","serie":2,"trimestre":1,"pagina_fonte":29,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP45","serie":2,"trimestre":1,"pagina_fonte":30,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP38","serie":2,"trimestre":1,"pagina_fonte":31,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP40","serie":2,"trimestre":1,"pagina_fonte":32,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":3,"trimestre":1,"pagina_fonte":34,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP01","serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP47","serie":3,"trimestre":1,"pagina_fonte":37,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"}]},{"codigo":"D022_P","materia_codigo":"portugues","descricao":"Inferir o sentido de palavra ou expressão a partir do contexto.","ocorrencias":[{"habilidade_codigo":"EM13LP10","serie":1,"trimestre":1,"pagina_fonte":12,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP06","serie":1,"trimestre":2,"pagina_fonte":5,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"},{"habilidade_codigo":"EM13LP06","serie":2,"trimestre":2,"pagina_fonte":12,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"},{"habilidade_codigo":"EM13LP06","serie":3,"trimestre":2,"pagina_fonte":18,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"}]},{"codigo":"D023_P","materia_codigo":"portugues","descricao":"Inferir uma informação implícita em um texto.","ocorrencias":[{"habilidade_codigo":"EM13LP10","serie":1,"trimestre":1,"pagina_fonte":12,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP06","serie":1,"trimestre":1,"pagina_fonte":17,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":2,"trimestre":1,"pagina_fonte":20,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":2,"trimestre":1,"pagina_fonte":22,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP52","serie":2,"trimestre":1,"pagina_fonte":23,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP29","serie":2,"trimestre":1,"pagina_fonte":24,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP53","serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":3,"trimestre":1,"pagina_fonte":34,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP01","serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP47","serie":3,"trimestre":1,"pagina_fonte":37,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP01","serie":1,"trimestre":2,"pagina_fonte":4,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"}]},{"codigo":"D024_P","materia_codigo":"portugues","descricao":"Identificar efeitos de ironia ou humor em textos variados.","ocorrencias":[{"habilidade_codigo":"EM13LP48","serie":3,"trimestre":1,"pagina_fonte":34,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP01","serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP47","serie":3,"trimestre":1,"pagina_fonte":37,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP06","serie":1,"trimestre":2,"pagina_fonte":5,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"},{"habilidade_codigo":"EM13LP06","serie":2,"trimestre":2,"pagina_fonte":12,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"}]},{"codigo":"D025_P","materia_codigo":"portugues","descricao":"Reconhecer efeitos de sentido decorrentes do uso da pontuação e de outras notações.","ocorrencias":[{"habilidade_codigo":"EM13LP15","serie":1,"trimestre":2,"pagina_fonte":6,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"},{"habilidade_codigo":"EM13LP15","serie":2,"trimestre":3,"pagina_fonte":15,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"},{"habilidade_codigo":"EM13LP15","serie":3,"trimestre":3,"pagina_fonte":21,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"}]},{"codigo":"D027_P","materia_codigo":"portugues","descricao":"Diferenciar as partes principais das secundárias um texto.","ocorrencias":[{"habilidade_codigo":"EM13LP45","serie":2,"trimestre":1,"pagina_fonte":30,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP38","serie":2,"trimestre":1,"pagina_fonte":31,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP40","serie":2,"trimestre":1,"pagina_fonte":32,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP15","serie":3,"trimestre":1,"pagina_fonte":39,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP07","serie":3,"trimestre":1,"pagina_fonte":40,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP02","serie":1,"trimestre":2,"pagina_fonte":4,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"}]},{"codigo":"D028_P","materia_codigo":"portugues","descricao":"Identificarlocutor e o interlocutor de um texto.","ocorrencias":[{"habilidade_codigo":"EM13LP10","serie":1,"trimestre":1,"pagina_fonte":12,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP07","serie":1,"trimestre":1,"pagina_fonte":13,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP06","serie":1,"trimestre":1,"pagina_fonte":14,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP44","serie":1,"trimestre":1,"pagina_fonte":16,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP15","serie":3,"trimestre":1,"pagina_fonte":39,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP07","serie":3,"trimestre":1,"pagina_fonte":40,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP45","serie":2,"trimestre":2,"pagina_fonte":14,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"},{"habilidade_codigo":"EM13LP45","serie":1,"trimestre":3,"pagina_fonte":8,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"},{"habilidade_codigo":"EM13LP45","serie":3,"trimestre":3,"pagina_fonte":22,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"}]},{"codigo":"D030_P","materia_codigo":"portugues","descricao":"Identificar o conflito gerador do enredo e os elementos que constroem a narrativa.","ocorrencias":[{"habilidade_codigo":"EM13LP48","serie":2,"trimestre":1,"pagina_fonte":20,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":2,"trimestre":1,"pagina_fonte":22,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP52","serie":2,"trimestre":1,"pagina_fonte":23,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP29","serie":2,"trimestre":1,"pagina_fonte":24,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP53","serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP49","serie":1,"trimestre":2,"pagina_fonte":8,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"},{"habilidade_codigo":"EM13LP49","serie":3,"trimestre":2,"pagina_fonte":20,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"}]},{"codigo":"D032_P","materia_codigo":"portugues","descricao":"Identificar a tese de um texto.","ocorrencias":[{"habilidade_codigo":"EM13LP48","serie":2,"trimestre":1,"pagina_fonte":20,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":2,"trimestre":1,"pagina_fonte":22,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP52","serie":2,"trimestre":1,"pagina_fonte":23,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP29","serie":2,"trimestre":1,"pagina_fonte":24,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP53","serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP15","serie":3,"trimestre":1,"pagina_fonte":39,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP07","serie":3,"trimestre":1,"pagina_fonte":40,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP05","serie":1,"trimestre":3,"pagina_fonte":5,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"},{"habilidade_codigo":"EM13LP05","serie":3,"trimestre":3,"pagina_fonte":19,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"}]},{"codigo":"D033_P","materia_codigo":"portugues","descricao":"Reconhecer posições distintas entre duas ou mais opiniões relativas ao mesmo fato ou ao mesmo tema.","ocorrencias":[{"habilidade_codigo":"EM13LP44","serie":1,"trimestre":1,"pagina_fonte":16,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":2,"trimestre":1,"pagina_fonte":20,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":2,"trimestre":1,"pagina_fonte":22,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP52","serie":2,"trimestre":1,"pagina_fonte":23,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP29","serie":2,"trimestre":1,"pagina_fonte":24,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP53","serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":3,"trimestre":1,"pagina_fonte":34,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP01","serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP47","serie":3,"trimestre":1,"pagina_fonte":37,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP07","serie":2,"trimestre":2,"pagina_fonte":13,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"}]},{"codigo":"D037_P","materia_codigo":"portugues","descricao":"Estabelecer relações entre partes de um identificando repetições ou substituições que contribuem para a continuidade de um texto.","ocorrencias":[{"habilidade_codigo":"EM13LP03","serie":1,"trimestre":1,"pagina_fonte":15,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP15","serie":3,"trimestre":1,"pagina_fonte":39,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP07","serie":3,"trimestre":1,"pagina_fonte":40,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP02","serie":2,"trimestre":3,"pagina_fonte":11,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"},{"habilidade_codigo":"EM13LP02","serie":3,"trimestre":3,"pagina_fonte":18,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"}]},{"codigo":"D038_P","materia_codigo":"portugues","descricao":"Distinguir um fato da opinião relativa a esse fato.","ocorrencias":[{"habilidade_codigo":"EM13LP48","serie":2,"trimestre":1,"pagina_fonte":20,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":2,"trimestre":1,"pagina_fonte":22,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP52","serie":2,"trimestre":1,"pagina_fonte":23,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP29","serie":2,"trimestre":1,"pagina_fonte":24,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP53","serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":3,"trimestre":1,"pagina_fonte":34,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP01","serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP47","serie":3,"trimestre":1,"pagina_fonte":37,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP40","serie":1,"trimestre":3,"pagina_fonte":8,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"},{"habilidade_codigo":"EM13LP40","serie":3,"trimestre":3,"pagina_fonte":22,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"}]},{"codigo":"D039_P","materia_codigo":"portugues","descricao":"Estabelecer relações lógico-discursivas presentes no texto, marcadas por conjunções, advérbios e outros articuladores.","ocorrencias":[{"habilidade_codigo":"EM13LP48","serie":2,"trimestre":1,"pagina_fonte":26,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":2,"trimestre":1,"pagina_fonte":28,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP52","serie":2,"trimestre":1,"pagina_fonte":29,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP45","serie":2,"trimestre":1,"pagina_fonte":30,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP38","serie":2,"trimestre":1,"pagina_fonte":31,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP40","serie":2,"trimestre":1,"pagina_fonte":32,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP07","serie":1,"trimestre":2,"pagina_fonte":6,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"},{"habilidade_codigo":"EM13LP07","serie":3,"trimestre":2,"pagina_fonte":19,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"},{"habilidade_codigo":"EM13LP07","serie":2,"trimestre":3,"pagina_fonte":13,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"}]},{"codigo":"D042_M","materia_codigo":"matematica","descricao":"Utilizar o princípio multiplicativo de contagem na resolução de problema.","ocorrencias":[{"habilidade_codigo":"EM13MAT310","serie":3,"trimestre":1,"pagina_fonte":30,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"},{"habilidade_codigo":"EM13MAT311","serie":3,"trimestre":1,"pagina_fonte":31,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"},{"habilidade_codigo":"EM13MAT310","serie":2,"trimestre":3,"pagina_fonte":20,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf"}]},{"codigo":"D043_M","materia_codigo":"matematica","descricao":"Identificar a localização de pontos no plano cartesiano.","ocorrencias":[{"habilidade_codigo":"EM13MAT401","serie":1,"trimestre":2,"pagina_fonte":7,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"},{"habilidade_codigo":"EM13MAT510","serie":3,"trimestre":3,"pagina_fonte":26,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf"}]},{"codigo":"D043_P","materia_codigo":"portugues","descricao":"Reconhecer o efeito de sentido decorrente da exploração de recursos estilísticos.","ocorrencias":[{"habilidade_codigo":"EM13LP06","serie":1,"trimestre":1,"pagina_fonte":17,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":1,"trimestre":1,"pagina_fonte":18,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":2,"trimestre":1,"pagina_fonte":20,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":2,"trimestre":1,"pagina_fonte":22,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP52","serie":2,"trimestre":1,"pagina_fonte":23,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP29","serie":2,"trimestre":1,"pagina_fonte":24,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP53","serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":3,"trimestre":1,"pagina_fonte":34,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP01","serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP47","serie":3,"trimestre":1,"pagina_fonte":37,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"}]},{"codigo":"D049_M","materia_codigo":"matematica","descricao":"Utilizar relações métricas em um triângulo retângulo na resolução de problemas.","ocorrencias":[{"habilidade_codigo":"EM13MAT308","serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"}]},{"codigo":"D051_M","materia_codigo":"matematica","descricao":"Resolver problema que envolva razões trigonométricas no triângulo retângulo (seno, cosseno, tangente).","ocorrencias":[{"habilidade_codigo":"EM13MAT202","serie":3,"trimestre":3,"pagina_fonte":30,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf"}]},{"codigo":"D053_P","materia_codigo":"portugues","descricao":"Reconhecer o efeito de sentido decorrente escolha de uma determinada palavra ou expressão.","ocorrencias":[{"habilidade_codigo":"EM13LP06","serie":1,"trimestre":1,"pagina_fonte":17,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":1,"trimestre":1,"pagina_fonte":18,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP06","serie":1,"trimestre":3,"pagina_fonte":6,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"},{"habilidade_codigo":"EM13LP06","serie":2,"trimestre":3,"pagina_fonte":12,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"},{"habilidade_codigo":"EM13LP06","serie":3,"trimestre":3,"pagina_fonte":19,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"}]},{"codigo":"D055_P","materia_codigo":"portugues","descricao":"Estabelecer relação entre a tese e os argumentos oferecidos para sustentá-la.","ocorrencias":[{"habilidade_codigo":"EM13LP48","serie":2,"trimestre":1,"pagina_fonte":20,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":2,"trimestre":1,"pagina_fonte":22,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP52","serie":2,"trimestre":1,"pagina_fonte":23,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP29","serie":2,"trimestre":1,"pagina_fonte":24,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP53","serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP05","serie":3,"trimestre":2,"pagina_fonte":18,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"},{"habilidade_codigo":"EM13LP05","serie":2,"trimestre":3,"pagina_fonte":12,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"}]},{"codigo":"D057_M","materia_codigo":"matematica","descricao":"Utilizar o perímetro de uma figura bidimensional na resolução de problema.","ocorrencias":[{"habilidade_codigo":"EM13MAT507","serie":3,"trimestre":2,"pagina_fonte":27,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D057_P","materia_codigo":"portugues","descricao":"Interpretar texto com auxílio de material gráfico diverso, como propagandas, quadrinhos e fotografias.","ocorrencias":[{"habilidade_codigo":"EM13LP10","serie":1,"trimestre":1,"pagina_fonte":12,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":3,"trimestre":1,"pagina_fonte":34,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP01","serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP47","serie":3,"trimestre":1,"pagina_fonte":37,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP15","serie":2,"trimestre":2,"pagina_fonte":13,"arquivo_fonte":"OCs-2026-EM-2o-tri.pdf"}]},{"codigo":"D058_M","materia_codigo":"matematica","descricao":"Utilizar área de figuras bidimensionais na resolução de problema.","ocorrencias":[{"habilidade_codigo":"EM13MAT307","serie":2,"trimestre":2,"pagina_fonte":17,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"},{"habilidade_codigo":"EM13MAT307","serie":3,"trimestre":2,"pagina_fonte":29,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"},{"habilidade_codigo":"EM13MAT307","serie":1,"trimestre":3,"pagina_fonte":11,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf"}]},{"codigo":"D060_P","materia_codigo":"portugues","descricao":"Reconhecer diferentes estratégias de argumentação.","ocorrencias":[{"habilidade_codigo":"EM13LP45","serie":2,"trimestre":1,"pagina_fonte":30,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP38","serie":2,"trimestre":1,"pagina_fonte":31,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP40","serie":2,"trimestre":1,"pagina_fonte":32,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"}]},{"codigo":"D061_P","materia_codigo":"portugues","descricao":"Estabelecer relação causa/consequência partes e elementos do texto.","ocorrencias":[{"habilidade_codigo":"EM13LP48","serie":2,"trimestre":1,"pagina_fonte":20,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":2,"trimestre":1,"pagina_fonte":22,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP52","serie":2,"trimestre":1,"pagina_fonte":23,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP29","serie":2,"trimestre":1,"pagina_fonte":24,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP53","serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP02","serie":1,"trimestre":3,"pagina_fonte":5,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"}]},{"codigo":"D062_P","materia_codigo":"portugues","descricao":"Identificar discursos que contribuíram para a formação mais da identidade nacional em textos da literatura brasileira.","ocorrencias":[{"habilidade_codigo":"EM13LP48","serie":2,"trimestre":1,"pagina_fonte":20,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":2,"trimestre":1,"pagina_fonte":22,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP52","serie":2,"trimestre":1,"pagina_fonte":23,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP29","serie":2,"trimestre":1,"pagina_fonte":24,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP53","serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":3,"trimestre":1,"pagina_fonte":34,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP01","serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP47","serie":3,"trimestre":1,"pagina_fonte":37,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"}]},{"codigo":"D063_M","materia_codigo":"matematica","descricao":"Corresponder listas e/ou tabelas simples gráficos que as representam.","ocorrencias":[{"habilidade_codigo":"EM13MAT102","serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"}]},{"codigo":"D064_M","materia_codigo":"matematica","descricao":"Utilizar informações apresentadas em tabelas ou gráficos na resolução de problemas.","ocorrencias":[{"habilidade_codigo":"EM13MAT406","serie":3,"trimestre":1,"pagina_fonte":33,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"},{"habilidade_codigo":"EM13MAT102","serie":3,"trimestre":1,"pagina_fonte":35,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"}]},{"codigo":"D065_M","materia_codigo":"matematica","descricao":"Resolver problema envolvendo noções de probabilidade.","ocorrencias":[{"habilidade_codigo":"EM13MAT311","serie":3,"trimestre":1,"pagina_fonte":31,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"},{"habilidade_codigo":"EM13MAT312","serie":3,"trimestre":1,"pagina_fonte":32,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"},{"habilidade_codigo":"EM13MAT311","serie":2,"trimestre":3,"pagina_fonte":20,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf"}]},{"codigo":"D066_M","materia_codigo":"matematica","descricao":"Utilizar medidas de tendência central resolução de problemas.","ocorrencias":[{"habilidade_codigo":"EM13MAT316","serie":3,"trimestre":1,"pagina_fonte":34,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"}]},{"codigo":"D071_M","materia_codigo":"matematica","descricao":"Analisar crescimento/decrescimento, zeros de funções reais apresentadas em gráficos.","ocorrencias":[{"habilidade_codigo":"EM13MAT401","serie":1,"trimestre":1,"pagina_fonte":21,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"},{"habilidade_codigo":"EM13MAT402","serie":1,"trimestre":2,"pagina_fonte":11,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"},{"habilidade_codigo":"EM13MAT502","serie":2,"trimestre":2,"pagina_fonte":19,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"},{"habilidade_codigo":"EM13MAT401","serie":3,"trimestre":2,"pagina_fonte":25,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D074_M","materia_codigo":"matematica","descricao":"Corresponder as representações algébrica e gráfica de uma função exponencial.","ocorrencias":[{"habilidade_codigo":"EM13MAT304","serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"},{"habilidade_codigo":"EM13MAT304","serie":3,"trimestre":2,"pagina_fonte":32,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D076_M","materia_codigo":"matematica","descricao":"Corresponder um polinômio fatorado por meio de polinômios de 1º grau às suas raízes.","ocorrencias":[{"habilidade_codigo":"EM13MAT507","serie":1,"trimestre":2,"pagina_fonte":9,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"},{"habilidade_codigo":"EM13MAT402","serie":3,"trimestre":2,"pagina_fonte":25,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D078_M","materia_codigo":"matematica","descricao":"Corresponder uma função polinomial do 1º grau a seu gráfico.","ocorrencias":[{"habilidade_codigo":"EM13MAT401","serie":1,"trimestre":1,"pagina_fonte":21,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"},{"habilidade_codigo":"EM13MAT402","serie":3,"trimestre":2,"pagina_fonte":25,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D080_M","materia_codigo":"matematica","descricao":"Identificar a representação algébrica gráfica de uma função logarítmica, reconhecendo-a como inversa da função exponencial.","ocorrencias":[{"habilidade_codigo":"EM13MAT403","serie":2,"trimestre":1,"pagina_fonte":28,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"}]},{"codigo":"D082_M","materia_codigo":"matematica","descricao":"Identificar o gráfico que representa uma situação descrita em um texto.","ocorrencias":[{"habilidade_codigo":"EM13MAT404","serie":1,"trimestre":2,"pagina_fonte":12,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D086_M","materia_codigo":"matematica","descricao":"Reconhecer expressão algébrica representa uma função a partir de uma tabela.","ocorrencias":[{"habilidade_codigo":"EM13MAT501","serie":1,"trimestre":1,"pagina_fonte":20,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"}]},{"codigo":"D087_M","materia_codigo":"matematica","descricao":"Resolver problema envolvendo equação do 2º grau.","ocorrencias":[{"habilidade_codigo":"EM13MAT507","serie":1,"trimestre":2,"pagina_fonte":9,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D088_M","materia_codigo":"matematica","descricao":"Utilizar função exponencial na resolução de problemas.","ocorrencias":[{"habilidade_codigo":"EM13MAT304","serie":2,"trimestre":1,"pagina_fonte":25,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"},{"habilidade_codigo":"EM13MAT403","serie":2,"trimestre":1,"pagina_fonte":28,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"},{"habilidade_codigo":"EM13MAT304","serie":3,"trimestre":2,"pagina_fonte":32,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D096_M","materia_codigo":"matematica","descricao":"Utilizar propriedades de progressões aritméticas na resolução de problemas.","ocorrencias":[{"habilidade_codigo":"EM13MAT507","serie":1,"trimestre":2,"pagina_fonte":9,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"},{"habilidade_codigo":"EM13MAT507","serie":3,"trimestre":2,"pagina_fonte":27,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D097_M","materia_codigo":"matematica","descricao":"Utilizar propriedades de progressões geométricas na resolução de problemas.","ocorrencias":[{"habilidade_codigo":"EM13MAT508","serie":2,"trimestre":1,"pagina_fonte":26,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"},{"habilidade_codigo":"EM13MAT508","serie":3,"trimestre":2,"pagina_fonte":33,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D102_P","materia_codigo":"portugues","descricao":"Reconhecer o efeito de sentido decorrente exploração de recursos ortográficos e/ou morfossintáticos.","ocorrencias":[{"habilidade_codigo":"EM13LP07","serie":1,"trimestre":1,"pagina_fonte":13,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP06","serie":1,"trimestre":1,"pagina_fonte":14,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP48","serie":2,"trimestre":1,"pagina_fonte":26,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP50","serie":2,"trimestre":1,"pagina_fonte":28,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP52","serie":2,"trimestre":1,"pagina_fonte":29,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP45","serie":2,"trimestre":1,"pagina_fonte":30,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP38","serie":2,"trimestre":1,"pagina_fonte":31,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP40","serie":2,"trimestre":1,"pagina_fonte":32,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP15","serie":3,"trimestre":1,"pagina_fonte":39,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP07","serie":3,"trimestre":1,"pagina_fonte":40,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP08","serie":2,"trimestre":3,"pagina_fonte":14,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"},{"habilidade_codigo":"EM13LP08","serie":3,"trimestre":3,"pagina_fonte":20,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"}]},{"codigo":"D103_P","materia_codigo":"portugues","descricao":"Identificar as marcas linguísticas que evidenciam locutor e o interlocutor de um texto.","ocorrencias":[{"habilidade_codigo":"EM13LP10","serie":1,"trimestre":1,"pagina_fonte":12,"arquivo_fonte":"EM_D_LP_26_14_04_26.pdf"},{"habilidade_codigo":"EM13LP10","serie":2,"trimestre":3,"pagina_fonte":14,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"},{"habilidade_codigo":"EM13LP10","serie":3,"trimestre":3,"pagina_fonte":20,"arquivo_fonte":"OCs-2026-EM-3o-tri.pdf"}]},{"codigo":"D111_M","materia_codigo":"matematica","descricao":"Relacionar diferentes poliedros ou corpos redondos com suas planificações ou vistas.","ocorrencias":[{"habilidade_codigo":"EM13MAT309","serie":2,"trimestre":2,"pagina_fonte":21,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"},{"habilidade_codigo":"EM13MAT506","serie":1,"trimestre":3,"pagina_fonte":13,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf"}]},{"codigo":"D119_M","materia_codigo":"matematica","descricao":"Identificar triângulos semelhantes mediante o reconhecimento de relações de proporcionalidade.","ocorrencias":[{"habilidade_codigo":"EM13MAT308","serie":3,"trimestre":1,"pagina_fonte":36,"arquivo_fonte":"EM_D_MAT_26_14_04_26.pdf"},{"habilidade_codigo":"EM13MAT308","serie":1,"trimestre":3,"pagina_fonte":15,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf"}]},{"codigo":"D125_M","materia_codigo":"matematica","descricao":"Identificar a relação entre o número de vértices, faces e/ou arestas de poliedros expressa em um problema.","ocorrencias":[{"habilidade_codigo":"EM13MAT309","serie":3,"trimestre":2,"pagina_fonte":30,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D126_M","materia_codigo":"matematica","descricao":"Identificar gráficos de funções trigonométricas (seno, cosseno, tangente) reconhecendo suas propriedades.","ocorrencias":[{"habilidade_codigo":"EM13MAT306","serie":3,"trimestre":3,"pagina_fonte":31,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf"}]},{"codigo":"D127_M","materia_codigo":"matematica","descricao":"Relacionar a determinação do ponto de intersecção de duas ou mais retas com a resolução de um sistema de equações com duas incógnitas.","ocorrencias":[{"habilidade_codigo":"EM13MAT301","serie":2,"trimestre":3,"pagina_fonte":23,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf"},{"habilidade_codigo":"EM13MAT301","serie":3,"trimestre":3,"pagina_fonte":29,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf"}]},{"codigo":"D129_M","materia_codigo":"matematica","descricao":"Resolver problema envolvendo a área total e/ou volume de um sólido.","ocorrencias":[{"habilidade_codigo":"EM13MAT309","serie":2,"trimestre":2,"pagina_fonte":21,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D132_M","materia_codigo":"matematica","descricao":"Resolver problema envolvendo uma função do 1º grau.","ocorrencias":[{"habilidade_codigo":"EM13MAT501","serie":1,"trimestre":2,"pagina_fonte":7,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D133_M","materia_codigo":"matematica","descricao":"Resolver problemas que envolvam pontos de máximo ou de mínimo no gráfico de uma função polinomial do segundo grau.","ocorrencias":[{"habilidade_codigo":"EM13MAT503","serie":1,"trimestre":2,"pagina_fonte":11,"arquivo_fonte":"MAT-OCs-EM-2o-trim-2026-12-06-26.pdf"}]},{"codigo":"D157_M","materia_codigo":"matematica","descricao":"Determinar a solução de um sistema linear associando-o a uma matriz.","ocorrencias":[{"habilidade_codigo":"EM13MAT301","serie":2,"trimestre":3,"pagina_fonte":23,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf"},{"habilidade_codigo":"EM13MAT301","serie":3,"trimestre":3,"pagina_fonte":29,"arquivo_fonte":"MAT-OCs-EM-3o-trim-2026-26-08-26.pdf"}]}]}$catalogo$::jsonb;
  materia text;
  habilidade_json jsonb;
  ocorrencia jsonb;
  descritor_json jsonb;
  descritor_ocorrencia jsonb;
  item_text text;
  curriculo_uuid uuid;
  periodo_uuid uuid;
  habilidade_uuid uuid;
  descritor_uuid uuid;
  objeto_uuid uuid;
begin
  for materia in select value from jsonb_array_elements_text(catalogo -> 'materias') loop
    insert into public.curriculos
      (nome, origem, ano_letivo, materia_codigo, modalidade, versao, status, ativo)
    values
      ('Base comum 2026 — ' || initcap(materia), catalogo ->> 'origem', 2026,
       materia::public.materia_aluno, 'Ensino Médio', 1, 'publicado', true)
    on conflict (origem, ano_letivo, materia_codigo, versao)
    do update set nome = excluded.nome, status = 'publicado', ativo = true, updated_at = now()
    returning id into curriculo_uuid;

    insert into public.curriculo_periodos (curriculo_id, serie, trimestre)
    select curriculo_uuid, serie, trimestre
    from generate_series(1, 3) serie cross join generate_series(1, 3) trimestre
    on conflict (curriculo_id, serie, trimestre) do nothing;
  end loop;

  for descritor_json in select value from jsonb_array_elements(catalogo -> 'descritores_avaliativos') loop
    insert into public.descritores_curriculares
      (codigo, titulo, descricao, materia_codigo, serie, trimestre, status, criado_por)
    values
      (descritor_json ->> 'codigo', descritor_json ->> 'codigo', descritor_json ->> 'descricao',
       (descritor_json ->> 'materia_codigo')::public.materia_aluno, null, null, 'ativo', null)
    on conflict (codigo) do update
      set descricao = excluded.descricao,
          materia_codigo = excluded.materia_codigo,
          status = 'ativo',
          updated_at = now()
    returning id into descritor_uuid;

    for descritor_ocorrencia in select value from jsonb_array_elements(descritor_json -> 'ocorrencias') loop
      select cp.id into periodo_uuid
      from public.curriculo_periodos cp
      join public.curriculos c on c.id = cp.curriculo_id
      where c.origem = catalogo ->> 'origem'
        and c.ano_letivo = 2026
        and c.versao = 1
        and c.materia_codigo = (descritor_json ->> 'materia_codigo')::public.materia_aluno
        and cp.serie = (descritor_ocorrencia ->> 'serie')::smallint
        and cp.trimestre = (descritor_ocorrencia ->> 'trimestre')::smallint;

      insert into public.descritor_curriculo_periodos
        (descritor_id, periodo_id, source_page, arquivo_fonte)
      values
        (descritor_uuid, periodo_uuid, (descritor_ocorrencia ->> 'pagina_fonte')::integer,
         descritor_ocorrencia ->> 'arquivo_fonte')
      on conflict (descritor_id, periodo_id) do update
        set source_page = excluded.source_page, arquivo_fonte = excluded.arquivo_fonte;
    end loop;
  end loop;

  for habilidade_json in select value from jsonb_array_elements(catalogo -> 'habilidades') loop
    insert into public.habilidades_curriculares (codigo, descricao, materia_codigo, modalidade)
    values (
      habilidade_json ->> 'codigo', habilidade_json ->> 'descricao',
      (habilidade_json ->> 'materia_codigo')::public.materia_aluno, 'Ensino Médio'
    )
    on conflict (codigo, materia_codigo) do update
      set descricao = excluded.descricao, updated_at = now()
    returning id into habilidade_uuid;

    for ocorrencia in select value from jsonb_array_elements(habilidade_json -> 'ocorrencias') loop
      select cp.id into periodo_uuid
      from public.curriculo_periodos cp
      join public.curriculos c on c.id = cp.curriculo_id
      where c.origem = catalogo ->> 'origem'
        and c.ano_letivo = 2026
        and c.versao = 1
        and c.materia_codigo = (habilidade_json ->> 'materia_codigo')::public.materia_aluno
        and cp.serie = (ocorrencia ->> 'serie')::smallint
        and cp.trimestre = (ocorrencia ->> 'trimestre')::smallint;

      insert into public.habilidade_curriculo_periodos
        (habilidade_id, periodo_id, source_page, unidade_tematica, arquivo_fonte)
      values
        (habilidade_uuid, periodo_uuid, (ocorrencia ->> 'pagina_fonte')::integer,
         nullif(ocorrencia ->> 'unidade_tematica', ''), ocorrencia ->> 'arquivo_fonte')
      on conflict (habilidade_id, periodo_id) do update
        set source_page = excluded.source_page,
            unidade_tematica = coalesce(excluded.unidade_tematica, public.habilidade_curriculo_periodos.unidade_tematica),
            arquivo_fonte = excluded.arquivo_fonte;

      for item_text in select value from jsonb_array_elements_text(ocorrencia -> 'expectativas') loop
        if char_length(btrim(item_text)) >= 8 then
          insert into public.expectativas_aprendizagem (habilidade_id, periodo_id, descricao)
          values (habilidade_uuid, periodo_uuid, btrim(item_text)) on conflict do nothing;
        end if;
      end loop;

      for item_text in select value from jsonb_array_elements_text(ocorrencia -> 'objetos') loop
        if char_length(btrim(item_text)) >= 3 then
          insert into public.objetos_conhecimento (descricao)
          values (btrim(item_text)) on conflict (descricao) do update set descricao = excluded.descricao
          returning id into objeto_uuid;
          insert into public.habilidade_objetos (habilidade_id, objeto_id, periodo_id)
          values (habilidade_uuid, objeto_uuid, periodo_uuid) on conflict do nothing;
        end if;
      end loop;

      for descritor_json in select value from jsonb_array_elements(ocorrencia -> 'descritores') loop
        select id into descritor_uuid from public.descritores_curriculares
        where codigo = descritor_json ->> 'codigo';
        if descritor_uuid is not null then
          insert into public.habilidade_descritores (habilidade_id, descritor_id, periodo_id)
          values (habilidade_uuid, descritor_uuid, periodo_uuid) on conflict do nothing;
        end if;
      end loop;
    end loop;
  end loop;
end;
$seed$;

create or replace function public.aluno_pode_acessar_materia(materia_input public.materia_aluno)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis p
    where p.id = (select auth.uid()) and p.role = 'aluno'
      and (
        materia_input in ('matematica', 'fisica', 'quimica', 'biologia', 'portugues', 'redacao')
        or (materia_input = 'tecnico_administracao' and p.curso_tecnico = 'administracao')
        or (materia_input = 'tecnico_informatica' and p.curso_tecnico = 'informatica')
      )
  );
$$;

revoke all on function public.aluno_pode_acessar_materia(public.materia_aluno) from public, anon, authenticated;
grant execute on function public.aluno_pode_acessar_materia(public.materia_aluno) to authenticated;

create or replace function public.buscar_catalogo_curricular_detalhado(
  p_materia public.materia_aluno,
  p_serie smallint default null,
  p_trimestre smallint default null,
  p_busca text default null
)
returns table (
  habilidade_id uuid, codigo text, descricao text, serie smallint, trimestre smallint,
  unidade_tematica text, pagina_fonte integer, arquivo_fonte text,
  objetos jsonb, expectativas jsonb, descritores jsonb
)
language sql stable security invoker set search_path = '' as $$
  select h.id, h.codigo, h.descricao, cp.serie, cp.trimestre,
    hcp.unidade_tematica, hcp.source_page, hcp.arquivo_fonte,
    coalesce((select jsonb_agg(jsonb_build_object('id', oc.id, 'descricao', oc.descricao) order by oc.descricao)
      from public.habilidade_objetos ho join public.objetos_conhecimento oc on oc.id = ho.objeto_id
      where ho.habilidade_id = h.id and ho.periodo_id = cp.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', ea.id, 'descricao', ea.descricao) order by ea.descricao)
      from public.expectativas_aprendizagem ea
      where ea.habilidade_id = h.id and ea.periodo_id = cp.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'codigo', d.codigo, 'titulo', d.titulo, 'descricao', d.descricao) order by d.codigo)
      from public.habilidade_descritores hd join public.descritores_curriculares d on d.id = hd.descritor_id
      where hd.habilidade_id = h.id and hd.periodo_id = cp.id), '[]'::jsonb)
  from public.habilidades_curriculares h
  join public.habilidade_curriculo_periodos hcp on hcp.habilidade_id = h.id
  join public.curriculo_periodos cp on cp.id = hcp.periodo_id
  join public.curriculos c on c.id = cp.curriculo_id
  where h.materia_codigo = p_materia and c.status = 'publicado' and c.ativo
    and (p_serie is null or cp.serie = p_serie)
    and (p_trimestre is null or cp.trimestre = p_trimestre)
    and (nullif(btrim(coalesce(p_busca, '')), '') is null
      or h.codigo ilike '%' || btrim(p_busca) || '%'
      or h.descricao ilike '%' || btrim(p_busca) || '%')
  order by cp.serie, cp.trimestre, h.codigo;
$$;

revoke all on function public.buscar_catalogo_curricular_detalhado(public.materia_aluno, smallint, smallint, text) from public, anon;
grant execute on function public.buscar_catalogo_curricular_detalhado(public.materia_aluno, smallint, smallint, text) to authenticated;

comment on function public.buscar_catalogo_curricular_detalhado(public.materia_aluno, smallint, smallint, text)
is 'Catálogo oficial detalhado usado pelo motor de atividades do OminiSaber.';

-- ============================================================================
-- ETAPA 31/67: migrations/20260908_engine_atividades_fase2_1.sql
-- ============================================================================

-- OminiSaber | Fase 2.1 - fundacao segura do motor de atividades
-- Consolida as avaliacoes docentes existentes sem duplicar o modulo de trilhas.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Um professor pode atuar em mais de uma materia e turma. Essa relacao substitui
-- autorizacoes baseadas apenas no layout/tipo do professor.
create table if not exists public.professor_turma_materias (
  professor_id uuid not null references public.perfis(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  materia_codigo public.materia_aluno not null,
  atribuido_por uuid references public.perfis(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (professor_id, turma_id, materia_codigo)
);

create index if not exists professor_turma_materias_turma_idx
  on public.professor_turma_materias (turma_id, materia_codigo, professor_id)
  where ativo = true;
create index if not exists professor_turma_materias_professor_idx
  on public.professor_turma_materias (professor_id, materia_codigo, turma_id)
  where ativo = true;
create index if not exists professor_turma_materias_atribuido_por_idx
  on public.professor_turma_materias (atribuido_por)
  where atribuido_por is not null;

insert into public.professor_turma_materias (professor_id, turma_id, materia_codigo)
select pt.professor_id, pt.turma_id,
  case
    when lower(coalesce(pt.materia, '')) like '%matem%' then 'matematica'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like '%fisic%' then 'fisica'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like '%quim%' then 'quimica'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like '%biolog%' then 'biologia'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like any (array['%portugu%', '%literat%', '%linguag%']) then 'portugues'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like '%reda%' then 'redacao'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like any (array['%admin%', '%gest%', '%empreend%', '%marketing%', '%finan%']) then 'tecnico_administracao'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like any (array['%inform%', '%program%', '%tecnolog%', '%banco de dados%', '%redes%']) then 'tecnico_informatica'::public.materia_aluno
    when p.tipo_professor = 'matematica' then 'matematica'::public.materia_aluno
    when p.tipo_professor = 'portugues' then 'portugues'::public.materia_aluno
    when p.tipo_professor = 'tecnico_administracao' then 'tecnico_administracao'::public.materia_aluno
    when p.tipo_professor = 'tecnico_informatica' then 'tecnico_informatica'::public.materia_aluno
    else null
  end
from public.professor_turmas pt
join public.perfis p on p.id = pt.professor_id
where p.role = 'professor'
on conflict do nothing;

insert into public.professor_turma_materias (professor_id, turma_id, materia_codigo)
select pt.professor_id, pt.turma_id, 'redacao'::public.materia_aluno
from public.professor_turmas pt
join public.perfis p on p.id = pt.professor_id
where p.role = 'professor' and p.tipo_professor = 'portugues'
on conflict do nothing;

create or replace function private.professor_tem_turma_materia(
  p_professor_id uuid,
  p_turma_id uuid,
  p_materia public.materia_aluno
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_professor_id = (select auth.uid())
    and (select public.usuario_role()) = 'professor'
    and exists (
      select 1
      from public.professor_turma_materias ptm
      where ptm.professor_id = p_professor_id
        and ptm.turma_id = p_turma_id
        and ptm.materia_codigo = p_materia
        and ptm.ativo = true
    );
$$;

revoke all on function private.professor_tem_turma_materia(uuid, uuid, public.materia_aluno) from public, anon;
grant execute on function private.professor_tem_turma_materia(uuid, uuid, public.materia_aluno) to authenticated;

-- avaliacoes_docentes passa a ser o registro canonico para atividades,
-- avaliacoes, diagnosticos e recuperacoes criados pelo professor.
alter table public.avaliacoes_docentes
  add column if not exists materia_codigo public.materia_aluno,
  add column if not exists categoria text not null default 'atividade',
  add column if not exists serie smallint,
  add column if not exists trimestre smallint,
  add column if not exists modo_pontuacao text not null default 'igual',
  add column if not exists tentativas_permitidas smallint not null default 1,
  add column if not exists embaralhar_questoes boolean not null default false,
  add column if not exists embaralhar_alternativas boolean not null default false,
  add column if not exists feedback_imediato boolean not null default false,
  add column if not exists exibir_gabarito boolean not null default false,
  add column if not exists versao_atual integer not null default 1;

update public.avaliacoes_docentes
set materia_codigo = case tipo_professor
  when 'matematica' then 'matematica'::public.materia_aluno
  when 'portugues' then 'portugues'::public.materia_aluno
  when 'tecnico_administracao' then 'tecnico_administracao'::public.materia_aluno
  when 'tecnico_informatica' then 'tecnico_informatica'::public.materia_aluno
end
where materia_codigo is null;

alter table public.avaliacoes_docentes alter column materia_codigo set not null;

do $$ begin
  alter table public.avaliacoes_docentes add constraint avaliacoes_docentes_categoria_check
    check (categoria in ('atividade', 'avaliacao', 'diagnostica', 'recuperacao'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.avaliacoes_docentes add constraint avaliacoes_docentes_serie_check
    check (serie is null or serie between 1 and 3);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.avaliacoes_docentes add constraint avaliacoes_docentes_trimestre_check
    check (trimestre is null or trimestre between 1 and 3);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.avaliacoes_docentes add constraint avaliacoes_docentes_modo_pontuacao_check
    check (modo_pontuacao in ('igual', 'manual'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.avaliacoes_docentes add constraint avaliacoes_docentes_tentativas_check
    check (tentativas_permitidas between 1 and 10);
exception when duplicate_object then null;
end $$;

create index if not exists avaliacoes_docentes_professor_materia_idx
  on public.avaliacoes_docentes (professor_id, materia_codigo, status, created_at desc);
create index if not exists avaliacoes_docentes_turma_publicacao_idx
  on public.avaliacoes_docentes (turma_id, status, abre_em, encerra_em);

-- Tipos comuns a todas as materias. Campos de configuracao suportam interacoes
-- especificas sem espalhar colunas ou respostas corretas pelo frontend.
alter table public.questoes_avaliacao drop constraint if exists questoes_avaliacao_tipo_check;
alter table public.questoes_avaliacao
  add column if not exists configuracao jsonb not null default '{}'::jsonb,
  add column if not exists explicacao text,
  add column if not exists obrigatoria boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.questoes_avaliacao add constraint questoes_avaliacao_tipo_check check (tipo in (
    'unica_escolha', 'multipla_escolha', 'verdadeiro_falso', 'numerica',
    'resposta_curta', 'dissertativa', 'associacao', 'ordenacao',
    'calculo', 'codigo', 'estudo_caso'
  ));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.questoes_avaliacao add constraint questoes_avaliacao_configuracao_check
    check (jsonb_typeof(configuracao) = 'object');
exception when duplicate_object then null;
end $$;

-- Versoes guardam somente o que o aluno pode receber. Gabaritos continuam
-- separados e nunca entram neste snapshot.
create table if not exists public.avaliacoes_versoes (
  avaliacao_id uuid not null references public.avaliacoes_docentes(id) on delete cascade,
  versao integer not null check (versao > 0),
  titulo text not null,
  instrucoes text not null,
  valor numeric(6,2) not null,
  configuracao jsonb not null default '{}'::jsonb check (jsonb_typeof(configuracao) = 'object'),
  questoes_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(questoes_snapshot) = 'array'),
  publicado_em timestamptz not null default now(),
  primary key (avaliacao_id, versao)
);

alter table public.tentativas_avaliacao
  add column if not exists numero_tentativa smallint not null default 1,
  add column if not exists versao_avaliacao integer not null default 1,
  add column if not exists pontuacao_automatica numeric(6,2) not null default 0,
  add column if not exists pontuacao_manual numeric(6,2) not null default 0,
  add column if not exists requer_revisao boolean not null default false,
  add column if not exists bloqueada_em timestamptz;

alter table public.tentativas_avaliacao
  drop constraint if exists tentativas_avaliacao_avaliacao_id_aluno_id_key;
do $$ begin
  alter table public.tentativas_avaliacao add constraint tentativas_avaliacao_numero_check
    check (numero_tentativa between 1 and 10);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.tentativas_avaliacao add constraint tentativas_avaliacao_unica
    unique (avaliacao_id, aluno_id, numero_tentativa);
exception when duplicate_object then null;
end $$;

create index if not exists tentativas_avaliacao_professor_idx
  on public.tentativas_avaliacao (avaliacao_id, status, enviada_em desc);
create index if not exists tentativas_avaliacao_aluno_idx
  on public.tentativas_avaliacao (aluno_id, status, iniciada_em desc);

create table if not exists public.respostas_avaliacao (
  id uuid primary key default gen_random_uuid(),
  tentativa_id uuid not null references public.tentativas_avaliacao(id) on delete cascade,
  questao_id uuid not null references public.questoes_avaliacao(id) on delete restrict,
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  resposta jsonb not null default '{}'::jsonb,
  status_correcao text not null default 'pendente',
  correta boolean,
  pontos_automaticos numeric(6,2) not null default 0 check (pontos_automaticos >= 0),
  pontos_manuais numeric(6,2) not null default 0 check (pontos_manuais >= 0),
  feedback text,
  respondida_em timestamptz not null default now(),
  corrigida_em timestamptz,
  updated_at timestamptz not null default now(),
  unique (tentativa_id, questao_id),
  check (jsonb_typeof(resposta) in ('object', 'array', 'string', 'number', 'boolean', 'null')),
  check (status_correcao in ('pendente', 'automatica', 'revisao', 'manual'))
);

create index if not exists respostas_avaliacao_tentativa_idx
  on public.respostas_avaliacao (tentativa_id, questao_id);
create index if not exists respostas_avaliacao_revisao_idx
  on public.respostas_avaliacao (status_correcao, tentativa_id)
  where status_correcao in ('pendente', 'revisao');
create index if not exists respostas_avaliacao_aluno_idx
  on public.respostas_avaliacao (aluno_id, tentativa_id);
create index if not exists respostas_avaliacao_questao_idx
  on public.respostas_avaliacao (questao_id);

create table if not exists public.avaliacoes_auditoria (
  id bigint generated by default as identity primary key,
  avaliacao_id uuid references public.avaliacoes_docentes(id) on delete set null,
  tentativa_id uuid references public.tentativas_avaliacao(id) on delete set null,
  ator_id uuid references public.perfis(id) on delete set null,
  evento text not null,
  detalhes jsonb not null default '{}'::jsonb check (jsonb_typeof(detalhes) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists avaliacoes_auditoria_avaliacao_idx
  on public.avaliacoes_auditoria (avaliacao_id, created_at desc);
create index if not exists avaliacoes_auditoria_tentativa_idx
  on public.avaliacoes_auditoria (tentativa_id, created_at desc)
  where tentativa_id is not null;
create index if not exists avaliacoes_auditoria_ator_idx
  on public.avaliacoes_auditoria (ator_id, created_at desc)
  where ator_id is not null;

create or replace function private.validar_avaliacao_docente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'encerrado' and new.status <> old.status then
      raise exception 'Uma atividade encerrada nao pode ser reaberta.';
    end if;
    if old.status = 'publicado' and new.status = 'rascunho' then
      raise exception 'Uma atividade publicada nao pode voltar a rascunho.';
    end if;
    if old.status <> 'rascunho'
       and (to_jsonb(new) - array['status','updated_at'])
           is distinct from (to_jsonb(old) - array['status','updated_at']) then
      raise exception 'O conteudo publicado e imutavel. Crie uma nova versao.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.capturar_versao_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sessao autenticada obrigatoria.';
  end if;
  if new.status = 'publicado' and (tg_op = 'INSERT' or old.status <> 'publicado') then
    insert into public.avaliacoes_versoes (
      avaliacao_id, versao, titulo, instrucoes, valor, configuracao,
      questoes_snapshot, publicado_em
    )
    select
      new.id, new.versao_atual, new.titulo, new.instrucoes, new.valor,
      new.configuracao,
      coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id,
        'ordem', q.ordem,
        'tipo', q.tipo,
        'enunciado', q.enunciado,
        'alternativas', q.alternativas,
        'pontos', q.pontos,
        'configuracao', q.configuracao,
        'obrigatoria', q.obrigatoria
      ) order by q.ordem) filter (where q.id is not null), '[]'::jsonb),
      coalesce(new.publicado_em, now())
    from public.questoes_avaliacao q
    where q.avaliacao_id = new.id
    on conflict (avaliacao_id, versao) do nothing;

    insert into public.avaliacoes_auditoria (avaliacao_id, ator_id, evento, detalhes)
    values (new.id, (select auth.uid()), 'publicada', jsonb_build_object('versao', new.versao_atual));
  end if;
  return new;
end;
$$;

revoke all on function private.capturar_versao_avaliacao() from public, anon, authenticated;

drop trigger if exists validar_avaliacao_docente_trigger on public.avaliacoes_docentes;
create trigger validar_avaliacao_docente_trigger
before update on public.avaliacoes_docentes
for each row execute function private.validar_avaliacao_docente();

drop trigger if exists capturar_versao_avaliacao_trigger on public.avaliacoes_docentes;
create trigger capturar_versao_avaliacao_trigger
after insert or update of status on public.avaliacoes_docentes
for each row execute function private.capturar_versao_avaliacao();

drop trigger if exists professor_turma_materias_updated_at on public.professor_turma_materias;
create trigger professor_turma_materias_updated_at
before update on public.professor_turma_materias
for each row execute function public.set_updated_at();
drop trigger if exists questoes_avaliacao_updated_at on public.questoes_avaliacao;
create trigger questoes_avaliacao_updated_at
before update on public.questoes_avaliacao
for each row execute function public.set_updated_at();
drop trigger if exists respostas_avaliacao_updated_at on public.respostas_avaliacao;
create trigger respostas_avaliacao_updated_at
before update on public.respostas_avaliacao
for each row execute function public.set_updated_at();

alter table public.professor_turma_materias enable row level security;
alter table public.avaliacoes_versoes enable row level security;
alter table public.respostas_avaliacao enable row level security;
alter table public.avaliacoes_auditoria enable row level security;

-- Grants explicitos: nenhuma tabela pedagogica aceita TRUNCATE/REFERENCES pelo cliente.
revoke all on public.professor_turma_materias, public.avaliacoes_docentes,
  public.questoes_avaliacao, public.gabaritos_avaliacao, public.avaliacoes_versoes,
  public.tentativas_avaliacao, public.respostas_avaliacao, public.avaliacoes_auditoria
  from anon, authenticated;
grant select on public.professor_turma_materias, public.avaliacoes_docentes,
  public.questoes_avaliacao, public.gabaritos_avaliacao, public.avaliacoes_versoes,
  public.tentativas_avaliacao, public.respostas_avaliacao, public.avaliacoes_auditoria
  to authenticated;
grant insert, update, delete on public.professor_turma_materias,
  public.avaliacoes_docentes, public.questoes_avaliacao, public.gabaritos_avaliacao
  to authenticated;
grant insert (avaliacao_id, aluno_id, respostas, status, iniciada_em, numero_tentativa, versao_avaliacao)
  on public.tentativas_avaliacao to authenticated;
grant insert (tentativa_id, questao_id, aluno_id, resposta)
  on public.respostas_avaliacao to authenticated;
grant update (resposta, updated_at) on public.respostas_avaliacao to authenticated;
grant usage, select on sequence public.avaliacoes_auditoria_id_seq to service_role;

drop policy if exists professor_turma_materias_select on public.professor_turma_materias;
drop policy if exists professor_turma_materias_manage on public.professor_turma_materias;
drop policy if exists professor_turma_materias_insert on public.professor_turma_materias;
drop policy if exists professor_turma_materias_update on public.professor_turma_materias;
drop policy if exists professor_turma_materias_delete on public.professor_turma_materias;
create policy professor_turma_materias_select on public.professor_turma_materias
for select to authenticated using (
  professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor'
);
create policy professor_turma_materias_insert on public.professor_turma_materias
for insert to authenticated with check (
  (select public.usuario_role()) = 'gestor'
  and exists (select 1 from public.perfis p where p.id = professor_id and p.role = 'professor')
);
create policy professor_turma_materias_update on public.professor_turma_materias
for update to authenticated
using ((select public.usuario_role()) = 'gestor')
with check (
  (select public.usuario_role()) = 'gestor'
  and exists (select 1 from public.perfis p where p.id = professor_id and p.role = 'professor')
);
create policy professor_turma_materias_delete on public.professor_turma_materias
for delete to authenticated using ((select public.usuario_role()) = 'gestor');

drop policy if exists avaliacoes_select on public.avaliacoes_docentes;
drop policy if exists avaliacoes_insert on public.avaliacoes_docentes;
drop policy if exists avaliacoes_update on public.avaliacoes_docentes;
drop policy if exists avaliacoes_delete on public.avaliacoes_docentes;
create policy avaliacoes_select on public.avaliacoes_docentes
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or professor_id = (select auth.uid())
  or (
    status in ('publicado', 'encerrado')
    and turma_id = (select public.usuario_turma_id())
  )
);
create policy avaliacoes_insert on public.avaliacoes_docentes
for insert to authenticated with check (
  status = 'rascunho' and publicado_em is null
  and private.professor_tem_turma_materia(professor_id, turma_id, materia_codigo)
);
create policy avaliacoes_update on public.avaliacoes_docentes
for update to authenticated
using (
  (select public.usuario_role()) = 'gestor'
  or professor_id = (select auth.uid())
)
with check (
  (select public.usuario_role()) = 'gestor'
  or private.professor_tem_turma_materia(professor_id, turma_id, materia_codigo)
);
create policy avaliacoes_delete on public.avaliacoes_docentes
for delete to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or (professor_id = (select auth.uid()) and status = 'rascunho')
);

drop policy if exists questoes_select on public.questoes_avaliacao;
drop policy if exists questoes_manage on public.questoes_avaliacao;
drop policy if exists questoes_insert on public.questoes_avaliacao;
drop policy if exists questoes_update on public.questoes_avaliacao;
drop policy if exists questoes_delete on public.questoes_avaliacao;
create policy questoes_select on public.questoes_avaliacao
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.avaliacoes_docentes a
    where a.id = avaliacao_id and (
      a.professor_id = (select auth.uid())
      or (a.status in ('publicado', 'encerrado') and a.turma_id = (select public.usuario_turma_id()))
    )
  )
);
create policy questoes_insert on public.questoes_avaliacao
for insert to authenticated with check (
  (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho')
);
create policy questoes_update on public.questoes_avaliacao
for update to authenticated
using (
  (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho')
)
with check (
  (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho')
);
create policy questoes_delete on public.questoes_avaliacao
for delete to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho')
);

drop policy if exists gabaritos_select on public.gabaritos_avaliacao;
drop policy if exists gabaritos_manage on public.gabaritos_avaliacao;
drop policy if exists gabaritos_insert on public.gabaritos_avaliacao;
drop policy if exists gabaritos_update on public.gabaritos_avaliacao;
drop policy if exists gabaritos_delete on public.gabaritos_avaliacao;
create policy gabaritos_select on public.gabaritos_avaliacao
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.questoes_avaliacao q
    join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where q.id = questao_id and a.professor_id = (select auth.uid())
  )
);
create policy gabaritos_insert on public.gabaritos_avaliacao
for insert to authenticated with check (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.questoes_avaliacao q
    join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where q.id = questao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho'
  )
);
create policy gabaritos_update on public.gabaritos_avaliacao
for update to authenticated
using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.questoes_avaliacao q
    join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where q.id = questao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho'
  )
)
with check (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.questoes_avaliacao q
    join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where q.id = questao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho'
  )
);
create policy gabaritos_delete on public.gabaritos_avaliacao
for delete to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.questoes_avaliacao q
    join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where q.id = questao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho'
  )
);

drop policy if exists avaliacoes_versoes_select on public.avaliacoes_versoes;
create policy avaliacoes_versoes_select on public.avaliacoes_versoes
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.avaliacoes_docentes a
    where a.id = avaliacao_id and (
      a.professor_id = (select auth.uid())
      or (a.status in ('publicado', 'encerrado') and a.turma_id = (select public.usuario_turma_id()))
    )
  )
);

drop policy if exists tentativas_select on public.tentativas_avaliacao;
drop policy if exists tentativas_insert on public.tentativas_avaliacao;
drop policy if exists tentativas_update on public.tentativas_avaliacao;
create policy tentativas_select on public.tentativas_avaliacao
for select to authenticated using (
  aluno_id = (select auth.uid())
  or (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()))
);
create policy tentativas_insert on public.tentativas_avaliacao
for insert to authenticated with check (
  aluno_id = (select auth.uid())
  and status = 'em_andamento'
  and nota is null and feedback is null and enviada_em is null and corrigida_em is null
  and pontuacao_automatica = 0 and pontuacao_manual = 0 and requer_revisao = false
  and exists (
    select 1 from public.avaliacoes_docentes a
    where a.id = avaliacao_id
      and a.status = 'publicado'
      and a.turma_id = (select public.usuario_turma_id())
      and (a.abre_em is null or a.abre_em <= now())
      and (a.encerra_em is null or a.encerra_em >= now())
      and numero_tentativa <= a.tentativas_permitidas
      and versao_avaliacao = a.versao_atual
  )
);

drop policy if exists respostas_avaliacao_select on public.respostas_avaliacao;
drop policy if exists respostas_avaliacao_insert on public.respostas_avaliacao;
drop policy if exists respostas_avaliacao_update on public.respostas_avaliacao;
create policy respostas_avaliacao_select on public.respostas_avaliacao
for select to authenticated using (
  aluno_id = (select auth.uid())
  or (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.tentativas_avaliacao t
    join public.avaliacoes_docentes a on a.id = t.avaliacao_id
    where t.id = tentativa_id and a.professor_id = (select auth.uid())
  )
);
create policy respostas_avaliacao_insert on public.respostas_avaliacao
for insert to authenticated with check (
  aluno_id = (select auth.uid())
  and status_correcao = 'pendente' and correta is null
  and pontos_automaticos = 0 and pontos_manuais = 0
  and feedback is null and corrigida_em is null
  and exists (
    select 1
    from public.tentativas_avaliacao t
    join public.questoes_avaliacao q on q.avaliacao_id = t.avaliacao_id
    where t.id = tentativa_id and t.aluno_id = (select auth.uid())
      and t.status = 'em_andamento' and q.id = questao_id
  )
);
create policy respostas_avaliacao_update on public.respostas_avaliacao
for update to authenticated
using (
  aluno_id = (select auth.uid())
  and exists (select 1 from public.tentativas_avaliacao t where t.id = tentativa_id and t.aluno_id = (select auth.uid()) and t.status = 'em_andamento')
)
with check (
  aluno_id = (select auth.uid()) and status_correcao = 'pendente'
  and correta is null and pontos_automaticos = 0 and pontos_manuais = 0
  and feedback is null and corrigida_em is null
);

drop policy if exists avaliacoes_auditoria_select on public.avaliacoes_auditoria;
create policy avaliacoes_auditoria_select on public.avaliacoes_auditoria
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()))
  or exists (select 1 from public.tentativas_avaliacao t where t.id = tentativa_id and t.aluno_id = (select auth.uid()))
);

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 32/67: migrations/20260908_engine_atividades_fase2_1_ajustes.sql
-- ============================================================================

-- OminiSaber | Ajustes pós-advisor da Fase 2.1

create index if not exists professor_turma_materias_atribuido_por_idx
  on public.professor_turma_materias (atribuido_por)
  where atribuido_por is not null;
create index if not exists respostas_avaliacao_aluno_idx
  on public.respostas_avaliacao (aluno_id, tentativa_id);
create index if not exists respostas_avaliacao_questao_idx
  on public.respostas_avaliacao (questao_id);
create index if not exists avaliacoes_auditoria_tentativa_idx
  on public.avaliacoes_auditoria (tentativa_id, created_at desc)
  where tentativa_id is not null;
create index if not exists avaliacoes_auditoria_ator_idx
  on public.avaliacoes_auditoria (ator_id, created_at desc)
  where ator_id is not null;

drop policy if exists professor_turma_materias_manage on public.professor_turma_materias;
drop policy if exists professor_turma_materias_insert on public.professor_turma_materias;
drop policy if exists professor_turma_materias_update on public.professor_turma_materias;
drop policy if exists professor_turma_materias_delete on public.professor_turma_materias;
create policy professor_turma_materias_insert on public.professor_turma_materias
for insert to authenticated with check (
  (select public.usuario_role()) = 'gestor'
  and exists (select 1 from public.perfis p where p.id = professor_id and p.role = 'professor')
);
create policy professor_turma_materias_update on public.professor_turma_materias
for update to authenticated
using ((select public.usuario_role()) = 'gestor')
with check (
  (select public.usuario_role()) = 'gestor'
  and exists (select 1 from public.perfis p where p.id = professor_id and p.role = 'professor')
);
create policy professor_turma_materias_delete on public.professor_turma_materias
for delete to authenticated using ((select public.usuario_role()) = 'gestor');

-- A associação questão-habilidade não precisa de UPDATE: trocar descritor é
-- remover e inserir. Separar operações elimina uma política SELECT redundante.
drop policy if exists questoes_avaliacao_habilidades_manage on public.questoes_avaliacao_habilidades;
drop policy if exists questoes_avaliacao_habilidades_insert on public.questoes_avaliacao_habilidades;
drop policy if exists questoes_avaliacao_habilidades_delete on public.questoes_avaliacao_habilidades;
create policy questoes_avaliacao_habilidades_insert on public.questoes_avaliacao_habilidades
for insert to authenticated with check (
  public.habilidade_curricular_publicada(habilidade_id)
  and (
    (select public.usuario_role()) = 'gestor'
    or exists (
      select 1
      from public.questoes_avaliacao q
      join public.avaliacoes_docentes a on a.id = q.avaliacao_id
      where q.id = questao_id
        and a.professor_id = (select auth.uid())
        and a.status = 'rascunho'
        and private.professor_tem_turma_materia(a.professor_id, a.turma_id, a.materia_codigo)
    )
  )
);
create policy questoes_avaliacao_habilidades_delete on public.questoes_avaliacao_habilidades
for delete to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1
    from public.questoes_avaliacao q
    join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where q.id = questao_id
      and a.professor_id = (select auth.uid())
      and a.status = 'rascunho'
  )
);

revoke update on public.questoes_avaliacao_habilidades from authenticated;

-- ============================================================================
-- ETAPA 33/67: migrations/20260908_construtor_atividades_fase2_2.sql
-- ============================================================================

-- OminiSaber | Fase 2.2 - criacao atomica de atividades pelo professor

create or replace function public.criar_atividade_docente(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_professor_id uuid := (select auth.uid());
  v_tipo_professor public.tipo_professor;
  v_turma_id uuid;
  v_materia public.materia_aluno;
  v_avaliacao_id uuid;
  v_questao_id uuid;
  v_titulo text := btrim(coalesce(p_payload->>'title', ''));
  v_categoria text := coalesce(nullif(p_payload->>'category', ''), 'atividade');
  v_modo_pontuacao text := coalesce(nullif(p_payload->>'scoringMode', ''), 'igual');
  v_valor numeric(6,2) := coalesce(nullif(p_payload->>'value', '')::numeric, 10);
  v_total_manual numeric(10,2);
  v_quantidade integer;
  v_ordem integer;
  v_pontos numeric(6,2);
  v_item jsonb;
  v_habilidade text;
  v_publicar boolean := coalesce((p_payload->>'publish')::boolean, false);
begin
  if v_professor_id is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  select p.tipo_professor into v_tipo_professor
  from public.perfis p
  where p.id = v_professor_id and p.role = 'professor' and p.ativo = true;
  if v_tipo_professor is null then
    raise exception 'A conta atual nao possui um perfil docente ativo.';
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Os dados da atividade sao invalidos.';
  end if;
  if char_length(v_titulo) < 3 or char_length(v_titulo) > 140 then
    raise exception 'O titulo deve ter entre 3 e 140 caracteres.';
  end if;
  if v_categoria not in ('atividade', 'avaliacao', 'diagnostica', 'recuperacao') then
    raise exception 'Categoria de atividade invalida.';
  end if;
  if v_modo_pontuacao not in ('igual', 'manual') then
    raise exception 'Modo de pontuacao invalido.';
  end if;
  if v_valor <= 0 or v_valor > 1000 then
    raise exception 'O valor total deve ser maior que zero e no maximo 1000.';
  end if;

  begin
    v_turma_id := nullif(p_payload->>'classId', '')::uuid;
    v_materia := nullif(p_payload->>'subject', '')::public.materia_aluno;
  exception when others then
    raise exception 'Turma ou materia invalida.';
  end;
  if v_turma_id is null or v_materia is null then
    raise exception 'Selecione a turma e a materia.';
  end if;
  if not private.professor_tem_turma_materia(v_professor_id, v_turma_id, v_materia) then
    raise exception 'Voce nao possui vinculo ativo com esta turma e materia.';
  end if;

  if jsonb_typeof(p_payload->'questions') <> 'array' then
    raise exception 'Adicione pelo menos uma questao.';
  end if;
  v_quantidade := jsonb_array_length(p_payload->'questions');
  if v_quantidade < 1 or v_quantidade > 100 then
    raise exception 'A atividade deve possuir entre 1 e 100 questoes.';
  end if;

  if nullif(p_payload->>'opensAt', '') is not null
     and nullif(p_payload->>'closesAt', '') is not null
     and (p_payload->>'closesAt')::timestamptz <= (p_payload->>'opensAt')::timestamptz then
    raise exception 'O encerramento precisa acontecer depois da abertura.';
  end if;

  if v_modo_pontuacao = 'manual' then
    select coalesce(sum(coalesce(nullif(q.value->>'points', '')::numeric, 0)), 0)
      into v_total_manual
    from jsonb_array_elements(p_payload->'questions') q;
    if abs(v_total_manual - v_valor) > 0.01 then
      raise exception 'A soma dos pontos (%) precisa ser igual ao valor total (%).', v_total_manual, v_valor;
    end if;
  end if;

  if v_publicar and v_materia in ('matematica', 'fisica', 'quimica', 'biologia', 'portugues')
     and not exists (
       select 1
       from jsonb_array_elements(p_payload->'questions') q
       cross join lateral jsonb_array_elements_text(coalesce(q.value->'skillIds', '[]'::jsonb)) h
     ) then
    raise exception 'Vincule pelo menos uma habilidade ou descritor antes de publicar.';
  end if;

  insert into public.avaliacoes_docentes (
    professor_id, turma_id, tipo_professor, materia_codigo, categoria,
    serie, trimestre, titulo, instrucoes, duracao_minutos, valor,
    modo_pontuacao, tentativas_permitidas, embaralhar_questoes,
    embaralhar_alternativas, feedback_imediato, exibir_gabarito,
    configuracao, status, abre_em, encerra_em
  ) values (
    v_professor_id,
    v_turma_id,
    v_tipo_professor,
    v_materia,
    v_categoria,
    nullif(p_payload->>'series', '')::smallint,
    nullif(p_payload->>'trimester', '')::smallint,
    v_titulo,
    coalesce(p_payload->>'instructions', ''),
    nullif(p_payload->>'duration', '')::integer,
    v_valor,
    v_modo_pontuacao,
    coalesce(nullif(p_payload->>'attempts', '')::smallint, 1),
    coalesce((p_payload->>'shuffleQuestions')::boolean, false),
    coalesce((p_payload->>'shuffleAlternatives')::boolean, false),
    coalesce((p_payload->>'immediateFeedback')::boolean, false),
    coalesce((p_payload->>'showAnswerKey')::boolean, false),
    coalesce(p_payload->'configuration', '{}'::jsonb),
    'rascunho',
    nullif(p_payload->>'opensAt', '')::timestamptz,
    nullif(p_payload->>'closesAt', '')::timestamptz
  ) returning id into v_avaliacao_id;

  for v_item, v_ordem in
    select q.value, q.ordinality::integer
    from jsonb_array_elements(p_payload->'questions') with ordinality q(value, ordinality)
  loop
    if char_length(btrim(coalesce(v_item->>'statement', ''))) < 3 then
      raise exception 'A questao % precisa de um enunciado valido.', v_ordem;
    end if;

    if v_modo_pontuacao = 'igual' then
      if v_ordem = v_quantidade then
        v_pontos := v_valor - round(v_valor / v_quantidade, 2) * (v_quantidade - 1);
      else
        v_pontos := round(v_valor / v_quantidade, 2);
      end if;
    else
      v_pontos := nullif(v_item->>'points', '')::numeric;
    end if;
    if v_pontos is null or v_pontos <= 0 then
      raise exception 'A questao % precisa ter pontuacao maior que zero.', v_ordem;
    end if;

    insert into public.questoes_avaliacao (
      avaliacao_id, ordem, tipo, enunciado, alternativas, pontos,
      configuracao, explicacao, obrigatoria
    ) values (
      v_avaliacao_id,
      v_ordem,
      v_item->>'type',
      btrim(v_item->>'statement'),
      coalesce(v_item->'alternatives', '[]'::jsonb),
      v_pontos,
      coalesce(v_item->'configuration', '{}'::jsonb),
      nullif(btrim(coalesce(v_item->>'explanation', '')), ''),
      coalesce((v_item->>'required')::boolean, true)
    ) returning id into v_questao_id;

    insert into public.gabaritos_avaliacao (questao_id, resposta_esperada)
    values (
      v_questao_id,
      jsonb_build_object(
        'value', coalesce(v_item->'answer', to_jsonb(coalesce(v_item->>'answerText', ''))),
        'normalization', coalesce(v_item->'answerConfiguration', '{}'::jsonb)
      )
    );

    for v_habilidade in
      select distinct h.value
      from jsonb_array_elements_text(coalesce(v_item->'skillIds', '[]'::jsonb)) h(value)
    loop
      if not exists (
        select 1 from public.habilidades_curriculares hc
        where hc.id = v_habilidade::uuid
          and hc.materia_codigo = v_materia
          and public.habilidade_curricular_publicada(hc.id)
      ) then
        raise exception 'A questao % possui habilidade invalida para a materia.', v_ordem;
      end if;
      insert into public.questoes_avaliacao_habilidades (questao_id, habilidade_id)
      values (v_questao_id, v_habilidade::uuid);
    end loop;
  end loop;

  if v_publicar then
    update public.avaliacoes_docentes
    set status = 'publicado', publicado_em = now()
    where id = v_avaliacao_id;
  end if;

  return v_avaliacao_id;
end;
$$;

revoke all on function public.criar_atividade_docente(jsonb) from public, anon;
grant execute on function public.criar_atividade_docente(jsonb) to authenticated;

-- ============================================================================
-- ETAPA 34/67: migrations/20260908_execucao_correcao_atividades_fase2_3.sql
-- ============================================================================

-- OminiSaber | Fase 2.3 - execucao do aluno e correcao automatica

create or replace function private.normalizar_resposta_avaliacao(p_valor jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(
    case
      when jsonb_typeof(p_valor) = 'object' and p_valor ? 'value' then p_valor->>'value'
      when jsonb_typeof(p_valor) = 'string' then p_valor #>> '{}'
      else p_valor::text
    end,
    ''
  )), '\s+', ' ', 'g'));
$$;

revoke all on function private.normalizar_resposta_avaliacao(jsonb) from public, anon, authenticated;

create or replace function private.corrigir_entrega_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avaliacao public.avaliacoes_docentes%rowtype;
  v_questoes_obrigatorias integer;
  v_respostas_obrigatorias integer;
  v_automaticos numeric(6,2) := 0;
  v_requer_revisao boolean := false;
  v_correta boolean;
  v_resposta_texto text;
  v_esperada_texto text;
  v_item record;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if (select public.usuario_role()) <> 'aluno' then
    return new;
  end if;
  if old.status <> 'em_andamento' or new.status <> 'enviada' then
    raise exception 'Esta tentativa nao pode ser enviada neste estado.';
  end if;
  if (select auth.uid()) is null or new.aluno_id <> (select auth.uid()) then
    raise exception 'Somente o aluno responsavel pode entregar esta tentativa.';
  end if;

  select a.* into v_avaliacao
  from public.avaliacoes_docentes a
  where a.id = new.avaliacao_id
  for share;
  if not found or v_avaliacao.turma_id <> (select public.usuario_turma_id()) then
    raise exception 'A atividade nao pertence a turma do aluno.';
  end if;
  if v_avaliacao.encerra_em is not null and v_avaliacao.encerra_em < now() then
    raise exception 'O prazo desta atividade foi encerrado.';
  end if;

  select count(*) into v_questoes_obrigatorias
  from public.questoes_avaliacao q
  where q.avaliacao_id = new.avaliacao_id and q.obrigatoria;
  select count(*) into v_respostas_obrigatorias
  from public.respostas_avaliacao r
  join public.questoes_avaliacao q on q.id = r.questao_id
  where r.tentativa_id = new.id and q.avaliacao_id = new.avaliacao_id
    and q.obrigatoria and r.resposta <> 'null'::jsonb;
  if v_respostas_obrigatorias < v_questoes_obrigatorias then
    raise exception 'Responda todas as questoes obrigatorias antes de enviar.';
  end if;

  for v_item in
    select r.id as resposta_id, r.resposta, q.tipo, q.pontos, q.explicacao,
      g.resposta_esperada
    from public.respostas_avaliacao r
    join public.questoes_avaliacao q on q.id = r.questao_id
    join public.gabaritos_avaliacao g on g.questao_id = q.id
    where r.tentativa_id = new.id
    order by q.ordem
  loop
    if v_item.tipo in ('dissertativa', 'codigo', 'estudo_caso') then
      v_requer_revisao := true;
      update public.respostas_avaliacao
      set status_correcao = 'revisao', correta = null, pontos_automaticos = 0,
        feedback = null, corrigida_em = null
      where id = v_item.resposta_id;
    else
      v_resposta_texto := private.normalizar_resposta_avaliacao(v_item.resposta);
      v_esperada_texto := private.normalizar_resposta_avaliacao(v_item.resposta_esperada->'value');
      if v_item.tipo = 'numerica' then
        begin
          v_correta := abs(replace(v_resposta_texto, ',', '.')::numeric - replace(v_esperada_texto, ',', '.')::numeric) <= 0.000001;
        exception when others then
          v_correta := false;
        end;
      elsif v_item.tipo = 'multipla_escolha' then
        v_correta := (
          select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
          from jsonb_array_elements_text(
            case when jsonb_typeof(v_item.resposta) = 'array' then v_item.resposta else coalesce(v_item.resposta->'value', '[]'::jsonb) end
          ) x
        ) = (
          select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
          from jsonb_array_elements_text(
            case when jsonb_typeof(v_item.resposta_esperada->'value') = 'array' then v_item.resposta_esperada->'value' else '[]'::jsonb end
          ) x
        );
      else
        v_correta := v_resposta_texto = v_esperada_texto;
      end if;
      if v_correta then v_automaticos := v_automaticos + v_item.pontos; end if;
      update public.respostas_avaliacao
      set status_correcao = 'automatica', correta = v_correta,
        pontos_automaticos = case when v_correta then v_item.pontos else 0 end,
        feedback = case
          when v_avaliacao.feedback_imediato or v_avaliacao.exibir_gabarito then v_item.explicacao
          else null
        end,
        corrigida_em = now()
      where id = v_item.resposta_id;
    end if;
  end loop;

  new.pontuacao_automatica := v_automaticos;
  new.pontuacao_manual := 0;
  new.requer_revisao := v_requer_revisao;
  new.enviada_em := now();
  new.bloqueada_em := now();
  new.nota := v_automaticos;
  new.status := case when v_requer_revisao then 'enviada' else 'corrigida' end;
  new.corrigida_em := case when v_requer_revisao then null else now() end;
  new.feedback := case when v_requer_revisao then 'Aguardando revisao do professor.' else 'Correcao automatica concluida.' end;

  insert into public.avaliacoes_auditoria (avaliacao_id, tentativa_id, ator_id, evento, detalhes)
  values (new.avaliacao_id, new.id, new.aluno_id, 'entregue', jsonb_build_object(
    'numero_tentativa', new.numero_tentativa,
    'pontuacao_automatica', v_automaticos,
    'requer_revisao', v_requer_revisao
  ));
  return new;
end;
$$;

revoke all on function private.corrigir_entrega_avaliacao() from public, anon, authenticated;

drop trigger if exists corrigir_entrega_avaliacao_trigger on public.tentativas_avaliacao;
create trigger corrigir_entrega_avaliacao_trigger
before update of status on public.tentativas_avaliacao
for each row execute function private.corrigir_entrega_avaliacao();

grant update (status, enviada_em) on public.tentativas_avaliacao to authenticated;

drop policy if exists tentativas_update_aluno on public.tentativas_avaliacao;
create policy tentativas_update_aluno on public.tentativas_avaliacao
for update to authenticated
using (
  aluno_id = (select auth.uid()) and status = 'em_andamento'
)
with check (
  aluno_id = (select auth.uid()) and status in ('enviada', 'corrigida')
);

create or replace function public.iniciar_tentativa_avaliacao(p_avaliacao_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_aluno_id uuid := (select auth.uid());
  v_avaliacao public.avaliacoes_docentes%rowtype;
  v_existente uuid;
  v_numero smallint;
  v_tentativa_id uuid;
begin
  if v_aluno_id is null or (select public.usuario_role()) <> 'aluno' then
    raise exception 'Uma conta de aluno autenticada e obrigatoria.';
  end if;
  select a.* into v_avaliacao from public.avaliacoes_docentes a
  where a.id = p_avaliacao_id;
  if not found or v_avaliacao.status <> 'publicado'
     or v_avaliacao.turma_id <> (select public.usuario_turma_id()) then
    raise exception 'Atividade indisponivel para este aluno.';
  end if;
  if (v_avaliacao.abre_em is not null and v_avaliacao.abre_em > now())
     or (v_avaliacao.encerra_em is not null and v_avaliacao.encerra_em < now()) then
    raise exception 'A atividade esta fora do periodo de realizacao.';
  end if;
  select t.id into v_existente from public.tentativas_avaliacao t
  where t.avaliacao_id = p_avaliacao_id and t.aluno_id = v_aluno_id
    and t.status = 'em_andamento' order by t.numero_tentativa desc limit 1;
  if v_existente is not null then return v_existente; end if;

  select (coalesce(max(t.numero_tentativa), 0) + 1)::smallint into v_numero
  from public.tentativas_avaliacao t
  where t.avaliacao_id = p_avaliacao_id and t.aluno_id = v_aluno_id;
  if v_numero > v_avaliacao.tentativas_permitidas then
    raise exception 'O limite de tentativas desta atividade foi atingido.';
  end if;
  insert into public.tentativas_avaliacao (
    avaliacao_id, aluno_id, respostas, status, numero_tentativa, versao_avaliacao
  ) values (
    p_avaliacao_id, v_aluno_id, '{}'::jsonb, 'em_andamento', v_numero, v_avaliacao.versao_atual
  ) returning id into v_tentativa_id;
  return v_tentativa_id;
end;
$$;

create or replace function public.salvar_resposta_avaliacao(
  p_tentativa_id uuid,
  p_questao_id uuid,
  p_resposta jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_resposta_id uuid;
begin
  if (select auth.uid()) is null or (select public.usuario_role()) <> 'aluno' then
    raise exception 'Uma conta de aluno autenticada e obrigatoria.';
  end if;
  if not exists (
    select 1 from public.tentativas_avaliacao t
    join public.questoes_avaliacao q on q.avaliacao_id = t.avaliacao_id
    where t.id = p_tentativa_id and t.aluno_id = (select auth.uid())
      and t.status = 'em_andamento' and q.id = p_questao_id
  ) then
    raise exception 'Tentativa ou questao indisponivel.';
  end if;
  insert into public.respostas_avaliacao (tentativa_id, questao_id, aluno_id, resposta)
  values (p_tentativa_id, p_questao_id, (select auth.uid()), coalesce(p_resposta, 'null'::jsonb))
  on conflict (tentativa_id, questao_id) do update
  set resposta = excluded.resposta, updated_at = now()
  returning id into v_resposta_id;
  return v_resposta_id;
end;
$$;

create or replace function public.entregar_tentativa_avaliacao(p_tentativa_id uuid)
returns table (
  tentativa_id uuid,
  status text,
  nota numeric,
  pontuacao_automatica numeric,
  requer_revisao boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.tentativas_avaliacao t
  set status = 'enviada', enviada_em = now()
  where t.id = p_tentativa_id and t.aluno_id = (select auth.uid()) and t.status = 'em_andamento';
  if not found then raise exception 'Tentativa indisponivel para entrega.'; end if;
  return query select t.id, t.status, t.nota, t.pontuacao_automatica, t.requer_revisao
  from public.tentativas_avaliacao t where t.id = p_tentativa_id;
end;
$$;

revoke all on function public.iniciar_tentativa_avaliacao(uuid) from public, anon;
revoke all on function public.salvar_resposta_avaliacao(uuid, uuid, jsonb) from public, anon;
revoke all on function public.entregar_tentativa_avaliacao(uuid) from public, anon;
grant execute on function public.iniciar_tentativa_avaliacao(uuid) to authenticated;
grant execute on function public.salvar_resposta_avaliacao(uuid, uuid, jsonb) to authenticated;
grant execute on function public.entregar_tentativa_avaliacao(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 35/67: migrations/20260908_execucao_correcao_atividades_fase2_3_ajustes.sql
-- ============================================================================

-- OminiSaber | Fase 2.3 - ajuste de inicio de tentativa para privilegios do aluno

create or replace function public.iniciar_tentativa_avaliacao(p_avaliacao_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_aluno_id uuid := (select auth.uid());
  v_avaliacao public.avaliacoes_docentes%rowtype;
  v_existente uuid;
  v_numero smallint;
  v_tentativa_id uuid;
begin
  if v_aluno_id is null or (select public.usuario_role()) <> 'aluno' then
    raise exception 'Uma conta de aluno autenticada e obrigatoria.';
  end if;
  select a.* into v_avaliacao from public.avaliacoes_docentes a
  where a.id = p_avaliacao_id;
  if not found or v_avaliacao.status <> 'publicado'
     or v_avaliacao.turma_id <> (select public.usuario_turma_id()) then
    raise exception 'Atividade indisponivel para este aluno.';
  end if;
  if (v_avaliacao.abre_em is not null and v_avaliacao.abre_em > now())
     or (v_avaliacao.encerra_em is not null and v_avaliacao.encerra_em < now()) then
    raise exception 'A atividade esta fora do periodo de realizacao.';
  end if;
  select t.id into v_existente from public.tentativas_avaliacao t
  where t.avaliacao_id = p_avaliacao_id and t.aluno_id = v_aluno_id
    and t.status = 'em_andamento' order by t.numero_tentativa desc limit 1;
  if v_existente is not null then return v_existente; end if;
  select (coalesce(max(t.numero_tentativa), 0) + 1)::smallint into v_numero
  from public.tentativas_avaliacao t
  where t.avaliacao_id = p_avaliacao_id and t.aluno_id = v_aluno_id;
  if v_numero > v_avaliacao.tentativas_permitidas then
    raise exception 'O limite de tentativas desta atividade foi atingido.';
  end if;
  insert into public.tentativas_avaliacao (
    avaliacao_id, aluno_id, respostas, status, numero_tentativa, versao_avaliacao
  ) values (
    p_avaliacao_id, v_aluno_id, '{}'::jsonb, 'em_andamento', v_numero, v_avaliacao.versao_atual
  ) returning id into v_tentativa_id;
  return v_tentativa_id;
end;
$$;

revoke all on function public.iniciar_tentativa_avaliacao(uuid) from public, anon;
grant execute on function public.iniciar_tentativa_avaliacao(uuid) to authenticated;

-- ============================================================================
-- ETAPA 36/67: migrations/20260908_execucao_correcao_atividades_fase2_3_compatibilidade.sql
-- ============================================================================

-- OminiSaber | Fase 2.3 - compatibilidade com validacao legada de tentativas

create or replace function public.validar_atualizacao_tentativa_docente()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  papel public.perfil_role := (select public.usuario_role());
begin
  if new.id <> old.id then
    raise exception 'A identidade da tentativa e imutavel.';
  end if;
  if papel = 'aluno' then
    if old.aluno_id <> (select auth.uid())
      or new.aluno_id <> old.aluno_id
      or new.avaliacao_id <> old.avaliacao_id
      or new.numero_tentativa <> old.numero_tentativa
      or new.versao_avaliacao <> old.versao_avaliacao
      or old.status <> 'em_andamento'
      or new.status not in ('enviada', 'corrigida') then
      raise exception 'O aluno nao pode alterar autoria, correcao ou uma tentativa ja enviada.';
    end if;
  elsif papel = 'professor' then
    if new.aluno_id <> old.aluno_id
      or new.avaliacao_id <> old.avaliacao_id
      or new.respostas is distinct from old.respostas
      or new.iniciada_em is distinct from old.iniciada_em
      or new.enviada_em is distinct from old.enviada_em then
      raise exception 'O professor pode corrigir a tentativa, mas nao alterar as respostas do aluno.';
    end if;
  elsif papel <> 'gestor' then
    raise exception 'Perfil sem permissao para atualizar tentativas.';
  end if;
  return new;
end;
$$;

revoke all on function public.validar_atualizacao_tentativa_docente() from public, anon, authenticated;

-- ============================================================================
-- ETAPA 37/67: migrations/20260908_correcao_docente_resultados_fase2_3.sql
-- ============================================================================

-- OminiSaber | Fase 2.3 - correcao docente e resultados por descritor

create index if not exists tentativas_avaliacao_revisao_docente_idx
  on public.tentativas_avaliacao (avaliacao_id, enviada_em desc)
  where requer_revisao = true and status = 'enviada';

create or replace function public.corrigir_resposta_avaliacao(
  p_resposta_id uuid,
  p_pontos numeric,
  p_feedback text default null
)
returns table (
  resposta_id uuid,
  tentativa_id uuid,
  status_tentativa text,
  nota numeric,
  pontuacao_automatica numeric,
  pontuacao_manual numeric,
  requer_revisao boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resposta public.respostas_avaliacao;
  v_tentativa public.tentativas_avaliacao;
  v_avaliacao public.avaliacoes_docentes;
  v_maximo numeric(6,2);
  v_automatica numeric(8,2);
  v_manual numeric(8,2);
  v_pendentes integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessao autenticada obrigatoria.';
  end if;

  select r.* into v_resposta
  from public.respostas_avaliacao r
  where r.id = p_resposta_id
  for update;
  if not found then raise exception 'Resposta nao encontrada.'; end if;

  select t.* into v_tentativa
  from public.tentativas_avaliacao t
  where t.id = v_resposta.tentativa_id
  for update;

  select a.* into v_avaliacao
  from public.avaliacoes_docentes a
  where a.id = v_tentativa.avaliacao_id;

  if (select public.usuario_role()) <> 'gestor'
     and v_avaliacao.professor_id <> (select auth.uid()) then
    raise exception 'Voce nao pode corrigir esta resposta.';
  end if;
  if v_tentativa.status not in ('enviada', 'corrigida') then
    raise exception 'A tentativa ainda nao foi entregue.';
  end if;
  if v_resposta.status_correcao not in ('revisao', 'manual') then
    raise exception 'Esta resposta nao aceita correcao manual.';
  end if;

  select q.pontos into v_maximo
  from public.questoes_avaliacao q
  where q.id = v_resposta.questao_id;
  if p_pontos is null or p_pontos < 0 or p_pontos > v_maximo then
    raise exception 'A pontuacao deve estar entre 0 e %.', v_maximo;
  end if;

  update public.respostas_avaliacao r
  set status_correcao = 'manual',
      correta = (p_pontos = v_maximo),
      pontos_manuais = round(p_pontos, 2),
      feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
      corrigida_em = now(),
      updated_at = now()
  where r.id = p_resposta_id;

  select
    coalesce(sum(r.pontos_automaticos), 0),
    coalesce(sum(r.pontos_manuais), 0),
    count(*) filter (where r.status_correcao in ('pendente', 'revisao'))
  into v_automatica, v_manual, v_pendentes
  from public.respostas_avaliacao r
  where r.tentativa_id = v_tentativa.id;

  update public.tentativas_avaliacao t
  set pontuacao_automatica = v_automatica,
      pontuacao_manual = v_manual,
      nota = least(v_avaliacao.valor, v_automatica + v_manual),
      requer_revisao = v_pendentes > 0,
      status = case when v_pendentes = 0 then 'corrigida' else 'enviada' end,
      corrigida_em = case when v_pendentes = 0 then now() else null end,
      feedback = case when v_pendentes = 0
        then 'Correcao concluida. Consulte as devolutivas em cada questao.'
        else t.feedback end
  where t.id = v_tentativa.id;

  insert into public.avaliacoes_auditoria
    (avaliacao_id, tentativa_id, ator_id, evento, detalhes)
  values
    (v_avaliacao.id, v_tentativa.id, (select auth.uid()), 'resposta_corrigida',
     jsonb_build_object('resposta_id', p_resposta_id, 'pontos', round(p_pontos, 2),
       'maximo', v_maximo, 'correcao_concluida', v_pendentes = 0));

  return query
  select r.id, t.id, t.status, t.nota, t.pontuacao_automatica,
    t.pontuacao_manual, t.requer_revisao
  from public.respostas_avaliacao r
  join public.tentativas_avaliacao t on t.id = r.tentativa_id
  where r.id = p_resposta_id;
end;
$$;

revoke all on function public.corrigir_resposta_avaliacao(uuid, numeric, text)
  from public, anon;
grant execute on function public.corrigir_resposta_avaliacao(uuid, numeric, text)
  to authenticated;

create or replace function public.resultados_avaliacao_docente(p_avaliacao_id uuid)
returns table (
  tentativa_id uuid,
  aluno_id uuid,
  aluno_nome text,
  matricula text,
  numero_tentativa smallint,
  status text,
  nota numeric,
  pontuacao_automatica numeric,
  pontuacao_manual numeric,
  requer_revisao boolean,
  respondidas bigint,
  total_questoes bigint,
  enviada_em timestamptz,
  corrigida_em timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.avaliacoes_docentes a
    where a.id = p_avaliacao_id
      and (a.professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor')
  ) then raise exception 'Avaliacao nao encontrada ou sem permissao.'; end if;

  return query
  select t.id, t.aluno_id, p.nome, p.matricula, t.numero_tentativa,
    t.status, t.nota, t.pontuacao_automatica, t.pontuacao_manual,
    t.requer_revisao, count(r.id),
    (select count(*) from public.questoes_avaliacao q where q.avaliacao_id = p_avaliacao_id),
    t.enviada_em, t.corrigida_em
  from public.tentativas_avaliacao t
  join public.perfis p on p.id = t.aluno_id
  left join public.respostas_avaliacao r on r.tentativa_id = t.id
  where t.avaliacao_id = p_avaliacao_id
  group by t.id, p.id
  order by t.enviada_em desc nulls last, p.nome;
end;
$$;

create or replace function public.resultados_descritores_avaliacao(p_avaliacao_id uuid)
returns table (
  habilidade_id uuid,
  codigo text,
  descricao text,
  descritores jsonb,
  respostas bigint,
  pontos_obtidos numeric,
  pontos_possiveis numeric,
  aproveitamento numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.avaliacoes_docentes a
    where a.id = p_avaliacao_id
      and (a.professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor')
  ) then raise exception 'Avaliacao nao encontrada ou sem permissao.'; end if;

  return query
  select h.id, h.codigo, h.descricao,
    coalesce((select jsonb_agg(distinct jsonb_build_object('codigo', d.codigo, 'descricao', d.descricao))
      from public.habilidade_descritores hd
      join public.descritores_curriculares d on d.id = hd.descritor_id
      where hd.habilidade_id = h.id), '[]'::jsonb),
    count(r.id),
    round(coalesce(sum(r.pontos_automaticos + r.pontos_manuais), 0), 2),
    round(coalesce(sum(q.pontos), 0), 2),
    round(case when coalesce(sum(q.pontos), 0) > 0
      then 100 * sum(r.pontos_automaticos + r.pontos_manuais) / sum(q.pontos)
      else 0 end, 1)
  from public.questoes_avaliacao_habilidades qh
  join public.habilidades_curriculares h on h.id = qh.habilidade_id
  join public.questoes_avaliacao q on q.id = qh.questao_id and q.avaliacao_id = p_avaliacao_id
  left join public.respostas_avaliacao r on r.questao_id = q.id
  left join public.tentativas_avaliacao t on t.id = r.tentativa_id
    and t.avaliacao_id = p_avaliacao_id and t.status in ('enviada', 'corrigida')
  where r.id is null or t.id is not null
  group by h.id
  order by aproveitamento asc, h.codigo;
end;
$$;

revoke all on function public.resultados_avaliacao_docente(uuid) from public, anon;
revoke all on function public.resultados_descritores_avaliacao(uuid) from public, anon;
grant execute on function public.resultados_avaliacao_docente(uuid) to authenticated;
grant execute on function public.resultados_descritores_avaliacao(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 38/67: migrations/20260908_correcao_docente_resultados_fase2_3_ajustes.sql
-- ============================================================================

-- OminiSaber | Fase 2.3 - correcao docente com privilegios minimos por RLS

grant update (status_correcao, correta, pontos_manuais, feedback, corrigida_em, updated_at)
  on public.respostas_avaliacao to authenticated;

drop policy if exists respostas_avaliacao_correcao_docente on public.respostas_avaliacao;
create policy respostas_avaliacao_correcao_docente on public.respostas_avaliacao
for update to authenticated
using (
  status_correcao in ('revisao', 'manual')
  and exists (
    select 1 from public.tentativas_avaliacao t
    join public.avaliacoes_docentes a on a.id = t.avaliacao_id
    where t.id = tentativa_id and t.status in ('enviada', 'corrigida')
      and (a.professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor')
  )
)
with check (
  status_correcao = 'manual' and pontos_manuais >= 0
  and pontos_manuais <= (select q.pontos from public.questoes_avaliacao q where q.id = questao_id)
  and exists (
    select 1 from public.tentativas_avaliacao t
    join public.avaliacoes_docentes a on a.id = t.avaliacao_id
    where t.id = tentativa_id and t.status in ('enviada', 'corrigida')
      and (a.professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor')
  )
);

create or replace function private.recalcular_tentativa_correcao_docente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avaliacao public.avaliacoes_docentes;
  v_automatica numeric(8,2);
  v_manual numeric(8,2);
  v_pendentes integer;
begin
  if new.status_correcao <> 'manual' then return new; end if;
  select a.* into v_avaliacao
  from public.tentativas_avaliacao t
  join public.avaliacoes_docentes a on a.id = t.avaliacao_id
  where t.id = new.tentativa_id;
  select coalesce(sum(r.pontos_automaticos), 0),
    coalesce(sum(r.pontos_manuais), 0),
    count(*) filter (where r.status_correcao in ('pendente', 'revisao'))
  into v_automatica, v_manual, v_pendentes
  from public.respostas_avaliacao r where r.tentativa_id = new.tentativa_id;
  update public.tentativas_avaliacao t
  set pontuacao_automatica = v_automatica, pontuacao_manual = v_manual,
      nota = least(v_avaliacao.valor, v_automatica + v_manual),
      requer_revisao = v_pendentes > 0,
      status = case when v_pendentes = 0 then 'corrigida' else 'enviada' end,
      corrigida_em = case when v_pendentes = 0 then now() else null end,
      feedback = case when v_pendentes = 0
        then 'Correcao concluida. Consulte as devolutivas em cada questao.' else t.feedback end
  where t.id = new.tentativa_id;
  insert into public.avaliacoes_auditoria
    (avaliacao_id, tentativa_id, ator_id, evento, detalhes)
  values (v_avaliacao.id, new.tentativa_id, (select auth.uid()), 'resposta_corrigida',
    jsonb_build_object('resposta_id', new.id, 'pontos', new.pontos_manuais,
      'correcao_concluida', v_pendentes = 0));
  return new;
end;
$$;

revoke all on function private.recalcular_tentativa_correcao_docente()
  from public, anon, authenticated;
drop trigger if exists recalcular_tentativa_correcao_docente_trigger on public.respostas_avaliacao;
create trigger recalcular_tentativa_correcao_docente_trigger
after update of status_correcao, pontos_manuais, feedback on public.respostas_avaliacao
for each row execute function private.recalcular_tentativa_correcao_docente();

create or replace function public.corrigir_resposta_avaliacao(
  p_resposta_id uuid, p_pontos numeric, p_feedback text default null
)
returns table (
  resposta_id uuid, tentativa_id uuid, status_tentativa text, nota numeric,
  pontuacao_automatica numeric, pontuacao_manual numeric, requer_revisao boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_resposta public.respostas_avaliacao;
  v_tentativa public.tentativas_avaliacao;
  v_avaliacao public.avaliacoes_docentes;
  v_maximo numeric(6,2);
begin
  if (select auth.uid()) is null then raise exception 'Sessao autenticada obrigatoria.'; end if;
  select r.* into v_resposta from public.respostas_avaliacao r
  where r.id = p_resposta_id for update;
  if not found then raise exception 'Resposta nao encontrada.'; end if;
  select t.* into v_tentativa from public.tentativas_avaliacao t where t.id = v_resposta.tentativa_id;
  select a.* into v_avaliacao from public.avaliacoes_docentes a where a.id = v_tentativa.avaliacao_id;
  if (select public.usuario_role()) <> 'gestor'
     and v_avaliacao.professor_id <> (select auth.uid()) then
    raise exception 'Voce nao pode corrigir esta resposta.';
  end if;
  if v_tentativa.status not in ('enviada', 'corrigida') then raise exception 'A tentativa ainda nao foi entregue.'; end if;
  if v_resposta.status_correcao not in ('revisao', 'manual') then raise exception 'Esta resposta nao aceita correcao manual.'; end if;
  select q.pontos into v_maximo from public.questoes_avaliacao q where q.id = v_resposta.questao_id;
  if p_pontos is null or p_pontos < 0 or p_pontos > v_maximo then
    raise exception 'A pontuacao deve estar entre 0 e %.', v_maximo;
  end if;
  update public.respostas_avaliacao r
  set status_correcao = 'manual', correta = (p_pontos = v_maximo),
      pontos_manuais = round(p_pontos, 2),
      feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
      corrigida_em = now(), updated_at = now()
  where r.id = p_resposta_id;
  return query select r.id, t.id, t.status, t.nota, t.pontuacao_automatica,
    t.pontuacao_manual, t.requer_revisao
  from public.respostas_avaliacao r
  join public.tentativas_avaliacao t on t.id = r.tentativa_id
  where r.id = p_resposta_id;
end;
$$;

revoke all on function public.corrigir_resposta_avaliacao(uuid, numeric, text) from public, anon;
grant execute on function public.corrigir_resposta_avaliacao(uuid, numeric, text) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 39/67: migrations/20260908_vinculos_docentes_compatibilidade_fase2_3.sql
-- ============================================================================

-- OminiSaber | Fase 2.3 - compatibilidade dos vinculos criados pelo gestor

create or replace function private.sincronizar_vinculo_docente_legado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo public.tipo_professor;
  v_materia public.materia_aluno;
begin
  if tg_op in ('DELETE', 'UPDATE') then
    select p.tipo_professor into v_tipo from public.perfis p where p.id = old.professor_id;
    v_materia := case
      when lower(coalesce(old.materia, '')) like '%matem%' then 'matematica'::public.materia_aluno
      when lower(coalesce(old.materia, '')) like '%fisic%' then 'fisica'::public.materia_aluno
      when lower(coalesce(old.materia, '')) like '%quim%' then 'quimica'::public.materia_aluno
      when lower(coalesce(old.materia, '')) like '%biolog%' then 'biologia'::public.materia_aluno
      when lower(coalesce(old.materia, '')) like any (array['%portugu%', '%literat%', '%linguag%']) then 'portugues'::public.materia_aluno
      when lower(coalesce(old.materia, '')) like '%reda%' then 'redacao'::public.materia_aluno
      when lower(coalesce(old.materia, '')) like any (array['%admin%', '%gest%', '%empreend%', '%marketing%', '%finan%']) then 'tecnico_administracao'::public.materia_aluno
      when lower(coalesce(old.materia, '')) like any (array['%inform%', '%program%', '%tecnolog%', '%banco de dados%', '%redes%']) then 'tecnico_informatica'::public.materia_aluno
      when v_tipo = 'matematica' then 'matematica'::public.materia_aluno
      when v_tipo = 'portugues' then 'portugues'::public.materia_aluno
      when v_tipo = 'tecnico_administracao' then 'tecnico_administracao'::public.materia_aluno
      when v_tipo = 'tecnico_informatica' then 'tecnico_informatica'::public.materia_aluno
      else null
    end;
    if v_materia is not null then
      delete from public.professor_turma_materias
      where professor_id = old.professor_id and turma_id = old.turma_id
        and materia_codigo = v_materia;
    end if;
    if v_tipo = 'portugues' then
      delete from public.professor_turma_materias
      where professor_id = old.professor_id and turma_id = old.turma_id
        and materia_codigo = 'redacao';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select p.tipo_professor into v_tipo from public.perfis p where p.id = new.professor_id;
    v_materia := case
      when lower(coalesce(new.materia, '')) like '%matem%' then 'matematica'::public.materia_aluno
      when lower(coalesce(new.materia, '')) like '%fisic%' then 'fisica'::public.materia_aluno
      when lower(coalesce(new.materia, '')) like '%quim%' then 'quimica'::public.materia_aluno
      when lower(coalesce(new.materia, '')) like '%biolog%' then 'biologia'::public.materia_aluno
      when lower(coalesce(new.materia, '')) like any (array['%portugu%', '%literat%', '%linguag%']) then 'portugues'::public.materia_aluno
      when lower(coalesce(new.materia, '')) like '%reda%' then 'redacao'::public.materia_aluno
      when lower(coalesce(new.materia, '')) like any (array['%admin%', '%gest%', '%empreend%', '%marketing%', '%finan%']) then 'tecnico_administracao'::public.materia_aluno
      when lower(coalesce(new.materia, '')) like any (array['%inform%', '%program%', '%tecnolog%', '%banco de dados%', '%redes%']) then 'tecnico_informatica'::public.materia_aluno
      when v_tipo = 'matematica' then 'matematica'::public.materia_aluno
      when v_tipo = 'portugues' then 'portugues'::public.materia_aluno
      when v_tipo = 'tecnico_administracao' then 'tecnico_administracao'::public.materia_aluno
      when v_tipo = 'tecnico_informatica' then 'tecnico_informatica'::public.materia_aluno
      else null
    end;
    if v_materia is null then raise exception 'Nao foi possivel identificar a materia do vinculo.'; end if;
    insert into public.professor_turma_materias
      (professor_id, turma_id, materia_codigo, atribuido_por, ativo)
    values (new.professor_id, new.turma_id, v_materia, (select auth.uid()), true)
    on conflict (professor_id, turma_id, materia_codigo)
    do update set ativo = true, atribuido_por = excluded.atribuido_por, updated_at = now();
    if v_tipo = 'portugues' then
      insert into public.professor_turma_materias
        (professor_id, turma_id, materia_codigo, atribuido_por, ativo)
      values (new.professor_id, new.turma_id, 'redacao', (select auth.uid()), true)
      on conflict (professor_id, turma_id, materia_codigo)
      do update set ativo = true, atribuido_por = excluded.atribuido_por, updated_at = now();
    end if;
    return new;
  end if;
  return old;
end;
$$;

revoke all on function private.sincronizar_vinculo_docente_legado()
  from public, anon, authenticated;
drop trigger if exists sincronizar_vinculo_docente_legado_trigger on public.professor_turmas;
create trigger sincronizar_vinculo_docente_legado_trigger
after insert or update or delete on public.professor_turmas
for each row execute function private.sincronizar_vinculo_docente_legado();

-- Reprocessa vínculos existentes sem criar duplicatas.
insert into public.professor_turma_materias (professor_id, turma_id, materia_codigo)
select pt.professor_id, pt.turma_id,
  case
    when lower(coalesce(pt.materia, '')) like '%matem%' then 'matematica'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like '%fisic%' then 'fisica'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like '%quim%' then 'quimica'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like '%biolog%' then 'biologia'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like any (array['%portugu%', '%literat%', '%linguag%']) then 'portugues'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like '%reda%' then 'redacao'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like any (array['%admin%', '%gest%', '%empreend%', '%marketing%', '%finan%']) then 'tecnico_administracao'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like any (array['%inform%', '%program%', '%tecnolog%', '%banco de dados%', '%redes%']) then 'tecnico_informatica'::public.materia_aluno
    when p.tipo_professor = 'matematica' then 'matematica'::public.materia_aluno
    when p.tipo_professor = 'portugues' then 'portugues'::public.materia_aluno
    when p.tipo_professor = 'tecnico_administracao' then 'tecnico_administracao'::public.materia_aluno
    when p.tipo_professor = 'tecnico_informatica' then 'tecnico_informatica'::public.materia_aluno
  end
from public.professor_turmas pt join public.perfis p on p.id = pt.professor_id
where p.role = 'professor'
on conflict (professor_id, turma_id, materia_codigo)
do update set ativo = true, updated_at = now();

drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis for select to authenticated
using (
  id = (select auth.uid()) or (select public.usuario_role()) = 'gestor'
  or ((select public.usuario_role()) = 'professor' and (
    exists (select 1 from public.professor_turma_materias ptm
      where ptm.professor_id = (select auth.uid()) and ptm.turma_id = perfis.turma_id and ptm.ativo)
    or exists (select 1 from public.professor_turmas pt
      where pt.professor_id = (select auth.uid()) and pt.turma_id = perfis.turma_id)
  ))
);

drop policy if exists turmas_select on public.turmas;
create policy turmas_select on public.turmas for select to authenticated
using (
  (select public.usuario_role()) in ('gestor', 'bibliotecaria')
  or id = (select public.usuario_turma_id())
  or exists (select 1 from public.professor_turma_materias ptm
    where ptm.professor_id = (select auth.uid()) and ptm.turma_id = id and ptm.ativo)
  or exists (select 1 from public.professor_turmas pt
    where pt.professor_id = (select auth.uid()) and pt.turma_id = id)
);

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 40/67: migrations/20260908_resultados_recuperacao_fase2_4.sql
-- ============================================================================

-- OminiSaber | Fase 2.4 - resultados, ajustes auditáveis e recuperação

create table if not exists public.ajustes_notas_avaliacao (
  id uuid primary key default gen_random_uuid(),
  tentativa_id uuid not null references public.tentativas_avaliacao(id) on delete cascade,
  avaliacao_id uuid not null references public.avaliacoes_docentes(id) on delete cascade,
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  ajustado_por uuid not null references public.perfis(id) on delete restrict,
  nota_anterior numeric(6,2),
  nota_nova numeric(6,2) not null check (nota_nova >= 0),
  motivo text not null check (char_length(btrim(motivo)) between 8 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists ajustes_notas_tentativa_idx
  on public.ajustes_notas_avaliacao (tentativa_id, created_at desc);
create index if not exists ajustes_notas_avaliacao_idx
  on public.ajustes_notas_avaliacao (avaliacao_id, created_at desc);
create index if not exists ajustes_notas_aluno_idx
  on public.ajustes_notas_avaliacao (aluno_id);
create index if not exists ajustes_notas_ajustado_por_idx
  on public.ajustes_notas_avaliacao (ajustado_por);

alter table public.ajustes_notas_avaliacao enable row level security;
revoke all on public.ajustes_notas_avaliacao from public, anon, authenticated;
grant select, insert on public.ajustes_notas_avaliacao to authenticated;

drop policy if exists ajustes_notas_select on public.ajustes_notas_avaliacao;
create policy ajustes_notas_select on public.ajustes_notas_avaliacao
for select to authenticated using (
  aluno_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a
    where a.id = avaliacao_id and a.professor_id = (select auth.uid()))
);

drop policy if exists ajustes_notas_insert on public.ajustes_notas_avaliacao;
create policy ajustes_notas_insert on public.ajustes_notas_avaliacao
for insert to authenticated with check (
  ajustado_por = (select auth.uid())
  and exists (
    select 1 from public.tentativas_avaliacao t
    join public.avaliacoes_docentes a on a.id = t.avaliacao_id
    where t.id = tentativa_id and t.avaliacao_id = avaliacao_id
      and t.aluno_id = aluno_id and t.status = 'corrigida'
      and nota_anterior is not distinct from t.nota
      and nota_nova <= a.valor
      and (a.professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor')
  )
);

create or replace function private.aplicar_ajuste_nota_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tentativas_avaliacao
  set nota = new.nota_nova,
      feedback = 'Nota ajustada pelo professor. Consulte o histórico da avaliação.',
      updated_at = now()
  where id = new.tentativa_id;
  insert into public.avaliacoes_auditoria
    (avaliacao_id, tentativa_id, ator_id, evento, detalhes)
  values (new.avaliacao_id, new.tentativa_id, new.ajustado_por, 'nota_ajustada',
    jsonb_build_object('ajuste_id', new.id, 'nota_anterior', new.nota_anterior,
      'nota_nova', new.nota_nova, 'motivo', new.motivo));
  return new;
end;
$$;

revoke all on function private.aplicar_ajuste_nota_avaliacao()
  from public, anon, authenticated;
drop trigger if exists aplicar_ajuste_nota_avaliacao_trigger on public.ajustes_notas_avaliacao;
create trigger aplicar_ajuste_nota_avaliacao_trigger
after insert on public.ajustes_notas_avaliacao
for each row execute function private.aplicar_ajuste_nota_avaliacao();

create or replace function public.ajustar_nota_avaliacao(
  p_tentativa_id uuid, p_nota numeric, p_motivo text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tentativa public.tentativas_avaliacao;
  v_avaliacao public.avaliacoes_docentes;
  v_id uuid;
begin
  select t.* into v_tentativa from public.tentativas_avaliacao t
  where t.id = p_tentativa_id for share;
  if not found then raise exception 'Tentativa nao encontrada.'; end if;
  select a.* into v_avaliacao from public.avaliacoes_docentes a
  where a.id = v_tentativa.avaliacao_id;
  if v_tentativa.status <> 'corrigida' then raise exception 'Finalize a correcao antes de ajustar a nota.'; end if;
  if v_avaliacao.professor_id <> (select auth.uid())
     and (select public.usuario_role()) <> 'gestor' then raise exception 'Sem permissao para ajustar esta nota.'; end if;
  if p_nota is null or p_nota < 0 or p_nota > v_avaliacao.valor then
    raise exception 'A nota deve estar entre 0 e %.', v_avaliacao.valor;
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 8 then
    raise exception 'Explique o motivo do ajuste com pelo menos 8 caracteres.';
  end if;
  insert into public.ajustes_notas_avaliacao
    (tentativa_id, avaliacao_id, aluno_id, ajustado_por, nota_anterior, nota_nova, motivo)
  values (v_tentativa.id, v_avaliacao.id, v_tentativa.aluno_id, (select auth.uid()),
    v_tentativa.nota, round(p_nota, 2), btrim(p_motivo))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.ajustar_nota_avaliacao(uuid, numeric, text) from public, anon;
grant execute on function public.ajustar_nota_avaliacao(uuid, numeric, text) to authenticated;

create or replace function public.painel_resultados_avaliacao(p_avaliacao_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_avaliacao public.avaliacoes_docentes;
  v_resultado jsonb;
begin
  select a.* into v_avaliacao from public.avaliacoes_docentes a
  where a.id = p_avaliacao_id
    and (a.professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor');
  if not found then raise exception 'Avaliacao nao encontrada ou sem permissao.'; end if;

  with latest as (
    select distinct on (t.aluno_id) t.*
    from public.tentativas_avaliacao t
    where t.avaliacao_id = p_avaliacao_id
    order by t.aluno_id, t.numero_tentativa desc
  ), students as (
    select p.id, p.nome, p.matricula, l.id as tentativa_id,
      l.status, l.nota, l.pontuacao_automatica, l.pontuacao_manual,
      l.requer_revisao, l.numero_tentativa, l.enviada_em, l.corrigida_em
    from public.perfis p left join latest l on l.aluno_id = p.id
    where p.role = 'aluno' and p.turma_id = v_avaliacao.turma_id
  ), answers as (
    select r.* from public.respostas_avaliacao r
    join latest l on l.id = r.tentativa_id
    where l.status in ('enviada', 'corrigida')
  ), question_stats as (
    select q.id, q.ordem, q.tipo, q.enunciado, q.pontos,
      count(an.id) as respostas,
      count(an.id) filter (where an.correta = true) as acertos,
      round(coalesce(avg(an.pontos_automaticos + an.pontos_manuais), 0), 2) as media_pontos,
      round(case when count(an.id) > 0
        then 100.0 * count(an.id) filter (where an.correta = true) / count(an.id)
        else 0 end, 1) as percentual_acerto
    from public.questoes_avaliacao q
    left join answers an on an.questao_id = q.id
    where q.avaliacao_id = p_avaliacao_id
    group by q.id
  ), descriptor_stats as (
    select h.id, h.codigo, h.descricao,
      coalesce((select jsonb_agg(distinct jsonb_build_object('codigo', d.codigo, 'descricao', d.descricao))
        from public.habilidade_descritores hd
        join public.descritores_curriculares d on d.id = hd.descritor_id
        where hd.habilidade_id = h.id), '[]'::jsonb) as descritores,
      count(an.id) as evidencias,
      round(coalesce(sum(an.pontos_automaticos + an.pontos_manuais), 0), 2) as obtidos,
      round(coalesce(sum(q.pontos) filter (where an.id is not null), 0), 2) as possiveis,
      round(case when coalesce(sum(q.pontos) filter (where an.id is not null), 0) > 0
        then 100 * sum(an.pontos_automaticos + an.pontos_manuais)
          / sum(q.pontos) filter (where an.id is not null) else 0 end, 1) as desempenho
    from public.questoes_avaliacao_habilidades qh
    join public.habilidades_curriculares h on h.id = qh.habilidade_id
    join public.questoes_avaliacao q on q.id = qh.questao_id and q.avaliacao_id = p_avaliacao_id
    left join answers an on an.questao_id = q.id
    group by h.id
  )
  select jsonb_build_object(
    'avaliacao', jsonb_build_object('id', v_avaliacao.id, 'titulo', v_avaliacao.titulo,
      'valor', v_avaliacao.valor, 'turma_id', v_avaliacao.turma_id,
      'materia_codigo', v_avaliacao.materia_codigo, 'categoria', v_avaliacao.categoria),
    'metricas', jsonb_build_object(
      'total_alunos', (select count(*) from students),
      'entregaram', (select count(*) from students where status in ('enviada', 'corrigida')),
      'nao_entregaram', (select count(*) from students where status is null or status = 'em_andamento'),
      'em_revisao', (select count(*) from students where requer_revisao),
      'media_turma', (select round(coalesce(avg(nota) filter (where status = 'corrigida'), 0), 2) from students)
    ),
    'alunos', coalesce((select jsonb_agg(jsonb_build_object(
      'aluno_id', id, 'nome', nome, 'matricula', matricula, 'tentativa_id', tentativa_id,
      'status', coalesce(status, 'nao_iniciada'), 'nota', nota,
      'pontuacao_automatica', pontuacao_automatica, 'pontuacao_manual', pontuacao_manual,
      'requer_revisao', coalesce(requer_revisao, false), 'numero_tentativa', numero_tentativa,
      'enviada_em', enviada_em, 'corrigida_em', corrigida_em) order by nome) from students), '[]'::jsonb),
    'questoes', coalesce((select jsonb_agg(to_jsonb(qs) order by percentual_acerto, ordem) from question_stats qs), '[]'::jsonb),
    'descritores', coalesce((select jsonb_agg(to_jsonb(ds) order by desempenho, codigo) from descriptor_stats ds), '[]'::jsonb),
    'auditoria', coalesce((select jsonb_agg(jsonb_build_object('id', au.id, 'evento', au.evento,
      'detalhes', au.detalhes, 'ator_id', au.ator_id, 'created_at', au.created_at) order by au.created_at desc)
      from (select * from public.avaliacoes_auditoria where avaliacao_id = p_avaliacao_id order by created_at desc limit 50) au), '[]'::jsonb)
  ) into v_resultado;
  return v_resultado;
end;
$$;

revoke all on function public.painel_resultados_avaliacao(uuid) from public, anon;
grant execute on function public.painel_resultados_avaliacao(uuid) to authenticated;

create or replace function public.criar_recuperacao_descritores(
  p_avaliacao_origem uuid, p_habilidade_ids uuid[], p_titulo text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_origem public.avaliacoes_docentes;
  v_nova_id uuid;
  v_questao record;
  v_nova_questao uuid;
begin
  select a.* into v_origem from public.avaliacoes_docentes a
  where a.id = p_avaliacao_origem and a.professor_id = (select auth.uid());
  if not found then raise exception 'Avaliacao de origem nao encontrada ou sem permissao.'; end if;
  if coalesce(array_length(p_habilidade_ids, 1), 0) = 0 then
    raise exception 'Selecione ao menos um descritor para a recuperacao.';
  end if;
  if exists (select 1 from unnest(p_habilidade_ids) as selecionada(habilidade_id)
    where not exists (select 1 from public.questoes_avaliacao_habilidades qh
      join public.questoes_avaliacao q on q.id = qh.questao_id
      where q.avaliacao_id = v_origem.id
        and qh.habilidade_id = selecionada.habilidade_id)) then
    raise exception 'Um dos descritores nao pertence a avaliacao de origem.';
  end if;
  insert into public.avaliacoes_docentes
    (professor_id, turma_id, tipo_professor, titulo, instrucoes, duracao_minutos,
     valor, configuracao, status, materia_codigo, categoria, serie, trimestre,
     modo_pontuacao, tentativas_permitidas, embaralhar_questoes,
     embaralhar_alternativas, feedback_imediato, exibir_gabarito)
  values (v_origem.professor_id, v_origem.turma_id, v_origem.tipo_professor,
    coalesce(nullif(btrim(p_titulo), ''), 'Recuperacao - ' || v_origem.titulo),
    'Recuperacao criada a partir dos descritores com menor desempenho. Revise antes de publicar.',
    v_origem.duracao_minutos, v_origem.valor,
    v_origem.configuracao || jsonb_build_object('avaliacao_origem_id', v_origem.id,
      'habilidade_ids', to_jsonb(p_habilidade_ids)), 'rascunho', v_origem.materia_codigo,
    'recuperacao', v_origem.serie, v_origem.trimestre, v_origem.modo_pontuacao,
    1, v_origem.embaralhar_questoes, v_origem.embaralhar_alternativas,
    v_origem.feedback_imediato, v_origem.exibir_gabarito)
  returning id into v_nova_id;

  for v_questao in
    select distinct q.* from public.questoes_avaliacao q
    join public.questoes_avaliacao_habilidades qh on qh.questao_id = q.id
    where q.avaliacao_id = v_origem.id and qh.habilidade_id = any(p_habilidade_ids)
    order by q.ordem
  loop
    insert into public.questoes_avaliacao
      (avaliacao_id, ordem, tipo, enunciado, alternativas, pontos, configuracao, explicacao, obrigatoria)
    values (v_nova_id, v_questao.ordem, v_questao.tipo, v_questao.enunciado,
      v_questao.alternativas, v_questao.pontos, v_questao.configuracao,
      v_questao.explicacao, v_questao.obrigatoria)
    returning id into v_nova_questao;
    insert into public.gabaritos_avaliacao (questao_id, resposta_esperada)
    select v_nova_questao, g.resposta_esperada from public.gabaritos_avaliacao g
    where g.questao_id = v_questao.id;
    insert into public.questoes_avaliacao_habilidades (questao_id, habilidade_id)
    select v_nova_questao, qh.habilidade_id
    from public.questoes_avaliacao_habilidades qh
    where qh.questao_id = v_questao.id and qh.habilidade_id = any(p_habilidade_ids)
    on conflict do nothing;
  end loop;

  insert into public.avaliacoes_auditoria (avaliacao_id, ator_id, evento, detalhes)
  values (v_nova_id, (select auth.uid()), 'recuperacao_criada',
    jsonb_build_object('avaliacao_origem_id', v_origem.id,
      'habilidade_ids', to_jsonb(p_habilidade_ids)));
  return v_nova_id;
end;
$$;

revoke all on function public.criar_recuperacao_descritores(uuid, uuid[], text) from public, anon;
grant execute on function public.criar_recuperacao_descritores(uuid, uuid[], text) to authenticated;

create or replace function public.desempenho_aluno_descritores()
returns table (
  materia_codigo public.materia_aluno, habilidade_id uuid, codigo text,
  descricao text, descritores jsonb, evidencias bigint,
  pontos_obtidos numeric, pontos_possiveis numeric, desempenho numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (select public.usuario_role()) <> 'aluno' then
    raise exception 'Esta leitura esta disponivel apenas para alunos.';
  end if;
  return query
  with latest as (
    select distinct on (t.avaliacao_id) t.*
    from public.tentativas_avaliacao t
    where t.aluno_id = (select auth.uid()) and t.status = 'corrigida'
    order by t.avaliacao_id, t.numero_tentativa desc
  ), evidence as (
    select a.materia_codigo, qh.habilidade_id, r.id,
      r.pontos_automaticos + r.pontos_manuais as obtidos, q.pontos as possiveis
    from latest t
    join public.avaliacoes_docentes a on a.id = t.avaliacao_id
    join public.respostas_avaliacao r on r.tentativa_id = t.id
    join public.questoes_avaliacao q on q.id = r.questao_id
    join public.questoes_avaliacao_habilidades qh on qh.questao_id = q.id
  )
  select e.materia_codigo, h.id, h.codigo, h.descricao,
    coalesce((select jsonb_agg(distinct jsonb_build_object('codigo', d.codigo, 'descricao', d.descricao))
      from public.habilidade_descritores hd
      join public.descritores_curriculares d on d.id = hd.descritor_id
      where hd.habilidade_id = h.id), '[]'::jsonb),
    count(e.id), round(sum(e.obtidos), 2), round(sum(e.possiveis), 2),
    round(case when sum(e.possiveis) > 0 then 100 * sum(e.obtidos) / sum(e.possiveis) else 0 end, 1)
  from evidence e join public.habilidades_curriculares h on h.id = e.habilidade_id
  group by e.materia_codigo, h.id
  order by e.materia_codigo, desempenho, h.codigo;
end;
$$;

revoke all on function public.desempenho_aluno_descritores() from public, anon;
grant execute on function public.desempenho_aluno_descritores() to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 41/67: migrations/20260908_resultados_recuperacao_fase2_4_ajustes.sql
-- ============================================================================

-- OminiSaber | Fase 2.4 - correção da validação de habilidades da recuperação

create or replace function public.criar_recuperacao_descritores(
  p_avaliacao_origem uuid, p_habilidade_ids uuid[], p_titulo text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_origem public.avaliacoes_docentes;
  v_nova_id uuid;
  v_questao record;
  v_nova_questao uuid;
begin
  select a.* into v_origem from public.avaliacoes_docentes a
  where a.id = p_avaliacao_origem and a.professor_id = (select auth.uid());
  if not found then raise exception 'Avaliacao de origem nao encontrada ou sem permissao.'; end if;
  if coalesce(array_length(p_habilidade_ids, 1), 0) = 0 then
    raise exception 'Selecione ao menos um descritor para a recuperacao.';
  end if;
  if exists (
    select 1 from unnest(p_habilidade_ids) as selecionada(habilidade_id)
    where not exists (
      select 1 from public.questoes_avaliacao_habilidades qh
      join public.questoes_avaliacao q on q.id = qh.questao_id
      where q.avaliacao_id = v_origem.id
        and qh.habilidade_id = selecionada.habilidade_id
    )
  ) then
    raise exception 'Um dos descritores nao pertence a avaliacao de origem.';
  end if;
  insert into public.avaliacoes_docentes
    (professor_id, turma_id, tipo_professor, titulo, instrucoes, duracao_minutos,
     valor, configuracao, status, materia_codigo, categoria, serie, trimestre,
     modo_pontuacao, tentativas_permitidas, embaralhar_questoes,
     embaralhar_alternativas, feedback_imediato, exibir_gabarito)
  values (v_origem.professor_id, v_origem.turma_id, v_origem.tipo_professor,
    coalesce(nullif(btrim(p_titulo), ''), 'Recuperacao - ' || v_origem.titulo),
    'Recuperacao criada a partir dos descritores com menor desempenho. Revise antes de publicar.',
    v_origem.duracao_minutos, v_origem.valor,
    v_origem.configuracao || jsonb_build_object('avaliacao_origem_id', v_origem.id,
      'habilidade_ids', to_jsonb(p_habilidade_ids)), 'rascunho', v_origem.materia_codigo,
    'recuperacao', v_origem.serie, v_origem.trimestre, v_origem.modo_pontuacao,
    1, v_origem.embaralhar_questoes, v_origem.embaralhar_alternativas,
    v_origem.feedback_imediato, v_origem.exibir_gabarito)
  returning id into v_nova_id;

  for v_questao in
    select distinct q.* from public.questoes_avaliacao q
    join public.questoes_avaliacao_habilidades qh on qh.questao_id = q.id
    where q.avaliacao_id = v_origem.id and qh.habilidade_id = any(p_habilidade_ids)
    order by q.ordem
  loop
    insert into public.questoes_avaliacao
      (avaliacao_id, ordem, tipo, enunciado, alternativas, pontos, configuracao, explicacao, obrigatoria)
    values (v_nova_id, v_questao.ordem, v_questao.tipo, v_questao.enunciado,
      v_questao.alternativas, v_questao.pontos, v_questao.configuracao,
      v_questao.explicacao, v_questao.obrigatoria)
    returning id into v_nova_questao;
    insert into public.gabaritos_avaliacao (questao_id, resposta_esperada)
    select v_nova_questao, g.resposta_esperada from public.gabaritos_avaliacao g
    where g.questao_id = v_questao.id;
    insert into public.questoes_avaliacao_habilidades (questao_id, habilidade_id)
    select v_nova_questao, qh.habilidade_id
    from public.questoes_avaliacao_habilidades qh
    where qh.questao_id = v_questao.id and qh.habilidade_id = any(p_habilidade_ids)
    on conflict do nothing;
  end loop;

  insert into public.avaliacoes_auditoria (avaliacao_id, ator_id, evento, detalhes)
  values (v_nova_id, (select auth.uid()), 'recuperacao_criada',
    jsonb_build_object('avaliacao_origem_id', v_origem.id,
      'habilidade_ids', to_jsonb(p_habilidade_ids)));
  return v_nova_id;
end;
$$;

revoke all on function public.criar_recuperacao_descritores(uuid, uuid[], text)
  from public, anon;
grant execute on function public.criar_recuperacao_descritores(uuid, uuid[], text)
  to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 42/67: migrations/20260908_resultados_recuperacao_fase2_4_indices.sql
-- ============================================================================

-- OminiSaber | Fase 2.4 - índices das relações de auditoria de notas

create index if not exists ajustes_notas_aluno_idx
  on public.ajustes_notas_avaliacao (aluno_id);
create index if not exists ajustes_notas_ajustado_por_idx
  on public.ajustes_notas_avaliacao (ajustado_por);

-- ============================================================================
-- ETAPA 43/67: migrations/20260909_corrigir_execucao_criar_atividade_docente.sql
-- ============================================================================

-- OminiSaber | Corrige a execução atômica do construtor de atividades.
--
-- O schema `private` não é exposto aos papéis da API. A função pública valida
-- explicitamente a sessão, o perfil docente e o vínculo turma/matéria antes de
-- chamar a rotina privada; por isso deve executar com os privilégios do dono.

alter function public.criar_atividade_docente(jsonb) security definer;
alter function public.criar_atividade_docente(jsonb) set search_path = '';

revoke all on function public.criar_atividade_docente(jsonb) from public, anon;
grant execute on function public.criar_atividade_docente(jsonb) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 44/67: migrations/20260909_atividade_docente_privilegios_minimos.sql
-- ============================================================================

-- OminiSaber | Privilégios mínimos para o construtor atômico.
--
-- O papel autenticado pode resolver somente as rotinas privadas que receberam
-- EXECUTE explícito. Nenhuma tabela do schema privado é concedida ao cliente.

grant usage on schema private to authenticated;

revoke all on function private.validar_avaliacao_docente()
from public, anon, authenticated;

alter function public.criar_atividade_docente(jsonb) security invoker;
alter function public.criar_atividade_docente(jsonb) set search_path = '';

revoke all on function public.criar_atividade_docente(jsonb) from public, anon;
grant execute on function public.criar_atividade_docente(jsonb) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 45/67: migrations/20260909122618_atividades_aluno_dashboard_notificacoes.sql
-- ============================================================================

alter table public.notificacoes
  add column if not exists avaliacao_id uuid;

do $$
begin
  alter table public.notificacoes
    add constraint notificacoes_avaliacao_id_fkey
    foreign key (avaliacao_id)
    references public.avaliacoes_docentes(id)
    on delete cascade;
exception
  when duplicate_object then null;
end $$;

create unique index if not exists notificacoes_avaliacao_id_key
  on public.notificacoes (avaliacao_id)
  where avaliacao_id is not null;

create or replace function private.sincronizar_notificacao_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titulo text;
  v_mensagem text;
begin
  if new.status = 'publicado' then
    v_titulo := case new.categoria
      when 'avaliacao' then 'Nova avaliação disponível'
      when 'diagnostica' then 'Nova atividade diagnóstica'
      when 'recuperacao' then 'Nova recuperação disponível'
      else 'Nova atividade disponível'
    end;

    v_mensagem := new.titulo || case
      when new.encerra_em is null then ' · confira as orientações do professor.'
      else ' · entrega até ' || to_char(
        new.encerra_em at time zone 'America/Sao_Paulo',
        'DD/MM/YYYY às HH24:MI'
      )
    end;

    insert into public.notificacoes (
      titulo,
      mensagem,
      tipo,
      prioridade,
      destino_turma_id,
      criado_por,
      avaliacao_id,
      link,
      expira_em,
      updated_at
    )
    values (
      v_titulo,
      v_mensagem,
      'avaliacao',
      case when new.categoria in ('avaliacao', 'recuperacao') then 'alta' else 'normal' end,
      new.turma_id,
      new.professor_id,
      new.id,
      '../atividades/index.html?atividade=' || new.id,
      new.encerra_em,
      now()
    )
    on conflict (avaliacao_id) where avaliacao_id is not null do update set
      titulo = excluded.titulo,
      mensagem = excluded.mensagem,
      prioridade = excluded.prioridade,
      destino_turma_id = excluded.destino_turma_id,
      criado_por = excluded.criado_por,
      link = excluded.link,
      expira_em = excluded.expira_em,
      updated_at = now();
  else
    delete from public.notificacoes
    where avaliacao_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function private.sincronizar_notificacao_avaliacao()
  from public, anon, authenticated;

drop trigger if exists trg_sincronizar_notificacao_avaliacao
  on public.avaliacoes_docentes;
create trigger trg_sincronizar_notificacao_avaliacao
after insert or update of status, turma_id, encerra_em
on public.avaliacoes_docentes
for each row execute function private.sincronizar_notificacao_avaliacao();

insert into public.notificacoes (
  titulo,
  mensagem,
  tipo,
  prioridade,
  destino_turma_id,
  criado_por,
  avaliacao_id,
  link,
  expira_em,
  updated_at
)
select
  case a.categoria
    when 'avaliacao' then 'Nova avaliação disponível'
    when 'diagnostica' then 'Nova atividade diagnóstica'
    when 'recuperacao' then 'Nova recuperação disponível'
    else 'Nova atividade disponível'
  end,
  a.titulo || case
    when a.encerra_em is null then ' · confira as orientações do professor.'
    else ' · entrega até ' || to_char(
      a.encerra_em at time zone 'America/Sao_Paulo',
      'DD/MM/YYYY às HH24:MI'
    )
  end,
  'avaliacao',
  case when a.categoria in ('avaliacao', 'recuperacao') then 'alta' else 'normal' end,
  a.turma_id,
  a.professor_id,
  a.id,
  '../atividades/index.html?atividade=' || a.id,
  a.encerra_em,
  now()
from public.avaliacoes_docentes a
where a.status = 'publicado'
on conflict (avaliacao_id) where avaliacao_id is not null do update set
  titulo = excluded.titulo,
  mensagem = excluded.mensagem,
  prioridade = excluded.prioridade,
  destino_turma_id = excluded.destino_turma_id,
  criado_por = excluded.criado_por,
  link = excluded.link,
  expira_em = excluded.expira_em,
  updated_at = now();

-- ============================================================================
-- ETAPA 46/67: migrations/20260910_corrigir_codigos_curriculares_matematica.sql
-- ============================================================================

create or replace function public.habilidade_curricular_publicada(
  p_habilidade_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.habilidades_curriculares h
    join public.habilidade_curriculo_periodos hcp on hcp.habilidade_id = h.id
    join public.curriculo_periodos cp on cp.id = hcp.periodo_id
    join public.curriculos c on c.id = cp.curriculo_id
    where h.id = p_habilidade_id
      and h.codigo ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
      and c.status = 'publicado'
      and c.ativo = true
  );
$$;

revoke all on function public.habilidade_curricular_publicada(uuid)
  from public, anon;
grant execute on function public.habilidade_curricular_publicada(uuid)
  to authenticated;

create or replace function public.buscar_habilidades_curriculares(
  p_materia public.materia_aluno,
  p_serie smallint default null,
  p_trimestre smallint default null,
  p_busca text default null
)
returns table (
  habilidade_id uuid,
  codigo text,
  descricao text,
  serie smallint,
  trimestre smallint,
  curriculo_id uuid,
  descritores jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    h.id,
    h.codigo,
    h.descricao,
    cp.serie,
    cp.trimestre,
    c.id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'codigo', d.codigo,
          'titulo', d.titulo
        )
        order by d.codigo
      ) filter (where d.id is not null),
      '[]'::jsonb
    )
  from public.habilidades_curriculares h
  join public.habilidade_curriculo_periodos hcp
    on hcp.habilidade_id = h.id
  join public.curriculo_periodos cp
    on cp.id = hcp.periodo_id
  join public.curriculos c
    on c.id = cp.curriculo_id
  left join public.habilidade_descritores hd
    on hd.habilidade_id = h.id
    and hd.periodo_id = cp.id
  left join public.descritores_curriculares d
    on d.id = hd.descritor_id
  where h.materia_codigo = p_materia
    and h.codigo ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
    and c.status = 'publicado'
    and c.ativo = true
    and (p_serie is null or cp.serie = p_serie)
    and (p_trimestre is null or cp.trimestre = p_trimestre)
    and (
      nullif(btrim(coalesce(p_busca, '')), '') is null
      or h.codigo ilike '%' || btrim(p_busca) || '%'
      or h.descricao ilike '%' || btrim(p_busca) || '%'
      or exists (
        select 1
        from public.habilidade_descritores hds
        join public.descritores_curriculares ds
          on ds.id = hds.descritor_id
        where hds.habilidade_id = h.id
          and hds.periodo_id = cp.id
          and (
            ds.codigo ilike '%' || btrim(p_busca) || '%'
            or ds.titulo ilike '%' || btrim(p_busca) || '%'
          )
      )
    )
  group by h.id, h.codigo, h.descricao, cp.serie, cp.trimestre, c.id
  order by h.codigo, cp.serie, cp.trimestre;
$$;

revoke all on function public.buscar_habilidades_curriculares(
  public.materia_aluno,
  smallint,
  smallint,
  text
) from public, anon;
grant execute on function public.buscar_habilidades_curriculares(
  public.materia_aluno,
  smallint,
  smallint,
  text
) to authenticated;

-- ============================================================================
-- ETAPA 47/67: migrations/20260910_integridade_formatos_atividade.sql
-- ============================================================================

-- OminiSaber | Integridade dos formatos interativos e correção automática

create or replace function private.validar_questao_avaliacao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_modo text := nullif(new.configuracao->>'mathMode', '');
  v_min numeric;
  v_max numeric;
  v_step numeric;
  v_target numeric;
  v_min_y numeric;
  v_max_y numeric;
  v_target_y numeric;
begin
  if v_modo is not null
     and v_modo not in ('livre', 'plano_cartesiano', 'reta_numerica', 'pitagoras', 'grafico_barras') then
    raise exception 'Modelo matematico invalido.';
  end if;

  if new.tipo in ('unica_escolha', 'multipla_escolha')
     and jsonb_array_length(new.alternativas) < 2 then
    raise exception 'Questoes objetivas precisam de pelo menos duas alternativas.';
  end if;

  if new.tipo = 'associacao' then
    if jsonb_typeof(new.configuracao->'pairs') <> 'array'
       or jsonb_array_length(new.configuracao->'pairs') < 2
       or exists (
         select 1
         from jsonb_array_elements(new.configuracao->'pairs') par
         where jsonb_typeof(par) <> 'object'
            or btrim(coalesce(par->>'left', '')) = ''
            or btrim(coalesce(par->>'right', '')) = ''
       ) then
      raise exception 'A associacao precisa de pelo menos dois pares completos.';
    end if;
  elsif new.tipo = 'ordenacao' and jsonb_array_length(new.alternativas) < 2 then
    raise exception 'A ordenacao precisa de pelo menos dois itens.';
  end if;

  if v_modo = 'plano_cartesiano' then
    if new.tipo <> 'resposta_curta' then
      raise exception 'O plano cartesiano deve usar resposta curta.';
    end if;
    begin
      v_min := (new.configuracao->>'minX')::numeric;
      v_max := (new.configuracao->>'maxX')::numeric;
      v_target := (new.configuracao->>'targetX')::numeric;
      v_min_y := (new.configuracao->>'minY')::numeric;
      v_max_y := (new.configuracao->>'maxY')::numeric;
      v_target_y := (new.configuracao->>'targetY')::numeric;
    exception when others then
      raise exception 'Os eixos e o ponto do plano cartesiano precisam ser numericos.';
    end;
    if v_max <= v_min or v_max_y <= v_min_y
       or v_target not between v_min and v_max
       or v_target_y not between v_min_y and v_max_y
       or v_target <> trunc(v_target)
       or v_target_y <> trunc(v_target_y) then
      raise exception 'Revise os limites e o ponto inteiro do plano cartesiano.';
    end if;
  elsif v_modo = 'reta_numerica' then
    if new.tipo <> 'numerica' then
      raise exception 'A reta numerica deve usar resposta numerica.';
    end if;
    begin
      v_min := (new.configuracao->>'min')::numeric;
      v_max := (new.configuracao->>'max')::numeric;
      v_step := (new.configuracao->>'step')::numeric;
      v_target := (new.configuracao->>'target')::numeric;
    exception when others then
      raise exception 'Os valores da reta numerica precisam ser numericos.';
    end;
    if v_max <= v_min or v_step <= 0 or v_target not between v_min and v_max then
      raise exception 'Revise os limites, o intervalo e a resposta da reta numerica.';
    end if;
  elsif v_modo = 'pitagoras' then
    if new.tipo <> 'numerica' then
      raise exception 'O modelo de triangulo deve usar resposta numerica.';
    end if;
    begin
      v_min := (new.configuracao->>'sideA')::numeric;
      v_max := (new.configuracao->>'sideB')::numeric;
      v_step := (new.configuracao->>'sideC')::numeric;
      v_target := (new.configuracao->>'target')::numeric;
    exception when others then
      raise exception 'As medidas do triangulo precisam ser numericas.';
    end;
    if least(v_min, v_max, v_step, v_target) <= 0 then
      raise exception 'As medidas e a resposta do triangulo precisam ser maiores que zero.';
    end if;
  elsif v_modo = 'grafico_barras' then
    if new.tipo <> 'unica_escolha'
       or jsonb_typeof(new.configuracao->'chartData') <> 'array'
       or jsonb_array_length(new.configuracao->'chartData') < 2
       or btrim(coalesce(new.configuracao->>'correctLabel', '')) = ''
       or exists (
         select 1
         from jsonb_array_elements(new.configuracao->'chartData') barra
         where jsonb_typeof(barra) <> 'object'
            or btrim(coalesce(barra->>'label', '')) = ''
            or jsonb_typeof(barra->'value') <> 'number'
       )
       or not exists (
         select 1
         from jsonb_array_elements(new.configuracao->'chartData') barra
         where barra->>'label' = new.configuracao->>'correctLabel'
       ) then
      raise exception 'O grafico precisa de ao menos duas barras e uma categoria correta valida.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validar_questao_avaliacao()
  from public, anon, authenticated;

drop trigger if exists validar_questao_avaliacao_trigger
  on public.questoes_avaliacao;
create trigger validar_questao_avaliacao_trigger
before insert or update on public.questoes_avaliacao
for each row execute function private.validar_questao_avaliacao();

create or replace function private.validar_gabarito_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_questao public.questoes_avaliacao;
  v_valor jsonb := new.resposta_esperada->'value';
  v_texto text;
  v_numero numeric;
begin
  select q.* into v_questao
  from public.questoes_avaliacao q
  where q.id = new.questao_id;
  if not found then
    raise exception 'Questao do gabarito nao encontrada.';
  end if;

  if v_questao.tipo in ('dissertativa', 'codigo', 'estudo_caso') then
    return new;
  end if;
  if v_valor is null or v_valor = 'null'::jsonb then
    raise exception 'Defina o gabarito da questao %.', v_questao.ordem;
  end if;

  if v_questao.tipo = 'unica_escolha' then
    v_texto := private.normalizar_resposta_avaliacao(v_valor);
    if not exists (
      select 1 from jsonb_array_elements_text(v_questao.alternativas) opcao
      where private.normalizar_resposta_avaliacao(to_jsonb(opcao)) = v_texto
    ) then
      raise exception 'O gabarito da questao % nao pertence as alternativas.', v_questao.ordem;
    end if;
  elsif v_questao.tipo = 'multipla_escolha' then
    if jsonb_typeof(v_valor) <> 'array' or jsonb_array_length(v_valor) = 0
       or exists (
         select 1 from jsonb_array_elements_text(v_valor) resposta
         where not exists (
           select 1 from jsonb_array_elements_text(v_questao.alternativas) opcao
           where private.normalizar_resposta_avaliacao(to_jsonb(opcao)) =
                 private.normalizar_resposta_avaliacao(to_jsonb(resposta))
         )
       ) then
      raise exception 'Revise as alternativas corretas da questao %.', v_questao.ordem;
    end if;
  elsif v_questao.tipo = 'verdadeiro_falso' then
    if private.normalizar_resposta_avaliacao(v_valor) not in ('verdadeiro', 'falso') then
      raise exception 'O gabarito deve ser Verdadeiro ou Falso.';
    end if;
  elsif v_questao.tipo in ('numerica', 'calculo') then
    begin
      v_numero := replace(private.normalizar_resposta_avaliacao(v_valor), ',', '.')::numeric;
    exception when others then
      raise exception 'O gabarito da questao % precisa ser numerico.', v_questao.ordem;
    end;
  elsif v_questao.tipo = 'resposta_curta' then
    if btrim(private.normalizar_resposta_avaliacao(v_valor)) = '' then
      raise exception 'Defina uma resposta curta para a questao %.', v_questao.ordem;
    end if;
  elsif v_questao.tipo = 'associacao' then
    if jsonb_typeof(v_valor) <> 'array'
       or jsonb_array_length(v_valor) <> jsonb_array_length(v_questao.configuracao->'pairs') then
      raise exception 'O gabarito da associacao nao corresponde aos pares cadastrados.';
    end if;
  elsif v_questao.tipo = 'ordenacao' then
    if jsonb_typeof(v_valor) <> 'array'
       or v_valor is distinct from v_questao.alternativas then
      raise exception 'O gabarito da ordenacao precisa seguir a sequencia cadastrada.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validar_gabarito_avaliacao()
  from public, anon, authenticated;

drop trigger if exists validar_gabarito_avaliacao_trigger
  on public.gabaritos_avaliacao;
create trigger validar_gabarito_avaliacao_trigger
before insert or update on public.gabaritos_avaliacao
for each row execute function private.validar_gabarito_avaliacao();

create or replace function private.corrigir_entrega_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avaliacao public.avaliacoes_docentes%rowtype;
  v_questoes_obrigatorias integer;
  v_respostas_obrigatorias integer;
  v_automaticos numeric(6,2) := 0;
  v_requer_revisao boolean := false;
  v_correta boolean;
  v_resposta_texto text;
  v_esperada_texto text;
  v_tolerancia numeric := 0;
  v_item record;
begin
  if new.status is not distinct from old.status then return new; end if;
  if (select public.usuario_role()) <> 'aluno' then return new; end if;
  if old.status <> 'em_andamento' or new.status <> 'enviada' then
    raise exception 'Esta tentativa nao pode ser enviada neste estado.';
  end if;
  if (select auth.uid()) is null or new.aluno_id <> (select auth.uid()) then
    raise exception 'Somente o aluno responsavel pode entregar esta tentativa.';
  end if;

  select a.* into v_avaliacao
  from public.avaliacoes_docentes a
  where a.id = new.avaliacao_id
  for share;
  if not found or v_avaliacao.turma_id <> (select public.usuario_turma_id()) then
    raise exception 'A atividade nao pertence a turma do aluno.';
  end if;
  if v_avaliacao.encerra_em is not null and v_avaliacao.encerra_em < now() then
    raise exception 'O prazo desta atividade foi encerrado.';
  end if;

  select count(*) into v_questoes_obrigatorias
  from public.questoes_avaliacao q
  where q.avaliacao_id = new.avaliacao_id and q.obrigatoria;
  select count(*) into v_respostas_obrigatorias
  from public.respostas_avaliacao r
  join public.questoes_avaliacao q on q.id = r.questao_id
  where r.tentativa_id = new.id and q.avaliacao_id = new.avaliacao_id
    and q.obrigatoria and r.resposta <> 'null'::jsonb;
  if v_respostas_obrigatorias < v_questoes_obrigatorias then
    raise exception 'Responda todas as questoes obrigatorias antes de enviar.';
  end if;

  for v_item in
    select r.id as resposta_id, r.resposta, q.tipo, q.pontos, q.explicacao,
      q.configuracao, g.resposta_esperada
    from public.respostas_avaliacao r
    join public.questoes_avaliacao q on q.id = r.questao_id
    join public.gabaritos_avaliacao g on g.questao_id = q.id
    where r.tentativa_id = new.id
    order by q.ordem
  loop
    if v_item.tipo in ('dissertativa', 'codigo', 'estudo_caso') then
      v_requer_revisao := true;
      update public.respostas_avaliacao
      set status_correcao = 'revisao', correta = null, pontos_automaticos = 0,
        feedback = null, corrigida_em = null
      where id = v_item.resposta_id;
      continue;
    end if;

    v_resposta_texto := private.normalizar_resposta_avaliacao(v_item.resposta);
    v_esperada_texto := private.normalizar_resposta_avaliacao(v_item.resposta_esperada->'value');
    v_correta := false;

    if v_item.tipo in ('numerica', 'calculo') then
      begin
        v_tolerancia := greatest(0, coalesce(nullif(v_item.configuracao->>'tolerance', '')::numeric, 0));
        v_correta := abs(
          replace(v_resposta_texto, ',', '.')::numeric -
          replace(v_esperada_texto, ',', '.')::numeric
        ) <= v_tolerancia;
      exception when others then
        v_correta := false;
      end;
    elsif v_item.tipo = 'multipla_escolha' then
      v_correta := (
        select coalesce(jsonb_agg(valor order by valor), '[]'::jsonb)
        from jsonb_array_elements_text(
          case when jsonb_typeof(v_item.resposta) = 'array'
            then v_item.resposta else '[]'::jsonb end
        ) valor
      ) = (
        select coalesce(jsonb_agg(valor order by valor), '[]'::jsonb)
        from jsonb_array_elements_text(v_item.resposta_esperada->'value') valor
      );
    elsif v_item.tipo in ('associacao', 'ordenacao') then
      v_correta := v_item.resposta = v_item.resposta_esperada->'value';
    elsif v_item.tipo = 'resposta_curta' then
      v_correta := v_resposta_texto = v_esperada_texto
        or (
          jsonb_typeof(v_item.configuracao->'acceptedAnswers') = 'array'
          and exists (
            select 1
            from jsonb_array_elements(v_item.configuracao->'acceptedAnswers') alternativa
            where private.normalizar_resposta_avaliacao(alternativa) = v_resposta_texto
          )
        );
    else
      v_correta := v_resposta_texto = v_esperada_texto;
    end if;

    if v_correta then v_automaticos := v_automaticos + v_item.pontos; end if;
    update public.respostas_avaliacao
    set status_correcao = 'automatica', correta = v_correta,
      pontos_automaticos = case when v_correta then v_item.pontos else 0 end,
      feedback = case
        when v_avaliacao.feedback_imediato or v_avaliacao.exibir_gabarito then v_item.explicacao
        else null
      end,
      corrigida_em = now()
    where id = v_item.resposta_id;
  end loop;

  new.pontuacao_automatica := v_automaticos;
  new.pontuacao_manual := 0;
  new.requer_revisao := v_requer_revisao;
  new.enviada_em := now();
  new.bloqueada_em := now();
  new.nota := v_automaticos;
  new.status := case when v_requer_revisao then 'enviada' else 'corrigida' end;
  new.corrigida_em := case when v_requer_revisao then null else now() end;
  new.feedback := case when v_requer_revisao
    then 'Aguardando revisao do professor.' else 'Correcao automatica concluida.' end;

  insert into public.avaliacoes_auditoria
    (avaliacao_id, tentativa_id, ator_id, evento, detalhes)
  values (new.avaliacao_id, new.id, new.aluno_id, 'entregue', jsonb_build_object(
    'numero_tentativa', new.numero_tentativa,
    'pontuacao_automatica', v_automaticos,
    'requer_revisao', v_requer_revisao
  ));
  return new;
end;
$$;

revoke all on function private.corrigir_entrega_avaliacao()
  from public, anon, authenticated;

drop policy if exists ajustes_notas_insert
  on public.ajustes_notas_avaliacao;
create policy ajustes_notas_insert on public.ajustes_notas_avaliacao
for insert to authenticated with check (
  ajustes_notas_avaliacao.ajustado_por = (select auth.uid())
  and exists (
    select 1
    from public.tentativas_avaliacao t
    join public.avaliacoes_docentes a on a.id = t.avaliacao_id
    where t.id = ajustes_notas_avaliacao.tentativa_id
      and t.avaliacao_id = ajustes_notas_avaliacao.avaliacao_id
      and t.aluno_id = ajustes_notas_avaliacao.aluno_id
      and t.status = 'corrigida'
      and ajustes_notas_avaliacao.nota_anterior is not distinct from t.nota
      and ajustes_notas_avaliacao.nota_nova <= a.valor
      and (
        a.professor_id = (select auth.uid())
        or (select public.usuario_role()) = 'gestor'
      )
  )
);

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 48/67: migrations/20260910_integridade_formatos_atividade_ajustes.sql
-- ============================================================================

-- OminiSaber | Ajuste de privilégios do validador interno de gabaritos

alter function private.validar_gabarito_avaliacao() security definer;
alter function private.validar_gabarito_avaliacao() set search_path = '';
revoke all on function private.validar_gabarito_avaliacao()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 49/67: migrations/20260910_laboratorio_medidas_geometricas.sql
-- ============================================================================

-- OminiSaber | Laboratorio de medidas geometricas 2D e 3D

create or replace function private.validar_questao_avaliacao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_modo text := nullif(new.configuracao->>'mathMode', '');
  v_min numeric;
  v_max numeric;
  v_step numeric;
  v_target numeric;
  v_min_y numeric;
  v_max_y numeric;
  v_target_y numeric;
  v_dimension text;
  v_shape text;
  v_target_type text;
  v_required_keys text[];
  v_key text;
  v_sides integer;
begin
  if v_modo is not null
     and v_modo not in (
       'livre',
       'plano_cartesiano',
       'reta_numerica',
       'pitagoras',
       'geometria_medidas',
       'grafico_barras'
     ) then
    raise exception 'Modelo matematico invalido.';
  end if;

  if new.tipo in ('unica_escolha', 'multipla_escolha')
     and jsonb_array_length(new.alternativas) < 2 then
    raise exception 'Questoes objetivas precisam de pelo menos duas alternativas.';
  end if;

  if new.tipo = 'associacao' then
    if jsonb_typeof(new.configuracao->'pairs') <> 'array'
       or jsonb_array_length(new.configuracao->'pairs') < 2
       or exists (
         select 1
         from jsonb_array_elements(new.configuracao->'pairs') par
         where jsonb_typeof(par) <> 'object'
            or btrim(coalesce(par->>'left', '')) = ''
            or btrim(coalesce(par->>'right', '')) = ''
       ) then
      raise exception 'A associacao precisa de pelo menos dois pares completos.';
    end if;
  elsif new.tipo = 'ordenacao' and jsonb_array_length(new.alternativas) < 2 then
    raise exception 'A ordenacao precisa de pelo menos dois itens.';
  end if;

  if v_modo = 'plano_cartesiano' then
    if new.tipo <> 'resposta_curta' then
      raise exception 'O plano cartesiano deve usar resposta curta.';
    end if;
    begin
      v_min := (new.configuracao->>'minX')::numeric;
      v_max := (new.configuracao->>'maxX')::numeric;
      v_target := (new.configuracao->>'targetX')::numeric;
      v_min_y := (new.configuracao->>'minY')::numeric;
      v_max_y := (new.configuracao->>'maxY')::numeric;
      v_target_y := (new.configuracao->>'targetY')::numeric;
    exception when others then
      raise exception 'Os eixos e o ponto do plano cartesiano precisam ser numericos.';
    end;
    if v_max <= v_min or v_max_y <= v_min_y
       or v_target not between v_min and v_max
       or v_target_y not between v_min_y and v_max_y
       or v_target <> trunc(v_target)
       or v_target_y <> trunc(v_target_y) then
      raise exception 'Revise os limites e o ponto inteiro do plano cartesiano.';
    end if;
  elsif v_modo = 'reta_numerica' then
    if new.tipo <> 'numerica' then
      raise exception 'A reta numerica deve usar resposta numerica.';
    end if;
    begin
      v_min := (new.configuracao->>'min')::numeric;
      v_max := (new.configuracao->>'max')::numeric;
      v_step := (new.configuracao->>'step')::numeric;
      v_target := (new.configuracao->>'target')::numeric;
    exception when others then
      raise exception 'Os valores da reta numerica precisam ser numericos.';
    end;
    if v_max <= v_min or v_step <= 0 or v_target not between v_min and v_max then
      raise exception 'Revise os limites, o intervalo e a resposta da reta numerica.';
    end if;
  elsif v_modo = 'pitagoras' then
    if new.tipo <> 'numerica' then
      raise exception 'O modelo de triangulo deve usar resposta numerica.';
    end if;
    begin
      v_min := (new.configuracao->>'sideA')::numeric;
      v_max := (new.configuracao->>'sideB')::numeric;
      v_step := (new.configuracao->>'sideC')::numeric;
      v_target := (new.configuracao->>'target')::numeric;
    exception when others then
      raise exception 'As medidas do triangulo precisam ser numericas.';
    end;
    if least(v_min, v_max, v_step, v_target) <= 0 then
      raise exception 'As medidas e a resposta do triangulo precisam ser maiores que zero.';
    end if;
  elsif v_modo = 'geometria_medidas' then
    if new.tipo <> 'numerica' then
      raise exception 'O laboratorio de medidas deve usar resposta numerica.';
    end if;

    v_dimension := new.configuracao->>'dimension';
    v_shape := new.configuracao->>'shape';
    v_target_type := new.configuracao->>'targetType';

    if v_dimension is null or v_dimension not in ('2d', '3d') then
      raise exception 'A dimensao geometrica deve ser 2d ou 3d.';
    end if;
    if (v_dimension = '2d' and v_shape not in (
         'quadrado', 'retangulo', 'triangulo', 'circulo', 'trapezio',
         'losango', 'poligono_regular', 'personalizada_2d'
       )) or (v_dimension = '3d' and v_shape not in (
         'cubo', 'paralelepipedo', 'cilindro', 'cone', 'esfera',
         'prisma', 'piramide', 'personalizada_3d'
       )) then
      raise exception 'A forma geometrica nao pertence a dimensao selecionada.';
    end if;
    if v_target_type is null or (v_dimension = '2d' and v_target_type not in (
         'area', 'perimetro', 'diagonal', 'medida_desconhecida'
       )) or (v_dimension = '3d' and v_target_type not in (
         'volume', 'area_total', 'area_lateral', 'medida_desconhecida'
       )) then
      raise exception 'O objetivo de calculo nao pertence a dimensao selecionada.';
    end if;
    if btrim(coalesce(new.configuracao->>'unit', '')) = ''
       or char_length(new.configuracao->>'unit') > 12 then
      raise exception 'Informe uma unidade de medida com ate 12 caracteres.';
    end if;
    if v_shape in ('personalizada_2d', 'personalizada_3d')
       and btrim(coalesce(new.configuracao->>'customName', '')) = '' then
      raise exception 'A forma personalizada precisa de um nome.';
    end if;

    v_required_keys := case v_shape
      when 'quadrado' then array['measureA']
      when 'retangulo' then array['measureA', 'measureB']
      when 'triangulo' then array['measureA', 'measureB', 'measureC', 'measureD']
      when 'circulo' then array['measureA']
      when 'trapezio' then array['measureA', 'measureB', 'measureC', 'measureD']
      when 'losango' then array['measureA', 'measureB', 'measureC']
      when 'poligono_regular' then array['measureA', 'measureB']
      when 'cubo' then array['measureA']
      when 'paralelepipedo' then array['measureA', 'measureB', 'measureC']
      when 'cilindro' then array['measureA', 'measureB']
      when 'cone' then array['measureA', 'measureB', 'measureC']
      when 'esfera' then array['measureA']
      when 'prisma' then array['measureA', 'measureB', 'measureC']
      when 'piramide' then array['measureA', 'measureB', 'measureC', 'measureD']
      else array['measureA', 'measureB', 'measureC', 'measureD']
    end;

    foreach v_key in array v_required_keys loop
      begin
        v_min := (new.configuracao->>v_key)::numeric;
      exception when others then
        raise exception 'A medida % precisa ser numerica.', v_key;
      end;
      if v_min is null or v_min <= 0 then
        raise exception 'Todas as medidas geometricas precisam ser maiores que zero.';
      end if;
    end loop;

    if v_shape in ('poligono_regular', 'prisma', 'piramide') then
      begin
        v_sides := (new.configuracao->>'sides')::integer;
      exception when others then
        raise exception 'O numero de lados da base precisa ser inteiro.';
      end;
      if v_sides is null or v_sides not between 3 and 20 then
        raise exception 'O numero de lados da base deve estar entre 3 e 20.';
      end if;
    end if;

    begin
      v_target := (new.configuracao->>'target')::numeric;
      v_step := coalesce(nullif(new.configuracao->>'tolerance', '')::numeric, 0);
    exception when others then
      raise exception 'A resposta e a tolerancia precisam ser numericas.';
    end;
    if v_target is null or v_step is null then
      raise exception 'A resposta e a tolerancia sao obrigatorias.';
    end if;
    if v_step < 0 then
      raise exception 'A tolerancia nao pode ser negativa.';
    end if;
  elsif v_modo = 'grafico_barras' then
    if new.tipo <> 'unica_escolha'
       or jsonb_typeof(new.configuracao->'chartData') <> 'array'
       or jsonb_array_length(new.configuracao->'chartData') < 2
       or btrim(coalesce(new.configuracao->>'correctLabel', '')) = ''
       or exists (
         select 1
         from jsonb_array_elements(new.configuracao->'chartData') barra
         where jsonb_typeof(barra) <> 'object'
            or btrim(coalesce(barra->>'label', '')) = ''
            or jsonb_typeof(barra->'value') <> 'number'
       )
       or not exists (
         select 1
         from jsonb_array_elements(new.configuracao->'chartData') barra
         where barra->>'label' = new.configuracao->>'correctLabel'
       ) then
      raise exception 'O grafico precisa de ao menos duas barras e uma categoria correta valida.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validar_questao_avaliacao()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 50/67: migrations/20260910_proteger_gabarito_geometria.sql
-- ============================================================================

-- OminiSaber | Protege gabarito e resolucao do laboratorio geometrico

create or replace function private.hidratar_configuracao_geometria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resposta text;
begin
  if new.configuracao->>'mathMode' = 'geometria_medidas'
     and not (new.configuracao ? 'target')
     and tg_op = 'UPDATE' then
    select g.resposta_esperada->>'value'
      into v_resposta
    from public.gabaritos_avaliacao g
    where g.questao_id = old.id;

    if nullif(v_resposta, '') is not null then
      new.configuracao := new.configuracao
        || jsonb_build_object('target', v_resposta);
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.proteger_configuracao_geometria()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.configuracao->>'mathMode' = 'geometria_medidas' then
    new.configuracao := new.configuracao - 'target' - 'solution';
  end if;

  return new;
end;
$$;

revoke all on function private.hidratar_configuracao_geometria()
  from public, anon, authenticated;
revoke all on function private.proteger_configuracao_geometria()
  from public, anon, authenticated;

drop trigger if exists aa_hidratar_configuracao_geometria
  on public.questoes_avaliacao;
create trigger aa_hidratar_configuracao_geometria
before insert or update on public.questoes_avaliacao
for each row execute function private.hidratar_configuracao_geometria();

drop trigger if exists zz_proteger_configuracao_geometria
  on public.questoes_avaliacao;
create trigger zz_proteger_configuracao_geometria
before insert or update on public.questoes_avaliacao
for each row execute function private.proteger_configuracao_geometria();

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 51/67: migrations/20260916_proteger_respostas_construtor_atividades.sql
-- ============================================================================

-- OminiSaber | Protecao de respostas e resolucoes do construtor de atividades

-- Preserva resolucoes docentes que ainda estavam na configuracao publica.
update public.gabaritos_avaliacao g
set resposta_esperada = jsonb_set(
  g.resposta_esperada,
  '{normalization}',
  coalesce(g.resposta_esperada->'normalization', '{}'::jsonb)
    || case
         when q.configuracao ? 'solution'
           then jsonb_build_object('solution', q.configuracao->'solution')
         else '{}'::jsonb
       end,
  true
)
from public.questoes_avaliacao q
where q.id = g.questao_id
  and q.configuracao ? 'solution';

create or replace function private.hidratar_configuracao_geometria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resposta text;
  v_modo text := new.configuracao->>'mathMode';
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  select g.resposta_esperada->>'value'
    into v_resposta
  from public.gabaritos_avaliacao g
  where g.questao_id = old.id;

  if nullif(v_resposta, '') is null then
    return new;
  end if;

  if v_modo = 'plano_cartesiano'
     and not (new.configuracao ? 'targetX')
     and position(';' in v_resposta) > 0 then
    new.configuracao := new.configuracao || jsonb_build_object(
      'targetX', split_part(v_resposta, ';', 1)::numeric,
      'targetY', split_part(v_resposta, ';', 2)::numeric
    );
  elsif v_modo in ('reta_numerica', 'pitagoras', 'geometria_medidas')
        and not (new.configuracao ? 'target') then
    new.configuracao := new.configuracao
      || jsonb_build_object('target', v_resposta::numeric);
  elsif v_modo = 'grafico_barras'
        and not (new.configuracao ? 'correctLabel') then
    new.configuracao := new.configuracao
      || jsonb_build_object('correctLabel', v_resposta);
  end if;

  return new;
end;
$$;

create or replace function private.proteger_configuracao_geometria()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_modo text := new.configuracao->>'mathMode';
begin
  new.configuracao := new.configuracao - 'solution';

  if v_modo = 'plano_cartesiano' then
    new.configuracao := new.configuracao - 'targetX' - 'targetY';
  elsif v_modo in ('reta_numerica', 'pitagoras', 'geometria_medidas') then
    new.configuracao := new.configuracao - 'target';
  elsif v_modo = 'grafico_barras' then
    new.configuracao := new.configuracao - 'correctLabel' - 'chartRows';
  end if;

  return new;
end;
$$;

revoke all on function private.hidratar_configuracao_geometria()
  from public, anon, authenticated;
revoke all on function private.proteger_configuracao_geometria()
  from public, anon, authenticated;

-- Regrava as configuracoes existentes para aplicar a protecao apos a validacao.
update public.questoes_avaliacao
set configuracao = configuracao
where configuracao ? 'solution'
   or configuracao->>'mathMode' in (
     'plano_cartesiano',
     'reta_numerica',
     'pitagoras',
     'geometria_medidas',
     'grafico_barras'
   );

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 52/67: migrations/20260916_corrigir_visibilidade_habilidades_atividades.sql
-- ============================================================================

-- OminiSaber | Corrige a leitura dos vinculos curriculares nas atividades

create or replace function public.habilidade_compativel_com_materia(
  p_habilidade_id uuid,
  p_materia public.materia_aluno
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.habilidades_curriculares h
    join public.habilidade_curriculo_periodos hcp
      on hcp.habilidade_id = h.id
    join public.curriculo_periodos cp
      on cp.id = hcp.periodo_id
    join public.curriculos c
      on c.id = cp.curriculo_id
    where h.id = p_habilidade_id
      and h.materia_codigo = p_materia
      and h.codigo ~ '^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?/ES)?$'
      and c.status = 'publicado'
      and c.ativo = true
  );
$$;

revoke all on function public.habilidade_compativel_com_materia(
  uuid,
  public.materia_aluno
) from public, anon;
grant execute on function public.habilidade_compativel_com_materia(
  uuid,
  public.materia_aluno
) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 53/67: migrations/20260917_endurecer_execucao_atividades_aluno.sql
-- ============================================================================

-- OminiSaber | Pente-fino da execucao de atividades pelo aluno

create or replace function private.resposta_avaliacao_preenchida(valor jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when valor is null or valor = 'null'::jsonb then true
    when jsonb_typeof(valor) = 'string' then btrim(valor #>> '{}') <> ''
    when jsonb_typeof(valor) = 'array' then
      jsonb_array_length(valor) > 0
      and not exists (
        select 1
        from jsonb_array_elements(valor) item
        where item = 'null'::jsonb
           or (jsonb_typeof(item) = 'string' and btrim(item #>> '{}') = '')
      )
    when jsonb_typeof(valor) = 'object' then valor <> '{}'::jsonb
    else true
  end;
$$;

revoke all on function private.resposta_avaliacao_preenchida(jsonb)
  from public, anon, authenticated;

update public.respostas_avaliacao
set resposta = 'null'::jsonb,
    updated_at = now()
where not private.resposta_avaliacao_preenchida(resposta);

alter table public.respostas_avaliacao
  drop constraint if exists respostas_avaliacao_resposta_preenchida_check;
alter table public.respostas_avaliacao
  add constraint respostas_avaliacao_resposta_preenchida_check
  check (private.resposta_avaliacao_preenchida(resposta));

create or replace function private.hidratar_configuracao_geometria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resposta jsonb;
  v_modo text := new.configuracao->>'mathMode';
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  select g.resposta_esperada->'value'
    into v_resposta
  from public.gabaritos_avaliacao g
  where g.questao_id = old.id;

  if v_resposta is null or v_resposta = 'null'::jsonb then
    return new;
  end if;

  if new.tipo = 'associacao'
     and jsonb_typeof(v_resposta) = 'array'
     and not (new.configuracao ? 'pairs') then
    new.configuracao := new.configuracao || jsonb_build_object(
      'pairs',
      coalesce((
        select jsonb_agg(
          jsonb_build_object('left', esquerda.valor, 'right', direita.valor)
          order by esquerda.ordem
        )
        from jsonb_array_elements_text(
          coalesce(new.configuracao->'associationLeft', new.alternativas)
        ) with ordinality esquerda(valor, ordem)
        join jsonb_array_elements_text(v_resposta)
          with ordinality direita(valor, ordem)
          using (ordem)
      ), '[]'::jsonb)
    );
  elsif new.tipo = 'ordenacao' and jsonb_typeof(v_resposta) = 'array' then
    new.alternativas := v_resposta;
  elsif v_modo = 'plano_cartesiano'
        and not (new.configuracao ? 'targetX')
        and position(';' in (v_resposta #>> '{}')) > 0 then
    new.configuracao := new.configuracao || jsonb_build_object(
      'targetX', split_part(v_resposta #>> '{}', ';', 1)::numeric,
      'targetY', split_part(v_resposta #>> '{}', ';', 2)::numeric
    );
  elsif v_modo in ('reta_numerica', 'pitagoras', 'geometria_medidas')
        and not (new.configuracao ? 'target') then
    new.configuracao := new.configuracao
      || jsonb_build_object('target', (v_resposta #>> '{}')::numeric);
  elsif v_modo = 'grafico_barras'
        and not (new.configuracao ? 'correctLabel') then
    new.configuracao := new.configuracao
      || jsonb_build_object('correctLabel', v_resposta #>> '{}');
  end if;

  return new;
end;
$$;

create or replace function private.proteger_configuracao_geometria()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_modo text := new.configuracao->>'mathMode';
  v_pares jsonb := new.configuracao->'pairs';
begin
  new.configuracao := new.configuracao - 'solution';

  if new.tipo = 'associacao' and jsonb_typeof(v_pares) = 'array' then
    new.configuracao := (new.configuracao - 'pairs') || jsonb_build_object(
      'pairs', coalesce((
        select jsonb_agg(jsonb_build_object('left', par->>'left') order by ordem)
        from jsonb_array_elements(v_pares) with ordinality item(par, ordem)
      ), '[]'::jsonb),
      'associationLeft', coalesce((
        select jsonb_agg(par->>'left' order by ordem)
        from jsonb_array_elements(v_pares) with ordinality item(par, ordem)
      ), '[]'::jsonb),
      'associationOptions', coalesce((
        select jsonb_agg(par->>'right' order by md5((par->>'right') || new.id::text))
        from jsonb_array_elements(v_pares) item(par)
      ), '[]'::jsonb)
    );
  end if;

  if new.tipo = 'ordenacao' and tg_op = 'UPDATE' then
    new.alternativas := coalesce((
      select jsonb_agg(valor order by md5(valor || new.id::text))
      from jsonb_array_elements_text(new.alternativas) item(valor)
    ), '[]'::jsonb);
  end if;

  if v_modo = 'plano_cartesiano' then
    new.configuracao := new.configuracao - 'targetX' - 'targetY';
  elsif v_modo in ('reta_numerica', 'pitagoras', 'geometria_medidas') then
    new.configuracao := new.configuracao - 'target';
  elsif v_modo = 'grafico_barras' then
    new.configuracao := new.configuracao - 'correctLabel' - 'chartRows';
  end if;

  return new;
end;
$$;

revoke all on function private.hidratar_configuracao_geometria()
  from public, anon, authenticated;
revoke all on function private.proteger_configuracao_geometria()
  from public, anon, authenticated;

create or replace function private.sanitizar_questao_apos_gabarito()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.questoes_avaliacao
  set configuracao = configuracao
  where id = new.questao_id;
  return new;
end;
$$;

revoke all on function private.sanitizar_questao_apos_gabarito()
  from public, anon, authenticated;

drop trigger if exists sanitizar_questao_apos_gabarito
  on public.gabaritos_avaliacao;
create trigger sanitizar_questao_apos_gabarito
after insert or update of resposta_esperada on public.gabaritos_avaliacao
for each row execute function private.sanitizar_questao_apos_gabarito();

update public.questoes_avaliacao
set configuracao = configuracao
where tipo in ('associacao', 'ordenacao');

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 54/67: migrations/20260917_endurecer_execucao_atividades_aluno_ajuste_associacao.sql
-- ============================================================================

create or replace function private.hidratar_configuracao_geometria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resposta jsonb;
  v_modo text := new.configuracao->>'mathMode';
  v_esquerda jsonb;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  select g.resposta_esperada->'value'
    into v_resposta
  from public.gabaritos_avaliacao g
  where g.questao_id = old.id;

  if v_resposta is null or v_resposta = 'null'::jsonb then
    return new;
  end if;

  if new.tipo = 'associacao' and jsonb_typeof(v_resposta) = 'array' then
    v_esquerda := coalesce(
      new.configuracao->'associationLeft',
      (
        select jsonb_agg(par->>'left' order by ordem)
        from jsonb_array_elements(new.configuracao->'pairs')
          with ordinality item(par, ordem)
        where nullif(btrim(par->>'left'), '') is not null
      ),
      new.alternativas
    );

    new.configuracao := new.configuracao || jsonb_build_object(
      'pairs',
      coalesce((
        select jsonb_agg(
          jsonb_build_object('left', esquerda.valor, 'right', direita.valor)
          order by esquerda.ordem
        )
        from jsonb_array_elements_text(v_esquerda)
          with ordinality esquerda(valor, ordem)
        join jsonb_array_elements_text(v_resposta)
          with ordinality direita(valor, ordem)
          using (ordem)
      ), '[]'::jsonb)
    );
  elsif new.tipo = 'ordenacao' and jsonb_typeof(v_resposta) = 'array' then
    new.alternativas := v_resposta;
  elsif v_modo = 'plano_cartesiano'
        and not (new.configuracao ? 'targetX')
        and position(';' in (v_resposta #>> '{}')) > 0 then
    new.configuracao := new.configuracao || jsonb_build_object(
      'targetX', split_part(v_resposta #>> '{}', ';', 1)::numeric,
      'targetY', split_part(v_resposta #>> '{}', ';', 2)::numeric
    );
  elsif v_modo = 'reta_numerica' and not (new.configuracao ? 'targetValue') then
    new.configuracao := new.configuracao || jsonb_build_object(
      'targetValue', (v_resposta #>> '{}')::numeric
    );
  elsif v_modo = 'leitura_grafico' and not (new.configuracao ? 'correctIndex') then
    new.configuracao := new.configuracao || jsonb_build_object(
      'correctIndex', (v_resposta #>> '{}')::integer
    );
  elsif v_modo = 'geometria_medidas' then
    new.configuracao := new.configuracao || jsonb_build_object(
      'expectedValue', (v_resposta #>> '{}')::numeric,
      'solution', coalesce(
        new.configuracao->>'solution',
        (select g.resposta_esperada->>'explanation'
         from public.gabaritos_avaliacao g
         where g.questao_id = old.id),
        ''
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.hidratar_configuracao_geometria() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 55/67: migrations/20260917_endurecer_execucao_atividades_aluno_ajuste_permissoes.sql
-- ============================================================================

-- A constraint chama esta função com os privilégios do usuário que grava a
-- resposta. Ela apenas valida o próprio JSON recebido, é IMMUTABLE e não lê
-- nenhuma tabela; por isso o aluno autenticado precisa poder executá-la.
grant execute on function private.resposta_avaliacao_preenchida(jsonb)
  to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 56/67: migrations/20260909_copiloto_docente_fase3_0.sql
-- ============================================================================

-- OminiSaber | Fase 3.0 - Copiloto docente isolado por feature flag

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

-- ============================================================================
-- ETAPA 57/67: migrations/20260909081800_fase3_advisors_ajustes.sql
-- ============================================================================

-- OminiSaber | Ajustes dos advisors após a instalação isolada da Fase 3.0

-- Função de trigger: fixa o namespace sem alterar seu comportamento.
alter function public.set_updated_at() set search_path = '';

-- O FOR ALL também criava uma policy permissiva de SELECT redundante.
-- Operações administrativas ficam separadas e continuam protegidas por role.
drop policy if exists feature_flags_manage_gestor on public.feature_flags;
drop policy if exists feature_flags_insert_gestor on public.feature_flags;
create policy feature_flags_insert_gestor on public.feature_flags
for insert to authenticated
with check ((select public.usuario_role()) = 'gestor');
drop policy if exists feature_flags_update_gestor on public.feature_flags;
create policy feature_flags_update_gestor on public.feature_flags
for update to authenticated
using ((select public.usuario_role()) = 'gestor')
with check ((select public.usuario_role()) = 'gestor');
drop policy if exists feature_flags_delete_gestor on public.feature_flags;
create policy feature_flags_delete_gestor on public.feature_flags
for delete to authenticated
using ((select public.usuario_role()) = 'gestor');

drop policy if exists feature_flag_usuarios_manage_gestor on public.feature_flag_usuarios;
drop policy if exists feature_flag_usuarios_insert_gestor on public.feature_flag_usuarios;
create policy feature_flag_usuarios_insert_gestor on public.feature_flag_usuarios
for insert to authenticated
with check ((select public.usuario_role()) = 'gestor');
drop policy if exists feature_flag_usuarios_update_gestor on public.feature_flag_usuarios;
create policy feature_flag_usuarios_update_gestor on public.feature_flag_usuarios
for update to authenticated
using ((select public.usuario_role()) = 'gestor')
with check ((select public.usuario_role()) = 'gestor');
drop policy if exists feature_flag_usuarios_delete_gestor on public.feature_flag_usuarios;
create policy feature_flag_usuarios_delete_gestor on public.feature_flag_usuarios
for delete to authenticated
using ((select public.usuario_role()) = 'gestor');

grant insert, update, delete on table public.feature_flags to authenticated;
grant insert, update, delete on table public.feature_flag_usuarios to authenticated;

create index if not exists feature_flag_usuarios_concedida_por_idx
  on public.feature_flag_usuarios (concedida_por)
  where concedida_por is not null;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 58/67: migrations/20260909194704_corrigir_integridade_redacoes.sql
-- ============================================================================

-- Uma correção só é válida quando as cinco competências existem e totalizam a
-- mesma nota apresentada na redação.
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
  quantidade_competencias integer;
  competencias_distintas integer;
  soma_competencias integer;
begin
  if nota_input is null or nota_input < 0 or nota_input > 1000 then
    raise exception 'A nota deve estar entre 0 e 1000.';
  end if;
  if char_length(pg_catalog.btrim(coalesce(feedback_input, ''))) < 2 then
    raise exception 'A devolutiva precisa ser preenchida.';
  end if;
  if jsonb_typeof(coalesce(competencias_input, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(comentarios_input, '[]'::jsonb)) <> 'array' then
    raise exception 'Competências e comentários devem ser listas.';
  end if;

  select count(*), count(distinct (value ->> 'competencia')::smallint),
         coalesce(sum((value ->> 'nota')::smallint), 0)
  into quantidade_competencias, competencias_distintas, soma_competencias
  from jsonb_array_elements(competencias_input);

  if quantidade_competencias <> 5 or competencias_distintas <> 5 then
    raise exception 'Informe exatamente as cinco competências, sem repetição.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(competencias_input) competencia
    where (competencia ->> 'competencia')::smallint not between 1 and 5
       or (competencia ->> 'nota')::smallint not in (0, 40, 80, 120, 160, 200)
  ) then
    raise exception 'Competência ou nota inválida.';
  end if;
  if soma_competencias::numeric <> nota_input then
    raise exception 'A nota final deve ser igual à soma das cinco competências.';
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
      feedback = pg_catalog.btrim(feedback_input),
      status = 'corrigida',
      corrigida_por = (select auth.uid()),
      corrigida_em = now()
  where id = redacao_input
  returning * into resultado;
  if resultado.id is null then raise exception 'Redação não encontrada.'; end if;

  for item in select value from jsonb_array_elements(competencias_input) loop
    competencia_numero := (item ->> 'competencia')::smallint;
    competencia_nota := (item ->> 'nota')::smallint;
    insert into public.avaliacoes_competencias_redacao
      (redacao_id, competencia, nota, comentario, professor_id)
    values (
      redacao_input,
      competencia_numero,
      competencia_nota,
      nullif(item ->> 'comentario', ''),
      (select auth.uid())
    )
    on conflict (redacao_id, competencia) do update
      set nota = excluded.nota,
          comentario = excluded.comentario,
          professor_id = excluded.professor_id,
          updated_at = now();
  end loop;

  for item in select value from jsonb_array_elements(coalesce(comentarios_input, '[]'::jsonb)) loop
    insert into public.comentarios_redacao
      (redacao_id, professor_id, inicio_offset, fim_offset, trecho, comentario, tipo)
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

revoke all on function public.corrigir_redacao(uuid,numeric,text,jsonb,jsonb)
  from public, anon;
grant execute on function public.corrigir_redacao(uuid,numeric,text,jsonb,jsonb)
  to authenticated;

-- Repara o registro de demonstração que originou o relatório. A nota anterior,
-- 780, não é representável pela matriz de cinco competências em passos de 40.
insert into public.avaliacoes_competencias_redacao
  (redacao_id, competencia, nota, comentario, professor_id)
select
  r.id,
  valores.competencia,
  valores.nota,
  valores.comentario,
  r.corrigida_por
from public.redacoes r
cross join (
  values
    (1::smallint, 160::smallint, 'Bom domínio da norma-padrão.'::text),
    (2::smallint, 160::smallint, 'Tema compreendido e tese bem delimitada.'::text),
    (3::smallint, 160::smallint, 'Argumentos pertinentes; amplie o repertório.'::text),
    (4::smallint, 160::smallint, 'Boa articulação entre as ideias.'::text),
    (5::smallint, 120::smallint, 'Detalhe melhor os meios da intervenção.'::text)
) as valores(competencia, nota, comentario)
where r.id = 'd2400000-0000-4000-8000-000000000022'
  and r.status = 'corrigida'
  and r.corrigida_por is not null
on conflict (redacao_id, competencia) do update
set nota = excluded.nota,
    comentario = excluded.comentario,
    professor_id = excluded.professor_id,
    updated_at = now();

update public.redacoes
set nota = 760
where id = 'd2400000-0000-4000-8000-000000000022'
  and status = 'corrigida';

-- Correções incompletas que não são o registro de demonstração voltam para a
-- fila docente. A devolutiva textual é preservada, mas a nota inválida é removida.
update public.redacoes r
set status = 'enviada',
    nota = null,
    corrigida_por = null,
    corrigida_em = null
where r.status = 'corrigida'
  and (
    select count(*) <> 5
        or count(distinct c.competencia) <> 5
        or coalesce(sum(c.nota), 0)::numeric <> r.nota
    from public.avaliacoes_competencias_redacao c
    where c.redacao_id = r.id
  );

create or replace function private.validar_integridade_correcao_redacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  redacao_id_validada uuid;
  redacao_validada public.redacoes;
  quantidade integer;
  soma integer;
begin
  if tg_table_name = 'redacoes' then
    if tg_op = 'DELETE' then redacao_id_validada := old.id;
    else redacao_id_validada := new.id;
    end if;
  else
    if tg_op = 'DELETE' then redacao_id_validada := old.redacao_id;
    else redacao_id_validada := new.redacao_id;
    end if;
  end if;

  select * into redacao_validada
  from public.redacoes
  where id = redacao_id_validada;

  if redacao_validada.id is not null and redacao_validada.status = 'corrigida' then
    select count(*), coalesce(sum(nota), 0)
    into quantidade, soma
    from public.avaliacoes_competencias_redacao
    where redacao_id = redacao_id_validada;

    if redacao_validada.nota is null
       or redacao_validada.corrigida_por is null
       or redacao_validada.corrigida_em is null
       or quantidade <> 5
       or soma::numeric <> redacao_validada.nota then
      raise exception 'Redação corrigida exige cinco competências cuja soma seja igual à nota final.';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.validar_integridade_correcao_redacao()
  from public, anon, authenticated;

drop trigger if exists validar_redacao_corrigida on public.redacoes;
create constraint trigger validar_redacao_corrigida
after insert or update of status, nota, corrigida_por, corrigida_em
on public.redacoes
deferrable initially deferred
for each row execute function private.validar_integridade_correcao_redacao();

drop trigger if exists validar_competencias_redacao_corrigida
  on public.avaliacoes_competencias_redacao;
create constraint trigger validar_competencias_redacao_corrigida
after insert or update or delete on public.avaliacoes_competencias_redacao
deferrable initially deferred
for each row execute function private.validar_integridade_correcao_redacao();

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 59/67: migrations/20260925090000_organizacao_governanca_banco.sql
-- ============================================================================

-- OminiSaber | Governança, observabilidade e índices relacionais do banco

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to service_role;

-- PostgreSQL não cria índices automaticamente para chaves estrangeiras. Este
-- bloco cobre relações simples e compostas ainda sem um índice utilizável,
-- preservando índices existentes e sem alterar dados.
do $$
declare
  relation_record record;
  index_name text;
begin
  for relation_record in
    select
      constraint_row.conrelid,
      constraint_row.conname,
      namespace_row.nspname,
      table_row.relname,
      string_agg(format('%I', attribute_row.attname), ', ' order by key_row.ordinality) as columns_sql
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class table_row
      on table_row.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    cross join lateral unnest(constraint_row.conkey)
      with ordinality as key_row(attnum, ordinality)
    join pg_catalog.pg_attribute attribute_row
      on attribute_row.attrelid = constraint_row.conrelid
     and attribute_row.attnum = key_row.attnum
    where constraint_row.contype = 'f'
      and namespace_row.nspname = 'public'
      and not exists (
        select 1
        from pg_catalog.pg_index index_row
        where index_row.indrelid = constraint_row.conrelid
          and index_row.indisvalid
          and index_row.indisready
          and index_row.indpred is null
          and index_row.indkey::smallint[] @> constraint_row.conkey
      )
    group by
      constraint_row.conrelid,
      constraint_row.conname,
      namespace_row.nspname,
      table_row.relname
  loop
    index_name := format(
      'idx_fk_%s_%s',
      left(relation_record.relname, 40),
      left(md5(relation_record.conname), 8)
    );

    execute format(
      'create index if not exists %I on %I.%I (%s)',
      index_name,
      relation_record.nspname,
      relation_record.relname,
      relation_record.columns_sql
    );
  end loop;
end
$$;

-- Diagnóstico somente de metadados. Não retorna conteúdo escolar nem dados de
-- usuários e não é exposto para clientes anônimos ou autenticados.
create or replace function private.database_health_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with public_tables as (
    select
      class_row.oid,
      class_row.relname,
      class_row.relrowsecurity
    from pg_catalog.pg_class class_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = class_row.relnamespace
    where namespace_row.nspname = 'public'
      and class_row.relkind in ('r', 'p')
  ),
  tables_without_primary_key as (
    select table_row.relname
    from public_tables table_row
    where not exists (
      select 1
      from pg_catalog.pg_constraint constraint_row
      where constraint_row.conrelid = table_row.oid
        and constraint_row.contype = 'p'
    )
  ),
  foreign_keys_without_index as (
    select
      table_row.relname,
      constraint_row.conname
    from pg_catalog.pg_constraint constraint_row
    join public_tables table_row
      on table_row.oid = constraint_row.conrelid
    where constraint_row.contype = 'f'
      and not exists (
        select 1
        from pg_catalog.pg_index index_row
        where index_row.indrelid = constraint_row.conrelid
          and index_row.indisvalid
          and index_row.indisready
          and index_row.indpred is null
          and index_row.indkey::smallint[] @> constraint_row.conkey
      )
  )
  select jsonb_build_object(
    'generated_at', pg_catalog.clock_timestamp(),
    'public_table_count', (select count(*) from public_tables),
    'rls_disabled', coalesce(
      (
        select jsonb_agg(table_row.relname order by table_row.relname)
        from public_tables table_row
        where not table_row.relrowsecurity
      ),
      '[]'::jsonb
    ),
    'tables_without_primary_key', coalesce(
      (
        select jsonb_agg(table_row.relname order by table_row.relname)
        from tables_without_primary_key table_row
      ),
      '[]'::jsonb
    ),
    'foreign_keys_without_index', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'table', foreign_key_row.relname,
            'constraint', foreign_key_row.conname
          )
          order by foreign_key_row.relname, foreign_key_row.conname
        )
        from foreign_keys_without_index foreign_key_row
      ),
      '[]'::jsonb
    ),
    'invalid_constraints', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'table', constraint_row.conrelid::regclass::text,
            'constraint', constraint_row.conname
          )
          order by constraint_row.conrelid::regclass::text, constraint_row.conname
        )
        from pg_catalog.pg_constraint constraint_row
        where not constraint_row.convalidated
      ),
      '[]'::jsonb
    )
  );
$$;

comment on function private.database_health_snapshot() is
  'Resumo interno de RLS, chaves primárias, índices de FKs e constraints inválidas.';

revoke all on function private.database_health_snapshot() from public, anon, authenticated;
grant execute on function private.database_health_snapshot() to service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 60/67: migrations/20260926120000_oministudio_persistencia_rls.sql
-- ============================================================================

-- OminiSaber | OminiStudio - persistencia, publicacao, execucao e RLS
-- Mantem rascunhos mutaveis separados de versoes publicadas imutaveis.

create table if not exists public.studio_experiencias (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.perfis(id) on delete cascade,
  materia_codigo public.materia_aluno not null,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 150),
  objetivo text not null default '' check (char_length(objetivo) <= 2500),
  turma_referencia text not null default '' check (char_length(turma_referencia) <= 120),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'publicado', 'arquivado')),
  versao_atual integer not null default 0 check (versao_atual >= 0),
  tentativas_permitidas smallint not null default 3
    check (tentativas_permitidas between 1 and 10),
  rascunho jsonb not null default '{}'::jsonb
    check (jsonb_typeof(rascunho) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_experiencias_professor_idx
  on public.studio_experiencias (professor_id, status, updated_at desc);
create index if not exists studio_experiencias_materia_idx
  on public.studio_experiencias (materia_codigo, status, updated_at desc);

create table if not exists public.studio_experiencia_versoes (
  experiencia_id uuid not null references public.studio_experiencias(id) on delete cascade,
  versao integer not null check (versao > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  publicado_por uuid not null references public.perfis(id) on delete restrict,
  publicado_em timestamptz not null default now(),
  primary key (experiencia_id, versao)
);

create index if not exists studio_versoes_publicado_por_idx
  on public.studio_experiencia_versoes (publicado_por, publicado_em desc);

create table if not exists public.studio_experiencia_turmas (
  experiencia_id uuid not null,
  versao integer not null,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  ativo boolean not null default true,
  abre_em timestamptz,
  encerra_em timestamptz,
  created_at timestamptz not null default now(),
  primary key (experiencia_id, versao, turma_id),
  foreign key (experiencia_id, versao)
    references public.studio_experiencia_versoes(experiencia_id, versao)
    on delete cascade,
  check (encerra_em is null or abre_em is null or encerra_em > abre_em)
);

create index if not exists studio_experiencia_turmas_turma_idx
  on public.studio_experiencia_turmas (turma_id, ativo, abre_em, encerra_em);

create table if not exists public.studio_tentativas (
  id uuid primary key default gen_random_uuid(),
  experiencia_id uuid not null,
  versao integer not null,
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete restrict,
  numero_tentativa smallint not null check (numero_tentativa between 1 and 10),
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'enviada', 'corrigida')),
  pontuacao_automatica numeric(8,2) not null default 0
    check (pontuacao_automatica >= 0),
  pontuacao_manual numeric(8,2) not null default 0
    check (pontuacao_manual >= 0),
  requer_revisao boolean not null default false,
  iniciada_em timestamptz not null default now(),
  enviada_em timestamptz,
  corrigida_em timestamptz,
  updated_at timestamptz not null default now(),
  unique (experiencia_id, versao, aluno_id, numero_tentativa),
  foreign key (experiencia_id, versao)
    references public.studio_experiencia_versoes(experiencia_id, versao)
    on delete restrict
);

create index if not exists studio_tentativas_aluno_idx
  on public.studio_tentativas (aluno_id, status, iniciada_em desc);
create index if not exists studio_tentativas_experiencia_idx
  on public.studio_tentativas (experiencia_id, versao, status, enviada_em desc);

create table if not exists public.studio_respostas (
  id uuid primary key default gen_random_uuid(),
  tentativa_id uuid not null references public.studio_tentativas(id) on delete cascade,
  bloco_id text not null check (char_length(bloco_id) between 1 and 120),
  bloco_tipo text not null
    check (bloco_tipo in ('content', 'number', 'choice', 'text', 'decision', 'flourish')),
  resposta jsonb not null default 'null'::jsonb,
  status_correcao text not null default 'registrada'
    check (status_correcao in ('registrada', 'automatica', 'revisao', 'manual')),
  correta boolean,
  pontos_automaticos numeric(8,2) not null default 0
    check (pontos_automaticos >= 0),
  pontos_manuais numeric(8,2) not null default 0
    check (pontos_manuais >= 0),
  feedback text check (feedback is null or char_length(feedback) <= 4000),
  respondida_em timestamptz not null default now(),
  corrigida_por uuid references public.perfis(id) on delete set null,
  corrigida_em timestamptz,
  updated_at timestamptz not null default now(),
  unique (tentativa_id, bloco_id)
);

create index if not exists studio_respostas_tentativa_idx
  on public.studio_respostas (tentativa_id, bloco_id);
create index if not exists studio_respostas_revisao_idx
  on public.studio_respostas (status_correcao, tentativa_id)
  where status_correcao = 'revisao';

create table if not exists public.studio_auditoria (
  id bigint generated by default as identity primary key,
  experiencia_id uuid references public.studio_experiencias(id) on delete set null,
  tentativa_id uuid references public.studio_tentativas(id) on delete set null,
  ator_id uuid references public.perfis(id) on delete set null,
  evento text not null check (char_length(evento) between 1 and 80),
  detalhes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(detalhes) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists studio_auditoria_experiencia_idx
  on public.studio_auditoria (experiencia_id, created_at desc);
create index if not exists studio_auditoria_tentativa_idx
  on public.studio_auditoria (tentativa_id, created_at desc)
  where tentativa_id is not null;
create index if not exists studio_auditoria_ator_idx
  on public.studio_auditoria (ator_id, created_at desc)
  where ator_id is not null;

create or replace function private.studio_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists studio_experiencias_updated_at on public.studio_experiencias;
create trigger studio_experiencias_updated_at
before update on public.studio_experiencias
for each row execute function private.studio_touch_updated_at();

drop trigger if exists studio_tentativas_updated_at on public.studio_tentativas;
create trigger studio_tentativas_updated_at
before update on public.studio_tentativas
for each row execute function private.studio_touch_updated_at();

drop trigger if exists studio_respostas_updated_at on public.studio_respostas;
create trigger studio_respostas_updated_at
before update on public.studio_respostas
for each row execute function private.studio_touch_updated_at();

create or replace function private.studio_bloquear_versao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Versoes publicadas do OminiStudio sao imutaveis.';
end;
$$;

drop trigger if exists studio_versoes_imutaveis on public.studio_experiencia_versoes;
create trigger studio_versoes_imutaveis
before update or delete on public.studio_experiencia_versoes
for each row execute function private.studio_bloquear_versao();

alter table public.studio_experiencias enable row level security;
alter table public.studio_experiencia_versoes enable row level security;
alter table public.studio_experiencia_turmas enable row level security;
alter table public.studio_tentativas enable row level security;
alter table public.studio_respostas enable row level security;
alter table public.studio_auditoria enable row level security;

revoke all on table
  public.studio_experiencias,
  public.studio_experiencia_versoes,
  public.studio_experiencia_turmas,
  public.studio_tentativas,
  public.studio_respostas,
  public.studio_auditoria
from anon, authenticated;

grant select, insert, update, delete on public.studio_experiencias to authenticated;
grant select on public.studio_experiencia_versoes to authenticated;
grant select on public.studio_experiencia_turmas to authenticated;
grant select on public.studio_tentativas to authenticated;
grant select, update (pontos_manuais, feedback, status_correcao, corrigida_por, corrigida_em, updated_at)
  on public.studio_respostas to authenticated;
grant select on public.studio_auditoria to authenticated;
grant usage, select on sequence public.studio_auditoria_id_seq to service_role;

drop policy if exists studio_experiencias_select on public.studio_experiencias;
create policy studio_experiencias_select on public.studio_experiencias
for select to authenticated using (
  professor_id = (select auth.uid())
  or (select public.usuario_role()) = 'gestor'
);

drop policy if exists studio_experiencias_insert on public.studio_experiencias;
create policy studio_experiencias_insert on public.studio_experiencias
for insert to authenticated with check (
  professor_id = (select auth.uid())
  and (select public.usuario_role()) = 'professor'
  and exists (
    select 1 from public.professor_turma_materias ptm
    where ptm.professor_id = (select auth.uid())
      and ptm.materia_codigo = materia_codigo
      and ptm.ativo = true
  )
);

drop policy if exists studio_experiencias_update on public.studio_experiencias;
create policy studio_experiencias_update on public.studio_experiencias
for update to authenticated
using (
  professor_id = (select auth.uid())
  or (select public.usuario_role()) = 'gestor'
)
with check (
  (professor_id = (select auth.uid()) and (select public.usuario_role()) = 'professor')
  or (select public.usuario_role()) = 'gestor'
);

drop policy if exists studio_experiencias_delete on public.studio_experiencias;
create policy studio_experiencias_delete on public.studio_experiencias
for delete to authenticated using (
  (professor_id = (select auth.uid()) and versao_atual = 0)
  or (select public.usuario_role()) = 'gestor'
);

drop policy if exists studio_versoes_select on public.studio_experiencia_versoes;
create policy studio_versoes_select on public.studio_experiencia_versoes
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.studio_experiencias e
    where e.id = experiencia_id and e.professor_id = (select auth.uid())
  )
);

drop policy if exists studio_turmas_select on public.studio_experiencia_turmas;
create policy studio_turmas_select on public.studio_experiencia_turmas
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or turma_id = (select public.usuario_turma_id())
  or exists (
    select 1 from public.studio_experiencias e
    where e.id = experiencia_id and e.professor_id = (select auth.uid())
  )
);

drop policy if exists studio_tentativas_select on public.studio_tentativas;
create policy studio_tentativas_select on public.studio_tentativas
for select to authenticated using (
  aluno_id = (select auth.uid())
  or (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.studio_experiencias e
    where e.id = experiencia_id and e.professor_id = (select auth.uid())
  )
);

drop policy if exists studio_respostas_select on public.studio_respostas;
create policy studio_respostas_select on public.studio_respostas
for select to authenticated using (
  exists (
    select 1
    from public.studio_tentativas t
    join public.studio_experiencias e on e.id = t.experiencia_id
    where t.id = tentativa_id
      and (
        t.aluno_id = (select auth.uid())
        or e.professor_id = (select auth.uid())
        or (select public.usuario_role()) = 'gestor'
      )
  )
);

drop policy if exists studio_respostas_update on public.studio_respostas;
create policy studio_respostas_update on public.studio_respostas
for update to authenticated
using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1
    from public.studio_tentativas t
    join public.studio_experiencias e on e.id = t.experiencia_id
    where t.id = tentativa_id and e.professor_id = (select auth.uid())
  )
)
with check (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1
    from public.studio_tentativas t
    join public.studio_experiencias e on e.id = t.experiencia_id
    where t.id = tentativa_id and e.professor_id = (select auth.uid())
  )
);

drop policy if exists studio_auditoria_select on public.studio_auditoria;
create policy studio_auditoria_select on public.studio_auditoria
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or ator_id = (select auth.uid())
  or exists (
    select 1 from public.studio_experiencias e
    where e.id = experiencia_id and e.professor_id = (select auth.uid())
  )
);

create or replace function private.publicar_experiencia_studio(
  p_experiencia_id uuid,
  p_turma_ids uuid[],
  p_abre_em timestamptz default null,
  p_encerra_em timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_papel public.perfil_role := (select public.usuario_role());
  v_experiencia public.studio_experiencias%rowtype;
  v_turma uuid;
  v_versao integer;
begin
  if v_usuario is null or v_papel not in ('professor', 'gestor') then
    raise exception 'Somente professores e gestores podem publicar experiencias.';
  end if;
  if coalesce(array_length(p_turma_ids, 1), 0) = 0 then
    raise exception 'Selecione pelo menos uma turma.';
  end if;
  if p_encerra_em is not null and p_abre_em is not null and p_encerra_em <= p_abre_em then
    raise exception 'O encerramento precisa ser posterior a abertura.';
  end if;

  select * into v_experiencia
  from public.studio_experiencias
  where id = p_experiencia_id
    and (professor_id = v_usuario or v_papel = 'gestor')
  for update;
  if not found then raise exception 'Experiencia nao encontrada ou sem permissao.'; end if;
  if v_experiencia.status = 'arquivado' then raise exception 'Experiencia arquivada nao pode ser publicada.'; end if;
  if jsonb_typeof(v_experiencia.rascunho->'blocks') <> 'array'
     or jsonb_array_length(v_experiencia.rascunho->'blocks') = 0
     or jsonb_typeof(v_experiencia.rascunho->'edges') <> 'array'
     or nullif(v_experiencia.rascunho->>'start', '') is null then
    raise exception 'O trabalho precisa de blocos, conexoes e etapa inicial.';
  end if;

  foreach v_turma in array p_turma_ids loop
    if v_papel <> 'gestor' and not exists (
      select 1 from public.professor_turma_materias ptm
      where ptm.professor_id = v_usuario
        and ptm.turma_id = v_turma
        and ptm.materia_codigo = v_experiencia.materia_codigo
        and ptm.ativo = true
    ) then
      raise exception 'Professor sem vinculo ativo com uma das turmas selecionadas.';
    end if;
  end loop;

  v_versao := v_experiencia.versao_atual + 1;
  insert into public.studio_experiencia_versoes
    (experiencia_id, versao, snapshot, publicado_por)
  values (v_experiencia.id, v_versao, v_experiencia.rascunho, v_usuario);

  foreach v_turma in array p_turma_ids loop
    insert into public.studio_experiencia_turmas
      (experiencia_id, versao, turma_id, abre_em, encerra_em)
    values (v_experiencia.id, v_versao, v_turma, p_abre_em, p_encerra_em);
  end loop;

  update public.studio_experiencias
  set status = 'publicado', versao_atual = v_versao
  where id = v_experiencia.id;

  insert into public.studio_auditoria (experiencia_id, ator_id, evento, detalhes)
  values (
    v_experiencia.id,
    v_usuario,
    'experiencia_publicada',
    jsonb_build_object('versao', v_versao, 'turmas', to_jsonb(p_turma_ids))
  );

  return jsonb_build_object('experiencia_id', v_experiencia.id, 'versao', v_versao);
end;
$$;

create or replace function public.publicar_experiencia_studio(
  p_experiencia_id uuid,
  p_turma_ids uuid[],
  p_abre_em timestamptz default null,
  p_encerra_em timestamptz default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.publicar_experiencia_studio(
    p_experiencia_id,
    p_turma_ids,
    p_abre_em,
    p_encerra_em
  );
$$;

create or replace function private.obter_experiencia_publicada_studio(p_experiencia_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_turma uuid := (select public.usuario_turma_id());
  v_experiencia public.studio_experiencias%rowtype;
  v_snapshot jsonb;
  v_versao integer;
  v_blocks jsonb;
begin
  if v_usuario is null or (select public.usuario_role()) <> 'aluno' or v_turma is null then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;

  select et.versao into v_versao
  from public.studio_experiencia_turmas et
  join public.studio_experiencias e on e.id = et.experiencia_id
  where et.experiencia_id = p_experiencia_id
    and e.status = 'publicado'
    and et.turma_id = v_turma
    and et.ativo = true
    and (et.abre_em is null or et.abre_em <= now())
    and (et.encerra_em is null or et.encerra_em >= now())
  order by et.versao desc
  limit 1;
  if not found then raise exception 'Experiencia indisponivel para este aluno.'; end if;

  select * into v_experiencia
  from public.studio_experiencias
  where id = p_experiencia_id;

  select snapshot into v_snapshot
  from public.studio_experiencia_versoes
  where experiencia_id = p_experiencia_id and versao = v_versao;

  select coalesce(
    jsonb_agg(value - 'correct' - 'min' - 'max' - 'rubric' order by ordinality),
    '[]'::jsonb
  ) into v_blocks
  from jsonb_array_elements(coalesce(v_snapshot->'blocks', '[]'::jsonb)) with ordinality;
  v_snapshot := jsonb_set(v_snapshot, '{blocks}', v_blocks, true);

  return jsonb_build_object(
    'experiencia_id', p_experiencia_id,
    'versao', v_versao,
    'materia_codigo', v_experiencia.materia_codigo,
    'tentativas_permitidas', v_experiencia.tentativas_permitidas,
    'work', v_snapshot
  );
end;
$$;

create or replace function public.obter_experiencia_publicada_studio(p_experiencia_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.obter_experiencia_publicada_studio(p_experiencia_id);
$$;

create or replace function private.iniciar_tentativa_studio(p_experiencia_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aluno uuid := (select auth.uid());
  v_turma uuid := (select public.usuario_turma_id());
  v_versao integer;
  v_limite integer;
  v_numero integer;
  v_tentativa uuid;
begin
  if v_aluno is null or (select public.usuario_role()) <> 'aluno' or v_turma is null then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;

  select et.versao, e.tentativas_permitidas into v_versao, v_limite
  from public.studio_experiencia_turmas et
  join public.studio_experiencias e on e.id = et.experiencia_id
  where et.experiencia_id = p_experiencia_id
    and et.turma_id = v_turma
    and et.ativo = true
    and e.status = 'publicado'
    and (et.abre_em is null or et.abre_em <= now())
    and (et.encerra_em is null or et.encerra_em >= now())
  order by et.versao desc limit 1;
  if not found then raise exception 'Experiencia indisponivel para este aluno.'; end if;

  select coalesce(max(numero_tentativa), 0) + 1 into v_numero
  from public.studio_tentativas
  where experiencia_id = p_experiencia_id and versao = v_versao and aluno_id = v_aluno;
  if v_numero > v_limite then raise exception 'Limite de tentativas atingido.'; end if;

  insert into public.studio_tentativas
    (experiencia_id, versao, aluno_id, turma_id, numero_tentativa)
  values (p_experiencia_id, v_versao, v_aluno, v_turma, v_numero)
  returning id into v_tentativa;

  insert into public.studio_auditoria (experiencia_id, tentativa_id, ator_id, evento, detalhes)
  values (p_experiencia_id, v_tentativa, v_aluno, 'tentativa_iniciada', jsonb_build_object('versao', v_versao, 'numero', v_numero));

  return jsonb_build_object('tentativa_id', v_tentativa, 'versao', v_versao, 'numero', v_numero);
end;
$$;

create or replace function public.iniciar_tentativa_studio(p_experiencia_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.iniciar_tentativa_studio(p_experiencia_id); $$;

create or replace function private.salvar_resposta_studio(
  p_tentativa_id uuid,
  p_bloco_id text,
  p_resposta jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aluno uuid := (select auth.uid());
  v_tentativa public.studio_tentativas%rowtype;
  v_bloco jsonb;
  v_tipo text;
  v_status text := 'registrada';
  v_correta boolean;
  v_pontos numeric(8,2) := 0;
  v_maximo numeric(8,2) := 0;
  v_texto text := trim(both '"' from coalesce(p_resposta::text, ''));
  v_numero numeric;
begin
  if v_aluno is null or (select public.usuario_role()) <> 'aluno' then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;
  select * into v_tentativa from public.studio_tentativas
  where id = p_tentativa_id and aluno_id = v_aluno and status = 'em_andamento';
  if not found then raise exception 'Tentativa indisponivel para edicao.'; end if;

  select value into v_bloco
  from public.studio_experiencia_versoes ev,
       jsonb_array_elements(ev.snapshot->'blocks') item
  where ev.experiencia_id = v_tentativa.experiencia_id
    and ev.versao = v_tentativa.versao
    and item.value->>'id' = p_bloco_id
  limit 1;
  if v_bloco is null then raise exception 'Bloco nao encontrado na versao publicada.'; end if;

  v_tipo := v_bloco->>'type';
  v_maximo := greatest(coalesce((v_bloco->>'points')::numeric, 0), 0);
  if v_tipo = 'text' then
    v_status := 'revisao';
  elsif v_tipo = 'number' then
    if v_texto ~ '^-?[0-9]+([.,][0-9]+)?$' then
      v_numero := replace(v_texto, ',', '.')::numeric;
      v_correta := v_numero between (v_bloco->>'min')::numeric and (v_bloco->>'max')::numeric;
    else
      v_correta := false;
    end if;
    v_status := 'automatica';
    v_pontos := case when v_correta then v_maximo else 0 end;
  elsif v_tipo = 'choice' then
    if v_texto ~ '^[0-9]+$' then
      v_correta := v_texto::integer = (v_bloco->>'correct')::integer;
    else
      v_correta := false;
    end if;
    v_status := 'automatica';
    v_pontos := case when v_correta then v_maximo else 0 end;
  end if;

  insert into public.studio_respostas
    (tentativa_id, bloco_id, bloco_tipo, resposta, status_correcao, correta, pontos_automaticos)
  values (p_tentativa_id, p_bloco_id, v_tipo, coalesce(p_resposta, 'null'::jsonb), v_status, v_correta, v_pontos)
  on conflict (tentativa_id, bloco_id) do update set
    resposta = excluded.resposta,
    status_correcao = excluded.status_correcao,
    correta = excluded.correta,
    pontos_automaticos = excluded.pontos_automaticos,
    pontos_manuais = 0,
    feedback = null,
    corrigida_por = null,
    corrigida_em = null,
    respondida_em = now(),
    updated_at = now();

  return jsonb_build_object('status', v_status, 'correta', v_correta, 'pontos', v_pontos, 'maximo', v_maximo);
end;
$$;

create or replace function public.salvar_resposta_studio(
  p_tentativa_id uuid,
  p_bloco_id text,
  p_resposta jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.salvar_resposta_studio(p_tentativa_id, p_bloco_id, p_resposta); $$;

create or replace function private.enviar_tentativa_studio(p_tentativa_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aluno uuid := (select auth.uid());
  v_tentativa public.studio_tentativas%rowtype;
  v_automatica numeric(8,2);
  v_manual numeric(8,2);
  v_revisao boolean;
begin
  if v_aluno is null or (select public.usuario_role()) <> 'aluno' then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;
  select * into v_tentativa from public.studio_tentativas
  where id = p_tentativa_id and aluno_id = v_aluno and status = 'em_andamento'
  for update;
  if not found then raise exception 'Tentativa indisponivel para envio.'; end if;

  select coalesce(sum(pontos_automaticos), 0), coalesce(sum(pontos_manuais), 0),
         coalesce(bool_or(status_correcao = 'revisao'), false)
  into v_automatica, v_manual, v_revisao
  from public.studio_respostas where tentativa_id = p_tentativa_id;

  update public.studio_tentativas set
    status = case when v_revisao then 'enviada' else 'corrigida' end,
    pontuacao_automatica = v_automatica,
    pontuacao_manual = v_manual,
    requer_revisao = v_revisao,
    enviada_em = now(),
    corrigida_em = case when v_revisao then null else now() end
  where id = p_tentativa_id;

  insert into public.studio_auditoria (experiencia_id, tentativa_id, ator_id, evento, detalhes)
  values (v_tentativa.experiencia_id, p_tentativa_id, v_aluno, 'tentativa_enviada', jsonb_build_object('requer_revisao', v_revisao));

  return jsonb_build_object('status', case when v_revisao then 'enviada' else 'corrigida' end, 'pontuacao_automatica', v_automatica, 'requer_revisao', v_revisao);
end;
$$;

create or replace function public.enviar_tentativa_studio(p_tentativa_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.enviar_tentativa_studio(p_tentativa_id); $$;

create or replace function private.corrigir_resposta_studio(
  p_resposta_id uuid,
  p_pontos numeric,
  p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_resposta public.studio_respostas%rowtype;
  v_tentativa public.studio_tentativas%rowtype;
  v_maximo numeric(8,2);
  v_pendentes integer;
begin
  select r.* into v_resposta
  from public.studio_respostas r
  join public.studio_tentativas t on t.id = r.tentativa_id
  join public.studio_experiencias e on e.id = t.experiencia_id
  where r.id = p_resposta_id
    and (e.professor_id = v_usuario or (select public.usuario_role()) = 'gestor');
  if not found then raise exception 'Resposta nao encontrada ou sem permissao.'; end if;
  if v_resposta.bloco_tipo <> 'text' then raise exception 'Somente respostas abertas aceitam correcao manual.'; end if;

  select * into v_tentativa
  from public.studio_tentativas
  where id = v_resposta.tentativa_id;

  select greatest(coalesce((item.value->>'points')::numeric, 0), 0) into v_maximo
  from public.studio_experiencia_versoes ev,
       jsonb_array_elements(ev.snapshot->'blocks') item
  where ev.experiencia_id = v_tentativa.experiencia_id
    and ev.versao = v_tentativa.versao
    and item.value->>'id' = v_resposta.bloco_id;
  if p_pontos < 0 or p_pontos > coalesce(v_maximo, 0) then
    raise exception 'Pontuacao fora do intervalo permitido.';
  end if;

  update public.studio_respostas set
    pontos_manuais = p_pontos,
    feedback = nullif(btrim(p_feedback), ''),
    status_correcao = 'manual',
    corrigida_por = v_usuario,
    corrigida_em = now()
  where id = p_resposta_id;

  select count(*) into v_pendentes from public.studio_respostas
  where tentativa_id = v_tentativa.id and status_correcao = 'revisao';

  update public.studio_tentativas set
    pontuacao_manual = (select coalesce(sum(pontos_manuais), 0) from public.studio_respostas where tentativa_id = v_tentativa.id),
    requer_revisao = v_pendentes > 0,
    status = case when v_pendentes = 0 then 'corrigida' else status end,
    corrigida_em = case when v_pendentes = 0 then now() else corrigida_em end
  where id = v_tentativa.id;

  insert into public.studio_auditoria (experiencia_id, tentativa_id, ator_id, evento, detalhes)
  values (v_tentativa.experiencia_id, v_tentativa.id, v_usuario, 'resposta_corrigida', jsonb_build_object('resposta_id', p_resposta_id, 'pontos', p_pontos));

  return jsonb_build_object('resposta_id', p_resposta_id, 'pontos', p_pontos, 'pendentes', v_pendentes);
end;
$$;

create or replace function public.corrigir_resposta_studio(
  p_resposta_id uuid,
  p_pontos numeric,
  p_feedback text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.corrigir_resposta_studio(p_resposta_id, p_pontos, p_feedback); $$;

revoke all on function private.publicar_experiencia_studio(uuid, uuid[], timestamptz, timestamptz) from public, anon;
revoke all on function private.obter_experiencia_publicada_studio(uuid) from public, anon;
revoke all on function private.iniciar_tentativa_studio(uuid) from public, anon;
revoke all on function private.salvar_resposta_studio(uuid, text, jsonb) from public, anon;
revoke all on function private.enviar_tentativa_studio(uuid) from public, anon;
revoke all on function private.corrigir_resposta_studio(uuid, numeric, text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.publicar_experiencia_studio(uuid, uuid[], timestamptz, timestamptz) to authenticated;
grant execute on function private.obter_experiencia_publicada_studio(uuid) to authenticated;
grant execute on function private.iniciar_tentativa_studio(uuid) to authenticated;
grant execute on function private.salvar_resposta_studio(uuid, text, jsonb) to authenticated;
grant execute on function private.enviar_tentativa_studio(uuid) to authenticated;
grant execute on function private.corrigir_resposta_studio(uuid, numeric, text) to authenticated;

revoke all on function public.publicar_experiencia_studio(uuid, uuid[], timestamptz, timestamptz) from public, anon;
revoke all on function public.obter_experiencia_publicada_studio(uuid) from public, anon;
revoke all on function public.iniciar_tentativa_studio(uuid) from public, anon;
revoke all on function public.salvar_resposta_studio(uuid, text, jsonb) from public, anon;
revoke all on function public.enviar_tentativa_studio(uuid) from public, anon;
revoke all on function public.corrigir_resposta_studio(uuid, numeric, text) from public, anon;
grant execute on function public.publicar_experiencia_studio(uuid, uuid[], timestamptz, timestamptz) to authenticated;
grant execute on function public.obter_experiencia_publicada_studio(uuid) to authenticated;
grant execute on function public.iniciar_tentativa_studio(uuid) to authenticated;
grant execute on function public.salvar_resposta_studio(uuid, text, jsonb) to authenticated;
grant execute on function public.enviar_tentativa_studio(uuid) to authenticated;
grant execute on function public.corrigir_resposta_studio(uuid, numeric, text) to authenticated;

comment on table public.studio_experiencias is 'Rascunhos autorais mutaveis do OminiStudio.';
comment on table public.studio_experiencia_versoes is 'Snapshots publicados e imutaveis do OminiStudio.';
comment on table public.studio_experiencia_turmas is 'Disponibilidade de cada versao publicada por turma.';
comment on table public.studio_tentativas is 'Tentativas dos alunos em experiencias publicadas.';
comment on table public.studio_respostas is 'Evidencias e correcao por bloco do OminiStudio.';
comment on table public.studio_auditoria is 'Trilha de auditoria de publicacao, execucao e correcao do OminiStudio.';

-- ============================================================================
-- ETAPA 61/67: migrations/20260927043000_corrigir_persistencia_redacoes.sql
-- ============================================================================

-- O cliente autenticado precisa de privilégios de tabela e de políticas RLS.
-- A RLS continua sendo a fronteira que limita cada aluno aos próprios textos.
alter table public.redacoes enable row level security;

revoke all on table public.redacoes from anon;
revoke all on table public.redacoes from authenticated;
grant select, insert, update on table public.redacoes to authenticated;

create unique index if not exists redacoes_rascunho_tema_unique
  on public.redacoes (aluno_id, tema_codigo)
  where status = 'rascunho' and tema_codigo is not null;

drop policy if exists redacoes_insert_proprias on public.redacoes;
create policy redacoes_insert_proprias
on public.redacoes
for insert
to authenticated
with check (
  aluno_id = (select auth.uid())
  and status = 'rascunho'
  and (
    proposta_id is null
    or exists (
      select 1
      from public.propostas_redacao proposta
      where proposta.id = proposta_id
        and proposta.publicada = true
    )
  )
);

drop policy if exists redacoes_update_aluno on public.redacoes;
create policy redacoes_update_aluno
on public.redacoes
for update
to authenticated
using (
  aluno_id = (select auth.uid())
  and status = 'rascunho'
)
with check (
  aluno_id = (select auth.uid())
  and status in ('rascunho', 'enviada')
);

comment on policy redacoes_insert_proprias on public.redacoes is
  'Aluno autenticado cria somente o próprio rascunho em proposta publicada.';
comment on policy redacoes_update_aluno on public.redacoes is
  'Aluno autenticado salva e envia somente o próprio rascunho.';

-- ============================================================================
-- ETAPA 62/67: migrations/20260927193604_push_dispositivos_agenda.sql
-- ============================================================================

create table if not exists public.push_dispositivos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  endpoint text not null unique,
  chave_p256dh text not null,
  chave_auth text not null,
  nome_dispositivo text,
  user_agent text,
  ativo boolean not null default true,
  ultimo_uso_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(endpoint) between 16 and 4096),
  check (char_length(chave_p256dh) between 16 and 512),
  check (char_length(chave_auth) between 8 and 256)
);

create table if not exists public.push_fila (
  id uuid primary key default gen_random_uuid(),
  notificacao_id uuid not null unique references public.notificacoes(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'processando', 'concluido', 'parcial', 'falhou')),
  tentativas integer not null default 0 check (tentativas >= 0),
  processada_em timestamptz,
  ultimo_erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_entregas (
  id uuid primary key default gen_random_uuid(),
  notificacao_id uuid not null references public.notificacoes(id) on delete cascade,
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  dispositivo_id uuid not null references public.push_dispositivos(id) on delete cascade,
  status text not null default 'processando' check (status in ('processando', 'enviado', 'falhou', 'expirado')),
  tentativas integer not null default 1 check (tentativas > 0),
  codigo_http integer,
  ultimo_erro text,
  enviada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notificacao_id, dispositivo_id)
);

create index if not exists push_dispositivos_usuario_ativo_idx
  on public.push_dispositivos (usuario_id, ativo);
create index if not exists push_fila_status_created_idx
  on public.push_fila (status, created_at);
create index if not exists push_entregas_usuario_created_idx
  on public.push_entregas (usuario_id, created_at desc);

alter table public.push_dispositivos enable row level security;
alter table public.push_fila enable row level security;
alter table public.push_entregas enable row level security;

revoke all on public.push_dispositivos, public.push_fila, public.push_entregas from anon, authenticated;
grant select, insert, update, delete on public.push_dispositivos to authenticated;
grant select on public.push_entregas to authenticated;
grant all on public.push_dispositivos, public.push_fila, public.push_entregas to service_role;

drop policy if exists push_dispositivos_select_proprio on public.push_dispositivos;
create policy push_dispositivos_select_proprio on public.push_dispositivos
for select to authenticated
using ((select auth.uid()) = usuario_id);

drop policy if exists push_dispositivos_insert_proprio on public.push_dispositivos;
create policy push_dispositivos_insert_proprio on public.push_dispositivos
for insert to authenticated
with check ((select auth.uid()) = usuario_id);

drop policy if exists push_dispositivos_update_proprio on public.push_dispositivos;
create policy push_dispositivos_update_proprio on public.push_dispositivos
for update to authenticated
using ((select auth.uid()) = usuario_id)
with check ((select auth.uid()) = usuario_id);

drop policy if exists push_dispositivos_delete_proprio on public.push_dispositivos;
create policy push_dispositivos_delete_proprio on public.push_dispositivos
for delete to authenticated
using ((select auth.uid()) = usuario_id);

drop policy if exists push_entregas_select_propria on public.push_entregas;
create policy push_entregas_select_propria on public.push_entregas
for select to authenticated
using ((select auth.uid()) = usuario_id);

create or replace function private.enfileirar_push_notificacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo = 'agenda' then
    insert into public.push_fila (notificacao_id)
    values (new.id)
    on conflict (notificacao_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.enfileirar_push_notificacao() from public, anon, authenticated;

drop trigger if exists trg_enfileirar_push_notificacao on public.notificacoes;
create trigger trg_enfileirar_push_notificacao
after insert on public.notificacoes
for each row execute function private.enfileirar_push_notificacao();

drop trigger if exists set_push_dispositivos_updated_at on public.push_dispositivos;
create trigger set_push_dispositivos_updated_at
before update on public.push_dispositivos
for each row execute function public.set_updated_at();

drop trigger if exists set_push_fila_updated_at on public.push_fila;
create trigger set_push_fila_updated_at
before update on public.push_fila
for each row execute function public.set_updated_at();

drop trigger if exists set_push_entregas_updated_at on public.push_entregas;
create trigger set_push_entregas_updated_at
before update on public.push_entregas
for each row execute function public.set_updated_at();

-- ============================================================================
-- ETAPA 63/67: migrations/20260928_corrigir_recuperacao_ajuste_nota.sql
-- ============================================================================

-- OminiSaber | Correções de recuperação e ajuste de nota
-- Mantém as operações sob RLS e concede apenas o acesso necessário.

grant insert on public.avaliacoes_auditoria to authenticated;

drop policy if exists avaliacoes_auditoria_insert_docente
  on public.avaliacoes_auditoria;
create policy avaliacoes_auditoria_insert_docente
on public.avaliacoes_auditoria
for insert
to authenticated
with check (
  ator_id = (select auth.uid())
  and (
    (select public.usuario_role()) = 'gestor'
    or exists (
      select 1
      from public.avaliacoes_docentes avaliacao
      where avaliacao.id = avaliacao_id
        and avaliacao.professor_id = (select auth.uid())
    )
  )
);

create or replace function public.ajustar_nota_avaliacao(
  p_tentativa_id uuid,
  p_nota numeric,
  p_motivo text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tentativa public.tentativas_avaliacao;
  v_avaliacao public.avaliacoes_docentes;
  v_id uuid;
begin
  -- FOR SHARE exigia um privilégio de escrita que o professor não deve possuir.
  select tentativa.*
    into v_tentativa
  from public.tentativas_avaliacao tentativa
  where tentativa.id = p_tentativa_id;

  if not found then
    raise exception 'Tentativa nao encontrada.';
  end if;

  select avaliacao.*
    into v_avaliacao
  from public.avaliacoes_docentes avaliacao
  where avaliacao.id = v_tentativa.avaliacao_id;

  if not found then
    raise exception 'Avaliacao nao encontrada.';
  end if;
  if v_tentativa.status <> 'corrigida' then
    raise exception 'Finalize a correcao antes de ajustar a nota.';
  end if;
  if v_avaliacao.professor_id <> (select auth.uid())
     and (select public.usuario_role()) <> 'gestor' then
    raise exception 'Sem permissao para ajustar esta nota.';
  end if;
  if p_nota is null or p_nota < 0 or p_nota > v_avaliacao.valor then
    raise exception 'A nota deve estar entre 0 e %.', v_avaliacao.valor;
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 8 then
    raise exception 'Explique o motivo do ajuste com pelo menos 8 caracteres.';
  end if;

  insert into public.ajustes_notas_avaliacao (
    tentativa_id,
    avaliacao_id,
    aluno_id,
    ajustado_por,
    nota_anterior,
    nota_nova,
    motivo
  ) values (
    v_tentativa.id,
    v_avaliacao.id,
    v_tentativa.aluno_id,
    (select auth.uid()),
    v_tentativa.nota,
    round(p_nota, 2),
    btrim(p_motivo)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ajustar_nota_avaliacao(uuid, numeric, text)
  from public, anon;
grant execute on function public.ajustar_nota_avaliacao(uuid, numeric, text)
  to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- ETAPA 64/67: migrations/20261003_omnistudio_fluxo_integrado.sql
-- ============================================================================

-- OmniStudio: catálogo do aluno, versões retomáveis e percurso validado no servidor.
-- Incremental; executar depois de 20260926120000_oministudio_persistencia_rls.sql.

alter table public.studio_respostas drop constraint if exists studio_respostas_bloco_tipo_check;
alter table public.studio_respostas add constraint studio_respostas_bloco_tipo_check
  check (bloco_tipo in ('content','number','choice','text','decision','flourish',
    'image','formula','graph','table','chemistry','periodic','balance','molecule','ordering','matching'));
alter table public.studio_respostas add column if not exists confirmada boolean not null default false;
alter table public.studio_tentativas add column if not exists pontos_maximos numeric(10,2)
  check (pontos_maximos is null or pontos_maximos >= 0);
-- O rascunho pode mudar; publicação e identidade continuam exclusivas das RPCs.
revoke insert,update on public.studio_experiencias from authenticated;
grant insert (id,professor_id,materia_codigo,titulo,objetivo,turma_referencia,rascunho,tentativas_permitidas)
  on public.studio_experiencias to authenticated;
grant update (professor_id,materia_codigo,titulo,objetivo,turma_referencia,rascunho,tentativas_permitidas,updated_at)
  on public.studio_experiencias to authenticated;
drop policy if exists studio_experiencias_insert on public.studio_experiencias;
create policy studio_experiencias_insert on public.studio_experiencias for insert to authenticated with check (
  professor_id = (select auth.uid()) and (select public.usuario_role()) = 'professor'
  and exists(select 1 from public.professor_turma_materias ptm where ptm.professor_id = (select auth.uid())
    and ptm.materia_codigo = studio_experiencias.materia_codigo and ptm.ativo)
);
drop policy if exists studio_experiencias_update on public.studio_experiencias;
create policy studio_experiencias_update on public.studio_experiencias for update to authenticated
using(professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor')
with check((select public.usuario_role()) = 'gestor' or (professor_id = (select auth.uid())
  and (select public.usuario_role()) = 'professor' and exists(select 1 from public.professor_turma_materias ptm
    where ptm.professor_id = (select auth.uid()) and ptm.materia_codigo = studio_experiencias.materia_codigo and ptm.ativo)));
-- A correção deve recalcular a tentativa e registrar auditoria na mesma transação.
revoke update on public.studio_respostas from authenticated;
revoke update (pontos_manuais,feedback,status_correcao,corrigida_por,corrigida_em,updated_at)
  on public.studio_respostas from authenticated;
update public.studio_respostas r set correta = null,pontos_automaticos = 0,pontos_manuais = 0,
  feedback = null,status_correcao = 'registrada'
  from public.studio_tentativas t where t.id = r.tentativa_id and t.status = 'em_andamento';

create or replace function private.studio_itens(p_bloco jsonb)
returns text[] language sql immutable security invoker set search_path = '' as $$
  select coalesce(array_agg(btrim(linha) order by ordem), array[]::text[])
  from regexp_split_to_table(coalesce(p_bloco->>'items',''), E'\r?\n') with ordinality as linhas(linha,ordem)
  where btrim(linha) <> '';
$$;

create or replace function private.studio_indices_publicos(p_bloco jsonb, p_matching boolean default false)
returns integer[] language plpgsql immutable security invoker set search_path = '' as $$
declare v_indices integer[]; v_itens text[] := private.studio_itens(p_bloco);
begin
  if jsonb_typeof(p_bloco->case when p_matching then '_rightOrder' else '_order' end) = 'array' then
    select array_agg(value::integer order by ordem) into v_indices
    from jsonb_array_elements_text(p_bloco->case when p_matching then '_rightOrder' else '_order' end)
      with ordinality as indices(value,ordem);
  else
    -- Compatibilidade com versões antigas: uma ordem estável, sem publicar a ordem de referência.
    select array_agg(i-1 order by md5(v_itens[i])) into v_indices
    from generate_subscripts(v_itens,1) as indices(i);
  end if;
  return coalesce(v_indices,array[]::integer[]);
end;
$$;

create or replace function private.studio_snapshot_publico(p_snapshot jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = '' as $$
declare v_bloco jsonb; v_publico jsonb; v_blocos jsonb := '[]'::jsonb;
  v_itens text[]; v_indices integer[]; v_lista text[]; v_esquerda text[]; v_direita text[]; v_i integer;
begin
  for v_bloco in select value from jsonb_array_elements(coalesce(p_snapshot->'blocks','[]'::jsonb)) loop
    v_publico := v_bloco - array['correct','min','max','rubric','feedback','solution','answer','acceptedAnswers','_order','_rightOrder'];
    if v_bloco->>'type' in ('ordering','matching') then
      v_itens := private.studio_itens(v_bloco);
      v_indices := private.studio_indices_publicos(v_bloco,v_bloco->>'type' = 'matching');
      v_lista := array[]::text[]; v_esquerda := array[]::text[]; v_direita := array[]::text[];
      foreach v_i in array v_indices loop
        v_lista := array_append(v_lista,v_itens[v_i+1]);
        v_direita := array_append(v_direita,btrim(split_part(v_itens[v_i+1],'|',2)));
      end loop;
      if v_bloco->>'type' = 'ordering' then
        v_publico := v_publico || jsonb_build_object('items',array_to_string(v_lista,E'\n'));
      else
        foreach v_i in array array(select generate_subscripts(v_itens,1)) loop
          v_esquerda := array_append(v_esquerda,btrim(split_part(v_itens[v_i],'|',1)));
        end loop;
        v_publico := v_publico || jsonb_build_object('items',array_to_string(v_esquerda,E'\n'),
          'leftItems',to_jsonb(v_esquerda),'rightItems',to_jsonb(v_direita));
      end if;
    end if;
    v_blocos := v_blocos || jsonb_build_array(v_publico);
  end loop;
  return jsonb_set(p_snapshot,'{blocks}',v_blocos,true);
end;
$$;

create or replace function private.studio_validar_trabalho(p_work jsonb)
returns void language plpgsql immutable security invoker set search_path = '' as $$
declare v_bloco jsonb; v_aresta jsonb; v_ids text[]; v_itens text[]; v_tipo text;
  v_limite integer; v_ciclo boolean; v_alcancados integer; v_sem_origem boolean;
begin
  if jsonb_typeof(p_work) is distinct from 'object'
    or jsonb_typeof(p_work->'blocks') is distinct from 'array'
    or jsonb_typeof(p_work->'edges') is distinct from 'array' then
    raise exception 'O trabalho precisa de blocos, conexoes e etapa inicial.';
  end if;
  v_limite := jsonb_array_length(p_work->'blocks');
  if v_limite < 1 or v_limite > 100 or jsonb_array_length(p_work->'edges') > 200 then
    raise exception 'Use entre 1 e 100 etapas e no maximo 200 conexoes.';
  end if;
  if char_length(btrim(coalesce(p_work->>'title',''))) not between 1 and 150 then
    raise exception 'De um titulo de ate 150 caracteres ao trabalho.';
  end if;
  select array_agg(value->>'id') into v_ids from jsonb_array_elements(p_work->'blocks');
  if array_position(v_ids,null) is not null or array_position(v_ids,'') is not null
    or (select count(distinct id) from unnest(v_ids) as blocos(id)) <> v_limite
    or not coalesce((p_work->>'start') = any(v_ids),false) then
    raise exception 'Identificadores e etapa inicial precisam ser unicos e validos.';
  end if;
  for v_bloco in select value from jsonb_array_elements(p_work->'blocks') loop
    v_tipo := v_bloco->>'type';
    if v_tipo is null or v_tipo not in ('content','number','choice','text','decision','flourish','image',
      'formula','graph','table','chemistry','periodic','balance','molecule','ordering','matching') then
      raise exception 'Tipo de etapa nao reconhecido.';
    end if;
    if char_length(v_bloco->>'id') > 120 or char_length(btrim(coalesce(v_bloco->>'title',''))) not between 1 and 150
      or char_length(coalesce(v_bloco->>'instructions','')) > 2500
      or (v_tipo <> 'decision' and btrim(coalesce(v_bloco->>'instructions','')) = '') then
      raise exception 'Cada etapa precisa de titulo e orientacoes validas.';
    end if;
    if jsonb_typeof(v_bloco->'points') is distinct from 'number'
      or (v_bloco->>'points')::numeric not between 0 and 1000 then
      raise exception 'Pontuacao invalida em uma etapa.';
    end if;
    if v_tipo not in ('number','choice','text','balance','ordering','matching') and (v_bloco->>'points')::numeric <> 0 then
      raise exception 'Etapas de exploracao e condicoes nao recebem pontos.';
    end if;
    if v_tipo in ('number','decision') and (jsonb_typeof(v_bloco->'min') is distinct from 'number'
      or jsonb_typeof(v_bloco->'max') is distinct from 'number'
      or (v_bloco->>'min')::numeric > (v_bloco->>'max')::numeric) then
      raise exception 'Revise o intervalo numerico.';
    end if;
    if v_tipo = 'choice' then
      if jsonb_typeof(v_bloco->'options') is distinct from 'array'
        or jsonb_array_length(v_bloco->'options') not between 2 and 12
        or coalesce(v_bloco->>'correct','') !~ '^[0-9]+$'
        or (v_bloco->>'correct')::integer >= jsonb_array_length(v_bloco->'options')
        or exists (select 1 from jsonb_array_elements(v_bloco->'options') as op(value)
          where jsonb_typeof(value) <> 'string' or btrim(value #>> '{}') = '') then
        raise exception 'Revise alternativas e gabarito.';
      end if;
    end if;
    if v_tipo in ('text','balance') and btrim(coalesce(v_bloco->>'rubric','')) = '' then
      raise exception 'Defina criterios para as respostas abertas.';
    end if;
    if v_tipo in ('ordering','matching') then
      v_itens := private.studio_itens(v_bloco);
      if cardinality(v_itens) not between 2 and 20
        or (select count(distinct item) from unnest(v_itens) as itens(item)) <> cardinality(v_itens) then
        raise exception 'Use de 2 a 20 itens diferentes na interacao.';
      end if;
      if v_tipo = 'matching' and exists (select 1 from unnest(v_itens) as itens(item)
        where item !~ '^[^|]+[|][^|]+$' or btrim(split_part(item,'|',1)) = '' or btrim(split_part(item,'|',2)) = '') then
        raise exception 'Cada associacao precisa de Termo | Correspondente.';
      end if;
      if v_tipo = 'matching' and (select count(distinct btrim(split_part(item,'|',2)))
        from unnest(v_itens) as itens(item)) <> cardinality(v_itens) then
        raise exception 'Use correspondentes diferentes em cada associacao.';
      end if;
    end if;
    if v_tipo in ('formula','graph','chemistry','balance') and btrim(coalesce(v_bloco->>'expression','')) = '' then
      raise exception 'Preencha a expressao de referencia.';
    end if;
    if v_tipo = 'table' and (btrim(coalesce(v_bloco->>'columns','')) = '' or btrim(coalesce(v_bloco->>'rows','')) = '') then
      raise exception 'Preencha as colunas e os dados da tabela.';
    end if;
    if v_tipo = 'flourish' and (coalesce(v_bloco->>'url','') !~ '^https://(public[.]flourish[.]studio|flo[.]uri[.]sh)/(visualisation|story)/[0-9]+/?(embed/?)?$'
      or btrim(coalesce(v_bloco->>'summary','')) = '') then
      raise exception 'Use um endereco publico Flourish e um resumo acessivel.';
    end if;
    if v_tipo = 'image' and (coalesce(v_bloco->>'url','') !~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$'
      or btrim(coalesce(v_bloco->>'alt','')) = '') then
      raise exception 'Use uma imagem HTTPS e uma descricao acessivel.';
    end if;
    if coalesce(v_bloco#>>'{advanceRule,required}','false') = 'true'
      and btrim(coalesce(v_bloco#>>'{advanceRule,prompt}','')) = '' then
      raise exception 'Escreva a orientacao da confirmacao obrigatoria.';
    end if;
    if v_tipo = 'decision' then
      if not exists (select 1 from jsonb_array_elements(p_work->'blocks') as b(value)
        where value->>'id' = v_bloco->>'source' and value->>'type' = 'number') then
        raise exception 'A condicao precisa de uma resposta numerica de origem.';
      end if;
      if (select count(*) from jsonb_array_elements(p_work->'edges') as e(value)
        where value->>'source' = v_bloco->>'id' and value->>'sourceHandle' = 'yes') <> 1
        or (select count(*) from jsonb_array_elements(p_work->'edges') as e(value)
        where value->>'source' = v_bloco->>'id' and value->>'sourceHandle' = 'no') <> 1 then
        raise exception 'Conecte um caminho Sim e um caminho Nao em cada condicao.';
      end if;
      -- A origem deve ser anterior em todos os percursos que chegam a esta decisão.
      with recursive caminho(id) as (
        select p_work->>'start' where p_work->>'start' <> v_bloco->>'source'
        union select e.value->>'target'
        from caminho c cross join jsonb_array_elements(p_work->'edges') as e(value)
        where e.value->>'source' = c.id and e.value->>'target' <> v_bloco->>'source'
      ) select exists(select 1 from caminho where id = v_bloco->>'id') into v_sem_origem;
      if v_sem_origem then raise exception 'A origem numerica deve anteceder a condicao em todos os caminhos.'; end if;
    elsif (select count(*) from jsonb_array_elements(p_work->'edges') as e(value)
      where value->>'source' = v_bloco->>'id') > 1 then
      raise exception 'Use uma condicao para dividir o percurso.';
    end if;
  end loop;
  for v_aresta in select value from jsonb_array_elements(p_work->'edges') loop
    if not coalesce((v_aresta->>'source') = any(v_ids),false)
      or not coalesce((v_aresta->>'target') = any(v_ids),false) then
      raise exception 'Uma conexao aponta para etapa inexistente.';
    end if;
  end loop;
  -- UNION elimina caminhos repetidos em bifurcações que se reencontram.
  with recursive conexoes(origem,destino) as (
    select value->>'source',value->>'target' from jsonb_array_elements(p_work->'edges')
  ), alcance(origem,destino) as (
    select origem,destino from conexoes union
    select a.origem,c.destino from alcance a join conexoes c on c.origem = a.destino
  ), inicio(id) as (
    select p_work->>'start' union select c.destino from inicio i join conexoes c on c.origem = i.id
  ) select exists(select 1 from alcance where origem = destino),(select count(*) from inicio)
    into v_ciclo,v_alcancados;
  if v_ciclo then raise exception 'O percurso precisa terminar; remova as conexoes circulares.'; end if;
  if v_alcancados <> v_limite then raise exception 'Todas as etapas precisam estar ligadas ao inicio.'; end if;
end;
$$;

create or replace function private.publicar_experiencia_studio(p_experiencia_id uuid,p_turma_ids uuid[],
  p_abre_em timestamptz default null,p_encerra_em timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_usuario uuid := (select auth.uid()); v_papel public.perfil_role := (select public.usuario_role());
  v_exp public.studio_experiencias%rowtype; v_turma uuid; v_versao integer; v_snapshot jsonb;
  v_blocos jsonb := '[]'::jsonb; v_bloco jsonb; v_indices jsonb; v_turmas uuid[];
begin
  if v_usuario is null or v_papel not in ('professor','gestor') then
    raise exception 'Somente professores e gestores podem publicar experiencias.';
  end if;
  select array_agg(distinct id) into v_turmas from unnest(p_turma_ids) as turmas(id) where id is not null;
  if coalesce(cardinality(v_turmas),0) = 0 then raise exception 'Selecione pelo menos uma turma.'; end if;
  if p_encerra_em is not null and (p_encerra_em <= coalesce(p_abre_em,now()) or p_encerra_em <= now()) then
    raise exception 'O encerramento precisa ser posterior a abertura e ao momento atual.';
  end if;
  select * into v_exp from public.studio_experiencias
    where id = p_experiencia_id and (professor_id = v_usuario or v_papel = 'gestor') for update;
  if not found then raise exception 'Experiencia nao encontrada ou sem permissao.'; end if;
  if v_exp.status = 'arquivado' then raise exception 'Experiencia arquivada nao pode ser publicada.'; end if;
  perform private.studio_validar_trabalho(v_exp.rascunho);
  foreach v_turma in array v_turmas loop
    if v_papel <> 'gestor' and not exists(select 1 from public.professor_turma_materias ptm
      where ptm.professor_id = v_usuario and ptm.turma_id = v_turma
        and ptm.materia_codigo = v_exp.materia_codigo and ptm.ativo) then
      raise exception 'Professor sem vinculo ativo com uma das turmas selecionadas.';
    end if;
  end loop;
  for v_bloco in select value from jsonb_array_elements(v_exp.rascunho->'blocks') loop
    if v_bloco->>'type' in ('ordering','matching') then
      select jsonb_agg(i-1 order by random()) into v_indices
      from generate_subscripts(private.studio_itens(v_bloco),1) as itens(i);
      v_bloco := v_bloco - array['_order','_rightOrder'] || jsonb_build_object(
        case when v_bloco->>'type' = 'matching' then '_rightOrder' else '_order' end,v_indices);
    end if;
    v_blocos := v_blocos || jsonb_build_array(v_bloco);
  end loop;
  v_snapshot := jsonb_set(v_exp.rascunho,'{blocks}',v_blocos,true);
  v_versao := v_exp.versao_atual + 1;
  insert into public.studio_experiencia_versoes(experiencia_id,versao,snapshot,publicado_por)
    values(v_exp.id,v_versao,v_snapshot,v_usuario);
  foreach v_turma in array v_turmas loop
    insert into public.studio_experiencia_turmas(experiencia_id,versao,turma_id,abre_em,encerra_em)
      values(v_exp.id,v_versao,v_turma,p_abre_em,p_encerra_em);
  end loop;
  update public.studio_experiencias set status = 'publicado',versao_atual = v_versao where id = v_exp.id;
  insert into public.studio_auditoria(experiencia_id,ator_id,evento,detalhes)
    values(v_exp.id,v_usuario,'experiencia_publicada',jsonb_build_object('versao',v_versao,'turmas',to_jsonb(v_turmas)));
  return jsonb_build_object('experiencia_id',v_exp.id,'versao',v_versao);
end;
$$;

create or replace function private.studio_verificar_acesso_tentativa(p_tentativa public.studio_tentativas,p_edicao boolean)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or (select public.usuario_role()) <> 'aluno'
    or p_tentativa.aluno_id <> (select auth.uid()) or p_tentativa.turma_id <> (select public.usuario_turma_id()) then
    raise exception 'Tentativa indisponivel para este aluno.';
  end if;
  if p_edicao and (p_tentativa.status <> 'em_andamento' or not exists (
    select 1 from public.studio_experiencia_turmas et join public.studio_experiencias e on e.id = et.experiencia_id
    where et.experiencia_id = p_tentativa.experiencia_id and et.versao = p_tentativa.versao
      and et.turma_id = p_tentativa.turma_id and et.ativo and e.status = 'publicado'
      and (et.abre_em is null or et.abre_em <= now()) and (et.encerra_em is null or et.encerra_em >= now())
  )) then raise exception 'O periodo desta tentativa encerrou ou ela ja foi enviada.'; end if;
end;
$$;

create or replace function private.obter_experiencia_tentativa_studio(p_tentativa_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_t public.studio_tentativas%rowtype; v_exp public.studio_experiencias%rowtype;
  v_snapshot jsonb; v_turma public.studio_experiencia_turmas%rowtype; v_respostas jsonb;
begin
  select * into v_t from public.studio_tentativas where id = p_tentativa_id;
  if not found then raise exception 'Tentativa nao encontrada.'; end if;
  perform private.studio_verificar_acesso_tentativa(v_t,false);
  select * into v_exp from public.studio_experiencias where id = v_t.experiencia_id;
  select snapshot into v_snapshot from public.studio_experiencia_versoes where experiencia_id = v_t.experiencia_id and versao = v_t.versao;
  select * into v_turma from public.studio_experiencia_turmas
    where experiencia_id = v_t.experiencia_id and versao = v_t.versao and turma_id = v_t.turma_id;
  select coalesce(jsonb_agg(case when v_t.status = 'em_andamento' then
    to_jsonb(r) - array['correta','pontos_automaticos','pontos_manuais','feedback','status_correcao','corrigida_por','corrigida_em']
    else to_jsonb(r) end order by r.respondida_em),'[]'::jsonb) into v_respostas
    from public.studio_respostas r where r.tentativa_id = v_t.id;
  return jsonb_build_object('experiencia_id',v_t.experiencia_id,'versao',v_t.versao,
    'materia_codigo',v_exp.materia_codigo,'tentativas_permitidas',v_exp.tentativas_permitidas,
    'abre_em',v_turma.abre_em,'encerra_em',v_turma.encerra_em,
    'pontos_maximos',v_t.pontos_maximos,
    'work',private.studio_snapshot_publico(v_snapshot),
    'tentativa',to_jsonb(v_t) || jsonb_build_object('studio_respostas',v_respostas));
end;
$$;

create or replace function private.obter_experiencia_publicada_studio(p_experiencia_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_aluno uuid := (select auth.uid()); v_turma uuid := (select public.usuario_turma_id());
  v_et public.studio_experiencia_turmas%rowtype; v_exp public.studio_experiencias%rowtype; v_snapshot jsonb; v_tentativa uuid;
begin
  if v_aluno is null or (select public.usuario_role()) <> 'aluno' or v_turma is null then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;
  select t.id into v_tentativa from public.studio_tentativas t
    join public.studio_experiencia_turmas et on et.experiencia_id = t.experiencia_id and et.versao = t.versao and et.turma_id = t.turma_id
    join public.studio_experiencias e on e.id = t.experiencia_id
    where t.experiencia_id = p_experiencia_id and t.aluno_id = v_aluno and t.turma_id = v_turma and t.status = 'em_andamento'
      and et.ativo and e.status = 'publicado' and (et.abre_em is null or et.abre_em <= now())
      and (et.encerra_em is null or et.encerra_em >= now())
    order by t.iniciada_em desc limit 1;
  if found then return private.obter_experiencia_tentativa_studio(v_tentativa); end if;
  select et.* into v_et from public.studio_experiencia_turmas et join public.studio_experiencias e on e.id = et.experiencia_id
    where et.experiencia_id = p_experiencia_id and et.turma_id = v_turma and et.ativo and e.status = 'publicado'
      and (et.abre_em is null or et.abre_em <= now()) and (et.encerra_em is null or et.encerra_em >= now())
    order by et.versao desc limit 1;
  if not found then raise exception 'Experiencia indisponivel para este aluno.'; end if;
  select * into v_exp from public.studio_experiencias where id = p_experiencia_id;
  select snapshot into v_snapshot from public.studio_experiencia_versoes where experiencia_id = p_experiencia_id and versao = v_et.versao;
  return jsonb_build_object('experiencia_id',p_experiencia_id,'versao',v_et.versao,'materia_codigo',v_exp.materia_codigo,
    'tentativas_permitidas',v_exp.tentativas_permitidas,'abre_em',v_et.abre_em,'encerra_em',v_et.encerra_em,
    'work',private.studio_snapshot_publico(v_snapshot));
end;
$$;

create or replace function private.listar_experiencias_aluno_studio()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_aluno uuid := (select auth.uid()); v_turma uuid := (select public.usuario_turma_id()); v_resultado jsonb;
begin
  if v_aluno is null or (select public.usuario_role()) <> 'aluno' or v_turma is null then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;
  select coalesce(jsonb_agg(item order by atualizado desc),'[]'::jsonb) into v_resultado from (
    select e.updated_at as atualizado,jsonb_build_object('experiencia_id',e.id,'id',e.id,
      'titulo',coalesce(ev.snapshot->>'title',e.titulo),'objetivo',coalesce(ev.snapshot->>'objective',e.objetivo),
      'materia_codigo',e.materia_codigo,'professor_nome',p.nome,'versao',et.versao,
      'abre_em',et.abre_em,'encerra_em',et.encerra_em,'tentativas_permitidas',e.tentativas_permitidas,
      'total_etapas',jsonb_array_length(ev.snapshot->'blocks'),
      'pontos_maximos',(select coalesce(sum((b.value->>'points')::numeric),0) from jsonb_array_elements(ev.snapshot->'blocks') b(value)),
      'ultima_tentativa',case when t.id is null then null else to_jsonb(t) end,
      'respostas_salvas',(select count(*) from public.studio_respostas r where r.tentativa_id = t.id)) as item
    from public.studio_experiencias e join public.perfis p on p.id = e.professor_id
    left join lateral (
      select tent.* from public.studio_tentativas tent where tent.experiencia_id = e.id and tent.aluno_id = v_aluno
        and tent.turma_id = v_turma order by (tent.status = 'em_andamento') desc,tent.iniciada_em desc limit 1
    ) historico on true
    join lateral (
      select pub.* from public.studio_experiencia_turmas pub where pub.experiencia_id = e.id and pub.turma_id = v_turma
        and ((e.status = 'publicado' and pub.ativo) or pub.versao = historico.versao)
      order by case when historico.status = 'em_andamento' and pub.versao = historico.versao and pub.ativo
        and e.status = 'publicado' and (pub.abre_em is null or pub.abre_em <= now())
        and (pub.encerra_em is null or pub.encerra_em >= now()) then 0
        when e.status = 'publicado' and pub.ativo then 1 else 2 end,pub.versao desc limit 1
    ) et on true
    left join lateral (
      select tent.* from public.studio_tentativas tent where tent.experiencia_id = e.id and tent.aluno_id = v_aluno
        and tent.turma_id = v_turma and tent.versao = et.versao order by tent.iniciada_em desc limit 1
    ) t on true
    join public.studio_experiencia_versoes ev on ev.experiencia_id = e.id and ev.versao = et.versao
  ) catalogo;
  return v_resultado;
end;
$$;

create or replace function private.iniciar_tentativa_studio(p_experiencia_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_aluno uuid := (select auth.uid()); v_turma uuid := (select public.usuario_turma_id());
  v_versao integer; v_limite integer; v_numero integer; v_t public.studio_tentativas%rowtype;
begin
  if v_aluno is null or (select public.usuario_role()) <> 'aluno' or v_turma is null then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;
  -- Uma trava por aluno/experiência serializa cliques repetidos e múltiplas abas.
  perform pg_advisory_xact_lock(hashtextextended(v_aluno::text || ':' || p_experiencia_id::text,0));
  select t.* into v_t from public.studio_tentativas t
    join public.studio_experiencia_turmas et on et.experiencia_id = t.experiencia_id and et.versao = t.versao and et.turma_id = t.turma_id
    join public.studio_experiencias e on e.id = t.experiencia_id
    where t.experiencia_id = p_experiencia_id and t.aluno_id = v_aluno and t.turma_id = v_turma and t.status = 'em_andamento'
      and et.ativo and e.status = 'publicado' and (et.abre_em is null or et.abre_em <= now())
      and (et.encerra_em is null or et.encerra_em >= now())
    order by t.iniciada_em desc limit 1;
  if found then
    perform private.studio_verificar_acesso_tentativa(v_t,true);
    return jsonb_build_object('tentativa_id',v_t.id,'versao',v_t.versao,'numero',v_t.numero_tentativa,'retomada',true);
  end if;
  select et.versao,e.tentativas_permitidas into v_versao,v_limite
    from public.studio_experiencia_turmas et join public.studio_experiencias e on e.id = et.experiencia_id
    where et.experiencia_id = p_experiencia_id and et.turma_id = v_turma and et.ativo and e.status = 'publicado'
      and (et.abre_em is null or et.abre_em <= now()) and (et.encerra_em is null or et.encerra_em >= now())
    order by et.versao desc limit 1;
  if not found then raise exception 'Experiencia indisponivel para este aluno.'; end if;
  if exists(select 1 from public.studio_tentativas where experiencia_id = p_experiencia_id
    and aluno_id = v_aluno and versao = v_versao and requer_revisao) then
    raise exception 'Aguarde a devolutiva do professor antes de tentar novamente.';
  end if;
  select coalesce(max(numero_tentativa),0)+1 into v_numero from public.studio_tentativas
    where experiencia_id = p_experiencia_id and versao = v_versao and aluno_id = v_aluno;
  if v_numero > v_limite then raise exception 'Limite de tentativas atingido.'; end if;
  insert into public.studio_tentativas(experiencia_id,versao,aluno_id,turma_id,numero_tentativa)
    values(p_experiencia_id,v_versao,v_aluno,v_turma,v_numero) returning * into v_t;
  insert into public.studio_auditoria(experiencia_id,tentativa_id,ator_id,evento,detalhes)
    values(p_experiencia_id,v_t.id,v_aluno,'tentativa_iniciada',jsonb_build_object('versao',v_versao,'numero',v_numero));
  return jsonb_build_object('tentativa_id',v_t.id,'versao',v_versao,'numero',v_numero,'retomada',false);
end;
$$;

create or replace function private.studio_resposta_completa(p_bloco jsonb,p_resposta jsonb,p_confirmada boolean)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare v_tipo text := p_bloco->>'type'; v_itens text[]; v_n integer; v_distintos integer; v_i integer; v_valor text;
begin
  if coalesce(p_bloco#>>'{advanceRule,required}','false') = 'true' and not p_confirmada then return false; end if;
  if v_tipo = 'decision' then return true; end if;
  if p_resposta is null or p_resposta = 'null'::jsonb then return false; end if;
  if v_tipo = 'number' then return jsonb_typeof(p_resposta) in ('number','string')
    and char_length(p_resposta #>> '{}') <= 100 and btrim(p_resposta #>> '{}') ~ '^-?[0-9]+([.,][0-9]+)?$'; end if;
  if v_tipo = 'choice' then
    v_valor := p_resposta #>> '{}';
    if jsonb_typeof(p_resposta) not in ('number','string') or v_valor !~ '^[0-9]{1,3}$' then return false; end if;
    return v_valor::integer < jsonb_array_length(p_bloco->'options');
  end if;
  if v_tipo in ('text','balance') then return jsonb_typeof(p_resposta) = 'string'
    and char_length(btrim(p_resposta #>> '{}')) between 1 and 20000; end if;
  if v_tipo in ('ordering','matching') then
    v_itens := private.studio_itens(p_bloco); v_n := cardinality(v_itens);
    if v_tipo = 'ordering' then
      if jsonb_typeof(p_resposta->'order') is distinct from 'array' or jsonb_array_length(p_resposta->'order') <> v_n then return false; end if;
      if exists(select 1 from jsonb_array_elements_text(p_resposta->'order') val(value)
        where value !~ '^[0-9]{1,3}$') then return false; end if;
      select count(distinct value::integer) into v_distintos from jsonb_array_elements_text(p_resposta->'order') val(value)
        where value::integer between 0 and v_n-1;
    else
      if jsonb_typeof(p_resposta->'matches') is distinct from 'object' then return false; end if;
      for v_i in 0..v_n-1 loop
        v_valor := p_resposta->'matches'->>v_i::text;
        if v_valor is null or v_valor !~ '^[0-9]{1,3}$' or v_valor::integer not between 0 and v_n-1 then return false; end if;
      end loop;
      select count(distinct value::integer) into v_distintos from jsonb_each_text(p_resposta->'matches') val(key,value)
        where key ~ '^[0-9]{1,3}$' and value ~ '^[0-9]{1,3}$';
      if (select count(*) from jsonb_each(p_resposta->'matches')) <> v_n then return false; end if;
    end if;
    return v_distintos = v_n;
  end if;
  return jsonb_typeof(p_resposta) = 'object' and p_resposta->'viewed' = 'true'::jsonb;
end;
$$;

create or replace function private.studio_proxima_etapa(p_snapshot jsonb,p_atual text,p_tentativa_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_bloco jsonb; v_resposta jsonb; v_passou boolean := false; v_alvo text; v_texto text;
begin
  select value into v_bloco from jsonb_array_elements(p_snapshot->'blocks') where value->>'id' = p_atual;
  if v_bloco is null then raise exception 'Etapa nao encontrada.'; end if;
  if v_bloco->>'type' = 'decision' then
    select resposta into v_resposta from public.studio_respostas
      where tentativa_id = p_tentativa_id and bloco_id = v_bloco->>'source';
    v_texto := v_resposta #>> '{}';
    if v_texto is null or v_texto !~ '^-?[0-9]+([.,][0-9]+)?$' then
      raise exception 'Registre a resposta numerica antes da condicao.';
    end if;
    v_passou := replace(v_texto,',','.')::numeric between (v_bloco->>'min')::numeric and (v_bloco->>'max')::numeric;
  end if;
  select value->>'target' into v_alvo from jsonb_array_elements(p_snapshot->'edges')
    where value->>'source' = p_atual and (v_bloco->>'type' <> 'decision'
      or value->>'sourceHandle' = case when v_passou then 'yes' else 'no' end) limit 1;
  return v_alvo;
end;
$$;

create or replace function private.studio_percurso_tentativa(p_snapshot jsonb,p_tentativa_id uuid)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare v_atual text := p_snapshot->>'start'; v_percurso text[] := array[]::text[]; v_bloco jsonb; v_origem text;
begin
  while v_atual is not null loop
    if v_atual = any(v_percurso) or cardinality(v_percurso) >= 100 then raise exception 'Percurso circular ou muito extenso.'; end if;
    v_percurso := array_append(v_percurso,v_atual);
    select value into v_bloco from jsonb_array_elements(p_snapshot->'blocks') where value->>'id' = v_atual;
    if v_bloco is null then raise exception 'Etapa nao encontrada.'; end if;
    -- Permite salvar antes de chegar a uma condição ainda sem resposta de origem.
    if v_bloco->>'type' = 'decision' then
      select resposta #>> '{}' into v_origem from public.studio_respostas
        where tentativa_id = p_tentativa_id and bloco_id = v_bloco->>'source';
      if v_origem is null or v_origem !~ '^-?[0-9]+([.,][0-9]+)?$' then exit; end if;
    end if;
    v_atual := private.studio_proxima_etapa(p_snapshot,v_atual,p_tentativa_id);
  end loop;
  return v_percurso;
end;
$$;

create or replace function private.salvar_resposta_studio(p_tentativa_id uuid,p_bloco_id text,p_resposta jsonb,p_confirmada boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_t public.studio_tentativas%rowtype; v_snapshot jsonb; v_bloco jsonb; v_percurso text[];
begin
  select * into v_t from public.studio_tentativas where id = p_tentativa_id for update;
  if not found then raise exception 'Tentativa nao encontrada.'; end if;
  perform private.studio_verificar_acesso_tentativa(v_t,true);
  if pg_column_size(p_resposta) > 65536 then raise exception 'A resposta excede o limite permitido.'; end if;
  select snapshot into v_snapshot from public.studio_experiencia_versoes where experiencia_id = v_t.experiencia_id and versao = v_t.versao;
  v_percurso := private.studio_percurso_tentativa(v_snapshot,v_t.id);
  if not p_bloco_id = any(v_percurso) then raise exception 'Esta etapa nao pertence ao seu percurso atual.'; end if;
  select value into v_bloco from jsonb_array_elements(v_snapshot->'blocks') where value->>'id' = p_bloco_id;
  if v_bloco is null or v_bloco->>'type' = 'decision' then raise exception 'Esta etapa nao recebe resposta.'; end if;
  -- Digitação intermediária e respostas limpas são rascunhos válidos para autosalvar.
  -- A completude e a confirmação são cobradas somente ao avançar e ao enviar.
  if p_resposta is not null and p_resposta <> 'null'::jsonb then
    if (v_bloco->>'type' in ('number','choice') and jsonb_typeof(p_resposta) not in ('number','string'))
      or (v_bloco->>'type' in ('text','balance') and (jsonb_typeof(p_resposta) <> 'string' or char_length(p_resposta #>> '{}') > 20000))
      or (v_bloco->>'type' = 'ordering' and (jsonb_typeof(p_resposta) <> 'object' or jsonb_typeof(p_resposta->'order') is distinct from 'array'))
      or (v_bloco->>'type' = 'matching' and (jsonb_typeof(p_resposta) <> 'object' or jsonb_typeof(p_resposta->'matches') is distinct from 'object'))
      or (v_bloco->>'type' not in ('number','choice','text','balance','ordering','matching') and jsonb_typeof(p_resposta) <> 'object') then
      raise exception 'Formato de resposta invalido para esta etapa.';
    end if;
  end if;
  insert into public.studio_respostas(tentativa_id,bloco_id,bloco_tipo,resposta,confirmada,status_correcao,correta,pontos_automaticos)
    values(v_t.id,p_bloco_id,v_bloco->>'type',coalesce(p_resposta,'null'::jsonb),coalesce(p_confirmada,false),'registrada',null,0)
    on conflict(tentativa_id,bloco_id) do update set resposta = excluded.resposta,confirmada = excluded.confirmada,
      status_correcao = 'registrada',correta = null,pontos_automaticos = 0,pontos_manuais = 0,feedback = null,
      corrigida_por = null,corrigida_em = null,respondida_em = now();
  -- Uma alteração anterior pode desviar o percurso; evidências fora dele deixam de valer.
  v_percurso := private.studio_percurso_tentativa(v_snapshot,v_t.id);
  delete from public.studio_respostas where tentativa_id = v_t.id and not bloco_id = any(v_percurso);
  return jsonb_build_object('status','salva','bloco_id',p_bloco_id,'confirmada',coalesce(p_confirmada,false));
end;
$$;

create or replace function private.salvar_resposta_studio(p_tentativa_id uuid,p_bloco_id text,p_resposta jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select private.salvar_resposta_studio(p_tentativa_id,p_bloco_id,p_resposta,false);
$$;

create or replace function private.resolver_proximo_bloco_studio(p_tentativa_id uuid,p_bloco_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_t public.studio_tentativas%rowtype; v_snapshot jsonb; v_bloco jsonb; v_r public.studio_respostas%rowtype;
begin
  select * into v_t from public.studio_tentativas where id = p_tentativa_id for update;
  if not found then raise exception 'Tentativa nao encontrada.'; end if;
  perform private.studio_verificar_acesso_tentativa(v_t,true);
  select snapshot into v_snapshot from public.studio_experiencia_versoes where experiencia_id = v_t.experiencia_id and versao = v_t.versao;
  if not p_bloco_id = any(private.studio_percurso_tentativa(v_snapshot,v_t.id)) then raise exception 'Etapa fora do percurso.'; end if;
  select value into v_bloco from jsonb_array_elements(v_snapshot->'blocks') where value->>'id' = p_bloco_id;
  if v_bloco->>'type' <> 'decision' then
    select * into v_r from public.studio_respostas where tentativa_id = v_t.id and bloco_id = p_bloco_id;
    if not found or not private.studio_resposta_completa(v_bloco,v_r.resposta,v_r.confirmada) then
      raise exception 'Conclua a etapa e a confirmacao obrigatoria antes de avancar.';
    end if;
  end if;
  return jsonb_build_object('nextBlockId',private.studio_proxima_etapa(v_snapshot,p_bloco_id,v_t.id));
end;
$$;

create or replace function private.enviar_tentativa_studio(p_tentativa_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_t public.studio_tentativas%rowtype; v_snapshot jsonb; v_percurso text[]; v_id text; v_bloco jsonb;
  v_r public.studio_respostas%rowtype; v_indices integer[]; v_i integer; v_ok boolean; v_max numeric;
  v_auto numeric := 0; v_revisao boolean := false; v_total numeric := 0;
begin
  select * into v_t from public.studio_tentativas where id = p_tentativa_id for update;
  if not found then raise exception 'Tentativa nao encontrada.'; end if;
  perform private.studio_verificar_acesso_tentativa(v_t,v_t.status = 'em_andamento');
  if v_t.status <> 'em_andamento' then return jsonb_build_object('status',v_t.status,
    'pontuacao_automatica',v_t.pontuacao_automatica,'pontos_maximos',v_t.pontos_maximos,'requer_revisao',v_t.requer_revisao); end if;
  select snapshot into v_snapshot from public.studio_experiencia_versoes where experiencia_id = v_t.experiencia_id and versao = v_t.versao;
  v_percurso := private.studio_percurso_tentativa(v_snapshot,v_t.id);
  foreach v_id in array v_percurso loop
    select value into v_bloco from jsonb_array_elements(v_snapshot->'blocks') where value->>'id' = v_id;
    if v_bloco->>'type' = 'decision' then
      perform private.studio_proxima_etapa(v_snapshot,v_id,v_t.id);
      continue;
    end if;
    select * into v_r from public.studio_respostas where tentativa_id = v_t.id and bloco_id = v_id;
    if not found or not private.studio_resposta_completa(v_bloco,v_r.resposta,v_r.confirmada) then
      raise exception 'Conclua todas as etapas do seu percurso antes de enviar.';
    end if;
    v_max := (v_bloco->>'points')::numeric; v_total := v_total + v_max; v_ok := null;
    if v_bloco->>'type' = 'number' then
      v_ok := replace(v_r.resposta #>> '{}',',','.')::numeric between (v_bloco->>'min')::numeric and (v_bloco->>'max')::numeric;
    elsif v_bloco->>'type' = 'choice' then v_ok := (v_r.resposta #>> '{}')::integer = (v_bloco->>'correct')::integer;
    elsif v_bloco->>'type' in ('ordering','matching') then
      v_indices := private.studio_indices_publicos(v_bloco,v_bloco->>'type' = 'matching'); v_ok := true;
      for v_i in 0..cardinality(v_indices)-1 loop
        if v_bloco->>'type' = 'ordering' then
          v_ok := v_ok and v_indices[(v_r.resposta->'order'->>v_i)::integer+1] = v_i;
        else v_ok := v_ok and v_indices[(v_r.resposta->'matches'->>v_i::text)::integer+1] = v_i; end if;
      end loop;
    end if;
    if v_bloco->>'type' in ('text','balance') then
      v_revisao := true;
      update public.studio_respostas set status_correcao = 'revisao',correta = null,pontos_automaticos = 0 where id = v_r.id;
    else
      v_auto := v_auto + case when v_ok then v_max else 0 end;
      update public.studio_respostas set status_correcao = case when v_ok is null then 'registrada' else 'automatica' end,
        correta = v_ok,pontos_automaticos = case when v_ok then v_max else 0 end where id = v_r.id;
    end if;
  end loop;
  delete from public.studio_respostas where tentativa_id = v_t.id and not bloco_id = any(v_percurso);
  update public.studio_tentativas set status = case when v_revisao then 'enviada' else 'corrigida' end,
    pontuacao_automatica = v_auto,pontuacao_manual = 0,pontos_maximos = v_total,requer_revisao = v_revisao,enviada_em = now(),
    corrigida_em = case when v_revisao then null else now() end where id = v_t.id;
  insert into public.studio_auditoria(experiencia_id,tentativa_id,ator_id,evento,detalhes)
    values(v_t.experiencia_id,v_t.id,(select auth.uid()),'tentativa_enviada',
      jsonb_build_object('requer_revisao',v_revisao,'percurso',to_jsonb(v_percurso),'pontos_maximos',v_total));
  return jsonb_build_object('status',case when v_revisao then 'enviada' else 'corrigida' end,
    'pontuacao_automatica',v_auto,'pontos_maximos',v_total,'requer_revisao',v_revisao);
end;
$$;

create or replace function private.corrigir_resposta_studio(p_resposta_id uuid,p_pontos numeric,p_feedback text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_usuario uuid := (select auth.uid()); v_r public.studio_respostas%rowtype;
  v_t public.studio_tentativas%rowtype; v_max numeric; v_pendentes integer;
begin
  if v_usuario is null or (select public.usuario_role()) not in ('professor','gestor') then
    raise exception 'Acesso restrito ao professor responsavel.';
  end if;
  select r.* into v_r from public.studio_respostas r join public.studio_tentativas t on t.id = r.tentativa_id
    join public.studio_experiencias e on e.id = t.experiencia_id where r.id = p_resposta_id
      and (e.professor_id = v_usuario or (select public.usuario_role()) = 'gestor');
  if not found then raise exception 'Resposta nao encontrada ou sem permissao.'; end if;
  select * into v_t from public.studio_tentativas where id = v_r.tentativa_id for update;
  if v_t.status = 'em_andamento' then raise exception 'Aguarde o envio antes de corrigir.'; end if;
  if v_r.bloco_tipo not in ('text','balance') then raise exception 'Somente respostas abertas aceitam correcao manual.'; end if;
  select (value->>'points')::numeric into v_max from public.studio_experiencia_versoes ev,
    jsonb_array_elements(ev.snapshot->'blocks') as b(value)
    where ev.experiencia_id = v_t.experiencia_id and ev.versao = v_t.versao and value->>'id' = v_r.bloco_id;
  if p_pontos is null or p_pontos = 'NaN'::numeric or p_pontos not between 0 and coalesce(v_max,0) then
    raise exception 'Pontuacao fora do intervalo permitido.';
  end if;
  if char_length(coalesce(p_feedback,'')) > 4000 then raise exception 'Use ate 4000 caracteres na devolutiva.'; end if;
  update public.studio_respostas set pontos_manuais = p_pontos,feedback = nullif(btrim(p_feedback),''),
    status_correcao = 'manual',corrigida_por = v_usuario,corrigida_em = now() where id = v_r.id;
  select count(*) into v_pendentes from public.studio_respostas where tentativa_id = v_t.id and status_correcao = 'revisao';
  update public.studio_tentativas set pontuacao_manual = (select coalesce(sum(pontos_manuais),0)
    from public.studio_respostas where tentativa_id = v_t.id),requer_revisao = v_pendentes > 0,
    status = case when v_pendentes = 0 then 'corrigida' else 'enviada' end,
    corrigida_em = case when v_pendentes = 0 then now() else null end where id = v_t.id;
  insert into public.studio_auditoria(experiencia_id,tentativa_id,ator_id,evento,detalhes)
    values(v_t.experiencia_id,v_t.id,v_usuario,'resposta_corrigida',jsonb_build_object('resposta_id',v_r.id,'pontos',p_pontos));
  return jsonb_build_object('resposta_id',v_r.id,'pontos',p_pontos,'pendentes',v_pendentes);
end;
$$;

create or replace function public.listar_experiencias_aluno_studio()
returns jsonb language sql security invoker set search_path = '' as $$ select private.listar_experiencias_aluno_studio(); $$;
create or replace function public.obter_experiencia_tentativa_studio(p_tentativa_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.obter_experiencia_tentativa_studio(p_tentativa_id); $$;
create or replace function public.resolver_proximo_bloco_studio(p_tentativa_id uuid,p_bloco_id text)
returns jsonb language sql security invoker set search_path = '' as $$ select private.resolver_proximo_bloco_studio(p_tentativa_id,p_bloco_id); $$;
-- Uma única assinatura pública evita ambiguidade no cache de schema do PostgREST.
drop function if exists public.salvar_resposta_studio(uuid,text,jsonb);
create or replace function public.salvar_resposta_studio(p_tentativa_id uuid,p_bloco_id text,p_resposta jsonb,p_confirmada boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$ select private.salvar_resposta_studio(p_tentativa_id,p_bloco_id,p_resposta,p_confirmada); $$;

alter table public.notificacoes add column if not exists studio_experiencia_id uuid;
alter table public.notificacoes add column if not exists studio_versao integer;
do $$ begin
  alter table public.notificacoes add constraint notificacoes_studio_versao_fkey
    foreign key(studio_experiencia_id,studio_versao)
    references public.studio_experiencia_versoes(experiencia_id,versao) on delete cascade;
exception when duplicate_object then null; end $$;
create unique index if not exists notificacoes_studio_turma_key
  on public.notificacoes(studio_experiencia_id,studio_versao,destino_turma_id)
  where studio_experiencia_id is not null;
create index if not exists studio_tentativas_retomada_idx
  on public.studio_tentativas(aluno_id,experiencia_id,iniciada_em desc) where status = 'em_andamento';

create or replace function private.studio_notificar_publicacao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_exp public.studio_experiencias%rowtype; v_titulo text;
begin
  if not new.ativo then
    delete from public.notificacoes where studio_experiencia_id = new.experiencia_id
      and studio_versao = new.versao and destino_turma_id = new.turma_id;
    return new;
  end if;
  select * into v_exp from public.studio_experiencias where id = new.experiencia_id;
  select coalesce(snapshot->>'title',v_exp.titulo) into v_titulo from public.studio_experiencia_versoes
    where experiencia_id = new.experiencia_id and versao = new.versao;
  insert into public.notificacoes(titulo,mensagem,tipo,prioridade,destino_turma_id,criado_por,link,expira_em,
    studio_experiencia_id,studio_versao,updated_at)
  values('Nova experiencia interativa',left(v_titulo || case when new.abre_em > now()
    then ' · disponivel em ' || to_char(new.abre_em at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
    when new.encerra_em is not null then ' · entrega ate ' || to_char(new.encerra_em at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
    else ' · descubra o percurso preparado pelo professor.' end,500),
    'avaliacao','normal',new.turma_id,v_exp.professor_id,
    '../atividades/index.html?studio=' || new.experiencia_id,new.encerra_em,new.experiencia_id,new.versao,now())
  on conflict(studio_experiencia_id,studio_versao,destino_turma_id) where studio_experiencia_id is not null
    do update set mensagem = excluded.mensagem,expira_em = excluded.expira_em,updated_at = now();
  return new;
end;
$$;
revoke all on function private.studio_notificar_publicacao() from public,anon,authenticated;
drop trigger if exists studio_publicacao_notificacao on public.studio_experiencia_turmas;
create trigger studio_publicacao_notificacao after insert or update of ativo,abre_em,encerra_em
  on public.studio_experiencia_turmas for each row execute function private.studio_notificar_publicacao();

create or replace function private.studio_remover_notificacao_arquivada()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'arquivado' then delete from public.notificacoes where studio_experiencia_id = new.id; end if;
  return new;
end;
$$;
revoke all on function private.studio_remover_notificacao_arquivada() from public,anon,authenticated;
drop trigger if exists studio_arquivo_notificacao on public.studio_experiencias;
create trigger studio_arquivo_notificacao after update of status on public.studio_experiencias
  for each row execute function private.studio_remover_notificacao_arquivada();

-- Apenas RPCs autenticadas expõem o contrato. Helpers não pertencem à Data API.
revoke all on function private.publicar_experiencia_studio(uuid,uuid[],timestamptz,timestamptz) from public,anon;
revoke all on function private.obter_experiencia_publicada_studio(uuid) from public,anon;
revoke all on function private.iniciar_tentativa_studio(uuid) from public,anon;
revoke all on function private.salvar_resposta_studio(uuid,text,jsonb) from public,anon;
revoke all on function private.enviar_tentativa_studio(uuid) from public,anon;
revoke all on function private.corrigir_resposta_studio(uuid,numeric,text) from public,anon;
grant execute on function private.publicar_experiencia_studio(uuid,uuid[],timestamptz,timestamptz) to authenticated;
grant execute on function private.obter_experiencia_publicada_studio(uuid) to authenticated;
grant execute on function private.iniciar_tentativa_studio(uuid) to authenticated;
grant execute on function private.salvar_resposta_studio(uuid,text,jsonb) to authenticated;
grant execute on function private.enviar_tentativa_studio(uuid) to authenticated;
grant execute on function private.corrigir_resposta_studio(uuid,numeric,text) to authenticated;
revoke all on function private.studio_itens(jsonb) from public,anon,authenticated;
revoke all on function private.studio_indices_publicos(jsonb,boolean) from public,anon,authenticated;
revoke all on function private.studio_snapshot_publico(jsonb) from public,anon,authenticated;
revoke all on function private.studio_validar_trabalho(jsonb) from public,anon,authenticated;
revoke all on function private.studio_verificar_acesso_tentativa(public.studio_tentativas,boolean) from public,anon,authenticated;
revoke all on function private.studio_resposta_completa(jsonb,jsonb,boolean) from public,anon,authenticated;
revoke all on function private.studio_proxima_etapa(jsonb,text,uuid) from public,anon,authenticated;
revoke all on function private.studio_percurso_tentativa(jsonb,uuid) from public,anon,authenticated;
revoke all on function private.listar_experiencias_aluno_studio() from public,anon;
revoke all on function private.obter_experiencia_tentativa_studio(uuid) from public,anon;
revoke all on function private.resolver_proximo_bloco_studio(uuid,text) from public,anon;
revoke all on function private.salvar_resposta_studio(uuid,text,jsonb,boolean) from public,anon;
revoke all on function public.listar_experiencias_aluno_studio() from public,anon;
revoke all on function public.obter_experiencia_tentativa_studio(uuid) from public,anon;
revoke all on function public.resolver_proximo_bloco_studio(uuid,text) from public,anon;
revoke all on function public.salvar_resposta_studio(uuid,text,jsonb,boolean) from public,anon;
grant execute on function private.listar_experiencias_aluno_studio() to authenticated;
grant execute on function private.obter_experiencia_tentativa_studio(uuid) to authenticated;
grant execute on function private.resolver_proximo_bloco_studio(uuid,text) to authenticated;
grant execute on function private.salvar_resposta_studio(uuid,text,jsonb,boolean) to authenticated;
grant execute on function public.listar_experiencias_aluno_studio() to authenticated;
grant execute on function public.obter_experiencia_tentativa_studio(uuid) to authenticated;
grant execute on function public.resolver_proximo_bloco_studio(uuid,text) to authenticated;
grant execute on function public.salvar_resposta_studio(uuid,text,jsonb,boolean) to authenticated;

-- ============================================================================
-- ETAPA 65/67: migrations/20261003_omnistudio_matematica.sql
-- ============================================================================

-- OmniStudio: metadados públicos de fórmulas, resolução guiada e plano cartesiano.
-- O banco limita o contrato; expressões nunca são executadas como SQL ou JavaScript.

-- Preserva integralmente as regras de percurso, gabarito e permissões existentes.
-- A condição torna esta extensão reaplicável sem renomear seu próprio wrapper.
do $$
begin
  if to_regprocedure('private.studio_validar_trabalho_base_integrado(jsonb)') is null then
    alter function private.studio_validar_trabalho(jsonb) rename to studio_validar_trabalho_base_integrado;
  end if;
end;
$$;

create or replace function private.studio_validar_trabalho(p_work jsonb)
returns void language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_bloco jsonb;
  v_config jsonb;
  v_variaveis jsonb;
  v_campo text;
  v_chave text;
  v_valor jsonb;
  v_x_min numeric;
  v_x_max numeric;
  v_y_min numeric;
  v_y_max numeric;
begin
  perform private.studio_validar_trabalho_base_integrado(p_work);
  for v_bloco in select value from jsonb_array_elements(p_work->'blocks') loop
    if v_bloco->>'type' in ('formula','graph') and (jsonb_typeof(v_bloco->'expression') is distinct from 'string'
      or char_length(v_bloco->>'expression') > 2000) then
      raise exception 'A formula ou funcao deve ser um texto de ate 2000 caracteres.';
    end if;
    if v_bloco->>'type' = 'graph' and (select count(*)
      from regexp_split_to_table(v_bloco->>'expression',E'[;\n]') as funcoes(expressao)
      where btrim(expressao) <> '') > 3 then
      raise exception 'Compare no maximo tres funcoes por plano cartesiano, uma por linha ou separadas por ponto e virgula.';
    end if;
    if v_bloco ? 'mathExpression' and (jsonb_typeof(v_bloco->'mathExpression') is distinct from 'string'
      or char_length(v_bloco->>'mathExpression') > 2000) then
      raise exception 'A expressao matematica deve ser um texto de ate 2000 caracteres.';
    end if;
    if v_bloco ? 'solutionSteps' and (jsonb_typeof(v_bloco->'solutionSteps') is distinct from 'string'
      or char_length(v_bloco->>'solutionSteps') > 8000) then
      raise exception 'As orientacoes da resolucao devem ser um texto de ate 8000 caracteres.';
    end if;

    v_config := coalesce(v_bloco->'graphSettings','{}'::jsonb);
    if jsonb_typeof(v_config) is distinct from 'object' then
      raise exception 'As configuracoes do plano cartesiano precisam ser um objeto.';
    end if;
    foreach v_campo in array array['xMin','xMax','yMin','yMax'] loop
      if v_config ? v_campo then
        if jsonb_typeof(v_config->v_campo) is distinct from 'number'
          or abs((v_config->>v_campo)::numeric) > 1000000 then
          raise exception 'Os limites do plano cartesiano precisam ser numeros entre -1000000 e 1000000.';
        end if;
      end if;
    end loop;
    foreach v_campo in array array['autoY','showTable'] loop
      if v_config ? v_campo and jsonb_typeof(v_config->v_campo) is distinct from 'boolean' then
        raise exception 'A escala automatica e a exibicao da tabela precisam ser valores booleanos.';
      end if;
    end loop;
    v_x_min := coalesce((v_config->>'xMin')::numeric,-5);
    v_x_max := coalesce((v_config->>'xMax')::numeric,5);
    if v_x_max - v_x_min < 0.0001 then
      raise exception 'O maximo de x precisa ser maior que o minimo, com uma janela de pelo menos 0.0001.';
    end if;
    if coalesce((v_config->>'autoY')::boolean,true) = false then
      v_y_min := coalesce((v_config->>'yMin')::numeric,-5);
      v_y_max := coalesce((v_config->>'yMax')::numeric,5);
      if v_y_max - v_y_min < 0.0001 then
        raise exception 'O maximo de y precisa ser maior que o minimo, com uma janela de pelo menos 0.0001.';
      end if;
    end if;

    -- Os parâmetros são números públicos escolhidos pelo professor, não código nem gabarito.
    for v_variaveis in
      select value from (values
        (coalesce(v_bloco->'mathVariables','{}'::jsonb)),
        (coalesce(v_config->'variables','{}'::jsonb))
      ) as conjuntos(value)
    loop
      if jsonb_typeof(v_variaveis) is distinct from 'object'
        or (select count(*) from jsonb_object_keys(v_variaveis)) > 26 then
        raise exception 'Use um objeto com ate 26 variaveis matematicas.';
      end if;
      for v_chave,v_valor in select key,value from jsonb_each(v_variaveis) loop
        if v_chave !~ '^[a-z]$' or jsonb_typeof(v_valor) is distinct from 'number'
          or abs((v_valor #>> '{}')::numeric) > 1000000 then
          raise exception 'Cada variavel deve ter uma letra minuscula e um valor numerico entre -1000000 e 1000000.';
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

-- Helpers continuam privados. Nenhuma nova RPC ou permissão de tabela é criada.
revoke all on function private.studio_validar_trabalho_base_integrado(jsonb) from public,anon,authenticated;
revoke all on function private.studio_validar_trabalho(jsonb) from public,anon,authenticated;

comment on function private.studio_validar_trabalho(jsonb) is
  'Valida percurso e metadados matematicos publicos limitados, sem executar expressoes ou expor gabaritos.';

-- ============================================================================
-- ETAPA 66/67: migrations/20261003_copiloto_ideias_trilhas.sql
-- ============================================================================

-- OminiSaber | Copiloto: ideias e trilhas com atividades completas.
-- Incremental; mantém registros anteriores, RLS, privilégios e feature flags.

alter table public.copiloto_execucoes
  drop constraint if exists copiloto_execucoes_acao_check;
alter table public.copiloto_execucoes
  add constraint copiloto_execucoes_acao_check
  check (acao in ('gerar_atividade', 'gerar_trilha', 'gerar_ideias', 'revisar_atividade', 'sugerir_recuperacao'));
alter table public.copiloto_execucoes
  alter column prompt_versao set default 'copiloto-pedagogico-2026-10-03';

comment on column public.copiloto_execucoes.prompt_versao is
  'Versão do contrato pedagógico e validação utilizados; registros anteriores mantêm sua versão original.';

-- ============================================================================
-- ETAPA 67/67: migrations/20261006_copiloto_operacoes_piloto.sql
-- ============================================================================

-- OminiSaber | Fase 3 - reserva atômica de uso do Copiloto.
-- A operação preserva os valores legados de acao para histórico e compatibilidade.

create or replace function public.reservar_execucao_copiloto(
  p_professor_id uuid,
  p_limite_por_minuto integer,
  p_limite_diario integer,
  p_sessao_id uuid,
  p_turma_id uuid,
  p_acao text,
  p_materia_codigo public.materia_aluno,
  p_habilidade_ids uuid[],
  p_solicitacao_resumo jsonb,
  p_prompt_versao text,
  p_provedor text,
  p_modelo text
)
returns table (execution_id uuid, limit_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minute_count integer;
  v_daily_count integer;
  v_execution_id uuid;
begin
  if p_professor_id is null
     or p_turma_id is null
     or p_limite_por_minuto < 1
     or p_limite_diario < 1
     or jsonb_typeof(p_solicitacao_resumo) <> 'object'
     or p_acao not in ('gerar_atividade', 'gerar_trilha', 'gerar_ideias', 'revisar_atividade', 'sugerir_recuperacao') then
    raise exception 'Parâmetros inválidos para reserva do Copiloto.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_professor_id::text, 20261006)
  );

  select count(*)::integer into v_minute_count
  from public.copiloto_execucoes
  where professor_id = p_professor_id
    and (case when acao = 'gerar_ideias' then 'gerar_atividade' else acao end)
      = (case when p_acao = 'gerar_ideias' then 'gerar_atividade' else p_acao end)
    and status in ('processando', 'concluida')
    and created_at >= now() - interval '1 minute';
  if v_minute_count >= p_limite_por_minuto then
    return query select null::uuid, 'minute'::text;
    return;
  end if;

  select count(*)::integer into v_daily_count
  from public.copiloto_execucoes
  where professor_id = p_professor_id
    and (case when acao = 'gerar_ideias' then 'gerar_atividade' else acao end)
      = (case when p_acao = 'gerar_ideias' then 'gerar_atividade' else p_acao end)
    and status in ('processando', 'concluida')
    and created_at >= now() - interval '1 day';
  if v_daily_count >= p_limite_diario then
    return query select null::uuid, 'daily'::text;
    return;
  end if;

  insert into public.copiloto_execucoes (
    sessao_id, professor_id, turma_id, acao, materia_codigo, habilidade_ids,
    solicitacao_resumo, prompt_versao, provedor, modelo
  ) values (
    p_sessao_id, p_professor_id, p_turma_id, p_acao, p_materia_codigo,
    coalesce(p_habilidade_ids, '{}'), p_solicitacao_resumo, p_prompt_versao,
    p_provedor, p_modelo
  ) returning id into v_execution_id;

  return query select v_execution_id, null::text;
end;
$$;

revoke all on function public.reservar_execucao_copiloto(
  uuid, integer, integer, uuid, uuid, text, public.materia_aluno, uuid[], jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.reservar_execucao_copiloto(
  uuid, integer, integer, uuid, uuid, text, public.materia_aluno, uuid[], jsonb, text, text, text
) to service_role;

comment on function public.reservar_execucao_copiloto(
  uuid, integer, integer, uuid, uuid, text, public.materia_aluno, uuid[], jsonb, text, text, text
) is 'Serializa e reserva uma execução do Copiloto dentro dos limites por professor.';

create or replace function public.resumo_habilidades_copiloto(
  p_turma_id uuid,
  p_materia_codigo public.materia_aluno
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_professor_id uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_professor_id is null or (select public.usuario_role()) <> 'professor'
     or not exists (
       select 1 from public.perfis p
       where p.id = v_professor_id and p.role = 'professor' and p.ativo = true
     )
     or not exists (
       select 1 from public.professor_turma_materias ptm
       where ptm.professor_id = v_professor_id
         and ptm.turma_id = p_turma_id
         and ptm.materia_codigo = p_materia_codigo
         and ptm.ativo = true
     ) then
    raise exception 'Sem autorização para analisar esta turma e matéria.' using errcode = '42501';
  end if;

  with scoped_activities as (
    select a.id
    from public.avaliacoes_docentes a
    where a.professor_id = v_professor_id
      and a.turma_id = p_turma_id
      and a.materia_codigo = p_materia_codigo
      and a.status in ('publicado', 'encerrado')
    order by a.created_at desc
    limit 20
  ), latest_attempts as (
    select distinct on (t.aluno_id, t.avaliacao_id)
      t.id, t.avaliacao_id, t.status
    from public.tentativas_avaliacao t
    join scoped_activities a on a.id = t.avaliacao_id
    where t.status in ('enviada', 'corrigida')
    order by t.aluno_id, t.avaliacao_id, t.numero_tentativa desc
  ), corrected_answers as (
    select r.questao_id, r.pontos_automaticos, r.pontos_manuais
    from public.respostas_avaliacao r
    join latest_attempts t on t.id = r.tentativa_id
    where t.status = 'corrigida'
  ), skill_performance as (
    select h.id, h.codigo, h.descricao,
      count(*)::integer as evidence_count,
      round(100 * sum(r.pontos_automaticos + r.pontos_manuais)
        / nullif(sum(q.pontos), 0), 1) as performance_percent,
      coalesce((
        select jsonb_agg(descriptor order by descriptor ->> 'code')
        from (
          select distinct jsonb_build_object('code', d.codigo, 'description', d.descricao) as descriptor
          from public.habilidade_descritores hd
          join public.descritores_curriculares d on d.id = hd.descritor_id
          where hd.habilidade_id = h.id
          limit 8
        ) descriptor_rows
      ), '[]'::jsonb) as descriptors
    from public.questoes_avaliacao_habilidades qh
    join public.habilidades_curriculares h on h.id = qh.habilidade_id
    join public.questoes_avaliacao q on q.id = qh.questao_id
    join scoped_activities a on a.id = q.avaliacao_id
    join corrected_answers r on r.questao_id = q.id
    group by h.id, h.codigo, h.descricao
    having count(*) >= 3 and sum(q.pontos) > 0
  ), critical_skills as (
    select * from skill_performance
    where performance_percent < 60
    order by performance_percent, evidence_count desc, codigo
    limit 12
  )
  select jsonb_build_object(
    'activityCount', (select count(*)::integer from scoped_activities),
    'correctedAttemptCount', (select count(*)::integer from latest_attempts where status = 'corrigida'),
    'criticalSkills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'code', codigo, 'description', descricao,
        'performancePercent', performance_percent, 'evidenceCount', evidence_count,
        'descriptors', descriptors
      ) order by performance_percent, codigo)
      from critical_skills
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.resumo_habilidades_copiloto(uuid, public.materia_aluno)
  from public, anon;
grant execute on function public.resumo_habilidades_copiloto(uuid, public.materia_aluno)
  to authenticated;

comment on function public.resumo_habilidades_copiloto(uuid, public.materia_aluno) is
  'Retorna somente habilidades abaixo de 60% com pelo menos três evidências corrigidas no escopo do professor autenticado.';

commit;

-- Fim do schema completo do OminiSaber.
