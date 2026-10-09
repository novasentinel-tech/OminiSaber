(() => {
  const events = {
    1888: [
      "Abolição da escravidão",
      "A Lei Áurea encerrou juridicamente a escravidão, sem criar políticas de inclusão para a população liberta.",
    ],
    1930: [
      "Revolução de 1930",
      "A ruptura política de 1930 inaugurou uma nova etapa de centralização do Estado brasileiro.",
    ],
    1964: [
      "Golpe civil-militar",
      "A ruptura institucional iniciou uma ditadura que restringiu direitos e liberdades por duas décadas.",
    ],
    1988: [
      "Constituição cidadã",
      "A Constituição de 1988 reorganizou direitos sociais e marcou a redemocratização brasileira.",
    ],
  };
  document.querySelectorAll("[data-year]").forEach((button) =>
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-year]")
        .forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      document.querySelector("[data-event]").textContent =
        events[button.dataset.year][0];
      document.querySelector("[data-event-info]").textContent =
        events[button.dataset.year][1];
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
        /história/i.test(item.atividades?.trilhas?.materia || ""),
      );
      document.querySelector("[data-progress]").textContent =
        `${items.length ? Math.round((items.filter((item) => item.concluida).length / items.length) * 100) : 0}%`;
      list.innerHTML =
        trails
          .filter((item) => /história/i.test(item.materia || ""))
          .map((item) => `<div class="trail-item">${item.titulo}</div>`)
          .join("") || "Nenhuma trilha publicada.";
    } catch (error) {
      list.textContent = error.message;
    }
  });
})();
