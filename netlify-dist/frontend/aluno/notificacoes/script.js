(() => {
  const state = { items: [], filter: "all", search: "", unsubscribe: null };
  const list = document.querySelector("[data-list]");
  const loading = document.querySelector("[data-loading]");
  const pushToggle = document.querySelector("[data-push-toggle]");
  const pushStatus = document.querySelector("[data-push-status]");
  const pushDescription = document.querySelector("[data-push-description]");
  let pushEnabled = false;
  const escapeHtml = (value = "") =>
    String(value).replace(
      /[&<>'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c],
    );
  const icon = {
    agenda: "event",
    avaliacao: "assignment",
    biblioteca: "local_library",
    progresso: "trending_up",
    sistema: "info",
  };
  const relative = (iso) => {
    const minutes = Math.round((Date.now() - new Date(iso)) / 60000);
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`;
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  };
  const filtered = () =>
    state.items.filter((item) => {
      const filterOk =
        state.filter === "all" ||
        (state.filter === "unread" && !item.readAt) ||
        (state.filter === "system" && item.tipo === "sistema") ||
        (state.filter === "agenda" &&
          ["agenda", "avaliacao"].includes(item.tipo));
      const q = state.search.toLowerCase();
      return (
        filterOk &&
        (!q || `${item.titulo} ${item.mensagem}`.toLowerCase().includes(q))
      );
    });
  const render = () => {
    const items = filtered();
    document.querySelector("[data-unread-count]").textContent =
      state.items.filter((item) => !item.readAt).length;
    list.innerHTML = items.length
      ? items
          .map(
            (item) =>
              `<article class="notice ${item.readAt ? "" : "unread"}" data-id="${item.id}" data-type="${item.tipo}"><span class="notice-icon material-symbols-outlined">${icon[item.tipo] || "notifications"}</span><div class="notice-copy"><header><strong>${escapeHtml(item.titulo)}</strong>${item.prioridade === "alta" ? '<span class="priority">prioridade</span>' : ""}</header><p>${escapeHtml(item.mensagem)}</p><div class="notice-meta"><span><span class="material-symbols-outlined">schedule</span>${relative(item.created_at)}</span>${item.perfis?.nome ? `<span><span class="material-symbols-outlined">person</span>${escapeHtml(item.perfis.nome)}</span>` : ""}</div></div><div class="notice-actions">${item.link ? `<a class="notice-link" href="${escapeHtml(item.link)}">Abrir</a>` : ""}<button class="notice-toggle material-symbols-outlined" type="button" data-toggle-read aria-label="${item.readAt ? "Marcar como não lida" : "Marcar como lida"}">${item.readAt ? "mark_email_unread" : "done"}</button></div></article>`,
          )
          .join("")
      : `<div class="state"><span class="material-symbols-outlined">notifications_off</span><h2>Nada por aqui</h2><p>${state.filter === "unread" ? "Você leu todas as novidades." : "Nenhuma notificação corresponde ao filtro."}</p></div>`;
  };
  const load = async () => {
    loading.hidden = false;
    try {
      if (!window.OminiSaber?.configured)
        throw new Error("O Supabase não está configurado.");
      state.items = await window.OminiSaber.listNotifications();
      render();
    } catch (error) {
      window.StudentShell?.notify(
        error.message || "Não foi possível carregar as notificações.",
        "error",
      );
      state.items = [];
      render();
    } finally {
      loading.hidden = true;
    }
  };
  const renderPushStatus = (status) => {
    pushEnabled = Boolean(status.subscribed);
    const action = pushToggle.querySelector("[data-push-action]");
    const iconNode = pushStatus.querySelector(".material-symbols-outlined");
    const label = pushStatus.querySelector("strong");
    pushToggle.disabled = false;
    if (!status.supported) {
      pushStatus.dataset.state = "unsupported";
      iconNode.textContent = "notifications_off";
      label.textContent = "Não disponível";
      pushToggle.disabled = true;
      action.textContent = "Indisponível neste navegador";
      pushDescription.textContent =
        "No iPhone ou iPad, adicione o OminiSaber à tela inicial e abra por esse atalho. Em outros dispositivos, use um navegador atualizado com HTTPS.";
      return;
    }
    if (status.permission === "denied") {
      pushStatus.dataset.state = "blocked";
      iconNode.textContent = "notifications_paused";
      label.textContent = "Bloqueadas";
      pushToggle.disabled = true;
      action.textContent = "Permissão bloqueada";
      pushDescription.textContent =
        "Libere as notificações nas configurações do navegador e recarregue esta página.";
      return;
    }
    pushStatus.dataset.state = pushEnabled ? "active" : "inactive";
    iconNode.textContent = pushEnabled
      ? "notifications_active"
      : "notifications_none";
    label.textContent = pushEnabled ? "Ativas neste dispositivo" : "Desativadas";
    action.textContent = pushEnabled
      ? "Desativar neste dispositivo"
      : "Ativar neste dispositivo";
  };
  const refreshPushStatus = async () => {
    try {
      renderPushStatus(await window.OminiSaber.getDevicePushStatus());
    } catch (error) {
      renderPushStatus({
        ...window.OminiSaber.getPushCapability(),
        subscribed: false,
      });
      console.warn(
        "[OminiSaber][push] Não foi possível consultar o dispositivo.",
        error,
      );
    }
  };
  pushToggle.addEventListener("click", async () => {
    pushToggle.disabled = true;
    try {
      const status = pushEnabled
        ? await window.OminiSaber.disableDevicePushNotifications()
        : await window.OminiSaber.enableDevicePushNotifications();
      renderPushStatus(status);
      window.StudentShell?.notify(
        status.subscribed
          ? "Notificações ativadas neste dispositivo."
          : "Notificações desativadas neste dispositivo.",
        "success",
      );
    } catch (error) {
      window.StudentShell?.notify(
        error.message || "Não foi possível alterar as notificações.",
        "error",
      );
      await refreshPushStatus();
    }
  });
  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-toggle-read]");
    if (!button) return;
    const row = button.closest("[data-id]");
    const item = state.items.find((entry) => entry.id === row.dataset.id);
    if (!item) return;
    button.disabled = true;
    try {
      await window.OminiSaber.markNotificationRead(item.id, !item.readAt);
      item.readAt = item.readAt ? null : new Date().toISOString();
      render();
    } catch (error) {
      button.disabled = false;
      window.StudentShell?.notify(error.message, "error");
    }
  });
  document
    .querySelector("[data-read-all]")
    .addEventListener("click", async (event) => {
      const ids = state.items
        .filter((item) => !item.readAt)
        .map((item) => item.id);
      if (!ids.length)
        return window.StudentShell?.notify("Todas já estão lidas.");
      event.currentTarget.disabled = true;
      try {
        await window.OminiSaber.markAllNotificationsRead(ids);
        const now = new Date().toISOString();
        state.items.forEach((item) => {
          item.readAt ||= now;
        });
        render();
        window.StudentShell?.notify("Notificações organizadas.");
      } catch (error) {
        window.StudentShell?.notify(error.message, "error");
      } finally {
        event.currentTarget.disabled = false;
      }
    });
  document.querySelectorAll("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-filter]")
        .forEach((item) => item.classList.toggle("active", item === button));
      state.filter = button.dataset.filter;
      render();
    }),
  );
  document.querySelector("[data-search]").addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    render();
  });
  document.addEventListener(
    "ominisaber:ready",
    () => {
      load();
      refreshPushStatus();
      if (window.OminiSaber?.configured)
        state.unsubscribe = window.OminiSaber.subscribeToAgenda(() => load());
    },
    { once: true },
  );
  window.addEventListener("beforeunload", () => state.unsubscribe?.());
})();
