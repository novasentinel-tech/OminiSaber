-- OminiSaber | Protege gabarito e resolucao do laboratorio geometrico

begin;

create or replace function private.hidratar_configuracao_geometria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resposta text;
begin
  if new.configuracao->>'mathMode' = 'geometria_medidas'
     and not (new.configuracao ? 'target')
     and tg_op = 'UPDATE' then
    select g.resposta_esperada->>'value'
      into v_resposta
    from public.gabaritos_avaliacao g
    where g.questao_id = old.id;

    if nullif(v_resposta, '') is not null then
      new.configuracao := new.configuracao
        || jsonb_build_object('target', v_resposta);
    end if;
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
begin
  if new.configuracao->>'mathMode' = 'geometria_medidas' then
    new.configuracao := new.configuracao - 'target' - 'solution';
  end if;

  return new;
end;
$$;

revoke all on function private.hidratar_configuracao_geometria()
  from public, anon, authenticated;
revoke all on function private.proteger_configuracao_geometria()
  from public, anon, authenticated;

drop trigger if exists aa_hidratar_configuracao_geometria
  on public.questoes_avaliacao;
create trigger aa_hidratar_configuracao_geometria
before insert or update on public.questoes_avaliacao
for each row execute function private.hidratar_configuracao_geometria();

drop trigger if exists zz_proteger_configuracao_geometria
  on public.questoes_avaliacao;
create trigger zz_proteger_configuracao_geometria
before insert or update on public.questoes_avaliacao
for each row execute function private.proteger_configuracao_geometria();

notify pgrst, 'reload schema';

commit;
