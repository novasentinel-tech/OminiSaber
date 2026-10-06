-- OminiSaber | Fase 2.3 - correcao docente e resultados por descritor

begin;

create index if not exists tentativas_avaliacao_revisao_docente_idx
  on public.tentativas_avaliacao (avaliacao_id, enviada_em desc)
  where requer_revisao = true and status = 'enviada';

create or replace function public.corrigir_resposta_avaliacao(
  p_resposta_id uuid,
  p_pontos numeric,
  p_feedback text default null
)
returns table (
  resposta_id uuid,
  tentativa_id uuid,
  status_tentativa text,
  nota numeric,
  pontuacao_automatica numeric,
  pontuacao_manual numeric,
  requer_revisao boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resposta public.respostas_avaliacao;
  v_tentativa public.tentativas_avaliacao;
  v_avaliacao public.avaliacoes_docentes;
  v_maximo numeric(6,2);
  v_automatica numeric(8,2);
  v_manual numeric(8,2);
  v_pendentes integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessao autenticada obrigatoria.';
  end if;

  select r.* into v_resposta
  from public.respostas_avaliacao r
  where r.id = p_resposta_id
  for update;
  if not found then raise exception 'Resposta nao encontrada.'; end if;

  select t.* into v_tentativa
  from public.tentativas_avaliacao t
  where t.id = v_resposta.tentativa_id
  for update;

  select a.* into v_avaliacao
  from public.avaliacoes_docentes a
  where a.id = v_tentativa.avaliacao_id;

  if (select public.usuario_role()) <> 'gestor'
     and v_avaliacao.professor_id <> (select auth.uid()) then
    raise exception 'Voce nao pode corrigir esta resposta.';
  end if;
  if v_tentativa.status not in ('enviada', 'corrigida') then
    raise exception 'A tentativa ainda nao foi entregue.';
  end if;
  if v_resposta.status_correcao not in ('revisao', 'manual') then
    raise exception 'Esta resposta nao aceita correcao manual.';
  end if;

  select q.pontos into v_maximo
  from public.questoes_avaliacao q
  where q.id = v_resposta.questao_id;
  if p_pontos is null or p_pontos < 0 or p_pontos > v_maximo then
    raise exception 'A pontuacao deve estar entre 0 e %.', v_maximo;
  end if;

  update public.respostas_avaliacao r
  set status_correcao = 'manual',
      correta = (p_pontos = v_maximo),
      pontos_manuais = round(p_pontos, 2),
      feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
      corrigida_em = now(),
      updated_at = now()
  where r.id = p_resposta_id;

  select
    coalesce(sum(r.pontos_automaticos), 0),
    coalesce(sum(r.pontos_manuais), 0),
    count(*) filter (where r.status_correcao in ('pendente', 'revisao'))
  into v_automatica, v_manual, v_pendentes
  from public.respostas_avaliacao r
  where r.tentativa_id = v_tentativa.id;

  update public.tentativas_avaliacao t
  set pontuacao_automatica = v_automatica,
      pontuacao_manual = v_manual,
      nota = least(v_avaliacao.valor, v_automatica + v_manual),
      requer_revisao = v_pendentes > 0,
      status = case when v_pendentes = 0 then 'corrigida' else 'enviada' end,
      corrigida_em = case when v_pendentes = 0 then now() else null end,
      feedback = case when v_pendentes = 0
        then 'Correcao concluida. Consulte as devolutivas em cada questao.'
        else t.feedback end
  where t.id = v_tentativa.id;

  insert into public.avaliacoes_auditoria
    (avaliacao_id, tentativa_id, ator_id, evento, detalhes)
  values
    (v_avaliacao.id, v_tentativa.id, (select auth.uid()), 'resposta_corrigida',
     jsonb_build_object('resposta_id', p_resposta_id, 'pontos', round(p_pontos, 2),
       'maximo', v_maximo, 'correcao_concluida', v_pendentes = 0));

  return query
  select r.id, t.id, t.status, t.nota, t.pontuacao_automatica,
    t.pontuacao_manual, t.requer_revisao
  from public.respostas_avaliacao r
  join public.tentativas_avaliacao t on t.id = r.tentativa_id
  where r.id = p_resposta_id;
end;
$$;

revoke all on function public.corrigir_resposta_avaliacao(uuid, numeric, text)
  from public, anon;
grant execute on function public.corrigir_resposta_avaliacao(uuid, numeric, text)
  to authenticated;

create or replace function public.resultados_avaliacao_docente(p_avaliacao_id uuid)
returns table (
  tentativa_id uuid,
  aluno_id uuid,
  aluno_nome text,
  matricula text,
  numero_tentativa smallint,
  status text,
  nota numeric,
  pontuacao_automatica numeric,
  pontuacao_manual numeric,
  requer_revisao boolean,
  respondidas bigint,
  total_questoes bigint,
  enviada_em timestamptz,
  corrigida_em timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.avaliacoes_docentes a
    where a.id = p_avaliacao_id
      and (a.professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor')
  ) then raise exception 'Avaliacao nao encontrada ou sem permissao.'; end if;

  return query
  select t.id, t.aluno_id, p.nome, p.matricula, t.numero_tentativa,
    t.status, t.nota, t.pontuacao_automatica, t.pontuacao_manual,
    t.requer_revisao, count(r.id),
    (select count(*) from public.questoes_avaliacao q where q.avaliacao_id = p_avaliacao_id),
    t.enviada_em, t.corrigida_em
  from public.tentativas_avaliacao t
  join public.perfis p on p.id = t.aluno_id
  left join public.respostas_avaliacao r on r.tentativa_id = t.id
  where t.avaliacao_id = p_avaliacao_id
  group by t.id, p.id
  order by t.enviada_em desc nulls last, p.nome;
end;
$$;

create or replace function public.resultados_descritores_avaliacao(p_avaliacao_id uuid)
returns table (
  habilidade_id uuid,
  codigo text,
  descricao text,
  descritores jsonb,
  respostas bigint,
  pontos_obtidos numeric,
  pontos_possiveis numeric,
  aproveitamento numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.avaliacoes_docentes a
    where a.id = p_avaliacao_id
      and (a.professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor')
  ) then raise exception 'Avaliacao nao encontrada ou sem permissao.'; end if;

  return query
  select h.id, h.codigo, h.descricao,
    coalesce((select jsonb_agg(distinct jsonb_build_object('codigo', d.codigo, 'descricao', d.descricao))
      from public.habilidade_descritores hd
      join public.descritores_curriculares d on d.id = hd.descritor_id
      where hd.habilidade_id = h.id), '[]'::jsonb),
    count(r.id),
    round(coalesce(sum(r.pontos_automaticos + r.pontos_manuais), 0), 2),
    round(coalesce(sum(q.pontos), 0), 2),
    round(case when coalesce(sum(q.pontos), 0) > 0
      then 100 * sum(r.pontos_automaticos + r.pontos_manuais) / sum(q.pontos)
      else 0 end, 1)
  from public.questoes_avaliacao_habilidades qh
  join public.habilidades_curriculares h on h.id = qh.habilidade_id
  join public.questoes_avaliacao q on q.id = qh.questao_id and q.avaliacao_id = p_avaliacao_id
  left join public.respostas_avaliacao r on r.questao_id = q.id
  left join public.tentativas_avaliacao t on t.id = r.tentativa_id
    and t.avaliacao_id = p_avaliacao_id and t.status in ('enviada', 'corrigida')
  where r.id is null or t.id is not null
  group by h.id
  order by aproveitamento asc, h.codigo;
end;
$$;

revoke all on function public.resultados_avaliacao_docente(uuid) from public, anon;
revoke all on function public.resultados_descritores_avaliacao(uuid) from public, anon;
grant execute on function public.resultados_avaliacao_docente(uuid) to authenticated;
grant execute on function public.resultados_descritores_avaliacao(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
