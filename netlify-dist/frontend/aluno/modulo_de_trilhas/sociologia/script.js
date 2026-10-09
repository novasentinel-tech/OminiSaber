(() => {
  const info = {
    renda:
      "Renda influencia o acesso a dispositivos, conexão estável, tempo livre e oportunidades de formação.",
    cultura:
      "Cultura molda repertórios, identidades e as formas como cada grupo interpreta a tecnologia.",
    poder:
      "Poder aparece nas regras que definem quem cria, controla e se beneficia das infraestruturas digitais.",
  };
  document.querySelectorAll("[data-perspective]").forEach((button) =>
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-perspective]")
        .forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      document.querySelector("[data-perspective-info]").textContent =
        info[button.dataset.perspective];
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
        /sociologia/i.test(item.atividades?.trilhas?.materia || ""),
      );
      document.querySelector("[data-progress]").textContent =
        `${items.length ? Math.round((items.filter((item) => item.concluida).length / items.length) * 100) : 0}%`;
      list.innerHTML =
        trails
          .filter((item) => /sociologia/i.test(item.materia || ""))
          .map((item) => `<div class="trail-item">${item.titulo}</div>`)
          .join("") || "Nenhuma trilha publicada.";
    } catch (error) {
      list.textContent = error.message;
    }
  });
})();
