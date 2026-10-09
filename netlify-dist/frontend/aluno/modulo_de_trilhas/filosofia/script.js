(() => {
  const info = {
    A: "A ética da virtude pergunta que tipo de pessoa age e quais hábitos sustentam a decisão.",
    B: "O utilitarismo avalia consequências e procura maximizar o bem-estar coletivo.",
    C: "A ética do dever defende princípios que devem valer mesmo quando o resultado é difícil.",
  };
  document.querySelectorAll("[data-choice]").forEach((button) =>
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-choice]")
        .forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      document.querySelector("[data-choice-info]").textContent =
        info[button.dataset.choice];
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
        /filosofia/i.test(item.atividades?.trilhas?.materia || ""),
      );
      document.querySelector("[data-progress]").textContent =
        `${items.length ? Math.round((items.filter((item) => item.concluida).length / items.length) * 100) : 0}%`;
      list.innerHTML =
        trails
          .filter((item) => /filosofia/i.test(item.materia || ""))
          .map((item) => `<div class="trail-item">${item.titulo}</div>`)
          .join("") || "Nenhuma trilha publicada.";
    } catch (error) {
      list.textContent = error.message;
    }
  });
})();
