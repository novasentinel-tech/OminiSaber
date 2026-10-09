(() => {
  const api = () => window.OminiSaber;
  const levelSystem = () => window.OminiSaberLevels;
  const state = {
    loading: document.querySelector('[data-state="loading"]'),
    error: document.querySelector('[data-state="error"]'),
    evolution: document.querySelector("[data-evolution]"),
    currentLevel: 1,
    achievements: [],
    unlockedIds: new Set(),
  };

  const escapeHTML = (value) =>
    String(value ?? "").replace(
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
  const setText = (selector, value) =>
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = value;
    });
  const show = (name) => {
    state.loading.classList.toggle("is-hidden", name !== "loading");
    state.error.classList.toggle("is-hidden", name !== "error");
    state.evolution.classList.toggle("is-hidden", name !== "ready");
  };
  const initials = (name) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  const localDateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const formatDate = (value) =>
    new Date(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });

  const renderProfile = (profile) => {
    const name = profile?.nome || "Aluno";
    setText("[data-profile-name]", name);
    setText("[data-initials]", initials(name));
    setText(
      "[data-profile-grade]",
      profile?.turmas?.serie
        ? `${profile.turmas.serie} · Ensino Médio`
        : "Ensino Médio",
    );
    setText("[data-greeting]", `Você está evoluindo, ${name.split(" ")[0]}`);
  };

  const selectMilestone = (number) => {
    const info = levelSystem().levels.find((level) => level.number === number);
    if (!info) return;
    document
      .querySelectorAll("[data-level]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(Number(button.dataset.level) === number),
        ),
      );
    const detail = document.querySelector("[data-milestone-detail]");
    detail.querySelector(".material-symbols-outlined").textContent = info.icon;
    detail.querySelector("strong").textContent =
      `${info.name} · Nível ${info.number}`;
    detail.querySelector("p").textContent = info.requirement;
    detail.querySelector(".status").textContent =
      info.number < state.currentLevel
        ? "Concluído"
        : info.number === state.currentLevel
          ? "Atual"
          : "Bloqueado";
  };

  const renderLevelPath = (progress) => {
    const levels = levelSystem().levels;
    document.querySelector("[data-level-path]").innerHTML = levels
      .map((level, index) => {
        const status =
          level.number < progress.current.number
            ? "complete"
            : level.number === progress.current.number
              ? "current"
              : "locked";
        const line =
          index < levels.length - 1
            ? `<span class="path-line ${level.number < progress.current.number ? "complete" : ""}" aria-hidden="true"></span>`
            : "";
        return `<button class="milestone ${status}" data-level="${level.number}" aria-pressed="${level.number === progress.current.number}"><span class="material-symbols-outlined">${level.icon}</span><strong>${level.number}</strong><small>${escapeHTML(level.name)}</small></button>${line}`;
      })
      .join("");
    selectMilestone(progress.current.number);
  };

  const renderLevel = (xpTotal, unlockedCount) => {
    const progress = levelSystem().progressFor(xpTotal);
    const { current, next, percentage, remaining, xp } = progress;
    state.currentLevel = current.number;
    setText("[data-level-number]", current.number);
    setText("[data-level-title]", current.name);
    setText("[data-level-description]", current.description);
    setText("[data-xp-total]", xp.toLocaleString("pt-BR"));
    setText(
      "[data-xp-detail]",
      next
        ? `${remaining.toLocaleString("pt-BR")} XP para o próximo nível`
        : "Você alcançou o nível máximo",
    );
    setText("[data-next-level]", next?.name || "Jornada completa");
    const bar = document.querySelector("[data-xp-bar]");
    bar.style.width = `${percentage}%`;
    bar.parentElement.setAttribute("aria-valuenow", String(percentage));

    const emblem = document.querySelector("[data-level-open]");
    emblem.querySelector(".material-symbols-outlined").textContent =
      current.icon;
    emblem.querySelector("strong").textContent = `Nível ${current.number}`;
    emblem.querySelector("small").textContent = current.name;
    emblem.setAttribute("aria-label", `Ver detalhes do nível ${current.name}`);

    setText("[data-dialog-level]", `Nível ${current.number}`);
    setText("[data-dialog-title]", current.name);
    setText("[data-dialog-description]", current.description);
    setText("[data-dialog-icon]", current.icon);
    document.querySelector("[data-dialog-list]").innerHTML =
      `<li>${escapeHTML(current.requirement)}</li><li>${xp.toLocaleString("pt-BR")} XP acumulados</li><li>${unlockedCount} conquista${unlockedCount === 1 ? "" : "s"} desbloqueada${unlockedCount === 1 ? "" : "s"}</li>`;

    setText(
      "[data-goal-title]",
      next ? `Chegar ao nível ${next.name}` : "Jornada de níveis completa",
    );
    setText(
      "[data-goal-description]",
      next
        ? `Faltam ${remaining.toLocaleString("pt-BR")} XP. Conclua aulas e atividades para continuar avançando.`
        : "Você alcançou o último nível. Continue estudando para ampliar sua coleção de conquistas.",
    );
    document.querySelector("[data-goal-progress]").style.width =
      `${percentage}%`;
    renderLevelPath(progress);
  };

  const renderWeek = (history) => {
    const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const days = [];
    const counts = new Map();
    history.forEach((item) => {
      const key = localDateKey(new Date(item.created_at));
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      const count = counts.get(localDateKey(date)) || 0;
      days.push({ date, count, today: offset === 0 });
    }
    const max = Math.max(1, ...days.map((day) => day.count));
    document.querySelector("[data-week-pulses]").innerHTML = days
      .map(
        (day) =>
          `<span class="${day.today ? "today" : ""}" style="--h:${day.count ? Math.max(24, Math.round((day.count / max) * 100)) : 8}%" title="${day.count} ações de estudo"><b>${day.count}</b><small>${day.today ? "Hoje" : labels[day.date.getDay()]}</small></span>`,
      )
      .join("");

    const activeDates = new Set(
      history.map((item) => localDateKey(new Date(item.created_at))),
    );
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!activeDates.has(localDateKey(cursor)))
      cursor.setDate(cursor.getDate() - 1);
    while (activeDates.has(localDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    setText(
      "[data-week-title]",
      streak
        ? `${streak} dia${streak === 1 ? "" : "s"} de consistência`
        : "Sua semana começa aqui",
    );
  };

  const renderAchievements = () => {
    const container = document.querySelector("[data-achievement-grid]");
    if (!state.achievements.length) {
      container.innerHTML =
        '<p class="empty-inline">Nenhuma conquista foi cadastrada pela escola ainda.</p>';
      return;
    }
    container.innerHTML = state.achievements
      .map((achievement) => {
        const unlocked = state.unlockedIds.has(String(achievement.id));
        return `<button class="achievement ${unlocked ? "unlocked" : "locked"}" data-status="${unlocked ? "unlocked" : "locked"}" data-achievement="${achievement.id}"><span class="medal-icon material-symbols-outlined">${unlocked ? escapeHTML(achievement.icone) : "lock"}</span><strong>${escapeHTML(achievement.nome)}</strong><small>${escapeHTML(unlocked ? achievement.descricao : achievement.requisito)}</small><span>${unlocked ? `+${Number(achievement.xp || 0)} XP` : "Ainda bloqueada"}</span></button>`;
      })
      .join("");
  };

  const renderRecentJourney = (movements) => {
    const container = document.querySelector("[data-recent-journey]");
    if (!movements.length) {
      container.innerHTML =
        '<li class="journey-empty"><span class="material-symbols-outlined">explore</span><div><strong>Sua jornada começa agora</strong><p>Conclua uma aula ou atividade para registrar seu primeiro avanço.</p></div></li>';
      return;
    }
    const icons = {
      atividade: "task_alt",
      trilha: "route",
      conquista: "workspace_premium",
      ajuste: "tune",
    };
    container.innerHTML = movements
      .slice(0, 6)
      .map(
        (movement) =>
          `<li><span class="material-symbols-outlined">${icons[movement.origem_tipo] || "stars"}</span><div><strong>${escapeHTML(movement.descricao)}</strong><p>${formatDate(movement.created_at)}</p></div><b>+${Number(movement.xp || 0)} XP</b></li>`,
      )
      .join("");
  };

  const bind = () => {
    document
      .querySelector("[data-level-path]")
      .addEventListener("click", (event) => {
        const button = event.target.closest("[data-level]");
        if (button) selectMilestone(Number(button.dataset.level));
      });
    document.querySelectorAll("[data-filter]").forEach((button) =>
      button.addEventListener("click", () => {
        document
          .querySelectorAll("[data-filter]")
          .forEach((item) => item.classList.toggle("active", item === button));
        document.querySelectorAll("[data-status]").forEach((card) => {
          card.hidden =
            button.dataset.filter !== "all" &&
            card.dataset.status !== button.dataset.filter;
        });
      }),
    );
    document
      .querySelector("[data-achievement-grid]")
      .addEventListener("click", (event) => {
        const card = event.target.closest("[data-achievement]");
        if (!card) return;
        const text = card.classList.contains("locked")
          ? `${card.querySelector("strong").textContent}: ${card.querySelector("small").textContent}`
          : `${card.querySelector("strong").textContent}: conquista desbloqueada.`;
        const toast = document.querySelector("[data-toast]");
        toast.textContent = text;
        toast.classList.add("visible");
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => toast.classList.remove("visible"), 3000);
      });
    const dialog = document.querySelector("[data-level-dialog]");
    document
      .querySelector("[data-level-open]")
      .addEventListener("click", () => dialog.showModal());
  };

  const load = async () => {
    show("loading");
    try {
      if (!api()?.configured)
        throw new Error("O Supabase não está configurado.");
      const session = await api().getSession();
      if (!session) {
        location.href = "../../login/index.html";
        return;
      }
      const [profile, xpData, history, achievementsResult, unlockedResult] =
        await Promise.all([
          api().getProfile(session.user.id),
          api().getStudyXp(),
          api().listStudyHistory({ limit: 200 }),
          api()
            .client.from("conquistas")
            .select("id,nome,descricao,requisito,categoria,xp,icone")
            .order("created_at"),
          api()
            .client.from("conquistas_aluno")
            .select("conquista_id,desbloqueado_em")
            .eq("aluno_id", session.user.id),
        ]);
      if (achievementsResult.error) throw achievementsResult.error;
      if (unlockedResult.error) throw unlockedResult.error;
      state.achievements = achievementsResult.data || [];
      state.unlockedIds = new Set(
        (unlockedResult.data || []).map((item) => String(item.conquista_id)),
      );
      renderProfile(profile);
      renderLevel(xpData.total, state.unlockedIds.size);
      renderWeek(history);
      renderAchievements();
      renderRecentJourney(xpData.movements || []);
      show("ready");
    } catch (error) {
      document.querySelector("[data-error-message]").textContent =
        error.message || "Tente novamente.";
      show("error");
    }
  };

  document.querySelector("[data-retry]").addEventListener("click", load);
  bind();
  load();
})();
