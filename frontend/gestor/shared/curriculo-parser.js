(() => {
  const SKILL_RE = /\b(?:EM|EF)\d{2}[A-Z]{2,3}\d{2,3}(?:[A-Z]{3}[a-z]?)?(?:\/ES)?\b/gi;
  const DESCRIPTOR_RE = /\bD\d{3}(?:_[A-Z])?\b/gi;
  const CURRICULAR_HEADER_RE = /^(?:\s*(?:(?:[1-3]\s*[ªºa]?)\s*(?:s[eé]rie|trimestre|quinzena|semana)|habilidade(?:s)?(?:\s+da\s+computa[cç][aã]o|\s+principal)?|objeto(?:s)?\s+de\s+conhecimento|expectativa(?:s)?(?:\s+de\s+aprendizagem)?|descritor(?:es)?|materiais?\s+estruturados?|material\s+estruturado|componente\s+curricular|s[eé]rie|trimestre|quinzena|semana)\b|\s*(?:EM|EF)\d{2}[A-Z]{2}\d{2}\b)/i;
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const unique = (values) => [...new Set(values.map(clean).filter(Boolean))];
  const first = (value, pattern) => String(value || '').match(pattern)?.[1] || null;
  const normalizeLines = (values) => values.map((value) => String(value || '').trim()).filter(Boolean).join('\n');
  const pageLines = (page, pageIndex) => {
    if (typeof page === 'string') return page.split(/\r?\n/).map((line) => ({ line, page: pageIndex + 1 }));
    const items = (page?.items || []).filter((item) => String(item.str || '').trim()).map((item) => ({ ...item, x: item.x ?? item.transform?.[4] ?? 0, y: item.y ?? item.transform?.[5] ?? 0 }));
    const grouped = [];
    items.sort((a, b) => b.y - a.y || a.x - b.x).forEach((item) => {
      let line = grouped.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
      if (!line) { line = { y: item.y, items: [] }; grouped.push(line); }
      line.items.push(item);
    });
    return grouped.sort((a, b) => b.y - a.y).map((line) => {
      line.items.sort((a, b) => a.x - b.x);
      const cells = [];
      line.items.forEach((item) => { const previous = cells.at(-1); const gap = previous ? item.x - (previous.x + (previous.width || 0)) : 0; if (previous && gap > 42) cells.push({ str: ` | ${item.str}`, x: item.x, width: item.width }); else if (previous) { previous.str += ` ${item.str}`; previous.width = (item.x + (item.width || 0)) - previous.x; } else cells.push({ str: item.str, x: item.x, width: item.width }); });
      return { line: cells.map((cell) => cell.str).join('').trim(), page: pageIndex + 1, visual: true, columns: cells.length };
    });
  };
  const context = (text) => ({
    serie: /(?:1ª|1a|1º|1o)\s*(?:série|serie)/i.test(text) ? 1 : /(?:2ª|2a|2º|2o)\s*(?:série|serie)/i.test(text) ? 2 : /(?:3ª|3a|3º|3o)\s*(?:série|serie)/i.test(text) ? 3 : null,
    trimestre: /(?:1º|1o|1ª|1a)\s*trimestre/i.test(text) ? 1 : /(?:2º|2o|2ª|2a)\s*trimestre/i.test(text) ? 2 : /(?:3º|3o|3ª|3a)\s*trimestre/i.test(text) ? 3 : null,
    quinzena: first(text, /(\d+ª?\s*quinzena)/i),
    semana: first(text, /(\d+ª?\s*semana)/i),
  });
  const detectSubject = (text) => {
    const normalized = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const rules = [
      ['tecnico_informatica', /informatica|programacao|banco de dados|redes de computadores|computacao/],
      ['tecnico_administracao', /administracao|gestao|empreendedorismo|marketing|financas/],
      ['redacao', /redacao|producao textual|texto dissertativo/],
      ['matematica', /matematica|algebra|geometria|estatistica/],
      ['fisica', /fisica|mecanica|termodinamica|eletromagnetismo/],
      ['quimica', /quimica|estequiometria|atomistica|eletroquimica/],
      ['biologia', /biologia|genetica|ecologia|citologia|evolucao/],
      ['portugues', /lingua portuguesa|portugues|literatura|linguagens/],
    ];
    return rules.find(([, pattern]) => pattern.test(normalized))?.[0] || null;
  };
  const extractDescriptors = (block) => {
    const lines = block.split(/\r?\n/);
    const descriptors = [];
    lines.forEach((line, index) => {
      const match = line.match(/\b(D\d{3}(?:_[A-Z])?)\b\s*[:–-]?\s*(.*)$/i);
      if (!match) return;
      const continuation = [];
      for (const next of lines.slice(index + 1)) {
        if (CURRICULAR_HEADER_RE.test(next) || /\bD\d{3}(?:_[A-Z])?\b/i.test(next)) break;
        continuation.push(next);
      }
      descriptors.push({ code: match[1].toUpperCase(), descricao: normalizeLines([match[2], ...continuation]) });
    });
    return descriptors;
  };
  const extractSection = (block, label) => {
    const lines = block.split(/\r?\n/);
    const values = [];
    let collecting = false;
    lines.forEach((line) => {
      if (new RegExp(`^\\s*${label}\\s*[:\\-]?`, 'i').test(line)) {
        collecting = true;
        values.push(line.replace(new RegExp(`^\\s*${label}\\s*[:\\-]?\\s*`, 'i'), ''));
        return;
      }
      if (collecting && CURRICULAR_HEADER_RE.test(line)) collecting = false;
      if (collecting) values.push(line);
    });
    return unique(values).filter((value) => !/^(?:descritor(?:es)?|expectativa(?:s)?|objeto(?:s)?)\s*[:\-]?$/i.test(value));
  };
  const confidence = ({ code, description, serie, trimestre, visual, columns, contextConflict }) => {
    let score = code ? 55 : 15;
    if (description.length >= 20) score += 20;
    if (serie) score += 12;
    if (trimestre) score += 8;
    if (visual) score += 5;
    if (columns > 1) score -= 12;
    if (contextConflict) score -= 20;
    return Math.min(score, 99);
  };
  const itemStatus = (score) => score >= 90 ? 'ok' : 'revisar';

  const parseCurriculumPages = (pages, options = {}) => {
    const lines = pages.flatMap(pageLines);
    const text = lines.map((entry) => entry.line).join('\n');
    const detected = {
      origem: options.origem || (/(SEDU|secretaria de estado da educação)/i.test(text) ? 'SEDU-ES' : null),
      ano_letivo: Number(options.ano || first(text, /\b(20\d{2})\b/)) || null,
      modalidade: /ensino\s+m[eé]dio/i.test(text) ? 'Ensino Médio' : null,
      materia_codigo: options.materia || detectSubject(text),
      ...context(text),
    };
    const matches = [];
    lines.forEach((entry, index) => {
      const regex = new RegExp(SKILL_RE.source, 'ig');
      let match;
      while ((match = regex.exec(entry.line))) matches.push({ code: match[0].toUpperCase(), index, page: entry.page, offset: match.index });
    });
    const items = matches.map((match, matchIndex) => {
      const end = matches[matchIndex + 1]?.index ?? lines.length;
      let contextStart = match.index;
      const previousSkill = matches[matchIndex - 1]?.index ?? -1;
      for (let lineIndex = match.index - 1; lineIndex > previousSkill; lineIndex -= 1) {
        if (/(?:série|serie|trimestre)/i.test(lines[lineIndex].line)) contextStart = lineIndex;
      }
      const blockLines = lines.slice(contextStart, end);
      const block = blockLines.map((entry) => entry.line).join('\n');
      const firstLine = lines[match.index]?.line || '';
      const firstLineDescription = firstLine.slice(match.offset + match.code.length);
      const remainingLines = [];
      for (const entry of lines.slice(match.index + 1, end)) {
        if (/\bD\d{3}(?:_[A-Z])?\b/i.test(entry.line) || /\bdescritor(?:es)?\b/i.test(entry.line)) break;
        remainingLines.push(entry.line);
      }
      const description = normalizeLines([firstLineDescription, ...remainingLines].map((value) => value.replace(/^[\s:–-]+/, '').split(/(?:descritor(?:es)?|expectativa(?:s)?|objeto(?:s)?\s+de\s+conhecimento)/i)[0]));
      const local = context(block);
      const descriptors = extractDescriptors(block);
      const isFundamentalReference = match.code.toUpperCase().startsWith('EF');
      const score = confidence({ ...local, code: match.code, description, visual: blockLines.some((entry) => entry.visual), columns: Math.max(...blockLines.map((entry) => entry.columns || 1)), contextConflict: !local.serie || !local.trimestre });
      return {
        tipo: isFundamentalReference ? 'referencia_ensino_fundamental' : 'habilidade',
        etapa: isFundamentalReference ? 'ensino_fundamental' : 'ensino_medio',
        source_page: match.page,
        confianca: score,
        status: isFundamentalReference ? 'revisar' : itemStatus(score),
        payload: {
          codigo: match.code,
          descricao: description || 'Descrição não identificada; revisar documento original.',
          serie: local.serie || detected.serie,
          trimestre: local.trimestre || detected.trimestre,
          quinzena: local.quinzena,
          semana: local.semana,
          etapa: isFundamentalReference ? 'ensino_fundamental' : 'ensino_medio',
          descritores: descriptors,
          expectativas: extractSection(block, 'expectativas?(?: de aprendizagem)?'),
          objetos: extractSection(block, 'objetos?(?: de conhecimento)?'),
        },
      };
    });
    if (!items.length) items.push({ tipo: 'aviso', source_page: 1, confianca: 20, status: 'revisar', payload: { mensagem: 'Nenhuma habilidade com código EM ou EF foi identificada.' } });
    return { detected, items, resumo: { habilidades: items.filter((item) => item.tipo === 'habilidade').length, referencias_ef: items.filter((item) => item.tipo === 'referencia_ensino_fundamental').length, descritores: unique(items.flatMap((item) => item.payload.descritores || []).map((item) => item.code)).length, paginas: pages.length } };
  };
  window.OminiSaberCurriculumParser = { parseCurriculumPages, confidence, itemStatus, detectSubject };
})();
