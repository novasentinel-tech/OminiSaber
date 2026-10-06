const escapeText = (value = '') => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

// Shared by the dashboard, teaching workspace, agenda and profile.
export function teacherSidebarMarkup({config, page, profile = 'Professor', studioRoute, base = '../', escapeHtml = escapeText}) {
  const e = escapeHtml;
  const route = name => `${base}${name}/index.html`;
  const link = (name, label, symbol, href, extra = '') => `<a class="${page === name ? 'active' : ''} ${extra}" href="${e(href)}"${page === name ? ' aria-current="page"' : ''}><span class="portal-nav-icon material-symbols-outlined" aria-hidden="true">${symbol}</span><span class="portal-nav-copy">${e(label)}</span></a>`;
  return `<aside class="portal-sidebar" id="teacher-sidebar" data-teacher-sidebar aria-label="Navegação do professor">
    <div class="portal-sidebar-branding"><a class="portal-brand" href="${e(route('dashboard'))}"><span class="portal-brand-mark material-symbols-outlined" aria-hidden="true">${config.icon}</span><span class="portal-brand-copy"><strong>OminiSaber</strong><small>Professor de ${e(config.short)}</small></span></a></div>
    <a class="portal-create" href="${e(route('avaliacoes'))}#view=create"><span class="material-symbols-outlined" aria-hidden="true">add</span><span>Criar atividade</span></a>
    <nav class="portal-nav" aria-label="Área do professor"><p class="portal-nav-label">Principal</p>
      ${link('dashboard', 'Início', 'home', route('dashboard'))}
      ${link('avaliacoes', 'Atividades', 'assignment', route('avaliacoes'))}
      ${link('laboratorio', config.labLabel, config.labIcon, route('laboratorio'))}
      ${config.type === 'portugues' ? link('redacoes', 'Redações', 'edit_note', route('redacoes')) : ''}
      <p class="portal-nav-label portal-nav-label-spaced">Ferramentas</p>
      <a class="portal-studio-link" href="${e(studioRoute)}"><span class="portal-nav-icon material-symbols-outlined" aria-hidden="true">account_tree</span><span class="portal-nav-copy">OminiStudio<small>Experiências interativas</small></span></a>
      ${link('agenda', 'Agenda das turmas', 'calendar_month', '/frontend/professor/agenda/index.html')}
    </nav>
    <div class="portal-sidebar-footer"><a class="portal-profile" href="/frontend/professor/perfil/index.html" aria-label="Abrir perfil e configurações"${page === 'perfil' ? ' aria-current="page"' : ''}><span class="portal-avatar material-symbols-outlined" aria-hidden="true">person</span><div><strong data-portal-profile>${e(profile)}</strong><small>${e(config.title)}</small></div><span class="portal-profile-action material-symbols-outlined" aria-hidden="true">settings</span></a><button class="portal-signout" type="button" data-portal-signout><span class="material-symbols-outlined" aria-hidden="true">logout</span><span>Sair</span></button></div>
  </aside>`;
}
