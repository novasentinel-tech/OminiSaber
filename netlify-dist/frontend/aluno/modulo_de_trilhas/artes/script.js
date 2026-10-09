(() => {
  const names = {
    calma: "Uma paleta calma convida a olhar devagar e perceber detalhes.",
    energia:
      "Cores de energia criam contraste e conduzem o olhar pela composição.",
    memoria: "Uma atmosfera de memória combina camadas, vestígios e afetos.",
  };
  document.querySelectorAll("[data-color]").forEach((button) =>
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-color]")
        .forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      document.querySelector("[data-stage]").textContent =
        names[button.dataset.color];
    }),
  );
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
        /artes/i.test(item.atividades?.trilhas?.materia || ""),
      );
      document.querySelector("[data-progress]").textContent =
        `${items.length ? Math.round((items.filter((item) => item.concluida).length / items.length) * 100) : 0}%`;
      list.innerHTML =
        trails
          .filter((item) => /artes/i.test(item.materia || ""))
          .map((item) => `<div class="trail-item">${item.titulo}</div>`)
          .join("") || "Nenhuma trilha publicada.";
    } catch (error) {
      list.textContent = error.message;
    }
  });
})();
