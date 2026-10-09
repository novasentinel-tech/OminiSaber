(() => {
  const input = document.querySelector("[data-x]");
  const check = document.querySelector("[data-check]");
  const feedback = document.querySelector("[data-feedback]");
  const update = () => {
    const value = Number(input.value);
    check.textContent = `2(${value}) + 4 = ${2 * value + 4}`;
    feedback.textContent =
      2 * value + 4 === 18
        ? "Perfeito: x = 7 mantém a igualdade verdadeira."
        : "A igualdade só é verdadeira quando o resultado chega a 18.";
  };
  input.addEventListener("input", update);
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
        /álgebra/i.test(item.atividades?.trilhas?.materia || ""),
      );
      document.querySelector("[data-progress]").textContent =
        `${items.length ? Math.round((items.filter((item) => item.concluida).length / items.length) * 100) : 0}%`;
      list.innerHTML =
        trails
          .filter((item) => /álgebra/i.test(item.materia || ""))
          .map((item) => `<div class="trail-item">${item.titulo}</div>`)
          .join("") || "Nenhuma trilha publicada.";
    } catch (error) {
      list.textContent = error.message;
    }
  });
})();
