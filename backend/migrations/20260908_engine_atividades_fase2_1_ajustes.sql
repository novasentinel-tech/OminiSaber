-- OminiSaber | Ajustes pós-advisor da Fase 2.1

begin;

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

commit;
