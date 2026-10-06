-- OminiSaber | OminiStudio - persistencia, publicacao, execucao e RLS
-- Mantem rascunhos mutaveis separados de versoes publicadas imutaveis.

begin;

create table if not exists public.studio_experiencias (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.perfis(id) on delete cascade,
  materia_codigo public.materia_aluno not null,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 150),
  objetivo text not null default '' check (char_length(objetivo) <= 2500),
  turma_referencia text not null default '' check (char_length(turma_referencia) <= 120),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'publicado', 'arquivado')),
  versao_atual integer not null default 0 check (versao_atual >= 0),
  tentativas_permitidas smallint not null default 3
    check (tentativas_permitidas between 1 and 10),
  rascunho jsonb not null default '{}'::jsonb
    check (jsonb_typeof(rascunho) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_experiencias_professor_idx
  on public.studio_experiencias (professor_id, status, updated_at desc);
create index if not exists studio_experiencias_materia_idx
  on public.studio_experiencias (materia_codigo, status, updated_at desc);

create table if not exists public.studio_experiencia_versoes (
  experiencia_id uuid not null references public.studio_experiencias(id) on delete cascade,
  versao integer not null check (versao > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  publicado_por uuid not null references public.perfis(id) on delete restrict,
  publicado_em timestamptz not null default now(),
  primary key (experiencia_id, versao)
);

create index if not exists studio_versoes_publicado_por_idx
  on public.studio_experiencia_versoes (publicado_por, publicado_em desc);

create table if not exists public.studio_experiencia_turmas (
  experiencia_id uuid not null,
  versao integer not null,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  ativo boolean not null default true,
  abre_em timestamptz,
  encerra_em timestamptz,
  created_at timestamptz not null default now(),
  primary key (experiencia_id, versao, turma_id),
  foreign key (experiencia_id, versao)
    references public.studio_experiencia_versoes(experiencia_id, versao)
    on delete cascade,
  check (encerra_em is null or abre_em is null or encerra_em > abre_em)
);

create index if not exists studio_experiencia_turmas_turma_idx
  on public.studio_experiencia_turmas (turma_id, ativo, abre_em, encerra_em);

create table if not exists public.studio_tentativas (
  id uuid primary key default gen_random_uuid(),
  experiencia_id uuid not null,
  versao integer not null,
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete restrict,
  numero_tentativa smallint not null check (numero_tentativa between 1 and 10),
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'enviada', 'corrigida')),
  pontuacao_automatica numeric(8,2) not null default 0
    check (pontuacao_automatica >= 0),
  pontuacao_manual numeric(8,2) not null default 0
    check (pontuacao_manual >= 0),
  requer_revisao boolean not null default false,
  iniciada_em timestamptz not null default now(),
  enviada_em timestamptz,
  corrigida_em timestamptz,
  updated_at timestamptz not null default now(),
  unique (experiencia_id, versao, aluno_id, numero_tentativa),
  foreign key (experiencia_id, versao)
    references public.studio_experiencia_versoes(experiencia_id, versao)
    on delete restrict
);

create index if not exists studio_tentativas_aluno_idx
  on public.studio_tentativas (aluno_id, status, iniciada_em desc);
create index if not exists studio_tentativas_experiencia_idx
  on public.studio_tentativas (experiencia_id, versao, status, enviada_em desc);

create table if not exists public.studio_respostas (
  id uuid primary key default gen_random_uuid(),
  tentativa_id uuid not null references public.studio_tentativas(id) on delete cascade,
  bloco_id text not null check (char_length(bloco_id) between 1 and 120),
  bloco_tipo text not null
    check (bloco_tipo in ('content', 'number', 'choice', 'text', 'decision', 'flourish')),
  resposta jsonb not null default 'null'::jsonb,
  status_correcao text not null default 'registrada'
    check (status_correcao in ('registrada', 'automatica', 'revisao', 'manual')),
  correta boolean,
  pontos_automaticos numeric(8,2) not null default 0
    check (pontos_automaticos >= 0),
  pontos_manuais numeric(8,2) not null default 0
    check (pontos_manuais >= 0),
  feedback text check (feedback is null or char_length(feedback) <= 4000),
  respondida_em timestamptz not null default now(),
  corrigida_por uuid references public.perfis(id) on delete set null,
  corrigida_em timestamptz,
  updated_at timestamptz not null default now(),
  unique (tentativa_id, bloco_id)
);

