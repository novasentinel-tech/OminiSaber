(() => {
  const api = window.OminiSaber;
  const state = {
    authors: [],
    isbnValues: [],
    scanner: null,
    selectedAuthor: null,
  };
  const $ = (selector) => document.querySelector(selector);

  const toast = (message, type = "success") => {
    const element = $("[data-toast]");
    if (!element) return;
    element.textContent = message;
    element.className = `toast visible ${type}`;
    clearTimeout(element.timer);
    element.timer = setTimeout(() => {
      element.className = "toast";
    }, 4200);
  };

  const online = () => Boolean(api?.configured && api.client);
  const normalize = (value) =>
    String(value || "")
      .trim()
      .replace(/\s+/g, " ");
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

  const fetchAuthors = async (term = "") => {
    const query = normalize(term);
    if (!online()) throw new Error("O Supabase não está configurado.");
    let request = api.client
      .from("autores")
      .select("id, nome")
      .order("nome")
      .limit(30);
    if (query) request = request.ilike("nome", `%${query}%`);
    const { data, error } = await request;
    if (error) throw error;
    return data || [];
  };

  const renderAuthors = (authors) => {
    const target = $("[data-author-results]");
    if (!target) return;
    if (!authors.length) {
      target.innerHTML =
        '<p class="empty">Nenhum autor encontrado. Cadastre um novo autor abaixo.</p>';
      return;
    }
    target.innerHTML = authors
      .map(
        (author) =>
          `<button class="author-option" type="button" data-author-id="${escapeHtml(author.id)}" data-author-name="${escapeHtml(author.nome)}"><span>${escapeHtml(author.nome)}</span><span class="material-symbols-outlined">chevron_right</span></button>`,
      )
      .join("");
  };

  const selectAuthor = (author) => {
    state.selectedAuthor = author;
    $("[name=autor]").value = author.nome;
    $("[name=autor_id]").value = author.id;
    const prefix =
      Math.abs(
        [...author.nome].reduce((sum, char) => sum + char.charCodeAt(0), 0),
      ) % 10000;
    $("[name=prefixo]").value = String(prefix || 1).padStart(4, "0");
    $("[data-author-modal]").close();
    updatePreview();
  };

  const setupAuthors = () => {
    const modal = $("[data-author-modal]");
    const search = $("[data-author-search]");
    $("[data-author-open]").addEventListener("click", async () => {
      modal.showModal();
      search.value = "";
      renderAuthors([]);
    });
    $("[data-author-close]").addEventListener("click", () => modal.close());
    search.addEventListener("input", async () => {
      try {
        renderAuthors(await fetchAuthors(search.value));
      } catch (error) {
        toast(error.message || "Não foi possível buscar autores.", "error");
      }
    });
    $("[data-author-results]").addEventListener("click", (event) => {
      const option = event.target.closest("[data-author-id]");
      if (option)
        selectAuthor({
          id: option.dataset.authorId,
          nome: option.dataset.authorName,
        });
    });
    $("[data-new-author]").addEventListener("click", () => {
      modal.close();
      $("[data-new-author-modal]").showModal();
      $("[data-new-author-form] input").focus();
    });
    document
      .querySelectorAll("[data-new-author-close]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          $("[data-new-author-modal]").close(),
        ),
      );
    $("[data-new-author-form]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = normalize(new FormData(event.currentTarget).get("nome"));
      if (!name) return;
      try {
        if (!online()) throw new Error("O Supabase não está configurado.");
        const result = await api.client
          .from("autores")
          .insert({ nome: name })
          .select("id, nome")
          .single();
        if (result.error) throw result.error;
        const author = result.data;
        event.currentTarget.reset();
        $("[data-new-author-modal]").close();
        selectAuthor(author);
        toast("Autor cadastrado e selecionado.");
      } catch (error) {
        toast(
          error.message?.includes("duplicate")
            ? "Este autor já está cadastrado."
            : error.message || "Não foi possível cadastrar o autor.",
          "error",
        );
      }
    });
  };

  const serial = (prefix, index) =>
    `${String(prefix).replace(/\D/g, "").padStart(4, "0").slice(0, 4)}${String(index).padStart(4, "0")}`;
  const lastSurname = (author) =>
    normalize(author)
      .split(" ")
      .filter(Boolean)
      .pop()
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 3)
      .toUpperCase() || "AUT";
  const buildLabel = (number, author, isbn) =>
    `${number}-${lastSurname(author)}-${normalize(isbn) || "SEM-ISBN"}`;

  const updatePreview = () => {
    const quantity = Math.max(1, Number($("[name=quantidade]").value || 1));
    const prefix = $("[name=prefixo]").value;
    const author = $("[name=autor]").value || "o autor selecionado";
    $("[data-batch-preview]").innerHTML =
      `<span class="material-symbols-outlined">tag</span><span>${escapeHtml(serial(prefix, 1))} até ${escapeHtml(serial(prefix, quantity))} · etiqueta: ${escapeHtml(buildLabel(serial(prefix, 1), author, $("[name=isbn]").value))}</span>`;
    state.isbnValues = Array.from(
      { length: quantity },
      (_, index) => state.isbnValues[index] ?? $("[name=isbn]").value.trim(),
    );
  };

  const renderIsbnList = () => {
    const quantity = Math.max(1, Number($("[name=quantidade]").value || 1));
    state.isbnValues = Array.from(
      { length: quantity },
      (_, index) => state.isbnValues[index] ?? $("[name=isbn]").value.trim(),
    );
    $("[data-isbn-list]").innerHTML = state.isbnValues
      .map(
        (isbn, index) =>
          `<label class="isbn-row"><span>Exemplar ${String(index + 1).padStart(2, "0")}</span><input class="input" data-isbn-index="${index}" inputmode="numeric" maxlength="17" value="${escapeHtml(isbn)}" placeholder="ISBN específico" /></label>`,
      )
      .join("");
  };

  const setupIsbns = () => {
    const modal = $("[data-isbn-modal]");
    $("[data-isbn-open]").addEventListener("click", () => {
      updatePreview();
      renderIsbnList();
      modal.showModal();
    });
    $("[data-isbn-inline-open]").addEventListener("click", () => {
      updatePreview();
      renderIsbnList();
      modal.showModal();
    });
    document
      .querySelectorAll("[data-isbn-close]")
      .forEach((button) =>
        button.addEventListener("click", () => modal.close()),
      );
    $("[data-isbn-list]").addEventListener("input", (event) => {
      if (event.target.dataset.isbnIndex !== undefined)
        state.isbnValues[Number(event.target.dataset.isbnIndex)] =
          event.target.value;
    });
    $("[data-copy-isbn]").addEventListener("click", () => {
      const isbn = $("[name=isbn]").value.trim();
      state.isbnValues.fill(isbn);
      renderIsbnList();
    });
    $("[data-isbn-save]").addEventListener("click", () => {
      $("[name=isbn]").value = state.isbnValues[0] || "";
      modal.close();
      toast("ISBNs revisados para este lote.", "info");
    });
    $("[data-scan-isbn]").addEventListener("click", () => {
      $("[data-scanner-modal]").showModal();
    });
  };

  const stopScanner = async () => {
    if (state.scanner) {
      await state.scanner.stop().catch(() => {});
      state.scanner.clear().catch(() => {});
      state.scanner = null;
    }
  };
  const setupScanner = () => {
    const modal = $("[data-scanner-modal]");
    $("[data-scanner-close]").addEventListener("click", async () => {
      await stopScanner();
      modal.close();
    });
    $("[data-scanner-start]").addEventListener("click", async () => {
      if (!window.Html5Qrcode)
        return toast(
          "Leitor de câmera indisponível. Digite o ISBN manualmente.",
          "error",
        );
      await stopScanner();
      state.scanner = new Html5Qrcode("isbn-reader");
      try {
        await state.scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 120 } },
          async (value) => {
            const isbn = value.replace(/\D/g, "");
            if (!isbn) return;
            const emptyIndex = state.isbnValues.findIndex((item) => !item);
            const index = emptyIndex >= 0 ? emptyIndex : 0;
            state.isbnValues[index] = isbn;
            renderIsbnList();
            await stopScanner();
            modal.close();
            $("[data-isbn-modal]").showModal();
            renderIsbnList();
            toast("ISBN lido com sucesso.");
          },
          () => {},
        );
        $("[data-scanner-status]").textContent =
          "Câmera ativa. Aponte para o código de barras.";
      } catch {
        toast(
          "Não foi possível acessar a câmera. Verifique a permissão do dispositivo.",
          "error",
        );
      }
    });
  };

  const submitBatch = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const quantity = Number(values.quantidade);
    if (
      !values.titulo.trim() ||
      !values.autor_id ||
      !values.genero ||
      !quantity ||
      quantity < 1
    )
      return toast("Preencha título, autor, gênero e quantidade.", "error");
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      updatePreview();
      const isbns = state.isbnValues
        .slice(0, quantity)
        .map((isbn) => isbn?.replace(/\D/g, "") || null);
      if (!online()) throw new Error("O Supabase não está configurado.");
      const response = await api.client.rpc(
        "biblioteca_cadastrar_lote_livros",
        {
          p_titulo: values.titulo.trim(),
          p_autor_id: values.autor_id,
          p_genero: values.genero,
          p_isbn: values.isbn.replace(/\D/g, "") || null,
          p_prefixo: values.prefixo,
          p_isbns: isbns,
        },
      );
      if (response.error) throw response.error;
      const result = response.data;
      toast(
        `${result.quantidade || quantity} exemplar(es) cadastrado(s) com sucesso.`,
      );
      form.reset();
      $("[name=quantidade]").value = 1;
      state.isbnValues = [];
      state.selectedAuthor = null;
      updatePreview();
    } catch (error) {
      toast(error.message || "Não foi possível cadastrar o lote.", "error");
    } finally {
      button.disabled = false;
    }
  };

  const initialize = () => {
    setupAuthors();
    setupIsbns();
    setupScanner();
    const form = $("[data-book-form]");
    form.addEventListener("submit", submitBatch);
    form.addEventListener("input", (event) => {
      if (["quantidade", "prefixo", "isbn"].includes(event.target.name))
        updatePreview();
    });
    updatePreview();
  };
  document.addEventListener("DOMContentLoaded", initialize);
  window.OminiSaberEstoque = { serial, buildLabel };
})();
