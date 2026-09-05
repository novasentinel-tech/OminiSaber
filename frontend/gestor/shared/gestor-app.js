(() => {
  const page = document.body.dataset.managerPage || "dashboard";
  const root = document.querySelector("#manager-app");
  const api = () => window.OminiSaber;
  const nav = [
    ["dashboard", "dashboard", "Dashboard"],
    ["turmas", "deployed_code", "Turmas"],
    ["alunos", "groups", "Alunos"],
    ["professores", "person", "Professores"],
    ["vinculos", "hub", "Vínculos"],
    ["descritores", "assignment", "Descritores"],
    ["conteudos-publicados", "file_copy", "Conteúdos publicados"],
    ["acessos", "admin_panel_settings", "Acessos e senhas"],
    ["auditoria", "shield", "Auditoria"],
    ["perfil", "person", "Perfil"],
  ];
  const route = (key) =>
    `../${key === "dashboard" ? "dashboard" : key}/index.html`;
  const esc = (value = "") =>
    String(value).replace(
      /[&<>'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c],
    );
  const icon = (name) =>
    `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
  const toast = (text) => {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    document.body.append(el);
    setTimeout(() => el.remove(), 3200);
  };
  const dates = () =>
    new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date());
  const title = {
    dashboard: "Mapa institucional",
    turmas: "Turmas",
    alunos: "Alunos",
    professores: "Professores",
    vinculos: "Vínculos pedagógicos",
    descritores: "Descritores curriculares",
    "conteudos-publicados": "Conteúdos publicados",
    acessos: "Acessos e senhas",
    auditoria: "Auditoria",
    perfil: "Meu perfil",
  }[page];
  const shell = () => {
    root.innerHTML = `<div class="manager-shell"><div class="sidebar-scrim"></div><aside class="manager-sidebar"><div class="brand">${icon("school")}<span>Omini<span style="color:var(--yellow)">Saber</span></span></div><nav class="manager-nav">${nav.map(([key, ic, label]) => `<a href="${route(key)}" class="${page === key ? "active" : ""}">${icon(ic)}<span>${label}</span></a>`).join("")}</nav><div class="sidebar-footer"><select class="school-select" aria-label="Unidade escolar"><option>Colégio OminiSaber</option></select><div class="year-label">Ano letivo <b>2026</b></div></div></aside><main class="manager-main"><header class="manager-header"><div style="display:flex;gap:12px;align-items:center"><button class="menu-btn" aria-label="Abrir menu">${icon("menu")}</button><div class="title-wrap"><h1>${title}</h1><p>${page === "dashboard" ? dates() : "Gestão institucional OminiSaber"}</p></div></div><div class="header-actions"><select class="field" aria-label="Ano letivo"><option>2026</option></select><button class="icon-btn" aria-label="Notificações">${icon("notifications")}</button><button class="profile-chip" data-go-profile><span class="avatar">GS</span><span data-profile-name>Gestor</span>${icon("expand_more")}</button></div></header><section class="manager-content"><div class="loading">Carregando dados reais...</div></section></main></div>`;
    const sidebar = root.querySelector(".manager-sidebar"),
      scrim = root.querySelector(".sidebar-scrim");
    root.querySelector(".menu-btn").onclick = () => {
      sidebar.classList.add("open");
      scrim.classList.add("open");
    };
    scrim.onclick = () => {
      sidebar.classList.remove("open");
      scrim.classList.remove("open");
    };
    root.querySelector("[data-go-profile]").onclick = () =>
      (location.href = route("perfil"));
  };
  const content = () => root.querySelector(".manager-content");
  const empty = (label) =>
    `<div class="empty">${icon("database")}<h3>Nenhum registro encontrado</h3><p>${label}</p></div>`;
  const modal = (heading, body, submitLabel = "Salvar") =>
    new Promise((resolve) => {
      const back = document.createElement("div");
      back.className = "modal-backdrop";
      back.innerHTML = `<form class="modal"><div class="modal-head"><h2>${heading}</h2><button type="button" class="icon-btn" data-close>${icon("close")}</button></div>${body}<div class="modal-actions"><button type="button" class="btn" data-close>Cancelar</button><button class="btn btn-primary">${submitLabel}</button></div></form>`;
      document.body.append(back);
      back.querySelectorAll("[data-close]").forEach(
        (b) =>
          (b.onclick = () => {
            back.remove();
            resolve(null);
          }),
      );
      back.querySelector("form").onsubmit = (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        back.remove();
        resolve(data);
      };
    });
  const status = (on, labelOn = "Ativo", labelOff = "Inativo") =>
    `<span class="badge ${on ? "" : "off"}">${on ? labelOn : labelOff}</span>`;
  const reviewStatusLabel = { ok: "OK", revisar: "Revisar", aprovado: "Aprovado", rejeitado: "Rejeitado" };
  const dashboard = async () => {
    if (window.renderManagerExecutiveDashboard)
      return window.renderManagerExecutiveDashboard({
        api,
        content,
        route,
        icon,
        esc,
      });
    const d = await api().getManagerOverview(),
      students = d.profiles.filter((x) => x.role === "aluno"),
      teachers = d.profiles.filter((x) => x.role === "professor"),
      active = students.filter((x) => x.ativo !== false),
      published = d.trails.filter((x) => x.publicada),
      coverage = d.descriptors.length
        ? Math.round(
            (new Set(d.trails.map((x) => x.descritor_sedu).filter(Boolean))
              .size /
              d.descriptors.length) *
              100,
          )
        : 0,
      regular = d.profiles.length
        ? Math.round(
            (d.profiles.filter(
              (x) => x.ativo !== false && !x.primeiro_acesso_pendente,
            ).length /
              d.profiles.length) *
              100,
          )
        : 0;
    content().innerHTML = `<div class="metrics"><div class="metric"><small>Cobertura curricular</small><strong>${coverage}%</strong><span>${published.length} trilhas publicadas</span><div class="progress" style="color:var(--blue)"><span style="width:${coverage}%"></span></div></div><div class="metric green"><small>Alunos vinculados</small><strong>${active.length}</strong><span>de ${students.length} matriculados</span><div class="progress" style="color:var(--green)"><span style="width:${students.length ? (active.length / students.length) * 100 : 0}%"></span></div></div><div class="metric green"><small>Contas regulares</small><strong>${regular}%</strong><span>${d.profiles.filter((x) => x.primeiro_acesso_pendente).length} primeiro(s) acesso(s) pendente(s)</span><div class="progress" style="color:var(--green)"><span style="width:${regular}%"></span></div></div></div><div class="dashboard-grid"><section class="map-card"><div class="map-toolbar"><div><select class="field" id="course-filter"><option value="">Todos os cursos</option><option value="administracao">Administração</option><option value="informatica">Informática</option></select></div><button class="btn" id="reset-map">${icon("refresh")} Redefinir mapa</button></div><div id="institution-map" class="map-canvas" aria-label="Mapa interativo das relações institucionais"></div><div class="map-legend"><span><i class="legend-dot"></i>Relação curricular</span><span><i class="legend-dot green"></i>Relação de pessoas</span><span><i class="legend-dot red"></i>Pendências</span></div></section><aside class="detail-card" id="map-detail"></aside></div>`;
    const stats = {
      classes: d.classes.length,
      students: students.length,
      teachers: teachers.length,
      descriptors: d.descriptors.length,
      content:
        d.trails.length +
        d.labs.length +
        d.evaluations.length +
        d.prompts.length,
    };
    const elements = [
      {
        data: {
          id: "classes",
          label: `Turmas\n${stats.classes}`,
          route: "turmas",
        },
      },
      {
        data: {
          id: "teachers",
          label: `Professores\n${stats.teachers}`,
          route: "professores",
        },
      },
      {
        data: {
          id: "students",
          label: `Alunos\n${stats.students}`,
          route: "alunos",
        },
      },
      {
        data: {
          id: "descriptors",
          label: `Descritores\n${stats.descriptors}`,
          route: "descritores",
        },
      },
      {
        data: {
          id: "content",
          label: `Conteúdos\n${stats.content}`,
          route: "conteudos-publicados",
        },
      },
      ...["teachers", "students", "descriptors"].map((t, i) => ({
        data: {
          id: `e${i}`,
          source: "classes",
          target: t,
          type: i < 2 ? "people" : "curriculum",
        },
      })),
      {
        data: {
          id: "e4",
          source: "descriptors",
          target: "content",
          type: "curriculum",
        },
      },
    ];
    const cy = cytoscape({
      container: document.querySelector("#institution-map"),
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "text-wrap": "wrap",
            "text-valign": "center",
            "text-halign": "center",
            "background-color": "#fff",
            "border-width": 2,
            "border-color": "#265bd7",
            width: 112,
            height: 112,
            "font-family": "Inter",
            "font-size": 14,
            color: "#122039",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 5,
            "border-color": "#265bd7",
            "underlay-color": "#dce8ff",
            "underlay-padding": 8,
            "underlay-opacity": 1,
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#265bd7",
            "target-arrow-color": "#265bd7",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
          },
        },
        {
          selector: 'edge[type="people"]',
          style: { "line-color": "#158a58", "target-arrow-color": "#158a58" },
        },
      ],
      layout: {
        name: "breadthfirst",
        roots: "#classes",
        directed: true,
        padding: 35,
        spacingFactor: 1.3,
      },
    });
    const show = (id = "classes") => {
      const map = {
          classes: [
            "Turmas",
            stats.classes,
            "Núcleo da organização acadêmica.",
          ],
          teachers: [
            "Professores",
            stats.teachers,
            "Docentes cadastrados e seus vínculos.",
          ],
          students: [
            "Alunos",
            stats.students,
            "Matrículas e situação de acesso.",
          ],
          descriptors: [
            "Descritores",
            stats.descriptors,
            "Cobertura curricular registrada.",
          ],
          content: [
            "Conteúdos publicados",
            stats.content,
            "Trilhas, avaliações e propostas.",
          ],
        },
        v = map[id];
      document.querySelector("#map-detail").innerHTML =
        `<h2>${v[0]}</h2><div class="detail-list"><div class="detail-row"><span>Total real</span><strong>${v[1]}</strong></div><div class="detail-row"><span>Atualização</span><strong>Agora</strong></div></div><p style="color:var(--muted);margin:22px 0">${v[2]}</p><div class="pending"><h3>Pendências institucionais</h3><div class="pending-item">${icon("key")}<span>Primeiros acessos pendentes</span><b>${d.profiles.filter((x) => x.primeiro_acesso_pendente).length}</b></div><div class="pending-item">${icon("assignment")}<span>Descritores em revisão</span><b>${d.descriptors.filter((x) => x.status === "revisao").length}</b></div><div class="pending-item">${icon("person_off")}<span>Contas inativas</span><b>${d.profiles.filter((x) => x.ativo === false).length}</b></div><a class="btn btn-primary" style="width:100%;margin-top:18px" href="${route(cy.$id(id).data("route"))}">Abrir detalhes ${icon("arrow_forward")}</a></div>`;
    };
    show();
    cy.on("tap", "node", (e) => show(e.target.id()));
    document.querySelector("#reset-map").onclick = () => {
      cy.fit(undefined, 35);
      cy.$(":selected").unselect();
      show();
    };
  };
  const standardPage = async () => {
    if (page === "turmas") return classesPage();
    if (page === "alunos") return peoplePage("aluno");
    if (page === "professores") return peoplePage("professor");
    if (page === "vinculos") return linksPage();
    if (page === "descritores") return descriptorsPage();
    if (page === "conteudos-publicados") return publicationsPage();
    if (page === "acessos") return accessPage();
    if (page === "auditoria") return auditPage();
    if (page === "perfil") return profilePage();
  };
  const classesPage = async () => {
    const rows = await api().listManagerClasses();
    content().innerHTML = `<div class="page-head"><div><h2>Estrutura de turmas</h2><p>Organize séries e anos letivos.</p></div><button class="btn btn-primary" id="new">${icon("add")} Nova turma</button></div><div class="cards">${rows.map((x) => `<article class="entity-card"><span class="badge">${esc(x.ano_letivo)}</span><h3>${esc(x.nome)}</h3><p>${esc(x.serie || "Série não definida")}</p><button class="btn edit" data-row='${esc(JSON.stringify(x))}'>Editar</button></article>`).join("") || empty("Cadastre a primeira turma.")}</div>`;
    const open = async (x) => {
      const d = await modal(
        x ? "Editar turma" : "Nova turma",
        `<div class="form-grid"><label class="wide">Nome<input class="field" name="nome" value="${esc(x?.nome)}" required></label><label>Ano letivo<input class="field" type="number" name="ano_letivo" value="${x?.ano_letivo || 2026}" required></label><label>Série<select class="field" name="serie"><option>1º ano</option><option>2º ano</option><option>3º ano</option></select></label></div>`,
      );
      if (d) {
        await api().saveManagerClass({ ...d, id: x?.id });
        toast("Turma salva.");
        classesPage();
      }
    };
    document.querySelector("#new").onclick = () => open();
    document
      .querySelectorAll(".edit")
      .forEach((b) => (b.onclick = () => open(JSON.parse(b.dataset.row))));
  };
  const peoplePage = async (role) => {
    const [rows, classes] = await Promise.all([
      api().listManagerProfiles(role),
      api().listManagerClasses(),
    ]);
    content().innerHTML = `<div class="page-head"><div><h2>${role === "aluno" ? "Alunos" : "Professores"}</h2><p>Dados reais de perfis e vínculos.</p></div><a class="btn btn-primary" href="${route("acessos")}">${icon("person_add")} Criar conta</a></div>${role === "aluno" && !classes.length ? `<div class="manager-notice"><div>${icon("info")}<span><b>Nenhuma turma cadastrada.</b> O curso pode ser alterado agora; para vincular uma turma, cadastre-a primeiro.</span></div><a class="btn" href="${route("turmas")}">Cadastrar turma</a></div>` : ""}<div class="toolbar"><input class="search" id="q" placeholder="Buscar por nome ou matrícula"></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Nome</th><th>Matrícula</th><th>${role === "aluno" ? "Turma / Curso" : "Especialidade"}</th><th>Situação</th><th>Ação</th></tr></thead><tbody>${rows.map((x) => `<tr data-search="${esc((x.nome + " " + (x.matricula || "")).toLowerCase())}"><td><b>${esc(x.nome)}</b><br><small>${esc(x.email_contato || "E-mail não informado")}</small></td><td>${esc(x.matricula || "—")}</td><td>${role === "aluno" ? `${esc(x.turmas?.nome || "Sem turma")} · ${esc(x.curso_tecnico === "informatica" ? "Informática" : x.curso_tecnico === "administracao" ? "Administração" : "Curso não definido")}` : esc((x.tipo_professor || "—").replaceAll("_", " "))}</td><td>${status(x.ativo !== false)}</td><td><button class="btn edit" data-id="${x.id}">Editar</button></td></tr>`).join("")}</tbody></table>${rows.length ? "" : empty("Nenhum perfil cadastrado.")}</div></div>`;
    document.querySelector("#q").oninput = (e) =>
      document
        .querySelectorAll("tbody tr")
        .forEach(
          (tr) =>
            (tr.hidden = !tr.dataset.search.includes(
              e.target.value.toLowerCase(),
            )),
        );
    document.querySelectorAll(".edit").forEach(
      (b) =>
        (b.onclick = async () => {
          const x = rows.find((r) => r.id === b.dataset.id),
            supportsActive = false;
          const body =
            role === "aluno"
              ? `<div class="form-grid"><label class="wide">Turma<select class="field" name="turma_id"><option value="">Sem turma</option>${classes.map((c) => `<option value="${c.id}" ${c.id === x.turma_id ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></label><label>Curso<select class="field" name="curso_tecnico"><option value="administracao" ${x.curso_tecnico === "administracao" ? "selected" : ""}>Administração</option><option value="informatica" ${x.curso_tecnico === "informatica" ? "selected" : ""}>Informática</option></select></label>${supportsActive ? `<label>Situação<select class="field" name="ativo"><option value="true" ${x.ativo !== false ? "selected" : ""}>Ativo</option><option value="false" ${x.ativo === false ? "selected" : ""}>Inativo</option></select></label>` : ""}</div>`
              : `<div class="form-grid"><label class="wide">Especialidade<select class="field" name="tipo_professor"><option value="matematica" ${x.tipo_professor === "matematica" ? "selected" : ""}>Matemática</option><option value="portugues" ${x.tipo_professor === "portugues" ? "selected" : ""}>Português</option><option value="tecnico_administracao" ${x.tipo_professor === "tecnico_administracao" ? "selected" : ""}>Técnico em Administração</option><option value="tecnico_informatica" ${x.tipo_professor === "tecnico_informatica" ? "selected" : ""}>Técnico em Informática</option></select></label>${supportsActive ? `<label>Situação<select class="field" name="ativo"><option value="true" ${x.ativo !== false ? "selected" : ""}>Ativo</option><option value="false" ${x.ativo === false ? "selected" : ""}>Inativo</option></select></label>` : ""}</div>`;
          const d = await modal(`Editar ${esc(x.nome)}`, body);
          if (d) {
            if ("ativo" in d) d.ativo = d.ativo === "true";
            if (d.turma_id === "") d.turma_id = null;
            try {
              await api().updateManagerProfile(x.id, d);
              toast("Perfil atualizado.");
              await peoplePage(role);
            } catch (error) {
              toast(`Não foi possível salvar: ${error.message}`);
            }
          }
        }),
    );
  };
  const linksPage = async () => {
    const [rows, teachers, classes] = await Promise.all([
      api().listManagerLinks(),
      api().listManagerProfiles("professor"),
      api().listManagerClasses(),
    ]);
    content().innerHTML = `<div class="page-head"><div><h2>Vínculos pedagógicos</h2><p>Associe professores às turmas e matérias.</p></div><button class="btn btn-primary" id="new">${icon("add_link")} Novo vínculo</button></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Professor</th><th>Turma</th><th>Matéria</th><th>Desde</th><th></th></tr></thead><tbody>${rows.map((x) => `<tr><td><b>${esc(x.perfis?.nome || "—")}</b></td><td>${esc(x.turmas?.nome || "—")}</td><td>${esc(x.materia || "—")}</td><td>${new Date(x.created_at).toLocaleDateString("pt-BR")}</td><td><button class="btn btn-danger remove" data-p="${x.professor_id}" data-t="${x.turma_id}">${icon("link_off")} Remover</button></td></tr>`).join("")}</tbody></table>${rows.length ? "" : empty("Ainda não há vínculos.")}</div></div>`;
    document.querySelector("#new").onclick = async () => {
      const d = await modal(
        "Novo vínculo",
        `<div class="form-grid"><label>Professor<select class="field" name="professor_id" required>${teachers.map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`)}</select></label><label>Turma<select class="field" name="turma_id" required>${classes.map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`)}</select></label><label class="wide">Matéria<input class="field" name="materia" required></label></div>`,
      );
      if (d) {
        await api().saveManagerLink(d);
        toast("Vínculo criado.");
        linksPage();
      }
    };
    document.querySelectorAll(".remove").forEach(
      (b) =>
        (b.onclick = async () => {
          await api().removeManagerLink(b.dataset.p, b.dataset.t);
          toast("Vínculo removido.");
          linksPage();
        }),
    );
  };
  const descriptorsPage = async () => {
    const rows = await api().listManagerDescriptors();
    content().innerHTML = `<div class="page-head"><div><h2>Descritores curriculares</h2><p>Referência institucional para trilhas e avaliações.</p></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="import-curriculum" disabled title="Importação automática em manutenção">${icon("upload_file")} Importação automática em manutenção</button><button class="btn btn-primary" id="new">${icon("add")} Novo descritor</button></div></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Código</th><th>Título</th><th>Matéria</th><th>Série / Trimestre</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((x) => `<tr><td><b>${esc(x.codigo)}</b></td><td>${esc(x.titulo)}</td><td>${esc(x.materia_codigo)}</td><td>${x.serie ? `${x.serie}º` : "—"} · ${x.trimestre ? `${x.trimestre}º tri` : "—"}</td><td>${status(x.status === "ativo", x.status, x.status)}</td><td><button class="btn edit" data-id="${x.id}">Editar</button></td></tr>`).join("")}</tbody></table>${rows.length ? "" : empty("Cadastre os descritores oficiais.")}</div></div>`;
    const wizardState = { step: 1, quantity: 1, descriptors: [] };
    const materiaOptions = `<option value="">Selecione</option><option value="portugues">Português</option><option value="matematica">Matemática</option><option value="fisica">Física</option><option value="redacao">Redação</option><option value="tecnico_administracao">Administração</option><option value="tecnico_informatica">Informática</option>`;
    const wizard = document.createElement("div");
    wizard.className = "modal-backdrop";
    wizard.innerHTML = `<form class="modal descriptor-wizard" style="max-width:900px"><div class="modal-head"><h2>Cadastro manual de descritores</h2><button type="button" class="icon-btn" data-wizard-close>${icon("close")}</button></div><div data-wizard-body></div><div class="modal-actions"><span data-wizard-error class="error-text"></span><button type="button" class="btn" data-wizard-prev>Anterior</button><button type="button" class="btn" data-wizard-cancel>Cancelar</button><button type="submit" class="btn btn-primary" data-wizard-submit>Continuar</button></div></form>`;
    const closeWizard = () => wizard.remove();
    const wizardBody = () => wizard.querySelector("[data-wizard-body]");
    const wizardError = (message = "") => { wizard.querySelector("[data-wizard-error]").textContent = message; };
    const validateStep1 = () => {
      const titles = wizardState.descriptors.map((item) => String(item.title || "").trim());
      if (!titles.every((title) => title.length >= 3)) return "Preencha todos os títulos com pelo menos 3 caracteres.";
      wizardState.descriptors.forEach((item, index) => { item.title = titles[index]; });
      return null;
    };
    const validateStep2 = () => {
      const current = wizardState.descriptors[wizardState.currentIndex];
      if (!current) return "Descritor inválido.";
      if (!["title", "code", "materia", "serie", "trimestre", "description", "status"].every((field) => String(current[field] ?? "").trim())) return "Preencha título, código, matéria, série, trimestre, descrição e status.";
      if (!/^D\d{3}(?:_[A-Z])?$/.test(current.code)) return "Use um código no formato D023_P.";
      if (wizardState.descriptors.some((item, index) => index !== wizardState.currentIndex && item.code === current.code)) return "Não repita o código dentro deste wizard.";
      return null;
    };
    const syncStep2 = () => {
      const current = wizardState.descriptors[wizardState.currentIndex];
      if (!current) return;
      const form = wizardBody().querySelector("[data-step-form]");
      if (!form) return;
      const values = new FormData(form);
      ["title", "code", "materia", "serie", "trimestre", "description", "status", "habilidade_id", "expectativa", "objetos", "habilidadeComputacao", "observacoes"].forEach((field) => { current[field] = values.get(field) || ""; });
      current.serie = current.serie ? Number(current.serie) : null;
      current.trimestre = current.trimestre ? Number(current.trimestre) : null;
    };
    const renderWizard = async () => {
      wizardError();
      const submit = wizard.querySelector("[data-wizard-submit]");
      if (wizardState.step === 1) {
        wizardBody().innerHTML = `<p>Etapa 1 de 3</p><label>Quantos descritores deseja cadastrar?<select class="field" name="quantity">${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${value === wizardState.quantity ? "selected" : ""}>${value}</option>`).join("")}</select></label><div class="form-grid" data-title-list>${wizardState.descriptors.map((item, index) => `<label>Descritor ${index + 1} — Título<input class="field" data-title-index="${index}" value="${esc(item.title)}" minlength="3" required></label>`).join("")}</div>`;
        wizardBody().querySelector("[name=quantity]").onchange = (event) => { wizardState.quantity = Number(event.target.value); while (wizardState.descriptors.length < wizardState.quantity) wizardState.descriptors.push({ title: "", code: "", materia: "", serie: "", trimestre: "", description: "", status: "revisao", habilidade_id: "", expectativa: "", objetos: "", habilidadeComputacao: "", observacoes: "" }); wizardState.descriptors.length = wizardState.quantity; renderWizard(); };
        wizardBody().querySelectorAll("[data-title-index]").forEach((input) => { input.oninput = () => { wizardState.descriptors[Number(input.dataset.titleIndex)].title = input.value; }; });
        submit.textContent = "Continuar";
      } else if (wizardState.step === 2) {
        const current = wizardState.descriptors[wizardState.currentIndex];
        wizardBody().innerHTML = `<p>Etapa 2 de 3 · Descritor ${wizardState.currentIndex + 1} de ${wizardState.quantity}</p><nav class="descriptor-wizard-nav">${wizardState.descriptors.map((item, index) => `<button type="button" class="btn ${index === wizardState.currentIndex ? "btn-primary" : ""}" data-descriptor-index="${index}">${index + 1}. ${esc(item.title || "Sem título")}</button>`).join("")}</nav><div class="form-grid" data-step-form><label>Título<input class="field" name="title" value="${esc(current.title)}" required></label><label>Código<input class="field" name="code" value="${esc(current.code)}" placeholder="D023_P" required></label><label>Matéria<select class="field" name="materia" required>${materiaOptions.replace(`value="${current.materia}"`, `value="${current.materia}" selected`)}</select></label><label>Série<select class="field" name="serie" required><option value="">Selecione</option>${[1, 2, 3].map((value) => `<option value="${value}" ${Number(current.serie) === value ? "selected" : ""}>${value}ª série</option>`).join("")}</select></label><label>Trimestre<select class="field" name="trimestre" required><option value="">Selecione</option>${[1, 2, 3].map((value) => `<option value="${value}" ${Number(current.trimestre) === value ? "selected" : ""}>${value}º trimestre</option>`).join("")}</select></label><label>Status<select class="field" name="status" required><option value="revisao" ${current.status === "revisao" ? "selected" : ""}>Em revisão</option><option value="ativo" ${current.status === "ativo" ? "selected" : ""}>Ativo</option><option value="arquivado" ${current.status === "arquivado" ? "selected" : ""}>Arquivado</option></select></label><label class="wide">Descrição<textarea class="field" name="description" rows="4" required>${esc(current.description)}</textarea></label><label class="wide">Habilidade curricular relacionada<select class="field" name="habilidade_id"><option value="">Sem habilidade relacionada</option></select></label></div>`;
        const skillSelect = wizardBody().querySelector("[name=habilidade_id]");
        wizardBody().querySelectorAll("[name=materia],[name=serie],[name=trimestre]").forEach((field) => { field.onchange = () => { syncStep2(); renderWizard(); }; });
        try { const skills = await api().listManagerCurriculumSkills({ materia: current.materia, serie: current.serie, trimestre: current.trimestre }); skillSelect.innerHTML += skills.map((skill) => `<option value="${skill.habilidade_id}" ${current.habilidade_id === skill.habilidade_id ? "selected" : ""}>${esc(skill.codigo)} — ${esc(skill.descricao)}</option>`).join(""); } catch (error) { wizardError(error.message); }
        wizardBody().querySelectorAll("[data-descriptor-index]").forEach((button) => { button.onclick = () => { syncStep2(); wizardState.currentIndex = Number(button.dataset.descriptorIndex); renderWizard(); }; });
        submit.textContent = wizardState.currentIndex === wizardState.quantity - 1 ? "Revisar" : "Próximo";
      } else {
        wizardBody().innerHTML = `<p>Etapa 3 de 3 · Revise os descritores antes de salvar.</p>${wizardState.descriptors.map((item, index) => `<section class="panel"><h3>${index + 1}. ${esc(item.title)}</h3><p><b>${esc(item.code)}</b> · ${esc(item.materia)} · ${item.serie}ª série · ${item.trimestre}º trimestre · ${esc(item.status)}</p><p>${esc(item.description)}</p><p>Habilidade: ${item.habilidade_id ? "Selecionada" : "Sem habilidade relacionada"}</p><button type="button" class="btn" data-edit-descriptor="${index}">Editar este descritor</button></section>`).join("")}`;
        wizardBody().querySelectorAll("[data-edit-descriptor]").forEach((button) => { button.onclick = () => { wizardState.currentIndex = Number(button.dataset.editDescriptor); wizardState.step = 2; renderWizard(); }; });
        submit.textContent = `Salvar ${wizardState.quantity} descritor${wizardState.quantity === 1 ? "" : "es"}`;
      }
      const previous = wizard.querySelector("[data-wizard-prev]");
      previous.hidden = wizardState.step === 1;
      previous.onclick = () => {
        if (wizardState.step === 3) { wizardState.step = 2; wizardState.currentIndex = wizardState.quantity - 1; }
        else if (wizardState.step === 2) { syncStep2(); if (wizardState.currentIndex > 0) wizardState.currentIndex -= 1; else wizardState.step = 1; }
        renderWizard();
      };
    };
    const openWizard = () => {
      wizardState.step = 1; wizardState.quantity = 1; wizardState.currentIndex = 0; wizardState.descriptors = [{ title: "", code: "", materia: "", serie: "", trimestre: "", description: "", status: "revisao", habilidade_id: "", expectativa: "", objetos: "", habilidadeComputacao: "", observacoes: "" }];
      document.body.append(wizard); renderWizard();
    };
    wizard.querySelector("[data-wizard-close]").onclick = closeWizard;
    wizard.querySelector("[data-wizard-cancel]").onclick = closeWizard;
    wizard.querySelector("form").onsubmit = async (event) => {
      event.preventDefault(); wizardError();
      if (wizardState.step === 1) { const error = validateStep1(); if (error) return wizardError(error); wizardState.step = 2; wizardState.currentIndex = 0; return renderWizard(); }
      if (wizardState.step === 2) { syncStep2(); const error = validateStep2(); if (error) return wizardError(error); if (wizardState.currentIndex < wizardState.quantity - 1) { wizardState.currentIndex += 1; return renderWizard(); } wizardState.step = 3; return renderWizard(); }
      try { for (let index = 0; index < wizardState.descriptors.length; index += 1) { const item = wizardState.descriptors[index]; wizardState.savingIndex = index; await api().saveManagerDescriptor(item); } closeWizard(); toast(`${wizardState.quantity} descritor${wizardState.quantity === 1 ? "" : "es"} cadastrado${wizardState.quantity === 1 ? "" : "s"} com sucesso.`); await descriptorsPage(); } catch (error) { wizardError(`Falha no descritor ${(wizardState.savingIndex ?? 0) + 1}: ${error.message}`); }
    };
    const review = async (importacao, parsed) => {
      const items = parsed.items.map((item, index) => ({ ...item, id: item.id || `local-${index}` }));
      const editItem = async (item) => {
        const payload = item.payload || {};
        const descriptors = (payload.descritores || []).map((descriptor) => `${descriptor.code}|${descriptor.descricao || ""}`).join("\n");
        const data = await modal("Editar item importado", `<div class="form-grid"><label>Código<input class="field" name="codigo" value="${esc(payload.codigo)}" required></label><label>Matéria<input class="field" name="materia_codigo" value="${esc(payload.materia_codigo || parsed.detected.materia_codigo || "")}"></label><label class="wide">Descrição<textarea class="field" name="descricao" rows="4" required>${esc(payload.descricao)}</textarea></label><label>Série<input class="field" type="number" min="1" max="3" name="serie" value="${payload.serie || ""}"></label><label>Trimestre<input class="field" type="number" min="1" max="3" name="trimestre" value="${payload.trimestre || ""}"></label><label>Quinzena<input class="field" name="quinzena" value="${esc(payload.quinzena)}"></label><label>Semana<input class="field" name="semana" value="${esc(payload.semana)}"></label><label>Página<input class="field" type="number" min="1" name="source_page" value="${item.source_page || ""}"></label><label class="wide">Descritores (código|descrição, uma linha por item)<textarea class="field" name="descritores" rows="3">${esc(descriptors)}</textarea></label><label class="wide">Expectativas (uma por linha)<textarea class="field" name="expectativas" rows="3">${esc((payload.expectativas || []).join("\n"))}</textarea></label><label class="wide">Objetos de conhecimento (um por linha)<textarea class="field" name="objetos" rows="3">${esc((payload.objetos || []).join("\n"))}</textarea></label></div>`);
        if (!data) return;
        item.payload = { ...payload, codigo: data.codigo.trim().toUpperCase(), descricao: data.descricao.trim(), materia_codigo: data.materia_codigo.trim() || null, serie: data.serie ? Number(data.serie) : null, trimestre: data.trimestre ? Number(data.trimestre) : null, quinzena: data.quinzena.trim() || null, semana: data.semana.trim() || null, descritores: data.descritores.split(/\r?\n/).map((line) => { const [code, ...description] = line.split("|"); return { code: code.trim().toUpperCase(), descricao: description.join("|").trim() }; }).filter((descriptor) => descriptor.code), expectativas: data.expectativas.split(/\r?\n/).map((value) => value.trim()).filter(Boolean), objetos: data.objetos.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) };
        item.source_page = data.source_page ? Number(data.source_page) : null;
        item.status = "revisar";
        if (!item.id.startsWith("local-")) { await api().updateCurriculumImportItem(item.id, { payload: item.payload, source_page: item.source_page, status: item.status }); if (item.payload.materia_codigo) await api().updateCurriculumImport(importacao.id, { materia_codigo: item.payload.materia_codigo }); }
        render();
      };
      const render = () => {
        const skills = items.filter((item) => item.tipo === "habilidade");
        const blocked = items.some((item) => item.status === "revisar" || (item.tipo === "referencia_ensino_fundamental" && !["aprovado", "rejeitado"].includes(item.status)));
        content().innerHTML = `<div class="page-head"><div><h2>Importação curricular</h2><p>${esc(importacao.nome_arquivo)} · ${esc(parsed.detected.origem || "Origem não identificada")} · ${parsed.detected.ano_letivo || "Ano não identificado"}</p></div><button class="btn" id="back-descriptors">${icon("arrow_back")} Voltar</button></div><div class="metrics"><div class="metric"><small>Habilidades</small><strong>${skills.length}</strong><span>${parsed.resumo.descritores} descritores únicos · ${parsed.resumo.referencias_ef || 0} referências EF</span></div><div class="metric"><small>Períodos</small><strong>${new Set(skills.map((item) => `${item.payload.serie}-${item.payload.trimestre}`)).size}</strong><span>de 3 trimestres possíveis</span></div><div class="metric ${blocked ? "" : "green"}"><small>Decisão</small><strong>${blocked ? "Revisar" : "Pronto"}</strong><span>${blocked ? "Há itens que exigem decisão" : "Todos os itens estão aprovados"}</span></div></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Código</th><th>Tipo</th><th>Série</th><th>Tri.</th><th>Descrição</th><th>Confiança</th><th>Status</th><th></th></tr></thead><tbody>${items.map((item) => `<tr><td><b>${esc(item.payload.codigo || "—")}</b></td><td>${item.tipo === "habilidade" ? "Habilidade EM" : item.tipo === "referencia_ensino_fundamental" ? "Referência EF" : "Aviso"}</td><td>${item.payload.serie || "—"}</td><td>${item.payload.trimestre || "—"}</td><td>${esc(item.payload.descricao || item.payload.mensagem)}</td><td>${item.confianca}%</td><td><select class="field review-status" data-id="${item.id}" ${item.id.startsWith("local-") ? "disabled" : ""}><option value="${item.status}">${item.status === "ok" ? "OK" : "Revisar"}</option><option value="aprovado">Aprovar</option><option value="rejeitado">Rejeitar</option></select></td><td><button class="btn edit-import" data-id="${item.id}">${icon("edit")} Editar</button></td></tr>`).join("")}</tbody></table></div><div class="modal-actions"><button class="btn btn-danger" id="reject-import">Rejeitar importação</button><button class="btn btn-primary" id="approve-import" ${blocked ? "disabled" : ""}>${icon("verified")} Aprovar e publicar currículo</button></div></div>`;
        if (items.some((item) => item.tipo === "referencia_ensino_fundamental")) { const notice = document.createElement("p"); notice.className = "manager-notice"; notice.textContent = "Referências EF ficam fora do currículo principal. Aprove para manter como referência complementar ou rejeite."; document.querySelector(".page-head").append(notice); }
        document.querySelectorAll(".review-status").forEach((select) => { const item = items.find((entry) => entry.id === select.dataset.id); select.innerHTML = Object.entries(reviewStatusLabel).map(([value, label]) => `<option value="${value}" ${value === item.status ? "selected" : ""}>${label}</option>`).join(""); });
        document.querySelector("#back-descriptors").onclick = descriptorsPage;
        document.querySelectorAll(".review-status").forEach((select) => { select.onchange = async () => { const item = items.find((entry) => entry.id === select.dataset.id); item.status = select.value; if (!select.dataset.id.startsWith("local-")) await api().updateCurriculumImportItem(select.dataset.id, { status: select.value }); render(); }; });
        document.querySelectorAll(".edit-import").forEach((button) => { button.onclick = () => editItem(items.find((item) => item.id === button.dataset.id)); });
        document.querySelector("#reject-import").onclick = async () => { await api().rejectCurriculumImport(importacao.id); toast("Importação rejeitada."); descriptorsPage(); };
        document.querySelector("#approve-import").onclick = async () => { await api().approveCurriculumImport(importacao.id); toast("Currículo aprovado e publicado no catálogo."); descriptorsPage(); };
      };
      render();
    };
    document.querySelector("#import-curriculum").onclick = async () => {
      const data = await modal("Importar currículo", `<div class="form-grid"><label class="wide">PDF oficial<input class="field" type="file" name="file" accept="application/pdf" required></label><label>Origem<input class="field" name="origem" value="SEDU-ES"></label><label>Ano letivo<input class="field" type="number" name="ano" value="2026" min="2000" max="2100" required></label><label>Componente curricular<select class="field" name="materia"><option value="">Detectar automaticamente</option><option value="portugues">Língua Portuguesa</option><option value="matematica">Matemática</option><option value="fisica">Física</option><option value="redacao">Redação</option><option value="tecnico_administracao">Administração</option><option value="tecnico_informatica">Informática</option></select></label><label>Trimestre<select class="field" name="trimestre"><option value="">Detectar automaticamente</option><option value="1">1º trimestre</option><option value="2">2º trimestre</option><option value="3">3º trimestre</option></select></label></div><p class="manager-notice">O documento será analisado e ficará em revisão. Nenhum dado pedagógico é publicado sem aprovação.</p>`, "Analisar currículo");
      if (!data?.file) return;
      content().innerHTML = `<div class="panel"><h2>Analisando currículo...</h2><p id="import-progress">Documento recebido</p></div>`;
      try {
        if (!window.pdfjsLib) throw new Error("O extrator de PDF não está disponível.");
        const pdfDocument = await window.pdfjsLib.getDocument({ data: await data.file.arrayBuffer() }).promise;
        const pages = [];
        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) { const page = await pdfDocument.getPage(pageNumber); const text = await page.getTextContent(); pages.push({ items: text.items.map((item) => ({ str: item.str, transform: item.transform, width: item.width, height: item.height })) }); document.querySelector("#import-progress").textContent = `Texto extraído: página ${pageNumber} de ${pdfDocument.numPages}`; }
        const parsed = window.OminiSaberCurriculumParser.parseCurriculumPages(pages, data);
        const extractedText = pages.map((page) => page.items.map((item) => item.str).join("\n")).join("\n\f\n");
        const result = await api().createCurriculumImport({ ...data, materia: data.materia || parsed.detected.materia_codigo, resumo: parsed.resumo, texto: extractedText }, parsed.items);
        if (result.duplicate) { toast("Este documento já foi importado."); return review(result.importacao, { ...parsed, items: result.items || parsed.items }); }
        await review(result.importacao, { ...parsed, items: result.items || parsed.items });
      } catch (error) { content().innerHTML = `<div class="panel"><h2>Não foi possível analisar o currículo</h2><p>${esc(error.message)}</p><button class="btn" id="retry-import">Voltar</button></div>`; document.querySelector("#retry-import").onclick = descriptorsPage; }
    };
    const open = async (x) => {
      const d = await modal(
        x ? "Editar descritor" : "Novo descritor",
        `<div class="form-grid"><label>Código<input class="field" name="codigo" value="${esc(x?.codigo)}" required></label><label>Matéria<select class="field" name="materia_codigo"><option value="portugues" ${x?.materia_codigo === "portugues" ? "selected" : ""}>Português</option><option value="matematica" ${x?.materia_codigo === "matematica" ? "selected" : ""}>Matemática</option><option value="fisica" ${x?.materia_codigo === "fisica" ? "selected" : ""}>Física</option><option value="redacao" ${x?.materia_codigo === "redacao" ? "selected" : ""}>Redação</option><option value="tecnico_administracao" ${x?.materia_codigo === "tecnico_administracao" ? "selected" : ""}>Administração</option><option value="tecnico_informatica" ${x?.materia_codigo === "tecnico_informatica" ? "selected" : ""}>Informática</option></select></label><label class="wide">Título<input class="field" name="titulo" value="${esc(x?.titulo)}" required></label><label>Série<select class="field" name="serie"><option>1</option><option>2</option><option>3</option></select></label><label>Trimestre<select class="field" name="trimestre"><option>1</option><option>2</option><option>3</option></select></label><label class="wide">Status<select class="field" name="status"><option value="ativo">Ativo</option><option value="revisao">Em revisão</option><option value="arquivado">Arquivado</option></select></label></div>`,
      );
      if (d) {
        await api().saveManagerDescriptor({ ...d, id: x?.id });
        toast("Descritor salvo.");
        descriptorsPage();
      }
    };
    document.querySelector("#new").onclick = openWizard;
    document
      .querySelectorAll(".edit")
      .forEach(
        (b) =>
          (b.onclick = () => open(rows.find((x) => x.id === b.dataset.id))),
      );
  };
  const publicationsPage = async () => {
    const d = await api().getManagerOverview(),
      rows = [
        ...d.trails.map((x) => ({ ...x, type: "Trilha", on: x.publicada })),
        ...d.labs.map((x) => ({
          ...x,
          type: "Laboratório",
          on: x.status === "publicado",
        })),
        ...d.evaluations.map((x) => ({
          ...x,
          type: "Avaliação",
          on: x.status === "publicada",
        })),
        ...d.prompts.map((x) => ({ ...x, type: "Redação", on: x.publicada })),
      ];
    content().innerHTML = `<div class="page-head"><div><h2>Conteúdos publicados</h2><p>Visão unificada do que já está disponível aos alunos.</p></div></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Conteúdo</th><th>Tipo</th><th>Turma</th><th>Estado</th><th>Criado em</th></tr></thead><tbody>${rows.map((x) => `<tr><td><b>${esc(x.titulo)}</b></td><td>${esc(x.type)}</td><td>${x.turma_id ? "Direcionado" : "Geral"}</td><td>${status(x.on, "Publicado", "Rascunho")}</td><td>${new Date(x.created_at).toLocaleDateString("pt-BR")}</td></tr>`).join("")}</tbody></table>${rows.length ? "" : empty("Nenhum conteúdo foi criado pelos professores.")}</div></div>`;
  };
  const accessPage = async () => {
    const rows = await api().listManagerProfiles();
    content().innerHTML = `<div class="page-head"><div><h2>Acessos e senhas</h2><p>Crie contas e emita senhas temporárias com segurança.</p></div><button class="btn btn-primary" id="new">${icon("person_add")} Criar conta</button></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Usuário</th><th>Tipo</th><th>Primeiro acesso</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rows.map((x) => `<tr><td><b>${esc(x.nome)}</b><br><small>${esc(x.email_contato || "—")}</small></td><td>${esc(x.role)}</td><td>${x.primeiro_acesso_pendente ? '<span class="badge warn">Pendente</span>' : "Concluído"}</td><td>${status(x.ativo !== false)}</td><td><button class="btn reset" data-id="${x.id}">${icon("key")} Nova senha</button> <button class="btn toggle" data-id="${x.id}" data-active="${x.ativo !== false}">${x.ativo !== false ? "Bloquear" : "Desbloquear"}</button></td></tr>`).join("")}</tbody></table></div></div>`;
    const reveal = async (result) => {
      await modal(
        "Credencial temporária",
        `<p>Copie agora. Esta senha não será armazenada nem exibida novamente.</p><div class="temp-password">${esc(result.temporaryPassword)}</div>`,
        `Fechar`,
      );
    };
    document.querySelector("#new").onclick = async () => {
      const d = await modal(
        "Criar nova conta",
        `<div class="form-grid"><label class="wide">Nome<input class="field" name="nome" required></label><label>E-mail<input class="field" type="email" name="email" required></label><label>Matrícula<input class="field" name="matricula"></label><label>Tipo<select class="field" name="role"><option value="aluno">Aluno</option><option value="professor">Professor</option><option value="bibliotecaria">Bibliotecária</option><option value="gestor">Gestor</option></select></label><label>Curso técnico<select class="field" name="curso_tecnico"><option value="administracao">Administração</option><option value="informatica">Informática</option></select></label><label class="wide">Especialidade docente<select class="field" name="tipo_professor"><option value="matematica">Matemática</option><option value="portugues">Português</option><option value="tecnico_administracao">Técnico em Administração</option><option value="tecnico_informatica">Técnico em Informática</option></select></label></div>`,
        "Criar conta",
      );
      if (d) reveal(await api().manageManagerAccess("create_user", d));
    };
    document
      .querySelectorAll(".reset")
      .forEach(
        (b) =>
          (b.onclick = async () =>
            reveal(
              await api().manageManagerAccess("reset_password", {
                userId: b.dataset.id,
              }),
            )),
      );
    document.querySelectorAll(".toggle").forEach(
      (b) =>
        (b.onclick = async () => {
          await api().manageManagerAccess("set_active", {
            userId: b.dataset.id,
            active: b.dataset.active !== "true",
          });
          toast("Situação da conta atualizada.");
          accessPage();
        }),
    );
  };
  const auditPage = async () => {
    const rows = await api().listManagerAudit();
    content().innerHTML = `<div class="page-head"><div><h2>Auditoria</h2><p>Registro somente leitura das ações administrativas.</p></div></div><div class="panel" style="padding:24px">${rows.map((x) => `<article class="audit-line"><b>${esc(x.acao)}</b> em ${esc(x.recurso)}<p>${esc(x.perfis?.nome || "Gestor")} · ${new Date(x.created_at).toLocaleString("pt-BR")}</p></article>`).join("") || empty("As próximas ações administrativas aparecerão aqui.")}</div>`;
  };
  const profilePage = async () => {
    const s = await api().getSession(),
      p = await api().getProfile(s.user.id);
    content().innerHTML = `<div class="page-head"><div><h2>Meu perfil</h2><p>Dados da conta administrativa.</p></div></div><div class="panel" style="padding:24px;max-width:700px"><form id="profile" class="form-grid"><label class="wide">Nome<input class="field" name="nome" value="${esc(p.nome)}" required></label><label class="wide">E-mail<input class="field" type="email" name="email" value="${esc(s.user.email)}" required></label><label>Função<input class="field" value="Gestor" disabled></label><label>Último acesso<input class="field" value="${p.ultimo_acesso_em ? new Date(p.ultimo_acesso_em).toLocaleString("pt-BR") : "Primeiro acesso"}" disabled></label><div class="wide"><button class="btn btn-primary">Salvar perfil</button> <button type="button" class="btn" id="logout">Sair</button></div></form></div>`;
    document.querySelector("#profile").onsubmit = async (e) => {
      e.preventDefault();
      await api().updateProfile(
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      toast("Perfil salvo.");
    };
    document.querySelector("#logout").onclick = () => api().signOut();
  };
  shell();
  document.addEventListener("ominisaber:ready", async () => {
    try {
      page === "dashboard" ? await dashboard() : await standardPage();
    } catch (error) {
      content().innerHTML = `<div class="empty">${icon("error")}<h3>Não foi possível carregar</h3><p>${esc(error.message)}</p><button class="btn" onclick="location.reload()">Tentar novamente</button></div>`;
    }
  });
})();
