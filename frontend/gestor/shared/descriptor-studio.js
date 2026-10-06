(() => {
  const subjects = { portugues: 'Português e Literatura', matematica: 'Matemática', fisica: 'Física', quimica: 'Química', biologia: 'Biologia', redacao: 'Redação', tecnico_administracao: 'Administração', tecnico_informatica: 'Informática' };
  const statuses = { revisao: 'Em revisão', ativo: 'Ativo', arquivado: 'Arquivado' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const blank = () => ({ codigo: '', titulo: '', descricao: '', materia_codigo: 'portugues', serie: '', trimestre: '', status: 'revisao', habilidade_id: '' });
  const icon = name => `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
  window.OminiDescriptorStudio = { async mount(root, api) {
    let rows = await api.listManagerDescriptors(), item = null, original = '', step = 0, creating = false, busy = false, query = '', filter = '', skillRequest = 0;
    const session = await api.getSession();
    const draftKey = `omini:descriptor-draft:${session.user.id}`;
    let restored = null;
    try { restored = JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch (_) { /* Storage is optional. */ }
    const changed = () => item && JSON.stringify(item) !== original;
    const notify = text => { root.querySelector('[data-message]').textContent = text; };
    const persist = () => {
      if (!creating) return;
      try { localStorage.setItem(draftKey, JSON.stringify(item)); notify('Rascunho salvo neste dispositivo.'); }
      catch (_) { notify('Não foi possível guardar o rascunho local. Mantenha esta página aberta.'); }
    };
    const errors = () => {
      const list = [];
      if (!/^D\d{3}(?:_[A-Z])?$/.test(item.codigo.trim().toUpperCase())) list.push('Use um código como D038_P ou D038.');
      if (rows.some(r => r.id !== item.id && r.codigo.toUpperCase() === item.codigo.trim().toUpperCase())) list.push('Esse código já existe no catálogo.');
      if (item.titulo.trim().length < 3 || item.titulo.trim().length > 180) list.push('O título deve ter entre 3 e 180 caracteres.');
      if (!item.descricao.trim()) list.push('Descreva a aprendizagem que será observada.');
      if (creating && (![1, 2, 3].includes(Number(item.serie)) || ![1, 2, 3].includes(Number(item.trimestre)))) list.push('Selecione a série e o trimestre.');
      if (creating && item.status === 'ativo' && !item.habilidade_id) list.push('Para disponibilizar aos professores, vincule uma habilidade publicada ou mantenha em revisão.');
      return list;
    };
    const periodLabel = () => {
      const periods = (item.descritor_curriculo_periodos || []).map(link => link.curriculo_periodos).filter(Boolean);
      if (periods.length) return [...new Set(periods.map(p => `${p.serie}ª série · ${p.trimestre}º trimestre`))].join(' / ');
      if (creating && (!item.serie || !item.trimestre)) return 'Selecione a série e o trimestre';
      return item.serie && item.trimestre ? `${item.serie}ª série · ${item.trimestre}º trimestre` : 'Períodos definidos pelos vínculos curriculares';
    };
    const options = (values, selected) => Object.entries(values).map(([v, label]) => `<option value="${esc(v)}" ${String(selected) === v ? 'selected' : ''}>${esc(label)}</option>`).join('');
    const field = (name, label, hint = '', max = 180) => `<label>${label}<input name="${name}" value="${esc(item[name])}" maxlength="${max}" ${name === 'codigo' && item.id ? 'readonly' : ''}><small>${hint}</small></label>`;
    const choices = (name, label, suffix) => `<fieldset><legend>${label}</legend><div class="ds-choices">${[1, 2, 3].map(v => `<label><input type="radio" name="${name}" value="${v}" ${Number(item[name]) === v ? 'checked' : ''}><span>${v}${suffix}</span></label>`).join('')}</div></fieldset>`;
    const identification = () => `<section class="ds-section"><p class="ds-eyebrow">01 · IDENTIFICAÇÃO</p><h2>O que o aluno deve aprender?</h2><p>Use um título curto e uma descrição que ajude o professor a reconhecer essa aprendizagem.</p><div class="ds-fields">${field('codigo', 'Código', item.id ? 'Identificador preservado para manter as referências existentes.' : 'Código único. Exemplo: D038_P.', 6)}${field('titulo', 'Título', 'Até 180 caracteres.')}</div><label>Descrição da aprendizagem<textarea name="descricao" rows="7" maxlength="20000" placeholder="Ex.: Inferir o sentido de uma palavra a partir do contexto...">${esc(item.descricao)}</textarea><small>Descreva uma ação observável, seu contexto e o resultado esperado.</small></label></section>`;
    const curriculumForm = () => `<section class="ds-section"><p class="ds-eyebrow">02 · CURRÍCULO</p><h2>Defina o contexto curricular</h2><label>Componente curricular<select name="materia_codigo">${options(subjects, item.materia_codigo)}</select></label>${choices('serie', 'Série', 'ª série')}${choices('trimestre', 'Trimestre', 'º trimestre')}${creating ? '<label>Vincular habilidade (opcional)<select name="habilidade_id"><option value="">Sem vínculo adicional</option></select><small data-skill-state>Selecione o período para consultar as habilidades publicadas.</small></label>' : '<p class="ds-note">Componente e períodos preservados para não alterar os vínculos existentes. ${esc(periodLabel())}.</p>'}</section>`;
    const curriculum = () => creating ? curriculumForm() : `<section class="ds-section"><p class="ds-eyebrow">02 · CURRÍCULO</p><h2>Contexto curricular preservado</h2><p>${esc(subjects[item.materia_codigo])}</p><p>${esc(periodLabel())}</p><p class="ds-note">${item.habilidade_descritores?.length || 0} vínculo(s) com habilidades. A edição de título, descrição e situação não altera os vínculos já usados nas atividades.</p></section>`;
    const publication = () => `<section class="ds-section"><p class="ds-eyebrow">03 · DISPONIBILIDADE</p><h2>Prepare o descritor para uso</h2><p>O descritor faz parte do catálogo curricular compartilhado. As atividades continuam usando suas próprias relações com habilidades e períodos.</p><label>Situação<select name="status">${options(statuses, item.status)}</select></label><div class="ds-note">Em revisão: cadastro em preparação. Ativo: disponível aos professores quando vinculado a uma habilidade de currículo publicado. Arquivado: preserva o histórico.</div></section>`;
    const preview = () => {
      const el = root.querySelector('[data-preview]');
      if (!el || !item) return;
      const checks = [ ['Código e título', /^D\d{3}(?:_[A-Z])?$/.test(item.codigo) && item.titulo.trim().length >= 3 && !rows.some(r => r.id !== item.id && r.codigo === item.codigo)], ['Descrição preenchida', !!item.descricao.trim()], ['Período definido', !!item.serie && !!item.trimestre || !!item.habilidade_descritores?.length] ];
      el.innerHTML = `<p class="ds-eyebrow">PRÉ-VISUALIZAÇÃO</p><h2>Assim fica no catálogo</h2><article class="ds-preview-card"><small>${esc(subjects[item.materia_codigo])} · ${esc(periodLabel())}</small><b class="ds-code">${esc(item.codigo || 'Código')}</b><h3>${esc(item.titulo || 'Título do descritor')}</h3><p>${esc(item.descricao || 'A descrição aparecerá aqui enquanto você escreve.')}</p><span class="ds-status">${esc(statuses[item.status])}</span></article><h3>Conferência</h3><ul class="ds-checks">${checks.map(([label, ok]) => `<li class="${ok ? 'complete' : ''}">${icon(ok ? 'check_circle' : 'radio_button_unchecked')}${label}</li>`).join('')}</ul><p class="ds-note">${creating ? 'O rascunho fica neste dispositivo. O cadastro só vai para o catálogo ao concluir.' : 'As alterações chegam ao catálogo após salvar. Revise a descrição antes de confirmar.'}</p>`;
    };
    const catalog = () => {
      const results = rows.filter(r => (!filter || r.materia_codigo === filter) && `${r.codigo} ${r.titulo} ${r.descricao}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
      root.querySelector('[data-list]').innerHTML = `<p class="ds-count">${results.length} descritores</p>${results.map(r => `<button type="button" class="ds-record ${r.id === item?.id ? 'selected' : ''}" data-id="${esc(r.id)}"><span><b>${esc(r.codigo)}</b><small>${esc(statuses[r.status] || r.status)}</small></span><strong>${esc(r.titulo)}</strong><p>${esc(r.descricao || 'Sem descrição')}</p></button>`).join('') || '<p class="ds-note">Nenhum descritor encontrado.</p>'}`;
    };
    const loadSkills = async () => {
      if (!creating || step !== 1 || !item.serie || !item.trimestre) return;
      const request = ++skillRequest, selected = item.habilidade_id;
      const select = root.querySelector('[name=habilidade_id]'), status = root.querySelector('[data-skill-state]');
      if (!select) return;
      status.textContent = 'Consultando habilidades…';
      try {
        const skills = await api.listManagerCurriculumSkills({ materia: item.materia_codigo, serie: Number(item.serie), trimestre: Number(item.trimestre) });
        if (request !== skillRequest || !select.isConnected) return;
        const unique = [...new Map(skills.map(s => [s.habilidade_id || s.id, s])).values()];
        select.innerHTML = '<option value="">Sem vínculo adicional</option>' + unique.map(s => `<option value="${esc(s.habilidade_id || s.id)}">${esc(s.codigo)} · ${esc(s.descricao || s.titulo)}</option>`).join('');
        select.value = selected;
        status.textContent = `${unique.length} habilidades compatíveis com este período.`;
      } catch (e) { if (request === skillRequest && status.isConnected) status.textContent = `Não foi possível consultar: ${e.message}`; }
    };
    const editor = () => {
      const area = root.querySelector('[data-editor]');
      if (!item) { area.innerHTML = '<div class="ds-section"><h2>Comece pelo catálogo</h2><p>Selecione um descritor ou crie o primeiro.</p></div>'; return; }
      area.innerHTML = `${creating ? `<nav class="ds-steps" aria-label="Etapas de criação">${['Identificação', 'Currículo', 'Disponibilidade', 'Revisão'].map((label, i) => `<button type="button" data-step="${i}" aria-current="${step === i ? 'step' : 'false'}"><b>${i + 1}</b><span>${label}</span></button>`).join('')}</nav>` : ''}<form class="ds-form" novalidate>${creating ? [identification, curriculum, publication, () => `<section class="ds-section"><p class="ds-eyebrow">04 · REVISÃO</p><h2>Confira antes de concluir</h2><p>${errors().length ? 'Ainda há campos que precisam de atenção.' : 'Os campos obrigatórios estão completos.'}</p><ul>${errors().map(e => `<li>${esc(e)}</li>`).join('')}</ul><dl><dt>Código</dt><dd>${esc(item.codigo)}</dd><dt>Título</dt><dd>${esc(item.titulo)}</dd><dt>Descrição</dt><dd>${esc(item.descricao)}</dd><dt>Currículo</dt><dd>${esc(subjects[item.materia_codigo])} · ${esc(item.serie)}ª série · ${esc(item.trimestre)}º trimestre</dd><dt>Situação</dt><dd>${esc(statuses[item.status])}</dd></dl></section>`][step]() : identification() + curriculum() + publication()}<footer class="ds-footer"><span data-save-state>${creating ? 'Cadastro guiado' : 'Edição do catálogo'}</span>${creating && step > 0 ? '<button class="btn" type="button" data-back>Voltar</button>' : ''}<button class="btn btn-primary" type="submit">${creating && step < 3 ? 'Continuar' : creating ? 'Concluir cadastro' : 'Salvar alterações'} ${icon('arrow_forward')}</button></footer></form>`;
      area.querySelector('form').oninput = e => {
        if (!e.target.name) return;
        item[e.target.name] = e.target.name === 'codigo' ? e.target.value.toUpperCase() : e.target.value;
        if (['materia_codigo', 'serie', 'trimestre'].includes(e.target.name)) { item.habilidade_id = ''; loadSkills(); }
        preview(); persist();
        if (!creating) notify('Alterações ainda não salvas.');
      };
      area.querySelector('form').onsubmit = async e => {
        e.preventDefault();
        if (busy) return;
        if (creating && step < 3) {
          const currentErrors = errors();
          if (step === 0 && (!item.codigo || !item.titulo.trim() || !item.descricao.trim() || currentErrors.some(x => /código|título/.test(x)))) { notify(currentErrors.join(' ')); return; }
          if (step === 1 && (!item.serie || !item.trimestre)) { notify('Selecione a série e o trimestre.'); return; }
          step++; editor(); preview(); return;
        }
        const issues = errors();
        if (issues.length) { notify(issues.join(' ')); return; }
        busy = true; area.querySelectorAll('button,input,select,textarea').forEach(x => x.disabled = true); notify('Salvando no catálogo…');
        try {
          const payload = { ...item, codigo: item.codigo.trim().toUpperCase(), titulo: item.titulo.trim(), descricao: item.descricao.trim(), serie: item.serie ? Number(item.serie) : null, trimestre: item.trimestre ? Number(item.trimestre) : null };
          if (creating) await api.saveManagerDescriptorsBatch([payload]);
          else await api.updateManagerDescriptor(item.id, payload);
          rows = await api.listManagerDescriptors();
          const saved = rows.find(r => r.codigo === payload.codigo);
          if (!saved || saved.descricao !== payload.descricao || saved.titulo !== payload.titulo) throw new Error('Não foi possível confirmar a leitura do cadastro salvo. Atualize antes de tentar novamente.');
          if (creating) { try { localStorage.removeItem(draftKey); } catch (_) {} restored = null; }
          creating = false; item = { ...saved }; original = JSON.stringify(item); render(); notify('Salvo e confirmado no catálogo.');
        } catch (e) { editor(); notify(`Não foi possível salvar: ${e.message}`); }
        finally { busy = false; }
      };
      area.querySelector('[data-back]')?.addEventListener('click', () => { step--; editor(); });
      area.querySelectorAll('[data-step]').forEach(b => b.onclick = () => { if (busy) return; step = Number(b.dataset.step); editor(); });
      if (!creating) {
        area.querySelectorAll('[name=materia_codigo],[name=serie],[name=trimestre]').forEach(control => { control.disabled = true; });
      }
      loadSkills();
    };
    const mayLeave = () => !changed() || window.confirm('Há alterações não salvas. Deseja descartá-las?');
    function render() {
      root.innerHTML = `<div class="ds-studio ${creating ? 'is-creating' : ''}"><header class="ds-heading"><div><p class="ds-eyebrow">CURRÍCULO / DESCRITORES</p><h2>${creating ? 'Novo descritor' : 'Mesa curricular'}</h2><p>${creating ? 'Construa, confira e disponibilize a aprendizagem.' : 'Encontre e edite as aprendizagens do catálogo institucional.'}</p></div><div class="ds-heading-actions"><button class="btn" data-catalog-toggle>${icon('view_sidebar')} Catálogo</button><button class="btn ${creating ? '' : 'btn-primary'}" data-new>${icon(creating ? 'arrow_back' : 'add')}${creating ? 'Voltar à edição' : 'Novo descritor'}</button></div></header><p class="ds-message" data-message role="status" aria-live="polite"></p>${restored && !creating ? '<button class="btn ds-restore" data-restore>Retomar rascunho de criação salvo neste dispositivo</button>' : ''}<div class="ds-workspace"><aside class="ds-catalog"><h2>Descritores</h2><label>Buscar<input type="search" data-search placeholder="Código, título ou descrição" value="${esc(query)}"></label><label>Componente<select data-filter><option value="">Todos os componentes</option>${options(subjects, filter)}</select></label><div data-list></div></aside><section class="ds-editor" data-editor></section><aside class="ds-preview" data-preview></aside></div></div>`;
      catalog(); editor(); preview();
      root.querySelector('[data-search]').oninput = e => { query = e.target.value; catalog(); };
      root.querySelector('[data-filter]').onchange = e => { filter = e.target.value; catalog(); };
      root.querySelector('[data-list]').onclick = e => { const b = e.target.closest('[data-id]'); if (b && !busy && mayLeave()) { creating = false; item = { ...rows.find(r => r.id === b.dataset.id) }; original = JSON.stringify(item); render(); } };
      root.querySelector('[data-new]').onclick = () => {
        if (busy || !mayLeave()) return;
        if (!creating && restored && !window.confirm('Já existe um rascunho de criação. Iniciar outro poderá substituí-lo. Continuar?')) return;
        if (creating) { restored = { ...item }; creating = false; item = rows[0] ? { ...rows[0] } : null; }
        else { creating = true; item = blank(); step = 0; }
        original = JSON.stringify(item); render();
      };
      root.querySelector('[data-restore]')?.addEventListener('click', () => { if (!mayLeave()) return; creating = true; item = { ...blank(), ...restored }; step = 0; original = JSON.stringify(item); render(); });
      root.querySelector('[data-catalog-toggle]').onclick = () => root.querySelector('.ds-studio').classList.toggle('show-catalog');
    }
    item = rows[0] ? { ...rows[0] } : null; original = JSON.stringify(item); render();
    window.addEventListener('beforeunload', e => { if (changed()) { e.preventDefault(); e.returnValue = ''; } });
  } };
})();
