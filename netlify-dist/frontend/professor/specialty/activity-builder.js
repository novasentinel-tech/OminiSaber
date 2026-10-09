(() => {
  "use strict";

  const TYPE_DEFS = {
    unica_escolha: {
      label: "Escolha única",
      icon: "radio_button_checked",
      group: "Objetiva",
      auto: true,
      description: "Uma resposta correta entre alternativas.",
    },
    multipla_escolha: {
      label: "Múltipla escolha",
      icon: "checklist",
      group: "Objetiva",
      auto: true,
      description: "Duas ou mais respostas podem estar corretas.",
    },
    verdadeiro_falso: {
      label: "Verdadeiro ou falso",
      icon: "rule",
      group: "Objetiva",
      auto: true,
      description: "Decisão rápida com correção imediata.",
    },
    numerica: {
      label: "Resposta numérica",
      icon: "pin",
      group: "Exata",
      auto: true,
      description: "Resposta numérica direta.",
    },
    calculo: {
      label: "Cálculo",
      icon: "calculate",
      group: "Exata",
      auto: true,
      description: "Problema com resultado numérico e resolução.",
    },
    resposta_curta: {
      label: "Resposta curta",
      icon: "short_text",
      group: "Escrita",
      auto: true,
      description: "Palavra, conceito ou frase breve.",
    },
    dissertativa: {
      label: "Dissertativa",
      icon: "notes",
      group: "Escrita",
      auto: false,
      description: "Resposta argumentada com revisão docente.",
    },
    estudo_caso: {
      label: "Estudo de caso",
      icon: "manage_search",
      group: "Investigação",
      auto: false,
      description: "Situação-problema com análise orientada.",
    },
    associacao: {
      label: "Associação",
      icon: "join",
      group: "Interativa",
      auto: true,
      description: "Relacione conceitos, exemplos e definições.",
    },
    ordenacao: {
      label: "Ordenação",
      icon: "sort",
      group: "Interativa",
      auto: true,
      description: "Organize etapas, fatos ou argumentos.",
    },
    codigo: {
      label: "Código",
      icon: "code",
      group: "Prática",
      auto: false,
      description: "Desafio de programação com revisão docente.",
    },
  };
  const INTERACTIVE_BLOCKS = {
    formula_quimica: {
      label: "Fórmula química",
      icon: "science",
      group: "Ciências",
      baseType: "resposta_curta",
      description: "Escreva compostos e permita que o aluno monte a fórmula por elementos.",
      defaults: {
        formula: "H₂O",
        formulaHint: "Combine os elementos e índices na ordem correta.",
        acceptedAnswers: ["H2O", "H₂O"],
      },
    },
    tabela_consultavel: {
      label: "Tabela consultável",
      icon: "table_view",
      group: "Dados",
      baseType: "unica_escolha",
      description: "Apresente dados pesquisáveis e ordenáveis antes da resposta.",
      defaults: {
        tableColumns: ["Item", "Valor"],
        tableRows: [["Amostra A", "10"], ["Amostra B", "20"]],
      },
    },
    formula_matematica: {
      label: "Fórmula matemática",
      icon: "function",
      group: "Exata",
      baseType: "calculo",
      description: "Mostre uma expressão, variáveis e um teclado matemático de apoio.",
      defaults: {
        mathExpression: "f(x) = 2x + 3",
        formulaVariables: "x = 4",
        tolerance: 0,
      },
    },
    plano_cartesiano: {
      label: "Plano cartesiano",
      icon: "grid_on",
      group: "Interativa",
      baseType: "resposta_curta",
      description: "Defina os eixos e peça que o aluno marque um ponto.",
      defaults: {
        mathMode: "plano_cartesiano",
        minX: -5,
        maxX: 5,
        minY: -5,
        maxY: 5,
        targetX: 2,
        targetY: 3,
      },
    },
  };
  const CATEGORY = {
    atividade: {
      label: "Atividade",
      icon: "extension",
      description: "Experiência guiada, prática e interativa.",
      accent: "#7c3aed",
    },
    avaliacao: {
      label: "Avaliação",
      icon: "assignment",
      description: "Instrumento formal com nota, prazo e regras claras.",
      accent: "#dc2626",
    },
    diagnostica: {
      label: "Diagnóstica",
      icon: "troubleshoot",
      description: "Mapeie conhecimentos prévios sem pressionar o aluno.",
      accent: "#0369a1",
    },
    recuperacao: {
      label: "Recuperação",
      icon: "replay",
      description: "Retome descritores com menor desempenho.",
      accent: "#047857",
    },
  };
  const CATEGORY_TYPES = {
    atividade: [
      "unica_escolha",
      "multipla_escolha",
      "verdadeiro_falso",
      "associacao",
      "ordenacao",
      "resposta_curta",
      "estudo_caso",
      "dissertativa",
      "numerica",
      "calculo",
      "codigo",
    ],
    avaliacao: [
      "unica_escolha",
      "multipla_escolha",
      "verdadeiro_falso",
      "numerica",
      "calculo",
      "resposta_curta",
      "dissertativa",
      "estudo_caso",
      "codigo",
    ],
    diagnostica: [
      "unica_escolha",
      "multipla_escolha",
      "verdadeiro_falso",
      "numerica",
      "resposta_curta",
      "associacao",
      "ordenacao",
      "estudo_caso",
    ],
    recuperacao: [
      "unica_escolha",
      "verdadeiro_falso",
      "resposta_curta",
      "associacao",
      "ordenacao",
      "numerica",
      "calculo",
      "estudo_caso",
    ],
  };
  const EXPERIENCE_STYLES = {
    atividade: [
      [
        "trilha_guiada",
        "Trilha guiada",
        "route",
        "Misture questões e avance em uma sequência curta.",
      ],
      [
        "oficina_interativa",
        "Oficina interativa",
        "interests",
        "Use associação, ordenação e investigação.",
      ],
      [
        "pratica_rapida",
        "Prática rápida",
        "bolt",
        "Poucas questões com foco e feedback imediato.",
      ],
    ],
    avaliacao: [
      [
        "prova_mista",
        "Prova mista",
        "fact_check",
        "Combine questões objetivas e abertas.",
      ],
      [
        "prova_objetiva",
        "Prova objetiva",
        "checklist",
        "Correção automática e leitura rápida dos resultados.",
      ],
    ],
    diagnostica: [
      [
        "sondagem",
        "Sondagem inicial",
        "radar",
        "Descubra o ponto de partida da turma.",
      ],
      [
        "mapa_descritores",
        "Mapa de descritores",
        "hub",
        "Distribua questões entre diferentes habilidades.",
      ],
    ],
    recuperacao: [
      [
        "retomada_guiada",
        "Retomada guiada",
        "replay_circle_filled",
        "Explique, pratique e confira a aprendizagem.",
      ],
      [
        "nova_tentativa",
        "Nova oportunidade",
        "refresh",
        "Reavalie os descritores priorizados.",
      ],
    ],
  };
  const BASE_SUBJECTS = [
    "matematica",
    "fisica",
    "quimica",
    "biologia",
    "portugues",
  ];
  const MANUAL_TYPES = new Set(["dissertativa", "codigo", "estudo_caso"]);
  const emptyQuestion = (type = "unica_escolha") => ({
    type,
    statement: "",
    alternatives: [],
    answer: "",
    explanation: "",
    points: 1,
    skillIds: [],
    required: true,
    configuration: {},
    answerConfiguration: {},
  });

  window.renderTeacherActivityBuilder = async ({
    content,
    data,
    api,
    config,
    escapeHtml,
    formatDate,
    toast,
    reload,
    initialClassId = "",
    initialTrimester = "",
    copyId = "",
  }) => {
    const { buildCopilotHandoff, buildIdeaContext, learningStages, learningTrailMetadata, publicLearningStage, hasCurriculumLink } = await import("./copilot-handoff.js?v=20261004-3");
    const state = {
      step: 1,
      questions: [],
      skills: [],
      selectedSkills: new Set(),
      editing: -1,
      loadingSkills: false,
      questionType: "unica_escolha",
      blockPreset: null,
      experienceStyle: "trilha_guiada",
      secureExam: false,
      mathMode: config.type === "matematica" ? "livre" : null,
      mathTemplatesCollapsed: false,
      outlineCollapsed: false,
      editorDirty: false,
      submitting: false,
      curriculumNeedsRelink: false,
      lastClassId: "",
      lastTrimester: "",
      lastCategory: "atividade",
      copilotTargetClassIds: [],
      learningTrail: null,
      copilotUndo: null,
      copilotRedo: false,
    };
    const e = escapeHtml;
    const validReferenceImage = (value) =>
      /^data:image\/(?:png|jpeg|webp);base64,/i.test(String(value || ""))
        ? String(value)
        : "";
    const optimizeReferenceImage = (file) =>
      new Promise((resolve, reject) => {
        if (!file?.type?.match(/^image\/(png|jpeg|webp)$/)) {
          reject(new Error("Use uma imagem PNG, JPG ou WebP."));
          return;
        }
        if (file.size > 8 * 1024 * 1024) {
          reject(new Error("A imagem deve ter no máximo 8 MB."));
          return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
        reader.onload = () => {
          const image = new Image();
          image.onerror = () => reject(new Error("A imagem selecionada é inválida."));
          image.onload = () => {
            const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.82));
          };
          image.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    const classes = data.classes || [];
    const classOption = (item) =>
      `<option value="${item.id}" data-series="${item.serie}">${e(item.nome)} · ${item.serie}º ano</option>`;
    const statusLabel = {
      rascunho: "Rascunho",
      publicado: "Publicado",
      encerrado: "Encerrado",
    };

    content.innerHTML = `<section class="activity-builder" data-activity-builder>
      <header class="builder-intro"><div><p class="eyebrow">Engine de atividades · Fase 3.1</p><h2>Crie com intenção pedagógica</h2><p>O formato escolhido transforma a seleção curricular, o editor e a experiência do aluno.</p></div><div class="builder-intro-actions"><div data-copilot-mount></div><button class="button secondary" type="button" data-open-corrections><span class="material-symbols-outlined">rate_review</span>Corrigir</button><button class="button secondary" type="button" data-open-results><span class="material-symbols-outlined">monitoring</span>Resultados</button><button class="button secondary" type="button" data-toggle-history><span class="material-symbols-outlined">history</span>Minhas atividades</button></div></header>
      <section class="notice" data-copilot-handoff hidden role="status"><div data-copilot-handoff-copy></div><button class="button secondary" type="button" data-copilot-undo>Restaurar rascunho anterior</button></section>
      ${
        classes.length
          ? `<nav class="builder-steps" aria-label="Etapas do construtor">${["Contexto", "Currículo", "Experiência", "Revisão"].map((label, index) => `<button type="button" data-step-button="${index + 1}"><span>${index + 1}</span><strong>${label}</strong></button>`).join("")}</nav>
      <form data-builder-form novalidate>
        <section class="builder-stage" data-step="1"><div class="stage-heading"><span>01</span><div><h3>Defina o contexto</h3><p>Escolha para quem, com qual objetivo e como a proposta será aplicada.</p></div></div><div class="builder-grid">
          <label>Título<input name="title" minlength="3" maxlength="140" required placeholder="${e(config.evaluationPlaceholder)}"></label>
          <label>Turma<select name="classId" required><option value="">Selecione uma turma</option>${classes.map(classOption).join("")}</select></label>
          <label>Formato<select name="category">${Object.entries(CATEGORY)
            .map(
              ([value, item]) =>
                `<option value="${value}">${item.label}</option>`,
            )
            .join("")}</select></label>
          <label>Trimestre<select name="trimester"><option value="">Não informar</option><option value="1">1º trimestre</option><option value="2">2º trimestre</option><option value="3">3º trimestre</option></select></label>
          <label>Duração estimada<input name="duration" type="number" min="5" max="300" value="50"><small>Em minutos</small></label>
          <label>Valor total<input name="value" type="number" min="0.1" max="1000" step="0.1" value="10"></label>
          <label class="wide">Orientações<textarea name="instructions" rows="4" maxlength="6000" placeholder="Explique critérios, materiais permitidos e objetivo da proposta."></textarea></label>
        </div><div data-format-panel></div></section>
        <section class="builder-stage curriculum-stage" data-step="2" hidden><div class="stage-heading"><span>02</span><div><h3>Conecte ao currículo</h3><p data-curriculum-copy>Selecione habilidades e descritores reais para orientar as questões.</p></div></div>
          <div class="curriculum-context" data-curriculum-context></div>
          <div class="skill-toolbar"><label>Buscar habilidade ou descritor<input data-skill-search type="search" placeholder="Digite um código, habilidade ou palavra-chave"></label><button class="button secondary" type="button" data-load-skills><span class="material-symbols-outlined">search</span>Buscar no currículo</button></div>
          <div class="selected-summary" data-selected-summary>Nenhuma habilidade selecionada.</div><div class="skill-results" data-skill-results><div class="builder-empty"><span class="material-symbols-outlined">travel_explore</span><p>Escolha a turma e consulte o catálogo curricular.</p></div></div>
        </section>
        <section class="builder-stage question-stage" data-step="3" hidden><div class="stage-heading"><span>03</span><div><h3 data-question-stage-title>Desenhe a experiência</h3><p data-question-stage-copy>Escolha um formato de questão e preencha somente o que ele precisa.</p></div></div>
          ${config.type === "matematica" ? '<section class="math-template-lab" data-math-template-lab aria-label="Modelos interativos de Matemática"></section>' : ""}
          <div class="question-composer"><aside class="type-rail"><header><span class="material-symbols-outlined">widgets</span><div><strong>Blocos disponíveis</strong><small data-type-count></small></div></header><div class="type-palette" data-type-palette></div></aside>
          <section class="dynamic-question-editor" data-question-editor></section></div>
          <aside class="question-outline" data-question-outline><header><div><span>ROTEIRO DA ATIVIDADE</span><strong data-question-counter>0 questões</strong></div><div class="outline-actions"><button type="button" data-toggle-outline aria-expanded="true"><span class="material-symbols-outlined">expand_less</span><b>Minimizar</b></button><button type="button" data-clear-questions title="Limpar roteiro"><span class="material-symbols-outlined">delete_sweep</span><b>Limpar</b></button></div></header><div data-outline-body><div class="question-list" data-question-list></div><div class="outline-total" data-outline-total></div></div></aside>
        </section>
        <section class="builder-stage" data-step="4" hidden><div class="stage-heading"><span>04</span><div><h3>Revise e publique</h3><p>Confira regras, datas e a experiência que o aluno receberá.</p></div></div>
          <div class="review-layout"><div data-review-preview></div><aside class="review-settings">
            <label>Distribuição da nota<select name="scoringMode"><option value="igual">Dividir igualmente</option><option value="manual">Definir por questão</option></select></label>
            <label>Tentativas permitidas<input name="attempts" type="number" min="1" max="10" value="1"></label>
            <label>Abertura<input name="opensAt" type="datetime-local"></label><label>Encerramento<input name="closesAt" type="datetime-local"></label>
            <label class="check"><input name="shuffleQuestions" type="checkbox"> Embaralhar questões</label><label class="check"><input name="shuffleAlternatives" type="checkbox"> Embaralhar alternativas</label>
            <label class="check"><input name="immediateFeedback" type="checkbox"> Feedback imediato</label><label class="check"><input name="showAnswerKey" type="checkbox"> Exibir gabarito após entrega</label>
          </aside></div>
        </section>
        <footer class="builder-footer"><button class="button secondary" type="button" data-previous>Voltar</button><p data-step-status>Etapa 1 de 4</p><button class="button primary" type="button" data-next>Continuar</button><div data-publish-actions hidden><button class="button secondary" name="intent" value="draft">Salvar rascunho</button><button class="button primary" name="intent" value="publish">Publicar para a turma</button></div></footer>
      </form>`
          : `<div class="builder-empty blocked"><span class="material-symbols-outlined">link_off</span><h3>Nenhuma turma vinculada a esta matéria</h3><p>Peça ao gestor para vincular sua conta à turma e à matéria. O construtor será liberado automaticamente.</p></div>`
      }
      <aside class="activity-history" data-history hidden><header><div><p class="eyebrow">Dados reais</p><h3>Atividades criadas</h3></div><button type="button" data-close-history aria-label="Fechar"><span class="material-symbols-outlined">close</span></button></header><div>${data.evaluations?.length ? data.evaluations.map((item) => `<article><span class="status ${item.status}">${statusLabel[item.status] || e(item.status)}</span><h4>${e(item.titulo)}</h4><p>${e(item.turmas?.nome || "Turma não informada")} · ${item.questoes_avaliacao?.length || 0} questão(ões)</p><small>${formatDate(item.created_at)}</small><button class="history-action" type="button" data-duplicate-evaluation="${item.id}"><span class="material-symbols-outlined">content_copy</span>Duplicar para editar</button></article>`).join("") : `<div class="builder-empty"><span class="material-symbols-outlined">assignment</span><p>Você ainda não criou atividades.</p></div>`}</div></aside>
    </section>`;
    if (!classes.length) return;

    const root = content.querySelector("[data-activity-builder]");
    const form = root.querySelector("[data-builder-form]");
    const field = (name) => form.elements.namedItem(name);
    const activeClass = () =>
      classes.find((item) => item.id === field("classId").value);
    const category = () => field("category").value;
    const currentTypes = () =>
      CATEGORY_TYPES[category()] || CATEGORY_TYPES.atividade;
    const defaultStyle = () =>
      EXPERIENCE_STYLES[category()]?.[0]?.[0] || "trilha_guiada";
    const selectedStyleLabel = () =>
      EXPERIENCE_STYLES[category()]?.find(
        ([value]) => value === state.experienceStyle,
      )?.[1] || "Experiência personalizada";

    const updatePageContext = () => {
      const subject = config.short || "sua matéria";
      const context = {
        atividade: {
          title: `Atividades de ${subject}`,
          subtitle:
            "Crie experiências práticas e interativas conectadas ao currículo.",
        },
        avaliacao: {
          title: `Avaliações de ${subject}`,
          subtitle:
            "Combine critérios claros, segurança e evidências de aprendizagem.",
        },
        diagnostica: {
          title: `Diagnóstico de ${subject}`,
          subtitle:
            "Mapeie conhecimentos prévios e identifique os próximos passos.",
        },
        recuperacao: {
          title: `Recuperação de ${subject}`,
          subtitle:
            "Retome os descritores com menor desempenho e reavalie a aprendizagem.",
        },
      }[category()];
      const topbar = document.querySelector(".portal-topbar");
      const heading = topbar?.querySelector("h1");
      const subtitle = heading?.nextElementSibling;
      if (heading) heading.textContent = context.title;
      if (subtitle) subtitle.textContent = context.subtitle;
      document.title = `${context.title} | OminiSaber`;
    };

    const renderFormatPanel = () => {
      const selected = CATEGORY[category()];
      const styles = EXPERIENCE_STYLES[category()] || [];
      updatePageContext();
      root.querySelector("[data-format-panel]").innerHTML =
        `<section class="format-panel" style="--format-accent:${selected.accent}"><header><span class="material-symbols-outlined">${selected.icon}</span><div><small>EXPERIÊNCIA ${selected.label.toUpperCase()}</small><h4>${selected.description}</h4></div></header><div class="experience-cards">${styles.map(([value, label, icon, description]) => `<button class="experience-card ${state.experienceStyle === value ? "selected" : ""}" type="button" data-experience="${value}"><span class="material-symbols-outlined">${icon}</span><strong>${label}</strong><small>${description}</small><i class="material-symbols-outlined">check_circle</i></button>`).join("")}</div>${category() === "avaliacao" ? `<div class="secure-exam-card ${state.secureExam ? "enabled" : ""}"><div class="secure-icon"><span class="material-symbols-outlined">shield_lock</span></div><div><strong>Prova Segura</strong><p>Solicita tela cheia, restringe copiar/colar e alerta quando o aluno troca de aba. O professor decide se quer ativar.</p><small>Limite técnico: um navegador não consegue bloquear DevTools nem comprovar uso de IA. Sinais suspeitos devem ir para revisão humana, nunca gerar nota zero automática.</small></div><button class="secure-toggle" type="button" role="switch" aria-checked="${state.secureExam}" data-secure-toggle><span></span><b>${state.secureExam ? "Ativada" : "Ativar"}</b></button></div>` : ""}</section>`;
      root.querySelectorAll("[data-experience]").forEach((button) =>
        button.addEventListener("click", () => {
          state.experienceStyle = button.dataset.experience;
          renderFormatPanel();
          renderCurriculumContext();
          renderTypePalette();
        }),
      );
      root
        .querySelector("[data-secure-toggle]")
        ?.addEventListener("click", () => {
          state.secureExam = !state.secureExam;
          renderFormatPanel();
        });
    };

    const renderCurriculumContext = () => {
      const selected = CATEGORY[category()];
      const copy = {
        atividade:
          "Escolha os objetivos que serão praticados durante a experiência.",
        avaliacao:
          "Defina exatamente quais aprendizagens serão avaliadas e comparadas.",
        diagnostica:
          "Selecione habilidades variadas para mapear o ponto de partida da turma.",
        recuperacao:
          "Priorize os descritores que precisam ser retomados e reavaliados.",
      }[category()];
      const requirement = BASE_SUBJECTS.includes(config.type)
        ? "Você pode montar e salvar o rascunho agora. Para publicar, vincule ao menos uma habilidade ou descritor a uma questão."
        : "Você pode continuar e salvar o rascunho sem selecionar habilidades.";
      root.querySelector("[data-curriculum-copy]").textContent = `${copy} ${requirement}`;
      root.querySelector("[data-curriculum-context]").innerHTML =
        `<span class="material-symbols-outlined" style="color:${selected.accent}">${selected.icon}</span><div><small>FORMATO ESCOLHIDO</small><strong>${selected.label} · ${selectedStyleLabel()}</strong><p>${copy}</p><small>${requirement}</small></div><b>${state.selectedSkills.size} selecionada(s)</b>`;
    };

    const refreshSelected = () => {
      const selected = [
        ...new Map(
          state.skills
            .filter((skill) => state.selectedSkills.has(skill.habilidade_id))
            .map((skill) => [skill.habilidade_id, skill]),
        ).values(),
      ];
      const selectedCount = selected.length || state.selectedSkills.size;
      root.querySelector("[data-selected-summary]").innerHTML = selectedCount
        ? `<div><span class="material-symbols-outlined">check_circle</span><strong>${selectedCount} habilidade(s) selecionada(s)</strong><small>As novas questões herdarão esses vínculos. Você poderá revisar antes de publicar.</small></div><div class="selected-codes">${selected.map((skill) => `<span>${e(skill.codigo)}</span>`).join("")}</div>`
        : `<div><span class="material-symbols-outlined">info</span><strong>Nenhuma habilidade selecionada</strong><small>Continue a criação e complete os vínculos curriculares antes de publicar, quando exigidos pela matéria.</small></div>`;
      renderCurriculumContext();
      const chips = root.querySelector("[data-question-skills]");
      if (chips)
        chips.innerHTML =
          selected.map((skill) => `<span>${e(skill.codigo)}</span>`).join("") ||
          (selectedCount
            ? `<small>${selectedCount} vínculo(s) curricular(es) preservado(s).</small>`
            : "<small>Volte à etapa 2 e selecione descritores.</small>");
    };

    const renderSkills = () => {
      const target = root.querySelector("[data-skill-results]");
      target.innerHTML = state.skills.length
        ? state.skills
            .map((skill) => {
              const descriptors = skill.descritores || [];
              return `<label class="skill-card"><input type="checkbox" value="${skill.habilidade_id}" ${state.selectedSkills.has(skill.habilidade_id) ? "checked" : ""}><span class="skill-check material-symbols-outlined">check</span><div class="skill-card-body"><header><strong>${e(skill.codigo)}</strong><span>${skill.serie}º ano</span><span>${skill.trimestre}º trimestre</span></header><p>${e(skill.descricao)}</p>${descriptors.length ? `<div class="descriptor-list"><small>DESCRITORES RELACIONADOS</small>${descriptors.map((descriptor) => `<em><b>${e(descriptor.codigo)}</b>${e(descriptor.descricao || "")}</em>`).join("")}</div>` : `<small class="no-descriptor">Sem descritor complementar cadastrado.</small>`}</div></label>`;
            })
            .join("")
        : `<div class="builder-empty"><span class="material-symbols-outlined">search_off</span><p>Nenhuma habilidade encontrada para os filtros atuais.</p></div>`;
      target.querySelectorAll("input").forEach((input) =>
        input.addEventListener("change", () => {
          input.checked
            ? state.selectedSkills.add(input.value)
            : state.selectedSkills.delete(input.value);
          refreshSelected();
        }),
      );
    };

    const loadSkills = async () => {
      const selectedClass = activeClass();
      if (!selectedClass)
        return toast("Selecione uma turma na primeira etapa.", "error");
      state.loadingSkills = true;
      root.querySelector("[data-skill-results]").innerHTML =
        `<div class="builder-empty"><span class="material-symbols-outlined spin">progress_activity</span><p>Consultando o catálogo curricular...</p></div>`;
      try {
        state.skills = await api.listCurriculumSkills({
          materia: config.type,
          serie: selectedClass.serie,
          trimestre: Number(field("trimester").value) || null,
          search: root.querySelector("[data-skill-search]").value.trim(),
        });
        renderSkills();
      } catch (error) {
        toast(error.message, "error");
        root.querySelector("[data-skill-results]").innerHTML =
          `<div class="builder-empty"><p>${e(error.message)}</p></div>`;
      } finally {
        state.loadingSkills = false;
      }
    };

    const questionValue = (question, key, fallback = "") =>
      question?.answerConfiguration?.[key] ??
      question?.configuration?.[key] ??
      fallback;
    const interactiveBlock = (question = null) => {
      const key = question?.configuration?.activityBlock || state.blockPreset;
      return key && INTERACTIVE_BLOCKS[key]
        ? { key, ...INTERACTIVE_BLOCKS[key] }
        : null;
    };
    const interactiveBlockQuestion = (key) => {
      const block = INTERACTIVE_BLOCKS[key];
      const question = emptyQuestion(block.baseType);
      question.configuration = {
        activityBlock: key,
        ...structuredClone(block.defaults),
      };
      if (key === "tabela_consultavel") {
        question.alternatives = ["Amostra A", "Amostra B"];
        question.answer = "Amostra B";
      }
      return question;
    };
    const questionDefinition = (question) =>
      INTERACTIVE_BLOCKS[question?.configuration?.activityBlock] ||
      TYPE_DEFS[question?.type] || { label: question?.type || "Questão", icon: "quiz" };
    const mathTemplate = (value = state.mathMode) =>
      config.mathTemplates?.find((item) => item.value === value) || null;
    const numberValue = (value, fallback = 0) => {
      const parsed = Number(String(value ?? "").replace(",", "."));
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const parseChartRows = (value = "") =>
      String(value)
        .split("\n")
        .map((line) => {
          const [label, rawValue] = line.split("|");
          return {
            label: String(label || "").trim(),
            value: numberValue(rawValue, Number.NaN),
          };
        })
        .filter((item) => item.label && Number.isFinite(item.value));
    const GEOMETRY_SHAPES = {
      quadrado: {
        label: "Quadrado",
        dimension: "2d",
        measures: [["measureA", "Lado", 4]],
      },
      retangulo: {
        label: "Retângulo",
        dimension: "2d",
        measures: [
          ["measureA", "Base", 6],
          ["measureB", "Altura", 4],
        ],
      },
      triangulo: {
        label: "Triângulo",
        dimension: "2d",
        measures: [
          ["measureA", "Base", 6],
          ["measureB", "Altura", 4],
          ["measureC", "Lado B", 5],
          ["measureD", "Lado C", 5],
        ],
      },
      circulo: {
        label: "Círculo",
        dimension: "2d",
        measures: [["measureA", "Raio", 3]],
      },
      trapezio: {
        label: "Trapézio",
        dimension: "2d",
        measures: [
          ["measureA", "Base maior", 8],
          ["measureB", "Base menor", 4],
          ["measureC", "Altura", 3],
          ["measureD", "Lado", 4],
        ],
      },
      losango: {
        label: "Losango",
        dimension: "2d",
        measures: [
          ["measureA", "Diagonal maior", 8],
          ["measureB", "Diagonal menor", 5],
          ["measureC", "Lado", 4.7],
        ],
      },
      poligono_regular: {
        label: "Polígono regular",
        dimension: "2d",
        measures: [
          ["measureA", "Lado", 4],
          ["measureB", "Apótema", 3],
        ],
        sides: true,
      },
      personalizada_2d: {
        label: "Figura 2D personalizada",
        dimension: "2d",
        custom: true,
        measures: [
          ["measureA", "Medida A", 5],
          ["measureB", "Medida B", 4],
          ["measureC", "Medida C", 3],
          ["measureD", "Medida D", 2],
        ],
      },
      cubo: {
        label: "Cubo",
        dimension: "3d",
        measures: [["measureA", "Aresta", 4]],
      },
      paralelepipedo: {
        label: "Paralelepípedo",
        dimension: "3d",
        measures: [
          ["measureA", "Comprimento", 7],
          ["measureB", "Largura", 4],
          ["measureC", "Altura", 3],
        ],
      },
      cilindro: {
        label: "Cilindro",
        dimension: "3d",
        measures: [
          ["measureA", "Raio", 3],
          ["measureB", "Altura", 7],
        ],
      },
      cone: {
        label: "Cone",
        dimension: "3d",
        measures: [
          ["measureA", "Raio", 3],
          ["measureB", "Altura", 7],
          ["measureC", "Geratriz", 7.6],
        ],
      },
      esfera: {
        label: "Esfera",
        dimension: "3d",
        measures: [["measureA", "Raio", 4]],
      },
      prisma: {
        label: "Prisma regular",
        dimension: "3d",
        measures: [
          ["measureA", "Área da base", 12],
          ["measureB", "Perímetro da base", 14],
          ["measureC", "Altura", 6],
        ],
        sides: true,
      },
      piramide: {
        label: "Pirâmide regular",
        dimension: "3d",
        measures: [
          ["measureA", "Área da base", 16],
          ["measureB", "Perímetro da base", 16],
          ["measureC", "Altura", 6],
          ["measureD", "Apótema lateral", 7.2],
        ],
        sides: true,
      },
      personalizada_3d: {
        label: "Sólido 3D personalizado",
        dimension: "3d",
        custom: true,
        measures: [
          ["measureA", "Medida A", 5],
          ["measureB", "Medida B", 4],
          ["measureC", "Medida C", 3],
          ["measureD", "Medida D", 2],
        ],
      },
    };
    const GEOMETRY_TARGETS = {
      "2d": [
        ["area", "Área"],
        ["perimetro", "Perímetro"],
        ["diagonal", "Diagonal"],
        ["medida_desconhecida", "Medida desconhecida"],
      ],
      "3d": [
        ["volume", "Volume"],
        ["area_total", "Área total"],
        ["area_lateral", "Área lateral"],
        ["medida_desconhecida", "Medida desconhecida"],
      ],
    };
    const geometryDefinition = (shape, dimension = "2d") =>
      GEOMETRY_SHAPES[shape] ||
      Object.values(GEOMETRY_SHAPES).find(
        (item) => item.dimension === dimension,
      );
    const geometryShapeOptions = (dimension, selected) =>
      Object.entries(GEOMETRY_SHAPES)
        .filter(([, item]) => item.dimension === dimension)
        .map(
          ([value, item]) =>
            `<option value="${value}" ${value === selected ? "selected" : ""}>${e(item.label)}</option>`,
        )
        .join("");
    const geometryTargetOptions = (dimension, selected) =>
      GEOMETRY_TARGETS[dimension]
        .map(
          ([value, label]) =>
            `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`,
        )
        .join("");
    const geometrySvgMarkup = (values = {}) => {
      const dimension = values.dimension === "3d" ? "3d" : "2d";
      const shape = geometryDefinition(values.shape, dimension);
      const shapeKey = GEOMETRY_SHAPES[values.shape]
        ? values.shape
        : dimension === "3d"
          ? "cubo"
          : "quadrado";
      const unit = e(values.unit || "cm");
      const number = (key, fallback) =>
        numberValue(values[key], fallback).toLocaleString("pt-BR");
      const measureLabels = (shape.measures || [])
        .map(
          ([key, label, fallback], index) =>
            `<span><b>${e(shape.custom ? values[`label${String.fromCharCode(65 + index)}`] || label : label)}:</b> ${number(key, fallback)} ${unit}</span>`,
        )
        .join("");
      let drawing = "";
      if (shapeKey === "quadrado" || shapeKey === "retangulo")
        drawing = `<rect x="75" y="40" width="210" height="145" rx="4"></rect><line x1="75" y1="205" x2="285" y2="205"></line><line x1="305" y1="40" x2="305" y2="185"></line>`;
      else if (shapeKey === "triangulo")
        drawing = `<polygon points="70,185 290,185 205,38"></polygon><line x1="205" y1="38" x2="205" y2="185" class="geometry-guide"></line>`;
      else if (shapeKey === "circulo")
        drawing = `<circle cx="180" cy="115" r="78"></circle><line x1="180" y1="115" x2="258" y2="115"></line><circle cx="180" cy="115" r="4" class="geometry-point"></circle>`;
      else if (shapeKey === "trapezio")
        drawing = `<polygon points="55,185 305,185 255,48 105,48"></polygon><line x1="105" y1="48" x2="105" y2="185" class="geometry-guide"></line>`;
      else if (shapeKey === "losango")
        drawing = `<polygon points="180,28 315,115 180,202 45,115"></polygon><line x1="45" y1="115" x2="315" y2="115" class="geometry-guide"></line><line x1="180" y1="28" x2="180" y2="202" class="geometry-guide"></line>`;
      else if (["poligono_regular", "personalizada_2d"].includes(shapeKey))
        drawing = `<polygon points="180,28 292,86 270,188 90,188 68,86"></polygon><line x1="180" y1="115" x2="180" y2="188" class="geometry-guide"></line>`;
      else if (
        ["cubo", "paralelepipedo", "prisma", "personalizada_3d"].includes(
          shapeKey,
        )
      )
        drawing = `<polygon points="75,80 235,80 295,42 135,42"></polygon><polygon points="235,80 295,42 295,165 235,205"></polygon><rect x="75" y="80" width="160" height="125"></rect><line x1="75" y1="80" x2="135" y2="42"></line><line x1="75" y1="205" x2="135" y2="165" class="geometry-guide"></line><line x1="135" y1="42" x2="135" y2="165" class="geometry-guide"></line><line x1="135" y1="165" x2="295" y2="165" class="geometry-guide"></line>`;
      else if (shapeKey === "cilindro")
        drawing = `<ellipse cx="180" cy="55" rx="82" ry="28"></ellipse><path d="M98 55 V174 C98 190 135 203 180 203 C225 203 262 190 262 174 V55"></path><ellipse cx="180" cy="174" rx="82" ry="28" class="geometry-guide"></ellipse>`;
      else if (shapeKey === "cone")
        drawing = `<ellipse cx="180" cy="178" rx="88" ry="29"></ellipse><path d="M92 178 L180 30 L268 178"></path><line x1="180" y1="30" x2="180" y2="178" class="geometry-guide"></line>`;
      else if (shapeKey === "esfera")
        drawing = `<circle cx="180" cy="115" r="88"></circle><ellipse cx="180" cy="115" rx="88" ry="28" class="geometry-guide"></ellipse><path d="M180 27 C135 57 135 173 180 203 C225 173 225 57 180 27" class="geometry-guide"></path>`;
      else
        drawing = `<polygon points="180,25 300,180 60,180"></polygon><polygon points="60,180 300,180 255,210 105,210"></polygon><line x1="180" y1="25" x2="180" y2="195" class="geometry-guide"></line>`;
      return `<div class="geometry-visual ${dimension}" data-geometry-visual><svg viewBox="0 0 360 235" role="img" aria-label="${e(shape.label)} com medidas configuradas"><g>${drawing}</g></svg><div class="geometry-measure-legend">${measureLabels}${shape.sides ? `<span><b>Lados da base:</b> ${Math.max(3, Math.round(numberValue(values.sides, 5)))}</span>` : ""}</div></div>`;
    };
    const mathPreviewMarkup = (mode, values = {}) => {
      if (mode === "plano_cartesiano") {
        const minX = numberValue(values.minX, -5);
        const maxX = Math.max(minX + 1, numberValue(values.maxX, 5));
        const minY = numberValue(values.minY, -5);
        const maxY = Math.max(minY + 1, numberValue(values.maxY, 5));
        const x = Math.min(maxX, Math.max(minX, numberValue(values.targetX)));
        const y = Math.min(maxY, Math.max(minY, numberValue(values.targetY)));
        const left = ((x - minX) / (maxX - minX)) * 100;
        const top = 100 - ((y - minY) / (maxY - minY)) * 100;
        return `<div class="math-preview-plane" role="img" aria-label="Plano cartesiano com o ponto ${x}, ${y}"><span class="axis axis-x"></span><span class="axis axis-y"></span><i style="--point-x:${left}%;--point-y:${top}%"></i><b>(${x}; ${y})</b></div>`;
      }
      if (mode === "reta_numerica") {
        const min = numberValue(values.min, -5);
        const max = Math.max(min + 1, numberValue(values.max, 5));
        const target = Math.min(
          max,
          Math.max(min, numberValue(values.target, 0)),
        );
        const position = ((target - min) / (max - min)) * 100;
        return `<div class="math-preview-line" role="img" aria-label="Reta numérica de ${min} a ${max}, resposta ${target}"><span>${min}</span><div><i style="--line-point:${position}%"></i></div><span>${max}</span><b>${target}</b></div>`;
      }
      if (mode === "pitagoras") {
        const sideA = numberValue(values.sideA, 3);
        const sideB = numberValue(values.sideB, 4);
        const sideC = numberValue(values.sideC, 5);
        const unit = e(values.unit || "u");
        return `<div class="math-preview-triangle"><svg viewBox="0 0 260 190" role="img" aria-label="Triângulo retângulo com catetos ${sideA} e ${sideB} e hipotenusa ${sideC} ${unit}"><path class="triangle-shape" d="M42 24 V154 H232 Z"></path><path class="right-angle-mark" d="M42 134 H62 V154"></path><text class="triangle-label side-a" x="14" y="94">${sideA} ${unit}</text><text class="triangle-label side-b" x="126" y="181">${sideB} ${unit}</text><text class="triangle-label side-c" x="145" y="75" transform="rotate(34 145 75)">${sideC} ${unit}</text></svg></div>`;
      }
      if (mode === "geometria_medidas") {
        const dimension = values.dimension === "3d" ? "3d" : "2d";
        const definition = geometryDefinition(values.shape, dimension);
        const shapeLabel = definition.custom
          ? values.customName || definition.label
          : definition.label;
        const targetLabel =
          GEOMETRY_TARGETS[dimension].find(
            ([value]) => value === values.targetType,
          )?.[1] || GEOMETRY_TARGETS[dimension][0][1];
        return `<div class="geometry-teacher-preview"><header><div><small>PRÉVIA DO ALUNO</small><strong>${e(shapeLabel)}</strong></div><span>${dimension.toUpperCase()} · calcular ${e(targetLabel.toLowerCase())}</span></header>${geometrySvgMarkup(values)}</div>`;
      }
      if (mode === "grafico_barras") {
        const rows = parseChartRows(values.chartRows);
        const max = Math.max(1, ...rows.map((item) => Math.abs(item.value)));
        return `<div class="math-preview-bars ${rows.length ? "" : "empty"}" role="img" aria-label="Prévia de gráfico com ${rows.length} categorias">${rows.length ? rows.map((item) => `<div><span style="--bar-size:${Math.max(5, (Math.abs(item.value) / max) * 100)}%"><b>${item.value}</b></span><small>${e(item.label)}</small></div>`).join("") : `<div class="chart-empty-example" aria-hidden="true"><span style="--bar-size:42%"></span><span style="--bar-size:72%"></span><span style="--bar-size:56%"></span></div><p><strong>Seu gráfico aparecerá aqui</strong><small>Digite ao menos duas linhas no formato Categoria | valor.</small></p>`}</div>`;
      }
      return "";
    };
    const mathSpecificFields = (mode, question) => {
      if (!mode || mode === "livre") return "";
      if (mode === "plano_cartesiano") {
        const answer = String(question.answer || "0;0").split(";");
        return `<section class="editor-section math-config-section"><div class="section-title"><span>2</span><div><strong>Configure o plano cartesiano</strong><small>O aluno tocará ou clicará no ponto que considera correto.</small></div></div><div class="math-config-grid"><label>Eixo X mínimo<input data-math-field="minX" type="number" value="${e(questionValue(question, "minX", -5))}"></label><label>Eixo X máximo<input data-math-field="maxX" type="number" value="${e(questionValue(question, "maxX", 5))}"></label><label>Eixo Y mínimo<input data-math-field="minY" type="number" value="${e(questionValue(question, "minY", -5))}"></label><label>Eixo Y máximo<input data-math-field="maxY" type="number" value="${e(questionValue(question, "maxY", 5))}"></label><label>Coordenada X correta<input data-math-field="targetX" type="number" step="1" value="${e(questionValue(question, "targetX", answer[0] || 0))}"></label><label>Coordenada Y correta<input data-math-field="targetY" type="number" step="1" value="${e(questionValue(question, "targetY", answer[1] || 0))}"></label></div><div class="math-live-preview" data-math-preview></div></section>`;
      }
      if (mode === "reta_numerica")
        return `<section class="editor-section math-config-section"><div class="section-title"><span>2</span><div><strong>Configure a reta numérica</strong><small>O aluno moverá o marcador até o valor escolhido.</small></div></div><div class="math-config-grid"><label>Valor mínimo<input data-math-field="min" type="number" step="any" value="${e(questionValue(question, "min", 0))}"></label><label>Valor máximo<input data-math-field="max" type="number" step="any" value="${e(questionValue(question, "max", 10))}"></label><label>Intervalo<input data-math-field="step" type="number" min="0.001" step="any" value="${e(questionValue(question, "step", 0.5))}"></label><label>Resposta correta<input data-math-field="target" type="number" step="any" value="${e(questionValue(question, "target", question.answer || 0))}"></label></div><div class="math-live-preview" data-math-preview></div></section>`;
      if (mode === "pitagoras")
        return `<section class="editor-section math-config-section"><div class="section-title"><span>2</span><div><strong>Configure o triângulo</strong><small>Informe as medidas que aparecerão no desenho e a resposta esperada.</small></div></div><div class="math-config-grid"><label>Cateto A<input data-math-field="sideA" type="number" min="0" step="any" value="${e(questionValue(question, "sideA", 3))}"></label><label>Cateto B<input data-math-field="sideB" type="number" min="0" step="any" value="${e(questionValue(question, "sideB", 4))}"></label><label>Hipotenusa<input data-math-field="sideC" type="number" min="0" step="any" value="${e(questionValue(question, "sideC", 5))}"></label><label>Unidade<input data-math-field="unit" maxlength="12" value="${e(questionValue(question, "unit", "m"))}"></label><label>Resposta correta<input data-math-field="target" type="number" step="any" value="${e(questionValue(question, "target", question.answer || 5))}"></label></div><label class="editor-label">Resolução de referência<textarea data-math-field="solution" rows="4" placeholder="Registre o cálculo esperado para a devolutiva.">${e(questionValue(question, "solution"))}</textarea></label><div class="math-live-preview" data-math-preview></div></section>`;
      if (mode === "geometria_medidas") {
        const dimension =
          questionValue(question, "dimension", "2d") === "3d" ? "3d" : "2d";
        const savedShape = questionValue(
          question,
          "shape",
          dimension === "3d" ? "cubo" : "quadrado",
        );
        const definition = geometryDefinition(savedShape, dimension);
        const targetType = questionValue(
          question,
          "targetType",
          dimension === "3d" ? "volume" : "area",
        );
        const measureFields = definition.measures
          .map(
            ([key, label, fallback], index) =>
              `<label data-geometry-measure><span>${e(definition.custom ? questionValue(question, `label${String.fromCharCode(65 + index)}`, label) || label : label)}</span><input data-math-field="${key}" type="number" min="0.000001" step="any" value="${e(questionValue(question, key, fallback))}"></label>`,
          )
          .join("");
        return `<section class="editor-section math-config-section geometry-config-section"><div class="section-title"><span>2</span><div><strong>Laboratório de medidas</strong><small>Escolha uma figura plana ou um sólido, informe as medidas e defina o que o aluno deve calcular.</small></div></div><div class="geometry-kind-grid"><label>Dimensão<select data-math-field="dimension" data-geometry-dimension><option value="2d" ${dimension === "2d" ? "selected" : ""}>Figura 2D</option><option value="3d" ${dimension === "3d" ? "selected" : ""}>Sólido 3D</option></select></label><label>Forma geométrica<select data-math-field="shape" data-geometry-shape>${geometryShapeOptions(dimension, savedShape)}</select></label><label>O aluno calculará<select data-math-field="targetType" data-geometry-target>${geometryTargetOptions(dimension, targetType)}</select></label></div><div class="geometry-custom-fields" data-geometry-custom ${definition.custom ? "" : "hidden"}><label>Nome da forma<input data-math-field="customName" maxlength="80" value="${e(questionValue(question, "customName", "Forma personalizada"))}" placeholder="Ex.: terreno irregular"></label><div><label>Nome da medida A<input data-math-field="labelA" maxlength="30" value="${e(questionValue(question, "labelA", "Medida A"))}"></label><label>Nome da medida B<input data-math-field="labelB" maxlength="30" value="${e(questionValue(question, "labelB", "Medida B"))}"></label><label>Nome da medida C<input data-math-field="labelC" maxlength="30" value="${e(questionValue(question, "labelC", "Medida C"))}"></label><label>Nome da medida D<input data-math-field="labelD" maxlength="30" value="${e(questionValue(question, "labelD", "Medida D"))}"></label></div></div><div class="math-config-grid geometry-measure-grid" data-geometry-measure-fields>${measureFields}${definition.sides ? `<label>Número de lados da base<input data-math-field="sides" type="number" min="3" max="20" step="1" value="${e(questionValue(question, "sides", 5))}"></label>` : ""}</div><div class="math-config-grid geometry-answer-grid"><label>Unidade<input data-math-field="unit" maxlength="12" value="${e(questionValue(question, "unit", "cm"))}" placeholder="cm, m, km..."></label><label>Resposta correta<input data-math-field="target" type="number" step="any" value="${e(questionValue(question, "target", question.answer || 16))}"></label><label>Tolerância aceita<input data-math-field="tolerance" type="number" min="0" step="0.001" value="${e(questionValue(question, "tolerance", 0.01))}"></label></div><label class="editor-label">Resolução de referência<textarea data-math-field="solution" rows="4" placeholder="Registre fórmula, substituição dos valores e resultado.">${e(questionValue(question, "solution"))}</textarea></label><aside class="geometry-interaction-note"><span class="material-symbols-outlined">touch_app</span><div><strong>Experiência do aluno</strong><small>Ele poderá girar, ampliar e ocultar ou revelar as medidas sem alterar os valores definidos na questão.</small></div></aside><div class="math-live-preview" data-math-preview></div></section>`;
      }
      if (mode === "grafico_barras") {
        const chartRows = questionValue(
          question,
          "chartRows",
          (question.alternatives || [])
            .map((label) => `${label} | 1`)
            .join("\n"),
        );
        return `<section class="editor-section math-config-section"><div class="section-title"><span>2</span><div><strong>Configure o gráfico</strong><small>Uma categoria por linha. Exemplo: Janeiro | 120.</small></div></div><label class="editor-label">Categorias e valores<textarea data-math-field="chartRows" rows="5" placeholder="Categoria A | 12\nCategoria B | 18">${e(chartRows)}</textarea></label><div class="math-config-grid"><label>Categoria correta<input data-math-field="correctLabel" value="${e(questionValue(question, "correctLabel", question.answer || ""))}" placeholder="Digite exatamente um rótulo"></label><label>Título do eixo vertical<input data-math-field="axisLabel" value="${e(questionValue(question, "axisLabel", "Quantidade"))}" placeholder="Ex.: Quantidade"></label></div><div class="math-live-preview" data-math-preview></div></section>`;
      }
      return "";
    };
    const readMathEditorValues = (editor) =>
      Object.fromEntries(
        [...editor.querySelectorAll("[data-math-field]")].map((input) => [
          input.dataset.mathField,
          input.value.trim(),
        ]),
      );
    const renderMathPreview = () => {
      const editor = root.querySelector("[data-question-editor]");
      const target = editor.querySelector("[data-math-preview]");
      if (!target) return;
      target.innerHTML = mathPreviewMarkup(
        state.mathMode,
        readMathEditorValues(editor),
      );
    };
    const updateGeometryEditor = (editor) => {
      if (state.mathMode !== "geometria_medidas") return;
      const values = readMathEditorValues(editor);
      const dimension = values.dimension === "3d" ? "3d" : "2d";
      const shapeSelect = editor.querySelector("[data-geometry-shape]");
      const currentDefinition = GEOMETRY_SHAPES[values.shape];
      const shape =
        currentDefinition?.dimension === dimension
          ? values.shape
          : dimension === "3d"
            ? "cubo"
            : "quadrado";
      const definition = geometryDefinition(shape, dimension);
      shapeSelect.innerHTML = geometryShapeOptions(dimension, shape);
      const target = editor.querySelector("[data-geometry-target]");
      const targetType = GEOMETRY_TARGETS[dimension].some(
        ([value]) => value === values.targetType,
      )
        ? values.targetType
        : dimension === "3d"
          ? "volume"
          : "area";
      target.innerHTML = geometryTargetOptions(dimension, targetType);
      editor.querySelector("[data-geometry-custom]").hidden =
        !definition.custom;
      editor.querySelector("[data-geometry-measure-fields]").innerHTML =
        definition.measures
          .map(([key, label, fallback], index) => {
            const customLabel = definition.custom
              ? values[`label${String.fromCharCode(65 + index)}`] || label
              : label;
            return `<label data-geometry-measure><span>${e(customLabel)}</span><input data-math-field="${key}" type="number" min="0.000001" step="any" value="${e(values[key] || fallback)}"></label>`;
          })
          .join("") +
        (definition.sides
          ? `<label>Número de lados da base<input data-math-field="sides" type="number" min="3" max="20" step="1" value="${e(values.sides || 5)}"></label>`
          : "");
      renderMathPreview();
    };
    const canReplaceEditor = (message) =>
      !state.editorDirty ||
      window.confirm(
        message ||
          "Você começou a preencher esta questão. Trocar o formato limpará os campos que ainda não foram adicionados ao roteiro. Deseja continuar?",
      );
    const renderMathTemplateLab = () => {
      const target = root.querySelector("[data-math-template-lab]");
      if (!target) return;
      const selectedTemplate = mathTemplate();
      target.innerHTML = `<header><div><small>ATELIÊ MATEMÁTICO</small><strong>Escolha como o aluno vai raciocinar</strong></div><div class="math-template-header-actions"><span>${state.mathTemplatesCollapsed ? `Selecionado: ${e(selectedTemplate?.label || "Questão livre")}` : "Modelos inspirados nos descritores do PAEBES"}</span><button type="button" data-toggle-math-templates aria-expanded="${!state.mathTemplatesCollapsed}"><span class="material-symbols-outlined">${state.mathTemplatesCollapsed ? "expand_more" : "expand_less"}</span>${state.mathTemplatesCollapsed ? "Mostrar modelos" : "Recolher modelos"}</button></div></header><div class="math-template-grid" role="radiogroup" aria-label="Modelo matemático" ${state.mathTemplatesCollapsed ? "hidden" : ""}>${config.mathTemplates.map((item) => `<button type="button" role="radio" class="math-template-card ${state.mathMode === item.value ? "selected" : ""}" data-math-template="${item.value}" aria-checked="${state.mathMode === item.value}" tabindex="${state.mathMode === item.value ? "0" : "-1"}"><span class="material-symbols-outlined">${item.icon}</span><div><strong>${e(item.label)}</strong><small>${e(item.description)}</small><em>${e(item.descriptors)}</em></div><i class="material-symbols-outlined">check_circle</i></button>`).join("")}</div>`;

      const selectTemplate = (value, focusSelected = false) => {
        if (value === state.mathMode) return;
        if (!canReplaceEditor()) return;
        const selected = mathTemplate(value);
        state.blockPreset = null;
        state.mathMode = selected.value;
        state.questionType = selected.questionType;
        state.editing = -1;
        renderMathTemplateLab();
        renderQuestionEditor(emptyQuestion(state.questionType));
        const editor = root.querySelector("[data-question-editor]");
        editor.scrollIntoView({ behavior: "smooth", block: "start" });
        if (focusSelected)
          root
            .querySelector(`[data-math-template="${selected.value}"]`)
            ?.focus();
      };

      target
        .querySelector("[data-toggle-math-templates]")
        ?.addEventListener("click", () => {
          state.mathTemplatesCollapsed = !state.mathTemplatesCollapsed;
          renderMathTemplateLab();
        });
      target.querySelectorAll("[data-math-template]").forEach((button) => {
        button.addEventListener("click", () =>
          selectTemplate(button.dataset.mathTemplate),
        );
        button.addEventListener("keydown", (event) => {
          if (
            !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
              event.key,
            )
          )
            return;
          event.preventDefault();
          const buttons = [...target.querySelectorAll("[data-math-template]")];
          const offset = ["ArrowRight", "ArrowDown"].includes(event.key)
            ? 1
            : -1;
          const next =
            buttons[
              (buttons.indexOf(button) + offset + buttons.length) %
                buttons.length
            ];
          selectTemplate(next.dataset.mathTemplate, true);
        });
      });
    };
    const optionRows = (question, multiple = false) => {
      const options = question?.alternatives?.length
        ? question.alternatives
        : ["", ""];
      const answers = Array.isArray(question?.answer)
        ? question.answer
        : [question?.answer];
      return `<div class="choice-options" data-choice-options>${options.map((option, index) => `<div class="choice-row" data-option-row><label title="Marcar como correta"><input type="${multiple ? "checkbox" : "radio"}" name="correct-option" ${answers.includes(option) && option ? "checked" : ""}><span class="material-symbols-outlined">${multiple ? "check_box" : "radio_button_checked"}</span></label><b>${String.fromCharCode(65 + index)}</b><input data-option-text value="${e(typeof option === "string" ? option : "")}" placeholder="Escreva a alternativa"><button type="button" data-remove-option aria-label="Remover alternativa"><span class="material-symbols-outlined">close</span></button></div>`).join("")}</div><button class="inline-add" type="button" data-add-option><span class="material-symbols-outlined">add</span>Adicionar alternativa</button>`;
    };
    const pairRows = (question) => {
      const pairs = question?.configuration?.pairs?.length
        ? question.configuration.pairs
        : [
            { left: "", right: "" },
            { left: "", right: "" },
          ];
      return `<div class="pair-options" data-pair-options>${pairs.map((pair) => `<div class="pair-row" data-pair-row><input data-pair-left value="${e(pair.left)}" placeholder="Conceito ou item"><span class="material-symbols-outlined">sync_alt</span><input data-pair-right value="${e(pair.right)}" placeholder="Correspondência correta"><button type="button" data-remove-pair aria-label="Remover par"><span class="material-symbols-outlined">close</span></button></div>`).join("")}</div><button class="inline-add" type="button" data-add-pair><span class="material-symbols-outlined">add</span>Adicionar par</button>`;
    };
    const orderRows = (question) => {
      const items = question?.alternatives?.length
        ? question.alternatives
        : ["", "", ""];
      return `<div class="order-options" data-order-options>${items.map((item, index) => `<div class="order-row" data-order-row><span class="material-symbols-outlined">drag_indicator</span><b>${index + 1}</b><input data-order-text value="${e(item)}" placeholder="Etapa ou elemento"><button type="button" data-remove-order aria-label="Remover item"><span class="material-symbols-outlined">close</span></button></div>`).join("")}</div><button class="inline-add" type="button" data-add-order><span class="material-symbols-outlined">add</span>Adicionar item</button>`;
    };

    const interactiveBlockFields = (block, question) => {
      const configValues = {
        ...block.defaults,
        ...(question.configuration || {}),
      };
      if (block.key === "formula_quimica") {
        return `<section class="editor-section interactive-config-section"><div class="section-title"><span>2</span><div><strong>Composição química</strong><small>Cadastre a representação exibida e as escritas aceitas na correção.</small></div></div><div class="interactive-config-grid"><label>Fórmula exibida<input data-block-field="formula" value="${e(configValues.formula || "")}" placeholder="Ex.: C₆H₁₂O₆"></label><label>Resposta principal<input data-answer value="${e(question.answer || configValues.formula || "")}" placeholder="Ex.: C6H12O6"></label></div><label class="editor-label">Orientação para montagem<input data-block-field="formulaHint" value="${e(configValues.formulaHint || "")}" placeholder="Ex.: Monte a fórmula molecular da glicose"></label><label class="editor-label">Outras escritas aceitas<textarea data-accepted rows="3" placeholder="Uma variação por linha">${e((configValues.acceptedAnswers || []).join("\n"))}</textarea><small>O aluno poderá usar o teclado comum ou os botões de elementos e índices.</small></label><div class="chemical-preview learning-block-preview" data-preview-depth><span class="material-symbols-outlined">science</span><div><small>PRÉVIA DO ALUNO</small><strong>${e(configValues.formula || "Fórmula química")}</strong><p>${e(configValues.formulaHint || "Monte a fórmula solicitada.")}</p></div></div></section>`;
      }
      if (block.key === "tabela_consultavel") {
        const columns = (configValues.tableColumns || []).join(" | ");
        const rows = (configValues.tableRows || [])
          .map((row) => row.join(" | "))
          .join("\n");
        return `<section class="editor-section interactive-config-section"><div class="section-title"><span>2</span><div><strong>Dados da tabela</strong><small>Use o caractere | para separar as colunas. Cada nova linha cria um registro.</small></div></div><label class="editor-label">Cabeçalhos<input data-table-columns value="${e(columns)}" placeholder="Elemento | Massa | Estado"></label><label class="editor-label">Linhas da tabela<textarea data-table-rows rows="6" placeholder="Hidrogênio | 1,008 | Gasoso\nOxigênio | 15,999 | Gasoso">${e(rows)}</textarea></label><div class="table-preview-note"><span class="material-symbols-outlined">manage_search</span><div><strong>Consulta ativa para o aluno</strong><small>Ele poderá pesquisar qualquer célula e ordenar a tabela por coluna antes de responder.</small></div></div><div class="section-title compact"><span>3</span><div><strong>Alternativas e gabarito</strong><small>Marque a resposta correta após a consulta.</small></div></div>${optionRows(question)}</section>`;
      }
      if (block.key === "formula_matematica") {
        return `<section class="editor-section interactive-config-section"><div class="section-title"><span>2</span><div><strong>Expressão e resultado</strong><small>O aluno verá a fórmula, as variáveis e um teclado matemático de apoio.</small></div></div><label class="editor-label formula-field">Fórmula ou função<input data-math-expression value="${e(configValues.mathExpression || "")}" placeholder="Ex.: A = πr²"><small>Você pode usar expoentes e símbolos matemáticos diretamente.</small></label><label class="editor-label">Valores e variáveis<input data-block-field="formulaVariables" value="${e(configValues.formulaVariables || "")}" placeholder="Ex.: r = 3 cm; π = 3,14"></label><div class="answer-grid"><label>Resposta correta<input data-answer value="${e(question.answer || "")}" inputmode="decimal" placeholder="Ex.: 28,26"></label><label>Tolerância aceita<input data-tolerance type="number" min="0" step="0.001" value="${e(questionValue(question, "tolerance", 0))}"></label></div><label class="editor-label">Resolução de referência<textarea data-solution rows="4" placeholder="Mostre a substituição dos valores e o resultado esperado.">${e(questionValue(question, "solution"))}</textarea></label></section>`;
      }
      return `<section class="editor-section interactive-config-section"><div class="section-title"><span>2</span><div><strong>Configuração do plano cartesiano</strong><small>Defina limites inteiros e o ponto que o aluno deverá marcar.</small></div></div><div class="cartesian-config-grid"><label>X mínimo<input data-block-field="minX" type="number" step="1" value="${e(configValues.minX)}"></label><label>X máximo<input data-block-field="maxX" type="number" step="1" value="${e(configValues.maxX)}"></label><label>Y mínimo<input data-block-field="minY" type="number" step="1" value="${e(configValues.minY)}"></label><label>Y máximo<input data-block-field="maxY" type="number" step="1" value="${e(configValues.maxY)}"></label><label>Ponto X<input data-block-field="targetX" type="number" step="1" value="${e(configValues.targetX)}"></label><label>Ponto Y<input data-block-field="targetY" type="number" step="1" value="${e(configValues.targetY)}"></label></div><aside class="geometry-interaction-note"><span class="material-symbols-outlined">touch_app</span><div><strong>Experiência do aluno</strong><small>Ele toca no plano para marcar o ponto e pode ajustar a posição com controles de direção.</small></div></aside></section>`;
    };

    const typeSpecificFields = (type, question) => {
      if (["unica_escolha", "multipla_escolha"].includes(type))
        return `<section class="editor-section"><div class="section-title"><span>2</span><div><strong>Alternativas e gabarito</strong><small>Marque ${type === "unica_escolha" ? "a alternativa correta" : "todas as alternativas corretas"}.</small></div></div>${optionRows(question, type === "multipla_escolha")}</section>`;
      if (type === "verdadeiro_falso")
        return `<section class="editor-section"><div class="section-title"><span>2</span><div><strong>Gabarito</strong><small>Escolha a conclusão esperada.</small></div></div><div class="binary-answer"><label><input type="radio" name="binary-answer" value="Verdadeiro" ${question.answer === "Verdadeiro" ? "checked" : ""}><span class="material-symbols-outlined">check_circle</span>Verdadeiro</label><label><input type="radio" name="binary-answer" value="Falso" ${question.answer === "Falso" ? "checked" : ""}><span class="material-symbols-outlined">cancel</span>Falso</label></div></section>`;
      if (["numerica", "calculo"].includes(type))
        return `<section class="editor-section"><div class="section-title"><span>2</span><div><strong>Resultado esperado</strong><small>A correção compara o valor numérico informado.</small></div></div>${type === "calculo" ? `<label class="editor-label formula-field">Função ou expressão apresentada ao aluno<input data-math-expression value="${e(questionValue(question, "mathExpression"))}" placeholder="Ex.: f(x) = 2x² - 4x + 1"><small>Use símbolos matemáticos ou uma escrita simples. Ela aparecerá em destaque no enunciado.</small></label>` : ""}<div class="answer-grid"><label>Resposta correta<input data-answer value="${e(question.answer || "")}" inputmode="decimal" placeholder="Ex.: 42 ou 3,14"></label><label>Tolerância aceita<input data-tolerance type="number" min="0" step="0.001" value="${e(questionValue(question, "tolerance", 0))}"><small>Respostas dentro desta margem também serão corrigidas como certas.</small></label></div>${type === "calculo" ? `<label class="editor-label">Resolução de referência<textarea data-solution rows="4" placeholder="Mostre o caminho esperado para apoiar a correção e a devolutiva.">${e(questionValue(question, "solution"))}</textarea></label>` : ""}</section>`;
      if (type === "resposta_curta")
        return `<section class="editor-section"><div class="section-title"><span>2</span><div><strong>Resposta esperada</strong><small>Informe a forma principal aceita pela correção automática.</small></div></div><label class="editor-label">Gabarito<input data-answer value="${e(question.answer || "")}" placeholder="Palavra, conceito ou frase breve"></label><label class="editor-label">Outras respostas aceitas<textarea data-accepted rows="3" placeholder="Uma variação válida por linha">${e((questionValue(question, "acceptedAnswers", []) || []).join("\n"))}</textarea><small>O corretor automático aceitará o gabarito principal e todas as variações listadas.</small></label></section>`;
      if (type === "associacao")
        return `<section class="editor-section"><div class="section-title"><span>2</span><div><strong>Pares de associação</strong><small>O lado direito será embaralhado para o aluno.</small></div></div>${pairRows(question)}</section>`;
      if (type === "ordenacao")
        return `<section class="editor-section"><div class="section-title"><span>2</span><div><strong>Ordem correta</strong><small>Cadastre os itens já na sequência esperada.</small></div></div>${orderRows(question)}</section>`;
      if (type === "codigo")
        return `<section class="editor-section"><div class="section-title"><span>2</span><div><strong>Ambiente do desafio</strong><small>O código será enviado para revisão do professor.</small></div></div><div class="answer-grid"><label>Linguagem<select data-language><option value="javascript" ${questionValue(question, "language") === "javascript" ? "selected" : ""}>JavaScript</option><option value="python" ${questionValue(question, "language") === "python" ? "selected" : ""}>Python</option><option value="html_css" ${questionValue(question, "language") === "html_css" ? "selected" : ""}>HTML + CSS</option><option value="pseudocodigo" ${questionValue(question, "language") === "pseudocodigo" ? "selected" : ""}>Pseudocódigo</option></select></label><label>Saída ou objetivo esperado<input data-expected-output value="${e(questionValue(question, "expectedOutput"))}" placeholder="Ex.: imprimir a soma dos valores"></label></div><label class="editor-label">Código inicial<textarea class="code-field" data-starter-code rows="7" spellcheck="false" placeholder="Forneça a estrutura inicial, se necessário.">${e(questionValue(question, "starterCode"))}</textarea></label><label class="editor-label">Critérios de correção<textarea data-criteria rows="3" placeholder="Clareza, funcionamento, organização...">${e(questionValue(question, "criteria"))}</textarea></label></section>`;
      return `<section class="editor-section"><div class="section-title"><span>2</span><div><strong>${type === "estudo_caso" ? "Contexto e critérios" : "Resposta de referência"}</strong><small>Esta questão será encaminhada para revisão docente.</small></div></div>${type === "estudo_caso" ? `<label class="editor-label">Cenário ou fonte complementar<textarea data-case-context rows="4" placeholder="Apresente dados, texto-base ou situação para análise.">${e(questionValue(question, "caseContext"))}</textarea></label>` : ""}<label class="editor-label">Resposta de referência<textarea data-answer rows="5" placeholder="Registre os elementos essenciais esperados na resposta.">${e(question.answer === "revisao_manual" ? "" : question.answer || "")}</textarea></label><label class="editor-label">Critérios de correção<textarea data-criteria rows="4" placeholder="Liste os critérios que orientarão sua correção.">${e(questionValue(question, "criteria"))}</textarea></label></section>`;
    };

    const renderQuestionEditor = (
      question = emptyQuestion(state.questionType),
    ) => {
      const activeBlock = interactiveBlock(question);
      if (activeBlock && !question.configuration?.activityBlock)
        question = interactiveBlockQuestion(activeBlock.key);
      const type = question.type || state.questionType;
      state.questionType = type;
      state.blockPreset = activeBlock?.key || null;
      if (config.type === "matematica")
        state.mathMode =
          question.configuration?.mathMode ||
          (state.editing >= 0 ? "livre" : state.mathMode || "livre");
      const def = TYPE_DEFS[type];
      const selectedMathTemplate =
        config.type === "matematica" && state.mathMode !== "livre"
          ? mathTemplate()
          : null;
      const editorDef = activeBlock
        ? activeBlock
        : selectedMathTemplate
        ? {
            ...def,
            icon: selectedMathTemplate.icon,
            label: selectedMathTemplate.label,
            description: selectedMathTemplate.description,
          }
        : def;
      const editingLabel =
        state.editing >= 0
          ? `Editando a questão ${state.editing + 1}`
          : `Nova questão ${state.questions.length + 1}`;
      const stages = learningStages(state.questions);
      const selectedStage = question.configuration?.learningStage?.id || stages.at(-1)?.id;
      root.querySelector("[data-question-editor]").innerHTML =
        `<header class="editor-hero"><div class="editor-type-icon"><span class="material-symbols-outlined">${editorDef.icon}</span></div><div><small>${editingLabel.toUpperCase()}</small><h4>${editorDef.label}</h4><p>${editorDef.description}</p></div><span class="correction-badge ${def.auto ? "automatic" : "manual"}"><span class="material-symbols-outlined">${def.auto ? "auto_awesome" : "person_edit"}</span>${def.auto ? "Correção automática" : "Revisão docente"}</span></header>
        <section class="editor-section"><div class="section-title"><span>1</span><div><strong>Comando da questão</strong><small>Dê contexto suficiente e use linguagem direta.</small></div></div>${stages.length ? `<label class="editor-label">Etapa do percurso<select data-learning-stage>${stages.map(stage => `<option value="${e(stage.id)}" ${stage.id === selectedStage ? "selected" : ""}>${stage.order}. ${e(stage.title)}</option>`).join("")}</select><small>A questão permanece conectada às orientações desta etapa.</small></label>` : ""}<div class="statement-layout"><label class="editor-label">Enunciado<textarea data-question-statement rows="5" maxlength="8000" placeholder="${e(config.questionPlaceholder)}">${e(question.statement || "")}</textarea></label><label class="points-field">Pontos<input data-question-points type="number" min="0.01" step="0.01" value="${Number(question.points) || 1}"></label></div><div class="reference-media-editor" data-reference-media><div class="reference-media-copy"><span class="material-symbols-outlined">image</span><div><strong>Imagem de referência <em>opcional</em></strong><small>Ajude o aluno a visualizar gráficos, situações, textos ou dados do problema.</small></div></div><input type="hidden" data-reference-image value="${e(validReferenceImage(question.configuration?.referenceImage?.dataUrl))}"><label class="reference-upload"><input type="file" data-reference-file accept="image/png,image/jpeg,image/webp"><span class="material-symbols-outlined">add_photo_alternate</span><b>${question.configuration?.referenceImage?.dataUrl ? "Trocar imagem" : "Adicionar imagem"}</b><small>PNG, JPG ou WebP · até 8 MB</small></label><figure data-reference-preview ${question.configuration?.referenceImage?.dataUrl ? "" : "hidden"}><img src="${e(validReferenceImage(question.configuration?.referenceImage?.dataUrl))}" alt="Prévia da imagem de referência"><button type="button" data-remove-reference><span class="material-symbols-outlined">delete</span>Remover</button></figure><label class="reference-alt">Descrição acessível da imagem<input data-reference-alt maxlength="240" value="${e(question.configuration?.referenceImage?.alt || "")}" placeholder="Ex.: gráfico da função com a parábola voltada para cima"></label></div></section>
        ${activeBlock ? interactiveBlockFields(activeBlock, question) : config.type === "matematica" && state.mathMode !== "livre" ? mathSpecificFields(state.mathMode, question) : typeSpecificFields(type, question)}
        <section class="editor-section feedback-section"><div class="section-title"><span>3</span><div><strong>Devolutiva pedagógica</strong><small>Explique o raciocínio e ajude o aluno a avançar.</small></div></div><label class="editor-label">Explicação ao aluno<textarea data-question-explanation rows="4" placeholder="O que o aluno deve compreender depois desta questão?">${e(question.explanation || "")}</textarea></label><div class="question-skill-footer"><div><small>HABILIDADES VINCULADAS</small><div class="question-skill-chips" data-question-skills></div></div><label class="required-toggle"><input data-required type="checkbox" ${question.required !== false ? "checked" : ""}><span></span>Obrigatória</label></div></section>
        <footer class="editor-actions"><button class="button secondary" type="button" data-reset-question>${state.editing >= 0 ? "Cancelar edição" : "Limpar"}</button><button class="button primary" type="button" data-save-question><span class="material-symbols-outlined">${state.editing >= 0 ? "save" : "add_circle"}</span>${state.editing >= 0 ? "Salvar alterações" : "Adicionar ao roteiro"}</button></footer>`;
      refreshSelected();
      renderTypePalette();
      renderMathTemplateLab();
      renderMathPreview();
      const editor = root.querySelector("[data-question-editor]");
      state.editorDirty = false;
      editor.addEventListener("input", (event) => {
        state.editorDirty = true;
        if (event.target.matches("[data-math-field]")) renderMathPreview();
      });
      editor.addEventListener("change", (event) => {
        state.editorDirty = true;
        if (
          event.target.matches(
            "[data-geometry-dimension], [data-geometry-shape]",
          )
        )
          updateGeometryEditor(editor);
        else if (event.target.matches("[data-math-field]")) renderMathPreview();
      });
    };

    const bindInteractivePaletteMotion = () => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      root.querySelectorAll("[data-block-preset]").forEach((card) => {
        const reset = () => {
          card.style.setProperty("--block-rx", "0deg");
          card.style.setProperty("--block-ry", "0deg");
          card.style.setProperty("--block-light-x", "50%");
          card.style.setProperty("--block-light-y", "50%");
        };
        if (!reduceMotion) {
          card.addEventListener("pointermove", (event) => {
            const rect = card.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
            card.style.setProperty("--block-rx", `${(0.5 - y) * 8}deg`);
            card.style.setProperty("--block-ry", `${(x - 0.5) * 10}deg`);
            card.style.setProperty("--block-light-x", `${x * 100}%`);
            card.style.setProperty("--block-light-y", `${y * 100}%`);
          });
          card.addEventListener("pointerleave", reset);
          card.addEventListener("blur", reset);
          card.addEventListener("keydown", (event) => {
            const directions = {
              ArrowLeft: [0, -5],
              ArrowRight: [0, 5],
              ArrowUp: [4, 0],
              ArrowDown: [-4, 0],
            };
            if (!directions[event.key]) return;
            event.preventDefault();
            const [rx, ry] = directions[event.key];
            card.style.setProperty("--block-rx", `${rx}deg`);
            card.style.setProperty("--block-ry", `${ry}deg`);
          });
        }
      });
    };

    const renderTypePalette = () => {
      const types = currentTypes();
      if (!types.includes(state.questionType)) {
        state.questionType = types[0];
        state.blockPreset = null;
      }
      root.querySelector("[data-type-count]").textContent =
        `${types.length + Object.keys(INTERACTIVE_BLOCKS).length} formatos para ${CATEGORY[category()].label.toLowerCase()}`;
      root.querySelector("[data-type-palette]").innerHTML =
        `<p class="palette-label">QUESTÕES</p>${types
          .map((type) => {
            const def = TYPE_DEFS[type];
            return `<button type="button" class="type-card ${!state.blockPreset && type === state.questionType ? "selected" : ""}" data-select-type="${type}"><span class="material-symbols-outlined">${def.icon}</span><div><strong>${def.label}</strong><small>${def.group}</small></div><i class="material-symbols-outlined">chevron_right</i></button>`;
          })
          .join("")}<p class="palette-label interactive-label">BLOCOS INTERATIVOS</p>${Object.entries(INTERACTIVE_BLOCKS)
          .map(
            ([key, block]) =>
              `<button type="button" class="type-card interactive-type-card ${state.blockPreset === key ? "selected" : ""}" data-block-preset="${key}" aria-label="${e(block.label)}: ${e(block.description)}"><span class="block-card-depth" aria-hidden="true"></span><span class="material-symbols-outlined">${block.icon}</span><div><strong>${block.label}</strong><small>${block.group}</small></div><i class="material-symbols-outlined">chevron_right</i></button>`,
          )
          .join("")}`;
      bindInteractivePaletteMotion();
      root.querySelector("[data-question-stage-title]").textContent = {
        atividade: "Desenhe uma experiência interativa",
        avaliacao: "Monte uma avaliação clara",
        diagnostica: "Construa o diagnóstico",
        recuperacao: "Prepare a retomada",
      }[category()];
      root.querySelector("[data-question-stage-copy]").textContent =
        `${CATEGORY[category()].label} · ${selectedStyleLabel()}. Cada formato abre apenas os campos necessários.`;
      renderMathTemplateLab();
    };

    const collectQuestion = () => {
      const editor = root.querySelector("[data-question-editor]");
      const type = state.questionType;
      const question = emptyQuestion(type);
      question.points =
        Number(editor.querySelector("[data-question-points]")?.value) || 0;
      question.statement =
        editor.querySelector("[data-question-statement]")?.value.trim() || "";
      question.explanation =
        editor.querySelector("[data-question-explanation]")?.value.trim() || "";
      question.skillIds = [...state.selectedSkills];
      question.required =
        editor.querySelector("[data-required]")?.checked !== false;
      const activeBlock = interactiveBlock();
      if (activeBlock?.key === "formula_quimica") {
        const acceptedAnswers = (editor.querySelector("[data-accepted]")?.value || "")
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean);
        question.answer = editor.querySelector("[data-answer]")?.value.trim() || "";
        question.configuration = {
          activityBlock: activeBlock.key,
          formula: editor.querySelector('[data-block-field="formula"]')?.value.trim() || "",
          formulaHint: editor.querySelector('[data-block-field="formulaHint"]')?.value.trim() || "",
          acceptedAnswers,
        };
        question.answerConfiguration = { acceptedAnswers };
      } else if (activeBlock?.key === "tabela_consultavel") {
        const tableColumns = (editor.querySelector("[data-table-columns]")?.value || "")
          .split("|")
          .map((value) => value.trim())
          .filter(Boolean);
        const tableRows = (editor.querySelector("[data-table-rows]")?.value || "")
          .split("\n")
          .map((line) => line.split("|").map((value) => value.trim()))
          .filter((row) => row.some(Boolean));
        const rows = [...editor.querySelectorAll("[data-option-row]")];
        question.alternatives = rows
          .map((row) => row.querySelector("[data-option-text]").value.trim())
          .filter(Boolean);
        question.answer = rows.find((row) => row.querySelector("input[type=radio]").checked)
          ?.querySelector("[data-option-text]").value.trim() || "";
        question.configuration = {
          activityBlock: activeBlock.key,
          tableColumns,
          tableRows,
          searchable: true,
          sortable: true,
        };
      } else if (activeBlock?.key === "formula_matematica") {
        question.answer = editor.querySelector("[data-answer]")?.value.trim() || "";
        question.configuration = {
          activityBlock: activeBlock.key,
          mathExpression: editor.querySelector("[data-math-expression]")?.value.trim() || "",
          formulaVariables: editor.querySelector('[data-block-field="formulaVariables"]')?.value.trim() || "",
          tolerance: Number(editor.querySelector("[data-tolerance]")?.value) || 0,
          mathKeypad: true,
        };
        question.answerConfiguration = {
          solution: editor.querySelector("[data-solution]")?.value.trim() || "",
        };
      } else if (activeBlock?.key === "plano_cartesiano") {
        const readCoordinate = (name, fallback) =>
          numberValue(editor.querySelector(`[data-block-field="${name}"]`)?.value, fallback);
        const targetX = readCoordinate("targetX", 0);
        const targetY = readCoordinate("targetY", 0);
        question.answer = `${targetX};${targetY}`;
        question.configuration = {
          activityBlock: activeBlock.key,
          mathMode: "plano_cartesiano",
          minX: readCoordinate("minX", -5),
          maxX: readCoordinate("maxX", 5),
          minY: readCoordinate("minY", -5),
          maxY: readCoordinate("maxY", 5),
          targetX,
          targetY,
        };
      } else if (config.type === "matematica" && state.mathMode !== "livre") {
        const values = readMathEditorValues(editor);
        if (state.mathMode === "plano_cartesiano") {
          question.answer = `${numberValue(values.targetX)};${numberValue(values.targetY)}`;
          question.configuration = {
            mathMode: state.mathMode,
            minX: numberValue(values.minX, -5),
            maxX: numberValue(values.maxX, 5),
            minY: numberValue(values.minY, -5),
            maxY: numberValue(values.maxY, 5),
            targetX: numberValue(values.targetX),
            targetY: numberValue(values.targetY),
          };
        } else if (state.mathMode === "reta_numerica") {
          question.answer = String(numberValue(values.target));
          question.configuration = {
            mathMode: state.mathMode,
            min: numberValue(values.min),
            max: numberValue(values.max, 10),
            step: numberValue(values.step, 0.5),
            target: numberValue(values.target),
          };
        } else if (state.mathMode === "pitagoras") {
          question.answer = String(numberValue(values.target));
          question.configuration = {
            mathMode: state.mathMode,
            sideA: numberValue(values.sideA, 3),
            sideB: numberValue(values.sideB, 4),
            sideC: numberValue(values.sideC, 5),
            unit: values.unit || "u",
            target: numberValue(values.target, 5),
          };
          question.answerConfiguration = { solution: values.solution || "" };
        } else if (state.mathMode === "geometria_medidas") {
          const dimension = values.dimension === "3d" ? "3d" : "2d";
          const definition = geometryDefinition(values.shape, dimension);
          const shape =
            GEOMETRY_SHAPES[values.shape]?.dimension === dimension
              ? values.shape
              : dimension === "3d"
                ? "cubo"
                : "quadrado";
          question.answer = String(numberValue(values.target));
          question.configuration = {
            mathMode: state.mathMode,
            dimension,
            shape,
            customName: definition.custom
              ? values.customName || definition.label
              : "",
            labelA: definition.custom ? values.labelA || "Medida A" : "",
            labelB: definition.custom ? values.labelB || "Medida B" : "",
            labelC: definition.custom ? values.labelC || "Medida C" : "",
            labelD: definition.custom ? values.labelD || "Medida D" : "",
            measureA: numberValue(values.measureA),
            measureB: numberValue(values.measureB),
            measureC: numberValue(values.measureC),
            measureD: numberValue(values.measureD),
            sides: definition.sides
              ? Math.round(numberValue(values.sides, 5))
              : null,
            targetType:
              GEOMETRY_TARGETS[dimension].find(
                ([value]) => value === values.targetType,
              )?.[0] || GEOMETRY_TARGETS[dimension][0][0],
            target: numberValue(values.target),
            tolerance: Math.max(0, numberValue(values.tolerance, 0.01)),
            unit: values.unit || "cm",
            interaction: {
              rotate: true,
              zoom: true,
              toggleMeasurements: true,
            },
          };
          question.answerConfiguration = { solution: values.solution || "" };
        } else if (state.mathMode === "grafico_barras") {
          const rows = parseChartRows(values.chartRows);
          question.alternatives = rows.map((item) => item.label);
          question.answer = values.correctLabel || "";
          question.configuration = {
            mathMode: state.mathMode,
            chartRows: values.chartRows || "",
            chartData: rows,
            correctLabel: values.correctLabel || "",
            axisLabel: values.axisLabel || "Quantidade",
          };
        }
      } else if (["unica_escolha", "multipla_escolha"].includes(type)) {
        const rows = [...editor.querySelectorAll("[data-option-row]")];
        question.alternatives = rows
          .map((row) => row.querySelector("[data-option-text]").value.trim())
          .filter(Boolean);
        const correct = rows
          .filter(
            (row) =>
              row.querySelector("input[type=radio],input[type=checkbox]")
                .checked,
          )
          .map((row) => row.querySelector("[data-option-text]").value.trim())
          .filter(Boolean);
        question.answer =
          type === "multipla_escolha" ? correct : correct[0] || "";
      } else if (type === "verdadeiro_falso")
        question.answer =
          editor.querySelector("input[name=binary-answer]:checked")?.value ||
          "";
      else if (["numerica", "calculo"].includes(type)) {
        question.answer =
          editor.querySelector("[data-answer]")?.value.trim() || "";
        question.configuration = {
          tolerance:
            Number(editor.querySelector("[data-tolerance]")?.value) || 0,
        };
        question.answerConfiguration = {
          solution: editor.querySelector("[data-solution]")?.value.trim() || "",
        };
      } else if (type === "resposta_curta") {
        question.answer =
          editor.querySelector("[data-answer]")?.value.trim() || "";
        const acceptedAnswers = (
          editor.querySelector("[data-accepted]")?.value || ""
        )
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean);
        question.configuration = { acceptedAnswers };
        question.answerConfiguration = { acceptedAnswers };
      } else if (type === "associacao") {
        const pairs = [...editor.querySelectorAll("[data-pair-row]")]
          .map((row) => ({
            left: row.querySelector("[data-pair-left]").value.trim(),
            right: row.querySelector("[data-pair-right]").value.trim(),
          }))
          .filter((pair) => pair.left || pair.right);
        question.alternatives = pairs.map((pair) => pair.left);
        question.answer = pairs.map((pair) => pair.right);
        question.configuration = { pairs };
      } else if (type === "ordenacao") {
        question.alternatives = [
          ...editor.querySelectorAll("[data-order-text]"),
        ]
          .map((input) => input.value.trim())
          .filter(Boolean);
        question.answer = [...question.alternatives];
        question.configuration = { interaction: "ordering" };
      } else if (type === "codigo") {
        question.answer = "revisao_manual";
        question.configuration = {
          language:
            editor.querySelector("[data-language]")?.value || "javascript",
          starterCode: editor.querySelector("[data-starter-code]")?.value || "",
          expectedOutput:
            editor.querySelector("[data-expected-output]")?.value.trim() || "",
          criteria: editor.querySelector("[data-criteria]")?.value.trim() || "",
        };
      } else {
        question.answer =
          editor.querySelector("[data-answer]")?.value.trim() ||
          "revisao_manual";
        question.configuration = {
          criteria: editor.querySelector("[data-criteria]")?.value.trim() || "",
          caseContext:
            editor.querySelector("[data-case-context]")?.value.trim() || "",
        };
      }
      const referenceData = validReferenceImage(
        editor.querySelector("[data-reference-image]")?.value,
      );
      const referenceAlt =
        editor.querySelector("[data-reference-alt]")?.value.trim() || "";
      const mathExpression =
        editor.querySelector("[data-math-expression]")?.value.trim() || "";
      question.configuration = {
        ...question.configuration,
        ...(referenceData
          ? { referenceImage: { dataUrl: referenceData, alt: referenceAlt } }
          : {}),
        ...(mathExpression ? { mathExpression } : {}),
      };
      const chosenStage = learningStages(state.questions).find(stage => stage.id === editor.querySelector("[data-learning-stage]")?.value);
      if (chosenStage) question.configuration.learningStage = publicLearningStage(chosenStage);
      return question;
    };

    const validateQuestion = (question) => {
      if (question.statement.length < 3) return "Escreva um enunciado válido.";
      if (
        !Number.isFinite(question.points) ||
        question.points <= 0 ||
        question.points > 1000
      )
        return "Informe uma pontuação entre 0,01 e 1000.";
      const normalizedItems = (items = []) =>
        items.map((item) => String(item).trim().toLocaleLowerCase("pt-BR"));
      const hasDuplicates = (items = []) => {
        const normalized = normalizedItems(items);
        return new Set(normalized).size !== normalized.length;
      };
      const activityBlock = question.configuration?.activityBlock;
      if (
        activityBlock === "formula_quimica" &&
        (!question.configuration.formula?.trim() || !question.answer?.trim())
      )
        return "Informe a fórmula exibida e a resposta química correta.";
      if (activityBlock === "tabela_consultavel") {
        const columns = question.configuration.tableColumns || [];
        const rows = question.configuration.tableRows || [];
        if (columns.length < 2 || rows.length < 2)
          return "A tabela precisa ter pelo menos duas colunas e duas linhas.";
        if (rows.some((row) => row.length !== columns.length || row.some((cell) => !cell)))
          return "Cada linha da tabela precisa preencher todas as colunas.";
      }
      if (
        activityBlock === "formula_matematica" &&
        !question.configuration.mathExpression?.trim()
      )
        return "Informe a fórmula ou função apresentada ao aluno.";
      const mathMode = question.configuration?.mathMode;
      if (
        mathMode === "plano_cartesiano" &&
        (question.configuration.maxX <= question.configuration.minX ||
          question.configuration.maxY <= question.configuration.minY)
      )
        return "Os valores máximos dos eixos devem ser maiores que os mínimos.";
      if (
        mathMode === "plano_cartesiano" &&
        (!Number.isInteger(question.configuration.targetX) ||
          !Number.isInteger(question.configuration.targetY) ||
          question.configuration.targetX < question.configuration.minX ||
          question.configuration.targetX > question.configuration.maxX ||
          question.configuration.targetY < question.configuration.minY ||
          question.configuration.targetY > question.configuration.maxY)
      )
        return "Use coordenadas inteiras que estejam dentro dos limites dos eixos.";
      if (
        mathMode === "reta_numerica" &&
        (question.configuration.max <= question.configuration.min ||
          question.configuration.step <= 0 ||
          question.configuration.target < question.configuration.min ||
          question.configuration.target > question.configuration.max)
      )
        return "Revise os limites, o intervalo e a resposta da reta numérica.";
      if (
        mathMode === "pitagoras" &&
        (question.configuration.sideA <= 0 ||
          question.configuration.sideB <= 0 ||
          question.configuration.sideC <= 0 ||
          numberValue(question.answer, Number.NaN) <= 0)
      )
        return "As medidas e a resposta do triângulo precisam ser maiores que zero.";
      if (mathMode === "geometria_medidas") {
        const geometry = question.configuration;
        const definition = GEOMETRY_SHAPES[geometry.shape];
        if (!definition || definition.dimension !== geometry.dimension)
          return "Escolha uma forma geométrica compatível com a dimensão.";
        if (
          !definition.measures.every(
            ([key]) => Number.isFinite(geometry[key]) && geometry[key] > 0,
          )
        )
          return "Todas as medidas da forma precisam ser maiores que zero.";
        if (
          definition.sides &&
          (!Number.isInteger(geometry.sides) ||
            geometry.sides < 3 ||
            geometry.sides > 20)
        )
          return "Informe entre 3 e 20 lados para a base regular.";
        if (
          !GEOMETRY_TARGETS[geometry.dimension].some(
            ([value]) => value === geometry.targetType,
          )
        )
          return "Escolha o tipo de medida que o aluno deverá calcular.";
        if (!geometry.unit.trim()) return "Informe a unidade de medida.";
        if (geometry.unit.trim().length > 12)
          return "A unidade de medida deve ter no máximo 12 caracteres.";
        if (definition.custom && !geometry.customName.trim())
          return "Dê um nome à forma personalizada.";
        if (numberValue(question.answer, Number.NaN) <= 0)
          return "A resposta geométrica precisa ser maior que zero.";
      }
      if (
        mathMode === "grafico_barras" &&
        (question.configuration.chartData.length < 2 ||
          !question.alternatives.includes(question.answer))
      )
        return "Informe pelo menos duas barras e uma categoria correta existente.";
      if (mathMode === "grafico_barras" && hasDuplicates(question.alternatives))
        return "Use nomes diferentes para cada categoria do gráfico.";
      if (
        ["unica_escolha", "multipla_escolha"].includes(question.type) &&
        question.alternatives.length < 2
      )
        return "Inclua pelo menos duas alternativas.";
      if (
        ["unica_escolha", "multipla_escolha"].includes(question.type) &&
        hasDuplicates(question.alternatives)
      )
        return "As alternativas precisam ser diferentes entre si.";
      if (["numerica", "calculo"].includes(question.type)) {
        const numericAnswer = Number(String(question.answer).replace(",", "."));
        if (!Number.isFinite(numericAnswer))
          return "Informe uma resposta numérica válida.";
        if (
          !Number.isFinite(question.configuration?.tolerance) ||
          question.configuration.tolerance < 0
        )
          return "A tolerância precisa ser um número maior ou igual a zero.";
      }
      if (
        question.type === "associacao" &&
        (question.configuration.pairs.length < 2 ||
          question.configuration.pairs.some(
            (pair) => !pair.left || !pair.right,
          ))
      )
        return "Inclua pelo menos dois pares completos.";
      if (
        question.type === "associacao" &&
        (hasDuplicates(question.configuration.pairs.map((pair) => pair.left)) ||
          hasDuplicates(question.configuration.pairs.map((pair) => pair.right)))
      )
        return "Os itens e as correspondências da associação precisam ser únicos.";
      if (question.type === "ordenacao" && question.alternatives.length < 2)
        return "Inclua pelo menos dois itens na sequência.";
      if (question.type === "ordenacao" && hasDuplicates(question.alternatives))
        return "Os itens da ordenação precisam ser diferentes entre si.";
      if (
        !MANUAL_TYPES.has(question.type) &&
        (!question.answer ||
          (Array.isArray(question.answer) && !question.answer.length))
      )
        return "Defina o gabarito para permitir a correção automática.";
      return "";
    };

    const renderQuestions = () => {
      const stages = learningStages(state.questions);
      if (stages.length) {
        field("shuffleQuestions").checked = false;
        field("shuffleQuestions").disabled = true;
      } else field("shuffleQuestions").disabled = false;
      const target = root.querySelector("[data-question-list]");
      target.innerHTML = state.questions.length
        ? state.questions
            .map((question, index) => {
              const def = questionDefinition(question);
              const stage = publicLearningStage(question.configuration?.learningStage);
              const first = stage && state.questions[index - 1]?.configuration?.learningStage?.id !== stage.id;
              const canMove = index > 0 && (!stage || state.questions[index - 1]?.configuration?.learningStage?.id === stage.id);
              return `${first ? `<section class="notice"><strong>ETAPA ${stage.order} · ${e(stage.title)}</strong><p>${e(stage.objective)}</p><small>${e(stage.instructions)}</small>${stage.bridge ? `<p>${e(stage.bridge)}</p>` : ""}</section>` : ""}<article class="question-row"><span class="material-symbols-outlined">${def.icon}</span><div><small>${stage ? `ETAPA ${stage.order} · ` : ""}QUESTÃO ${index + 1}</small><strong>${e(question.statement)}</strong><em>${e(def.label)} · ${question.points} ponto(s)</em></div><div><button type="button" data-edit="${index}" aria-label="Editar"><span class="material-symbols-outlined">edit</span></button><button type="button" data-up="${index}" aria-label="${stage ? "Subir nesta etapa" : "Subir"}" ${canMove ? "" : "disabled"}><span class="material-symbols-outlined">arrow_upward</span></button><button type="button" data-delete="${index}" aria-label="Excluir"><span class="material-symbols-outlined">delete</span></button></div></article>`;
            })
            .join("")
        : `<div class="builder-empty compact"><span class="material-symbols-outlined">playlist_add</span><strong>Seu roteiro está vazio</strong><p>Escolha um bloco ao lado e adicione a primeira questão.</p></div>`;
      root.querySelector("[data-question-counter]").textContent =
        `${state.questions.length} questão(ões)`;
      const total = state.questions.reduce(
        (sum, question) => sum + Number(question.points || 0),
        0,
      );
      root.querySelector("[data-outline-total]").innerHTML =
        `<span>Pontuação configurada</span><strong>${total.toLocaleString("pt-BR")} pts</strong>`;
      const outline = root.querySelector("[data-question-outline]");
      const body = outline.querySelector("[data-outline-body]");
      const toggle = outline.querySelector("[data-toggle-outline]");
      body.hidden = state.outlineCollapsed;
      outline.classList.toggle("collapsed", state.outlineCollapsed);
      toggle.setAttribute("aria-expanded", String(!state.outlineCollapsed));
      toggle.querySelector("span").textContent = state.outlineCollapsed
        ? "expand_more"
        : "expand_less";
      toggle.querySelector("b").textContent = state.outlineCollapsed
        ? "Mostrar roteiro"
        : "Minimizar";
      const banner = root.querySelector("[data-copilot-handoff]");
      banner.hidden = !state.copilotUndo && !stages.length;
      root.querySelector("[data-copilot-undo]").hidden = !state.copilotUndo;
      root.querySelector("[data-copilot-undo]").textContent = state.copilotRedo ? "Reaplicar ajuste do Copiloto" : "Restaurar rascunho anterior";
      root.querySelector("[data-copilot-handoff-copy]").textContent = stages.length
        ? `Percurso de aprendizagem: ${stages.length} etapas e ${state.questions.length} questões. Todas as orientações serão incluídas na mesma atividade. A ordem das etapas será preservada.`
        : "Ajuste do Copiloto aplicado ao rascunho. Você pode restaurar a versão anterior.";
    };

    const renderReview = () => {
      const scoring = field("scoringMode").value;
      const total = Number(field("value").value) || 0;
      const selected = CATEGORY[category()];
      const curriculumHint = BASE_SUBJECTS.includes(config.type) && !hasCurriculumLink(state.questions)
        ? '<p class="notice" data-publish-curriculum-hint>Seu rascunho pode ser salvo. Para publicar, vincule ao menos uma habilidade ou descritor a uma questão na etapa Currículo.</p>'
        : "";
      root.querySelector("[data-review-preview]").innerHTML =
        `<article class="review-card"><div class="review-format" style="--format-accent:${selected.accent}"><span class="material-symbols-outlined">${selected.icon}</span><div><small>${selected.label.toUpperCase()}</small><strong>${e(selectedStyleLabel())}</strong></div>${state.secureExam && category() === "avaliacao" ? `<em><span class="material-symbols-outlined">shield_lock</span>Prova Segura</em>` : ""}</div><h3>${e(field("title").value || "Proposta sem título")}</h3><p>${e(activeClass()?.nome || "Turma não selecionada")} · ${state.questions.length} questão(ões) · ${total} ponto(s)</p>${curriculumHint}<ol>${state.questions.map((question) => { const def = questionDefinition(question); return `<li><span class="material-symbols-outlined">${def.icon}</span><div><strong>${e(question.statement)}</strong><small>${e(def.label)} · ${scoring === "igual" ? (total / state.questions.length).toFixed(2) : question.points} ponto(s) · ${question.skillIds.length} habilidade(s)</small></div></li>`; }).join("")}</ol></article>`;
    };

    const go = (step) => {
      state.step = Math.max(1, Math.min(4, step));
      root
        .querySelectorAll("[data-step]")
        .forEach(
          (section) =>
            (section.hidden = Number(section.dataset.step) !== state.step),
        );
      root.querySelectorAll("[data-step-button]").forEach((button) => {
        button.setAttribute("aria-current", Number(button.dataset.stepButton) === state.step ? "step" : "false");
        button.classList.toggle(
          "active",
          Number(button.dataset.stepButton) === state.step,
        );
        button.classList.toggle(
          "done",
          Number(button.dataset.stepButton) < state.step,
        );
      });
      root.querySelector("[data-previous]").hidden = state.step === 1;
      root.querySelector("[data-next]").hidden = state.step === 4;
      root.querySelector("[data-publish-actions]").hidden = state.step !== 4;
      root.querySelector("[data-step-status]").textContent =
        `Etapa ${state.step} de 4`;
      if (state.step === 2) {
        renderCurriculumContext();
        if (!state.skills.length && activeClass()) loadSkills();
      }
      if (state.step === 3) {
        renderTypePalette();
        renderQuestions();
      }
      if (state.step === 4) renderReview();
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const validateContext = () => {
      const title = field("title").value.trim();
      const duration = Number(field("duration").value);
      const total = Number(field("value").value);
      if (title.length < 3 || title.length > 140) {
        toast("O título deve ter entre 3 e 140 caracteres.", "error");
        field("title").focus();
        return false;
      }
      if (!activeClass()) {
        toast("Selecione uma turma válida.", "error");
        field("classId").focus();
        return false;
      }
      if (!Number.isInteger(duration) || duration < 5 || duration > 300) {
        toast(
          "A duração deve ser um número inteiro entre 5 e 300 minutos.",
          "error",
        );
        field("duration").focus();
        return false;
      }
      if (!Number.isFinite(total) || total < 0.1 || total > 1000) {
        toast("O valor total deve ficar entre 0,1 e 1000 pontos.", "error");
        field("value").focus();
        return false;
      }
      return true;
    };
    const validateSchedule = () => {
      const attempts = Number(field("attempts").value);
      const opensValue = field("opensAt").value;
      const closesValue = field("closesAt").value;
      const opensAt = opensValue ? new Date(opensValue) : null;
      const closesAt = closesValue ? new Date(closesValue) : null;
      if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) {
        toast("As tentativas permitidas devem ficar entre 1 e 10.", "error");
        field("attempts").focus();
        return false;
      }
      if (
        (opensAt && Number.isNaN(opensAt.getTime())) ||
        (closesAt && Number.isNaN(closesAt.getTime()))
      ) {
        toast("Revise as datas de abertura e encerramento.", "error");
        return false;
      }
      if (opensAt && closesAt && closesAt <= opensAt) {
        toast("O encerramento precisa acontecer depois da abertura.", "error");
        field("closesAt").focus();
        return false;
      }
      return true;
    };
    const validateStep = (step = state.step) => {
      if (step === 1) return validateContext();
      if (step === 2 && state.curriculumNeedsRelink) {
        const skillIds = [...state.selectedSkills];
        state.questions = state.questions.map((question) => ({
          ...question,
          skillIds: [...skillIds],
        }));
        state.curriculumNeedsRelink = false;
        renderQuestions();
      }
      if (step === 3) {
        if (state.editorDirty) {
          toast(
            "Adicione a questão em preenchimento ao roteiro ou cancele a edição antes de continuar.",
            "error",
          );
          return false;
        }
        if (!state.questions.length) {
          toast("Adicione ao menos uma questão.", "error");
          return false;
        }
        const invalidIndex = state.questions.findIndex(validateQuestion);
        if (invalidIndex >= 0) {
          toast(
            `Revise a questão ${invalidIndex + 1}: ${validateQuestion(state.questions[invalidIndex])}`,
            "error",
          );
          return false;
        }
      }
      if (step === 4) return validateSchedule();
      return true;
    };
    const navigateTo = (target) => {
      if (target <= state.step) return go(target);
      for (let step = state.step; step < target; step += 1) {
        if (!validateStep(step)) {
          go(step);
          return;
        }
      }
      go(target);
    };

    root
      .querySelector("[data-load-skills]")
      .addEventListener("click", loadSkills);
    root
      .querySelector("[data-skill-search]")
      .addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          loadSkills();
        }
      });
    const resetCurriculumContext = () => {
      state.skills = [];
      state.selectedSkills.clear();
      if (state.questions.length) {
        state.curriculumNeedsRelink = true;
        state.questions = state.questions.map((question) => ({
          ...question,
          skillIds: [],
        }));
        renderQuestions();
      }
      refreshSelected();
      renderCurriculumContext();
    };
    field("classId").addEventListener("change", () => {
      const nextClassId = field("classId").value;
      if (
        state.lastClassId &&
        nextClassId !== state.lastClassId &&
        (state.questions.length || state.selectedSkills.size) &&
        !window.confirm(
          "Ao trocar a turma, os vínculos curriculares serão refeitos. As questões serão mantidas e deverão ser vinculadas ao currículo da nova turma. Deseja continuar?",
        )
      ) {
        field("classId").value = state.lastClassId;
        return;
      }
      state.lastClassId = nextClassId;
      resetCurriculumContext();
    });
    field("trimester").addEventListener("change", () => {
      const nextTrimester = field("trimester").value;
      if (
        state.lastTrimester !== nextTrimester &&
        (state.questions.length || state.selectedSkills.size) &&
        !window.confirm(
          "Ao trocar o trimestre, os descritores selecionados serão limpos e as questões deverão ser vinculadas novamente. Deseja continuar?",
        )
      ) {
        field("trimester").value = state.lastTrimester;
        return;
      }
      state.lastTrimester = nextTrimester;
      resetCurriculumContext();
    });
    field("category").addEventListener("change", () => {
      const nextCategory = category();
      const allowedTypes = CATEGORY_TYPES[nextCategory] || [];
      const incompatibleQuestions = state.questions.filter(
        (question) => !allowedTypes.includes(question.type),
      );
      if (
        (state.editorDirty || incompatibleQuestions.length) &&
        !window.confirm(
          `${state.editorDirty ? "Há uma questão em preenchimento. " : ""}${incompatibleQuestions.length ? `${incompatibleQuestions.length} questão(ões) do roteiro não são compatíveis com o novo formato e serão removidas. ` : ""}Deseja trocar o formato?`,
        )
      ) {
        field("category").value = state.lastCategory;
        return;
      }
      if (incompatibleQuestions.length) {
        state.questions = state.questions.filter((question) =>
          allowedTypes.includes(question.type),
        );
        renderQuestions();
      }
      state.lastCategory = nextCategory;
      state.experienceStyle = defaultStyle();
      state.secureExam = false;
      if (config.type === "matematica") state.mathMode = "livre";
      state.blockPreset = null;
      state.questionType = currentTypes()[0];
      state.editing = -1;
      renderFormatPanel();
      renderCurriculumContext();
      renderQuestionEditor();
    });
    root
      .querySelector("[data-type-palette]")
      .addEventListener("click", (event) => {
        const presetButton = event.target.closest("[data-block-preset]");
        if (presetButton) {
          const preset = presetButton.dataset.blockPreset;
          if (preset === state.blockPreset) return;
          if (!canReplaceEditor()) return;
          state.editing = -1;
          state.blockPreset = preset;
          state.questionType = INTERACTIVE_BLOCKS[preset].baseType;
          if (config.type === "matematica") state.mathMode = "livre";
          renderQuestionEditor(interactiveBlockQuestion(preset));
          renderTypePalette();
          root
            .querySelector("[data-question-editor]")
            .scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        const button = event.target.closest("[data-select-type]");
        if (!button) return;
        const nextType = button.dataset.selectType;
        if (
          nextType === state.questionType &&
          state.mathMode === "livre" &&
          !state.blockPreset
        )
          return;
        if (!canReplaceEditor()) return;
        state.editing = -1;
        state.blockPreset = null;
        if (config.type === "matematica") state.mathMode = "livre";
        state.questionType = nextType;
        renderQuestionEditor();
        root
          .querySelector("[data-question-editor]")
          .scrollIntoView({ behavior: "smooth", block: "start" });
      });

    root
      .querySelector("[data-question-editor]")
      .addEventListener("click", (event) => {
        const editor = root.querySelector("[data-question-editor]");
        if (event.target.closest("[data-add-option]")) {
          editor
            .querySelector("[data-choice-options]")
            .insertAdjacentHTML(
              "beforeend",
              `<div class="choice-row" data-option-row><label title="Marcar como correta"><input type="${state.questionType === "multipla_escolha" ? "checkbox" : "radio"}" name="correct-option"><span class="material-symbols-outlined">${state.questionType === "multipla_escolha" ? "check_box" : "radio_button_checked"}</span></label><b>${String.fromCharCode(65 + editor.querySelectorAll("[data-option-row]").length)}</b><input data-option-text placeholder="Escreva a alternativa"><button type="button" data-remove-option aria-label="Remover alternativa"><span class="material-symbols-outlined">close</span></button></div>`,
            );
          state.editorDirty = true;
        }
        const removeOption = event.target.closest("[data-remove-option]");
        if (
          removeOption &&
          editor.querySelectorAll("[data-option-row]").length > 2
        ) {
          removeOption.closest("[data-option-row]").remove();
          state.editorDirty = true;
        }
        if (event.target.closest("[data-add-pair]")) {
          editor
            .querySelector("[data-pair-options]")
            .insertAdjacentHTML(
              "beforeend",
              `<div class="pair-row" data-pair-row><input data-pair-left placeholder="Conceito ou item"><span class="material-symbols-outlined">sync_alt</span><input data-pair-right placeholder="Correspondência correta"><button type="button" data-remove-pair aria-label="Remover par"><span class="material-symbols-outlined">close</span></button></div>`,
            );
          state.editorDirty = true;
        }
        const removePair = event.target.closest("[data-remove-pair]");
        if (
          removePair &&
          editor.querySelectorAll("[data-pair-row]").length > 2
        ) {
          removePair.closest("[data-pair-row]").remove();
          state.editorDirty = true;
        }
        if (event.target.closest("[data-add-order]")) {
          editor
            .querySelector("[data-order-options]")
            .insertAdjacentHTML(
              "beforeend",
              `<div class="order-row" data-order-row><span class="material-symbols-outlined">drag_indicator</span><b>${editor.querySelectorAll("[data-order-row]").length + 1}</b><input data-order-text placeholder="Etapa ou elemento"><button type="button" data-remove-order aria-label="Remover item"><span class="material-symbols-outlined">close</span></button></div>`,
            );
          state.editorDirty = true;
        }
        const removeOrder = event.target.closest("[data-remove-order]");
        if (
          removeOrder &&
          editor.querySelectorAll("[data-order-row]").length > 2
        ) {
          removeOrder.closest("[data-order-row]").remove();
          [...editor.querySelectorAll("[data-order-row] b")].forEach(
            (item, index) => (item.textContent = index + 1),
          );
          state.editorDirty = true;
        }
        if (event.target.closest("[data-remove-reference]")) {
          const media = editor.querySelector("[data-reference-media]");
          media.querySelector("[data-reference-image]").value = "";
          media.querySelector("[data-reference-file]").value = "";
          media.querySelector("[data-reference-preview]").hidden = true;
          media.querySelector("[data-reference-preview] img").removeAttribute("src");
          media.querySelector("[data-reference-alt]").value = "";
          media.querySelector(".reference-upload b").textContent = "Adicionar imagem";
          state.editorDirty = true;
        }
        if (event.target.closest("[data-reset-question]")) {
          if (!canReplaceEditor()) return;
          state.editing = -1;
          renderQuestionEditor();
        }
        if (event.target.closest("[data-save-question]")) {
          const wasEditing = state.editing >= 0;
          const question = collectQuestion();
          const error = validateQuestion(question);
          if (error) return toast(error, "error");
          state.editing >= 0
            ? state.questions.splice(state.editing, 1, question)
            : state.questions.push(question);
          state.questions.sort((left, right) => (left.configuration?.learningStage?.order || 0) - (right.configuration?.learningStage?.order || 0));
          state.editing = -1;
          renderQuestions();
          renderQuestionEditor(emptyQuestion(state.questionType));
          toast(
            wasEditing
              ? "Alterações da questão salvas."
              : "Questão adicionada ao roteiro.",
          );
        }
      });
    root
      .querySelector("[data-question-editor]")
      .addEventListener("change", async (event) => {
        if (!event.target.matches("[data-reference-file]")) return;
        const file = event.target.files?.[0];
        if (!file) return;
        const media = event.target.closest("[data-reference-media]");
        const upload = media.querySelector(".reference-upload");
        upload.classList.add("is-loading");
        try {
          const dataUrl = await optimizeReferenceImage(file);
          media.querySelector("[data-reference-image]").value = dataUrl;
          const preview = media.querySelector("[data-reference-preview]");
          preview.hidden = false;
          preview.querySelector("img").src = dataUrl;
          media.querySelector(".reference-upload b").textContent = "Trocar imagem";
          if (!media.querySelector("[data-reference-alt]").value)
            media.querySelector("[data-reference-alt]").value = file.name.replace(/\.[^.]+$/, "");
          state.editorDirty = true;
        } catch (error) {
          event.target.value = "";
          toast(error.message, "error");
        } finally {
          upload.classList.remove("is-loading");
        }
      });

    root
      .querySelector("[data-question-list]")
      .addEventListener("click", (event) => {
        const edit = event.target.closest("[data-edit]"),
          remove = event.target.closest("[data-delete]"),
          up = event.target.closest("[data-up]");
        if (edit) {
          const nextIndex = Number(edit.dataset.edit);
          if (nextIndex === state.editing) {
            root
              .querySelector("[data-question-editor]")
              .scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          if (
            !canReplaceEditor(
              "Há uma questão em preenchimento. Deseja descartá-la e abrir outra questão para edição?",
            )
          )
            return;
          state.editing = nextIndex;
          state.questionType = state.questions[state.editing].type;
          state.blockPreset =
            state.questions[state.editing].configuration?.activityBlock || null;
          renderQuestionEditor(state.questions[state.editing]);
          root
            .querySelector("[data-question-editor]")
            .scrollIntoView({ behavior: "smooth", block: "start" });
        }
        if (remove) {
          const index = Number(remove.dataset.delete);
          if (
            !window.confirm(`Deseja excluir a questão ${index + 1} do roteiro?`)
          )
            return;
          if (
            !canReplaceEditor(
              "A exclusão também descartará os campos que estão em preenchimento. Deseja continuar?",
            )
          )
            return;
          state.questions.splice(index, 1);
          state.editing = -1;
          renderQuestions();
          renderQuestionEditor();
        }
        if (up) {
          const index = Number(up.dataset.up);
          if (index < 1 || state.questions[index]?.configuration?.learningStage?.id !== state.questions[index - 1]?.configuration?.learningStage?.id) return;
          if (
            !canReplaceEditor(
              "Reordenar o roteiro descartará os campos que estão em preenchimento. Deseja continuar?",
            )
          )
            return;
          [state.questions[index - 1], state.questions[index]] = [
            state.questions[index],
            state.questions[index - 1],
          ];
          state.editing = -1;
          renderQuestions();
          renderQuestionEditor();
        }
      });
    root
      .querySelector("[data-toggle-outline]")
      .addEventListener("click", () => {
        state.outlineCollapsed = !state.outlineCollapsed;
        renderQuestions();
      });
    root
      .querySelector("[data-clear-questions]")
      .addEventListener("click", () => {
        if (
          state.questions.length &&
          confirm("Deseja remover todas as questões deste roteiro?")
        ) {
          state.questions = [];
          state.editing = -1;
          renderQuestions();
          renderQuestionEditor();
        }
      });
    root.querySelector("[data-next]").addEventListener("click", () => {
      navigateTo(state.step + 1);
    });
    root
      .querySelector("[data-previous]")
      .addEventListener("click", () => go(state.step - 1));
    root.querySelectorAll("[data-step-button]").forEach((button) =>
      button.addEventListener("click", () => {
        const target = Number(button.dataset.stepButton);
        navigateTo(target);
      }),
    );
    field("scoringMode").addEventListener("change", renderReview);
    root
      .querySelector("[data-toggle-history]")
      .addEventListener(
        "click",
        () => (root.querySelector("[data-history]").hidden = false),
      );
    root
      .querySelector("[data-close-history]")
      .addEventListener(
        "click",
        () => (root.querySelector("[data-history]").hidden = true),
      );
    root
      .querySelector("[data-open-corrections]")
      ?.addEventListener("click", () =>
        window.renderTeacherReviewCenter?.({
          content,
          data,
          api,
          config,
          escapeHtml,
          formatDate,
          toast,
          reload,
          mode: "reviews",
        }),
      );
    root.querySelector("[data-open-results]")?.addEventListener("click", () =>
      window.renderTeacherReviewCenter?.({
        content,
        data,
        api,
        config,
        escapeHtml,
        formatDate,
        toast,
        reload,
        mode: "results",
      }),
    );

    root.querySelectorAll("[data-duplicate-evaluation]").forEach((button) =>
      button.addEventListener("click", async () => {
        const source = data.evaluations.find(
          (item) => item.id === button.dataset.duplicateEvaluation,
        );
        if (!source) return;
        field("title").value = `Cópia de ${source.titulo}`.slice(0, 140);
        field("classId").value = source.turma_id || "";
        state.lastClassId = field("classId").value;
        field("category").value = source.categoria || "atividade";
        state.lastCategory = field("category").value;
        field("trimester").value = source.trimestre || "";
        state.lastTrimester = field("trimester").value;
        field("duration").value = source.duracao_minutos || 50;
        field("value").value = source.valor || 10;
        field("instructions").value = source.instrucoes || "";
        field("scoringMode").value = source.modo_pontuacao || "igual";
        field("attempts").value = source.tentativas_permitidas || 1;
        field("shuffleQuestions").checked = Boolean(source.embaralhar_questoes);
        field("shuffleAlternatives").checked = Boolean(
          source.embaralhar_alternativas,
        );
        field("immediateFeedback").checked = Boolean(source.feedback_imediato);
        field("showAnswerKey").checked = Boolean(source.exibir_gabarito);
        field("opensAt").value = "";
        field("closesAt").value = "";
        state.experienceStyle =
          source.configuracao?.experienceStyle || defaultStyle();
        state.secureExam = Boolean(source.configuracao?.secureExam?.enabled);
        state.questions = (source.questoes_avaliacao || []).map((question) => {
          const answer =
            question.gabaritos_avaliacao?.resposta_esperada?.value ?? "";
          const configuration = { ...(question.configuracao || {}) };
          let alternatives = question.alternativas || [];
          if (question.tipo === "associacao" && Array.isArray(answer)) {
            const leftItems = Array.isArray(configuration.associationLeft)
              ? configuration.associationLeft
              : alternatives;
            configuration.pairs = leftItems.map((left, index) => ({
              left,
              right: answer[index] || "",
            }));
          }
          if (question.tipo === "ordenacao" && Array.isArray(answer))
            alternatives = [...answer];
          return {
            type: question.tipo,
            statement: question.enunciado,
            alternatives,
            answer,
            explanation: question.explicacao || "",
            points: Number(question.pontos),
            skillIds: (question.questoes_avaliacao_habilidades || []).map(
              (link) => link.habilidade_id,
            ),
            required: question.obrigatoria !== false,
            configuration,
            answerConfiguration:
              question.gabaritos_avaliacao?.resposta_esperada?.normalization ||
              {},
          };
        });
        state.learningTrail = learningTrailMetadata(state.questions, source.configuracao?.learningTrail || { title: source.titulo, description: source.instrucoes });
        state.copilotUndo = null;
        state.copilotRedo = false;
        state.selectedSkills = new Set(
          state.questions.flatMap((question) => question.skillIds),
        );
        if (config.type === "matematica")
          state.mathMode =
            state.questions[0]?.configuration?.mathMode || "livre";
        state.questionType = state.questions[0]?.type || currentTypes()[0];
        state.blockPreset =
          state.questions[0]?.configuration?.activityBlock || null;
        state.skills = [];
        try {
          state.skills = await api.listCurriculumSkills({
            materia: config.type,
            serie: activeClass()?.serie,
            trimestre: Number(field("trimester").value) || null,
            search: "",
          });
        } catch (error) {
          toast(
            `A cópia foi preparada, mas os nomes dos descritores não puderam ser carregados: ${error.message}`,
            "error",
          );
        }
        state.curriculumNeedsRelink = false;
        state.editing = -1;
        state.editorDirty = false;
        renderFormatPanel();
        renderQuestions();
        refreshSelected();
        renderQuestionEditor();
        root.querySelector("[data-history]").hidden = true;
        go(1);
        toast("Cópia preparada. Revise antes de salvar ou publicar.");
      }),
    );

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.step !== 4) {
        navigateTo(state.step + 1);
        return;
      }
      if (state.submitting) return;
      const submitter = event.submitter;
      const intent = submitter?.value === "publish" ? "publish" : "draft";
      const values = new FormData(form);
      const scoringMode = values.get("scoringMode");
      for (let step = 1; step <= 4; step += 1) {
        if (!validateStep(step)) {
          go(step);
          return;
        }
      }
      if (intent === "publish" && BASE_SUBJECTS.includes(config.type) && !hasCurriculumLink(state.questions)) {
        toast("O rascunho pode ser salvo. Para publicar, selecione ao menos uma habilidade ou descritor na etapa Currículo e vincule a uma questão.", "error");
        state.curriculumNeedsRelink = true;
        go(2);
        root.querySelector("[data-skill-search]").focus();
        return;
      }
      if (
        scoringMode === "manual" &&
        Math.abs(
          state.questions.reduce((sum, question) => sum + question.points, 0) -
            Number(values.get("value")),
        ) > 0.01
      )
        return toast(
          "A soma dos pontos precisa ser igual ao valor total.",
          "error",
        );
      const publishButtons = [
        ...root.querySelectorAll("[data-publish-actions] button"),
      ];
      state.submitting = true;
      publishButtons.forEach((button) => {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
      });
      const toIso = (value) =>
        value ? new Date(String(value)).toISOString() : null;
      try {
        const targetClassIds = intent === "publish" && state.copilotTargetClassIds.length
          ? [...new Set(state.copilotTargetClassIds)]
          : [values.get("classId")];
        const createPayload = (targetClassId) => ({
          tipoProfessor: config.type,
          subject: config.type,
          category: values.get("category"),
          series: activeClass()?.serie,
          trimester: Number(values.get("trimester")) || null,
          scoringMode,
          attempts: Number(values.get("attempts")),
          shuffleQuestions: learningStages(state.questions).length ? false : values.has("shuffleQuestions"),
          shuffleAlternatives: values.has("shuffleAlternatives"),
          immediateFeedback: values.has("immediateFeedback"),
          showAnswerKey: values.has("showAnswerKey"),
          title: values.get("title"),
          instructions: values.get("instructions"),
          duration: Number(values.get("duration")),
          value: Number(values.get("value")),
          classId: targetClassId,
          opensAt: toIso(values.get("opensAt")),
          closesAt: toIso(values.get("closesAt")),
          configuration: {
            model: config.evaluationModel,
            builderVersion: "3.1",
            experienceStyle: state.experienceStyle,
            ...(learningTrailMetadata(state.questions, state.learningTrail || {}) ? { learningTrail: learningTrailMetadata(state.questions, state.learningTrail || {}) } : {}),
            secureExam: {
              enabled: category() === "avaliacao" && state.secureExam,
              requireFullscreen: true,
              monitorFocus: true,
              restrictClipboard: true,
              aiHandling: "teacher_review",
            },
          },
          questions: state.questions,
          publish: intent === "publish",
        });
        await Promise.all(targetClassIds.map((targetClassId) => api.createTeacherEvaluation(createPayload(targetClassId))));
        toast(
          intent === "publish"
            ? targetClassIds.length > 1
              ? `Proposta publicada para ${targetClassIds.length} turmas.`
              : "Proposta publicada para a turma."
            : "Rascunho salvo com segurança.",
        );
        await reload();
      } catch (error) {
        toast(error.message, "error");
        state.submitting = false;
        publishButtons.forEach((button) => {
          button.disabled = false;
          button.removeAttribute("aria-busy");
        });
      }
    });

    const captureCopilotDraft = () => {
      const editor = root.querySelector("[data-question-editor]"), copy = editor.cloneNode(true);
      [...editor.querySelectorAll("input,textarea,select")].forEach((control, index) => {
        const target = copy.querySelectorAll("input,textarea,select")[index];
        if (control.tagName === "TEXTAREA") target.textContent = control.value;
        else if (control.tagName === "SELECT") [...target.options].forEach(option => option.toggleAttribute("selected", option.value === control.value));
        else { target.setAttribute("value", control.value); target.toggleAttribute("checked", control.checked); }
      });
      return {
        questions: JSON.parse(JSON.stringify(state.questions)), learningTrail: state.learningTrail && JSON.parse(JSON.stringify(state.learningTrail)),
        selectedSkills: [...state.selectedSkills], skills: JSON.parse(JSON.stringify(state.skills)),
        fields: [...form.elements].filter(control => control.name && !control.closest("[data-question-editor]") && control.tagName !== "BUTTON").map(control => ({ name: control.name, value: control.value, checked: control.checked })),
        editorHtml: copy.innerHTML,
        context: Object.fromEntries(["step","editing","questionType","blockPreset","experienceStyle","secureExam","mathMode","editorDirty","curriculumNeedsRelink","lastClassId","lastTrimester","lastCategory","copilotTargetClassIds"].map(key => [key, JSON.parse(JSON.stringify(state[key]))])),
      };
    };
    const restoreCopilotDraft = snapshot => {
      state.questions = snapshot.questions; state.learningTrail = snapshot.learningTrail;
      state.selectedSkills = new Set(snapshot.selectedSkills); state.skills = snapshot.skills;
      Object.assign(state, snapshot.context);
      snapshot.fields.forEach(item => { const control = field(item.name); if (control) { control.value = item.value; if (typeof item.checked === "boolean") control.checked = item.checked; } });
      renderFormatPanel();
      snapshot.fields.forEach(item => { const control = field(item.name); if (control) { control.value = item.value; if (typeof item.checked === "boolean") control.checked = item.checked; } });
      renderQuestions(); renderQuestionEditor();
      root.querySelector("[data-question-editor]").innerHTML = snapshot.editorHtml;
      state.editorDirty = snapshot.context.editorDirty;
      refreshSelected(); renderCurriculumContext(); go(snapshot.context.step);
    };
    const getCopilotDraft = () => ({ title: field("title").value, instructions: field("instructions").value, category: category(), duration: Number(field("duration").value), value: Number(field("value").value), scoringMode: field("scoringMode").value, questions: JSON.parse(JSON.stringify(state.questions)), learningTrail: state.learningTrail && JSON.parse(JSON.stringify(state.learningTrail)) });
    const undoCopilotSuggestion = () => {
      if (!state.copilotUndo || state.submitting) return { ok: false };
      const previous = state.copilotUndo, current = captureCopilotDraft();
      state.copilotUndo = current;
      state.copilotRedo = !state.copilotRedo;
      restoreCopilotDraft(previous);
      toast(state.copilotRedo ? "Rascunho anterior restaurado. Você pode reaplicar o ajuste do Copiloto." : "Ajuste do Copiloto reaplicado. Você pode restaurar o rascunho anterior.");
      return { ok: true };
    };
    root.querySelector("[data-copilot-undo]")?.addEventListener("click", undoCopilotSuggestion);
    const applyCopilotSuggestion = (suggestion, { append = false, targetClassIds = [] } = {}) => {
      if (state.submitting) throw new Error("Espere o salvamento terminar antes de alterar o rascunho.");
      const prepared = buildCopilotHandoff(suggestion, getCopilotDraft(), { append });
      const invalid = prepared.questions.find(validateQuestion);
      if (invalid) throw new Error("Revise a proposta: " + validateQuestion(invalid));
      if (targetClassIds.some(id => !classes.some(item => item.id === id))) throw new Error("A proposta contém uma turma que não está vinculada a este componente.");
      const before = captureCopilotDraft();
      const previousUndo = state.copilotUndo;
      const previousRedo = state.copilotRedo;
      try {
        field("title").value = prepared.title; field("instructions").value = prepared.instructions;
        field("category").value = prepared.category; field("duration").value = prepared.duration;
        field("value").value = prepared.value; field("scoringMode").value = prepared.scoringMode;
        state.questions = prepared.questions; state.learningTrail = prepared.learningTrail;
        state.selectedSkills = new Set(prepared.questions.flatMap(question => question.skillIds || []));
        state.copilotTargetClassIds = [...targetClassIds]; state.editing = -1; state.editorDirty = false;
        state.questionType = state.questions[0]?.type || "unica_escolha"; state.blockPreset = null;
        state.experienceStyle = prepared.learningTrail ? "trilha_guiada" : state.experienceStyle;
        state.copilotUndo = before;
        state.copilotRedo = false;
        renderFormatPanel(); renderQuestions(); renderQuestionEditor(); refreshSelected(); go(3);
      } catch (error) { state.copilotUndo = previousUndo; state.copilotRedo = previousRedo; restoreCopilotDraft(before); throw error; }
      return { ok: true, stageCount: learningStages(prepared.questions).length, questionCount: prepared.questions.length };
    };
    const applyCopilotIdea = idea => {
      const context = buildIdeaContext(idea), before = captureCopilotDraft();
      field("title").value = context.title; field("instructions").value = context.instructions;
      state.copilotUndo = before; state.copilotRedo = false; renderQuestions(); go(1);
      return { ok: true };
    };
    await window.initTeacherCopilot?.({
      root,
      state,
      field,
      activeClass,
      config,
      api,
      toast,
      renderQuestions,
      refreshSelected,
      go,
      applyCopilotSuggestion,
      applyCopilotIdea,
      undoCopilotSuggestion,
      getCopilotDraft,
    });
    if (initialClassId && classes.some(item => item.id === initialClassId)) {
      field("classId").value = initialClassId;
      state.lastClassId = initialClassId;
    }
    field("trimester").value = initialTrimester;
    state.lastTrimester = initialTrimester;
    renderFormatPanel();
    renderCurriculumContext();
    renderQuestionEditor();
    renderQuestions();
    refreshSelected();
    go(1);
    if (copyId) [...root.querySelectorAll("[data-duplicate-evaluation]")].find(button => button.dataset.duplicateEvaluation === copyId)?.click();
  };
})();
