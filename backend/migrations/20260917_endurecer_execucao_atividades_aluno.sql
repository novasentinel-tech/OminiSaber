-- OminiSaber | Pente-fino da execucao de atividades pelo aluno

begin;

create or replace function private.resposta_avaliacao_preenchida(valor jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when valor is null or valor = 'null'::jsonb then true
    when jsonb_typeof(valor) = 'string' then btrim(valor #>> '{}') <> ''
    when jsonb_typeof(valor) = 'array' then
      jsonb_array_length(valor) > 0
      and not exists (
        select 1
        from jsonb_array_elements(valor) item
        where item = 'null'::jsonb
           or (jsonb_typeof(item) = 'string' and btrim(item #>> '{}') = '')
      )
    when jsonb_typeof(valor) = 'object' then valor <> '{}'::jsonb
    else true
  end;
$$;

revoke all on function private.resposta_avaliacao_preenchida(jsonb)
  from public, anon, authenticated;

update public.respostas_avaliacao
set resposta = 'null'::jsonb,
    updated_at = now()
where not private.resposta_avaliacao_preenchida(resposta);

alter table public.respostas_avaliacao
  drop constraint if exists respostas_avaliacao_resposta_preenchida_check;
alter table public.respostas_avaliacao
  add constraint respostas_avaliacao_resposta_preenchida_check
  check (private.resposta_avaliacao_preenchida(resposta));

create or replace function private.hidratar_configuracao_geometria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resposta jsonb;
  v_modo text := new.configuracao->>'mathMode';
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  select g.resposta_esperada->'value'
    into v_resposta
  from public.gabaritos_avaliacao g
  where g.questao_id = old.id;

  if v_resposta is null or v_resposta = 'null'::jsonb then
    return new;
  end if;

  if new.tipo = 'associacao'
     and jsonb_typeof(v_resposta) = 'array'
     and not (new.configuracao ? 'pairs') then
    new.configuracao := new.configuracao || jsonb_build_object(
      'pairs',
      coalesce((
        select jsonb_agg(
          jsonb_build_object('left', esquerda.valor, 'right', direita.valor)
          order by esquerda.ordem
        )
        from jsonb_array_elements_text(
          coalesce(new.configuracao->'associationLeft', new.alternativas)
        ) with ordinality esquerda(valor, ordem)
        join jsonb_array_elements_text(v_resposta)
          with ordinality direita(valor, ordem)
          using (ordem)
      ), '[]'::jsonb)
    );
  elsif new.tipo = 'ordenacao' and jsonb_typeof(v_resposta) = 'array' then
    new.alternativas := v_resposta;
  elsif v_modo = 'plano_cartesiano'
        and not (new.configuracao ? 'targetX')
        and position(';' in (v_resposta #>> '{}')) > 0 then
    new.configuracao := new.configuracao || jsonb_build_object(
      'targetX', split_part(v_resposta #>> '{}', ';', 1)::numeric,
      'targetY', split_part(v_resposta #>> '{}', ';', 2)::numeric
    );
  elsif v_modo in ('reta_numerica', 'pitagoras', 'geometria_medidas')
        and not (new.configuracao ? 'target') then
    new.configuracao := new.configuracao
      || jsonb_build_object('target', (v_resposta #>> '{}')::numeric);
  elsif v_modo = 'grafico_barras'
        and not (new.configuracao ? 'correctLabel') then
    new.configuracao := new.configuracao
      || jsonb_build_object('correctLabel', v_resposta #>> '{}');
  end if;

  return new;
end;
$$;

create or replace function private.proteger_configuracao_geometria()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_modo text := new.configuracao->>'mathMode';
  v_pares jsonb := new.configuracao->'pairs';
begin
  new.configuracao := new.configuracao - 'solution';

  if new.tipo = 'associacao' and jsonb_typeof(v_pares) = 'array' then
    new.configuracao := (new.configuracao - 'pairs') || jsonb_build_object(
      'pairs', coalesce((
        select jsonb_agg(jsonb_build_object('left', par->>'left') order by ordem)
        from jsonb_array_elements(v_pares) with ordinality item(par, ordem)
      ), '[]'::jsonb),
      'associationLeft', coalesce((
        select jsonb_agg(par->>'left' order by ordem)
        from jsonb_array_elements(v_pares) with ordinality item(par, ordem)
      ), '[]'::jsonb),
      'associationOptions', coalesce((
        select jsonb_agg(par->>'right' order by md5((par->>'right') || new.id::text))
        from jsonb_array_elements(v_pares) item(par)
      ), '[]'::jsonb)
    );
  end if;

  if new.tipo = 'ordenacao' and tg_op = 'UPDATE' then
    new.alternativas := coalesce((
      select jsonb_agg(valor order by md5(valor || new.id::text))
      from jsonb_array_elements_text(new.alternativas) item(valor)
    ), '[]'::jsonb);
  end if;

  if v_modo = 'plano_cartesiano' then
    new.configuracao := new.configuracao - 'targetX' - 'targetY';
  elsif v_modo in ('reta_numerica', 'pitagoras', 'geometria_medidas') then
    new.configuracao := new.configuracao - 'target';
  elsif v_modo = 'grafico_barras' then
    new.configuracao := new.configuracao - 'correctLabel' - 'chartRows';
  end if;

  return new;
end;
$$;

revoke all on function private.hidratar_configuracao_geometria()
  from public, anon, authenticated;
revoke all on function private.proteger_configuracao_geometria()
  from public, anon, authenticated;

create or replace function private.sanitizar_questao_apos_gabarito()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.questoes_avaliacao
  set configuracao = configuracao
  where id = new.questao_id;
  return new;
end;
$$;

revoke all on function private.sanitizar_questao_apos_gabarito()
  from public, anon, authenticated;

drop trigger if exists sanitizar_questao_apos_gabarito
  on public.gabaritos_avaliacao;
create trigger sanitizar_questao_apos_gabarito
after insert or update of resposta_esperada on public.gabaritos_avaliacao
for each row execute function private.sanitizar_questao_apos_gabarito();

update public.questoes_avaliacao
set configuracao = configuracao
where tipo in ('associacao', 'ordenacao');

notify pgrst, 'reload schema';

commit;
