-- OminiSaber | Fase 2.2 - criacao atomica de atividades pelo professor

begin;

create or replace function public.criar_atividade_docente(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_professor_id uuid := (select auth.uid());
  v_tipo_professor public.tipo_professor;
  v_turma_id uuid;
  v_materia public.materia_aluno;
  v_avaliacao_id uuid;
  v_questao_id uuid;
  v_titulo text := btrim(coalesce(p_payload->>'title', ''));
  v_categoria text := coalesce(nullif(p_payload->>'category', ''), 'atividade');
  v_modo_pontuacao text := coalesce(nullif(p_payload->>'scoringMode', ''), 'igual');
  v_valor numeric(6,2) := coalesce(nullif(p_payload->>'value', '')::numeric, 10);
  v_total_manual numeric(10,2);
  v_quantidade integer;
  v_ordem integer;
  v_pontos numeric(6,2);
  v_item jsonb;
  v_habilidade text;
  v_publicar boolean := coalesce((p_payload->>'publish')::boolean, false);
begin
  if v_professor_id is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;

  select p.tipo_professor into v_tipo_professor
  from public.perfis p
  where p.id = v_professor_id and p.role = 'professor' and p.ativo = true;
  if v_tipo_professor is null then
    raise exception 'A conta atual nao possui um perfil docente ativo.';
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Os dados da atividade sao invalidos.';
  end if;
  if char_length(v_titulo) < 3 or char_length(v_titulo) > 140 then
    raise exception 'O titulo deve ter entre 3 e 140 caracteres.';
  end if;
  if v_categoria not in ('atividade', 'avaliacao', 'diagnostica', 'recuperacao') then
    raise exception 'Categoria de atividade invalida.';
  end if;
  if v_modo_pontuacao not in ('igual', 'manual') then
    raise exception 'Modo de pontuacao invalido.';
  end if;
  if v_valor <= 0 or v_valor > 1000 then
    raise exception 'O valor total deve ser maior que zero e no maximo 1000.';
  end if;

  begin
    v_turma_id := nullif(p_payload->>'classId', '')::uuid;
    v_materia := nullif(p_payload->>'subject', '')::public.materia_aluno;
  exception when others then
    raise exception 'Turma ou materia invalida.';
  end;
  if v_turma_id is null or v_materia is null then
    raise exception 'Selecione a turma e a materia.';
  end if;
  if not private.professor_tem_turma_materia(v_professor_id, v_turma_id, v_materia) then
    raise exception 'Voce nao possui vinculo ativo com esta turma e materia.';
  end if;

  if jsonb_typeof(p_payload->'questions') <> 'array' then
    raise exception 'Adicione pelo menos uma questao.';
  end if;
  v_quantidade := jsonb_array_length(p_payload->'questions');
  if v_quantidade < 1 or v_quantidade > 100 then
    raise exception 'A atividade deve possuir entre 1 e 100 questoes.';
  end if;

  if nullif(p_payload->>'opensAt', '') is not null
     and nullif(p_payload->>'closesAt', '') is not null
     and (p_payload->>'closesAt')::timestamptz <= (p_payload->>'opensAt')::timestamptz then
    raise exception 'O encerramento precisa acontecer depois da abertura.';
  end if;

  if v_modo_pontuacao = 'manual' then
    select coalesce(sum(coalesce(nullif(q.value->>'points', '')::numeric, 0)), 0)
      into v_total_manual
    from jsonb_array_elements(p_payload->'questions') q;
    if abs(v_total_manual - v_valor) > 0.01 then
      raise exception 'A soma dos pontos (%) precisa ser igual ao valor total (%).', v_total_manual, v_valor;
    end if;
  end if;

  if v_publicar and v_materia in ('matematica', 'fisica', 'quimica', 'biologia', 'portugues')
     and not exists (
       select 1
       from jsonb_array_elements(p_payload->'questions') q
       cross join lateral jsonb_array_elements_text(coalesce(q.value->'skillIds', '[]'::jsonb)) h
     ) then
    raise exception 'Vincule pelo menos uma habilidade ou descritor antes de publicar.';
  end if;

  insert into public.avaliacoes_docentes (
    professor_id, turma_id, tipo_professor, materia_codigo, categoria,
    serie, trimestre, titulo, instrucoes, duracao_minutos, valor,
    modo_pontuacao, tentativas_permitidas, embaralhar_questoes,
    embaralhar_alternativas, feedback_imediato, exibir_gabarito,
    configuracao, status, abre_em, encerra_em
  ) values (
    v_professor_id,
    v_turma_id,
    v_tipo_professor,
    v_materia,
    v_categoria,
    nullif(p_payload->>'series', '')::smallint,
    nullif(p_payload->>'trimester', '')::smallint,
    v_titulo,
    coalesce(p_payload->>'instructions', ''),
    nullif(p_payload->>'duration', '')::integer,
    v_valor,
    v_modo_pontuacao,
    coalesce(nullif(p_payload->>'attempts', '')::smallint, 1),
    coalesce((p_payload->>'shuffleQuestions')::boolean, false),
    coalesce((p_payload->>'shuffleAlternatives')::boolean, false),
    coalesce((p_payload->>'immediateFeedback')::boolean, false),
    coalesce((p_payload->>'showAnswerKey')::boolean, false),
    coalesce(p_payload->'configuration', '{}'::jsonb),
    'rascunho',
    nullif(p_payload->>'opensAt', '')::timestamptz,
    nullif(p_payload->>'closesAt', '')::timestamptz
  ) returning id into v_avaliacao_id;

  for v_item, v_ordem in
    select q.value, q.ordinality::integer
    from jsonb_array_elements(p_payload->'questions') with ordinality q(value, ordinality)
  loop
    if char_length(btrim(coalesce(v_item->>'statement', ''))) < 3 then
      raise exception 'A questao % precisa de um enunciado valido.', v_ordem;
    end if;

    if v_modo_pontuacao = 'igual' then
      if v_ordem = v_quantidade then
        v_pontos := v_valor - round(v_valor / v_quantidade, 2) * (v_quantidade - 1);
      else
        v_pontos := round(v_valor / v_quantidade, 2);
      end if;
    else
      v_pontos := nullif(v_item->>'points', '')::numeric;
    end if;
    if v_pontos is null or v_pontos <= 0 then
      raise exception 'A questao % precisa ter pontuacao maior que zero.', v_ordem;
    end if;

    insert into public.questoes_avaliacao (
      avaliacao_id, ordem, tipo, enunciado, alternativas, pontos,
      configuracao, explicacao, obrigatoria
    ) values (
      v_avaliacao_id,
      v_ordem,
      v_item->>'type',
      btrim(v_item->>'statement'),
      coalesce(v_item->'alternatives', '[]'::jsonb),
      v_pontos,
      coalesce(v_item->'configuration', '{}'::jsonb),
      nullif(btrim(coalesce(v_item->>'explanation', '')), ''),
      coalesce((v_item->>'required')::boolean, true)
    ) returning id into v_questao_id;

    insert into public.gabaritos_avaliacao (questao_id, resposta_esperada)
    values (
      v_questao_id,
      jsonb_build_object(
        'value', coalesce(v_item->'answer', to_jsonb(coalesce(v_item->>'answerText', ''))),
        'normalization', coalesce(v_item->'answerConfiguration', '{}'::jsonb)
      )
    );

    for v_habilidade in
      select distinct h.value
      from jsonb_array_elements_text(coalesce(v_item->'skillIds', '[]'::jsonb)) h(value)
    loop
      if not exists (
        select 1 from public.habilidades_curriculares hc
        where hc.id = v_habilidade::uuid
          and hc.materia_codigo = v_materia
          and public.habilidade_curricular_publicada(hc.id)
      ) then
        raise exception 'A questao % possui habilidade invalida para a materia.', v_ordem;
      end if;
      insert into public.questoes_avaliacao_habilidades (questao_id, habilidade_id)
      values (v_questao_id, v_habilidade::uuid);
    end loop;
  end loop;

  if v_publicar then
    update public.avaliacoes_docentes
    set status = 'publicado', publicado_em = now()
    where id = v_avaliacao_id;
  end if;

  return v_avaliacao_id;
end;
$$;

revoke all on function public.criar_atividade_docente(jsonb) from public, anon;
grant execute on function public.criar_atividade_docente(jsonb) to authenticated;

commit;
