(() => {
  "use strict";

  const api = () => window.OminiSaber;
  const subjectMeta = {
    matematica: { label: "Matemática", icon: "functions" },
    fisica: { label: "Física", icon: "experiment" },
    portugues: { label: "Português e Literatura", icon: "menu_book" },
    redacao: { label: "Redação", icon: "edit_note" },
    tecnico_administracao: { label: "Matérias Administrativas", icon: "business_center" },
    tecnico_informatica: { label: "Matérias de Informática", icon: "terminal" },
  };
  const baseSubjects = ["matematica", "fisica", "portugues", "redacao"];
  const elements = {
    loading: document.querySelector('[data-state="loading"]'),
    error: document.querySelector('[data-state="error"]'),
    errorMessage: document.querySelector("[data-error-message]"),
    content: document.querySelector("[data-map-content]"),
    select: document.querySelector("[data-subject-select]"),
    mapTitle: document.querySelector("[data-map-title]"),
    list: document.querySelector("[data-descriptor-list]"),
    detail: document.querySelector("[data-descriptor-detail]"),
    activities: document.querySelector("[data-related-activities]"),
    general: document.querySelector("[data-general-score]"),
    attention: document.querySelector("[data-attention-count]"),
    progress: document.querySelector("[data-progress-count]"),
    strong: document.querySelector("[data-strong-count]"),
  };
  let performance = [];
  let evaluations = [];
  let allowedSubjects = [];
  let currentSubject = "matematica";
  let currentFilter = "all";
  let selectedSkillId = null;

  const escapeHTML = (value = "") =>
    String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const latestAttempt = (item) => item.tentativas_avaliacao?.[0] || null;
  const isFinished = (attempt) => ["enviada", "corrigida"].includes(attempt?.status);
  const activityAccess = (item) =>
    api().getStudentEvaluationAvailability
      ? api().getStudentEvaluationAvailability(item)
      : { state: "available", actionable: true };

  const statusFor = (descriptor) => {
    const score = Number.isFinite(Number(descriptor.desempenho)) ? Math.round(Number(descriptor.desempenho)) : null;
    if (score === null) return { score, className: "neutral", label: "Sem evidência", icon: "pending" };
    if (score >= 80) return { score, className: "success", label: "Domínio forte", icon: "verified" };
    if (score >= 60) return { score, className: "warning", label: "Em evolução", icon: "trending_up" };
    return { score, className: "danger", label: "Precisa de atenção", icon: "priority_high" };
  };

  const showState = (state) => {
    elements.loading.classList.toggle("is-hidden", state !== "loading");
    elements.error.classList.toggle("is-hidden", state !== "error");
    elements.content.classList.toggle("is-hidden", state !== "ready");
  };

  const updateQuery = (code) => {
    const url = new URL(window.location.href);
    url.searchParams.set("materia", code);
    history.replaceState({}, "", url);
  };

  const descriptorHref = (descriptor) =>
    `../atividades/index.html?materia=${encodeURIComponent(currentSubject)}&habilidade=${encodeURIComponent(descriptor.habilidade_id || "")}`;

  const descriptorKey = (descriptor) =>
    String(descriptor.habilidade_id || descriptor.codigo || descriptor.descricao || "");

  const recommendationFor = (status) => {
    if (status.className === "danger") return "Comece por uma atividade curta e refaça as questões que geraram mais dúvida.";
    if (status.className === "warning") return "Você está perto do domínio. Uma nova prática ajuda a consolidar este conteúdo.";
    if (status.className === "success") return "Conteúdo consolidado. Revise quando quiser ou avance para outra prioridade.";
    return "Faça uma atividade ligada a esta matéria para gerar a primeira evidência.";
  };

  const renderDetail = (item) => {
    if (!item) {
      elements.detail.innerHTML = `<div class="detail-empty"><span class="material-symbols-outlined">touch_app</span><strong>Escolha um descritor</strong><p>Os detalhes aparecerão aqui sem tirar você do mapa.</p></div>`;
      return;
    }
    const status = statusFor(item);
    const score = status.score === null ? "—" : `${status.score}%`;
    const obtained = Number(item.pontos_obtidos || 0);
    const possible = Number(item.pontos_possiveis || 0);
    elements.detail.innerHTML = `<div class="detail-status ${status.className}"><span class="material-symbols-outlined">${status.icon}</span>${escapeHTML(status.label)}</div><p class="detail-code">${escapeHTML(item.codigo || "Descritor")}</p><h3>${escapeHTML(item.descricao || "Descrição não informada")}</h3><div class="detail-score"><strong>${score}</strong><span>aproveitamento nas correções</span></div><dl><div><dt>Evidências</dt><dd>${Number(item.evidencias || 0)}</dd></div><div><dt>Pontos</dt><dd>${obtained} de ${possible}</dd></div></dl><div class="recommendation"><span class="material-symbols-outlined">lightbulb</span><p><strong>Próximo passo</strong>${recommendationFor(status)}</p></div><a class="detail-action" href="${descriptorHref(item)}">Ver atividades <span class="material-symbols-outlined">arrow_forward</span></a>`;
  };

  const renderDescriptors = (statuses) => {
    const visible = statuses.filter((item) => currentFilter === "all" || item.className === currentFilter);
    if (!visible.length) {
      elements.list.innerHTML = `<div class="empty-list"><span class="material-symbols-outlined">filter_alt_off</span><strong>Nenhum descritor neste filtro</strong><p>Escolha outro estado para continuar explorando.</p></div>`;
      renderDetail(null);
      return;
    }
    if (!visible.some((item) => descriptorKey(item.descriptor) === selectedSkillId)) selectedSkillId = descriptorKey(visible[0].descriptor);
    elements.list.innerHTML = visible
      .map((item) => {
        const descriptor = item.descriptor;
        const selected = descriptorKey(descriptor) === selectedSkillId;
        const width = item.score === null ? 0 : Math.max(3, item.score);
        return `<button class="descriptor-row ${item.className}${selected ? " selected" : ""}" type="button" data-skill-id="${escapeHTML(descriptorKey(descriptor))}" aria-pressed="${selected}"><span class="row-status"><i></i><small>${escapeHTML(item.label)}</small></span><span class="row-copy"><strong>${escapeHTML(descriptor.codigo || "Descritor")}</strong><span>${escapeHTML(descriptor.descricao || "Descrição não informada")}</span><em><i style="width:${width}%"></i></em></span><span class="row-evidence"><b>${item.score === null ? "—" : `${item.score}%`}</b><small>${Number(descriptor.evidencias || 0)} evidência(s)</small></span><span class="material-symbols-outlined row-arrow">chevron_right</span></button>`;
      })
      .join("");
    renderDetail(visible.find((item) => descriptorKey(item.descriptor) === selectedSkillId)?.descriptor || visible[0].descriptor);
  };

  const renderActivities = () => {
    const items = evaluations.filter((item) => item.materia_codigo === currentSubject).slice(0, 3);
    if (!items.length) {
      elements.activities.innerHTML = `<div class="activity-empty"><span class="material-symbols-outlined">assignment</span><div><strong>Nenhuma atividade publicada nesta matéria</strong><p>Quando um professor publicar uma proposta, ela aparecerá aqui.</p></div></div>`;
      return;
    }
    elements.activities.innerHTML = items.map((item) => {
      const attempt = latestAttempt(item);
      const access = activityAccess(item);
      const done = isFinished(attempt);
      const status = done ? "Entregue" : attempt?.status === "em_andamento" ? "Em andamento" : access.state === "scheduled" ? "Agendada" : access.state === "expired" ? "Prazo encerrado" : "Pendente";
      const action = done ? "Ver resultado" : attempt ? "Continuar" : "Começar";
      const actionable = done || access.actionable;
      return `<article class="related-card"><div class="activity-card-top"><span class="activity-icon material-symbols-outlined">assignment</span><span class="activity-state${done ? " done" : ""}">${status}</span></div><h3>${escapeHTML(item.titulo)}</h3><p>${escapeHTML(item.instrucoes || "Confira as orientações do professor antes de começar.")}</p><div class="activity-meta"><span><i class="material-symbols-outlined">quiz</i>${item.questoes_avaliacao?.length || 0} questões</span><span><i class="material-symbols-outlined">schedule</i>${item.duracao_minutos || "—"} min</span></div>${actionable ? `<a href="../atividades/index.html?atividade=${encodeURIComponent(item.id)}">${action}<span class="material-symbols-outlined">arrow_forward</span></a>` : `<span class="activity-disabled">${status}</span>`}</article>`;
    }).join("");
  };

  const renderMap = (code) => {
    currentSubject = code;
    selectedSkillId = null;
    const descriptors = performance.filter((item) => item.materia_codigo === code);
    const order = { danger: 0, warning: 1, neutral: 2, success: 3 };
    const statuses = descriptors.map((descriptor) => ({ descriptor, ...statusFor(descriptor) })).sort((a, b) => order[a.className] - order[b.className] || (a.score ?? 101) - (b.score ?? 101));
    const possible = descriptors.reduce((sum, item) => sum + Number(item.pontos_possiveis || 0), 0);
    const obtained = descriptors.reduce((sum, item) => sum + Number(item.pontos_obtidos || 0), 0);
    const general = possible ? Math.round((obtained / possible) * 100) : null;
    elements.mapTitle.textContent = `Descritores de ${subjectMeta[code].label}`;
    elements.general.textContent = general === null ? "—" : `${general}%`;
    elements.attention.textContent = statuses.filter((item) => item.className === "danger").length;
    elements.progress.textContent = statuses.filter((item) => item.className === "warning").length;
    elements.strong.textContent = statuses.filter((item) => item.className === "success").length;
    updateQuery(code);
    renderDescriptors(statuses);
    renderActivities();
  };

  const currentStatuses = () => performance.filter((item) => item.materia_codigo === currentSubject).map((descriptor) => ({ descriptor, ...statusFor(descriptor) })).sort((a, b) => (a.score ?? 101) - (b.score ?? 101));

  document.querySelectorAll("[data-status-filter]").forEach((button) => button.addEventListener("click", () => {
    currentFilter = button.dataset.statusFilter;
    selectedSkillId = null;
    document.querySelectorAll("[data-status-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderDescriptors(currentStatuses());
  }));

  elements.list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-skill-id]");
    if (!button) return;
    selectedSkillId = button.dataset.skillId;
    renderDescriptors(currentStatuses());
  });

  const load = async () => {
    showState("loading");
    try {
      if (!api()?.configured) throw new Error("A conexão com o Supabase não está configurada.");
      const [profile, descriptorPerformance, studentEvaluations] = await Promise.all([
        api().getProfile(),
        api().getStudentDescriptorPerformance(),
        api().listStudentEvaluations(),
      ]);
      if (!profile?.curso_tecnico) throw new Error("Seu curso técnico ainda não foi definido pela escola.");
      allowedSubjects = [...baseSubjects, profile.curso_tecnico === "administracao" ? "tecnico_administracao" : "tecnico_informatica"];
      performance = descriptorPerformance;
      evaluations = studentEvaluations;
      elements.select.innerHTML = allowedSubjects.map((code) => `<option value="${code}">${escapeHTML(subjectMeta[code].label)}</option>`).join("");
      const requested = new URLSearchParams(window.location.search).get("materia");
      const initial = allowedSubjects.includes(requested) ? requested : allowedSubjects[0];
      elements.select.value = initial;
      renderMap(initial);
      showState("ready");
    } catch (error) {
      elements.errorMessage.textContent = error.message || "Tente novamente em alguns instantes.";
      showState("error");
    }
  };

  elements.select.addEventListener("change", (event) => {
    currentFilter = "all";
    document.querySelectorAll("[data-status-filter]").forEach((item) => item.classList.toggle("active", item.dataset.statusFilter === "all"));
    renderMap(event.target.value);
  });
  document.querySelector("[data-retry]")?.addEventListener("click", load);
  load();
})();
