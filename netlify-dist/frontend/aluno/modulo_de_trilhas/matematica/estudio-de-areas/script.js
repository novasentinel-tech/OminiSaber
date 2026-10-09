(() => {
  const canvas = document.querySelector("[data-area-canvas]");
  const ctx = canvas.getContext("2d");
  const initial = [
    { id: "A", x: 2, y: 1, w: 3, h: 8, color: "#0f9b8e", fill: "#d8f4ef" },
    { id: "B", x: 2, y: 9, w: 6, h: 2, color: "#0b5fe8", fill: "#dbe9ff" },
  ];
  let pieces = structuredClone(initial);
  let selected = null;
  let tool = "move";
  let moved = false;
  const unit = () => Math.max(24, Math.min(42, (canvas.clientWidth - 70) / 13));
  const origin = () => ({ x: 36, y: 34 });
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };
  const draw = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const u = unit();
    const o = origin();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#e6ebf4";
    ctx.lineWidth = 1;
    for (let x = o.x; x < w; x += u) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = o.y; y < h; y += u) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    pieces.forEach((piece) => {
      const x = o.x + piece.x * u;
      const y = o.y + piece.y * u;
      const pw = piece.w * u;
      const ph = piece.h * u;
      ctx.fillStyle = piece.fill;
      ctx.fillRect(x, y, pw, ph);
      ctx.strokeStyle = piece.color;
      ctx.lineWidth = selected?.id === piece.id ? 4 : 2;
      ctx.strokeRect(x, y, pw, ph);
      ctx.fillStyle = piece.color;
      ctx.font = "700 15px Inter";
      ctx.textAlign = "center";
      ctx.fillText(piece.id, x + pw / 2, y + ph / 2 + 5);
      if (tool === "measure") {
        ctx.font = "700 11px Inter";
        ctx.fillText(`${piece.w} m`, x + pw / 2, y - 8);
        ctx.save();
        ctx.translate(x - 10, y + ph / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${piece.h} m`, 0, 0);
        ctx.restore();
      }
    });
    ctx.fillStyle = "#5e6680";
    ctx.font = "11px Inter";
    ctx.textAlign = "left";
    ctx.fillText("Cada quadrado representa 1 m²", 12, h - 12);
    if (tool === "cut") {
      const p = pieces[0];
      const x = o.x + p.x * u;
      const y = o.y + (p.y + 4) * u;
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = "#ef5b68";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + p.w * u, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };
  const locate = (event) => {
    const rect = canvas.getBoundingClientRect();
    const u = unit();
    const o = origin();
    return {
      x: (event.clientX - rect.left - o.x) / u,
      y: (event.clientY - rect.top - o.y) / u,
    };
  };
  canvas.addEventListener("pointerdown", (event) => {
    if (tool !== "move") return;
    const p = locate(event);
    selected = [...pieces]
      .reverse()
      .find(
        (piece) =>
          p.x >= piece.x &&
          p.x <= piece.x + piece.w &&
          p.y >= piece.y &&
          p.y <= piece.y + piece.h,
      );
    if (selected) {
      selected.dx = p.x - selected.x;
      selected.dy = p.y - selected.y;
      canvas.setPointerCapture(event.pointerId);
      draw();
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!selected) return;
    const p = locate(event);
    selected.x = Math.max(0, Math.round(p.x - selected.dx));
    selected.y = Math.max(0, Math.round(p.y - selected.dy));
    moved = true;
    draw();
  });
  const release = () => {
    selected = null;
    draw();
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  document.querySelectorAll("[data-tool]").forEach((button) =>
    button.addEventListener("click", () => {
      tool = button.dataset.tool;
      document
        .querySelectorAll("[data-tool]")
        .forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
      canvas.style.cursor = tool === "move" ? "grab" : "crosshair";
      draw();
    }),
  );
  document.querySelector("[data-undo]").addEventListener("click", () => {
    pieces = structuredClone(initial);
    moved = false;
    draw();
    window.OminiMath.toast("A composição voltou ao início.");
  });
  document.querySelector("[data-validate]").addEventListener("click", () => {
    const feedback = document.querySelector("[data-feedback]");
    if (!moved) {
      feedback.className = "feedback error";
      feedback.textContent =
        "Mova pelo menos uma parte para observar que a área não se altera.";
      return;
    }
    feedback.className = "feedback success";
    feedback.textContent =
      "Estratégia válida: 24 m² + 12 m² = 36 m². A composição mudou, mas a área foi preservada.";
    window.OminiMath.complete(
      "estudio-de-areas",
      "Estúdio de Áreas concluído.",
    );
  });
  new ResizeObserver(resize).observe(canvas);
})();
