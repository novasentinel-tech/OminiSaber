-- OminiSaber | Fase 2.4 - correção da validação de habilidades da recuperação

begin;

create or replace function public.criar_recuperacao_descritores(
  p_avaliacao_origem uuid, p_habilidade_ids uuid[], p_titulo text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_origem public.avaliacoes_docentes;
  v_nova_id uuid;
  v_questao record;
  v_nova_questao uuid;
begin
  select a.* into v_origem from public.avaliacoes_docentes a
  where a.id = p_avaliacao_origem and a.professor_id = (select auth.uid());
  if not found then raise exception 'Avaliacao de origem nao encontrada ou sem permissao.'; end if;
  if coalesce(array_length(p_habilidade_ids, 1), 0) = 0 then
    raise exception 'Selecione ao menos um descritor para a recuperacao.';
  end if;
  if exists (
    select 1 from unnest(p_habilidade_ids) as selecionada(habilidade_id)
    where not exists (
      select 1 from public.questoes_avaliacao_habilidades qh
      join public.questoes_avaliacao q on q.id = qh.questao_id
      where q.avaliacao_id = v_origem.id
        and qh.habilidade_id = selecionada.habilidade_id
    )
  ) then
    raise exception 'Um dos descritores nao pertence a avaliacao de origem.';
  end if;
  insert into public.avaliacoes_docentes
    (professor_id, turma_id, tipo_professor, titulo, instrucoes, duracao_minutos,
     valor, configuracao, status, materia_codigo, categoria, serie, trimestre,
     modo_pontuacao, tentativas_permitidas, embaralhar_questoes,
     embaralhar_alternativas, feedback_imediato, exibir_gabarito)
  values (v_origem.professor_id, v_origem.turma_id, v_origem.tipo_professor,
    coalesce(nullif(btrim(p_titulo), ''), 'Recuperacao - ' || v_origem.titulo),
    'Recuperacao criada a partir dos descritores com menor desempenho. Revise antes de publicar.',
    v_origem.duracao_minutos, v_origem.valor,
    v_origem.configuracao || jsonb_build_object('avaliacao_origem_id', v_origem.id,
      'habilidade_ids', to_jsonb(p_habilidade_ids)), 'rascunho', v_origem.materia_codigo,
    'recuperacao', v_origem.serie, v_origem.trimestre, v_origem.modo_pontuacao,
    1, v_origem.embaralhar_questoes, v_origem.embaralhar_alternativas,
    v_origem.feedback_imediato, v_origem.exibir_gabarito)
  returning id into v_nova_id;

  for v_questao in
    select distinct q.* from public.questoes_avaliacao q
    join public.questoes_avaliacao_habilidades qh on qh.questao_id = q.id
    where q.avaliacao_id = v_origem.id and qh.habilidade_id = any(p_habilidade_ids)
    order by q.ordem
  loop
    insert into public.questoes_avaliacao
      (avaliacao_id, ordem, tipo, enunciado, alternativas, pontos, configuracao, explicacao, obrigatoria)
    values (v_nova_id, v_questao.ordem, v_questao.tipo, v_questao.enunciado,
      v_questao.alternativas, v_questao.pontos, v_questao.configuracao,
      v_questao.explicacao, v_questao.obrigatoria)
    returning id into v_nova_questao;
    insert into public.gabaritos_avaliacao (questao_id, resposta_esperada)
    select v_nova_questao, g.resposta_esperada from public.gabaritos_avaliacao g
    where g.questao_id = v_questao.id;
    insert into public.questoes_avaliacao_habilidades (questao_id, habilidade_id)
    select v_nova_questao, qh.habilidade_id
    from public.questoes_avaliacao_habilidades qh
    where qh.questao_id = v_questao.id and qh.habilidade_id = any(p_habilidade_ids)
    on conflict do nothing;
  end loop;

  insert into public.avaliacoes_auditoria (avaliacao_id, ator_id, evento, detalhes)
  values (v_nova_id, (select auth.uid()), 'recuperacao_criada',
    jsonb_build_object('avaliacao_origem_id', v_origem.id,
      'habilidade_ids', to_jsonb(p_habilidade_ids)));
  return v_nova_id;
end;
$$;

revoke all on function public.criar_recuperacao_descritores(uuid, uuid[], text)
  from public, anon;
grant execute on function public.criar_recuperacao_descritores(uuid, uuid[], text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
