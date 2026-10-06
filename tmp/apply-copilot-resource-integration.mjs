import fs from 'node:fs';
const replace = (file, pairs) => {
  let source=fs.readFileSync(file,'utf8');
  for(const [before,after] of pairs){if(!source.includes(before))throw new Error('Trecho não encontrado em '+file);source=source.replaceAll(before,after);}
  fs.writeFileSync(file,source);
};
/* This one-time source migration was applied during the rework. */
/* replace('frontend/aluno/atividades/script.js', [
  ['  const labels = {', "  const rich = value => window.OminiResources?.richText(value) || esc(value);\n  const labels = {"],
  ['${esc(question.enunciado)}','${rich(question.enunciado)}'],
  ['${esc(question.enunciado || "Questão")}','${rich(question.enunciado || "Questão")}'],
  ['>${esc(option)}</label>','>${rich(option)}</label>'],
  ['    evaluation.questoes_avaliacao.forEach((question) => {','    window.OminiResources?.hydrate(root());\n    evaluation.questoes_avaliacao.forEach((question) => {'],
]); */
/* replace('frontend/professor/specialty/activity-builder.js', [
  ['<strong>${e(question.statement)}</strong><small>','<strong>${resourceUi.richText(question.statement)}</strong>${resourceUi.renderResources(question.configuration?.resources)}<small>'],
  ['    const go = (step) => {','    const go = (step) => {'],
  ['.join("")}</ol></article>`;\n    };','.join("")}</ol></article>`;\n      resourceUi.hydrate(root.querySelector("[data-review-preview]"));\n    };'],
]); */
replace('engine/src/components/StudentRuntime.jsx', [
  ['onAnswer={respond} preview={preview} />','onAnswer={respond} preview={preview} allowLearningSupport={!secureAssessment} />'],
  ["{!['formula', 'graph'].includes(block.type) && <details className=\"math-scratchpad\">", "{!secureAssessment && !['formula', 'graph'].includes(block.type) && <details className=\"math-scratchpad\">"],
]);
