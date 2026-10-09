(() => {
  "use strict";
  const HIDDEN_KEY = "ominisaber:teacher-copilot-hidden";
  const specialties = {
    portugues: ["Português", "edit_note", "professor_portugues"],
    matematica: ["Matemática", "calculate", "professor_matematica"],
    tecnico_informatica: ["Informática", "terminal", "professor_tecnico_informatica"],
    tecnico_administracao: ["Administração", "business_center", "professor_tecnico_administracao"],
  };
  const initials = (name) => String(name || "Professor").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const toast = (message, error = false) => {
    const node = document.querySelector("[data-profile-toast]");
    node.textContent = message;
    node.className = `toast visible${error ? " error" : ""}`;
    clearTimeout(node.timer);
    node.timer = setTimeout(() => node.classList.remove("visible"), 3200);
  };
  const stored = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const renderSidebar = async (profile) => {
    const config = window.OMINI_TEACHER_CONFIGS?.[profile.tipo_professor];
    if (!config) throw new Error("Não foi possível identificar sua especialidade docente.");
    const [, , folder] = specialties[profile.tipo_professor];
    const base = `../${folder}/`;
    const studioRoute = `/oministudio/?teacherType=${encodeURIComponent(config.type)}&returnTo=${encodeURIComponent(location.pathname)}#choose`;
    const { teacherSidebarMarkup } = await import("../specialty/teacher-navigation.js?v=20261004-8");
    const previous = document.querySelector("[data-profile-sidebar]") || document.querySelector("[data-teacher-sidebar]");
    previous.outerHTML = teacherSidebarMarkup({ config, page: "perfil", profile: profile.nome || "Professor", studioRoute, base });
    const sidebar = document.querySelector("[data-teacher-sidebar]");
    sidebar.dataset.profileSidebar = "";
    sidebar.querySelector("[data-portal-signout]").addEventListener("click", () => window.OminiSaber.signOut());
  };
  const init = async () => {
    try {
      const [profile, session] = await Promise.all([window.OminiSaber.getProfile(), window.OminiSaber.getSession()]);
      if (!profile || profile.role !== "professor") return;
      await renderSidebar(profile);
      const form = document.querySelector("[data-profile-form]");
      form.elements.name.value = profile.nome || "";
      form.elements.email.value = session?.user?.email || profile.email || "";
      document.querySelector("[data-profile-heading]").textContent = profile.nome || "Perfil do professor";
      document.querySelector("[data-profile-role]").textContent = specialties[profile.tipo_professor]?.[0] ? `Professor de ${specialties[profile.tipo_professor][0]}` : "Conta docente";
      document.querySelector("[data-profile-initials]").textContent = initials(profile.nome);
      const visible = document.querySelector("[data-copilot-visible]");
      visible.checked = stored(HIDDEN_KEY) !== "true";
      visible.addEventListener("change", () => {
        localStorage.setItem(HIDDEN_KEY, String(!visible.checked));
        toast(visible.checked ? "O Copiloto voltará a aparecer nas atividades." : "O acesso ao Copiloto foi ocultado neste dispositivo.");
      });
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = event.submitter;
        button.disabled = true;
        try {
          const updated = await window.OminiSaber.updateProfile({ nome: form.elements.name.value.trim(), email: form.elements.email.value.trim() });
          document.querySelector("[data-profile-heading]").textContent = updated?.nome || form.elements.name.value.trim();
          document.querySelector("[data-profile-initials]").textContent = initials(updated?.nome || form.elements.name.value);
          document.querySelector("[data-portal-profile]").textContent = updated?.nome || form.elements.name.value.trim();
          document.querySelector("[data-profile-status]").textContent = "Alterações salvas.";
          toast("Perfil atualizado com sucesso.");
        } catch (error) { toast(error.message, true); }
        finally { button.disabled = false; }
      });
    } catch (error) { toast(error.message, true); }
  };
  document.addEventListener("ominisaber:ready", init, { once: true });
})();
