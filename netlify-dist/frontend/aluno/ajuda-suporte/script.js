(() => {
  const faqs = [
    {
      topic: "acesso",
      q: "Esqueci minha senha. O que faço?",
      a: "Na tela de entrada, use a recuperação de senha com o e-mail cadastrado. Se não tiver acesso ao e-mail, procure a equipe da escola.",
    },
    {
      topic: "agenda",
      q: "Quem adiciona provas e recuperações?",
      a: "Os professores publicam os compromissos para cada turma. A agenda e a central de notificações são atualizadas automaticamente.",
    },
    {
      topic: "agenda",
      q: "Uma data mudou. Preciso atualizar a página?",
      a: "Não. Enquanto a página estiver aberta, alterações publicadas pelos professores aparecem automaticamente.",
    },
    {
      topic: "atividades",
      q: "Como sei se uma atividade foi enviada?",
      a: "Confira o estado da atividade na trilha correspondente. Envios concluídos exibem a confirmação e ficam registrados no seu progresso.",
    },
    {
      topic: "acesso",
      q: "Onde encontro meus dados escolares?",
      a: "Abra Perfil. Dados como turma, matrícula e curso técnico são vinculados pela equipe da escola.",
    },
  ];
  const list = document.querySelector("[data-faq-list]");
  let topic = "all";
  let query = "";
  const escapeHtml = (value = "") =>
    String(value).replace(
      /[&<>'"]/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[character],
    );
  const render = () => {
    const items = faqs.filter(
      (item) =>
        (topic === "all" || item.topic === topic) &&
        (!query || `${item.q} ${item.a}`.toLowerCase().includes(query)),
    );
    list.innerHTML = items.length
      ? items
          .map(
            (item) =>
              `<article class="faq-item"><button class="faq-question" type="button" aria-expanded="false">${escapeHtml(item.q)}<span class="material-symbols-outlined">expand_more</span></button><div class="faq-answer" hidden>${escapeHtml(item.a)}</div></article>`,
          )
          .join("")
      : '<div class="state"><span class="material-symbols-outlined">search_off</span><h2>Nenhuma resposta encontrada</h2><p>Tente usar palavras mais curtas.</p></div>';
  };
  list.addEventListener("click", (event) => {
    const button = event.target.closest(".faq-question");
    if (!button) return;
    const answer = button.nextElementSibling;
    answer.hidden = !answer.hidden;
    button.setAttribute("aria-expanded", String(!answer.hidden));
    button.querySelector(".material-symbols-outlined").textContent =
      answer.hidden ? "expand_more" : "expand_less";
  });
  document.querySelectorAll("[data-topic]").forEach((button) =>
    button.addEventListener("click", () => {
      topic = topic === button.dataset.topic ? "all" : button.dataset.topic;
      document
        .querySelectorAll("[data-topic]")
        .forEach((item) =>
          item.classList.toggle("active", item.dataset.topic === topic),
        );
      render();
    }),
  );
  document
    .querySelector("[data-help-search]")
    .addEventListener("input", (event) => {
      query = event.target.value.trim().toLowerCase();
      topic = "all";
      document
        .querySelectorAll("[data-topic]")
        .forEach((item) => item.classList.remove("active"));
      render();
    });
  document
    .querySelector("[data-copy-diagnostics]")
    .addEventListener("click", async () => {
      const diagnostics = `OminiSaber | ${navigator.userAgent} | ${new Date().toLocaleString("pt-BR")} | Página: ${location.pathname}`;
      try {
        await navigator.clipboard.writeText(diagnostics);
        window.StudentShell?.notify("Dados técnicos copiados.");
      } catch {
        window.StudentShell?.notify(
          "Não foi possível copiar automaticamente.",
          "error",
        );
      }
    });
  render();
})();
