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
    join public.habilidade_curriculo_periodos hcp on hcp.habilidade_id = h.id
    join public.curriculo_periodos cp on cp.id = hcp.periodo_id
    join public.curriculos c on c.id = cp.curriculo_id
    where h.id = p_habilidade_id
      and h.materia_codigo = p_materia
      and h.codigo ~ '^EM\d{2}[A-Z]{2}\d{2}$'
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

commit;
