(() => {
  const api = window.OminiSaber;
  const state = {
    sections: [],
    copies: [],
    books: [],
    selectedSection: null,
    scanner: null,
  };
  const $ = (selector) => document.querySelector(selector);
  const online = () => Boolean(api?.configured && api.client);
  const escapeHtml = (value) =>
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
  const toast = (message, type = "success") => {
    const element = $("[data-toast]");
    element.textContent = message;
    element.className = `toast visible ${type}`;
    clearTimeout(element.timer);
    element.timer = setTimeout(() => {
      element.className = "toast";
    }, 4200);
  };

  const loadData = async () => {
    if (!online()) return;
    const [sections, copies, books] = await Promise.all([
      api.client
        .from("secoes_fisicas")
        .select("id, nome, genero_associado, capacidade_maxima, ocupacao_atual")
        .order("nome"),
      api.client
        .from("exemplares")
        .select(
          "id, livro_id, numero_serie, isbn, isbn_individual, status, secao_fisica_id",
        )
        .is("secao_fisica_id", null)
        .order("numero_serie"),
      api.client.from("livros").select("id, titulo, autor, genero"),
    ]);
    if (sections.error || copies.error || books.error)
      throw sections.error || copies.error || books.error;
    state.sections = sections.data || [];
    state.copies = copies.data || [];
    state.books = books.data || [];
  };

  const renderSections = () => {
    const grid = $("[data-shelf-grid]");
    $("[data-section-count]").textContent =
      `${state.sections.length} seção${state.sections.length === 1 ? "" : "ões"}`;
    if (!state.sections.length) {
      grid.innerHTML =
        '<p class="empty">Nenhuma seção cadastrada. Crie a primeira estante acima.</p>';
      return;
    }
    grid.innerHTML = state.sections
      .map((section) => {
        const occupied = Number(section.ocupacao_atual) || 0;
        const capacity = Number(section.capacidade_maxima) || 1;
        const percentage = Math.min(
          100,
          Math.round((occupied / capacity) * 100),
        );
        const status =
          percentage >= 100 ? "full" : percentage >= 80 ? "near-full" : "";
        return `<article class="panel shelf-card ${status}"><div class="shelf-top"><div><h3 class="shelf-name">${escapeHtml(section.nome)}</h3><p class="genre">${escapeHtml(section.genero_associado || "Todos os gêneros")}</p></div><span class="material-symbols-outlined shelf-icon">shelves</span></div><div class="occupancy-line"><span>Ocupação</span><strong>${occupied}/${capacity} livros</strong></div><div class="bar" aria-label="${percentage}% ocupado"><div class="bar-fill" style="--occupancy: ${percentage}%"></div></div><p class="status-line"><span class="material-symbols-outlined">${percentage >= 100 ? "error" : percentage >= 80 ? "warning" : "check_circle"}</span>${percentage >= 100 ? "Estante lotada" : percentage >= 80 ? "Quase cheia" : "Espaço disponível"}</p><button class="button" type="button" data-allocate="${escapeHtml(section.id)}"><span class="material-symbols-outlined">drive_file_move</span>Alocar exemplares</button></article>`;
      })
      .join("");
  };

  const renderCopies = () => {
    const term = $("[data-copy-search]").value.toLowerCase().trim();
    const bookById = new Map(state.books.map((book) => [book.id, book]));
    const copies = state.copies.filter((copy) => {
      const book = bookById.get(copy.livro_id);
      return `${copy.numero_serie} ${copy.isbn || copy.isbn_individual || ""} ${book?.titulo || ""}`
        .toLowerCase()
        .includes(term);
    });
    const list = $("[data-copy-list]");
    list.innerHTML = copies.length
      ? copies
          .map((copy) => {
            const book = bookById.get(copy.livro_id) || {};
            return `<label class="copy-option"><input type="checkbox" value="${escapeHtml(copy.id)}" data-copy-check><span class="copy-info"><strong>${escapeHtml(copy.numero_serie)}</strong><small>${escapeHtml(book.titulo || "Obra não encontrada")} · ${escapeHtml(copy.isbn || copy.isbn_individual || "ISBN não informado")}</small></span></label>`;
          })
          .join("")
      : '<p class="empty">Nenhum exemplar sem localização encontrado.</p>';
    updateSelection();
  };

  const updateSelection = () => {
    const selected = document.querySelectorAll(
      "[data-copy-check]:checked",
    ).length;
    const capacity = Math.max(
      0,
      Number(state.selectedSection?.capacidade_maxima || 0) -
        Number(state.selectedSection?.ocupacao_atual || 0),
    );
    $("[data-selected-count]").textContent = selected;
    $("[data-available-capacity]").textContent = capacity;
    const warning = $("[data-allocation-warning]");
    const invalid = selected > capacity;
    warning.hidden = !invalid;
    warning.textContent = invalid
      ? `Você selecionou ${selected} exemplares, mas só há espaço para ${capacity}. Remova ${selected - capacity} seleção(ões) para continuar.`
      : "";
    $("[data-allocation-save]").disabled = invalid || selected === 0;
  };

  const openAllocation = (sectionId) => {
    state.selectedSection = state.sections.find(
      (section) => section.id === sectionId,
    );
    $("[data-allocation-section]").textContent = state.selectedSection.nome;
    $("[data-copy-search]").value = "";
    renderCopies();
    $("[data-allocation-modal]").showModal();
  };
  const setupSections = () => {
    $("[data-shelf-grid]").addEventListener("click", (event) => {
      const button = event.target.closest("[data-allocate]");
      if (button) openAllocation(button.dataset.allocate);
    });
    $("[data-section-form]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const button = event.currentTarget.querySelector("[type=submit]");
      button.disabled = true;
      try {
        if (!online())
          throw new Error("Configure o Supabase para salvar uma seção.");
        const result = await api.client
          .from("secoes_fisicas")
          .insert({
            nome: values.nome.trim(),
            genero_associado: values.genero_associado,
            capacidade_maxima: Number(values.capacidade_maxima),
            ocupacao_atual: 0,
          })
          .select()
          .single();
        if (result.error) throw result.error;
        state.sections.push(result.data);
        event.currentTarget.reset();
        renderSections();
        toast("Seção criada com sucesso.");
      } catch (error) {
        toast(error.message || "Não foi possível criar a seção.", "error");
      } finally {
        button.disabled = false;
      }
    });
  };

  const saveAllocation = async () => {
    const ids = [...document.querySelectorAll("[data-copy-check]:checked")].map(
      (input) => input.value,
    );
    if (
      ids.length >
      Number(state.selectedSection.capacidade_maxima) -
        Number(state.selectedSection.ocupacao_atual)
    )
      return updateSelection();
    try {
      if (!online())
        throw new Error("Configure o Supabase para alocar exemplares.");
      const result = await api.client.rpc("biblioteca_alocar_exemplares", {
        p_secao_fisica_id: state.selectedSection.id,
        p_exemplar_ids: ids,
      });
      if (result.error) throw result.error;
      const allocated = new Set(ids);
      state.copies = state.copies.filter((copy) => !allocated.has(copy.id));
      state.selectedSection.ocupacao_atual =
        Number(state.selectedSection.ocupacao_atual || 0) + ids.length;
      $("[data-allocation-modal]").close();
      renderSections();
      toast(`${ids.length} exemplar(es) alocado(s) com sucesso.`);
    } catch (error) {
      toast(error.message || "Não foi possível alocar os exemplares.", "error");
    }
  };

  const stopScanner = async () => {
    if (state.scanner) {
      await state.scanner.stop().catch(() => {});
      state.scanner.clear().catch(() => {});
      state.scanner = null;
    }
  };
  const setupAllocation = () => {
    const allocation = $("[data-allocation-modal]");
    document
      .querySelectorAll("[data-allocation-close]")
      .forEach((button) =>
        button.addEventListener("click", () => allocation.close()),
      );
    $("[data-copy-search]").addEventListener("input", renderCopies);
    $("[data-copy-list]").addEventListener("change", updateSelection);
    $("[data-allocation-save]").addEventListener("click", saveAllocation);
    $("[data-allocation-scan]").addEventListener("click", () =>
      $("[data-scanner-modal]").showModal(),
    );
  };
  const setupScanner = () => {
    const modal = $("[data-scanner-modal]");
    $("[data-scanner-close]").addEventListener("click", async () => {
      await stopScanner();
      modal.close();
    });
    $("[data-scanner-start]").addEventListener("click", async () => {
      if (!window.Html5Qrcode)
        return toast("Leitor de câmera indisponível.", "error");
      await stopScanner();
      state.scanner = new Html5Qrcode("allocation-reader");
      try {
        await state.scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 120 } },
          async (value) => {
            const serial = value.match(/\b\d{8}\b/)?.[0] || value.split("-")[0];
            const input = [
              ...document.querySelectorAll("[data-copy-check]"),
            ].find((candidate) => {
              const label = candidate.closest(".copy-option");
              return label?.textContent.includes(serial);
            });
            if (input) {
              input.checked = true;
              updateSelection();
              toast("Exemplar selecionado pela etiqueta.");
            } else
              toast(
                "Etiqueta não encontrada entre os exemplares sem localização.",
                "error",
              );
            await stopScanner();
            modal.close();
          },
          () => {},
        );
        $("[data-scanner-status]").textContent =
          "Câmera ativa. Aponte para a etiqueta.";
      } catch {
        toast("Não foi possível acessar a câmera.", "error");
      }
    });
  };

  const initialize = async () => {
    setupSections();
    setupAllocation();
    setupScanner();
    try {
      await loadData();
      renderSections();
    } catch (error) {
      renderSections();
      toast(error.message || "Não foi possível carregar as seções.", "error");
    }
  };
  document.addEventListener("DOMContentLoaded", initialize);
  window.OminiSaberSecoes = { updateSelection };
})();
