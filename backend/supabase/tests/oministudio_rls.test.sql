begin;

select plan(18);

select ok((select relrowsecurity from pg_class where oid = 'public.studio_experiencias'::regclass), 'RLS em studio_experiencias');
select ok((select relrowsecurity from pg_class where oid = 'public.studio_experiencia_versoes'::regclass), 'RLS em studio_experiencia_versoes');
select ok((select relrowsecurity from pg_class where oid = 'public.studio_experiencia_turmas'::regclass), 'RLS em studio_experiencia_turmas');
select ok((select relrowsecurity from pg_class where oid = 'public.studio_tentativas'::regclass), 'RLS em studio_tentativas');
select ok((select relrowsecurity from pg_class where oid = 'public.studio_respostas'::regclass), 'RLS em studio_respostas');
select ok((select relrowsecurity from pg_class where oid = 'public.studio_auditoria'::regclass), 'RLS em studio_auditoria');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'studio-prof-1@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"nome":"Professor Studio 1","matricula":"STP1","curso_tecnico":"informatica"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'studio-prof-2@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"nome":"Professor Studio 2","matricula":"STP2","curso_tecnico":"informatica"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'studio-aluno-1@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"nome":"Aluno Studio 1","matricula":"STA1","curso_tecnico":"informatica"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'studio-aluno-2@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"nome":"Aluno Studio 2","matricula":"STA2","curso_tecnico":"informatica"}', now(), now());

insert into public.turmas (id, nome, ano_letivo, serie) values
  ('30000000-0000-0000-0000-000000000001', 'Studio A', 2026, '2ª série'),
  ('30000000-0000-0000-0000-000000000002', 'Studio B', 2026, '2ª série');

update public.perfis set role = 'professor', tipo_professor = 'portugues', curso_tecnico = null
where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
update public.perfis set turma_id = '30000000-0000-0000-0000-000000000001'
where id = '20000000-0000-0000-0000-000000000001';
update public.perfis set turma_id = '30000000-0000-0000-0000-000000000002'
where id = '20000000-0000-0000-0000-000000000002';

insert into public.professor_turma_materias (professor_id, turma_id, materia_codigo)
values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'portugues');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok($$
  insert into public.studio_experiencias
    (id, professor_id, materia_codigo, titulo, rascunho)
  values (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'portugues',
    'Experiência RLS',
    '{"version":1,"title":"Experiência RLS","start":"q1","blocks":[{"id":"q1","type":"choice","title":"Questão","instructions":"Escolha","points":2,"options":["A","B"],"correct":1,"position":{"x":0,"y":0}}],"edges":[]}'::jsonb
  )
$$, 'professor cria rascunho da propria disciplina');

select results_eq(
  $$ select count(*)::integer from public.studio_experiencias where id = '40000000-0000-0000-0000-000000000001' $$,
  array[1],
  'professor le o proprio rascunho'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$ select count(*)::integer from public.studio_experiencias where id = '40000000-0000-0000-0000-000000000001' $$,
  array[0],
  'outro professor nao le o rascunho'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$ select count(*)::integer from public.studio_experiencias where id = '40000000-0000-0000-0000-000000000001' $$,
  array[0],
  'aluno nao le tabela com snapshot privado'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select lives_ok($$
  select public.publicar_experiencia_studio(
    '40000000-0000-0000-0000-000000000001',
    array['30000000-0000-0000-0000-000000000001'::uuid],
    null,
    null
  )
$$, 'professor publica apenas para turma vinculada');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select lives_ok($$
  select public.obter_experiencia_publicada_studio('40000000-0000-0000-0000-000000000001')
$$, 'aluno da turma obtem snapshot publico');

select ok(
  not ((public.obter_experiencia_publicada_studio('40000000-0000-0000-0000-000000000001')->'work'->'blocks'->0) ? 'correct'),
  'snapshot do aluno nao contem gabarito'
);

select lives_ok($$
  select public.iniciar_tentativa_studio('40000000-0000-0000-0000-000000000001')
$$, 'aluno vinculado inicia tentativa');

select lives_ok($$
  select public.salvar_resposta_studio(
    (select id from public.studio_tentativas where aluno_id = '20000000-0000-0000-0000-000000000001' limit 1),
    'q1',
    '1'::jsonb
  )
$$, 'aluno salva resposta com correcao no servidor');

select lives_ok($$
  select public.enviar_tentativa_studio(
    (select id from public.studio_tentativas where aluno_id = '20000000-0000-0000-0000-000000000001' limit 1)
  )
$$, 'aluno envia tentativa');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.obter_experiencia_publicada_studio('40000000-0000-0000-0000-000000000001') $$,
  'P0001',
  'Experiencia indisponivel para este aluno.',
  'aluno de outra turma nao recebe a experiencia'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$ select * from public.studio_experiencias $$,
  '42501',
  null,
  'anon nao acessa tabelas do OminiStudio'
);

reset role;
select * from finish();

delete from auth.users
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002'
);

delete from public.turmas
where id in (
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002'
);

commit;
