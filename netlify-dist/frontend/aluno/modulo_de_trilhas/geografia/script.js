(() => {
  const info = {
    centro:
      "Centro urbano: concentra serviços, empregos e decisões, mas também pode expulsar moradores pelo preço da terra.",
    fluxos:
      "Fluxos: pessoas, mercadorias, capitais e informações conectam diferentes territórios.",
    desigualdade:
      "Desigualdade: o acesso à cidade varia conforme renda, raça, gênero e localização da moradia.",
  };
  document.querySelectorAll("[data-node]").forEach((button) =>
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-node]")
        .forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      document.querySelector("[data-node-info]").textContent =
        info[button.dataset.node];
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
        /geografia/i.test(item.atividades?.trilhas?.materia || ""),
      );
      document.querySelector("[data-progress]").textContent =
        `${items.length ? Math.round((items.filter((item) => item.concluida).length / items.length) * 100) : 0}%`;
      list.innerHTML =
        trails
          .filter((item) => /geografia/i.test(item.materia || ""))
          .map((item) => `<div class="trail-item">${item.titulo}</div>`)
          .join("") || "Nenhuma trilha publicada.";
    } catch (error) {
      list.textContent = error.message;
    }
  });
})();
