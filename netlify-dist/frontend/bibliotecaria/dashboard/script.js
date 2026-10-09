(() => {
  const api = () => window.OminiSaber;
  const $ = (selector) => document.querySelector(selector);
  const escape = (value) =>
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
  const toast = (message, type = "info") => {
    const node = $("[data-toast]");
    node.textContent = message;
    node.dataset.type = type;
    node.classList.add("visible");
    clearTimeout(node.timer);
    node.timer = setTimeout(() => node.classList.remove("visible"), 3400);
  };
  const relative = (value) => {
    const minutes = Math.max(
      0,
      Math.floor((Date.now() - new Date(value).getTime()) / 60000),
    );
    if (minutes < 60) return `Há ${minutes || 1} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Há ${hours}h`;
    return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
  };
  const statusPriority = (item) =>
    item.status === "emprestado" &&
    item.devolucao_prevista_em &&
    new Date(item.devolucao_prevista_em) < new Date()
      ? 0
      : item.status === "pendente"
        ? 1
        : item.status === "aprovado"
          ? 2
          : 9;
  const separate = async (id, button) => {
    button.disabled = true;
    button.textContent = "Separando...";
    const { error } = await api().client.rpc("biblioteca_separar_solicitacao", {
      p_solicitacao_id: id,
    });
    if (error) {
      button.disabled = false;
      button.textContent = "Separar agora";
      throw error;
    }
    toast("Exemplar separado e reservado para o aluno.", "success");
    await load();
  };
  const renderQueue = (requests) => {
    const term = $("[data-global-search]").value.trim().toLowerCase();
    const rows = requests
      .filter((item) =>
        ["pendente", "aprovado", "emprestado"].includes(item.status),
      )
      .filter((item) =>
        `${item.livros?.titulo} ${item.perfis?.nome} ${item.perfis?.turmas?.nome}`
          .toLowerCase()
          .includes(term),
      )
      .sort((a, b) => statusPriority(a) - statusPriority(b))
      .slice(0, 6);
    $("[data-queue]").innerHTML = rows.length
      ? rows
          .map((item) => {
            const overdue =
              item.status === "emprestado" &&
              item.devolucao_prevista_em &&
              new Date(item.devolucao_prevista_em) < new Date();
            const kind = overdue
              ? "overdue"
              : item.status === "pendente"
                ? "approval"
                : "pickup";
            const title = overdue
              ? "Devolução atrasada"
              : item.status === "pendente"
                ? "Novo pedido para separar"
                : "Exemplar pronto para retirada";
            const icon = overdue
              ? "priority_high"
              : item.status === "pendente"
                ? "inventory_2"
                : "move_to_inbox";
            const action =
              item.status === "pendente"
                ? `<button class="button secondary" data-separate="${item.id}">Separar agora</button>`
                : `<a class="button secondary" href="../gestao_emprestimos/index.html?aba=${item.status}">${overdue ? "Registrar devolução" : "Confirmar retirada"}</a>`;
            return `<article data-kind="${kind}"><span class="queue-icon ${overdue ? "danger" : ""} material-symbols-outlined">${icon}</span><div><strong>${title}</strong><p>${escape(item.livros?.titulo || "Livro")} · ${escape(item.perfis?.nome || "Aluno")} · ${escape(item.perfis?.turmas?.nome || "Sem turma")}</p></div><span class="queue-meta">${overdue ? `Venceu ${new Intl.DateTimeFormat("pt-BR").format(new Date(item.devolucao_prevista_em))}` : relative(item.solicitado_em)}</span>${action}</article>`;
          })
          .join("")
      : '<div class="empty"><span class="material-symbols-outlined">task_alt</span><strong>Fila resolvida</strong><p>Nenhuma prioridade encontrada agora.</p></div>';
  };
  const renderChart = (requests) => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    const values = days.map((day) => {
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      return {
        label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
          .format(day)
          .replace(".", ""),
        loans: requests.filter(
          (x) =>
            x.retirada_em &&
            new Date(x.retirada_em) >= day &&
            new Date(x.retirada_em) < next,
        ).length,
        returns: requests.filter(
          (x) =>
            x.devolvido_em &&
            new Date(x.devolvido_em) >= day &&
            new Date(x.devolvido_em) < next,
        ).length,
      };
    });
    const max = Math.max(1, ...values.flatMap((x) => [x.loans, x.returns]));
    $("[data-chart]").innerHTML = values
      .map(
        (x) =>
          `<span><i style="--loan:${Math.round((x.loans / max) * 100)}%;--return:${Math.round((x.returns / max) * 100)}%" title="${x.loans} empréstimos e ${x.returns} devoluções"></i><small>${x.label}</small></span>`,
      )
      .join("");
    const total = values.reduce((sum, x) => sum + x.loans + x.returns, 0);
    $("[data-trend]").textContent = total
      ? `${total} movimentações registradas`
      : "Sem movimentação";
  };
  let lastRequests = [];
  const load = async () => {
    if (!api()?.configured) throw new Error("Supabase não configurado.");
    const [profile, booksResult, requestsResult] = await Promise.all([
      api().getProfile(),
      api().client.from("livros").select("quantidade_disponivel"),
      api()
        .client.from("solicitacoes_emprestimo")
        .select(
          "*,livros(titulo,autor),perfis!solicitacoes_emprestimo_aluno_id_fkey(nome,turmas(nome))",
        )
        .order("solicitado_em", { ascending: false }),
    ]);
    if (booksResult.error || requestsResult.error)
      throw booksResult.error || requestsResult.error;
    const books = booksResult.data || [];
    lastRequests = requestsResult.data || [];
    $("[data-greeting]").textContent =
      `Olá, ${String(profile?.nome || "bibliotecária").split(" ")[0]}`;
    $("[data-pending]").textContent = lastRequests.filter(
      (x) => x.status === "pendente",
    ).length;
    $("[data-pickup]").textContent = lastRequests.filter(
      (x) => x.status === "aprovado",
    ).length;
    $("[data-overdue]").textContent = lastRequests.filter(
      (x) =>
        x.status === "emprestado" &&
        x.devolucao_prevista_em &&
        new Date(x.devolucao_prevista_em) < new Date(),
    ).length;
    $("[data-available]").textContent = books.reduce(
      (sum, x) => sum + Number(x.quantidade_disponivel || 0),
      0,
    );
    renderQueue(lastRequests);
    renderChart(lastRequests);
  };
  let realtimeChannel;
  const subscribe = () => {
    if (realtimeChannel || !api()?.client) return;
    realtimeChannel = api()
      .client.channel("biblioteca-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitacoes_emprestimo" },
        () => load().catch(() => {}),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "livros" },
        () => load().catch(() => {}),
      )
      .subscribe();
  };
  $("[data-queue]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-separate]");
    if (button)
      separate(button.dataset.separate, button).catch((error) =>
        toast(error.message || "Não foi possível separar.", "error"),
      );
  });
  $("[data-global-search]").addEventListener("input", () =>
    renderQueue(lastRequests),
  );
  $("[data-signout]").addEventListener("click", () => api()?.signOut());
  const init = () => {
    load().catch((error) =>
      toast(error.message || "Não foi possível carregar a operação.", "error"),
    );
    subscribe();
  };
  document.addEventListener("ominisaber:ready", init);
  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("beforeunload", () => {
    if (realtimeChannel) api()?.client.removeChannel(realtimeChannel);
  });
})();
