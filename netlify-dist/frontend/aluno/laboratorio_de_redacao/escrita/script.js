(() => {
  const params = new URLSearchParams(location.search);
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const api = () => window.OminiSaber;
  const state = {
    themeCode: params.get("tema") || "",
    essayId: params.get("redacao") || "",
    proposal: null,
    planning: null,
    saving: null,
    saveTimer: 0,
    dirty: false,
    saveFailed: false,
    lastPersisted: "",
    previousWordCount: 0,
    lastValidText: "",
    currentLines: 1,
  };

  const el = {
    app: $("[data-writing-app]"),
    loading: $("[data-loading]"),
    title: $("[data-title]"),
    text: $("[data-text]"),
    themeTitle: $("[data-theme-title]"),
    saveState: $("[data-save-state]"),
    saveLabel: $("[data-save-label]"),
    retry: $("[data-retry-save]"),
    feedback: $("[data-writing-feedback]"),
    backPlanning: $("[data-back-planning]"),
    exit: $("[data-exit-focus]"),
    panel: $("[data-reference-panel]"),
    panelToggle: $("[data-reference-toggle]"),
    focusToolbar: $("[data-reference-focus-toolbar]"),
    focusTitle: $("[data-reference-focus-title]"),
    referenceHint: $("[data-reference-hint]"),
    lineMeasure: $("[data-line-measure]"),
    lineFeedback: $("[data-line-feedback]"),
  };

  const escapeHTML = (value = "") =>
    String(value).replace(
      /[&<>'"]/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[char],
    );

  const safeUrl = (value = "") => {
    if (!String(value).trim()) return "";
    try {
      const url = new URL(value, location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

  const setSaveState = (message, mode = "saved") => {
    const icons = {
      saved: "cloud_done",
      saving: "sync",
      pending: "cloud_sync",
      error: "cloud_off",
    };
    el.saveState.className = `save-state is-${mode}`;
    el.saveState.querySelector(".material-symbols-outlined").textContent =
      icons[mode] || icons.saved;
    el.saveLabel.textContent = message;
    el.retry.classList.toggle("is-hidden", mode !== "error");
  };

  const wordCount = () => {
    const text = el.text.value.trim();
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  };

  const renderLineNumbers = () => {
    $("[data-line-numbers]").innerHTML = Array.from(
      { length: 30 },
      (_, index) => `<span>${index + 1}</span>`,
    ).join("");
  };

  const measureLineCount = (value = el.text.value) => {
    const textStyle = getComputedStyle(el.text);
    const lineHeight = Number.parseFloat(textStyle.lineHeight) || 32;
    el.lineMeasure.style.width = `${el.text.clientWidth}px`;
    el.lineMeasure.textContent = value
      ? `${value}${value.endsWith("\n") ? "\u200b" : ""}`
      : "\u200b";
    return Math.max(1, Math.ceil(el.lineMeasure.scrollHeight / lineHeight));
  };

  const updateLineState = () => {
    const lines = measureLineCount();
    state.currentLines = lines;
    $("[data-line-count]").textContent = Math.min(lines, 30);
    $("[data-footer-line-count]").textContent = Math.min(lines, 30);
    const budget = $(".line-budget");
    budget.classList.toggle("is-near-limit", lines >= 26 && lines < 30);
    budget.classList.toggle("is-at-limit", lines >= 30);
    if (lines < 30 && el.lineFeedback.classList.contains("is-error")) {
      el.lineFeedback.classList.remove("is-error");
      el.lineFeedback.textContent = "Sua redação pode ocupar até 30 linhas.";
    }
    return lines;
  };

  const updateStats = () => {
    const text = el.text.value.trim();
    const words = wordCount();
    const paragraphs = text
      ? text.split(/\n\s*\n|\n(?=\s{4})/).filter((item) => item.trim()).length
      : 0;
    $("[data-word-count]").textContent = words;
    $("[data-paragraph-count]").textContent = paragraphs;
    $("[data-character-count]").textContent = el.text.value.length;
    updateLineState();
    return words;
  };

  const snapshot = () =>
    JSON.stringify({ title: el.title.value, text: el.text.value });

  const payload = () => ({
    essayId: state.essayId || null,
    titulo: el.title.value.trim() || "Redação sem título",
    texto: el.text.value,
    themeCode: state.themeCode,
    proposalId: state.proposal?.id || null,
    planningId: state.planning?.id || null,
  });

  const flushSave = async ({ announce = false } = {}) => {
    window.clearTimeout(state.saveTimer);
    if (!state.dirty && snapshot() === state.lastPersisted) {
      if (announce) setSaveState("Tudo salvo", "saved");
      return state.saving;
    }
    if (state.saving) return state.saving;

    state.saveFailed = false;
    state.saving = (async () => {
      while (state.dirty || snapshot() !== state.lastPersisted) {
        state.dirty = false;
        const savingSnapshot = snapshot();
        setSaveState("Salvando...", "saving");
        try {
          const draft = await api().saveEssayDraft(payload());
          state.essayId = draft.id;
          state.lastPersisted = savingSnapshot;
          const query = new URLSearchParams(location.search);
          query.set("tema", state.themeCode);
          query.set("redacao", state.essayId);
          history.replaceState(null, "", `${location.pathname}?${query}`);
          updateLinks();
          const time = new Intl.DateTimeFormat("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(new Date());
          setSaveState(`Salvo às ${time}`, "saved");
          if (snapshot() !== savingSnapshot) state.dirty = true;
        } catch (error) {
          console.error("[OminiSaber][Redação] Falha no salvamento automático.", error);
          state.dirty = true;
          state.saveFailed = true;
          setSaveState("Não foi possível salvar", "error");
          el.feedback.textContent =
            "Sua última alteração ainda não foi sincronizada. Verifique a conexão e tente novamente.";
          throw error;
        }
      }
    })();

    try {
      await state.saving;
      if (announce) el.feedback.textContent = "Rascunho salvo na sua conta.";
    } finally {
      state.saving = null;
      if (state.dirty && !state.saveFailed) flushSave().catch(() => {});
    }
  };

  const scheduleSave = ({ immediate = false } = {}) => {
    state.dirty = true;
    state.saveFailed = false;
    window.clearTimeout(state.saveTimer);
    setSaveState("Alterações pendentes", "pending");
    if (immediate) flushSave().catch(() => {});
    else
      state.saveTimer = window.setTimeout(
        () => flushSave().catch(() => {}),
        700,
      );
  };

  const updateLinks = () => {
    const query = new URLSearchParams();
    if (state.themeCode) query.set("tema", state.themeCode);
    if (state.essayId) query.set("redacao", state.essayId);
    el.backPlanning.href = `../index.html?${query}&step=2`;
    el.exit.href = `../index.html?${query}&step=2`;
  };

  const supportMaterials = () => {
    const motivators = (state.proposal?.textos_motivadores || []).map(
      (item, index) =>
        typeof item === "string"
          ? { titulo: `Texto motivador ${index + 1}`, conteudo: item }
          : {
              titulo: item.titulo || `Texto motivador ${index + 1}`,
              conteudo: item.texto || item.conteudo || "",
              autoria: item.autoria,
              fonte: item.fonte,
              url: item.url,
            },
    );
    return [...motivators, ...(state.proposal?.materiais_redacao || [])];
  };

  const renderSupport = () => {
    const target = $("[data-reference-content='support']");
    const materials = supportMaterials();
    const command = state.proposal?.comando || state.proposal?.resumo || "";
    target.innerHTML = `
      <article class="reference-block is-command" data-reference-card data-reference-title="Comando da proposta" tabindex="0" role="button" aria-label="Ampliar comando da proposta">
        <small>Comando da proposta</small>
        <h2>${escapeHTML(state.proposal?.titulo || "Tema selecionado")}</h2>
        <p>${escapeHTML(command || "Desenvolva um texto dissertativo-argumentativo sobre o tema selecionado.")}</p>
      </article>
      ${
        materials.length
          ? materials
              .map((item, index) => {
                const url = safeUrl(item.url || item.fonte_url || "");
                const meta = [item.autoria, item.fonte, item.ano]
                  .filter(Boolean)
                  .join(" · ");
                const title = item.titulo || "Material de apoio";
                return `<article class="reference-block" data-reference-card data-reference-title="${escapeHTML(title)}" tabindex="0" role="button" aria-label="Ampliar ${escapeHTML(title)}"><small>Texto de apoio ${index + 1}</small><h3>${escapeHTML(title)}</h3>${meta ? `<span class="reference-meta">${escapeHTML(meta)}</span>` : ""}<p>${escapeHTML(item.conteudo || item.texto || "Material disponibilizado pela professora.")}</p>${url ? `<a class="reference-link" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Abrir fonte<span class="material-symbols-outlined" aria-hidden="true">open_in_new</span></a>` : ""}</article>`;
              })
              .join("")
          : '<article class="reference-block" data-reference-card data-reference-title="Textos de apoio" tabindex="0" role="button" aria-label="Ampliar textos de apoio"><small>Textos de apoio</small><h3>Nenhum material adicional</h3><p>Use o comando da proposta e o planejamento construído nas etapas anteriores.</p></article>'
      }`;
  };

  const renderPlanning = () => {
    const target = $("[data-reference-content='planning']");
    const plan = state.planning || {};
    const argumentsList = Array.isArray(plan.argumentos) ? plan.argumentos : [];
    const intervention = plan.intervencao || {};
    const repertoires = (plan.planejamento_repertorios || [])
      .map((item) => item.repertorios_redacao?.titulo)
      .filter(Boolean);
    target.innerHTML = `
      <article class="reference-block" data-reference-card data-reference-title="Anotações" tabindex="0" role="button" aria-label="Ampliar anotações"><small>Anotações</small><p>${escapeHTML(plan.anotacoes || "Nenhuma anotação registrada.")}</p></article>
      <article class="reference-block" data-reference-card data-reference-title="Tese" tabindex="0" role="button" aria-label="Ampliar tese"><small>Tese</small><p>${escapeHTML(plan.tese || "Tese ainda não definida.")}</p></article>
      <article class="reference-block" data-reference-card data-reference-title="Argumentos" tabindex="0" role="button" aria-label="Ampliar argumentos"><small>Argumentos</small><ul>${argumentsList.filter(Boolean).length ? argumentsList.filter(Boolean).map((item) => `<li>${escapeHTML(item)}</li>`).join("") : "<li>Argumentos ainda não definidos.</li>"}</ul></article>
      <article class="reference-block" data-reference-card data-reference-title="Repertórios escolhidos" tabindex="0" role="button" aria-label="Ampliar repertórios escolhidos"><small>Repertórios escolhidos</small><ul>${repertoires.length ? repertoires.map((item) => `<li>${escapeHTML(item)}</li>`).join("") : "<li>Nenhum repertório selecionado.</li>"}</ul></article>
      <article class="reference-block" data-reference-card data-reference-title="Intervenção" tabindex="0" role="button" aria-label="Ampliar intervenção"><small>Intervenção</small><p>${escapeHTML(Object.values(intervention).filter(Boolean).join(" · ") || "Intervenção ainda não esboçada.")}</p></article>`;
  };

  const showAllReferences = () => {
    $$('[data-reference-card]').forEach((card) => {
      card.classList.remove("is-hidden", "is-focused");
      card.setAttribute("tabindex", "0");
    });
    el.focusToolbar.classList.add("is-hidden");
    el.referenceHint.classList.remove("is-hidden");
    $(".reference-tabs").classList.remove("is-hidden");
  };

  const focusReferenceCard = (card) => {
    if (!card || card.classList.contains("is-focused")) return;
    const activeContent = card.closest("[data-reference-content]");
    activeContent.querySelectorAll("[data-reference-card]").forEach((item) => {
      const focused = item === card;
      item.classList.toggle("is-hidden", !focused);
      item.classList.toggle("is-focused", focused);
      item.setAttribute("tabindex", focused ? "-1" : "0");
    });
    el.focusTitle.textContent = card.dataset.referenceTitle || "Conteúdo ampliado";
    el.focusToolbar.classList.remove("is-hidden");
    el.referenceHint.classList.add("is-hidden");
    $(".reference-tabs").classList.add("is-hidden");
    card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    $("[data-reference-show-all]").focus();
  };

  const selectReferenceTab = (name) => {
    showAllReferences();
    $$('[data-reference-tab]').forEach((button) => {
      const active = button.dataset.referenceTab === name;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    $$('[data-reference-content]').forEach((panel) =>
      panel.classList.toggle("is-hidden", panel.dataset.referenceContent !== name),
    );
  };

  const openReference = (name) => {
    selectReferenceTab(name || "support");
    document.body.classList.remove("reference-minimized");
    updateReferenceToggle();
    document.body.classList.add("reference-open");
    el.panel.querySelector("[data-reference-tab].is-active")?.focus();
  };

  const closeReference = () => {
    document.body.classList.remove("reference-open");
  };

  const updateReferenceToggle = () => {
    const mobile = matchMedia("(max-width: 820px)").matches;
    if (mobile) document.body.classList.remove("reference-minimized");
    const minimized = document.body.classList.contains("reference-minimized");
    const icon = el.panelToggle.querySelector(".material-symbols-outlined");
    icon.textContent = mobile ? "close" : minimized ? "chevron_right" : "chevron_left";
    el.panelToggle.setAttribute(
      "aria-label",
      mobile ? "Fechar painel" : minimized ? "Abrir painel de apoio" : "Minimizar painel de apoio",
    );
    el.panelToggle.setAttribute("aria-expanded", String(!minimized && !mobile ? true : mobile));
  };

  const toggleReference = () => {
    if (matchMedia("(max-width: 820px)").matches) {
      closeReference();
      return;
    }
    document.body.classList.toggle("reference-minimized");
    updateReferenceToggle();
  };

  const handleParagraphShortcut = (event) => {
    const position = el.text.selectionStart;
    const lineStart = el.text.value.lastIndexOf("\n", position - 1) + 1;
    const atLineStart = !el.text.value.slice(lineStart, position).trim();
    if (
      (event.key === "Tab" && atLineStart) ||
      (event.key === "Enter" && event.shiftKey)
    ) {
      event.preventDefault();
      const previousText = el.text.value;
      el.text.setRangeText("\n    ", position, el.text.selectionEnd, "end");
      if (measureLineCount() > 30) {
        el.text.value = previousText;
        el.text.setSelectionRange(position, position);
        el.lineFeedback.classList.add("is-error");
        el.lineFeedback.textContent =
          "Limite de 30 linhas atingido. Revise o texto antes de continuar.";
        return;
      }
      state.lastValidText = el.text.value;
      updateStats();
      scheduleSave({ immediate: true });
    }
  };

  const loadWritingData = async () => {
    if (!api()?.configured) throw new Error("O Supabase não está configurado.");
    let essay = null;
    if (state.essayId) essay = await api().getStudentEssay(state.essayId);
    if (essay) {
      state.themeCode = essay.tema_codigo || state.themeCode;
      state.planning =
        essay.planejamentos_redacao ||
        (await api().getEssayPlanning(state.themeCode));
      state.proposal = essay.proposta_id
        ? await api().getWritingPrompt(essay.proposta_id)
        : essay.propostas_redacao;
      el.title.value = essay.titulo === "Redação sem título" ? "" : essay.titulo || "";
      el.text.value = essay.texto || "";
    } else {
      if (!state.themeCode) throw new Error("Escolha um tema antes de escrever.");
      const proposalId = state.themeCode.startsWith("db:")
        ? state.themeCode.slice(3)
        : null;
      const [proposal, planning, draft] = await Promise.all([
        proposalId ? api().getWritingPrompt(proposalId) : null,
        api().getEssayPlanning(state.themeCode),
        api().getEssayDraft(state.themeCode),
      ]);
      state.proposal = proposal;
      state.planning = planning;
      if (draft) {
        state.essayId = draft.id;
        el.title.value = draft.titulo === "Redação sem título" ? "" : draft.titulo || "";
        el.text.value = draft.texto || "";
      }
    }
    el.themeTitle.textContent =
      state.proposal?.titulo || "Redação em desenvolvimento";
    state.lastPersisted = snapshot();
    state.lastValidText = el.text.value;
    state.previousWordCount = updateStats();
    renderSupport();
    renderPlanning();
    updateLinks();
    setSaveState(state.essayId ? "Rascunho recuperado" : "Pronto para escrever");
  };

  const review = async () => {
    const words = wordCount();
    if (words < 20) {
      el.feedback.textContent =
        "Escreva pelo menos 20 palavras antes de abrir a revisão.";
      el.text.focus();
      return;
    }
    el.feedback.textContent = "";
    state.dirty = state.dirty || snapshot() !== state.lastPersisted;
    try {
      await flushSave({ announce: true });
      location.href = `../revisao/index.html?redacao=${encodeURIComponent(state.essayId)}`;
    } catch {}
  };

  const bindEvents = () => {
    el.title.addEventListener("input", () => scheduleSave());
    el.text.addEventListener("input", (event) => {
      const nextLines = measureLineCount();
      const notReducingOverflow = nextLines >= state.currentLines;
      if (nextLines > 30 && notReducingOverflow) {
        const attemptedPosition = el.text.selectionStart;
        el.text.value = state.lastValidText;
        const restoredPosition = Math.min(attemptedPosition - 1, el.text.value.length);
        el.text.setSelectionRange(restoredPosition, restoredPosition);
        updateStats();
        el.lineFeedback.classList.add("is-error");
        el.lineFeedback.textContent =
          "Limite de 30 linhas atingido. Revise o texto antes de continuar.";
        return;
      }
      state.lastValidText = el.text.value;
      const words = updateStats();
      const completedWord =
        words > state.previousWordCount ||
        /[\s.,;:!?)]/.test(event.data || "");
      state.previousWordCount = words;
      scheduleSave({ immediate: completedWord });
    });
    el.text.addEventListener("keydown", handleParagraphShortcut);
    $("[data-save-now]").addEventListener("click", () => {
      state.dirty = state.dirty || snapshot() !== state.lastPersisted;
      flushSave({ announce: true }).catch(() => {});
    });
    el.retry.addEventListener("click", () => {
      state.saveFailed = false;
      flushSave({ announce: true }).catch(() => {});
    });
    $$('[data-reference-tab]').forEach((button) =>
      button.addEventListener("click", () =>
        selectReferenceTab(button.dataset.referenceTab),
      ),
    );
    el.panel.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      focusReferenceCard(event.target.closest("[data-reference-card]"));
    });
    el.panel.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      if (event.target.closest("a, button")) return;
      const card = event.target.closest("[data-reference-card]");
      if (!card) return;
      event.preventDefault();
      focusReferenceCard(card);
    });
    $("[data-reference-show-all]").addEventListener("click", showAllReferences);
    el.panelToggle.addEventListener("click", toggleReference);
    $$('[data-open-reference]').forEach((button) =>
      button.addEventListener("click", () =>
        openReference(button.dataset.openReference),
      ),
    );
    $$('[data-close-reference]').forEach((button) =>
      button.addEventListener("click", closeReference),
    );
    $$('[data-review]').forEach((button) =>
      button.addEventListener("click", review),
    );
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeReference();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        state.dirty = state.dirty || snapshot() !== state.lastPersisted;
        flushSave({ announce: true }).catch(() => {});
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && state.dirty)
        flushSave().catch(() => {});
    });
    window.addEventListener("resize", () => {
      updateReferenceToggle();
      updateLineState();
    });

    if (window.visualViewport) {
      const syncVirtualKeyboard = () => {
        const keyboardHeight = Math.max(
          0,
          window.innerHeight - window.visualViewport.height,
        );
        document.body.classList.toggle("keyboard-open", keyboardHeight > 140);
        document.documentElement.style.setProperty(
          "--keyboard-height",
          `${keyboardHeight}px`,
        );
      };
      window.visualViewport.addEventListener("resize", syncVirtualKeyboard);
      window.visualViewport.addEventListener("scroll", syncVirtualKeyboard);
      syncVirtualKeyboard();
    }
  };

  const init = async () => {
    renderLineNumbers();
    updateReferenceToggle();
    bindEvents();
    try {
      await loadWritingData();
      el.app.setAttribute("aria-busy", "false");
      el.loading.remove();
      el.text.focus();
    } catch (error) {
      el.loading.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">error</span><strong>Não foi possível abrir a sala de escrita</strong><small>${escapeHTML(error.message)}</small><a class="exit-focus" href="../index.html">Voltar ao laboratório</a>`;
    }
  };

  window.addEventListener("DOMContentLoaded", init);
})();
