(() => {
  const data = {
    núcleo: [
      "Núcleo",
      "Armazena o material genético e coordena as atividades celulares.",
    ],
    membrana: [
      "Membrana plasmática",
      "Controla a entrada e a saída de substâncias na célula.",
    ],
    mitocôndria: [
      "Mitocôndria",
      "Produz energia para as funções da célula por meio da respiração celular.",
    ],
  };
  document.querySelectorAll("[data-part]").forEach((button) =>
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-part]")
        .forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      document.querySelector("[data-part-name]").textContent =
        data[button.dataset.part][0];
      document.querySelector("[data-part-info]").textContent =
        data[button.dataset.part][1];
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
        /biologia/i.test(item.atividades?.trilhas?.materia || ""),
      );
      document.querySelector("[data-progress]").textContent =
        `${items.length ? Math.round((items.filter((item) => item.concluida).length / items.length) * 100) : 0}%`;
      list.innerHTML =
        trails
          .filter((item) => /biologia/i.test(item.materia || ""))
          .map((item) => `<div class="trail-item">${item.titulo}</div>`)
          .join("") || "Nenhuma trilha publicada.";
    } catch (error) {
      list.textContent = error.message;
    }
  });
})();
