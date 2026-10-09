(() => {
  const dialog = window.OminiDayDialog.create();
  let requestVersion = 0;
  let linkedEvent = new URLSearchParams(location.search).get("evento");
  const subjectFilter = new URLSearchParams(location.search).get("materia") || "";
  const subjectLabels = {
    matematica: "matematica",
    portugues: "portugues",
    fisica: "fisica",
    redacao: "redacao",
    tecnico_administracao: "administracao",
    tecnico_informatica: "informatica",
  };
  const state = {
    cursor: new Date(),
    selected: new Date(),
    events: [],
    filter: "all",
    unsubscribe: null,
  };
  const el = {
    calendar: document.querySelector("[data-calendar]"),
    month: document.querySelector("[data-month-title]"),
    loading: document.querySelector("[data-loading]"),
    dayLabel: dialog.title,
    dayNumber: dialog.number,
    dayEvents: dialog.content,
    upcoming: document.querySelector("[data-upcoming-events]"),
  };
  const isoDay = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const sameDay = (date, iso) => isoDay(date) === isoDay(new Date(iso));
  const escapeHtml = (value = "") =>
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
  const normalize = (value = "") =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const visibleEvents = () =>
    state.events.filter(
      (item) =>
        (state.filter === "all" || item.tipo === state.filter) &&
        (!subjectFilter ||
          normalize(item.materia).includes(subjectLabels[subjectFilter] || subjectFilter)),
    );
  const typeLabel = {
    prova: "Prova",
    recuperacao: "Recuperação",
    trabalho: "Trabalho",
    atividade: "Atividade",
    aula: "Aula",
    reuniao: "Reunião",
    outro: "Evento",
  };
  const renderEvent = (event) => {
    const date = new Date(event.inicio);
    const end = event.fim ? new Date(event.fim) : null;
    const timeOptions = { hour: "2-digit", minute: "2-digit" };
    const hours = event.dia_inteiro ? "Dia todo" : date.toLocaleTimeString("pt-BR", timeOptions) + (end && !Number.isNaN(end.getTime()) ? ` – ${sameDay(date, event.fim) ? "" : end.toLocaleDateString("pt-BR") + " às "}${end.toLocaleTimeString("pt-BR", timeOptions)}` : "");
    return `<article class="agenda-event ${escapeHtml(event.tipo)}"><header><strong>${escapeHtml(event.titulo)}</strong><time>${hours}</time></header><p>${escapeHtml(event.descricao || typeLabel[event.tipo] || "Compromisso escolar")}</p><div class="event-meta"><span>${escapeHtml(typeLabel[event.tipo] || "Evento")}</span><span><span class="material-symbols-outlined" aria-hidden="true">book_2</span>${escapeHtml(event.materia || "Geral")}</span>${event.local ? `<span><span class="material-symbols-outlined" aria-hidden="true">location_on</span>${escapeHtml(event.local)}</span>` : ""}${event.perfis?.nome ? `<span><span class="material-symbols-outlined" aria-hidden="true">person</span>${escapeHtml(event.perfis.nome)}</span>` : ""}</div></article>`;
  };
  const renderDetails = () => {
    const items = visibleEvents().filter((item) =>
      sameDay(state.selected, item.inicio),
    );
    el.dayLabel.textContent = state.selected.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    el.dayNumber.textContent = state.selected.getDate();
    dialog.count.textContent = items.length ? `${items.length} compromisso${items.length === 1 ? "" : "s"} neste dia` : "Um espaço livre na sua agenda";
    el.dayEvents.innerHTML = items.length
      ? items.map(renderEvent).join("")
      : `<div class="empty-day"><span class="material-symbols-outlined">event_available</span><p>Nenhum compromisso neste dia.</p></div>`;
    const now = new Date();
    const upcoming = visibleEvents()
      .filter((item) => new Date(item.inicio) >= now)
      .slice(0, 4);
    el.upcoming.innerHTML = upcoming.length
      ? upcoming
          .map((item) => {
            const d = new Date(item.inicio);
            return `<button type="button" class="upcoming-row" data-open-date="${isoDay(d)}" aria-haspopup="dialog"><span class="upcoming-date"><b>${d.getDate()}</b><small>${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</small></span><div><strong>${escapeHtml(item.titulo)}</strong><span>${escapeHtml(item.materia || typeLabel[item.tipo])}</span></div><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>`;
          })
          .join("")
      : `<p class="empty-day">Sem compromissos próximos.</p>`;
  };
  const renderCalendar = () => {
    const year = state.cursor.getFullYear(),
      month = state.cursor.getMonth();
    el.month.textContent = state.cursor.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    let html = "";
    for (let i = 0; i < 42; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const items = visibleEvents().filter((item) => sameDay(day, item.inicio));
      const classes = ["calendar-day"];
      if (day.getMonth() !== month) classes.push("outside");
      if (sameDay(day, new Date().toISOString())) classes.push("today");
      if (isoDay(day) === isoDay(state.selected)) classes.push("selected");
      html += `<button type="button" class="${classes.join(" ")}" data-date="${isoDay(day)}" aria-haspopup="dialog" aria-pressed="${isoDay(day) === isoDay(state.selected)}" aria-label="${day.toLocaleDateString("pt-BR")}, ${items.length} compromissos"><span class="day-number">${day.getDate()}</span>${items
        .slice(0, 2)
        .map(
          (item) =>
            `<span class="event-pill ${item.tipo}">${escapeHtml(item.titulo)}</span>`,
        )
        .join(
          "",
        )}${items.length > 2 ? `<small class="more-events">+${items.length - 2} eventos</small>` : ""}</button>`;
    }
    el.calendar.innerHTML = html;
    renderDetails();
  };
  const load = async () => {
    const version = ++requestVersion;
    el.loading.hidden = false;
    try {
      if (!window.OminiSaber?.configured)
        throw new Error("O Supabase não está configurado.");
      const from = new Date(
        state.cursor.getFullYear(),
        state.cursor.getMonth() - 1,
        1,
      );
      const to = new Date(
        state.cursor.getFullYear(),
        state.cursor.getMonth() + 2,
        1,
      );
      const events = await window.OminiSaber.listAgendaEvents({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      if (version !== requestVersion) return;
      state.events = events;
      const now = new Date();
      const next = visibleEvents().filter(
        (item) => new Date(item.inicio) >= now && item.status === "publicado",
      );
      document.querySelector("[data-next-count]").textContent = next.length;
      document.querySelector("[data-assessment-count]").textContent =
        next.filter((item) =>
          ["prova", "recuperacao"].includes(item.tipo),
        ).length;
      renderCalendar();
      if (linkedEvent) {
        const event = state.events.find(item => item.id === linkedEvent);
        if (event) {
          linkedEvent = null;
          const date = isoDay(new Date(event.inicio));
          selectDay(date, el.calendar.querySelector(`[data-date="${date}"]`) || document.querySelector("[data-today]"));
        }
      }
    } catch (error) {
      if (version !== requestVersion) return;
      window.StudentShell?.notify(
        error.message || "Não foi possível carregar a agenda.",
        "error",
      );
      state.events = [];
      renderCalendar();
    } finally {
      if (version === requestVersion) el.loading.hidden = true;
    }
  };
  const selectDay = (date, button) => {
    const [y, m, d] = date.split("-").map(Number);
    state.selected = new Date(y, m - 1, d);
    el.calendar.querySelectorAll("[data-date]").forEach(cell => {
      const selected = cell.dataset.date === date;
      cell.classList.toggle("selected", selected);
      cell.setAttribute("aria-pressed", String(selected));
    });
    renderDetails();
    dialog.open(button);
  };
  el.calendar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (button) selectDay(button.dataset.date, button);
  });
  el.upcoming.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-date]");
    if (button) selectDay(button.dataset.openDate, el.calendar.querySelector(`[data-date="${button.dataset.openDate}"]`) || document.querySelector("[data-today]"));
  });
  document.querySelector("[data-prev-month]").addEventListener("click", () => {
    state.cursor = new Date(
      state.cursor.getFullYear(),
      state.cursor.getMonth() - 1,
      1,
    );
    load();
  });
  document.querySelector("[data-next-month]").addEventListener("click", () => {
    state.cursor = new Date(
      state.cursor.getFullYear(),
      state.cursor.getMonth() + 1,
      1,
    );
    load();
  });
  document.querySelector("[data-today]").addEventListener("click", () => {
    state.cursor = new Date();
    state.selected = new Date();
    load();
  });
  document
    .querySelector("[data-type-filter]")
    .addEventListener("change", (event) => {
      state.filter = event.target.value;
      renderCalendar();
    });
  document.addEventListener(
    "ominisaber:ready",
    () => {
      load();
      if (window.OminiSaber?.configured)
        state.unsubscribe = window.OminiSaber.subscribeToAgenda(() => load());
    },
    { once: true },
  );
  window.addEventListener("beforeunload", () => state.unsubscribe?.());
})();
