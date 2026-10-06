import { mathSegments, renderMathMarkup } from '../../../engine/src/core/math-format.js';
import { sampleMathPoints, evaluateMathExpression, mathVariables } from '../../../engine/src/core/math.js';
import '../../../engine/node_modules/katex/dist/katex.min.css';
import './style.css';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e6 ? value : fallback;
const label = value => String(value ?? '').slice(0, 600);
const format = value => Number.isFinite(value) ? Number(value.toPrecision(5)).toLocaleString('pt-BR') : 'fora do domínio';
export function richText(value) {
  return mathSegments(String(value ?? '').replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$').replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$')).map(segment => {
    if (segment.text !== undefined) return escape(segment.text).replace(/\n/g, '<br>');
    const result = renderMathMarkup(segment.math, segment.display);
    return result.html || `<span class="resource-math-error">${escape(segment.math)}</span>`;
  }).join('');
}
const math = expression => { const value = renderMathMarkup(String(expression ?? '').slice(0, 2000), true); return value.html || escape(expression); };
const mounted = new WeakSet();

function chartMarkup(resource) {
  const data = (Array.isArray(resource.data) ? resource.data : []).slice(0, 12).map(row => ({ label: label(row.label), value: finite(row.value) }));
  if (data.length < 2) return '';
  const min = Math.min(0, ...data.map(d => d.value)), max = Math.max(1, ...data.map(d => d.value)), scale = v => 160 - 130 * (v - min) / (max - min);
  const x = i => 45 + i * 420 / Math.max(1, data.length - 1);
  const line = resource.chartType === 'line';
  const baseline = scale(0);
  const marks = line ? `<polyline fill="none" stroke="#1a56db" stroke-width="3" points="${data.map((d, i) => `${x(i)},${scale(d.value)}`).join(' ')}"/>${data.map((d, i) => `<circle cx="${x(i)}" cy="${scale(d.value)}" r="5" fill="#1a56db"/>`).join('')}` : data.map((d,i) => `<rect x="${25 + i * 460 / data.length}" y="${Math.min(scale(d.value), baseline)}" width="${Math.min(54, 340 / data.length)}" height="${Math.max(1, Math.abs(scale(d.value)-baseline))}" rx="4" fill="#1a56db"/>`).join('');
  return `<svg viewBox="0 0 510 195" role="img" aria-label="${escape(resource.alt || 'Gráfico com dados disponíveis na tabela')}"><line x1="15" y1="${baseline}" x2="500" y2="${baseline}" stroke="#93a4ba"/>${marks}${data.map((d,i) => `<text x="${line ? x(i) : 25+i*460/data.length+Math.min(54,340/data.length)/2}" y="185" text-anchor="middle">${escape(d.label.slice(0,12))}</text>`).join('')}</svg><div class="resource-data-buttons" aria-label="Consultar valores">${data.map(d=>`<button type="button" data-resource-value="${escape(`${d.label}: ${format(d.value)}`)}">${escape(d.label)}</button>`).join('')}</div><output data-resource-readout aria-live="polite">Toque em uma categoria para consultar o valor.</output><details><summary>Dados em tabela${resource.yLabel ? ` · ${escape(resource.yLabel)}` : ''}</summary><table><thead><tr><th>${escape(resource.xLabel || 'Categoria')}</th><th>${escape(resource.yLabel || 'Valor')}</th></tr></thead><tbody>${data.map(d=>`<tr><th>${escape(d.label)}</th><td>${format(d.value)}</td></tr>`).join('')}</tbody></table></details>`;
}

function figureMarkup(resource) {
  const values = (resource.values || []).slice(0,3).map(n=>finite(n,1)), unit = escape(label(resource.unit));
  const labels = (resource.labels || []).slice(0,4);
  let shape = '';
  if (resource.kind === 'circle') shape = '<circle cx="190" cy="106" r="77"/><line x1="190" y1="106" x2="267" y2="106" class="measure-line"/>';
  else if (resource.kind === 'triangle') {
    const [a=3,b=4,c=5] = values, horizontal=(a*a+b*b-c*c)/(2*b), height=Math.sqrt(Math.max(0,a*a-horizontal*horizontal)), scale=155/Math.max(a,b,c,1);
    shape=`<polygon points="65,180 ${65+b*scale},180 ${65+horizontal*scale},${180-height*scale}"/>`;
  } else shape='<rect x="60" y="35" width="260" height="145" rx="3"/>';
  return `<svg viewBox="0 0 380 225" role="img" aria-label="${escape(resource.alt || 'Figura geométrica')}"><g class="resource-geometry">${shape}</g><g data-resource-measures>${values.map((v,i)=>`<text x="${[190,337,50][i]}" y="${[211,108,62][i]}" text-anchor="middle">${escape(labels[i] || ['A','B','C'][i])}: ${format(v)} ${unit}</text>`).join('')}</g></svg><button type="button" data-resource-toggle-measures aria-pressed="true">Ocultar medidas</button>`;
}

