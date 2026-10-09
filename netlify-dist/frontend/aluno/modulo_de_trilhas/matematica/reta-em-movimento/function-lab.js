(() => {
  const canvas = document.querySelector("[data-line-canvas]"), ctx = canvas.getContext("2d");
  const handle = document.querySelector("[data-plot-handle]");
  const math = window.OminiFunctionPlot;
  const state = { mode: "linear", m: 1, b: 1, a: 1, qb: 0, c: 0 };
  const fields = Object.fromEntries(["m", "b", "a", "qb", "c"].map((k) => [k, document.querySelector(`[data-${k}]`)]));
  const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
  const format = (n) => numberFormat.format(Math.abs(n) < 1e-9 ? 0 : n);
  let width = 0, height = 0, frame = 0, drag = null;
  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw(); }); };
  const bounds = () => {
    const v = drag?.view || math.view(state);
    const left = width < 360 ? 43 : 52, right = width - 18, top = 24, bottom = height - 34;
    return { ...v, left, right, top, bottom,
      x: (x) => left + (x - v.minX) / (v.maxX - v.minX) * (right - left),
      y: (y) => bottom - (y - v.minY) / (v.maxY - v.minY) * (bottom - top) };
  };
  const handleX = () => state.mode === "linear" ? 4 : 1;
  const equation = () => {
    const term = (n, suffix = "") => `${n < 0 ? "−" : "+"} ${format(Math.abs(n))}${suffix}`;
    return state.mode === "linear" ? `y = ${format(state.m)}x ${term(state.b)}` : `y = ${format(state.a)}x² ${term(state.qb, "x")} ${term(state.c)}`;
  };
  const dot = (x, y, color, radius = 7) => {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  };
  const draw = () => {
    if (width < 10 || height < 10) return;
    const p = bounds();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
    ctx.font = "11px system-ui";
    // Labels use dedicated margins, never the moving axis or curve bounds.
    for (let x = Math.ceil(p.minX / p.stepX) * p.stepX; x <= p.maxX + 1e-8; x += p.stepX) {
      ctx.strokeStyle = "#e1e7f2"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x(x), p.top); ctx.lineTo(p.x(x), p.bottom); ctx.stroke();
      ctx.fillStyle = "#56627a"; ctx.textAlign = "center"; ctx.fillText(format(x), p.x(x), p.bottom + 18);
    }
    for (let y = Math.ceil(p.minY / p.stepY) * p.stepY; y <= p.maxY + 1e-8; y += p.stepY) {
      ctx.strokeStyle = "#e1e7f2"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.left, p.y(y)); ctx.lineTo(p.right, p.y(y)); ctx.stroke();
      ctx.fillStyle = "#56627a"; ctx.textAlign = "right"; ctx.fillText(format(y), p.left - 7, p.y(y) + 4);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(p.left, p.top, p.right - p.left, p.bottom - p.top); ctx.clip();
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.left, p.y(0)); ctx.lineTo(p.right, p.y(0));
    ctx.moveTo(p.x(0), p.top); ctx.lineTo(p.x(0), p.bottom); ctx.stroke();
    ctx.strokeStyle = "#155be8"; ctx.lineWidth = 3; ctx.lineJoin = "round";
    ctx.beginPath();
    const steps = Math.max(200, Math.ceil(p.right - p.left));
    for (let i = 0; i <= steps; i++) {
      const x = p.minX + (p.maxX - p.minX) * i / steps;
      if (!i) ctx.moveTo(p.x(x), p.y(math.evaluate(state, x)));
      else ctx.lineTo(p.x(x), p.y(math.evaluate(state, x)));
    }
    ctx.stroke();
    if (state.mode === "linear") {
      const y1 = math.evaluate(state, 1), y2 = math.evaluate(state, 4);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = "#c58012"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x(1), p.y(y1)); ctx.lineTo(p.x(4), p.y(y1)); ctx.lineTo(p.x(4), p.y(y2)); ctx.stroke(); ctx.setLineDash([]);
    } else if (state.a) {
      const vx = -state.qb / (2 * state.a);
      dot(p.x(vx), p.y(math.evaluate(state, vx)), "#c58012");
    }
    dot(p.x(0), p.y(math.evaluate(state, 0)), "#078477", state.mode === "quadratic" ? 4 : 7);
    dot(p.x(handleX()), p.y(math.evaluate(state, handleX())), "#155be8", 9);
    handle.style.left = `${p.x(handleX())}px`;
    handle.style.top = `${p.y(math.evaluate(state, handleX()))}px`;
    ctx.restore();
    ctx.fillStyle = "#334155"; ctx.font = "bold 12px system-ui";
    ctx.textAlign = "right"; ctx.fillText("x", p.right, height - 3);
    ctx.textAlign = "left"; ctx.fillText("y", p.left - 6, 13);
  };
  const sync = () => {
    for (const [key, input] of Object.entries(fields)) {
      state[key] = Number(input.value);
      document.querySelector(`[data-${key}-output]`).textContent = format(state[key]);
    }
    const quadratic = state.mode === "quadratic";
    document.querySelectorAll("[data-linear-only]").forEach((e) => { e.hidden = quadratic; });
    document.querySelectorAll("[data-quadratic-only]").forEach((e) => { e.hidden = !quadratic; });
    document.querySelector("[data-equation]").textContent = equation();
    document.querySelector("[data-equation-title]").textContent = quadratic ? "Ajuste a parábola: y = ax² + bx + c" : "Ajuste a reta: y = mx + b";
    document.querySelector("[data-plot-caption]").textContent = quadratic ? "Arraste o ponto azul para mudar a. O ponto dourado indica o vértice. A escala se ajusta ao soltar." : "Arraste o ponto azul para mudar a inclinação. O ponto verde marca b. A escala se ajusta ao soltar.";
    document.querySelector("[data-m-meaning]").textContent = state.m > 0 ? "reta crescente" : state.m < 0 ? "reta decrescente" : "reta horizontal";
    document.querySelector("[data-initial-value]").textContent = `R$ ${format(state.b)}`;
    document.querySelector("[data-km-value]").textContent = `R$ ${format(state.m)}/km`;
    const roots = math.roots(state);
    let summary = roots === null ? "Todos os valores de x são zeros da função." : roots.length ? `Zeros da função: ${roots.map(format).join(" e ")}.` : "A função não cruza o eixo x.";
    if (quadratic) {
      if (state.a) {
        const vx = -state.qb / (2 * state.a);
        summary = `Concavidade para ${state.a > 0 ? "cima" : "baixo"}. Vértice: (${format(vx)}; ${format(math.evaluate(state, vx))}). ${summary}`;
      } else summary = `Com a = 0, a função deixa de ser quadrática. ${summary}`;
    }
    document.querySelector("[data-plot-summary]").textContent = summary;
    canvas.setAttribute("aria-label", `${equation()}. ${summary} Use os controles abaixo para ajustar os coeficientes.`);
    schedule();
  };
  for (const input of Object.values(fields)) input.addEventListener("input", sync);
  document.querySelector("[data-function-mode]").addEventListener("change", (event) => { drag = null; state.mode = event.target.value; sync(); });
  document.querySelectorAll("[data-change]").forEach((button) => button.addEventListener("click", () => {
    const input = fields[button.dataset.change];
    input.value = String(Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value) + Number(button.dataset.delta))));
    sync();
  }));
  document.querySelector("[data-reset-plot]").addEventListener("click", () => {
    drag = null;
    for (const [key, value] of Object.entries({ m: 1, b: 1, a: 1, qb: 0, c: 0 })) fields[key].value = value;
    sync();
  });
  handle.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect(), p = bounds();
    if (Math.hypot(event.clientX - rect.left - p.x(handleX()), event.clientY - rect.top - p.y(math.evaluate(state, handleX()))) > 28) return;
    drag = { view: math.view(state), pointerId: event.pointerId };
    handle.setPointerCapture(event.pointerId); event.preventDefault();
  });
  handle.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = canvas.getBoundingClientRect(), p = bounds();
    const y = p.minY + (p.bottom - (event.clientY - rect.top)) / (p.bottom - p.top) * (p.maxY - p.minY);
    const key = state.mode === "linear" ? "m" : "a";
    const value = key === "m" ? (y - state.b) / 4 : y - state.qb - state.c;
    const input = fields[key], step = Number(input.step);
    const clearance = (p.maxY - p.minY) * 12 / (p.bottom - p.top);
    const base = key === "m" ? state.b : state.qb + state.c, divisor = key === "m" ? 4 : 1;
    const low = Math.max(Number(input.min), Math.ceil(((p.minY + clearance - base) / divisor) / step) * step);
    const high = Math.min(Number(input.max), Math.floor(((p.maxY - clearance - base) / divisor) / step) * step);
    input.value = String(Math.max(low, Math.min(high, Math.round(value / step) * step)));
    sync();
  });
  const release = () => { drag = null; schedule(); };
  handle.addEventListener("pointerup", release);
  handle.addEventListener("pointercancel", release);
  handle.addEventListener("lostpointercapture", release);
  document.querySelector("[data-test-hypothesis]").addEventListener("click", () => {
    const selected = document.querySelector('input[name="prediction"]:checked');
    const feedback = document.querySelector("[data-feedback]");
    feedback.className = "feedback error";
    if (!selected) { feedback.textContent = "Escolha uma previsão antes de testar."; return; }
    if (selected.value !== "steeper") { feedback.textContent = "Compare o módulo de m: a inclinação depende de |m|. Experimente os controles."; return; }
    fields.m.value = state.m < 0 ? -Math.min(3, Math.abs(state.m) + 1) : Math.min(3, state.m + 1);
    sync();
    feedback.className = "feedback success";
    feedback.textContent = "Isso! Aumentar |m| aumenta a inclinação em relação ao eixo x. Observe os valores dos eixos quando a escala se ajusta.";
    window.OminiMath?.complete("reta-em-movimento", "Reta em Movimento concluída.");
  });
  new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (!rect.width || !rect.height) return;
    width = rect.width; height = rect.height;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); schedule();
  }).observe(canvas);
  sync();
})();
