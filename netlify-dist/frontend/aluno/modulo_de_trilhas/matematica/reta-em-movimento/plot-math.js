/* Pure geometry, shared by the canvas and numerical regression checks. */
((root) => {
  const evaluate = (s, x) => s.mode === "quadratic" ? s.a * x * x + s.qb * x + s.c : s.m * x + s.b;
  const niceStep = (span) => {
    const raw = Math.max(span / 7, 0.01), unit = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].find((n) => n * unit >= raw) * unit;
  };
  const roots = (s) => {
    const a = s.mode === "quadratic" ? s.a : 0;
    const b = s.mode === "quadratic" ? s.qb : s.m;
    const c = s.mode === "quadratic" ? s.c : s.b;
    if (!a) return b ? [-c / b] : c ? [] : null;
    const d = b * b - 4 * a * c;
    if (d < 0) return [];
    if (!d) return [-b / (2 * a)];
    return [(-b - Math.sqrt(d)) / (2 * a), (-b + Math.sqrt(d)) / (2 * a)].sort((x, y) => x - y);
  };
  const view = (s) => {
    const vertex = s.mode === "quadratic" && s.a ? -s.qb / (2 * s.a) : null;
    const minX = Math.min(-6, vertex === null ? -6 : Math.floor(vertex - 2));
    const maxX = Math.max(6, vertex === null ? 6 : Math.ceil(vertex + 2));
    const ys = [0, evaluate(s, minX), evaluate(s, maxX), evaluate(s, 0)];
    if (vertex !== null) ys.push(evaluate(s, vertex));
    const low = Math.min(...ys), high = Math.max(...ys);
    const margin = Math.max(1, (high - low) * 0.12);
    const stepY = niceStep(Math.max(6, high - low + 2 * margin));
    return { minX, maxX,
      minY: Math.floor(Math.min(-1, low - margin) / stepY) * stepY,
      maxY: Math.ceil(Math.max(1, high + margin) / stepY) * stepY,
      stepX: niceStep(maxX - minX), stepY };
  };
  const api = { evaluate, view, roots };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OminiFunctionPlot = api;
})(globalThis);