create index if not exists studio_respostas_tentativa_idx
  on public.studio_respostas (tentativa_id, bloco_id);
create index if not exists studio_respostas_revisao_idx
  on public.studio_respostas (status_correcao, tentativa_id)
  where status_correcao = 'revisao';

create table if not exists public.studio_auditoria (
  id bigint generated by default as identity primary key,
  experiencia_id uuid references public.studio_experiencias(id) on delete set null,
  tentativa_id uuid references public.studio_tentativas(id) on delete set null,
  ator_id uuid references public.perfis(id) on delete set null,
  evento text not null check (char_length(evento) between 1 and 80),
  detalhes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(detalhes) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists studio_auditoria_experiencia_idx
  on public.studio_auditoria (experiencia_id, created_at desc);
create index if not exists studio_auditoria_tentativa_idx
  on public.studio_auditoria (tentativa_id, created_at desc)
  where tentativa_id is not null;
create index if not exists studio_auditoria_ator_idx
  on public.studio_auditoria (ator_id, created_at desc)
  where ator_id is not null;

create or replace function private.studio_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists studio_experiencias_updated_at on public.studio_experiencias;
create trigger studio_experiencias_updated_at
before update on public.studio_experiencias
for each row execute function private.studio_touch_updated_at();

drop trigger if exists studio_tentativas_updated_at on public.studio_tentativas;
create trigger studio_tentativas_updated_at
before update on public.studio_tentativas
for each row execute function private.studio_touch_updated_at();

drop trigger if exists studio_respostas_updated_at on public.studio_respostas;
create trigger studio_respostas_updated_at
before update on public.studio_respostas
for each row execute function private.studio_touch_updated_at();

create or replace function private.studio_bloquear_versao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Versoes publicadas do OminiStudio sao imutaveis.';
end;
$$;

drop trigger if exists studio_versoes_imutaveis on public.studio_experiencia_versoes;
create trigger studio_versoes_imutaveis
before update or delete on public.studio_experiencia_versoes
for each row execute function private.studio_bloquear_versao();

alter table public.studio_experiencias enable row level security;
alter table public.studio_experiencia_versoes enable row level security;
alter table public.studio_experiencia_turmas enable row level security;
alter table public.studio_tentativas enable row level security;
alter table public.studio_respostas enable row level security;
alter table public.studio_auditoria enable row level security;

revoke all on table
  public.studio_experiencias,
  public.studio_experiencia_versoes,
  public.studio_experiencia_turmas,
  public.studio_tentativas,
  public.studio_respostas,
  public.studio_auditoria
from anon, authenticated;

grant select, insert, update, delete on public.studio_experiencias to authenticated;
grant select on public.studio_experiencia_versoes to authenticated;
grant select on public.studio_experiencia_turmas to authenticated;
grant select on public.studio_tentativas to authenticated;
grant select, update (pontos_manuais, feedback, status_correcao, corrigida_por, corrigida_em, updated_at)
  on public.studio_respostas to authenticated;
grant select on public.studio_auditoria to authenticated;
grant usage, select on sequence public.studio_auditoria_id_seq to service_role;

drop policy if exists studio_experiencias_select on public.studio_experiencias;
create policy studio_experiencias_select on public.studio_experiencias
for select to authenticated using (
  professor_id = (select auth.uid())
  or (select public.usuario_role()) = 'gestor'
);

drop policy if exists studio_experiencias_insert on public.studio_experiencias;
create policy studio_experiencias_insert on public.studio_experiencias
for insert to authenticated with check (
  professor_id = (select auth.uid())
  and (select public.usuario_role()) = 'professor'
  and exists (
    select 1 from public.professor_turma_materias ptm
    where ptm.professor_id = (select auth.uid())
      and ptm.materia_codigo = materia_codigo
      and ptm.ativo = true
  )
);

drop policy if exists studio_experiencias_update on public.studio_experiencias;
create policy studio_experiencias_update on public.studio_experiencias
for update to authenticated
using (
  professor_id = (select auth.uid())
  or (select public.usuario_role()) = 'gestor'
)
with check (
  (professor_id = (select auth.uid()) and (select public.usuario_role()) = 'professor')
  or (select public.usuario_role()) = 'gestor'
);

drop policy if exists studio_experiencias_delete on public.studio_experiencias;
create policy studio_experiencias_delete on public.studio_experiencias
for delete to authenticated using (
  (professor_id = (select auth.uid()) and versao_atual = 0)
  or (select public.usuario_role()) = 'gestor'
);

drop policy if exists studio_versoes_select on public.studio_experiencia_versoes;
create policy studio_versoes_select on public.studio_experiencia_versoes
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.studio_experiencias e
    where e.id = experiencia_id and e.professor_id = (select auth.uid())
  )
);

