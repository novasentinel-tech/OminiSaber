(() => {
  const speed = document.querySelector("[data-speed]");
  const runner = document.querySelector("[data-runner]");
  const reading = document.querySelector("[data-reading]");
  const update = () => {
    runner.style.width = `${speed.value * 5}%`;
    reading.textContent = `Velocidade: ${speed.value} m/s · deslocamento calculado em 5 segundos: ${speed.value * 5} m.`;
  };
  speed.addEventListener("input", update);
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
        /física/i.test(item.atividades?.trilhas?.materia || ""),
      );
      document.querySelector("[data-progress]").textContent =
        `${items.length ? Math.round((items.filter((item) => item.concluida).length / items.length) * 100) : 0}%`;
      list.innerHTML =
        trails
          .filter((item) => /física/i.test(item.materia || ""))
          .slice(0, 3)
          .map(
            (item) =>
              `<div class="trail-item">${item.titulo}<span>${item.atividades?.length || 0} experimentos</span></div>`,
          )
          .join("") || "Nenhuma trilha publicada.";
    } catch (error) {
      list.textContent = error.message;
    }
  });
})();
