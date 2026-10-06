const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluate, view, roots } = require("../frontend/aluno/modulo_de_trilhas/matematica/reta-em-movimento/plot-math.js");

test("linear extremes keep the curve, intercept and drag handle in the visible range", () => {
  for (let m = -3; m <= 3; m += .5) for (let b = -5; b <= 5; b++) {
    const s = { mode: "linear", m, b }, v = view(s);
    for (const x of [-6, 0, 1, 4, 6]) {
      assert.ok(evaluate(s, x) > v.minY && evaluate(s, x) < v.maxY, `offscreen: m=${m}, b=${b}, x=${x}`);
    }
  }
});

test("all quadratic coefficient settings keep both branches and vertex framed", () => {
  for (let a = -3; a <= 3; a += .25) for (let qb = -5; qb <= 5; qb += .5) for (let c = -5; c <= 5; c++) {
    const s = { mode: "quadratic", a, qb, c }, v = view(s);
    assert.ok(Number.isFinite(v.minY) && v.maxY > v.minY && v.stepY > 0);
    if (a) {
      const vx = -qb / (2 * a);
      assert.ok(vx > v.minX && vx < v.maxX);
      assert.ok(evaluate(s, vx) > v.minY && evaluate(s, vx) < v.maxY);
    }
    for (let i = 0; i <= 40; i++) {
      const x = v.minX + (v.maxX - v.minX) * i / 40;
      assert.ok(evaluate(s, x) >= v.minY && evaluate(s, x) <= v.maxY);
    }
  }
});

test("zeros and degenerate quadratics are represented correctly", () => {
  assert.deepEqual(roots({ mode: "quadratic", a: 1, qb: 0, c: -4 }), [-2, 2]);
  assert.deepEqual(roots({ mode: "quadratic", a: 1, qb: -2, c: 1 }), [1]);
  assert.deepEqual(roots({ mode: "quadratic", a: 1, qb: 0, c: 1 }), []);
  assert.deepEqual(roots({ mode: "quadratic", a: 0, qb: 2, c: -4 }), [2]);
  assert.equal(roots({ mode: "quadratic", a: 0, qb: 0, c: 0 }), null);
  assert.deepEqual(roots({ mode: "quadratic", a: 0, qb: 0, c: 2 }), []);
});
