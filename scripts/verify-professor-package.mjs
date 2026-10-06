import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authDestinationPages, htmlPublicDependencies, validatePublicSupabaseConfig } from './prepare-netlify-site.mjs';

// Compare public entry points and their assets. Never inspect environment files.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcesOnly = process.argv.includes('--sources-only');
const urlArgument = process.argv.indexOf('--url');
const publicBase = urlArgument >= 0 ? new URL(process.argv[urlArgument + 1]) : null;
if (publicBase && !['127.0.0.1', 'localhost', '[::1]'].includes(publicBase.hostname)) throw new Error('A conferência HTTP é limitada à prévia local.');
const specialties = ['matematica', 'portugues', 'tecnico_administracao', 'tecnico_informatica'];
const baseTeacherFiles = specialties.flatMap(type => ['dashboard', 'avaliacoes', 'laboratorio'].flatMap(page =>
  ['index.html', 'script.js', 'style.css'].map(file => `frontend/professor/professor_${type}/${page}/${file}`),
));
const htmlUnder = async relative => {
  const items = await readdir(path.join(root, relative), { withFileTypes: true });
  const nested = await Promise.all(items.map(item => item.isDirectory()
    ? htmlUnder(`${relative}/${item.name}`)
    : item.name.endsWith('.html') ? [`${relative}/${item.name}`] : []));
  return nested.flat();
};
const specialtyHtml = (await Promise.all(specialties.map(type => htmlUnder(`frontend/professor/professor_${type}`)))).flat();
const teacherPages = [...new Set([...baseTeacherFiles, ...specialtyHtml,
  ...['index.html', 'script.js', 'style.css'].flatMap(file => [
    `frontend/professor/perfil/${file}`,
    `frontend/professor/agenda/${file}`,
    `frontend/professor/professor_portugues/redacoes/${file}`,
  ]),
])];
const sharedFiles = [
  'frontend/professor/app.js',
  'frontend/professor/specialty/configs.js',
  'frontend/professor/specialty/portal.js',
  'frontend/professor/specialty/portal.css',
  'frontend/professor/specialty/teacher-dashboard.js',
  'frontend/professor/specialty/teacher-dashboard.css',
  'frontend/professor/specialty/dashboard-data.js',
  'frontend/professor/specialty/teacher-navigation.js',
  'frontend/professor/specialty/teacher-review.js',
  'frontend/professor/specialty/teacher-review.css',
  'frontend/professor/specialty/teacher-copilot.js',
  'frontend/professor/specialty/teacher-copilot.css',
  'frontend/professor/specialty/activity-builder.js',
  'frontend/professor/specialty/activity-builder.css',
  'frontend/professor/specialty/copilot-handoff.js',
  'frontend/Parties/parties.js',
  'frontend/Parties/parties.css',
  'frontend/Parties/layouts/teacher-sidebar.css',
  'frontend/Parties/layouts/teacher-workspace.css',
  'frontend/Parties/layouts/teacher-evaluations.css',
  'frontend/Parties/styles.entry.css',
  'frontend/Parties/teacher-evaluations.js',
  'frontend/shared/omni-select.css',
  'frontend/shared/omni-select.js',
  'frontend/assets/dashboard/professora-boas-vindas.webp',
  'backend/ominisaber-supabase-client.js',
  'backend/ominisaber-supabase-config.js',
  'backend/vendor/supabase-2.112.3.js',
  'ominisaber-sw.js',
  '_headers',
  '_redirects',
];
const loginFiles = await htmlPublicDependencies('frontend/login/index.html', root);
const studentEntryFiles = [...new Set((await Promise.all([
  'frontend/aluno/dashboard_principal/index.html',
  'frontend/aluno/perfil/index.html',
].map(page => htmlPublicDependencies(page, root)))).flat())];
const authEntryFiles = [...new Set((await Promise.all(authDestinationPages.map(page => htmlPublicDependencies(page, root)))).flat())];
const entries = [...new Set(['index.html', 'ominisaber.webmanifest', ...teacherPages, ...sharedFiles, ...loginFiles, ...studentEntryFiles, ...authEntryFiles])]
  .map(file => ({ source: file, output: `netlify-dist/${file}` }));
