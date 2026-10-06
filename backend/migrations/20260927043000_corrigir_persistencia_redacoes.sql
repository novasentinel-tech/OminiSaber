begin;

-- O cliente autenticado precisa de privilégios de tabela e de políticas RLS.
-- A RLS continua sendo a fronteira que limita cada aluno aos próprios textos.
alter table public.redacoes enable row level security;

revoke all on table public.redacoes from anon;
revoke all on table public.redacoes from authenticated;
grant select, insert, update on table public.redacoes to authenticated;

create unique index if not exists redacoes_rascunho_tema_unique
  on public.redacoes (aluno_id, tema_codigo)
  where status = 'rascunho' and tema_codigo is not null;

drop policy if exists redacoes_insert_proprias on public.redacoes;
create policy redacoes_insert_proprias
on public.redacoes
for insert
to authenticated
with check (
  aluno_id = (select auth.uid())
  and status = 'rascunho'
  and (
    proposta_id is null
    or exists (
      select 1
      from public.propostas_redacao proposta
      where proposta.id = proposta_id
        and proposta.publicada = true
    )
  )
);

drop policy if exists redacoes_update_aluno on public.redacoes;
create policy redacoes_update_aluno
on public.redacoes
for update
to authenticated
using (
  aluno_id = (select auth.uid())
  and status = 'rascunho'
)
with check (
  aluno_id = (select auth.uid())
  and status in ('rascunho', 'enviada')
);

comment on policy redacoes_insert_proprias on public.redacoes is
  'Aluno autenticado cria somente o próprio rascunho em proposta publicada.';
comment on policy redacoes_update_aluno on public.redacoes is
  'Aluno autenticado salva e envia somente o próprio rascunho.';

commit;
