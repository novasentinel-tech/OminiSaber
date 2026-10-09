(() => {
  const api = () => window.OminiSaber;
  let studyUserId = "aluno";
  let programmingLab = null;
  const page = document.body.dataset.studyPage || "catalogo";
  const params = new URLSearchParams(location.search);
  const requestedSubjectCode = params.get("materia") || "";
  const requestedSubjectLabels = {
    matematica: "Matemática",
    portugues: "Português",
    fisica: "Física",
    redacao: "Redação",
    tecnico_administracao: "Administração",
    tecnico_informatica: "Informática",
  };
  const frontendIndex = location.pathname.indexOf("/frontend/");
  const frontendRoot =
    frontendIndex >= 0
      ? location.pathname.slice(0, frontendIndex) + "/frontend/"
      : "/frontend/";
  const moduleRoot = `${frontendRoot}aluno/modulo_de_trilhas/`;
  const routes = {
    catalogo: `${moduleRoot}index.html`,
    salvos: `${moduleRoot}salvos/index.html`,
    historico: `${moduleRoot}historico/index.html`,
    dashboard: `${frontendRoot}aluno/dashboard_principal/index.html`,
    evolucao: `${frontendRoot}aluno/minha_evolucao/index.html`,
    perfil: `${frontendRoot}aluno/perfil/index.html`,
    notificacoes: `${frontendRoot}aluno/notificacoes/index.html`,
  };
  const root = document.querySelector("[data-study-root]");
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
    if (!value || value === "null" || value === "undefined") return "";
    try {
      const url = new URL(value, location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };
  const date = (value, options = {}) =>
    value
      ? new Intl.DateTimeFormat("pt-BR", options).format(new Date(value))
      : "Sem data";
  const typeLabel = {
    aula: "Aula",
    atividade: "Atividade",
    quiz: "Quiz",
    projeto: "Projeto",
  };
  const eventLabels = {
    iniciou_trilha: ["route", "Iniciou uma trilha"],
    abriu_aula: ["menu_book", "Abriu uma aula"],
    concluiu_aula: ["task_alt", "Concluiu uma aula"],
    iniciou_atividade: ["quiz", "Iniciou uma atividade"],
    respondeu: ["edit", "Respondeu uma questão"],
    concluiu_atividade: ["workspace_premium", "Concluiu uma atividade"],
    salvou: ["bookmark", "Salvou para revisar"],
    removeu_salvo: ["bookmark_remove", "Removeu dos salvos"],
    anotou: ["sticky_note_2", "Atualizou suas anotações"],
  };
  let toastTimer;
  const notify = (message, type = "success") => {
    const node = document.querySelector("[data-study-toast]");
    if (!node) return;
    node.textContent = message;
    node.className = `toast visible ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      node.className = "toast";
    }, 3600);
  };
  const initials = (name = "") =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "AL";
  const active = (key) => (page === key ? "active" : "");

  const shell = () => {
    root.innerHTML = `<main class="study-main"><header class="study-topbar"><button class="icon-button menu-button" type="button" data-study-menu aria-label="Abrir navegação" aria-expanded="false"><span class="material-symbols-outlined">menu</span></button><div class="study-topbar-copy"><strong>Central de aprendizagem</strong><span>Conteúdo, prática e evolução conectados</span></div><div class="study-topbar-actions"><a class="icon-button" href="${routes.salvos}" aria-label="Conteúdos salvos"><span class="material-symbols-outlined">bookmark</span></a><a class="icon-button" href="${routes.notificacoes}" aria-label="Notificações"><span class="material-symbols-outlined">notifications</span></a><a class="icon-button" href="${routes.perfil}" aria-label="Perfil"><span class="material-symbols-outlined">person</span></a></div></header><div class="study-content" data-study-content></div></main><div class="toast" data-study-toast role="status" aria-live="polite"></div>`;
    const button = document.querySelector("[data-study-menu]");
    button.addEventListener("click", () => {
      document.body.classList.toggle("study-menu-open");
      button.setAttribute(
        "aria-expanded",
        String(document.body.classList.contains("study-menu-open")),
      );
    });
  };
  const content = () => document.querySelector("[data-study-content]");
  const loading = () => {
    content().innerHTML =
      '<section class="panel loading-state" aria-live="polite"><span class="loader"></span><p>Carregando seus estudos...</p></section>';
  };
  const empty = (title, message, icon = "route") =>
    `<section class="panel empty-state"><span class="material-symbols-outlined">${icon}</span><h2>${escapeHTML(title)}</h2><p>${escapeHTML(message)}</p></section>`;
  const error = (message) =>
    `<section class="panel error-state" role="alert"><span class="material-symbols-outlined">cloud_off</span><h2>Não foi possível carregar</h2><p>${escapeHTML(message)}</p><button class="button primary" type="button" data-study-retry>Tentar novamente</button></section>`;
  const progress = (value, label = "Progresso") =>
    `<div class="progress" role="progressbar" aria-label="${escapeHTML(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><span style="width:${Math.max(0, Math.min(100, value))}%"></span></div>`;

  const renderTrailCard = (trail) => {
    const cover = safeUrl(trail.capa_url);
    return `<article class="panel trail-card"><div class="trail-cover ${cover ? "has-image" : ""}"${cover ? ` style="background-image:url('${escapeHTML(cover)}')"` : ""}><span class="trail-subject">${escapeHTML(trail.materia)}</span><span class="difficulty">${escapeHTML(trail.dificuldade || "inicial")}</span></div><div class="trail-card-body"><h2>${escapeHTML(trail.titulo)}</h2><p>${escapeHTML(trail.descricao || "Descrição ainda não publicada.")}</p><div class="trail-meta"><span><span class="material-symbols-outlined">format_list_numbered</span>${trail.atividades?.length || 0} etapas</span><span><span class="material-symbols-outlined">schedule</span>${Number(trail.duracao_estimada_min || 0)} min</span>${trail.serie ? `<span><span class="material-symbols-outlined">school</span>${trail.serie}º ano</span>` : ""}</div><div class="progress-wrap"><div class="progress-label"><span>${trail.concluidas || 0} concluídas</span><strong>${trail.progressoPercentual || 0}%</strong></div>${progress(trail.progressoPercentual || 0, `Progresso em ${trail.titulo}`)}</div><footer><span class="xp-badge"><span class="material-symbols-outlined">bolt</span>${Number(trail.recompensa_xp || 0)} XP</span><a href="${moduleRoot}trilha/index.html?trilha=${encodeURIComponent(trail.id)}">${trail.progressoPercentual ? "Continuar" : "Começar"}<span class="material-symbols-outlined">arrow_forward</span></a></footer></div></article>`;
  };

  const addProgrammingLaunch = () => {
    if (requestedSubjectCode && requestedSubjectCode !== "tecnico_informatica") return;
    const launch = document.createElement("section");
    launch.className = "pl-catalog-launch";
    launch.setAttribute("aria-label", "Trilhas de programação");
    launch.innerHTML = '<div><p class="eyebrow">INFORMÁTICA · APRENDER FAZENDO</p><h2>Seu primeiro programa pode começar aqui.</h2><p>Python e C++: 24 etapas, 6 mini projetos, execução real e desafios com feedback. Prática com progresso salvo neste navegador.</p></div><div><a href="' + moduleRoot + 'ide/index.html?language=python">Começar Python</a><a href="' + moduleRoot + 'ide/index.html?language=cpp">Começar C++</a></div>';
    content().querySelector(".page-heading,.catalog-hero")?.after(launch);
  };
  const renderCatalog = async () => {
    const trails = await api().listStudyCatalog();
    if (!trails.length) {
      content().innerHTML = `<header class="page-heading"><div><p class="eyebrow">TRILHAS E ESTUDOS</p><h1>Catálogo de trilhas</h1><p>Os conteúdos publicados para sua turma aparecerão aqui.</p></div></header>${empty("Nenhuma trilha publicada", "Quando um professor publicar uma trilha para sua turma, ela ficará disponível neste catálogo.", "inventory_2")}`;
      addProgrammingLaunch();
      return;
    }
    const subjects = [
      ...new Set(trails.map((item) => item.materia).filter(Boolean)),
    ].sort();
    const areas = [
      ...new Set(trails.map((item) => item.area_conhecimento).filter(Boolean)),
    ].sort();
    const completed = trails.reduce(
      (sum, item) => sum + Number(item.concluidas || 0),
      0,
    );
    content().innerHTML = `<section class="catalog-hero"><div><p class="eyebrow">TRILHAS DO ENSINO MÉDIO</p><h1>Escolha seu próximo território de descoberta.</h1><p>Encontre conteúdos publicados para sua turma e continue exatamente de onde parou.</p></div><div class="catalog-stats"><div><strong>${trails.length}</strong><span>trilhas disponíveis</span></div><div><strong>${completed}</strong><span>etapas concluídas</span></div></div></section><section class="panel filters" aria-label="Filtros do catálogo"><label class="search-field"><span class="material-symbols-outlined">search</span><input type="search" data-catalog-search placeholder="Buscar por título, matéria ou descritor" aria-label="Buscar trilhas"></label><label class="select-field"><span class="material-symbols-outlined">book_2</span><select data-catalog-subject aria-label="Filtrar por matéria"><option value="">Todas as matérias</option>${subjects.map((item) => `<option>${escapeHTML(item)}</option>`).join("")}</select></label><label class="select-field"><span class="material-symbols-outlined">category</span><select data-catalog-area aria-label="Filtrar por área"><option value="">Todas as áreas</option>${areas.map((item) => `<option>${escapeHTML(item)}</option>`).join("")}</select></label><label class="select-field"><span class="material-symbols-outlined">signal_cellular_alt</span><select data-catalog-difficulty aria-label="Filtrar por dificuldade"><option value="">Todos os níveis</option><option value="inicial">Inicial</option><option value="intermediaria">Intermediária</option><option value="avancada">Avançada</option></select></label></section><section class="trail-grid" data-trail-grid aria-live="polite">${trails.map(renderTrailCard).join("")}</section>`;
    addProgrammingLaunch();
    const filter = () => {
      const search = document
        .querySelector("[data-catalog-search]")
        .value.trim()
        .toLowerCase();
      const subject = document.querySelector("[data-catalog-subject]").value;
      const area = document.querySelector("[data-catalog-area]").value;
      const difficulty = document.querySelector(
        "[data-catalog-difficulty]",
      ).value;
      const filtered = trails.filter(
        (trail) =>
          (!search ||
            `${trail.titulo} ${trail.descricao || ""} ${trail.materia} ${trail.descritor_sedu || ""}`
              .toLowerCase()
              .includes(search)) &&
          (!subject || trail.materia === subject) &&
          (!area || trail.area_conhecimento === area) &&
          (!difficulty || trail.dificuldade === difficulty),
      );
      document.querySelector("[data-trail-grid]").innerHTML = filtered.length
        ? filtered.map(renderTrailCard).join("")
        : empty(
            "Nenhuma trilha encontrada",
            "Altere os filtros para encontrar outros conteúdos.",
            "search_off",
          );
    };
    document
      .querySelectorAll(
        "[data-catalog-search],[data-catalog-subject],[data-catalog-area],[data-catalog-difficulty]",
      )
      .forEach((field) =>
        field.addEventListener(
          field.tagName === "INPUT" ? "input" : "change",
          filter,
        ),
      );
    const requestedLabel = requestedSubjectLabels[requestedSubjectCode];
    const subjectSelect = document.querySelector("[data-catalog-subject]");
    if (
      requestedLabel &&
      [...subjectSelect.options].some((option) => option.value === requestedLabel)
    ) {
      subjectSelect.value = requestedLabel;
      filter();
    }
  };

  const renderTrail = async () => {
    const id = params.get("trilha");
    if (!id) throw new Error("Trilha não informada.");
    const [trail, catalog] = await Promise.all([
      api().getStudyTrail(id),
      api().listStudyCatalog(),
    ]);
    if (!trail) {
      content().innerHTML = empty(
        "Trilha indisponível",
        "Ela pode ter sido removida ou ainda não foi publicada para sua turma.",
        "lock",
      );
      return;
    }
    const completed = trail.atividades.filter(
      (item) => item.progresso?.concluida,
    ).length;
    const percent = trail.atividades.length
      ? Math.round((completed / trail.atividades.length) * 100)
      : 0;
    const catalogById = new Map(catalog.map((item) => [item.id, item]));
    const unmetTrailPrereqs = (trail.prerequisitos || []).filter(
      (item) =>
        (catalogById.get(item.prerequisito_trilha_id)?.progressoPercentual ||
          0) < 100,
    );
    const lockedTrail = unmetTrailPrereqs.length > 0;
    content().innerHTML = `<section class="trail-hero"><div><p class="eyebrow">${escapeHTML(trail.materia)}${trail.descritor_sedu ? ` · ${escapeHTML(trail.descritor_sedu)}` : ""}</p><h1>${escapeHTML(trail.titulo)}</h1><p>${escapeHTML(trail.descricao || "Descrição ainda não publicada.")}</p><div class="trail-tags">${trail.serie ? `<span>${trail.serie}º ano</span>` : ""}${trail.trimestre ? `<span>${trail.trimestre}º trimestre</span>` : ""}<span>${escapeHTML(trail.dificuldade || "inicial")}</span>${(trail.tags || []).map((tag) => `<span>${escapeHTML(tag)}</span>`).join("")}</div></div><div class="trail-score"><strong>${percent}%</strong><span>${completed} de ${trail.atividades.length} etapas</span></div></section><div class="trail-layout"><section class="panel"><div class="panel-header"><div><h2>Etapas da trilha</h2><p>Siga a sequência e desbloqueie os próximos conteúdos.</p></div><button class="icon-button" type="button" data-save-trail aria-label="${trail.salvo ? "Remover trilha dos salvos" : "Salvar trilha"}"><span class="material-symbols-outlined">${trail.salvo ? "bookmark_added" : "bookmark_add"}</span></button></div><div class="steps">${
      trail.atividades.length
        ? trail.atividades
            .map((item, index) => {
              const prereq = trail.atividades.find(
                (candidate) => candidate.id === item.prerequisito_atividade_id,
              );
              const locked =
                lockedTrail || Boolean(prereq && !prereq.progresso?.concluida);
              const route = ["atividade", "quiz", "projeto"].includes(
                item.tipo_conteudo,
              )
                ? "atividade"
                : "aula";
              return `<article class="step ${item.progresso?.concluida ? "complete" : ""} ${locked ? "locked" : ""}"><span class="step-index material-symbols-outlined">${item.progresso?.concluida ? "check" : locked ? "lock" : route === "aula" ? "menu_book" : "quiz"}</span><div><h3>${index + 1}. ${escapeHTML(item.titulo)}</h3><p>${escapeHTML(item.descricao || typeLabel[item.tipo_conteudo] || "Etapa de estudo")}</p><div class="step-meta"><span>${typeLabel[item.tipo_conteudo] || "Etapa"}</span><span>${Number(item.duracao_minutos || 0)} min</span><span>+${Number(item.recompensa_xp || 0)} XP</span></div></div>${locked ? '<span class="material-symbols-outlined">lock</span>' : `<a class="button secondary" href="${moduleRoot}${route}/index.html?atividade=${encodeURIComponent(item.id)}">${item.progresso?.concluida ? "Rever" : "Abrir"}</a>`}</article>`;
            })
            .join("")
        : empty(
            "Sem etapas publicadas",
            "O professor ainda não publicou as etapas desta trilha.",
            "format_list_numbered",
          )
    }</div></section><aside class="side-stack"><section class="panel info-panel"><h2>Sobre esta trilha</h2><div class="info-list"><div><span>Duração estimada</span><strong>${Number(trail.duracao_estimada_min || 0)} min</strong></div><div><span>Recompensa</span><strong>${Number(trail.recompensa_xp || 0)} XP</strong></div><div><span>Seu XP total</span><strong>${Number(trail.xpTotal || 0)} XP</strong></div><div><span>Tipo</span><strong>${escapeHTML(trail.tipo)}</strong></div></div></section><section class="panel info-panel"><h2>Pré-requisitos</h2>${
      trail.prerequisitos?.length
        ? trail.prerequisitos
            .map((item) => {
              const required = item.trilhas;
              const done =
                (catalogById.get(item.prerequisito_trilha_id)
                  ?.progressoPercentual || 0) === 100;
              return `<div class="prerequisite"><strong>${done ? "✓" : "○"} ${escapeHTML(required?.titulo || "Trilha necessária")}</strong><br><span>${done ? "Concluída" : "Conclua antes de começar"}</span></div>`;
            })
            .join("")
        : '<p class="prerequisite">Nenhum pré-requisito.</p>'
    }</section></aside></div>`;
    document
      .querySelector("[data-save-trail]")
      .addEventListener("click", async (event) => {
        event.currentTarget.disabled = true;
        try {
          trail.salvo = await api().toggleSavedContent({ trailId: trail.id });
          event.currentTarget.querySelector("span").textContent = trail.salvo
            ? "bookmark_added"
            : "bookmark_add";
          notify(
            trail.salvo
              ? "Trilha salva para revisar."
              : "Trilha removida dos salvos.",
          );
        } catch (err) {
          notify(err.message, "error");
        } finally {
          event.currentTarget.disabled = false;
        }
      });
    api()
      .recordStudyEvent({ trailId: trail.id, event: "iniciou_trilha" })
      .catch(() => {});
  };

  const renderBlocks = (blocks = []) =>
    blocks
      .map((block) => {
        const text = escapeHTML(block.texto || block.text || "");
        if (block.tipo === "titulo") return `<h2>${text}</h2>`;
        if (block.tipo === "subtitulo") return `<h3>${text}</h3>`;
        if (block.tipo === "citacao") return `<blockquote>${text}</blockquote>`;
        if (block.tipo === "lista")
          return `<ul>${(block.itens || []).map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`;
        if (block.tipo === "imagem") {
          const url = safeUrl(block.url);
          return url
            ? `<figure><img src="${escapeHTML(url)}" alt="${escapeHTML(block.alt || "")}">${block.legenda ? `<figcaption>${escapeHTML(block.legenda)}</figcaption>` : ""}</figure>`
            : "";
        }
        if (block.tipo === "codigo") return `<pre><code>${text}</code></pre>`;
        if (block.tipo === "destaque")
          return `<div class="callout">${text}</div>`;
        return `<p>${text}</p>`;
      })
      .join("");

  const renderLesson = async () => {
    const id = params.get("atividade");
    if (!id) throw new Error("Aula não informada.");
    const activity = await api().getStudyActivity(id);
    if (!activity) {
      content().innerHTML = empty(
        "Aula indisponível",
        "Este conteúdo não está publicado para sua turma.",
        "lock",
      );
      return;
    }
    const blocks = Array.isArray(activity.conteudo?.blocos)
      ? activity.conteudo.blocos
      : [];
    const video = safeUrl(activity.video_url);
    const hasPseudoCode = blocks.some((block) => block.tipo === "codigo");
    const ideUrl = `${moduleRoot}ide/index.html?atividade=${encodeURIComponent(id)}`;
    const practiceCard = hasPseudoCode
      ? `<section class="lesson-practice-card"><div><span class="material-symbols-outlined">terminal</span><div><strong>Agora é sua vez</strong><p>Use o roteiro como referência e construa a lógica com suas próprias decisões.</p></div></div><a class="button primary" href="${ideUrl}"><span class="material-symbols-outlined">code</span>Começar estrutura Pseudo</a></section>`
      : "";
    const ideButton = hasPseudoCode
      ? `<a class="button ide-access-button" href="${ideUrl}"><span class="material-symbols-outlined">terminal</span>Acessar IDE</a>`
      : "";
    content().innerHTML = `<div class="lesson-layout"><article class="panel lesson-article"><nav class="lesson-breadcrumb"><a href="${moduleRoot}trilha/index.html?trilha=${encodeURIComponent(activity.trilha_id)}">${escapeHTML(activity.trilhas?.titulo || "Trilha")}</a><span class="material-symbols-outlined">chevron_right</span><span>Aula</span></nav><p class="eyebrow">${escapeHTML(activity.trilhas?.materia || "")}${activity.trilhas?.descritor_sedu ? ` · ${escapeHTML(activity.trilhas.descritor_sedu)}` : ""}</p><h1>${escapeHTML(activity.titulo)}</h1><p class="lesson-lead">${escapeHTML(activity.descricao || "")}</p>${video ? `<a class="button secondary" href="${escapeHTML(video)}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-outlined">play_circle</span>Abrir vídeo da aula</a>` : ""}<div class="content-blocks">${blocks.length ? renderBlocks(blocks) : empty("Conteúdo em preparação", "O professor ainda não publicou os blocos desta aula.", "edit_note")}</div>${practiceCard}</article><aside class="lesson-tools"><section class="panel info-panel"><h2>Seu estudo</h2><div class="info-list"><div><span>Duração</span><strong>${Number(activity.duracao_minutos || 0)} min</strong></div><div><span>Recompensa</span><strong>+${Number(activity.recompensa_xp || 0)} XP</strong></div><div><span>Estado</span><strong data-lesson-state>${activity.progresso?.concluida ? "Concluída" : "Em andamento"}</strong></div></div>${ideButton}<button class="button primary" type="button" data-complete-lesson ${activity.progresso?.concluida ? "disabled" : ""}><span class="material-symbols-outlined">task_alt</span>${activity.progresso?.concluida ? "Aula concluída" : "Concluir aula"}</button><button class="button ghost" type="button" data-save-activity><span class="material-symbols-outlined">${activity.salvo ? "bookmark_added" : "bookmark_add"}</span>${activity.salvo ? "Salvo" : "Salvar para revisar"}</button></section><section class="panel info-panel notes-panel"><h2>Minhas anotações</h2><textarea data-lesson-notes maxlength="10000" placeholder="Registre suas ideias e dúvidas...">${escapeHTML(activity.anotacao?.texto || "")}</textarea><button class="button secondary" type="button" data-save-notes><span class="material-symbols-outlined">save</span>Salvar anotações</button></section><section class="panel info-panel"><h2>Materiais</h2><div class="materials">${
      activity.materiais.length
        ? activity.materiais
            .map((item) => {
              const url = safeUrl(item.url);
              return url
                ? `<a class="material-link" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-outlined">${item.tipo === "pdf" ? "picture_as_pdf" : item.tipo === "video" ? "smart_display" : "attach_file"}</span>${escapeHTML(item.titulo)}</a>`
                : "";
            })
            .join("")
        : '<p class="prerequisite">Nenhum material complementar.</p>'
    }</div></section></aside></div>`;
    document
      .querySelector("[data-save-notes]")
      .addEventListener("click", async (event) => {
        event.currentTarget.disabled = true;
        try {
          await api().saveLessonNotes(
            id,
            document.querySelector("[data-lesson-notes]").value,
          );
          notify("Anotações salvas no Supabase.");
        } catch (err) {
          notify(err.message, "error");
        } finally {
          event.currentTarget.disabled = false;
        }
      });
    document
      .querySelector("[data-complete-lesson]")
      .addEventListener("click", async (event) => {
        event.currentTarget.disabled = true;
        try {
          await api().completeLesson(id);
          event.currentTarget.innerHTML =
            '<span class="material-symbols-outlined">task_alt</span>Aula concluída';
          document.querySelector("[data-lesson-state]").textContent =
            "Concluída";
          notify(`Aula concluída. +${Number(activity.recompensa_xp || 0)} XP`);
        } catch (err) {
          event.currentTarget.disabled = false;
          notify(err.message, "error");
        }
      });
    document
      .querySelector("[data-save-activity]")
      .addEventListener("click", async (event) => {
        event.currentTarget.disabled = true;
        try {
          activity.salvo = await api().toggleSavedContent({ activityId: id });
          event.currentTarget.innerHTML = `<span class="material-symbols-outlined">${activity.salvo ? "bookmark_added" : "bookmark_add"}</span>${activity.salvo ? "Salvo" : "Salvar para revisar"}`;
          notify(activity.salvo ? "Aula salva." : "Aula removida dos salvos.");
        } catch (err) {
          notify(err.message, "error");
        } finally {
          event.currentTarget.disabled = false;
        }
      });
    api()
      .recordStudyEvent({
        trailId: activity.trilha_id,
        activityId: id,
        event: "abriu_aula",
      })
      .catch(() => {});
  };

  const renderIde = async () => {
    const id = params.get("atividade");
    const activity = id ? await api().getStudyActivity(id) : null;
    if (id && !activity) throw new Error("Esta prática não está disponível.");
    content().innerHTML = '<nav class="lesson-breadcrumb"><a href="' + moduleRoot + (id ? 'aula/index.html?atividade=' + encodeURIComponent(id) : 'index.html?materia=tecnico_informatica') + '">' + (id ? escapeHTML(activity.titulo) : 'Voltar às trilhas') + '</a></nav><div data-programming-lab></div>';
    programmingLab?.dispose();
    const { mountProgrammingLab } = await import("../../../shared/programming-lab/programming-lab.js");
    programmingLab = mountProgrammingLab(content().querySelector("[data-programming-lab]"), { mode: "student", userId: studyUserId });
  };
  const renderPseudoIde = async () => {
    const id = params.get("atividade");
    if (!id) throw new Error("Aula não informada para o IDE.");
    const activity = await api().getStudyActivity(id);
    if (!activity) throw new Error("Esta prática não está disponível.");
    const trail = await api().getStudyTrail(activity.trilha_id);
    const firstLessonSummary = trail?.atividades?.find((item) => item.ordem === 1);
    const firstLesson = firstLessonSummary
      ? await api().getStudyActivity(firstLessonSummary.id)
      : null;
    const sourceBlocks = Array.isArray(firstLesson?.conteudo?.blocos)
      ? firstLesson.conteudo.blocos
      : [];
    const sourceNotes = firstLesson?.anotacao?.texto || "";
    const storageKey = `ominisaber:pseudo:v2:${id}`;
    const starter = `INICIO\n  // Leia os dados do pedido\n  \n  // Verifique o estoque antes de calcular\n  \n  // Mostre o resultado para o atendente\n  \nFIM`;
    const savedCode = localStorage.getItem(storageKey) || starter;
    const sourceSummary = sourceBlocks
      .filter((block) => ["texto", "lista", "destaque"].includes(block.tipo))
      .slice(0, 4)
      .map((block) =>
        block.tipo === "lista"
          ? `<ul>${(block.itens || []).map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`
          : `<p>${escapeHTML(block.texto || "")}</p>`,
      )
      .join("");

    content().innerHTML = `<div class="ide-page"><header class="ide-heading"><div><nav class="lesson-breadcrumb"><a href="${moduleRoot}aula/index.html?atividade=${encodeURIComponent(id)}">${escapeHTML(activity.titulo)}</a><span class="material-symbols-outlined">chevron_right</span><span>Laboratório Pseudo</span></nav><p class="eyebrow">PRÁTICA GUIADA · INFORMÁTICA</p><h1>Construa o fluxo da cantina</h1><p>Transforme o material das aulas em uma solução que você consegue explicar, testar e melhorar.</p></div><div class="ide-heading-actions"><button class="button secondary" type="button" data-open-tutorial><span class="material-symbols-outlined">school</span>Ver tutorial</button><a class="button ghost" href="${moduleRoot}aula/index.html?atividade=${encodeURIComponent(id)}"><span class="material-symbols-outlined">arrow_back</span>Voltar à aula</a></div></header><section class="ide-mission"><div class="ide-mission-icon"><span class="material-symbols-outlined">flag</span></div><div><span>MISSÃO ATUAL</span><h2>Atenda um pedido sem perder nenhuma regra</h2><p>Seu algoritmo deve ler o pedido, validar estoque, calcular o total, considerar o desconto e informar o resultado.</p></div><div class="ide-mission-progress"><strong data-ide-progress>0/5</strong><span>critérios atendidos</span></div></section><div class="ide-workspace"><aside class="ide-reference panel"><div class="ide-tabs" role="tablist" aria-label="Referências"><button class="active" type="button" data-reference-tab="mission">Missão</button><button type="button" data-reference-tab="lesson">Aula 1</button><button type="button" data-reference-tab="notes">Anotações</button></div><div class="ide-reference-panel active" data-reference-panel="mission"><h2>O que sua solução precisa fazer</h2><ol><li>Ler os dados do pedido.</li><li>Verificar se há estoque.</li><li>Calcular subtotal e desconto.</li><li>Confirmar pagamento.</li><li>Informar sucesso ou erro.</li></ol><div class="ide-tip"><span class="material-symbols-outlined">lightbulb</span><p>Não copie o exemplo da aula. Use-o para decidir a ordem dos seus próprios passos.</p></div></div><div class="ide-reference-panel" data-reference-panel="lesson"><h2>${escapeHTML(firstLesson?.titulo || "Material da Aula 1")}</h2>${sourceSummary || "<p>Revise a primeira aula antes de começar.</p>"}<a href="${moduleRoot}aula/index.html?atividade=${encodeURIComponent(firstLesson?.id || id)}">Reabrir Aula 1 <span class="material-symbols-outlined">open_in_new</span></a></div><div class="ide-reference-panel" data-reference-panel="notes"><h2>Suas anotações da Aula 1</h2>${sourceNotes ? `<p class="student-notes">${escapeHTML(sourceNotes)}</p><button class="button secondary" type="button" data-import-notes><span class="material-symbols-outlined">post_add</span>Levar para o rascunho</button>` : '<div class="ide-empty-notes"><span class="material-symbols-outlined">sticky_note_2</span><p>Você ainda não salvou anotações na Aula 1.</p><a href="' + moduleRoot + 'aula/index.html?atividade=' + encodeURIComponent(firstLesson?.id || id) + '">Fazer anotações</a></div>'}</div></aside><section class="ide-editor panel"><header class="ide-editor-head"><div><span class="ide-status-dot"></span><strong>estrutura-cantina.pseudo</strong><span data-save-status>Salvo neste dispositivo</span></div><div><button class="icon-button" type="button" data-copy-code aria-label="Copiar pseudocódigo"><span class="material-symbols-outlined">content_copy</span></button><button class="icon-button" type="button" data-reset-code aria-label="Recomeçar pseudocódigo"><span class="material-symbols-outlined">restart_alt</span></button></div></header><div class="ide-shortcuts" aria-label="Blocos rápidos"><button type="button" data-snippet="ler pedido">+ Entrada</button><button type="button" data-snippet="SE condicao ENTAO\n    // ação\n  SENAO\n    // alternativa\n  FIMSE">+ Condição</button><button type="button" data-snippet="total <- subtotal - desconto">+ Cálculo</button><button type="button" data-snippet='escrever "Resultado"'>+ Saída</button></div><div class="ide-code-wrap"><div class="ide-line-numbers" data-line-numbers aria-hidden="true"></div><textarea data-pseudo-editor spellcheck="false" aria-label="Editor de pseudocódigo">${escapeHTML(savedCode)}</textarea></div><footer class="ide-editor-footer"><span><kbd>Ctrl</kbd> + <kbd>Enter</kbd> para executar</span><button class="button primary" type="button" data-run-code><span class="material-symbols-outlined">play_arrow</span>Executar teste</button></footer></section><aside class="ide-feedback"><section class="panel ide-checklist"><header><div><span>VALIDAÇÃO</span><h2>Checklist da solução</h2></div><strong data-score-badge>0%</strong></header><div data-code-checks></div></section><section class="panel ide-simulator"><header><span class="material-symbols-outlined">tune</span><div><span>TESTE DE MESA</span><h2>Simule um pedido</h2></div></header><label>Estoque disponível<select data-sim-stock><option value="sim">Sim</option><option value="nao">Não</option></select></label><div class="ide-field-row"><label>Subtotal<input type="number" min="0" step="0.01" value="24" data-sim-subtotal></label><label>Desconto<select data-sim-discount><option value="nao">Não</option><option value="sim">10%</option></select></label></div><div class="ide-console" data-ide-console><span>Console</span><p>Execute seu pseudocódigo para observar o resultado.</p></div></section></aside></div></div><dialog class="ide-tutorial" data-ide-tutorial><form method="dialog"><button class="icon-button ide-tutorial-close" value="cancel" aria-label="Fechar tutorial"><span class="material-symbols-outlined">close</span></button><div class="ide-tutorial-step active" data-tutorial-step="0"><span class="tutorial-count">1 de 3</span><div class="tutorial-icon"><span class="material-symbols-outlined">menu_book</span></div><h2>Consulte antes de programar</h2><p>Use as abas Missão, Aula 1 e Anotações para recuperar as regras sem receber a solução pronta.</p></div><div class="ide-tutorial-step" data-tutorial-step="1"><span class="tutorial-count">2 de 3</span><div class="tutorial-icon"><span class="material-symbols-outlined">code_blocks</span></div><h2>Monte com blocos ou escreva livremente</h2><p>Os atalhos inserem estruturas comuns no cursor. Você decide os nomes, a ordem e as condições.</p></div><div class="ide-tutorial-step" data-tutorial-step="2"><span class="tutorial-count">3 de 3</span><div class="tutorial-icon"><span class="material-symbols-outlined">experiment</span></div><h2>Teste caminhos diferentes</h2><p>Execute com e sem estoque, altere valores e use o checklist para encontrar o que ainda falta.</p></div><div class="ide-tutorial-dots" aria-hidden="true"><span class="active"></span><span></span><span></span></div><div class="ide-tutorial-actions"><button class="button ghost" type="button" data-tutorial-prev disabled>Voltar</button><button class="button primary" type="button" data-tutorial-next>Próximo</button></div></form></dialog>`;

    const editor = document.querySelector("[data-pseudo-editor]");
    const lineNumbers = document.querySelector("[data-line-numbers]");
    const saveStatus = document.querySelector("[data-save-status]");
    const checks = [
      ["inicio", "Começa e termina o algoritmo", (code) => /\bINICIO\b/i.test(code) && /\bFIM\b/i.test(code)],
      ["entrada", "Lê os dados do pedido", (code) => /\b(ler|receber)\b/i.test(code)],
      ["decisao", "Decide com base no estoque", (code) => /\bSE\b[\s\S]*\bENTAO\b/i.test(code) && /estoque/i.test(code)],
      ["calculo", "Calcula o valor do pedido", (code) => /(<-|calcular|subtotal|total)/i.test(code)],
      ["saida", "Informa sucesso ou erro", (code) => /\b(escrever|informar|exibir)\b/i.test(code)],
    ];
    let saveTimer;
    const updateLines = () => {
      const count = editor.value.split("\n").length;
      lineNumbers.innerHTML = Array.from({ length: count }, (_, index) => `<span>${index + 1}</span>`).join("");
      lineNumbers.scrollTop = editor.scrollTop;
    };
    const evaluateCode = () => {
      const results = checks.map(([, , test]) => test(editor.value));
      const completed = results.filter(Boolean).length;
      const score = Math.round((completed / checks.length) * 100);
      document.querySelector("[data-ide-progress]").textContent = `${completed}/${checks.length}`;
      document.querySelector("[data-score-badge]").textContent = `${score}%`;
      document.querySelector("[data-code-checks]").innerHTML = checks
        .map(([, label], index) => `<div class="ide-check ${results[index] ? "done" : ""}"><span class="material-symbols-outlined">${results[index] ? "check_circle" : "radio_button_unchecked"}</span><span>${escapeHTML(label)}</span></div>`)
        .join("");
      return { completed, score };
    };
    const saveCode = () => {
      localStorage.setItem(storageKey, editor.value);
      saveStatus.textContent = "Salvo agora";
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => (saveStatus.textContent = "Salvo neste dispositivo"), 1300);
    };
    const insertSnippet = (snippet) => {
      let start = editor.selectionStart;
      let end = editor.selectionEnd;
      if (start === 0 || start === editor.value.length) {
        const finalBlock = editor.value.lastIndexOf("\nFIM");
        if (finalBlock > 0) start = end = finalBlock;
      }
      const prefix = start && editor.value[start - 1] !== "\n" ? "\n  " : "  ";
      editor.value = `${editor.value.slice(0, start)}${prefix}${snippet}${editor.value.slice(end)}`;
      editor.focus();
      editor.selectionStart = editor.selectionEnd = start + prefix.length + snippet.length;
      updateLines();
      evaluateCode();
      saveCode();
    };
    const runCode = () => {
      const validation = evaluateCode();
      const stock = document.querySelector("[data-sim-stock]").value === "sim";
      const subtotal = Number(document.querySelector("[data-sim-subtotal]").value || 0);
      const discount = document.querySelector("[data-sim-discount]").value === "sim";
      const output = document.querySelector("[data-ide-console]");
      if (validation.completed < 3) {
        output.className = "ide-console warning";
        output.innerHTML = `<span>Console · estrutura incompleta</span><p>Seu algoritmo ainda não consegue percorrer o pedido. Observe os itens abertos no checklist e escolha o próximo passo.</p>`;
        return;
      }
      const total = discount ? subtotal * 0.9 : subtotal;
      output.className = `ide-console ${stock ? "success" : "error"}`;
      output.innerHTML = stock
        ? `<span>Console · pedido aprovado</span><p>Estoque confirmado → total calculado: <strong>${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>${discount ? " com desconto de 10%" : ""}.</p>`
        : `<span>Console · caminho alternativo</span><p>Item indisponível. O pedido não deve seguir para pagamento.</p>`;
      api().recordStudyEvent({ trailId: activity.trilha_id, activityId: id, event: "testou_pseudocodigo", details: { criterios: validation.completed, estoque: stock } }).catch(() => {});
    };

    editor.addEventListener("input", () => {
      updateLines();
      evaluateCode();
      saveCode();
    });
    editor.addEventListener("scroll", updateLines);
    editor.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        runCode();
      }
      if (event.key === "Tab") {
        event.preventDefault();
        insertSnippet("  ");
      }
    });
    document.querySelectorAll("[data-snippet]").forEach((button) =>
      button.addEventListener("click", () => insertSnippet(button.dataset.snippet)),
    );
    document.querySelector("[data-run-code]").addEventListener("click", runCode);
    document.querySelector("[data-copy-code]").addEventListener("click", async () => {
      await navigator.clipboard.writeText(editor.value);
      notify("Pseudocódigo copiado.");
    });
    document.querySelector("[data-reset-code]").addEventListener("click", () => {
      if (!window.confirm("Recomeçar com a estrutura inicial?")) return;
      editor.value = starter;
      updateLines();
      evaluateCode();
      saveCode();
    });
    document.querySelector("[data-import-notes]")?.addEventListener("click", () =>
      insertSnippet(`// Minhas anotações da Aula 1:\n  // ${sourceNotes.replace(/\n/g, "\n  // ")}`),
    );
    document.querySelectorAll("[data-reference-tab]").forEach((button) =>
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-reference-tab]").forEach((item) => item.classList.toggle("active", item === button));
        document.querySelectorAll("[data-reference-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.referencePanel === button.dataset.referenceTab));
      }),
    );

    const tutorial = document.querySelector("[data-ide-tutorial]");
    let tutorialStep = 0;
    const drawTutorial = () => {
      document.querySelectorAll("[data-tutorial-step]").forEach((step) => step.classList.toggle("active", Number(step.dataset.tutorialStep) === tutorialStep));
      document.querySelectorAll(".ide-tutorial-dots span").forEach((dot, index) => dot.classList.toggle("active", index === tutorialStep));
      document.querySelector("[data-tutorial-prev]").disabled = tutorialStep === 0;
      document.querySelector("[data-tutorial-next]").textContent = tutorialStep === 2 ? "Começar a programar" : "Próximo";
    };
    document.querySelector("[data-open-tutorial]").addEventListener("click", () => {
      tutorialStep = 0;
      drawTutorial();
      tutorial.showModal();
    });
    document.querySelector("[data-tutorial-prev]").addEventListener("click", () => {
      tutorialStep = Math.max(0, tutorialStep - 1);
      drawTutorial();
    });
    document.querySelector("[data-tutorial-next]").addEventListener("click", () => {
      if (tutorialStep === 2) {
        localStorage.setItem("ominisaber:pseudo-tutorial-seen", "1");
        tutorial.close();
        editor.focus();
        return;
      }
      tutorialStep += 1;
      drawTutorial();
    });
    updateLines();
    evaluateCode();
    if (!localStorage.getItem("ominisaber:pseudo-tutorial-seen")) tutorial.showModal();
    api().recordStudyEvent({ trailId: activity.trilha_id, activityId: id, event: "abriu_ide_pseudocodigo" }).catch(() => {});
  };

  const renderActivity = async () => {
    const id = params.get("atividade");
    if (!id) throw new Error("Atividade não informada.");
    const activity = await api().getStudyActivity(id);
    if (!activity) {
      content().innerHTML = empty(
        "Atividade indisponível",
        "Ela pode não estar publicada para sua turma.",
        "lock",
      );
      return;
    }
    if (!activity.questoes.length) {
      content().innerHTML = `<header class="page-heading"><div><p class="eyebrow">${escapeHTML(activity.trilhas?.materia || "")}</p><h1>${escapeHTML(activity.titulo)}</h1><p>${escapeHTML(activity.descricao || "")}</p></div></header>${empty("Questões em preparação", "O professor ainda não publicou questões para esta atividade.", "quiz")}`;
      return;
    }
    let attempt = await api().getActiveActivityAttempt(id);
    if (attempt?.status === "concluida") {
      content().innerHTML = `<div class="activity-shell">${empty("Atividade já concluída", "Seu resultado está disponível. Você também pode iniciar uma nova tentativa.", "task_alt")}<div class="question-actions"><a class="button secondary" href="${moduleRoot}resultado/index.html?atividade=${encodeURIComponent(id)}">Ver resultado</a><button class="button primary" type="button" data-retry-activity>Nova tentativa</button></div></div>`;
      document
        .querySelector("[data-retry-activity]")
        .addEventListener("click", async (event) => {
          event.currentTarget.disabled = true;
          attempt = await api().startActivityAttempt(id);
          await renderActivity();
        });
      return;
    }
    if (!attempt) attempt = await api().startActivityAttempt(id);
    const answers = new Map(
      (attempt.respostas_questoes || []).map((item) => [item.questao_id, item]),
    );
    let index = Math.max(
      0,
      activity.questoes.findIndex((question) => !answers.has(question.id)),
    );
    if (index < 0) index = activity.questoes.length - 1;
    const draw = () => {
      const question = activity.questoes[index];
      const existing = answers.get(question.id);
      const alternatives = Array.isArray(question.alternativas)
        ? question.alternativas
        : [];
      content().innerHTML = `<div class="activity-shell"><header class="activity-head"><div><p class="eyebrow">${escapeHTML(activity.trilhas?.materia || "")} · ${typeLabel[activity.tipo_conteudo] || "Atividade"}</p><h1>${escapeHTML(activity.titulo)}</h1><p>${escapeHTML(activity.descricao || "")}</p></div><span class="xp-badge"><span class="material-symbols-outlined">bolt</span>+${Number(activity.recompensa_xp || 0)} XP</span></header><div class="question-progress"><span>Questão ${index + 1} de ${activity.questoes.length}</span>${progress(Math.round(((index + 1) / activity.questoes.length) * 100), "Progresso da atividade")}</div><section class="panel question-card" aria-live="polite"><span class="question-kicker">${Number(question.pontos)} ponto(s)</span><h2>${escapeHTML(question.enunciado)}</h2>${
        question.tipo === "resposta_curta"
          ? `<input class="short-answer" data-short-answer value="${escapeHTML(existing?.resposta?.valor || "")}" placeholder="Digite sua resposta" ${existing ? "disabled" : ""}>`
          : `<div class="alternatives">${alternatives
              .map((option, optionIndex) => {
                const value =
                  typeof option === "object"
                    ? String(option.valor ?? option.value ?? optionIndex)
                    : String(option);
                const label =
                  typeof option === "object"
                    ? String(option.texto ?? option.label ?? option.valor ?? "")
                    : String(option);
                const selected = existing?.resposta?.valor === value;
                return `<button class="alternative ${selected ? "selected" : ""}" type="button" data-answer="${escapeHTML(value)}" ${existing ? "disabled" : ""}><span class="alternative-letter">${String.fromCharCode(65 + optionIndex)}</span><span>${escapeHTML(label)}</span></button>`;
              })
              .join("")}</div>`
      }${question.dica && !existing ? `<button class="button ghost" type="button" data-show-hint><span class="material-symbols-outlined">lightbulb</span>Ver dica</button><div class="hint-box" data-hint hidden>${escapeHTML(question.dica)}</div>` : ""}${existing ? `<div class="feedback-box ${existing.correta ? "correct" : "incorrect"}"><strong>${existing.correta ? "Resposta correta" : "Ainda não foi dessa vez"}</strong><br>${escapeHTML(existing.explicacao_snapshot || "")}</div>` : ""}<div class="question-actions">${index > 0 ? '<button class="button secondary" type="button" data-prev-question>Anterior</button>' : "<span></span>"}${existing ? `<button class="button primary" type="button" data-next-question>${index === activity.questoes.length - 1 ? "Ver resultado" : "Próxima questão"}<span class="material-symbols-outlined">arrow_forward</span></button>` : '<button class="button primary" type="button" data-submit-answer disabled>Responder</button>'}</div></section></div>`;
      let selected = null;
      document.querySelectorAll("[data-answer]").forEach((button) =>
        button.addEventListener("click", () => {
          selected = button.dataset.answer;
          document
            .querySelectorAll("[data-answer]")
            .forEach((item) =>
              item.classList.toggle("selected", item === button),
            );
          document.querySelector("[data-submit-answer]").disabled = false;
        }),
      );
      document
        .querySelector("[data-short-answer]")
        ?.addEventListener("input", (event) => {
          selected = event.target.value.trim().toLowerCase();
          document.querySelector("[data-submit-answer]").disabled = !selected;
        });
      document
        .querySelector("[data-show-hint]")
        ?.addEventListener("click", () => {
          document.querySelector("[data-hint]").hidden = false;
        });
      document
        .querySelector("[data-prev-question]")
        ?.addEventListener("click", () => {
          index -= 1;
          draw();
        });
      document
        .querySelector("[data-submit-answer]")
        ?.addEventListener("click", async (event) => {
          if (!selected) return;
          event.currentTarget.disabled = true;
          try {
            const response = await api().answerActivityQuestion({
              attemptId: attempt.id,
              questionId: question.id,
              answer: { valor: selected },
            });
            answers.set(question.id, response);
            draw();
          } catch (err) {
            event.currentTarget.disabled = false;
            notify(err.message, "error");
          }
        });
      document
        .querySelector("[data-next-question]")
        ?.addEventListener("click", async () => {
          if (index < activity.questoes.length - 1) {
            index += 1;
            draw();
          } else {
            location.href = `${moduleRoot}resultado/index.html?atividade=${encodeURIComponent(id)}`;
          }
        });
    };
    draw();
  };

  const renderResult = async () => {
    const id = params.get("atividade");
    if (!id) throw new Error("Atividade não informada.");
    const result = await api().getActivityResult(id);
    if (!result?.attempt) {
      content().innerHTML = empty(
        "Resultado ainda indisponível",
        "Conclua a atividade para visualizar acertos e explicações.",
        "pending_actions",
      );
      return;
    }
    const { attempt, activity } = result;
    const maximum = Number(attempt.pontuacao_maxima || 0);
    const score = maximum
      ? Math.round((Number(attempt.pontuacao_obtida || 0) / maximum) * 100)
      : 0;
    const questionById = new Map(
      activity.questoes.map((item) => [item.id, item]),
    );
    content().innerHTML = `<section class="panel result-hero"><div class="result-ring" style="--score:${score}%"><strong>${score}%</strong></div><h1>${score >= 70 ? "Muito bem!" : "Continue praticando"}</h1><p>${escapeHTML(activity.titulo)}</p><div class="result-summary"><div><strong>${attempt.acertos}</strong><span>acertos</span></div><div><strong>${activity.questoes.length}</strong><span>questões</span></div><div><strong>+${Number(activity.recompensa_xp || 0)}</strong><span>XP da conclusão</span></div></div><div class="question-actions"><a class="button secondary" href="${moduleRoot}trilha/index.html?trilha=${encodeURIComponent(activity.trilha_id)}">Voltar à trilha</a><a class="button primary" href="${moduleRoot}atividade/index.html?atividade=${encodeURIComponent(id)}">Tentar novamente</a></div></section><section class="review-list"><div class="page-heading"><div><p class="eyebrow">REVISÃO</p><h1>Entenda suas respostas</h1></div></div>${(
      attempt.respostas_questoes || []
    )
      .map((answer, index) => {
        const question = questionById.get(answer.questao_id);
        return `<article class="panel review-item ${answer.correta ? "" : "incorrect"}"><header><span class="material-symbols-outlined">${answer.correta ? "check_circle" : "cancel"}</span><h3>${index + 1}. ${escapeHTML(question?.enunciado || "Questão")}</h3></header><p><strong>Sua resposta:</strong> ${escapeHTML(answer.resposta?.valor || "")}</p><p>${escapeHTML(answer.explicacao_snapshot || "")}</p></article>`;
      })
      .join("")}</section>`;
  };

  const renderSaved = async () => {
    const items = await api().listSavedContent();
    content().innerHTML = `<header class="page-heading"><div><p class="eyebrow">REVISÃO POSTERIOR</p><h1>Favoritos e conteúdos salvos</h1><p>Retome rapidamente os materiais que você separou para estudar depois.</p></div></header>${
      items.length
        ? `<section class="saved-grid">${items
            .map((item) => {
              const trail = item.trilhas;
              const activity = item.atividades;
              const target = trail
                ? `${moduleRoot}trilha/index.html?trilha=${trail.id}`
                : `${moduleRoot}${["atividade", "quiz", "projeto"].includes(activity?.tipo_conteudo) ? "atividade" : "aula"}/index.html?atividade=${activity?.id}`;
              return `<article class="panel saved-item"><span class="saved-icon material-symbols-outlined">${trail ? "route" : activity?.tipo_conteudo === "aula" ? "menu_book" : "quiz"}</span><div><h2>${escapeHTML(trail?.titulo || activity?.titulo || "Conteúdo")}</h2><p>${escapeHTML(trail?.materia || activity?.trilhas?.materia || "")} · salvo em ${date(item.created_at, { day: "2-digit", month: "short" })}</p></div><a class="button secondary" href="${target}">Abrir</a></article>`;
            })
            .join("")}</section>`
        : empty(
            "Nenhum conteúdo salvo",
            "Use o ícone de marcador em uma trilha ou aula para montar sua lista de revisão.",
            "bookmarks",
          )
    }`;
  };

  const renderHistory = async () => {
    const [items, xp] = await Promise.all([
      api().listStudyHistory(),
      api().getStudyXp(),
    ]);
    content().innerHTML = `<header class="page-heading"><div><p class="eyebrow">SUA JORNADA</p><h1>Histórico de estudos</h1><p>Uma linha do tempo com os registros reais da sua atividade na plataforma.</p></div><span class="xp-badge"><span class="material-symbols-outlined">bolt</span>${xp.total} XP acumulados</span></header>${
      items.length
        ? `<section class="timeline">${items
            .map((item) => {
              const info = eventLabels[item.evento] || ["history", item.evento];
              const title =
                item.atividades?.titulo || item.trilhas?.titulo || info[1];
              return `<article class="panel history-item"><time>${date(item.created_at, { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}</time><h2><span class="material-symbols-outlined">${info[0]}</span> ${escapeHTML(info[1])}</h2><p>${escapeHTML(title)}${item.trilhas?.materia ? ` · ${escapeHTML(item.trilhas.materia)}` : ""}</p></article>`;
            })
            .join("")}</section>`
        : empty(
            "Seu histórico começará aqui",
            "Abra uma trilha, conclua uma aula ou responda uma atividade para criar os primeiros registros.",
            "history",
          )
    }`;
  };

  const renderers = {
    catalogo: renderCatalog,
    trilha: renderTrail,
    aula: renderLesson,
    ide: params.get("mode") === "pseudo" ? renderPseudoIde : renderIde,
    atividade: renderActivity,
    resultado: renderResult,
    salvos: renderSaved,
    historico: renderHistory,
  };
  const load = async () => {
    loading();
    try {
      if (!api()?.configured)
        throw new Error("O Supabase não está configurado.");
      await renderers[page]();
    } catch (err) {
      content().innerHTML = error(err.message || "Tente novamente.");
      document
        .querySelector("[data-study-retry]")
        ?.addEventListener("click", load);
    }
  };
  const hydrateProfile = async (event) => {
    if (!event.detail?.session) return;
    studyUserId = event.detail.session.user.id;
    try {
      const profile = await api().getProfile(event.detail.session.user.id);
      const name = profile?.nome || event.detail.session.user.email || "Aluno";
      document.querySelector("[data-study-name]").textContent = name;
      document.querySelector("[data-study-avatar]").textContent =
        initials(name);
      document.querySelector("[data-study-class]").textContent = profile?.turmas
        ?.serie
        ? `${profile.turmas.serie}º ano`
        : "Ensino Médio";
    } catch {
      /* O conteúdo principal possui estado de erro próprio. */
    }
  };
  shell();
  document.addEventListener(
    "ominisaber:ready",
    async (event) => {
      await hydrateProfile(event);
      load();
    },
    { once: true },
  );
  document.addEventListener("DOMContentLoaded", () => {
    if (!api()?.configured) load();
  });
})();
