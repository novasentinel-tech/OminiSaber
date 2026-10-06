import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Restricted repair for the documented synthetic test cohort. No deletion,
// password reset, content seeding or replacement of existing profile IDs.
dotenv.config({ path: new URL('../../.env', import.meta.url) });
const project = 'mvnuhwlnbhijjlosmnfv';
const classId = 'd2400000-0000-4000-8000-000000000001';
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !secret || !publicKey) throw new Error('Configuração do ambiente incompleta.');
if (new URL(url).hostname !== `${project}.supabase.co`) throw new Error('Projeto diferente do ambiente sintético autorizado.');
if (secret === publicKey) throw new Error('A chave pública deve ser diferente da chave administrativa.');
const apply = process.argv.includes('--apply');
const verify = process.argv.includes('--verify-only') || process.argv.includes('--verify');
if (apply && verify) throw new Error('Selecione somente --apply ou --verify.');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, secret, options);
const safeError = (error) => error ? { code: error.code || null, status: error.status || null, message: error.message } : null;
const requireResult = (response, label) => {
  if (response.error) throw new Error(`${label}: ${JSON.stringify(safeError(response.error))}`);
  return response.data;
};

requireResult(await admin.from('turmas').select('id').eq('id', classId).single(), 'Turma');
const teacher = requireResult(await admin.from('perfis').select('id,role,tipo_professor').eq('matricula', 'userprofportugues').single(), 'Professor');
if (teacher.role !== 'professor' || teacher.tipo_professor !== 'portugues') throw new Error('O professor de Português não foi confirmado.');
const links = requireResult(await admin.from('professor_turma_materias').select('professor_id,turma_id,materia_codigo,ativo').eq('professor_id', teacher.id).eq('turma_id', classId).eq('materia_codigo', 'portugues').eq('ativo', true), 'Vínculo');
if (links.length !== 1) throw new Error('Vínculo único e ativo de Português não encontrado.');

const profiles = requireResult(await admin.from('perfis').select('id,nome,matricula,role,turma_id,curso_tecnico,email_contato').eq('role', 'aluno').eq('turma_id', classId), 'Perfis de aluno');
if (profiles.length !== 30) throw new Error('A turma deve ter exatamente os 30 perfis sintéticos existentes; revisão manual necessária.');
const users = [];
for (let page = 1; page <= 20; page++) {
  const result = requireResult(await admin.auth.admin.listUsers({ page, perPage: 100 }), 'Lista de usuários Auth');
  users.push(...result.users);
  if (!result.nextPage) break;
}
const plan = [];
const publicProbe = createClient(url, publicKey, options);
for (let number = 1; number <= 30; number++) {
  const suffix = String(number).padStart(2, '0');
  const email = `aluno${suffix}@teste.ominisaber.com`;
  const matches = profiles.filter(profile => {
    const parsed = /^TEST-PT-\s*(\d+)$/.exec(profile.matricula || '');
    return profile.email_contato?.toLowerCase() === email || Number(parsed?.[1]) === number;
  });
  if (matches.length !== 1) throw new Error(`Perfil sintético ${suffix} sem correspondência única.`);
  const profile = matches[0];
  if (profile.role !== 'aluno' || profile.curso_tecnico !== 'informatica' || !profile.matricula) throw new Error(`Perfil ${suffix} incompatível com a turma sintética.`);
  const previousContact = String(profile.email_contato || '').toLowerCase();
  const malformedSynthetic = /^aluno\s+(\d+)@teste\.ominisaber\.com$/.exec(previousContact);
  if (previousContact && previousContact !== email && Number(malformedSynthetic?.[1]) !== number) throw new Error(`E-mail de contato incompatível no perfil ${suffix}; não substituir dados existentes.`);
  const emailUser = users.find(user => user.email?.toLowerCase() === email);
  const idResponse = await admin.auth.admin.getUserById(profile.id);
  const idUser = idResponse.data.user;
  if (idResponse.error && idResponse.error.code !== 'user_not_found') throw new Error(`Consulta Auth ${suffix}: ${JSON.stringify(safeError(idResponse.error))}`);
  if (emailUser && emailUser.id !== profile.id) throw new Error(`E-mail sintético ${suffix} pertence a outra identidade; não duplicar.`);
  if (idUser && idUser.email?.toLowerCase() !== email) throw new Error(`ID do perfil ${suffix} pertence a outro e-mail; não substituir.`);
  const rawEmail = requireResult(await publicProbe.rpc('email_por_matricula', { matricula_input: profile.matricula }), `Identidade SQL ${suffix}`);
  plan.push({ number, suffix, email, profile, exists: Boolean(idUser || emailUser), requiresSqlRepair: !idUser && Boolean(rawEmail) });
}
if (new Set(plan.map(item => item.profile.id)).size !== 30) throw new Error('Os perfis sintéticos devem manter 30 IDs distintos.');
console.log(JSON.stringify({ mode: apply ? 'apply' : verify ? 'verify-only' : 'dry-run', project, classId, existingProfiles: profiles.length, existingAuthStudents: plan.filter(item => item.exists).length, missingAuthStudents: plan.filter(item => !item.exists).length, sqlAuthRowsNeedingRepair: plan.filter(item => item.requiresSqlRepair).length, preserveProfileIds: true, preserveRegistrations: true, professorLinkVerified: true }));
if (!apply && !verify) process.exit(0);
if (plan.some(item => item.requiresSqlRepair)) throw new Error('Existem identidades SQL que o GoTrue não reconhece; reparar as linhas existentes, sem criar contas duplicadas.');
if (verify && plan.some(item => !item.exists)) throw new Error('A verificação exige os 30 usuários de teste existentes no Auth.');

