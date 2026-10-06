-- READ ONLY. Exactly the documented synthetic Portuguese cohort.
-- Does not print password hashes, tokens, secrets or student names.
with cohort as (
  select p.id, p.matricula, p.email_contato,
    substring(p.matricula from '([0-9]+)$')::integer as student_number
  from public.perfis p
  where p.role = 'aluno'
    and p.turma_id = 'd2400000-0000-4000-8000-000000000001'::uuid
    and p.matricula ~ '^TEST-PT-\s*([1-9]|[12][0-9]|30)$'
)
select p.student_number, p.id, p.matricula, p.email_contato,
  'aluno' || lpad(p.student_number::text, 2, '0') || '@teste.ominisaber.com' as expected_email,
  u.id is not null as auth_sql_row_exists,
  u.instance_id, u.aud, u.role, u.email, u.deleted_at,
  u.email_confirmed_at is not null as email_confirmed,
  length(coalesce(u.encrypted_password, '')) > 0 as password_hash_present,
  u.raw_app_meta_data ->> 'provider' as provider,
  u.raw_app_meta_data ->> 'ominisaber_role' as application_role,
  (select count(*) from auth.identities i where i.user_id = p.id) as identity_count
from cohort p
left join auth.users u on u.id = p.id
order by p.student_number;

select conname, pg_get_constraintdef(oid) as definition
from pg_catalog.pg_constraint
where conrelid = 'public.perfis'::regclass and contype = 'f';

select tg.tgname, ns.nspname as function_schema, fn.proname as function_name,
  pg_get_functiondef(fn.oid) as function_definition
from pg_catalog.pg_trigger tg
join pg_catalog.pg_proc fn on fn.oid = tg.tgfoid
join pg_catalog.pg_namespace ns on ns.oid = fn.pronamespace
where tg.tgrelid = 'auth.users'::regclass and not tg.tgisinternal;

-- Return NULL counts only, never token values. Uses JSON keys so diagnostics
-- still work if a newer or older Auth version omits one of these columns.
with cohort as (
  select u.* from auth.users u
  join public.perfis p on p.id = u.id
  where p.role = 'aluno'
    and p.turma_id = 'd2400000-0000-4000-8000-000000000001'::uuid
    and p.matricula ~ '^TEST-PT-\s*([1-9]|[12][0-9]|30)$'
)
select fields.key as nullable_field,
  count(*) filter (where fields.value = 'null'::jsonb) as null_rows
from cohort u
cross join lateral jsonb_each(to_jsonb(u)) fields
where fields.key in (
  'confirmation_token', 'recovery_token', 'email_change_token_new',
  'email_change', 'email_change_token_current', 'phone_change',
  'phone_change_token', 'reauthentication_token'
)
group by fields.key
order by fields.key;
