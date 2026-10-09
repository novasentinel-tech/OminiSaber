(() => {
  const quotes = {
    romantismo:
      "A emoção ocupa o centro e a paisagem se torna espelho de quem narra.",
    modernismo:
      "A linguagem se fragmenta para inventar uma forma capaz de falar do presente.",
    realismo:
      "O cotidiano aparece sem idealização, revelando conflitos sociais e psicológicos.",
  };
  document.querySelectorAll("[data-movement]").forEach((button) =>
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-movement]")
        .forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      document.querySelector("[data-quote]").textContent =
        quotes[button.dataset.movement];
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
        /literatura/i.test(item.atividades?.trilhas?.materia || ""),
      );
      document.querySelector("[data-progress]").textContent =
        `${items.length ? Math.round((items.filter((item) => item.concluida).length / items.length) * 100) : 0}%`;
      list.innerHTML =
        trails
          .filter((item) => /literatura/i.test(item.materia || ""))
          .map((item) => `<div class="trail-item">${item.titulo}</div>`)
          .join("") || "Nenhuma trilha publicada.";
    } catch (error) {
      list.textContent = error.message;
    }
  });
})();
