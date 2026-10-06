-- OminiSaber | Correções de recuperação e ajuste de nota
-- Mantém as operações sob RLS e concede apenas o acesso necessário.

begin;

grant insert on public.avaliacoes_auditoria to authenticated;

drop policy if exists avaliacoes_auditoria_insert_docente
  on public.avaliacoes_auditoria;
create policy avaliacoes_auditoria_insert_docente
on public.avaliacoes_auditoria
for insert
to authenticated
with check (
  ator_id = (select auth.uid())
  and (
    (select public.usuario_role()) = 'gestor'
    or exists (
      select 1
      from public.avaliacoes_docentes avaliacao
      where avaliacao.id = avaliacao_id
        and avaliacao.professor_id = (select auth.uid())
    )
  )
);

create or replace function public.ajustar_nota_avaliacao(
  p_tentativa_id uuid,
  p_nota numeric,
  p_motivo text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tentativa public.tentativas_avaliacao;
  v_avaliacao public.avaliacoes_docentes;
  v_id uuid;
begin
  -- FOR SHARE exigia um privilégio de escrita que o professor não deve possuir.
  select tentativa.*
    into v_tentativa
  from public.tentativas_avaliacao tentativa
  where tentativa.id = p_tentativa_id;

  if not found then
    raise exception 'Tentativa nao encontrada.';
  end if;

  select avaliacao.*
    into v_avaliacao
  from public.avaliacoes_docentes avaliacao
  where avaliacao.id = v_tentativa.avaliacao_id;

  if not found then
    raise exception 'Avaliacao nao encontrada.';
  end if;
  if v_tentativa.status <> 'corrigida' then
    raise exception 'Finalize a correcao antes de ajustar a nota.';
  end if;
  if v_avaliacao.professor_id <> (select auth.uid())
     and (select public.usuario_role()) <> 'gestor' then
    raise exception 'Sem permissao para ajustar esta nota.';
  end if;
  if p_nota is null or p_nota < 0 or p_nota > v_avaliacao.valor then
    raise exception 'A nota deve estar entre 0 e %.', v_avaliacao.valor;
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 8 then
    raise exception 'Explique o motivo do ajuste com pelo menos 8 caracteres.';
  end if;

  insert into public.ajustes_notas_avaliacao (
    tentativa_id,
    avaliacao_id,
    aluno_id,
    ajustado_por,
    nota_anterior,
    nota_nova,
    motivo
  ) values (
    v_tentativa.id,
    v_avaliacao.id,
    v_tentativa.aluno_id,
    (select auth.uid()),
    v_tentativa.nota,
    round(p_nota, 2),
    btrim(p_motivo)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ajustar_nota_avaliacao(uuid, numeric, text)
  from public, anon;
grant execute on function public.ajustar_nota_avaliacao(uuid, numeric, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
