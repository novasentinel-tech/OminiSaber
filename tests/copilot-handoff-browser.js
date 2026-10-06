(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const results = [], calls = [], notices = [], errors = [];
  const fixture = window.copilotHandoffFixture = { results, calls, notices, errors, status: 'loading', savedPayload: null };
  const out = document.querySelector('#test-results'), status = document.querySelector('#test-status');
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
    results.push('OK · ' + message);
    out.textContent = results.join('\n');
  };
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const waitFor = async (predicate, message, timeout = 6000) => {
    const end = performance.now() + timeout;
    while (!predicate()) {
      if (performance.now() > end) throw new Error(message);
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  const question = statement => ({ type: 'unica_escolha', statement, points: 1, alternatives: ['Uma evidência verificável.', 'Uma impressão sem evidências.'], answer: 'Uma evidência verificável.', explanation: 'Compare a evidência apresentada com a conclusão.', skillIds: [], required: true, answerConfiguration: { privateSolution: 'GABARITO_PRIVADO_FIXTURE' } });
  const activity = (title, count = 1, value = 5) => ({ title, instructions: 'Leia os exemplos, compare as evidências e registre sua decisão com uma justificativa.', category: 'atividade', duration: 10, value, scoringMode: 'igual', questions: Array.from({ length: count }, (_, index) => question(title + ': qual evidência sustenta a conclusão ' + (index + 1) + '?')) });
  const trail = () => ({ activity: activity('Compatibilidade da primeira etapa'), trail: { title: 'Investigar, praticar e transferir', description: 'Um percurso de leitura crítica que termina com aplicação em uma nova situação.', steps: ['Observe as evidências', 'Compare interpretações', 'Transfira para outro texto'].map((title, index) => ({ order: index + 1, title, objective: ['Identificar informações explícitas.', 'Comparar interpretações sustentadas por dados.', 'Defender uma conclusão em um contexto novo.'][index], interaction: 'lista', phase: ['diagnostico','pratica_guiada','transferencia'][index], bridge: index ? 'Retome as evidências da etapa anterior para justificar esta decisão.' : '', activity: activity(title, index + 1, 6 + index) })) } });
  const classes = [{ id: 'fixture-class', nome: 'Turma fictícia 2º A', serie: 2 }];
  const skill = { habilidade_id: 'fixture-skill', codigo: 'FIXTURE01', descricao: 'Comparar fatos e opiniões com evidências.', serie: 2, trimestre: 1, descritores: [] };
  const api = {
    listCurriculumSkills: async () => [structuredClone(skill)],
    createTeacherEvaluation: async payload => {
      calls.push({ name: 'createTeacherEvaluation', payload: structuredClone(payload) });
      if (payload.publish) throw new Error('Publicação externa bloqueada pela fixture.');
      fixture.savedPayload = structuredClone(payload);
      return { id: 'fixture-draft' };
    },
  };
  let context;
  window.initTeacherCopilot = async value => { context = value; fixture.context = value; };
  const mount = async () => {
    await window.renderTeacherActivityBuilder({ content: document.querySelector('#workspace'), data: { classes, evaluations: [] }, api, config: window.OMINI_TEACHER_CONFIGS.portugues, escapeHtml, formatDate: value => String(value || 'Sem data'), toast: (message, type) => notices.push({ message, type }), reload: mount, initialClassId: 'fixture-class' });
  };

  async function studentMode() {
    document.querySelector('.fixture-actions').hidden = true;
    out.hidden = true;
    const payload = window.parent !== window ? window.parent.copilotHandoffFixture?.savedPayload : null;
    if (!payload) throw new Error('A prévia isolada exige o rascunho inventado da fixture principal.');
    const evaluation = { id: 'fixture-evaluation', titulo: payload.title, instrucoes: payload.instructions, materia_codigo: 'portugues', valor: payload.value, categoria: payload.category, configuracao: payload.configuration, tentativas_permitidas: 1, questoes_avaliacao: payload.questions.map((item, index) => ({ id: 'fixture-question-' + (index + 1), ordem: index + 1, tipo: item.type, enunciado: item.statement, pontos: item.points, obrigatoria: item.required, alternativas: item.alternatives, configuracao: { ...item.configuration, learningStage: { ...item.configuration.learningStage, answer: 'GABARITO_PRIVADO_METADATA', rubric: 'RUBRICA_PRIVADA_METADATA' } } })) };
    const attempt = { id: 'fixture-attempt', numero_tentativa: 1, status: 'em_andamento', respostas_avaliacao: [] };
    window.StudentShell = { notify: (message, type) => notices.push({ message, type }) };
    window.OminiSaber = {
      listStudentEvaluations: async () => [evaluation],
      listStudentStudioExperiences: async () => [],
      getStudentEvaluationAttempt: async () => structuredClone(attempt),
      startStudentEvaluationAttempt: async () => ({ id: attempt.id }),
      saveStudentEvaluationAnswer: async payload => { calls.push({ name: 'saveStudentEvaluationAnswer', payload: structuredClone(payload) }); return {}; },
      submitStudentEvaluationAttempt: async () => { throw new Error('Entrega externa bloqueada pela fixture.'); },
    };
    document.querySelector('[data-activity-root]').hidden = false;
    await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = '../frontend/aluno/atividades/script.js?v=20261004-3'; script.onload = resolve; script.onerror = () => reject(new Error('Não foi possível carregar o fluxo real de resposta.')); document.head.append(script); });
    document.dispatchEvent(new CustomEvent('ominisaber:ready', { detail: { session: { user: { id: 'fixture-student' } } } }));
    await waitFor(() => document.querySelectorAll('[data-question]').length === 6, 'O percurso não apareceu para o aluno.');
    fixture.status = 'ready';
  }

  async function run() {
    const button = document.querySelector('#run-tests'); button.disabled = true;
    fixture.status = 'running'; results.length = 0; notices.length = 0; calls.length = 0; fixture.savedPayload = null;
    status.textContent = 'Verificando aplicação, restauração, currículo e respostas...';
    await mount();
    context.applyCopilotSuggestion({ activity: activity('Meu rascunho anterior') });
    context.go(2);
    context.root.querySelector('[data-next]').click();
    check(context.state.step === 3 && context.state.selectedSkills.size === 0, 'Criar questões sem currículo selecionado continua permitido.');
    const initialRoot = context.root;
    initialRoot.querySelector('[data-next]').click();
    check(context.state.step === 4, 'Chegar à revisão não exige currículo para um rascunho.');
    initialRoot.querySelector('button[value="draft"]').click();
    await waitFor(() => fixture.savedPayload && context.root !== initialRoot, 'O rascunho sem currículo não foi salvo.');
    check(!fixture.savedPayload.publish && fixture.savedPayload.questions.every(item => item.skillIds.length === 0), 'Salvar rascunho sem vínculos curriculares é permitido.');
    calls.length = 0; fixture.savedPayload = null;
    context.applyCopilotSuggestion({ activity: activity('Meu rascunho anterior') });
    const pending = context.root.querySelector('[data-question-statement]');
    pending.value = 'Questão em preenchimento ainda não adicionada.';
    pending.dispatchEvent(new Event('input', { bubbles: true }));
    check(context.state.editorDirty, 'O editor reconhece a questão ainda não salva.');
    const source = trail(), original = structuredClone(source);
    const applied = context.applyCopilotSuggestion(source, { targetClassIds: ['fixture-class'] });
    check(applied.ok && applied.stageCount === 3 && applied.questionCount === 6, 'Aplicar o percurso conserva as três etapas e as seis questões.');
    check(same(source, original), 'A resposta do Copiloto permanece intacta.');
    check(context.field('duration').value === '30' && context.field('value').value === '21', 'Duração e pontuação somam todas as atividades.');
    check(same(context.state.questions.map(item => item.configuration.learningStage.order), [1,2,2,3,3,3]), 'Cada questão mantém sua etapa e a sequência progressiva.');
    check(context.root.querySelectorAll('[data-question-list] > section').length === 3, 'O roteiro mostra as orientações das três etapas.');
    check(!context.root.querySelector('[data-question-list]').textContent.includes('GABARITO_PRIVADO'), 'O resumo das etapas não apresenta respostas privadas.');
    check(context.field('shuffleQuestions').disabled && !context.field('shuffleQuestions').checked, 'O percurso preserva sua ordem durante a entrega.');
    const publicCopy = context.getCopilotDraft(); publicCopy.learningTrail.title = 'Título alterado na cópia';
    check(context.state.learningTrail.title !== publicCopy.learningTrail.title, 'Consultar o rascunho entrega uma cópia independente dos metadados.');
    const before = context.getCopilotDraft();
    const broken = trail(); delete broken.trail.steps[1].activity;
    let invalidRejected = false; try { context.applyCopilotSuggestion(broken); } catch { invalidRejected = true; }
    check(invalidRejected && same(before, context.getCopilotDraft()), 'Uma etapa incompleta é recusada sem modificar o rascunho.');
    let classRejected = false; try { context.applyCopilotSuggestion(trail(), { targetClassIds: ['turma-nao-vinculada'] }); } catch { classRejected = true; }
    check(classRejected && same(before, context.getCopilotDraft()), 'Uma turma não vinculada é recusada sem modificar o rascunho.');
    const root = context.root, querySelector = root.querySelector;
    let failOnce = true, renderRejected = false;
    root.querySelector = function(selector) { if (failOnce && selector === '[data-format-panel]') { failOnce = false; throw new Error('Falha de renderização deliberada da fixture.'); } return querySelector.call(this, selector); };
    try { context.applyCopilotSuggestion({ activity: activity('Proposta com falha simulada') }); } catch { renderRejected = true; } finally { root.querySelector = querySelector; }
    check(renderRejected && same(before, context.getCopilotDraft()), 'Uma falha durante a renderização restaura todos os dados do rascunho.');
    check(!root.querySelector('[data-copilot-undo]').hidden, 'A restauração anterior continua disponível após uma falha.');
    root.querySelector('[data-copilot-undo]').click();
    check(context.field('title').value === 'Meu rascunho anterior' && context.state.questions.length === 1, 'Restaurar retorna ao título e às questões anteriores.');
    check(context.field('value').value === '5' && context.field('duration').value === '10' && context.state.copilotTargetClassIds.length === 0, 'Restaurar recupera pontuação, duração e seleção de turmas.');
    check(root.querySelector('[data-question-statement]').value === 'Questão em preenchimento ainda não adicionada.' && context.state.editorDirty, 'Restaurar recupera também a questão que ainda estava em preenchimento.');
    check(root.querySelector('[data-copilot-undo]').textContent === 'Reaplicar ajuste do Copiloto', 'O botão de restauração passa a indicar a reaplicação disponível.');
    context.undoCopilotSuggestion();
    check(same(before, context.getCopilotDraft()) && !context.state.editorDirty, 'A segunda restauração recupera o percurso completo.');
    check(root.querySelector('[data-copilot-undo]').textContent === 'Restaurar rascunho anterior', 'Reaplicar o ajuste restaura a indicação de desfazer.');
    context.applyCopilotSuggestion({ activity: activity('Desafio de reforço') }, { append: true });
    check(context.state.questions.length === 7 && context.state.learningTrail.stages.length === 4, 'Adicionar uma nova atividade conserva as etapas já criadas.');
    context.undoCopilotSuggestion();
    check(same(before, context.getCopilotDraft()), 'Desfazer a adição recupera exatamente o percurso anterior.');
    root.querySelector('[data-next]').click();
    check(context.state.step === 4 && !!root.querySelector('[data-publish-curriculum-hint]'), 'A revisão permite o rascunho e explica a exigência de currículo para publicar.');
    root.querySelector('button[value="publish"]').click();
    check(calls.length === 0 && context.state.step === 2, 'Publicar sem vínculo curricular retorna ao currículo e não chama a API.');
    check(document.activeElement === root.querySelector('[data-skill-search]'), 'A busca de habilidades recebe foco para resolver a pendência.');
    check(notices.at(-1)?.type === 'error' && notices.at(-1).message.includes('rascunho pode ser salvo'), 'O aviso distingue o rascunho permitido da publicação pendente.');
    await waitFor(() => !context.state.loadingSkills && root.querySelector('.skill-card input'), 'O currículo fictício não carregou.');
    root.querySelector('.skill-card input').click();
    root.querySelector('[data-next]').click();
    check(context.state.step === 3 && context.state.questions.every(item => item.skillIds.includes('fixture-skill')), 'Selecionar a habilidade e continuar vincula as questões pendentes.');
    root.querySelector('[data-next]').click();
    check(context.state.step === 4 && !root.querySelector('[data-publish-curriculum-hint]'), 'A revisão reconhece os vínculos nas questões.');
    root.querySelector('button[value="draft"]').click();
    await waitFor(() => fixture.savedPayload && context.root !== root, 'O rascunho completo não foi salvo na API inventada.');
    const payload = fixture.savedPayload;
    check(calls.length === 1 && !payload.publish, 'Salvar envia um rascunho e não publica externamente.');
    check(payload.questions.length === 6 && payload.configuration.learningTrail.stages.length === 3, 'O payload contém todas as questões e todas as etapas.');
    check(payload.duration === 30 && payload.value === 21 && !payload.shuffleQuestions, 'O payload conserva duração, pontuação e sequência do percurso.');
    check(Math.abs(payload.questions.reduce((sum, item) => sum + item.points, 0) - payload.value) < .001, 'A soma dos pontos corresponde ao valor publicado no payload.');
    check(payload.configuration.learningTrail.stages.every(stage => stage.instructions && stage.objective), 'Cada etapa inclui orientações e objetivo para o aluno.');
    check(!JSON.stringify(payload.configuration.learningTrail).includes('GABARITO_PRIVADO'), 'Os metadados públicos do payload excluem respostas privadas.');

    // A segunda fixture consome somente o payload inventado acima, através do fluxo real de resposta.
    const frame = document.createElement('iframe'); frame.title = 'Prévia isolada do aluno'; frame.src = 'copilot-handoff-browser.html?mode=student&atividade=fixture-evaluation';
    document.querySelector('#student-preview').replaceChildren(frame);
    await waitFor(() => frame.contentWindow?.copilotHandoffFixture?.status === 'ready', 'A prévia do aluno não terminou de carregar.');
    const studentDocument = frame.contentDocument, headers = [...studentDocument.querySelectorAll('.student-learning-stage')];
    check(headers.length === 3 && studentDocument.querySelectorAll('[data-question]').length === 6, 'O aluno recebe as três etapas e as seis questões do rascunho.');
    check(headers.every((node, index) => node.textContent.includes(source.trail.steps[index].activity.instructions)), 'O aluno encontra as orientações completas de cada etapa.');
    check(headers.slice(1).every(node => node.textContent.includes('Retome as evidências')), 'As etapas seguintes retomam explicitamente o trabalho anterior.');
    check(!studentDocument.querySelector('[data-activity-root]').textContent.includes('PRIVADO') && !headers.some(node => node.querySelector('input,textarea')), 'Os cabeçalhos públicos não exibem respostas, rubricas privadas ou campos fictícios.');
    const answer = studentDocument.querySelector('[data-question] input[type="radio"]'); answer.click();
    await waitFor(() => frame.contentWindow.copilotHandoffFixture.calls.some(item => item.name === 'saveStudentEvaluationAnswer'), 'A resposta do aluno não foi salva pela fixture.');
    const saved = frame.contentWindow.copilotHandoffFixture.calls.find(item => item.name === 'saveStudentEvaluationAnswer');
    check(saved.payload.questionId === 'fixture-question-1' && saved.payload.answer === payload.questions[0].alternatives[0], 'A interação do aluno salva a resposta da questão correta.');
    check(studentDocument.querySelector('[data-progress-text]').textContent === '1 de 6 respondidas', 'O progresso do aluno acompanha a resposta dentro do percurso.');
    fixture.status = 'passed'; status.textContent = `${results.length} verificações passaram.`; button.disabled = false;
  }

  const fail = error => { errors.push(error.message || String(error)); fixture.status = 'failed'; status.textContent = 'A verificação encontrou uma falha.'; out.textContent = `FALHOU · ${error.message || error}\n\n${results.join('\n')}`; document.querySelector('#run-tests').disabled = false; };
  document.querySelector('#run-tests').addEventListener('click', () => run().catch(fail));
  if (params.get('mode') === 'student') studentMode().catch(fail);
  else mount().then(() => { fixture.status = 'ready'; status.textContent = 'Construtor pronto para verificação.'; if (params.has('test')) run().catch(fail); }).catch(fail);
})();
