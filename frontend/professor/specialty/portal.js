(() => {
  const config = window.OMINI_TEACHER_PORTAL;
  const root = document.querySelector("[data-teacher-portal]");
  if (!config || !root) return;
  const api = () => window.OminiSaber;
  const page = document.body.dataset.page || "dashboard";
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
  const formatDate = (value) =>
    value
      ? new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(value))
      : "Sem prazo";
  const toast = (message, type = "success") => {
    let node = document.querySelector("[data-portal-toast]");
    if (!node) {
      node = document.createElement("div");
      node.dataset.portalToast = "";
      node.className = "toast";
      node.setAttribute("role", "status");
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.className = `toast visible ${type === "error" ? "error" : ""}`;
    clearTimeout(node.timer);
    node.timer = setTimeout(() => node.classList.remove("visible"), 3600);
  };
  const curriculumPickerMarkup = (id, classes = []) => `<section class="curriculum-picker" data-curriculum-picker="${id}"><div class="picker-heading"><div><p class="eyebrow">Currículo publicado</p><strong>Habilidades opcionais</strong></div><small>Busque por código, descrição ou descritor.</small></div><div class="picker-filters"><select class="field" data-curriculum-class><option value="">Todas as turmas</option>${classes.map((item) => `<option value="${item.id}">${escapeHtml(item.nome)}${item.serie ? ` · ${escapeHtml(item.serie)}` : ""}</option>`).join("")}</select><select class="field" data-curriculum-trimestre><option value="">Todos os trimestres</option><option value="1">1º trimestre</option><option value="2">2º trimestre</option><option value="3">3º trimestre</option></select><input class="field" type="search" data-curriculum-search placeholder="Ex.: EM13LP01 ou D023_P"></div><div class="curriculum-results" data-curriculum-results><small>Pesquise para carregar habilidades.</small></div></section>`;
  const bindCurriculumPicker = (root, classes = []) => {
    const picker = root.querySelector("[data-curriculum-picker]");
    if (!picker) return { selected: () => [], clear: () => {} };
    const selected = new Set();
    const classField = picker.querySelector("[data-curriculum-class]");
    const trimesterField = picker.querySelector("[data-curriculum-trimestre]");
    const searchField = picker.querySelector("[data-curriculum-search]");
    const result = picker.querySelector("[data-curriculum-results]");
    const load = async () => {
      const classItem = classes.find((item) => item.id === classField.value);
      const seriesMatch = String(classItem?.serie || "").match(/\d+/);
      try {
        const skills = await api().listCurriculumSkills({ materia: config.type, serie: seriesMatch ? Number(seriesMatch[0]) : null, trimestre: trimesterField.value ? Number(trimesterField.value) : null, search: searchField.value.trim() });
        result.innerHTML = skills.length ? skills.map((skill) => `<label class="curriculum-result"><input type="checkbox" value="${skill.habilidade_id}" ${selected.has(skill.habilidade_id) ? "checked" : ""}><span><strong>${escapeHtml(skill.codigo)}</strong><span>${escapeHtml(skill.descricao)}</span><small>${(skill.descritores || []).length ? `Descritores: ${(skill.descritores || []).map((item) => escapeHtml(item.codigo)).join(", ")}` : "Sem descritor relacionado"} · ${skill.serie}ª série · ${skill.trimestre}º tri</small></span></label>`).join("") : "<small>Nenhuma habilidade EM publicada encontrada.</small>";
        result.querySelectorAll("input").forEach((input) => input.addEventListener("change", () => input.checked ? selected.add(input.value) : selected.delete(input.value)));
      } catch (error) { result.innerHTML = `<small class="error-text">${escapeHtml(error.message)}</small>`; }
    };
    [classField, trimesterField].forEach((field) => field.addEventListener("change", load));
    searchField.addEventListener("input", load);
    return { selected: () => [...selected], clear: () => { selected.clear(); result.innerHTML = "<small>Pesquise para carregar habilidades.</small>"; } };
  };
  window.OminiCurriculumPicker = { markup: curriculumPickerMarkup, bind: bindCurriculumPicker };
  const route = (name) => `../${name}/index.html`;
  const shell = () => {
    const writingLink =
      config.type === "portugues"
        ? `<a class="${page === "redacoes" ? "active" : ""}" href="${route("redacoes")}"><span class="material-symbols-outlined">edit_note</span>Redações</a>`
        : "";
    const topActions =
      page === "redacoes"
        ? `<a class="button secondary" href="${route("avaliacoes")}"><span class="material-symbols-outlined">fact_check</span>Avaliações</a><button class="button primary" type="button" data-new-prompt-global><span class="material-symbols-outlined">add</span>Nova proposta</button>`
        : `<a class="button secondary" href="${route("laboratorio")}"><span class="material-symbols-outlined">${config.labIcon}</span>Novo laboratório</a><a class="button primary" href="${route("avaliacoes")}"><span class="material-symbols-outlined">add_task</span>Nova avaliação</a>`;
    root.innerHTML = `<aside class="portal-sidebar" aria-label="Navegação docente"><a class="portal-brand" href="${route("dashboard")}"><span class="material-symbols-outlined">${config.icon}</span><span>OminiSaber<small>${escapeHtml(config.short)}</small></span></a><nav class="portal-nav"><a class="${page === "dashboard" ? "active" : ""}" href="${route("dashboard")}"><span class="material-symbols-outlined">space_dashboard</span>Visão geral</a><a class="${page === "laboratorio" ? "active" : ""}" href="${route("laboratorio")}"><span class="material-symbols-outlined">${config.labIcon}</span>${escapeHtml(config.labLabel)}</a><a class="${page === "avaliacoes" ? "active" : ""}" href="${route("avaliacoes")}"><span class="material-symbols-outlined">fact_check</span>Avaliações</a>${writingLink}</nav><div class="portal-profile"><span class="portal-avatar material-symbols-outlined">person</span><div><strong data-portal-profile>Professor</strong><small>${escapeHtml(config.title)}</small></div></div><button class="portal-signout" type="button" data-portal-signout><span class="material-symbols-outlined">logout</span>Sair</button></aside><main class="portal-main"><header class="portal-topbar"><button class="icon-button menu-button" type="button" data-portal-menu aria-label="Abrir navegação" aria-expanded="false"><span class="material-symbols-outlined">menu</span></button><div><p class="eyebrow">${escapeHtml(config.kicker)}</p><h1>${escapeHtml(config.pages[page].title)}</h1><p>${escapeHtml(config.pages[page].subtitle)}</p></div><div class="portal-actions">${topActions}</div></header><div class="portal-content" data-portal-content><section class="loading-state" aria-live="polite"><span class="material-symbols-outlined">progress_activity</span><p>Carregando dados do Supabase...</p></section></div></main>`;
    document
      .querySelector("[data-portal-menu]")
      ?.addEventListener("click", (event) => {
        document.body.classList.toggle("menu-open");
        event.currentTarget.setAttribute(
          "aria-expanded",
          String(document.body.classList.contains("menu-open")),
        );
      });
    document
      .querySelector("[data-portal-signout]")
      ?.addEventListener("click", () => api()?.signOut());
  };
  const listRows = (items, kind) =>
    items.length
      ? items
          .slice(0, 6)
          .map(
            (item) =>
              `<article class="content-row"><span class="content-icon material-symbols-outlined">${kind === "lab" ? config.labIcon : "assignment"}</span><div><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.turmas?.nome || "Modelo reutilizável")} · ${formatDate(item.prazo || item.encerra_em)}</small></div><span class="status ${item.status}">${escapeHtml(item.status)}</span></article>`,
          )
          .join("")
      : `<div class="empty-state"><span class="material-symbols-outlined">inventory_2</span><h2>Nenhum conteúdo ainda</h2><p>Crie o primeiro item e ele aparecerá aqui com dados reais.</p></div>`;
  const specialtyBoard = (data) => {
    if (config.type === "tecnico_administracao") {
      const columns = ["rascunho", "publicado", "encerrado"];
      return `<div class="kanban">${columns
        .map(
          (status) =>
            `<div class="kanban-column"><strong>${status}</strong>${
              data.labs
                .filter((item) => item.status === status)
                .map(
                  (item) =>
                    `<div class="kanban-card">${escapeHtml(item.titulo)}</div>`,
                )
                .join("") || '<div class="kanban-card">Nenhum projeto</div>'
            }</div>`,
        )
        .join("")}</div>`;
    }
    if (config.type === "tecnico_informatica") {
      const rows = data.labs
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.titulo)}</td><td>${escapeHtml(item.formato)}</td><td>${escapeHtml(item.status)}</td><td>${(item.entregas_laboratorio || []).length}</td></tr>`,
        )
        .join("");
      return `<div style="overflow:auto"><table class="technical-table"><thead><tr><th>Laboratório</th><th>Ambiente</th><th>Status</th><th>Entregas</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Nenhum laboratório configurado.</td></tr>'}</tbody></table></div>`;
    }
    return `<div class="content-list">${listRows(data.labs, "lab")}</div>`;
  };
  const renderDashboard = async (data) => {
    const content = document.querySelector("[data-portal-content]");
    let essays = [];
    if (config.type === "portugues") essays = await api().listTeacherEssays();
    const publishedLabs = data.labs.filter(
      (item) => item.status === "publicado",
    ).length;
    const draftEvaluations = data.evaluations.filter(
      (item) => item.status === "rascunho",
    ).length;
    const pending =
      config.type === "portugues"
        ? essays.filter((item) => item.status === "enviada").length
        : data.labs.reduce(
            (sum, item) =>
              sum +
              (item.entregas_laboratorio || []).filter(
                (entry) => entry.status === "enviada",
              ).length,
            0,
          );
    content.innerHTML = `<section class="hero"><div><p class="eyebrow">Espaço da especialidade</p><h2>${escapeHtml(config.hero)}</h2><p>${escapeHtml(config.description)}</p></div><span class="hero-symbol"><span class="material-symbols-outlined">${config.icon}</span></span></section><section class="metrics" aria-label="Resumo real do espaço"><article class="metric"><span>Turmas vinculadas</span><strong>${data.classes.length}</strong></article><article class="metric"><span>Alunos vinculados</span><strong>${data.studentCount}</strong></article><article class="metric"><span>Laboratórios publicados</span><strong>${publishedLabs}</strong></article><article class="metric"><span>${config.type === "portugues" ? "Redações pendentes" : "Entregas pendentes"}</span><strong>${pending}</strong></article></section><div class="workspace-grid"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">${escapeHtml(config.boardKicker)}</p><h2>${escapeHtml(config.boardTitle)}</h2></div><a class="button secondary" href="${route("laboratorio")}">Gerenciar</a></div>${specialtyBoard(data)}</section><aside class="panel"><div class="panel-heading"><div><p class="eyebrow">Produção</p><h2>Próximas ações</h2></div></div><div class="quick-grid"><a href="${route("laboratorio")}"><span class="material-symbols-outlined">${config.labIcon}</span>Criar ${escapeHtml(config.labSingular)}</a><a href="${route("avaliacoes")}"><span class="material-symbols-outlined">quiz</span>Preparar avaliação</a>${config.type === "portugues" ? `<a href="${route("redacoes")}"><span class="material-symbols-outlined">rate_review</span>Corrigir redações</a>` : ""}<a href="${route("avaliacoes")}"><span class="material-symbols-outlined">draft</span>${draftEvaluations} avaliações em rascunho</a></div></aside></div><section class="panel" style="margin-top:17px"><div class="panel-heading"><div><p class="eyebrow">Avaliações</p><h2>Preparação e aplicação</h2></div><a href="${route("avaliacoes")}">Ver todas</a></div><div class="content-list">${listRows(data.evaluations, "evaluation")}</div></section>`;
  };
  const classOptions = (classes) =>
    `<option value="">Modelo sem turma</option>${classes.map((item) => `<option value="${item.id}">${escapeHtml(item.nome)}${item.serie ? ` · ${escapeHtml(item.serie)}` : ""}</option>`).join("")}`;
  const renderLabs = (data) => {
    const content = document.querySelector("[data-portal-content]");
    content.innerHTML = `<div class="form-layout"><section class="form-card"><p class="eyebrow">Criação guiada</p><h2>${escapeHtml(config.labCreateTitle)}</h2><form data-lab-form><div class="form-grid"><label class="wide">Título<input name="title" required minlength="3" maxlength="140" placeholder="${escapeHtml(config.labTitlePlaceholder)}"></label><label>Turma<select name="classId">${classOptions(data.classes)}</select></label><label>Formato<select name="format">${config.labFormats.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("")}</select></label><label class="wide">Objetivo e orientação<textarea name="description" required rows="4" placeholder="Explique o que o aluno deve investigar, produzir ou demonstrar."></textarea></label><label>${escapeHtml(config.configLabel)}<input name="configValue" required placeholder="${escapeHtml(config.configPlaceholder)}"></label><label>Prazo<input name="deadline" type="datetime-local"></label></div>${curriculumPickerMarkup("lab-curriculum-picker", data.classes)}<div class="form-actions"><button class="button secondary" name="intent" value="draft">Salvar rascunho</button><button class="button primary" name="intent" value="publish">Publicar para turma</button></div></form></section><aside class="form-card builder-sidebar"><p class="eyebrow">Conteúdo real</p><h2>Seus laboratórios</h2><div class="content-list" data-lab-list>${listRows(data.labs, "lab")}</div></aside></div>`;
    const form = document.querySelector("[data-lab-form]");
    const curriculumPicker = bindCurriculumPicker(form, data.classes);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitter = event.submitter;
      const values = new FormData(form);
      submitter.disabled = true;
      try {
        await api().createTeacherLab({
          tipoProfessor: config.type,
          title: values.get("title").trim(),
          description: values.get("description").trim(),
          format: values.get("format"),
          classId: values.get("classId") || null,
          deadline: values.get("deadline") || null,
          configuration: {
            [config.configKey]: values.get("configValue").trim(),
          },
          skillIds: curriculumPicker.selected(),
          publish: submitter.value === "publish",
        });
        toast(
          submitter.value === "publish"
            ? "Laboratório publicado para a turma."
            : "Rascunho salvo com segurança.",
        );
        await load();
      } catch (error) {
        toast(error.message, "error");
      } finally {
        submitter.disabled = false;
      }
    });
  };
  const renderEvaluations = (data) => {
    const content = document.querySelector("[data-portal-content]");
    const questions = [];
    content.innerHTML = `<div class="form-layout"><section class="form-card"><p class="eyebrow">Construtor de avaliação</p><h2>${escapeHtml(config.evaluationTitle)}</h2><form data-evaluation-form><div class="form-grid"><label class="wide">Título<input name="title" required minlength="3" maxlength="140" placeholder="${escapeHtml(config.evaluationPlaceholder)}"></label><label>Turma<select name="classId">${classOptions(data.classes)}</select></label><label>Duração em minutos<input name="duration" type="number" min="5" max="300" value="50"></label><label>Valor total<input name="value" type="number" min="0.1" step="0.1" value="10"></label><label>Abertura<input name="opensAt" type="datetime-local"></label><label>Encerramento<input name="closesAt" type="datetime-local"></label><label class="wide">Instruções<textarea name="instructions" rows="3" placeholder="Oriente os alunos sobre critérios, consulta e forma de resposta."></textarea></label></div><div class="panel" style="margin-top:18px;box-shadow:none"><div class="panel-heading"><div><p class="eyebrow">Questão</p><h2>Adicionar questão</h2></div></div><div class="form-grid"><label class="wide">Enunciado<textarea data-question-statement rows="3" placeholder="${escapeHtml(config.questionPlaceholder)}"></textarea></label><label>Tipo<select data-question-type>${config.questionTypes.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}</select></label><label>Pontos<input data-question-points type="number" min="0.1" step="0.1" value="1"></label><label class="wide">Alternativas ou critérios<textarea data-question-options rows="3" placeholder="Uma opção ou critério por linha"></textarea></label><label class="wide">Resposta esperada<textarea data-question-answer rows="2" placeholder="Resposta, resultado ou critérios de correção"></textarea></label></div><div class="form-actions"><button class="button secondary" type="button" data-add-question>Adicionar à avaliação</button></div></div><div class="form-actions"><button class="button secondary" name="intent" value="draft">Salvar rascunho</button><button class="button primary" name="intent" value="publish">Publicar avaliação</button></div></form></section><aside class="form-card builder-sidebar"><p class="eyebrow">Composição</p><h2>Questões adicionadas</h2><div class="notice">A avaliação e suas questões são gravadas no Supabase somente ao salvar ou publicar.</div><div data-question-list style="margin-top:13px"></div><hr style="border:0;border-top:1px solid var(--line);margin:20px 0"><p class="eyebrow">Avaliações existentes</p><div class="content-list">${listRows(data.evaluations, "evaluation")}</div></aside></div>`;
    const questionFields = content.querySelector("[data-question-answer]")?.closest(".form-grid");
    questionFields?.insertAdjacentHTML("beforeend", curriculumPickerMarkup("question-curriculum-picker", data.classes));
    const questionPicker = bindCurriculumPicker(content, data.classes);
    const renderQuestions = () => {
      const target = document.querySelector("[data-question-list]");
      target.innerHTML = questions.length
        ? questions
            .map(
              (item, index) =>
                `<article class="question-draft"><strong>${index + 1}. ${escapeHtml(item.statement)}</strong><small>${escapeHtml(item.type.replaceAll("_", " "))} · ${item.points} ponto(s) · ${item.skillIds.length ? `${item.skillIds.length} habilidade(s)` : "sem habilidade"}</small><div class="question-toolbar"><button type="button" data-remove-question="${index}">Remover</button></div></article>`,
            )
            .join("")
        : '<div class="empty-state" style="min-height:150px"><span class="material-symbols-outlined">playlist_add</span><p>Adicione a primeira questão.</p></div>';
      document.querySelectorAll("[data-remove-question]").forEach((button) =>
        button.addEventListener("click", () => {
          questions.splice(Number(button.dataset.removeQuestion), 1);
          renderQuestions();
        }),
      );
    };
    renderQuestions();
    const questionList = document.querySelector("[data-question-list]");
    const addOrderControls = () =>
      questionList
        .querySelectorAll(".question-draft")
        .forEach((card, index) => {
          const toolbar = card.querySelector(".question-toolbar");
          if (!toolbar || toolbar.querySelector("[data-move-question]")) return;
          const up = document.createElement("button");
          up.type = "button";
          up.dataset.moveQuestion = "up";
          up.textContent = "Subir";
          up.disabled = index === 0;
          const down = document.createElement("button");
          down.type = "button";
          down.dataset.moveQuestion = "down";
          down.textContent = "Descer";
          down.disabled = index === questions.length - 1;
          toolbar.prepend(down);
          toolbar.prepend(up);
        });
    new MutationObserver(addOrderControls).observe(questionList, {
      childList: true,
      subtree: true,
    });
    addOrderControls();
    questionList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-move-question]");
      if (!button) return;
      const card = button.closest(".question-draft");
      const index = [
        ...questionList.querySelectorAll(".question-draft"),
      ].indexOf(card);
      const target =
        button.dataset.moveQuestion === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= questions.length) return;
      [questions[index], questions[target]] = [
        questions[target],
        questions[index],
      ];
      renderQuestions();
    });
    document
      .querySelector("[data-add-question]")
      .addEventListener("click", () => {
        const statement = document
          .querySelector("[data-question-statement]")
          .value.trim();
        if (!statement)
          return toast("Escreva o enunciado da questão.", "error");
        questions.push({
          statement,
          type: document.querySelector("[data-question-type]").value,
          points:
            Number(document.querySelector("[data-question-points]").value) || 1,
          alternatives: document
            .querySelector("[data-question-options]")
            .value.split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          answer: document.querySelector("[data-question-answer]").value.trim(),
          skillIds: questionPicker.selected(),
        });
        document.querySelector("[data-question-statement]").value = "";
        document.querySelector("[data-question-options]").value = "";
        document.querySelector("[data-question-answer]").value = "";
        questionPicker.clear();
        renderQuestions();
        toast("Questão adicionada à composição.");
      });
    document
      .querySelector("[data-evaluation-form]")
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitter = event.submitter;
        const values = new FormData(event.currentTarget);
        if (!questions.length)
          return toast("Adicione pelo menos uma questão.", "error");
        submitter.disabled = true;
        try {
          await api().createTeacherEvaluation({
            tipoProfessor: config.type,
            title: values.get("title").trim(),
            instructions: values.get("instructions").trim(),
            duration: Number(values.get("duration")),
            value: Number(values.get("value")),
            classId: values.get("classId") || null,
            opensAt: values.get("opensAt") || null,
            closesAt: values.get("closesAt") || null,
            configuration: { model: config.evaluationModel },
            questions,
            publish: submitter.value === "publish",
          });
          toast(
            submitter.value === "publish"
              ? "Avaliação publicada para a turma."
              : "Avaliação salva como rascunho.",
          );
          await load();
        } catch (error) {
          toast(error.message, "error");
        } finally {
          submitter.disabled = false;
        }
      });
  };
  const load = async () => {
    const content = document.querySelector("[data-portal-content]");
    content.innerHTML =
      '<section class="loading-state" aria-live="polite"><span class="material-symbols-outlined">progress_activity</span><p>Carregando dados do Supabase...</p></section>';
    try {
      const data = await api().getTeacherWorkspace(config.type);
      document.querySelector("[data-portal-profile]").textContent =
        data.profile?.nome || "Professor";
      if (page === "dashboard") await renderDashboard(data);
      else if (page === "laboratorio") renderLabs(data);
      else if (
        page === "redacoes" &&
        typeof window.renderPortugueseEssays === "function"
      )
        await window.renderPortugueseEssays({
          content,
          data,
          api: api(),
          escapeHtml,
          formatDate,
          toast,
          reload: load,
        });
      else renderEvaluations(data);
    } catch (error) {
      console.error(
        `[OminiSaber][Supabase][${config.type}] Falha ao carregar a página ${page}.`,
        error,
      );
      content.innerHTML = `<section class="empty-state" role="alert"><span class="material-symbols-outlined">cloud_off</span><h2>Não foi possível carregar o espaço</h2><p>${escapeHtml(error.message)}</p><button class="button primary" type="button" data-retry> tentar novamente</button></section>`;
      document.querySelector("[data-retry]")?.addEventListener("click", load);
    }
  };
  shell();
  const agendaLink = document.createElement("a");
  agendaLink.href = "../../agenda/index.html";
  agendaLink.innerHTML =
    '<span class="material-symbols-outlined">calendar_month</span>Agenda das turmas';
  document.querySelector(".portal-nav")?.appendChild(agendaLink);
  const agendaAction = document.createElement("a");
  agendaAction.className = "button secondary";
  agendaAction.href = "../../agenda/index.html";
  agendaAction.innerHTML =
    '<span class="material-symbols-outlined">event_upcoming</span>Agenda';
  document.querySelector(".portal-actions")?.prepend(agendaAction);
  document.addEventListener("click", (event) => {
    if (!document.body.classList.contains("menu-open")) return;
    const sidebar = document.querySelector(".portal-sidebar");
    if (
      !sidebar?.contains(event.target) &&
      !event.target.closest("[data-portal-menu]")
    ) {
      document.body.classList.remove("menu-open");
      document
        .querySelector("[data-portal-menu]")
        ?.setAttribute("aria-expanded", "false");
    }
  });
  document
    .querySelectorAll(".portal-nav a")
    .forEach((link) =>
      link.addEventListener("click", () =>
        document.body.classList.remove("menu-open"),
      ),
    );
  document.addEventListener("ominisaber:ready", load, { once: true });
})();
