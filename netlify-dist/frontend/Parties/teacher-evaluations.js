/* Shared teacher workspace. Existing APIs remain the authority for permissions and grades. */
(() => {
  const labels = { rascunho: 'Rascunho', publicado: 'Publicado', encerrado: 'Encerrado' };
  const frontendMarker = location.pathname.indexOf('/frontend/');
  const frontendRoot = frontendMarker >= 0
    ? `${location.pathname.slice(0, frontendMarker)}/frontend/`
    : '/frontend/';
  const specialtyBase = new URL(`${frontendRoot}professor/specialty/`, location.origin);
  const assetPromises = new Map();
  const loadAsset = (type, file, version) => {
    const url = new URL(`${file}?v=${version}`, specialtyBase).href;
    if (assetPromises.has(url)) return assetPromises.get(url);
    const promise = new Promise((resolve, reject) => {
      const selector = type === 'style' ? `link[href="${url}"]` : `script[src="${url}"]`;
      const existing = document.querySelector(selector);
      if (existing?.dataset.loaded === 'true') return resolve();
      const asset = existing || document.createElement(type === 'style' ? 'link' : 'script');
      if (type === 'style') {
        asset.rel = 'stylesheet';
        asset.href = url;
      } else {
        asset.src = url;
        asset.async = true;
      }
      const ready = () => { asset.dataset.loaded = 'true'; resolve(); };
      asset.addEventListener('load', ready, { once: true });
      asset.addEventListener('error', () => reject(new Error('Não foi possível preparar esta área. Verifique a conexão e tente novamente.')), { once: true });
      if (!existing) document.head.append(asset);
      else if (existing.sheet || (type === 'script' && existing.dataset.loaded === 'true')) ready();
    });
    assetPromises.set(url, promise);
    return promise;
  };
  const ensureFeature = async (view) => {
    if (view === 'create') {
      if (typeof window.renderTeacherActivityBuilder === 'function') return;
      await Promise.all([
        loadAsset('style', 'activity-builder.css', '20261004-3'),
        loadAsset('style', 'teacher-copilot.css', '20261004-3'),
        loadAsset('script', 'teacher-copilot.js', '20261004-6'),
        loadAsset('script', 'activity-builder.js', '20261004-3'),
      ]);
      if (typeof window.renderTeacherActivityBuilder !== 'function') throw new Error('O construtor não ficou disponível. Tente novamente.');
      return;
    }
    if (view === 'reviews' || view === 'results') {
      if (typeof window.renderTeacherReviewCenter === 'function') return;
      await Promise.all([
        loadAsset('style', 'teacher-review.css', '20261004-8'),
        loadAsset('script', 'teacher-review.js', '20261004-8'),
      ]);
      if (typeof window.renderTeacherReviewCenter !== 'function') throw new Error('A central de correções não ficou disponível. Tente novamente.');
    }
  };
  window.renderTeacherEvaluations = async (context) => {
    const { content, data, api, config, escapeHtml: e, formatDate, toast } = context;
    const query = new URLSearchParams(location.hash.slice(1));
    let openCopilot = query.get('copiloto') === '1';
    const state = { view: query.get('view') || 'list', classId: query.get('turma') || '', trimester: query.get('trimestre') || '', status: '', search: '', evaluationId: query.get('avaliacao') || '' };
    const items = data.evaluations || [];
    const choices = [['list','Minhas avaliações'],['create','Nova avaliação'],['results','Acompanhamento'],['reviews','Correção e recuperação']];
    if (!choices.some(([key]) => key === state.view)) state.view = 'list';
    const saveRoute = () => {
      const params = new URLSearchParams({ view: state.view });
      if (state.classId) params.set('turma', state.classId);
      if (state.trimester) params.set('trimestre', state.trimester);
      if (state.evaluationId) params.set('avaliacao', state.evaluationId);
      history.replaceState(null, '', `#${params}`);
    };
    const filtered = () => items.filter(item => (!state.classId || item.turma_id === state.classId) && (!state.trimester || String(item.trimestre) === state.trimester));
    content.innerHTML = `<section class="os-evaluations"><header class="os-eval-heading"><div><h2>Atividades das turmas</h2><p>Crie atividades e acompanhe as entregas e os resultados.</p></div></header><div class="os-eval-context"><label>Turma<select data-eval-class><option value="">Todas as turmas</option>${(data.classes || []).map(item => `<option value="${e(item.id)}">${e(item.nome)}</option>`).join('')}</select></label><label>Trimestre<select data-eval-trimester><option value="">Todos os trimestres</option><option value="1">1º trimestre</option><option value="2">2º trimestre</option><option value="3">3º trimestre</option></select></label></div><nav class="os-eval-nav" aria-label="Fluxo de avaliações">${choices.map(([key,label]) => `<button type="button" data-eval-view="${key}">${label}</button>`).join('')}</nav><div data-eval-screen></div></section>`;
    const root = content.querySelector('.os-evaluations');
    const target = root.querySelector('[data-eval-screen]');
    const restorePageTitle = () => {
      const title = config.pages?.avaliacoes?.title || 'Avaliações';
      const subtitle = config.pages?.avaliacoes?.subtitle || 'Prepare, acompanhe e corrija avaliações.';
      const heading = document.querySelector('.portal-topbar h1');
      const help = document.querySelector('.portal-topbar .portal-context-help');
      if (heading) heading.textContent = title;
      if (help) help.textContent = subtitle;
      document.title = `${title} | OminiSaber`;
    };
    root.querySelector('[data-eval-class]').value = state.classId;
    root.querySelector('[data-eval-trimester]').value = state.trimester;
    let dirty = false;
    const mayLeave = () => !dirty || window.confirm('Sair da criação? Alterações ainda não salvas serão perdidas.');
    const reload = async () => { dirty = false; state.view = 'list'; state.evaluationId = ''; saveRoute(); await context.reload(); };
    const renderList = () => {
      const scoped = filtered();
      target.innerHTML = `<div class="os-eval-metrics">${Object.entries(labels).map(([key,label]) => `<article><strong>${scoped.filter(item=>item.status===key).length}</strong><span>${label === 'Publicado' ? 'Publicadas' : label === 'Encerrado' ? 'Encerradas' : 'Rascunhos'}</span></article>`).join('')}</div><div class="os-eval-filter"><label>Buscar avaliação<input type="search" data-eval-search placeholder="Título da avaliação" value="${e(state.search)}"></label><label>Situação<select data-eval-status><option value="">Todas</option>${Object.entries(labels).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label></div><p data-eval-count role="status"></p><div class="os-eval-list" data-eval-list></div>`;
      const list = target.querySelector('[data-eval-list]');
      const draw = () => {
        const matches = scoped.filter(item => (!state.status || item.status === state.status) && String(item.titulo).toLocaleLowerCase('pt-BR').includes(state.search.toLocaleLowerCase('pt-BR')));
        target.querySelector('[data-eval-count]').textContent = `${matches.length} avaliação(ões)`;
        list.innerHTML = matches.length ? matches.map(item => `<article class="os-eval-card"><div><span class="os-eval-status">${e(labels[item.status] || item.status)}</span><h3>${e(item.titulo)}</h3><p>${e(item.turmas?.nome || 'Sem turma')} · ${item.trimestre ? `${e(item.trimestre)}º trimestre` : 'Trimestre não informado'}</p><p>${Number(item.valor) || 0} pontos · ${item.questoes_avaliacao?.length || 0} questões · Prazo: ${e(formatDate(item.encerra_em))}</p></div><div class="os-eval-actions"><button class="button secondary" type="button" data-preview="${e(item.id)}">Revisar proposta</button>${item.status !== 'rascunho' ? `<button class="button primary" type="button" data-results="${e(item.id)}">Acompanhar</button><button class="button secondary" type="button" data-reviews="${e(item.id)}">Corrigir</button>` : ''}<button class="button secondary" type="button" data-copy="${e(item.id)}">Criar cópia</button></div></article>`).join('') : '<div class="os-eval-empty"><h3>Nenhuma avaliação encontrada</h3><p>Ajuste os filtros ou use Nova avaliação para preparar a primeira proposta.</p></div>';
      };
      target.querySelector('[data-eval-status]').value = state.status;
      target.querySelector('[data-eval-search]').addEventListener('input', event => { state.search = event.target.value; draw(); });
      target.querySelector('[data-eval-status]').addEventListener('change', event => { state.status = event.target.value; draw(); });
      list.addEventListener('click', async event => {
        const button = event.target.closest('button');
        if (!button) return;
        if (button.dataset.preview) return preview(button.dataset.preview, button);
        state.evaluationId = button.dataset.results || button.dataset.reviews || '';
        state.view = button.dataset.copy ? 'create' : button.dataset.results ? 'results' : 'reviews';
        await render(button.dataset.copy);
      });
      draw();
    };
    const preview = (id, trigger) => {
      const item = items.find(value => value.id === id);
      if (!item) return;
      const dialog = document.createElement('dialog');
      dialog.className = 'os-eval-dialog';
      dialog.setAttribute('aria-labelledby', 'os-eval-preview-title');
      const questions = [...(item.questoes_avaliacao || [])].sort((a,b) => a.ordem-b.ordem);
      dialog.innerHTML = `<header><div><p class="eyebrow">REVISÃO DA PROPOSTA</p><h2 id="os-eval-preview-title">${e(item.titulo)}</h2></div><button type="button" class="button secondary" data-close>Fechar</button></header><p>${e(item.turmas?.nome || 'Sem turma')} · ${Number(item.valor) || 0} pontos</p><p>Abertura: ${e(formatDate(item.abre_em))}<br>Encerramento: ${e(formatDate(item.encerra_em))}</p><p class="os-eval-instructions">${e(item.instrucoes || 'Sem orientações adicionais.')}</p><ol>${questions.map(question=>`<li><h3>${e(question.enunciado || 'Questão')}</h3><p>${Number(question.pontos) || 0} pontos</p>${Array.isArray(question.alternativas) ? `<ul>${question.alternativas.map(option=>`<li>${e(typeof option === 'string' ? option : option.text || option.label || '')}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ol><footer><p>Somente propostas publicadas ficam disponíveis para os alunos da turma. Os gabaritos não aparecem nesta revisão.</p>${item.status === 'rascunho' ? '<button type="button" class="button primary" data-publish>Publicar para a turma</button>' : ''}<p data-publish-error role="alert"></p></footer>`;
      document.body.append(dialog);
      dialog.querySelector('[data-close]').onclick = () => dialog.close();
      dialog.addEventListener('close', () => { dialog.remove(); if (trigger.isConnected) trigger.focus(); });
      dialog.querySelector('[data-publish]')?.addEventListener('click', async event => {
        if (!item.turma_id || !questions.length) { dialog.querySelector('[data-publish-error]').textContent = 'A publicação exige turma e questões. Crie uma cópia para completar a proposta.'; return; }
        if (!window.confirm(`Publicar “${item.titulo}” para ${item.turmas?.nome || 'a turma selecionada'}?`)) return;
        event.target.disabled = true;
        try { await api.updateTeacherEvaluationStatus(id, 'publicado'); dialog.close(); toast('Avaliação publicada para a turma.'); await reload(); }
        catch (error) { dialog.querySelector('[data-publish-error]').textContent = error.message; event.target.disabled = false; }
      });
      dialog.showModal();
    };
    const render = async (copyId) => {
      dirty = false;
      saveRoute();
      root.querySelectorAll('[data-eval-view]').forEach(button => { button.setAttribute('aria-current', button.dataset.evalView === state.view ? 'page' : 'false'); });
      if (state.view !== 'create') restorePageTitle();
      if (state.view === 'list') return renderList();
      target.setAttribute('aria-busy', 'true');
      target.innerHTML = `<section class="loading-state os-module-loading" aria-live="polite"><span class="material-symbols-outlined">progress_activity</span><div><strong>Preparando esta área</strong><p>Carregando somente os recursos necessários...</p></div></section>`;
      try {
        await ensureFeature(state.view);
      } catch (error) {
        target.removeAttribute('aria-busy');
        target.innerHTML = `<section class="os-eval-empty" role="alert"><h3>Não foi possível abrir esta área</h3><p>${e(error.message)}</p><button class="button primary" type="button" data-module-retry>Tentar novamente</button></section>`;
        target.querySelector('[data-module-retry]')?.addEventListener('click', () => render(copyId), { once: true });
        return;
      }
      target.removeAttribute('aria-busy');
      if (state.view === 'create') {
        await window.renderTeacherActivityBuilder({ ...context, content: target, reload, initialClassId: state.classId, initialTrimester: state.trimester, copyId });
        if (openCopilot) {
          openCopilot = false;
          target.querySelector('[data-copilot-open]')?.click();
        }
        dirty = Boolean(copyId);
        const introduction = target.querySelector('.builder-intro .eyebrow');
        if (introduction) introduction.textContent = 'PREPARAÇÃO DA AVALIAÇÃO';
        target.addEventListener('input', () => { if (state.view === 'create') dirty = true; }, { once: true });
        target.addEventListener('change', () => { if (state.view === 'create') dirty = true; }, { once: true });
      } else {
        await window.renderTeacherReviewCenter({ ...context, content: target, data: { ...data, evaluations: filtered() }, reload, onCreate: async () => { state.view = 'create'; state.evaluationId = ''; await render(); }, mode: state.view === 'results' ? 'results' : 'reviews', evaluationId: state.evaluationId, classId: state.classId, trimester: state.trimester });
        const introduction = target.querySelector('.review-hero .eyebrow');
        if (introduction) introduction.textContent = 'ACOMPANHAMENTO DA APRENDIZAGEM';
      }
    };
    root.querySelectorAll('[data-eval-view]').forEach(button => {
      const warm = () => { if (button.dataset.evalView !== 'list') ensureFeature(button.dataset.evalView).catch(() => {}); };
      button.addEventListener('pointerenter', warm, { once: true });
      button.addEventListener('focus', warm, { once: true });
      button.addEventListener('click', async () => { if (!mayLeave()) return; state.view = button.dataset.evalView; state.evaluationId = ''; await render(); });
    });
    document.querySelectorAll('.portal-actions a').forEach(link => {
      if (!link.getAttribute('href')?.includes('avaliacoes')) return;
      link.onclick = event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        root.querySelector('[data-eval-view="create"]').click();
      };
    });
    for (const [selector,key] of [['[data-eval-class]','classId'],['[data-eval-trimester]','trimester']]) root.querySelector(selector).addEventListener('change', async event => { if (!mayLeave()) { event.target.value = state[key]; return; } state[key] = event.target.value; state.evaluationId = ''; await render(); });
    await render();
  };
})();