export function renderResources(resources) {
  if (!Array.isArray(resources)) return '';
  return `<div class="activity-resources">${resources.slice(0,4).map(resource => {
    if (!resource || typeof resource !== 'object') return '';
    let body='';
    if (resource.type === 'formula') body=`<div class="resource-formula">${math(resource.expression)}</div>`;
    if (resource.type === 'chart') body=chartMarkup(resource);
    if (resource.type === 'figure') body=figureMarkup(resource);
    if (resource.type === 'comic') body=`<div class="resource-comic">${(resource.panels || []).slice(0,4).map((panel,i)=>`<section><span class="comic-number">${i+1}</span><div class="comic-avatar" aria-hidden="true"><i></i><b></b></div><div class="comic-bubble"><strong>${escape(label(panel.speaker))}</strong><p>${richText(label(panel.text))}</p></div></section>`).join('')}</div>`;
    if (resource.type === 'graph') body=`<div class="resource-graph" data-resource-graph="${escape(JSON.stringify({expressions:(resource.expressions||[]).slice(0,3),settings:resource.settings||{}}))}"><div data-resource-plot></div><div class="resource-graph-tools"><button type="button" data-resource-zoom="in" aria-label="Ampliar plano cartesiano">+</button><button type="button" data-resource-zoom="out" aria-label="Reduzir plano cartesiano">−</button><button type="button" data-resource-zoom="reset">Restaurar</button><label>Consultar x <input data-resource-x type="number" step="any" value="0"></label></div><div data-resource-parameters></div><output data-resource-point aria-live="polite"></output><details><summary>Tabela de valores</summary><div data-resource-table></div></details></div>`;
    return body ? `<figure class="activity-resource resource-${escape(resource.type)}">${resource.caption ? `<figcaption>${richText(label(resource.caption))}</figcaption>` : ''}${body}</figure>` : '';
  }).join('')}</div>`;
}

