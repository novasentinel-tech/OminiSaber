import fs from 'node:fs';

const migration = fs.readFileSync(new URL('../migrations/20260905_integracao_curricular_fase4_1.sql', import.meta.url), 'utf8');
const phase4 = fs.readFileSync(new URL('../migrations/20260905_integracao_curricular_fase4.sql', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('./build-complete-schema.js', import.meta.url), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(migration.includes('habilidade_compativel_com_materia'), 'helper central de compatibilidade existe');
assert(migration.includes('security invoker') && migration.includes("h.materia_codigo = p_materia"), 'helper valida matéria sem SECURITY DEFINER');
assert(migration.includes("h.codigo ~ '^EM\\d{2}[A-Z]{2}\\d{2}$'") && migration.includes("c.status = 'publicado'") && migration.includes('c.ativo = true'), 'helper preserva EM/publicado/ativo');
assert(migration.includes('a.tipo_professor::text::public.materia_aluno'), 'A/B/K questões derivam matéria da avaliação');
assert(migration.includes('l.tipo_professor::text::public.materia_aluno'), 'C/D/K laboratórios derivam matéria do laboratório');
assert(migration.includes('t.materia_codigo'), 'E/F atividades derivam matéria da trilha');
assert(migration.includes("'portugues'::public.materia_aluno"), 'G/H propostas usam Português explícito');
assert((migration.match(/habilidade_compativel_com_materia\(/g) || []).length >= 9, 'policies aplicam compatibilidade em USING e WITH CHECK');
assert(migration.includes('questoes_avaliacao_habilidades_manage') && migration.includes('with check'), 'A/B questões bloqueiam matéria incompatível');
assert(migration.includes('laboratorios_docentes_habilidades_manage') && migration.includes('with check'), 'C/D laboratórios bloqueiam matéria incompatível');
assert(migration.includes('atividades_habilidades_manage') && migration.includes('with check'), 'E/F atividades bloqueiam matéria incompatível');
assert(migration.includes('propostas_redacao_habilidades_manage') && migration.includes('with check'), 'G/H propostas bloqueiam matéria incompatível');
assert(phase4.includes('habilidade_curricular_publicada') && migration.includes('habilidade_compativel_com_materia'), 'I/J preservam publicação e impedem EF');
assert(migration.includes("(select public.usuario_role()) = 'gestor'") && migration.includes("a.professor_id = (select auth.uid())") && migration.includes("l.professor_id = (select auth.uid())"), 'K/L preservam autorização de professor e Gestor');
assert(build.includes('20260905_integracao_curricular_fase4_1.sql'), 'Fase 4.1 incluída no build');
console.log('OK integridade curricular: matéria do recurso compatível com habilidade EM publicada em todas as relações da Fase 4.');
console.log('Smoke/static Fase 4.1: cobre cenários A-L por invariantes SQL; sem PostgreSQL/Supabase real, não são testes comportamentais.');