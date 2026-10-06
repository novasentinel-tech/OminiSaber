begin;

create or replace function private.hidratar_configuracao_geometria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resposta jsonb;
  v_modo text := new.configuracao->>'mathMode';
  v_esquerda jsonb;
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

  if new.tipo = 'associacao' and jsonb_typeof(v_resposta) = 'array' then
    v_esquerda := coalesce(
      new.configuracao->'associationLeft',
      (
        select jsonb_agg(par->>'left' order by ordem)
        from jsonb_array_elements(new.configuracao->'pairs')
          with ordinality item(par, ordem)
        where nullif(btrim(par->>'left'), '') is not null
      ),
      new.alternativas
    );

    new.configuracao := new.configuracao || jsonb_build_object(
      'pairs',
      coalesce((
        select jsonb_agg(
          jsonb_build_object('left', esquerda.valor, 'right', direita.valor)
          order by esquerda.ordem
        )
        from jsonb_array_elements_text(v_esquerda)
          with ordinality esquerda(valor, ordem)
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
  elsif v_modo = 'reta_numerica' and not (new.configuracao ? 'targetValue') then
    new.configuracao := new.configuracao || jsonb_build_object(
      'targetValue', (v_resposta #>> '{}')::numeric
    );
  elsif v_modo = 'leitura_grafico' and not (new.configuracao ? 'correctIndex') then
    new.configuracao := new.configuracao || jsonb_build_object(
      'correctIndex', (v_resposta #>> '{}')::integer
    );
  elsif v_modo = 'geometria_medidas' then
    new.configuracao := new.configuracao || jsonb_build_object(
      'expectedValue', (v_resposta #>> '{}')::numeric,
      'solution', coalesce(
        new.configuracao->>'solution',
        (select g.resposta_esperada->>'explanation'
         from public.gabaritos_avaliacao g
         where g.questao_id = old.id),
        ''
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.hidratar_configuracao_geometria() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
