(() => {
  const poster = document.querySelector("[data-poster]");
  let speech = null;
  document.querySelectorAll("[data-focus]").forEach((button) =>
    button.addEventListener("click", () => {
      poster.dataset.focus = button.dataset.focus;
      document
        .querySelectorAll(".focus-switch")
        .forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
    }),
  );
  document
    .querySelectorAll("[data-clue]")
    .forEach((button) =>
      button.addEventListener("click", () => button.classList.toggle("active")),
    );
  document
    .querySelector("[data-listen-description]")
    .addEventListener("click", () => {
      if (!("speechSynthesis" in window))
        return window.OminiPortuguese.toast(
          "A descrição em voz alta não está disponível neste navegador.",
        );
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        document.querySelector("[data-description-label]").textContent =
          "Ouvir descrição da imagem";
        return;
      }
      speech = new SpeechSynthesisUtterance(
        document.querySelector(".poster-card img").alt,
      );
      speech.lang = "pt-BR";
      speech.rate = 0.9;
      speech.onend = () => {
        document.querySelector("[data-description-label]").textContent =
          "Ouvir descrição da imagem";
      };
      document.querySelector("[data-description-label]").textContent =
        "Parar descrição";
      window.speechSynthesis.speak(speech);
    });
  document.querySelector("[data-clear]").addEventListener("click", () => {
    document
      .querySelectorAll('input[name="interpretation"]')
      .forEach((input) => {
        input.checked = false;
      });
    document
      .querySelectorAll("[data-clue]")
      .forEach((button) => button.classList.remove("active"));
    document.querySelector("[data-feedback]").textContent = "";
  });
  document.querySelector("[data-confirm]").addEventListener("click", () => {
    const selected = document.querySelector(
      'input[name="interpretation"]:checked',
    );
    const clues = document.querySelectorAll("[data-clue].active").length;
    const feedback = document.querySelector("[data-feedback]");
    if (!selected) {
      feedback.className = "feedback error";
      feedback.textContent = "Escolha uma interpretação antes de confirmar.";
      return;
    }
    if (selected.value !== "3") {
      feedback.className = "feedback error";
      feedback.textContent =
        "Releia o contraste entre os edifícios, as moradias, o título e as barras do gráfico.";
      return;
    }
    if (clues < 2) {
      feedback.className = "feedback error";
      feedback.textContent =
        "Sua interpretação está no caminho certo. Marque ao menos duas pistas visuais que a sustentam.";
      return;
    }
    feedback.className = "feedback success";
    feedback.textContent =
      "Interpretação confirmada: você articulou linguagem verbal e material gráfico para reconhecer a crítica social.";
    window.OminiPortuguese.complete(
      "interpretacao-visual",
      "Interpretação Visual concluída. Você sustentou sua leitura com pistas do material.",
    );
  });
})();
