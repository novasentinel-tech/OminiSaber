(() => {
  const state = {
    achievements: [],
    unlocked: new Map(),
    activeFilter: "todos",
    xp: 0,
  };

  const elements = {
    loading: document.querySelector("[data-loading]"),
    error: document.querySelector("[data-error]"),
    errorMessage: document.querySelector("[data-error-message]"),
    content: document.querySelector("[data-content]"),
    cards: document.querySelector("[data-achievement-list]"),
    unlockedCount: document.querySelectorAll("[data-unlocked-count]"),
    xp: document.querySelectorAll("[data-xp]"),
    level: document.querySelector("[data-level]"),
    levelTitle: document.querySelector("[data-level-title]"),
    xpBar: document.querySelector("[data-xp-bar]"),
  };

  const api = () => window.OminiSaber;
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
  const firstValue = (object, keys, fallback = "") =>
    keys
      .map((key) => object?.[key])
      .find((value) => value !== undefined && value !== null && value !== "") ??
    fallback;
  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "Data não informada";
  const getCategory = (achievement) => {
    const value = String(
      firstValue(achievement, ["categoria", "category", "tipo"], "geral"),
    ).toLowerCase();
    if (value.includes("trilha") || value.includes("atividade"))
      return "trilhas";
    if (value.includes("reda")) return "redacao";
    if (value.includes("leit")) return "leitura";
    return "geral";
  };
  const getAchievementId = (achievement) =>
    firstValue(achievement, ["id", "conquista_id"]);
  const getUnlockedId = (record) =>
    firstValue(record, ["conquista_id", "achievement_id", "id_conquista"]);
  const getXp = (achievement) =>
    Number(
      firstValue(achievement, ["xp", "xp_recompensa", "recompensa_xp"], 0),
    ) || 0;
  const getName = (achievement) =>
    firstValue(achievement, ["nome", "titulo", "name"], "Conquista");
  const getDescription = (achievement) =>
    firstValue(
      achievement,
      ["descricao", "description", "requisito"],
      "Continue estudando para desbloquear esta conquista.",
    );
  const getIcon = (achievement, unlocked) =>
    unlocked
      ? firstValue(achievement, ["icone", "icon"], "workspace_premium")
      : "lock";
  const getDetailPath = (achievement) => {
    const paths = {
      "primeira-redacao": "medalhas/primeira-redacao.html",
      "leitor-assiduo": "medalhas/leitor-assiduo.html",
      "explorador-trilhas": "medalhas/explorador-trilhas.html",
      "foco-total": "medalhas/foco-total.html",
    };
    const id = String(getAchievementId(achievement));
    return paths[id] || "";
  };

  const setState = (name) => {
    elements.loading.classList.toggle("is-hidden", name !== "loading");
    elements.error.classList.toggle("is-hidden", name !== "error");
    elements.content.classList.toggle("is-hidden", name !== "ready");
  };
  const setSummary = (xpTotal) => {
    const unlocked = [...state.unlocked.values()];
    const levelProgress = window.OminiSaberLevels.progressFor(xpTotal);
    state.xp = levelProgress.xp;
    elements.unlockedCount.forEach((element) => {
      element.textContent = `${unlocked.length} desbloqueada${unlocked.length === 1 ? "" : "s"}`;
    });
    elements.xp.forEach((element) => {
      element.textContent = `${levelProgress.xp.toLocaleString("pt-BR")} XP`;
    });
    elements.level.textContent = `Nível ${levelProgress.current.number}`;
    elements.levelTitle.textContent = levelProgress.current.name;
    elements.xpBar.style.width = `${levelProgress.percentage}%`;
    document.querySelector("[data-xp-detail]").textContent = levelProgress.next
      ? `${levelProgress.remaining.toLocaleString("pt-BR")} XP para ${levelProgress.next.name}`
      : "Nível máximo alcançado";
  };
  const renderCards = () => {
    const filtered = state.achievements.filter(
      (achievement) =>
        state.activeFilter === "todos" ||
        getCategory(achievement) === state.activeFilter,
    );
    if (!filtered.length) {
      elements.cards.innerHTML =
        '<p class="empty-state">Nenhuma conquista encontrada nesta categoria.</p>';
      return;
    }
    elements.cards.innerHTML = filtered
      .map((achievement) => {
        const id = String(getAchievementId(achievement));
        const record = state.unlocked.get(id);
        const isUnlocked = Boolean(record);
        const xp = getXp(achievement);
        const title = getName(achievement);
        const detail = isUnlocked
          ? `Desbloqueada em ${formatDate(firstValue(record, ["desbloqueado_em", "conquistada_em", "created_at"]))}`
          : getDescription(achievement);
        const cardClass = isUnlocked ? "is-unlocked" : "is-locked";
        const icon = escapeHTML(getIcon(achievement, isUnlocked));
        const category = escapeHTML(getCategory(achievement));
        const detailPath = getDetailPath(achievement);
        const cardTag = detailPath ? "a" : "article";
        const cardLink = detailPath ? ` href="${detailPath}"` : "";
        return `
          <${cardTag} class="achievement-card ${cardClass}"${cardLink}>
            <div class="achievement-top">
              <span class="achievement-icon material-symbols-outlined">
                ${icon}
              </span>
              <span class="xp-tag">+${xp} XP</span>
            </div>
            <div>
              <h3>${escapeHTML(title)}</h3>
              <p>${escapeHTML(detail)}</p>
            </div>
            <span class="achievement-category">${category}</span>
          </${cardTag}>`;
      })
      .join("");
  };
  const loadAchievements = async () => {
    setState("loading");
    try {
      if (!api()?.configured || !api().client) {
        throw new Error("O Supabase não está configurado.");
      }
      const session = await api().getSession();
      if (!session) {
        window.location.href = "../../login/index.html";
        return;
      }
      const [achievementsResult, unlockedResult, xpData] = await Promise.all([
        api().client.from("conquistas").select("*"),
        api()
          .client.from("conquistas_aluno")
          .select("*")
          .eq("aluno_id", session.user.id),
        api().getStudyXp(),
      ]);
      if (achievementsResult.error) throw achievementsResult.error;
      if (unlockedResult.error) throw unlockedResult.error;
      state.achievements = achievementsResult.data || [];
      (unlockedResult.data || []).forEach((record) =>
        state.unlocked.set(String(getUnlockedId(record)), record),
      );
      setSummary(xpData.total);
      renderCards();
      setState("ready");
    } catch (error) {
      elements.errorMessage.textContent =
        error.message || "Não foi possível carregar suas conquistas.";
      setState("error");
    }
  };

  document.querySelectorAll("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.filter;
      document
        .querySelectorAll("[data-filter]")
        .forEach((item) => item.classList.toggle("is-active", item === button));
      renderCards();
    }),
  );
  document
    .querySelector("[data-retry]")
    ?.addEventListener("click", loadAchievements);
  document.addEventListener("DOMContentLoaded", loadAchievements);
})();
