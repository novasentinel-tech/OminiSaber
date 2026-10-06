import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, '..');
const catalogPath = path.join(backendDir, 'data', 'catalogo-curricular-base-comum-2026.json');
const migrationPath = path.join(backendDir, 'migrations', '20260907_catalogo_curricular_base_comum.sql');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const payload = JSON.stringify(catalog);

const sql = `begin;

alter table public.habilidade_curriculo_periodos
  add column if not exists unidade_tematica text,
  add column if not exists arquivo_fonte text;

create table if not exists public.descritor_curriculo_periodos (
  descritor_id uuid not null references public.descritores_curriculares(id) on delete cascade,
  periodo_id uuid not null references public.curriculo_periodos(id) on delete cascade,
  source_page integer check (source_page is null or source_page > 0),
  arquivo_fonte text,
  primary key (descritor_id, periodo_id)
);

create index if not exists descritor_curriculo_periodos_periodo_idx
  on public.descritor_curriculo_periodos (periodo_id, descritor_id);

alter table public.descritor_curriculo_periodos enable row level security;
drop policy if exists descritor_periodos_leitura on public.descritor_curriculo_periodos;
create policy descritor_periodos_leitura on public.descritor_curriculo_periodos
  for select to authenticated using (true);
drop policy if exists descritor_periodos_gestor on public.descritor_curriculo_periodos;
create policy descritor_periodos_gestor on public.descritor_curriculo_periodos
  for all to authenticated
  using ((select public.usuario_role()) = 'gestor')
  with check ((select public.usuario_role()) = 'gestor');
grant select on public.descritor_curriculo_periodos to authenticated;
grant insert, update, delete on public.descritor_curriculo_periodos to authenticated;

do $seed$
declare
  catalogo jsonb := $catalogo$${payload}$catalogo$::jsonb;
  materia text;
  habilidade_json jsonb;
  ocorrencia jsonb;
  descritor_json jsonb;
  descritor_ocorrencia jsonb;
  item_text text;
  curriculo_uuid uuid;
  periodo_uuid uuid;
  habilidade_uuid uuid;
  descritor_uuid uuid;
  objeto_uuid uuid;
begin
  for materia in select value from jsonb_array_elements_text(catalogo -> 'materias') loop
    insert into public.curriculos
      (nome, origem, ano_letivo, materia_codigo, modalidade, versao, status, ativo)
    values
      ('Base comum 2026 — ' || initcap(materia), catalogo ->> 'origem', 2026,
       materia::public.materia_aluno, 'Ensino Médio', 1, 'publicado', true)
    on conflict (origem, ano_letivo, materia_codigo, versao)
    do update set nome = excluded.nome, status = 'publicado', ativo = true, updated_at = now()
    returning id into curriculo_uuid;

    insert into public.curriculo_periodos (curriculo_id, serie, trimestre)
    select curriculo_uuid, serie, trimestre
    from generate_series(1, 3) serie cross join generate_series(1, 3) trimestre
    on conflict (curriculo_id, serie, trimestre) do nothing;
  end loop;

  for descritor_json in select value from jsonb_array_elements(catalogo -> 'descritores_avaliativos') loop
    insert into public.descritores_curriculares
      (codigo, titulo, descricao, materia_codigo, serie, trimestre, status, criado_por)
    values
      (descritor_json ->> 'codigo', descritor_json ->> 'codigo', descritor_json ->> 'descricao',
       (descritor_json ->> 'materia_codigo')::public.materia_aluno, null, null, 'ativo', null)
    on conflict (codigo) do update
      set descricao = excluded.descricao,
          materia_codigo = excluded.materia_codigo,
          status = 'ativo',
          updated_at = now()
    returning id into descritor_uuid;

    for descritor_ocorrencia in select value from jsonb_array_elements(descritor_json -> 'ocorrencias') loop
      select cp.id into periodo_uuid
      from public.curriculo_periodos cp
      join public.curriculos c on c.id = cp.curriculo_id
      where c.origem = catalogo ->> 'origem'
        and c.ano_letivo = 2026
        and c.versao = 1
        and c.materia_codigo = (descritor_json ->> 'materia_codigo')::public.materia_aluno
        and cp.serie = (descritor_ocorrencia ->> 'serie')::smallint
        and cp.trimestre = (descritor_ocorrencia ->> 'trimestre')::smallint;

      insert into public.descritor_curriculo_periodos
        (descritor_id, periodo_id, source_page, arquivo_fonte)
      values
        (descritor_uuid, periodo_uuid, (descritor_ocorrencia ->> 'pagina_fonte')::integer,
         descritor_ocorrencia ->> 'arquivo_fonte')
      on conflict (descritor_id, periodo_id) do update
        set source_page = excluded.source_page, arquivo_fonte = excluded.arquivo_fonte;
    end loop;
  end loop;

  for habilidade_json in select value from jsonb_array_elements(catalogo -> 'habilidades') loop
    insert into public.habilidades_curriculares (codigo, descricao, materia_codigo, modalidade)
    values (
      habilidade_json ->> 'codigo', habilidade_json ->> 'descricao',
      (habilidade_json ->> 'materia_codigo')::public.materia_aluno, 'Ensino Médio'
    )
    on conflict (codigo, materia_codigo) do update
      set descricao = excluded.descricao, updated_at = now()
    returning id into habilidade_uuid;

    for ocorrencia in select value from jsonb_array_elements(habilidade_json -> 'ocorrencias') loop
      select cp.id into periodo_uuid
      from public.curriculo_periodos cp
      join public.curriculos c on c.id = cp.curriculo_id
      where c.origem = catalogo ->> 'origem'
        and c.ano_letivo = 2026
        and c.versao = 1
        and c.materia_codigo = (habilidade_json ->> 'materia_codigo')::public.materia_aluno
        and cp.serie = (ocorrencia ->> 'serie')::smallint
        and cp.trimestre = (ocorrencia ->> 'trimestre')::smallint;

      insert into public.habilidade_curriculo_periodos
        (habilidade_id, periodo_id, source_page, unidade_tematica, arquivo_fonte)
      values
        (habilidade_uuid, periodo_uuid, (ocorrencia ->> 'pagina_fonte')::integer,
         nullif(ocorrencia ->> 'unidade_tematica', ''), ocorrencia ->> 'arquivo_fonte')
      on conflict (habilidade_id, periodo_id) do update
        set source_page = excluded.source_page,
            unidade_tematica = coalesce(excluded.unidade_tematica, public.habilidade_curriculo_periodos.unidade_tematica),
            arquivo_fonte = excluded.arquivo_fonte;

      for item_text in select value from jsonb_array_elements_text(ocorrencia -> 'expectativas') loop
        if char_length(btrim(item_text)) >= 8 then
          insert into public.expectativas_aprendizagem (habilidade_id, periodo_id, descricao)
          values (habilidade_uuid, periodo_uuid, btrim(item_text)) on conflict do nothing;
        end if;
      end loop;

      for item_text in select value from jsonb_array_elements_text(ocorrencia -> 'objetos') loop
        if char_length(btrim(item_text)) >= 3 then
          insert into public.objetos_conhecimento (descricao)
          values (btrim(item_text)) on conflict (descricao) do update set descricao = excluded.descricao
          returning id into objeto_uuid;
          insert into public.habilidade_objetos (habilidade_id, objeto_id, periodo_id)
          values (habilidade_uuid, objeto_uuid, periodo_uuid) on conflict do nothing;
        end if;
      end loop;

      for descritor_json in select value from jsonb_array_elements(ocorrencia -> 'descritores') loop
        select id into descritor_uuid from public.descritores_curriculares
        where codigo = descritor_json ->> 'codigo';
        if descritor_uuid is not null then
          insert into public.habilidade_descritores (habilidade_id, descritor_id, periodo_id)
          values (habilidade_uuid, descritor_uuid, periodo_uuid) on conflict do nothing;
        end if;
      end loop;
    end loop;
  end loop;
end;
$seed$;

create or replace function public.aluno_pode_acessar_materia(materia_input public.materia_aluno)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis p
    where p.id = (select auth.uid()) and p.role = 'aluno'
      and (
        materia_input in ('matematica', 'fisica', 'quimica', 'biologia', 'portugues', 'redacao')
        or (materia_input = 'tecnico_administracao' and p.curso_tecnico = 'administracao')
        or (materia_input = 'tecnico_informatica' and p.curso_tecnico = 'informatica')
      )
  );
$$;

revoke all on function public.aluno_pode_acessar_materia(public.materia_aluno) from public, anon, authenticated;
grant execute on function public.aluno_pode_acessar_materia(public.materia_aluno) to authenticated;

create or replace function public.buscar_catalogo_curricular_detalhado(
  p_materia public.materia_aluno,
  p_serie smallint default null,
  p_trimestre smallint default null,
  p_busca text default null
)
returns table (
  habilidade_id uuid, codigo text, descricao text, serie smallint, trimestre smallint,
  unidade_tematica text, pagina_fonte integer, arquivo_fonte text,
  objetos jsonb, expectativas jsonb, descritores jsonb
)
language sql stable security invoker set search_path = '' as $$
  select h.id, h.codigo, h.descricao, cp.serie, cp.trimestre,
    hcp.unidade_tematica, hcp.source_page, hcp.arquivo_fonte,
    coalesce((select jsonb_agg(jsonb_build_object('id', oc.id, 'descricao', oc.descricao) order by oc.descricao)
      from public.habilidade_objetos ho join public.objetos_conhecimento oc on oc.id = ho.objeto_id
      where ho.habilidade_id = h.id and ho.periodo_id = cp.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', ea.id, 'descricao', ea.descricao) order by ea.descricao)
      from public.expectativas_aprendizagem ea
      where ea.habilidade_id = h.id and ea.periodo_id = cp.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'codigo', d.codigo, 'titulo', d.titulo, 'descricao', d.descricao) order by d.codigo)
      from public.habilidade_descritores hd join public.descritores_curriculares d on d.id = hd.descritor_id
      where hd.habilidade_id = h.id and hd.periodo_id = cp.id), '[]'::jsonb)
  from public.habilidades_curriculares h
  join public.habilidade_curriculo_periodos hcp on hcp.habilidade_id = h.id
  join public.curriculo_periodos cp on cp.id = hcp.periodo_id
  join public.curriculos c on c.id = cp.curriculo_id
  where h.materia_codigo = p_materia and c.status = 'publicado' and c.ativo
    and (p_serie is null or cp.serie = p_serie)
    and (p_trimestre is null or cp.trimestre = p_trimestre)
    and (nullif(btrim(coalesce(p_busca, '')), '') is null
      or h.codigo ilike '%' || btrim(p_busca) || '%'
      or h.descricao ilike '%' || btrim(p_busca) || '%')
  order by cp.serie, cp.trimestre, h.codigo;
$$;

revoke all on function public.buscar_catalogo_curricular_detalhado(public.materia_aluno, smallint, smallint, text) from public, anon;
grant execute on function public.buscar_catalogo_curricular_detalhado(public.materia_aluno, smallint, smallint, text) to authenticated;

comment on function public.buscar_catalogo_curricular_detalhado(public.materia_aluno, smallint, smallint, text)
is 'Catálogo oficial detalhado usado pelo motor de atividades do OminiSaber.';

commit;
`;

fs.writeFileSync(migrationPath, sql, 'utf8');
console.log(`Migração curricular gerada: ${migrationPath}`);
