(() => {
  const groups = [
    ["Visão geral", ["dashboard"]],
    ["Pessoas", ["turmas", "alunos", "professores", "vinculos"]],
    ["Currículo", ["descritores", "conteudos-publicados"]],
    ["Administração", ["acessos", "auditoria"]],
    ["Conta", ["perfil"]],
  ];
  const nav = document.querySelector(".manager-nav");
  if (nav) {
    const links = [...nav.querySelectorAll("a")];
    nav.innerHTML = "";
    groups.forEach(([title, keys]) => {
      const box = document.createElement("div");
      box.className = "manager-nav-group";
      box.innerHTML = `<div class="manager-nav-title">${title}</div>`;
      keys.forEach((key) => {
        const link = links.find((item) => item.getAttribute("href")?.includes(`/${key}/`) || (key === "dashboard" && item.getAttribute("href")?.includes("/dashboard/")));
        if (link) {
          if (key === "dashboard") link.querySelector("span:last-child").textContent = "Visão geral";
          box.append(link);
        }
      });
      nav.append(box);
    });
  }

  const page = document.body.dataset.managerPage;
  const actions = document.querySelector(".header-actions");
  if (page !== "acessos" && actions && !actions.querySelector(".manager-primary-action")) {
    const link = document.createElement("a");
    link.className = "btn btn-primary manager-primary-action";
    link.href = "../acessos/index.html";
    link.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">add</span><span>Nova conta</span>';
    actions.append(link);
  }
  if (page === "dashboard") {
    const title = document.querySelector(".title-wrap h1");
    const subtitle = document.querySelector(".title-wrap p");
    if (title) title.textContent = "Visão geral";
    if (subtitle) subtitle.textContent = "Colégio OminiSaber · Ano letivo 2026";
  }

  const severity = (count) => (count > 0 ? "attention" : "regular");
  const severityLabel = (count) => (count > 0 ? "Atenção" : "Em dia");

  window.renderManagerExecutiveDashboard = async ({ api, content, route, icon, esc }) => {
    const data = await api().getManagerOverview();
    const students = data.profiles.filter((item) => item.role === "aluno");
    const teachers = data.profiles.filter((item) => item.role === "professor");
    const activeStudents = students.filter((item) => item.ativo !== false);
    const linksByTeacher = new Set(data.links.map((item) => item.professor_id));
    const coveredCodes = new Set(data.trails.filter((item) => item.publicada && item.descritor_sedu).map((item) => item.descritor_sedu));
    const covered = data.descriptors.filter((item) => coveredCodes.has(item.codigo)).length;
    const coverage = data.descriptors.length ? Math.round((covered / data.descriptors.length) * 100) : 0;
    const pendingAccess = data.accesses.filter((item) => item.status === "pendente").length;
    const components = [
      ["Português", "portugues_literatura"], ["Matemática", "matematica"], ["Física", "fisica"],
      ["Redação", "redacao"], ["Administração", "administracao"], ["Informática", "informatica"],
    ].map(([label, code]) => {
      const all = data.descriptors.filter((item) => item.materia_codigo === code);
      const complete = all.filter((item) => coveredCodes.has(item.codigo));
      return { label, code, total: all.length, covered: complete.length, percent: all.length ? Math.round((complete.length / all.length) * 100) : 0 };
    });
    const priorities = [
      { label: "Descritores sem conteúdo", detail: "Aguardam criação ou publicação", count: data.descriptors.filter((item) => !coveredCodes.has(item.codigo)).length, area: "Currículo", to: "descritores" },
      { label: "Alunos sem turma", detail: "Necessitam de alocação", count: students.filter((item) => !item.turma_id).length, area: "Pessoas", to: "alunos" },
      { label: "Professores sem vínculo", detail: "Necessitam de turma e componente", count: teachers.filter((item) => !linksByTeacher.has(item.id)).length, area: "Pessoas", to: "vinculos" },
      { label: "Solicitações de acesso", detail: "Aguardam análise administrativa", count: pendingAccess, area: "Administração", to: "acessos" },
    ];
    const audit = await api().listManagerAudit().catch(() => []);
    const date = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());

    content().innerHTML = `
      <section class="manager-summary" aria-label="Resumo institucional">
        <a href="${route("alunos")}" class="summary-item"><span class="summary-icon green">${icon("groups")}</span><span><strong>${activeStudents.length}</strong><b>alunos ativos</b><small>de ${students.length} matriculados</small></span></a>
        <a href="${route("turmas")}" class="summary-item"><span class="summary-icon blue">${icon("co_present")}</span><span><strong>${data.classes.length}</strong><b>${data.classes.length === 1 ? "turma ativa" : "turmas ativas"}</b><small>Ano letivo 2026</small></span></a>
        <a href="${route("professores")}" class="summary-item"><span class="summary-icon violet">${icon("person")}</span><span><strong>${teachers.length}</strong><b>professores</b><small>${linksByTeacher.size} com vínculo</small></span></a>
        <a href="${route("descritores")}" class="summary-item"><span class="summary-ring" style="--value:${coverage * 3.6}deg"><i>${coverage}%</i></span><span><strong>${coverage}%</strong><b>cobertura curricular</b><small>${covered} de ${data.descriptors.length} descritores</small></span></a>
      </section>
      <div class="operations-grid">
        <section class="manager-panel priorities-panel">
          <div class="panel-heading compact"><div><p class="eyebrow">Operação escolar</p><h2>Prioridades de hoje</h2><p>Itens que exigem atenção para manter a gestão em dia.</p></div><time>${esc(date)}</time></div>
          <div class="priority-table" role="table" aria-label="Prioridades de hoje">
            <div class="priority-table-head" role="row"><span>Prioridade</span><span>Item</span><span>Quantidade</span><span>Área</span><span>Ação</span></div>
            ${priorities.map((item) => `<a class="priority-table-row" role="row" href="${route(item.to)}"><span><i class="status-dot ${severity(item.count)}"></i>${severityLabel(item.count)}</span><span><b>${esc(item.label)}</b><small>${esc(item.detail)}</small></span><strong class="priority-value ${severity(item.count)}">${item.count}</strong><span>${esc(item.area)}</span><span class="row-action">Ver detalhes ${icon("arrow_forward")}</span></a>`).join("")}
          </div>
        </section>
        <aside class="manager-side-stack">
          <section class="manager-panel quick-panel"><div class="panel-heading compact"><div><p class="eyebrow">Atalhos</p><h2>Ações frequentes</h2></div></div><div class="quick-actions">
            <a class="quick-action primary" href="${route("acessos")}">${icon("person_add")}<span><b>Nova conta</b><small>Criar um acesso institucional</small></span>${icon("arrow_forward")}</a>
            <a class="quick-action" href="${route("turmas")}">${icon("add_box")}<span><b>Criar turma</b><small>Organizar o ano letivo</small></span>${icon("arrow_forward")}</a>
            <a class="quick-action" href="${route("vinculos")}">${icon("add_link")}<span><b>Vincular professor</b><small>Associar turma e componente</small></span>${icon("arrow_forward")}</a>
          </div></section>
          <section class="manager-panel recent-panel"><div class="panel-heading compact"><div><p class="eyebrow">Histórico</p><h2>Movimentações recentes</h2></div><a href="${route("auditoria")}">Ver todas</a></div><div class="recent-list">${audit.length ? audit.slice(0, 4).map((item) => `<a href="${route("auditoria")}" class="recent-item"><i></i><span><b>${esc(item.acao.replaceAll("_", " "))}</b><small>${esc(item.perfis?.nome || "Sistema")} · ${new Date(item.created_at).toLocaleString("pt-BR")}</small></span></a>`).join("") : '<div class="compact-empty">Nenhuma movimentação registrada.</div>'}</div></section>
        </aside>
      </div>
      <section class="manager-panel coverage-overview"><div class="panel-heading compact"><div><p class="eyebrow">Currículo</p><h2>Cobertura por componente</h2><p>Descritores presentes em conteúdos publicados.</p></div><a href="${route("descritores")}">Ver descritores ${icon("arrow_forward")}</a></div><div class="coverage-list">${components.map((item) => `<a href="${route("descritores")}" class="coverage-row"><span><b>${esc(item.label)}</b><small>${item.covered} de ${item.total}</small></span><div class="coverage-track"><i style="width:${item.percent}%"></i></div><strong>${item.percent}%</strong></a>`).join("")}</div></section>
      <details class="manager-panel curriculum-details"><summary><span>${icon("table_view")}<b>Consultar habilidades curriculares</b><small>Abra somente quando precisar analisar os detalhes.</small></span>${icon("expand_more")}</summary><div class="curriculum-details-body"><div class="coverage-filters"><select class="field" data-coverage-materia><option value="">Todas as matérias</option><option value="portugues">Português</option><option value="matematica">Matemática</option><option value="fisica">Física</option><option value="redacao">Redação</option><option value="tecnico_administracao">Administração</option><option value="tecnico_informatica">Informática</option></select><select class="field" data-coverage-serie><option value="">Todas as séries</option><option value="1">1ª série</option><option value="2">2ª série</option><option value="3">3ª série</option></select><select class="field" data-coverage-trimestre><option value="">Todos os trimestres</option><option value="1">1º trimestre</option><option value="2">2º trimestre</option><option value="3">3º trimestre</option></select></div><div data-curriculum-coverage-body><p class="compact-empty">Abra a consulta para carregar os dados.</p></div></div></details>`;

    const details = content().querySelector(".curriculum-details");
    const coverageBody = details.querySelector("[data-curriculum-coverage-body]");
    let coverageLoaded = false;
    const loadCoverage = async () => {
      coverageBody.innerHTML = '<div class="inline-loading">Carregando habilidades...</div>';
      const rows = await api().getCurriculumCoverage({ materia: details.querySelector("[data-coverage-materia]").value || null, serie: details.querySelector("[data-coverage-serie]").value || null, trimestre: details.querySelector("[data-coverage-trimestre]").value || null });
      const used = rows.filter((row) => row.utilizada).length;
      const percent = rows.length ? Math.round((used / rows.length) * 100) : 0;
      coverageBody.innerHTML = `<div class="coverage-mini-summary"><span><b>${rows.length}</b> previstas</span><span><b>${used}</b> utilizadas</span><span><b>${rows.length - used}</b> pendentes</span><span><b>${percent}%</b> cobertura</span></div><div class="table-wrap"><table class="data-table curriculum-table"><thead><tr><th>Habilidade</th><th>Período</th><th>Status</th><th>Uso</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${esc(row.codigo)}</strong><small>${esc(row.descricao)}</small></td><td>${row.serie}ª série · ${row.trimestre}º tri</td><td><span class="table-status ${row.utilizada ? "success" : "neutral"}">${row.utilizada ? "Utilizada" : "Não utilizada"}</span></td><td>${(row.usos || []).map((usage) => esc(`${usage.tipo}: ${usage.recurso}`)).join("; ") || "—"}</td></tr>`).join("") || '<tr><td colspan="4">Nenhuma habilidade encontrada.</td></tr>'}</tbody></table></div>`;
      window.OminiSaberEnhanceManagerTables?.(coverageBody);
    };
    details.addEventListener("toggle", () => {
      if (details.open && !coverageLoaded) {
        coverageLoaded = true;
        loadCoverage().catch((error) => { coverageBody.innerHTML = `<p class="error-text">${esc(error.message)}</p>`; });
      }
    });
    details.querySelectorAll("[data-coverage-materia],[data-coverage-serie],[data-coverage-trimestre]").forEach((field) => field.addEventListener("change", () => loadCoverage().catch((error) => { coverageBody.innerHTML = `<p class="error-text">${esc(error.message)}</p>`; })));
  };
})();
