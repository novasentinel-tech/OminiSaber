type JsonObject = Record<string, unknown>;
export const VISUAL_TYPES = ['formula', 'graph', 'chart', 'figure', 'comic'];
const object = (value: unknown): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('O recurso visual precisa de um objeto válido.');
  return value as JsonObject;
};
const keys = (value: JsonObject, permitted: string[]) => {
  if (Object.keys(value).some(key => !permitted.includes(key))) throw new Error('O recurso visual contém campos não permitidos, código ou gabarito.');
};
export function visualText(value: unknown, max = 1000, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('O texto do recurso visual é inválido ou excede o limite.');
  const result = value.trim();
  if (/<\/?[a-z][^>]*>|(?:https?:|javascript:|data:|file:|blob:)\s*|\bon\w+\s*=/i.test(result)) throw new Error('Recursos visuais usam somente texto e dados locais, sem HTML ou URLs.');
  return result;
}
const number = (value: unknown, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('O recurso visual contém uma medida ou dado numérico inválido.');
  return value;
};
const commands = new Set('frac dfrac tfrac sqrt sin cos tan ln log exp pi alpha beta gamma delta theta lambda mu sigma omega Delta Sigma Omega sum prod int lim infty le leq ge geq ne neq approx pm mp times cdot div left right displaystyle text mathrm mathbf overline underline vec hat quad qquad begin end cases aligned matrix pmatrix bmatrix'.split(' '));
export function visualFormula(value: unknown): string {
  const result = visualText(value, 1200, true);
  if (/[`"']|=>|\b(?:eval|alert|function|document|window|globalThis|fetch|import|require|console|javascript|constructor|process)\b/i.test(result)) throw new Error('Use somente notação matemática, sem código executável.');
  for (const command of result.matchAll(/\\([a-z]+)/gi)) if (!commands.has(command[1])) throw new Error('A fórmula contém um comando LaTeX não permitido.');
  let depth = 0;
  for (const char of result) {
    if (char === '{' && ++depth > 32) throw new Error('A fórmula está aninhada demais.');
    if (char === '}' && --depth < 0) throw new Error('A fórmula contém chaves sem abertura.');
  }
  if (depth) throw new Error('Falta fechar uma chave da fórmula.');
  return result;
}

/** Same bounded arithmetic language as the local graph renderer; never eval. */
export function graphExpression(value: unknown): string {
  const original = visualFormula(value);
  let source = original.replace(/^\$\$?|\$\$?$/g, '').replace(/^\s*(?:y|[fgh]\s*\(\s*x\s*\))\s*=\s*/i, '');
  function latex(input: string, level = 0): string {
    if (level > 32) throw new Error('A função está aninhada demais.');
    let cursor = 0, result = '';
    const group = () => {
      while (/\s/.test(input[cursor] || '') && cursor < input.length) cursor++;
      if (input[cursor++] !== '{') throw new Error('Use chaves na fração ou raiz.');
      const start = cursor; let depth = 1;
      while (cursor < input.length && depth) { if (input[cursor] === '{') depth++; if (input[cursor] === '}') depth--; if (depth) cursor++; }
      if (depth) throw new Error('Falta fechar uma chave da função.');
      return latex(input.slice(start, cursor++), level + 1);
    };
    while (cursor < input.length) {
      const char = input[cursor++];
      if (char !== '\\') { result += char; continue; }
      const command = input.slice(cursor).match(/^[a-z]+/i)?.[0];
      if (!command) { if ([',', ';', '!', ' '].includes(input[cursor])) { cursor++; continue; } throw new Error('Símbolo LaTeX não suportado pelo gráfico.'); }
      cursor += command.length;
      if (['frac', 'dfrac', 'tfrac'].includes(command)) result += `((${group()})/(${group()}))`;
      else if (command === 'sqrt') result += `sqrt(${group()})`;
      else if (['cdot', 'times'].includes(command)) result += '*';
      else if (command === 'div') result += '/';
      else if (['left', 'right', 'displaystyle'].includes(command)) continue;
      else if (['pi', 'sin', 'cos', 'tan', 'ln', 'log', 'exp'].includes(command)) result += command;
      else throw new Error('Use uma função suportada pelo plano cartesiano.');
    }
    if (result.length > 2400) throw new Error('A função ficou longa demais.');
    return result;
  }
  const superscripts: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };
  source = latex(source).replace(/[−–]/g, '-').replace(/[×·⋅]/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, value => `^(${[...value].map(char => superscripts[char]).join('')})`).replace(/(\d),(?=\d)/g, '$1.').replace(/\{/g, '(').replace(/\}/g, ')').toLowerCase();
  const functions = new Set(['sin', 'cos', 'tan', 'sqrt', 'abs', 'ln', 'log', 'exp']);
  const tokens: string[] = [];
  let pos = 0;
  while (pos < source.length) {
    if (/\s/.test(source[pos])) { pos++; continue; }
    const rest = source.slice(pos), numeric = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i)?.[0], name = rest.match(/^[a-z]+/)?.[0];
    if (numeric) { if (!Number.isFinite(Number(numeric)) || tokens.at(-1) === 'number') throw new Error('Número inválido na função.'); tokens.push('number'); pos += numeric.length; }
    else if (name) { if (functions.has(name)) tokens.push('function'); else if (name === 'pi' || name === 'e') tokens.push('value'); else if (name.length <= 3) tokens.push(...Array.from(name, () => 'value')); else throw new Error('Nome não suportado na função.'); pos += name.length; }
    else if ('+-*/^()'.includes(source[pos])) tokens.push(source[pos++]);
    else throw new Error('Símbolo não suportado na função.');
    if (tokens.length > 300) throw new Error('A função contém operações demais.');
  }
  let cursor = 0, depth = 0;
  const primary = () => {
    if (++depth > 32) throw new Error('A função está aninhada demais.');
    const token = tokens[cursor++];
    if (token === '(' || token === 'function') {
      if (token === 'function' && tokens[cursor++] !== '(') throw new Error('Use parênteses na função.');
      sum(); if (tokens[cursor++] !== ')') throw new Error('Falta fechar um parêntese da função.');
    } else if (!['number', 'value'].includes(token)) throw new Error('Falta um termo da função.');
    depth--;
  };
  const unary = (): void => { if (++depth > 32) throw new Error('A função está aninhada demais.'); try { if (['+', '-'].includes(tokens[cursor])) { cursor++; unary(); } else { primary(); if (tokens[cursor] === '^') { cursor++; unary(); } } } finally { depth--; } };
  const product = () => { unary(); while (tokens[cursor] && !['+', '-', ')'].includes(tokens[cursor])) { if (['*', '/'].includes(tokens[cursor])) cursor++; else if (!['number', 'value', 'function', '('].includes(tokens[cursor])) break; unary(); } };
  const sum = () => { product(); while (['+', '-'].includes(tokens[cursor])) { cursor++; product(); } };
  sum(); if (cursor !== tokens.length) throw new Error('A função contém uma operação incompleta.');
  return original;
}

export function normalizeGraphSettings(value: unknown = {}): JsonObject {
  const raw = object(value); keys(raw, ['xMin', 'xMax', 'yMin', 'yMax', 'autoY', 'showTable', 'variables']);
  const config: JsonObject = { xMin: raw.xMin === undefined ? -5 : number(raw.xMin, -1e6, 1e6), xMax: raw.xMax === undefined ? 5 : number(raw.xMax, -1e6, 1e6), yMin: raw.yMin === undefined ? -5 : number(raw.yMin, -1e6, 1e6), yMax: raw.yMax === undefined ? 5 : number(raw.yMax, -1e6, 1e6), autoY: raw.autoY ?? true, showTable: raw.showTable ?? true };
  if (typeof config.autoY !== 'boolean' || typeof config.showTable !== 'boolean' || Number(config.xMax) - Number(config.xMin) < .0001 || Number(config.yMax) - Number(config.yMin) < .0001) throw new Error('A janela do plano cartesiano é inválida.');
  const variables = raw.variables === undefined ? {} : object(raw.variables);
  if (Object.keys(variables).length > 26) throw new Error('Há parâmetros demais no gráfico.');
  config.variables = Object.fromEntries(Object.entries(variables).map(([key, value]) => { if (!/^[a-z]$/.test(key)) throw new Error('Um parâmetro do gráfico precisa de uma letra minúscula.'); return [key, number(value, -1e6, 1e6)]; }));
  return config;
}

export function normalizeVisualResources(value: unknown): JsonObject[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 4) throw new Error('Use até quatro recursos visuais por questão.');
  return value.map(item => {
    const raw = object(item), type = raw.type;
    if (!VISUAL_TYPES.includes(String(type))) throw new Error('O recurso visual utiliza um formato não suportado.');
    const specific: Record<string, string[]> = { formula: ['expression'], graph: ['expressions', 'settings'], chart: ['chartType', 'data', 'xLabel', 'yLabel'], figure: ['kind', 'values', 'labels', 'unit'], comic: ['panels'] };
    keys(raw, ['type', 'caption', 'alt', ...specific[String(type)]]);
    const base: JsonObject = { type, caption: raw.caption === undefined ? '' : visualText(raw.caption, 500), alt: visualText(raw.alt, 1000, true) };
    if (type === 'formula') return { ...base, expression: visualFormula(raw.expression) };
    if (type === 'graph') {
      if (!Array.isArray(raw.expressions) || !raw.expressions.length || raw.expressions.length > 3) throw new Error('Compare de uma a três funções no mesmo gráfico.');
      return { ...base, expressions: raw.expressions.map(graphExpression), settings: normalizeGraphSettings(raw.settings) };
    }
    if (type === 'chart') {
      if (!['bar', 'line'].includes(String(raw.chartType)) || !Array.isArray(raw.data) || raw.data.length < 2 || raw.data.length > 24) throw new Error('Um gráfico precisa de duas a 24 categorias e formato barras ou linhas.');
      const data = raw.data.map(item => { const row = object(item); keys(row, ['label', 'value']); return { label: visualText(row.label, 80, true), value: number(row.value, -1e6, 1e6) }; });
      if (new Set(data.map(item => item.label)).size !== data.length) throw new Error('O gráfico precisa de categorias distintas.');
      return { ...base, chartType: raw.chartType, data, xLabel: raw.xLabel === undefined ? '' : visualText(raw.xLabel, 80), yLabel: raw.yLabel === undefined ? '' : visualText(raw.yLabel, 80) };
    }
    if (type === 'figure') {
      const count = ({ rectangle: 2, triangle: 3, circle: 1 } as Record<string, number>)[String(raw.kind)];
      if (!count || !Array.isArray(raw.values) || raw.values.length !== count) throw new Error('Informe duas dimensões do retângulo, três lados do triângulo ou o raio do círculo.');
      const values = raw.values.map(value => number(value, .0001, 1e6));
      if (count === 3 && values.some(value => value >= values.reduce((a, b) => a + b, 0) - value)) throw new Error('As três medidas não formam um triângulo.');
      const labels = raw.labels === undefined ? [] : raw.labels;
      if (!Array.isArray(labels) || labels.length > 4) throw new Error('Use até quatro legendas na figura.');
      return { ...base, kind: raw.kind, values, labels: labels.map(value => visualText(value, 100)), unit: raw.unit === undefined ? '' : visualText(raw.unit, 30) };
    }
    if (!Array.isArray(raw.panels) || raw.panels.length < 2 || raw.panels.length > 4) throw new Error('O quadrinho precisa de dois a quatro painéis.');
    const panels = raw.panels.map(value => { const panel = object(value); keys(panel, ['speaker', 'text']); return { speaker: visualText(panel.speaker, 60, true), text: visualText(panel.text, 500, true) }; });
    return { ...base, panels };
  });
}

export function visualResourcesSchema() {
  const text = { type: 'string' };
  return { type: 'array', maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['type', 'alt', 'caption'], properties: {
    type: { type: 'string', enum: VISUAL_TYPES }, alt: text, caption: text,
    expression: text, expressions: { type: 'array', minItems: 1, maxItems: 3, items: text },
    settings: { type: 'object', additionalProperties: false, properties: { xMin: { type: 'number' }, xMax: { type: 'number' }, yMin: { type: 'number' }, yMax: { type: 'number' }, autoY: { type: 'boolean' }, showTable: { type: 'boolean' }, variables: { type: 'object', properties: Object.fromEntries(Array.from('abcdefghijklmnopqrstuvwxyz', key => [key, { type: 'number' }])) } } },
    chartType: { type: 'string', enum: ['bar', 'line'] }, data: { type: 'array', minItems: 2, maxItems: 24, items: { type: 'object', additionalProperties: false, required: ['label', 'value'], properties: { label: text, value: { type: 'number' } } } }, xLabel: text, yLabel: text,
    kind: { type: 'string', enum: ['rectangle', 'triangle', 'circle'] }, values: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'number' } }, labels: { type: 'array', maxItems: 4, items: text }, unit: text,
    panels: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['speaker', 'text'], properties: { speaker: text, text } } },
  } } };
}
