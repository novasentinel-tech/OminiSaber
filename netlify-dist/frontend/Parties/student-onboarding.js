(() => {
  const VERSION = "v1";
  const scriptUrl = document.currentScript?.src || window.location.href;
  const illustrationUrl = new URL(
    "./assets/student-onboarding.png",
    scriptUrl,
  ).href;
  const frontendRoot = (() => {
    const marker = window.location.pathname.indexOf("/frontend/");
    return marker >= 0
      ? `${window.location.pathname.slice(0, marker)}/frontend/`
      : "/frontend/";
  })();
  const studentRoot = `${frontendRoot}aluno/`;
  const steps = [
    {
      folder: "dashboard_principal",
      icon: "home",
      title: "Seu ponto de partida",
      body: "No Início você encontra o próximo compromisso, suas matérias e um resumo do seu progresso.",
    },
    {
      folder: "atividades",
      icon: "assignment",
      title: "Atividades e resultados",
      body: "Veja o que está pendente, continue de onde parou e confira os resultados das entregas.",
    },
    {
      folder: "modulo_de_trilhas",
      icon: "route",
      title: "Trilhas de aprendizagem",
      body: "Siga conteúdos e práticas em sequência, sempre com o próximo passo indicado.",
    },
    {
      folder: "laboratorio_de_redacao",
      icon: "edit_note",
      title: "Laboratório de redação",
      body: "Explore a proposta, planeje argumentos e escreva seu texto com salvamento automático.",
      pageTarget: ".stepper",
    },
    {
      folder: "minha_evolucao",
      icon: "monitoring",
      title: "Acompanhe sua evolução",
      body: "Consulte seu ritmo, conquistas, histórico de estudo e pontos que merecem atenção.",
    },
    {
      folder: "biblioteca_digital",
      icon: "local_library",
      title: "Sua biblioteca",
      body: "Encontre livros e materiais digitais verificados para apoiar seus estudos.",
    },
    {
      folder: "notificacoes",
      icon: "notifications",
      title: "Nenhum aviso importante fica para trás",
      body: "Novas atividades, mudanças e compromissos da sua turma aparecem nesta central.",
    },
    {
      folder: "agenda",
      icon: "calendar_month",
      title: "Organize sua rotina",
      body: "A Agenda reúne provas, recuperações e atividades publicadas pelos professores.",
    },
    {
      folder: "perfil",
      icon: "person",
      title: "Confira sua identidade escolar",
      body: "No Perfil você consulta turma, matrícula, curso e informações vinculadas pela escola.",
    },
    {
      folder: "ajuda-suporte",
      icon: "help",
      title: "Ajuda sempre disponível",
      body: "Pesquise dúvidas, copie dados técnicos e volte a este passeio quando quiser.",
    },
  ];

  let initialized = false;
  let hydrated = false;
  let userId = "";
  let studentName = "Estudante";
  let welcomeDialog = null;
  let tourLayer = null;
  let activeStep = -1;
  let sidebarWasCollapsed = false;
  let repositionFrame = 0;

  const escapeHtml = (value = "") =>
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
  const stateKey = () => `ominisaber:student-onboarding:${VERSION}:${userId}`;
  const sessionKey = () => `${stateKey()}:welcome-closed`;
  const readState = () => {
    if (!userId) return null;
    try {
      return JSON.parse(localStorage.getItem(stateKey()) || "null");
    } catch {
      return null;
    }
  };
  const writeState = (state) => {
    if (!userId) return;
    try {
      localStorage.setItem(
        stateKey(),
        JSON.stringify({ ...state, updatedAt: new Date().toISOString() }),
      );
    } catch {
      /* O tutorial continua funcionando durante a página atual. */
    }
  };
  const wasClosedThisSession = () => {
    try {
      return sessionStorage.getItem(sessionKey()) === "true";
    } catch {
      return false;
    }
  };
  const closeForSession = () => {
    try {
      sessionStorage.setItem(sessionKey(), "true");
    } catch {
      /* Sem armazenamento, o diálogo apenas fecha nesta página. */
    }
  };
  const currentFolder = () =>
    window.location.pathname.split("/aluno/")[1]?.split("/")[0] || "";
  const stepUrl = (step) => `${studentRoot}${step.folder}/index.html`;
  const isVisible = (element) =>
    Boolean(
      element &&
        element.getClientRects().length &&
        getComputedStyle(element).visibility !== "hidden",
    );

  const createWelcome = () => {
    if (welcomeDialog) return welcomeDialog;
    const dialog = document.createElement("dialog");
    dialog.className = "os-student-welcome";
    dialog.setAttribute("aria-labelledby", "os-student-welcome-title");
    dialog.innerHTML = `
      <div class="os-welcome-shell">
        <button class="os-onboarding-close" type="button" data-welcome-close aria-label="Fechar apresentação">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
        <div class="os-welcome-brand"><span class="material-symbols-outlined" aria-hidden="true">school</span><strong>OminiSaber<small>Área do aluno</small></strong></div>
        <div class="os-welcome-layout">
          <div class="os-welcome-art"><img src="${illustrationUrl}" alt="Estudante usando o OminiSaber para aprender" /></div>
          <div class="os-welcome-content">
            <p class="os-welcome-eyebrow">SEU NOVO ESPAÇO DE APRENDIZAGEM</p>
            <h2 id="os-student-welcome-title">Bem-vinda ao OminiSaber, <span data-welcome-name>Estudante</span></h2>
            <p class="os-welcome-lead">Vamos conhecer o que mais importa para você estudar com tranquilidade.</p>
            <div class="os-welcome-map" aria-label="Áreas que serão apresentadas">
              <div class="is-active"><span class="material-symbols-outlined" aria-hidden="true">menu_book</span><strong>Aprender</strong><small>Atividades e Trilhas</small></div>
              <i aria-hidden="true"></i>
              <div><span class="material-symbols-outlined" aria-hidden="true">monitoring</span><strong>Acompanhar</strong><small>Evolução</small></div>
              <i aria-hidden="true"></i>
              <div><span class="material-symbols-outlined" aria-hidden="true">calendar_month</span><strong>Organizar</strong><small>Agenda e Avisos</small></div>
              <i aria-hidden="true"></i>
              <div class="is-writing"><span class="material-symbols-outlined" aria-hidden="true">edit_note</span><strong>Criar</strong><small>Redação</small></div>
            </div>
            <div class="os-welcome-preview">
              <span class="material-symbols-outlined" aria-hidden="true">highlight</span>
              <div><strong>Depois, vamos destacar cada área diretamente na tela.</strong><small>Você verá orientações curtas enquanto navega pelo sistema.</small></div>
              <em>${steps.length} passos · cerca de 3 minutos</em>
            </div>
          </div>
        </div>
        <footer class="os-welcome-footer">
          <label><input type="checkbox" data-welcome-never /> <span>Não mostrar novamente</span></label>
          <div class="os-welcome-actions">
            <button class="os-onboarding-button is-ghost" type="button" data-welcome-explore>Explorar sozinho</button>
            <button class="os-onboarding-button is-primary" type="button" data-welcome-start>Começar passeio <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button>
          </div>
          <p>Você poderá rever este tutorial em <a href="${studentRoot}ajuda-suporte/index.html">Ajuda e suporte</a>.</p>
        </footer>
      </div>`;
    document.body.appendChild(dialog);
    const dismiss = () => {
      const never = dialog.querySelector("[data-welcome-never]").checked;
      if (never) writeState({ status: "dismissed", step: 0 });
      else {
        const state = readState();
        if (state?.status === "active") {
          writeState({ status: "skipped", step: activeStep });
        }
        closeForSession();
      }
      dialog.close?.();
    };
    dialog.querySelector("[data-welcome-close]").addEventListener("click", dismiss);
    dialog
      .querySelector("[data-welcome-explore]")
      .addEventListener("click", dismiss);
    dialog.querySelector("[data-welcome-start]").addEventListener("click", () => {
      writeState({ status: "active", step: 0 });
      dialog.close?.();
      startTour(0);
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dismiss();
    });
    welcomeDialog = dialog;
    return dialog;
  };

  const showWelcome = ({ force = false } = {}) => {
    stopTour({ preserveState: true });
    const state = readState();
    if (!force && (state || wasClosedThisSession())) return;
    const dialog = createWelcome();
    dialog.querySelector("[data-welcome-name]").textContent =
      studentName.split(/\s+/)[0] || "Estudante";
    dialog.querySelector("[data-welcome-never]").checked = false;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    window.setTimeout(
      () => dialog.querySelector("[data-welcome-start]")?.focus(),
      40,
    );
  };

  const injectHelpRestart = () => {
    if (
      currentFolder() !== "ajuda-suporte" ||
      document.querySelector("[data-student-tour-restart]")
    )
      return;
    const hero = document.querySelector(".help-hero");
    if (!hero) return;
    const section = document.createElement("section");
    section.className = "os-tour-restart";
    section.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">explore</span><div><strong>Quer conhecer o OminiSaber?</strong><p>Reveja o passeio guiado por todas as áreas do aluno.</p></div><button type="button" data-student-tour-restart>Rever tutorial</button>`;
    hero.insertAdjacentElement("afterend", section);
    section
      .querySelector("[data-student-tour-restart]")
      .addEventListener("click", () => showWelcome({ force: true }));
  };

  const createTourLayer = () => {
    if (tourLayer) return tourLayer;
    const layer = document.createElement("div");
    layer.className = "os-student-tour";
    layer.innerHTML = `
      <div class="os-tour-shade is-top" aria-hidden="true"></div>
      <div class="os-tour-shade is-left" aria-hidden="true"></div>
      <div class="os-tour-shade is-right" aria-hidden="true"></div>
      <div class="os-tour-shade is-bottom" aria-hidden="true"></div>
      <div class="os-tour-focus-ring" aria-hidden="true"></div>
      <section class="os-tour-coachmark" role="dialog" aria-modal="false" aria-labelledby="os-tour-title" aria-describedby="os-tour-copy">
        <button class="os-onboarding-close" type="button" data-tour-close aria-label="Fechar tutorial"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
        <p class="os-tour-progress" data-tour-progress></p>
        <div class="os-tour-heading"><span class="material-symbols-outlined" data-tour-icon aria-hidden="true"></span><div><h2 id="os-tour-title" data-tour-title></h2><p id="os-tour-copy" data-tour-copy></p></div></div>
        <div class="os-tour-dots" data-tour-dots aria-hidden="true"></div>
        <footer><button class="os-onboarding-button is-ghost" type="button" data-tour-skip>Pular tutorial</button><div><button class="os-onboarding-button is-secondary" type="button" data-tour-back>Voltar</button><button class="os-onboarding-button is-primary" type="button" data-tour-next>Próximo</button></div></footer>
      </section>`;
    document.body.appendChild(layer);
    layer.querySelector("[data-tour-close]").addEventListener("click", () =>
      stopTour({ status: "skipped" }),
    );
    layer.querySelector("[data-tour-skip]").addEventListener("click", () =>
      stopTour({ status: "skipped" }),
    );
    layer.querySelector("[data-tour-back]").addEventListener("click", () =>
      goToStep(activeStep - 1),
    );
    layer.querySelector("[data-tour-next]").addEventListener("click", () => {
      if (activeStep >= steps.length - 1) {
        stopTour({ status: "completed" });
        window.StudentShell?.notify?.("Passeio concluído. Boa jornada!");
        return;
      }
      goToStep(activeStep + 1);
    });
    tourLayer = layer;
    return layer;
  };

  const targetForStep = (step) => {
    const hrefFragment = `/aluno/${step.folder}/`;
    const pageTarget = step.pageTarget
      ? document.querySelector(step.pageTarget)
      : null;
    if (isVisible(pageTarget)) return pageTarget;
    if (window.innerWidth <= 900) {
      const mobile = [...document.querySelectorAll(".os-mobile-nav a")].find(
        (link) => link.href.includes(hrefFragment),
      );
      if (isVisible(mobile)) return mobile;
      const heading = document.querySelector(
        "main :is(h1,.page-heading,.help-hero,.topbar-title,.section-heading)",
      );
      if (isVisible(heading)) return heading;
    }
    const sidebar = [
      ...document.querySelectorAll(
        ".os-party-student-sidebar .omni-student-nav a",
      ),
    ].find((link) => link.href.includes(hrefFragment));
    if (isVisible(sidebar)) return sidebar;
    return document.querySelector("main h1, main .page-heading, main header");
  };

  const positionTour = () => {
    if (!tourLayer || tourLayer.hidden || activeStep < 0) return;
    cancelAnimationFrame(repositionFrame);
    repositionFrame = requestAnimationFrame(() => {
      const target = targetForStep(steps[activeStep]);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const raw = target?.getBoundingClientRect();
      const rect = raw
        ? {
            left: Math.max(8, raw.left - 6),
            top: Math.max(8, raw.top - 6),
            right: Math.min(viewportWidth - 8, raw.right + 6),
            bottom: Math.min(viewportHeight - 8, raw.bottom + 6),
          }
        : {
            left: 16,
            top: 16,
            right: viewportWidth - 16,
            bottom: 84,
          };
      const width = Math.max(0, rect.right - rect.left);
      const height = Math.max(0, rect.bottom - rect.top);
      const ring = tourLayer.querySelector(".os-tour-focus-ring");
      Object.assign(ring.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${width}px`,
        height: `${height}px`,
      });
      Object.assign(tourLayer.querySelector(".os-tour-shade.is-top").style, {
        left: "0px",
        top: "0px",
        width: `${viewportWidth}px`,
        height: `${rect.top}px`,
      });
      Object.assign(tourLayer.querySelector(".os-tour-shade.is-left").style, {
        left: "0px",
        top: `${rect.top}px`,
        width: `${rect.left}px`,
        height: `${height}px`,
      });
      Object.assign(tourLayer.querySelector(".os-tour-shade.is-right").style, {
        left: `${rect.right}px`,
        top: `${rect.top}px`,
        width: `${Math.max(0, viewportWidth - rect.right)}px`,
        height: `${height}px`,
      });
      Object.assign(tourLayer.querySelector(".os-tour-shade.is-bottom").style, {
        left: "0px",
        top: `${rect.bottom}px`,
        width: `${viewportWidth}px`,
        height: `${Math.max(0, viewportHeight - rect.bottom)}px`,
      });
      const coachmark = tourLayer.querySelector(".os-tour-coachmark");
      if (viewportWidth <= 720) {
        coachmark.style.removeProperty("left");
        coachmark.style.removeProperty("top");
        coachmark.style.removeProperty("right");
        return;
      }
      const coachWidth = Math.min(400, viewportWidth - 32);
      const coachHeight = coachmark.offsetHeight || 310;
      let left = rect.right + 18;
      if (left + coachWidth > viewportWidth - 16)
        left = Math.max(16, rect.left - coachWidth - 18);
      let top = Math.min(
        viewportHeight - coachHeight - 16,
        Math.max(16, rect.top - 18),
      );
      Object.assign(coachmark.style, {
        left: `${left}px`,
        top: `${Math.max(16, top)}px`,
        right: "auto",
      });
    });
  };

  const renderStep = (index) => {
    const step = steps[index];
    const layer = createTourLayer();
    activeStep = index;
    layer.hidden = false;
    document.body.classList.add("os-onboarding-tour-active");
    layer.querySelector("[data-tour-progress]").textContent =
      `PASSO ${index + 1} DE ${steps.length}`;
    layer.querySelector("[data-tour-icon]").textContent = step.icon;
    layer.querySelector("[data-tour-title]").textContent = step.title;
    layer.querySelector("[data-tour-copy]").textContent = step.body;
    layer.querySelector("[data-tour-dots]").innerHTML = steps
      .map(
        (_, dotIndex) =>
          `<span class="${dotIndex <= index ? "is-complete" : ""}" title="Passo ${dotIndex + 1}"></span>`,
      )
      .join("");
    const back = layer.querySelector("[data-tour-back]");
    const next = layer.querySelector("[data-tour-next]");
    back.disabled = index === 0;
    next.innerHTML =
      index === steps.length - 1
        ? 'Concluir <span class="material-symbols-outlined" aria-hidden="true">check</span>'
        : 'Próximo <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>';
    positionTour();
    window.setTimeout(() => next.focus(), 40);
  };

  const startTour = (index = 0) => {
    const safeIndex = Math.min(Math.max(Number(index) || 0, 0), steps.length - 1);
    const step = steps[safeIndex];
    writeState({ status: "active", step: safeIndex });
    if (currentFolder() !== step.folder) {
      window.location.href = stepUrl(step);
      return;
    }
    sidebarWasCollapsed = document.body.classList.contains(
      "os-student-sidebar-collapsed",
    );
    if (window.innerWidth > 900 && sidebarWasCollapsed) {
      document.documentElement.classList.remove("os-sidebar-collapsed");
      document.body.classList.remove("os-student-sidebar-collapsed");
      const sidebar = document.querySelector(".os-party-student-sidebar");
      if (sidebar) sidebar.inert = false;
    }
    renderStep(safeIndex);
  };

  const goToStep = (index) => {
    if (index < 0 || index >= steps.length) return;
    activeStep = index;
    writeState({ status: "active", step: index });
    if (currentFolder() !== steps[index].folder) {
      window.location.href = stepUrl(steps[index]);
      return;
    }
    renderStep(index);
  };

  const stopTour = ({ status, preserveState = false } = {}) => {
    if (!preserveState && status) writeState({ status, step: activeStep });
    activeStep = -1;
    document.body.classList.remove("os-onboarding-tour-active");
    if (tourLayer) tourLayer.hidden = true;
    if (sidebarWasCollapsed && window.innerWidth > 900) {
      document.documentElement.classList.add("os-sidebar-collapsed");
      document.body.classList.add("os-student-sidebar-collapsed");
      const sidebar = document.querySelector(".os-party-student-sidebar");
      if (sidebar) sidebar.inert = true;
    }
    sidebarWasCollapsed = false;
  };

  const waitForDashboard = (callback, attempts = 0) => {
    const dashboard = document.querySelector("[data-dashboard]");
    if (!dashboard || !dashboard.classList.contains("is-hidden") || attempts > 35) {
      callback();
      return;
    }
    window.setTimeout(() => waitForDashboard(callback, attempts + 1), 100);
  };

  const hydrate = async (session) => {
    if (hydrated || !session?.user?.id) return;
    hydrated = true;
    userId = session.user.id;
    try {
      const profile = await window.OminiSaber?.getProfile?.(userId);
      studentName = profile?.nome || session.user.user_metadata?.nome || "Estudante";
    } catch {
      studentName = session.user.user_metadata?.nome || "Estudante";
    }
    injectHelpRestart();
    const state = readState();
    if (state?.status === "active") {
      window.setTimeout(() => startTour(state.step), 220);
      return;
    }
    if (!state && currentFolder() === "dashboard_principal")
      waitForDashboard(() => showWelcome());
  };

  const init = async () => {
    if (initialized || document.body.dataset.partyRole !== "student") return;
    initialized = true;
    injectHelpRestart();
    document.addEventListener("ominisaber:ready", (event) =>
      hydrate(event.detail?.session),
    );
    window.addEventListener("resize", positionTour, { passive: true });
    window.addEventListener("scroll", positionTour, { passive: true });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && activeStep >= 0)
        stopTour({ status: "skipped" });
    });
    try {
      const session = await window.OminiSaber?.getSession?.();
      if (session) hydrate(session);
    } catch {
      /* A autenticação principal exibirá a mensagem adequada. */
    }
  };

  window.OminiStudentOnboarding = {
    init,
    start: () => showWelcome({ force: true }),
    reset: () => {
      if (userId) localStorage.removeItem(stateKey());
      showWelcome({ force: true });
    },
  };
})();
