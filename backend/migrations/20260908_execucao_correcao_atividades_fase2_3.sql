-- OminiSaber | Fase 2.3 - execucao do aluno e correcao automatica

begin;

create or replace function private.normalizar_resposta_avaliacao(p_valor jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(
    case
      when jsonb_typeof(p_valor) = 'object' and p_valor ? 'value' then p_valor->>'value'
      when jsonb_typeof(p_valor) = 'string' then p_valor #>> '{}'
      else p_valor::text
    end,
    ''
  )), '\s+', ' ', 'g'));
$$;

revoke all on function private.normalizar_resposta_avaliacao(jsonb) from public, anon, authenticated;

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
  v_item record;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if (select public.usuario_role()) <> 'aluno' then
    return new;
  end if;
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
      g.resposta_esperada
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
    else
      v_resposta_texto := private.normalizar_resposta_avaliacao(v_item.resposta);
      v_esperada_texto := private.normalizar_resposta_avaliacao(v_item.resposta_esperada->'value');
      if v_item.tipo = 'numerica' then
        begin
          v_correta := abs(replace(v_resposta_texto, ',', '.')::numeric - replace(v_esperada_texto, ',', '.')::numeric) <= 0.000001;
        exception when others then
          v_correta := false;
        end;
      elsif v_item.tipo = 'multipla_escolha' then
        v_correta := (
          select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
          from jsonb_array_elements_text(
            case when jsonb_typeof(v_item.resposta) = 'array' then v_item.resposta else coalesce(v_item.resposta->'value', '[]'::jsonb) end
          ) x
        ) = (
          select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
          from jsonb_array_elements_text(
            case when jsonb_typeof(v_item.resposta_esperada->'value') = 'array' then v_item.resposta_esperada->'value' else '[]'::jsonb end
          ) x
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
    end if;
  end loop;

  new.pontuacao_automatica := v_automaticos;
  new.pontuacao_manual := 0;
  new.requer_revisao := v_requer_revisao;
  new.enviada_em := now();
  new.bloqueada_em := now();
  new.nota := v_automaticos;
  new.status := case when v_requer_revisao then 'enviada' else 'corrigida' end;
  new.corrigida_em := case when v_requer_revisao then null else now() end;
  new.feedback := case when v_requer_revisao then 'Aguardando revisao do professor.' else 'Correcao automatica concluida.' end;

  insert into public.avaliacoes_auditoria (avaliacao_id, tentativa_id, ator_id, evento, detalhes)
  values (new.avaliacao_id, new.id, new.aluno_id, 'entregue', jsonb_build_object(
    'numero_tentativa', new.numero_tentativa,
    'pontuacao_automatica', v_automaticos,
    'requer_revisao', v_requer_revisao
  ));
  return new;
end;
$$;

revoke all on function private.corrigir_entrega_avaliacao() from public, anon, authenticated;

drop trigger if exists corrigir_entrega_avaliacao_trigger on public.tentativas_avaliacao;
create trigger corrigir_entrega_avaliacao_trigger
before update of status on public.tentativas_avaliacao
for each row execute function private.corrigir_entrega_avaliacao();

grant update (status, enviada_em) on public.tentativas_avaliacao to authenticated;

drop policy if exists tentativas_update_aluno on public.tentativas_avaliacao;
create policy tentativas_update_aluno on public.tentativas_avaliacao
for update to authenticated
using (
  aluno_id = (select auth.uid()) and status = 'em_andamento'
)
with check (
  aluno_id = (select auth.uid()) and status in ('enviada', 'corrigida')
);

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

create or replace function public.salvar_resposta_avaliacao(
  p_tentativa_id uuid,
  p_questao_id uuid,
  p_resposta jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_resposta_id uuid;
begin
  if (select auth.uid()) is null or (select public.usuario_role()) <> 'aluno' then
    raise exception 'Uma conta de aluno autenticada e obrigatoria.';
  end if;
  if not exists (
    select 1 from public.tentativas_avaliacao t
    join public.questoes_avaliacao q on q.avaliacao_id = t.avaliacao_id
    where t.id = p_tentativa_id and t.aluno_id = (select auth.uid())
      and t.status = 'em_andamento' and q.id = p_questao_id
  ) then
    raise exception 'Tentativa ou questao indisponivel.';
  end if;
  insert into public.respostas_avaliacao (tentativa_id, questao_id, aluno_id, resposta)
  values (p_tentativa_id, p_questao_id, (select auth.uid()), coalesce(p_resposta, 'null'::jsonb))
  on conflict (tentativa_id, questao_id) do update
  set resposta = excluded.resposta, updated_at = now()
  returning id into v_resposta_id;
  return v_resposta_id;
end;
$$;

create or replace function public.entregar_tentativa_avaliacao(p_tentativa_id uuid)
returns table (
  tentativa_id uuid,
  status text,
  nota numeric,
  pontuacao_automatica numeric,
  requer_revisao boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.tentativas_avaliacao t
  set status = 'enviada', enviada_em = now()
  where t.id = p_tentativa_id and t.aluno_id = (select auth.uid()) and t.status = 'em_andamento';
  if not found then raise exception 'Tentativa indisponivel para entrega.'; end if;
  return query select t.id, t.status, t.nota, t.pontuacao_automatica, t.requer_revisao
  from public.tentativas_avaliacao t where t.id = p_tentativa_id;
end;
$$;

revoke all on function public.iniciar_tentativa_avaliacao(uuid) from public, anon;
revoke all on function public.salvar_resposta_avaliacao(uuid, uuid, jsonb) from public, anon;
revoke all on function public.entregar_tentativa_avaliacao(uuid) from public, anon;
grant execute on function public.iniciar_tentativa_avaliacao(uuid) to authenticated;
grant execute on function public.salvar_resposta_avaliacao(uuid, uuid, jsonb) to authenticated;
grant execute on function public.entregar_tentativa_avaliacao(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