drop policy if exists studio_turmas_select on public.studio_experiencia_turmas;
create policy studio_turmas_select on public.studio_experiencia_turmas
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or turma_id = (select public.usuario_turma_id())
  or exists (
    select 1 from public.studio_experiencias e
    where e.id = experiencia_id and e.professor_id = (select auth.uid())
  )
);

drop policy if exists studio_tentativas_select on public.studio_tentativas;
create policy studio_tentativas_select on public.studio_tentativas
for select to authenticated using (
  aluno_id = (select auth.uid())
  or (select public.usuario_role()) = 'gestor'
  or exists (
    select 1 from public.studio_experiencias e
    where e.id = experiencia_id and e.professor_id = (select auth.uid())
  )
);

drop policy if exists studio_respostas_select on public.studio_respostas;
create policy studio_respostas_select on public.studio_respostas
for select to authenticated using (
  exists (
    select 1
    from public.studio_tentativas t
    join public.studio_experiencias e on e.id = t.experiencia_id
    where t.id = tentativa_id
      and (
        t.aluno_id = (select auth.uid())
        or e.professor_id = (select auth.uid())
        or (select public.usuario_role()) = 'gestor'
      )
  )
);

drop policy if exists studio_respostas_update on public.studio_respostas;
create policy studio_respostas_update on public.studio_respostas
for update to authenticated
using (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1
    from public.studio_tentativas t
    join public.studio_experiencias e on e.id = t.experiencia_id
    where t.id = tentativa_id and e.professor_id = (select auth.uid())
  )
)
with check (
  (select public.usuario_role()) = 'gestor'
  or exists (
    select 1
    from public.studio_tentativas t
    join public.studio_experiencias e on e.id = t.experiencia_id
    where t.id = tentativa_id and e.professor_id = (select auth.uid())
  )
);

drop policy if exists studio_auditoria_select on public.studio_auditoria;
create policy studio_auditoria_select on public.studio_auditoria
for select to authenticated using (
  (select public.usuario_role()) = 'gestor'
  or ator_id = (select auth.uid())
  or exists (
    select 1 from public.studio_experiencias e
    where e.id = experiencia_id and e.professor_id = (select auth.uid())
  )
);

