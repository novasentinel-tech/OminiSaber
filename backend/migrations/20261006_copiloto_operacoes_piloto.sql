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
    and created_at >= now() - interval '1 minute';
  if v_minute_count >= p_limite_por_minuto then
    return query select null::uuid, 'minute'::text;
    return;
  end if;

  select count(*)::integer into v_daily_count
  from public.copiloto_execucoes
  where professor_id = p_professor_id
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

commit;