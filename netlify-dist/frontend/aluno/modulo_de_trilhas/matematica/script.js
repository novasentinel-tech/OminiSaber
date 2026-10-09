(() => {
  const ids = ["maquina-de-padroes", "estudio-de-areas", "reta-em-movimento"];
  const renderProgress = async () => {
    const progress = await window.OminiMath.loadProgress();
    const completed = ids.filter((id) => progress[id]?.completed).length;
    document.querySelector("[data-hub-progress]").textContent =
      `${completed}/3`;
    document.querySelector("[data-hub-progress-bar]").style.width =
      `${(completed / 3) * 100}%`;
    ids.forEach((id) => {
      if (progress[id]?.completed) {
        const node = document.querySelector(`[data-card-status="${id}"]`);
        node.textContent = "Atividade concluída";
        node.classList.add("completed");
      }
    });
  };
  const buttons = [...document.querySelectorAll("[data-year]")];
  const cards = [...document.querySelectorAll("[data-card-year]")];
  buttons.forEach((button) =>
    button.addEventListener("click", () => {
      buttons.forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
      const year = button.dataset.year;
      let visible = 0;
      cards.forEach((card) => {
        const show = year === "all" || card.dataset.cardYear === year;
        card.hidden = !show;
        if (show) visible += 1;
      });
      document.querySelector("[data-empty-filter]").hidden = visible > 0;
    }),
  );
  const loadFeed = async () => {
    const count = document.querySelector("[data-teacher-feed-count]");
    const copy = document.querySelector("[data-teacher-feed-copy]");
    if (!window.OminiSaber?.configured) {
      count.textContent = "—";
      copy.textContent =
        "Conecte o Supabase para consultar as atividades publicadas.";
      return;
    }
    try {
      const evaluations = await window.OminiSaber.listStudentEvaluations({
        tipoProfessor: "matematica",
      });
      count.textContent = evaluations.length;
      copy.textContent = evaluations.length
        ? `${evaluations.length} avaliação(ões) de Matemática disponível(is) nos laboratórios.`
        : "Nenhuma avaliação publicada pelo professor para sua turma.";
    } catch {
      count.textContent = "!";
      copy.textContent = "Não foi possível consultar as atividades agora.";
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
