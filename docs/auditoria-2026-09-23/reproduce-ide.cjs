// Read-only: exercise the existing IDE functions with a fake DOM/API.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const source=fs.readFileSync(path.join(__dirname,"../../frontend/aluno/modulo_de_trilhas/shared/study-app.js"),"utf8");
const checks=source.match(/    const checks = \[([\s\S]*?)\n    \];/)[1];
const evaluate=source.match(/    const evaluateCode = \(\) => \{([\s\S]*?)\n    \};/)[1];
const run=source.match(/    const runCode = \(\) => \{([\s\S]*?)\n    \};/)[1];
const nodes={
 "[data-sim-stock]":{value:"sim"},"[data-sim-subtotal]":{value:"24"},
 "[data-sim-discount]":{value:"nao"},"[data-ide-console]":{},
 "[data-ide-progress]":{},"[data-score-badge]":{},"[data-code-checks]":{}
};
const editor={value:"// INICIO FIM ler SE ENTAO estoque total escrever"};
const functions=new Function("editor","document","escapeHTML","api","activity","id",
 "const checks=["+checks+"];const evaluateCode=()=>{"+evaluate+"};const runCode=()=>{"+run+"};return {evaluateCode,runCode};"
)(editor,{querySelector:s=>nodes[s]},String,()=>({recordStudyEvent:()=>Promise.resolve()}),{trilha_id:"fake"},"fake");
assert.equal(functions.evaluateCode().score,100);
functions.runCode();
const first=nodes["[data-ide-console]"].innerHTML;
editor.value='INICIO\nler pedido\nSE estoque ENTAO\ntotal <- 999\nescrever "Outro resultado"\nFIMSE\nFIM';
functions.runCode();
assert.equal(nodes["[data-ide-console]"].innerHTML,first);
console.log("CONFIRMADO: comentário obtém 100%; atribuição total <- 999 não muda a saída calculada com subtotal 24.");
console.log("Nenhuma requisição enviada ou código de aluno alterado.");
