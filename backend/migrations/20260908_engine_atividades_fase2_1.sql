-- OminiSaber | Fase 2.1 - fundacao segura do motor de atividades
-- Consolida as avaliacoes docentes existentes sem duplicar o modulo de trilhas.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Um professor pode atuar em mais de uma materia e turma. Essa relacao substitui
-- autorizacoes baseadas apenas no layout/tipo do professor.
create table if not exists public.professor_turma_materias (
  professor_id uuid not null references public.perfis(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  materia_codigo public.materia_aluno not null,
  atribuido_por uuid references public.perfis(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (professor_id, turma_id, materia_codigo)
);

create index if not exists professor_turma_materias_turma_idx
  on public.professor_turma_materias (turma_id, materia_codigo, professor_id)
  where ativo = true;
create index if not exists professor_turma_materias_professor_idx
  on public.professor_turma_materias (professor_id, materia_codigo, turma_id)
  where ativo = true;
create index if not exists professor_turma_materias_atribuido_por_idx
  on public.professor_turma_materias (atribuido_por)
  where atribuido_por is not null;

insert into public.professor_turma_materias (professor_id, turma_id, materia_codigo)
select pt.professor_id, pt.turma_id,
  case
    when lower(coalesce(pt.materia, '')) like '%matem%' then 'matematica'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like '%fisic%' then 'fisica'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like '%quim%' then 'quimica'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like '%biolog%' then 'biologia'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like any (array['%portugu%', '%literat%', '%linguag%']) then 'portugues'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like '%reda%' then 'redacao'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like any (array['%admin%', '%gest%', '%empreend%', '%marketing%', '%finan%']) then 'tecnico_administracao'::public.materia_aluno
    when lower(coalesce(pt.materia, '')) like any (array['%inform%', '%program%', '%tecnolog%', '%banco de dados%', '%redes%']) then 'tecnico_informatica'::public.materia_aluno
    when p.tipo_professor = 'matematica' then 'matematica'::public.materia_aluno
    when p.tipo_professor = 'portugues' then 'portugues'::public.materia_aluno
    when p.tipo_professor = 'tecnico_administracao' then 'tecnico_administracao'::public.materia_aluno
    when p.tipo_professor = 'tecnico_informatica' then 'tecnico_informatica'::public.materia_aluno
    else null
  end
from public.professor_turmas pt
join public.perfis p on p.id = pt.professor_id
where p.role = 'professor'
on conflict do nothing;

insert into public.professor_turma_materias (professor_id, turma_id, materia_codigo)
select pt.professor_id, pt.turma_id, 'redacao'::public.materia_aluno
from public.professor_turmas pt
join public.perfis p on p.id = pt.professor_id
where p.role = 'professor' and p.tipo_professor = 'portugues'
on conflict do nothing;

create or replace function private.professor_tem_turma_materia(
  p_professor_id uuid,
  p_turma_id uuid,
  p_materia public.materia_aluno
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_professor_id = (select auth.uid())
    and (select public.usuario_role()) = 'professor'
    and exists (
      select 1
      from public.professor_turma_materias ptm
      where ptm.professor_id = p_professor_id
        and ptm.turma_id = p_turma_id
        and ptm.materia_codigo = p_materia
        and ptm.ativo = true
    );
$$;

revoke all on function private.professor_tem_turma_materia(uuid, uuid, public.materia_aluno) from public, anon;
grant execute on function private.professor_tem_turma_materia(uuid, uuid, public.materia_aluno) to authenticated;

-- avaliacoes_docentes passa a ser o registro canonico para atividades,
-- avaliacoes, diagnosticos e recuperacoes criados pelo professor.
alter table public.avaliacoes_docentes
  add column if not exists materia_codigo public.materia_aluno,
  add column if not exists categoria text not null default 'atividade',
  add column if not exists serie smallint,
  add column if not exists trimestre smallint,
  add column if not exists modo_pontuacao text not null default 'igual',
  add column if not exists tentativas_permitidas smallint not null default 1,
  add column if not exists embaralhar_questoes boolean not null default false,
  add column if not exists embaralhar_alternativas boolean not null default false,
  add column if not exists feedback_imediato boolean not null default false,
  add column if not exists exibir_gabarito boolean not null default false,
  add column if not exists versao_atual integer not null default 1;

update public.avaliacoes_docentes
set materia_codigo = case tipo_professor
  when 'matematica' then 'matematica'::public.materia_aluno
  when 'portugues' then 'portugues'::public.materia_aluno
  when 'tecnico_administracao' then 'tecnico_administracao'::public.materia_aluno
  when 'tecnico_informatica' then 'tecnico_informatica'::public.materia_aluno
end
where materia_codigo is null;

alter table public.avaliacoes_docentes alter column materia_codigo set not null;

do $$ begin
  alter table public.avaliacoes_docentes add constraint avaliacoes_docentes_categoria_check
    check (categoria in ('atividade', 'avaliacao', 'diagnostica', 'recuperacao'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.avaliacoes_docentes add constraint avaliacoes_docentes_serie_check
    check (serie is null or serie between 1 and 3);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.avaliacoes_docentes add constraint avaliacoes_docentes_trimestre_check
    check (trimestre is null or trimestre between 1 and 3);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.avaliacoes_docentes add constraint avaliacoes_docentes_modo_pontuacao_check
    check (modo_pontuacao in ('igual', 'manual'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.avaliacoes_docentes add constraint avaliacoes_docentes_tentativas_check
    check (tentativas_permitidas between 1 and 10);
exception when duplicate_object then null;
end $$;

create index if not exists avaliacoes_docentes_professor_materia_idx
  on public.avaliacoes_docentes (professor_id, materia_codigo, status, created_at desc);
create index if not exists avaliacoes_docentes_turma_publicacao_idx
  on public.avaliacoes_docentes (turma_id, status, abre_em, encerra_em);

-- Tipos comuns a todas as materias. Campos de configuracao suportam interacoes
-- especificas sem espalhar colunas ou respostas corretas pelo frontend.
alter table public.questoes_avaliacao drop constraint if exists questoes_avaliacao_tipo_check;
alter table public.questoes_avaliacao
  add column if not exists configuracao jsonb not null default '{}'::jsonb,
  add column if not exists explicacao text,
  add column if not exists obrigatoria boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.questoes_avaliacao add constraint questoes_avaliacao_tipo_check check (tipo in (
    'unica_escolha', 'multipla_escolha', 'verdadeiro_falso', 'numerica',
    'resposta_curta', 'dissertativa', 'associacao', 'ordenacao',
    'calculo', 'codigo', 'estudo_caso'
  ));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.questoes_avaliacao add constraint questoes_avaliacao_configuracao_check
    check (jsonb_typeof(configuracao) = 'object');
exception when duplicate_object then null;
end $$;

-- Versoes guardam somente o que o aluno pode receber. Gabaritos continuam
-- separados e nunca entram neste snapshot.
create table if not exists public.avaliacoes_versoes (
  avaliacao_id uuid not null references public.avaliacoes_docentes(id) on delete cascade,
  versao integer not null check (versao > 0),
  titulo text not null,
  instrucoes text not null,
  valor numeric(6,2) not null,
  configuracao jsonb not null default '{}'::jsonb check (jsonb_typeof(configuracao) = 'object'),
  questoes_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(questoes_snapshot) = 'array'),
  publicado_em timestamptz not null default now(),
  primary key (avaliacao_id, versao)
);

alter table public.tentativas_avaliacao
  add column if not exists numero_tentativa smallint not null default 1,
  add column if not exists versao_avaliacao integer not null default 1,
  add column if not exists pontuacao_automatica numeric(6,2) not null default 0,
  add column if not exists pontuacao_manual numeric(6,2) not null default 0,
  add column if not exists requer_revisao boolean not null default false,
  add column if not exists bloqueada_em timestamptz;

alter table public.tentativas_avaliacao
  drop constraint if exists tentativas_avaliacao_avaliacao_id_aluno_id_key;
do $$ begin
  alter table public.tentativas_avaliacao add constraint tentativas_avaliacao_numero_check
    check (numero_tentativa between 1 and 10);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.tentativas_avaliacao add constraint tentativas_avaliacao_unica
    unique (avaliacao_id, aluno_id, numero_tentativa);
exception when duplicate_object then null;
end $$;

create index if not exists tentativas_avaliacao_professor_idx
  on public.tentativas_avaliacao (avaliacao_id, status, enviada_em desc);
create index if not exists tentativas_avaliacao_aluno_idx
  on public.tentativas_avaliacao (aluno_id, status, iniciada_em desc);

create table if not exists public.respostas_avaliacao (
  id uuid primary key default gen_random_uuid(),
  tentativa_id uuid not null references public.tentativas_avaliacao(id) on delete cascade,
  questao_id uuid not null references public.questoes_avaliacao(id) on delete restrict,
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  resposta jsonb not null default '{}'::jsonb,
  status_correcao text not null default 'pendente',
  correta boolean,
  pontos_automaticos numeric(6,2) not null default 0 check (pontos_automaticos >= 0),
  pontos_manuais numeric(6,2) not null default 0 check (pontos_manuais >= 0),
  feedback text,
  respondida_em timestamptz not null default now(),
  corrigida_em timestamptz,
  updated_at timestamptz not null default now(),
  unique (tentativa_id, questao_id),
  check (jsonb_typeof(resposta) in ('object', 'array', 'string', 'number', 'boolean', 'null')),
  check (status_correcao in ('pendente', 'automatica', 'revisao', 'manual'))
);

create index if not exists respostas_avaliacao_tentativa_idx
  on public.respostas_avaliacao (tentativa_id, questao_id);
create index if not exists respostas_avaliacao_revisao_idx
  on public.respostas_avaliacao (status_correcao, tentativa_id)
  where status_correcao in ('pendente', 'revisao');
create index if not exists respostas_avaliacao_aluno_idx
  on public.respostas_avaliacao (aluno_id, tentativa_id);
create index if not exists respostas_avaliacao_questao_idx
  on public.respostas_avaliacao (questao_id);

create table if not exists public.avaliacoes_auditoria (
  id bigint generated by default as identity primary key,
  avaliacao_id uuid references public.avaliacoes_docentes(id) on delete set null,
  tentativa_id uuid references public.tentativas_avaliacao(id) on delete set null,
  ator_id uuid references public.perfis(id) on delete set null,
  evento text not null,
  detalhes jsonb not null default '{}'::jsonb check (jsonb_typeof(detalhes) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists avaliacoes_auditoria_avaliacao_idx
  on public.avaliacoes_auditoria (avaliacao_id, created_at desc);
create index if not exists avaliacoes_auditoria_tentativa_idx
  on public.avaliacoes_auditoria (tentativa_id, created_at desc)
  where tentativa_id is not null;
create index if not exists avaliacoes_auditoria_ator_idx
  on public.avaliacoes_auditoria (ator_id, created_at desc)
  where ator_id is not null;

create or replace function private.validar_avaliacao_docente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'encerrado' and new.status <> old.status then
      raise exception 'Uma atividade encerrada nao pode ser reaberta.';
    end if;
    if old.status = 'publicado' and new.status = 'rascunho' then
      raise exception 'Uma atividade publicada nao pode voltar a rascunho.';
    end if;
    if old.status <> 'rascunho'
       and (to_jsonb(new) - array['status','updated_at'])
           is distinct from (to_jsonb(old) - array['status','updated_at']) then
      raise exception 'O conteudo publicado e imutavel. Crie uma nova versao.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.capturar_versao_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sessao autenticada obrigatoria.';
  end if;
  if new.status = 'publicado' and (tg_op = 'INSERT' or old.status <> 'publicado') then
    insert into public.avaliacoes_versoes (
      avaliacao_id, versao, titulo, instrucoes, valor, configuracao,
      questoes_snapshot, publicado_em
    )
    select
      new.id, new.versao_atual, new.titulo, new.instrucoes, new.valor,
      new.configuracao,
      coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id,
        'ordem', q.ordem,
        'tipo', q.tipo,
        'enunciado', q.enunciado,
        'alternativas', q.alternativas,
        'pontos', q.pontos,
        'configuracao', q.configuracao,
        'obrigatoria', q.obrigatoria
      ) order by q.ordem) filter (where q.id is not null), '[]'::jsonb),
      coalesce(new.publicado_em, now())
    from public.questoes_avaliacao q
    where q.avaliacao_id = new.id
    on conflict (avaliacao_id, versao) do nothing;

    insert into public.avaliacoes_auditoria (avaliacao_id, ator_id, evento, detalhes)
    values (new.id, (select auth.uid()), 'publicada', jsonb_build_object('versao', new.versao_atual));
  end if;
  return new;
end;
$$;

revoke all on function private.capturar_versao_avaliacao() from public, anon, authenticated;

drop trigger if exists validar_avaliacao_docente_trigger on public.avaliacoes_docentes;
create trigger validar_avaliacao_docente_trigger
before update on public.avaliacoes_docentes
for each row execute function private.validar_avaliacao_docente();

drop trigger if exists capturar_versao_avaliacao_trigger on public.avaliacoes_docentes;
create trigger capturar_versao_avaliacao_trigger
after insert or update of status on public.avaliacoes_docentes
for each row execute function private.capturar_versao_avaliacao();

drop trigger if exists professor_turma_materias_updated_at on public.professor_turma_materias;
create trigger professor_turma_materias_updated_at
before update on public.professor_turma_materias
for each row execute function public.set_updated_at();
drop trigger if exists questoes_avaliacao_updated_at on public.questoes_avaliacao;
create trigger questoes_avaliacao_updated_at
before update on public.questoes_avaliacao
for each row execute function public.set_updated_at();
drop trigger if exists respostas_avaliacao_updated_at on public.respostas_avaliacao;
create trigger respostas_avaliacao_updated_at
before update on public.respostas_avaliacao
for each row execute function public.set_updated_at();

alter table public.professor_turma_materias enable row level security;
alter table public.avaliacoes_versoes enable row level security;
alter table public.respostas_avaliacao enable row level security;
alter table public.avaliacoes_auditoria enable row level security;

-- Grants explicitos: nenhuma tabela pedagogica aceita TRUNCATE/REFERENCES pelo cliente.
revoke all on public.professor_turma_materias, public.avaliacoes_docentes,
  public.questoes_avaliacao, public.gabaritos_avaliacao, public.avaliacoes_versoes,
  public.tentativas_avaliacao, public.respostas_avaliacao, public.avaliacoes_auditoria
  from anon, authenticated;
grant select on public.professor_turma_materias, public.avaliacoes_docentes,
  public.questoes_avaliacao, public.gabaritos_avaliacao, public.avaliacoes_versoes,
  public.tentativas_avaliacao, public.respostas_avaliacao, public.avaliacoes_auditoria
  to authenticated;
grant insert, update, delete on public.professor_turma_materias,
  public.avaliacoes_docentes, public.questoes_avaliacao, public.gabaritos_avaliacao
  to authenticated;
grant insert (avaliacao_id, aluno_id, respostas, status, iniciada_em, numero_tentativa, versao_avaliacao)
  on public.tentativas_avaliacao to authenticated;
grant insert (tentativa_id, questao_id, aluno_id, resposta)
  on public.respostas_avaliacao to authenticated;
grant update (resposta, updated_at) on public.respostas_avaliacao to authenticated;
grant usage, select on sequence public.avaliacoes_auditoria_id_seq to service_role;

drop policy if exists professor_turma_materias_select on public.professor_turma_materias;
drop policy if exists professor_turma_materias_manage on public.professor_turma_materias;
drop policy if exists professor_turma_materias_insert on public.professor_turma_materias;
drop policy if exists professor_turma_materias_update on public.professor_turma_materias;
drop policy if exists professor_turma_materias_delete on public.professor_turma_materias;
create policy professor_turma_materias_select on public.professor_turma_materias
for select to authenticated using (
  professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor'
);
create policy professor_turma_materias_insert on public.professor_turma_materias
for insert to authenticated with check (
  (select public.usuario_role()) = 'gestor'
  and exists (select 1 from public.perfis p where p.id = professor_id and p.role = 'professor')
);
create policy professor_turma_materias_update on public.professor_turma_materias
for update to authenticated
using ((select public.usuario_role()) = 'gestor')
with check (
  (select public.usuario_role()) = 'gestor'
  and exists (select 1 from public.perfis p where p.id = professor_id and p.role = 'professor')
);
create policy professor_turma_materias_delete on public.professor_turma_materias
for delete to authenticated using ((select public.usuario_role()) = 'gestor');

drop policy if exists avaliacoes_select on public.avaliacoes_docentes;
drop policy if exists avaliacoes_insert on public.avaliacoes_docentes;
drop policy if exists avaliacoes_update on public.avaliacoes_docentes;
drop policy if exists avaliacoes_delete on public.avaliacoes_docentes;
create policy avaliacoes_select on public.avaliacoes_docentes
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or professor_id = (select auth.uid())
  or (
    status in ('publicado', 'encerrado')
    and turma_id = (select public.usuario_turma_id())
  )
);
create policy avaliacoes_insert on public.avaliacoes_docentes
for insert to authenticated with check (
  status = 'rascunho' and publicado_em is null
  and private.professor_tem_turma_materia(professor_id, turma_id, materia_codigo)
);
create policy avaliacoes_update on public.avaliacoes_docentes
for update to authenticated
using (
  (select public.usuario_role()) = 'gestor'
  or professor_id = (select auth.uid())
)
with check (
  (select public.usuario_role()) = 'gestor'
  or private.professor_tem_turma_materia(professor_id, turma_id, materia_codigo)
);
create policy avaliacoes_delete on public.avaliacoes_docentes
for delete to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or (professor_id = (select auth.uid()) and status = 'rascunho')
);

drop policy if exists questoes_select on public.questoes_avaliacao;
drop policy if exists questoes_manage on public.questoes_avaliacao;
drop policy if exists questoes_insert on public.questoes_avaliacao;
drop policy if exists questoes_update on public.questoes_avaliacao;
drop policy if exists questoes_delete on public.questoes_avaliacao;
create policy questoes_select on public.questoes_avaliacao
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.avaliacoes_docentes a
    where a.id = avaliacao_id and (
      a.professor_id = (select auth.uid())
      or (a.status in ('publicado', 'encerrado') and a.turma_id = (select public.usuario_turma_id()))
    )
  )
);
create policy questoes_insert on public.questoes_avaliacao
for insert to authenticated with check (
  (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho')
);
create policy questoes_update on public.questoes_avaliacao
for update to authenticated
using (
  (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho')
)
with check (
  (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho')
);
create policy questoes_delete on public.questoes_avaliacao
for delete to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho')
);

drop policy if exists gabaritos_select on public.gabaritos_avaliacao;
drop policy if exists gabaritos_manage on public.gabaritos_avaliacao;
drop policy if exists gabaritos_insert on public.gabaritos_avaliacao;
drop policy if exists gabaritos_update on public.gabaritos_avaliacao;
drop policy if exists gabaritos_delete on public.gabaritos_avaliacao;
create policy gabaritos_select on public.gabaritos_avaliacao
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.questoes_avaliacao q
    join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where q.id = questao_id and a.professor_id = (select auth.uid())
  )
);
create policy gabaritos_insert on public.gabaritos_avaliacao
for insert to authenticated with check (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.questoes_avaliacao q
    join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where q.id = questao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho'
  )
);
create policy gabaritos_update on public.gabaritos_avaliacao
for update to authenticated
using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.questoes_avaliacao q
    join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where q.id = questao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho'
  )
)
with check (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.questoes_avaliacao q
    join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where q.id = questao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho'
  )
);
create policy gabaritos_delete on public.gabaritos_avaliacao
for delete to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.questoes_avaliacao q
    join public.avaliacoes_docentes a on a.id = q.avaliacao_id
    where q.id = questao_id and a.professor_id = (select auth.uid()) and a.status = 'rascunho'
  )
);

