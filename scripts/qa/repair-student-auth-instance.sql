-- Restricted repair for the 30 existing synthetic students. Preserves IDs,
-- passwords, emails, identities, profiles, registrations and class membership.
-- Also normalizes four absent token strings diagnosed as NULL on this cohort.
-- Run on the documented project mvnuhwlnbhijjlosmnfv only.
begin;

do $$
declare
  cohort_count integer;
  matched_emails integer;
  invalid_instances integer;
  repaired integer;
begin
  select count(*),
    count(*) filter (where u.email ~ '^aluno *[0-9]{1,2}@teste[.]ominisaber[.]com$'
      and substring(u.email from '([0-9]+)@')::integer = substring(p.matricula from '([0-9]+)$')::integer),
    count(*) filter (where u.instance_id is not null and u.instance_id <> '00000000-0000-0000-0000-000000000000'::uuid)
  into cohort_count, matched_emails, invalid_instances
  from public.perfis p join auth.users u on u.id=p.id
  where p.role='aluno'
    and p.turma_id='d2400000-0000-4000-8000-000000000001'::uuid
    and p.curso_tecnico='informatica'
    and p.matricula ~ '^TEST-PT- *([1-9]|[12][0-9]|30)$'
    and u.aud='authenticated' and u.role='authenticated'
    and u.email_confirmed_at is not null and u.deleted_at is null;
  if cohort_count <> 30 or matched_emails <> 30 or invalid_instances <> 0 then
    raise exception 'Synthetic cohort differs from the confirmed diagnosis; no repair was applied.';
  end if;

  update auth.users u set
    instance_id='00000000-0000-0000-0000-000000000000'::uuid,
    updated_at=now()
  from public.perfis p
  where p.id=u.id and p.role='aluno'
    and p.turma_id='d2400000-0000-4000-8000-000000000001'::uuid
    and p.curso_tecnico='informatica'
    and p.matricula ~ '^TEST-PT- *([1-9]|[12][0-9]|30)$'
    and u.instance_id is null;
  get diagnostics repaired = row_count;
  raise notice 'Synthetic authentication instances repaired: %', repaired;

  -- GoTrue loads these fields as strings. NULL does not represent a token;
  -- replace only missing values with the normal empty-string representation.
  update auth.users u set
    confirmation_token=coalesce(u.confirmation_token, ''),
    recovery_token=coalesce(u.recovery_token, ''),
    email_change_token_new=coalesce(u.email_change_token_new, ''),
    email_change=coalesce(u.email_change, ''),
    updated_at=now()
  from public.perfis p
  where p.id=u.id and p.role='aluno'
    and p.turma_id='d2400000-0000-4000-8000-000000000001'::uuid
    and p.curso_tecnico='informatica'
    and p.matricula ~ '^TEST-PT- *([1-9]|[12][0-9]|30)$'
    and u.instance_id='00000000-0000-0000-0000-000000000000'::uuid
    and (u.confirmation_token is null or u.recovery_token is null
      or u.email_change_token_new is null or u.email_change is null);
  get diagnostics repaired = row_count;
  raise notice 'Synthetic authentication empty-string fields normalized: %', repaired;
end $$;

select count(*) as synthetic_auth_instances_valid
from public.perfis p join auth.users u on u.id=p.id
where p.role='aluno'
  and p.turma_id='d2400000-0000-4000-8000-000000000001'::uuid
  and p.matricula ~ '^TEST-PT- *([1-9]|[12][0-9]|30)$'
  and u.instance_id='00000000-0000-0000-0000-000000000000'::uuid
  and u.confirmation_token is not null and u.recovery_token is not null
  and u.email_change_token_new is not null and u.email_change is not null;
commit;
