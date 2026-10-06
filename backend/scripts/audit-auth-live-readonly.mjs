import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

dotenv.config({ path: new URL('../../.env', import.meta.url) });
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publicKey || !secret) throw new Error('Configuração de auditoria incompleta.');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, secret, options);
const err = (error) => error ? { code: error.code || null, status: error.status || null, message: error.message } : null;
const rows = [];
for (let page = 1; page <= 20; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error(JSON.stringify(err(error)));
  console.log(JSON.stringify({ authPage: page, returned: data.users.length, total: data.total, nextPage: data.nextPage, lastPage: data.lastPage }));
  rows.push(...data.users);
  if (data.users.length < 100) break;
}
const inventory = await admin.from('perfis').select('role,matricula,tipo_professor,curso_tecnico');
console.log(JSON.stringify({ inventory: { authCount: rows.length, authSyntheticEmails: rows.filter(user => /teste[.@]/.test(user.email || '')).map(user => user.email), profileRoles: (inventory.data || []).reduce((acc, profile) => { acc[profile.role] = (acc[profile.role] || 0) + 1; return acc; }, {}), error: err(inventory.error) } }));
const studentProfiles = await admin.from('perfis').select('id,matricula,turma_id,email_contato').eq('role', 'aluno').limit(3);
const inventoryPublic = createClient(url, publicKey, options);
for (const profile of studentProfiles.data || []) {
  const userResponse = await admin.auth.admin.getUserById(profile.id);
  const user = userResponse.data.user;
  console.log(JSON.stringify({ studentProfile: { id: profile.id, matricula: profile.matricula, turma_id: profile.turma_id, syntheticContactEmail: /teste|test|example|invalid/.test(profile.email_contato || '') ? profile.email_contato : '[redacted]' }, authExists: Boolean(user), syntheticEmail: user && /teste[.@]/.test(user.email || '') ? user.email : null, deletedAt: user?.deleted_at || null, error: err(userResponse.error) }));
  const resolved = await inventoryPublic.rpc('email_por_matricula', { matricula_input: profile.matricula });
  console.log(JSON.stringify({ syntheticStudentRegistration: profile.matricula, resolvedEmail: /teste|test|example|invalid/.test(resolved.data || '') ? resolved.data : resolved.data ? '[redacted]' : null, error: err(resolved.error) }));
}
for (const path of ['../ominisaber-supabase-config.js', '../../netlify-dist/backend/ominisaber-supabase-config.js']) {
  const sandbox = { window: {} };
  vm.runInNewContext(await readFile(new URL(path, import.meta.url), 'utf8'), sandbox);
  const config = sandbox.window.OMINISABER_SUPABASE_CONFIG;
  console.log(JSON.stringify({ configuration: path, project: new URL(config.url).hostname, sameUrlAsEnvironment: config.url === url, samePublicKeyAsEnvironment: config.anonKey === publicKey }));
}
if (process.argv.includes('--inventory-only')) process.exit(0);
const emails = Array.from({ length: 30 }, (_, i) => `aluno${String(i + 1).padStart(2, '0')}@teste.ominisaber.com`);
const targets = rows.filter((user) => emails.includes(user.email) || user.email === 'professor.portugues.teste@ominisaber.com.br');
const profileResponse = await admin.from('perfis').select('id,role,matricula,tipo_professor,curso_tecnico').in('id', targets.map((user) => user.id));
const profiles = profileResponse.data || [];
console.log(JSON.stringify({ project: new URL(url).hostname, totalAuthUsers: rows.length, syntheticStudentsFound: targets.filter(user => emails.includes(user.email)).length, missingStudents: emails.filter(email => !rows.some(user => user.email === email)), profileError: err(profileResponse.error), profiles: profiles.map(profile => ({ email: targets.find(user => user.id === profile.id)?.email, role: profile.role, matricula: profile.matricula, tipo_professor: profile.tipo_professor, curso_tecnico: profile.curso_tecnico })) }));
const anon = createClient(url, publicKey, options);
for (const registration of ['profportugues', 'userprofportugues']) {
  const response = await anon.rpc('email_por_matricula', { matricula_input: registration });
  console.log(JSON.stringify({ registration, resolvedEmail: response.data, error: err(response.error) }));
}
async function checkLogin(email, password) {
  const client = createClient(url, publicKey, options);
  const response = await client.auth.signInWithPassword({ email, password });
  let profile = null;
  if (response.data.user) {
    const query = await client.from('perfis').select('role,tipo_professor,curso_tecnico,matricula').eq('id', response.data.user.id).single();
    profile = { data: query.data, error: err(query.error) };
    await client.auth.signOut({ scope: 'local' });
  }
  console.log(JSON.stringify({ email, login: Boolean(response.data.session), error: err(response.error), profile }));
}
for (const specialty of ['portugues', 'matematica', 'administracao', 'informatica']) {
  await checkLogin(`professor.${specialty}.teste@ominisaber.com.br`, `senha123prof${specialty}`);
}
const availableStudentEmails = emails.filter(email => rows.some(user => user.email === email));
console.log(JSON.stringify({ studentAuthAvailable: availableStudentEmails.length, missingStudentLoginsSkipped: emails.length - availableStudentEmails.length }));
for (const email of availableStudentEmails.slice(0, 1)) await checkLogin(email, 'Teste@12345');
