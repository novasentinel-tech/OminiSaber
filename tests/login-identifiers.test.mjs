import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../backend/ominisaber-supabase-client.js', import.meta.url), 'utf8');
const authSection = source.slice(source.indexOf('  const legacyTeacherRegistrations ='), source.indexOf('  const signUp ='));

function loginFixture(registrations = {}, rpcError = null, authError = null) {
  const lookups = [];
  const passwords = [];
  const client = {
    async rpc(name, { matricula_input }) {
      assert.equal(name, 'email_por_matricula');
      lookups.push(matricula_input);
      return { data: Object.hasOwn(registrations, matricula_input) ? registrations[matricula_input] : null, error: rpcError };
    },
    auth: { async signInWithPassword(credentials) {
      passwords.push({ ...credentials });
      return { data: authError ? null : { session: { user: { id: 'test-id' } } }, error: authError };
    } },
  };
  const context = vm.createContext({ client, ensureConfigured: () => true });
  const signIn = vm.runInContext(`${authSection}\n signIn`, context);
  return { signIn, lookups, passwords };
}

test('email login normalizes the email without modifying the password or resolving a registration', async () => {
  const fixture = loginFixture();
  await fixture.signIn(' Aluno01@teste.ominisaber.com ', ' Teste@12345 ');
  assert.deepEqual(fixture.lookups, []);
  assert.deepEqual(fixture.passwords, [{ email: 'aluno01@teste.ominisaber.com', password: ' Teste@12345 ' }]);
});

test('an exact registration takes precedence over a teacher shorthand', async () => {
  const fixture = loginFixture({ profportugues: 'exact@example.test', userprofportugues: 'other@example.test' });
  await fixture.signIn('profportugues', 'password');
  assert.deepEqual(fixture.lookups, ['profportugues']);
  assert.equal(fixture.passwords[0].email, 'exact@example.test');
});

test('the four legacy teacher shorthands resolve to their existing registrations', async () => {
  for (const shorthand of ['profportugues', 'profmatematica', 'profadministracao', 'profinformatica']) {
    const fixture = loginFixture({ [`user${shorthand}`]: `${shorthand}@example.test` });
    const result = await fixture.signIn(shorthand.toUpperCase(), 'password');
    assert.equal(result.error, null);
    assert.deepEqual(fixture.lookups, [shorthand.toUpperCase(), `user${shorthand}`]);
    assert.equal(fixture.passwords.length, 1);
  }
});

test('an unknown registration never guesses another account or attempts a password login', async () => {
  for (const registration of ['aluno999', 'constructor', '__proto__', 'toString']) {
    const fixture = loginFixture();
    const result = await fixture.signIn(registration, 'password');
    assert.match(result.error.message, /Matrícula não encontrada/);
    assert.deepEqual(fixture.lookups, [registration]);
    assert.deepEqual(fixture.passwords, []);
  }
});

test('RPC failures do not trigger a fallback or authenticate another account', async () => {
  const error = { message: 'network error' };
  const fixture = loginFixture({}, error);
  const result = await fixture.signIn('profportugues', 'password');
  assert.equal(result.error, error);
  assert.deepEqual(fixture.lookups, ['profportugues']);
  assert.deepEqual(fixture.passwords, []);
});

test('an incorrect password remains rejected after resolving a shorthand', async () => {
  const error = { code: 'invalid_credentials' };
  const fixture = loginFixture({ userprofportugues: 'teacher@example.test' }, null, error);
  const result = await fixture.signIn('profportugues', 'incorrect');
  assert.equal(result.error, error);
  assert.equal(result.data, null);
  assert.equal(fixture.passwords.length, 1);
});
