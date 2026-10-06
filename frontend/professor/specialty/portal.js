(async () => {
  const requiredTeacherType = document.body.dataset.requiredTeacherType
    ?.split(",")[0]
    ?.trim();
  const config =
    window.OMINI_TEACHER_PORTAL ||
    window.OMINI_TEACHER_CONFIGS?.[requiredTeacherType];
  const root = document.querySelector("[data-teacher-portal]");
  if (!config || !root) return;
  const { teacherSidebarMarkup } = await import("./teacher-navigation.js?v=20261004-8");
  const api = () => window.OminiSaber;
  let programmingLab = null;
  let programmingActivity = null;
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
  const debounce = (callback, delay = 220) => {
    let timer = 0;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };
  };
  const loadAsset = (tag, attributes) =>
    new Promise((resolve, reject) => {
      const selector = attributes["data-portal-asset"]
        ? `[data-portal-asset="${attributes["data-portal-asset"]}"]`
        : null;
      const current = selector && document.querySelector(selector);
      if (current) {
        if (current.dataset.loaded === "true" || tag === "link") resolve(current);
        else {
          current.addEventListener("load", () => resolve(current), { once: true });
          current.addEventListener("error", reject, { once: true });
        }
        return;
      }
      const node = document.createElement(tag);
      Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
      node.addEventListener("load", () => {
        node.dataset.loaded = "true";
        resolve(node);
      }, { once: true });
      node.addEventListener("error", reject, { once: true });
      document.head.appendChild(node);
      if (tag === "link") resolve(node);
    });
  const loadWritingWorkspace = async () => {
    await Promise.all([
      loadAsset("link", {
        rel: "stylesheet",
        href: "../redacoes/style.css?v=20260929-2",
        "data-portal-asset": "writing-style",
      }),
      loadAsset("script", {
        src: "../redacoes/script.js?v=20260929-2",
        "data-portal-asset": "writing-script",
      }),
    ]);
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
    searchField.addEventListener("input", debounce(load, 260));
    return { selected: () => [...selected], clear: () => { selected.clear(); result.innerHTML = "<small>Pesquise para carregar habilidades.</small>"; } };
  };
  window.OminiCurriculumPicker = { markup: curriculumPickerMarkup, bind: bindCurriculumPicker };
  const route = (name) => `../${name}/index.html`;
  const studioRoute = () => {
    const params = new URLSearchParams({
      teacherType: config.type,
      returnTo: window.location.pathname,
    });
    const studio = new URL("/oministudio/", window.location.origin);
    studio.search = params.toString();
    studio.hash = "choose";
    return studio.href;
  };
  const shell = () => {
    if (page === "dashboard") {
      root.innerHTML = '<main id="conteudo-principal" data-portal-content><section class="loading-state" aria-live="polite"><span class="material-symbols-outlined" aria-hidden="true">progress_activity</span><p>Preparando o acompanhamento das suas turmas...</p></section></main>';
      return;
    }
    root.innerHTML = `${teacherSidebarMarkup({config, page, studioRoute: studioRoute(), escapeHtml})}<main class="portal-main"><header class="portal-topbar teacher-navigation-bar"><button type="button" class="icon-button" data-teacher-sidebar-toggle aria-label="Abrir menu do professor" aria-controls="teacher-sidebar" aria-expanded="false"><span class="material-symbols-outlined" aria-hidden="true">menu</span></button><a class="teacher-toolbar-brand" href="${route('dashboard')}">OminiSaber</a><span class="teacher-toolbar-context">${escapeHtml(config.short)}</span></header><div class="portal-content" data-portal-content><section class="loading-state" aria-live="polite"><span class="material-symbols-outlined" aria-hidden="true">progress_activity</span><p>Carregando seu espaço...</p></section></div></main>`;
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
    const { renderTeacherDashboard } = await import("./teacher-dashboard.js?v=20261004-8");
    return renderTeacherDashboard({ root, data, config, api: api(), escapeHtml, studioRoute: studioRoute(), reload: load });
  };
  const classOptions = (classes) =>
    `<option value="">Modelo sem turma</option>${classes.map((item) => `<option value="${item.id}">${escapeHtml(item.nome)}${item.serie ? ` · ${escapeHtml(item.serie)}` : ""}</option>`).join("")}`;
  const renderLabs = (data) => {
    const content = document.querySelector("[data-portal-content]");
    content.innerHTML = `<div class="form-layout"><section class="form-card"><p class="eyebrow">Criação guiada</p><h2>${escapeHtml(config.labCreateTitle)}</h2><form data-lab-form><div class="form-grid"><label class="wide">Título<input name="title" required minlength="3" maxlength="140" placeholder="${escapeHtml(config.labTitlePlaceholder)}"></label><label>Turma<select name="classId">${classOptions(data.classes)}</select></label><label>Formato<select name="format">${config.labFormats.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("")}</select></label><label class="wide">Objetivo e orientação<textarea name="description" required rows="4" placeholder="Explique o que o aluno deve investigar, produzir ou demonstrar."></textarea></label><label>${escapeHtml(config.configLabel)}<input name="configValue" required placeholder="${escapeHtml(config.configPlaceholder)}"></label><label>Prazo<input name="deadline" type="datetime-local"></label></div>${curriculumPickerMarkup("lab-curriculum-picker", data.classes)}<div class="form-actions"><button class="button secondary" name="intent" value="draft">Salvar rascunho</button><button class="button primary" name="intent" value="publish">Publicar para turma</button></div></form></section><aside class="form-card builder-sidebar"><p class="eyebrow">Conteúdo real</p><h2>Seus laboratórios</h2><div class="content-list" data-lab-list>${listRows(data.labs, "lab")}</div></aside></div>`;
    const form = document.querySelector("[data-lab-form]");
    if (config.type === "tecnico_informatica") {
      programmingLab?.dispose();
      programmingActivity = null;
      const existing = content.querySelector(".form-layout");
      const publisher = document.createElement("details");
      publisher.className = "pl-teacher-publish";
      publisher.innerHTML = '<summary>Orientar uma turma ou criar outro laboratório</summary>';
      publisher.append(existing);
      const labRoot = document.createElement("div");
      labRoot.dataset.programmingLab = "";
      labRoot.innerHTML = '<p class="notice">Preparando o laboratório de programação…</p>';
      content.replaceChildren(labRoot, publisher);
      import("../../shared/programming-lab/programming-lab.js").then(({ mountProgrammingLab }) => {
        if (!labRoot.isConnected) return;
        programmingLab = mountProgrammingLab(labRoot, { mode: "teacher", userId: data.profile?.id || "professor", onAssign: ({ language, lesson, url }) => {
          programmingActivity = { language, lessonId: lesson.id };
          form.elements.title.value = lesson.title + " · " + (language === "python" ? "Python" : "C++");
          form.elements.format.value = "desafio_codigo";
          form.elements.description.value = lesson.task + "\n\nAbra a prática: " + url + "\n\nPreveja a saída, valide todos os cenários e resolva a variação. Explique à turma como você chegou à solução.";
          form.elements.configValue.value = language === "python" ? "Python no navegador" : "C++20 no navegador";
          publisher.open = true;
          publisher.scrollIntoView({ block: "start" });
          form.elements.classId.focus();
        } });
      }).catch(() => { labRoot.innerHTML = '<p class="notice">Não foi possível abrir a prática. Recarregue a página para tentar novamente.</p>'; });
    }
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
            ...(programmingActivity && values.get("format") === "desafio_codigo" ? { programming_language: programmingActivity.language, programming_lesson: programmingActivity.lessonId } : {}),
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
      const profileName = document.querySelector("[data-portal-profile]");
      if (profileName) profileName.textContent = data.profile?.nome || "Professor";
      if (page === "dashboard") await renderDashboard(data);
      else if (page === "laboratorio") renderLabs(data);
      else if (page === "redacoes") {
        if (typeof window.renderPortugueseEssays !== "function")
          await loadWritingWorkspace();
        await window.renderPortugueseEssays({
          content,
          data,
          api: api(),
          escapeHtml,
          formatDate,
          toast,
          reload: load,
        });
      }
      else if (page === "avaliacoes") {
        await import("../../Parties/teacher-evaluations.js?v=20261004-8");
        await window.renderTeacherEvaluations({
          content,
          data,
          api: api(),
          config,
          escapeHtml,
          formatDate,
          toast,
          reload: load,
        });
      }
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
  const agendaAction = document.createElement("a");
  agendaAction.className = "button secondary";
  agendaAction.href = "../../agenda/index.html";
  agendaAction.innerHTML =
    '<span class="material-symbols-outlined">event_upcoming</span>Agenda';
  document.querySelector(".portal-actions")?.prepend(agendaAction);
  document.addEventListener("ominisaber:ready", load, { once: true });
})();
