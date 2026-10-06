(() => {
  const partiesStylesheet = [...document.querySelectorAll('link[rel="stylesheet"]')].find(
    (link) => link.href.includes("/Parties/parties.css"),
  );

  const keepPartiesLast = () => {
    if (partiesStylesheet && partiesStylesheet.parentNode === document.head) {
      document.head.append(partiesStylesheet);
    }
  };

  const inferRole = (path) => {
    if (path.includes("/frontend/aluno/")) return "student";
    if (path.includes("/frontend/professor/")) return "teacher";
    if (path.includes("/frontend/gestor/")) return "manager";
    if (path.includes("/frontend/bibliotecaria/")) return "library";
    return "public";
  };

  const inferLayout = (path) => {
    if (
      path.includes("/frontend/login/") ||
      path.includes("/frontend/cadastro/") ||
      path.includes("/frontend/redefinir-senha/")
    )
      return "auth";
    if (path.includes("/frontend/erro/")) return "utility";
    return "app";
  };

  const inferSurface = (path) => {
    if (path.includes("/frontend/aluno/dashboard_principal/"))
      return "student-dashboard";
    if (path.includes("/dashboard/")) return "dashboard";
    if (path.includes("/atividades/")) return "activities";
    if (path.includes("/agenda/")) return "agenda";
    if (path.includes("/perfil/")) return "profile";
    return "content";
  };

  const addSkipLink = () => {
    const main = document.querySelector("main");
    if (!main || document.querySelector(".os-skip-link")) return;
    if (!main.id) main.id = "conteudo-principal";
    const link = document.createElement("a");
    link.className = "os-skip-link";
    link.href = `#${main.id}`;
    link.textContent = "Ir para o conteúdo principal";
    document.body.prepend(link);
  };

  const improveSemantics = () => {
    document.querySelectorAll(".toast").forEach((toast) => {
      if (!toast.hasAttribute("role")) toast.setAttribute("role", "status");
      if (!toast.hasAttribute("aria-live"))
        toast.setAttribute("aria-live", "polite");
    });
    document.querySelectorAll(".loader,.spinner").forEach((loader) => {
      if (!loader.hasAttribute("aria-hidden"))
        loader.setAttribute("aria-hidden", "true");
    });
    document.querySelectorAll("button:not([type])").forEach((button) => {
      if (!button.closest("form")) button.type = "button";
    });
  };

  const markComponents = () => {
    const mappings = [
      ["dialog,.modal,.modal-card", "dialog"],
      ["table,.data-table", "table"],
      [".toast", "toast"],
      [".empty,.empty-state", "empty-state"],
      [".loader,.spinner,.loading-state", "loading-state"],
      [".topbar,.site-header,.app-header,.app-topbar,.portal-topbar,.study-topbar", "topbar"],
      [".sidebar,.app-sidebar,.study-sidebar,.library-sidebar", "sidebar"],
    ];
    mappings.forEach(([selector, component]) =>
      document
        .querySelectorAll(selector)
        .forEach((element) => (element.dataset.partyComponent = component)),
    );
  };

  const standardizeHeaders = (root = document) => {
    root
      .querySelectorAll?.(
        ".topbar,.site-header,.app-header,.app-topbar,.portal-topbar,.study-topbar",
      )
      .forEach((header) => header.classList.add("os-standard-header"));
  };

  const sidebarSelector = [
    ".portal-sidebar",
    ".app-sidebar",
    ".sidebar",
    ".library-sidebar",
    ".study-sidebar",
    "[data-shared-sidebar]",
    "[data-sidebar]",
  ].join(",");

  const headerSelector = [
    ".topbar",
    ".site-header",
    ".app-header",
    ".app-topbar",
    ".portal-topbar",
    ".study-topbar",
    ".hub-header",
  ].join(",");

  const normalizeLabel = (value = "") =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const getFrontendRoot = () => {
    const marker = window.location.pathname.indexOf("/frontend/");
    return marker >= 0
      ? `${window.location.pathname.slice(0, marker)}/frontend/`
      : "/frontend/";
  };

  const loadSelectSystem = () => {
    if (!['student', 'teacher'].includes(document.body.dataset.partyRole) || window.OminiSelect || document.querySelector('script[data-omini-select]')) return;
    const script = document.createElement('script');
    script.src = `${getFrontendRoot()}shared/omni-select.js?v=20261002-1`;
    script.defer = true;
    script.dataset.ominiSelect = 'true';
    document.head.append(script);
  };

  const loadStudentOnboarding = () => {
    if (
      document.body.dataset.partyRole !== "student" ||
      document.querySelector("script[data-student-onboarding]")
    )
      return;
    const root = getFrontendRoot();
    if (!document.querySelector("link[data-student-onboarding]")) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = `${root}Parties/student-onboarding.css?v=20260928-3`;
      stylesheet.dataset.studentOnboarding = "true";
      document.head.appendChild(stylesheet);
    }
    const script = document.createElement("script");
    script.src = `${root}Parties/student-onboarding.js?v=20260928-3`;
    script.defer = true;
    script.dataset.studentOnboarding = "true";
    script.addEventListener("load", () =>
      window.OminiStudentOnboarding?.init(),
    );
    document.head.appendChild(script);
  };

  const studentSidebarStorageKey = "ominisaber:student-sidebar-collapsed";

  const setStudentSidebarCollapsed = (collapsed, focusTarget = false) => {
    if (document.body.dataset.partyRole !== "student") return;
    const desktop = window.innerWidth > 900;
    document.documentElement.classList.toggle("os-sidebar-collapsed", desktop && collapsed);
    document.body.classList.toggle(
      "os-student-sidebar-collapsed",
      desktop && collapsed,
    );
    const reopen = document.querySelector("[data-student-sidebar-reopen]");
    const close = document.querySelector("[data-student-sidebar-collapse]");
    const sidebar = document.querySelector(".os-party-student-sidebar");
    if (sidebar) sidebar.inert = desktop ? collapsed : !document.body.classList.contains("os-mobile-menu-open");
    reopen?.setAttribute("aria-expanded", String(!(desktop && collapsed)));
    close?.setAttribute("aria-expanded", String(!(desktop && collapsed)));
    try {
      window.localStorage.setItem(studentSidebarStorageKey, String(collapsed));
    } catch {
      /* A preferência continua funcionando durante a página atual. */
    }
    if (focusTarget)
      window.setTimeout(
        () => (collapsed ? reopen : close)?.focus(),
        380,
      );
  };

  const savedStudentSidebarState = () => {
    try {
      return window.localStorage.getItem(studentSidebarStorageKey) === "true";
    } catch {
      return false;
    }
  };

  const teacherSidebarStorageKey = "ominisaber:teacher-sidebar-collapsed";
  const teacherSidebarSelector = "[data-teacher-sidebar],.portal-sidebar";
  const teacherToggleSelector = "[data-teacher-sidebar-toggle]";
  let teacherMenuTrigger = null;
  const teacherBackgroundState = new Map();

  const savedTeacherSidebarState = () => {
    try {
      return window.localStorage.getItem(teacherSidebarStorageKey) === "true";
    } catch {
      return false;
    }
  };

  let teacherSidebarCollapsed = savedTeacherSidebarState();
  const teacherNavigationReady = () => document.body.dataset.partyRole === "teacher"
    && !document.body.hasAttribute("data-teacher-navigation-pending");
  const teacherIsMobile = () => window.innerWidth <= 900;
  const teacherSidebar = () => document.querySelector(teacherSidebarSelector);
  const teacherMenuControls = () => [...document.querySelectorAll(teacherToggleSelector)]
    .filter(control => !control.closest(teacherSidebarSelector));
  const teacherFocusables = (sidebar) => [...(sidebar?.querySelectorAll(
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
  ) || [])].filter(control => !control.inert && control.tabIndex >= 0 && control.getClientRects().length);
  const focusTeacherTrigger = () => {
    const control = teacherMenuTrigger?.isConnected && !teacherMenuTrigger.inert
      ? teacherMenuTrigger
      : teacherMenuControls().find(button => button.getClientRects().length);
    control?.focus({ preventScroll: true });
    teacherMenuTrigger = null;
  };
  const focusTeacherClose = () => {
    const sidebar = teacherSidebar();
    if (sidebar && !sidebar.inert) sidebar.querySelector("[data-teacher-sidebar-close]")?.focus({ preventScroll: true });
  };
  const syncTeacherBackground = (locked) => {
    if (!locked) {
      teacherBackgroundState.forEach((wasInert, element) => { element.inert = wasInert; });
      teacherBackgroundState.clear();
      return;
    }
    const sidebar = teacherSidebar();
    document.querySelectorAll(`main,.td-header,.os-mobile-nav,.os-teacher-sidebar-open,${headerSelector}`).forEach(element => {
      if (element === sidebar || element.contains(sidebar)) return;
      if (!teacherBackgroundState.has(element)) teacherBackgroundState.set(element, element.inert);
      element.inert = true;
    });
  };
  const syncTeacherSidebar = () => {
    if (!teacherNavigationReady()) return;
    const sidebar = teacherSidebar();
    const mobile = teacherIsMobile();
    const drawerOpen = mobile && document.body.classList.contains("os-mobile-menu-open");
    const closed = mobile ? !drawerOpen : teacherSidebarCollapsed;
    document.documentElement.classList.toggle("os-teacher-sidebar-collapsed", !mobile && teacherSidebarCollapsed);
    document.body.classList.toggle("os-teacher-sidebar-collapsed", !mobile && teacherSidebarCollapsed);
    if (sidebar) {
      sidebar.inert = closed;
      sidebar.setAttribute("aria-hidden", String(closed));
    }
    document.querySelectorAll(`${teacherToggleSelector},[data-teacher-sidebar-close],.os-mobile-nav-more`).forEach(control => {
      control.setAttribute("aria-controls", sidebar?.id || "teacher-sidebar");
      control.setAttribute("aria-expanded", String(!closed));
      if (control.matches(teacherToggleSelector)) control.setAttribute("aria-label", closed ? "Abrir menu do professor" : "Fechar menu do professor");
    });
    syncTeacherBackground(drawerOpen);
  };
  const setTeacherSidebarCollapsed = (collapsed, focusTarget = false) => {
    if (!teacherNavigationReady()) return;
    teacherSidebarCollapsed = collapsed;
    try {
      window.localStorage.setItem(teacherSidebarStorageKey, String(collapsed));
    } catch {
      /* A preferência continua funcionando durante a página atual. */
    }
    syncTeacherSidebar();
    if (focusTarget) {
      if (collapsed) focusTeacherTrigger();
      else focusTeacherClose();
    }
  };
  const closeTeacherMobileMenu = (restoreFocus = true) => {
    if (!teacherNavigationReady()) return;
    const wasOpen = document.body.classList.contains("os-mobile-menu-open");
    document.body.classList.remove("os-mobile-menu-open", "menu-open", "nav-open");
    syncTeacherSidebar();
    if (wasOpen && restoreFocus) focusTeacherTrigger();
    else teacherMenuTrigger = null;
  };
  const openTeacherMobileMenu = () => {
    const sidebar = teacherSidebar();
    if (!teacherNavigationReady() || !teacherIsMobile() || !sidebar) return;
    if (!document.body.classList.contains("os-mobile-menu-open")) teacherMenuTrigger = document.activeElement;
    document.body.classList.remove("menu-open", "nav-open");
    document.body.classList.add("os-mobile-menu-open");
    syncTeacherSidebar();
    focusTeacherClose();
  };

  const setupTeacherSidebar = () => {
    if (!teacherNavigationReady()) return;
    const sidebar = teacherSidebar();
    if (!sidebar) return;
    sidebar.id ||= "teacher-sidebar";
    sidebar.dataset.teacherSidebar = "";
    sidebar.dataset.osMobileDrawer = "true";
    document
      .querySelectorAll(
        ".omni-sidebar-close,.omni-sidebar-edge,.omni-sidebar-mobile,.omni-sidebar-backdrop,.shared-sidebar-toggle,.sidebar-edge-reveal,.os-teacher-sidebar-collapse,.os-mobile-close,.td-backdrop",
      )
      .forEach((control) => control.remove());
    document.querySelectorAll('.portal-topbar .menu-button,.portal-topbar [data-portal-menu],.portal-topbar [data-menu-toggle],.os-mobile-menu-button').forEach(control => {
      if (!control.matches(teacherToggleSelector)) control.remove();
    });
    document.body.classList.remove("omni-sidebar-collapsed", "menu-open", "nav-open");
    sidebar.classList.remove("omni-sidebar-managed");
    sidebar.classList.add("os-teacher-sidebar");
    const brand = sidebar.querySelector(".portal-brand");
    brand?.querySelector(":scope > .material-symbols-outlined")?.classList.add("portal-brand-mark");
    brand?.querySelector(":scope > span:not(.material-symbols-outlined)")?.classList.add("portal-brand-copy");
    sidebar.querySelectorAll(".portal-nav a").forEach((link) => {
      link.querySelector(":scope > .material-symbols-outlined")?.classList.add("portal-nav-icon");
      link.querySelector(":scope > span:not(.material-symbols-outlined)")?.classList.add("portal-nav-copy");
      const label = link.querySelector(".portal-nav-copy")?.firstChild?.textContent?.trim() || getLinkLabel(link);
      if (label) link.title = label;
    });
    if (!sidebar.querySelector(".portal-create")) {
      const evaluations = [...sidebar.querySelectorAll(".portal-nav a")].find((link) =>
        normalizeLabel(getLinkLabel(link)).includes("avaliac"),
      );
      if (evaluations) {
        const create = document.createElement("a");
        create.className = "portal-create";
        create.href = `${evaluations.href.split("#")[0]}#view=create`;
        create.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">add</span><span>Criar atividade</span>';
        brand?.insertAdjacentElement("afterend", create);
      }
    }
    if (!sidebar.querySelector(".portal-sidebar-footer")) {
      const profile = sidebar.querySelector(".portal-profile");
      const signout = sidebar.querySelector(".portal-signout");
      if (profile || signout) {
        const footer = document.createElement("div");
        footer.className = "portal-sidebar-footer";
        profile?.before(footer);
        if (profile) footer.appendChild(profile);
        if (signout) footer.appendChild(signout);
      }
    }
    if (!sidebar.querySelector("[data-teacher-sidebar-close]")) {
      const control = document.createElement("button");
      control.type = "button";
      control.className = "os-teacher-sidebar-close";
      control.dataset.teacherSidebarClose = "";
      control.setAttribute("aria-label", "Fechar menu do professor");
      control.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
      sidebar.prepend(control);
    }
    const headerToggle = teacherMenuControls().find(control => !control.classList.contains("os-teacher-sidebar-open"));
    let externalToggle = document.querySelector(".os-teacher-sidebar-open");
    if (headerToggle) externalToggle?.remove();
    else if (!externalToggle) {
      externalToggle = document.createElement("button");
      externalToggle.type = "button";
      externalToggle.className = "os-teacher-sidebar-open";
      externalToggle.dataset.teacherSidebarToggle = "";
      externalToggle.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">menu</span>';
      document.body.appendChild(externalToggle);
    }
    if (!document.querySelector(".os-mobile-backdrop")) {
      const backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "os-mobile-backdrop";
      backdrop.setAttribute("aria-label", "Fechar menu do professor");
      document.body.appendChild(backdrop);
    }
    createMobileNav(sidebar, "teacher");
    syncTeacherSidebar();
  };

  const cleanStudentSidebarArtifacts = () => {
    if (document.body.dataset.partyRole !== "student") return;
    document
      .querySelectorAll(
        "aside.sidebar,aside.app-sidebar,aside.study-sidebar,aside.library-sidebar,[data-shared-sidebar]",
      )
      .forEach((element) => {
        if (
          !element.classList.contains("os-party-student-sidebar") &&
          !element.classList.contains("correction-sidebar") &&
          !element.classList.contains("notes-drawer")
        )
          element.remove();
      });
    document
      .querySelectorAll(
        ".shared-sidebar-toggle,.sidebar-edge-reveal,.omni-sidebar-close,.omni-sidebar-edge,.omni-sidebar-mobile,.omni-sidebar-backdrop",
      )
      .forEach((control) => control.remove());
    document.body.classList.remove(
      "omni-sidebar-collapsed",
      "omni-student-nav-ready",
      "menu-open",
      "nav-open",
      "study-menu-open",
    );
  };

  const buildStudentSidebar = () => {
    if (document.body.dataset.partyRole !== "student") return null;
    const root = `${getFrontendRoot()}aluno/`;
    const path = window.location.pathname;
    const definitions = [
      ["dashboard", "dashboard_principal", "space_dashboard", "Início"],
      ["atividades", "atividades", "assignment", "Atividades", "activity"],
      ["trilhas", "modulo_de_trilhas", "route", "Trilhas"],
      ["evolucao", "minha_evolucao", "monitoring", "Evolução"],
      ["biblioteca", "biblioteca_digital", "local_library", "Biblioteca"],
      ["notificacoes", "notificacoes", "notifications", "Notificações", "notification"],
      ["agenda", "agenda", "calendar_month", "Agenda"],
      ["perfil", "perfil", "person", "Perfil"],
      ["ajuda", "ajuda-suporte", "help", "Ajuda e suporte"],
    ];
    const active = path.includes("/mapa_dificuldades/")
      ? "dashboard"
      : definitions.find(([, folder]) => path.includes(`/aluno/${folder}/`))?.[0] ||
        null;
    const navItem = ([key, folder, icon, label, counter]) =>
      `<a href="${root}${folder}/index.html"${active === key ? ' class="active" aria-current="page"' : ""}><span class="material-symbols-outlined" aria-hidden="true">${icon}</span><span>${label}</span>${counter ? `<strong class="omni-student-nav-count" data-student-${counter}-count hidden></strong>` : ""}</a>`;

    const oldSidebar = document.querySelector(
      ".os-party-student-sidebar,.omni-student-sidebar",
    );
    const preserved = {
      name:
        oldSidebar?.querySelector("[data-profile-name],[data-shell-name]")
          ?.textContent || "Aluno",
      grade:
        oldSidebar?.querySelector(
          "[data-student-sidebar-grade],[data-profile-context],[data-shell-class]",
        )?.textContent || "Ensino Médio",
      initials:
        oldSidebar?.querySelector("[data-initials],[data-shell-avatar]")
          ?.textContent || "AL",
    };
    document
      .querySelectorAll(
        "aside.sidebar,aside.app-sidebar,aside.study-sidebar,aside.library-sidebar,[data-shared-sidebar]",
      )
      .forEach((element) => {
        if (
          !element.classList.contains("correction-sidebar") &&
          !element.classList.contains("notes-drawer")
        )
          element.remove();
      });
    cleanStudentSidebarArtifacts();

    const sidebar = document.createElement("aside");
    sidebar.className = "os-party-student-sidebar omni-student-sidebar";
    sidebar.id = "os-student-sidebar";
    sidebar.dataset.sidebar = "";
    sidebar.setAttribute("aria-label", "Navegação principal do aluno");
    sidebar.innerHTML = `<button class="os-student-sidebar-collapse" type="button" data-student-sidebar-collapse aria-label="Fechar menu lateral" aria-controls="os-student-sidebar" aria-expanded="true"><span class="material-symbols-outlined" aria-hidden="true">left_panel_close</span></button><a class="omni-student-brand" href="${root}dashboard_principal/index.html"><span class="omni-student-brand-mark material-symbols-outlined" aria-hidden="true">school</span><span class="omni-student-brand-copy">OminiSaber<small>Área do aluno</small></span></a><nav class="omni-student-nav"><p class="omni-student-nav-label">Aprender</p>${definitions.slice(0, 5).map(navItem).join("")}<p class="omni-student-nav-label">Organização</p>${definitions.slice(5).map(navItem).join("")}</nav><div class="omni-student-account"><span class="omni-student-avatar" data-initials data-shell-avatar>${preserved.initials}</span><div><strong data-profile-name data-shell-name>${preserved.name}</strong><small data-student-sidebar-grade data-profile-context data-profile-grade data-shell-class>${preserved.grade}</small></div></div><button class="omni-student-signout" type="button" data-student-signout><span class="material-symbols-outlined" aria-hidden="true">logout</span>Sair</button>`;
    sidebar
      .querySelector("[data-student-signout]")
      .addEventListener("click", async (event) => {
        event.currentTarget.disabled = true;
        try {
          if (window.OminiSaber?.signOut) await window.OminiSaber.signOut();
          else window.location.href = `${getFrontendRoot()}login/index.html`;
        } catch {
          event.currentTarget.disabled = false;
        }
      });
    document.body.prepend(sidebar);
    const reopen = document.createElement("button");
    reopen.type = "button";
    reopen.className = "os-student-sidebar-reopen";
    reopen.dataset.studentSidebarReopen = "";
    reopen.setAttribute("aria-label", "Abrir menu lateral");
    reopen.setAttribute("aria-controls", sidebar.id);
    reopen.setAttribute("aria-expanded", "true");
    reopen.innerHTML =
      '<span class="material-symbols-outlined" aria-hidden="true">right_panel_open</span>';
    document.body.appendChild(reopen);
    sidebar
      .querySelector("[data-student-sidebar-collapse]")
      .addEventListener("click", () => setStudentSidebarCollapsed(true, true));
    reopen.addEventListener("click", () =>
      setStudentSidebarCollapsed(false, true),
    );
    setStudentSidebarCollapsed(savedStudentSidebarState());
    return sidebar;
  };

  const closeMobileMenu = () => {
    if (document.body.dataset.partyRole === "teacher") {
      closeTeacherMobileMenu();
      return;
    }
    document.body.classList.remove(
      "os-mobile-menu-open",
      "menu-open",
      "nav-open",
    );
    const sidebar = document.querySelector(".os-party-student-sidebar");
    if (sidebar) sidebar.inert = window.innerWidth <= 900 || document.body.classList.contains("os-student-sidebar-collapsed");
    document
      .querySelectorAll(
        "[data-menu-toggle],[data-portal-menu],[data-os-mobile-menu],.os-mobile-nav-more",
      )
      .forEach((button) => button.setAttribute("aria-expanded", "false"));
  };

  const openMobileMenu = () => {
    if (document.body.dataset.partyRole === "teacher") {
      openTeacherMobileMenu();
      return;
    }
    document.body.classList.add("os-mobile-menu-open");
    const sidebar = document.querySelector(".os-party-student-sidebar");
    if (sidebar) sidebar.inert = false;
    document
      .querySelectorAll(
        "[data-menu-toggle],[data-portal-menu],[data-os-mobile-menu],.os-mobile-nav-more",
      )
      .forEach((button) => button.setAttribute("aria-expanded", "true"));
    window.setTimeout(
      () => document.querySelector(".os-mobile-close")?.focus(),
      30,
    );
  };

  const toggleMobileMenu = () => {
    if (document.body.classList.contains("os-mobile-menu-open")) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  };

  const createMobileMenuButton = (header) => {
    let button = header?.querySelector(
      "[data-menu-toggle],[data-os-mobile-menu],.menu-button",
    );
    if (button || !header) return button;

    button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button menu-button os-mobile-menu-button";
    button.dataset.osMobileMenu = "true";
    button.setAttribute("aria-label", "Abrir menu principal");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML =
      '<span class="material-symbols-outlined" aria-hidden="true">menu</span>';
    header.prepend(button);
    return button;
  };

  const getSidebarLinks = (sidebar) =>
    [...(sidebar?.querySelectorAll("a[href]") || [])].filter((link) => {
      const label = normalizeLabel(link.textContent);
      const href = link.getAttribute("href") || "";
      return (
        label &&
        !link.matches('.portal-brand,.omni-student-brand') &&
        !label.includes("sair") &&
        !label.includes("logout") &&
        !href.startsWith("javascript:") &&
        !href.startsWith("#")
      );
    });

  const getLinkLabel = (link) => {
    const copy = link.cloneNode(true);
    copy
      .querySelectorAll(
        ".material-symbols-outlined,.nav-badge,[class*='badge'],small",
      )
      .forEach((node) => node.remove());
    return copy.textContent.replace(/\s+/g, " ").trim();
  };

  const pickPrimaryLinks = (links, role) => {
    if (role === "teacher") {
      const folders = ["dashboard", "avaliacoes", "laboratorio", "agenda"];
      return folders.map(folder => links.find(link =>
        link.closest(".portal-nav") && new URL(link.href, location.href).pathname.includes(`/${folder}/`),
      )).filter(Boolean);
    }
    const priorities = {
      student: ["inicio", "atividades", "trilhas", "agenda"],
      teacher: ["visao geral", "avaliacoes", "laboratorio", "agenda"],
      manager: ["inicio", "turmas", "professores", "agenda"],
      library: ["inicio", "acervo", "emprestimos", "solicitacoes"],
      public: ["inicio", "recursos", "ajuda", "perfil"],
    };
    const picked = [];
    (priorities[role] || priorities.public).forEach((term) => {
      const match = links.find(
        (link) =>
          !picked.includes(link) &&
          normalizeLabel(link.textContent).includes(term),
      );
      if (match) picked.push(match);
    });
    links.forEach((link) => {
      if (picked.length < 4 && !picked.includes(link)) picked.push(link);
    });
    return picked.slice(0, 4);
  };

  const isCurrentLink = (link) => {
    if (link.matches(".active,[aria-current='page']")) return true;
    try {
      const target = new URL(link.href, window.location.href);
      return target.pathname === window.location.pathname;
    } catch {
      return false;
    }
  };

  const getStudentMobileItems = (links) => {
    const marker = window.location.pathname.indexOf("/frontend/");
    const root =
      marker >= 0
        ? `${window.location.pathname.slice(0, marker)}/frontend/aluno/`
        : "/frontend/aluno/";
    const definitions = [
      {
        label: "Início",
        icon: "home",
        folder: "dashboard_principal",
        active: /\/(dashboard_principal|mapa_dificuldades)\//.test(
          window.location.pathname,
        ),
      },
      {
        label: "Atividades",
        icon: "assignment",
        folder: "atividades",
      },
      {
        label: "Trilhas",
        icon: "route",
        folder: "modulo_de_trilhas",
      },
      {
        label: "Agenda",
        icon: "calendar_month",
        folder: "agenda",
      },
    ];
    return definitions.map((item) => {
      const source = links.find((link) =>
        normalizeLabel(getLinkLabel(link)).includes(
          normalizeLabel(item.label),
        ),
      );
      return {
        ...item,
        href: `${root}${item.folder}/index.html`,
        active:
          item.active ||
          window.location.pathname.includes(`/aluno/${item.folder}/`),
        badge: source?.querySelector(".nav-badge,[class*='badge']") || null,
      };
    });
  };

  const createMobileNav = (sidebar, role) => {
    const links = getSidebarLinks(sidebar);
    if (!links.length) return;
    const signature = role === "teacher"
      ? JSON.stringify(links.map(link => [link.href, getLinkLabel(link), isCurrentLink(link)]))
      : "";
    const existing = document.querySelector(".os-mobile-nav");
    if (existing) {
      if (role !== "teacher" || existing.dataset.teacherNavigationSignature === signature) return;
      existing.remove();
    }

    const nav = document.createElement("nav");
    nav.className = "os-mobile-nav";
    nav.setAttribute("aria-label", "Navegação principal no celular");
    if (role === "teacher") nav.dataset.teacherNavigationSignature = signature;

    const primaryItems =
      role === "student"
        ? getStudentMobileItems(links)
        : pickPrimaryLinks(links, role).map((source) => ({
            source,
            href: source.href,
            icon:
              source.querySelector(".material-symbols-outlined")?.textContent,
            label: role === 'teacher' ? (normalizeLabel(getLinkLabel(source)).includes('visao geral') ? 'Início' : /laboratorio|oficina/.test(normalizeLabel(getLinkLabel(source))) ? 'Aulas' : normalizeLabel(getLinkLabel(source)).includes('agenda') ? 'Agenda' : getLinkLabel(source)) : getLinkLabel(source),
            active: isCurrentLink(source),
            badge: source.querySelector(".nav-badge,[class*='badge']"),
          }));

    let hasActivePrimary = false;
    primaryItems.forEach((entry) => {
      const item = document.createElement("a");
      item.href = entry.href;
      item.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${entry.icon?.trim() || "circle"}</span><span>${entry.label || "Abrir"}</span>`;
      if (entry.active) {
        hasActivePrimary = true;
        item.classList.add("is-active");
        item.setAttribute("aria-current", "page");
      }
      const badge = entry.badge;
      if (badge && !badge.hidden && badge.textContent.trim()) {
        const badgeClone = badge.cloneNode(true);
        badgeClone.removeAttribute("hidden");
        item.appendChild(badgeClone);
      }
      nav.appendChild(item);
    });

    const more = document.createElement("button");
    more.type = "button";
    more.className = "os-mobile-nav-more";
    more.setAttribute("aria-label", "Abrir mais opções");
    more.setAttribute("aria-expanded", "false");
    more.innerHTML =
      '<span class="material-symbols-outlined" aria-hidden="true">more_horiz</span><span>Mais</span>';
    if (!hasActivePrimary) more.classList.add("is-active");
    more.addEventListener("click", toggleMobileMenu);
    nav.appendChild(more);
    document.body.appendChild(nav);
  };

  const setupMobileShell = () => {
    if (document.body.dataset.partyLayout !== "app") return;
    // Teacher navigation owns its close button, triggers and drawer lifecycle.
    if (document.body.dataset.partyRole === "teacher") return;
    const sidebar = document.querySelector(sidebarSelector);
    if (!sidebar) return;

    sidebar.dataset.osMobileDrawer = "true";
    if (!sidebar.querySelector(".os-mobile-close")) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "os-mobile-close";
      close.setAttribute("aria-label", "Fechar menu principal");
      close.innerHTML =
        '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
      close.addEventListener("click", closeMobileMenu);
      sidebar.prepend(close);
    }

    if (!document.querySelector(".os-mobile-backdrop")) {
      const backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "os-mobile-backdrop";
      backdrop.setAttribute("aria-label", "Fechar menu principal");
      backdrop.addEventListener("click", closeMobileMenu);
      document.body.appendChild(backdrop);
    }

    const header = document.querySelector(headerSelector);
    const menuButton = createMobileMenuButton(header);
    if (menuButton && !menuButton.dataset.osMobileBound) {
      menuButton.dataset.osMobileBound = "true";
      menuButton.addEventListener("click", () => {
        window.setTimeout(() => {
          if (
            document.body.classList.contains("menu-open") ||
            document.body.classList.contains("nav-open")
          ) {
            openMobileMenu();
          } else {
            toggleMobileMenu();
          }
        }, 0);
      });
    }

    sidebar.querySelectorAll("a[href]").forEach((link) => {
      if (!link.dataset.osMobileCloseBound) {
        link.dataset.osMobileCloseBound = "true";
        link.addEventListener("click", closeMobileMenu);
      }
    });

    createMobileNav(sidebar, document.body.dataset.partyRole || "public");
  };

  const boot = () => {
    const path = window.location.pathname.toLowerCase();
    document.body.classList.add("os-parties-ready");
    document.body.dataset.partyRole = inferRole(path);
    document.body.dataset.partyLayout = inferLayout(path);
    document.body.dataset.partySurface = inferSurface(path);
    loadSelectSystem();
    buildStudentSidebar();
    loadStudentOnboarding();
    cleanStudentSidebarArtifacts();
    addSkipLink();
    improveSemantics();
    markComponents();
    standardizeHeaders();
    setupTeacherSidebar();
    setupMobileShell();
    document.addEventListener("ominisaber:navigation-ready", () => {
      if (document.body.hasAttribute("data-teacher-navigation-pending")) return;
      setupTeacherSidebar();
      setupMobileShell();
    });
    keepPartiesLast();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove("os-shell-pending");
    }));
    document.dispatchEvent(
      new CustomEvent("ominisaber:parties-ready", {
        detail: {
          role: document.body.dataset.partyRole,
          layout: document.body.dataset.partyLayout,
          surface: document.body.dataset.partySurface,
        },
      }),
    );

    const observer = new MutationObserver((records) => {
      let shellChanged = false;
      records.forEach((record) =>
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(headerSelector) || node.querySelector(headerSelector)) {
            if (node.matches(headerSelector)) node.classList.add("os-standard-header");
            standardizeHeaders(node);
            shellChanged = true;
          }
          if (node.matches(sidebarSelector) || node.querySelector(sidebarSelector)) shellChanged = true;
          if (node.matches(`.td-header,${teacherToggleSelector}`) || node.querySelector(`.td-header,${teacherToggleSelector}`)) shellChanged = true;
        }),
      );
      // Rendering a card, chart or notification must not rebuild navigation.
      if (shellChanged) {
        cleanStudentSidebarArtifacts();
        setupTeacherSidebar();
        setupMobileShell();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", event => {
      if (!teacherNavigationReady()) return;
      const control = event.target.closest?.(`${teacherToggleSelector},[data-teacher-sidebar-close],.os-mobile-backdrop`);
      if (control?.matches(teacherToggleSelector)) {
        teacherMenuTrigger = control;
        if (teacherIsMobile()) toggleMobileMenu();
        else setTeacherSidebarCollapsed(!teacherSidebarCollapsed, true);
      } else if (control?.matches("[data-teacher-sidebar-close]")) {
        if (teacherIsMobile()) closeTeacherMobileMenu();
        else setTeacherSidebarCollapsed(true, true);
      } else if (control?.matches(".os-mobile-backdrop")) closeTeacherMobileMenu();
      else if (teacherIsMobile() && teacherSidebar()?.contains(event.target.closest?.("a[href]"))) closeTeacherMobileMenu(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (document.body.dataset.partyRole !== "teacher") {
        if (event.key === "Escape") closeMobileMenu();
        return;
      }
      if (!teacherNavigationReady()) return;
      const sidebar = teacherSidebar();
      const mobileOpen = teacherIsMobile() && document.body.classList.contains("os-mobile-menu-open");
      if (event.key === "Escape" && mobileOpen) {
        event.preventDefault();
        closeTeacherMobileMenu();
      } else if (event.key === "Escape" && !teacherIsMobile() && sidebar?.contains(document.activeElement)) {
        event.preventDefault();
        setTeacherSidebarCollapsed(true, true);
      } else if (event.key === "Tab" && mobileOpen) {
        const controls = teacherFocusables(sidebar);
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (!controls.includes(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    let teacherWasMobile = teacherIsMobile();
    window.addEventListener("resize", () => {
      if (document.body.dataset.partyRole === "teacher") {
        if (!teacherNavigationReady()) return;
        const focusedInSidebar = teacherSidebar()?.contains(document.activeElement);
        if (teacherWasMobile !== teacherIsMobile()) {
          closeTeacherMobileMenu(false);
          teacherWasMobile = teacherIsMobile();
        }
        syncTeacherSidebar();
        if (focusedInSidebar && teacherSidebar()?.inert) focusTeacherTrigger();
        return;
      }
      if (window.innerWidth > 900) closeMobileMenu();
      setStudentSidebarCollapsed(savedStudentSidebarState());
    });
    window.addEventListener("storage", event => {
      if (!teacherNavigationReady() || event.key !== teacherSidebarStorageKey) return;
      teacherSidebarCollapsed = event.newValue === "true";
      syncTeacherSidebar();
      if (teacherSidebar()?.inert && teacherSidebar().contains(document.activeElement)) focusTeacherTrigger();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
