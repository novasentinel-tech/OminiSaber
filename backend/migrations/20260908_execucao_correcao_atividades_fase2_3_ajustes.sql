-- OminiSaber | Fase 2.3 - ajuste de inicio de tentativa para privilegios do aluno

begin;

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

commit;
