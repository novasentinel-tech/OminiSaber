(() => {
  const body = document.body;
  let progressCache = {};
  const escapeHTML = (value = "") =>
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
  const getProgress = () => progressCache;
  const loadProgress = async () => {
    if (!window.OminiSaber?.configured)
      throw new Error("O Supabase não está configurado.");
    const rows = await window.OminiSaber.listExperienceProgress({
      subject: "matematica",
    });
    progressCache = Object.fromEntries(
      rows.map((item) => [
        item.experiencia_codigo,
        { completed: item.concluida, completedAt: item.concluida_em },
      ]),
    );
    return progressCache;
  };
  const toast = (message) => {
    document.querySelector("[data-toast]")?.remove();
    const node = document.createElement("div");
    node.className = "toast";
    node.dataset.toast = "true";
    node.role = "status";
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), 3600);
  };
  const setupMenu = () => {
    const toggle = document.querySelector("[data-menu-toggle]");
    const close = () => {
      body.classList.remove("menu-open");
      toggle?.setAttribute("aria-expanded", "false");
    };
    toggle?.addEventListener("click", () => {
      const open = body.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    document
      .querySelectorAll(".sidebar a")
      .forEach((link) => link.addEventListener("click", close));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    document.addEventListener("click", (event) => {
      if (
        body.classList.contains("menu-open") &&
        !event.target.closest(".sidebar") &&
        !event.target.closest("[data-menu-toggle]")
      )
        close();
    });
  };
  const setProfile = async () => {
    if (!window.OminiSaber?.configured) return;
    try {
      const profile = await window.OminiSaber.getProfile();
      document.querySelectorAll("[data-profile-name]").forEach((node) => {
        node.textContent = profile?.nome || "Estudante";
      });
    } catch (error) {
      console.warn("Não foi possível carregar o perfil.", error);
    }
  };
  const buildQuizDialog = (evaluation) => {
    document.querySelector("[data-quiz-dialog]")?.remove();
    const dialog = document.createElement("dialog");
    dialog.className = "quiz-dialog";
    dialog.dataset.quizDialog = "true";
    const questions = evaluation.questoes_avaliacao || [];
    const content = questions
      .map((question, index) => {
        const alternatives = Array.isArray(question.alternativas)
          ? question.alternativas
          : [];
        const input = alternatives.length
          ? alternatives
              .map((alternative, optionIndex) => {
                const value =
                  typeof alternative === "object"
                    ? (alternative.value ??
                      alternative.text ??
                      alternative.label ??
                      optionIndex)
                    : alternative;
                const label =
                  typeof alternative === "object"
                    ? (alternative.label ??
                      alternative.text ??
                      alternative.value ??
                      `Alternativa ${optionIndex + 1}`)
                    : alternative;
                return `<label class="quiz-option"><input required type="radio" name="question-${escapeHTML(question.id)}" value="${escapeHTML(value)}"><span>${escapeHTML(label)}</span></label>`;
              })
              .join("")
          : `<textarea required name="question-${escapeHTML(question.id)}" aria-label="Resposta da questão ${index + 1}" placeholder="Escreva sua resolução"></textarea>`;
        return `<fieldset class="quiz-question"><legend>${index + 1}. ${escapeHTML(question.enunciado)}</legend>${input}</fieldset>`;
      })
      .join("");
    dialog.innerHTML = `<div class="quiz-dialog-inner"><header class="quiz-dialog-head"><div><p class="panel-kicker">Quiz do professor</p><h2>${escapeHTML(evaluation.titulo)}</h2><p class="muted small">${escapeHTML(evaluation.instrucoes || "Resolva com atenção e envie quando terminar.")}</p></div><button class="icon-button" type="button" data-close-quiz aria-label="Fechar quiz"><span class="material-symbols-outlined">close</span></button></header><form data-quiz-form>${content || '<p class="muted small">Esta avaliação ainda não possui questões.</p>'}<div class="button-row"><button class="primary-button" type="submit" ${questions.length ? "" : "disabled"}><span class="material-symbols-outlined">send</span>Enviar respostas</button><button class="secondary-button" type="button" data-save-quiz ${questions.length ? "" : "disabled"}>Salvar rascunho</button></div><p class="feedback" data-quiz-feedback aria-live="polite"></p></form></div>`;
    document.body.appendChild(dialog);
    dialog
      .querySelector("[data-close-quiz]")
      .addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    const collect = () => {
      const data = new FormData(dialog.querySelector("form"));
      return questions.reduce((responses, question) => {
        responses[question.id] = data.get(`question-${question.id}`) || "";
        return responses;
      }, {});
    };
    const persist = async (submit) => {
      const feedback = dialog.querySelector("[data-quiz-feedback]");
      const responses = collect();
      if (
        submit &&
        Object.values(responses).some((value) => !String(value).trim())
      ) {
        feedback.className = "feedback error";
        feedback.textContent = "Responda todas as questões antes de enviar.";
        return;
      }
      dialog.querySelectorAll("button").forEach((button) => {
        button.disabled = true;
      });
      try {
        await window.OminiSaber.saveStudentEvaluationAttempt({
          evaluationId: evaluation.id,
          responses,
          submit,
        });
        feedback.className = "feedback success";
        feedback.textContent = submit
          ? "Respostas enviadas ao professor."
          : "Rascunho salvo com segurança.";
        if (submit) window.setTimeout(() => dialog.close(), 1500);
      } catch (error) {
        feedback.className = "feedback error";
        feedback.textContent = error.message;
      } finally {
        dialog.querySelectorAll("button").forEach((button) => {
          button.disabled = false;
        });
      }
    };
    dialog
      .querySelector("[data-quiz-form]")
      .addEventListener("submit", (event) => {
        event.preventDefault();
        persist(true);
      });
    dialog
      .querySelector("[data-save-quiz]")
      .addEventListener("click", () => persist(false));
    dialog.showModal();
  };
  const loadTeacherQuiz = async () => {
    const cards = [...document.querySelectorAll("[data-teacher-quiz]")];
    if (!cards.length) return;
    if (!window.OminiSaber?.configured) {
      cards.forEach((card) => {
        card.querySelector("[data-quiz-copy]").textContent =
          "Conecte o Supabase para consultar o quiz publicado pelo professor.";
        card.querySelector("[data-open-quiz]").hidden = true;
      });
      return;
    }
    try {
      const descriptor = body.dataset.descriptor || "";
      const evaluations = await window.OminiSaber.listStudentEvaluations({
        tipoProfessor: "matematica",
      });
      const evaluation = evaluations.find((item) => {
        const config = item.configuracao || {};
        return (
          config.descritor === descriptor ||
          String(item.titulo || "")
            .toLowerCase()
            .includes(descriptor.toLowerCase())
        );
      });
      cards.forEach((card) => {
        const button = card.querySelector("[data-open-quiz]");
        if (!evaluation) {
          card.querySelector("[data-quiz-copy]").textContent =
            "Disponível quando o professor publicar.";
          button.hidden = true;
          return;
        }
        card.dataset.state = "available";
        card.querySelector("[data-quiz-title]").textContent = evaluation.titulo;
        card.querySelector("[data-quiz-copy]").textContent =
          `${evaluation.questoes_avaliacao?.length || 0} questão(ões) · ${evaluation.duracao_minutos || "tempo livre"} min`;
        button.hidden = false;
        button.addEventListener("click", () => buildQuizDialog(evaluation));
      });
    } catch (error) {
      cards.forEach((card) => {
        card.querySelector("[data-quiz-copy]").textContent =
          "Não foi possível consultar o quiz agora.";
        card.querySelector("[data-open-quiz]").hidden = true;
      });
    }
  };
  const complete = async (id, message) => {
    try {
      const row = await window.OminiSaber.completeExperience({
        subject: "matematica",
        code: id,
      });
      progressCache[id] = { completed: true, completedAt: row.concluida_em };
      document.querySelectorAll("[data-completion-state]").forEach((node) => {
        node.textContent = "Atividade concluída";
      });
      toast(message || "Atividade concluída e salva na sua conta.");
    } catch (error) {
      toast(error.message || "Não foi possível salvar o progresso.");
    }
  };
  const id = body.dataset.experience;
  const setupCompletionState = async () => {
    await loadProgress();
    if (id && getProgress()[id]?.completed)
      document.querySelectorAll("[data-completion-state]").forEach((node) => {
        node.textContent = "Atividade concluída";
      });
  };
  window.OminiMath = {
    complete,
    getProgress,
    loadProgress,
    toast,
    loadTeacherQuiz,
  };
  setupMenu();
  document.addEventListener("ominisaber:ready", () => {
    setProfile();
    setupCompletionState().catch((error) => toast(error.message));
    loadTeacherQuiz();
  });
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.OminiSaber?.configured) loadTeacherQuiz();
  });
})();
