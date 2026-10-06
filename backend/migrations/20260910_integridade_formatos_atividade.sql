-- OminiSaber | Integridade dos formatos interativos e correção automática

begin;

create or replace function private.validar_questao_avaliacao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_modo text := nullif(new.configuracao->>'mathMode', '');
  v_min numeric;
  v_max numeric;
  v_step numeric;
  v_target numeric;
  v_min_y numeric;
  v_max_y numeric;
  v_target_y numeric;
begin
  if v_modo is not null
     and v_modo not in ('livre', 'plano_cartesiano', 'reta_numerica', 'pitagoras', 'grafico_barras') then
    raise exception 'Modelo matematico invalido.';
  end if;

  if new.tipo in ('unica_escolha', 'multipla_escolha')
     and jsonb_array_length(new.alternativas) < 2 then
    raise exception 'Questoes objetivas precisam de pelo menos duas alternativas.';
  end if;

  if new.tipo = 'associacao' then
    if jsonb_typeof(new.configuracao->'pairs') <> 'array'
       or jsonb_array_length(new.configuracao->'pairs') < 2
       or exists (
         select 1
         from jsonb_array_elements(new.configuracao->'pairs') par
         where jsonb_typeof(par) <> 'object'
            or btrim(coalesce(par->>'left', '')) = ''
            or btrim(coalesce(par->>'right', '')) = ''
       ) then
      raise exception 'A associacao precisa de pelo menos dois pares completos.';
    end if;
  elsif new.tipo = 'ordenacao' and jsonb_array_length(new.alternativas) < 2 then
    raise exception 'A ordenacao precisa de pelo menos dois itens.';
  end if;

  if v_modo = 'plano_cartesiano' then
    if new.tipo <> 'resposta_curta' then
      raise exception 'O plano cartesiano deve usar resposta curta.';
    end if;
    begin
      v_min := (new.configuracao->>'minX')::numeric;
      v_max := (new.configuracao->>'maxX')::numeric;
      v_target := (new.configuracao->>'targetX')::numeric;
      v_min_y := (new.configuracao->>'minY')::numeric;
      v_max_y := (new.configuracao->>'maxY')::numeric;
      v_target_y := (new.configuracao->>'targetY')::numeric;
    exception when others then
      raise exception 'Os eixos e o ponto do plano cartesiano precisam ser numericos.';
    end;
    if v_max <= v_min or v_max_y <= v_min_y
       or v_target not between v_min and v_max
       or v_target_y not between v_min_y and v_max_y
       or v_target <> trunc(v_target)
       or v_target_y <> trunc(v_target_y) then
      raise exception 'Revise os limites e o ponto inteiro do plano cartesiano.';
    end if;
  elsif v_modo = 'reta_numerica' then
    if new.tipo <> 'numerica' then
      raise exception 'A reta numerica deve usar resposta numerica.';
    end if;
    begin
      v_min := (new.configuracao->>'min')::numeric;
      v_max := (new.configuracao->>'max')::numeric;
      v_step := (new.configuracao->>'step')::numeric;
      v_target := (new.configuracao->>'target')::numeric;
    exception when others then
      raise exception 'Os valores da reta numerica precisam ser numericos.';
    end;
    if v_max <= v_min or v_step <= 0 or v_target not between v_min and v_max then
      raise exception 'Revise os limites, o intervalo e a resposta da reta numerica.';
    end if;
  elsif v_modo = 'pitagoras' then
    if new.tipo <> 'numerica' then
      raise exception 'O modelo de triangulo deve usar resposta numerica.';
    end if;
    begin
      v_min := (new.configuracao->>'sideA')::numeric;
      v_max := (new.configuracao->>'sideB')::numeric;
      v_step := (new.configuracao->>'sideC')::numeric;
      v_target := (new.configuracao->>'target')::numeric;
    exception when others then
      raise exception 'As medidas do triangulo precisam ser numericas.';
    end;
    if least(v_min, v_max, v_step, v_target) <= 0 then
      raise exception 'As medidas e a resposta do triangulo precisam ser maiores que zero.';
    end if;
  elsif v_modo = 'grafico_barras' then
    if new.tipo <> 'unica_escolha'
       or jsonb_typeof(new.configuracao->'chartData') <> 'array'
       or jsonb_array_length(new.configuracao->'chartData') < 2
       or btrim(coalesce(new.configuracao->>'correctLabel', '')) = ''
       or exists (
         select 1
         from jsonb_array_elements(new.configuracao->'chartData') barra
         where jsonb_typeof(barra) <> 'object'
            or btrim(coalesce(barra->>'label', '')) = ''
            or jsonb_typeof(barra->'value') <> 'number'
       )
       or not exists (
         select 1
         from jsonb_array_elements(new.configuracao->'chartData') barra
         where barra->>'label' = new.configuracao->>'correctLabel'
       ) then
      raise exception 'O grafico precisa de ao menos duas barras e uma categoria correta valida.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validar_questao_avaliacao()
  from public, anon, authenticated;

