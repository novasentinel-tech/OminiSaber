import fs from 'node:fs';

const migration = fs.readFileSync(new URL('../migrations/20260905_integracao_curricular_fase4.sql', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../ominisaber-supabase-client.js', import.meta.url), 'utf8');
const portal = fs.readFileSync(new URL('../../frontend/professor/specialty/portal.js', import.meta.url), 'utf8');
const redacoes = fs.readFileSync(new URL('../../frontend/professor/professor_portugues/redacoes/script.js', import.meta.url), 'utf8');
const executive = fs.readFileSync(new URL('../../frontend/gestor/shared/gestor-executive.js', import.meta.url), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const relationTables = [
  'questoes_avaliacao_habilidades',
  'laboratorios_docentes_habilidades',
  'atividades_habilidades',
  'propostas_redacao_habilidades'
];
relationTables.forEach((table) => {
  assert(migration.includes(`create table if not exists public.${table}`), `${table} existe`);
  assert(migration.includes(`alter table public.${table} enable row level security`), `${table} possui RLS`);
  assert(migration.includes(`on public.${table} (`), `${table} possui índice de habilidade`);
});
assert(migration.includes('buscar_habilidades_curriculares'), 'A seleção curricular possui RPC');
assert(migration.includes("h.codigo ~ '^EM\\d{2}[A-Z]{2}\\d{2}$'") && migration.includes("c.status = 'publicado'") && migration.includes('c.ativo = true'), 'A/B/L seleção somente EM publicado ativo');
assert(migration.includes('p_busca') && migration.includes('ds.codigo ilike') && migration.includes('h.descricao ilike'), 'A busca cobre código, descrição e descritor');
assert(migration.includes('cobertura_curricular') && migration.includes("Apenas gestores podem consultar cobertura"), 'J cobertura restrita ao Gestor');
assert(migration.includes('union all') && migration.includes("'avaliação'") && migration.includes("'laboratório'") && migration.includes("'atividade'") && migration.includes("'redação'"), 'J cobertura agrega usos pedagógicos');
assert(migration.includes('habilidade_curricular_publicada'), 'B/F/L relações validam habilidade publicada');
assert(migration.includes("a.professor_id = (select auth.uid())") && migration.includes("l.professor_id = (select auth.uid())"), 'H professor só gerencia seu conteúdo');
assert(migration.includes("(select public.usuario_role()) = 'gestor'") && migration.includes('(select public.usuario_turma_id())'), 'I mantém separação entre Gestor, professor e aluno');
assert(client.includes("client.rpc('buscar_habilidades_curriculares'") && client.includes('questoes_avaliacao_habilidades'), 'C cliente consulta e vincula questões');
assert(client.includes('laboratorios_docentes_habilidades') && client.includes('propostas_redacao_habilidades'), 'E cliente vincula laboratórios e propostas');
assert(portal.includes('curriculumPickerMarkup') && portal.includes('listCurriculumSkills') && portal.includes('skillIds'), 'A/C/E Portal Professor usa seletor reutilizável');
assert(redacoes.includes('OminiCurriculumPicker') && redacoes.includes('skillIds'), 'F redações possuem vínculo opcional separado das competências');
assert(!redacoes.includes('competencia') || redacoes.includes('competencias'), 'redações preservam competências ENEM separadas');
assert(executive.includes('getCurriculumCoverage') && executive.includes('Ainda não trabalhadas') && executive.includes('data-coverage-trimestre'), 'J/K Gestor exibe cobertura filtrável');
console.log('OK integração curricular: relações N:N, seleção EM publicada, RLS, avaliações, laboratórios, redações e cobertura do Gestor.');
console.log('Smoke/static Fase 4: cobre A-M por invariantes SQL/cliente; sem PostgreSQL/Supabase real, não são testes comportamentais.');
