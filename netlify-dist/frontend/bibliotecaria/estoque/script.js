(() => {
  const api = window.OminiSaber;
  const state = {
    books: [],
    sections: [],
    exemplares: [],
    materials: [],
    digitalReady: true,
    scannedIsbns: [],
    stream: null,
    detector: null,
    scanning: false,
    initialized: false,
  };
  const $ = (selector) => document.querySelector(selector);

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

  const setText = (selector, value) => {
    const element = $(selector);
    if (element) element.textContent = value;
  };

  const showToast = (message, type = "success") => {
    const element = $("[data-toast]");
    if (!element) return;
    element.textContent = message;
    element.className = `toast visible ${type}`;
    window.clearTimeout(element.timer);
    element.timer = window.setTimeout(() => {
      element.className = "toast";
    }, 4500);
  };

  const isOnline = () => Boolean(api?.configured && api.client);

  const loadData = async () => {
    if (!isOnline()) throw new Error("O Supabase não está configurado.");

    const [booksResult, sectionsResult, copiesResult, materialsResult] =
      await Promise.all([
        api.client
          .from("livros")
          .select("id, titulo, autor, genero, capa_url")
          .order("titulo"),
        api.client.from("secoes_fisicas").select("*").order("nome"),
        api.client
          .from("exemplares")
          .select(
            "id, livro_id, numero_serie, isbn_individual, secao_fisica_id, status",
          )
          .order("numero_serie"),
        api.client
          .from("materiais_biblioteca")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
    if (booksResult.error || sectionsResult.error || copiesResult.error) {
      throw booksResult.error || sectionsResult.error || copiesResult.error;
    }
    state.books = booksResult.data || [];
    state.sections = sectionsResult.data || [];
    state.exemplares = copiesResult.data || [];
    state.digitalReady = !materialsResult.error;
    state.materials = materialsResult.data || [];
  };

  const renderMetrics = () => {
    setText("[data-book-count]", state.books.length);
    setText("[data-copy-count]", state.exemplares.length);
    setText("[data-section-count]", state.sections.length);
    setText(
      "[data-unassigned-count]",
      state.exemplares.filter((copy) => !copy.secao_fisica_id).length,
    );
  };

  const renderSections = () => {
    const target = $("[data-sections]");
    if (!target) return;
    if (!state.sections.length) {
      target.innerHTML = '<p class="empty">Nenhuma seção criada ainda.</p>';
      return;
    }
    target.innerHTML = state.sections
      .map((section) => {
        const used =
          Number(section.ocupacao_atual) ||
          state.exemplares.filter((copy) => copy.secao_fisica_id === section.id)
            .length;
        const capacity = Number(section.capacidade_maxima) || 1;
        const percentage = Math.min(100, Math.round((used / capacity) * 100));
        return `<div class="section-item">
        <strong>${escapeHtml(section.nome)}</strong>
        <span class="subject">${used}/${capacity}</span>
        <small>${escapeHtml(section.genero_associado || "Todos os gêneros")}</small>
        <div class="capacity"><span style="width: ${percentage}%"></span></div>
      </div>`;
      })
      .join("");
  };

  const renderCatalog = () => {
    const target = $("[data-catalog]");
    if (!target) return;
    const term = ($("[data-search]")?.value || "").toLowerCase().trim();
    const books = state.books.filter((book) =>
      `${book.titulo} ${book.autor} ${book.genero}`
        .toLowerCase()
        .includes(term),
    );
    if (!books.length) {
      target.innerHTML = '<p class="empty">Nenhum título encontrado.</p>';
      return;
    }
    target.innerHTML = books
      .map((book) => {
        const copies = state.exemplares.filter(
          (copy) => copy.livro_id === book.id,
        );
        const rows = copies.length
          ? copies
              .map((copy) => {
                const section = state.sections.find(
                  (item) => item.id === copy.secao_fisica_id,
                );
                const editable = ["disponivel", "manutencao"].includes(
                  copy.status,
                );
                const statusControl = editable
                  ? `<select class="status-select ${escapeHtml(copy.status)}" data-copy-status="${copy.id}" aria-label="Status do exemplar ${escapeHtml(copy.numero_serie)}"><option value="disponivel" ${copy.status === "disponivel" ? "selected" : ""}>Disponível</option><option value="manutencao" ${copy.status === "manutencao" ? "selected" : ""}>Manutenção</option></select>`
                  : `<span class="status ${escapeHtml(copy.status)}">${copy.status === "reservado" ? "reservado" : "emprestado"}</span>`;
                return `<tr>
          <td><strong>${escapeHtml(copy.numero_serie)}</strong></td>
          <td>${escapeHtml(copy.isbn_individual || "Aguardando leitura")}</td>
          <td>${statusControl}</td>
          <td>${escapeHtml(section?.nome || "Sem seção")}</td>
                  <td>${escapeHtml(section ? `Retirar na ${section.nome}` : "Atribuir uma seção")}</td>
        </tr>`;
              })
              .join("")
          : '<tr><td colspan="4">Nenhum exemplar físico cadastrado.</td></tr>';
        return `<article class="book-row">
        <div class="book-summary" data-expand>
          <div><strong>${escapeHtml(book.titulo)}</strong><small>Gênero: ${escapeHtml(book.genero || "Não informado")} · ${copies.length} exemplar(es)</small></div>
          <span class="subject">${escapeHtml(book.genero || "Não informado")}</span>
          <span class="material-symbols-outlined">chevron_right</span>
        </div>
        <div class="book-details"><table class="copy-table"><thead><tr><th>Série</th><th>ISBN individual</th><th>Status</th><th>Localização</th></tr></thead><tbody>${rows}</tbody></table></div>
      </article>`;
      })
      .join("");
  };

  const render = () => {
    renderMetrics();
    renderSections();
    renderCatalog();
    renderDigital();
  };

  const fileSize = (bytes) => {
    if (!bytes) return "Tamanho não informado";
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const renderDigital = () => {
    const target = $("[data-digital-list]");
    const warning = $("[data-digital-warning]");
    if (!target) return;
    warning.hidden = state.digitalReady;
    $("[data-pdf-form-toggle]").disabled = !state.digitalReady;
    if (!state.digitalReady) {
      target.innerHTML =
        '<p class="empty">O acervo físico continua disponível. Instale a migração para publicar PDFs.</p>';
      return;
    }
    target.innerHTML = state.materials.length
      ? state.materials
          .map(
            (item) => `<article class="digital-row">
      <span class="pdf-icon material-symbols-outlined">picture_as_pdf</span>
      <div><span class="status ${item.publicado ? "disponivel" : "manutencao"}">${item.publicado ? "Publicado" : "Oculto"}</span><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.materia || item.categoria)} · ${fileSize(item.tamanho_bytes)} · ${item.verificado ? "Verificado" : "Pendente"}</small></div>
      <button class="button secondary" type="button" data-toggle-material="${item.id}" data-published="${String(item.publicado)}">${item.publicado ? "Ocultar" : "Publicar"}</button>
    </article>`,
          )
          .join("")
      : '<p class="empty">Nenhum PDF cadastrado ainda.</p>';
  };

  const isRealPdf = async (file) => {
    if (!file || file.size > 50 * 1024 * 1024) return false;
    const signature = new TextDecoder().decode(
      await file.slice(0, 5).arrayBuffer(),
    );
    return file.type === "application/pdf" && signature === "%PDF-";
  };

  const setupDigital = () => {
    const form = $("[data-pdf-form]");
    $("[data-pdf-form-toggle]")?.addEventListener("click", () => {
      form.hidden = false;
      form.querySelector("input")?.focus();
    });
    $("[data-pdf-form-cancel]")?.addEventListener("click", () => {
      form.hidden = true;
      form.reset();
    });
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      const file = form.elements.arquivo.files[0];
      const button = form.querySelector('button[type="submit"]');
      if (!(await isRealPdf(file)))
        return showToast("Selecione um PDF válido de até 50 MB.", "error");
      button.disabled = true;
      let path = null;
      try {
        const session = await api.getSession();
        if (!session) throw new Error("Sessão expirada.");
        const safeName = file.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "-")
          .toLowerCase();
        path = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
        const uploaded = await api.client.storage
          .from("biblioteca-pdfs")
          .upload(path, file, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (uploaded.error) throw uploaded.error;
        const now = new Date().toISOString();
        const inserted = await api.client
          .from("materiais_biblioteca")
          .insert({
            titulo: String(values.titulo).trim(),
            autor: String(values.autor || "").trim() || null,
            materia: values.materia,
            categoria: String(values.categoria || "Material de apoio").trim(),
            descricao: String(values.descricao || "").trim() || null,
            storage_bucket: "biblioteca-pdfs",
            storage_path: path,
            nome_arquivo: file.name,
            mime_type: "application/pdf",
            tamanho_bytes: file.size,
            verificado: true,
            verificado_por: session.user.id,
            verificado_em: now,
            publicado: true,
            criado_por: session.user.id,
          })
          .select()
          .single();
        if (inserted.error) throw inserted.error;
        state.materials.unshift(inserted.data);
        form.reset();
        form.hidden = true;
        renderDigital();
        showToast("PDF verificado e publicado para os alunos.");
      } catch (error) {
        if (path)
          await api.client.storage.from("biblioteca-pdfs").remove([path]);
        showToast(error.message || "Não foi possível publicar o PDF.", "error");
      } finally {
        button.disabled = false;
      }
    });
    $("[data-digital-list]")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-toggle-material]");
      if (!button) return;
      button.disabled = true;
      const next = button.dataset.published !== "true";
      const { data, error } = await api.client
        .from("materiais_biblioteca")
        .update({ publicado: next })
        .eq("id", button.dataset.toggleMaterial)
        .select()
        .single();
      if (error) showToast(error.message, "error");
      else {
        const index = state.materials.findIndex((item) => item.id === data.id);
        state.materials[index] = data;
        renderDigital();
        showToast(next ? "PDF publicado." : "PDF ocultado dos alunos.");
      }
    });
  };

  const insertOne = async (table, payload) => {
    if (!isOnline()) throw new Error("O Supabase não está configurado.");
    const { data, error } = await api.client
      .from(table)
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const distributeCopies = async (copies, genero) => {
    let offset = 0;
    for (const section of state.sections) {
      const used =
        Number(section.ocupacao_atual) ||
        state.exemplares.filter((copy) => copy.secao_fisica_id === section.id)
          .length;
      const remaining = Math.max(0, Number(section.capacidade_maxima) - used);
      const matchesGenre =
        !section.genero_associado ||
        section.genero_associado.toLowerCase() === genero.toLowerCase();
      if (!matchesGenre || !remaining) continue;
      const selected = copies.slice(offset, offset + remaining);
      offset += selected.length;
      for (const copy of selected) {
        copy.secao_fisica_id = section.id;
        const { error } = await api.client
          .from("exemplares")
          .update({ secao_fisica_id: section.id })
          .eq("id", copy.id);
        if (error) throw error;
      }
      if (offset === copies.length) break;
    }
  };

  const updateBatchPreview = () => {
    const quantity = Math.max(1, Number($("[data-quantity]")?.value || 1));
    const prefix = ($("[data-prefix]")?.value || "9873")
      .replace(/\D/g, "")
      .padStart(4, "0")
      .slice(0, 4);
    const preview = $(`[data-batch-preview]`);
    if (preview)
      preview.textContent = `Série gerada: ${prefix}-001 até ${prefix}-${String(quantity).padStart(3, "0")}`;
    updateScanProgress();
  };

  const updateScanProgress = () => {
    const quantity = Number($("[data-quantity]")?.value || 1);
    setText(
      "[data-scan-current]",
      `Exemplar ${Math.min(state.scannedIsbns.length + 1, quantity)}`,
    );
    setText(
      "[data-scan-count]",
      `${state.scannedIsbns.length} de ${quantity} ISBNs lidos`,
    );
  };

  const handleBookSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const values = Object.fromEntries(new FormData(form));
    const quantity = Number(values.quantidade);
    if (!button || !quantity || quantity < 1) return;
    button.disabled = true;
    try {
      const book = await insertOne("livros", {
        titulo: values.titulo.trim(),
        autor: values.autor.trim(),
        genero: values.genero,
        capa_url: values.capa_url.trim() || null,
        quantidade_total: quantity,
        quantidade_disponivel: quantity,
      });
      const prefix = values.prefixo
        .replace(/\D/g, "")
        .padStart(4, "0")
        .slice(0, 4);
      const copies = [];
      for (let index = 0; index < quantity; index += 1) {
        const copy = await insertOne("exemplares", {
          livro_id: book.id,
          numero_serie: `${prefix}-${String(index + 1).padStart(3, "0")}`,
          isbn_individual: state.scannedIsbns[index] || null,
          status: "disponivel",
          secao_fisica_id: null,
        });
        copies.push(copy);
      }
      state.books.push(book);
      state.exemplares.push(...copies);
      await distributeCopies(copies, values.genero);
      form.reset();
      $("[data-quantity]").value = 1;
      $("[data-prefix]").value = "9873";
      state.scannedIsbns = [];
      updateBatchPreview();
      render();
      showToast(`${quantity} exemplar(es) cadastrado(s) com sucesso.`);
    } catch (error) {
      showToast(error.message || "Não foi possível cadastrar o lote.", "error");
    } finally {
      button.disabled = false;
    }
  };

  const setupBookForm = () => {
    const form = $("[data-book-form]");
    if (!form) return;
    $("[data-quantity]")?.addEventListener("input", updateBatchPreview);
    $("[data-prefix]")?.addEventListener("input", updateBatchPreview);
    form.addEventListener("submit", handleBookSubmit);
  };

  const setupSections = () => {
    const modal = $("[data-section-modal]");
    const form = $("[data-section-form]");
    $("[data-section-open]")?.addEventListener("click", () =>
      modal?.showModal(),
    );
    document
      .querySelectorAll("[data-modal-close]")
      .forEach((button) =>
        button.addEventListener("click", () => modal?.close()),
      );
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      try {
        const section = await insertOne("secoes_fisicas", {
          nome: values.nome.trim(),
          genero_associado:
            values.materia_associada.trim() || "Todos os gêneros",
          capacidade_maxima: Number(values.capacidade_maxima),
          ocupacao_atual: 0,
        });
        state.sections.push(section);
        event.currentTarget.reset();
        modal?.close();
        render();
        showToast("Seção criada com sucesso.");
      } catch (error) {
        showToast(error.message || "Não foi possível criar a seção.", "error");
      }
    });
  };

  const setupCatalog = () => {
    $("[data-search]")?.addEventListener("input", renderCatalog);
    $("[data-catalog]")?.addEventListener("click", (event) => {
      const summary = event.target.closest("[data-expand]");
      if (summary) summary.parentElement.classList.toggle("open");
    });
    $("[data-catalog]")?.addEventListener("change", async (event) => {
      const select = event.target.closest("[data-copy-status]");
      if (!select) return;
      const copy = state.exemplares.find(
        (item) => item.id === select.dataset.copyStatus,
      );
      const previous = copy?.status;
      select.disabled = true;
      const result = await api.client.rpc(
        "biblioteca_atualizar_status_exemplar",
        {
          p_exemplar_id: select.dataset.copyStatus,
          p_status: select.value,
        },
      );
      if (result.error) {
        select.value = previous;
        showToast(result.error.message, "error");
      } else {
        Object.assign(copy, result.data);
        showToast("Status do exemplar atualizado.");
      }
      select.disabled = false;
    });
  };

  const stopScanner = () => {
    state.scanning = false;
    state.stream?.getTracks().forEach((track) => track.stop());
    state.stream = null;
    const video = $("[data-scanner-video]");
    if (video) video.srcObject = null;
  };

  const scanFrame = async () => {
    if (!state.scanning || !state.detector || !state.stream) return;
    try {
      const codes = await state.detector.detect($("[data-scanner-video]"));
      const value = codes[0]?.rawValue;
      const quantity = Number($("[data-quantity]")?.value || 1);
      if (
        value &&
        state.scannedIsbns.length < quantity &&
        !state.scannedIsbns.includes(value)
      ) {
        state.scannedIsbns.push(value);
        updateScanProgress();
        showToast(`ISBN lido para o exemplar ${state.scannedIsbns.length}.`);
      }
      if (state.scannedIsbns.length >= quantity) {
        state.scanning = false;
        $("[data-scanner-status]").textContent =
          "Todos os ISBNs deste lote foram lidos.";
        return;
      }
    } catch {
      // A câmera pode não entregar um quadro legível em cada tentativa.
    }
    if (state.scanning) window.requestAnimationFrame(scanFrame);
  };

  const setupScanner = () => {
    const modal = $("[data-scanner-modal]");
    $("[data-scan-open]")?.addEventListener("click", () => {
      state.scannedIsbns = [];
      updateScanProgress();
      modal?.showModal();
    });
    $("[data-scanner-close]")?.addEventListener("click", () => {
      stopScanner();
      modal?.close();
    });
    $("[data-scanner-start]")?.addEventListener("click", async () => {
      if (
        !("BarcodeDetector" in window) ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        $("[data-scanner-status]").textContent =
          "Este navegador não oferece leitura por câmera. Cadastre os ISBNs manualmente depois.";
        showToast("Leitura por câmera indisponível neste navegador.", "error");
        return;
      }
      try {
        state.detector = new BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_128"],
        });
        state.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        $("[data-scanner-video]").srcObject = state.stream;
        $("[data-scanner-status]").textContent =
          "Câmera ativa. Aponte para o código do próximo exemplar.";
        state.scanning = true;
        scanFrame();
      } catch (error) {
        $("[data-scanner-status]").textContent =
          "Não foi possível acessar a câmera. Verifique a permissão do dispositivo.";
        showToast(error.message || "Câmera indisponível.", "error");
      }
    });
  };

  const initialize = async () => {
    if (state.initialized) return;
    state.initialized = true;
    setupBookForm();
    setupSections();
    setupCatalog();
    setupScanner();
    setupDigital();
    try {
      await loadData();
      render();
    } catch (error) {
      state.books = [];
      state.sections = [];
      state.exemplares = [];
      render();
      showToast(
        error.message || "Não foi possível carregar o acervo.",
        "error",
      );
    }
  };

  document.addEventListener("ominisaber:ready", initialize);
  document.addEventListener("DOMContentLoaded", initialize);
  $("[data-signout]")?.addEventListener("click", () => api?.signOut());
})();