drop trigger if exists validar_questao_avaliacao_trigger
  on public.questoes_avaliacao;
create trigger validar_questao_avaliacao_trigger
before insert or update on public.questoes_avaliacao
for each row execute function private.validar_questao_avaliacao();

create or replace function private.validar_gabarito_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_questao public.questoes_avaliacao;
  v_valor jsonb := new.resposta_esperada->'value';
  v_texto text;
  v_numero numeric;
begin
  select q.* into v_questao
  from public.questoes_avaliacao q
  where q.id = new.questao_id;
  if not found then
    raise exception 'Questao do gabarito nao encontrada.';
  end if;

  if v_questao.tipo in ('dissertativa', 'codigo', 'estudo_caso') then
    return new;
  end if;
  if v_valor is null or v_valor = 'null'::jsonb then
    raise exception 'Defina o gabarito da questao %.', v_questao.ordem;
  end if;

  if v_questao.tipo = 'unica_escolha' then
    v_texto := private.normalizar_resposta_avaliacao(v_valor);
    if not exists (
      select 1 from jsonb_array_elements_text(v_questao.alternativas) opcao
      where private.normalizar_resposta_avaliacao(to_jsonb(opcao)) = v_texto
    ) then
      raise exception 'O gabarito da questao % nao pertence as alternativas.', v_questao.ordem;
    end if;
  elsif v_questao.tipo = 'multipla_escolha' then
    if jsonb_typeof(v_valor) <> 'array' or jsonb_array_length(v_valor) = 0
       or exists (
         select 1 from jsonb_array_elements_text(v_valor) resposta
         where not exists (
           select 1 from jsonb_array_elements_text(v_questao.alternativas) opcao
           where private.normalizar_resposta_avaliacao(to_jsonb(opcao)) =
                 private.normalizar_resposta_avaliacao(to_jsonb(resposta))
         )
       ) then
      raise exception 'Revise as alternativas corretas da questao %.', v_questao.ordem;
    end if;
  elsif v_questao.tipo = 'verdadeiro_falso' then
    if private.normalizar_resposta_avaliacao(v_valor) not in ('verdadeiro', 'falso') then
      raise exception 'O gabarito deve ser Verdadeiro ou Falso.';
    end if;
  elsif v_questao.tipo in ('numerica', 'calculo') then
    begin
      v_numero := replace(private.normalizar_resposta_avaliacao(v_valor), ',', '.')::numeric;
    exception when others then
      raise exception 'O gabarito da questao % precisa ser numerico.', v_questao.ordem;
    end;
  elsif v_questao.tipo = 'resposta_curta' then
    if btrim(private.normalizar_resposta_avaliacao(v_valor)) = '' then
      raise exception 'Defina uma resposta curta para a questao %.', v_questao.ordem;
    end if;
  elsif v_questao.tipo = 'associacao' then
    if jsonb_typeof(v_valor) <> 'array'
       or jsonb_array_length(v_valor) <> jsonb_array_length(v_questao.configuracao->'pairs') then
      raise exception 'O gabarito da associacao nao corresponde aos pares cadastrados.';
    end if;
  elsif v_questao.tipo = 'ordenacao' then
    if jsonb_typeof(v_valor) <> 'array'
       or v_valor is distinct from v_questao.alternativas then
      raise exception 'O gabarito da ordenacao precisa seguir a sequencia cadastrada.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validar_gabarito_avaliacao()
  from public, anon, authenticated;

