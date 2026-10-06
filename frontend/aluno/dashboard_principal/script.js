(() => {
  "use strict";
  const api = () => window.OminiSaber;
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    loading: $('[data-state="loading"]'),
    error: $('[data-state="error"]'),
    errorMessage: $("[data-error-message]"),
    dashboard: $("[data-dashboard]"),
    next: $("[data-next-step]"),
    chips: $("[data-subject-chips]"),
    select: $("[data-subject-filter]"),
    context: $("[data-filter-context]"),
    clear: $("[data-clear-subject-filter]"),
    destinations: $("[data-destination-grid]"),
    days: $("[data-weekly-days]"),
    total: $("[data-weekly-total]"),
    toast: $("[data-toast]"),
    notifications: $("[data-notification-toggle]"),
  };
  const subjectMeta = {
    matematica: { label: "Matemática", icon: "functions" },
    portugues: { label: "Português", icon: "menu_book" },
    fisica: { label: "Física", icon: "experiment" },
    redacao: { label: "Redação", icon: "edit_note" },
    tecnico_administracao: { label: "Administração", icon: "business_center" },
    tecnico_informatica: { label: "Informática", icon: "terminal" },
  };
  const baseSubjects = ["matematica", "portugues", "fisica", "redacao"];
  const destinations = [
    { key: "avaliacoes", label: "Atividades e avaliações", icon: "assignment_turned_in", tone: "coral", description: "Explore atividades interativas, provas e devolutivas.", href: "../atividades/index.html", query: { view: "evaluations" }, priority: true },
    { key: "trilhas", label: "Trilhas de aprendizagem", icon: "route", tone: "amber", description: "Siga rotas personalizadas para aprender no seu ritmo.", href: "../modulo_de_trilhas/index.html", priority: true },
    { key: "materias", label: "Matérias", icon: "school", tone: "green", description: "Explore os conteúdos das suas disciplinas.", href: "../modulo_de_trilhas/index.html", generic: true, priority: true },
    { key: "exercicios", label: "Exercícios", icon: "calculate", tone: "blue", description: "Pratique com listas e atividades.", href: "../atividades/index.html", query: { tipo: "exercicio" } },
    { key: "biblioteca", label: "Biblioteca", icon: "menu_book", tone: "violet", description: "Acesse livros, artigos e materiais de apoio.", href: "../biblioteca_digital/index.html" },
    { key: "agenda", label: "Agenda", icon: "calendar_month", tone: "green", description: "Veja seus compromissos e não perca prazos.", href: "../agenda/index.html", generic: true },
    { key: "forum", label: "Fórum", icon: "groups", tone: "blue", description: "Organize suas dúvidas e encontre suporte.", href: "../ajuda-suporte/index.html", query: { origem: "forum" } },
    { key: "sites", label: "Sites úteis", icon: "open_in_new", tone: "coral", description: "Consulte links e recursos recomendados.", href: "../biblioteca_digital/index.html", query: { mode: "digital" } },
  ];
  let data;
  let subjects = [];
  let activeSubject = "all";
  let unsubscribeRealtime;
  let loading = false;
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const normalizeSubject = (item = {}) => {
    if (item.materia_codigo && subjectMeta[item.materia_codigo]) return item.materia_codigo;
    const value = String(item.materia || "").toLocaleLowerCase("pt-BR");
    if (/redaç|redac/.test(value)) return "redacao";
    if (/portugu|literat|linguag/.test(value)) return "portugues";
    if (/físic|fisic/.test(value)) return "fisica";
    if (/matem|álgebr|algebr|geometr|estat/.test(value)) return "matematica";
    if (/admin|gest|empreend|marketing|finan/.test(value)) return "tecnico_administracao";
    if (/inform|program|tecnolog|banco de dados|redes/.test(value)) return "tecnico_informatica";
    return "";
  };
  const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AL";
  const currentSubject = () => subjects.find((item) => item.code === activeSubject) || null;
  const latest = (evaluation) => evaluation.tentativas_avaliacao?.[0] || null;
  const finished = (evaluation) => ["enviada", "corrigida"].includes(latest(evaluation)?.status);
  const actionable = (evaluation) => api().getStudentEvaluationAvailability
    ? api().getStudentEvaluationAvailability(evaluation).actionable
    : (!evaluation.abre_em || new Date(evaluation.abre_em) <= new Date()) && (!evaluation.encerra_em || new Date(evaluation.encerra_em) >= new Date());
  const show = (state) => {
    ui.loading?.classList.toggle("is-hidden", state !== "loading");
    ui.error?.classList.toggle("is-hidden", state !== "error");
    ui.dashboard?.classList.toggle("is-hidden", state !== "ready");
  };
  const notify = (message) => {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.classList.add("visible");
    clearTimeout(ui.toast.timer);
    ui.toast.timer = setTimeout(() => ui.toast.classList.remove("visible"), 2800);
  };
  const hrefFor = (destination) => {
    const url = new URL(destination.href, location.href);
    Object.entries(destination.query || {}).forEach(([key, value]) => url.searchParams.set(key, value));
    if (activeSubject !== "all") url.searchParams.set("materia", activeSubject);
    return `${url.pathname}${url.search}${url.hash}`;
  };
  const destinationLabel = (destination) => {
    const subject = currentSubject();
    if (!subject || destination.generic) return destination.label;
    return destination.key === "trilhas" ? `Trilhas de ${subject.label}` : `${destination.label} de ${subject.label}`;
  };
  const destinationDescription = (destination) => {
    const subject = currentSubject();
    if (!subject || destination.generic) return destination.description;
    return ({
      avaliacoes: `Explore atividades, provas e devolutivas de ${subject.label}.`,
      biblioteca: `Acesse materiais de apoio de ${subject.label}.`,
      exercicios: `Pratique com listas e atividades de ${subject.label}.`,
      trilhas: `Siga rotas personalizadas de ${subject.label}.`,
      forum: `Organize suas dúvidas sobre ${subject.label}.`,
      sites: `Consulte recursos recomendados de ${subject.label}.`,
    })[destination.key] || destination.description;
  };
  const filteredPending = () => (data?.evaluations || []).filter((item) => actionable(item) && !finished(item) && (activeSubject === "all" || normalizeSubject(item) === activeSubject));
  const matchesSubject = (item) => activeSubject === "all" || normalizeSubject(item) === activeSubject;
  const evaluationState = (evaluation) => {
    if (finished(evaluation)) return "success";
    const availability = api().getStudentEvaluationAvailability
      ? api().getStudentEvaluationAvailability(evaluation)
      : { state: actionable(evaluation) ? "available" : "expired" };
    return availability.state === "expired" ? "danger" : "warning";
  };
  const trailState = (trail) => {
    const activities = trail.atividades || [];
    if (activities.length && activities.every((activity) => activity.progresso?.concluida)) return "success";
    if (trail.prazo && new Date(trail.prazo).getTime() < Date.now()) return "danger";
    return activities.some((activity) => !activity.progresso?.concluida) ? "warning" : "success";
  };
  const summarizeStates = (states) => {
    const counts = states.reduce((summary, state) => ({ ...summary, [state]: summary[state] + 1 }), { danger: 0, warning: 0, success: 0 });
    const state = counts.danger ? "danger" : counts.warning ? "warning" : "success";
    return { state, counts };
  };
  const destinationStatus = (key) => {
    const evaluations = (data?.evaluations || []).filter(matchesSubject);
    const trails = (data?.trails || []).filter(matchesSubject);
    if (key === "avaliacoes") {
      const summary = summarizeStates(evaluations.map(evaluationState));
      if (summary.state === "danger") return { ...summary, label: `${summary.counts.danger} fora do prazo` };
      if (summary.state === "warning") return { ...summary, label: `${summary.counts.warning} para fazer` };
      return data.studioUnavailable ? { ...summary, state: "warning", label: "Atualizar atividades" } : { ...summary, label: evaluations.length ? "Tudo concluído" : "Tudo em dia" };
    }
    if (key === "trilhas") {
      const summary = summarizeStates(trails.map(trailState));
      if (summary.state === "danger") return { ...summary, label: `${summary.counts.danger} atrasada${summary.counts.danger === 1 ? "" : "s"}` };
      if (summary.state === "warning") return { ...summary, label: `${summary.counts.warning} em andamento` };
      return { ...summary, label: trails.length ? "Trilhas concluídas" : "Tudo em dia" };
    }
    const summary = summarizeStates([...evaluations.map(evaluationState), ...trails.map(trailState)]);
    if (summary.state === "danger") return { ...summary, label: "Atenção aos prazos" };
    if (summary.state === "warning") return { ...summary, label: "Estudos em andamento" };
    return { ...summary, label: "Tudo em dia" };
  };
  const renderProfile = (profile) => {
    const name = profile.nome || "Aluno";
    $("[data-profile-name]")?.replaceChildren(name);
    $("[data-greeting]").textContent = `Olá, ${name.split(/\s+/)[0]}`;
    $("[data-initials]")?.replaceChildren(initials(name));
    const course = profile.curso_tecnico === "administracao" ? "Técnico em Administração" : "Técnico em Informática";
    $("[data-profile-context]")?.replaceChildren([profile.turmas?.serie ? `${profile.turmas.serie}º ano` : null, course].filter(Boolean).join(" · "));
    $("[data-current-date]").textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  };
  const renderNext = () => {
    const evaluations = filteredPending().sort((a, b) => (latest(a)?.status === "em_andamento" ? 0 : 1) - (latest(b)?.status === "em_andamento" ? 0 : 1) || (a.encerra_em ? new Date(a.encerra_em).getTime() : Infinity) - (b.encerra_em ? new Date(b.encerra_em).getTime() : Infinity));
    const evaluation = evaluations[0];
    if (evaluation) {
      const subject = subjectMeta[normalizeSubject(evaluation)] || { label: "Atividade", icon: "assignment" };
      const started = latest(evaluation)?.status === "em_andamento";
      const deadline = evaluation.encerra_em ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(evaluation.encerra_em)) : "Sem prazo";
      const count = evaluation.origemStudio ? Number(evaluation.total_etapas || 0) : evaluation.questoes_avaliacao?.length || 0;
      const saved = evaluation.origemStudio ? Number(evaluation.respostas_salvas || 0) : (latest(evaluation)?.respostas_avaliacao || []).filter(response => response.resposta !== null && response.resposta !== undefined && response.resposta !== "").length;
      const progress = started && count ? Math.min(100, Math.round(saved / count * 100)) : 0;
      const target = evaluation.origemStudio ? `../atividades/index.html?studio=${encodeURIComponent(evaluation.experiencia_id || evaluation.id)}` : `../atividades/index.html?atividade=${encodeURIComponent(evaluation.id)}`;
      ui.next.innerHTML = `<div class="lesson-summary"><p class="section-kicker">${started ? "Continue de onde parou" : evaluation.origemStudio ? "Explore no OmniStudio" : "Sua próxima atividade"}</p><div class="lesson-title-row"><span class="subject-icon material-symbols-outlined">${subject.icon}</span><div><h2 id="next-step-title">${esc(evaluation.titulo)}</h2><p>${esc(subject.label)} · ${evaluation.origemStudio ? "Atividade interativa" : esc(evaluation.categoria || "Atividade")}</p></div></div><div class="lesson-progress"><div class="progress-track" role="progressbar" aria-label="Etapas com resposta salva" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div><strong>${started ? `${progress}% com respostas salvas` : `${evaluations.length} atividade(s) aguardando você`}</strong></div></div><div class="lesson-meta"><span><span class="material-symbols-outlined">${evaluation.origemStudio ? "route" : "quiz"}</span>${count} ${evaluation.origemStudio ? "etapas" : "questão(ões)"}</span><span><span class="material-symbols-outlined">${evaluation.origemStudio ? "cloud_done" : "schedule"}</span>${evaluation.origemStudio ? "Salvamento automático" : `${Number(evaluation.duracao_minutos || 0) || "—"} min`}</span><span><span class="material-symbols-outlined">event</span>${esc(deadline)}</span><a class="button lesson-action" href="${target}">${started ? "Continuar atividade" : evaluation.origemStudio ? "Explorar atividade" : "Começar atividade"}<span class="material-symbols-outlined">arrow_forward</span></a></div>`;
      return;
    }
    const trail = (data.trails || []).filter((item) => activeSubject === "all" || normalizeSubject(item) === activeSubject).find((item) => (item.atividades || []).some((activity) => !activity.progresso?.concluida));
    const activity = trail?.atividades?.find((item) => !item.progresso?.concluida);
    if (trail && activity) {
      const subject = subjectMeta[normalizeSubject(trail)] || { label: trail.materia || "Conteúdo", icon: "school" };
      const total = trail.atividades.length;
      const done = trail.atividades.filter((item) => item.progresso?.concluida).length;
      const progress = total ? Math.round((done / total) * 100) : 0;
      ui.next.innerHTML = `<div class="lesson-summary"><p class="section-kicker">Continue de onde parou</p><div class="lesson-title-row"><span class="subject-icon material-symbols-outlined">${subject.icon}</span><div><h2 id="next-step-title">${esc(activity.titulo)}</h2><p>${esc(subject.label)} · ${esc(trail.titulo)}</p></div></div><div class="lesson-progress"><div class="progress-track" role="progressbar" aria-label="Progresso da trilha" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div><strong>${progress}% concluído</strong></div></div><div class="lesson-meta"><span><span class="material-symbols-outlined">schedule</span>${Number(activity.duracao_minutos || 0)} min</span><span><span class="material-symbols-outlined">school</span>${esc(subject.label)}</span><a class="button lesson-action" href="../modulo_de_trilhas/${["atividade", "quiz", "projeto"].includes(activity.tipo_conteudo) ? "atividade" : "aula"}/index.html?atividade=${encodeURIComponent(activity.id)}">Continuar aprendendo<span class="material-symbols-outlined">arrow_forward</span></a></div>`;
      return;
    }
    const subject = currentSubject();
    if (data.studioUnavailable) {
      ui.next.innerHTML = `<div class="lesson-summary"><p class="section-kicker">Atualização pendente</p><h2 id="next-step-title">Consulte suas atividades interativas</h2><p>Não conseguimos atualizar o OmniStudio agora. A Central de atividades permite tentar novamente.</p></div><div class="lesson-meta"><a class="button lesson-action" href="${hrefFor(destinations[0])}">Abrir atividades<span class="material-symbols-outlined">arrow_forward</span></a></div>`;
      return;
    }
    ui.next.innerHTML = `<div class="lesson-summary"><p class="section-kicker">Tudo em dia</p><h2 id="next-step-title">${subject ? `Nenhuma pendência de ${esc(subject.label)}` : "Nenhuma atividade pendente"}</h2><p>Você concluiu tudo o que está disponível neste filtro.</p></div><div class="lesson-meta"><span><span class="material-symbols-outlined">task_alt</span>Seu estudo está organizado</span><a class="button lesson-action" href="${hrefFor(destinations[0])}">Ver atividades<span class="material-symbols-outlined">arrow_forward</span></a></div>`;
  };
  const renderFilters = () => {
    const options = [{ code: "all", label: "Todas" }, ...subjects];
    ui.chips.innerHTML = options.map((item) => `<button type="button" class="subject-filter-chip ${item.code === activeSubject ? "active" : ""}" data-subject-filter-value="${item.code}" aria-pressed="${item.code === activeSubject}">${esc(item.label)}</button>`).join("");
    ui.select.innerHTML = options.map((item) => `<option value="${item.code}" ${item.code === activeSubject ? "selected" : ""}>${esc(item.label)}</option>`).join("");
    const subject = currentSubject();
    ui.context.innerHTML = subject ? `<span class="material-symbols-outlined" aria-hidden="true">filter_alt</span> Mostrando conteúdos de <strong>${esc(subject.label)}</strong>` : '<span class="material-symbols-outlined" aria-hidden="true">dashboard</span> Mostrando todas as matérias';
    ui.clear.hidden = activeSubject === "all";
    if (matchMedia("(max-width: 760px)").matches) {
      requestAnimationFrame(() => {
        ui.chips.querySelector(".subject-filter-chip.active")?.scrollIntoView({
          block: "nearest",
          inline: "center",
          behavior: "smooth",
        });
      });
    }
  };
  const renderDestinations = () => {
    ui.destinations.innerHTML = destinations.map((item) => {
      const status = item.priority ? destinationStatus(item.key) : null;
      const badge = status
        ? `<span class="destination-badge">${esc(status.label)}</span>`
        : item.key === "agenda" ? '<span class="destination-badge green">Ver hoje</span>' : "";
      return `<a class="destination-card ${item.priority ? `priority state-${status.state}` : ""} tone-${item.tone}" href="${hrefFor(item)}" data-destination="${item.key}"${status ? ` data-learning-state="${status.state}"` : ""}><span class="destination-icon material-symbols-outlined" aria-hidden="true">${item.icon}</span><span class="destination-copy"><strong>${esc(destinationLabel(item))}</strong><small>${esc(destinationDescription(item))}</small></span>${badge}<span class="destination-arrow material-symbols-outlined" aria-hidden="true">arrow_forward</span></a>`;
    }).join("");
    const agendaHref = hrefFor(destinations.find((item) => item.key === "agenda"));
    $("[data-today-agenda-link]")?.setAttribute("href", agendaHref);
    $("[data-agenda-shortcut]")?.setAttribute("href", agendaHref);
  };
  const renderWeek = () => {
    const days = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - offset));
      const key = date.toISOString().slice(0, 10);
      const count = (data.history || []).filter((item) => {
        const itemSubject = normalizeSubject(item);
        if (activeSubject !== "all" && itemSubject && itemSubject !== activeSubject) return false;
        return new Date(item.created_at).toISOString().slice(0, 10) === key;
      }).length;
      return { date, count, today: offset === 6 };
    });
    const total = days.reduce((sum, day) => sum + day.count, 0);
    ui.days.innerHTML = days.map((day) => `<li class="${day.count ? "done" : ""} ${day.today ? "today" : ""}"><span>${new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(day.date).replace(".", "")}</span><b>${day.count}</b></li>`).join("");
    ui.total.innerHTML = `<span class="ring-progress">${total}<small>registros</small></span><p><strong>${Number(data.xp || 0)} XP acumulados</strong><span>${currentSubject() ? `Filtrados em ${esc(currentSubject().label)}` : "Todas as matérias"}</span></p>`;
  };
  const renderNotifications = () => {
    const unread = (data.notifications || []).filter((item) => !item.readAt).length;
    ui.notifications?.querySelector(".notification-dot")?.remove();
    if (unread && ui.notifications) {
      const dot = document.createElement("span");
      dot.className = "notification-dot";
      dot.setAttribute("aria-hidden", "true");
      ui.notifications.append(dot);
    }
  };
  const applyFilter = (code, announce = true) => {
    if (code !== "all" && !subjects.some((item) => item.code === code)) return;
    activeSubject = code;
    try { localStorage.setItem("ominisaber:student-subject-filter", code); } catch {}
    const url = new URL(location.href);
    if (code === "all") url.searchParams.delete("materia");
    else url.searchParams.set("materia", code);
    history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    renderFilters();
    renderNext();
    renderDestinations();
    renderWeek();
    if (announce) notify(code === "all" ? "Exibindo todas as matérias." : `Filtro de ${subjectMeta[code].label} aplicado em toda a página.`);
  };
  const bind = () => {
    ui.chips.addEventListener("click", (event) => {
      const button = event.target.closest("[data-subject-filter-value]");
      if (button) applyFilter(button.dataset.subjectFilterValue);
    });
    ui.select.addEventListener("change", (event) => applyFilter(event.target.value));
    ui.clear.addEventListener("click", () => applyFilter("all"));
    ui.notifications?.addEventListener("click", () => { location.href = "../notificacoes/index.html"; });
    if (ui.notifications && !$("[data-agenda-shortcut]")) {
      const agenda = document.createElement("a");
      agenda.className = "icon-button";
      agenda.dataset.agendaShortcut = "true";
      agenda.href = hrefFor(destinations.find((item) => item.key === "agenda"));
      agenda.setAttribute("aria-label", "Abrir agenda");
      agenda.innerHTML = '<span class="material-symbols-outlined">calendar_month</span>';
      ui.notifications.before(agenda);
    }
    const dialog = $("[data-focus-dialog]");
    $("[data-focus-open]")?.addEventListener("click", () => dialog?.showModal());
    document.querySelectorAll("[data-focus-minutes]").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll("[data-focus-minutes]").forEach((item) => item.classList.toggle("selected", item === button));
      dialog.querySelector("h2").textContent = `${button.dataset.focusMinutes}:00`;
    }));
    dialog?.addEventListener("close", () => { if (dialog.returnValue === "start") notify("Sessão de foco iniciada."); });
    const menu = $("[data-menu-toggle]");
    menu?.addEventListener("click", () => {
      document.body.classList.toggle("menu-open");
      menu.setAttribute("aria-expanded", String(document.body.classList.contains("menu-open")));
    });
  };
  const load = async () => {
    if (loading) return;
    loading = true;
    show("loading");
    try {
      if (!api()?.configured) throw new Error("A conexão com o Supabase não está configurada.");
      const results = await Promise.allSettled([
        api().getStudentDashboard(),
        api().listStudentStudioExperiences ? api().listStudentStudioExperiences() : Promise.resolve([]),
      ]);
      if (results[0].status === "rejected") throw results[0].reason;
      data = results[0].value;
      data.studioUnavailable = results[1].status === "rejected";
      const studio = results[1].status === "fulfilled" ? results[1].value || [] : [];
      data.evaluations = [...(data.evaluations || []), ...studio.map(item => ({ ...item, origemStudio: true, tentativas_avaliacao: item.ultima_tentativa ? [item.ultima_tentativa] : [] }))];
      const profile = data.profile || {};
      const codes = [...baseSubjects, profile.curso_tecnico === "administracao" ? "tecnico_administracao" : "tecnico_informatica"];
      subjects = codes.map((code) => ({ code, ...subjectMeta[code] }));
      const requested = new URLSearchParams(location.search).get("materia");
      let saved = "";
      try { saved = localStorage.getItem("ominisaber:student-subject-filter") || ""; } catch {}
      const allowed = new Set(codes);
      activeSubject = allowed.has(requested) ? requested : allowed.has(saved) ? saved : "all";
      renderProfile(profile);
      renderFilters();
      renderNext();
      renderDestinations();
      renderNotifications();
      renderWeek();
      show("ready");
    } catch (error) {
      ui.errorMessage.textContent = error.message || "Tente novamente em alguns instantes.";
      show("error");
    } finally {
      loading = false;
    }
  };
  $("[data-retry]")?.addEventListener("click", load);
  bind();
  load();
  if (api()?.configured) unsubscribeRealtime = api().subscribeToAgenda(() => load());
  window.addEventListener("beforeunload", () => unsubscribeRealtime?.());
})();
