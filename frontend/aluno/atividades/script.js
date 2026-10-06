(() => {
  "use strict";

  const root = () => document.querySelector("[data-activity-root]");
  const api = () => window.OminiSaber;
  const esc = (value = "") =>
    String(value).replace(
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
  const rich = value => window.OminiResources?.richText(value) || esc(value);
  const labels = {
    matematica: "Matemática",
    portugues: "Português",
    fisica: "Física",
    quimica: "Química",
    biologia: "Biologia",
    tecnico_administracao: "Administração",
    tecnico_informatica: "Informática",
    atividade: "Atividade",
    avaliacao: "Avaliação",
    diagnostica: "Diagnóstica",
    recuperacao: "Recuperação",
  };
  const pageParams = new URLSearchParams(location.search);
  const subjectFilter = pageParams.get("materia") || "";
  const colors = {
    matematica: "var(--math)",
    portugues: "var(--portuguese)",
    fisica: "var(--physics)",
    quimica: "var(--chemistry)",
    biologia: "var(--biology)",
    tecnico_administracao: "var(--admin)",
    tecnico_informatica: "var(--tech)",
  };
  const notify = (message, type = "success") =>
    window.StudentShell?.notify(message, type);
  const date = (value) =>
    value
      ? new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(value))
      : "Sem prazo";
  const latest = (item) => item.tentativas_avaliacao?.[0] || null;
  const finished = (attempt) =>
    ["enviada", "corrigida"].includes(attempt?.status);
  const availability = (evaluation) =>
    api().getStudentEvaluationAvailability
      ? api().getStudentEvaluationAvailability(evaluation)
      : { state: "available", actionable: true };
  const status = (evaluation, attempt) => {
    if (finished(attempt))
      return attempt.requer_revisao
        ? ["Em revisão", "review"]
        : ["Concluída", "done"];
    const access = availability(evaluation);
    if (access.state === "scheduled") return ["Agendada", "scheduled"];
    if (access.state === "expired") return ["Prazo encerrado", "expired"];
    return attempt?.status === "em_andamento"
      ? ["Em andamento", ""]
      : ["Pendente", ""];
  };
  const answerIsComplete = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "boolean") return true;
    if (Array.isArray(value))
      return value.length > 0 && value.every(answerIsComplete);
    if (typeof value === "object") {
      const entries = Object.values(value);
      return entries.length > 0 && entries.some(answerIsComplete);
    }
    return false;
  };
  const answerText = (value) => {
    if (value === null || value === undefined || value === "") return "Sem resposta";
    if (["string", "number", "boolean"].includes(typeof value)) return String(value);
    const useful = value.value ?? value.answer ?? value.text ?? value.code ?? value.selected ?? value.values;
    if (useful !== undefined) return Array.isArray(useful) ? useful.join(", ") : String(useful);
    return JSON.stringify(value, null, 2);
  };
  const secureConfig = (evaluation) =>
    evaluation?.configuracao?.secureExam?.enabled
      ? evaluation.configuracao.secureExam
      : null;
  let evaluations = [];
  let studioExperiences = [];
  let studioLoadError = "";
  let filter = "pending";
  let catalogSubject = subjectFilter;
  let catalogSearch = "";
  let currentAttempt = null;
  let answers = new Map();
  let saveTimers = new Map();
  let saveQueue = new Map();
  let savePromises = new Map();
  let secureCleanup = null;

  const shortDate = (value) =>
    value
      ? new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
          .format(new Date(value))
          .replace(" de ", " ")
      : "Sem prazo";
  const subjectName = (item) =>
    labels[item.materia_codigo] || item.materia_codigo || "Outra disciplina";
  const teacherName = (item) => {
    const savedName = String(
      item?.configuracao?.author?.name ||
        item?.configuracao?.autor_nome ||
        "",
    ).trim();
    return savedName || `Professor(a) de ${subjectName(item)}`;
  };
  const activityProgress = (item, attempt = latest(item)) => {
    if (finished(attempt)) return 100;
    const questionCount = item.questoes_avaliacao?.length || 0;
    if (!attempt || !questionCount) return 0;
    const answeredQuestionIds = new Set(
      (attempt.respostas_avaliacao || [])
        .filter((response) => answerIsComplete(response?.resposta))
        .map((response) => response.questao_id)
        .filter(Boolean),
    );
    return Math.min(
      100,
      Math.round((answeredQuestionIds.size / questionCount) * 100),
    );
  };
  const subjectIcon = (code) =>
    ({
      matematica: "calculate",
      portugues: "menu_book",
      fisica: "science",
      quimica: "experiment",
      biologia: "eco",
      tecnico_administracao: "business_center",
      tecnico_informatica: "terminal",
    })[code] || "assignment";
  const actionFor = (item, attempt, access, compact = false) => {
    if (finished(attempt))
      return `<a class="catalog-action secondary" href="?atividade=${encodeURIComponent(item.id)}">${compact ? "Ver" : "Ver resultado"}<span class="material-symbols-outlined">arrow_forward</span></a>`;
    if (access.actionable)
      return `<a class="catalog-action" href="?atividade=${encodeURIComponent(item.id)}">${attempt ? "Continuar" : "Começar"}<span class="material-symbols-outlined">arrow_forward</span></a>`;
    return `<span class="catalog-action disabled" aria-disabled="true">${access.state === "scheduled" ? "Ainda não abriu" : "Prazo encerrado"}</span>`;
  };
  const searchMatches = (item) =>
    !catalogSearch ||
    `${item.titulo || ""} ${item.instrucoes || ""} ${subjectName(item)}`
      .toLocaleLowerCase("pt-BR")
      .includes(catalogSearch.toLocaleLowerCase("pt-BR"));
  const catalogControls = () => {
    const subjects = [...new Set([...evaluations, ...studioExperiences].map((item) => item.materia_codigo).filter(Boolean))];
    return `<section class="catalog-controls" aria-label="Buscar e filtrar atividades"><label class="catalog-search"><span class="material-symbols-outlined">search</span><span class="sr-only">Buscar atividade</span><input type="search" data-catalog-search value="${esc(catalogSearch)}" placeholder="Buscar atividade..." autocomplete="off"></label><label class="catalog-subject"><span class="material-symbols-outlined">menu_book</span><span class="sr-only">Filtrar por disciplina</span><select data-catalog-subject><option value="">Todas as disciplinas</option>${subjects.map((code) => `<option value="${esc(code)}" ${catalogSubject === code ? "selected" : ""}>${esc(labels[code] || code)}</option>`).join("")}</select></label></section>`;
  };
  const pendingCard = (item) => {
    const attempt = latest(item);
    const access = availability(item);
    const progress = activityProgress(item, attempt);
    const secure = secureConfig(item);
    return `<article class="pending-card" style="--subject:${colors[item.materia_codigo] || "var(--accent)"}"><header><span class="subject-icon material-symbols-outlined">${subjectIcon(item.materia_codigo)}</span><div><span class="subject">${esc(subjectName(item))}</span><h3>${esc(item.titulo)}</h3><p>${esc(teacherName(item))}</p></div>${item.encerra_em ? `<time datetime="${esc(item.encerra_em)}">${esc(shortDate(item.encerra_em))}</time>` : '<time>Sem prazo</time>'}</header>${secure ? '<span class="secure-inline"><span class="material-symbols-outlined">shield_lock</span>Prova Segura</span>' : ""}<div class="pending-card-meta"><span><i class="material-symbols-outlined">quiz</i>${item.questoes_avaliacao?.length || 0} questões</span><span><i class="material-symbols-outlined">schedule</i>${item.duracao_minutos || "—"} min</span></div><div class="activity-progress" aria-label="${progress}% concluído"><i style="--value:${progress}%"></i><small>${progress}%</small></div>${actionFor(item, attempt, access)}</article>`;
  };
  const renderPending = (items) => {
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);
    const endWeek = new Date(endToday);
    endWeek.setDate(endWeek.getDate() + 7);
    const groups = [
      ["Hoje", "Vencem até o fim do dia", "schedule", items.filter((item) => item.encerra_em && new Date(item.encerra_em) <= endToday)],
      ["Próximos dias", "Vencem nos próximos 7 dias", "calendar_month", items.filter((item) => item.encerra_em && new Date(item.encerra_em) > endToday && new Date(item.encerra_em) <= endWeek)],
      ["Sem prazo", "Faça no seu tempo", "hourglass_empty", items.filter((item) => !item.encerra_em || new Date(item.encerra_em) > endWeek)],
    ];
    if (!items.length) return emptyCatalog("task_alt", "Tudo em dia", "Nenhuma atividade para fazer neste filtro.");
    return `<section class="pending-board">${groups.map(([title, subtitle, icon, entries]) => `<section class="deadline-column"><header><span class="material-symbols-outlined">${icon}</span><div><h2>${title}</h2><p>${subtitle}</p></div><b>${entries.length}</b></header><div>${entries.length ? entries.map(pendingCard).join("") : '<p class="column-empty">Nenhuma atividade aqui.</p>'}</div></section>`).join("")}</section>`;
  };
  const deliveredRow = (item) => {
    const attempt = latest(item);
    const corrected = attempt?.status === "corrigida";
    const submittedAt = attempt?.enviada_em || attempt?.corrigida_em;
    return `<article class="delivered-row" style="--subject:${colors[item.materia_codigo] || "var(--accent)"}"><span class="subject-icon material-symbols-outlined">${subjectIcon(item.materia_codigo)}</span><div class="delivered-title"><b>${esc(subjectName(item))}</b><h3>${esc(item.titulo)}</h3></div><time datetime="${esc(submittedAt || "")}"><span class="material-symbols-outlined">calendar_today</span>${esc(shortDate(submittedAt))}</time><span class="delivery-status ${corrected ? "corrected" : "waiting"}"><span class="material-symbols-outlined">${corrected ? "check_circle" : "schedule"}</span>${corrected ? "Corrigida" : "Aguardando correção"}</span><strong class="delivery-score">${attempt?.nota == null ? "—" : `${Number(attempt.nota).toLocaleString("pt-BR")} / ${Number(item.valor || 10).toLocaleString("pt-BR")}`}</strong>${actionFor(item, attempt, availability(item), true)}</article>`;
  };
  const renderDelivered = (items) => {
    if (!items.length) return emptyCatalog("inventory_2", "Nenhuma entrega encontrada", "Suas atividades enviadas aparecerão aqui.");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const week = new Date(today);
    week.setDate(week.getDate() - 7);
    const attemptDate = (item) => new Date(latest(item)?.enviada_em || latest(item)?.corrigida_em || 0);
    const groups = [
      ["Hoje", items.filter((item) => attemptDate(item) >= today)],
      ["Esta semana", items.filter((item) => attemptDate(item) < today && attemptDate(item) >= week)],
      ["Anteriores", items.filter((item) => attemptDate(item) < week)],
    ].filter(([, entries]) => entries.length);
    return `<section class="delivered-history">${groups.map(([title, entries]) => `<section><header><h2>${title}</h2><span>${entries.length} ${entries.length === 1 ? "atividade" : "atividades"}</span></header><div>${entries.map(deliveredRow).join("")}</div></section>`).join("")}</section>`;
  };
  const renderAll = (items) => {
    if (!items.length) return emptyCatalog("filter_alt_off", "Nenhuma atividade encontrada", "Ajuste a busca ou o filtro de disciplina.");
    const subjects = [...new Set(items.map((item) => item.materia_codigo))];
    return `<section class="subject-groups">${subjects.map((code) => {
      const entries = items.filter((item) => item.materia_codigo === code);
      const delivered = entries.filter((item) => finished(latest(item))).length;
      const percentage = Math.round((delivered / entries.length) * 100);
      return `<section class="subject-group" style="--subject:${colors[code] || "var(--accent)"}"><header><span class="subject-icon material-symbols-outlined">${subjectIcon(code)}</span><div><h2>${esc(labels[code] || code)}</h2><p>${delivered} de ${entries.length} atividades entregues</p></div><div class="subject-progress"><i style="--value:${percentage}%"></i><strong>${percentage}%</strong></div><span class="subject-count pending"><b>${entries.length - delivered}</b> pendentes</span><span class="subject-count done"><b>${delivered}</b> entregues</span></header><div class="subject-activity-list">${entries.map((item) => {
        const attempt = latest(item);
        const done = finished(attempt);
        return `<article><span class="material-symbols-outlined state-icon">${done ? "check_circle" : "schedule"}</span><div><h3>${esc(item.titulo)}</h3><small>${esc(labels[item.categoria] || item.categoria || "Atividade")}</small></div><time>${esc(shortDate(done ? attempt.enviada_em : item.encerra_em))}</time><strong>${done && attempt?.nota != null ? Number(attempt.nota).toLocaleString("pt-BR") : done ? "Entregue" : "Pendente"}</strong>${actionFor(item, attempt, availability(item), true)}</article>`;
      }).join("")}</div></section>`;
    }).join("")}</section>`;
  };
  const emptyCatalog = (icon, title, message) => `<div class="activity-empty"><span class="material-symbols-outlined">${icon}</span><h2>${title}</h2><p>${message}</p></div>`;

  const studioAttempt = (item) => item.ultima_tentativa || null;
  const studioAvailability = (item) => {
    const now = Date.now();
    if (item.abre_em && new Date(item.abre_em).getTime() > now)
      return { state: "scheduled", actionable: false };
    if (item.encerra_em && new Date(item.encerra_em).getTime() < now)
      return { state: "expired", actionable: false };
    return { state: "available", actionable: true };
  };
  const studioHref = (item) => {
    const prefix = location.pathname.includes("/netlify-dist/") ? "/netlify-dist" : "";
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
    const base = prefix ? `${prefix}/oministudio/` : local ? "/engine/dist/client/" : "/oministudio/";
    return `${base}?experience=${encodeURIComponent(item.experiencia_id || item.id)}`;
  };
  const renderStudioCatalog = (items) => items.length ? `<section class="studio-student-catalog" aria-labelledby="studio-catalog-title"><header><span class="material-symbols-outlined" aria-hidden="true">interactive_space</span><div><p class="eyebrow">OMINISTUDIO</p><h2 id="studio-catalog-title">Explore, responda e descubra</h2><p>Atividades interativas preparadas pelos seus professores.</p></div><span class="studio-catalog-count">${items.length} ${items.length === 1 ? "atividade" : "atividades"}</span></header><div class="studio-student-grid">${items.map((item) => {
    const attempt = studioAttempt(item), done = finished(attempt), access = studioAvailability(item);
    const progress = done ? 100 : Math.min(100, Math.round(Number(item.respostas_salvas || 0) / Math.max(1, Number(item.total_etapas || 1)) * 100));
    const label = done ? attempt.requer_revisao ? "Com o professor" : "Corrigida" : access.state === "scheduled" ? "Agendada" : access.state === "expired" ? "Prazo encerrado" : attempt ? "Em andamento" : "Pronta para começar";
    const action = done ? "Ver devolutiva" : attempt ? "Continuar percurso" : "Explorar atividade";
    return `<article class="studio-student-card ${done ? "done" : ""}" style="--subject:${colors[item.materia_codigo] || "var(--accent)"}"><div class="studio-card-top"><span class="subject-icon material-symbols-outlined" aria-hidden="true">${subjectIcon(item.materia_codigo)}</span><div><span class="subject">${esc(subjectName(item))}</span><small>${esc(item.professor_nome || `Professor(a) de ${subjectName(item)}`)}</small></div><span class="studio-card-status">${label}</span></div><h3>${esc(item.titulo)}</h3><p>${esc(item.objetivo || "Uma etapa de cada vez: explore e construa suas respostas.")}</p><div class="studio-card-facts"><span><i class="material-symbols-outlined" aria-hidden="true">route</i>${Number(item.total_etapas || 0)} etapas</span><span><i class="material-symbols-outlined" aria-hidden="true">event</i>${esc(shortDate(item.encerra_em))}</span></div>${attempt && !done ? `<div class="studio-card-progress" aria-label="${progress}% das etapas com resposta salva"><span><b>Seu progresso</b><strong>${progress}%</strong></span><div><i style="width:${progress}%"></i></div></div>` : ""}${done || access.actionable ? `<a class="catalog-action ${done ? "secondary" : ""}" href="${esc(studioHref(item))}">${action}<span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a>` : `<span class="catalog-action disabled" aria-disabled="true">${access.state === "scheduled" ? `Abre em ${esc(shortDate(item.abre_em))}` : "Prazo encerrado"}</span>`}</article>`;
  }).join("")}</div></section>` : "";

  const renderCatalog = () => {
    secureCleanup?.();
    secureCleanup = null;
    const inSelectedSubject = (item) =>
      !catalogSubject || item.materia_codigo === catalogSubject;
    const visible = evaluations.filter((item) => {
      if (!inSelectedSubject(item) || !searchMatches(item)) return false;
      if (filter === "all") return true;
      return filter === "done"
        ? finished(latest(item))
        : availability(item).actionable && !finished(latest(item));
    });
    const visibleStudio = studioExperiences.filter((item) => {
      if (!inSelectedSubject(item) || !searchMatches({ ...item, instrucoes: item.objetivo })) return false;
      if (filter === "all") return true;
      return filter === "done" ? finished(studioAttempt(item)) : studioAvailability(item).actionable && !finished(studioAttempt(item));
    });
    const completed = evaluations.filter(
      (item) => inSelectedSubject(item) && finished(latest(item)),
    ).length + studioExperiences.filter(item => inSelectedSubject(item) && finished(studioAttempt(item))).length;
    const pending = evaluations.filter(
      (item) =>
        inSelectedSubject(item) &&
        availability(item).actionable &&
        !finished(latest(item)),
    ).length + studioExperiences.filter(item => inSelectedSubject(item) && studioAvailability(item).actionable && !finished(studioAttempt(item))).length;
    const subjectLabel = labels[catalogSubject] || "";
    const traditional = visible.length || !visibleStudio.length ? filter === "pending" ? renderPending(visible) : filter === "done" ? renderDelivered(visible) : renderAll(visible) : "";
    root().innerHTML = `<header class="activities-hero"><div><p class="eyebrow">${subjectLabel ? `FILTRO ATIVO · ${esc(subjectLabel)}` : "SUA TURMA · DADOS REAIS"}</p><h1>${subjectLabel ? `Atividades de ${esc(subjectLabel)}` : "Atividades dos professores"}</h1><p>Encontre o que fazer agora, acompanhe entregas e consulte seu histórico.</p>${subjectFilter ? '<a class="subject-filter-return" href="index.html">Ver todas as matérias</a>' : ""}</div><div class="activity-metrics"><span><strong>${pending}</strong>pendentes</span><span><strong>${completed}</strong>entregues</span></div></header><div class="catalog-toolbar"><nav class="activity-tabs" aria-label="Filtrar atividades"><button data-filter="pending">Para fazer</button><button data-filter="done">Entregues</button><button data-filter="all">Todas</button></nav>${catalogControls()}</div>${studioLoadError ? `<div class="studio-catalog-warning" role="status"><span class="material-symbols-outlined" aria-hidden="true">cloud_off</span><p>${esc(studioLoadError)}</p><button type="button" data-retry-studio>Atualizar</button></div>` : ""}<div class="catalog-content">${renderStudioCatalog(visibleStudio)}${traditional}</div>`;
    root().querySelector("[data-retry-studio]")?.addEventListener("click", load);
    root()
      .querySelectorAll("[data-filter]")
      .forEach((button) => {
        button.classList.toggle("active", button.dataset.filter === filter);
        button.addEventListener("click", () => {
          filter = button.dataset.filter;
          renderCatalog();
        });
      });
    root().querySelector("[data-catalog-subject]")?.addEventListener("change", (event) => {
      catalogSubject = event.currentTarget.value;
      renderCatalog();
    });
    root().querySelector("[data-catalog-search]")?.addEventListener("input", (event) => {
      catalogSearch = event.currentTarget.value;
      renderCatalog();
      const search = root().querySelector("[data-catalog-search]");
      search?.focus();
      search?.setSelectionRange(catalogSearch.length, catalogSearch.length);
    });
  };

  const shuffled = (items) => [...items].sort(() => Math.random() - 0.5);

  const numeric = (value, fallback = 0) => {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const coordinatePosition = (value, min, max, invert = false) => {
    const percent = ((value - min) / (max - min)) * 100;
    return invert ? 100 - percent : percent;
  };

  const geometryLabels = {
    quadrado: "Quadrado",
    retangulo: "Retângulo",
    triangulo: "Triângulo",
    circulo: "Círculo",
    trapezio: "Trapézio",
    losango: "Losango",
    poligono_regular: "Polígono regular",
    personalizada_2d: "Figura 2D personalizada",
    cubo: "Cubo",
    paralelepipedo: "Paralelepípedo",
    cilindro: "Cilindro",
    cone: "Cone",
    esfera: "Esfera",
    prisma: "Prisma regular",
    piramide: "Pirâmide regular",
    personalizada_3d: "Sólido 3D personalizado",
    area: "Área",
    perimetro: "Perímetro",
    diagonal: "Diagonal",
    volume: "Volume",
    area_total: "Área total",
    area_lateral: "Área lateral",
    medida_desconhecida: "Medida desconhecida",
  };

  const geometryMeasureDefinitions = {
    quadrado: [["measureA", "Lado"]],
    retangulo: [
      ["measureA", "Base"],
      ["measureB", "Altura"],
    ],
    triangulo: [
      ["measureA", "Base"],
      ["measureB", "Altura"],
      ["measureC", "Lado B"],
      ["measureD", "Lado C"],
    ],
    circulo: [["measureA", "Raio"]],
    trapezio: [
      ["measureA", "Base maior"],
      ["measureB", "Base menor"],
      ["measureC", "Altura"],
      ["measureD", "Lado"],
    ],
    losango: [
      ["measureA", "Diagonal maior"],
      ["measureB", "Diagonal menor"],
      ["measureC", "Lado"],
    ],
    poligono_regular: [
      ["measureA", "Lado"],
      ["measureB", "Apótema"],
    ],
    personalizada_2d: [
      ["measureA", "Medida A"],
      ["measureB", "Medida B"],
      ["measureC", "Medida C"],
      ["measureD", "Medida D"],
    ],
    cubo: [["measureA", "Aresta"]],
    paralelepipedo: [
      ["measureA", "Comprimento"],
      ["measureB", "Largura"],
      ["measureC", "Altura"],
    ],
    cilindro: [
      ["measureA", "Raio"],
      ["measureB", "Altura"],
    ],
    cone: [
      ["measureA", "Raio"],
      ["measureB", "Altura"],
      ["measureC", "Geratriz"],
    ],
    esfera: [["measureA", "Raio"]],
    prisma: [
      ["measureA", "Área da base"],
      ["measureB", "Perímetro da base"],
      ["measureC", "Altura"],
    ],
    piramide: [
      ["measureA", "Área da base"],
      ["measureB", "Perímetro da base"],
      ["measureC", "Altura"],
      ["measureD", "Apótema lateral"],
    ],
    personalizada_3d: [
      ["measureA", "Medida A"],
      ["measureB", "Medida B"],
      ["measureC", "Medida C"],
      ["measureD", "Medida D"],
    ],
  };

  const studentGeometrySvg = (shape) => {
    if (["quadrado", "retangulo"].includes(shape))
      return `<rect x="75" y="40" width="210" height="145" rx="4"></rect><line x1="75" y1="205" x2="285" y2="205"></line><line x1="305" y1="40" x2="305" y2="185"></line>`;
    if (shape === "triangulo")
      return `<polygon points="70,185 290,185 205,38"></polygon><line x1="205" y1="38" x2="205" y2="185" class="geometry-guide"></line>`;
    if (shape === "circulo")
      return `<circle cx="180" cy="115" r="78"></circle><line x1="180" y1="115" x2="258" y2="115"></line><circle cx="180" cy="115" r="4" class="geometry-point"></circle>`;
    if (shape === "trapezio")
      return `<polygon points="55,185 305,185 255,48 105,48"></polygon><line x1="105" y1="48" x2="105" y2="185" class="geometry-guide"></line>`;
    if (shape === "losango")
      return `<polygon points="180,28 315,115 180,202 45,115"></polygon><line x1="45" y1="115" x2="315" y2="115" class="geometry-guide"></line><line x1="180" y1="28" x2="180" y2="202" class="geometry-guide"></line>`;
    if (["poligono_regular", "personalizada_2d"].includes(shape))
      return `<polygon points="180,28 292,86 270,188 90,188 68,86"></polygon><line x1="180" y1="115" x2="180" y2="188" class="geometry-guide"></line>`;
    if (
      ["cubo", "paralelepipedo", "prisma", "personalizada_3d"].includes(shape)
    )
      return `<polygon points="75,80 235,80 295,42 135,42"></polygon><polygon points="235,80 295,42 295,165 235,205"></polygon><rect x="75" y="80" width="160" height="125"></rect><line x1="75" y1="80" x2="135" y2="42"></line><line x1="75" y1="205" x2="135" y2="165" class="geometry-guide"></line><line x1="135" y1="42" x2="135" y2="165" class="geometry-guide"></line><line x1="135" y1="165" x2="295" y2="165" class="geometry-guide"></line>`;
    if (shape === "cilindro")
      return `<ellipse cx="180" cy="55" rx="82" ry="28"></ellipse><path d="M98 55 V174 C98 190 135 203 180 203 C225 203 262 190 262 174 V55"></path><ellipse cx="180" cy="174" rx="82" ry="28" class="geometry-guide"></ellipse>`;
    if (shape === "cone")
      return `<ellipse cx="180" cy="178" rx="88" ry="29"></ellipse><path d="M92 178 L180 30 L268 178"></path><line x1="180" y1="30" x2="180" y2="178" class="geometry-guide"></line>`;
    if (shape === "esfera")
      return `<circle cx="180" cy="115" r="88"></circle><ellipse cx="180" cy="115" rx="88" ry="28" class="geometry-guide"></ellipse><path d="M180 27 C135 57 135 173 180 203 C225 173 225 57 180 27" class="geometry-guide"></path>`;
    return `<polygon points="180,25 300,180 60,180"></polygon><polygon points="60,180 300,180 255,210 105,210"></polygon><line x1="180" y1="25" x2="180" y2="195" class="geometry-guide"></line>`;
  };

  const geometryResponseInput = (config, savedValue) => {
    const shape = geometryMeasureDefinitions[config.shape]
      ? config.shape
      : config.dimension === "3d"
        ? "cubo"
        : "quadrado";
    const dimension = config.dimension === "3d" ? "3d" : "2d";
    const name =
      config.customName || geometryLabels[shape] || "Forma geométrica";
    const baseUnit = esc(config.unit || "cm");
    const unit = ["area", "area_total", "area_lateral"].includes(
      config.targetType,
    )
      ? `${baseUnit}²`
      : config.targetType === "volume"
        ? `${baseUnit}³`
        : baseUnit;
    const measurements = geometryMeasureDefinitions[shape]
      .map(([key, defaultLabel], index) => {
        const customLabel = config[`label${String.fromCharCode(65 + index)}`];
        return `<span><b>${esc(customLabel || defaultLabel)}</b><strong>${numeric(config[key]).toLocaleString("pt-BR")} ${baseUnit}</strong></span>`;
      })
      .join("");
    return `<div class="interactive-geometry ${dimension}" data-geometry-lab><header><div><span class="material-symbols-outlined">${dimension === "3d" ? "deployed_code" : "category"}</span><div><small>LABORATÓRIO DE MEDIDAS · ${dimension.toUpperCase()}</small><strong>${esc(name)}</strong></div></div><em>Calcule: ${esc(geometryLabels[config.targetType] || "medida solicitada")}</em></header><div class="student-geometry-stage" data-geometry-stage style="--geometry-rotation:0deg;--geometry-scale:1"><svg viewBox="0 0 360 235" role="img" aria-label="${esc(name)} interativo"><g>${studentGeometrySvg(shape)}</g></svg></div><div class="student-geometry-measures" data-geometry-measures>${measurements}${config.sides ? `<span><b>Lados da base</b><strong>${Math.round(numeric(config.sides))}</strong></span>` : ""}</div><div class="geometry-controls"><button type="button" data-toggle-geometry-measures aria-pressed="true"><span class="material-symbols-outlined">straighten</span>Ocultar medidas</button><label>Girar visual <output data-geometry-rotation-output>0°</output><input data-geometry-rotation type="range" min="-35" max="35" step="1" value="0"></label><label>Ampliar <output data-geometry-scale-output>100%</output><input data-geometry-scale type="range" min="80" max="125" step="5" value="100"></label></div><label class="geometry-answer">Sua resposta (${unit})<input class="numeric-answer" data-answer type="text" inputmode="decimal" value="${esc(savedValue)}" placeholder="Digite somente o valor numérico"></label></div>`;
  };

  const mathResponseInput = (question, saved) => {
    const config = question.configuracao || {};
    const mode = config.mathMode;
    const savedValue = String(saved?.resposta || "");
    if (mode === "plano_cartesiano") {
      const minX = numeric(config.minX, -5);
      const maxX = Math.max(minX + 1, numeric(config.maxX, 5));
      const minY = numeric(config.minY, -5);
      const maxY = Math.max(minY + 1, numeric(config.maxY, 5));
      const [rawX, rawY] = savedValue.split(";");
      const hasPoint = rawX !== undefined && rawY !== undefined;
      const pointX = numeric(rawX);
      const pointY = numeric(rawY);
      const grid = Array.from({ length: 11 }, (_, index) => index * 10)
        .map(
          (position) =>
            `<line x1="${position}" y1="0" x2="${position}" y2="100"></line><line x1="0" y1="${position}" x2="100" y2="${position}"></line>`,
        )
        .join("");
      return `<div class="interactive-coordinate" data-coordinate-plane data-min-x="${minX}" data-max-x="${maxX}" data-min-y="${minY}" data-max-y="${maxY}"><p>Clique ou toque no ponto desejado. Use as setas após selecionar para ajustar.</p><svg viewBox="0 0 100 100" role="img" aria-label="Plano cartesiano interativo de ${minX} a ${maxX} no eixo X e ${minY} a ${maxY} no eixo Y"><g class="coordinate-grid">${grid}</g><line class="coordinate-axis" x1="0" y1="${coordinatePosition(0, minY, maxY, true)}" x2="100" y2="${coordinatePosition(0, minY, maxY, true)}"></line><line class="coordinate-axis" x1="${coordinatePosition(0, minX, maxX)}" y1="0" x2="${coordinatePosition(0, minX, maxX)}" y2="100"></line><circle data-coordinate-marker cx="${hasPoint ? coordinatePosition(pointX, minX, maxX) : 50}" cy="${hasPoint ? coordinatePosition(pointY, minY, maxY, true) : 50}" r="2.8" ${hasPoint ? "" : "hidden"}></circle><rect data-coordinate-hit x="0" y="0" width="100" height="100"></rect></svg><div class="coordinate-result"><output data-coordinate-output aria-live="polite">${hasPoint ? `Ponto selecionado: (${pointX}; ${pointY})` : "Nenhum ponto selecionado"}</output><span>Eixo X: ${minX} a ${maxX} · Eixo Y: ${minY} a ${maxY}</span><div class="coordinate-controls" aria-label="Ajustar ponto"><button type="button" data-coordinate-adjust="-1,0" aria-label="Mover para a esquerda">←</button><button type="button" data-coordinate-adjust="1,0" aria-label="Mover para a direita">→</button><button type="button" data-coordinate-adjust="0,1" aria-label="Mover para cima">↑</button><button type="button" data-coordinate-adjust="0,-1" aria-label="Mover para baixo">↓</button></div></div><input data-answer type="hidden" value="${esc(savedValue)}"></div>`;
    }
    if (mode === "reta_numerica") {
      const min = numeric(config.min, 0);
      const max = Math.max(min + 1, numeric(config.max, 10));
      const step = Math.max(0.001, numeric(config.step, 0.5));
      const value = savedValue ? numeric(savedValue, min) : min;
      return `<div class="interactive-number-line"><output data-number-line-output>${value.toLocaleString("pt-BR")}</output><input data-answer data-number-line type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="Escolha um valor na reta numérica"><div><span>${min.toLocaleString("pt-BR")}</span><span>${max.toLocaleString("pt-BR")}</span></div></div>`;
    }
    if (mode === "pitagoras") {
      const unit = esc(config.unit || "u");
      const sideA = numeric(config.sideA, 3);
      const sideB = numeric(config.sideB, 4);
      const sideC = numeric(config.sideC, 5);
      return `<div class="interactive-triangle"><div class="triangle-figure"><svg viewBox="0 0 260 190" role="img" aria-label="Triângulo retângulo com catetos ${sideA} e ${sideB} e hipotenusa ${sideC} ${unit}"><path class="triangle-shape" d="M42 24 V154 H232 Z"></path><path class="right-angle-mark" d="M42 134 H62 V154"></path><text class="triangle-label side-a" x="14" y="94">${sideA} ${unit}</text><text class="triangle-label side-b" x="126" y="181">${sideB} ${unit}</text><text class="triangle-label side-c" x="145" y="75" transform="rotate(34 145 75)">${sideC} ${unit}</text></svg></div><label>Resultado<input class="numeric-answer" data-answer type="text" inputmode="decimal" value="${esc(savedValue)}" placeholder="Digite o valor"></label></div>`;
    }
    if (mode === "geometria_medidas")
      return geometryResponseInput(config, savedValue);
    if (mode === "grafico_barras") {
      const rows = Array.isArray(config.chartData) ? config.chartData : [];
      const max = Math.max(
        1,
        ...rows.map((item) => Math.abs(numeric(item.value))),
      );
      return `<div class="interactive-bar-question"><p class="chart-axis-label">${esc(config.axisLabel || "Quantidade")}</p><div class="interactive-bars" role="group" aria-label="Gráfico de barras interativo">${rows.map((item) => `<button type="button" data-bar-option="${esc(item.label)}" aria-label="${esc(item.label)}: ${numeric(item.value)}"><span style="--student-bar:${Math.max(5, (Math.abs(numeric(item.value)) / max) * 100)}%"><b>${numeric(item.value)}</b></span><small>${esc(item.label)}</small></button>`).join("")}</div><p>Selecione uma barra ou marque uma alternativa:</p><div class="answer-options">${question.alternativas.map((option) => `<label class="answer-option"><input type="radio" name="q-${question.id}" value="${esc(option)}" ${savedValue === option ? "checked" : ""}>${rich(option)}</label>`).join("")}</div></div>`;
    }
    return "";
  };

  const interactiveBlockResponse = (question, saved) => {
    const config = question.configuracao || {};
    const block = config.activityBlock;
    const savedValue = String(saved?.resposta || "");
    if (block === "formula_quimica") {
      const tokens = ["H", "C", "N", "O", "Na", "Cl", "S", "P", "₂", "₃", "₄", "(", ")", "+", "→"];
      return `<section class="learning-interactive-card chemical-builder" data-learning-card data-chemical-builder><div class="learning-card-light" aria-hidden="true"></div><header><span class="material-symbols-outlined">science</span><div><small>CONSTRUTOR QUÍMICO</small><strong>${esc(config.formulaHint || "Monte a fórmula solicitada")}</strong></div></header><div class="chemical-target"><small>REFERÊNCIA</small><strong>${esc(config.formula || "Fórmula química")}</strong></div><label>Sua fórmula<input class="text-answer chemical-answer" data-answer value="${esc(savedValue)}" placeholder="Digite ou use os elementos abaixo" autocomplete="off" spellcheck="false"></label><div class="chemical-token-grid" aria-label="Elementos e símbolos químicos">${tokens.map((token) => `<button type="button" data-chemical-token="${esc(token)}">${esc(token)}</button>`).join("")}<button type="button" data-chemical-action="backspace" aria-label="Apagar último símbolo"><span class="material-symbols-outlined">backspace</span></button><button type="button" data-chemical-action="clear">Limpar</button></div></section>`;
    }
    if (block === "tabela_consultavel") {
      const columns = Array.isArray(config.tableColumns) ? config.tableColumns : [];
      const rows = Array.isArray(config.tableRows) ? config.tableRows : [];
      return `<section class="learning-interactive-card searchable-table-block" data-learning-card data-searchable-table><div class="learning-card-light" aria-hidden="true"></div><header><span class="material-symbols-outlined">table_view</span><div><small>TABELA CONSULTÁVEL</small><strong>Pesquise e ordene os dados</strong></div></header><label class="table-search"><span class="material-symbols-outlined">search</span><input type="search" data-table-search placeholder="Buscar em qualquer coluna" aria-label="Buscar na tabela"></label><div class="responsive-data-table"><table><thead><tr>${columns.map((column, index) => `<th><button type="button" data-sort-column="${index}" aria-label="Ordenar por ${esc(column)}">${esc(column)}<span class="material-symbols-outlined">unfold_more</span></button></th>`).join("")}</tr></thead><tbody data-table-body>${rows.map((row) => `<tr>${columns.map((_, index) => `<td>${esc(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="table-result" data-table-result>${rows.length} registro(s)</p><div class="answer-options">${question.alternativas.map((option) => `<label class="answer-option"><input type="radio" name="q-${question.id}" value="${esc(option)}" ${savedValue === option ? "checked" : ""}>${rich(option)}</label>`).join("")}</div></section>`;
    }
    if (block === "formula_matematica") {
      const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ",", "-"];
      return `<section class="learning-interactive-card math-formula-block" data-learning-card data-math-keypad><div class="learning-card-light" aria-hidden="true"></div><header><span class="material-symbols-outlined">function</span><div><small>FÓRMULA INTERATIVA</small><strong>${esc(config.mathExpression || "Expressão matemática")}</strong></div></header>${config.formulaVariables ? `<p class="formula-variables"><b>Dados:</b> ${esc(config.formulaVariables)}</p>` : ""}<label>Resultado<input class="numeric-answer" data-answer type="text" inputmode="decimal" value="${esc(savedValue)}" placeholder="Digite o resultado"></label><div class="math-keypad" aria-label="Teclado matemático">${keys.map((key) => `<button type="button" data-math-key="${esc(key)}">${esc(key)}</button>`).join("")}<button type="button" data-math-action="backspace" aria-label="Apagar último caractere"><span class="material-symbols-outlined">backspace</span></button><button type="button" data-math-action="clear">Limpar</button></div></section>`;
    }
    return "";
  };

  const responseInput = (question, saved) => {
    const value = saved?.resposta;
    const blockInput = interactiveBlockResponse(question, saved);
    if (blockInput) return blockInput;
    const mathInput = mathResponseInput(question, saved);
    if (mathInput) return mathInput;
    if (["unica_escolha", "verdadeiro_falso"].includes(question.tipo)) {
      const options =
        question.tipo === "verdadeiro_falso"
          ? ["Verdadeiro", "Falso"]
          : question.alternativas;
      return `<div class="answer-options">${options.map((option) => `<label class="answer-option"><input type="radio" name="q-${question.id}" value="${esc(option)}" ${value === option ? "checked" : ""}>${rich(option)}</label>`).join("")}</div>`;
    }
    if (question.tipo === "multipla_escolha") {
      const selected = Array.isArray(value) ? value : [];
      return `<div class="answer-options">${question.alternativas.map((option) => `<label class="answer-option"><input type="checkbox" name="q-${question.id}" value="${esc(option)}" ${selected.includes(option) ? "checked" : ""}>${rich(option)}</label>`).join("")}</div>`;
    }
    if (question.tipo === "associacao") {
      const config = question.configuracao || {};
      const leftItems = Array.isArray(config.associationLeft)
        ? config.associationLeft
        : Array.isArray(config.pairs)
          ? config.pairs.map((pair) => pair.left)
          : question.alternativas || [];
      const selected = Array.isArray(value) ? value : [];
      const configuredOptions = Array.isArray(config.associationOptions)
        ? config.associationOptions
        : (config.pairs || []).map((pair) => pair.right).filter(Boolean);
      const rightOptions = shuffled(configuredOptions);
      return `<div class="association-answer" data-association>${leftItems.map((left, index) => `<label><strong>${esc(left)}</strong><span class="material-symbols-outlined">arrow_forward</span><select data-association-select><option value="">Selecione a correspondência</option>${rightOptions.map((option) => `<option value="${esc(option)}" ${selected[index] === option ? "selected" : ""}>${esc(option)}</option>`).join("")}</select></label>`).join("")}</div>`;
    }
    if (question.tipo === "ordenacao") {
      const items =
        Array.isArray(value) && value.length
          ? value
          : shuffled(question.alternativas || []);
      return `<div class="ordering-answer" data-ordering>${items.map((item, index) => `<div data-order-item data-value="${esc(item)}"><span class="order-position">${index + 1}</span><strong>${esc(item)}</strong><div><button type="button" data-move-up aria-label="Mover para cima" ${index === 0 ? "disabled" : ""}><span class="material-symbols-outlined">arrow_upward</span></button><button type="button" data-move-down aria-label="Mover para baixo" ${index === items.length - 1 ? "disabled" : ""}><span class="material-symbols-outlined">arrow_downward</span></button></div></div>`).join("")}</div>`;
    }
    if (["numerica", "calculo"].includes(question.tipo))
      return `<input class="numeric-answer" data-answer type="text" inputmode="decimal" value="${esc(value || "")}" placeholder="Digite sua resposta">`;
    if (question.tipo === "codigo")
      return `<div class="code-answer"><header><span class="material-symbols-outlined">code</span>${esc(question.configuracao?.language || "Código")}</header>${question.configuracao?.starterCode ? `<pre>${esc(question.configuracao.starterCode)}</pre>` : ""}<textarea class="text-answer" data-answer spellcheck="false" placeholder="Escreva sua solução">${esc(value || "")}</textarea>${question.configuracao?.expectedOutput ? `<small>Objetivo: ${esc(question.configuracao.expectedOutput)}</small>` : ""}</div>`;
    return `${question.configuracao?.caseContext ? `<blockquote class="case-context">${esc(question.configuracao.caseContext)}</blockquote>` : ""}<textarea class="text-answer" data-answer placeholder="Escreva sua resposta">${esc(value || "")}</textarea>`;
  };

  const questionReference = (question) => {
    const config = question.configuracao || {};
    const resources = window.OminiResources?.renderResources(config.resources) || '';
    const dataUrl = String(config.referenceImage?.dataUrl || "");
    const safeImage = /^data:image\/(?:png|jpeg|webp);base64,/i.test(dataUrl)
      ? dataUrl
      : "";
    const expression = config.activityBlock === "formula_matematica"
      ? ""
      : String(config.mathExpression || "").trim();
    if (!safeImage && !expression && !resources) return "";
    return `<section class="question-reference" aria-label="Material de referência">${resources}${expression ? `<div class="question-formula"><span class="material-symbols-outlined">function</span><div><small>EXPRESSÃO DE REFERÊNCIA</small><strong>${window.OminiResources?.richText(`$${expression}$`) || esc(expression)}</strong></div></div>` : ""}${safeImage ? `<figure><img src="${esc(safeImage)}" alt="${esc(config.referenceImage?.alt || "Imagem de referência da questão")}"><figcaption>${esc(config.referenceImage?.alt || "Imagem de referência")}</figcaption></figure>` : ""}</section>`;
  };

  const learningStageHeader = (question, previousQuestion) => {
    const stage = question.configuracao?.learningStage;
    if (!stage || typeof stage !== "object" || previousQuestion?.configuracao?.learningStage?.id === stage.id) return "";
    const order = Number(stage.order);
    if (!Number.isInteger(order) || order < 1 || order > 12 || !stage.id) return "";
    const text = (value, limit) => esc(String(value || "").slice(0, limit));
    return `<section class="student-learning-stage" aria-label="Etapa ${order} do percurso"><span class="eyebrow">PERCURSO DE APRENDIZAGEM · ETAPA ${order}</span><h2>${text(stage.title, 140)}</h2>${stage.objective ? `<p class="stage-objective"><strong>O que você vai desenvolver:</strong> ${text(stage.objective, 600)}</p>` : ""}${stage.bridge ? `<p class="stage-bridge"><span class="material-symbols-outlined" aria-hidden="true">conversion_path</span>${text(stage.bridge, 600)}</p>` : ""}${stage.instructions ? `<div class="stage-instructions"><strong>Como trabalhar nesta etapa</strong><p>${text(stage.instructions, 6000)}</p></div>` : ""}</section>`;
  };

  const readAnswer = (card, question) => {
    if (question.tipo === "multipla_escolha")
      return [...card.querySelectorAll("input:checked")].map(
        (input) => input.value,
      );
    if (["unica_escolha", "verdadeiro_falso"].includes(question.tipo))
      return card.querySelector("input:checked")?.value;
    if (question.tipo === "associacao")
      return [...card.querySelectorAll("[data-association-select]")].map(
        (select) => select.value,
      );
    if (question.tipo === "ordenacao")
      return [...card.querySelectorAll("[data-order-item]")].map(
        (item) => item.dataset.value,
      );
    return card.querySelector("[data-answer]")?.value.trim();
  };

  const refreshProgress = () => {
    const count = [...answers.values()].filter(answerIsComplete).length;
    const total = Number(
      root().querySelector("[data-total]")?.dataset.total || 0,
    );
    const percent = total ? Math.round((count / total) * 100) : 0;
    root().querySelector("[data-progress-text]").textContent =
      `${count} de ${total} respondidas`;
    root()
      .querySelector("[data-progress-bar]")
      .style.setProperty("--progress", `${percent}%`);
  };

  const persistQueuedAnswer = (questionId) => {
    const queued = saveQueue.get(questionId);
    if (!queued) return savePromises.get(questionId) || Promise.resolve();
    saveQueue.delete(questionId);
    clearTimeout(saveTimers.get(questionId));
    saveTimers.delete(questionId);
    const previous = savePromises.get(questionId) || Promise.resolve();
    const request = previous
      .catch(() => {})
      .then(async () => {
        try {
          await api().saveStudentEvaluationAnswer({
            attemptId: currentAttempt.id,
            questionId,
            answer: queued.answer,
          });
          if (!saveQueue.has(questionId))
            queued.state.textContent = answerIsComplete(queued.answer)
              ? "Resposta salva"
              : "Resposta removida";
        } catch (error) {
          if (answers.get(questionId) === queued.answer)
            saveQueue.set(questionId, queued);
          queued.state.textContent = "Falha ao salvar · tentaremos novamente";
          notify(error.message, "error");
          throw error;
        }
      });
    savePromises.set(questionId, request);
    request
      .finally(() => {
        if (savePromises.get(questionId) === request)
          savePromises.delete(questionId);
      })
      .catch(() => {});
    return request;
  };

  const flushPendingSaves = async () => {
    const queuedIds = [...saveQueue.keys()];
    const requests = queuedIds.map(persistQueuedAnswer);
    const inFlight = [...new Set([...requests, ...savePromises.values()])];
    const results = await Promise.allSettled(inFlight);
    if (results.some((result) => result.status === "rejected"))
      throw new Error(
        "Ainda existem respostas sem salvar. Verifique sua conexão e tente novamente.",
      );
  };

  const save = (card, question) => {
    const answer = readAnswer(card, question);
    if (answer === undefined) return;
    answers.set(question.id, answer);
    card.classList.toggle("answered", answerIsComplete(answer));
    refreshProgress();
    clearTimeout(saveTimers.get(question.id));
    const state = card.querySelector("[data-save-state]");
    state.textContent = "Salvando...";
    saveQueue.set(question.id, { answer, state });
    saveTimers.set(
      question.id,
      setTimeout(() => persistQueuedAnswer(question.id).catch(() => {}), 350),
    );
  };

  const activateSecureMode = (evaluation) => {
    const banner = root().querySelector("[data-secure-banner]");
    let interruptions = 0;
    const update = (message) => {
      if (banner)
        banner.querySelector("[data-secure-status]").textContent = message;
    };
    const restrict = (event) => {
      event.preventDefault();
      update("Ação restringida pelo modo monitorado.");
      notify(
        "Copiar, colar e o menu de contexto estão desativados nesta avaliação.",
        "error",
      );
    };
    const visibility = () => {
      if (document.hidden) {
        interruptions += 1;
        update(
          `${interruptions} saída(s) da avaliação detectada(s) neste dispositivo.`,
        );
      }
    };
    const fullscreen = () => {
      if (!document.fullscreenElement)
        update(
          "Tela cheia encerrada. Retorne para continuar no modo monitorado.",
        );
    };
    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    ["copy", "cut", "paste", "contextmenu"].forEach((name) =>
      document.addEventListener(name, restrict),
    );
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", fullscreen);
    window.addEventListener("beforeunload", beforeUnload);
    root()
      .querySelector("[data-return-fullscreen]")
      ?.addEventListener("click", () =>
        document.documentElement
          .requestFullscreen?.()
          .catch(() =>
            notify(
              "Não foi possível ativar a tela cheia neste navegador.",
              "error",
            ),
          ),
      );
    secureCleanup = () => {
      ["copy", "cut", "paste", "contextmenu"].forEach((name) =>
        document.removeEventListener(name, restrict),
      );
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("fullscreenchange", fullscreen);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  };

  const renderResult = async (evaluation, attempt) => {
    secureCleanup?.();
    secureCleanup = null;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    const percent = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (Number(attempt.nota || 0) / Number(evaluation.valor || 1)) * 100,
        ),
      ),
    );
    const attemptsRemaining = Math.max(
      0,
      Number(evaluation.tentativas_permitidas || 1) -
        Number(attempt.numero_tentativa || 1),
    );
    const canRetry = !attempt.requer_revisao && attemptsRemaining > 0 && availability(evaluation).actionable;
    const questionMap = new Map((evaluation.questoes_avaliacao || []).map((question, index) => [question.id, { ...question, displayOrder: index + 1 }]));
    const responses = [...(attempt.respostas_avaliacao || [])].sort((a, b) => (questionMap.get(a.questao_id)?.displayOrder || 0) - (questionMap.get(b.questao_id)?.displayOrder || 0));
    const feedbackItems = responses.filter((response) => response.feedback);
    const corrected = !attempt.requer_revisao && attempt.status === "corrigida";
    const responseMarkup = responses.map((response) => {
      const question = questionMap.get(response.questao_id) || {};
      const pending = ["revisao", "pendente"].includes(response.status_correcao);
      const automatic = response.status_correcao === "automatica";
      const earned = Number(response.pontos_manuais ?? response.pontos_automaticos ?? 0);
      return `<article class="student-feedback-item ${pending ? "pending" : response.correta ? "correct" : "needs-work"}"><header><span>Questão ${question.displayOrder || ""}</span><em><span class="material-symbols-outlined">${pending ? "schedule" : automatic ? "auto_awesome" : "person_edit"}</span>${pending ? "Aguardando professor" : automatic ? "Correção automática" : "Revisada pelo professor"}</em><strong>${pending ? "—" : earned.toLocaleString("pt-BR")} / ${Number(question.pontos || 0).toLocaleString("pt-BR")}</strong></header><h3>${rich(question.enunciado || "Questão")}</h3><div class="student-feedback-answer"><small>Sua resposta</small><p>${esc(answerText(response.resposta))}</p></div>${response.feedback ? `<div class="teacher-feedback"><span class="material-symbols-outlined">chat</span><div><small>Devolutiva</small><p>${esc(response.feedback)}</p></div></div>` : pending ? `<p class="feedback-wait">Sua resposta foi entregue e está na fila de correção.</p>` : `<p class="feedback-wait">Esta questão não recebeu um comentário adicional.</p>`}</article>`;
    }).join("");
    root().innerHTML = `<section class="result-panel result-summary"><div><p class="eyebrow">${attempt.requer_revisao ? "ENTREGA CONFIRMADA" : "DEVOLUTIVA DISPONÍVEL"}</p><h1>${attempt.requer_revisao ? "Sua atividade está com o professor" : "Correção concluída"}</h1><p>${attempt.requer_revisao ? "Suas respostas foram salvas e enviadas. Você será avisado quando a correção estiver pronta." : `Você alcançou ${percent}% da pontuação desta atividade.`}</p><div class="result-timeline" aria-label="Andamento da atividade"><span class="done"><i class="material-symbols-outlined">task_alt</i><b>Entregue</b></span><span class="${attempt.requer_revisao ? "active" : "done"}"><i class="material-symbols-outlined">rate_review</i><b>Em revisão</b></span><span class="${corrected ? "done" : ""}"><i class="material-symbols-outlined">workspace_premium</i><b>Corrigida</b></span></div></div><aside><div class="result-score" style="--score:${percent}%"><strong>${Number(attempt.nota || 0).toLocaleString("pt-BR")}</strong><small>de ${Number(evaluation.valor || 0).toLocaleString("pt-BR")}</small></div><p class="result-attempts">Tentativa ${attempt.numero_tentativa} de ${evaluation.tentativas_permitidas}${canRetry ? ` · ${attemptsRemaining} restante(s)` : ""}</p></aside></section>${attempt.feedback || feedbackItems.length || responses.length ? `<section class="feedback-center"><header><div><p class="eyebrow">SUA DEVOLUTIVA</p><h2>${attempt.requer_revisao ? "Acompanhe cada etapa" : "Entenda seu resultado"}</h2><p>${esc(attempt.feedback || (attempt.requer_revisao ? "A correção detalhada aparecerá aqui." : "Confira os comentários e use-os como guia para a próxima tentativa."))}</p></div><span class="feedback-count"><strong>${feedbackItems.length}</strong> comentário(s)</span></header><div class="student-feedback-list">${responseMarkup}</div></section>` : ""}<div class="result-actions"><a class="button secondary" href="index.html">Voltar às atividades</a>${canRetry ? '<button class="button" type="button" data-retry-attempt>Fazer nova tentativa</button>' : ""}</div>`;
    root()
      .querySelector("[data-retry-attempt]")
      ?.addEventListener("click", () =>
        renderEvaluation(evaluation, { forceNew: true }),
      );
  };

  const beginEvaluation = async (evaluation, { forceNew = false } = {}) => {
    let attempt = await api().getStudentEvaluationAttempt(evaluation.id);
    if (!forceNew && finished(attempt))
      return renderResult(evaluation, attempt);
    await api().startStudentEvaluationAttempt(evaluation.id);
    attempt = await api().getStudentEvaluationAttempt(evaluation.id);
    currentAttempt = attempt;
    answers = new Map();
    saveTimers.forEach((timer) => clearTimeout(timer));
    saveTimers = new Map();
    saveQueue = new Map();
    savePromises = new Map();
    const stored = new Map(
      (attempt?.respostas_avaliacao || []).map((answer) => [
        answer.questao_id,
        answer,
      ]),
    );
    stored.forEach((answer, id) => answers.set(id, answer.resposta));
    const secure = secureConfig(evaluation);
    root().innerHTML = `${secure ? `<section class="secure-active" data-secure-banner><span class="material-symbols-outlined">shield_lock</span><div><strong>Prova Segura ativa</strong><small data-secure-status>Tela cheia e restrições locais ativas. Permanecer nesta página é sua responsabilidade.</small></div><button type="button" data-return-fullscreen>Retornar à tela cheia</button></section>` : ""}<header class="assessment-head"><div><a href="index.html" data-leave-assessment>← Voltar às atividades</a><p class="eyebrow">${esc(labels[evaluation.materia_codigo] || evaluation.materia_codigo)} · TENTATIVA ${attempt.numero_tentativa}</p><h1>${esc(evaluation.titulo)}</h1><p>${esc(evaluation.instrucoes || "Responda com atenção e revise antes de enviar.")}</p></div><div class="assessment-badge"><strong>${evaluation.valor}</strong>pontos</div></header><div class="assessment-progress" data-progress-bar><span data-progress-text></span><div><i></i></div></div><section class="question-stack" data-total="${evaluation.questoes_avaliacao.length}">${evaluation.questoes_avaliacao
      .map((question, index) => {
        const storedAnswer = stored.get(question.id)?.resposta;
        const saved = answerIsComplete(storedAnswer);
        return `${learningStageHeader(question, evaluation.questoes_avaliacao[index - 1])}<article class="student-question ${saved ? "answered" : ""}" data-question="${question.id}"><header><span>QUESTÃO ${index + 1}</span><span>${question.pontos} ponto(s)</span></header><h2>${rich(question.enunciado)}</h2>${questionReference(question)}${responseInput(question, stored.get(question.id))}<small class="save-state" data-save-state>${saved ? "Resposta salva" : "Ainda não respondida"}</small></article>`;
      })
      .join(
        "",
      )}</section><footer class="assessment-footer"><span>Revise todas as respostas antes da entrega.</span><button class="button" type="button" data-submit>Entregar atividade</button></footer>`;
    window.OminiResources?.hydrate(root());
    evaluation.questoes_avaliacao.forEach((question) => {
      const card = root().querySelector(`[data-question="${question.id}"]`);
      const plane = card.querySelector("[data-coordinate-plane]");
      if (plane) {
        const minX = numeric(plane.dataset.minX, -5);
        const maxX = numeric(plane.dataset.maxX, 5);
        const minY = numeric(plane.dataset.minY, -5);
        const maxY = numeric(plane.dataset.maxY, 5);
        const answer = plane.querySelector("[data-answer]");
        const marker = plane.querySelector("[data-coordinate-marker]");
        const output = plane.querySelector("[data-coordinate-output]");
        const setPoint = (rawX, rawY) => {
          const x = Math.min(maxX, Math.max(minX, Math.round(rawX)));
          const y = Math.min(maxY, Math.max(minY, Math.round(rawY)));
          answer.value = `${x};${y}`;
          marker.hidden = false;
          marker.setAttribute("cx", coordinatePosition(x, minX, maxX));
          marker.setAttribute("cy", coordinatePosition(y, minY, maxY, true));
          output.textContent = `Ponto selecionado: (${x}; ${y})`;
          answer.dispatchEvent(new Event("input", { bubbles: true }));
        };
        plane
          .querySelector("[data-coordinate-hit]")
          ?.addEventListener("pointerdown", (event) => {
            const bounds = event.currentTarget
              .closest("svg")
              .getBoundingClientRect();
            const x =
              minX +
              ((event.clientX - bounds.left) / bounds.width) * (maxX - minX);
            const y =
              maxY -
              ((event.clientY - bounds.top) / bounds.height) * (maxY - minY);
            setPoint(x, y);
          });
        plane.querySelectorAll("[data-coordinate-adjust]").forEach((button) =>
          button.addEventListener("click", () => {
            const [dx, dy] = button.dataset.coordinateAdjust
              .split(",")
              .map(Number);
            const [currentX, currentY] = answer.value
              ? answer.value.split(";").map(Number)
              : [0, 0];
            setPoint(currentX + dx, currentY + dy);
          }),
        );
      }
      const numberLine = card.querySelector("[data-number-line]");
      numberLine?.addEventListener("input", () => {
        card.querySelector("[data-number-line-output]").textContent = numeric(
          numberLine.value,
        ).toLocaleString("pt-BR");
      });
      card.querySelectorAll("[data-bar-option]").forEach((button) =>
        button.addEventListener("click", () => {
          const option = [...card.querySelectorAll("input[type=radio]")].find(
            (input) => input.value === button.dataset.barOption,
          );
          if (!option) return;
          option.checked = true;
          option.dispatchEvent(new Event("change", { bubbles: true }));
        }),
      );
      const chemicalBuilder = card.querySelector("[data-chemical-builder]");
      if (chemicalBuilder) {
        const answer = chemicalBuilder.querySelector("[data-answer]");
        chemicalBuilder.querySelectorAll("[data-chemical-token]").forEach((button) =>
          button.addEventListener("click", () => {
            answer.value += button.dataset.chemicalToken;
            answer.focus();
            answer.dispatchEvent(new Event("input", { bubbles: true }));
          }),
        );
        chemicalBuilder.querySelectorAll("[data-chemical-action]").forEach((button) =>
          button.addEventListener("click", () => {
            answer.value = button.dataset.chemicalAction === "clear"
              ? ""
              : Array.from(answer.value).slice(0, -1).join("");
            answer.focus();
            answer.dispatchEvent(new Event("input", { bubbles: true }));
          }),
        );
      }
      const searchableTable = card.querySelector("[data-searchable-table]");
      if (searchableTable) {
        const body = searchableTable.querySelector("[data-table-body]");
        const rows = () => [...body.querySelectorAll("tr")];
        const updateCount = () => {
          const visible = rows().filter((row) => !row.hidden).length;
          searchableTable.querySelector("[data-table-result]").textContent =
            `${visible} registro(s) encontrado(s)`;
        };
        searchableTable.querySelector("[data-table-search]").addEventListener("input", (event) => {
          event.stopPropagation();
          const term = event.target.value.trim().toLocaleLowerCase("pt-BR");
          rows().forEach((row) => {
            row.hidden = Boolean(term) && !row.textContent.toLocaleLowerCase("pt-BR").includes(term);
          });
          updateCount();
        });
        searchableTable.querySelectorAll("[data-sort-column]").forEach((button) =>
          button.addEventListener("click", () => {
            const index = Number(button.dataset.sortColumn);
            const direction = button.dataset.direction === "asc" ? "desc" : "asc";
            button.dataset.direction = direction;
            rows()
              .sort((a, b) => {
                const first = a.children[index]?.textContent.trim() || "";
                const second = b.children[index]?.textContent.trim() || "";
                return first.localeCompare(second, "pt-BR", { numeric: true }) * (direction === "asc" ? 1 : -1);
              })
              .forEach((row) => body.appendChild(row));
            button.querySelector(".material-symbols-outlined").textContent =
              direction === "asc" ? "arrow_upward" : "arrow_downward";
          }),
        );
      }
      const mathKeypad = card.querySelector("[data-math-keypad]");
      if (mathKeypad) {
        const answer = mathKeypad.querySelector("[data-answer]");
        mathKeypad.querySelectorAll("[data-math-key]").forEach((button) =>
          button.addEventListener("click", () => {
            answer.value += button.dataset.mathKey;
            answer.focus();
            answer.dispatchEvent(new Event("input", { bubbles: true }));
          }),
        );
        mathKeypad.querySelectorAll("[data-math-action]").forEach((button) =>
          button.addEventListener("click", () => {
            answer.value = button.dataset.mathAction === "clear"
              ? ""
              : Array.from(answer.value).slice(0, -1).join("");
            answer.focus();
            answer.dispatchEvent(new Event("input", { bubbles: true }));
          }),
        );
      }
      card.querySelectorAll("[data-learning-card]").forEach((learningCard) => {
        learningCard.tabIndex = 0;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const reset = () => {
          learningCard.style.setProperty("--learn-rx", "0deg");
          learningCard.style.setProperty("--learn-ry", "0deg");
          learningCard.style.setProperty("--learn-light-x", "50%");
          learningCard.style.setProperty("--learn-light-y", "50%");
        };
        if (reduced) return reset();
        learningCard.addEventListener("pointermove", (event) => {
          if (event.pointerType && event.pointerType !== "mouse") return;
          const rect = learningCard.getBoundingClientRect();
          const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
          const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
          learningCard.style.setProperty("--learn-rx", `${(0.5 - y) * 5}deg`);
          learningCard.style.setProperty("--learn-ry", `${(x - 0.5) * 7}deg`);
          learningCard.style.setProperty("--learn-light-x", `${x * 100}%`);
          learningCard.style.setProperty("--learn-light-y", `${y * 100}%`);
        });
        learningCard.addEventListener("pointerleave", reset);
        learningCard.addEventListener("blur", reset);
        learningCard.addEventListener("keydown", (event) => {
          const tilt = { ArrowLeft: [0, -4], ArrowRight: [0, 4], ArrowUp: [3, 0], ArrowDown: [-3, 0] }[event.key];
          if (!tilt) return;
          event.preventDefault();
          learningCard.style.setProperty("--learn-rx", `${tilt[0]}deg`);
          learningCard.style.setProperty("--learn-ry", `${tilt[1]}deg`);
        });
      });
      const geometryLab = card.querySelector("[data-geometry-lab]");
      if (geometryLab) {
        const stage = geometryLab.querySelector("[data-geometry-stage]");
        const measures = geometryLab.querySelector("[data-geometry-measures]");
        const toggle = geometryLab.querySelector(
          "[data-toggle-geometry-measures]",
        );
        toggle.addEventListener("click", (event) => {
          event.stopPropagation();
          const visible = toggle.getAttribute("aria-pressed") === "true";
          toggle.setAttribute("aria-pressed", String(!visible));
          measures.hidden = visible;
          toggle.innerHTML = `<span class="material-symbols-outlined">straighten</span>${visible ? "Mostrar medidas" : "Ocultar medidas"}`;
        });
        const rotation = geometryLab.querySelector("[data-geometry-rotation]");
        rotation.addEventListener("input", (event) => {
          event.stopPropagation();
          stage.style.setProperty(
            "--geometry-rotation",
            `${rotation.value}deg`,
          );
          geometryLab.querySelector("[data-geometry-rotation-output]").value =
            `${rotation.value}°`;
        });
        const scale = geometryLab.querySelector("[data-geometry-scale]");
        scale.addEventListener("input", (event) => {
          event.stopPropagation();
          stage.style.setProperty(
            "--geometry-scale",
            String(Number(scale.value) / 100),
          );
          geometryLab.querySelector("[data-geometry-scale-output]").value =
            `${scale.value}%`;
        });
      }
      card.addEventListener("input", () => save(card, question));
      card.addEventListener("change", () => save(card, question));
      card.addEventListener("click", (event) => {
        const move = event.target.closest("[data-move-up],[data-move-down]");
        if (!move) return;
        const row = move.closest("[data-order-item]");
        const sibling = move.matches("[data-move-up]")
          ? row.previousElementSibling
          : row.nextElementSibling;
        if (!sibling) return;
        move.matches("[data-move-up]")
          ? row.parentElement.insertBefore(row, sibling)
          : row.parentElement.insertBefore(sibling, row);
        [...row.parentElement.children].forEach((item, index) => {
          item.querySelector(".order-position").textContent = index + 1;
          item.querySelector("[data-move-up]").disabled = index === 0;
          item.querySelector("[data-move-down]").disabled =
            index === row.parentElement.children.length - 1;
        });
        save(card, question);
      });
      if (question.tipo === "ordenacao" && !stored.has(question.id))
        save(card, question);
    });
    if (secure) activateSecureMode(evaluation);
    refreshProgress();
    root()
      .querySelector("[data-leave-assessment]")
      ?.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
          await flushPendingSaves();
          location.href = event.currentTarget.href;
        } catch (error) {
          notify(error.message, "error");
        }
      });
    root()
      .querySelector("[data-submit]")
      .addEventListener("click", async (event) => {
        const unansweredRequired = evaluation.questoes_avaliacao.filter(
          (question) =>
            question.obrigatoria && !answerIsComplete(answers.get(question.id)),
        );
        if (unansweredRequired.length) {
          root()
            .querySelector(`[data-question="${unansweredRequired[0].id}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
          return notify(
            `Responda ${unansweredRequired.length === 1 ? "a questão obrigatória pendente" : `as ${unansweredRequired.length} questões obrigatórias pendentes`}.`,
            "error",
          );
        }
        if (
          !confirm(
            "Deseja entregar? Depois do envio as respostas não poderão ser alteradas.",
          )
        )
          return;
        event.currentTarget.disabled = true;
        event.currentTarget.textContent = "Salvando e entregando...";
        try {
          await flushPendingSaves();
          await api().submitStudentEvaluationAttempt(currentAttempt.id);
          const updated = await api().getStudentEvaluationAttempt(
            evaluation.id,
          );
          renderResult(evaluation, updated);
        } catch (error) {
          notify(error.message, "error");
          event.currentTarget.disabled = false;
          event.currentTarget.textContent = "Entregar atividade";
        }
      });
  };

  const renderEvaluation = async (evaluation, { forceNew = false } = {}) => {
    const attempt = await api().getStudentEvaluationAttempt(evaluation.id);
    if (!forceNew && finished(attempt))
      return renderResult(evaluation, attempt);
    const access = availability(evaluation);
    if (!access.actionable) {
      const scheduled = access.state === "scheduled";
      root().innerHTML = `<section class="activity-unavailable"><span class="material-symbols-outlined">${scheduled ? "calendar_clock" : "event_busy"}</span><p class="eyebrow">${scheduled ? "ATIVIDADE AGENDADA" : "PRAZO ENCERRADO"}</p><h1>${scheduled ? "Esta atividade ainda não começou" : "Esta atividade não aceita mais respostas"}</h1><p>${scheduled ? `A abertura está prevista para ${date(evaluation.abre_em)}.` : `O prazo terminou em ${date(evaluation.encerra_em)}.`}</p><a class="button secondary" href="index.html">Voltar às atividades</a></section>`;
      return;
    }
    const secure = secureConfig(evaluation);
    if (!secure) return beginEvaluation(evaluation, { forceNew });
    root().innerHTML = `<section class="secure-gate"><div class="secure-gate-icon"><span class="material-symbols-outlined">shield_lock</span></div><p class="eyebrow">AVALIAÇÃO MONITORADA</p><h1>Antes de iniciar a Prova Segura</h1><p>Ao começar, o sistema solicitará tela cheia, restringirá copiar e colar e avisará quando esta página perder o foco.</p><ul><li><span class="material-symbols-outlined">fullscreen</span>Permaneça em tela cheia durante a tentativa.</li><li><span class="material-symbols-outlined">tab_close</span>Evite trocar de aba ou aplicativo.</li><li><span class="material-symbols-outlined">content_paste_off</span>Copiar, colar e menu de contexto ficarão restritos.</li></ul><aside><strong>Transparência</strong> O navegador não bloqueia DevTools e o sistema não afirma detectar IA automaticamente. Eventuais sinais devem ser avaliados pelo professor.</aside><button class="button" type="button" data-start-secure>Entrar em tela cheia e começar</button><a href="index.html">Voltar às atividades</a></section>`;
    root()
      .querySelector("[data-start-secure]")
      .addEventListener("click", async (event) => {
        event.currentTarget.disabled = true;
        try {
          await document.documentElement.requestFullscreen?.();
          await beginEvaluation(evaluation, { forceNew });
        } catch (error) {
          event.currentTarget.disabled = false;
          notify("Ative a tela cheia para iniciar esta avaliação.", "error");
        }
      });
  };

  const load = async () => {
    try {
      const studioId = new URLSearchParams(location.search).get("studio");
      if (studioId) {
        location.replace(studioHref({ experiencia_id: studioId }));
        return;
      }
      const results = await Promise.allSettled([
        api().listStudentEvaluations(),
        api().listStudentStudioExperiences ? api().listStudentStudioExperiences() : Promise.resolve([]),
      ]);
      if (results[0].status === "rejected") throw results[0].reason;
      evaluations = results[0].value || [];
      studioExperiences = results[1].status === "fulfilled" ? results[1].value || [] : [];
      studioLoadError = results[1].status === "rejected" ? "Não foi possível consultar as atividades do OmniStudio. Suas outras atividades estão disponíveis abaixo." : "";
      const id = new URLSearchParams(location.search).get("atividade");
      if (id) {
        const evaluation = evaluations.find((item) => item.id === id);
        if (!evaluation)
          throw new Error("Esta atividade não está disponível para sua turma.");
        await renderEvaluation(evaluation);
      } else renderCatalog();
    } catch (error) {
      root().innerHTML = `<div class="activity-empty"><span class="material-symbols-outlined">cloud_off</span><h2>Não foi possível carregar</h2><p>${esc(error.message)}</p><button class="button" data-retry>Tentar novamente</button></div>`;
      root().querySelector("[data-retry]")?.addEventListener("click", load);
    }
  };

  document.addEventListener("ominisaber:ready", (event) => {
    if (event.detail?.session) load();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && currentAttempt) flushPendingSaves().catch(() => {});
  });
  window.addEventListener("beforeunload", (event) => {
    if (!saveQueue.size && !savePromises.size) return;
    event.preventDefault();
    event.returnValue = "";
  });
})();
