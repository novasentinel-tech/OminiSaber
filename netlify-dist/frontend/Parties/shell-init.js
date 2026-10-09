/* Inlined by migrate-html.mjs before page styles: restore layout before paint. */
(() => {
  const root = document.documentElement;
  root.classList.add("os-student-shell", "os-shell-pending");
  let collapsed = false;
  try {
    collapsed = localStorage.getItem("ominisaber:student-sidebar-collapsed") === "true";
  } catch { /* Storage may be unavailable; the default layout still works. */ }
  root.classList.toggle("os-sidebar-collapsed", innerWidth > 900 && collapsed);
})();