drop policy if exists avaliacoes_versoes_select on public.avaliacoes_versoes;
create policy avaliacoes_versoes_select on public.avaliacoes_versoes
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.avaliacoes_docentes a
    where a.id = avaliacao_id and (
      a.professor_id = (select auth.uid())
      or (a.status in ('publicado', 'encerrado') and a.turma_id = (select public.usuario_turma_id()))
    )
  )
);

drop policy if exists tentativas_select on public.tentativas_avaliacao;
drop policy if exists tentativas_insert on public.tentativas_avaliacao;
drop policy if exists tentativas_update on public.tentativas_avaliacao;
create policy tentativas_select on public.tentativas_avaliacao
for select to authenticated using (
  aluno_id = (select auth.uid())
  or (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()))
);
create policy tentativas_insert on public.tentativas_avaliacao
for insert to authenticated with check (
  aluno_id = (select auth.uid())
  and status = 'em_andamento'
  and nota is null and feedback is null and enviada_em is null and corrigida_em is null
  and pontuacao_automatica = 0 and pontuacao_manual = 0 and requer_revisao = false
  and exists (
    select 1 from public.avaliacoes_docentes a
    where a.id = avaliacao_id
      and a.status = 'publicado'
      and a.turma_id = (select public.usuario_turma_id())
      and (a.abre_em is null or a.abre_em <= now())
      and (a.encerra_em is null or a.encerra_em >= now())
      and numero_tentativa <= a.tentativas_permitidas
      and versao_avaliacao = a.versao_atual
  )
);

