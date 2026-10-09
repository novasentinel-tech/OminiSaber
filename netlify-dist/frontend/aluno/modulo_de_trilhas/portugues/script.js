(() => {
  const ids = [
    "mapa-da-lingua",
    "investigacao-argumentativa",
    "interpretacao-visual",
  ];
  const renderProgress = async () => {
    const progress = await window.OminiPortuguese.loadProgress();
    const completed = ids.filter((id) => progress[id]?.completed).length;
    document.querySelector("[data-hub-progress]").textContent =
      `${completed}/${ids.length}`;
    document.querySelector("[data-hub-progress-bar]").style.width =
      `${(completed / ids.length) * 100}%`;
    ids.forEach((id) => {
      const status = document.querySelector(`[data-card-status="${id}"]`);
      if (progress[id]?.completed && status) {
        status.textContent = "Atividade concluída";
        status.classList.add("completed");
      }
    });
  };
  document.querySelectorAll("[data-year]").forEach((button) =>
    button.addEventListener("click", () => {
      const year = button.dataset.year;
      document
        .querySelectorAll("[data-year]")
        .forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
      let visible = 0;
      document.querySelectorAll("[data-card-year]").forEach((card) => {
        card.hidden = year !== "all" && card.dataset.cardYear !== year;
        if (!card.hidden) visible += 1;
      });
      document.querySelector("[data-empty-filter]").hidden = visible > 0;
    }),
  );
  const loadFeed = async () => {
    const copy = document.querySelector("[data-teacher-feed-copy]");
    const count = document.querySelector("[data-teacher-feed-count]");
    if (!window.OminiSaber?.configured) {
      copy.textContent =
        "Configure o Supabase para exibir avaliações reais da sua turma.";
      count.textContent = "0";
      return;
    }
    try {
      const evaluations = await window.OminiSaber.listStudentEvaluations({
        tipoProfessor: "portugues",
      });
      count.textContent = evaluations.length;
      copy.textContent = evaluations.length
        ? `${evaluations.length} avaliação(ões) de Português disponível(is) nas experiências.`
        : "Nenhuma avaliação publicada pelo professor para sua turma.";
    } catch {
      copy.textContent =
        "Não foi possível consultar as avaliações neste momento.";
      count.textContent = "—";
    }
  };
  document.addEventListener("ominisaber:ready", () => {
    renderProgress().catch(() => {});
    loadFeed();
  });
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.OminiSaber?.configured) loadFeed();
  });
})();
