(() => {
  const base = document.querySelector("[data-base]");
  const height = document.querySelector("[data-height]");
  const result = document.querySelector("[data-result]");
  const triangle = document.querySelector("[data-triangle]");

  const updateShape = () => {
    result.textContent = `Área: ${(base.value * height.value) / 2} u²`;
    triangle.style.borderRightWidth = `${base.value * 10}px`;
    triangle.style.borderLeftWidth = `${base.value * 10}px`;
    triangle.style.borderBottomWidth = `${height.value * 18}px`;
  };

  base.addEventListener("input", updateShape);
  height.addEventListener("input", updateShape);

  document.addEventListener("DOMContentLoaded", async () => {
    const list = document.querySelector("[data-trails]");
    if (!window.OminiSaber?.configured) {
      list.textContent = "Supabase não configurado.";
      return;
    }
    try {
      const [trails, progress] = await Promise.all([
        window.OminiSaber.listTrilhas(),
        window.OminiSaber.listStudentProgress(),
      ]);
      const items = progress.filter((item) =>
        /geometria/i.test(item.atividades?.trilhas?.materia || ""),
      );
      document.querySelector("[data-progress]").textContent =
        `${items.length ? Math.round((items.filter((item) => item.concluida).length / items.length) * 100) : 0}%`;
      list.innerHTML =
        trails
          .filter((item) => /geometria/i.test(item.materia || ""))
          .map((item) => `<div class="trail-item">${item.titulo}</div>`)
          .join("") || "Nenhuma trilha publicada.";
    } catch (error) {
      list.textContent = error.message;
    }
  });
})();