let created = 0;
for (const item of plan) {
  if (apply && !item.exists) {
    const response = await admin.auth.admin.createUser({
      id: item.profile.id,
      email: item.email,
      password: 'Teste@12345',
      email_confirm: true,
      user_metadata: { nome: item.profile.nome, matricula: item.profile.matricula, curso_tecnico: 'informatica' },
      app_metadata: { ominisaber_role: 'aluno', synthetic_test_account: true },
    });
    const result = requireResult(response, `Restauração Auth ${item.suffix}`);
    if (result.user.id !== item.profile.id) throw new Error(`Auth ${item.suffix} retornou ID diferente; interrompendo.`);
    created++;
    console.log(JSON.stringify({ restored: item.suffix, existingProfileIdPreserved: true }));
  }
  if (apply && item.profile.email_contato !== item.email) {
    requireResult(await admin.from('perfis').update({ email_contato: item.email }).eq('id', item.profile.id).eq('role', 'aluno').eq('turma_id', classId).select('id').single(), `Contato sintético ${item.suffix}`);
  }
}
const afterProfiles = requireResult(await admin.from('perfis').select('id,matricula,role,turma_id,curso_tecnico,email_contato').in('id', plan.map(item => item.profile.id)), 'Perfis após restauração');
if (afterProfiles.length !== 30) throw new Error('A verificação exige os mesmos 30 perfis.');
for (const item of plan) {
  const profile = afterProfiles.find(row => row.id === item.profile.id);
  if (!profile || profile.role !== 'aluno' || profile.turma_id !== classId || profile.curso_tecnico !== 'informatica' || profile.matricula !== item.profile.matricula || profile.email_contato !== item.email) throw new Error(`A identidade do perfil ${item.suffix} não foi preservada.`);
  const user = requireResult(await admin.auth.admin.getUserById(item.profile.id), `Auth após restauração ${item.suffix}`).user;
  if (user.email?.toLowerCase() !== item.email || !user.email_confirmed_at || user.role !== 'authenticated') throw new Error(`Auth ${item.suffix} não possui e-mail confirmado e papel padrão correspondente.`);
  if (!user.identities?.some(identity => identity.provider === 'email' && identity.identity_data?.email === item.email)) throw new Error(`Auth ${item.suffix} não possui identidade de e-mail correspondente.`);
}
const first = plan[0];
const publicClient = createClient(url, publicKey, options);
for (const sample of [{ mode: 'email', item: first }, { mode: 'matricula', item: first }, { mode: 'ultimo-aluno', item: plan[29] }]) {
  const { mode, item } = sample;
  const email = mode === 'matricula' ? requireResult(await publicClient.rpc('email_por_matricula', { matricula_input: item.profile.matricula }), 'Login por matrícula') : item.email;
  if (email !== item.email) throw new Error('A matrícula não resolve o e-mail do aluno preservado.');
  const login = requireResult(await publicClient.auth.signInWithPassword({ email, password: 'Teste@12345' }), `Login ${mode}`);
  if (!login.session || login.user.id !== item.profile.id) throw new Error('O login não retornou a identidade esperada.');
  const profile = requireResult(await publicClient.from('perfis').select('role,turma_id,curso_tecnico').eq('id', login.user.id).single(), 'Perfil com RLS');
  if (profile.role !== 'aluno' || profile.turma_id !== classId || profile.curso_tecnico !== 'informatica') throw new Error('O perfil protegido não corresponde à turma sintética.');
  requireResult(await publicClient.auth.signOut({ scope: 'local' }), 'Encerramento da sessão de teste');
  console.log(JSON.stringify({ check: `login-${mode}`, success: true, profileRlsVerified: true }));
}
console.log(JSON.stringify({ result: 'verified', createdAuthStudents: created, confirmedAuthStudents: 30, emailIdentitiesVerified: 30, preservedProfiles: 30, preservedRegistrations: 30, existingAuthPasswordsChanged: 0, deletedRecords: 0, contentSeeded: false }));
