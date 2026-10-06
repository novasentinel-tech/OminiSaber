-- OminiSaber | Governança, observabilidade e índices relacionais do banco

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to service_role;

-- PostgreSQL não cria índices automaticamente para chaves estrangeiras. Este
-- bloco cobre relações simples e compostas ainda sem um índice utilizável,
-- preservando índices existentes e sem alterar dados.
do $$
declare
  relation_record record;
  index_name text;
begin
  for relation_record in
    select
      constraint_row.conrelid,
      constraint_row.conname,
      namespace_row.nspname,
      table_row.relname,
      string_agg(format('%I', attribute_row.attname), ', ' order by key_row.ordinality) as columns_sql
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class table_row
      on table_row.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    cross join lateral unnest(constraint_row.conkey)
      with ordinality as key_row(attnum, ordinality)
    join pg_catalog.pg_attribute attribute_row
      on attribute_row.attrelid = constraint_row.conrelid
     and attribute_row.attnum = key_row.attnum
    where constraint_row.contype = 'f'
      and namespace_row.nspname = 'public'
      and not exists (
        select 1
        from pg_catalog.pg_index index_row
        where index_row.indrelid = constraint_row.conrelid
          and index_row.indisvalid
          and index_row.indisready
          and index_row.indpred is null
          and index_row.indkey::smallint[] @> constraint_row.conkey
      )
    group by
      constraint_row.conrelid,
      constraint_row.conname,
      namespace_row.nspname,
      table_row.relname
  loop
    index_name := format(
      'idx_fk_%s_%s',
      left(relation_record.relname, 40),
      left(md5(relation_record.conname), 8)
    );

    execute format(
      'create index if not exists %I on %I.%I (%s)',
      index_name,
      relation_record.nspname,
      relation_record.relname,
      relation_record.columns_sql
    );
  end loop;
end
$$;

-- Diagnóstico somente de metadados. Não retorna conteúdo escolar nem dados de
-- usuários e não é exposto para clientes anônimos ou autenticados.
create or replace function private.database_health_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with public_tables as (
    select
      class_row.oid,
      class_row.relname,
      class_row.relrowsecurity
    from pg_catalog.pg_class class_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = class_row.relnamespace
    where namespace_row.nspname = 'public'
      and class_row.relkind in ('r', 'p')
  ),
  tables_without_primary_key as (
    select table_row.relname
    from public_tables table_row
    where not exists (
      select 1
      from pg_catalog.pg_constraint constraint_row
      where constraint_row.conrelid = table_row.oid
        and constraint_row.contype = 'p'
    )
  ),
  foreign_keys_without_index as (
    select
      table_row.relname,
      constraint_row.conname
    from pg_catalog.pg_constraint constraint_row
    join public_tables table_row
      on table_row.oid = constraint_row.conrelid
    where constraint_row.contype = 'f'
      and not exists (
        select 1
        from pg_catalog.pg_index index_row
        where index_row.indrelid = constraint_row.conrelid
          and index_row.indisvalid
          and index_row.indisready
          and index_row.indpred is null
          and index_row.indkey::smallint[] @> constraint_row.conkey
      )
  )
  select jsonb_build_object(
    'generated_at', pg_catalog.clock_timestamp(),
    'public_table_count', (select count(*) from public_tables),
    'rls_disabled', coalesce(
      (
        select jsonb_agg(table_row.relname order by table_row.relname)
        from public_tables table_row
        where not table_row.relrowsecurity
      ),
      '[]'::jsonb
    ),
    'tables_without_primary_key', coalesce(
      (
        select jsonb_agg(table_row.relname order by table_row.relname)
        from tables_without_primary_key table_row
      ),
      '[]'::jsonb
    ),
    'foreign_keys_without_index', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'table', foreign_key_row.relname,
            'constraint', foreign_key_row.conname
          )
          order by foreign_key_row.relname, foreign_key_row.conname
        )
        from foreign_keys_without_index foreign_key_row
      ),
      '[]'::jsonb
    ),
    'invalid_constraints', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'table', constraint_row.conrelid::regclass::text,
            'constraint', constraint_row.conname
          )
          order by constraint_row.conrelid::regclass::text, constraint_row.conname
        )
        from pg_catalog.pg_constraint constraint_row
        where not constraint_row.convalidated
      ),
      '[]'::jsonb
    )
  );
$$;

comment on function private.database_health_snapshot() is
  'Resumo interno de RLS, chaves primárias, índices de FKs e constraints inválidas.';

revoke all on function private.database_health_snapshot() from public, anon, authenticated;
grant execute on function private.database_health_snapshot() to service_role;

notify pgrst, 'reload schema';

commit;
