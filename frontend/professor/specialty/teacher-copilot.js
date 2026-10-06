(() => {
  "use strict";

  const TYPES = [
    ["unica_escolha", "Escolha única"],
    ["verdadeiro_falso", "Verdadeiro ou falso"],
    ["resposta_curta", "Resposta curta"],
    ["dissertativa", "Dissertativa"],
    ["numerica", "Resposta numérica"],
    ["calculo", "Cálculo"],
    ["codigo", "Código"],
    ["estudo_caso", "Estudo de caso"],
  ];
  const MODES = [
    ["gerar_atividade", "Atividade", "assignment"],
    ["gerar_prova", "Prova", "fact_check"],
    ["gerar_diagnostico", "Diagnóstica", "troubleshoot"],
    ["gerar_trilha", "Trilha", "route"],
    ["gerar_ideias", "Ideias", "lightbulb"],
    ["revisar_atividade", "Revisar", "rate_review"],
  ];
  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>\"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const richText = (value) =>
    window.OminiResources?.richText(value) || escapeHtml(value);
  const questionResources = (question) =>
    window.OminiResources?.renderResources(question.configuration?.resources) || "";
  const icon = (name) =>
    `<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;
  const label = (type) => TYPES.find(([value]) => value === type)?.[1] || type;
  const activitiesOf = (suggestion) =>
    suggestion?.trail?.steps?.length
      ? suggestion.trail.steps.map((step) => step?.activity)
      : suggestion?.activity
        ? [suggestion.activity]
        : [];
  const contextKeyOf = (classId, trimester, category) =>
    `${classId || ""}|${trimester || ""}|${category || ""}`;
  const creationAction = (mode) =>
    ["gerar_prova", "gerar_diagnostico"].includes(mode)
      ? "gerar_atividade"
      : mode;
  const accessPreferences = ({
    fullAccess = true,
    types = [],
    useClassContext = false,
    allFormatsEnabled = false,
  } = {}) => ({
    fullAccess: !!fullAccess,
    questionTypes: fullAccess ? TYPES.map(([type]) => type) : [...types],
    allFormatsEnabled: !!fullAccess || !!allFormatsEnabled,
    useClassContext: !!fullAccess || !!useClassContext,
    classContextMode: fullAccess ? "auto" : useClassContext ? "always" : "off",
  });
  const boundedMessages = (messages) =>
    messages
      .filter((message) => ["user", "assistant"].includes(message.role))
      .slice(-8)
      .map(({ role, content }) => ({
        role,
        content: String(content).slice(0, 2000),
      }));
  const comparable = (value) =>
    String(value ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("pt-BR");
  const numberAnswer = (value) => {
    const text = String(value ?? "").trim();
    return /^[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[-+]?\d+)?$/i.test(text) &&
      Number.isFinite(Number(text.replace(",", ".")))
      ? Number(text.replace(",", "."))
      : null;
  };
  const pointsOf = (activity, index) => {
    if (activity.scoringMode === "manual")
      return Number(activity.questions[index].points);
    const cents = Math.round(Number(activity.value) * 100);
    const count = activity.questions.length;
    return (Math.floor(cents / count) + Number(index < cents % count)) / 100;
  };
  const suggestionIssue = (suggestion) => {
    if (!suggestion || typeof suggestion !== "object")
      return "A proposta recebida está incompleta. Peça uma nova versão.";
    if (suggestion.ideas) {
      if (
        !Array.isArray(suggestion.ideas) ||
        suggestion.ideas.length < 3 ||
        suggestion.ideas.length > 6 ||
        suggestion.ideas.some(
          (idea) =>
            !idea ||
            [
              "title",
              "objective",
              "hook",
              "studentAction",
              "evidence",
              "interaction",
              "teacherPrompt",
            ].some((name) => !String(idea[name] || "").trim()) ||
            !Number.isInteger(Number(idea.duration)) ||
            Number(idea.duration) < 5 ||
            Number(idea.duration) > 300 ||
            !Array.isArray(idea.adaptations) ||
            !idea.adaptations.length ||
            !Array.isArray(idea.materials),
        )
      )
        return "A IA precisa retornar de três a seis ideias completas, com objetivo, ação do aluno e evidência de aprendizagem.";
      return "";
    }
    if (
      suggestion.trail &&
      (!Array.isArray(suggestion.trail.steps) ||
        suggestion.trail.steps.length < 2 ||
        suggestion.trail.steps.length > 12 ||
        suggestion.trail.steps.some(
          (step) =>
            !step?.activity ||
            !String(step.title || "").trim() ||
            !String(step.objective || "").trim(),
        ))
    )
      return "A trilha precisa conter todas as etapas com atividades completas. Peça uma nova versão.";
    if (
      suggestion.trail &&
      (String(suggestion.trail.title || "").trim().length < 3 ||
        String(suggestion.trail.title).length > 140 ||
        String(suggestion.trail.description || "").trim().length < 3)
    )
      return "Confira o título e as orientações do percurso completo.";
    const activities = activitiesOf(suggestion);
    if (!activities.length)
      return "A IA não retornou uma atividade utilizável. Ajuste o pedido e tente novamente.";
    for (const activity of activities) {
      if (
        !activity ||
        String(activity.title || "").trim().length < 3 ||
        String(activity.title).length > 140 ||
        String(activity.instructions || "").trim().length < 3
      )
        return "Confira o título e as orientações de cada atividade.";
      if (
        !Number.isInteger(Number(activity.duration)) ||
        Number(activity.duration) < 5 ||
        Number(activity.duration) > 300 ||
        !Number.isFinite(Number(activity.value)) ||
        Number(activity.value) < 0.1 ||
        Number(activity.value) > 1000
      )
        return "Confira a duração (5 a 300 minutos) e o valor total de cada atividade.";
      if (
        Math.abs(
          Number(activity.value) * 100 -
            Math.round(Number(activity.value) * 100),
        ) > 0.000001
      )
        return "Use no máximo duas casas decimais no valor da atividade.";
      if (
        !Array.isArray(activity.questions) ||
        !activity.questions.length ||
        activity.questions.length > 100
      )
        return "Cada atividade precisa conter de 1 a 100 questões completas.";
      for (let index = 0; index < activity.questions.length; index++) {
        const question = activity.questions[index];
        const prefix = `Questão ${index + 1}: `;
        if (
          !question ||
          !TYPES.some(([type]) => type === question.type) ||
          String(question.statement || "").trim().length < 3
        )
          return prefix + "confira o formato e o enunciado.";
        if (
          !Number.isFinite(Number(question.points)) ||
          Number(question.points) < 0.01 ||
          Number(question.points) > 1000
        )
          return prefix + "use uma pontuação entre 0,01 e 1000.";
        if (
          activity.scoringMode === "manual" &&
          Math.abs(
            Number(question.points) * 100 -
              Math.round(Number(question.points) * 100),
          ) > 0.000001
        )
          return prefix + "use no máximo duas casas decimais na pontuação.";
        if (!String(question.answer ?? "").trim())
          return (
            prefix + "defina a resposta esperada ou os critérios de revisão."
          );
        if (["unica_escolha", "verdadeiro_falso"].includes(question.type)) {
          const options = question.alternatives;
          if (
            !Array.isArray(options) ||
            options.length < 2 ||
            options.length > 8 ||
            options.some((option) => !String(option).trim()) ||
            new Set(options.map(comparable)).size !== options.length ||
            !options.includes(question.answer)
          )
            return (
              prefix +
              "as alternativas devem ser diferentes, preenchidas e conter exatamente o gabarito indicado."
            );
          if (
            question.type === "verdadeiro_falso" &&
            (options.length !== 2 ||
              !["verdadeiro", "falso"].every((option) =>
                options.map(comparable).includes(option),
              ))
          )
            return prefix + "use as alternativas Verdadeiro e Falso.";
        }
        if (
          ["numerica", "calculo"].includes(question.type) &&
          numberAnswer(question.answer) === null
        )
          return prefix + "informe um gabarito numérico finito, sem unidades.";
      }
      if (
        activity.scoringMode === "manual" &&
        activity.questions.reduce(
          (sum, question) => sum + Math.round(Number(question.points) * 100),
          0,
        ) !== Math.round(Number(activity.value) * 100)
      )
        return "A soma dos pontos das questões precisa corresponder ao valor total da etapa.";
      if (
        activity.scoringMode !== "manual" &&
        Math.round(Number(activity.value) * 100) < activity.questions.length
      )
        return "Aumente o valor da etapa para distribuir pelo menos 0,01 ponto por questão.";
    }
    if (
      activities.reduce((sum, activity) => sum + activity.questions.length, 0) >
        100 ||
      activities.reduce((sum, activity) => sum + Number(activity.duration), 0) >
        300 ||
      activities.reduce((sum, activity) => sum + Number(activity.value), 0) >
        1000
    )
      return "O percurso completo deve ter até 100 questões, 300 minutos e 1000 pontos. Ajuste as etapas antes de aplicar.";
    return "";
  };
  const validateSuggestion = (suggestion) => !suggestionIssue(suggestion);
  const preserveReviewedTrail = (suggestion, previous, stageIndex) => {
    if (!previous?.trail || !suggestion?.activity || suggestion.trail)
      return suggestion;
    const revised = clone(previous);
    const step = revised.trail.steps[stageIndex];
    if (!step) return suggestion;
    step.activity = clone(suggestion.activity);
    step.title = step.activity.title;
    revised.activity = revised.trail.steps[0].activity;
    revised.summary = suggestion.summary;
    revised.warnings = [
      ...new Set([
        ...(previous.warnings || []),
        ...(suggestion.warnings || []),
        `Somente a etapa ${stageIndex + 1} foi revisada. As demais etapas foram preservadas nesta proposta.`,
      ]),
    ];
    return revised;
  };
  const previewEvaluation = (question, value) => {
    if (!String(value ?? "").trim())
      return {
        kind: "empty",
        feedback: "Registre uma resposta para experimentar esta questão.",
      };
    let correct = null;
    if (["unica_escolha", "verdadeiro_falso"].includes(question.type))
      correct = comparable(value) === comparable(question.answer);
    else if (
      question.type === "numerica" ||
      (question.type === "calculo" && numberAnswer(question.answer) !== null)
    ) {
      const actual = numberAnswer(value),
        expected = numberAnswer(question.answer);
      const rawTolerance =
        question.configuration?.tolerance ??
        question.answerConfiguration?.tolerance ??
        0;
      const tolerance = Number.isFinite(Number(rawTolerance))
        ? Math.max(0, Number(rawTolerance))
        : 0;
      correct =
        actual !== null &&
        expected !== null &&
        Math.abs(actual - expected) <= tolerance;
    } else if (question.type === "resposta_curta") {
      const accepted =
        question.configuration?.acceptedAnswers ??
        question.answerConfiguration?.acceptedAnswers ??
        [];
      correct = [
        question.answer,
        ...(Array.isArray(accepted) ? accepted : []),
      ].some((answer) => comparable(answer) === comparable(value));
    }
    return correct === null
      ? {
          kind: "manual",
          feedback:
            "Resposta registrada nesta prévia. No envio real, o professor revisará o raciocínio e os critérios da atividade.",
        }
      : {
          kind: correct ? "correct" : "incorrect",
          feedback: `${correct ? "Resposta correta." : "Reveja sua resposta."}${question.explanation ? ` ${question.explanation}` : ""}`,
        };
  };
  // Small, side-effect-free contracts also used by the integration fixture.
  window.OminiTeacherCopilotContracts = Object.freeze({
    activitiesOf,
    contextKeyOf,
    creationAction,
    accessPreferences,
    boundedMessages,
    validateSuggestion,
    suggestionIssue,
    previewEvaluation,
    pointsOf,
    preserveReviewedTrail,
  });

  window.initTeacherCopilot = async ({
    root,
    state,
    field,
    activeClass,
    config,
    api,
    toast,
    renderQuestions,
    refreshSelected,
    go,
    applyCopilotSuggestion,
    getCopilotDraft,
    renderQuestionEditor,
    onActivityApplied,
  }) => {
    const mount = root.querySelector("[data-copilot-mount]");
    if (
      !mount ||
      !api?.isFeatureEnabled ||
      !api?.requestTeacherCopilot ||
      mount.querySelector("[data-copilot-open]")
    )
      return;
    try {
      if (
        window.localStorage.getItem("ominisaber:teacher-copilot-hidden") ===
        "true"
      )
        return;
    } catch (_ignored) {
      /* Storage may be unavailable. */
    }
    try {
      if (!(await api.isFeatureEnabled("professor_copiloto"))) return;
    } catch (_ignored) {
      return;
    }

    mount.innerHTML = `<button class="button secondary copilot-launch" type="button" data-copilot-open>${icon("auto_awesome")}<span>Criar com o copiloto</span></button>`;
    const workspace = document.createElement("section");
    workspace.className = "copilot-workspace";
    workspace.hidden = true;
    workspace.setAttribute("aria-label", "Espaço de criação com o copiloto");
    workspace.innerHTML = `
      <div class="copilot-breadcrumb"><span class="copilot-workspace-brand">${icon(config.icon || "menu_book")}<strong>OminiSaber</strong></span><span class="copilot-breadcrumb-path">Criação de atividade</span>${icon("chevron_right")}<strong>Copiloto</strong><button type="button" data-copilot-close>${icon("arrow_back")}Voltar ao rascunho</button></div>
      <header class="copilot-workspace-header"><div><h2 tabindex="-1" data-copilot-heading>O que vamos preparar?</h2><p>Atividades, provas, diagnósticas, trilhas e ideias para sua aula.</p></div><div class="copilot-context-strip" data-copilot-context></div></header>
      <div class="copilot-workspace-tools"><p data-copilot-layout-note>Converse e acompanhe sua proposta ao lado.</p><button type="button" data-copilot-preview-toggle aria-controls="copilot-proposal-panel" aria-expanded="true">${icon("right_panel_close")}<span>Ocultar prévia</span></button></div>
      <div class="copilot-workspace-grid">
        <section class="copilot-conversation" aria-labelledby="copilot-conversation-title">
          <header class="copilot-panel-heading"><span class="copilot-heading-icon">${icon("auto_awesome")}</span><div><h3 id="copilot-conversation-title">Converse com o copiloto</h3><p>Conte o objetivo. Eu preparo os formatos e recursos adequados.</p></div></header>
          <nav class="copilot-modes" aria-label="Tipo de ajuda">${MODES.map(([value, text, symbol], index) => `<button type="button" data-copilot-mode="${value}" aria-pressed="${index === 0}">${icon(symbol)}${text}</button>`).join("")}</nav>
          <div class="copilot-messages" data-copilot-messages role="log" aria-label="Conversa com o copiloto" aria-live="polite" aria-relevant="additions"></div>
          <div class="copilot-error" data-copilot-error role="alert" hidden><div>${icon("error_outline")}<p data-copilot-error-text></p></div><button type="button" data-copilot-retry>Tentar novamente</button></div>
          <div class="copilot-refinement-chips" data-copilot-chips aria-label="Sugestões de pedido"></div>
          <form class="copilot-composer" data-copilot-form>
            <label class="copilot-visually-hidden" for="copilot-message">Seu pedido ao copiloto</label><textarea id="copilot-message" name="objective" rows="3" maxlength="2000" placeholder="Descreva o que deseja que seus alunos aprendam..." required></textarea>
            <div class="copilot-composer-bar"><small>Não inclua dados pessoais de alunos.</small><button type="submit" data-copilot-send aria-label="Enviar pedido ao copiloto">${icon("arrow_upward")}</button></div>
          </form>
          <div class="copilot-access"><label class="copilot-check"><input type="checkbox" data-copilot-full-access checked><span><strong>Acesso Total</strong><small>O copiloto escolhe os formatos e recursos. Considera o panorama da turma quando seu pedido precisar, usando somente indicadores gerais.</small></span></label></div>
          <label class="copilot-check copilot-exam-option" data-copilot-exam-option hidden><input type="checkbox" data-copilot-secure-exam checked><span><strong>Modo seguro de prova</strong><small>Oculta dicas e correções durante a prova. Solicita tela cheia e registra saídas para revisão do professor.</small></span></label>
          <details class="copilot-options"><summary>${icon("tune")}Personalizar (opcional)</summary><p class="copilot-options-note" data-copilot-options-note>Desmarque Acesso Total para escolher a quantidade, o nível e os formatos.</p><fieldset class="copilot-manual-options" data-copilot-manual-options disabled><div class="copilot-option-fields"><label>Total de questões<input type="number" data-copilot-count min="1" max="12" value="5"></label><label>Nível<select data-copilot-difficulty><option value="equilibrada">Médio · prática acessível</option><option value="introducao">Fácil · primeiros passos</option><option value="aprofundamento">Desafio · aprofundamento</option></select></label></div><p class="copilot-count-note" data-copilot-count-note>Quantidade da atividade. Na trilha, será distribuída entre as etapas.</p><fieldset><legend>Formatos de resposta</legend><div class="copilot-type-options">${TYPES.map(([value, text]) => `<label><input type="checkbox" data-copilot-type="${value}" checked>${text}</label>`).join("")}</div><label class="copilot-check"><input type="checkbox" data-copilot-enable-all checked>Selecionar todos</label></fieldset><label class="copilot-check copilot-consent"><input type="checkbox" data-copilot-consent><span>Considerar sempre o panorama da turma<small>Somente indicadores gerais e temas recentes. Nenhum aluno é identificado.</small></span></label></fieldset><label class="copilot-check"><input type="checkbox" data-copilot-all-classes><span>Preparar para todas as minhas turmas<small>A seleção será levada ao rascunho para sua revisão.</small></span></label></details>
          <p class="copilot-memory-note" data-copilot-memory-note role="status" hidden></p>
        </section>
        <section id="copilot-proposal-panel" class="copilot-proposal" aria-label="Proposta e prévia do aluno">
          <header class="copilot-proposal-toolbar"><div class="copilot-view-tabs" role="tablist" aria-label="Visualização da proposta"><button id="copilot-draft-tab" type="button" role="tab" aria-controls="copilot-proposal-content" aria-selected="true" data-copilot-view="draft">${icon("edit_note")}Rascunho</button><button id="copilot-student-tab" type="button" role="tab" aria-controls="copilot-proposal-content" aria-selected="false" data-copilot-view="student">${icon("visibility")}Visão do aluno</button></div><button class="copilot-hide-preview" type="button" data-copilot-preview-hide aria-label="Ocultar a prévia e ampliar a conversa">${icon("close")}</button></header>
          <div class="copilot-draft-bar" data-copilot-draft-bar hidden><label>Proposta<select data-copilot-drafts aria-label="Escolher uma proposta da conversa"></select></label><span data-copilot-draft-state>Pronta para revisar</span></div>
          <p class="copilot-validation" data-copilot-validation role="status" hidden></p><div id="copilot-proposal-content" class="copilot-proposal-content" data-copilot-result role="tabpanel" aria-labelledby="copilot-draft-tab"></div>
          <footer class="copilot-proposal-footer"><div class="copilot-proposal-safety">${icon("verified_user")}<span>Revise antes de aplicar.</span></div><div class="copilot-feedback" data-copilot-feedback hidden><span>Foi útil?</span><button type="button" data-feedback="true" aria-label="A sugestão foi útil">${icon("thumb_up")}</button><button type="button" data-feedback="false" aria-label="A sugestão precisa melhorar">${icon("thumb_down")}</button></div><div class="copilot-apply-actions"><button class="button secondary" type="button" data-copilot-edit disabled>${icon("edit")}Editar proposta</button><button class="button secondary" type="button" data-copilot-append hidden>${icon("playlist_add")}Adicionar questões</button><button class="button primary" type="button" data-copilot-apply disabled>${icon("check")}Aplicar ao rascunho</button></div></footer>
        </section>
      </div><p class="copilot-workspace-status" data-copilot-status role="status" aria-live="polite"></p>`;
    root.append(workspace);

    const find = (selector) => workspace.querySelector(selector);
    const form = find("[data-copilot-form]");
    const composer = form.elements.objective;
    const output = find("[data-copilot-result]");
    const messagesNode = find("[data-copilot-messages]");
    const errorBox = find("[data-copilot-error]");
    const status = find("[data-copilot-status]");
    const launch = mount.querySelector("[data-copilot-open]");
    const messages = [];
    const drafts = [];
    const previewResponses = new Map();
    let activeDraftId = null;
    let mode = "gerar_atividade";
    let view = "draft";
    let stage = 0;
    let busy = false;
    let generationId = 0;
    let sessionId = null;
    let conversationMemory = null;
    let previewHidden = false;
    let lastAttempt = null;
    let previousStep = 1;
    let applying = false;
    const currentDraft = () =>
      drafts.find((draft) => draft.id === activeDraftId);
    try {
      previewHidden = window.localStorage.getItem(
        "ominisaber:copilot-preview-hidden",
      ) === "true";
    } catch (_ignored) {
      /* The conversation remains usable when storage is unavailable. */
    }
    const syncPreviewLayout = ({ focus = false } = {}) => {
      find(".copilot-proposal").hidden = previewHidden;
      workspace.classList.toggle("copilot-chat-only", previewHidden);
      const toggle = find("[data-copilot-preview-toggle]");
      toggle.setAttribute("aria-expanded", String(!previewHidden));
      toggle.innerHTML = `${icon(previewHidden ? "right_panel_open" : "right_panel_close")}<span>${previewHidden ? "Mostrar prévia" : "Ocultar prévia"}</span>`;
      find("[data-copilot-layout-note]").textContent = previewHidden
        ? "Sua conversa ocupa toda a tela. Abra a prévia quando quiser revisar."
        : "Converse e acompanhe sua proposta ao lado.";
      if (focus) {
        if (previewHidden) composer.focus();
        else {
          find(`[data-copilot-view="${view}"]`).focus();
          find(".copilot-proposal").scrollIntoView({ block: "nearest" });
        }
      }
    };
    const setPreviewHidden = (hidden) => {
      previewHidden = hidden;
      try {
        window.localStorage.setItem(
          "ominisaber:copilot-preview-hidden",
          String(previewHidden),
        );
      } catch (_ignored) {
        /* This preference does not depend on storage. */
      }
      syncPreviewLayout({ focus: true });
    };
    const syncAccessControls = () => {
      const fullAccess = find("[data-copilot-full-access]").checked;
      find("[data-copilot-manual-options]").disabled = fullAccess;
      find("[data-copilot-options-note]").textContent = fullAccess
        ? "Desmarque Acesso Total para escolher a quantidade, o nível e os formatos. Você também pode pedir isso diretamente na conversa."
        : "Escolha suas preferências. O copiloto vai respeitar os formatos selecionados.";
    };
    const contextKey = () =>
      contextKeyOf(
        activeClass()?.id,
        field("trimester")?.value,
        field("category")?.value,
      );
    const selectedSkills = () =>
      (state.skills || []).filter((skill) =>
        state.selectedSkills?.has(skill.habilidade_id),
      );
    const totalQuestions = (suggestion) =>
      activitiesOf(suggestion).reduce(
        (sum, activity) => sum + activity.questions.length,
        0,
      );
    const currentActivity = () =>
      getCopilotDraft
        ? getCopilotDraft()
        : {
            title: field("title")?.value || "",
            instructions: field("instructions")?.value || "",
            category: field("category")?.value,
            duration: Number(field("duration")?.value) || 50,
            value: Number(field("value")?.value) || 10,
            scoringMode: field("scoringMode")?.value || "igual",
            questions: clone(state.questions || []),
          };

    const refreshContext = () => {
      const selected = activeClass();
      const objective =
        selectedSkills()
          .map((skill) => skill.descricao)
          .join(" · ") ||
        field("title")?.value ||
        "Seu objetivo de aprendizagem";
      find("[data-copilot-context]").innerHTML =
        `<div>${icon("menu_book")}<span><small>Componente</small><strong>${escapeHtml(config.short || config.label || config.type)}</strong></span></div><div>${icon("groups")}<span><small>Turma</small><strong>${escapeHtml(selected?.nome || "A definir")}</strong></span></div><div class="copilot-context-objective">${icon("my_location")}<span><small>Objetivo</small><strong title="${escapeHtml(objective)}">${escapeHtml(objective)}</strong></span><button type="button" data-copilot-context-edit aria-label="Editar contexto da atividade">${icon("edit")}</button></div>`;
    };
    const renderMessages = () => {
      messagesNode.innerHTML = `<article class="copilot-chat-message assistant"><span class="copilot-chat-avatar">${icon("auto_awesome")}</span><div><header><strong>Copiloto</strong></header><p>Posso preparar atividades, provas, diagnósticas, trilhas ou ideias para sua aula. Conte o tema, o que seus alunos já sabem e o objetivo. Depois, podemos ajustar a proposta juntos.</p></div></article>${messages.map((message) => `<article class="copilot-chat-message ${message.role}"><span class="copilot-chat-avatar">${icon(message.role === "user" ? "person" : "auto_awesome")}</span><div><header><strong>${message.role === "user" ? "Você" : "Copiloto"}</strong><time>${new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></header><p>${escapeHtml(message.content)}</p>${message.role === "assistant" && message.draftId ? `<button class="copilot-message-proposal" type="button" data-copilot-open-proposal="${escapeHtml(message.draftId)}">${icon("description")}Ver proposta</button>` : ""}</div></article>`).join("")}${busy ? `<article class="copilot-chat-message assistant copilot-pending"><span class="copilot-chat-avatar">${icon("auto_awesome")}</span><div><p>${icon("progress_activity")}Preparando sua proposta...</p></div></article>` : ""}`;
      messagesNode.scrollTop = messagesNode.scrollHeight;
      find("[data-copilot-chips]").innerHTML = (
        currentDraft()
          ? ["Mais prática", "Mais acessível", "Incluir debate"]
          : [
              "Prática guiada",
              "Investigar um tema",
              "Diagnosticar conhecimentos",
            ]
      )
        .map(
          (text) =>
            `<button type="button" data-copilot-prompt="${text}" ${busy ? "disabled" : ""}>${text}</button>`,
        )
        .join("");
    };
    const addMessage = (role, content, draftId = null) => {
      messages.push({
        role,
        content,
        createdAt: Date.now(),
        contextKey: contextKey(),
        draftId,
      });
      renderMessages();
    };
    const showError = (message, retry = false) => {
      if (
        /invalid argument|INVALID_ARGUMENT|response_format|unsupported schema|API_KEY_INVALID|PERMISSION_DENIED/i.test(
          message,
        )
      ) {
        message =
          "O serviço de IA recusou este pedido. A integração do Copiloto precisa ser atualizada no servidor. Seu pedido continua preservado.";
        retry = false;
      }
      find("[data-copilot-error-text]").textContent = message;
      find("[data-copilot-retry]").hidden = !retry;
      errorBox.hidden = false;
      status.textContent =
        "O pedido não foi concluído. Sua proposta continua preservada.";
    };
    const syncControls = () => {
      const draft = currentDraft();
      const issue = draft ? suggestionIssue(draft.payload.suggestion) : "";
      const usable =
        draft &&
        !issue &&
        !draft.payload.suggestion.ideas?.length &&
        activitiesOf(draft.payload.suggestion).length &&
        draft.contextKey === contextKey();
      find("[data-copilot-validation]").hidden = !issue;
      find("[data-copilot-validation]").textContent = issue;
      find("[data-copilot-send]").disabled = busy || applying;
      find("[data-copilot-send]").setAttribute(
        "aria-label",
        busy ? "Preparando proposta" : "Enviar pedido ao copiloto",
      );
      find("[data-copilot-apply]").disabled = busy || applying || !usable;
      find("[data-copilot-append]").hidden =
        !usable || !state.questions?.length;
      find("[data-copilot-append]").disabled = busy || applying;
      find("[data-copilot-edit]").disabled = !usable || applying;
      find("[data-copilot-feedback]").hidden =
        !draft?.payload.executionId || !api.sendTeacherCopilotFeedback;
      workspace.querySelectorAll("[data-feedback]").forEach((button) => {
        button.disabled = !!draft?.feedbackSent;
      });
      workspace.querySelectorAll("[data-copilot-mode]").forEach((button) => {
        button.disabled = busy;
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.copilotMode === mode),
        );
      });
      workspace.querySelectorAll("[data-copilot-idea]").forEach((button) => {
        button.disabled = busy || applying || !!issue;
      });
      find("[data-copilot-exam-option]").hidden =
        field("category")?.value !== "avaliacao";
      find("[data-copilot-count]").min = mode === "gerar_trilha" ? "2" : "1";
      find("[data-copilot-count-note]").textContent =
        mode === "gerar_trilha"
          ? "Total distribuído entre todas as etapas da trilha (mínimo 2)."
          : "Quantidade da atividade. Na trilha, será distribuída entre as etapas.";
      composer.placeholder =
        mode === "revisar_atividade"
          ? currentDraft()?.payload.suggestion.trail
            ? `O que devemos melhorar na etapa ${stage + 1}? As outras serão preservadas.`
            : "O que devemos melhorar no rascunho?"
          : mode === "gerar_ideias"
            ? "Sobre qual objetivo você quer explorar ideias?"
            : mode === "gerar_trilha"
              ? "Descreva o objetivo e a progressão da trilha..."
              : currentDraft()
                ? "Peça um ajuste na proposta..."
                : "Descreva o que deseja que seus alunos aprendam...";
      output.setAttribute("aria-busy", String(busy));
      find("[data-copilot-draft-state]").textContent =
        draft?.contextKey !== contextKey()
          ? "Contexto alterado: gere uma nova proposta"
          : draft?.applied
            ? "Aplicada ao seu rascunho"
            : draft?.edited
              ? "Editada por você"
              : "Pronta para revisar";
    };
    const syncDraftMenu = () => {
      find("[data-copilot-draft-bar]").hidden = !drafts.length;
      find("[data-copilot-drafts]").innerHTML = drafts
        .map(
          (draft, index) =>
            `<option value="${draft.id}" ${draft.id === activeDraftId ? "selected" : ""}>${index + 1}. ${escapeHtml(draft.title)}</option>`,
        )
        .join("");
      syncControls();
    };

    const renderEmpty = () => {
      output.innerHTML = `<div class="copilot-empty"><span class="copilot-empty-icon">${icon(busy ? "auto_awesome" : "edit_document")}</span><h3>${busy ? "Construindo sua proposta" : "Sua próxima atividade começa aqui"}</h3><p>${busy ? "Conferindo os objetivos, as questões e o feedback. Você poderá editar cada detalhe." : "Descreva seu objetivo na conversa. A proposta aparecerá aqui, pronta para você editar e experimentar como aluno."}</p><div><span>${icon("chat_bubble_outline")}Converse</span>${icon("chevron_right")}<span>${icon("edit_note")}Revise</span>${icon("chevron_right")}<span>${icon("check_circle")}Aplique</span></div>${!activeClass() ? `<button class="button secondary" type="button" data-copilot-context-edit>Definir turma e contexto</button>` : ""}</div>`;
    };
    const renderIdeas = (suggestion) => {
      output.innerHTML = `<div class="copilot-ideas"><p class="copilot-eyebrow">Ideias para sua aula</p><h3>Escolha um ponto de partida</h3><p>${escapeHtml(suggestion.summary || "Explore as propostas e transforme uma delas em atividade.")}</p>${suggestion.ideas.map((idea, index) => `<article><div class="copilot-idea-number">${index + 1}</div><div><h4>${escapeHtml(idea.title)}</h4><p>${escapeHtml(idea.objective)}</p>${idea.hook ? `<blockquote>${escapeHtml(idea.hook)}</blockquote>` : ""}<dl><div><dt>O aluno faz</dt><dd>${escapeHtml(idea.studentAction || idea.interaction || "")}</dd></div><div><dt>Evidência de aprendizagem</dt><dd>${escapeHtml(idea.evidence || "")}</dd></div>${Array.isArray(idea.adaptations) && idea.adaptations.length ? `<div><dt>Adaptações e desafios</dt><dd><ul>${idea.adaptations.map((adaptation) => `<li>${escapeHtml(adaptation)}</li>`).join("")}</ul></dd></div>` : ""}</dl><div class="copilot-idea-meta"><span>${icon("schedule")}${Number(idea.duration || idea.estimatedMinutes) || 30} min</span>${idea.materials?.length ? `<span>${escapeHtml(Array.isArray(idea.materials) ? idea.materials.join(" · ") : idea.materials)}</span>` : ""}</div><button class="button secondary" type="button" data-copilot-idea="${index}" ${busy ? "disabled" : ""}>${icon("auto_awesome")}Criar atividade com esta ideia</button></div></article>`).join("")}</div>`;
    };
    const questionEditor = (question, index, activity) => {
      const points = pointsOf(activity, index);
      return `<article class="copilot-question-editor"><header><span class="copilot-question-number">${index + 1}</span><span>${escapeHtml(label(question.type))}</span><small>${(Number.isFinite(points) ? points : 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} pontos</small><button type="button" data-copilot-remove="${index}" aria-label="Remover questão ${index + 1}" ${activity.questions.length < 2 ? "disabled" : ""}>${icon("delete")}</button></header>${questionResources(question)}<label>Enunciado<textarea rows="3" maxlength="6000" data-question-index="${index}" data-question-field="statement">${escapeHtml(question.statement)}</textarea></label>${question.alternatives?.length ? `<div class="copilot-alternative-editor">${question.alternatives.map((alternative, alternativeIndex) => `<label><span>${String.fromCharCode(65 + alternativeIndex)}</span><input maxlength="1000" aria-label="Alternativa ${alternativeIndex + 1} da questão ${index + 1}" data-question-index="${index}" data-alternative-index="${alternativeIndex}" value="${escapeHtml(alternative)}"></label>`).join("")}</div>` : ""}<details class="copilot-answer-details"><summary>${icon("fact_check")}Gabarito e feedback do professor</summary><label>Resposta esperada<textarea rows="2" maxlength="4000" data-question-index="${index}" data-question-field="answer">${escapeHtml(typeof question.answer === "object" ? JSON.stringify(question.answer) : question.answer)}</textarea></label><label>Feedback pedagógico<textarea rows="3" maxlength="4000" data-question-index="${index}" data-question-field="explanation">${escapeHtml(question.explanation)}</textarea></label>${activity.scoringMode === "manual" ? `<label>Pontos<input type="number" min="0.01" step="0.01" data-question-index="${index}" data-question-field="points" value="${escapeHtml(question.points)}"></label>` : ""}</details></article>`;
    };
    const renderDraft = (suggestion, activity) => {
      output.innerHTML = `<div class="copilot-draft-paper"><div class="copilot-paper-kicker"><span>${suggestion.trail ? `Etapa ${stage + 1} de ${activitiesOf(suggestion).length}` : "Proposta de atividade"}</span><span>${icon("edit")}Editável</span></div><label class="copilot-edit-title"><span class="copilot-visually-hidden">Título da atividade</span><textarea rows="2" maxlength="140" data-activity-field="title">${escapeHtml(activity.title)}</textarea></label>${suggestion.summary ? `<p class="copilot-draft-summary">${escapeHtml(suggestion.summary)}</p>` : ""}<label class="copilot-instructions-label">Orientações para o aluno<textarea rows="3" maxlength="6000" data-activity-field="instructions">${escapeHtml(activity.instructions)}</textarea></label><div class="copilot-draft-meta"><label>Duração (min)<input type="number" min="5" max="300" data-activity-field="duration" value="${escapeHtml(activity.duration)}"></label><label>Valor total<input type="number" min="0.1" max="1000" step="0.1" data-activity-field="value" value="${escapeHtml(activity.value)}"></label><span>${activity.questions.length} questões</span></div>${(suggestion.warnings || []).length ? `<div class="copilot-warnings">${icon("info")}<ul>${suggestion.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></div>` : ""}<div class="copilot-question-editors">${activity.questions.map((question, index) => questionEditor(question, index, activity)).join("")}</div></div>`;
      if (suggestion.trail && stage === 0)
        output
          .querySelector(".copilot-draft-paper")
          .insertAdjacentHTML(
            "afterbegin",
            `<div class="copilot-trail-title"><label>Título do percurso<input maxlength="140" data-trail-field="title" value="${escapeHtml(suggestion.trail.title)}"></label><label>Objetivo e orientações do percurso<textarea rows="2" maxlength="2000" data-trail-field="description">${escapeHtml(suggestion.trail.description)}</textarea></label></div>`,
          );
    };
    const responseKey = (index) => `${activeDraftId}:${stage}:${index}`;
    const studentQuestion = (question, index, activity) => {
      const key = responseKey(index);
      const response = previewResponses.get(key) || {};
      const points = pointsOf(activity, index);
      const alternatives =
        question.type === "verdadeiro_falso" && !question.alternatives?.length
          ? ["Verdadeiro", "Falso"]
          : question.alternatives || [];
      return `<article class="copilot-student-question"><header><span class="copilot-question-number">${index + 1}</span><h4>${richText(question.statement)}</h4></header>${questionResources(question)}${alternatives.length ? `<div class="copilot-student-choices">${alternatives.map((alternative, alternativeIndex) => `<label class="${response.value === alternative ? "is-selected" : ""}"><input type="radio" name="preview-${stage}-${index}" data-preview-question="${index}" value="${escapeHtml(alternative)}" ${response.value === alternative ? "checked" : ""}><span><small>${String.fromCharCode(65 + alternativeIndex)}</small>${richText(alternative)}</span></label>`).join("")}</div>` : `<label class="copilot-student-response">${question.type === "codigo" ? "Escreva seu código" : ["numerica", "calculo"].includes(question.type) ? "Sua resposta numérica (sem unidades)" : "Sua resposta"}<textarea rows="${question.type === "codigo" ? 6 : 3}" data-preview-question="${index}" placeholder="${question.type === "codigo" ? "Digite seu código aqui..." : "Registre sua resposta..."}">${escapeHtml(response.value || "")}</textarea></label>`}<footer><span>${icon("stars")}${(Number.isFinite(points) ? points : 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} pontos</span><button type="button" data-preview-check="${index}">Experimentar resposta</button></footer><p class="copilot-preview-response" data-preview-feedback="${index}" role="status" ${response.feedback ? "" : "hidden"}>${escapeHtml(response.feedback || "")}</p></article>`;
    };
    const renderStudent = (suggestion, activity) => {
      output.innerHTML = `<div class="copilot-student-paper"><div class="copilot-paper-kicker"><span>${suggestion.trail ? `Etapa ${stage + 1} de ${activitiesOf(suggestion).length}` : "Sua atividade"}</span><span>${icon("schedule")}${Number(activity.duration) || 50} min</span></div><h3>${escapeHtml(activity.title)}</h3><p class="copilot-student-intro">${currentDraft()?.secureExam ? "Prévia do modo seguro: respostas sem dicas ou correções durante a prova." : "Prévia interativa: experimente as respostas."} Nenhum envio será registrado.</p>${activity.instructions ? `<div class="copilot-student-instructions">${icon("menu_book")}<p>${richText(activity.instructions)}</p></div>` : ""}${activity.questions.map((question, index) => studentQuestion(question, index, activity)).join("")}</div>`;
    };
    const renderProposal = () => {
      const draft = currentDraft();
      workspace.querySelectorAll("[data-copilot-view]").forEach((button) => {
        button.setAttribute(
          "aria-selected",
          String(button.dataset.copilotView === view),
        );
        button.tabIndex = button.dataset.copilotView === view ? 0 : -1;
      });
      output.setAttribute(
        "aria-labelledby",
        view === "draft" ? "copilot-draft-tab" : "copilot-student-tab",
      );
      if (!draft) renderEmpty();
      else {
        const suggestion = draft.payload.suggestion;
        if (suggestion.ideas?.length) renderIdeas(suggestion);
        else {
          const activities = activitiesOf(suggestion);
          stage = Math.max(0, Math.min(stage, activities.length - 1));
          if (view === "student") renderStudent(suggestion, activities[stage]);
          else renderDraft(suggestion, activities[stage]);
          if (activities.length > 1)
            output.insertAdjacentHTML(
              "afterbegin",
              `<nav class="copilot-trail-stages" aria-label="Etapas da trilha">${suggestion.trail.steps.map((step, index) => `<button type="button" data-copilot-stage="${index}" aria-current="${stage === index ? "step" : "false"}"><span>${index + 1}</span>${escapeHtml(step.title || step.activity.title)}</button>`).join("")}</nav>`,
            );
        }
      }
      syncDraftMenu();
      window.OminiResources?.hydrate(output);
    };
    const ensureCurriculumSkills = async (key) => {
      if (state.skills?.length || !api.listCurriculumSkills) return;
      const selected = activeClass();
      const skills = await api
        .listCurriculumSkills({
          materia: config.type,
          serie: selected.serie,
          trimestre: Number(field("trimester")?.value) || null,
          search: "",
        })
        .catch(() => []);
      if (contextKey() === key)
        state.skills = Array.isArray(skills) ? skills : [];
    };

    const generate = async (text, { retry = false, action = creationAction(mode) } = {}) => {
      action = creationAction(action);
      if (busy || applying) return;
      const selected = activeClass();
      if (!selected) {
        showError(
          "Selecione uma turma no contexto da atividade para continuar.",
        );
        return;
      }
      if (text.trim().length < 3) {
        showError("Conte um pouco mais sobre o que deseja preparar.");
        composer.focus();
        return;
      }
      if (
        action === "revisar_atividade" &&
        !state.questions?.length &&
        !activitiesOf(currentDraft()?.payload.suggestion).length
      ) {
        showError(
          "Crie ou adicione questões ao rascunho antes de pedir uma revisão.",
        );
        return;
      }
      const preferences = accessPreferences({
        fullAccess: find("[data-copilot-full-access]").checked,
        allFormatsEnabled: find("[data-copilot-enable-all]").checked,
        useClassContext: find("[data-copilot-consent]").checked,
        types: [
        ...workspace.querySelectorAll("[data-copilot-type]:checked"),
        ].map((input) => input.dataset.copilotType),
      });
      const types = preferences.questionTypes;
      if (!types.length) {
        showError(
          "Selecione pelo menos um formato em Personalizar ou marque Acesso Total.",
        );
        find(".copilot-options").open = true;
        return;
      }
      const count = preferences.fullAccess
        ? 5
        : Number(find("[data-copilot-count]").value);
      if (
        !Number.isInteger(count) ||
        count < (action === "gerar_trilha" ? 2 : 1) ||
        count > 12
      ) {
        showError(
          action === "gerar_trilha"
            ? "Escolha de 2 a 12 questões no total da trilha."
            : "Escolha de 1 a 12 questões para a atividade.",
        );
        find(".copilot-options").open = true;
        return;
      }
      errorBox.hidden = true;
      busy = true;
      const generation = ++generationId;
      const key = contextKey();
      const preferenceSnapshot = {
        ...preferences,
        difficulty: preferences.fullAccess
          ? "equilibrada"
          : find("[data-copilot-difficulty]").value,
        allClasses: find("[data-copilot-all-classes]").checked,
        secureExam: field("category")?.value === "avaliacao"
          ? find("[data-copilot-secure-exam]").checked
          : undefined,
      };
      const requestedDraft = currentDraft();
      const requestedStage = stage;
      const activeSuggestion =
        requestedDraft?.contextKey === key
          ? clone(requestedDraft.payload.suggestion)
          : null;
      const activitySnapshot = clone(
        activitiesOf(activeSuggestion)[stage] || currentActivity(),
      );
      const contextSnapshot = {
        trimester: Number(field("trimester")?.value) || null,
        category: field("category")?.value || "atividade",
        duration: Number(field("duration")?.value) || 50,
        value: Number(field("value")?.value) || 10,
      };
      const reviewingStage =
        action === "revisar_atividade" && !!activeSuggestion?.trail;
      if (reviewingStage) {
        contextSnapshot.duration = activitySnapshot.duration;
        contextSnapshot.value = activitySnapshot.value;
      }
      lastAttempt = { text, action, key };
      if (!retry) addMessage("user", text);
      composer.value = "";
      renderMessages();
      if (!currentDraft()) renderProposal();
      syncControls();
      status.textContent = "Preparando uma proposta para sua turma...";
      try {
        await ensureCurriculumSkills(key);
        if (generation !== generationId || key !== contextKey()) return;
        const objective =
          text.length >= 10
            ? text
            : `${text}. Ajuste a proposta com o contexto desta conversa.`;
        const payload = await api.requestTeacherCopilot({
          action,
          subject: config.type,
          classId: selected.id,
          series: selected.serie,
          ...contextSnapshot,
          objective,
          difficulty: preferenceSnapshot.difficulty,
          questionCount: reviewingStage
            ? activitySnapshot.questions.length
            : count,
          questionTypes: types,
          allFormatsEnabled: preferenceSnapshot.allFormatsEnabled,
          fullAccess: preferenceSnapshot.fullAccess,
          classContextMode: preferenceSnapshot.classContextMode,
          secureExam: preferenceSnapshot.secureExam,
          skillIds: selectedSkills().map((skill) => skill.habilidade_id),
          skillCandidateIds: (state.skills || [])
            .map((skill) => skill.habilidade_id)
            .filter(Boolean)
            .slice(0, 80),
          useClassContext: preferenceSnapshot.useClassContext,
          sessionId,
          conversationMemory,
          messages: boundedMessages(
            messages.filter((message) => message.contextKey === key),
          ),
          currentActivity: activitySnapshot,
          currentSuggestion: activeSuggestion,
        });
        if (
          generation !== generationId ||
          key !== contextKey() ||
          !workspace.isConnected
        )
          return;
        const returnedSuggestion =
          payload?.suggestion ||
          (payload?.result?.ideas ? { ...payload.result } : null);
        const suggestion = reviewingStage
          ? preserveReviewedTrail(
              returnedSuggestion,
              activeSuggestion,
              requestedStage,
            )
          : returnedSuggestion;
        if (!validateSuggestion(suggestion))
          throw new Error(suggestionIssue(suggestion));
        sessionId = payload.sessionId || sessionId;
        conversationMemory = payload.conversationMemory || conversationMemory;
        const memoryNote = find("[data-copilot-memory-note]");
        const providerConfirmed = payload.contextSummary?.providerConfirmed === true &&
          payload.contextSummary?.provider === "google-gemini";
        memoryNote.textContent = [
          providerConfirmed ? "Criado com Gemini." : "",
          payload.contextSummary?.memoryPersisted
            ? "Contexto da conversa atualizado para os próximos ajustes."
            : payload.contextSummary?.memoryUsed
              ? "Contexto da conversa considerado neste pedido."
            : "",
        ].filter(Boolean).join(" ");
        memoryNote.hidden = !memoryNote.textContent;
        const allClassIds = [...(field("classId")?.options || [])]
          .map((option) => option.value)
          .filter(Boolean);
        const draft = {
          id: `proposal-${generation}-${Date.now()}`,
          title:
            suggestion.trail?.title ||
            suggestion.activity?.title ||
            "Ideias para sua aula",
          action: suggestion.trail ? "gerar_trilha"
            : suggestion.activity?.category === "avaliacao" ? "gerar_prova"
            : suggestion.activity?.category === "diagnostica" ? "gerar_diagnostico"
            : action,
          payload: clone({ ...payload, suggestion }),
          contextKey: key,
          targetClassIds: preferenceSnapshot.allClasses
            ? allClassIds
            : [selected.id],
          edited: false,
          applied: false,
          feedbackSent: false,
          secureExam: suggestion.activity?.category === "avaliacao" &&
            (suggestion.activity.secureExam ?? suggestion.activity.configuration?.secureExam?.enabled ?? preferenceSnapshot.secureExam ?? true),
        };
        drafts.push(draft);
        activeDraftId = draft.id;
        stage = reviewingStage ? requestedStage : 0;
        view = "draft";
        const description =
          suggestion.summary ||
          (suggestion.ideas?.length
            ? `Preparei ${suggestion.ideas.length} ideias. Escolha uma para criar a atividade.`
            : suggestion.trail
              ? `Preparei uma trilha com ${activitiesOf(suggestion).length} etapas e ${totalQuestions(suggestion)} questões. Você pode editar e experimentar cada etapa ao lado.`
              : `Preparei uma atividade com ${totalQuestions(suggestion)} questões. Revise ou peça um ajuste.`);
        addMessage("assistant", description, draft.id);
        status.textContent = (payload.contextSummary?.analysisUsed ?? payload.contextSummary?.analysisAuthorized)
          ? "Proposta pronta. Foram considerados somente indicadores agregados da turma."
          : "Proposta pronta para sua revisão. O desempenho da turma não foi analisado.";
        root.dispatchEvent(new Event("input", { bubbles: true }));
        renderProposal();
      } catch (error) {
        if (generation === generationId) {
          if (!composer.value.trim()) composer.value = text;
          showError(
            error?.message ||
              "Não foi possível preparar a proposta. Tente novamente.",
            error?.retryable !== false,
          );
        }
      } finally {
        if (generation === generationId) {
          busy = false;
          renderMessages();
          if (!currentDraft()) renderProposal();
          syncControls();
        }
      }
    };

    const closeWorkspace = (nextStep = previousStep) => {
      workspace.hidden = true;
      root.classList.remove("copilot-workspace-open");
      document.body.classList.remove("teacher-copilot-page-open");
      go?.(nextStep);
      launch.focus();
    };
    launch.addEventListener("click", () => {
      previousStep = state.step || 1;
      if (["gerar_atividade", "gerar_prova", "gerar_diagnostico"].includes(mode)) {
        mode = field("category")?.value === "avaliacao" ? "gerar_prova"
          : field("category")?.value === "diagnostica" ? "gerar_diagnostico"
          : "gerar_atividade";
      }
      refreshContext();
      renderMessages();
      renderProposal();
      workspace.hidden = false;
      root.classList.add("copilot-workspace-open");
      document.body.classList.add("teacher-copilot-page-open");
      find("[data-copilot-heading]").focus();
      workspace.scrollIntoView({ block: "start", behavior: "instant" });
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      generate(composer.value.trim());
    });
    composer.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    find("[data-copilot-drafts]").addEventListener("change", (event) => {
      activeDraftId = event.target.value;
      mode = currentDraft()?.action || "gerar_atividade";
      stage = 0;
      renderProposal();
      renderMessages();
    });
    find("[data-copilot-full-access]").addEventListener("change", syncAccessControls);
    find("[data-copilot-secure-exam]").addEventListener("change", (event) => {
      const draft = currentDraft();
      if (draft?.payload.suggestion.activity?.category === "avaliacao") {
        draft.secureExam = event.target.checked;
        draft.payload.suggestion.activity.secureExam = event.target.checked;
        previewResponses.clear();
        renderProposal();
      }
    });
    find("[data-copilot-enable-all]").addEventListener("change", (event) => {
      workspace.querySelectorAll("[data-copilot-type]").forEach((input) => {
        input.checked = event.target.checked;
      });
    });
    workspace.querySelectorAll("[data-copilot-type]").forEach((input) =>
      input.addEventListener("change", () => {
        const all = find("[data-copilot-enable-all]");
        const selected = workspace.querySelectorAll(
          "[data-copilot-type]:checked",
        ).length;
        all.checked = selected === TYPES.length;
        all.indeterminate = selected > 0 && selected < TYPES.length;
      }),
    );
    ["classId", "trimester", "category"].forEach((name) =>
      field(name)?.addEventListener("change", () => {
        generationId += 1;
        busy = false;
        lastAttempt = null;
        sessionId = null;
        conversationMemory = null;
        find("[data-copilot-memory-note]").hidden = true;
        errorBox.hidden = true;
        refreshContext();
        renderMessages();
        syncControls();
        status.textContent = drafts.length
          ? "O contexto mudou. As propostas anteriores foram preservadas; gere uma nova para a turma atual."
          : "O contexto mudou. Seu próximo pedido usará a turma e as preferências atuais.";
      }),
    );
    const edited = () => {
      const draft = currentDraft();
      if (!draft) return;
      draft.edited = true;
      const activities = activitiesOf(draft.payload.suggestion);
      if (draft.payload.suggestion.trail) {
        draft.payload.suggestion.activity = activities[0];
        draft.payload.suggestion.trail.steps[stage].title =
          activities[stage].title;
      }
      draft.title =
        draft.payload.suggestion.trail?.title ||
        activities[0]?.title ||
        draft.title;
      previewResponses.clear();
      syncControls();
    };
    output.addEventListener("input", (event) => {
      const target = event.target;
      const suggestion = currentDraft()?.payload.suggestion;
      const activity = activitiesOf(suggestion)[stage];
      if (!activity) return;
      if (target.matches("[data-trail-field]")) {
        suggestion.trail[target.dataset.trailField] = target.value;
        edited();
      }
      if (target.matches("[data-activity-field]")) {
        const name = target.dataset.activityField;
        activity[name] = ["duration", "value"].includes(name)
          ? Number(target.value)
          : target.value;
        edited();
      }
      if (target.matches("[data-question-field]")) {
        const question =
          activity.questions[Number(target.dataset.questionIndex)];
        const name = target.dataset.questionField;
        question[name] =
          name === "points" ? Number(target.value) : target.value;
        edited();
      }
      if (target.matches("[data-alternative-index]")) {
        const question =
          activity.questions[Number(target.dataset.questionIndex)];
        const index = Number(target.dataset.alternativeIndex);
        if (question.answer === question.alternatives[index])
          question.answer = target.value;
        question.alternatives[index] = target.value;
        edited();
      }
      if (target.matches("[data-preview-question]")) {
        const key = responseKey(Number(target.dataset.previewQuestion));
        previewResponses.set(key, { value: target.value });
        const feedback = output.querySelector(
          `[data-preview-feedback="${target.dataset.previewQuestion}"]`,
        );
        if (feedback) feedback.hidden = true;
        if (target.type === "radio")
          output
            .querySelectorAll(`[name="${target.name}"]`)
            .forEach((input) =>
              input
                .closest("label")
                .classList.toggle("is-selected", input.checked),
            );
      }
    });
    const apply = async (append) => {
      const draft = currentDraft();
      if (busy || applying || !draft) return;
      if (draft.contextKey !== contextKey()) {
        showError(
          "O contexto mudou. Gere uma proposta para a turma atual antes de aplicar.",
        );
        return;
      }
      const suggestion = draft.payload.suggestion;
      if (!validateSuggestion(suggestion) || suggestion.ideas?.length) {
        showError(
          suggestionIssue(suggestion) ||
            "Transforme a ideia em uma atividade antes de aplicar.",
        );
        return;
      }
      const activities = activitiesOf(suggestion);
      applying = true;
      syncControls();
      try {
        if (applyCopilotSuggestion) {
          const applied = await applyCopilotSuggestion(clone(suggestion), {
            append,
            targetClassIds: [...draft.targetClassIds],
            secureExam: !!draft.secureExam,
          });
          if (applied === false || applied?.ok === false) return;
        } else {
          if (suggestion.trail) {
            showError(
              "Esta página ainda não permite aplicar a trilha completa. Use uma atividade ou abra o editor de trilhas.",
            );
            return;
          }
          const activity = clone(suggestion.activity);
          if (
            !append &&
            state.questions.length &&
            !window.confirm("Substituir as questões atuais por esta proposta?")
          )
            return;
          if (append) {
            state.questions = [...state.questions, ...activity.questions];
            field("value").value = (
              Number(field("value").value) + Number(activity.value)
            ).toFixed(2);
          } else {
            [
              "title",
              "instructions",
              "category",
              "duration",
              "value",
              "scoringMode",
            ].forEach((name) => {
              if (field(name) && activity[name] !== undefined)
                field(name).value = activity[name];
            });
            state.questions = activity.questions;
          }
          state.selectedSkills = new Set(
            state.questions.flatMap((question) => question.skillIds || []),
          );
          state.copilotTargetClassIds = [...draft.targetClassIds];
          state.editing = -1;
          renderQuestions();
          refreshSelected();
          renderQuestionEditor?.();
          onActivityApplied?.(activity);
        }
        draft.applied = true;
        closeWorkspace(3);
        toast("Proposta aplicada ao rascunho. Revise antes de publicar.");
      } catch (error) {
        showError(error?.message || "Não foi possível aplicar esta proposta.");
      } finally {
        applying = false;
        syncControls();
      }
    };
    workspace.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      if (button.matches("[data-copilot-close]")) closeWorkspace();
      else if (button.matches("[data-copilot-preview-toggle]"))
        setPreviewHidden(!previewHidden);
      else if (button.matches("[data-copilot-preview-hide]"))
        setPreviewHidden(true);
      else if (button.matches("[data-copilot-open-proposal]")) {
        activeDraftId = button.dataset.copilotOpenProposal;
        stage = 0;
        renderProposal();
        setPreviewHidden(false);
      }
      else if (button.matches("[data-copilot-context-edit]")) closeWorkspace(1);
      else if (button.matches("[data-copilot-mode]")) {
        const previousMode = mode;
        mode = button.dataset.copilotMode;
        const category = {
          gerar_atividade: "atividade",
          gerar_prova: "avaliacao",
          gerar_diagnostico: "diagnostica",
          gerar_trilha: "atividade",
        }[mode];
        if (category && field("category")?.value !== category) {
          field("category").value = category;
          field("category").dispatchEvent(new Event("change", { bubbles: true }));
          if (field("category").value !== category) {
            mode = previousMode;
            syncControls();
            return;
          }
        }
        if (mode === "gerar_prova") find("[data-copilot-secure-exam]").checked = true;
        syncControls();
        composer.focus();
      } else if (button.matches("[data-copilot-view]")) {
        view = button.dataset.copilotView;
        renderProposal();
      } else if (button.matches("[data-copilot-edit]")) {
        view = "draft";
        renderProposal();
        output.querySelector("[data-activity-field='title']")?.focus();
      } else if (button.matches("[data-copilot-prompt]")) {
        const prompt = button.dataset.copilotPrompt;
        const requests = {
          "Mais prática":
            "Torne a proposta mais prática, com ações concretas do aluno e situações do cotidiano.",
          "Mais acessível":
            "Adapte a linguagem e as etapas para tornar a atividade mais acessível, preservando o objetivo pedagógico.",
          "Incluir debate":
            "Inclua uma discussão com comparação de evidências e uma conclusão justificada.",
          "Prática guiada": `Crie uma prática guiada de ${config.short}, com exemplos claros e desafios progressivos.`,
          "Investigar um tema": `Crie uma investigação de ${config.short} baseada em situações reais e comparação de evidências.`,
          "Diagnosticar conhecimentos": `Prepare uma atividade diagnóstica de ${config.short} com feedback acolhedor.`,
        };
        composer.value = requests[prompt] || prompt;
        composer.focus();
      } else if (
        button.matches("[data-copilot-retry]") &&
        lastAttempt &&
        lastAttempt.key === contextKey()
      )
        generate(lastAttempt.text, { retry: true, action: lastAttempt.action });
      else if (button.matches("[data-copilot-apply]")) await apply(false);
      else if (button.matches("[data-copilot-append]")) await apply(true);
      else if (button.matches("[data-copilot-stage]")) {
        stage = Number(button.dataset.copilotStage);
        renderProposal();
      } else if (button.matches("[data-copilot-remove]")) {
        const activity = activitiesOf(currentDraft()?.payload.suggestion)[
          stage
        ];
        if (activity.questions.length > 1) {
          activity.questions.splice(Number(button.dataset.copilotRemove), 1);
          edited();
          renderProposal();
        }
      } else if (button.matches("[data-copilot-idea]")) {
        const idea =
          currentDraft()?.payload.suggestion.ideas[
            Number(button.dataset.copilotIdea)
          ];
        if (idea) {
          mode = "gerar_atividade";
          syncControls();
          generate(
            `Crie uma atividade a partir desta ideia: ${idea.title}. Objetivo: ${idea.objective}. O aluno deve: ${idea.studentAction || idea.interaction || "participar ativamente"}. Evidência de aprendizagem: ${idea.evidence || "atingir o objetivo descrito"}. ${Array.isArray(idea.adaptations) && idea.adaptations.length ? `Adaptações e desafios: ${idea.adaptations.join("; ")}. ` : ""}${idea.teacherPrompt || ""}`,
            { action: "gerar_atividade" },
          );
        }
      } else if (button.matches("[data-preview-check]")) {
        const index = Number(button.dataset.previewCheck);
        const activity = activitiesOf(currentDraft()?.payload.suggestion)[
          stage
        ];
        const question = activity.questions[index];
        const key = responseKey(index);
        const response = previewResponses.get(key) || {};
        const node = output.querySelector(`[data-preview-feedback="${index}"]`);
        const { feedback } = currentDraft()?.secureExam
          ? { feedback: "Resposta registrada nesta prévia. No modo prova, dicas e correções aparecem somente após a liberação do professor." }
          : previewEvaluation(question, response.value);
        previewResponses.set(key, { ...response, feedback });
        node.textContent = feedback;
        node.hidden = false;
      } else if (
        button.matches("[data-feedback]") &&
        currentDraft()?.payload.executionId
      ) {
        const draft = currentDraft();
        workspace.querySelectorAll("[data-feedback]").forEach((item) => {
          item.disabled = true;
        });
        try {
          await api.sendTeacherCopilotFeedback(
            draft.payload.executionId,
            button.dataset.feedback === "true",
          );
          draft.feedbackSent = true;
          status.textContent = "Seu retorno sobre a proposta foi registrado.";
        } catch (error) {
          showError(error.message || "Não foi possível registrar seu retorno.");
        } finally {
          syncControls();
        }
      }
    });
    workspace.querySelectorAll("[data-copilot-view]").forEach((button) =>
      button.addEventListener("keydown", (event) => {
        if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          view = view === "draft" ? "student" : "draft";
          renderProposal();
          find(`[data-copilot-view="${view}"]`).focus();
        }
      }),
    );
    workspace.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !applying) closeWorkspace();
    });
    const beforeUnload = (event) => {
      if (
        busy ||
        (!workspace.hidden &&
          ((currentDraft() && !currentDraft().applied) ||
            composer.value.trim()))
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    const observer = new MutationObserver(() => {
      if (!root.isConnected) {
        generationId += 1;
        window.removeEventListener("beforeunload", beforeUnload);
        document.body.classList.remove("teacher-copilot-page-open");
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    refreshContext();
    syncAccessControls();
    syncPreviewLayout();
    renderMessages();
    renderProposal();
  };
})();
