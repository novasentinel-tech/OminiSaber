-- OminiSaber | Fase 2.3 - correcao docente com privilegios minimos por RLS

begin;

grant update (status_correcao, correta, pontos_manuais, feedback, corrigida_em, updated_at)
  on public.respostas_avaliacao to authenticated;

drop policy if exists respostas_avaliacao_correcao_docente on public.respostas_avaliacao;
create policy respostas_avaliacao_correcao_docente on public.respostas_avaliacao
for update to authenticated
using (
  status_correcao in ('revisao', 'manual')
  and exists (
    select 1 from public.tentativas_avaliacao t
    join public.avaliacoes_docentes a on a.id = t.avaliacao_id
    where t.id = tentativa_id and t.status in ('enviada', 'corrigida')
      and (a.professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor')
  )
)
with check (
  status_correcao = 'manual' and pontos_manuais >= 0
  and pontos_manuais <= (select q.pontos from public.questoes_avaliacao q where q.id = questao_id)
  and exists (
    select 1 from public.tentativas_avaliacao t
    join public.avaliacoes_docentes a on a.id = t.avaliacao_id
    where t.id = tentativa_id and t.status in ('enviada', 'corrigida')
      and (a.professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor')
  )
);

create or replace function private.recalcular_tentativa_correcao_docente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avaliacao public.avaliacoes_docentes;
  v_automatica numeric(8,2);
  v_manual numeric(8,2);
  v_pendentes integer;
begin
  if new.status_correcao <> 'manual' then return new; end if;
  select a.* into v_avaliacao
  from public.tentativas_avaliacao t
  join public.avaliacoes_docentes a on a.id = t.avaliacao_id
  where t.id = new.tentativa_id;
  select coalesce(sum(r.pontos_automaticos), 0),
    coalesce(sum(r.pontos_manuais), 0),
    count(*) filter (where r.status_correcao in ('pendente', 'revisao'))
  into v_automatica, v_manual, v_pendentes
  from public.respostas_avaliacao r where r.tentativa_id = new.tentativa_id;
  update public.tentativas_avaliacao t
  set pontuacao_automatica = v_automatica, pontuacao_manual = v_manual,
      nota = least(v_avaliacao.valor, v_automatica + v_manual),
      requer_revisao = v_pendentes > 0,
      status = case when v_pendentes = 0 then 'corrigida' else 'enviada' end,
      corrigida_em = case when v_pendentes = 0 then now() else null end,
      feedback = case when v_pendentes = 0
        then 'Correcao concluida. Consulte as devolutivas em cada questao.' else t.feedback end
  where t.id = new.tentativa_id;
  insert into public.avaliacoes_auditoria
    (avaliacao_id, tentativa_id, ator_id, evento, detalhes)
  values (v_avaliacao.id, new.tentativa_id, (select auth.uid()), 'resposta_corrigida',
    jsonb_build_object('resposta_id', new.id, 'pontos', new.pontos_manuais,
      'correcao_concluida', v_pendentes = 0));
  return new;
end;
$$;

revoke all on function private.recalcular_tentativa_correcao_docente()
  from public, anon, authenticated;
drop trigger if exists recalcular_tentativa_correcao_docente_trigger on public.respostas_avaliacao;
create trigger recalcular_tentativa_correcao_docente_trigger
after update of status_correcao, pontos_manuais, feedback on public.respostas_avaliacao
for each row execute function private.recalcular_tentativa_correcao_docente();

create or replace function public.corrigir_resposta_avaliacao(
  p_resposta_id uuid, p_pontos numeric, p_feedback text default null
)
returns table (
  resposta_id uuid, tentativa_id uuid, status_tentativa text, nota numeric,
  pontuacao_automatica numeric, pontuacao_manual numeric, requer_revisao boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_resposta public.respostas_avaliacao;
  v_tentativa public.tentativas_avaliacao;
  v_avaliacao public.avaliacoes_docentes;
  v_maximo numeric(6,2);
begin
  if (select auth.uid()) is null then raise exception 'Sessao autenticada obrigatoria.'; end if;
  select r.* into v_resposta from public.respostas_avaliacao r
  where r.id = p_resposta_id for update;
  if not found then raise exception 'Resposta nao encontrada.'; end if;
  select t.* into v_tentativa from public.tentativas_avaliacao t where t.id = v_resposta.tentativa_id;
  select a.* into v_avaliacao from public.avaliacoes_docentes a where a.id = v_tentativa.avaliacao_id;
  if (select public.usuario_role()) <> 'gestor'
     and v_avaliacao.professor_id <> (select auth.uid()) then
    raise exception 'Voce nao pode corrigir esta resposta.';
  end if;
  if v_tentativa.status not in ('enviada', 'corrigida') then raise exception 'A tentativa ainda nao foi entregue.'; end if;
  if v_resposta.status_correcao not in ('revisao', 'manual') then raise exception 'Esta resposta nao aceita correcao manual.'; end if;
  select q.pontos into v_maximo from public.questoes_avaliacao q where q.id = v_resposta.questao_id;
  if p_pontos is null or p_pontos < 0 or p_pontos > v_maximo then
    raise exception 'A pontuacao deve estar entre 0 e %.', v_maximo;
  end if;
  update public.respostas_avaliacao r
  set status_correcao = 'manual', correta = (p_pontos = v_maximo),
      pontos_manuais = round(p_pontos, 2),
      feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
      corrigida_em = now(), updated_at = now()
  where r.id = p_resposta_id;
  return query select r.id, t.id, t.status, t.nota, t.pontuacao_automatica,
    t.pontuacao_manual, t.requer_revisao
  from public.respostas_avaliacao r
  join public.tentativas_avaliacao t on t.id = r.tentativa_id
  where r.id = p_resposta_id;
end;
$$;

revoke all on function public.corrigir_resposta_avaliacao(uuid, numeric, text) from public, anon;
grant execute on function public.corrigir_resposta_avaliacao(uuid, numeric, text) to authenticated;

notify pgrst, 'reload schema';

commit;