drop trigger if exists validar_gabarito_avaliacao_trigger
  on public.gabaritos_avaliacao;
create trigger validar_gabarito_avaliacao_trigger
before insert or update on public.gabaritos_avaliacao
for each row execute function private.validar_gabarito_avaliacao();

create or replace function private.corrigir_entrega_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avaliacao public.avaliacoes_docentes%rowtype;
  v_questoes_obrigatorias integer;
  v_respostas_obrigatorias integer;
  v_automaticos numeric(6,2) := 0;
  v_requer_revisao boolean := false;
  v_correta boolean;
  v_resposta_texto text;
  v_esperada_texto text;
  v_tolerancia numeric := 0;
  v_item record;
begin
  if new.status is not distinct from old.status then return new; end if;
  if (select public.usuario_role()) <> 'aluno' then return new; end if;
  if old.status <> 'em_andamento' or new.status <> 'enviada' then
    raise exception 'Esta tentativa nao pode ser enviada neste estado.';
  end if;
  if (select auth.uid()) is null or new.aluno_id <> (select auth.uid()) then
    raise exception 'Somente o aluno responsavel pode entregar esta tentativa.';
  end if;

  select a.* into v_avaliacao
  from public.avaliacoes_docentes a
  where a.id = new.avaliacao_id
  for share;
  if not found or v_avaliacao.turma_id <> (select public.usuario_turma_id()) then
    raise exception 'A atividade nao pertence a turma do aluno.';
  end if;
  if v_avaliacao.encerra_em is not null and v_avaliacao.encerra_em < now() then
    raise exception 'O prazo desta atividade foi encerrado.';
  end if;

  select count(*) into v_questoes_obrigatorias
  from public.questoes_avaliacao q
  where q.avaliacao_id = new.avaliacao_id and q.obrigatoria;
  select count(*) into v_respostas_obrigatorias
  from public.respostas_avaliacao r
  join public.questoes_avaliacao q on q.id = r.questao_id
  where r.tentativa_id = new.id and q.avaliacao_id = new.avaliacao_id
    and q.obrigatoria and r.resposta <> 'null'::jsonb;
  if v_respostas_obrigatorias < v_questoes_obrigatorias then
    raise exception 'Responda todas as questoes obrigatorias antes de enviar.';
  end if;

  for v_item in
    select r.id as resposta_id, r.resposta, q.tipo, q.pontos, q.explicacao,
      q.configuracao, g.resposta_esperada
    from public.respostas_avaliacao r
    join public.questoes_avaliacao q on q.id = r.questao_id
    join public.gabaritos_avaliacao g on g.questao_id = q.id
    where r.tentativa_id = new.id
    order by q.ordem
  loop
    if v_item.tipo in ('dissertativa', 'codigo', 'estudo_caso') then
      v_requer_revisao := true;
      update public.respostas_avaliacao
      set status_correcao = 'revisao', correta = null, pontos_automaticos = 0,
        feedback = null, corrigida_em = null
      where id = v_item.resposta_id;
      continue;
    end if;

    v_resposta_texto := private.normalizar_resposta_avaliacao(v_item.resposta);
    v_esperada_texto := private.normalizar_resposta_avaliacao(v_item.resposta_esperada->'value');
    v_correta := false;

    if v_item.tipo in ('numerica', 'calculo') then
      begin
        v_tolerancia := greatest(0, coalesce(nullif(v_item.configuracao->>'tolerance', '')::numeric, 0));
        v_correta := abs(
          replace(v_resposta_texto, ',', '.')::numeric -
          replace(v_esperada_texto, ',', '.')::numeric
        ) <= v_tolerancia;
      exception when others then
        v_correta := false;
      end;
    elsif v_item.tipo = 'multipla_escolha' then
      v_correta := (
        select coalesce(jsonb_agg(valor order by valor), '[]'::jsonb)
        from jsonb_array_elements_text(
          case when jsonb_typeof(v_item.resposta) = 'array'
            then v_item.resposta else '[]'::jsonb end
        ) valor
      ) = (
        select coalesce(jsonb_agg(valor order by valor), '[]'::jsonb)
        from jsonb_array_elements_text(v_item.resposta_esperada->'value') valor
      );
    elsif v_item.tipo in ('associacao', 'ordenacao') then
      v_correta := v_item.resposta = v_item.resposta_esperada->'value';
    elsif v_item.tipo = 'resposta_curta' then
      v_correta := v_resposta_texto = v_esperada_texto
        or (
          jsonb_typeof(v_item.configuracao->'acceptedAnswers') = 'array'
          and exists (
            select 1
            from jsonb_array_elements(v_item.configuracao->'acceptedAnswers') alternativa
            where private.normalizar_resposta_avaliacao(alternativa) = v_resposta_texto
          )
        );
    else
      v_correta := v_resposta_texto = v_esperada_texto;
    end if;

    if v_correta then v_automaticos := v_automaticos + v_item.pontos; end if;
    update public.respostas_avaliacao
    set status_correcao = 'automatica', correta = v_correta,
      pontos_automaticos = case when v_correta then v_item.pontos else 0 end,
      feedback = case
        when v_avaliacao.feedback_imediato or v_avaliacao.exibir_gabarito then v_item.explicacao
        else null
      end,
      corrigida_em = now()
    where id = v_item.resposta_id;
  end loop;

  new.pontuacao_automatica := v_automaticos;
  new.pontuacao_manual := 0;
  new.requer_revisao := v_requer_revisao;
  new.enviada_em := now();
  new.bloqueada_em := now();
  new.nota := v_automaticos;
  new.status := case when v_requer_revisao then 'enviada' else 'corrigida' end;
  new.corrigida_em := case when v_requer_revisao then null else now() end;
  new.feedback := case when v_requer_revisao
    then 'Aguardando revisao do professor.' else 'Correcao automatica concluida.' end;

  insert into public.avaliacoes_auditoria
    (avaliacao_id, tentativa_id, ator_id, evento, detalhes)
  values (new.avaliacao_id, new.id, new.aluno_id, 'entregue', jsonb_build_object(
    'numero_tentativa', new.numero_tentativa,
    'pontuacao_automatica', v_automaticos,
    'requer_revisao', v_requer_revisao
  ));
  return new;
end;
$$;

revoke all on function private.corrigir_entrega_avaliacao()
  from public, anon, authenticated;

drop policy if exists ajustes_notas_insert
  on public.ajustes_notas_avaliacao;
create policy ajustes_notas_insert on public.ajustes_notas_avaliacao
for insert to authenticated with check (
  ajustes_notas_avaliacao.ajustado_por = (select auth.uid())
  and exists (
    select 1
    from public.tentativas_avaliacao t
    join public.avaliacoes_docentes a on a.id = t.avaliacao_id
    where t.id = ajustes_notas_avaliacao.tentativa_id
      and t.avaliacao_id = ajustes_notas_avaliacao.avaliacao_id
      and t.aluno_id = ajustes_notas_avaliacao.aluno_id
      and t.status = 'corrigida'
      and ajustes_notas_avaliacao.nota_anterior is not distinct from t.nota
      and ajustes_notas_avaliacao.nota_nova <= a.valor
      and (
        a.professor_id = (select auth.uid())
        or (select public.usuario_role()) = 'gestor'
      )
  )
);

notify pgrst, 'reload schema';

commit;
