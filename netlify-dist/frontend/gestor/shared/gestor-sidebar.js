(() => {
  const sidebar = document.querySelector(".manager-sidebar");
  if (!sidebar || sidebar.querySelector(".manager-sidebar-toggle")) return;
  const scrim = document.querySelector(".sidebar-scrim");
  const mobile = () => window.matchMedia("(max-width:900px)").matches;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "manager-sidebar-toggle";
  button.setAttribute("aria-controls", "manager-navigation");
  sidebar.id = "manager-navigation";
  const reopen = document.createElement("button");
  reopen.type = "button";
  reopen.className = "manager-sidebar-reopen";
  reopen.setAttribute("aria-controls", "manager-navigation");
  reopen.title = "Expandir menu";
  const icon = (name) =>
    `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
  document.body.append(button);
  document.body.append(reopen);
  document.querySelectorAll(".manager-nav a").forEach((link) => {
    const label = link.textContent.trim();
    link.title = label;
  });
  const sync = () => {
    const collapsed = document.body.classList.contains(
      "manager-sidebar-collapsed",
    );
    const open = sidebar.classList.contains("open");
    button.innerHTML = icon(mobile() ? "close" : "left_panel_close");
    button.setAttribute(
      "aria-label",
      mobile() ? "Fechar menu lateral" : "Recolher menu lateral",
    );
    button.setAttribute("aria-expanded", String(mobile() ? open : !collapsed));
    reopen.innerHTML = icon("right_panel_open");
    reopen.setAttribute("aria-label", "Expandir menu lateral");
  };
  if (localStorage.getItem("ominisaber:manager-sidebar") === "collapsed")
    document.body.classList.add("manager-sidebar-collapsed");
  const closeMobile = () => {
    sidebar.classList.remove("open");
    scrim?.classList.remove("open");
    document.body.classList.remove("mobile-sidebar-open");
    sync();
  };
  button.addEventListener("click", () => {
    if (mobile()) {
      closeMobile();
      return;
    }
    document.body.classList.toggle("manager-sidebar-collapsed");
    localStorage.setItem(
      "ominisaber:manager-sidebar",
      document.body.classList.contains("manager-sidebar-collapsed")
        ? "collapsed"
        : "expanded",
    );
    sync();
  });
  reopen.addEventListener("click", () => {
    document.body.classList.remove("manager-sidebar-collapsed");
    localStorage.setItem("ominisaber:manager-sidebar", "expanded");
    sync();
  });
  document.querySelector(".menu-btn")?.addEventListener("click", () => {
    document.body.classList.add("mobile-sidebar-open");
    requestAnimationFrame(sync);
  });
  scrim?.addEventListener("click", closeMobile);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobile()) closeMobile();
  });
  window.addEventListener("resize", () => {
    if (!mobile()) {
      sidebar.classList.remove("open");
      scrim?.classList.remove("open");
      document.body.classList.remove("mobile-sidebar-open");
    }
    sync();
  });
  sync();
})();
