import fs from 'node:fs';

const catalog = JSON.parse(fs.readFileSync('backend/data/catalogo-curricular-base-comum-2026.json', 'utf8'));
const expectedSubjects = ['portugues', 'matematica', 'fisica', 'quimica', 'biologia'];
const failures = [];
const periods = new Set();
const skillKeys = new Set();

if (JSON.stringify(catalog.materias) !== JSON.stringify(expectedSubjects)) {
  failures.push('A lista de componentes da base comum não corresponde ao escopo definido.');
}

for (const skill of catalog.habilidades || []) {
  const key = `${skill.materia_codigo}:${skill.codigo}`;
  if (skillKeys.has(key)) failures.push(`Habilidade duplicada: ${key}`);
  skillKeys.add(key);
  if (!/^EM[0-9]{2}[A-Z]{2,3}[0-9]{2,3}(?:[A-Z]{3}[A-Za-z]?)?(?:\/ES)?$/.test(skill.codigo)) {
    failures.push(`Código de habilidade inválido: ${skill.codigo}`);
  }
  if (!skill.descricao || skill.descricao.length < 20 || /pendente|não identificada/i.test(skill.descricao)) {
    failures.push(`Descrição incompleta: ${key}`);
  }
  for (const occurrence of skill.ocorrencias || []) {
    periods.add(`${skill.materia_codigo}:${occurrence.serie}:${occurrence.trimestre}`);
    if (![1, 2, 3].includes(occurrence.serie) || ![1, 2, 3].includes(occurrence.trimestre)) failures.push(`Período inválido: ${key}`);
    if (!occurrence.arquivo_fonte || !occurrence.pagina_fonte) failures.push(`Rastreabilidade ausente: ${key}`);
  }
}

for (const subject of expectedSubjects) {
  for (let series = 1; series <= 3; series += 1) {
    for (let trimester = 1; trimester <= 3; trimester += 1) {
      if (!periods.has(`${subject}:${series}:${trimester}`)) failures.push(`Período sem habilidades: ${subject} ${series}ª/${trimester}º`);
    }
  }
}

if ((catalog.habilidades || []).length < 100) failures.push('Catálogo possui menos de 100 habilidades.');
if ((catalog.descritores_avaliativos || []).length < 40) failures.push('Catálogo possui menos de 40 descritores avaliativos.');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  habilidades: catalog.habilidades.length,
  descritores: catalog.descritores_avaliativos.length,
  ocorrencias: catalog.habilidades.reduce((total, skill) => total + skill.ocorrencias.length, 0),
  periodos_cobertos: periods.size
}, null, 2));
