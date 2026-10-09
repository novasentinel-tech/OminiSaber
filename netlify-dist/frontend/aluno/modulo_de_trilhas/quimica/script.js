(() => {
  const data = {
    H: ["Hidrogênio", "Não metal · número atômico 1 · o elemento mais leve."],
    C: ["Carbono", "Não metal · número atômico 6 · base da vida orgânica."],
    O: ["Oxigênio", "Não metal · número atômico 8 · essencial à respiração."],
    Na: ["Sódio", "Metal alcalino · número atômico 11 · reativo em água."],
    Fe: [
      "Ferro",
      "Metal de transição · número atômico 26 · presente na hemoglobina.",
    ],
    Au: [
      "Ouro",
      "Metal de transição · número atômico 79 · resistente à oxidação.",
    ],
  };
  document.querySelectorAll("[data-element]").forEach((button) =>
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-element]")
        .forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      document.querySelector("[data-element-name]").textContent =
        data[button.dataset.element][0];
      document.querySelector("[data-element-info]").textContent =
        data[button.dataset.element][1];
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
        /química/i.test(item.atividades?.trilhas?.materia || ""),
      );
      document.querySelector("[data-progress]").textContent =
        `${items.length ? Math.round((items.filter((item) => item.concluida).length / items.length) * 100) : 0}%`;
      list.innerHTML =
        trails
          .filter((item) => /química/i.test(item.materia || ""))
          .map((item) => `<div class="trail-item">${item.titulo}</div>`)
          .join("") || "Nenhuma trilha publicada.";
    } catch (error) {
      list.textContent = error.message;
    }
  });
})();
