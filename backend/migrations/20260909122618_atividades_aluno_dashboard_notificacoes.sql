begin;

alter table public.notificacoes
  add column if not exists avaliacao_id uuid;

do $$
begin
  alter table public.notificacoes
    add constraint notificacoes_avaliacao_id_fkey
    foreign key (avaliacao_id)
    references public.avaliacoes_docentes(id)
    on delete cascade;
exception
  when duplicate_object then null;
end $$;

create unique index if not exists notificacoes_avaliacao_id_key
  on public.notificacoes (avaliacao_id)
  where avaliacao_id is not null;

create or replace function private.sincronizar_notificacao_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titulo text;
  v_mensagem text;
begin
  if new.status = 'publicado' then
    v_titulo := case new.categoria
      when 'avaliacao' then 'Nova avaliação disponível'
      when 'diagnostica' then 'Nova atividade diagnóstica'
      when 'recuperacao' then 'Nova recuperação disponível'
      else 'Nova atividade disponível'
    end;

    v_mensagem := new.titulo || case
      when new.encerra_em is null then ' · confira as orientações do professor.'
      else ' · entrega até ' || to_char(
        new.encerra_em at time zone 'America/Sao_Paulo',
        'DD/MM/YYYY às HH24:MI'
      )
    end;

    insert into public.notificacoes (
      titulo,
      mensagem,
      tipo,
      prioridade,
      destino_turma_id,
      criado_por,
      avaliacao_id,
      link,
      expira_em,
      updated_at
    )
    values (
      v_titulo,
      v_mensagem,
      'avaliacao',
      case when new.categoria in ('avaliacao', 'recuperacao') then 'alta' else 'normal' end,
      new.turma_id,
      new.professor_id,
      new.id,
      '../atividades/index.html?atividade=' || new.id,
      new.encerra_em,
      now()
    )
    on conflict (avaliacao_id) where avaliacao_id is not null do update set
      titulo = excluded.titulo,
      mensagem = excluded.mensagem,
      prioridade = excluded.prioridade,
      destino_turma_id = excluded.destino_turma_id,
      criado_por = excluded.criado_por,
      link = excluded.link,
      expira_em = excluded.expira_em,
      updated_at = now();
  else
    delete from public.notificacoes
    where avaliacao_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function private.sincronizar_notificacao_avaliacao()
  from public, anon, authenticated;

drop trigger if exists trg_sincronizar_notificacao_avaliacao
  on public.avaliacoes_docentes;
create trigger trg_sincronizar_notificacao_avaliacao
after insert or update of status, turma_id, encerra_em
on public.avaliacoes_docentes
for each row execute function private.sincronizar_notificacao_avaliacao();

insert into public.notificacoes (
  titulo,
  mensagem,
  tipo,
  prioridade,
  destino_turma_id,
  criado_por,
  avaliacao_id,
  link,
  expira_em,
  updated_at
)
select
  case a.categoria
    when 'avaliacao' then 'Nova avaliação disponível'
    when 'diagnostica' then 'Nova atividade diagnóstica'
    when 'recuperacao' then 'Nova recuperação disponível'
    else 'Nova atividade disponível'
  end,
  a.titulo || case
    when a.encerra_em is null then ' · confira as orientações do professor.'
    else ' · entrega até ' || to_char(
      a.encerra_em at time zone 'America/Sao_Paulo',
      'DD/MM/YYYY às HH24:MI'
    )
  end,
  'avaliacao',
  case when a.categoria in ('avaliacao', 'recuperacao') then 'alta' else 'normal' end,
  a.turma_id,
  a.professor_id,
  a.id,
  '../atividades/index.html?atividade=' || a.id,
  a.encerra_em,
  now()
from public.avaliacoes_docentes a
where a.status = 'publicado'
on conflict (avaliacao_id) where avaliacao_id is not null do update set
  titulo = excluded.titulo,
  mensagem = excluded.mensagem,
  prioridade = excluded.prioridade,
  destino_turma_id = excluded.destino_turma_id,
  criado_por = excluded.criado_por,
  link = excluded.link,
  expira_em = excluded.expira_em,
  updated_at = now();

commit;
