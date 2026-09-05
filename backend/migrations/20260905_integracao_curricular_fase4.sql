begin;

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
      and h.codigo ~ '^EM\d{2}[A-Z]{2}\d{2}$'
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
    and h.codigo ~ '^EM\d{2}[A-Z]{2}\d{2}$'
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
      and h.codigo ~ '^EM\d{2}[A-Z]{2}\d{2}$'
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

commit;
