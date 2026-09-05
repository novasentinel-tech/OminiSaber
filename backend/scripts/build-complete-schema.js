import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDirectory, '..');
const outputPath = path.join(backendRoot, 'ominisaber-schema-completo.sql');
const sources = [
  'schema/core.sql',
  'migrations/20260831_acesso_materias_aluno.sql',
  'schema/configuracoes.sql',
  'schema/biblioteca.sql',
  'schema/estoque-etapa1.sql',
  'schema/estoque-etapa2.sql',
  'schema/conquistas.sql',
  'schema/espacos-docentes.sql',
  'migrations/20260831_trilhas_estudos_completos.sql',
  'migrations/20260831_redacao_jornada_completa.sql',
  'migrations/20260831_agenda_notificacoes.sql',
  'migrations/20260902_biblioteca_acervo_unificado.sql',
  'migrations/20260903_portal_gestor.sql',
  'migrations/20260903_importacao_curricular.sql',
  'migrations/20260903_importacao_curricular_fase1.sql',
  'migrations/20260903_importacao_curricular_fase2.sql',
  'migrations/20260903_importacao_curricular_fase3.sql',
  'migrations/20260903_importacao_curricular_fase3_1.sql',
  'migrations/20260903_redacoes_avaliacoes_portugues.sql',
  'migrations/20260904_importacao_curricular_fase3_2.sql',
  'migrations/20260904_importacao_curricular_correcao_policy.sql',
  'migrations/20260904_importacao_curricular_fase3_3.sql',
  'migrations/20260904_importacao_curricular_fase3_4.sql',
  'migrations/20260904_importacao_curricular_fase3_5.sql'
];

const removeTransactionWrapper = (sql, source) => {
  const begins = sql.match(/^\s*begin;\s*$/gim) || [];
  const commits = sql.match(/^\s*commit;\s*$/gim) || [];
  if (begins.length !== 1 || commits.length !== 1) {
    throw new Error(`${source} precisa conter exatamente um BEGIN e um COMMIT.`);
  }
  return sql
    .replace(/^\s*begin;\s*$/im, '')
    .replace(/^\s*commit;\s*$/im, '')
    .trim();
};

const sections = sources.map((source, index) => {
  const absolutePath = path.join(backendRoot, source);
  const sql = fs.readFileSync(absolutePath, 'utf8');
  const body = removeTransactionWrapper(sql, source);
  return `-- ============================================================================\n-- ETAPA ${index + 1}/${sources.length}: ${source}\n-- ============================================================================\n\n${body}`;
});

const header = `-- OminiSaber | Schema completo para instalação limpa no Supabase
-- Gerado por backend/scripts/build-complete-schema.js.
-- Não edite este arquivo diretamente; altere os schemas de origem e gere novamente.
-- A instalação inteira é atômica: qualquer erro desfaz todas as etapas.

begin;`;

const footer = `commit;

-- Fim do schema completo do OminiSaber.
`;

fs.writeFileSync(outputPath, `${header}\n\n${sections.join('\n\n')}\n\n${footer}`, 'utf8');
console.log(`Schema completo gerado: ${outputPath}`);
