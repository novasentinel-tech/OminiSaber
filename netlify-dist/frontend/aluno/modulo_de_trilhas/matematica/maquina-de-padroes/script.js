(() => {
  const canvas = document.querySelector("[data-function-canvas]");
  const ctx = canvas.getContext("2d");
  const colors = [
    "#0b5fe8",
    "#0f9b8e",
    "#f29c13",
    "#4932d5",
    "#ef5b68",
    "#1499cd",
    "#8a5adf",
  ];
  const state = { a: 2, b: 1, xs: [-2, -1, 0, 1, 2], dragging: null };
  const rows = document.querySelector("[data-value-rows]");
  const format = (value) =>
    Number.isInteger(value) ? value : value.toFixed(1).replace(".", ",");
  const equationText = () =>
    `${format(state.a)}x ${state.b < 0 ? "−" : "+"} ${format(Math.abs(state.b))}`;
  const renderRows = () => {
    rows.innerHTML = state.xs
      .map(
        (x, index) =>
          `<tr><td><div class="number-control"><input data-x-index="${index}" type="number" step="1" value="${x}" aria-label="Entrada x da linha ${index + 1}"></div></td><td><div class="number-control"><input data-y-index="${index}" type="number" step="1" value="${state.a * x + state.b}" aria-label="Saída f de x da linha ${index + 1}"><span class="row-marker" style="--marker:${colors[index % colors.length]}">${index + 1}</span></div></td></tr>`,
      )
      .join("");
    rows.querySelectorAll("[data-x-index]").forEach((input) =>
      input.addEventListener("change", () => {
        state.xs[Number(input.dataset.xIndex)] = Number(input.value);
        renderRows();
        draw();
      }),
    );
    rows.querySelectorAll("[data-y-index]").forEach((input) =>
      input.addEventListener("change", () => {
        const index = Number(input.dataset.yIndex);
        const x = state.xs[index];
        const y = Number(input.value);
        if (index > 0 && x !== state.xs[0])
          state.a =
            Math.round(
              ((y - (state.a * state.xs[0] + state.b)) / (x - state.xs[0])) * 2,
            ) / 2;
        state.b = Math.round((y - state.a * x) * 2) / 2;
        sync();
      }),
    );
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };
  const metrics = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const pad = 34;
    return {
      w,
      h,
      pad,
      sx: (w - pad * 2) / 12,
      sy: (h - pad * 2) / 12,
      ox: w / 2,
      oy: h / 2,
    };
  };
  const pointToCanvas = (x, y) => {
    const m = metrics();
    return { x: m.ox + x * m.sx, y: m.oy - y * m.sy };
  };
  const draw = () => {
    const m = metrics();
    ctx.clearRect(0, 0, m.w, m.h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, m.w, m.h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e1e7f2";
    for (let i = -6; i <= 6; i += 1) {
      const px = pointToCanvas(i, 0).x;
      const py = pointToCanvas(0, i).y;
      ctx.beginPath();
      ctx.moveTo(px, m.pad);
      ctx.lineTo(px, m.h - m.pad);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.pad, py);
      ctx.lineTo(m.w - m.pad, py);
      ctx.stroke();
    }
    ctx.strokeStyle = "#1e2a4a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(m.pad, m.oy);
    ctx.lineTo(m.w - m.pad, m.oy);
    ctx.moveTo(m.ox, m.pad);
    ctx.lineTo(m.ox, m.h - m.pad);
    ctx.stroke();
    ctx.fillStyle = "#5f6680";
    ctx.font = "11px Inter";
    ctx.textAlign = "center";
    for (let i = -6; i <= 6; i += 1) {
      if (i) {
        ctx.fillText(i, pointToCanvas(i, 0).x, m.oy + 17);
        ctx.textAlign = "right";
        ctx.fillText(i, m.ox - 8, pointToCanvas(0, i).y + 4);
        ctx.textAlign = "center";
      }
    }
    const p1 = pointToCanvas(-6, state.a * -6 + state.b);
    const p2 = pointToCanvas(6, state.a * 6 + state.b);
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.pad, m.pad, m.w - m.pad * 2, m.h - m.pad * 2);
    ctx.clip();
    ctx.strokeStyle = "#0b5fe8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    state.xs.forEach((x, index) => {
      const p = pointToCanvas(x, state.a * x + state.b);
      ctx.fillStyle = colors[index % colors.length];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "700 10px Inter";
      ctx.fillText(index + 1, p.x, p.y + 3);
    });
    ctx.fillStyle = "#0b5fe8";
    ctx.font = "700 12px Inter";
    ctx.textAlign = "left";
    ctx.fillText(`f(x) = ${equationText()}`, m.pad + 8, m.pad + 18);
  };
  const sync = () => {
    document.querySelector("[data-a]").textContent = format(state.a);
    document.querySelector("[data-b]").textContent = format(state.b);
    document.querySelector("[data-a-output]").textContent = format(state.a);
    document.querySelector("[data-b-output]").textContent = format(state.b);
    document.querySelector("[data-explanation]").innerHTML =
      `A cada aumento de <strong>1</strong> em x, a saída varia <strong>${format(state.a)}</strong>. Quando x = 0, a reta cruza o eixo y em <strong>${format(state.b)}</strong>.`;
    renderRows();
    draw();
  };
  document.querySelectorAll("[data-step]").forEach((button) =>
    button.addEventListener("click", () => {
      const key = button.dataset.step;
      state[key] = Math.max(
        -5,
        Math.min(5, state[key] + Number(button.dataset.delta)),
      );
      sync();
    }),
  );
  document.querySelector("[data-add-row]").addEventListener("click", () => {
    const next = Math.max(...state.xs) + 1;
    if (state.xs.length < 7) {
      state.xs.push(next);
      renderRows();
      draw();
    } else
      window.OminiMath.toast(
        "A tabela já possui linhas suficientes para investigar o padrão.",
      );
  });
  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    let best = null;
    state.xs.forEach((x, index) => {
      const p = pointToCanvas(x, state.a * x + state.b);
      const distance = Math.hypot(px - p.x, py - p.y);
      if (!best || distance < best.distance) best = { index, distance };
    });
    if (best?.distance < 24) {
      state.dragging = best.index;
      canvas.setPointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (state.dragging === null) return;
    const rect = canvas.getBoundingClientRect();
    const m = metrics();
    const y = Math.round(((m.oy - (event.clientY - rect.top)) / m.sy) * 2) / 2;
    const x = state.xs[state.dragging];
    state.b = Math.max(-5, Math.min(5, y - state.a * x));
    sync();
  });
  const endDrag = () => {
    state.dragging = null;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  document
    .querySelector("[data-confirm-rule]")
    .addEventListener("click", () => {
      const feedback = document.querySelector("[data-feedback]");
      feedback.className = "feedback success";
      feedback.textContent = `Regra confirmada: f(x) = ${equationText()}. Você conectou as três representações.`;
      window.OminiMath.complete(
        "maquina-de-padroes",
        "Máquina de Padrões concluída.",
      );
    });
  new ResizeObserver(resize).observe(canvas);
  sync();
})();
