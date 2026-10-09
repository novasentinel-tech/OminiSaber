import { LEARNING_TRACKS, getLesson } from './learning-tracks.js';
import { createProgrammingRunner } from './runtime.js';
import { assessCase, freshDraft, invalidateStage, lessonComplete, mergeSavedDrafts, verifiedStage } from './learning-progress.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const icon = name => '<span class="material-symbols-outlined pl-icon" aria-hidden="true">' + name + '</span>';
const byLanguage = language => {
  const track = LEARNING_TRACKS[language];
  return Array.isArray(track) ? { language, title: language === 'python' ? 'Python' : 'C++', lessons: track } : track;
};
const teacherStudentUrl = new URL('../../aluno/modulo_de_trilhas/ide/index.html', import.meta.url);
const mountedLabs = new WeakMap();

export function mountProgrammingLab(root, { mode = 'student', userId = 'visitante', onAssign } = {}) {
  if (!root) throw new Error('Não foi encontrado o espaço do laboratório.');
  mountedLabs.get(root)?.dispose();
  const runner = createProgrammingRunner(), storageKey = 'ominisaber.programming.v1:' + mode + ':' + userId;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { saved = {}; }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const parameters = new URLSearchParams(location.search);
  let language = ['python','cpp'].includes(parameters.get('language')) ? parameters.get('language') : saved.language === 'cpp' ? 'cpp' : 'python';
  let lessonId = getLesson(language, parameters.get('lesson'))?.id || getLesson(language, saved.lessonId)?.id || byLanguage(language).lessons[0].id;
  let stage = 'lesson', running = false, lastOutput = '', status = 'Pronto para experimentar', cancel, destroyed = false;
  let storageAvailable = true;
  let memory = saved.drafts && typeof saved.drafts === 'object' && !Array.isArray(saved.drafts) ? saved.drafts : {};
  const currentLesson = () => getLesson(language, lessonId);
  const currentDraft = () => {
    const key = language + ':' + lessonId;
    const existing = memory[key];
    if (!existing || typeof existing.code !== 'string' || typeof existing.transferCode !== 'string') memory[key] = freshDraft(currentLesson());
    const draft = memory[key];
    for (const prefix of ['lesson','transfer']) {
      if (draft[prefix + 'Results'] !== undefined && (!Array.isArray(draft[prefix + 'Results']) || draft[prefix + 'Results'].some(result => !result || typeof result.passed !== 'boolean'))) invalidateStage(draft,prefix);
    }
    draft.hints = Number.isInteger(draft.hints) ? Math.max(0,Math.min(draft.hints,3)) : 0;
    draft.transferHints = Number.isInteger(draft.transferHints) ? Math.max(0,Math.min(draft.transferHints,3)) : 0;
    return memory[key];
  };
  const getCode = () => stage === 'transfer' ? currentDraft().transferCode : currentDraft().code;
  const clearExperiment = () => { lastOutput = ''; status = 'Pronto para experimentar'; };
  function save() {
    try {
      let latest;
      try { latest = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { latest = {}; }
      memory = mergeSavedDrafts(memory, latest?.drafts, language + ':' + lessonId);
      localStorage.setItem(storageKey, JSON.stringify({ language, lessonId, drafts: memory, version: 1 }));
      storageAvailable = true;
    }
    catch { storageAvailable = false; showStatus('O rascunho não pôde ser salvo. Baixe seu arquivo para guardar uma cópia.'); }
    const label = root.querySelector('[data-pl-save-state]');
    if (label) label.textContent = storageAvailable ? 'Rascunho salvo neste navegador' : 'Não salvo · baixe uma cópia';
    return storageAvailable;
  }
  function setCode(value) {
    const draft = currentDraft();
    draft[stage === 'transfer' ? 'transferCode' : 'code'] = value;
    invalidateStage(draft, stage); save(); updateEvidence();
    if (storageAvailable) showStatus('Rascunho alterado. Execute e valide esta versão do programa.');
  }
  function showStatus(message) { status = message; const node = root.querySelector('[data-pl-status]'); if (node) node.textContent = message; }
  function updateLines() {
    const editor = root.querySelector('[data-pl-code]'), lines = root.querySelector('[data-pl-lines]');
    if (!editor || !lines) return;
    lines.textContent = editor.value.split('\n').map((_, index) => index + 1).join('\n');
    lines.scrollTop = editor.scrollTop;
  }
  function updateEvidence() {
    const draft = currentDraft(), complete = lessonComplete(draft);
    root.querySelector('[data-pl-prediction-state]').textContent = draft.predictionVerified ? 'Previsão conferida' : 'Previsão pendente';
    root.querySelector('[data-pl-main-state]').textContent = verifiedStage(draft) ? 'Desafio validado' : 'Desafio pendente';
    root.querySelector('[data-pl-transfer-state]').textContent = verifiedStage(draft, 'transfer') ? 'Variação validada' : 'Variação pendente';
    const next = root.querySelector('[data-pl-next]');
    next.disabled = running || !complete || byLanguage(language).lessons.at(-1).id === lessonId;
    root.querySelector('[data-pl-complete]').textContent = complete ? 'Você previu, programou e aplicou a ideia em outra situação.' : 'Conclua a previsão, teste o desafio e resolva a variação para avançar.';
    const finished = byLanguage(language).lessons.filter(lesson => lessonComplete(memory[language + ':' + lesson.id] || {})).length;
    root.querySelector('[data-pl-progress]').textContent = finished + ' de ' + byLanguage(language).lessons.length + ' etapas validadas';
    root.querySelector('[data-pl-progress-bar]').value = finished;
    root.querySelectorAll('[data-pl-lesson]').forEach(button => {
      const done = lessonComplete(memory[language + ':' + button.dataset.plLesson] || {});
      button.classList.toggle('is-complete', done);
      button.querySelector('[data-pl-lesson-icon]').textContent = done ? 'check_circle' : getLesson(language, button.dataset.plLesson).kind === 'project' ? 'rocket_launch' : 'radio_button_unchecked';
    });
  }
  function renderCases(results = []) {
    const target = root.querySelector('[data-pl-results]');
    target.innerHTML = results.length ? results.map(result =>
      '<article class="pl-case ' + (result.passed ? 'passed' : 'failed') + '"><header>' + icon(result.passed ? 'check_circle' : 'error') + '<strong>' + escape(result.label) + '</strong><span>' + (result.passed ? 'Passou' : 'Revise') + '</span></header>' +
      (result.passed ? '' : '<div class="pl-case-diff"><div><small>ENTRADA</small><pre>' + escape(result.input || '(sem entrada)') + '</pre></div><div><small>ESPERADO</small><pre>' + escape(result.expected || '(sem saída)') + '</pre></div><div><small>SEU RESULTADO</small><pre>' + escape(result.actual || '(sem saída)') + '</pre></div></div>' + (result.error ? '<pre class="pl-error">' + escape(result.error) + '</pre>' : '')) + '</article>').join('') :
      '<p class="pl-muted">Teste seu programa com todas as entradas do desafio. Apenas executar uma vez não conclui a etapa.</p>';
  }
  function setRunning(value) {
    running = value;
    root.querySelectorAll('[data-pl-run],[data-pl-check],[data-pl-language],[data-pl-lesson],[data-pl-stage],[data-pl-reset],[data-pl-recover]').forEach(button => button.disabled = value);
    root.querySelector('[data-pl-stop]').disabled = !value;
    root.querySelector('[data-pl-code]').readOnly = value;
    root.querySelector('[data-pl-stdin]').readOnly = value;
    updateEvidence();
  }
  async function run(allCases = false) {
    if (running || destroyed) return;
    const lesson = currentLesson(), draft = currentDraft(), source = getCode();
    if (!source.trim()) { showStatus('Escreva um programa antes de executar.'); return; }
    const targetStage = stage, prefix = targetStage === 'transfer' ? 'transfer' : 'lesson';
    const cases = targetStage === 'transfer' ? lesson.transfer.cases : lesson.cases;
    cancel = new AbortController(); setRunning(true); lastOutput = '';
    const results = [];
    if (allCases) { invalidateStage(draft, targetStage); renderCases(); }
    try {
      const inputs = allCases ? cases : [{ input: root.querySelector('[data-pl-stdin]').value, label: 'Seu experimento' }];
      for (let index = 0; index < inputs.length; index++) {
        if (cancel.signal.aborted) break;
        const testCase = inputs[index];
        showStatus(allCases ? 'Testando ' + (index + 1) + ' de ' + inputs.length + '…' : 'Executando seu programa…');
        const result = await runner.run({ language, code: source, stdin: testCase.input, signal: cancel.signal, timeoutMs: 5000, onStatus: value => showStatus(typeof value === 'string' ? value : value.message || value.stage || 'Preparando ambiente…') });
        if (destroyed) return;
        lastOutput = result.stdout || '';
        const output = root.querySelector('[data-pl-output]');
        output.textContent = (result.stdout || '') + (result.stderr ? '\n' + result.stderr : '') + (result.error && result.error !== result.stderr ? '\n' + result.error : '') || '(O programa não escreveu no terminal.)';
        if (allCases) {
          results.push(assessCase(result, testCase)); renderCases(results);
          if (['cancelled','load_error','timeout'].includes(result.status)) break;
        } else showStatus(result.status === 'success' ? 'Programa executado. Compare a saída com sua previsão.' : result.error || 'O programa precisa de um ajuste. Confira o terminal.');
      }
      if (allCases) {
        draft[prefix + 'Results'] = results;
        if (results.length === cases.length && results.every(result => result.passed) && !cancel.signal.aborted) {
          draft[prefix + 'VerifiedCode'] = source;
          showStatus(targetStage === 'transfer' ? 'Variação validada. Você aplicou a ideia em um novo cenário.' : 'Todos os testes passaram. Agora experimente a variação.');
        } else showStatus(cancel.signal.aborted ? 'Execução interrompida. Seu código foi preservado.' : 'Alguns testes ainda não passaram. Compare as entradas e saídas abaixo.');
        save();
      }
    } catch (error) {
      if (destroyed) return;
      root.querySelector('[data-pl-output]').textContent = error.message || 'O ambiente não conseguiu executar. Tente novamente.';
      showStatus(cancel.signal.aborted ? 'Execução interrompida.' : 'Não foi possível executar. Seu código continua aqui.');
    } finally { if (!destroyed) { setRunning(false); updateEvidence(); } }
  }
  function render() {
    const lesson = currentLesson(), track = byLanguage(language), draft = currentDraft(), index = track.lessons.findIndex(item => item.id === lessonId);
    const hints = stage === 'transfer' ? lesson.transfer.hints || ['Releia a nova missão: quais entradas e saídas mudaram?', 'Use a mesma ideia da etapa principal, adaptando os dados e as regras ao novo cenário.', 'Execute com a primeira entrada, compare com a missão e depois valide todas as entradas.'] : lesson.hints;
    const hintKey = stage === 'transfer' ? 'transferHints' : 'hints';
    root.classList.add('programming-lab');
    root.innerHTML = '<header class="pl-heading"><div><span class="pl-kicker">LABORATÓRIO DE INFORMÁTICA</span><h1>Aprenda criando. Entenda executando.</h1><p>Preveja o resultado, programe, teste e transforme o que aprendeu em pequenos projetos.</p></div><div class="pl-heading-actions"><span class="pl-local">' + icon('save') + 'Progresso neste navegador</span>' + (mode === 'teacher' ? '<button type="button" class="pl-button" data-pl-share>' + icon('link') + 'Copiar trilha para alunos</button>' + (onAssign ? '<button type="button" class="pl-button pl-primary" data-pl-assign>' + icon('assignment') + 'Preparar atividade para a turma</button>' : '') : '') + '</div></header>' +
      '<div class="pl-language-switch" role="group" aria-label="Linguagem da trilha"><button type="button" data-pl-language="python" aria-pressed="' + (language === 'python') + '">' + icon('code') + '<span><strong>Python</strong><small>Da primeira saída a projetos com dados</small></span></button><button type="button" data-pl-language="cpp" aria-pressed="' + (language === 'cpp') + '">' + icon('terminal') + '<span><strong>C++</strong><small>Da lógica a programas estruturados</small></span></button></div>' +
      '<div class="pl-workspace"><aside class="pl-route"><div class="pl-route-head"><span class="pl-kicker">SUA TRILHA · ' + escape(track.title || (language === 'python' ? 'Python' : 'C++')) + '</span><strong data-pl-progress></strong><progress data-pl-progress-bar max="' + track.lessons.length + '" value="0" aria-label="Etapas validadas"></progress></div><nav aria-label="Etapas da trilha">' + track.lessons.map((item, number) => '<button type="button" data-pl-lesson="' + escape(item.id) + '" ' + (item.id === lessonId ? 'aria-current="step"' : '') + '><span class="pl-lesson-number">' + (number + 1) + '</span><span><strong>' + escape(item.title) + '</strong><small>' + (item.kind === 'project' ? 'Mini projeto · ' : '') + escape(item.duration || 15) + ' min</small></span><span class="material-symbols-outlined" data-pl-lesson-icon aria-hidden="true"></span></button>').join('') + '</nav><p>Seu avanço depende de evidências: prever, testar e resolver outra situação. Esta prática não atribui notas escolares.</p></aside>' +
      '<main class="pl-main"><section class="pl-lesson"><div class="pl-lesson-heading"><span class="pl-kicker">ETAPA ' + (index + 1) + ' · ' + (lesson.kind === 'project' ? 'MINI PROJETO' : 'APRENDER E FAZER') + '</span><span>' + escape(lesson.duration || 15) + ' min</span></div><h2>' + escape(lesson.title) + '</h2><p class="pl-summary">' + escape(lesson.summary) + '</p><div class="pl-concepts">' + (lesson.concepts || []).map(item => '<span>' + escape(item) + '</span>').join('') + '</div><button class="pl-text-button" type="button" data-pl-editor-link>' + icon('code') + 'Abrir o editor</button><details class="pl-learn" open><summary>' + icon('menu_book') + 'Entenda a ideia</summary>' + (lesson.learn || []).map(item => '<p>' + escape(item) + '</p>').join('') + '<p class="pl-mistake"><strong>Armadilha comum:</strong> ' + escape(lesson.commonMistake) + '</p></details></section>' +
      '<section class="pl-prediction" aria-labelledby="pl-prediction-title"><div><span class="pl-kicker">1 · PENSE ANTES DE EXECUTAR</span><h3 id="pl-prediction-title">' + escape(lesson.prediction.prompt) + '</h3></div><pre>' + escape(lesson.prediction.code) + '</pre><fieldset><legend>Qual saída você espera?</legend>' + lesson.prediction.choices.map((choice, number) => '<label><input type="radio" name="pl-prediction" value="' + number + '" ' + (draft.prediction === number ? 'checked' : '') + '><span>' + escape(choice) + '</span></label>').join('') + '</fieldset><button type="button" class="pl-button" data-pl-predict>Conferir meu raciocínio</button><p data-pl-prediction-feedback role="status">' + (draft.predictionVerified ? escape(lesson.prediction.explanation) : '') + '</p></section>' +
      '<section class="pl-build"><header><div><span class="pl-kicker">2 · PROGRAME E EXPERIMENTE</span><h3>Seu espaço de desenvolvimento</h3></div><div class="pl-stage-tabs" role="group" aria-label="Modo de prática"><button type="button" data-pl-stage="lesson" aria-pressed="' + (stage === 'lesson') + '">Desafio</button><button type="button" data-pl-stage="transfer" aria-pressed="' + (stage === 'transfer') + '">Aplicar em outra situação</button></div></header><div class="pl-task"><strong>' + (stage === 'transfer' ? 'Agora, mude o contexto' : 'Sua missão') + '</strong><p>' + escape(stage === 'transfer' ? lesson.transfer.prompt : lesson.task) + '</p></div>' +
      '<div class="pl-editor-head"><strong>' + (language === 'python' ? 'main.py' : 'main.cpp') + '</strong><span data-pl-save-state></span><button type="button" aria-label="Baixar seu código" title="Baixar arquivo" data-pl-download>' + icon('download') + '</button><button type="button" aria-label="Restaurar código inicial" title="Guardar rascunho e restaurar exemplo" data-pl-reset>' + icon('restart_alt') + '</button></div><div class="pl-code-wrap"><pre data-pl-lines aria-hidden="true"></pre><textarea data-pl-code aria-label="Editor de código ' + (language === 'python' ? 'Python' : 'C++') + '" spellcheck="false" autocomplete="off" autocapitalize="off" maxlength="30000">' + escape(getCode()) + '</textarea></div><div class="pl-recovery"><button type="button" class="pl-text-button" data-pl-recover ' + (!draft[stage + 'Backup'] ? 'hidden' : '') + '>Recuperar rascunho anterior</button><small>Tab indenta · Ctrl + Enter executa</small></div>' +
      '<div class="pl-run-area"><label>Entradas do programa <small>Uma resposta por linha, na ordem de input() ou cin.</small><textarea data-pl-stdin aria-label="Entradas do programa" rows="3" maxlength="10000" spellcheck="false">' + escape(stage === 'transfer' ? draft.transferStdin : draft.stdin) + '</textarea></label><div class="pl-run-actions"><button type="button" class="pl-button pl-primary" data-pl-run>' + icon('play_arrow') + 'Executar código</button><button type="button" class="pl-button" data-pl-stop disabled>' + icon('stop') + 'Parar</button><button type="button" class="pl-button pl-check" data-pl-check>' + icon('fact_check') + 'Validar desafio</button></div></div><p class="pl-runtime-note">' + (language === 'python' ? 'Python real no navegador. O ambiente é preparado na primeira execução.' : 'C++20 real: seu programa é compilado no navegador. A primeira preparação baixa aproximadamente 95 MB e pode levar alguns minutos.') + '</p><p class="pl-status" data-pl-status role="status">' + escape(status) + '</p>' +
      '<section class="pl-terminal" aria-label="Terminal do programa"><header>' + icon('terminal') + '<strong>Terminal</strong><small>Saída e mensagens da última execução</small></header><pre data-pl-output tabindex="0">' + escape(lastOutput || 'Seu resultado aparecerá aqui. Execute uma hipótese e observe o que muda.') + '</pre></section><div class="pl-results" data-pl-results aria-live="polite"></div>' +
      '<div class="pl-hints"><button type="button" class="pl-text-button" data-pl-hint ' + (draft[hintKey] >= hints.length ? 'disabled' : '') + '>' + icon('lightbulb') + 'Preciso de uma pista</button><ol>' + hints.slice(0, draft[hintKey] || 0).map(hint => '<li>' + escape(hint) + '</li>').join('') + '</ol></div></section>' +
      '<section class="pl-evidence"><span class="pl-kicker">3 · DEMONSTRE O QUE APRENDEU</span><div><span>' + icon('psychology') + '<strong data-pl-prediction-state></strong></span><span>' + icon('fact_check') + '<strong data-pl-main-state></strong></span><span>' + icon('swap_horiz') + '<strong data-pl-transfer-state></strong></span></div><p data-pl-complete></p><button type="button" class="pl-button pl-primary" data-pl-next>Próxima etapa' + icon('arrow_forward') + '</button></section></main></div>';
    updateLines(); updateEvidence(); renderCases(draft[(stage === 'transfer' ? 'transfer' : 'lesson') + 'Results']);
    root.querySelectorAll('[data-pl-language]').forEach(button => button.addEventListener('click', () => { save(); language = button.dataset.plLanguage; lessonId = byLanguage(language).lessons[0].id; stage = 'lesson'; clearExperiment(); render(); }));
    root.querySelectorAll('[data-pl-lesson]').forEach(button => button.addEventListener('click', () => { save(); lessonId = button.dataset.plLesson; stage = 'lesson'; clearExperiment(); render(); root.querySelector('.pl-lesson h2').scrollIntoView({block:'nearest'}); }));
    root.querySelectorAll('[data-pl-stage]').forEach(button => button.addEventListener('click', () => { stage = button.dataset.plStage; clearExperiment(); render(); root.querySelector('[data-pl-code]').focus(); }));
    const editor = root.querySelector('[data-pl-code]');
    editor.addEventListener('input', () => { setCode(editor.value); updateLines(); renderCases(); });
    editor.addEventListener('scroll', updateLines);
    editor.addEventListener('keydown', event => {
      if (running || destroyed) return;
      if (event.key === 'Tab') { event.preventDefault(); const begin = editor.selectionStart, end = editor.selectionEnd; editor.setRangeText('    ',begin,end,'end'); setCode(editor.value); updateLines(); }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); run(); }
    });
    root.querySelector('[data-pl-stdin]').addEventListener('input', event => { draft[stage === 'transfer' ? 'transferStdin' : 'stdin'] = event.target.value; save(); });
    root.querySelectorAll('input[name="pl-prediction"]').forEach(input => input.addEventListener('change', () => { draft.prediction = Number(input.value); draft.predictionVerified = false; save(); updateEvidence(); root.querySelector('[data-pl-prediction-feedback]').textContent = ''; }));
    root.querySelector('[data-pl-predict]').addEventListener('click', () => { draft.predictionVerified = draft.prediction === lesson.prediction.correctIndex; root.querySelector('[data-pl-prediction-feedback]').textContent = draft.prediction == null ? 'Escolha uma previsão para conferir.' : draft.predictionVerified ? lesson.prediction.explanation : 'Pense na ordem das instruções e nos valores usados. Tente outra previsão antes de executar.'; save(); updateEvidence(); });
    root.querySelector('[data-pl-hint]').addEventListener('click', () => { draft[hintKey] = Math.min((draft[hintKey] || 0) + 1,hints.length); save(); root.querySelector('.pl-hints ol').innerHTML = hints.slice(0,draft[hintKey]).map(hint=>'<li>'+escape(hint)+'</li>').join(''); root.querySelector('[data-pl-hint]').disabled = draft[hintKey] >= hints.length; });
    root.querySelector('[data-pl-editor-link]').addEventListener('click', () => { root.querySelector('.pl-build').scrollIntoView({block:'start'}); editor.focus({preventScroll:true}); });
    root.querySelector('[data-pl-run]').addEventListener('click', () => run());
    root.querySelector('[data-pl-check]').addEventListener('click', () => run(true));
    root.querySelector('[data-pl-stop]').addEventListener('click', () => { cancel?.abort(); runner.stop(); showStatus('Interrompendo a execução…'); });
    root.querySelector('[data-pl-reset]').addEventListener('click', () => { draft[stage + 'Backup'] = getCode(); setCode(stage === 'transfer' ? lesson.transfer.starterCode : lesson.starterCode); render(); showStatus('Exemplo inicial restaurado. Você pode recuperar seu rascunho anterior.'); });
    root.querySelector('[data-pl-recover]').addEventListener('click', () => { const backup = draft[stage + 'Backup']; draft[stage + 'Backup'] = getCode(); setCode(backup); render(); showStatus('Rascunho recuperado.'); });
    root.querySelector('[data-pl-next]').addEventListener('click', () => { if (!lessonComplete(draft)) return; const next = track.lessons[index + 1]; if (next) { save(); lessonId = next.id; stage = 'lesson'; clearExperiment(); render(); root.querySelector('.pl-lesson h2').scrollIntoView({block:'start'}); } });
    root.querySelector('[data-pl-download]').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([getCode()],{type:'text/plain;charset=utf-8'})), link = document.createElement('a'); link.href = url; link.download = language === 'python' ? 'main.py' : 'main.cpp'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); });
    root.querySelector('[data-pl-share]')?.addEventListener('click', async () => { const target = new URL(teacherStudentUrl); target.searchParams.set('language',language); target.searchParams.set('lesson',lessonId); try { await navigator.clipboard.writeText(target.href); showStatus('Link da etapa copiado. A prática continua no ambiente do aluno.'); } catch { showStatus('Abra esta etapa: ' + target.href); } });
    root.querySelector('[data-pl-assign]')?.addEventListener('click', () => {
      const target = new URL(teacherStudentUrl); target.searchParams.set('language',language); target.searchParams.set('lesson',lessonId);
      onAssign({language, lesson, url:target.href});
    });
    save();
  }
  render();
  const cleanup = () => { if (destroyed) return; destroyed = true; cancel?.abort(); runner.dispose(); window.removeEventListener('pagehide',onPageHide); };
  const onPageHide = event => {
    if (event.persisted) { cancel?.abort(); runner.stop(); }
    else cleanup();
  };
  window.addEventListener('pagehide',onPageHide);
  const handle = { dispose: cleanup };
  mountedLabs.set(root,handle);
  return handle;
}
