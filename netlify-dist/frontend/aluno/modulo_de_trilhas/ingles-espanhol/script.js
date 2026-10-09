(() => {
  const cards = [
    [
      "community",
      "comunidade · pessoas que compartilham um espaço ou interesse",
    ],
    ["cuidado", "care · atenção dedicada a alguém ou algo"],
    ["camino", "caminho · direção ou percurso em espanhol"],
  ];
  let index = 0;
  let flipped = false;
  const face = document.querySelector("[data-card-face]");
  const translation = document.querySelector("[data-card-translation]");
  document.querySelector("[data-flip]").addEventListener("click", () => {
    flipped = !flipped;
    face.textContent = flipped
      ? cards[index][1].split(" · ")[0]
      : cards[index][0];
  });
  document.querySelector("[data-next]").addEventListener("click", () => {
    index = (index + 1) % cards.length;
    flipped = false;
    face.textContent = cards[index][0];
    translation.textContent = cards[index][1];
  });
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
        /ingl[eê]s|espanhol/i.test(item.atividades?.trilhas?.materia || ""),
      );
      document.querySelector("[data-progress]").textContent =
        `${items.length ? Math.round((items.filter((item) => item.concluida).length / items.length) * 100) : 0}%`;
      list.innerHTML =
        trails
          .filter((item) => /ingl[eê]s|espanhol/i.test(item.materia || ""))
          .map((item) => `<div class="trail-item">${item.titulo}</div>`)
          .join("") || "Nenhuma trilha publicada.";
    } catch (error) {
      list.textContent = error.message;
    }
  });
})();
