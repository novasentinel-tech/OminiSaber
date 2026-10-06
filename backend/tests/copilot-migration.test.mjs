import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('migration permite ideias e trilhas e mantém ações e logs anteriores', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table public.copiloto_execucoes (id int generated always as identity, acao text not null check(acao in ('gerar_atividade','revisar_atividade','sugerir_recuperacao')), prompt_versao text not null default 'fase3.0-v1'); insert into public.copiloto_execucoes(acao) values('gerar_atividade');`);
    const sql = fs.readFileSync(new URL('../migrations/20261003_copiloto_ideias_trilhas.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(`insert into public.copiloto_execucoes(acao) values('gerar_ideias'),('gerar_trilha'),('revisar_atividade'),('sugerir_recuperacao');`);
    assert.equal((await db.query('select count(*)::int as total from public.copiloto_execucoes')).rows[0].total, 5);
    assert.equal((await db.query('select prompt_versao from public.copiloto_execucoes where id=1')).rows[0].prompt_versao, 'fase3.0-v1');
    assert.equal((await db.query('select prompt_versao from public.copiloto_execucoes where id=2')).rows[0].prompt_versao, 'copiloto-pedagogico-2026-10-03');
    await assert.rejects(db.exec(`insert into public.copiloto_execucoes(acao) values('publicar_auto');`));
    await db.exec(sql); // Idempotent schema rebuild.
  } finally { await db.close(); }
});

test('RPC reserva quotas atomicamente por professor e operação sem contar falhas', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create type public.materia_aluno as enum ('matematica');
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create table public.copiloto_execucoes (
        id uuid primary key default gen_random_uuid(),
        sessao_id uuid,
        professor_id uuid not null,
        turma_id uuid not null,
        acao text not null,
        materia_codigo public.materia_aluno not null,
        habilidade_ids uuid[] not null default '{}',
        solicitacao_resumo jsonb not null,
        prompt_versao text not null,
        provedor text,
        modelo text,
        status text not null default 'processando',
        created_at timestamptz not null default now()
      );
    `);
    const sql = fs.readFileSync(new URL('../migrations/20261006_copiloto_operacoes_piloto.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    const call = (operation, minuteLimit = 1, dailyLimit = 10) => db.query(`
      select * from public.reservar_execucao_copiloto(
        '10000000-0000-4000-8000-000000000001', ${minuteLimit}, ${dailyLimit}, null,
        '20000000-0000-4000-8000-000000000001', '${operation}', 'matematica', '{}',
        '{"operation":"${operation}"}'::jsonb, 'test-v1', 'google-gemini', 'test-model'
      )
    `);
    const parallel = await Promise.all([call('gerar_atividade'), call('gerar_atividade')]);
    const outcomes = parallel.map(result => result.rows[0]);
    assert.equal(outcomes.filter(result => result.execution_id).length, 1);
    assert.equal(outcomes.filter(result => result.limit_reason === 'minute').length, 1);
    const ideasVariant = await call('gerar_ideias');
    assert.equal(ideasVariant.rows[0].limit_reason, 'minute');
    const separateOperation = await call('sugerir_recuperacao');
    assert.ok(separateOperation.rows[0].execution_id);
    await db.exec(`update public.copiloto_execucoes set status = 'falhou' where acao = 'gerar_atividade';`);
    const afterFailure = await call('gerar_atividade');
    assert.ok(afterFailure.rows[0].execution_id);
    const dailyLimit = await call('gerar_atividade', 10, 1);
    assert.equal(dailyLimit.rows[0].limit_reason, 'daily');
    assert.match(sql, /pg_advisory_xact_lock/);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /to service_role/);
    await db.exec(sql);
  } finally { await db.close(); }
});

test('RPC de análise retorna somente agregados e rejeita outra conta sem vínculo', async () => {
  const db = new PGlite();
  const professorA = '10000000-0000-4000-8000-000000000001';
  const professorB = '10000000-0000-4000-8000-000000000002';
  const classA = '20000000-0000-4000-8000-000000000001';
  const subject = 'matematica';
  try {
    await db.exec(`
      create schema auth;
      create type public.materia_aluno as enum ('matematica');
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table public.perfis (id uuid primary key, role text not null, ativo boolean not null);
      create function public.usuario_role() returns text language sql stable as $$ select p.role from public.perfis p where p.id = auth.uid() $$;
      create table public.professor_turma_materias (professor_id uuid, turma_id uuid, materia_codigo public.materia_aluno, ativo boolean);
      create table public.avaliacoes_docentes (id uuid primary key, professor_id uuid, turma_id uuid, materia_codigo public.materia_aluno, status text, created_at timestamptz default now());
      create table public.tentativas_avaliacao (id uuid primary key, aluno_id uuid, avaliacao_id uuid, status text, numero_tentativa integer);
      create table public.respostas_avaliacao (id uuid primary key, tentativa_id uuid, questao_id uuid, pontos_automaticos numeric, pontos_manuais numeric);
      create table public.questoes_avaliacao (id uuid primary key, avaliacao_id uuid, pontos numeric);
      create table public.questoes_avaliacao_habilidades (questao_id uuid, habilidade_id uuid);
      create table public.habilidades_curriculares (id uuid primary key, codigo text, descricao text);
      create table public.habilidade_descritores (habilidade_id uuid, descritor_id uuid);
      create table public.descritores_curriculares (id uuid primary key, codigo text, descricao text);
      create table public.copiloto_execucoes (
        id uuid primary key default gen_random_uuid(), sessao_id uuid, professor_id uuid not null,
        turma_id uuid not null, acao text not null, materia_codigo public.materia_aluno not null,
        habilidade_ids uuid[] not null default '{}', solicitacao_resumo jsonb not null,
        prompt_versao text not null, provedor text, modelo text, status text not null default 'processando',
        created_at timestamptz not null default now()
      );
      insert into public.perfis values
        ('${professorA}', 'professor', true), ('${professorB}', 'professor', true);
      insert into public.professor_turma_materias values ('${professorA}', '${classA}', '${subject}', true);
      insert into public.avaliacoes_docentes values
        ('30000000-0000-4000-8000-000000000001', '${professorA}', '${classA}', '${subject}', 'publicado', now());
      insert into public.habilidades_curriculares values
        ('40000000-0000-4000-8000-000000000001', 'HAB-01', 'Comparar evidências.');
      insert into public.descritores_curriculares values
        ('50000000-0000-4000-8000-000000000001', 'D-01', 'Identificar relações.');
      insert into public.habilidade_descritores values
        ('40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001');
    `);
    for (let index = 1; index <= 3; index++) {
      await db.exec(`
        insert into public.questoes_avaliacao values ('60000000-0000-4000-8000-${String(index).padStart(12, '0')}', '30000000-0000-4000-8000-000000000001', 10);
        insert into public.questoes_avaliacao_habilidades values ('60000000-0000-4000-8000-${String(index).padStart(12, '0')}', '40000000-0000-4000-8000-000000000001');
        insert into public.tentativas_avaliacao values ('70000000-0000-4000-8000-${String(index).padStart(12, '0')}', '80000000-0000-4000-8000-${String(index).padStart(12, '0')}', '30000000-0000-4000-8000-000000000001', 'corrigida', 1);
        insert into public.respostas_avaliacao values ('90000000-0000-4000-8000-${String(index).padStart(12, '0')}', '70000000-0000-4000-8000-${String(index).padStart(12, '0')}', '60000000-0000-4000-8000-${String(index).padStart(12, '0')}', 4, 0);
      `);
    }
    const sql = fs.readFileSync(new URL('../migrations/20261006_copiloto_operacoes_piloto.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.query(`select set_config('request.jwt.claim.sub', '${professorA}', false)`);
    const analysis = await db.query(`select public.resumo_habilidades_copiloto('${classA}', '${subject}') as result`);
    assert.equal(analysis.rows[0].result.criticalSkills[0].performancePercent, 40);
    assert.equal(analysis.rows[0].result.criticalSkills[0].evidenceCount, 3);
    assert.equal(analysis.rows[0].result.criticalSkills[0].descriptors[0].code, 'D-01');
    assert.doesNotMatch(JSON.stringify(analysis.rows[0].result), /aluno|resposta|tentativa_id|80000000/);
    await db.query(`select set_config('request.jwt.claim.sub', '${professorB}', false)`);
    await assert.rejects(db.query(`select public.resumo_habilidades_copiloto('${classA}', '${subject}')`), /autorização/);
  } finally { await db.close(); }
});
