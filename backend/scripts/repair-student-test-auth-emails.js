import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Use only after the NULL instance_id rows have been repaired server-side.
// Normalizes nine malformed synthetic emails. Never resets any password.
dotenv.config({ path: new URL('../../.env', import.meta.url) });
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const classId = 'd2400000-0000-4000-8000-000000000001';
if (!url || !secret || new URL(url).hostname !== 'mvnuhwlnbhijjlosmnfv.supabase.co') throw new Error('Projeto de teste autorizado não configurado.');
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const apply = process.argv.includes('--apply');
const ensureIdentities = process.argv.includes('--ensure-email-identities');
const checked = (response, label) => {
  if (response.error) throw new Error(`${label}: ${JSON.stringify({ code: response.error.code, status: response.error.status, message: response.error.message })}`);
  return response.data;
};
const profiles = checked(await admin.from('perfis').select('id,matricula,role,curso_tecnico,turma_id,email_contato').eq('role', 'aluno').eq('turma_id', classId), 'Perfis');
if (profiles.length !== 30) throw new Error('A turma deve manter exatamente os 30 perfis sintéticos.');
const plan = [];
for (let number = 1; number <= 30; number++) {
  const suffix = String(number).padStart(2, '0');
  const matches = profiles.filter(row => Number(/^TEST-PT-\s*(\d+)$/.exec(row.matricula || '')?.[1]) === number);
  if (matches.length !== 1 || matches[0].curso_tecnico !== 'informatica') throw new Error(`Perfil ${suffix} não corresponde à coorte autorizada.`);
  const profile = matches[0];
  const user = checked(await admin.auth.admin.getUserById(profile.id), `Auth ${suffix}`).user;
  const email = `aluno${suffix}@teste.ominisaber.com`;
  const malformed = new RegExp(`^aluno +${number}@teste\\.ominisaber\\.com$`);
  if (user.role !== 'authenticated' || user.deleted_at || !user.email_confirmed_at) throw new Error(`Auth ${suffix} tem estado diferente do esperado.`);
  if (user.email !== email && !(number <= 9 && malformed.test(user.email || ''))) throw new Error(`E-mail Auth ${suffix} diferente da forma sintética autorizada.`);
  if (profile.email_contato !== email && !(number <= 9 && malformed.test(profile.email_contato || ''))) throw new Error(`Contato ${suffix} diferente da forma sintética autorizada.`);
  plan.push({ profile, user, email, suffix });
}
const hasEmailIdentity = (item) => item.user.identities?.some(identity => identity.provider === 'email' && identity.identity_data?.email === item.email);
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', authUsersVerified: plan.length, malformedAuthEmails: plan.filter(row => row.user.email !== row.email).length, malformedContactEmails: plan.filter(row => row.profile.email_contato !== row.email).length, missingEmailIdentities: plan.filter(row => !hasEmailIdentity(row)).length, ensureEmailIdentities: ensureIdentities, passwordChanges: 0, identityIdsPreserved: true }));
if (!apply) process.exit(0);
let changedAuth = 0;
let changedContacts = 0;
let ensuredEmailIdentities = 0;
for (const item of plan) {
  if (item.user.email !== item.email || (ensureIdentities && !hasEmailIdentity(item))) {
    const updated = checked(await admin.auth.admin.updateUserById(item.profile.id, { email: item.email, email_confirm: true }), `E-mail Auth ${item.suffix}`).user;
    if (updated.id !== item.profile.id || updated.email !== item.email) throw new Error(`Resposta Auth ${item.suffix} não corresponde à identidade esperada.`);
    if (item.user.email !== item.email) changedAuth++;
    if (ensureIdentities) {
      if (!updated.identities?.some(identity => identity.provider === 'email' && identity.identity_data?.email === item.email)) throw new Error(`A identidade de e-mail ${item.suffix} não foi confirmada pela API.`);
      ensuredEmailIdentities++;
    }
  }
  if (item.profile.email_contato !== item.email) {
    checked(await admin.from('perfis').update({ email_contato: item.email }).eq('id', item.profile.id).eq('role', 'aluno').eq('turma_id', classId).select('id').single(), `Contato ${item.suffix}`);
    changedContacts++;
  }
}
console.log(JSON.stringify({ result: 'applied', correctedAuthEmails: changedAuth, correctedProfileContacts: changedContacts, ensuredEmailIdentities, passwordChanges: 0, profilesAdded: 0, deletedRecords: 0 }));