entries.push({ source: 'engine/dist/client/index.html', output: 'netlify-dist/oministudio/index.html' });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const checks = await Promise.all(entries.map(async entry => {
  try {
    if (sourcesOnly) {
      await access(path.join(root, entry.source));
      return { path: entry.source, identical: true };
    }
    const [source, output] = await Promise.all([
      readFile(path.join(root, entry.source)),
      readFile(path.join(root, entry.output)),
    ]);
    return { path: entry.source, identical: digest(source) === digest(output) };
  } catch (error) {
    return { path: entry.source, identical: false, error: error.code || 'unreadable' };
  }
}));
const differences = checks.filter(check => !check.identical);
const publicConfiguration = [];
for (const relative of ['backend/ominisaber-supabase-config.js', ...(!sourcesOnly ? ['netlify-dist/backend/ominisaber-supabase-config.js'] : [])]) {
  try {
    const validated = validatePublicSupabaseConfig(await readFile(path.join(root, relative), 'utf8'));
    publicConfiguration.push({ path: relative, valid: true, ...validated });
  } catch (error) {
    publicConfiguration.push({ path: relative, valid: false, error: error.message });
  }
}
const invalidPublicConfiguration = publicConfiguration.filter(check => !check.valid);
const checkHttpEntry = async entry => {
  // A local static server may close a reused connection. Retry transport only;
  // a missing file or byte mismatch always fails immediately.
  for (let attempt=0; attempt<2; attempt++) {
    try {
      const response = await fetch(new URL(entry.output.replace(/^netlify-dist\//, ''), publicBase), {signal: AbortSignal.timeout(10000), headers:{'Connection':'close'}});
      const bytes = await response.arrayBuffer();
      const expected = await readFile(path.join(root, entry.output));
      return { path: entry.output, identical: response.ok && digest(new Uint8Array(bytes)) === digest(expected), status: response.status };
    } catch (error) {
      if (attempt === 1) return { path: entry.output, identical: false, error: error.cause?.code || error.code || error.name || 'unreachable' };
    }
  }
};
const httpChecks = [];
if (publicBase) {
  for (let offset=0; offset<entries.length; offset+=4) httpChecks.push(...await Promise.all(entries.slice(offset,offset+4).map(checkHttpEntry)));
}
const httpDifferences = httpChecks.filter(check => !check.identical);

// QA stays in the workspace; its fixture data and evidence must not ship as public pages.
const qaFiles = [
  'tests/teacher-dashboard-data.test.mjs',
  'tests/teacher-evaluations.html',
  'tests/teacher-evaluations-mobile.html',
  'tests/teacher-evaluations-fixture.js',
  'tests/copilot-workspace.test.mjs',
  'tests/copilot-workspace.html',
  'tests/copilot-workspace-fixture.js',
  'tests/copilot-handoff.test.mjs',
  'design-qa.md',
  'docs/qa/dashboard-rework-2026-10-04/data-audit.md',
];
const missingQa = (await Promise.all(qaFiles.map(async file => {
  try { await access(path.join(root, file)); return null; }
  catch (error) { return { path: file, error: error.code || 'unreadable' }; }
}))).filter(Boolean);
const forbiddenPaths = ['docs', 'tests', 'scripts', 'design-qa.md', 'node_modules', '.env', 'backend/migrations', 'backend/supabase'];
const leakedPrivateFiles = sourcesOnly ? [] : (await Promise.all(forbiddenPaths.map(async file => {
  try { await access(path.join(root, 'netlify-dist', file)); return file; }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}))).filter(Boolean);

let bundleMatchesSources = false;
let bundleError = null;
try {
  const partiesRoot = path.join(root, 'frontend/Parties');
  let expected = await readFile(path.join(partiesRoot, 'styles.entry.css'), 'utf8');
  for (const match of [...expected.matchAll(/@import url\("(\.\/[^"?]+)(?:\?[^" ]*)?"\);/g)]) {
    const css = await readFile(path.join(partiesRoot, match[1]), 'utf8');
    expected = expected.replace(match[0], () => `\n/* ${match[1]} */\n${css}`);
  }
  const served = await readFile(path.join(partiesRoot, 'parties.css'), 'utf8');
  bundleMatchesSources = digest(expected) === digest(served);
} catch (error) { bundleError = error.code || error.message; }

console.log(JSON.stringify({ sourcesOnly, specialties: specialties.length, specialtyHtml: specialtyHtml.length, loginFiles: loginFiles.length, studentEntryFiles: studentEntryFiles.length, authDestinationPages: authDestinationPages.length, authEntryFiles: authEntryFiles.length, publicConfiguration, checked: checks.length, identical: checks.length - differences.length, differences, httpChecked: httpChecks.length, httpIdentical: httpChecks.length - httpDifferences.length, httpDifferences, localQaChecked: qaFiles.length, missingQa, leakedPrivateFiles, bundleMatchesSources, bundleError, liveAuthenticationChecked: false, remoteNetlifyChecked: false }, null, 2));
if (differences.length || httpDifferences.length || invalidPublicConfiguration.length || missingQa.length || leakedPrivateFiles.length || !bundleMatchesSources) process.exitCode = 1;