function mountGraph(element) {
  let config;
  try { config=JSON.parse(element.dataset.resourceGraph); } catch { return; }
  const expressions=(config.expressions || []).filter(v=>typeof v==='string').slice(0,3), settings=config.settings||{};
  const initial={ xMin:finite(settings.xMin,-5),xMax:finite(settings.xMax,5) };
  if (initial.xMax<=initial.xMin) initial.xMax=initial.xMin+10;
  let xMin=initial.xMin,xMax=initial.xMax;
  const variables=Object.fromEntries(Object.entries(settings.variables||{}).filter(([key,v])=>/^[a-z]$/.test(key)&&key!=='x'&&typeof v==='number'&&Number.isFinite(v)).slice(0,10));
  let parameters=[];
  try { parameters=[...new Set(expressions.flatMap(mathVariables))].filter(k=>k!=='x').slice(0,10); } catch {}
  parameters.forEach(key=>{ if(variables[key]==null)variables[key]=1; });
  element.querySelector('[data-resource-parameters]').innerHTML=parameters.map(key=>`<label class="resource-parameter">${key} <output data-variable-value="${key}">${format(variables[key])}</output><input type="range" data-resource-variable="${key}" min="${Math.min(-10,variables[key]-5)}" max="${Math.max(10,variables[key]+5)}" step="0.5" value="${variables[key]}"></label>`).join('');
  function point() {
    const x=Number(element.querySelector('[data-resource-x]').value);
    element.querySelector('[data-resource-point]').textContent=expressions.map((expression,i)=>{let y=null;try{y=evaluateMathExpression(expression,{...variables,x});}catch{} return `f${i+1}(${format(x)}) = ${format(y)}`;}).join(' · ');
  }
  function draw() {
    try {
      const series=expressions.map(expression=>sampleMathPoints(expression,{xMin,xMax,samples:301,variables}));
      const ys=series.flat().map(p=>p.y).filter(y=>Number.isFinite(y)&&Math.abs(y)<1e4).sort((a,b)=>a-b);
      let yMin=finite(settings.yMin,-5),yMax=finite(settings.yMax,5);
      if(settings.autoY!==false && ys.length){yMin=Math.min(0,ys[Math.floor(ys.length*.03)]);yMax=Math.max(0,ys[Math.floor(ys.length*.97)]);const pad=Math.max(1,(yMax-yMin)*.12);yMin-=pad;yMax+=pad;}
      if(yMax<=yMin)yMax=yMin+10;
      const px=x=>40+440*(x-xMin)/(xMax-xMin),py=y=>230-200*(y-yMin)/(yMax-yMin), colors=['#1a56db','#7857c6','#198369'];
      const grid=Array.from({length:6},(_,i)=>{const x=xMin+(xMax-xMin)*i/5,y=yMin+(yMax-yMin)*i/5;return `<line x1="${px(x)}" y1="30" x2="${px(x)}" y2="230" stroke="#e3e9f1"/><line x1="40" y1="${py(y)}" x2="480" y2="${py(y)}" stroke="#e3e9f1"/><text x="${px(x)}" y="252" text-anchor="middle">${format(x)}</text><text x="32" y="${py(y)+4}" text-anchor="end">${format(y)}</text>`;}).join('');
      const paths=series.map((points,index)=>{let prior=null,path='';for(const p of points){if(!Number.isFinite(p.y)||p.y<yMin||p.y>yMax){prior=null;continue;}const jump=prior&&Math.abs(p.y-prior.y)>(yMax-yMin)*.4;path+=`${prior&&!jump?'L':'M'}${px(p.x).toFixed(2)},${py(p.y).toFixed(2)} `;prior=p;}return `<path d="${path}" fill="none" stroke="${colors[index]}" stroke-width="2.6"/>`;}).join('');
      element.querySelector('[data-resource-plot]').innerHTML=`<svg viewBox="0 0 510 270" role="img" aria-label="Plano cartesiano interativo. Consulte funções e valores abaixo.">${grid}${xMin<=0&&xMax>=0?`<line x1="${px(0)}" y1="30" x2="${px(0)}" y2="230" stroke="#64748b"/>`:''}${yMin<=0&&yMax>=0?`<line x1="40" y1="${py(0)}" x2="480" y2="${py(0)}" stroke="#64748b"/>`:''}${paths}</svg><div class="resource-legend">${expressions.map((expression,i)=>`<span style="--resource-color:${colors[i]}">${math(expression)}</span>`).join('')}</div>`;
      const rows=Array.from({length:7},(_,i)=>xMin+(xMax-xMin)*i/6);
      element.querySelector('[data-resource-table]').innerHTML=`<table><thead><tr><th>x</th>${expressions.map((_,i)=>`<th>f${i+1}(x)</th>`).join('')}</tr></thead><tbody>${rows.map(x=>`<tr><th>${format(x)}</th>${expressions.map(expression=>{let y=null;try{y=evaluateMathExpression(expression,{...variables,x});}catch{}return `<td>${format(y)}</td>`;}).join('')}</tr>`).join('')}</tbody></table>`;
      point();
    } catch(error) { element.querySelector('[data-resource-plot]').textContent=`Confira a função do gráfico: ${error.message}`; }
  }
  element.querySelector('[data-resource-x]').addEventListener('input',point);
  element.querySelectorAll('[data-resource-variable]').forEach(input=>input.addEventListener('input',()=>{variables[input.dataset.resourceVariable]=Number(input.value);element.querySelector(`[data-variable-value="${input.dataset.resourceVariable}"]`).textContent=format(Number(input.value));draw();}));
  element.querySelectorAll('[data-resource-zoom]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.resourceZoom;if(action==='reset'){xMin=initial.xMin;xMax=initial.xMax;}else{const center=(xMin+xMax)/2,width=Math.max(.001,Math.min(1e6,(xMax-xMin)*(action==='in'?.5:2)));xMin=center-width/2;xMax=center+width/2;}draw();}));
  draw();
}

export function hydrate(container = document) {
  container.querySelectorAll('.activity-resource').forEach(resource=>{
    if(mounted.has(resource))return;mounted.add(resource);
    resource.querySelectorAll('[data-resource-value]').forEach(button=>button.addEventListener('click',()=>{resource.querySelector('[data-resource-readout]').textContent=button.dataset.resourceValue;}));
    resource.querySelector('[data-resource-toggle-measures]')?.addEventListener('click',event=>{const button=event.currentTarget, group=resource.querySelector('[data-resource-measures]'), visible=button.getAttribute('aria-pressed')==='true';group.style.display=visible?'none':'';button.setAttribute('aria-pressed',String(!visible));button.textContent=visible?'Mostrar medidas':'Ocultar medidas';});
    resource.querySelectorAll('[data-resource-graph]').forEach(mountGraph);
  });
}
window.OminiResources = { richText, renderResources, hydrate };
