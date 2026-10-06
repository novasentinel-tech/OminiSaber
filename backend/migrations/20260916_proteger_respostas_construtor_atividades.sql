-- OminiSaber | Protecao de respostas e resolucoes do construtor de atividades

begin;

-- Preserva resolucoes docentes que ainda estavam na configuracao publica.
update public.gabaritos_avaliacao g
set resposta_esperada = jsonb_set(
  g.resposta_esperada,
  '{normalization}',
  coalesce(g.resposta_esperada->'normalization', '{}'::jsonb)
    || case
         when q.configuracao ? 'solution'
           then jsonb_build_object('solution', q.configuracao->'solution')
         else '{}'::jsonb
       end,
  true
)
from public.questoes_avaliacao q
where q.id = g.questao_id
  and q.configuracao ? 'solution';

create or replace function private.hidratar_configuracao_geometria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resposta text;
  v_modo text := new.configuracao->>'mathMode';
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  select g.resposta_esperada->>'value'
    into v_resposta
  from public.gabaritos_avaliacao g
  where g.questao_id = old.id;

  if nullif(v_resposta, '') is null then
    return new;
  end if;

  if v_modo = 'plano_cartesiano'
     and not (new.configuracao ? 'targetX')
     and position(';' in v_resposta) > 0 then
    new.configuracao := new.configuracao || jsonb_build_object(
      'targetX', split_part(v_resposta, ';', 1)::numeric,
      'targetY', split_part(v_resposta, ';', 2)::numeric
    );
  elsif v_modo in ('reta_numerica', 'pitagoras', 'geometria_medidas')
        and not (new.configuracao ? 'target') then
    new.configuracao := new.configuracao
      || jsonb_build_object('target', v_resposta::numeric);
  elsif v_modo = 'grafico_barras'
        and not (new.configuracao ? 'correctLabel') then
    new.configuracao := new.configuracao
      || jsonb_build_object('correctLabel', v_resposta);
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
begin
  new.configuracao := new.configuracao - 'solution';

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

-- Regrava as configuracoes existentes para aplicar a protecao apos a validacao.
update public.questoes_avaliacao
set configuracao = configuracao
where configuracao ? 'solution'
   or configuracao->>'mathMode' in (
     'plano_cartesiano',
     'reta_numerica',
     'pitagoras',
     'geometria_medidas',
     'grafico_barras'
   );

notify pgrst, 'reload schema';

commit;
