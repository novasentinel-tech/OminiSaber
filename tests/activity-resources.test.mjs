import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}, console};
vm.runInNewContext(fs.readFileSync(new URL('../frontend/shared/activity-resources/browser.js',import.meta.url),'utf8'),context);
const {richText,renderResources}=context.window.OminiResources;
test('matemática real produz frações, raízes, potências e MathML acessível no enunciado',()=>{
  const html=richText('Resolva $\\frac{3+5}{2}$ e $\\sqrt{16}+2^3$.');
  assert.match(html,/<math/);assert.match(html,/<mfrac>/);assert.match(html,/<msqrt>/);assert.match(html,/<msup>/);
  assert.match(richText('Resolva \\(x^2\\).'),/<math/);
  assert.match(richText('Veja \\[x^2\\].'),/<math/);
});
test('recursos visuais escapam texto e proíbem comandos de links/HTML na matemática',()=>{
  assert.match(richText('<img src=x onerror=alert(1)>'),/&lt;img/);
  assert.doesNotMatch(richText('$\\href{javascript:alert(1)}{x}$'),/<a[\s>]/);
  const html=renderResources([{type:'chart',chartType:'line',data:[{label:'<script>evil</script>',value:2},{label:'B',value:-3}],caption:'<svg onload=evil>',alt:'" onload="evil'}]);
  assert.doesNotMatch(html,/<script>|<svg onload|aria-label="" onload/);
  assert.match(html,/<table>/);assert.match(html,/Consultar valores/);
});
test('figuras, quadrinhos e gráfico são conteúdo público com controles reais sem soluções automáticas',()=>{
  const html=renderResources([{type:'figure',kind:'triangle',values:[3,4,5],unit:'cm'},{type:'comic',panels:[{speaker:'Ana',text:'Vamos comparar?'},{speaker:'Bia',text:'Observe o gráfico.'}]},{type:'graph',expressions:['2x+1'],settings:{xMin:-5,xMax:5,autoY:true,variables:{}}}]);
  assert.match(html,/Ocultar medidas/);assert.match(html,/comic-bubble/);assert.match(html,/data-resource-zoom/);assert.match(html,/Tabela de valores/);
  assert.doesNotMatch(html,/Começar a resolução|Usar como resposta|correct|answerConfiguration/);
});
