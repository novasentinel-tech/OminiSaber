begin;

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

commit;
