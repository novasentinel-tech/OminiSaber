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
