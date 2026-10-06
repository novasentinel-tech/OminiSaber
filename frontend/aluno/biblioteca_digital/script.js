(() => {
  const api = () => window.OminiSaber;
  const pageParams = new URLSearchParams(location.search);
  const subjectLabels = {
    matematica: "Matemática",
    portugues: "Português",
    fisica: "Física",
    redacao: "Redação",
    tecnico_administracao: "Administração",
    tecnico_informatica: "Informática",
  };
  const requestedSubject = subjectLabels[pageParams.get("materia")] || "todos";
  const state = {
    physical: [],
    digital: [],
    requests: [],
    mode: pageParams.get("mode") === "digital" ? "digital" : "fisico",
    filter: requestedSubject,
    search: "",
    selected: null,
    busy: false,
  };
  const $ = (selector) => document.querySelector(selector);
  const escapeHTML = (value) =>
    String(value ?? "").replace(
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
  const normalize = (value) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const formatDate = (value) =>
    value
      ? new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "short",
        }).format(new Date(value))
      : "--";
  const toast = (message, type = "info") => {
    const node = $("[data-toast]");
    node.textContent = message;
    node.dataset.type = type;
    node.classList.add("is-visible");
    clearTimeout(node.timer);
    node.timer = setTimeout(() => node.classList.remove("is-visible"), 3800);
  };
  const cover = (item, kind) =>
    `<div class="book-cover ${kind}">${item.capa_url ? `<img src="${escapeHTML(item.capa_url)}" alt="Capa de ${escapeHTML(item.titulo)}" onerror="this.remove()">` : ""}<span class="material-symbols-outlined">${kind === "digital" ? "picture_as_pdf" : "menu_book"}</span><em>${kind === "digital" ? "PDF VERIFICADO" : Number(item.quantidade_disponivel) > 0 ? "DISPONÍVEL" : "INDISPONÍVEL"}</em></div>`;
  const activeRequest = (bookId) =>
    state.requests.find(
      (item) =>
        String(item.livro_id) === String(bookId) &&
        ["pendente", "aprovado", "emprestado"].includes(item.status),
    );
  const statusInfo = (status) =>
    ({
      pendente: [
        "Pedido enviado",
        "Aguardando a biblioteca separar o exemplar.",
        "schedule",
      ],
      aprovado: [
        "Pronto para retirada",
        "Seu exemplar já está separado na biblioteca.",
        "inventory_2",
      ],
      emprestado: [
        "Com você",
        "Consulte abaixo o prazo de devolução.",
        "auto_stories",
      ],
      devolvido: ["Devolvido", "Empréstimo finalizado.", "task_alt"],
      recusado: [
        "Não atendido",
        "Consulte a observação da biblioteca.",
        "info",
      ],
    })[status] || [
      "Em análise",
      "Acompanhe a atualização do pedido.",
      "schedule",
    ];
  const filtered = (items) =>
    items.filter((item) => {
      const haystack = normalize(
        `${item.titulo} ${item.autor} ${item.materia} ${item.genero} ${item.categoria} ${item.palavras_chave}`,
      );
      const matchesSearch =
        !state.search || haystack.includes(normalize(state.search));
      const matchesFilter =
        state.filter === "todos" ||
        [item.materia, item.genero, item.categoria].some(
          (value) => normalize(value) === normalize(state.filter),
        );
      return matchesSearch && matchesFilter;
    });

  const renderPhysical = () => {
    const items = filtered(state.physical);
    $("[data-result-count]").textContent =
      `${items.length} ${items.length === 1 ? "título" : "títulos"}`;
    $("[data-catalog]").innerHTML = items.length
      ? items
          .map((book) => {
            const request = activeRequest(book.id);
            const available = Number(book.quantidade_disponivel || 0);
            return `<article class="book-card">${cover(book, "physical")}<div class="card-body"><span class="subject-tag">${escapeHTML(book.genero || book.categoria || "Acervo")}</span><h3>${escapeHTML(book.titulo)}</h3><p>${escapeHTML(book.autor || "Autor não informado")}</p><div class="availability"><span class="material-symbols-outlined">${request ? "receipt_long" : available ? "check_circle" : "hourglass_empty"}</span>${request ? escapeHTML(statusInfo(request.status)[0]) : available ? `${available} disponível(is)` : "Sem exemplar disponível"}</div><button type="button" data-item-id="${escapeHTML(book.id)}" data-kind="physical">${request ? "Acompanhar pedido" : "Ver e solicitar"}<span class="material-symbols-outlined">arrow_forward</span></button></div></article>`;
          })
          .join("")
      : '<div class="empty-state"><span class="material-symbols-outlined">search_off</span><strong>Nenhum livro encontrado</strong><p>Tente buscar com outros termos.</p></div>';
  };
  const renderDigital = () => {
    const items = filtered(state.digital);
    $("[data-result-count]").textContent =
      `${items.length} ${items.length === 1 ? "PDF" : "PDFs"}`;
    $("[data-catalog]").innerHTML = items.length
      ? items
          .map(
            (item) =>
              `<article class="book-card">${cover(item, "digital")}<div class="card-body"><span class="subject-tag verified"><span class="material-symbols-outlined">verified</span>${escapeHTML(item.materia || item.categoria || "PDF")}</span><h3>${escapeHTML(item.titulo)}</h3><p>${escapeHTML(item.autor || "OminiSaber")}</p><div class="availability safe"><span class="material-symbols-outlined">shield_lock</span>Arquivo conferido pela biblioteca</div><button type="button" data-item-id="${escapeHTML(item.id)}" data-kind="digital">Detalhes e download<span class="material-symbols-outlined">download</span></button></div></article>`,
          )
          .join("")
      : '<div class="empty-state"><span class="material-symbols-outlined">folder_off</span><strong>Nenhum PDF publicado</strong><p>Apenas arquivos verificados aparecem para alunos.</p></div>';
  };
  const renderRequests = () => {
    const items = state.requests.filter((request) => {
      const info = `${request.livros?.titulo} ${request.livros?.autor} ${request.status}`;
      return !state.search || normalize(info).includes(normalize(state.search));
    });
    $("[data-result-count]").textContent =
      `${items.length} ${items.length === 1 ? "pedido" : "pedidos"}`;
    $("[data-catalog]").innerHTML = items.length
      ? `<div class="request-list">${items
          .map((request) => {
            const info = statusInfo(request.status);
            return `<article class="request-card"><span class="request-icon material-symbols-outlined">${info[2]}</span><div><span class="request-status ${escapeHTML(request.status)}">${escapeHTML(info[0])}</span><h3>${escapeHTML(request.livros?.titulo || "Livro")}</h3><p>${escapeHTML(info[1])}</p>${request.observacao ? `<small>${escapeHTML(request.observacao)}</small>` : ""}</div><div class="request-date"><span>${request.status === "emprestado" ? "Devolver até" : "Solicitado em"}</span><strong>${formatDate(request.status === "emprestado" ? request.devolucao_prevista_em : request.solicitado_em)}</strong></div></article>`;
          })
          .join("")}</div>`
      : '<div class="empty-state"><span class="material-symbols-outlined">receipt_long</span><strong>Você ainda não fez pedidos</strong><p>Abra “Livros físicos” para solicitar um exemplar.</p></div>';
  };
  const render = () => {
    const metadata = {
      fisico: [
        "ACERVO FÍSICO",
        "Livros para solicitar",
        "A bibliotecária separa um exemplar e avisa quando estiver pronto.",
      ],
      digital: [
        "ACERVO DIGITAL",
        "PDFs seguros para baixar",
        "Somente materiais verificados e publicados pela biblioteca.",
      ],
      pedidos: [
        "ACOMPANHAMENTO",
        "Meus pedidos",
        "Veja quando o livro for separado e estiver pronto para retirada.",
      ],
    }[state.mode];
    $("[data-section-eyebrow]").textContent = metadata[0];
    $("[data-section-title]").textContent = metadata[1];
    $("[data-section-description]").textContent = metadata[2];
    $("[data-safe-note]").hidden = state.mode !== "digital";
    $("[data-filters]").hidden = state.mode === "pedidos";
    if (state.mode === "fisico") renderPhysical();
    else if (state.mode === "digital") renderDigital();
    else renderRequests();
    document
      .querySelectorAll("[data-item-id]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          openItem(button.dataset.kind, button.dataset.itemId),
        ),
      );
  };
  const openItem = (kind, id) => {
    const item = (kind === "digital" ? state.digital : state.physical).find(
      (entry) => String(entry.id) === String(id),
    );
    if (!item) return;
    state.selected = { kind, item };
    $("[data-dialog-cover]").innerHTML = cover(item, kind);
    $("[data-dialog-subject]").textContent =
      item.materia || item.genero || item.categoria || "Acervo";
    $("[data-dialog-title]").textContent = item.titulo;
    $("[data-dialog-author]").textContent = item.autor || "Autor não informado";
    $("[data-dialog-synopsis]").textContent =
      item.descricao || item.sinopse || "Descrição ainda não cadastrada.";
    $("[data-fact-one]").textContent = item.paginas
      ? `${item.paginas} páginas`
      : "Não informado";
    const button = $("[data-primary-action]");
    const label = $("[data-action-label]");
    const icon = $("[data-action-icon]");
    button.disabled = false;
    if (kind === "digital") {
      $("[data-fact-two-label]").textContent = "Segurança";
      $("[data-fact-two]").textContent = "PDF verificado";
      $("[data-dialog-guidance]").innerHTML =
        '<span class="material-symbols-outlined">verified_user</span><p>O arquivo será baixado pelo armazenamento protegido do OminiSaber. Nenhuma página externa será aberta.</p>';
      label.textContent = "Baixar PDF";
      icon.textContent = "download";
    } else {
      const request = activeRequest(item.id);
      const available = Number(item.quantidade_disponivel || 0);
      $("[data-fact-two-label]").textContent = "Disponibilidade";
      $("[data-fact-two]").textContent = `${available} exemplar(es)`;
      $("[data-dialog-guidance]").innerHTML = request
        ? `<span class="material-symbols-outlined">${statusInfo(request.status)[2]}</span><p>${escapeHTML(statusInfo(request.status)[1])}</p>`
        : '<span class="material-symbols-outlined">info</span><p>Solicitar não inicia uma leitura: a biblioteca receberá o pedido e separará um exemplar físico para retirada.</p>';
      label.textContent = request
        ? statusInfo(request.status)[0]
        : available
          ? "Solicitar livro"
          : "Indisponível";
      icon.textContent = request
        ? statusInfo(request.status)[2]
        : "bookmark_add";
      button.disabled = Boolean(request) || !available;
    }
    $("[data-dialog]").showModal();
  };
  const requestBook = async (book) => {
    const rpc = await api().client.rpc("biblioteca_solicitar_livro", {
      p_livro_id: book.id,
    });
    if (rpc.error?.code === "PGRST202" || rpc.error?.code === "42883") {
      const session = await api().getSession();
      const legacy = await api()
        .client.from("solicitacoes_emprestimo")
        .insert({
          livro_id: book.id,
          aluno_id: session.user.id,
          status: "pendente",
        })
        .select()
        .single();
      if (legacy.error) throw legacy.error;
    } else if (rpc.error) throw rpc.error;
    toast(
      "Pedido enviado. A biblioteca já pode separar seu exemplar.",
      "success",
    );
  };
  const downloadPdf = async (material) => {
    const { data, error } = await api()
      .client.storage.from(material.storage_bucket || "biblioteca-pdfs")
      .download(material.storage_path);
    if (error) throw error;
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = material.nome_arquivo || `${material.titulo}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Download do PDF iniciado.", "success");
  };
  const primaryAction = async () => {
    if (state.busy || !state.selected) return;
    state.busy = true;
    const button = $("[data-primary-action]");
    button.disabled = true;
    try {
      if (state.selected.kind === "digital")
        await downloadPdf(state.selected.item);
      else await requestBook(state.selected.item);
      $("[data-dialog]").close();
      await loadData();
    } catch (error) {
      toast(error.message || "Não foi possível concluir agora.", "error");
    } finally {
      state.busy = false;
      button.disabled = false;
    }
  };
  const loadData = async () => {
    if (!api()?.configured) throw new Error("Supabase não configurado.");
    const session = await api().getSession();
    if (!session) throw new Error("Sessão expirada.");
    const [booksResult, digitalResult, requestsResult, profile] =
      await Promise.all([
        api()
          .client.from("livros")
          .select(
            "id,titulo,autor,genero,categoria,capa_url,sinopse,paginas,palavras_chave,quantidade_total,quantidade_disponivel",
          )
          .order("titulo"),
        api()
          .client.from("materiais_biblioteca")
          .select("*")
          .eq("publicado", true)
          .eq("verificado", true)
          .order("titulo"),
        api()
          .client.from("solicitacoes_emprestimo")
          .select("*,livros(id,titulo,autor)")
          .eq("aluno_id", session.user.id)
          .order("solicitado_em", { ascending: false }),
        api().getProfile(session.user.id),
      ]);
    if (booksResult.error) throw booksResult.error;
    if (requestsResult.error) throw requestsResult.error;
    state.physical = booksResult.data || [];
    state.digital = digitalResult.error ? [] : digitalResult.data || [];
    state.requests = requestsResult.data || [];
    $("[data-physical-count]").textContent = state.physical.length;
    $("[data-digital-count]").textContent = state.digital.length;
    $("[data-request-count]").textContent = state.requests.filter((item) =>
      ["pendente", "aprovado", "emprestado"].includes(item.status),
    ).length;
    $("[data-initials]").textContent = String(profile?.nome || "Aluno")
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
    render();
  };
  document.querySelectorAll("[data-mode]").forEach((button) =>
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      document
        .querySelectorAll("[data-mode]")
        .forEach((item) => item.classList.toggle("is-active", item === button));
      render();
    }),
  );
  $("[data-search]").addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });
  document.querySelectorAll("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document
        .querySelectorAll("[data-filter]")
        .forEach((item) => item.classList.toggle("is-active", item === button));
      render();
    }),
  );
  document.querySelectorAll("[data-mode]").forEach((button) =>
    button.classList.toggle("is-active", button.dataset.mode === state.mode),
  );
  document.querySelectorAll("[data-filter]").forEach((button) =>
    button.classList.toggle("is-active", button.dataset.filter === state.filter),
  );
  $("[data-close-dialog]").addEventListener("click", () =>
    $("[data-dialog]").close(),
  );
  $("[data-primary-action]").addEventListener("click", primaryAction);
  let realtimeChannel;
  const init = () => {
    loadData().catch((error) => {
      toast(
        error.message || "Não foi possível carregar a biblioteca.",
        "error",
      );
      $("[data-catalog]").innerHTML =
        '<div class="empty-state"><span class="material-symbols-outlined">cloud_off</span><strong>Acervo indisponível</strong><p>Tente atualizar a página.</p></div>';
    });
    if (!realtimeChannel && api()?.client)
      realtimeChannel = api()
        .client.channel("biblioteca-aluno")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "solicitacoes_emprestimo" },
          () => loadData().catch(() => {}),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "livros" },
          () => loadData().catch(() => {}),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "materiais_biblioteca" },
          () => loadData().catch(() => {}),
        )
        .subscribe();
  };
  document.addEventListener("ominisaber:ready", init);
  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("beforeunload", () => {
    if (realtimeChannel) api()?.client.removeChannel(realtimeChannel);
  });
})();
