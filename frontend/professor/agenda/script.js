(() => {
  const state = {
    events: [],
    classes: [],
    profile: null,
    filter: "all",
    search: "",
    unsubscribe: null,
  };
  const list = document.querySelector("[data-events-list]"),
    loading = document.querySelector("[data-events-loading]"),
    form = document.querySelector("[data-event-form]"),
    toast = document.querySelector("[data-toast]");
  let toastTimer;
  const debounce = (callback, delay = 180) => {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => callback(...args), delay);
    };
  };
  const notify = (message, type = "success") => {
    toast.textContent = message;
    toast.className = `toast visible ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.className = "toast"), 3600);
  };
  const escapeHtml = (v = "") =>
    String(v).replace(
      /[&<>'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c],
    );
  const labels = {
    prova: "Prova",
    recuperacao: "Recuperação",
    trabalho: "Trabalho",
    atividade: "Atividade",
    aula: "Aula",
    reuniao: "Reunião",
    outro: "Evento",
  };
  const specialties = {
    matematica: "Matemática",
    portugues: "Língua Portuguesa",
    tecnico_administracao: "Técnico em Administração",
    tecnico_informatica: "Técnico em Informática",
  };
  const renderTeacherNavigation = async () => {
    const config = window.OMINI_TEACHER_CONFIGS?.[state.profile?.tipo_professor];
    if (!config) throw new Error("Não foi possível identificar sua especialidade docente.");
    const { teacherSidebarMarkup } = await import("../specialty/teacher-navigation.js?v=20261004-8");
    const base = `../professor_${config.type}/`;
    const studioRoute = `/oministudio/?teacherType=${encodeURIComponent(config.type)}&returnTo=${encodeURIComponent(location.pathname)}#choose`;
    const toggle = document.querySelector("[data-agenda-menu]");
    toggle.removeAttribute("data-menu-toggle");
    toggle.dataset.teacherSidebarToggle = "";
    toggle.setAttribute("aria-controls", "teacher-sidebar");
    document.body.removeAttribute("data-teacher-navigation-pending");
    document.querySelector(".portal-sidebar").outerHTML = teacherSidebarMarkup({ config, page: "agenda", profile: state.profile.nome || "Professor", studioRoute, base, escapeHtml });
    document.querySelector("[data-portal-signout]").addEventListener("click", () => window.OminiSaber.signOut());
    document.querySelector("[data-agenda-panel-link]").href = `${base}dashboard/index.html`;
    document.dispatchEvent(new CustomEvent("ominisaber:navigation-ready"));
  };
  const normalizeSearch = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const render = () => {
    const terms = normalizeSearch(state.search).trim().split(/\s+/).filter(Boolean);
    const items = state.events.filter(
      (item) => (state.filter === "all" || item.turma_id === state.filter) &&
        terms.every((term) => normalizeSearch([
          item.titulo, item.materia, item.turmas?.nome, item.perfis?.nome,
          labels[item.tipo], new Date(item.inicio).toLocaleDateString("pt-BR"),
        ].join(" ")).includes(term)),
    );
    document.querySelector("[data-list-caption]").textContent =
      `${items.length} compromisso${items.length === 1 ? "" : "s"} ${items.length === 1 ? "visível" : "visíveis"}`;
    list.innerHTML = items.length
      ? items
          .map((item) => {
            const d = new Date(item.inicio),
              own = item.professor_id === state.profile?.id;
            return `<article class="event-row"><div class="event-date"><strong>${d.getDate()}</strong><span>${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span></div><div class="event-main"><header><strong>${escapeHtml(item.titulo)}</strong><span class="event-type ${item.tipo}">${labels[item.tipo]}</span></header><p>${d.toLocaleDateString("pt-BR", { weekday: "long" })} · ${item.dia_inteiro ? "dia todo" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p><div class="event-meta"><span><span class="material-symbols-outlined">groups</span>${escapeHtml(item.turmas?.nome || "Turma")}</span><span><span class="material-symbols-outlined">book_2</span>${escapeHtml(item.materia || "Geral")}</span><span><span class="material-symbols-outlined">person</span>${escapeHtml(item.perfis?.nome || "Professor")}</span></div></div><div class="event-actions">${own ? `<button type="button" data-cancel="${item.id}" aria-label="Cancelar compromisso"><span class="material-symbols-outlined">event_busy</span></button><button type="button" data-delete="${item.id}" aria-label="Excluir compromisso"><span class="material-symbols-outlined">delete</span></button>` : ""}</div></article>`;
          })
          .join("")
      : `<div class="state"><span class="material-symbols-outlined">event_available</span><h2>${terms.length ? "Nenhum resultado" : "Agenda livre"}</h2><p>${terms.length ? "Tente outro termo ou selecione outra turma." : "Nenhum compromisso no período carregado para este filtro."}</p></div>`;
  };
  const load = async () => {
    loading.hidden = false;
    try {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const to = new Date();
      to.setMonth(to.getMonth() + 5);
      state.events = await window.OminiSaber.listAgendaEvents({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      render();
    } catch (error) {
      notify(error.message || "Não foi possível carregar a agenda.", "error");
    } finally {
      loading.hidden = true;
    }
  };
  const init = async (event) => {
    try {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      form.elements.date.value = date.toISOString().slice(0, 10);
      form.elements.time.value = "08:00";
      const session = event.detail?.session;
      if (!session) throw new Error("Sessão expirada. Entre novamente.");
      state.profile = await window.OminiSaber.getProfile(session.user.id);
      state.profile.id = session.user.id;
      document.body.dataset.partyRole = state.profile.role === "gestor" ? "manager" : "teacher";
      if (state.profile.role === "gestor") {
        document.querySelector(".portal-sidebar")?.setAttribute("data-sidebar", "");
        document.body.removeAttribute("data-teacher-navigation-pending");
        document.dispatchEvent(new CustomEvent("ominisaber:navigation-ready"));
      }
      const linkedClasses = await window.OminiSaber.listTeacherClasses();
      state.classes = [
        ...new Map(linkedClasses.map((item) => [item.id, item])).values(),
      ];
      document.querySelector("[data-teacher-name]").textContent =
        state.profile?.nome || "Professor";
      document.querySelector("[data-teacher-specialty]").textContent =
        specialties[state.profile?.tipo_professor] || "Docente";
      form.elements.subject.value =
        specialties[state.profile?.tipo_professor] || "";
      if (state.profile.role === "professor") await renderTeacherNavigation();
      const options = state.classes
        .map(
          (item) =>
            `<option value="${item.id}">${escapeHtml(item.nome)}</option>`,
        )
        .join("");
      form.elements.classId.insertAdjacentHTML("beforeend", options);
      document
        .querySelector("[data-class-filter]")
        .insertAdjacentHTML("beforeend", options);
      await load();
      state.unsubscribe = window.OminiSaber.subscribeToAgenda(() => load());
    } catch (error) {
      console.error(
        "[OminiSaber][agenda] Falha ao carregar agenda docente:",
        error,
      );
      notify(error.message || "Não foi possível preparar a agenda.", "error");
      loading.hidden = true;
    }
  };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const date = form.elements.date.value,
      time = form.elements.time.value,
      endTime = form.elements.endTime.value;
    button.disabled = true;
    try {
      const created = await window.OminiSaber.createAgendaEvent({
        title: form.elements.title.value,
        type: form.elements.type.value,
        classId: form.elements.classId.value,
        start: new Date(`${date}T${time}`).toISOString(),
        end: endTime ? new Date(`${date}T${endTime}`).toISOString() : null,
        subject: form.elements.subject.value,
        location: form.elements.location.value,
        description: form.elements.description.value,
        status: form.elements.published.checked ? "publicado" : "rascunho",
      });
      form.elements.title.value = "";
      form.elements.description.value = "";
      form.elements.location.value = "";
      document.body.classList.remove("form-open");
      notify(
        form.elements.published.checked
          ? created?.push?.devices > 0
            ? `Compromisso publicado e enviado para ${created.push.devices} dispositivo${created.push.devices === 1 ? "" : "s"}.`
            : "Compromisso publicado. Os alunos já podem vê-lo; o push será enviado aos dispositivos ativados."
          : "Rascunho salvo.",
      );
      await load();
    } catch (error) {
      notify(error.message || "Não foi possível publicar.", "error");
    } finally {
      button.disabled = false;
    }
  });
  list.addEventListener("click", async (e) => {
    const cancel = e.target.closest("[data-cancel]"),
      del = e.target.closest("[data-delete]");
    if (!cancel && !del) return;
    const id = (cancel || del).dataset[cancel ? "cancel" : "delete"];
    try {
      if (cancel)
        await window.OminiSaber.updateAgendaEvent(id, { status: "cancelado" });
      else await window.OminiSaber.deleteAgendaEvent(id);
      notify(
        cancel
          ? "Compromisso cancelado e aviso removido."
          : "Compromisso excluído.",
      );
      await load();
    } catch (error) {
      notify(error.message, "error");
    }
  });
  document
    .querySelector("[data-class-filter]")
    .addEventListener("change", (e) => {
      state.filter = e.target.value;
      render();
    });
  document.querySelector("[data-event-search]").addEventListener(
    "input",
    debounce((event) => {
      state.search = event.target.value;
      render();
    }),
  );
  document
    .querySelector("[data-open-form]")
    .addEventListener("click", () => document.body.classList.add("form-open"));
  document
    .querySelector("[data-close-form]")
    .addEventListener("click", () =>
      document.body.classList.remove("form-open"),
    );
  document
    .querySelector("[data-agenda-menu]")
    .addEventListener("click", (e) => {
      if (state.profile?.role === "professor") return;
      document.body.classList.toggle("nav-open");
      e.currentTarget.setAttribute(
        "aria-expanded",
        String(document.body.classList.contains("nav-open")),
      );
    });
  document.addEventListener("ominisaber:ready", init, { once: true });
  window.addEventListener("beforeunload", () => state.unsubscribe?.());
})();
