begin;

alter table public.descritores_curriculares
  alter column serie drop not null,
  alter column trimestre drop not null;

create table if not exists public.curriculos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  origem text not null,
  ano_letivo smallint not null check (ano_letivo between 2000 and 2100),
  materia_codigo public.materia_aluno not null,
  modalidade text not null default 'Ensino Médio',
  versao integer not null default 1 check (versao > 0),
  versao_em timestamptz not null default now(),
  status text not null default 'rascunho' check (status in ('rascunho','aprovado','publicado','arquivado')),
  ativo boolean not null default true,
  documento_origem_id uuid,
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (origem, ano_letivo, materia_codigo, versao)
);

create table if not exists public.curriculo_periodos (
  id uuid primary key default gen_random_uuid(),
  curriculo_id uuid not null references public.curriculos(id) on delete cascade,
  serie smallint not null check (serie between 1 and 3),
  trimestre smallint not null check (trimestre between 1 and 3),
  unique (curriculo_id, serie, trimestre)
);

create table if not exists public.habilidades_curriculares (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  descricao text not null,
  materia_codigo public.materia_aluno not null,
  modalidade text not null default 'Ensino Médio',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (codigo, materia_codigo)
);

create table if not exists public.habilidade_curriculo_periodos (
  habilidade_id uuid not null references public.habilidades_curriculares(id) on delete cascade,
  periodo_id uuid not null references public.curriculo_periodos(id) on delete cascade,
  quinzena text,
  semana text,
  source_page integer check (source_page is null or source_page > 0),
  primary key (habilidade_id, periodo_id)
);

create table if not exists public.habilidade_descritores (
  habilidade_id uuid not null references public.habilidades_curriculares(id) on delete cascade,
  descritor_id uuid not null references public.descritores_curriculares(id) on delete restrict,
  periodo_id uuid not null references public.curriculo_periodos(id) on delete cascade,
  primary key (habilidade_id, descritor_id, periodo_id)
);

create table if not exists public.expectativas_aprendizagem (
  id uuid primary key default gen_random_uuid(),
  habilidade_id uuid not null references public.habilidades_curriculares(id) on delete cascade,
  periodo_id uuid not null references public.curriculo_periodos(id) on delete cascade,
  descricao text not null,
  unique (habilidade_id, periodo_id, descricao)
);

create table if not exists public.objetos_conhecimento (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  unique (descricao)
);

create table if not exists public.habilidade_objetos (
  habilidade_id uuid not null references public.habilidades_curriculares(id) on delete cascade,
  objeto_id uuid not null references public.objetos_conhecimento(id) on delete restrict,
  periodo_id uuid not null references public.curriculo_periodos(id) on delete cascade,
  primary key (habilidade_id, objeto_id, periodo_id)
);

create table if not exists public.importacoes_curriculo (
  id uuid primary key default gen_random_uuid(),
  nome_arquivo text not null,
  arquivo_hash_sha256 text not null check (arquivo_hash_sha256 ~ '^[a-f0-9]{64}$'),
  origem text,
  ano_letivo smallint check (ano_letivo is null or ano_letivo between 2000 and 2100),
  materia_codigo public.materia_aluno,
  trimestre smallint check (trimestre is null or trimestre between 1 and 3),
  status text not null default 'upload' check (status in ('upload','processando','revisao','aprovada','rejeitada','erro')),
  erro text,
  resumo jsonb not null default '{}'::jsonb,
  documento_texto_extraido text,
  importado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (arquivo_hash_sha256)
);

