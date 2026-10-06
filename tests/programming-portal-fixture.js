(() => {
  const params = new URLSearchParams(location.search);
  const scene = params.get('scene') || 'teacher';
  const fixtureUser = 'fixture-programming-' + (params.get('nonce') || 'manual');
  const calls = [];
  const activity = { id: 'fixture-activity', titulo: 'Prática inventada de programação', trilha_id: 'fixture-trail', ordem: 1, conteudo: { blocos: [{ tipo: 'texto', texto: 'Material inventado para testar o modo de pseudocódigo.' }] }, anotacao: { texto: '' } };
  const trail = { id: 'fixture-trail', titulo: 'Trilha fictícia de Informática', descricao: 'Conteúdo inventado da fixture.', materia: 'Informática', area_conhecimento: 'Técnica', dificuldade: 'inicial', atividades: [activity], duracao_estimada_min: 20, recompensa_xp: 0 };
  const classes = [{ id: 'fixture-class', nome: 'Turma fictícia de teste', serie: '2' }];
  const profile = { id: fixtureUser, nome: 'Pessoa fictícia de teste', turmas: { serie: 2 } };
  const workspace = { classes, profile, labs: [], evaluations: [], studentCount: 0 };
  window.programmingFixture = { scene, requestKey: params.toString(), calls, fixtureUser, errors: [] };
  const capture = (name, result) => async (...args) => { calls.push({ name, args }); return typeof result === 'function' ? result(...args) : result; };
  // Este objeto só existe na fixture. Não carrega o cliente real, tokens ou scripts de autenticação.
  window.OminiSaber = {
    configured: true,
    getProfile: capture('getProfile', profile),
    getTeacherWorkspace: capture('getTeacherWorkspace', workspace),
    listCurriculumSkills: capture('listCurriculumSkills', []),
    createTeacherLab: capture('createTeacherLab', { id: 'fixture-created' }),
    listStudyCatalog: capture('listStudyCatalog', scene === 'catalog-full' ? [trail] : []),
    getStudyActivity: capture('getStudyActivity', id => id === 'fixture-activity' ? activity : null),
    getStudyTrail: capture('getStudyTrail', trail),
    recordStudyEvent: capture('recordStudyEvent', {}),
    signOut: capture('signOut', {}),
  };
  const fail = error => {
    const message = error?.message || String(error);
    window.programmingFixture.errors.push(message);
    const node = document.createElement('pre'); node.className = 'fixture-error'; node.textContent = message; document.body.append(node);
  };
  window.addEventListener('error', event => fail(event.error || event.message));
  window.addEventListener('unhandledrejection', event => fail(event.reason));
  const loadScript = src => new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = src;
    script.onload = resolve; script.onerror = () => reject(new Error('Não foi possível carregar ' + src));
    document.head.append(script);
  });
  async function boot() {
    const root = document.createElement('div');
    if (scene === 'teacher') {
      document.body.dataset.requiredTeacherType = 'tecnico_informatica';
      document.body.dataset.page = 'laboratorio';
      root.dataset.teacherPortal = ''; document.body.append(root);
      await loadScript('../frontend/professor/specialty/configs.js');
      await loadScript('../frontend/professor/specialty/portal.js');
    } else {
      document.body.dataset.studyPage = scene.startsWith('catalog') ? 'catalogo' : 'ide';
      root.dataset.studyRoot = ''; document.body.append(root);
      await loadScript('../frontend/aluno/modulo_de_trilhas/shared/study-app.js');
    }
    document.dispatchEvent(new CustomEvent('ominisaber:ready', { detail: { session: { user: { id: fixtureUser, email: 'fixture@example.invalid' } } } }));
  }
  boot().catch(fail);
})();