drop policy if exists respostas_avaliacao_select on public.respostas_avaliacao;
drop policy if exists respostas_avaliacao_insert on public.respostas_avaliacao;
drop policy if exists respostas_avaliacao_update on public.respostas_avaliacao;
create policy respostas_avaliacao_select on public.respostas_avaliacao
for select to authenticated using (
  aluno_id = (select auth.uid())
  or (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.tentativas_avaliacao t
    join public.avaliacoes_docentes a on a.id = t.avaliacao_id
    where t.id = tentativa_id and a.professor_id = (select auth.uid())
  )
);
create policy respostas_avaliacao_insert on public.respostas_avaliacao
for insert to authenticated with check (
  aluno_id = (select auth.uid())
  and status_correcao = 'pendente' and correta is null
  and pontos_automaticos = 0 and pontos_manuais = 0
  and feedback is null and corrigida_em is null
  and exists (
    select 1
    from public.tentativas_avaliacao t
    join public.questoes_avaliacao q on q.avaliacao_id = t.avaliacao_id
    where t.id = tentativa_id and t.aluno_id = (select auth.uid())
      and t.status = 'em_andamento' and q.id = questao_id
  )
);
create policy respostas_avaliacao_update on public.respostas_avaliacao
for update to authenticated
using (
  aluno_id = (select auth.uid())
  and exists (select 1 from public.tentativas_avaliacao t where t.id = tentativa_id and t.aluno_id = (select auth.uid()) and t.status = 'em_andamento')
)
with check (
  aluno_id = (select auth.uid()) and status_correcao = 'pendente'
  and correta is null and pontos_automaticos = 0 and pontos_manuais = 0
  and feedback is null and corrigida_em is null
);

drop policy if exists avaliacoes_auditoria_select on public.avaliacoes_auditoria;
create policy avaliacoes_auditoria_select on public.avaliacoes_auditoria
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a where a.id = avaliacao_id and a.professor_id = (select auth.uid()))
  or exists (select 1 from public.tentativas_avaliacao t where t.id = tentativa_id and t.aluno_id = (select auth.uid()))
);

notify pgrst, 'reload schema';

commit;
