(() => {
  const routes = {
    matematica: "../professor_matematica/dashboard/index.html",
    portugues: "../professor_portugues/dashboard/index.html",
    tecnico_administracao:
      "../professor_tecnico_administracao/dashboard/index.html",
    tecnico_informatica:
      "../professor_tecnico_informatica/dashboard/index.html",
  };
  const showError = (message) => {
    document
      .querySelector('[data-state="loading"]')
      ?.classList.add("is-hidden");
    document
      .querySelector('[data-state="error"]')
      ?.classList.remove("is-hidden");
    document.querySelector("[data-error-message]").textContent = message;
  };
  const load = async () => {
    try {
      if (!window.OminiSaber?.configured)
        throw new Error("O Supabase não está configurado.");
      const session = await window.OminiSaber.getSession();
      if (!session) return location.replace("../../login/index.html");
      const profile = await window.OminiSaber.getProfile(session.user.id);
      const destination = routes[profile?.tipo_professor];
      if (!destination)
        throw new Error(
          "A especialidade deste professor ainda não foi definida.",
        );
      location.replace(destination);
    } catch (error) {
      showError(error.message || "Não foi possível abrir o espaço docente.");
    }
  };
  document.querySelector("[data-retry]")?.addEventListener("click", load);
  load();
})();
