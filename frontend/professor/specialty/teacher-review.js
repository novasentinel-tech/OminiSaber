(() => {
  "use strict";

  const answerText = (value) => {
    if (value === null || value === undefined || value === "")
      return "Sem resposta";
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
      return String(value);
    const useful =
      value.value ??
      value.answer ??
      value.text ??
      value.code ??
      value.selected ??
      value.values;
    if (useful !== undefined)
      return Array.isArray(useful) ? useful.join(", ") : String(useful);
    return JSON.stringify(value, null, 2);
  };
  const percentage = (value) => value == null ? "Sem evidências" :
    `${Math.max(0, Math.min(100, Number(value) || 0))
      .toFixed(1)
      .replace(".0", "")}%`;

  window.renderTeacherReviewCenter = async ({
    content,
    data,
    api,
    config,
    escapeHtml: e,
    formatDate,
    toast,
    reload,
    mode = "reviews",
    evaluationId = "",
    classId = "",
    trimester = "",
    onCreate = reload,
  }) => {
    const evaluations = (data.evaluations || []).filter(
      (item) => item.status !== "rascunho",
    );
    const state = {
      mode,
      queue: [],
      queueAll: [],
      queueSearch: "",
      queueEvaluationId: evaluationId || "",
      selectedAttempt: null,
      evaluationId: evaluations.some(item => item.id === evaluationId) ? evaluationId : evaluations[0]?.id || "",
      analytics: {},
    };
    let queueSearchTimer = null;

    const shell = () => {
      content.innerHTML = `<section class="teacher-review" data-teacher-review>
        <header class="review-hero"><div><p class="eyebrow">Ciclo de aprendizagem</p><h2>Central de correções</h2><p>Revise respostas, escreva devolutivas claras e transforme dificuldades em próximos passos.</p></div><button class="button primary" type="button" data-new-activity><span class="material-symbols-outlined">add_task</span>Nova atividade</button></header>
        <nav class="review-tabs" aria-label="Áreas das avaliações"><button type="button" data-mode="reviews"><span class="material-symbols-outlined">rate_review</span>Correções pendentes</button><button type="button" data-mode="results"><span class="material-symbols-outlined">monitoring</span>Resultados e recuperação</button></nav>
        <div data-review-view></div>
      </section>`;
      const root = content.querySelector("[data-teacher-review]");
      root
        .querySelector("[data-new-activity]")
        .addEventListener("click", onCreate);
      root.querySelectorAll("[data-mode]").forEach((button) =>
        button.addEventListener("click", () => {
          state.mode = button.dataset.mode;
          render();
        }),
      );
      return root;
    };

    const root = shell();
    const view = () => root.querySelector("[data-review-view]");
    const setActiveTab = () =>
      root
        .querySelectorAll("[data-mode]")
        .forEach((button) =>
          button.classList.toggle("active", button.dataset.mode === state.mode),
        );
    const evaluationOptions = () =>
      evaluations
        .map(
          (item) =>
            `<option value="${item.id}" ${item.id === state.evaluationId ? "selected" : ""}>${e(item.titulo)} · ${e(item.turmas?.nome || "Sem turma")}</option>`,
        )
        .join("");

    const renderLoading = (message) => {
      view().innerHTML = `<div class="review-loading"><span class="material-symbols-outlined spin">progress_activity</span><p>${e(message)}</p></div>`;
    };
    const renderEmpty = (icon, title, message) =>
      `<div class="review-empty"><span class="material-symbols-outlined">${icon}</span><h3>${e(title)}</h3><p>${e(message)}</p></div>`;

    const responseStatus = (response) => {
      if (response.status_correcao === "manual")
        return { label: "Revisada", icon: "task_alt", className: "done" };
      if (response.status_correcao === "automatica")
        return { label: "Automática", icon: "auto_awesome", className: "automatic" };
      return { label: "Aguardando", icon: "rate_review", className: "pending" };
    };

    const referenceImage = (question) => {
      const image = question?.configuracao?.referenceImage;
      if (!image?.dataUrl || !/^data:image\/(png|jpeg|webp);base64,/i.test(image.dataUrl))
        return "";
      return `<figure class="review-reference"><img src="${e(image.dataUrl)}" alt="${e(image.alt || "Imagem de referência da questão")}">${image.alt ? `<figcaption>${e(image.alt)}</figcaption>` : ""}</figure>`;
    };

    const responseCard = (response) => {
      const question = response.questoes_avaliacao || {};
      const expected = question.gabaritos_avaliacao?.resposta_esperada;
      const status = responseStatus(response);
      const maximum = Number(question.pontos || 0);
      const earned = Number(response.pontos_manuais ?? response.pontos_automaticos ?? 0);
      const acceptsManual = ["revisao", "manual"].includes(response.status_correcao);
      return `<article class="manual-answer ${status.className}" data-response-card="${response.id}"><header><span>Questão ${question.ordem || ""}</span><span class="answer-state ${status.className}"><span class="material-symbols-outlined">${status.icon}</span>${status.label}</span><strong>${earned.toFixed(2)} / ${maximum.toFixed(2)}</strong></header><h4>${e(question.enunciado || "Questão")}</h4>${referenceImage(question)}<div class="answer-comparison"><div><small>Resposta do aluno</small><pre>${e(answerText(response.resposta))}</pre></div><div><small>Referência de correção</small><pre>${e(answerText(expected))}</pre>${question.explicacao ? `<p>${e(question.explicacao)}</p>` : ""}</div></div>${acceptsManual ? `<form data-grade-response="${response.id}"><div class="grade-fields"><label>Pontos<input name="points" type="number" min="0" max="${maximum}" step="0.01" value="${Number(response.pontos_manuais || 0)}" required></label><label>Devolutiva ao aluno<textarea name="feedback" rows="4" minlength="8" maxlength="3000" required placeholder="Diga o que foi bem feito, o que precisa melhorar e qual é o próximo passo.">${e(response.feedback || "")}</textarea></label></div><div class="grade-shortcuts" aria-label="Atalhos de pontuação"><button type="button" data-score="0">0 ponto</button><button type="button" data-score="${maximum / 2}">Metade</button><button type="button" data-score="${maximum}">Pontuação máxima</button></div><button class="button primary" type="submit"><span class="material-symbols-outlined">check_circle</span>Salvar e avançar</button></form>` : `<div class="automatic-feedback"><span class="material-symbols-outlined">${status.icon}</span><div><strong>${status.label}</strong><p>${e(response.feedback || "Esta resposta já foi corrigida pelo sistema.")}</p></div></div>`}</article>`;
    };

    const renderAttempt = () => {
      const target = root.querySelector("[data-selected-attempt]");
      const attempt = state.selectedAttempt;
      if (!target) return;
      if (!attempt) {
        target.innerHTML = renderEmpty(
          "touch_app",
          "Selecione uma entrega",
          "Escolha um aluno na fila para abrir as respostas que precisam de revisão.",
        );
        return;
      }
      const responses = attempt.respostas_avaliacao || [];
      const pending = responses.filter((item) =>
        ["revisao", "manual"].includes(item.status_correcao),
      );
      const completed = responses.filter((item) => !["revisao", "pendente"].includes(item.status_correcao)).length;
      const nextIndex = state.queue.findIndex((item) => item.id === attempt.id) + 1;
      target.innerHTML = `<header class="attempt-heading"><div><p class="eyebrow">${e(attempt.avaliacoes_docentes?.titulo || "Atividade")}</p><h3>${e(attempt.perfis?.nome || "Aluno")}</h3><p>${e(attempt.avaliacoes_docentes?.turmas?.nome || "Turma")} · tentativa ${attempt.numero_tentativa} · entregue ${formatDate(attempt.enviada_em)}</p></div><div class="attempt-scoreboard"><div class="score-chip"><small>Automática</small><strong>${Number(attempt.pontuacao_automatica || 0).toFixed(2)}</strong></div><div class="score-chip"><small>Manual</small><strong>${Number(attempt.pontuacao_manual || 0).toFixed(2)}</strong></div></div></header><div class="attempt-progress"><div><span><strong>${completed}</strong> de ${responses.length} respostas revisadas</span><span>${pending.filter((item) => item.status_correcao === "revisao").length} aguardando ação</span></div><div class="mastery-track"><i style="width:${responses.length ? Math.round(completed / responses.length * 100) : 0}%"></i></div></div><nav class="attempt-tools" aria-label="Navegação entre entregas"><span>Entrega ${nextIndex} de ${state.queue.length}</span><button type="button" data-next-attempt ${state.queue.length < 2 ? "disabled" : ""}>Próxima entrega<span class="material-symbols-outlined">arrow_forward</span></button></nav><div class="manual-answer-list">${responses.map(responseCard).join("")}</div>`;
      target.querySelector("[data-next-attempt]")?.addEventListener("click", () => {
        const next = state.queue[nextIndex % state.queue.length];
        state.selectedAttempt = next || null;
        renderQueue();
      });
      target.querySelectorAll("[data-grade-response]").forEach((form) =>
        {
          form.querySelectorAll("[data-score]").forEach((shortcut) =>
            shortcut.addEventListener("click", () => {
              form.elements.points.value = shortcut.dataset.score;
              form.elements.feedback.focus();
            }),
          );
          form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const button = form.querySelector("button");
          const fields = new FormData(form);
          button.disabled = true;
          try {
            const result = await api.gradeTeacherEvaluationResponse({
              responseId: form.dataset.gradeResponse,
              points: fields.get("points"),
              feedback: fields.get("feedback"),
            });
            toast(
              result?.requer_revisao
                ? "Correção salva. Ainda existem respostas pendentes."
                : "Correção concluída e nota final liberada.",
            );
            await loadQueue(attempt.id);
          } catch (error) {
            toast(error.message, "error");
            button.disabled = false;
          }
          });
        },
      );
    };

    const applyQueueFilters = () => {
      const term = state.queueSearch.trim().toLocaleLowerCase("pt-BR");
      state.queue = state.queueAll.filter((attempt) => {
        const matchesEvaluation = !state.queueEvaluationId || attempt.avaliacao_id === state.queueEvaluationId;
        const haystack = `${attempt.perfis?.nome || ""} ${attempt.perfis?.matricula || ""} ${attempt.avaliacoes_docentes?.titulo || ""}`.toLocaleLowerCase("pt-BR");
        return matchesEvaluation && (!term || haystack.includes(term));
      });
      if (!state.queue.some((item) => item.id === state.selectedAttempt?.id))
        state.selectedAttempt = state.queue[0] || null;
    };

    const renderQueue = () => {
      const pendingResponses = state.queueAll.reduce((total, attempt) => total + (attempt.respostas_avaliacao || []).filter((response) => response.status_correcao === "revisao").length, 0);
      view().innerHTML = `<section class="queue-overview"><article><span class="material-symbols-outlined">inbox</span><div><small>Entregas na fila</small><strong>${state.queueAll.length}</strong></div></article><article><span class="material-symbols-outlined">rate_review</span><div><small>Respostas para revisar</small><strong>${pendingResponses}</strong></div></article><article><span class="material-symbols-outlined">auto_awesome</span><div><small>Correção automática</small><strong>Ativa</strong></div></article></section><section class="queue-toolbar"><label><span class="material-symbols-outlined">search</span><input type="search" data-queue-search value="${e(state.queueSearch)}" placeholder="Buscar aluno ou atividade"></label><select data-queue-evaluation aria-label="Filtrar por atividade"><option value="">Todas as atividades</option>${evaluationOptions()}</select></section>${state.queue.length
        ? `<div class="review-workspace"><aside class="review-queue"><div class="queue-heading"><div><p class="eyebrow">Mais antigas primeiro</p><h3>${state.queue.length} entrega(s) visível(is)</h3></div></div><div class="queue-list">${state.queue
            .map((attempt) => {
              const pending = (attempt.respostas_avaliacao || []).filter(
                (r) => r.status_correcao === "revisao",
              ).length;
              return `<button type="button" data-attempt="${attempt.id}" class="${state.selectedAttempt?.id === attempt.id ? "active" : ""}"><span class="student-avatar">${e(
                (attempt.perfis?.nome || "A")
                  .split(" ")
                  .slice(0, 2)
                  .map((v) => v[0])
                  .join(""),
              )}</span><span><strong>${e(attempt.perfis?.nome || "Aluno")}</strong><small>${e(attempt.avaliacoes_docentes?.titulo || "Atividade")} · ${pending} pendente(s)</small></span><span class="material-symbols-outlined">chevron_right</span></button>`;
            })
            .join(
              "",
            )}</div></aside><section class="selected-attempt" data-selected-attempt></section></div>`
        : `<section class="queue-empty-compact">${renderEmpty(
            "task_alt",
            state.queueAll.length ? "Nenhuma entrega encontrada" : "Fila de correção em dia",
            state.queueAll.length ? "Ajuste a busca ou escolha outra atividade." : "As questões objetivas já foram corrigidas. Novas respostas abertas aparecerão aqui após a entrega.",
          )}<button class="button secondary" type="button" data-open-results-empty><span class="material-symbols-outlined">monitoring</span>Ver resultados da turma</button></section>`}`;
      view().querySelector("[data-queue-search]")?.addEventListener("input", (event) => {
        state.queueSearch = event.target.value;
        window.clearTimeout(queueSearchTimer);
        queueSearchTimer = window.setTimeout(() => {
          applyQueueFilters();
          renderQueue();
          requestAnimationFrame(() => {
            const field = view().querySelector("[data-queue-search]");
            field?.focus();
            field?.setSelectionRange(field.value.length, field.value.length);
          });
        }, 120);
      });
      const evaluationFilter = view().querySelector("[data-queue-evaluation]");
      if (evaluationFilter) {
        evaluationFilter.value = state.queueEvaluationId;
        evaluationFilter.addEventListener("change", (event) => {
          state.queueEvaluationId = event.target.value;
          applyQueueFilters();
          renderQueue();
        });
      }
      view().querySelector("[data-open-results-empty]")?.addEventListener("click", () => {
        state.mode = "results";
        render();
      });
      view()
        .querySelectorAll("[data-attempt]")
        .forEach((button) =>
          button.addEventListener("click", () => {
            state.selectedAttempt =
              state.queue.find((item) => item.id === button.dataset.attempt) ||
              null;
            renderQueue();
          }),
        );
      renderAttempt();
    };

    const loadQueue = async (keepId = null) => {
      renderLoading("Buscando entregas reais no Supabase...");
      try {
        const queue = await api.listTeacherReviewQueue({
          tipoProfessor: config.type,
          evaluationId: evaluationId || null,
        });
        const allowed = new Set(evaluations.map(item => item.id));
        state.queueAll = queue.filter(item => (!classId && !trimester && !evaluationId) || allowed.has(item.avaliacao_id));
        applyQueueFilters();
        state.selectedAttempt =
          state.queue.find((item) => item.id === keepId) ||
          state.queue[0] ||
          null;
        renderQueue();
      } catch (error) {
        view().innerHTML = renderEmpty(
          "cloud_off",
          "Não foi possível carregar a fila",
          error.message,
        );
      }
    };

    const renderResults = () => {
      if (!evaluations.length) {
        view().innerHTML = renderEmpty(
          "assignment",
          "Nenhuma atividade publicada",
          "Publique uma atividade para começar a acompanhar resultados reais.",
        );
        return;
      }
      const analytics = state.analytics || {};
      const metrics = analytics.metricas || {};
      const students = analytics.alunos || [];
      const questions = analytics.questoes || [];
      const descriptors = (analytics.descritores || []).map(item => Number(item.evidencias) > 0 ? item : { ...item, desempenho: null });
      const audit = analytics.auditoria || [];
      const maxGrade = Number(analytics.avaliacao?.valor || 0);
      const statusLabel = (item) =>
        item.requer_revisao
          ? "Em revisão"
          : {
              nao_iniciada: "Não iniciou",
              em_andamento: "Em andamento",
              enviada: "Enviada",
              corrigida: "Corrigida",
            }[item.status] || item.status;
      const weakIds = descriptors
        .filter((item) => Number(item.evidencias) > 0 && item.desempenho != null && Number(item.desempenho) < 60)
        .map((item) => item.id);
      view().innerHTML = `<section class="results-toolbar"><label>Atividade<select data-result-evaluation>${evaluationOptions()}</select></label><button class="button secondary" type="button" data-refresh-results><span class="material-symbols-outlined">refresh</span>Atualizar</button></section>
        <section class="result-metrics"><article><span class="material-symbols-outlined">groups</span><small>Turma</small><strong>${Number(metrics.total_alunos || 0)}</strong><span>${Number(metrics.entregaram || 0)} entregaram</span></article><article><span class="material-symbols-outlined">person_alert</span><small>Não entregaram</small><strong>${Number(metrics.nao_entregaram || 0)}</strong><span>alunos pendentes</span></article><article><span class="material-symbols-outlined">analytics</span><small>Média da turma</small><strong>${Number(metrics.media_turma || 0).toFixed(1)}</strong><span>de ${maxGrade.toFixed(1)} pontos</span></article><article><span class="material-symbols-outlined">rate_review</span><small>Em revisão</small><strong>${Number(metrics.em_revisao || 0)}</strong><span>correções manuais</span></article></section>
        <div class="results-grid"><section class="results-panel"><div class="panel-title"><div><p class="eyebrow">Visão individual</p><h3>Todos os alunos da turma</h3></div></div>${students.length ? `<div class="result-table" role="table"><div class="result-row result-row-five head" role="row"><span>Aluno</span><span>Automática</span><span>Manual</span><span>Nota</span><span>Situação / ação</span></div>${students.map((item) => `<div class="result-row result-row-five" role="row"><span><strong>${e(item.nome)}</strong><small>${e(item.matricula || "Sem matrícula")}</small></span><span>${item.pontuacao_automatica == null ? "—" : Number(item.pontuacao_automatica).toFixed(2)}</span><span>${item.pontuacao_manual == null ? "—" : Number(item.pontuacao_manual).toFixed(2)}</span><span><strong>${item.nota == null ? "—" : Number(item.nota).toFixed(2)}</strong></span><span><em class="result-status ${e(item.status)}">${e(statusLabel(item))}</em>${item.status === "corrigida" ? `<button type="button" class="grade-adjust" data-adjust-grade="${item.tentativa_id}" data-student="${e(item.nome)}" data-grade="${Number(item.nota || 0)}">Ajustar nota</button>` : ""}</span></div>`).join("")}</div>` : renderEmpty("group_off", "Turma sem alunos", "Vincule alunos à turma para acompanhar entregas e resultados.")}</section>
          <aside class="results-panel"><div class="panel-title"><div><p class="eyebrow">Currículo</p><h3>Desempenho por descritor</h3></div></div><form class="descriptor-results" data-recovery-form>${descriptors.length ? descriptors.map((item) => `<label class="descriptor-result"><input type="checkbox" name="skills" value="${item.id}" ${weakIds.includes(item.id) ? "checked" : ""}><span><span class="descriptor-heading"><strong>${e(item.codigo)}</strong><b>${percentage(item.desempenho)}</b></span><small>${e(item.descricao)}</small><span class="mastery-track"><i style="width:${Math.max(0, Math.min(100, Number(item.desempenho) || 0))}%"></i></span><em>${Number(item.evidencias || 0)} evidência(s) · ${(item.descritores || []).map((d) => e(d.codigo)).join(" · ") || "sem código associado"}</em></span></label>`).join("") : `<p class="subtle">Associe habilidades às questões para ativar esta leitura.</p>`}<div class="recovery-action"><label>Título da recuperação<input name="title" maxlength="180" placeholder="Recuperação · ${e(analytics.avaliacao?.titulo || "atividade")}"></label><button class="button primary" type="submit" ${descriptors.length ? "" : "disabled"}><span class="material-symbols-outlined">restart_alt</span>Criar recuperação focada</button><small>Os descritores abaixo de 60% já vêm selecionados. A recuperação será criada como rascunho.</small></div></form></aside></div>
        <div class="evidence-grid"><section class="results-panel"><div class="panel-title"><div><p class="eyebrow">Diagnóstico</p><h3>Questões que mais geraram dificuldade</h3></div></div><div class="question-difficulty">${questions.length ? questions.map((item) => `<article><span class="question-rank">${item.ordem}</span><div><strong>${e(item.enunciado)}</strong><small>${Number(item.acertos || 0)} acerto(s) em ${Number(item.respostas || 0)} resposta(s)</small><div class="mastery-track"><i style="width:${Number(item.percentual_acerto || 0)}%"></i></div></div><b>${percentage(item.percentual_acerto)}</b></article>`).join("") : `<p class="subtle">Ainda não existem respostas para analisar.</p>`}</div></section><section class="results-panel"><div class="panel-title"><div><p class="eyebrow">Transparência</p><h3>Histórico de auditoria</h3></div></div><div class="audit-list">${audit.length ? audit.map((item) => `<article><span class="material-symbols-outlined">history</span><div><strong>${e(String(item.evento || "alteração").replaceAll("_", " "))}</strong><small>${formatDate(item.created_at)}</small>${item.detalhes?.motivo ? `<p>${e(item.detalhes.motivo)}</p>` : ""}</div></article>`).join("") : `<p class="subtle">Nenhuma alteração auditável registrada.</p>`}</div></section></div>
        <dialog class="grade-dialog" data-grade-dialog><form method="dialog" data-grade-form><button class="dialog-close" value="cancel" aria-label="Fechar"><span class="material-symbols-outlined">close</span></button><p class="eyebrow">Ajuste auditável</p><h3 data-grade-student></h3><label>Nova nota<input name="grade" type="number" min="0" max="${maxGrade}" step="0.01" required></label><label>Justificativa<textarea name="reason" minlength="8" maxlength="2000" rows="4" required placeholder="Explique por que a nota está sendo alterada."></textarea></label><button class="button primary" type="submit" value="save"><span class="material-symbols-outlined">verified</span>Registrar ajuste</button></form></dialog>`;
      root
        .querySelector("[data-result-evaluation]")
        .addEventListener("change", (event) => {
          state.evaluationId = event.target.value;
          loadResults();
        });
      root
        .querySelector("[data-refresh-results]")
        .addEventListener("click", loadResults);
      const dialog = root.querySelector("[data-grade-dialog]");
      dialog.setAttribute("aria-label", "Ajustar nota do aluno");
      const closeGradeDialog = dialog.querySelector(".dialog-close");
      closeGradeDialog.type = "button";
      closeGradeDialog.addEventListener("click", () => dialog.close());
      root.querySelectorAll("[data-adjust-grade]").forEach((button) =>
        button.addEventListener("click", () => {
          dialog.querySelector("[data-grade-form]").reset();
          dialog.dataset.attemptId = button.dataset.adjustGrade;
          dialog.querySelector("[data-grade-student]").textContent =
            button.dataset.student;
          dialog.querySelector('[name="grade"]').value = button.dataset.grade;
          dialog.showModal();
        }),
      );
      dialog
        .querySelector("[data-grade-form]")
        .addEventListener("submit", async (event) => {
          if (event.submitter?.value !== "save") return;
          event.preventDefault();
          const form = event.currentTarget;
          const fields = new FormData(form);
          const button = form.querySelector('[type="submit"][value="save"]');
          button.disabled = true;
          try {
            await api.adjustTeacherEvaluationGrade({
              attemptId: dialog.dataset.attemptId,
              grade: fields.get("grade"),
              reason: fields.get("reason"),
            });
            dialog.close();
            toast("Nota ajustada e registrada no histórico de auditoria.");
            await loadResults();
          } catch (error) {
            toast(error.message, "error");
            button.disabled = false;
          }
        });
      root
        .querySelector("[data-recovery-form]")
        ?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fields = new FormData(form);
          const skillIds = fields.getAll("skills");
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;
          try {
            await api.createTeacherRecovery({
              evaluationId: state.evaluationId,
              skillIds,
              title: fields.get("title"),
            });
            toast(
              "Recuperação criada como rascunho com os descritores selecionados.",
            );
            window.setTimeout(reload, 700);
          } catch (error) {
            toast(error.message, "error");
            button.disabled = false;
          }
        });
    };

    const loadResults = async () => {
      if (!state.evaluationId) return renderResults();
      renderLoading("Calculando resultados por aluno e descritor...");
      try {
        state.analytics = await api.getTeacherEvaluationAnalytics(
          state.evaluationId,
        );
        renderResults();
      } catch (error) {
        view().innerHTML = renderEmpty(
          "cloud_off",
          "Não foi possível calcular os resultados",
          error.message,
        );
      }
    };

    const render = () => {
      setActiveTab();
      state.mode === "results" ? loadResults() : loadQueue();
    };
    render();
  };
})();
