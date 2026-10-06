-- OminiSaber | Fase 3 - reserva atômica de uso do Copiloto.
-- A operação preserva os valores legados de acao para histórico e compatibilidade.
begin;

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