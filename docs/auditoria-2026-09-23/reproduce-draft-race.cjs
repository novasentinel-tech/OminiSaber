// Read-only reproduction: executes the existing save function with a fake API.
// No browser session, credentials, network, or database writes.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname,"../../frontend/aluno/laboratorio_de_redacao/script.js"),"utf8");
const body = source.match(/const saveDraft = async \(\{ quiet = true \} = \{\}\) => \{([\s\S]*?)\n  \};\n  const debounceDraft/)[1];
let finish;
const calls=[],messages=[];
const state={selected:{id:"test"},savingDraft:false,essayId:"test",planning:null};
const el={title:{value:"Teste"},text:{value:"Versão A"},draftStatus:{}};
const save=new Function("state","el","api","setPill","$","notify","return async function({quiet=true}={}){"+body+"}")(state,el,()=>({configured:true,saveEssayDraft:payload=>{calls.push(payload);return new Promise(resolve=>{finish=()=>resolve({id:"test"});});}}),(_el,message)=>messages.push(message),()=>({textContent:""}),()=>{});
(async()=>{
  const first=save();
  el.text.value="Versão B digitada enquanto A ainda salva";
  await save(); // Simulates the next debounce firing before the first response.
  finish();await first;
  assert.equal(calls.length,1);
  assert.equal(calls[0].texto,"Versão A");
  assert.match(messages.at(-1),/^Salvo/);
  console.log("CONFIRMADO: apenas A enviada; B não enfileirada; interface indica Salvo.");
  console.log("Teste isolado; nenhum dado externo foi alterado.");
})().catch(e=>{console.error(e);process.exitCode=1;});
