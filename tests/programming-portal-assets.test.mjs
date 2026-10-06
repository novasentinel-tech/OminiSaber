import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { publicCopies } from '../scripts/prepare-netlify-site.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('imports do laboratório resolvem desde os scripts reais do professor e aluno', async () => {
  for (const [script, target] of [
    ['frontend/professor/specialty/portal.js', '../../shared/programming-lab/programming-lab.js'],
    ['frontend/aluno/modulo_de_trilhas/shared/study-app.js', '../../../shared/programming-lab/programming-lab.js'],
  ]) {
    const source = await read(script);
    assert.ok(source.includes(`import("${target}")`), script);
    await access(new URL(target, new URL(script, root)));
  }
  const labPath = new URL('frontend/shared/programming-lab/programming-lab.js', root);
  const lab = await readFile(labPath, 'utf8');
  for (const match of lab.matchAll(/from\s+['"]([^'"]+)['"]/g)) await access(new URL(match[1], labPath));
  assert.equal(new URL('../../aluno/modulo_de_trilhas/ide/index.html', labPath).pathname.endsWith('/frontend/aluno/modulo_de_trilhas/ide/index.html'), true);
});

test('páginas de laboratório e catálogo carregam o CSS compartilhado pelo caminho correto', async () => {
  for (const page of [
    'frontend/professor/professor_tecnico_informatica/laboratorio/index.html',
    'frontend/aluno/modulo_de_trilhas/ide/index.html',
    'frontend/aluno/modulo_de_trilhas/index.html',
  ]) {
    const html = await read(page);
    const style = [...html.matchAll(/<link[^>]+href="([^"]*programming-lab\.css[^\"]*)"/g)];
    assert.equal(style.length, 1, page);
    const path = new URL(style[0][1], new URL(page, root)); path.search = '';
    await access(path);
  }
  assert.ok(publicCopies.some(([source, destination = source]) =>
    source === 'frontend' && destination === 'frontend'), 'o pacote publica a árvore frontend com os assets do laboratório');
});

test('fixtures de integração não carregam autenticação ou cliente Supabase real', async () => {
  for (const file of ['tests/programming-portal-fixture.html', 'tests/programming-portal-fixture.js']) {
    const source = await read(file);
    assert.doesNotMatch(source, /(?:src\s*=|loadScript\()[^\n]*(?:ominisaber-supabase|supabase-2\.|\/app\.js["'])/);
    assert.doesNotMatch(source, /service_role|anon_key|access_token|sb_secret_/i);
  }
  const fixture = await read('tests/programming-portal-fixture.js');
  assert.match(fixture, /fixture-programming-/);
  assert.match(fixture, /createTeacherLab:\s*capture\('createTeacherLab'/);
});
