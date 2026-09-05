window.OMINI_TEACHER_PORTAL = window.OMINI_TEACHER_CONFIGS.portugues;

window.renderPortugueseEssays = async ({
  content,
  data,
  api,
  escapeHtml,
  toast,
  reload,
}) => {
  const [essays, prompts, drafts] = await Promise.all([
    api.listTeacherEssays(),
    api.listTeacherWritingPrompts(),
    api.listEssayCorrectionDrafts(),
  ]);
  let selectedId = essays[0]?.id || null;
  let currentView = "entregas";
  const draftByEssay = new Map(
    drafts.map((draft) => [draft.redacao_id, draft]),
  );
  const classLabel = (essay) => essay.perfis?.turmas?.nome || "Sem turma";
  const studentName = (essay) =>
    essay.perfis?.nome || "Aluno sem nome cadastrado";
  const initials = (name) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "AL";
  const dateTime = (value) =>
    value
      ? new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(value))
      : "Data não informada";
  const corrected = essays.filter((essay) => essay.status === "corrigida");
  const pending = essays.filter((essay) => essay.status === "enviada");
  const scored = corrected.filter((essay) =>
    Number.isFinite(Number(essay.nota)),
  );
  const averageScore = scored.length
    ? Math.round(
        scored.reduce((sum, essay) => sum + Number(essay.nota), 0) /
          scored.length,
      )
    : null;
  const correctionDurations = corrected
    .filter((essay) => essay.enviada_em && essay.corrigida_em)
    .map((essay) => new Date(essay.corrigida_em) - new Date(essay.enviada_em))
    .filter((value) => value >= 0);
  const averageCorrection = correctionDurations.length
    ? correctionDurations.reduce((sum, value) => sum + value, 0) /
      correctionDurations.length
    : null;
  const formatDuration = (milliseconds) => {
    if (milliseconds === null) return "Sem dados";
    const hours = Math.round(milliseconds / 3600000);
    return hours >= 24
      ? `${Math.floor(hours / 24)}d ${hours % 24}h`
      : `${hours}h`;
  };
  const deadlines = essays.filter(
    (essay) => essay.enviada_em && essay.propostas_redacao?.prazo,
  );
  const onTime = deadlines.length
    ? Math.round(
        (deadlines.filter(
          (essay) =>
            new Date(essay.enviada_em) <=
            new Date(essay.propostas_redacao.prazo),
        ).length /
          deadlines.length) *
          100,
      )
    : null;

  content.innerHTML = `<section class="metrics" aria-label="Indicadores reais de redação">
    <article class="metric"><span>Para corrigir</span><strong>${pending.length}</strong></article>
    <article class="metric"><span>Tempo médio de devolutiva</span><strong>${formatDuration(averageCorrection)}</strong></article>
    <article class="metric"><span>Média das redações</span><strong>${averageScore ?? "—"}</strong></article>
    <article class="metric"><span>Entregas no prazo</span><strong>${onTime === null ? "—" : `${onTime}%`}</strong></article>
  </section>
  <div class="writing-tabs" role="tablist" aria-label="Áreas de redação">
    <button class="writing-tab active" type="button" data-writing-view="entregas" role="tab">Entregas <span>${pending.length}</span></button>
    <button class="writing-tab" type="button" data-writing-view="propostas" role="tab">Propostas <span>${prompts.length}</span></button>
    <button class="writing-tab" type="button" data-writing-view="evolucao" role="tab">Evolução</button>
  </div>
  <section data-writing-panel></section>
  <dialog class="dialog" data-prompt-dialog>
    <form method="dialog" data-prompt-form>
      <header class="dialog-head"><h2>Nova proposta de redação</h2><button class="icon-button" value="cancel" aria-label="Fechar"><span class="material-symbols-outlined">close</span></button></header>
      <div class="dialog-body"><div class="form-grid">
        <label class="wide">Título<input name="title" required minlength="3" maxlength="160" placeholder="Tema da proposta"></label>
        <label>Categoria<input name="category" required placeholder="Ex.: dissertativo-argumentativo"></label>
        <label>Turma<select name="classId"><option value="">Todas as turmas vinculadas</option>${data.classes.map((item) => `<option value="${item.id}">${escapeHtml(item.nome)}</option>`).join("")}</select></label>
        <label class="wide">Comando<textarea name="command" required minlength="10" rows="4" placeholder="Explique com clareza o texto que o aluno deverá produzir."></textarea></label>
        <label class="wide">Critérios de correção<textarea name="rubric" rows="3" placeholder="Competências, estrutura e critérios esperados."></textarea></label>
        <label>Prazo<input name="deadline" type="datetime-local"></label>
        <label class="checkbox-line"><input name="pinned" type="checkbox"> Fixar para os alunos</label>
      </div><div class="dialog-actions"><button class="button secondary" name="intent" value="draft">Salvar rascunho</button><button class="button primary" name="intent" value="publish">Publicar proposta</button></div></div>
    </form>
  </dialog>`;

  const panel = content.querySelector("[data-writing-panel]");
  const promptDialog = content.querySelector("[data-prompt-dialog]");
  const promptFields = content.querySelector("[data-prompt-form] .form-grid");
  promptFields?.insertAdjacentHTML("beforeend", window.OminiCurriculumPicker?.markup("prompt-curriculum-picker", data.classes) || "");
  const promptPicker = window.OminiCurriculumPicker?.bind(content, data.classes) || { selected: () => [] };
  const globalPromptButton = document.querySelector("[data-new-prompt-global]");
  if (globalPromptButton)
    globalPromptButton.onclick = () => promptDialog.showModal();
  const renderEmpty = (icon, title, message) =>
    `<div class="empty-state"><span class="material-symbols-outlined">${icon}</span><h2>${title}</h2><p>${message}</p></div>`;
  const getCompetencies = (essay) => {
    const source =
      draftByEssay.get(essay.id)?.competencias ||
      essay.avaliacoes_competencias_redacao ||
      [];
    return [1, 2, 3, 4, 5].map(
      (number) =>
        source.find((item) => Number(item.competencia) === number) || {
          competencia: number,
          nota: 0,
          comentario: "",
        },
    );
  };
  const scoreOptions = (selected) =>
    [0, 40, 80, 120, 160, 200]
      .map(
        (value) =>
          `<option value="${value}" ${Number(selected) === value ? "selected" : ""}>${value}</option>`,
      )
      .join("");

  const renderCorrection = () => {
    const selected = essays.find((essay) => essay.id === selectedId);
    panel.innerHTML = `<div class="writing-toolbar"><div class="search-field"><span class="material-symbols-outlined">search</span><input data-essay-search type="search" placeholder="Buscar aluno, turma ou proposta"></div><select data-essay-status><option value="todos">Todos os estados</option><option value="enviada">Aguardando correção</option><option value="corrigida">Corrigidas</option></select></div>
      <div class="correction-layout"><aside class="panel submission-list" data-submission-list>${essays.length ? essays.map((essay) => `<button class="submission-card ${essay.id === selectedId ? "active" : ""}" type="button" data-essay-id="${essay.id}" data-status="${essay.status}"><span class="student-initials">${initials(studentName(essay))}</span><span><strong>${escapeHtml(studentName(essay))}</strong><small>${escapeHtml(essay.propostas_redacao?.titulo || essay.titulo || "Redação sem proposta")} · ${escapeHtml(classLabel(essay))}</small></span><span class="status ${essay.status === "enviada" ? "rascunho" : ""}">${essay.status === "enviada" ? "Pendente" : "Corrigida"}</span></button>`).join("") : renderEmpty("rate_review", "Nenhuma redação recebida", "As redações enviadas pelas turmas vinculadas aparecerão aqui.")}</aside>
      <section class="panel" data-correction-area>${selected ? correctionMarkup(selected) : renderEmpty("description", "Selecione uma redação", "Quando houver entregas, escolha um texto para iniciar a devolutiva.")}</section></div>`;
    bindCorrection();
  };

  const correctionMarkup = (essay) => {
    const draft = draftByEssay.get(essay.id);
    const competencies = getCompetencies(essay);
    const feedback = draft?.feedback ?? essay.feedback ?? "";
    return `<header class="essay-head"><div><p class="eyebrow">Correção guiada</p><h2>${escapeHtml(studentName(essay))}</h2><p>${escapeHtml(classLabel(essay))} · enviada em ${dateTime(essay.enviada_em)}</p></div><span class="status ${essay.status === "enviada" ? "rascunho" : ""}">${essay.status === "enviada" ? "Aguardando" : "Devolvida"}</span></header>
      <div class="notice"><strong>${escapeHtml(essay.propostas_redacao?.titulo || essay.titulo || "Produção textual")}</strong>${essay.propostas_redacao?.prazo ? ` · prazo ${dateTime(essay.propostas_redacao.prazo)}` : ""}</div>
      <article class="essay-copy">${escapeHtml(essay.texto || essay.conteudo || "O texto enviado não possui conteúdo disponível.")}</article>
      <form class="correction-form" data-correction-form data-essay-id="${essay.id}"><div><p class="eyebrow">Competências</p><div class="competence-grid">${competencies.map((item) => `<div class="competence-card"><label>C${item.competencia}<span data-competence-value>${item.nota}</span></label><select name="competence-${item.competencia}" aria-label="Nota da competência ${item.competencia}">${scoreOptions(item.nota)}</select></div>`).join("")}</div></div>
      <label>Devolutiva ao aluno<textarea name="feedback" rows="5" maxlength="20000" placeholder="Explique avanços, pontos de atenção e um próximo passo concreto.">${escapeHtml(feedback)}</textarea></label>
      <div class="correction-total"><span>Nota calculada pelas 5 competências</span><strong><span data-total-score>${competencies.reduce((sum, item) => sum + Number(item.nota), 0)}</span>/1000</strong></div>
      <div class="correction-actions"><button class="button secondary" name="intent" value="draft">Salvar rascunho</button><button class="button primary" name="intent" value="return">${essay.status === "corrigida" ? "Atualizar devolutiva" : "Devolver ao aluno"}</button></div></form>`;
  };

  const bindCorrection = () => {
    const list = panel.querySelector("[data-submission-list]");
    list?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-essay-id]");
      if (!button) return;
      selectedId = button.dataset.essayId;
      renderCorrection();
    });
    const filter = () => {
      const term =
        panel
          .querySelector("[data-essay-search]")
          ?.value.trim()
          .toLowerCase() || "";
      const status =
        panel.querySelector("[data-essay-status]")?.value || "todos";
      panel.querySelectorAll("[data-essay-id]").forEach((item) => {
        item.hidden =
          Boolean(term && !item.textContent.toLowerCase().includes(term)) ||
          (status !== "todos" && item.dataset.status !== status);
      });
    };
    panel
      .querySelector("[data-essay-search]")
      ?.addEventListener("input", filter);
    panel
      .querySelector("[data-essay-status]")
      ?.addEventListener("change", filter);
    const form = panel.querySelector("[data-correction-form]");
    if (!form) return;
    const updateTotal = () => {
      let total = 0;
      form.querySelectorAll('[name^="competence-"]').forEach((select) => {
        total += Number(select.value);
        select
          .closest(".competence-card")
          .querySelector("[data-competence-value]").textContent = select.value;
      });
      form.querySelector("[data-total-score]").textContent = total;
    };
    form
      .querySelectorAll('[name^="competence-"]')
      .forEach((select) => select.addEventListener("change", updateTotal));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitter = event.submitter;
      submitter.disabled = true;
      const competencies = [1, 2, 3, 4, 5].map((number) => ({
        competencia: number,
        nota: Number(form.elements[`competence-${number}`].value),
        comentario: "",
      }));
      const feedback = form.elements.feedback.value.trim();
      const score = competencies.reduce((sum, item) => sum + item.nota, 0);
      try {
        if (submitter.value === "draft") {
          const saved = await api.saveEssayCorrectionDraft(
            form.dataset.essayId,
            { score, feedback, competencies },
          );
          draftByEssay.set(form.dataset.essayId, saved);
          toast("Rascunho de correção salvo no Supabase.");
        } else {
          if (!feedback)
            throw new Error(
              "Escreva uma devolutiva antes de devolver a redação.",
            );
          await api.correctEssay(form.dataset.essayId, {
            score,
            feedback,
            competencies,
          });
          toast("Redação corrigida e devolvida ao aluno.");
          await reload();
        }
      } catch (error) {
        toast(error.message, "error");
      } finally {
        submitter.disabled = false;
      }
    });
  };

  const renderPrompts = () => {
    panel.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">Banco da professora</p><h2>Propostas de redação</h2></div><button class="button primary" type="button" data-new-prompt><span class="material-symbols-outlined">add</span>Nova proposta</button></div><div class="prompt-grid">${prompts.length ? prompts.map((prompt) => `<article class="prompt-card"><p class="eyebrow">${escapeHtml(prompt.categoria || "Produção textual")}</p><h3>${escapeHtml(prompt.titulo)}</h3><p>${escapeHtml(prompt.comando || "Sem comando cadastrado.")}</p><div class="prompt-meta"><span class="tag">${prompt.publicada ? "Publicada" : "Rascunho"}</span>${prompt.fixada ? '<span class="tag">Fixada</span>' : ""}<span class="tag">${escapeHtml(prompt.turmas?.nome || "Todas as turmas")}</span><span class="tag">${prompt.prazo ? dateTime(prompt.prazo) : "Sem prazo"}</span></div></article>`).join("") : renderEmpty("library_add", "Nenhuma proposta criada", "Crie uma proposta e escolha quando publicá-la para as turmas.")}</div>`;
    panel
      .querySelector("[data-new-prompt]")
      ?.addEventListener("click", () => promptDialog.showModal());
  };

  const renderEvolution = () => {
    const allCompetencies = corrected.flatMap(
      (essay) => essay.avaliacoes_competencias_redacao || [],
    );
    panel.innerHTML = `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">Dados consolidados</p><h2>Evolução por competência</h2><p>Médias calculadas somente com redações corrigidas.</p></div></div>${
      allCompetencies.length
        ? `<div class="evolution-grid">${[1, 2, 3, 4, 5]
            .map((number) => {
              const values = allCompetencies
                .filter((item) => Number(item.competencia) === number)
                .map((item) => Number(item.nota));
              const average = values.length
                ? Math.round(
                    values.reduce((sum, value) => sum + value, 0) /
                      values.length,
                  )
                : null;
              return `<article class="evolution-card"><span>Competência ${number}</span><strong>${average ?? "—"}${average === null ? "" : "/200"}</strong><div class="progress-bar"><i style="width:${average === null ? 0 : average / 2}%"></i></div></article>`;
            })
            .join("")}</div>`
        : renderEmpty(
            "monitoring",
            "Ainda não há série histórica",
            "As médias serão exibidas após a primeira redação corrigida.",
          )
    }</section>`;
  };

  const renderView = () => {
    if (currentView === "entregas") renderCorrection();
    else if (currentView === "propostas") renderPrompts();
    else renderEvolution();
  };
  content.querySelectorAll("[data-writing-view]").forEach((button) =>
    button.addEventListener("click", () => {
      currentView = button.dataset.writingView;
      content
        .querySelectorAll("[data-writing-view]")
        .forEach((item) => item.classList.toggle("active", item === button));
      renderView();
    }),
  );
  content
    .querySelector("[data-prompt-form]")
    .addEventListener("submit", async (event) => {
      const submitter = event.submitter;
      if (!submitter || submitter.value === "cancel") return;
      event.preventDefault();
      submitter.disabled = true;
      const values = new FormData(event.currentTarget);
      try {
        await api.createWritingPrompt({
          title: values.get("title").trim(),
          category: values.get("category").trim(),
          command: values.get("command").trim(),
          rubric: values.get("rubric").trim(),
          deadline: values.get("deadline") || null,
          classId: values.get("classId") || null,
          published: submitter.value === "publish",
          pinned: values.get("pinned") === "on",
          skillIds: promptPicker.selected(),
        });
        toast(
          submitter.value === "publish"
            ? "Proposta publicada para os alunos."
            : "Proposta salva como rascunho.",
        );
        promptDialog.close();
        await reload();
      } catch (error) {
        toast(error.message, "error");
      } finally {
        submitter.disabled = false;
      }
    });
  renderView();
};