create table if not exists public.importacoes_curriculo_itens (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null references public.importacoes_curriculo(id) on delete cascade,
  tipo text not null check (tipo in ('habilidade','descritor','aviso')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  confianca numeric(5,2) not null default 0 check (confianca between 0 and 100),
  status text not null default 'revisar' check (status in ('ok','revisar','rejeitado','aprovado')),
  source_page integer check (source_page is null or source_page > 0),
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists curriculos_filtro_idx on public.curriculos (materia_codigo, ano_letivo, status);
create index if not exists curriculo_periodos_busca_idx on public.curriculo_periodos (curriculo_id, serie, trimestre);
create index if not exists habilidades_codigo_idx on public.habilidades_curriculares (codigo, materia_codigo);
create index if not exists importacoes_status_idx on public.importacoes_curriculo (status, created_at desc);
create index if not exists importacoes_itens_importacao_idx on public.importacoes_curriculo_itens (importacao_id, tipo, status);

alter table public.curriculos enable row level security;
alter table public.curriculo_periodos enable row level security;
alter table public.habilidades_curriculares enable row level security;
alter table public.habilidade_curriculo_periodos enable row level security;
alter table public.habilidade_descritores enable row level security;
alter table public.expectativas_aprendizagem enable row level security;
alter table public.objetos_conhecimento enable row level security;
alter table public.habilidade_objetos enable row level security;
alter table public.importacoes_curriculo enable row level security;
alter table public.importacoes_curriculo_itens enable row level security;

drop policy if exists curriculos_leitura on public.curriculos;
create policy curriculos_leitura on public.curriculos for select to authenticated using (status = 'publicado' or (select public.usuario_role()) = 'gestor');
drop policy if exists curriculos_gestor on public.curriculos;
create policy curriculos_gestor on public.curriculos for all to authenticated using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');
drop policy if exists curriculo_periodos_leitura on public.curriculo_periodos;
create policy curriculo_periodos_leitura on public.curriculo_periodos for select to authenticated using (exists (select 1 from public.curriculos c where c.id = curriculo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists curriculo_periodos_gestor on public.curriculo_periodos;
create policy curriculo_periodos_gestor on public.curriculo_periodos for all to authenticated using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');
drop policy if exists habilidades_leitura on public.habilidades_curriculares;
create policy habilidades_leitura on public.habilidades_curriculares for select to authenticated using ((select public.usuario_role()) is not null);
drop policy if exists habilidades_gestor on public.habilidades_curriculares;
create policy habilidades_gestor on public.habilidades_curriculares for all to authenticated using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');
drop policy if exists habilidade_periodos_leitura on public.habilidade_curriculo_periodos;
create policy habilidade_periodos_leitura on public.habilidade_curriculo_periodos for select to authenticated using (exists (select 1 from public.curriculo_periodos p join public.curriculos c on c.id = p.curriculo_id where p.id = periodo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists habilidade_descritores_leitura on public.habilidade_descritores;
create policy habilidade_descritores_leitura on public.habilidade_descritores for select to authenticated using (exists (select 1 from public.curriculo_periodos p join public.curriculos c on c.id = p.curriculo_id where p.id = periodo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists expectativas_leitura on public.expectativas_aprendizagem;
create policy expectativas_leitura on public.expectativas_aprendizagem for select to authenticated using (exists (select 1 from public.curriculo_periodos p join public.curriculos c on c.id = p.curriculo_id where p.id = periodo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists objetos_leitura on public.objetos_conhecimento;
create policy objetos_leitura on public.objetos_conhecimento for select to authenticated using (exists (select 1 from public.habilidade_objetos ho join public.curriculo_periodos p on p.id = ho.periodo_id join public.curriculos c on c.id = p.curriculo_id where ho.objeto_id = public.objetos_conhecimento.id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists habilidade_objetos_leitura on public.habilidade_objetos;
create policy habilidade_objetos_leitura on public.habilidade_objetos for select to authenticated using (exists (select 1 from public.curriculo_periodos p join public.curriculos c on c.id = p.curriculo_id where p.id = periodo_id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));
drop policy if exists importacoes_gestor on public.importacoes_curriculo;
create policy importacoes_gestor on public.importacoes_curriculo for all to authenticated using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');
drop policy if exists importacoes_itens_gestor on public.importacoes_curriculo_itens;
create policy importacoes_itens_gestor on public.importacoes_curriculo_itens for all to authenticated using ((select public.usuario_role()) = 'gestor') with check ((select public.usuario_role()) = 'gestor');

grant select on public.curriculos, public.curriculo_periodos, public.habilidades_curriculares, public.habilidade_curriculo_periodos, public.habilidade_descritores, public.expectativas_aprendizagem, public.objetos_conhecimento, public.habilidade_objetos to authenticated;
grant select, insert, update, delete on public.curriculos, public.curriculo_periodos, public.habilidades_curriculares, public.habilidade_curriculo_periodos, public.habilidade_descritores, public.expectativas_aprendizagem, public.objetos_conhecimento, public.habilidade_objetos, public.importacoes_curriculo, public.importacoes_curriculo_itens to authenticated;

create or replace function public.aprovar_importacao_curriculo(p_importacao_id uuid)
returns uuid
language plpgsql
 security definer set search_path = ''
as $$
declare
  imp public.importacoes_curriculo;
  curr public.curriculos;
  periodo public.curriculo_periodos;
  habilidade public.habilidades_curriculares;
  descritor public.descritores_curriculares;
  objeto public.objetos_conhecimento;
  item jsonb;
  child jsonb;
  serie_num smallint;
  tri_num smallint;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem aprovar importações'; end if;
  select * into imp from public.importacoes_curriculo where id = p_importacao_id for update;
  if imp.id is null then raise exception 'Importação não encontrada'; end if;
  if imp.status <> 'revisao' then raise exception 'A importação precisa estar em revisão'; end if;

  select * into curr from public.curriculos
    where origem = coalesce(imp.origem, 'Não identificada')
      and ano_letivo = imp.ano_letivo and materia_codigo = imp.materia_codigo
      and status <> 'arquivado'
    order by versao desc limit 1;
  if curr.id is null then
    insert into public.curriculos (nome, origem, ano_letivo, materia_codigo, criado_por)
    values (coalesce(imp.origem, 'Currículo importado') || ' ' || imp.ano_letivo,
      coalesce(imp.origem, 'Não identificada'), imp.ano_letivo, imp.materia_codigo, imp.importado_por)
    returning * into curr;
  end if;

  for item in select payload from public.importacoes_curriculo_itens
    where importacao_id = imp.id and tipo = 'habilidade' and status <> 'rejeitado'
  loop
    serie_num := nullif((item ->> 'serie')::smallint, 0);
    tri_num := coalesce(nullif((item ->> 'trimestre')::smallint, 0), imp.trimestre);
    if serie_num is null or tri_num is null then continue; end if;
    insert into public.curriculo_periodos (curriculo_id, serie, trimestre)
    values (curr.id, serie_num, tri_num)
    on conflict (curriculo_id, serie, trimestre) do update set trimestre = excluded.trimestre
    returning * into periodo;
    insert into public.habilidades_curriculares (codigo, descricao, materia_codigo)
    values (upper(item ->> 'codigo'), coalesce(nullif(item ->> 'descricao', ''), 'Descrição pendente'), imp.materia_codigo)
    on conflict (codigo, materia_codigo) do update set descricao = case when public.habilidades_curriculares.descricao = 'Descrição pendente' then excluded.descricao else public.habilidades_curriculares.descricao end
    returning * into habilidade;
    insert into public.habilidade_curriculo_periodos (habilidade_id, periodo_id, quinzena, semana, source_page)
    values (habilidade.id, periodo.id, item ->> 'quinzena', item ->> 'semana', nullif(item ->> 'source_page', '')::integer)
    on conflict (habilidade_id, periodo_id) do update set quinzena = excluded.quinzena, semana = excluded.semana, source_page = excluded.source_page;
    for child in select value from jsonb_array_elements(coalesce(item -> 'descritores', '[]'::jsonb))
    loop
      insert into public.descritores_curriculares (codigo, titulo, descricao, materia_codigo, serie, trimestre, status)
      values (upper(child ->> 'code'), upper(child ->> 'code'), nullif(child ->> 'descricao', ''), imp.materia_codigo, serie_num, tri_num, 'revisao')
      on conflict (codigo) do update set descricao = coalesce(public.descritores_curriculares.descricao, excluded.descricao)
      returning * into descritor;
      insert into public.habilidade_descritores values (habilidade.id, descritor.id, periodo.id) on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'expectativas', '[]'::jsonb))
    loop
      insert into public.expectativas_aprendizagem (habilidade_id, periodo_id, descricao) values (habilidade.id, periodo.id, child #>> '{}') on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'objetos', '[]'::jsonb))
    loop
      insert into public.objetos_conhecimento (descricao) values (child #>> '{}') on conflict (descricao) do update set descricao = excluded.descricao returning * into objeto;
      insert into public.habilidade_objetos values (habilidade.id, objeto.id, periodo.id) on conflict do nothing;
    end loop;
  end loop;
  update public.importacoes_curriculo set status = 'aprovada', updated_at = now() where id = imp.id;
  update public.curriculos set status = 'aprovado', updated_at = now() where id = curr.id;
  return curr.id;
end;
$$;

revoke all on function public.aprovar_importacao_curriculo(uuid) from public, anon, authenticated;
grant execute on function public.aprovar_importacao_curriculo(uuid) to authenticated;

commit;