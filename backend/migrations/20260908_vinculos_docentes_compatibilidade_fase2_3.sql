-- OminiSaber | Fase 2.3 - compatibilidade dos vinculos criados pelo gestor

begin;

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

commit;
