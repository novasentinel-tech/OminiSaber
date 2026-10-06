-- OminiSaber | Corrige a leitura dos vinculos curriculares nas atividades

begin;

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

commit;
