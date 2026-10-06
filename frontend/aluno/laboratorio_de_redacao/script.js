(() => {
  const params = new URLSearchParams(location.search);
  const api = () => window.OminiSaber;
  const state = {
    step: 1,
    themes: [],
    selected: null,
    planning: null,
    essayId: params.get("redacao"),
    repertoires: [],
    selectedRepertoires: new Set(),
    themeFilter: "todos",
    repertoireFilter: "todos",
    savingPlan: false,
    savingDraft: false,
    writingMode: "guided",
    mapBlock: "thesis",
    mapReady: false,
  };
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const el = {
    panels: $$("[data-step]"),
    steps: $$("[data-step-target]"),
    pinned: $("[data-pinned-grid]"),
    grid: $("[data-theme-grid]"),
    total: $("[data-theme-total]"),
    search: $("[data-theme-search]"),
    selected: $("[data-selected-theme]"),
    notes: $("[data-planning-notes]"),
    thesis: $("[data-planning-thesis]"),
    arguments: $$("[data-argument]"),
    interventions: $$("[data-intervention]"),
    planStatus: $("[data-planning-status]"),
    repertoireGrid: $("[data-repertoire-grid]"),
    repertoireCount: $("[data-repertoire-count]"),
    title: $("[data-official-title]"),
    text: $("[data-official-text]"),
    draftStatus: $("[data-draft-status]"),
    notesContent: $("[data-notes-content]"),
    writingTheme: $("[data-writing-theme]"),
    feedback: $("[data-feedback]"),
    dialog: $("[data-theme-dialog]"),
    dialogContent: $("[data-theme-dialog-content]"),
    modeDialog: $("[data-writing-mode-dialog]"),
    mapMount: $("[data-essay-map]"),
    mapProgressLabel: $("[data-map-progress-label]"),
    mapProgressBar: $("[data-map-progress-bar]"),
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
  const slug = (value = "") =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const safeUrl = (value = "") => {
    try {
      const url = new URL(value, location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };
  const categoryIcon = {
    sociedade: "groups",
    tecnologia: "devices",
    "meio-ambiente": "eco",
    educacao: "school",
    saude: "health_and_safety",
    cultura: "theater_comedy",
  };
  const categoryClass = {
    tecnologia: "theme-tech",
    "meio-ambiente": "theme-nature",
    sociedade: "theme-society",
    educacao: "theme-education",
    saude: "theme-health",
    cultura: "theme-culture",
  };
  const repertoireLabels = {
    cultural: "Cultural",
    estatistico: "Estatístico",
    historico: "Histórico",
    cientifico: "Científico",
    legal: "Legal",
    literario: "Literário",
  };
  const notify = (message, type = "") => {
    el.feedback.textContent = message;
    el.feedback.className = `feedback${type ? ` is-${type}` : ""}`;
  };
  const setPill = (node, message, mode = "") => {
    node.className = `save-pill${mode ? ` is-${mode}` : ""}`;
    node.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${mode === "saving" ? "sync" : mode === "error" ? "cloud_off" : "cloud_done"}</span>${escapeHTML(message)}`;
  };
  const themeFromDb = (prompt) => ({
    id: `db:${prompt.id}`,
    proposalId: prompt.id,
    title: prompt.titulo,
    category: slug(prompt.categoria || "sociedade"),
    categoryLabel: prompt.categoria || "Sociedade",
    axis: prompt.eixo_tematico || prompt.categoria || "Tema contemporâneo",
    difficulty: prompt.dificuldade || "intermediaria",
    estimatedMinutes: prompt.tempo_estimado_min || 90,
    summary: prompt.resumo || prompt.comando,
    command: prompt.comando,
    keywords: prompt.palavras_chave || [],
    motivators: (prompt.textos_motivadores || []).map((item, index) =>
      typeof item === "string"
        ? { title: `Texto ${index + 1}`, text: item }
        : {
            title: item.titulo || `Texto ${index + 1}`,
            text: item.texto || item.conteudo || "",
          },
    ),
    materials: prompt.materiais_redacao || [],
    details: prompt.detalhes || {},
    pinned: prompt.fixada,
    deadline: prompt.prazo,
    source: "supabase",
    repertoires: [],
  });
  const renderThemeCard = (theme) =>
    `<article class="theme-card" data-theme-card="${escapeHTML(theme.id)}" data-category="${escapeHTML(theme.category)}"><div class="theme-card-top ${categoryClass[theme.category] || "theme-society"}"><span class="theme-badge">${escapeHTML(theme.categoryLabel)}</span><span class="material-symbols-outlined" aria-hidden="true">${categoryIcon[theme.category] || "edit_note"}</span></div><div class="theme-card-body"><span class="source-label"><span class="material-symbols-outlined" aria-hidden="true">database</span>Professora</span><h3>${escapeHTML(theme.title)}</h3><p>${escapeHTML(theme.summary)}</p><div class="theme-meta"><span><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${Number(theme.estimatedMinutes)} min</span><span><span class="material-symbols-outlined" aria-hidden="true">signal_cellular_alt</span>${escapeHTML(theme.difficulty)}</span><span><span class="material-symbols-outlined" aria-hidden="true">article</span>${(theme.motivators || []).length + (theme.materials || []).length} materiais</span></div><div class="theme-card-actions"><button class="button button-primary" type="button" data-select-theme="${escapeHTML(theme.id)}">Escolher tema<span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button><button class="details-button" type="button" data-open-theme="${escapeHTML(theme.id)}" aria-label="Ver detalhes de ${escapeHTML(theme.title)}"><span class="material-symbols-outlined" aria-hidden="true">info</span></button></div></div></article>`;
  const renderThemes = () => {
    const query = el.search.value.trim().toLowerCase();
    const filtered = state.themes.filter(
      (theme) =>
        (state.themeFilter === "todos" ||
          theme.category === state.themeFilter) &&
        (!query ||
          `${theme.title} ${theme.summary} ${theme.axis} ${(theme.keywords || []).join(" ")}`
            .toLowerCase()
            .includes(query)),
    );
    el.grid.innerHTML = filtered.length
      ? filtered.map(renderThemeCard).join("")
      : '<p class="empty-inline"><span class="material-symbols-outlined">search_off</span>Nenhum tema encontrado. Tente outro filtro ou termo.</p>';
    el.total.textContent = `${filtered.length} ${filtered.length === 1 ? "tema" : "temas"}`;
  };
  const renderPinned = () => {
    const pinnedThemes = state.themes.filter((theme) => theme.pinned);
    const pinnedMaterials = state.themes.flatMap((theme) =>
      (theme.materials || [])
        .filter((item) => item.fixado)
        .map((item) => ({ theme, item })),
    );
    const cards = [
      ...pinnedThemes.map(
        (theme) =>
          `<article class="pinned-card"><span class="material-symbols-outlined" aria-hidden="true">assignment</span><div><h4>${escapeHTML(theme.title)}</h4><p>Proposta fixada · ${escapeHTML(theme.categoryLabel)}</p></div><button type="button" data-open-theme="${escapeHTML(theme.id)}" aria-label="Abrir proposta fixada"><span class="material-symbols-outlined">arrow_forward</span></button></article>`,
      ),
      ...pinnedMaterials.map(
        ({ theme, item }) =>
          `<article class="pinned-card"><span class="material-symbols-outlined" aria-hidden="true">article</span><div><h4>${escapeHTML(item.titulo)}</h4><p>${escapeHTML(item.tipo.replaceAll("_", " "))} · ${escapeHTML(theme.title)}</p></div><button type="button" data-open-theme="${escapeHTML(theme.id)}" aria-label="Abrir texto fixado"><span class="material-symbols-outlined">arrow_forward</span></button></article>`,
      ),
    ];
    el.pinned.innerHTML = cards.length
      ? cards.join("")
      : '<p class="empty-inline"><span class="material-symbols-outlined">keep_off</span>Nenhum texto ou proposta foi fixado pela professora para sua turma.</p>';
  };
  const openDetails = (theme) => {
    const materials = [
      ...(theme.motivators || []).map((item) => ({
        titulo: item.title,
        conteudo: item.text,
      })),
      ...(theme.materials || []),
    ];
    el.dialogContent.innerHTML = `<header class="dialog-hero"><p class="eyebrow">${escapeHTML(theme.categoryLabel)} · ${escapeHTML(theme.axis)}</p><h2 id="theme-dialog-title">${escapeHTML(theme.title)}</h2><p>${escapeHTML(theme.summary)}</p></header><div class="dialog-body"><div class="dialog-facts"><div><span>Dificuldade</span><strong>${escapeHTML(theme.difficulty)}</strong></div><div><span>Tempo sugerido</span><strong>${Number(theme.estimatedMinutes)} min</strong></div><div><span>Materiais</span><strong>${materials.length}</strong></div><div><span>Origem</span><strong>Professora</strong></div></div><section class="dialog-command"><h3>Comando da proposta</h3><p>${escapeHTML(theme.command)}</p></section><section class="dialog-materials"><h3>Textos e materiais</h3>${
      materials.length
        ? materials
            .map((item) => {
              const url = safeUrl(item.url);
              return `<article class="dialog-material"><strong>${escapeHTML(item.titulo || "Material")}</strong>${item.autoria || item.fonte ? `<small>${escapeHTML([item.autoria, item.fonte].filter(Boolean).join(" · "))}</small>` : ""}<p>${escapeHTML(item.conteudo || "")}</p>${url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Abrir fonte</a>` : ""}</article>`;
            })
            .join("")
        : '<p class="empty-inline">A professora ainda não adicionou materiais complementares.</p>'
    }</section><div class="dialog-actions"><button class="button button-primary" type="button" data-select-theme="${escapeHTML(theme.id)}">Usar esta proposta<span class="material-symbols-outlined">arrow_forward</span></button></div></div>`;
    el.dialog.showModal();
  };
  const mapDefinitions = [
    { id: "theme", number: 1, icon: "topic", label: "Tema", helper: "Entenda o problema" },
    { id: "thesis", number: 2, icon: "lightbulb", label: "Tese", helper: "Sua posição" },
    { id: "argument-1", number: 3, icon: "forum", label: "Argumento 1", helper: "Primeiro ponto" },
    { id: "repertoire", number: 4, icon: "menu_book", label: "Repertório", helper: "Dados e referências" },
    { id: "argument-2", number: 5, icon: "forum", label: "Argumento 2", helper: "Segundo ponto" },
    { id: "intervention", number: 6, icon: "construction", label: "Intervenção", helper: "Solução proposta" },
  ];
  const mapCompletion = () => ({
    theme: Boolean(state.selected),
    thesis: Boolean(el.thesis.value.trim()),
    "argument-1": Boolean(el.arguments[0]?.value.trim()),
    repertoire: state.selectedRepertoires.size > 0,
    "argument-2": Boolean(el.arguments[1]?.value.trim()),
    intervention: el.interventions.filter((field) => field.value.trim()).length >= 4,
  });
  const selectMapBlock = (id, { focus = false } = {}) => {
    if (!mapDefinitions.some((item) => item.id === id)) return;
    state.mapBlock = id;
    $$('[data-writing-block]').forEach((node) => {
      const active = node.dataset.writingBlock === id;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-selected", String(active));
      node.tabIndex = active ? 0 : -1;
      if (active && focus) node.focus();
    });
    $$('[data-map-panel]').forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.mapPanel === id);
    });
  };
  const renderMapProgress = () => {
    if (!state.mapReady) return;
    const completed = mapCompletion();
    const count = Object.values(completed).filter(Boolean).length;
    if (el.mapProgressLabel) el.mapProgressLabel.textContent = `${count} de 6`;
    if (el.mapProgressBar) el.mapProgressBar.style.width = `${(count / 6) * 100}%`;
    $$('[data-writing-block]').forEach((node) => {
      const done = completed[node.dataset.writingBlock];
      node.classList.toggle("is-complete", done);
      const badge = node.querySelector(".map-node-number");
      if (badge) badge.textContent = done ? "check" : node.dataset.mapNumber;
      badge?.classList.toggle("material-symbols-outlined", done);
    });
  };
  const panelHeader = (number, icon, title, description) => `
    <header class="map-editor-head"><span class="map-editor-icon material-symbols-outlined" aria-hidden="true">${icon}</span><div><small>ETAPA ${number} DE 6</small><h3>${title}</h3><p>${description}</p></div></header>`;
  const nextButton = (target, label = "Salvar e seguir") => {
    const button = document.createElement("button");
    button.className = "button button-primary map-next";
    button.type = "button";
    button.dataset.mapNext = target;
    button.innerHTML = `${label}<span class="material-symbols-outlined" aria-hidden="true">${target === "writing" ? "edit_document" : "arrow_forward"}</span>`;
    return button;
  };
  const createMapPanel = (id, html) => {
    const panel = document.createElement("article");
    panel.className = `map-editor-panel${id === state.mapBlock ? " is-active" : ""}`;
    panel.dataset.mapPanel = id;
    panel.innerHTML = html;
    return panel;
  };
  const buildMapExperience = () => {
    if (state.mapReady || !el.mapMount) return;
    const nodes = mapDefinitions.map((item, index) => `${index ? '<span class="map-connector material-symbols-outlined" aria-hidden="true">arrow_forward</span>' : ""}<button class="essay-map-node${item.id === state.mapBlock ? " is-active" : ""}" type="button" role="tab" aria-selected="${item.id === state.mapBlock}" tabindex="${item.id === state.mapBlock ? 0 : -1}" data-writing-block="${item.id}" data-map-number="${item.number}"><span class="map-node-number">${item.number}</span><i class="material-symbols-outlined" aria-hidden="true">${item.icon}</i><strong>${item.label}</strong><small>${item.helper}</small></button>`).join("");
    el.mapMount.innerHTML = `<div class="essay-map-workspace"><section class="essay-map-canvas"><div class="essay-map-track" role="tablist" aria-label="Etapas do mapa da redação" data-map-track>${nodes}</div><aside class="map-tip"><span class="material-symbols-outlined" aria-hidden="true">keyboard</span><p><strong>Navegue também pelo teclado.</strong> Use as setas para avançar entre os blocos e Enter para editar.</p></aside></section><section class="map-editor" data-map-editor aria-live="polite"></section></div>`;
    const editor = $("[data-map-editor]");

    const themePanel = createMapPanel("theme", `${panelHeader(1, "topic", "Compreensão do tema", "Registre ideias, dúvidas e conexões antes de definir sua posição.")}<div class="map-question"><strong>O que você entendeu do problema?</strong><p>Anote causas, consequências, conceitos importantes e perguntas.</p></div><label class="map-field-label" for="planning-notes">Suas anotações</label>`);
    themePanel.append(el.notes);
    const notesFooter = document.createElement("div");
    notesFooter.className = "planning-footer";
    notesFooter.innerHTML = '<span data-planning-count-map>0 caracteres</span><span>Salvo na sua conta</span>';
    themePanel.append(notesFooter, nextButton("thesis"));

    const thesisPanel = createMapPanel("thesis", `${panelHeader(2, "lightbulb", "Tese", "Defina, em uma frase, a posição que será defendida.")}<div class="map-question"><strong>Qual é a sua posição sobre o tema?</strong><p>Responda diretamente ao problema apresentado pela proposta.</p></div><label class="map-field-label" for="planning-thesis">Sua resposta</label>`);
    thesisPanel.append(el.thesis);
    thesisPanel.insertAdjacentHTML("beforeend", '<details class="map-example"><summary><span class="material-symbols-outlined" aria-hidden="true">menu_book</span>Exemplo opcional</summary><p>Uma tese clara apresenta uma posição e antecipa os dois aspectos que serão desenvolvidos.</p></details>');
    thesisPanel.append(nextButton("argument-1"));

    const argumentOne = createMapPanel("argument-1", `${panelHeader(3, "forum", "Argumento 1", "Apresente a primeira razão que sustenta sua tese.")}<div class="map-question"><strong>Qual causa ou aspecto deve ser analisado primeiro?</strong><p>Acrescente uma explicação verificável; não repita apenas a tese.</p></div><label class="map-field-label">Primeiro argumento</label>`);
    argumentOne.append(el.arguments[0], nextButton("repertoire"));

    const repertoire = createMapPanel("repertoire", `${panelHeader(4, "menu_book", "Repertório produtivo", "Escolha uma referência que realmente ajude a explicar seu argumento.")}`);
    repertoire.classList.add("map-editor-panel-wide");
    repertoire.append($(".repertoire-lab"), nextButton("argument-2"));

    const argumentTwo = createMapPanel("argument-2", `${panelHeader(5, "forum", "Argumento 2", "Aprofunde a discussão com outro aspecto relevante.")}<div class="map-question"><strong>Que consequência, contraponto ou nova perspectiva completa sua análise?</strong></div><label class="map-field-label">Segundo argumento</label>`);
    argumentTwo.append(el.arguments[1], nextButton("intervention"));

    const intervention = createMapPanel("intervention", `${panelHeader(6, "construction", "Proposta de intervenção", "Construa uma solução concreta, detalhada e respeitosa.")}`);
    intervention.append($(".intervention-builder"), nextButton("writing", "Montar meu texto"));

    editor.append(themePanel, thesisPanel, argumentOne, repertoire, argumentTwo, intervention);
    $("[data-step='2']")?.classList.add("map-ready");
    state.mapReady = true;
    selectMapBlock(state.mapBlock);
    renderMapProgress();
  };
  const openModeChoice = () => {
    if (!el.modeDialog?.showModal) return;
    el.modeDialog.showModal();
  };
  const setupParallaxCards = () => {
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
    $$('[data-parallax-card]').forEach((card) => {
      let frame = 0;
      let next = { x: 0, y: 0 };
      const paint = () => {
        frame = 0;
        card.style.setProperty("--tilt-x", `${next.y * -6}deg`);
        card.style.setProperty("--tilt-y", `${next.x * 6}deg`);
        card.style.setProperty("--light-x", `${50 + next.x * 28}%`);
        card.style.setProperty("--light-y", `${50 + next.y * 28}%`);
      };
      card.addEventListener("pointermove", (event) => {
        if (reduceMotion.matches || event.pointerType === "touch") return;
        const rect = card.getBoundingClientRect();
        next = { x: Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2)), y: Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2)) };
        if (!frame) frame = requestAnimationFrame(paint);
      });
      card.addEventListener("pointerleave", () => {
        next = { x: 0, y: 0 };
        if (!frame) frame = requestAnimationFrame(paint);
      });
    });
  };
  const currentPlanningPayload = () => ({
    themeCode: state.selected.id,
    proposalId: state.selected.proposalId || null,
    notes: el.notes.value,
    thesis: el.thesis.value,
    arguments: el.arguments.map((field) => field.value),
    intervention: Object.fromEntries(
      el.interventions.map((field) => [
        field.dataset.intervention,
        field.value,
      ]),
    ),
    repertoireIds: [...state.selectedRepertoires],
    contextualRepertoires: [],
  });
  const savePlanning = async ({ quiet = false } = {}) => {
    if (!state.selected || state.savingPlan) return state.planning;
    state.savingPlan = true;
    setPill(el.planStatus, "Salvando planejamento...", "saving");
    const payload = currentPlanningPayload();
    try {
      if (!api()?.configured)
        throw new Error("O Supabase não está configurado.");
      state.planning = await api().saveEssayPlanning(payload);
      setPill(el.planStatus, "Planejamento salvo");
      if (!quiet) notify("Seu planejamento foi salvo.", "success");
      return state.planning;
    } catch (error) {
      setPill(el.planStatus, "Falha ao salvar", "error");
      notify(
        error.message || "Não foi possível salvar o planejamento.",
        "error",
      );
      throw error;
    } finally {
      state.savingPlan = false;
    }
  };
  const debouncePlanning = () => {
    clearTimeout(debouncePlanning.timer);
    setPill(el.planStatus, "Alterações pendentes", "saving");
    debouncePlanning.timer = setTimeout(
      () => savePlanning({ quiet: true }).catch(() => {}),
      900,
    );
  };
  const renderRepertoires = () => {
    const visible = state.repertoires.filter(
      (item) =>
        state.repertoireFilter === "todos" ||
        item.category === state.repertoireFilter,
    );
    el.repertoireGrid.innerHTML = visible.length
      ? visible
          .map((item) => {
            const selected = state.selectedRepertoires.has(item.id);
            return `<article class="repertoire-card ${selected ? "is-selected" : ""}" data-repertoire-card="${escapeHTML(item.id)}"><header><span class="repertoire-type">${escapeHTML(repertoireLabels[item.category] || item.category)}</span><span class="material-symbols-outlined" aria-hidden="true">${selected ? "check_circle" : "add_circle"}</span></header><h4>${escapeHTML(item.title)}</h4><p>${escapeHTML(item.reference)}</p><p class="application"><strong>Como aplicar:</strong> ${escapeHTML(item.application)}</p><button type="button" data-toggle-repertoire="${escapeHTML(item.id)}">${selected ? "Remover do planejamento" : "Adicionar ao planejamento"}</button></article>`;
          })
          .join("")
      : '<p class="empty-inline"><span class="material-symbols-outlined">category</span>Nenhum repertório contextualizado nesta categoria.</p>';
    el.repertoireCount.textContent = `${state.selectedRepertoires.size} selecionado${state.selectedRepertoires.size === 1 ? "" : "s"}`;
    renderMapProgress();
  };
  const loadPlanning = async () => {
    let planning = null;
    let dbRepertoires = [];
    if (!api()?.configured) throw new Error("O Supabase não está configurado.");
    [planning, dbRepertoires] = await Promise.all([
      api().getEssayPlanning(state.selected.id),
      api().listWritingRepertoires({
        proposalId: state.selected.proposalId || null,
      }),
    ]);
    state.planning = planning;
    state.repertoires = [
      ...(state.selected.repertoires || []),
      ...dbRepertoires.map((item) => ({
        id: item.id,
        category: item.categoria,
        title: item.titulo,
        reference: item.referencia,
        application: item.aplicacao,
        sourceUrl: item.fonte_url,
      })),
    ];
    state.selectedRepertoires = new Set([
      ...(planning?.planejamento_repertorios || []).map(
        (item) => item.repertorio_id,
      ),
      ...(planning?.repertorios_contextuais || []).map((item) => item.codigo),
    ]);
    el.notes.value = planning?.anotacoes || "";
    el.thesis.value = planning?.tese || "";
    el.arguments.forEach((field, index) => {
      field.value = planning?.argumentos?.[index] || "";
    });
    el.interventions.forEach((field) => {
      field.value = planning?.intervencao?.[field.dataset.intervention] || "";
    });
    $("[data-planning-count]").textContent =
      `${el.notes.value.length} caracteres`;
    const mapCount = $("[data-planning-count-map]");
    if (mapCount) mapCount.textContent = `${el.notes.value.length} caracteres`;
    renderRepertoires();
    setPill(
      el.planStatus,
      planning ? "Planejamento recuperado" : "Pronto para planejar",
    );
  };
  const chooseTheme = async (id, { promptMode = true } = {}) => {
    const theme = state.themes.find((item) => item.id === id);
    if (!theme) return;
    state.selected = theme;
    el.dialog.open && el.dialog.close();
    el.selected.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">topic</span><span><small>${escapeHTML(theme.categoryLabel)} · ${escapeHTML(theme.axis)}</small>Tema selecionado: <strong>${escapeHTML(theme.title)}</strong></span>`;
    await setStep(2);
    renderMapProgress();
    if (promptMode) openModeChoice();
    loadPlanning()
      .then(renderMapProgress)
      .catch((error) => notify(error.message, "error"));
  };
  const renderNotesDrawer = () => {
    const selectedItems = state.repertoires.filter((item) =>
      state.selectedRepertoires.has(item.id),
    );
    const intervention = Object.fromEntries(
      el.interventions.map((field) => [
        field.dataset.intervention,
        field.value,
      ]),
    );
    el.notesContent.innerHTML = `<section><h3>Anotações</h3><p>${escapeHTML(el.notes.value || "Nenhuma anotação registrada.")}</p></section><section><h3>Tese</h3><p>${escapeHTML(el.thesis.value || "Tese ainda não definida.")}</p></section><section><h3>Argumentos</h3><ul>${el.arguments.map((field) => `<li>${escapeHTML(field.value || "Argumento ainda não definido.")}</li>`).join("")}</ul></section><section><h3>Repertórios escolhidos</h3><ul>${selectedItems.length ? selectedItems.map((item) => `<li>${escapeHTML(item.title)}</li>`).join("") : "<li>Nenhum repertório selecionado.</li>"}</ul></section><section><h3>Intervenção</h3><p>${escapeHTML(Object.values(intervention).filter(Boolean).join(" · ") || "Ainda não esboçada.")}</p></section>`;
  };
  const loadDraft = async () => {
    let draft = null;
    if (!api()?.configured) throw new Error("O Supabase não está configurado.");
    if (state.essayId) draft = await api().getStudentEssay(state.essayId);
    else draft = await api().getEssayDraft(state.selected.id);
    if (draft) {
      state.essayId = draft.id;
      el.title.value = draft.titulo || "";
      el.text.value = draft.texto || "";
    } else {
      el.title.value = "";
      el.text.value = "";
    }
    updateWritingStats();
  };
  const saveDraft = async ({ quiet = true } = {}) => {
    if (!state.selected || state.savingDraft) return;
    state.savingDraft = true;
    setPill(el.draftStatus, "Salvando rascunho...", "saving");
    const payload = {
      essayId: state.essayId,
      titulo: el.title.value.trim() || "Redação sem título",
      texto: el.text.value,
      themeCode: state.selected.id,
      proposalId: state.selected.proposalId || null,
      planningId: state.planning?.id || null,
    };
    try {
      if (!api()?.configured)
        throw new Error("O Supabase não está configurado.");
      const draft = await api().saveEssayDraft(payload);
      state.essayId = draft.id;
      const time = new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());
      setPill(el.draftStatus, `Salvo às ${time}`);
      $("[data-last-saved]").textContent = `Último salvamento: ${time}`;
      if (!quiet) notify("Rascunho salvo na sua conta.", "success");
    } catch (error) {
      setPill(el.draftStatus, "Falha ao salvar", "error");
      notify(
        "O Supabase não respondeu. O texto ainda não foi salvo; tente novamente.",
        "error",
      );
      throw error;
    } finally {
      state.savingDraft = false;
    }
  };
  const debounceDraft = () => {
    clearTimeout(debounceDraft.timer);
    setPill(el.draftStatus, "Alterações pendentes", "saving");
    debounceDraft.timer = setTimeout(() => saveDraft().catch(() => {}), 1000);
  };
  const updateWritingStats = () => {
    const text = el.text.value.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const paragraphs = text
      ? text.split(/\n\s*\n|\n(?=\s{4})/).filter((item) => item.trim()).length
      : 0;
    $("[data-word-count]").textContent = words;
    $("[data-paragraph-count]").textContent = paragraphs;
    $("[data-character-count]").textContent = el.text.value.length;
  };
  const prepareWriting = async () => {
    await savePlanning({ quiet: true });
    renderNotesDrawer();
    el.writingTheme.textContent = state.selected.title;
    await loadDraft();
  };
  const openWritingRoom = async () => {
    await savePlanning({ quiet: true });
    let draft = null;
    if (state.essayId) draft = await api().getStudentEssay(state.essayId);
    else draft = await api().getEssayDraft(state.selected.id);
    if (draft?.id) state.essayId = draft.id;
    const query = new URLSearchParams({ tema: state.selected.id });
    if (state.essayId) query.set("redacao", state.essayId);
    location.href = `escrita/index.html?${query}`;
  };
  const setStep = async (step) => {
    if (step > 1 && !state.selected)
      return notify("Escolha uma proposta antes de continuar.", "error");
    if (step === 3) {
      try {
        await openWritingRoom();
        return;
      } catch (error) {
        notify(
          error.message || "Não foi possível abrir a sala de escrita.",
          "error",
        );
        return;
      }
    }
    state.step = step;
    document.body.classList.toggle("redacao-map-mode", step === 2);
    el.panels.forEach((panel) =>
      panel.classList.toggle("is-hidden", Number(panel.dataset.step) !== step),
    );
    el.steps.forEach((button) => {
      const active = Number(button.dataset.stepTarget) === step;
      button.classList.toggle("is-active", active);
      active
        ? button.setAttribute("aria-current", "step")
        : button.removeAttribute("aria-current");
    });
    if (step === 3) el.text.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
    notify("");
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
      const insertion = "\n    ";
      el.text.setRangeText(insertion, position, el.text.selectionEnd, "end");
      updateWritingStats();
      debounceDraft();
      notify("Novo parágrafo iniciado.", "success");
    }
  };
  const openReview = async () => {
    if (!el.text.value.trim() || el.text.value.trim().split(/\s+/).length < 20)
      return notify(
        "Escreva pelo menos 20 palavras antes de abrir a revisão.",
        "error",
      );
    try {
      await saveDraft({ quiet: false });
      const query = new URLSearchParams({ redacao: state.essayId });
      location.href = `revisao/index.html?${query}`;
    } catch {}
  };
  const bindEvents = () => {
    el.search.addEventListener("input", renderThemes);
    $$("[data-theme-filter]").forEach((button) =>
      button.addEventListener("click", () => {
        state.themeFilter = button.dataset.themeFilter;
        $$("[data-theme-filter]").forEach((item) =>
          item.classList.toggle("is-active", item === button),
        );
        renderThemes();
      }),
    );
    document.addEventListener("click", (event) => {
      const open = event.target.closest("[data-open-theme]");
      if (open)
        openDetails(
          state.themes.find((item) => item.id === open.dataset.openTheme),
        );
      const select = event.target.closest("[data-select-theme]");
      if (select) chooseTheme(select.dataset.selectTheme);
      const toggle = event.target.closest("[data-toggle-repertoire]");
      if (toggle) {
        const id = toggle.dataset.toggleRepertoire;
        state.selectedRepertoires.has(id)
          ? state.selectedRepertoires.delete(id)
          : state.selectedRepertoires.add(id);
        renderRepertoires();
        debouncePlanning();
      }
      const block = event.target.closest("[data-writing-block]");
      if (block) selectMapBlock(block.dataset.writingBlock);
      const next = event.target.closest("[data-map-next]");
      if (next) {
        if (next.dataset.mapNext === "writing") setStep(3);
        else selectMapBlock(next.dataset.mapNext, { focus: true });
      }
      const mode = event.target.closest("[data-writing-mode]");
      if (mode) {
        state.writingMode = mode.dataset.writingMode;
        el.modeDialog?.close();
        mode.dataset.writingMode === "free" ? setStep(3) : setStep(2);
      }
      const switchMode = event.target.closest("[data-switch-mode]");
      if (switchMode) {
        state.writingMode = switchMode.dataset.switchMode;
        state.writingMode === "free" ? setStep(3) : setStep(2);
      }
    });
    $("[data-close-dialog]").addEventListener("click", () => el.dialog.close());
    el.dialog.addEventListener("click", (event) => {
      if (event.target === el.dialog) el.dialog.close();
    });
    el.steps.forEach((button) =>
      button.addEventListener("click", () =>
        setStep(Number(button.dataset.stepTarget)),
      ),
    );
    $$("[data-back-step]").forEach((button) =>
      button.addEventListener("click", () =>
        setStep(Number(button.dataset.backStep)),
      ),
    );
    $("[data-next-step]").addEventListener("click", () => setStep(3));
    [el.notes, el.thesis, ...el.arguments, ...el.interventions].forEach(
      (field) =>
        field.addEventListener("input", () => {
          $("[data-planning-count]").textContent =
            `${el.notes.value.length} caracteres`;
          const mapCount = $("[data-planning-count-map]");
          if (mapCount) mapCount.textContent = `${el.notes.value.length} caracteres`;
          renderMapProgress();
          debouncePlanning();
        }),
    );
    $$("[data-repertoire-filter]").forEach((button) =>
      button.addEventListener("click", () => {
        state.repertoireFilter = button.dataset.repertoireFilter;
        $$("[data-repertoire-filter]").forEach((item) =>
          item.classList.toggle("is-active", item === button),
        );
        renderRepertoires();
      }),
    );
    $("[data-toggle-notes]").addEventListener("click", (event) => {
      const collapsed = $("[data-writing-workspace]").classList.toggle(
        "notes-collapsed",
      );
      event.currentTarget.setAttribute("aria-expanded", String(!collapsed));
      event.currentTarget.setAttribute(
        "aria-label",
        collapsed
          ? "Expandir bloco de anotações"
          : "Minimizar bloco de anotações",
      );
      event.currentTarget.querySelector("span").textContent = collapsed
        ? "right_panel_open"
        : "left_panel_close";
    });
    [el.title, el.text].forEach((field) =>
      field.addEventListener("input", () => {
        updateWritingStats();
        debounceDraft();
      }),
    );
    el.text.addEventListener("keydown", handleParagraphShortcut);
    $("[data-open-review]").addEventListener("click", openReview);
    $("[data-map-track]")?.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const index = mapDefinitions.findIndex((item) => item.id === state.mapBlock);
      const nextIndex = event.key === "ArrowRight" ? Math.min(mapDefinitions.length - 1, index + 1) : Math.max(0, index - 1);
      selectMapBlock(mapDefinitions[nextIndex].id, { focus: true });
    });
    el.modeDialog?.addEventListener("cancel", (event) => event.preventDefault());
  };
  const restoreFromEssay = async () => {
    if (!state.essayId || !api()?.configured) return false;
    const essay = await api().getStudentEssay(state.essayId);
    if (!essay) return false;
    const theme =
      state.themes.find((item) => item.id === essay.tema_codigo) ||
      (essay.propostas_redacao
        ? themeFromDb({ ...essay.propostas_redacao, materiais_redacao: [] })
        : null);
    if (!theme) return false;
    state.selected = theme;
    state.planning = essay.planejamentos_redacao;
    el.title.value = essay.titulo;
    el.text.value = essay.texto;
    await chooseTheme(theme.id, { promptMode: false });
    await setStep(Number(params.get("step") || 3));
    return true;
  };
  const init = async () => {
    buildMapExperience();
    setupParallaxCards();
    bindEvents();
    renderThemes();
    renderPinned();
    if (!api()?.configured)
      return notify("O Supabase não está configurado.", "error");
    try {
      const prompts = await api().listWritingPrompts();
      state.themes = prompts.map(themeFromDb);
      renderPinned();
      renderThemes();
    } catch (error) {
      notify(
        `Os temas da professora não puderam ser carregados: ${error.message}`,
        "error",
      );
    }
    try {
      const profile = await api().getProfile();
      const initials = (profile?.nome || "Aluno")
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
      $$("[data-initials]").forEach((node) => {
        node.textContent = initials;
      });
    } catch {}
    if (await restoreFromEssay().catch(() => false)) return;
    const requestedTheme = params.get("tema");
    if (
      requestedTheme &&
      state.themes.some((item) => item.id === requestedTheme)
    )
      await chooseTheme(requestedTheme);
  };
  window.addEventListener("DOMContentLoaded", init);
})();
