(() => {
  const body = document.body;
  const sidebar = document.querySelector(".app-sidebar");
  const currentSection = location.pathname.split("/aluno/")[1]?.split("/")[0] || "";
  if (sidebar && !sidebar.children.length) {
    const item = (folder, icon, label, counter = "") => `<a class="${currentSection === folder ? "active" : ""}" href="../${folder}/index.html"><span class="material-symbols-outlined">${icon}</span>${label}${counter ? `<span class="nav-badge" data-shell-${counter}-count hidden></span>` : ""}</a>`;
    sidebar.innerHTML = `<a class="app-brand" href="../dashboard_principal/index.html"><span class="brand-symbol material-symbols-outlined">school</span><span>OminiSaber<small>Área do aluno</small></span></a><p class="nav-label">Aprender</p><nav class="app-nav">${item("dashboard_principal", "space_dashboard", "Início")}${item("atividades", "assignment", "Atividades", "activity")}${item("modulo_de_trilhas", "route", "Trilhas")}${item("laboratorio_de_redacao", "edit_note", "Redação")}${item("minha_evolucao", "monitoring", "Evolução")}${item("biblioteca_digital", "local_library", "Biblioteca")}</nav><p class="nav-label">Organização</p><nav class="app-nav">${item("notificacoes", "notifications", "Notificações", "notification")}${item("agenda", "calendar_month", "Agenda")}${item("perfil", "person", "Perfil")}${item("ajuda-suporte", "help", "Ajuda e suporte")}</nav><div class="sidebar-person"><span class="person-avatar" data-shell-avatar>AL</span><div><strong data-shell-name>Aluno</strong><span data-shell-class>Ensino Médio</span></div></div>`;
  }
  const menu = document.querySelector("[data-menu-toggle]");
  const toast = document.querySelector("[data-toast]");
  let toastTimer;
  let unsubscribeRealtime = null;
  const initials = (name = "") =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "AL";
  window.StudentShell = {
    notify(message, type = "success") {
      if (!toast) return;
      toast.textContent = message;
      toast.className = `toast visible ${type}`;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.className = "toast";
      }, 3600);
    },
  };
  const updateCounter = (selector, value) => {
    document.querySelectorAll(selector).forEach((node) => {
      node.hidden = value < 1;
      node.textContent = value > 99 ? "99+" : String(value);
    });
  };
  const refreshCounters = async () => {
    if (!window.OminiSaber?.configured) return;
    const [evaluations, notifications] = await Promise.all([
      window.OminiSaber.listStudentEvaluations(),
      window.OminiSaber.listNotifications(),
    ]);
    const pending = evaluations.filter(
      (evaluation) =>
        (window.OminiSaber.getStudentEvaluationAvailability
          ? window.OminiSaber.getStudentEvaluationAvailability(evaluation)
              .actionable
          : true) &&
        !["enviada", "corrigida"].includes(
          evaluation.tentativas_avaliacao?.[0]?.status,
        ),
    ).length;
    const unread = notifications.filter((item) => !item.readAt).length;
    updateCounter("[data-shell-activity-count]", pending);
    updateCounter("[data-shell-notification-count]", unread);
  };
  menu?.addEventListener("click", () => {
    body.classList.toggle("nav-open");
    menu.setAttribute(
      "aria-expanded",
      String(body.classList.contains("nav-open")),
    );
  });
  document.addEventListener("click", (event) => {
    if (
      innerWidth <= 900 &&
      body.classList.contains("nav-open") &&
      !event.target.closest(".app-sidebar") &&
      !event.target.closest("[data-menu-toggle]")
    )
      body.classList.remove("nav-open");
  });
  document.addEventListener("ominisaber:ready", async (event) => {
    if (!event.detail?.session) return;
    try {
      const profile = await window.OminiSaber.getProfile(
        event.detail.session.user.id,
      );
      const name = profile?.nome || event.detail.session.user.email || "Aluno";
      document.querySelectorAll("[data-shell-name]").forEach((node) => {
        node.textContent = name;
      });
      document.querySelectorAll("[data-shell-avatar]").forEach((node) => {
        node.textContent = profile?.avatar_url ? "" : initials(name);
        if (profile?.avatar_url)
          node.style.backgroundImage = `url("${String(profile.avatar_url).replace(/"/g, "")}")`;
      });
      document.querySelectorAll("[data-shell-class]").forEach((node) => {
        node.textContent = profile?.turmas?.serie
          ? `${profile.turmas.serie}º ano`
          : "Ensino Médio";
      });
      await refreshCounters();
      unsubscribeRealtime ||= window.OminiSaber.subscribeToAgenda(() =>
        refreshCounters().catch(() => {}),
      );
    } catch {
      /* A página principal mostra o erro da operação relevante. */
    }
  });
  window.addEventListener("beforeunload", () => unsubscribeRealtime?.());
})();
