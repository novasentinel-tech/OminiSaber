begin;

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

commit;