create or replace function private.publicar_experiencia_studio(
  p_experiencia_id uuid,
  p_turma_ids uuid[],
  p_abre_em timestamptz default null,
  p_encerra_em timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_papel public.perfil_role := (select public.usuario_role());
  v_experiencia public.studio_experiencias%rowtype;
  v_turma uuid;
  v_versao integer;
begin
  if v_usuario is null or v_papel not in ('professor', 'gestor') then
    raise exception 'Somente professores e gestores podem publicar experiencias.';
  end if;
  if coalesce(array_length(p_turma_ids, 1), 0) = 0 then
    raise exception 'Selecione pelo menos uma turma.';
  end if;
  if p_encerra_em is not null and p_abre_em is not null and p_encerra_em <= p_abre_em then
    raise exception 'O encerramento precisa ser posterior a abertura.';
  end if;

  select * into v_experiencia
  from public.studio_experiencias
  where id = p_experiencia_id
    and (professor_id = v_usuario or v_papel = 'gestor')
  for update;
  if not found then raise exception 'Experiencia nao encontrada ou sem permissao.'; end if;
  if v_experiencia.status = 'arquivado' then raise exception 'Experiencia arquivada nao pode ser publicada.'; end if;
  if jsonb_typeof(v_experiencia.rascunho->'blocks') <> 'array'
     or jsonb_array_length(v_experiencia.rascunho->'blocks') = 0
     or jsonb_typeof(v_experiencia.rascunho->'edges') <> 'array'
     or nullif(v_experiencia.rascunho->>'start', '') is null then
    raise exception 'O trabalho precisa de blocos, conexoes e etapa inicial.';
  end if;

  foreach v_turma in array p_turma_ids loop
    if v_papel <> 'gestor' and not exists (
      select 1 from public.professor_turma_materias ptm
      where ptm.professor_id = v_usuario
        and ptm.turma_id = v_turma
        and ptm.materia_codigo = v_experiencia.materia_codigo
        and ptm.ativo = true
    ) then
      raise exception 'Professor sem vinculo ativo com uma das turmas selecionadas.';
    end if;
  end loop;

  v_versao := v_experiencia.versao_atual + 1;
  insert into public.studio_experiencia_versoes
    (experiencia_id, versao, snapshot, publicado_por)
  values (v_experiencia.id, v_versao, v_experiencia.rascunho, v_usuario);

  foreach v_turma in array p_turma_ids loop
    insert into public.studio_experiencia_turmas
      (experiencia_id, versao, turma_id, abre_em, encerra_em)
    values (v_experiencia.id, v_versao, v_turma, p_abre_em, p_encerra_em);
  end loop;

  update public.studio_experiencias
  set status = 'publicado', versao_atual = v_versao
  where id = v_experiencia.id;

  insert into public.studio_auditoria (experiencia_id, ator_id, evento, detalhes)
  values (
    v_experiencia.id,
    v_usuario,
    'experiencia_publicada',
    jsonb_build_object('versao', v_versao, 'turmas', to_jsonb(p_turma_ids))
  );

  return jsonb_build_object('experiencia_id', v_experiencia.id, 'versao', v_versao);
end;
$$;

create or replace function public.publicar_experiencia_studio(
  p_experiencia_id uuid,
  p_turma_ids uuid[],
  p_abre_em timestamptz default null,
  p_encerra_em timestamptz default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.publicar_experiencia_studio(
    p_experiencia_id,
    p_turma_ids,
    p_abre_em,
    p_encerra_em
  );
$$;

create or replace function private.obter_experiencia_publicada_studio(p_experiencia_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_turma uuid := (select public.usuario_turma_id());
  v_experiencia public.studio_experiencias%rowtype;
  v_snapshot jsonb;
  v_versao integer;
  v_blocks jsonb;
begin
  if v_usuario is null or (select public.usuario_role()) <> 'aluno' or v_turma is null then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;

  select et.versao into v_versao
  from public.studio_experiencia_turmas et
  join public.studio_experiencias e on e.id = et.experiencia_id
  where et.experiencia_id = p_experiencia_id
    and e.status = 'publicado'
    and et.turma_id = v_turma
    and et.ativo = true
    and (et.abre_em is null or et.abre_em <= now())
    and (et.encerra_em is null or et.encerra_em >= now())
  order by et.versao desc
  limit 1;
  if not found then raise exception 'Experiencia indisponivel para este aluno.'; end if;

  select * into v_experiencia
  from public.studio_experiencias
  where id = p_experiencia_id;

  select snapshot into v_snapshot
  from public.studio_experiencia_versoes
  where experiencia_id = p_experiencia_id and versao = v_versao;

  select coalesce(
    jsonb_agg(value - 'correct' - 'min' - 'max' - 'rubric' order by ordinality),
    '[]'::jsonb
  ) into v_blocks
  from jsonb_array_elements(coalesce(v_snapshot->'blocks', '[]'::jsonb)) with ordinality;
  v_snapshot := jsonb_set(v_snapshot, '{blocks}', v_blocks, true);

  return jsonb_build_object(
    'experiencia_id', p_experiencia_id,
    'versao', v_versao,
    'materia_codigo', v_experiencia.materia_codigo,
    'tentativas_permitidas', v_experiencia.tentativas_permitidas,
    'work', v_snapshot
  );
end;
$$;

create or replace function public.obter_experiencia_publicada_studio(p_experiencia_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.obter_experiencia_publicada_studio(p_experiencia_id);
$$;

create or replace function private.iniciar_tentativa_studio(p_experiencia_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aluno uuid := (select auth.uid());
  v_turma uuid := (select public.usuario_turma_id());
  v_versao integer;
  v_limite integer;
  v_numero integer;
  v_tentativa uuid;
begin
  if v_aluno is null or (select public.usuario_role()) <> 'aluno' or v_turma is null then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;

  select et.versao, e.tentativas_permitidas into v_versao, v_limite
  from public.studio_experiencia_turmas et
  join public.studio_experiencias e on e.id = et.experiencia_id
  where et.experiencia_id = p_experiencia_id
    and et.turma_id = v_turma
    and et.ativo = true
    and e.status = 'publicado'
    and (et.abre_em is null or et.abre_em <= now())
    and (et.encerra_em is null or et.encerra_em >= now())
  order by et.versao desc limit 1;
  if not found then raise exception 'Experiencia indisponivel para este aluno.'; end if;

  select coalesce(max(numero_tentativa), 0) + 1 into v_numero
  from public.studio_tentativas
  where experiencia_id = p_experiencia_id and versao = v_versao and aluno_id = v_aluno;
  if v_numero > v_limite then raise exception 'Limite de tentativas atingido.'; end if;

  insert into public.studio_tentativas
    (experiencia_id, versao, aluno_id, turma_id, numero_tentativa)
  values (p_experiencia_id, v_versao, v_aluno, v_turma, v_numero)
  returning id into v_tentativa;

  insert into public.studio_auditoria (experiencia_id, tentativa_id, ator_id, evento, detalhes)
  values (p_experiencia_id, v_tentativa, v_aluno, 'tentativa_iniciada', jsonb_build_object('versao', v_versao, 'numero', v_numero));

  return jsonb_build_object('tentativa_id', v_tentativa, 'versao', v_versao, 'numero', v_numero);
end;
$$;

create or replace function public.iniciar_tentativa_studio(p_experiencia_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.iniciar_tentativa_studio(p_experiencia_id); $$;

create or replace function private.salvar_resposta_studio(
  p_tentativa_id uuid,
  p_bloco_id text,
  p_resposta jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aluno uuid := (select auth.uid());
  v_tentativa public.studio_tentativas%rowtype;
  v_bloco jsonb;
  v_tipo text;
  v_status text := 'registrada';
  v_correta boolean;
  v_pontos numeric(8,2) := 0;
  v_maximo numeric(8,2) := 0;
  v_texto text := trim(both '"' from coalesce(p_resposta::text, ''));
  v_numero numeric;
begin
  if v_aluno is null or (select public.usuario_role()) <> 'aluno' then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;
  select * into v_tentativa from public.studio_tentativas
  where id = p_tentativa_id and aluno_id = v_aluno and status = 'em_andamento';
  if not found then raise exception 'Tentativa indisponivel para edicao.'; end if;

  select value into v_bloco
  from public.studio_experiencia_versoes ev,
       jsonb_array_elements(ev.snapshot->'blocks') item
  where ev.experiencia_id = v_tentativa.experiencia_id
    and ev.versao = v_tentativa.versao
    and item.value->>'id' = p_bloco_id
  limit 1;
  if v_bloco is null then raise exception 'Bloco nao encontrado na versao publicada.'; end if;

  v_tipo := v_bloco->>'type';
  v_maximo := greatest(coalesce((v_bloco->>'points')::numeric, 0), 0);
  if v_tipo = 'text' then
    v_status := 'revisao';
  elsif v_tipo = 'number' then
    if v_texto ~ '^-?[0-9]+([.,][0-9]+)?$' then
      v_numero := replace(v_texto, ',', '.')::numeric;
      v_correta := v_numero between (v_bloco->>'min')::numeric and (v_bloco->>'max')::numeric;
    else
      v_correta := false;
    end if;
    v_status := 'automatica';
    v_pontos := case when v_correta then v_maximo else 0 end;
  elsif v_tipo = 'choice' then
    if v_texto ~ '^[0-9]+$' then
      v_correta := v_texto::integer = (v_bloco->>'correct')::integer;
    else
      v_correta := false;
    end if;
    v_status := 'automatica';
    v_pontos := case when v_correta then v_maximo else 0 end;
  end if;

  insert into public.studio_respostas
    (tentativa_id, bloco_id, bloco_tipo, resposta, status_correcao, correta, pontos_automaticos)
  values (p_tentativa_id, p_bloco_id, v_tipo, coalesce(p_resposta, 'null'::jsonb), v_status, v_correta, v_pontos)
  on conflict (tentativa_id, bloco_id) do update set
    resposta = excluded.resposta,
    status_correcao = excluded.status_correcao,
    correta = excluded.correta,
    pontos_automaticos = excluded.pontos_automaticos,
    pontos_manuais = 0,
    feedback = null,
    corrigida_por = null,
    corrigida_em = null,
    respondida_em = now(),
    updated_at = now();

  return jsonb_build_object('status', v_status, 'correta', v_correta, 'pontos', v_pontos, 'maximo', v_maximo);
end;
$$;

create or replace function public.salvar_resposta_studio(
  p_tentativa_id uuid,
  p_bloco_id text,
  p_resposta jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.salvar_resposta_studio(p_tentativa_id, p_bloco_id, p_resposta); $$;

create or replace function private.enviar_tentativa_studio(p_tentativa_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aluno uuid := (select auth.uid());
  v_tentativa public.studio_tentativas%rowtype;
  v_automatica numeric(8,2);
  v_manual numeric(8,2);
  v_revisao boolean;
begin
  if v_aluno is null or (select public.usuario_role()) <> 'aluno' then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;
  select * into v_tentativa from public.studio_tentativas
  where id = p_tentativa_id and aluno_id = v_aluno and status = 'em_andamento'
  for update;
  if not found then raise exception 'Tentativa indisponivel para envio.'; end if;

  select coalesce(sum(pontos_automaticos), 0), coalesce(sum(pontos_manuais), 0),
         coalesce(bool_or(status_correcao = 'revisao'), false)
  into v_automatica, v_manual, v_revisao
  from public.studio_respostas where tentativa_id = p_tentativa_id;

  update public.studio_tentativas set
    status = case when v_revisao then 'enviada' else 'corrigida' end,
    pontuacao_automatica = v_automatica,
    pontuacao_manual = v_manual,
    requer_revisao = v_revisao,
    enviada_em = now(),
    corrigida_em = case when v_revisao then null else now() end
  where id = p_tentativa_id;

  insert into public.studio_auditoria (experiencia_id, tentativa_id, ator_id, evento, detalhes)
  values (v_tentativa.experiencia_id, p_tentativa_id, v_aluno, 'tentativa_enviada', jsonb_build_object('requer_revisao', v_revisao));

  return jsonb_build_object('status', case when v_revisao then 'enviada' else 'corrigida' end, 'pontuacao_automatica', v_automatica, 'requer_revisao', v_revisao);
end;
$$;

create or replace function public.enviar_tentativa_studio(p_tentativa_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.enviar_tentativa_studio(p_tentativa_id); $$;

create or replace function private.corrigir_resposta_studio(
  p_resposta_id uuid,
  p_pontos numeric,
  p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_resposta public.studio_respostas%rowtype;
  v_tentativa public.studio_tentativas%rowtype;
  v_maximo numeric(8,2);
  v_pendentes integer;
begin
  select r.* into v_resposta
  from public.studio_respostas r
  join public.studio_tentativas t on t.id = r.tentativa_id
  join public.studio_experiencias e on e.id = t.experiencia_id
  where r.id = p_resposta_id
    and (e.professor_id = v_usuario or (select public.usuario_role()) = 'gestor');
  if not found then raise exception 'Resposta nao encontrada ou sem permissao.'; end if;
  if v_resposta.bloco_tipo <> 'text' then raise exception 'Somente respostas abertas aceitam correcao manual.'; end if;

  select * into v_tentativa
  from public.studio_tentativas
  where id = v_resposta.tentativa_id;

  select greatest(coalesce((item.value->>'points')::numeric, 0), 0) into v_maximo
  from public.studio_experiencia_versoes ev,
       jsonb_array_elements(ev.snapshot->'blocks') item
  where ev.experiencia_id = v_tentativa.experiencia_id
    and ev.versao = v_tentativa.versao
    and item.value->>'id' = v_resposta.bloco_id;
  if p_pontos < 0 or p_pontos > coalesce(v_maximo, 0) then
    raise exception 'Pontuacao fora do intervalo permitido.';
  end if;

  update public.studio_respostas set
    pontos_manuais = p_pontos,
    feedback = nullif(btrim(p_feedback), ''),
    status_correcao = 'manual',
    corrigida_por = v_usuario,
    corrigida_em = now()
  where id = p_resposta_id;

  select count(*) into v_pendentes from public.studio_respostas
  where tentativa_id = v_tentativa.id and status_correcao = 'revisao';

  update public.studio_tentativas set
    pontuacao_manual = (select coalesce(sum(pontos_manuais), 0) from public.studio_respostas where tentativa_id = v_tentativa.id),
    requer_revisao = v_pendentes > 0,
    status = case when v_pendentes = 0 then 'corrigida' else status end,
    corrigida_em = case when v_pendentes = 0 then now() else corrigida_em end
  where id = v_tentativa.id;

  insert into public.studio_auditoria (experiencia_id, tentativa_id, ator_id, evento, detalhes)
  values (v_tentativa.experiencia_id, v_tentativa.id, v_usuario, 'resposta_corrigida', jsonb_build_object('resposta_id', p_resposta_id, 'pontos', p_pontos));

  return jsonb_build_object('resposta_id', p_resposta_id, 'pontos', p_pontos, 'pendentes', v_pendentes);
end;
$$;

create or replace function public.corrigir_resposta_studio(
  p_resposta_id uuid,
  p_pontos numeric,
  p_feedback text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.corrigir_resposta_studio(p_resposta_id, p_pontos, p_feedback); $$;

revoke all on function private.publicar_experiencia_studio(uuid, uuid[], timestamptz, timestamptz) from public, anon;
revoke all on function private.obter_experiencia_publicada_studio(uuid) from public, anon;
revoke all on function private.iniciar_tentativa_studio(uuid) from public, anon;
revoke all on function private.salvar_resposta_studio(uuid, text, jsonb) from public, anon;
revoke all on function private.enviar_tentativa_studio(uuid) from public, anon;
revoke all on function private.corrigir_resposta_studio(uuid, numeric, text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.publicar_experiencia_studio(uuid, uuid[], timestamptz, timestamptz) to authenticated;
grant execute on function private.obter_experiencia_publicada_studio(uuid) to authenticated;
grant execute on function private.iniciar_tentativa_studio(uuid) to authenticated;
grant execute on function private.salvar_resposta_studio(uuid, text, jsonb) to authenticated;
grant execute on function private.enviar_tentativa_studio(uuid) to authenticated;
grant execute on function private.corrigir_resposta_studio(uuid, numeric, text) to authenticated;

revoke all on function public.publicar_experiencia_studio(uuid, uuid[], timestamptz, timestamptz) from public, anon;
revoke all on function public.obter_experiencia_publicada_studio(uuid) from public, anon;
revoke all on function public.iniciar_tentativa_studio(uuid) from public, anon;
revoke all on function public.salvar_resposta_studio(uuid, text, jsonb) from public, anon;
revoke all on function public.enviar_tentativa_studio(uuid) from public, anon;
revoke all on function public.corrigir_resposta_studio(uuid, numeric, text) from public, anon;
grant execute on function public.publicar_experiencia_studio(uuid, uuid[], timestamptz, timestamptz) to authenticated;
grant execute on function public.obter_experiencia_publicada_studio(uuid) to authenticated;
grant execute on function public.iniciar_tentativa_studio(uuid) to authenticated;
grant execute on function public.salvar_resposta_studio(uuid, text, jsonb) to authenticated;
grant execute on function public.enviar_tentativa_studio(uuid) to authenticated;
grant execute on function public.corrigir_resposta_studio(uuid, numeric, text) to authenticated;

comment on table public.studio_experiencias is 'Rascunhos autorais mutaveis do OminiStudio.';
comment on table public.studio_experiencia_versoes is 'Snapshots publicados e imutaveis do OminiStudio.';
comment on table public.studio_experiencia_turmas is 'Disponibilidade de cada versao publicada por turma.';
comment on table public.studio_tentativas is 'Tentativas dos alunos em experiencias publicadas.';
comment on table public.studio_respostas is 'Evidencias e correcao por bloco do OminiStudio.';
comment on table public.studio_auditoria is 'Trilha de auditoria de publicacao, execucao e correcao do OminiStudio.';

commit;
