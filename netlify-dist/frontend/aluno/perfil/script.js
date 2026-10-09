(() => {
  const initials = (name = "") =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "AL";
  const set = (selector, value) =>
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = value || "Não informado";
    });
  document.addEventListener(
    "ominisaber:ready",
    async (event) => {
      try {
        const session = event.detail?.session;
        if (!session) return;
        const profile = await window.OminiSaber.getProfile(session.user.id);
        const name = profile?.nome || session.user.email;
        const grade = profile?.turmas?.serie;
        set("[data-profile-name]", name);
        set("[data-profile-email]", session.user.email);
        set(
          "[data-profile-grade]",
          grade ? `${grade}º ano do Ensino Médio` : "Ensino Médio",
        );
        set(
          "[data-profile-registration]",
          profile?.matricula
            ? `Matrícula ${profile.matricula}`
            : "Matrícula não informada",
        );
        set("[data-profile-class]", profile?.turmas?.nome || "Não informada");
        set("[data-profile-year]", grade ? `${grade}º ano` : "Não informado");
        set("[data-profile-course]", profile?.curso_tecnico || "Não informado");
        const avatar = document.querySelector("[data-profile-avatar]");
        avatar.textContent = profile?.avatar_url ? "" : initials(name);
        if (profile?.avatar_url)
          avatar.style.backgroundImage = `url("${String(profile.avatar_url).replace(/"/g, "")}")`;
      } catch (error) {
        window.StudentShell?.notify(
          error.message || "Não foi possível carregar o perfil.",
          "error",
        );
      }
    },
    { once: true },
  );
})();
