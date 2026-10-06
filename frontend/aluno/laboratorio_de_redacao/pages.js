(() => {
  const page = document.body.dataset.redacaoPage;
  const root = document.querySelector("[data-redacao-root]");
  const params = new URLSearchParams(location.search);
  const essayId = params.get("redacao");
  const api = () => window.OminiSaber;
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
  const date = (value) =>
    value
      ? new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(value))
      : "Sem data";
  const statusLabels = {
    rascunho: "Rascunho",
    enviada: "Aguardando correção",
    corrigida: "Corrigida",
  };
  const empty = (icon, title, message, action = "") =>
    `<section class="subpage-empty"><span class="material-symbols-outlined">${icon}</span><h1>${escapeHTML(title)}</h1><p>${escapeHTML(message)}</p>${action}</section>`;
  const loadEssay = async () => {
    if (!essayId || !api()?.configured) return null;
    return api().getStudentEssay(essayId);
  };
  const paragraphCount = (text = "") =>
    text.trim()
      ? text
          .trim()
          .split(/\n\s*\n|\n(?=\s{4})/)
          .filter((item) => item.trim()).length
      : 0;
  const review = async () => {
    const essay = await loadEssay();
    if (!essay) {
      root.innerHTML = empty(
        "description",
        "Rascunho não encontrado",
        "Volte ao laboratório e salve sua redação antes de revisar.",
        '<a class="button button-primary" href="../index.html">Voltar ao laboratório</a>',
      );
      return;
    }
    if (essay.status !== "rascunho") {
      root.innerHTML = empty(
        "task_alt",
        "Esta redação já foi enviada",
        "O texto não pode mais ser alterado. Acompanhe o estado no histórico.",
        '<a class="button button-primary" href="../historico/index.html">Abrir histórico</a>',
      );
      return;
    }
    const words = essay.texto.trim().split(/\s+/).filter(Boolean).length;
    const paragraphs = paragraphCount(essay.texto);
    const automatic = [
      {
        ok: essay.titulo.trim().length >= 3,
        label: "O texto possui um título definido.",
      },
      {
        ok: words >= 80,
        label: `Há desenvolvimento suficiente para revisão (${words} palavras; mínimo técnico: 80).`,
      },
      {
        ok: paragraphs >= 4,
        label: `A estrutura apresenta ao menos quatro parágrafos (${paragraphs} identificados).`,
      },
    ];
    root.innerHTML = `<header class="subpage-heading"><div><p class="eyebrow">REVISÃO ANTES DO ENVIO</p><h1>Uma última leitura com intenção.</h1><p>O checklist combina verificações do texto com decisões que só você pode confirmar.</p></div><span class="review-score" data-review-score>0/6</span></header><div class="review-layout"><article class="review-paper"><p class="review-theme">${escapeHTML(essay.propostas_redacao?.titulo || "Proposta do banco de temas")}</p><h2>${escapeHTML(essay.titulo)}</h2><div class="essay-text">${escapeHTML(essay.texto)}</div><footer><span>${words} palavras</span><span>${paragraphs} parágrafos</span><span>Salvo ${date(essay.updated_at)}</span></footer></article><aside class="checklist-panel"><h2>Checklist de estrutura</h2><p>Os três primeiros itens são avaliados automaticamente.</p><div class="checklist">${automatic.map((item) => `<label class="check-item automatic ${item.ok ? "checked" : ""}"><input type="checkbox" data-review-check disabled ${item.ok ? "checked" : ""}><span class="material-symbols-outlined">${item.ok ? "check_circle" : "cancel"}</span><span><strong>Verificação automática</strong>${escapeHTML(item.label)}</span></label>`).join("")}<label class="check-item"><input type="checkbox" data-review-check><span class="material-symbols-outlined">radio_button_unchecked</span><span><strong>Tese e argumentos</strong>Minha introdução apresenta uma posição e os parágrafos seguintes desenvolvem razões diferentes.</span></label><label class="check-item"><input type="checkbox" data-review-check><span class="material-symbols-outlined">radio_button_unchecked</span><span><strong>Repertório pertinente</strong>As referências foram explicadas e conectadas ao argumento; não usei repertório coringa.</span></label><label class="check-item"><input type="checkbox" data-review-check><span class="material-symbols-outlined">radio_button_unchecked</span><span><strong>Intervenção completa</strong>Minha proposta contém agente, ação, meio, finalidade e detalhamento, respeitando os direitos humanos.</span></label></div><div class="review-actions"><a class="button button-secondary" href="../escrita/index.html?redacao=${encodeURIComponent(essay.id || essayId)}&tema=${encodeURIComponent(essay.tema_codigo || "")}"><span class="material-symbols-outlined">edit</span>Continuar editando</a><button class="button button-primary" type="button" data-submit-reviewed disabled>Confirmar e enviar<span class="material-symbols-outlined">send</span></button></div><p class="review-feedback" data-review-feedback role="status" aria-live="polite"></p></aside></div>`;
    const checks = [...document.querySelectorAll("[data-review-check]")];
    const submit = document.querySelector("[data-submit-reviewed]");
    const update = () => {
      const completed = checks.filter((item) => item.checked).length;
      document.querySelector("[data-review-score]").textContent =
        `${completed}/${checks.length}`;
      checks
        .filter((item) => !item.disabled)
        .forEach((input) => {
          const item = input.closest(".check-item");
          item.classList.toggle("checked", input.checked);
          item.querySelector(".material-symbols-outlined").textContent =
            input.checked ? "check_circle" : "radio_button_unchecked";
        });
      submit.disabled = completed !== checks.length;
    };
    checks.forEach((input) => input.addEventListener("change", update));
    update();
    submit.addEventListener("click", async () => {
      submit.disabled = true;
      submit.innerHTML =
        '<span class="material-symbols-outlined">sync</span>Enviando...';
      try {
        await api().submitEssayDraft(essay.id);
        location.href = "../historico/index.html?enviada=1";
      } catch (error) {
        document.querySelector("[data-review-feedback]").textContent =
          error.message;
        submit.disabled = false;
        submit.innerHTML =
          'Confirmar e enviar<span class="material-symbols-outlined">send</span>';
      }
    });
  };
  const corrected = async () => {
    const essay = await loadEssay();
    if (!essay) {
      root.innerHTML = empty(
        "search_off",
        "Redação não encontrada",
        "Não foi possível localizar esta produção.",
        '<a class="button button-primary" href="../historico/index.html">Voltar ao histórico</a>',
      );
      return;
    }
    if (essay.status !== "corrigida") {
      root.innerHTML = empty(
        "hourglass_top",
        "Correção em andamento",
        "Sua redação foi enviada e ainda está com a professora. A correção aparecerá aqui quando estiver pronta.",
        '<a class="button button-primary" href="../historico/index.html">Voltar ao histórico</a>',
      );
      return;
    }
    const versions = essay.versoes_redacao || [];
    const sentVersion =
      versions.find((item) => item.motivo === "envio") || versions.at(-1);
    const comments = essay.comentarios_redacao || [];
    const competencies = essay.avaliacoes_competencias_redacao || [];
    root.innerHTML = `<header class="subpage-heading corrected-heading"><div><p class="eyebrow">REDAÇÃO CORRIGIDA</p><h1>${escapeHTML(essay.titulo)}</h1><p>Compare o texto enviado, os comentários e o desempenho em cada competência.</p></div><div class="final-grade"><strong>${Number(essay.nota || 0)}</strong><span>pontos</span></div></header><section class="feedback-summary"><span class="material-symbols-outlined">forum</span><div><h2>Devolutiva geral</h2><p>${escapeHTML(essay.feedback || "A professora ainda não registrou uma devolutiva geral.")}</p></div></section><div class="correction-layout"><article class="corrected-paper"><header><div><p class="eyebrow">TEXTO ENVIADO</p><h2>${escapeHTML(sentVersion?.titulo || essay.titulo)}</h2></div><select data-version-select aria-label="Selecionar versão">${versions.map((item) => `<option value="${item.numero}" ${item.id === sentVersion?.id ? "selected" : ""}>Versão ${item.numero} · ${escapeHTML(item.motivo)}</option>`).join("")}</select></header><div class="essay-text" data-version-text>${escapeHTML(sentVersion?.texto || essay.texto)}</div></article><aside class="correction-sidebar"><section class="competence-panel"><h2>Competências</h2>${[
      1, 2, 3, 4, 5,
    ]
      .map((number) => {
        const item = competencies.find(
          (entry) => Number(entry.competencia) === number,
        );
        const score = Number(item?.nota || 0);
        return `<article class="competence-row"><header><strong>C${number}</strong><span>${score}/200</span></header><div class="competence-bar"><span style="width:${score / 2}%"></span></div><p>${escapeHTML(item?.comentario || "Sem comentário específico.")}</p></article>`;
      })
      .join(
        "",
      )}</section><section class="comments-panel"><h2>Comentários no texto</h2>${comments.length ? comments.map((item) => `<article class="teacher-comment ${escapeHTML(item.tipo)}"><span>${escapeHTML(item.tipo)}</span>${item.trecho ? `<blockquote>“${escapeHTML(item.trecho)}”</blockquote>` : ""}<p>${escapeHTML(item.comentario)}</p></article>`).join("") : '<p class="empty-inline">Nenhum comentário por trecho.</p>'}</section></aside></div>`;
    document
      .querySelector("[data-version-select]")
      ?.addEventListener("change", (event) => {
        const version = versions.find(
          (item) => Number(item.numero) === Number(event.target.value),
        );
        if (version)
          document.querySelector("[data-version-text]").textContent =
            version.texto;
      });
  };
  const history = async () => {
    if (!api()?.configured) throw new Error("O Supabase não está configurado.");
    const items = await api().listStudentEssayHistory();
    const correctedItems = items.filter((item) => item.status === "corrigida");
    const average = correctedItems.length
      ? Math.round(
          correctedItems.reduce(
            (sum, item) => sum + Number(item.nota || 0),
            0,
          ) / correctedItems.length,
        )
      : 0;
    root.innerHTML = `<header class="subpage-heading"><div><p class="eyebrow">MINHAS REDAÇÕES</p><h1>Histórico e evolução</h1><p>Acompanhe rascunhos, envios, correções e todas as versões preservadas no Supabase.</p></div><a class="button button-primary" href="../index.html"><span class="material-symbols-outlined">add</span>Nova redação</a></header><section class="history-stats"><div><span class="material-symbols-outlined">edit_document</span><strong>${items.length}</strong><small>produções</small></div><div><span class="material-symbols-outlined">task_alt</span><strong>${correctedItems.length}</strong><small>corrigidas</small></div><div><span class="material-symbols-outlined">monitoring</span><strong>${average || "—"}</strong><small>média corrigida</small></div><div><span class="material-symbols-outlined">history</span><strong>${items.reduce((sum, item) => sum + (item.versoes_redacao?.length || 0), 0)}</strong><small>versões preservadas</small></div></section><div class="history-toolbar"><div role="group" aria-label="Filtrar histórico"><button class="filter-button is-active" type="button" data-history-filter="todos">Todas</button><button class="filter-button" type="button" data-history-filter="rascunho">Rascunhos</button><button class="filter-button" type="button" data-history-filter="enviada">Aguardando</button><button class="filter-button" type="button" data-history-filter="corrigida">Corrigidas</button></div></div><section class="essay-history-list" data-history-list>${items.length ? items.map(historyCard).join("") : empty("history", "Seu histórico começará aqui", "Quando você salvar a primeira redação, as versões e o andamento aparecerão nesta página.", '<a class="button button-primary" href="../index.html">Começar uma redação</a>')}</section>`;
    document.querySelectorAll("[data-history-filter]").forEach((button) =>
      button.addEventListener("click", () => {
        document
          .querySelectorAll("[data-history-filter]")
          .forEach((item) =>
            item.classList.toggle("is-active", item === button),
          );
        document
          .querySelectorAll("[data-history-status]")
          .forEach((card) =>
            card.classList.toggle(
              "is-hidden",
              button.dataset.historyFilter !== "todos" &&
                card.dataset.historyStatus !== button.dataset.historyFilter,
            ),
          );
      }),
    );
  };
  const historyCard = (item) => {
    const action =
      item.status === "rascunho"
        ? `../index.html?redacao=${item.id}&step=3`
        : item.status === "corrigida"
          ? `../corrigida/index.html?redacao=${item.id}`
          : "";
    return `<article class="essay-history-card" data-history-status="${item.status}"><div class="status-mark ${item.status}"><span class="material-symbols-outlined">${item.status === "corrigida" ? "workspace_premium" : item.status === "enviada" ? "schedule_send" : "edit_note"}</span></div><div class="history-card-main"><span class="status-chip ${item.status}">${statusLabels[item.status] || item.status}</span><h2>${escapeHTML(item.titulo)}</h2><p>${escapeHTML(item.propostas_redacao?.titulo || "Tema do acervo OminiSaber")}</p><footer><span><span class="material-symbols-outlined">calendar_today</span>${date(item.updated_at)}</span><span><span class="material-symbols-outlined">history</span>${item.versoes_redacao?.length || 0} versões</span>${item.nota != null ? `<span><span class="material-symbols-outlined">grade</span>${Number(item.nota)} pontos</span>` : ""}</footer></div>${action ? `<a class="button button-secondary" href="${action}">${item.status === "rascunho" ? "Continuar" : "Ver correção"}<span class="material-symbols-outlined">arrow_forward</span></a>` : '<span class="waiting-label">Em avaliação</span>'}</article>`;
  };
  const init = async () => {
    try {
      if (page === "revisao") await review();
      else if (page === "corrigida") await corrected();
      else await history();
    } catch (error) {
      root.innerHTML = empty(
        "cloud_off",
        "Não foi possível carregar",
        error.message || "Tente novamente mais tarde.",
        '<button class="button button-primary" type="button" onclick="location.reload()">Tentar novamente</button>',
      );
    }
  };
  window.addEventListener("DOMContentLoaded", init);
})();
