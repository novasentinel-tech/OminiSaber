(() => {
  const config = window.OMINISABER_SUPABASE_CONFIG || {};
  const configured = Boolean(config.url && config.anonKey && window.supabase);
  const client = configured ? window.supabase.createClient(config.url, config.anonKey) : null;

  const frontendIndex = window.location.pathname.indexOf('/frontend/');
  const frontendRoot = frontendIndex >= 0 ? window.location.pathname.slice(0, frontendIndex) + '/frontend/' : '/frontend/';
  const routes = {
    login: `${frontendRoot}login/index.html`,
    dashboard: `${frontendRoot}aluno/dashboard_principal/index.html`,
    passwordReset: `${frontendRoot}redefinir-senha/index.html`,
    error: `${frontendRoot}erro/index.html`
  };

  const teacherRoutes = {
    matematica: `${frontendRoot}professor/professor_matematica/dashboard/index.html`,
    portugues: `${frontendRoot}professor/professor_portugues/dashboard/index.html`,
    tecnico_administracao: `${frontendRoot}professor/professor_tecnico_administracao/dashboard/index.html`,
    tecnico_informatica: `${frontendRoot}professor/professor_tecnico_informatica/dashboard/index.html`
  };

  const currentPage = window.location.pathname;
  const isLoginPage = currentPage.includes('/login/');
  const isPublicAuthPage = isLoginPage || currentPage.includes('/cadastro/') || currentPage.includes('/redefinir-senha/');
  const isStudentArea = currentPage.includes('/frontend/aluno/');

  const setupStudentSidebar = () => {
    if (!isStudentArea) return;
    document.body.dataset.appRole = 'student';
    document.body.dataset.requiredRole = 'aluno';
    document.body.classList.add('omni-student-nav-ready');

    if (!document.getElementById('ominisaber-student-sidebar')) {
      const link = document.createElement('link');
      link.id = 'ominisaber-student-sidebar';
      link.rel = 'stylesheet';
      link.href = `${frontendRoot}shared/student-sidebar.css?v=20260903-2`;
      document.head.appendChild(link);
    }

    const studentRoutes = {
      dashboard: `${frontendRoot}aluno/dashboard_principal/index.html`,
      trilhas: `${frontendRoot}aluno/modulo_de_trilhas/index.html`,
      redacao: `${frontendRoot}aluno/laboratorio_de_redacao/index.html`,
      evolucao: `${frontendRoot}aluno/minha_evolucao/index.html`,
      biblioteca: `${frontendRoot}aluno/biblioteca_digital/index.html`,
      notificacoes: `${frontendRoot}aluno/notificacoes/index.html`,
      agenda: `${frontendRoot}aluno/agenda/index.html`,
      perfil: `${frontendRoot}aluno/perfil/index.html`,
      ajuda: `${frontendRoot}aluno/ajuda-suporte/index.html`
    };
    const activeKey = currentPage.includes('/modulo_de_trilhas/') ? 'trilhas'
      : currentPage.includes('/laboratorio_de_redacao/') ? 'redacao'
        : currentPage.includes('/minha_evolucao/') ? 'evolucao'
          : currentPage.includes('/biblioteca_digital/') ? 'biblioteca'
            : currentPage.includes('/notificacoes/') ? 'notificacoes'
              : currentPage.includes('/agenda/') ? 'agenda'
                : currentPage.includes('/perfil/') ? 'perfil'
                  : currentPage.includes('/ajuda-suporte/') ? 'ajuda'
                    : 'dashboard';
    const navItem = (key, icon, label) => `<a href="${studentRoutes[key]}"${activeKey === key ? ' class="active" aria-current="page"' : ''}><span class="material-symbols-outlined" aria-hidden="true">${icon}</span><span>${label}</span></a>`;

    const candidates = [...document.querySelectorAll('aside.sidebar,aside.app-sidebar,aside.study-sidebar')]
      .filter((element) => !element.classList.contains('correction-sidebar') && !element.classList.contains('notes-drawer'));
    const sidebar = candidates.shift() || document.createElement('aside');
    candidates.forEach((element) => element.remove());
    if (!sidebar.isConnected) document.body.prepend(sidebar);
    sidebar.className = 'sidebar omni-student-sidebar';
    sidebar.dataset.sidebar = '';
    sidebar.setAttribute('aria-label', 'Navegação principal do aluno');
    sidebar.innerHTML = `
      <a class="omni-student-brand" href="${studentRoutes.dashboard}"><span class="omni-student-brand-mark material-symbols-outlined" aria-hidden="true">school</span><span>OminiSaber<small>Área do aluno</small></span></a>
      <nav class="omni-student-nav">
        <p class="omni-student-nav-label">Aprender</p>
        ${navItem('dashboard', 'space_dashboard', 'Início')}
        ${navItem('trilhas', 'route', 'Trilhas')}
        ${navItem('redacao', 'edit_note', 'Redação')}
        ${navItem('evolucao', 'monitoring', 'Evolução')}
        ${navItem('biblioteca', 'local_library', 'Biblioteca')}
        <p class="omni-student-nav-label">Organização</p>
        ${navItem('notificacoes', 'notifications', 'Notificações')}
        ${navItem('agenda', 'calendar_month', 'Agenda')}
        ${navItem('perfil', 'person', 'Perfil')}
        ${navItem('ajuda', 'help', 'Ajuda e suporte')}
      </nav>
      <div class="omni-student-account"><span class="omni-student-avatar" data-initials data-shell-avatar>AL</span><div><strong data-profile-name data-shell-name>Aluno</strong><small data-student-sidebar-grade data-profile-context data-profile-grade data-shell-class>Ensino Médio</small></div></div>
      <button class="omni-student-signout" type="button" data-student-signout><span class="material-symbols-outlined" aria-hidden="true">logout</span>Sair</button>`;
    sidebar.querySelector('[data-student-signout]')?.addEventListener('click', async (event) => {
      event.currentTarget.disabled = true;
      try { await signOut(); } catch (error) { notify(error.message, 'error'); event.currentTarget.disabled = false; }
    });

  };

  const setupUniversalSidebar = () => {
    if (isPublicAuthPage) return;
    setupStudentSidebar();
    const stylesheetId = 'ominisaber-sidebar-controls';
    if (!document.getElementById(stylesheetId)) {
      const link = document.createElement('link');
      link.id = stylesheetId;
      link.rel = 'stylesheet';
      link.href = `${frontendRoot}shared/sidebar-controls.css?v=20260902-2`;
      document.head.appendChild(link);
    }

    const sidebarSelector = '.sidebar,.library-sidebar,.portal-sidebar,.study-sidebar,.app-sidebar,[data-shared-sidebar]';
    const mobileClasses = ['menu-open', 'nav-open', 'study-menu-open'];
    const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
    const setCollapsed = (collapsed) => {
      document.body.classList.toggle('omni-sidebar-collapsed', collapsed && !isMobile());
      if (!isMobile()) localStorage.setItem('ominisaber-sidebar-collapsed', collapsed ? '1' : '0');
      document.querySelectorAll('[data-omni-sidebar-close]').forEach((button) => {
        button.setAttribute('aria-label', 'Fechar menu lateral');
      });
    };
    const closeMobile = () => {
      mobileClasses.forEach((className) => document.body.classList.remove(className));
      document.querySelectorAll('[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    };
    const openMobile = (sidebar) => {
      const className = sidebar.classList.contains('app-sidebar')
        ? 'nav-open'
        : sidebar.classList.contains('study-sidebar')
          ? 'study-menu-open'
          : 'menu-open';
      document.body.classList.add(className);
    };
    const hydrate = () => {
      const sidebars = [...document.querySelectorAll(sidebarSelector)].filter((sidebar) => !sidebar.closest('.builder-sidebar,.correction-sidebar'));
      if (!sidebars.length) return;
      document.querySelectorAll('.shared-sidebar-toggle,.sidebar-edge-reveal').forEach((control) => control.remove());
      sidebars.forEach((sidebar) => {
        if (sidebar.classList.contains('library-sidebar')) sidebar.setAttribute('data-sidebar', '');
        if (document.body.dataset.appRole === 'library') {
          const nav = sidebar.querySelector('nav');
          if (nav && !nav.dataset.libraryNavReady) {
            nav.dataset.libraryNavReady = 'true';
            const items = [
              ['dashboard', 'space_dashboard', 'Hoje'],
              ['gestao_emprestimos', 'sync_alt', 'Circulação'],
              ['estoque', 'shelves', 'Acervo e PDFs'],
              ['configuracoes', 'tune', 'Regras']
            ];
            nav.innerHTML = items.map(([segment, icon, label]) => {
              const href = `${frontendRoot}bibliotecaria/${segment}/${segment === 'dashboard' ? 'index.html' : 'index.html'}`;
              const active = currentPage.includes(`/bibliotecaria/${segment}/`);
              return `<a href="${href}"${active ? ' class="active" aria-current="page"' : ''}><span class="material-symbols-outlined" aria-hidden="true">${icon}</span><span>${label}</span></a>`;
            }).join('');
          }
        }
        if (document.body.dataset.appRole === 'library' && !sidebar.querySelector('[data-library-sidebar-status]')) {
          const status = document.createElement('div');
          status.className = 'library-sidebar-status';
          status.dataset.librarySidebarStatus = 'true';
          status.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${configured ? 'cloud_done' : 'cloud_off'}</span><div><strong>${configured ? 'Acervo conectado' : 'Sem conexão'}</strong><small>${configured ? 'Dados em tempo real' : 'Revise o arquivo .env'}</small></div>`;
          sidebar.insertBefore(status, sidebar.querySelector('[data-signout]'));
        }
        if (sidebar.dataset.omniSidebarReady) return;
        sidebar.dataset.omniSidebarReady = 'true';
        sidebar.classList.add('omni-sidebar-managed');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'omni-sidebar-close';
        button.dataset.omniSidebarClose = 'true';
        button.setAttribute('aria-label', 'Fechar menu lateral');
        button.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">left_panel_close</span>';
        button.addEventListener('click', () => {
          if (isMobile()) closeMobile();
          else setCollapsed(true);
        });
        sidebar.appendChild(button);
      });

      if (!document.querySelector('[data-omni-sidebar-edge]')) {
        const reveal = document.createElement('button');
        reveal.type = 'button';
        reveal.className = 'omni-sidebar-edge';
        reveal.dataset.omniSidebarEdge = 'true';
        reveal.setAttribute('aria-label', 'Abrir menu lateral');
        reveal.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">left_panel_open</span>';
        reveal.addEventListener('click', () => {
          const sidebar = document.querySelector(sidebarSelector);
          if (isMobile() && sidebar) openMobile(sidebar);
          else setCollapsed(false);
        });
        document.body.appendChild(reveal);
      }
      if (!document.querySelector('[data-omni-sidebar-mobile]')) {
        const mobileReveal = document.createElement('button');
        mobileReveal.type = 'button';
        mobileReveal.className = 'omni-sidebar-mobile';
        mobileReveal.dataset.omniSidebarMobile = 'true';
        mobileReveal.setAttribute('aria-label', document.body.dataset.appRole === 'library' ? 'Abrir menu da biblioteca' : 'Abrir menu lateral');
        mobileReveal.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">menu</span><span>Menu</span>';
        mobileReveal.addEventListener('click', () => {
          const sidebar = document.querySelector(sidebarSelector);
          if (sidebar) openMobile(sidebar);
        });
        document.body.appendChild(mobileReveal);
      }
      if (!document.querySelector('[data-omni-sidebar-backdrop]')) {
        const backdrop = document.createElement('button');
        backdrop.type = 'button';
        backdrop.className = 'omni-sidebar-backdrop';
        backdrop.dataset.omniSidebarBackdrop = 'true';
        backdrop.setAttribute('aria-label', 'Fechar menu lateral');
        backdrop.addEventListener('click', closeMobile);
        document.body.appendChild(backdrop);
      }
    };

    setCollapsed(localStorage.getItem('ominisaber-sidebar-collapsed') === '1');
    hydrate();
    const observer = new MutationObserver(hydrate);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', () => {
      if (isMobile()) document.body.classList.remove('omni-sidebar-collapsed');
      else setCollapsed(localStorage.getItem('ominisaber-sidebar-collapsed') === '1');
    }, { passive: true });
  };

  const notify = (message, type = 'info') => {
    const event = new CustomEvent('ominisaber:notification', { detail: { message, type } });
    document.dispatchEvent(event);

    let element = document.querySelector('[data-backend-status]');
    if (!element) {
      element = document.createElement('div');
      element.dataset.backendStatus = 'true';
      element.className = 'backend-status';
      element.innerHTML = '<span class="backend-status-icon" aria-hidden="true"></span><div class="backend-status-content"><strong class="backend-status-title"></strong><p class="backend-status-message"></p></div><button type="button" class="backend-status-close" aria-label="Fechar mensagem">&times;</button>';
      element.querySelector('.backend-status-close').addEventListener('click', () => { element.hidden = true; });
      document.body.appendChild(element);
    }
    const titles = { error: 'Não foi possível concluir', warning: 'Atenção', success: 'Tudo certo', info: 'Informação' };
    const icons = { error: '!', warning: '!', success: '✓', info: 'i' };
    element.querySelector('.backend-status-title').textContent = titles[type] || titles.info;
    element.querySelector('.backend-status-message').textContent = message;
    element.querySelector('.backend-status-icon').textContent = icons[type] || icons.info;
    element.dataset.type = type;
    element.hidden = false;
    window.clearTimeout(element._hideTimer);
    element._hideTimer = window.setTimeout(() => { element.hidden = true; }, 5000);
  };

  const ensureConfigured = () => {
    if (!configured) {
      notify('Conexão Supabase não configurada. Preencha backend/ominisaber-supabase-config.js.', 'warning');
      return false;
    }
    return true;
  };

  const getSession = async () => {
    if (!configured) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  };

  const getProfile = async (userId) => {
    if (!ensureConfigured()) return null;
    const id = userId || (await getSession())?.user?.id;
    if (!id) return null;
    const { data, error } = await client.from('perfis').select('*, turmas!perfis_turma_id_fkey(id,nome,serie,ano_letivo)').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  };

  const getProfileDestination = (profile) => {
    if (!profile) throw new Error('PROFILE_NOT_FOUND');
    if (profile.role === 'aluno') return routes.dashboard;
    if (profile.role === 'bibliotecaria') return `${frontendRoot}bibliotecaria/dashboard/index.html`;
    if (profile.role === 'gestor') return `${frontendRoot}gestor/dashboard/index.html`;
    if (profile.role === 'professor') {
      const destination = teacherRoutes[profile.tipo_professor];
      if (!destination) throw new Error('TEACHER_SPECIALTY_NOT_FOUND');
      return destination;
    }
    throw new Error('ROLE_NOT_SUPPORTED');
  };

  const requireRole = async (allowedRoles) => {
    const profile = await getProfile();
    if (!profile || !allowedRoles.includes(profile.role)) {
      notify('Você não possui permissão para acessar esta área.', 'error');
      window.location.href = `${routes.error}?code=forbidden`;
      return false;
    }
    return true;
  };

  const signIn = async (email, password) => {
    if (!ensureConfigured()) return { data: null, error: new Error('Supabase não configurado') };
    const identifier = String(email || '').trim();
    let loginEmail = identifier.toLowerCase();
    if (!identifier.includes('@')) {
      const { data, error } = await client.rpc('email_por_matricula', { matricula_input: identifier });
      if (error) return { data: null, error };
      if (!data) return { data: null, error: new Error('Matrícula não encontrada.') };
      loginEmail = String(data).trim().toLowerCase();
    }
    return client.auth.signInWithPassword({ email: loginEmail, password });
  };

  const signUp = async ({ nome, matricula, email, password, curso_tecnico }) => {
    if (!ensureConfigured()) return { data: null, error: new Error('Supabase não configurado') };
    if (!['administracao', 'informatica'].includes(curso_tecnico)) {
      return { data: null, error: new Error('Selecione o curso técnico do aluno.') };
    }
    return client.auth.signUp({
      email: String(email || '').trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${routes.login}?confirmacao=concluida`,
        data: {
          nome: String(nome || '').trim(),
          matricula: String(matricula || '').trim(),
          curso_tecnico
        }
      }
    });
  };

  const resendSignupConfirmation = async (email) => {
    if (!ensureConfigured()) return { data: null, error: new Error('Supabase não configurado') };
    return client.auth.resend({
      type: 'signup',
      email: String(email || '').trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}${routes.login}?confirmacao=concluida` }
    });
  };

  const requestPasswordReset = async (email) => {
    if (!ensureConfigured()) return { data: null, error: new Error('Supabase não configurado') };
    return client.auth.resetPasswordForEmail(String(email || '').trim().toLowerCase(), {
      redirectTo: `${window.location.origin}${routes.passwordReset}`
    });
  };

  const clearSession = async () => {
    if (!configured) return;
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!configured) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    window.location.href = routes.login;
  };

  const listTrilhas = async ({ tipo } = {}) => {
    if (!ensureConfigured()) return [];
    const profile = await getProfile();
    let query = client.from('trilhas').select('*, atividades(*)').eq('publicada', true).order('created_at', { ascending: false });
    if (profile?.turma_id) query = query.or(`turma_id.eq.${profile.turma_id},turma_id.is.null`);
    if (tipo) query = query.eq('tipo', tipo);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const listStudentNotes = async () => {
    if (!ensureConfigured()) return [];
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client.from('notas').select('*').eq('aluno_id', session.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  const listStudentProgress = async () => {
    if (!ensureConfigured()) return [];
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client.from('progresso_atividades').select('*, atividades(id, trilha_id, titulo, trilhas(id, titulo, materia, tipo))').eq('aluno_id', session.user.id);
    if (error) throw error;
    return data || [];
  };

  const listStudentRedacoes = async () => {
    if (!ensureConfigured()) return [];
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client.from('redacoes').select('*').eq('aluno_id', session.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  const listWritingPrompts = async () => {
    if (!ensureConfigured()) return [];
    const { data, error } = await client.from('propostas_redacao').select('*, materiais_redacao(*)').eq('publicada', true).order('fixada', { ascending: false }).order('prazo', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data || []).map((prompt) => ({ ...prompt, materiais_redacao: (prompt.materiais_redacao || []).sort((a, b) => Number(a.ordem) - Number(b.ordem)) }));
  };

  const getWritingPrompt = async (promptId) => {
    if (!ensureConfigured()) return null;
    const { data, error } = await client.from('propostas_redacao').select('*, materiais_redacao(*)').eq('id', promptId).eq('publicada', true).maybeSingle();
    if (error) throw error;
    return data ? { ...data, materiais_redacao: (data.materiais_redacao || []).sort((a, b) => Number(a.ordem) - Number(b.ordem)) } : null;
  };

  const listWritingRepertoires = async ({ proposalId = null, category = '' } = {}) => {
    if (!ensureConfigured()) return [];
    const profile = await getProfile();
    let query = client.from('repertorios_redacao').select('*').eq('publicado', true).eq('contextualizado', true).order('categoria').order('titulo');
    query = proposalId ? query.or(`proposta_id.eq.${proposalId},proposta_id.is.null`) : query.is('proposta_id', null);
    if (profile?.turma_id) query = query.or(`turma_id.eq.${profile.turma_id},turma_id.is.null`);
    if (category) query = query.eq('categoria', category);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const getEssayPlanning = async (themeCode) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client.from('planejamentos_redacao')
      .select('*, planejamento_repertorios(repertorio_id,uso_planejado,repertorios_redacao(*))')
      .eq('aluno_id', session.user.id).eq('tema_codigo', themeCode).maybeSingle();
    if (error) throw error;
    return data;
  };

  const saveEssayPlanning = async ({ themeCode, proposalId = null, notes = '', thesis = '', arguments: argumentsList = [], intervention = {}, repertoireIds = [], contextualRepertoires = [] }) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client.from('planejamentos_redacao').upsert({
      aluno_id: session.user.id,
      proposta_id: proposalId,
      tema_codigo: themeCode,
      anotacoes: String(notes || '').slice(0, 20000),
      tese: String(thesis || '').slice(0, 4000),
      argumentos: Array.isArray(argumentsList) ? argumentsList : [],
      repertorios_contextuais: Array.isArray(contextualRepertoires) ? contextualRepertoires : [],
      intervencao: intervention && typeof intervention === 'object' ? intervention : {},
      updated_at: new Date().toISOString()
    }, { onConflict: 'aluno_id,tema_codigo' }).select().single();
    if (error) throw error;
    const { error: removeError } = await client.from('planejamento_repertorios').delete().eq('planejamento_id', data.id);
    if (removeError) throw removeError;
    const uniqueIds = [...new Set(repertoireIds.filter(Boolean))];
    if (uniqueIds.length) {
      const { error: linkError } = await client.from('planejamento_repertorios').insert(uniqueIds.map((repertorioId) => ({ planejamento_id: data.id, repertorio_id: repertorioId })));
      if (linkError) throw linkError;
    }
    return data;
  };

  const listTeacherClasses = async () => {
    if (!ensureConfigured()) return [];
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client.from('professor_turmas').select('materia, turmas!professor_turmas_turma_id_fkey(id,nome,serie)').eq('professor_id', session.user.id);
    if (error) throw error;
    return (data || []).map((item) => ({ ...item.turmas, materia: item.materia })).filter((item) => item.id);
  };

  const listCurriculumSkills = async ({ materia, serie = null, trimestre = null, search = '' } = {}) => {
    if (!ensureConfigured()) return [];
    const { data, error } = await client.rpc('buscar_habilidades_curriculares', {
      p_materia: materia,
      p_serie: serie || null,
      p_trimestre: trimestre || null,
      p_busca: search || null
    });
    if (error) throw error;
    return data || [];
  };

  const listTeacherStudentIds = async (classIds) => {
    if (!classIds.length) return [];
    const { data, error } = await client.from('perfis').select('id').eq('role', 'aluno').in('turma_id', classIds);
    if (error) throw error;
    return (data || []).map((item) => item.id);
  };

  const createWritingPrompt = async ({ title, category, command, motivators = [], rubric, deadline, classId = null, className = null, published = false, pinned = false, summary = '', axis = '', difficulty = 'intermediaria', estimatedMinutes = 90, keywords = [], details = {}, skillIds = [] }) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    let targetClassId = classId;
    if (!targetClassId && className) {
      const { data: targetClass, error: classError } = await client.from('turmas').select('id').eq('nome', className).maybeSingle();
      if (classError) throw classError;
      targetClassId = targetClass?.id || null;
    }
    const { data, error } = await client.from('propostas_redacao').insert({
      titulo: title,
      categoria: category,
      comando: command,
      textos_motivadores: motivators,
      rubrica,
      professor_id: session.user.id,
      turma_id: targetClassId,
      prazo: deadline,
      publicada: published,
      fixada: pinned,
      resumo: summary || null,
      eixo_tematico: axis || null,
      dificuldade: difficulty,
      tempo_estimado_min: estimatedMinutes,
      palavras_chave: keywords,
      detalhes: details
    }).select().single();
    if (error) throw error;
    const uniqueSkillIds = [...new Set((skillIds || []).filter(Boolean))];
    if (uniqueSkillIds.length) {
      const { error: linkError } = await client.from('propostas_redacao_habilidades').insert(uniqueSkillIds.map((habilidade_id) => ({ proposta_id: data.id, habilidade_id })));
      if (linkError) { await client.from('propostas_redacao').delete().eq('id', data.id); throw linkError; }
    }
    return data;
  };

  const listTeacherWritingPrompts = async () => {
    if (!ensureConfigured()) return [];
    const { session } = await assertTeacherSpecialty('portugues');
    const { data, error } = await client.from('propostas_redacao')
      .select('*, turmas!propostas_redacao_turma_id_fkey(id,nome,serie), materiais_redacao(*)')
      .eq('professor_id', session.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((prompt) => ({
      ...prompt,
      materiais_redacao: [...(prompt.materiais_redacao || [])].sort((a, b) => Number(a.ordem) - Number(b.ordem))
    }));
  };

  const listTeacherEssays = async () => {
    if (!ensureConfigured()) return [];
    const { session } = await assertTeacherSpecialty('portugues');
    const classes = await listTeacherClasses();
    const studentIds = await listTeacherStudentIds(classes.map((item) => item.id));
    if (!studentIds.length) return [];
    const { data, error } = await client.from('redacoes').select('*, perfis!redacoes_aluno_id_fkey(nome,turma_id,turmas!perfis_turma_id_fkey(id,nome,serie)), propostas_redacao!redacoes_proposta_id_fkey(id,titulo,prazo,categoria), avaliacoes_competencias_redacao(competencia,nota,comentario), comentarios_redacao(id,inicio_offset,fim_offset,trecho,comentario,tipo,created_at)').in('aluno_id', studentIds).in('status', ['enviada', 'corrigida']).order('enviada_em', { ascending: true });
    if (error) throw error;
    return (data || []).map((essay) => ({
      ...essay,
      avaliacoes_competencias_redacao: [...(essay.avaliacoes_competencias_redacao || [])].sort((a, b) => Number(a.competencia) - Number(b.competencia)),
      comentarios_redacao: [...(essay.comentarios_redacao || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    }));
  };

  const listEssayCorrectionDrafts = async () => {
    if (!ensureConfigured()) return [];
    const { session } = await assertTeacherSpecialty('portugues');
    const { data, error } = await client.from('rascunhos_correcao_redacao').select('*').eq('professor_id', session.user.id);
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return [];
      throw error;
    }
    return data || [];
  };

  const saveEssayCorrectionDraft = async (essayId, { score = null, feedback = '', competencies = [] } = {}) => {
    if (!ensureConfigured()) return null;
    const { session } = await assertTeacherSpecialty('portugues');
    const normalizedScore = score === '' || score === null ? null : Number(score);
    const { data, error } = await client.from('rascunhos_correcao_redacao').upsert({
      redacao_id: essayId,
      professor_id: session.user.id,
      nota: Number.isFinite(normalizedScore) ? normalizedScore : null,
      feedback: String(feedback || '').slice(0, 20000),
      competencias: Array.isArray(competencies) ? competencies : [],
      updated_at: new Date().toISOString()
    }, { onConflict: 'redacao_id,professor_id' }).select().single();
    if (error) throw error;
    return data;
  };

  const correctEssay = async (essayId, { score, feedback, competencies = [], comments = [] }) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const atomic = await client.rpc('corrigir_redacao', {
      redacao_input: essayId,
      nota_input: score,
      feedback_input: feedback,
      competencias_input: competencies,
      comentarios_input: comments
    });
    if (!atomic.error) return atomic.data;
    if (atomic.error.code !== 'PGRST202' && atomic.error.code !== '42883') throw atomic.error;

    // Compatibilidade temporária com bancos ainda sem a migração transacional.
    const { data, error } = await client.from('redacoes').update({ nota: score, feedback, status: 'corrigida', corrigida_por: session.user.id, corrigida_em: new Date().toISOString() }).eq('id', essayId).select().single();
    if (error) throw error;
    if (competencies.length) {
      const { error: competenciesError } = await client.from('avaliacoes_competencias_redacao').upsert(competencies.map((item) => ({ redacao_id: essayId, competencia: item.competencia, nota: item.nota, comentario: item.comentario || null, professor_id: session.user.id })), { onConflict: 'redacao_id,competencia' });
      if (competenciesError) throw competenciesError;
    }
    if (comments.length) {
      const { error: commentsError } = await client.from('comentarios_redacao').insert(comments.map((item) => ({ redacao_id: essayId, professor_id: session.user.id, inicio_offset: item.inicioOffset ?? null, fim_offset: item.fimOffset ?? null, trecho: item.trecho || null, comentario: item.comentario, tipo: item.tipo || 'orientacao' })));
      if (commentsError) throw commentsError;
    }
    const { error: draftError } = await client.from('rascunhos_correcao_redacao').delete().eq('redacao_id', essayId).eq('professor_id', session.user.id);
    if (draftError && draftError.code !== '42P01' && draftError.code !== 'PGRST205') throw draftError;
    return data;
  };

  const getTeacherSummary = async () => {
    if (!ensureConfigured()) return null;
    const profile = await getProfile();
    const classes = await listTeacherClasses();
    const classIds = classes.map((item) => item.id);
    const studentIds = await listTeacherStudentIds(classIds);
    let studentsQuery = client.from('perfis').select('id', { count: 'exact', head: true }).eq('role', 'aluno');
    if (classIds.length) studentsQuery = studentsQuery.in('turma_id', classIds);
    const [studentsResult, essaysResult, progressResult] = await Promise.all([
      studentsQuery,
      studentIds.length ? client.from('redacoes').select('id', { count: 'exact', head: true }).in('aluno_id', studentIds).eq('status', 'enviada') : Promise.resolve({ count: 0, error: null }),
      studentIds.length ? client.from('progresso_atividades').select('concluida').in('aluno_id', studentIds) : Promise.resolve({ data: [], error: null })
    ]);
    if (studentsResult.error) throw studentsResult.error;
    if (essaysResult.error) throw essaysResult.error;
    if (progressResult.error) throw progressResult.error;
    const progress = progressResult.data || [];
    const completed = progress.filter((item) => item.concluida).length;
    return { students: studentsResult.count || 0, pendingEssays: essaysResult.count || 0, averageProgress: progress.length ? Math.round((completed / progress.length) * 100) : 0 };
  };

  const assertTeacherSpecialty = async (expectedType) => {
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const profile = await getProfile(session.user.id);
    if (profile?.role !== 'professor' || profile.tipo_professor !== expectedType) {
      throw new Error('Sua conta não possui acesso a esta especialidade docente.');
    }
    return { session, profile };
  };

  const listTeacherLabs = async ({ tipoProfessor, status } = {}) => {
    if (!ensureConfigured()) return [];
    const { session } = await assertTeacherSpecialty(tipoProfessor);
    let query = client.from('laboratorios_docentes').select('*, turmas!laboratorios_docentes_turma_id_fkey(id,nome,serie), entregas_laboratorio(id,status,nota)').eq('professor_id', session.user.id).eq('tipo_professor', tipoProfessor).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const createTeacherLab = async ({ tipoProfessor, title, description, format, configuration = {}, classId = null, deadline = null, publish = false, skillIds = [] }) => {
    if (!ensureConfigured()) return null;
    if (!String(title || '').trim() || !String(format || '').trim()) throw new Error('Informe título e formato do laboratório.');
    const { session } = await assertTeacherSpecialty(tipoProfessor);
    const { data, error } = await client.from('laboratorios_docentes').insert({
      professor_id: session.user.id,
      turma_id: classId || null,
      tipo_professor: tipoProfessor,
      titulo: String(title).trim(),
      descricao: description || '',
      formato: format,
      configuracao: configuration,
      prazo: deadline || null,
      status: publish ? 'publicado' : 'rascunho',
      publicado_em: publish ? new Date().toISOString() : null
    }).select().single();
    if (error) throw error;
    const uniqueSkillIds = [...new Set((skillIds || []).filter(Boolean))];
    if (uniqueSkillIds.length) {
      const { error: linkError } = await client.from('laboratorios_docentes_habilidades').insert(uniqueSkillIds.map((habilidade_id) => ({ laboratorio_id: data.id, habilidade_id })));
      if (linkError) { await client.from('laboratorios_docentes').delete().eq('id', data.id); throw linkError; }
    }
    return data;
  };

  const updateTeacherLabStatus = async (labId, status) => {
    if (!ensureConfigured()) return null;
    if (!['rascunho', 'publicado', 'encerrado'].includes(status)) throw new Error('Status de laboratório inválido.');
    const { data, error } = await client.from('laboratorios_docentes').update({ status, publicado_em: status === 'publicado' ? new Date().toISOString() : null }).eq('id', labId).select().single();
    if (error) throw error;
    return data;
  };

  const listTeacherEvaluations = async ({ tipoProfessor, status } = {}) => {
    if (!ensureConfigured()) return [];
    const { session } = await assertTeacherSpecialty(tipoProfessor);
    let query = client.from('avaliacoes_docentes').select('*, turmas!avaliacoes_docentes_turma_id_fkey(id,nome,serie), questoes_avaliacao(id,tipo,pontos), tentativas_avaliacao(id,status,nota)').eq('professor_id', session.user.id).eq('tipo_professor', tipoProfessor).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const createTeacherEvaluation = async ({ tipoProfessor, title, instructions, duration, value, classId = null, opensAt = null, closesAt = null, configuration = {}, questions = [], publish = false }) => {
    if (!ensureConfigured()) return null;
    if (!String(title || '').trim()) throw new Error('Informe o título da avaliação.');
    if (!Array.isArray(questions) || questions.length === 0) throw new Error('Adicione pelo menos uma questão.');
    if (questions.some((question) => !String(question.statement || '').trim())) throw new Error('Todas as questões precisam de enunciado.');
    const { session } = await assertTeacherSpecialty(tipoProfessor);
    const { data: evaluation, error } = await client.from('avaliacoes_docentes').insert({
      professor_id: session.user.id,
      turma_id: classId || null,
      tipo_professor: tipoProfessor,
      titulo: String(title).trim(),
      instrucoes: instructions || '',
      duracao_minutos: duration || null,
      valor: value || 10,
      configuracao: configuration,
      status: 'rascunho',
      abre_em: opensAt || null,
      encerra_em: closesAt || null
    }).select().single();
    if (error) throw error;
    {
      const rows = questions.map((question, index) => ({
        avaliacao_id: evaluation.id,
        ordem: index + 1,
        tipo: question.type,
        enunciado: question.statement,
        alternativas: question.alternatives || [],
        pontos: question.points || 1
      }));
      const { data: insertedQuestions, error: questionsError } = await client.from('questoes_avaliacao').insert(rows).select('id,ordem');
      if (questionsError) {
        await client.from('avaliacoes_docentes').delete().eq('id', evaluation.id);
        throw questionsError;
      }
      const skillRows = (insertedQuestions || []).flatMap((questionRow) => [...new Set((questions[questionRow.ordem - 1]?.skillIds || []).filter(Boolean))].map((habilidade_id) => ({ questao_id: questionRow.id, habilidade_id })));
      if (skillRows.length) {
        const { error: skillsError } = await client.from('questoes_avaliacao_habilidades').insert(skillRows);
        if (skillsError) { await client.from('avaliacoes_docentes').delete().eq('id', evaluation.id); throw skillsError; }
      }
      const answerRows = (insertedQuestions || []).map((questionRow) => ({
        questao_id: questionRow.id,
        resposta_esperada: { value: questions[questionRow.ordem - 1]?.answer || '' }
      }));
      const { error: answersError } = await client.from('gabaritos_avaliacao').insert(answerRows);
      if (answersError) {
        await client.from('avaliacoes_docentes').delete().eq('id', evaluation.id);
        throw answersError;
      }
    }
    if (!publish) return evaluation;
    const { data: published, error: publishError } = await client.from('avaliacoes_docentes').update({ status: 'publicado', publicado_em: new Date().toISOString() }).eq('id', evaluation.id).select().single();
    if (publishError) throw publishError;
    return published;
  };

  const updateTeacherEvaluationStatus = async (evaluationId, status) => {
    if (!ensureConfigured()) return null;
    if (!['rascunho', 'publicado', 'encerrado'].includes(status)) throw new Error('Status de avaliação inválido.');
    const { data, error } = await client.from('avaliacoes_docentes').update({ status, publicado_em: status === 'publicado' ? new Date().toISOString() : null }).eq('id', evaluationId).select().single();
    if (error) throw error;
    return data;
  };

  const getTeacherWorkspace = async (tipoProfessor) => {
    const [profile, classes, labs, evaluations] = await Promise.all([
      getProfile(),
      listTeacherClasses(),
      listTeacherLabs({ tipoProfessor }),
      listTeacherEvaluations({ tipoProfessor })
    ]);
    const classIds = classes.map((item) => item.id);
    let studentCount = 0;
    if (classIds.length) {
      const { count, error } = await client.from('perfis').select('id', { count: 'exact', head: true }).eq('role', 'aluno').in('turma_id', classIds);
      if (error) throw error;
      studentCount = count || 0;
    }
    return { profile, classes, labs, evaluations, studentCount };
  };

  const listStudentEvaluations = async ({ tipoProfessor = null } = {}) => {
    if (!ensureConfigured()) return [];
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    let query = client
      .from('avaliacoes_docentes')
      .select('*, questoes_avaliacao(id,ordem,tipo,enunciado,alternativas,pontos)')
      .eq('status', 'publicado')
      .order('publicado_em', { ascending: false });
    if (tipoProfessor) query = query.eq('tipo_professor', tipoProfessor);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((evaluation) => ({
      ...evaluation,
      questoes_avaliacao: [...(evaluation.questoes_avaliacao || [])].sort((a, b) => a.ordem - b.ordem)
    }));
  };

  const getStudentEvaluationAttempt = async (evaluationId) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client
      .from('tentativas_avaliacao')
      .select('*')
      .eq('avaliacao_id', evaluationId)
      .eq('aluno_id', session.user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const saveStudentEvaluationAttempt = async ({ evaluationId, responses, submit = false }) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const payload = {
      avaliacao_id: evaluationId,
      aluno_id: session.user.id,
      respostas: responses,
      status: submit ? 'enviada' : 'em_andamento',
      enviada_em: submit ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await client
      .from('tentativas_avaliacao')
      .upsert(payload, { onConflict: 'avaliacao_id,aluno_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const listStudentLoans = async () => {
    if (!ensureConfigured()) return [];
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client.from('solicitacoes_emprestimo').select('*, livros(id, titulo, autor)').eq('aluno_id', session.user.id).order('solicitado_em', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  const listLivros = async (search = '') => {
    if (!ensureConfigured()) return [];
    let query = client.from('livros').select('*').order('titulo');
    if (search.trim()) query = query.or(`titulo.ilike.%${search.trim()}%,autor.ilike.%${search.trim()}%`);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const saveEssayDraft = async ({ essayId = null, titulo, texto, themeCode, proposalId = null, planningId = null, trilhaId = null }) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const payload = {
      aluno_id: session.user.id,
      titulo,
      texto,
      trilha_id: trilhaId,
      proposta_id: propostaId,
      tema_codigo: themeCode,
      planejamento_id: planningId,
      status: 'rascunho',
      updated_at: new Date().toISOString()
    };
    let existingId = essayId;
    if (!existingId) {
      const { data: existing, error: existingError } = await client.from('redacoes').select('id').eq('aluno_id', session.user.id).eq('tema_codigo', themeCode).eq('status', 'rascunho').maybeSingle();
      if (existingError) throw existingError;
      existingId = existing?.id || null;
    }
    const request = existingId
      ? client.from('redacoes').update(payload).eq('id', existingId).eq('aluno_id', session.user.id).eq('status', 'rascunho')
      : client.from('redacoes').insert(payload);
    const { data, error } = await request.select().single();
    if (error) throw error;
    return data;
  };

  const getEssayDraft = async (themeCode) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client.from('redacoes').select('*').eq('aluno_id', session.user.id).eq('tema_codigo', themeCode).eq('status', 'rascunho').maybeSingle();
    if (error) throw error;
    return data;
  };

  const submitEssayDraft = async (essayId) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const now = new Date().toISOString();
    const { data, error } = await client.from('redacoes').update({ status: 'enviada', enviada_em: now, enviada_para_revisao_em: now, updated_at: now }).eq('id', essayId).eq('aluno_id', session.user.id).eq('status', 'rascunho').select().single();
    if (error) throw error;
    return data;
  };

  const createRedacao = async ({ titulo, texto, trilhaId = null, propostaId = null, themeCode = null, planningId = null }) => {
    const draft = await saveEssayDraft({ titulo, texto, trilhaId, proposalId: propostaId, themeCode: themeCode || `livre:${Date.now()}`, planningId });
    return submitEssayDraft(draft.id);
  };

  const getStudentEssay = async (essayId) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client.from('redacoes').select('*, propostas_redacao(*), planejamentos_redacao(*, planejamento_repertorios(repertorios_redacao(*))), versoes_redacao(*), comentarios_redacao(*), avaliacoes_competencias_redacao(*)').eq('id', essayId).eq('aluno_id', session.user.id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    data.versoes_redacao = (data.versoes_redacao || []).sort((a, b) => Number(b.numero) - Number(a.numero));
    data.comentarios_redacao = (data.comentarios_redacao || []).sort((a, b) => Number(a.inicio_offset ?? 0) - Number(b.inicio_offset ?? 0));
    data.avaliacoes_competencias_redacao = (data.avaliacoes_competencias_redacao || []).sort((a, b) => Number(a.competencia) - Number(b.competencia));
    return data;
  };

  const listStudentEssayHistory = async () => {
    if (!ensureConfigured()) return [];
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client.from('redacoes').select('id,titulo,tema_codigo,status,nota,created_at,updated_at,enviada_em,corrigida_em,propostas_redacao(id,titulo,categoria),versoes_redacao(id,numero,created_at)').eq('aluno_id', session.user.id).order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  const managerSession = async () => {
    if (!ensureConfigured()) throw new Error('Supabase não configurado.');
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const profile = await getProfile(session.user.id);
    if (profile?.role !== 'gestor') throw new Error('Acesso exclusivo do gestor.');
    return { session, profile };
  };

  const managerSelect = async (table, select = '*', options = {}) => {
    await managerSession();
    let query = client.from(table).select(select);
    if (options.order) query = query.order(options.order, { ascending: options.ascending ?? true });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const getManagerOverview = async () => {
    await managerSession();
    const optional = (promise) => promise.catch(() => []);
    const [classes, profiles, links, descriptors, trails, labs, evaluations, prompts, accesses] = await Promise.all([
      managerSelect('turmas', '*', { order: 'nome' }),
      managerSelect('perfis', '*'),
      managerSelect('professor_turmas', 'professor_id,turma_id,materia,created_at'),
      optional(managerSelect('descritores_curriculares', '*')),
      managerSelect('trilhas', 'id,titulo,publicada,turma_id,materia_codigo,descritor_sedu,created_at'),
      managerSelect('laboratorios_docentes', 'id,titulo,status,turma_id,created_at'),
      managerSelect('avaliacoes_docentes', 'id,titulo,status,turma_id,created_at'),
      managerSelect('propostas_redacao', 'id,titulo,publicada,turma_id,created_at'),
      optional(managerSelect('solicitacoes_acesso', '*', { order: 'created_at', ascending: false }))
    ]);
    return { classes, profiles, links, descriptors, trails, labs, evaluations, prompts, accesses };
  };

  const getCurriculumCoverage = async ({ materia = null, serie = null, trimestre = null, turmaId = null, professorId = null } = {}) => {
    await managerSession();
    const { data, error } = await client.rpc('cobertura_curricular', {
      p_materia: materia || null,
      p_serie: serie || null,
      p_trimestre: trimestre || null,
      p_turma_id: turmaId || null,
      p_professor_id: professorId || null
    });
    if (error) throw error;
    return data || [];
  };

  const listManagerClasses = () => managerSelect('turmas', '*', { order: 'nome' });
  const saveManagerClass = async (payload) => {
    await managerSession();
    const record = { nome: payload.nome.trim(), ano_letivo: Number(payload.ano_letivo), serie: String(payload.serie || '').trim() || null };
    const query = payload.id ? client.from('turmas').update(record).eq('id', payload.id) : client.from('turmas').insert(record);
    const { data, error } = await query.select().single(); if (error) throw error; return data;
  };
  const listManagerProfiles = async (role) => {
    const rows = await managerSelect('perfis', '*,turmas!perfis_turma_id_fkey(id,nome,serie)');
    return role ? rows.filter((row) => row.role === role) : rows;
  };
  const updateManagerProfile = async (id, changes) => {
    await managerSession();
    const coreKeys = ['nome', 'matricula', 'curso_tecnico', 'turma_id', 'tipo_professor'];
    const core = Object.fromEntries(Object.entries(changes || {}).filter(([key]) => coreKeys.includes(key)));
    if (Object.keys(core).length) {
      const { error } = await client.from('perfis').update(core).eq('id', id);
      if (error) throw error;
    }
    const { data, error } = await client.from('perfis').select('*,turmas!perfis_turma_id_fkey(id,nome,serie)').eq('id', id).single();
    if (error) throw error;
    return data;
  };
  const listManagerLinks = () => managerSelect('professor_turmas', 'professor_id,turma_id,materia,created_at,perfis!professor_turmas_professor_id_fkey(id,nome,tipo_professor),turmas!professor_turmas_turma_id_fkey(id,nome,serie)');
  const saveManagerLink = async (payload) => { await managerSession(); const { data, error } = await client.from('professor_turmas').upsert(payload).select().single(); if (error) throw error; return data; };
  const removeManagerLink = async (professorId, turmaId) => { await managerSession(); const { error } = await client.from('professor_turmas').delete().eq('professor_id', professorId).eq('turma_id', turmaId); if (error) throw error; };
  const listManagerDescriptors = () => managerSelect('descritores_curriculares', '*', { order: 'codigo' });
  const saveManagerDescriptor = async (payload) => { await managerSession(); const record = { ...payload, serie: Number(payload.serie), trimestre: Number(payload.trimestre) }; const query = record.id ? client.from('descritores_curriculares').update(record).eq('id', record.id) : client.from('descritores_curriculares').insert(record); const { data, error } = await query.select().single(); if (error) throw error; return data; };
  const listManagerAudit = () => managerSelect('gestor_auditoria', '*,perfis!gestor_auditoria_gestor_id_fkey(nome)', { order: 'created_at', ascending: false });
  const manageManagerAccess = async (action, payload) => { await managerSession(); const { data, error } = await client.functions.invoke('gestor-contas', { body: { action, ...payload } }); if (error) throw error; if (data?.error) throw new Error(data.error); return data; };

  const updateProfile = async ({ nome, email }) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client.from('perfis').update({ nome }).eq('id', session.user.id).select().single();
    if (error) throw error;
    if (email && email !== session.user.email) {
      const { error: authError } = await client.auth.updateUser({ email });
      if (authError) throw authError;
      notify('Perfil salvo. Confirme o novo e-mail na sua caixa de entrada.', 'success');
    }
    return data;
  };

  const requestLoan = async (livroId) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client.rpc('biblioteca_solicitar_livro', { p_livro_id: livroId });
    if (error) throw error;
    return data;
  };

  const listAgendaEvents = async ({ from, to, own = false } = {}) => {
    if (!ensureConfigured()) return [];
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const profile = await getProfile(session.user.id);
    let query = client.from('eventos_agenda')
      .select('*, turmas!eventos_agenda_turma_id_fkey(id,nome,serie), perfis!eventos_agenda_professor_id_fkey(id,nome,tipo_professor)')
      .order('inicio', { ascending: true });
    if (from) query = query.gte('inicio', from);
    if (to) query = query.lt('inicio', to);
    if (own) query = query.eq('professor_id', session.user.id);
    if (profile?.role === 'professor') {
      const classes = await listTeacherClasses();
      const classIds = classes.map((item) => item.id);
      if (!classIds.length) return [];
      query = query.in('turma_id', classIds);
    }
    if (profile?.role === 'aluno' && profile.turma_id) query = query.eq('turma_id', profile.turma_id).eq('status', 'publicado');
    const { data, error } = await query;
    if (error) {
      console.error('[OminiSaber][Supabase] Falha ao consultar eventos_agenda para o usuário autenticado.', error);
      throw error;
    }
    return data || [];
  };

  const createAgendaEvent = async (payload) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await client.from('eventos_agenda').insert({
      titulo: String(payload.title || '').trim(),
      descricao: String(payload.description || '').trim() || null,
      tipo: payload.type,
      inicio: payload.start,
      fim: payload.end || null,
      dia_inteiro: Boolean(payload.allDay),
      materia: String(payload.subject || '').trim() || null,
      local: String(payload.location || '').trim() || null,
      turma_id: payload.classId,
      professor_id: session.user.id,
      status: payload.status || 'publicado'
    }).select().single();
    if (error) throw error;
    return data;
  };

  const updateAgendaEvent = async (eventId, changes) => {
    if (!ensureConfigured()) return null;
    const { data, error } = await client.from('eventos_agenda')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', eventId).select().single();
    if (error) throw error;
    return data;
  };

  const deleteAgendaEvent = async (eventId) => {
    if (!ensureConfigured()) return;
    const { error } = await client.from('eventos_agenda').delete().eq('id', eventId);
    if (error) throw error;
  };

  const listNotifications = async () => {
    if (!ensureConfigured()) return [];
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const [notificationsResult, readsResult] = await Promise.all([
      client.from('notificacoes').select('*, eventos_agenda(id,inicio,tipo,materia,local), perfis!notificacoes_criado_por_fkey(nome,tipo_professor)').order('created_at', { ascending: false }).limit(100),
      client.from('notificacoes_lidas').select('notificacao_id,lida_em').eq('usuario_id', session.user.id)
    ]);
    if (notificationsResult.error) throw notificationsResult.error;
    if (readsResult.error) throw readsResult.error;
    const reads = new Map((readsResult.data || []).map((item) => [item.notificacao_id, item.lida_em]));
    return (notificationsResult.data || []).map((item) => ({ ...item, readAt: reads.get(item.id) || null }));
  };

  const markNotificationRead = async (notificationId, read = true) => {
    if (!ensureConfigured()) return;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const query = client.from('notificacoes_lidas');
    const { error } = read
      ? await query.upsert({ usuario_id: session.user.id, notificacao_id: notificationId, lida_em: new Date().toISOString() }, { onConflict: 'usuario_id,notificacao_id' })
      : await query.delete().eq('usuario_id', session.user.id).eq('notificacao_id', notificationId);
    if (error) throw error;
  };

  const markAllNotificationsRead = async (notificationIds) => {
    if (!notificationIds?.length || !ensureConfigured()) return;
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const rows = notificationIds.map((id) => ({ usuario_id: session.user.id, notificacao_id: id, lida_em: new Date().toISOString() }));
    const { error } = await client.from('notificacoes_lidas').upsert(rows, { onConflict: 'usuario_id,notificacao_id' });
    if (error) throw error;
  };

  const subscribeToAgenda = (onChange) => {
    if (!client) return () => {};
    const channel = client.channel(`agenda-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eventos_agenda' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacoes' }, onChange)
      .subscribe();
    return () => { client.removeChannel(channel); };
  };

  const requireStudentSession = async () => {
    const session = await getSession();
    if (!session) throw new Error('Sessão expirada. Entre novamente.');
    const profile = await getProfile(session.user.id);
    if (profile?.role !== 'aluno') throw new Error('Este conteúdo está disponível apenas para alunos.');
    return { session, profile };
  };

  const listExperienceProgress = async ({ subject } = {}) => {
    if (!ensureConfigured()) throw new Error('Supabase não configurado.');
    const { session } = await requireStudentSession();
    let query = client.from('progresso_experiencias')
      .select('materia_codigo,experiencia_codigo,concluida,concluida_em,updated_at')
      .eq('aluno_id', session.user.id);
    if (subject) query = query.eq('materia_codigo', subject);
    const { data, error } = await query.order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  const completeExperience = async ({ subject, code }) => {
    if (!['matematica', 'fisica', 'portugues', 'redacao', 'tecnico_administracao', 'tecnico_informatica'].includes(subject)) {
      throw new Error('Matéria inválida.');
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(code || ''))) throw new Error('Experiência inválida.');
    const { session } = await requireStudentSession();
    const now = new Date().toISOString();
    const { data, error } = await client.from('progresso_experiencias').upsert({
      aluno_id: session.user.id,
      materia_codigo: subject,
      experiencia_codigo: code,
      concluida: true,
      concluida_em: now,
      updated_at: now
    }, { onConflict: 'aluno_id,materia_codigo,experiencia_codigo' }).select().single();
    if (error) throw error;
    return data;
  };

  const getStudentDashboard = async () => {
    if (!ensureConfigured()) throw new Error('Supabase não configurado.');
    const { session, profile } = await requireStudentSession();
    if (!profile?.curso_tecnico) {
      throw new Error('Seu curso técnico ainda não foi definido pela escola.');
    }

    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const [trailsResult, notesResult, essaysResult, historyResult, xpResult, experiencesResult] = await Promise.all([
      client.from('trilhas')
        .select('id,titulo,descricao,materia,materia_codigo,descritor_sedu,dificuldade,duracao_estimada_min,recompensa_xp,prazo,created_at,atividades(id,titulo,descricao,ordem,status,tipo_conteudo,duracao_minutos,recompensa_xp,progresso_atividades(aluno_id,concluida,nota,concluida_em))')
        .eq('publicada', true)
        .order('created_at', { ascending: false }),
      client.from('notas')
        .select('materia,materia_codigo,valor,created_at')
        .eq('aluno_id', session.user.id)
        .order('created_at', { ascending: false }),
      client.from('redacoes')
        .select('id,nota,status,updated_at')
        .eq('aluno_id', session.user.id)
        .order('updated_at', { ascending: false }),
      client.from('historico_estudos')
        .select('id,evento,created_at,trilha_id,atividade_id')
        .eq('aluno_id', session.user.id)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true }),
      client.from('xp_movimentos')
        .select('xp')
        .eq('aluno_id', session.user.id),
      client.from('progresso_experiencias')
        .select('materia_codigo,experiencia_codigo,concluida,concluida_em')
        .eq('aluno_id', session.user.id)
    ]);

    for (const result of [trailsResult, notesResult, essaysResult, historyResult, xpResult, experiencesResult]) {
      if (result.error) throw result.error;
    }

    const trails = (trailsResult.data || []).map((trail) => {
      const activities = (trail.atividades || [])
        .filter((activity) => activity.status === 'publicada')
        .sort((a, b) => Number(a.ordem) - Number(b.ordem))
        .map((activity) => ({
          ...activity,
          progresso: (activity.progresso_atividades || []).find((item) => item.aluno_id === session.user.id) || null
        }));
      return { ...trail, atividades: activities };
    });

    return {
      profile,
      trails,
      notes: notesResult.data || [],
      essays: essaysResult.data || [],
      experiences: experiencesResult.data || [],
      history: historyResult.data || [],
      xp: (xpResult.data || []).reduce((total, item) => total + Number(item.xp || 0), 0)
    };
  };

  const listStudyCatalog = async ({ search = '', subject = '', area = '', difficulty = '', savedOnly = false } = {}) => {
    if (!ensureConfigured()) return [];
    const { session, profile } = await requireStudentSession();
    let query = client.from('trilhas').select('id,titulo,descricao,materia,materia_codigo,descritor_sedu,tipo,area_conhecimento,serie,trimestre,dificuldade,duracao_estimada_min,recompensa_xp,capa_url,tags,prazo,turma_id,atividades(id,titulo,ordem,status,tipo_conteudo,duracao_minutos,recompensa_xp,obrigatoria,prerequisito_atividade_id,progresso_atividades(aluno_id,concluida,nota,concluida_em))').eq('publicada', true).order('created_at', { ascending: false });
    query = profile?.turma_id ? query.or(`turma_id.is.null,turma_id.eq.${profile.turma_id}`) : query.is('turma_id', null);
    if (search.trim()) query = query.or(`titulo.ilike.%${search.trim()}%,descricao.ilike.%${search.trim()}%,materia.ilike.%${search.trim()}%`);
    if (subject) query = query.eq('materia', subject);
    if (area) query = query.eq('area_conhecimento', area);
    if (difficulty) query = query.eq('dificuldade', difficulty);
    const { data, error } = await query;
    if (error) throw error;
    let trails = (data || []).map((trail) => {
      const activities = (trail.atividades || []).filter((activity) => activity.status === 'publicada').map((activity) => ({ ...activity, progresso: (activity.progresso_atividades || []).find((item) => item.aluno_id === session.user.id) || null }));
      const completed = activities.filter((activity) => activity.progresso?.concluida).length;
      return { ...trail, atividades: activities, progressoPercentual: activities.length ? Math.round((completed / activities.length) * 100) : 0, concluidas: completed };
    });
    if (savedOnly) {
      const { data: saved, error: savedError } = await client.from('conteudos_salvos').select('trilha_id').eq('aluno_id', session.user.id).not('trilha_id', 'is', null);
      if (savedError) throw savedError;
      const ids = new Set((saved || []).map((item) => item.trilha_id));
      trails = trails.filter((trail) => ids.has(trail.id));
    }
    return trails;
  };

  const getStudyTrail = async (trailId) => {
    if (!ensureConfigured()) return null;
    const { session } = await requireStudentSession();
    const [trailResult, savedResult, prerequisitesResult, xpResult] = await Promise.all([
      client.from('trilhas').select('id,titulo,descricao,materia,materia_codigo,descritor_sedu,tipo,area_conhecimento,serie,trimestre,dificuldade,duracao_estimada_min,recompensa_xp,capa_url,tags,prazo,atividades(id,titulo,descricao,ordem,status,tipo_conteudo,duracao_minutos,recompensa_xp,obrigatoria,prerequisito_atividade_id,progresso_atividades(aluno_id,concluida,nota,concluida_em))').eq('id', trailId).eq('publicada', true).maybeSingle(),
      client.from('conteudos_salvos').select('id').eq('aluno_id', session.user.id).eq('trilha_id', trailId).maybeSingle(),
      client.from('trilhas_prerequisitos').select('prerequisito_trilha_id, trilhas!trilhas_prerequisitos_prerequisito_trilha_id_fkey(id,titulo,materia)').eq('trilha_id', trailId),
      client.from('xp_movimentos').select('xp').eq('aluno_id', session.user.id)
    ]);
    if (trailResult.error) throw trailResult.error;
    if (savedResult.error) throw savedResult.error;
    if (prerequisitesResult.error) throw prerequisitesResult.error;
    if (xpResult.error) throw xpResult.error;
    if (!trailResult.data) return null;
    const activities = (trailResult.data.atividades || []).filter((item) => item.status === 'publicada').sort((a, b) => a.ordem - b.ordem).map((item) => ({ ...item, progresso: (item.progresso_atividades || []).find((progress) => progress.aluno_id === session.user.id) || null }));
    return { ...trailResult.data, atividades: activities, salvo: Boolean(savedResult.data), prerequisitos: prerequisitesResult.data || [], xpTotal: (xpResult.data || []).reduce((sum, item) => sum + Number(item.xp || 0), 0) };
  };

  const getStudyActivity = async (activityId) => {
    if (!ensureConfigured()) return null;
    const { session } = await requireStudentSession();
    const [activityResult, materialsResult, questionsResult, progressResult, noteResult, savedResult] = await Promise.all([
      client.from('atividades').select('id,trilha_id,titulo,descricao,ordem,status,tipo_conteudo,conteudo,video_url,duracao_minutos,recompensa_xp,obrigatoria,prerequisito_atividade_id,trilhas(id,titulo,materia,descritor_sedu,recompensa_xp)').eq('id', activityId).eq('status', 'publicada').maybeSingle(),
      client.from('materiais_aula').select('*').eq('atividade_id', activityId).order('ordem'),
      client.from('questoes_atividades').select('id,atividade_id,enunciado,tipo,alternativas,dica,pontos,ordem').eq('atividade_id', activityId).order('ordem'),
      client.from('progresso_atividades').select('*').eq('atividade_id', activityId).eq('aluno_id', session.user.id).maybeSingle(),
      client.from('anotacoes_aula').select('texto,updated_at').eq('atividade_id', activityId).eq('aluno_id', session.user.id).maybeSingle(),
      client.from('conteudos_salvos').select('id').eq('atividade_id', activityId).eq('aluno_id', session.user.id).maybeSingle()
    ]);
    for (const result of [activityResult, materialsResult, questionsResult, progressResult, noteResult, savedResult]) if (result.error) throw result.error;
    return activityResult.data ? { ...activityResult.data, materiais: materialsResult.data || [], questoes: questionsResult.data || [], progresso: progressResult.data, anotacao: noteResult.data, salvo: Boolean(savedResult.data) } : null;
  };

  const toggleSavedContent = async ({ trailId = null, activityId = null }) => {
    if (!ensureConfigured()) return false;
    const { session } = await requireStudentSession();
    let query = client.from('conteudos_salvos').select('id').eq('aluno_id', session.user.id);
    query = trailId ? query.eq('trilha_id', trailId) : query.eq('atividade_id', activityId);
    const { data: existing, error: findError } = await query.maybeSingle();
    if (findError) throw findError;
    if (existing) {
      const { error } = await client.from('conteudos_salvos').delete().eq('id', existing.id).eq('aluno_id', session.user.id);
      if (error) throw error;
      await recordStudyEvent({ trailId, activityId, event: 'removeu_salvo' });
      return false;
    }
    const { error } = await client.from('conteudos_salvos').insert({ aluno_id: session.user.id, trilha_id: trailId, atividade_id: activityId });
    if (error) throw error;
    await recordStudyEvent({ trailId, activityId, event: 'salvou' });
    return true;
  };

  const listSavedContent = async () => {
    if (!ensureConfigured()) return [];
    const { session } = await requireStudentSession();
    const { data, error } = await client.from('conteudos_salvos').select('id,nota_pessoal,created_at,trilhas(id,titulo,descricao,materia,dificuldade,capa_url),atividades(id,titulo,descricao,tipo_conteudo,duracao_minutos,trilhas(id,titulo,materia))').eq('aluno_id', session.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  const saveLessonNotes = async (activityId, text) => {
    if (!ensureConfigured()) return null;
    const { session } = await requireStudentSession();
    const { data, error } = await client.from('anotacoes_aula').upsert({ aluno_id: session.user.id, atividade_id: activityId, texto: String(text || '').slice(0, 10000), updated_at: new Date().toISOString() }, { onConflict: 'aluno_id,atividade_id' }).select().single();
    if (error) throw error;
    await recordStudyEvent({ activityId, event: 'anotou' });
    return data;
  };

  const completeLesson = async (activityId) => {
    if (!ensureConfigured()) return null;
    const { session } = await requireStudentSession();
    const { data, error } = await client.from('progresso_atividades').upsert({ atividade_id: activityId, aluno_id: session.user.id, concluida: true, concluida_em: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'atividade_id,aluno_id' }).select().single();
    if (error) throw error;
    return data;
  };

  const startActivityAttempt = async (activityId) => {
    if (!ensureConfigured()) return null;
    const { session } = await requireStudentSession();
    const { data, error } = await client.from('tentativas_atividades').insert({ atividade_id: activityId, aluno_id: session.user.id }).select().single();
    if (error) throw error;
    await recordStudyEvent({ activityId, event: 'iniciou_atividade', details: { tentativa_id: data.id } });
    return data;
  };

  const getActiveActivityAttempt = async (activityId) => {
    if (!ensureConfigured()) return null;
    const { session } = await requireStudentSession();
    const { data, error } = await client.from('tentativas_atividades').select('*, respostas_questoes(id,questao_id,resposta,correta,pontos_obtidos,explicacao_snapshot,respondida_em)').eq('atividade_id', activityId).eq('aluno_id', session.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  };

  const answerActivityQuestion = async ({ attemptId, questionId, answer }) => {
    if (!ensureConfigured()) return null;
    const { session } = await requireStudentSession();
    const { data, error } = await client.from('respostas_questoes').upsert({ tentativa_id: attemptId, questao_id: questionId, aluno_id: session.user.id, resposta: answer, updated_at: new Date().toISOString() }, { onConflict: 'tentativa_id,questao_id' }).select('id,questao_id,resposta,correta,pontos_obtidos,explicacao_snapshot,respondida_em').single();
    if (error) throw error;
    return data;
  };

  const getActivityResult = async (activityId) => {
    if (!ensureConfigured()) return null;
    const attempt = await getActiveActivityAttempt(activityId);
    if (!attempt) return null;
    const activity = await getStudyActivity(activityId);
    return { attempt, activity };
  };

  const recordStudyEvent = async ({ trailId = null, activityId = null, event, details = {}, durationSeconds = null }) => {
    if (!ensureConfigured()) return null;
    const session = await getSession();
    if (!session) return null;
    let resolvedTrailId = trailId;
    if (!resolvedTrailId && activityId) {
      const { data } = await client.from('atividades').select('trilha_id').eq('id', activityId).maybeSingle();
      resolvedTrailId = data?.trilha_id || null;
    }
    const { data, error } = await client.from('historico_estudos').insert({ aluno_id: session.user.id, trilha_id: resolvedTrailId, atividade_id: activityId, evento: event, detalhes: details, duracao_segundos: durationSeconds }).select().single();
    if (error) throw error;
    return data;
  };

  const listStudyHistory = async ({ limit = 80 } = {}) => {
    if (!ensureConfigured()) return [];
    const { session } = await requireStudentSession();
    const { data, error } = await client.from('historico_estudos').select('id,evento,detalhes,duracao_segundos,created_at,trilhas(id,titulo,materia),atividades(id,titulo,tipo_conteudo)').eq('aluno_id', session.user.id).order('created_at', { ascending: false }).limit(Math.min(limit, 200));
    if (error) throw error;
    return data || [];
  };

  const getStudyXp = async () => {
    if (!ensureConfigured()) return { total: 0, movements: [] };
    const { session } = await requireStudentSession();
    const { data, error } = await client.from('xp_movimentos').select('*').eq('aluno_id', session.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    const movements = data || [];
    return { total: movements.reduce((sum, item) => sum + Number(item.xp || 0), 0), movements };
  };

  const bindProfileActions = () => {
    const saveButton = document.querySelector('[data-save-profile]');
    if (!saveButton || saveButton.dataset.bound) return;
    saveButton.dataset.bound = 'true';
    saveButton.addEventListener('click', async () => {
      const name = document.querySelector('[data-profile-name-input]')?.value.trim();
      const email = document.querySelector('[data-profile-email]')?.value.trim();
      if (!name) return notify('Informe seu nome completo.', 'error');
      saveButton.disabled = true;
      try {
        await updateProfile({ nome: name, email });
        notify('Perfil atualizado com sucesso.', 'success');
      } catch (error) {
        notify(error.message, 'error');
      } finally {
        saveButton.disabled = false;
      }
    });
  };

  const bindRedacaoActions = () => {
    const submitButton = document.querySelector('[data-submit-redacao]');
    if (!submitButton || submitButton.dataset.bound) return;
    submitButton.dataset.bound = 'true';
    submitButton.addEventListener('click', async () => {
      const title = document.querySelector('[data-redacao-title]')?.value.trim();
      const text = document.querySelector('[data-redacao-text]')?.value.trim();
      if (!title || !text) return notify('Preencha o título e o texto antes de enviar.', 'error');
      submitButton.disabled = true;
      try {
        await createRedacao({ titulo: title, texto: text });
        notify('Redação enviada para correção.', 'success');
      } catch (error) {
        notify(error.message, 'error');
      } finally {
        submitButton.disabled = false;
      }
    });
  };

  const bindLibraryActions = async () => {
    const articles = [...document.querySelectorAll('article')];
    if (!articles.length) return;
    const books = await listLivros();
    articles.forEach((article) => {
      const title = article.querySelector('h3')?.textContent.trim();
      const book = books.find((item) => item.titulo.toLowerCase() === title?.toLowerCase());
      const button = [...article.querySelectorAll('button')].find((item) => /solicitar empréstimo/i.test(item.textContent));
      if (!book || !button || button.dataset.bound) return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await requestLoan(book.id);
          button.textContent = 'Solicitação enviada';
          notify('Empréstimo solicitado. Aguarde a confirmação da bibliotecária.', 'success');
        } catch (error) {
          button.disabled = false;
          notify(error.message, 'error');
        }
      });
    });
  };

  const loadPageData = async () => {
    bindProfileActions();
    bindRedacaoActions();
    if (currentPage.includes('/biblioteca_digital/')) await bindLibraryActions();
    if (currentPage.includes('/modulo_de_trilhas/')) {
      const trilhas = await listTrilhas();
      document.querySelectorAll('[data-trilhas-count]').forEach((element) => { element.textContent = trilhas.length; });
    }
  };

  const mount = async () => {
    if (!configured) {
      if (isPublicAuthPage) return;
      notify('O Supabase não está configurado. Preencha as chaves para carregar dados reais.', 'warning');
      return;
    }

    const session = await getSession();
    if (!session && !isPublicAuthPage) {
      window.location.href = routes.login;
      return;
    }

    if (session) {
      const profile = await getProfile(session.user.id);
      document.querySelectorAll('[data-profile-name]').forEach((element) => {
        element.textContent = profile?.nome || session.user.email;
      });
      document.querySelectorAll('[data-student-sidebar-grade]').forEach((element) => {
        const grade = profile?.turmas?.serie;
        element.textContent = grade ? `${grade}º ano do Ensino Médio` : 'Ensino Médio';
      });
      document.querySelectorAll('[data-profile-email]').forEach((element) => {
        element.value = session.user.email || '';
      });
      const roleByDirectory = currentPage.includes('/bibliotecaria/')
        ? ['bibliotecaria', 'gestor']
        : currentPage.includes('/professor/')
          ? ['professor', 'gestor']
          : currentPage.includes('/gestor/')
            ? ['gestor']
            : null;
      const requiredRole = document.body.dataset.requiredRole;
      const allowedRoles = requiredRole ? requiredRole.split(',').map((role) => role.trim()) : roleByDirectory;
      if (allowedRoles && !(await requireRole(allowedRoles))) return;
      const requiredTeacherType = document.body.dataset.requiredTeacherType;
      if (requiredTeacherType && profile?.role === 'professor') {
        const allowedTeacherTypes = requiredTeacherType.split(',').map((type) => type.trim());
        if (!allowedTeacherTypes.includes(profile.tipo_professor)) {
          notify('Esta ferramenta não está disponível para sua especialidade docente.', 'error');
          window.location.href = routes.error + '?code=teacher-specialty';
          return;
        }
      }
    }

    document.dispatchEvent(new CustomEvent('ominisaber:ready', { detail: { client, session } }));
    await loadPageData();
  };

  window.OminiSaber = {
    client,
    configured,
    notify,
    getSession,
    getProfile,
    getProfileDestination,
    requireRole,
    signIn,
    signUp,
    resendSignupConfirmation,
    requestPasswordReset,
    clearSession,
    signOut,
    listTrilhas,
    listStudentNotes,
    listStudentProgress,
    listStudentRedacoes,
    listWritingPrompts,
    getWritingPrompt,
    listWritingRepertoires,
    getEssayPlanning,
    saveEssayPlanning,
    listTeacherClasses,
    listCurriculumSkills,
    createWritingPrompt,
    listTeacherWritingPrompts,
    listTeacherEssays,
    listEssayCorrectionDrafts,
    saveEssayCorrectionDraft,
    correctEssay,
    getTeacherSummary,
    assertTeacherSpecialty,
    listTeacherLabs,
    createTeacherLab,
    updateTeacherLabStatus,
    listTeacherEvaluations,
    createTeacherEvaluation,
    updateTeacherEvaluationStatus,
    getTeacherWorkspace,
    listStudentEvaluations,
    getStudentEvaluationAttempt,
    saveStudentEvaluationAttempt,
    listStudentLoans,
    listLivros,
    createRedacao,
    saveEssayDraft,
    getEssayDraft,
    submitEssayDraft,
    getStudentEssay,
    listStudentEssayHistory,
    getManagerOverview,
    getCurriculumCoverage,
    listManagerClasses,
    saveManagerClass,
    listManagerProfiles,
    updateManagerProfile,
    listManagerLinks,
    saveManagerLink,
    removeManagerLink,
    listManagerDescriptors,
    saveManagerDescriptor,
    listManagerAudit,
    manageManagerAccess,
    updateProfile,
    requestLoan,
    listAgendaEvents,
    createAgendaEvent,
    updateAgendaEvent,
    deleteAgendaEvent,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    subscribeToAgenda,
    listExperienceProgress,
    completeExperience,
    getStudentDashboard,
    listStudyCatalog,
    getStudyTrail,
    getStudyActivity,
    toggleSavedContent,
    listSavedContent,
    saveLessonNotes,
    completeLesson,
    startActivityAttempt,
    getActiveActivityAttempt,
    answerActivityQuestion,
    getActivityResult,
    recordStudyEvent,
    listStudyHistory,
    getStudyXp
  };

  window.addEventListener('DOMContentLoaded', () => {
    setupUniversalSidebar();
    mount().catch((error) => notify(error.message, 'error'));
  });
})();
