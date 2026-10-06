import { teacherSidebarMarkup } from './teacher-navigation.js?v=20261004-8';
import { buildDashboardSummary, dashboardDeadlineLabel, drawDashboardChart } from './dashboard-data.js?v=20261004-1';

const icon = (name) => `<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;
const list = (value) => Array.isArray(value) ? value : [];
let lifecycle = null;
const stylesheet = () => new Promise((resolve, reject) => {
  const url = new URL('./teacher-dashboard.css?v=20261004-8', import.meta.url).href;
  const existing = document.querySelector('link[data-teacher-dashboard-style]');
  if (existing?.sheet) return resolve();
  const link = existing || document.createElement('link');
  link.rel = 'stylesheet'; link.href = url; link.dataset.teacherDashboardStyle = '';
  link.addEventListener('load', resolve, {once:true});
  link.addEventListener('error', () => reject(new Error('Não foi possível carregar o painel. Atualize a página.')), {once:true});
  if (!existing) document.head.append(link);
});

// Each optional source can fail independently without erasing the school workspace.
async function collect(data, api, subject) {
  const request = (name, ...args) => typeof api[name] === 'function' ? api[name](...args) : Promise.reject(new Error('Fonte indisponível'));
  const linkedClassIds = new Set(list(data.classes).map(item => item.id));
  const evaluationsById = new Map(list(data.evaluations).map(item => [item.id, item]));
  const sources = await Promise.allSettled([
    subject === 'portugues' ? request('listTeacherEssays') : Promise.resolve([]),
    request('listTeacherReviewQueue', {tipoProfessor:subject}),
    request('listNotifications'),
  ]);
  const eligibleEvaluations = list(data.evaluations).filter(item => linkedClassIds.has(item.turma_id) && item.status !== 'rascunho' && list(item.tentativas_avaliacao).some(attempt => attempt.status === 'corrigida'))
    .sort((a,b) => new Date(b.updated_at || b.publicado_em || b.encerra_em || 0) - new Date(a.updated_at || a.publicado_em || a.encerra_em || 0));
  const candidates = eligibleEvaluations.slice(0,12);
  const evaluationResults = [];
  let resultsUnavailable = false;
  for (let start=0; start<candidates.length; start+=3) {
    const batch = candidates.slice(start,start+3);
    const answers = await Promise.allSettled(batch.map(item => request('getTeacherEvaluationResults',item.id)));
    answers.forEach((answer,index) => {
      if (answer.status === 'fulfilled') evaluationResults.push({evaluation:batch[index],results:answer.value});
      else resultsUnavailable = true;
    });
  }
  return {
    essays: sources[0].status === 'fulfilled' ? list(sources[0].value) : [],
    essaysUnavailable: sources[0].status === 'rejected',
    reviewQueue: sources[1].status === 'fulfilled' ? list(sources[1].value).filter(item => linkedClassIds.has(item.avaliacoes_docentes?.turma_id || evaluationsById.get(item.avaliacao_id)?.turma_id)) : [],
    reviewsUnavailable: sources[1].status === 'rejected',
    notifications: sources[2].status === 'fulfilled' ? list(sources[2].value) : [],
    notificationsUnavailable: sources[2].status === 'rejected',
    evaluationResults, resultsUnavailable, hasMoreResults:eligibleEvaluations.length > 12,
  };
}

export async function renderTeacherDashboard({root,data,config,api,escapeHtml:e,studioRoute,reload}) {
  lifecycle?.abort(); lifecycle = new AbortController();
  const signal = lifecycle.signal;
  await stylesheet();
  const extras = await collect(data,api,config.type);
  if (signal.aborted) return;
  const summary = buildDashboardSummary({...data,...extras});
  // The authoritative review queue excludes submitted work already graded automatically.
  summary.pending.evaluations = extras.reviewQueue.length;
  summary.pending.total = summary.pending.evaluations + summary.pending.labs + summary.pending.essays;
  const now = new Date();
  const route = (view='list',classId='',evaluationId='') => {
    const hash = new URLSearchParams({view});
    if (classId) hash.set('turma',classId);
    if (evaluationId) hash.set('avaliacao',evaluationId);
    return `../avaliacoes/index.html#${hash}`;
  };
  const fullDate = value => new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value));
  const shortDate = value => new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(value));
  const profile = data.profile?.nome || 'Professor';
  const initials = profile.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase();
  const unread = extras.notifications.filter(item=>!item.readAt).length;
  const next = summary.nextDeadline;
  const nextClass = next && summary.classes.find(item=>item.id===next.turma_id);
  const reviewHref = summary.pending.evaluations ? route('reviews') : summary.pending.essays ? '../redacoes/index.html' : summary.pending.labs ? '../laboratorio/index.html' : route('reviews');
  const reviewsUnknown = extras.reviewsUnavailable || extras.essaysUnavailable;
  const chartMarkup = (large=false) => summary.chart.count ? `<div class="td-chart${large?' td-chart-large':''}"><canvas data-dashboard-chart role="img" aria-label="Média percentual dos resultados corrigidos por turma nas últimas seis semanas. Consulte a tabela de dados."></canvas></div>` : `<div class="td-chart-empty">${icon(extras.resultsUnavailable?'cloud_off':'monitoring')}<strong>${extras.resultsUnavailable?'Resultados indisponíveis':'A evolução começa com as primeiras correções'}</strong><p>${extras.resultsUnavailable?'Você pode continuar criando e corrigindo atividades.':'Depois de corrigir uma atividade, os resultados da turma aparecem aqui.'}</p></div>`;
  const legend = () => `<div class="td-legend">${summary.chart.series.slice(0,5).map((item,index)=>`<span><i class="td-series-${index}" aria-hidden="true"></i>${e(item.label)}</span>`).join('')}</div>`;
  const chartTable = () => `<details class="td-chart-data"><summary>Consultar os dados do gráfico</summary><div class="td-table-scroll"><table><caption>Média da nota em relação ao valor da atividade; somente últimas tentativas corrigidas. Sem resultado significa ausência de amostra.</caption><thead><tr><th scope="col">Turma</th>${summary.chart.weeks.map(week=>`<th scope="col">${e(week.label)}</th>`).join('')}</tr></thead><tbody>${summary.chart.series.map(item=>`<tr><th scope="row">${e(item.label)}</th>${item.points.map(point=>`<td>${point.value===null?'Sem resultado':`${Math.round(point.value)}% · ${point.count} correções`}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  root.innerHTML = `<div class="td-shell">
    <header class="td-header"><button type="button" class="td-icon-button" data-teacher-sidebar-toggle aria-label="Fechar menu principal" aria-expanded="true" aria-controls="teacher-sidebar">${icon('menu')}</button><a class="td-brand" href="../dashboard/index.html">${icon('menu_book')}<strong>OminiSaber</strong></a><div class="td-account-actions"><button type="button" class="td-icon-button td-bell" data-dashboard-notifications aria-label="Notificações${unread?`, ${unread} não lidas`:''}">${icon('notifications')}${unread?'<i aria-hidden="true"></i>':''}</button><button type="button" class="td-icon-button" data-dashboard-help aria-label="Como usar o painel">${icon('help')}</button><a class="td-account" aria-label="Perfil de ${e(profile)}" href="../../perfil/index.html"><span class="td-avatar" aria-hidden="true">${e(initials)}</span><span><strong data-portal-profile>${e(profile)}</strong><small>${e(config.short)}</small></span>${icon('expand_more')}</a></div></header>
    ${teacherSidebarMarkup({config, page:'dashboard', profile, studioRoute, escapeHtml:e})}
    <main class="td-main portal-main" id="conteudo-principal"><div data-portal-content><div class="td-page-title"><h1>Acompanhe as atividades das turmas</h1><a class="td-create-link" href="${route('create')}">${icon('add')}Criar atividade</a></div>
    <div class="td-main-grid"><section class="td-welcome td-surface" aria-labelledby="dashboard-welcome"><div class="td-welcome-copy"><h2 id="dashboard-welcome">Olá, Professor!</h2><p>Acompanhe suas turmas, atividades e correções de ${e(config.short)}.</p><div class="td-chart-heading"><strong>Desempenho nas atividades</strong><small>Últimas seis semanas</small></div>${chartMarkup()}${legend()}<button type="button" class="td-button td-primary" data-dashboard-evolution>Ver evolução das turmas${icon('arrow_forward')}</button></div><img class="td-welcome-image" src="/frontend/assets/dashboard/professora-boas-vindas.webp" width="640" height="640" alt="" decoding="async"></section>
    <section class="td-classes td-surface" id="dashboard-turmas" aria-labelledby="dashboard-classes"><h2 id="dashboard-classes">Acesso rápido às turmas</h2><p>Veja atividades, resultados e pendências de cada turma.</p><div class="td-class-list">${summary.classes.length?summary.classes.slice(0,4).map((item,index)=>`<a class="td-class-row td-class-${index%3}" href="${route('list',item.id)}"><span class="td-class-icon">${icon('groups')}</span><span><strong>${e(item.nome)}</strong><small>${item.activityCount} ${item.activityCount===1?'atividade':'atividades'}${item.serie?` · ${e(/^\d+$/.test(String(item.serie)) ? `${item.serie}º ano` : item.serie)}`:''}</small></span>${icon('chevron_right')}</a>`).join(''):`<div class="td-inline-empty">${icon('groups')}<strong>Nenhuma turma vinculada</strong><p>Seus vínculos escolares aparecerão aqui.</p></div>`}</div><p class="td-class-total">${summary.classes.length} ${summary.classes.length===1?'turma vinculada':'turmas vinculadas'} · ${summary.studentCount} alunos</p>${summary.classes.length>4?`<a class="td-text-link" href="${route()}">Ver todas as turmas ${icon('arrow_forward')}</a>`:''}</section></div>
    <div class="td-operation-grid"><section class="td-operation td-surface"><div class="td-card-heading"><span class="td-status-icon td-red">${icon('description')}</span><h2>${reviewsUnknown?'Correções indisponíveis':summary.pending.total?`${summary.pending.total} ${summary.pending.total===1?'entrega para corrigir':'entregas para corrigir'}`:'Correções em dia'}</h2></div><p>${reviewsUnknown?'Uma parte das correções não pôde ser carregada.':summary.pending.total?'Avaliações, oficinas e redações aguardando sua devolutiva.':'Nenhuma entrega está aguardando sua revisão.'}</p><a class="td-button td-primary" href="${e(reviewHref)}">Revisar entregas${icon('arrow_forward')}</a><a class="td-button td-secondary" href="${route('create')}&copiloto=1">${icon('auto_awesome')}Planejar com o Copiloto</a></section>
    <section class="td-operation td-surface"><div class="td-card-heading"><span class="td-status-icon td-amber">${icon('groups')}</span><h2>${extras.resultsUnavailable?'Apoio: dados incompletos':summary.assessedStudents?`${summary.support.length} ${summary.support.length===1?'aluno precisa':'alunos precisam'} de apoio`:'Ainda sem resultados'}</h2></div><p>${extras.resultsUnavailable?'Não é possível concluir o panorama com os dados disponíveis.':summary.assessedStudents?`Triagem abaixo de 60% na última correção disponível entre as avaliações consultadas. Amostra de ${summary.assessedStudents} alunos.`:'As correções vão ajudar a identificar quem precisa de uma nova prática.'}</p><button type="button" class="td-text-link" data-dashboard-support>${summary.assessedStudents?'Ver alunos':'Como acompanhar'}${icon('chevron_right')}</button></section>
    <section class="td-operation td-surface"><div class="td-card-heading"><span class="td-status-icon td-blue">${icon('calendar_month')}</span><h2>Próxima entrega</h2></div><p>${next?`${e(next.titulo)}${nextClass?` · ${e(nextClass.nome)}`:''}`:'Nenhum prazo de entrega agendado.'}</p>${next?`<div class="td-deadline">${icon('event')}<span><strong>${e(fullDate(next.deadline))}</strong><small>${e(dashboardDeadlineLabel(next.deadline,now))}</small></span></div>`:'<div class="td-deadline td-deadline-empty"><span>Prepare uma atividade e defina o prazo para a turma.</span></div>'}<a class="td-text-link" href="${next?next.kind==='lab'?'../laboratorio/index.html':route('list',next.turma_id,next.id):route('create')}">${next?'Ver detalhes':'Preparar atividade'}${icon('chevron_right')}</a></section>
    <section class="td-operation td-reminders td-surface"><div class="td-card-heading"><span class="td-status-icon td-green">${icon('notifications')}</span><h2>Lembretes do OminiSaber</h2></div><div class="td-reminder-note">${icon(summary.dueSoon.length?'schedule':'task_alt')}<div><strong>${summary.dueSoon.length?'Prazos se aproximando':'Sua rotina organizada'}</strong><p>${summary.dueSoon.length?`${summary.dueSoon.length} ${summary.dueSoon.length===1?'atividade tem':'atividades têm'} prazo nos próximos cinco dias.`:summary.drafts?`${summary.drafts} ${summary.drafts===1?'rascunho pode':'rascunhos podem'} ser preparado para a próxima aula.`:'Não há entregas com prazo nos próximos cinco dias.'}</p></div></div><a class="td-text-link" href="../../agenda/index.html">Ver agenda das turmas${icon('chevron_right')}</a></section></div>
    <div class="td-authoring-strip"><span>${icon('account_tree')}Crie percursos com prática e descoberta.</span><a href="${e(studioRoute)}">Abrir OminiStudio${icon('arrow_forward')}</a></div>
    <p class="td-data-note">Dados das turmas vinculadas · Atualizado em ${e(shortDate(now))}${extras.hasMoreResults?' · Resultados das 12 avaliações atualizadas mais recentemente':''}</p></div></main></div>`;
  document.body.classList.add('teacher-dashboard-ready');
  root.querySelector('[data-portal-signout]').addEventListener('click',async event=>{
    event.currentTarget.disabled=true;
    try {await api.signOut();} catch {event.currentTarget.disabled=false;}
  },{signal});
  const openDialog = (title,body,trigger) => {
    const dialog=document.createElement('dialog'); dialog.className='td-dialog';
    dialog.setAttribute('aria-labelledby','td-dialog-title');
    dialog.innerHTML=`<header><h2 id="td-dialog-title">${e(title)}</h2><button type="button" class="td-icon-button" aria-label="Fechar janela">${icon('close')}</button></header><div class="td-dialog-content">${body}</div>`;
    document.body.append(dialog); dialog.querySelector('header button').onclick=()=>dialog.close();
    dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
    dialog.addEventListener('close',()=>{dialog.remove();trigger?.focus({preventScroll:true});},{once:true});
    dialog.showModal(); return dialog;
  };
  const observers=[];
  const mountCharts=(scope)=>{
    const mounted=[];
    scope.querySelectorAll('[data-dashboard-chart]').forEach(canvas=>{
      const draw=()=>drawDashboardChart(canvas,summary.chart,scope.querySelector('[data-chart-class]')?.value||'');
      const observer=new ResizeObserver(draw);observer.observe(canvas);observers.push(observer);draw();
      mounted.push(observer);
      scope.querySelector('[data-chart-class]')?.addEventListener('change',draw);
    });
    return mounted;
  };
  signal.addEventListener('abort',()=>observers.forEach(observer=>observer.disconnect()),{once:true});
  mountCharts(root);
  root.querySelector('[data-dashboard-evolution]').addEventListener('click',event=>{
    const dialog=openDialog('Evolução das turmas',`<p>Média percentual das últimas tentativas corrigidas, nas últimas seis semanas. Períodos sem amostra não são ligados no gráfico.</p>${extras.resultsUnavailable?'<p role="status">Uma parte dos resultados não pôde ser carregada.</p>':''}${summary.chart.count?`<label class="td-chart-filter">Turma<select data-chart-class><option value="">Todas as turmas</option>${summary.chart.series.map(item=>`<option value="${e(item.id)}">${e(item.label)}</option>`).join('')}</select></label>`:''}${chartMarkup(true)}${legend()}${summary.chart.count?chartTable():''}<a class="td-button td-secondary" href="${route('results')}">Abrir acompanhamento${icon('arrow_forward')}</a>`,event.currentTarget);
    const dialogObservers=mountCharts(dialog);
    dialog.addEventListener('close',()=>dialogObservers.forEach(observer=>observer.disconnect()),{once:true});
  },{signal});
  root.querySelector('[data-dashboard-support]').addEventListener('click',event=>{
    openDialog('Apoio à aprendizagem',`${extras.resultsUnavailable?'<p role="status">Os resultados estão incompletos. Consulte o acompanhamento antes de decidir uma intervenção.</p>':''}<p>Esta triagem usa a última correção disponível por aluno entre as avaliações consultadas, com resultado abaixo de 60%. A correção pode ser anterior às seis semanas do gráfico. Considere o contexto e a evolução de cada aluno antes de decidir uma nova prática.</p>${summary.assessedStudents?`<p>${summary.assessedStudents} alunos com resultados corrigidos disponíveis.${extras.hasMoreResults?' A consulta inclui as 12 avaliações atualizadas mais recentemente com resultados corrigidos.':''}</p><div class="td-support-list">${summary.support.map(item=>`<article><div><strong>${e(item.aluno_nome||'Aluno')}</strong><p>${e(item.evaluation.titulo)} · ${Math.round(item.percentage)}%</p></div><a class="td-text-link" href="${route('results',item.evaluation.turma_id,item.evaluation.id)}">Acompanhar${icon('arrow_forward')}</a></article>`).join('')||'<p>Nenhum último resultado corrigido está abaixo desse corte.</p>'}</div>`:'<p>Primeiro aplique uma atividade e finalize as correções. As evidências disponíveis aparecerão aqui.</p>'}<a class="td-button td-secondary" href="${route('results')}">Abrir resultados${icon('arrow_forward')}</a>`,event.currentTarget);
  },{signal});
  root.querySelector('[data-dashboard-notifications]').addEventListener('click',event=>{
    openDialog('Notificações',extras.notificationsUnavailable?'<p role="alert">Não foi possível carregar os avisos. Tente atualizar o painel.</p>':`<div class="td-notifications">${extras.notifications.slice(0,12).map(item=>`<article><strong>${e(item.titulo||'Aviso da escola')}</strong><p>${e(item.mensagem||item.conteudo||'Consulte a agenda para mais detalhes.')}</p>${item.created_at?`<small>${e(shortDate(item.created_at))}</small>`:''}</article>`).join('')||'<p>Nenhum aviso por aqui. Os próximos comunicados aparecerão nesta área.</p>'}</div><a class="td-button td-secondary" href="../../agenda/index.html">Consultar agenda${icon('arrow_forward')}</a>`,event.currentTarget);
  },{signal});
  root.querySelector('[data-dashboard-help]').addEventListener('click',event=>{
    openDialog('Seu painel, em três passos',`<ol class="td-help-list"><li><strong>Acompanhe suas turmas</strong><p>Abra uma turma para ver suas atividades. O gráfico mostra resultados depois das correções.</p></li><li><strong>Dê retorno aos alunos</strong><p>Use Revisar entregas para finalizar correções e orientar a próxima tentativa.</p></li><li><strong>Prepare a próxima prática</strong><p>Crie uma atividade ou abra o OminiStudio para montar um percurso interativo. O Copiloto ajuda na preparação.</p></li></ol><a class="td-button td-primary" href="${route('create')}">Criar atividade${icon('arrow_forward')}</a>`,event.currentTarget);
  },{signal});
}
