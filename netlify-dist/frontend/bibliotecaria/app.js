(() => {
  const api = window.OminiSaber;
  const toast = (message, type = "success") => {
    let element = document.querySelector("[data-toast]");
    if (!element) {
      element = document.createElement("div");
      element.dataset.toast = "";
      element.className = "toast";
      document.body.appendChild(element);
    }
    element.textContent = message;
    element.className = `toast visible ${type}`;
    window.clearTimeout(element.timer);
    element.timer = window.setTimeout(() => {
      element.className = "toast";
    }, 4500);
  };
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
  const date = (value) =>
    value
      ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
          new Date(value),
        )
      : "--";
  const getRequests = async (status) => {
    if (!api?.configured) throw new Error("O Supabase não está configurado.");
    let query = api.client
      .from("solicitacoes_emprestimo")
      .select(
        "*, livros(titulo, autor), exemplares(numero_serie,isbn_individual,secoes_fisicas!exemplares_secao_fisica_id_fkey(nome)), perfis!solicitacoes_emprestimo_aluno_id_fkey(nome, turma_id, turmas(nome))",
      )
      .order("created_at", { ascending: false });
    if (status && status !== "atrasado") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };
  const loadStats = async () => {
    if (!api?.configured) throw new Error("O Supabase não está configurado.");
    const [
      { data: books, error: bookError },
      { data: requests, error: requestError },
    ] = await Promise.all([
      api.client
        .from("livros")
        .select("quantidade_total, quantidade_disponivel"),
      api.client
        .from("solicitacoes_emprestimo")
        .select("status, devolucao_prevista_em"),
    ]);
    if (bookError) throw bookError;
    if (requestError) throw requestError;
    document.querySelector("[data-total]").textContent = books.reduce(
      (sum, item) => sum + item.quantidade_total,
      0,
    );
    document.querySelector("[data-available]").textContent = books.reduce(
      (sum, item) => sum + item.quantidade_disponivel,
      0,
    );
    document.querySelector("[data-pending]").textContent = requests.filter(
      (item) => item.status === "pendente",
    ).length;
    document.querySelector("[data-overdue]").textContent = requests.filter(
      (item) =>
        item.status === "emprestado" &&
        new Date(item.devolucao_prevista_em) < new Date(),
    ).length;
  };
  const action = async (rpc, id, extra = {}) => {
    if (!api?.configured) throw new Error("O Supabase não está configurado.");
    const args =
      rpc === "biblioteca_recusar_solicitacao"
        ? { p_solicitacao_id: id, p_motivo: extra.motivo }
        : { p_solicitacao_id: id };
    const { error } = await api.client.rpc(rpc, args);
    if (error) throw error;
    toast("Operação concluída com sucesso.");
    window.dispatchEvent(new CustomEvent("library:refresh"));
  };
  const renderRequests = async (target, status, search = "") => {
    const requests = await getRequests(status);
    const term = search.toLowerCase().trim();
    const filtered = requests.filter((item) => {
      const matchesStatus =
        status !== "atrasado" ||
        (item.status === "emprestado" &&
          new Date(item.devolucao_prevista_em) < new Date());
      return (
        matchesStatus &&
        `${item.perfis?.nome} ${item.perfis?.turmas?.nome} ${item.livros?.titulo}`
          .toLowerCase()
          .includes(term)
      );
    });
    target.innerHTML = filtered.length
      ? filtered
          .map((item) => {
            const overdue =
              item.status === "emprestado" &&
              new Date(item.devolucao_prevista_em) < new Date();
            const label =
              item.status === "pendente"
                ? "Pendente"
                : item.status === "aprovado"
                  ? "Aguardando retirada"
                  : item.status === "emprestado"
                    ? overdue
                      ? "Atrasado"
                      : "Ativo"
                    : "Devolvido";
            const statusClass = overdue
              ? "danger"
              : item.status === "pendente"
                ? "warning"
                : "";
            const button =
              item.status === "pendente"
                ? `<div class="row-actions"><button class="button secondary" data-action="separate" data-id="${item.id}"><span class="material-symbols-outlined">inventory_2</span>Separar</button><button class="button danger icon-only" data-reject-open="${item.id}" aria-label="Recusar solicitação"><span class="material-symbols-outlined">close</span></button></div>`
                : item.status === "aprovado"
                  ? `<button class="button" data-action="deliver" data-id="${item.id}">Confirmar entrega</button>`
                  : item.status === "emprestado"
                    ? `<button class="button danger" data-action="return" data-id="${item.id}">Dar baixa / devolver</button>`
                    : "";
            const copy = item.exemplares;
            const location =
              copy?.secoes_fisicas?.nome ||
              item.observacao ||
              "Localização pendente";
            return `<tr><td data-label="Aluno / turma"><strong>${escape(item.perfis?.nome)}</strong><small>${escape(item.perfis?.turmas?.nome || "Turma não informada")}</small></td><td data-label="Livro"><strong>${escape(item.livros?.titulo)}</strong><small>${escape(item.livros?.autor)}</small>${copy ? `<small>Exemplar ${escape(copy.numero_serie)} · ${escape(location)}</small>` : ""}</td><td data-label="Status / prazo"><span class="badge ${statusClass}">${label}</span><small>${item.status === "emprestado" ? `Até ${date(item.devolucao_prevista_em)}` : date(item.solicitado_em)}</small></td><td data-label="Ação">${button}</td></tr>`;
          })
          .join("")
      : '<tr><td colspan="4" class="empty">Nenhum registro encontrado.</td></tr>';
  };
  const bindActions = (root) =>
    root.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      button.disabled = true;
      const rpc = {
        separate: "biblioteca_separar_solicitacao",
        deliver: "biblioteca_confirmar_entrega",
        return: "biblioteca_registrar_devolucao",
      }[button.dataset.action];
      try {
        await action(rpc, button.dataset.id);
      } catch (error) {
        toast(error.message, "error");
        button.disabled = false;
      }
    });
  const setupManagement = () => {
    const table = document.querySelector("[data-requests]");
    if (!table) return;
    const allowedTabs = [
      "pendente",
      "aprovado",
      "emprestado",
      "atrasado",
      "devolvido",
    ];
    let current = new URLSearchParams(location.search).get("aba") || "pendente";
    if (!allowedTabs.includes(current)) current = "pendente";
    const search = document.querySelector("[data-search]");
    const render = () =>
      renderRequests(table, current, search.value).catch((error) =>
        toast(error.message, "error"),
      );
    document.querySelectorAll("[data-tab]").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === current);
      tab.addEventListener("click", () => {
        current = tab.dataset.tab;
        document
          .querySelectorAll("[data-tab]")
          .forEach((item) => item.classList.toggle("active", item === tab));
        render();
      });
    });
    search.addEventListener("input", render);
    bindActions(table);
    const rejectDialog = document.querySelector("[data-reject-dialog]");
    const rejectForm = document.querySelector("[data-reject-form]");
    table.addEventListener("click", (event) => {
      const button = event.target.closest("[data-reject-open]");
      if (!button) return;
      rejectForm.elements.solicitacao_id.value = button.dataset.rejectOpen;
      rejectForm.elements.motivo.value = "";
      rejectDialog.showModal();
      rejectForm.elements.motivo.focus();
    });
    document
      .querySelectorAll("[data-reject-close]")
      .forEach((button) =>
        button.addEventListener("click", () => rejectDialog.close()),
      );
    rejectForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = rejectForm.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await action(
          "biblioteca_recusar_solicitacao",
          rejectForm.elements.solicitacao_id.value,
          { motivo: rejectForm.elements.motivo.value.trim() },
        );
        rejectDialog.close();
      } catch (error) {
        toast(error.message, "error");
      } finally {
        button.disabled = false;
      }
    });
    window.addEventListener("library:refresh", render);
    const channel = api.client
      .channel("biblioteca-circulacao")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitacoes_emprestimo" },
        render,
      )
      .subscribe();
    window.addEventListener(
      "beforeunload",
      () => api.client.removeChannel(channel),
      { once: true },
    );
    render();
  };
  const setupInventory = () => {
    const form = document.querySelector("[data-book-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button");
      button.disabled = true;
      const values = Object.fromEntries(new FormData(form));
      const total = Number(values.quantidade_total);
      try {
        const { error } = await api.client.from("livros").insert({
          titulo: values.titulo.trim(),
          autor: values.autor.trim(),
          isbn: values.isbn.trim() || null,
          materia: values.materia.trim() || "Geral",
          capa_url: values.capa_url.trim() || null,
          quantidade_total: total,
          quantidade_disponivel: total,
        });
        if (error) throw error;
        form.reset();
        toast("Título cadastrado no acervo.");
      } catch (error) {
        toast(error.message, "error");
      } finally {
        button.disabled = false;
      }
    });
  };
  const setupSettings = () => {
    const form = document.querySelector("[data-library-settings]");
    if (!form) return;
    if (!api?.configured)
      return toast("O Supabase não está configurado.", "error");
    const renderPreview = () => {
      const days = Number(form.prazo_dias.value || 15);
      const limit = Number(form.limite_livros.value || 1);
      const daysTarget = document.querySelector("[data-rules-days]");
      const limitTarget = document.querySelector("[data-rules-limit]");
      if (daysTarget) daysTarget.textContent = `${days} dias`;
      if (limitTarget)
        limitTarget.textContent = `${limit} ${limit === 1 ? "livro" : "livros"}`;
    };
    form.addEventListener("change", renderPreview);
    renderPreview();
    api.client
      .from("configuracoes_biblioteca")
      .select("*")
      .eq("id", true)
      .single()
      .then(({ data }) => {
        if (data) {
          form.prazo_dias.value = data.prazo_dias;
          form.limite_livros.value = data.limite_livros;
          renderPreview();
        }
      });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("[data-settings-save]");
      button.disabled = true;
      const { error } = await api.client
        .from("configuracoes_biblioteca")
        .update({
          prazo_dias: Number(form.prazo_dias.value),
          limite_livros: Number(form.limite_livros.value),
        })
        .eq("id", true);
      if (error) toast(error.message, "error");
      else toast("Regras da biblioteca atualizadas.");
      button.disabled = false;
    });
  };
  const initialize = () => {
    loadStats().catch((error) => toast(error.message, "error"));
    setupManagement();
    setupInventory();
    setupSettings();
  };
  document.addEventListener("ominisaber:ready", initialize);
  if (!api?.configured) initialize();
  document
    .querySelector("[data-signout]")
    ?.addEventListener("click", () => api.signOut());
})();
