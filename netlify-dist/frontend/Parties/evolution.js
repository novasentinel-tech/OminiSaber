(() => {
  "use strict";
  const page = document.body.dataset.evolutionPage;
  if (!page) return;
  const $ = (s) => document.querySelector(s);
  const content = $("[data-ev-content]");
  const status = $("[data-ev-state]");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const date = (s) => new Date(s).toLocaleDateString("pt-BR", {day:"numeric",month:"long",year:"numeric"});
  const key = (d) => [d.getFullYear(),d.getMonth(),d.getDate()].join("-");
  const icon = (name) => '<span class="material-symbols-outlined" aria-hidden="true">'+esc(name)+'</span>';
  const link = (href,text,primary=false) => '<a class="ev-button'+(primary?' primary':'')+'" href="'+href+'">'+text+'</a>';
  const empty = (text) => '<p class="ev-empty">'+text+'</p>';
  const finiteScore = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const score = (s) => finiteScore(s.desempenho) && Number(s.evidencias)>0 ? Math.max(0,Math.min(100,Number(s.desempenho))) : null;
  const label = (s) => s===null?"Sem evidência":s<60?"Precisa praticar":s<80?"Em desenvolvimento":"Bom domínio";
  let data, shown = 20;
  const intros = {
    overview:"Um olhar sobre sua jornada e espaço para o próximo passo.",
    performance:"Entenda suas habilidades a partir das respostas já corrigidas.",
    achievements:"Reconheça o que você construiu. Descubra os próximos marcos.",
    history:"Revisite seus passos, suas anotações e os registros de XP."
  };
  $("[data-ev-intro]").textContent = intros[page];
  const skillLink = (s) => "../atividades/index.html?materia="+encodeURIComponent(s.materia_codigo||"")+"&habilidade="+encodeURIComponent(s.habilidade_id||"");
  function levelCard() {
    const p=window.OminiSaberLevels.progressFor(data.xp.total);
    return '<section class="ev-card ev-level"><p class="ev-kicker">SEU NÍVEL ATUAL</p><div class="ev-level-name"><span class="ev-emblem">'+icon(p.current.icon)+'</span><div><small>Nível '+p.current.number+'</small><h2>'+esc(p.current.name)+'</h2></div></div><p>'+esc(p.current.description)+'</p><progress max="100" value="'+p.percentage+'" aria-label="Progresso para o próximo nível"></progress><div class="ev-meta"><strong>'+p.xp.toLocaleString("pt-BR")+' XP acumulados</strong><span>'+(p.next?p.remaining+' XP para '+esc(p.next.name):"Último nível alcançado")+'</span></div></section>';
  }
  function overview() {
    const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-6+i);return d;});
    const counts=days.map(d=>data.history.filter(h=>key(new Date(h.created_at))===key(d)).length);
    const since=days[0].getTime(), now=Date.now();
    const xp=data.xp.movements.filter(m=>new Date(m.created_at).getTime()>=since && new Date(m.created_at).getTime()<=now).reduce((n,m)=>n+Number(m.xp||0),0);
    const weak=data.performance.filter(s=>score(s)!==null && score(s)<80).sort((a,b)=>score(a)-score(b))[0];
    const latest=[...data.unlocked].sort((a,b)=>new Date(b.desbloqueado_em)-new Date(a.desbloqueado_em))[0];
    const medal=data.achievements.find(a=>String(a.id)===String(latest?.conquista_id));
    content.innerHTML='<div class="ev-grid"><div>'+levelCard()+'<section class="ev-card"><h2>Seu ritmo nesta semana</h2><p>Últimos 7 dias · registros de estudo, não uma contagem de atividades concluídas.</p><div class="ev-stats"><div class="ev-stat"><strong>'+counts.filter(Boolean).length+'</strong><span>dias com registros</span></div><div class="ev-stat"><strong>'+counts.reduce((a,b)=>a+b,0)+'</strong><span>registros de estudo</span></div><div class="ev-stat"><strong>'+xp+'</strong><span>XP no período</span></div></div><div class="ev-week">'+days.map((d,i)=>'<div class="ev-day"><b style="height:'+Math.max(22,counts[i]/Math.max(1,...counts)*95)+'px">'+counts[i]+'</b><span>'+d.toLocaleDateString("pt-BR",{weekday:"short"}).replace(".","")+'</span></div>').join("")+'</div>'+link("historico.html","Explorar meu histórico")+(data.history.length===200?'<p><small>Resumo limitado aos 200 registros mais recentes.</small></p>':"")+'</section></div><div><section class="ev-card"><p class="ev-kicker">PRÓXIMO PASSO</p><h2>'+(weak?"Uma habilidade para fortalecer":"Continue sua jornada")+'</h2><p>'+(weak?esc(weak.descricao)+' · '+Math.round(score(weak))+'% nas evidências corrigidas.':"Explore suas atividades. Quando houver respostas corrigidas, você encontrará aqui uma indicação baseada nos seus resultados.")+'</p>'+link(weak?skillLink(weak):"../atividades/index.html",weak?"Ver atividades relacionadas":"Acessar atividades",true)+'</section><section class="ev-card"><p class="ev-kicker">ÚLTIMA CONQUISTA</p><h2>'+esc(medal?.nome||"Seu próximo marco espera por você")+'</h2><p>'+esc(medal?medal.descricao:"Conheça os critérios das conquistas e avance no seu próprio ritmo.")+'</p>'+(medal?'<p><small>'+date(latest.desbloqueado_em)+'</small></p>':"")+link("conquistas.html","Explorar conquistas")+'</section>'+link("desempenho.html","Entender meu desempenho")+'</div></div>';
  }
  function performance() {
    const subjects=[...new Set(data.performance.map(s=>s.materia_codigo).filter(Boolean))];
    content.innerHTML='<section class="ev-card"><div class="ev-filters"><label>Matéria<select data-subject><option value="">Todas as matérias</option>'+subjects.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join("")+'</select></label><label>Situação<select data-situation><option value="">Todas as situações</option><option>Precisa praticar</option><option>Em desenvolvimento</option><option>Bom domínio</option><option>Sem evidência</option></select></label></div><p>Retrato atual das habilidades. Atividades pendentes não contam como dificuldade. A base atual não oferece uma série histórica por período.</p><div data-skills aria-live="polite"></div></section>';
    const render=()=>{
      const items=data.performance.filter(s=>(!$("[data-subject]").value||s.materia_codigo===$("[data-subject]").value)&&(!$("[data-situation]").value||label(score(s))===$("[data-situation]").value)).sort((a,b)=>(score(a)??101)-(score(b)??101));
      $("[data-skills]").innerHTML=items.length?items.map(s=>{const n=score(s);return '<article class="ev-row"><div><span class="ev-pill">'+label(n)+'</span><h3>'+esc(s.codigo)+'</h3><p>'+esc(s.descricao)+'</p><small>'+Number(s.evidencias||0)+' evidências corrigidas'+(n!==null?' · '+Math.round(n)+'% de aproveitamento':'')+'</small>'+(n!==null?'<progress max="100" value="'+n+'" aria-label="'+esc(s.codigo)+': '+Math.round(n)+'%"></progress>':"")+'</div>'+link(skillLink(s),"Ver atividades")+'</article>';}).join(""):empty("Nenhuma habilidade encontrada. Os resultados aparecem após a correção das questões vinculadas a descritores.");
    };
    $("[data-subject]").addEventListener("change",render);
    $("[data-situation]").addEventListener("change",render);render();
  }
  function achievements() {
    const p=window.OminiSaberLevels.progressFor(data.xp.total);
    content.innerHTML='<section class="ev-card"><h2>Seu caminho de níveis</h2><p>Os níveis são definidos pelo XP acumulado. Selecione um marco para conhecer seus critérios.</p><div class="ev-levels">'+window.OminiSaberLevels.levels.map(l=>'<button class="ev-button" data-level="'+l.number+'"'+(l.number===p.current.number?' aria-current="step"':'')+'>'+icon(l.icon)+' '+l.number+' · '+esc(l.name)+'</button>').join("")+'</div></section><section class="ev-card"><div class="ev-meta"><h2>Sua coleção</h2><strong>'+data.unlocked.length+' desbloqueadas</strong></div><div class="ev-filters"><label>Mostrar<select data-medal-filter><option value="all">Todas as conquistas</option><option value="yes">Conquistadas</option><option value="no">Ainda não conquistadas</option></select></label></div><div class="ev-gallery" data-medals aria-live="polite"></div></section>';
    const render=()=>{$("[data-medals]").innerHTML=data.achievements.filter(a=>{const u=data.unlocked.some(r=>String(r.conquista_id)===String(a.id));return $("[data-medal-filter]").value==="all"||u===($("[data-medal-filter]").value==="yes");}).map(a=>{const u=data.unlocked.find(r=>String(r.conquista_id)===String(a.id));return '<button class="ev-medal '+(u?"":"locked")+'" data-medal="'+esc(a.id)+'"><span class="ev-emblem">'+icon(u?a.icone||"workspace_premium":"lock")+'</span><strong>'+esc(a.nome)+'</strong><small>'+esc(u?a.descricao:a.requisito||"Critério ainda não informado.")+'</small><span class="ev-pill">'+(u?'Conquistada · '+date(u.desbloqueado_em):"Ainda não conquistada")+'</span></button>';}).join("")||empty("Nenhuma conquista neste filtro.");};
    $("[data-medal-filter]").addEventListener("change",render);render();
  }
  const events={abriu:"Conteúdo acessado",abriu_aula:"Aula acessada",iniciou_trilha:"Trilha iniciada",iniciou_atividade:"Atividade iniciada",concluiu_atividade:"Atividade concluída",concluiu_aula:"Aula concluída",concluiu:"Aula concluída",salvou:"Conteúdo salvo",removeu_salvo:"Conteúdo removido dos salvos",anotou:"Anotações atualizadas",iniciou:"Estudo iniciado"};
  function history() {
    content.innerHTML='<section class="ev-card"><div class="ev-filters"><label>Tipo de registro<select data-history-kind><option value="study">Estudo</option><option value="xp">Movimentações de XP</option></select></label><label>Período<select data-history-period><option value="0">Todos os registros disponíveis</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select></label></div><p data-history-note></p><ol class="ev-timeline" data-timeline aria-live="polite"></ol><button class="ev-button" data-more>Mostrar mais registros</button></section>';
    const render=()=>{
      const xp=$("[data-history-kind]").value==="xp", n=Number($("[data-history-period]").value);
      const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-Math.max(0,n-1));
      const rows=(xp?data.xp.movements:data.history).filter(r=>!n||new Date(r.created_at)>=start).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      $("[data-history-note]").textContent=xp?"Lançamentos de XP registrados na sua conta.":"Até 200 registros de estudo mais recentes. Acessos e anotações não significam conclusão.";
      let previous="";
      $("[data-timeline]").innerHTML=rows.slice(0,shown).map(r=>{
        const day=date(r.created_at), heading=day!==previous?'<li><h3>'+day+'</h3></li>':"";previous=day;
        const title=xp?r.descricao:events[r.evento]||String(r.evento||"Registro de estudo").replaceAll("_"," ");
        const href=r.atividades?.id?"../modulo_de_trilhas/aula/index.html?atividade="+encodeURIComponent(r.atividades.id):r.trilhas?.id?"../modulo_de_trilhas/trilha/index.html?trilha="+encodeURIComponent(r.trilhas.id):null;
        return heading+'<li class="ev-row"><div><time datetime="'+esc(r.created_at)+'">'+new Date(r.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+'</time><h3>'+esc(title)+'</h3><p>'+esc(xp?"":r.atividades?.titulo||r.trilhas?.titulo||"")+'</p></div>'+(xp?'<strong>'+(Number(r.xp)>0?"+":"")+Number(r.xp||0)+' XP</strong>':href?link(href,"Revisitar"):"")+'</li>';
      }).join("")||'<li class="ev-empty">Nenhum registro neste período.</li>';
      $("[data-more]").hidden=shown>=rows.length;
    };
    ["[data-history-kind]","[data-history-period]"].forEach(s=>$(s).addEventListener("change",()=>{shown=20;render();}));
    $("[data-more]").addEventListener("click",()=>{shown+=20;render();});render();
  }
  content.addEventListener("click",e=>{
    const medal=e.target.closest("[data-medal]"),level=e.target.closest("[data-level]");
    if(!medal&&!level)return;
    let title,description,detail;
    if(level){const l=window.OminiSaberLevels.levels.find(l=>l.number===Number(level.dataset.level));title=l.name;description=l.description;detail=l.requirement;}
    else {const a=data.achievements.find(a=>String(a.id)===medal.dataset.medal);title=a.nome;description=a.descricao;const u=data.unlocked.find(r=>String(r.conquista_id)===String(a.id));detail=(a.requisito||"Critério não informado.")+(u?" Conquistada em "+date(u.desbloqueado_em)+".":"")+" Recompensa cadastrada: "+Number(a.xp||0)+" XP.";}
    $("[data-ev-detail]").innerHTML='<h2 id="ev-detail-title">'+esc(title)+'</h2><p>'+esc(description)+'</p><p>'+esc(detail)+'</p>';
    $("[data-ev-dialog]").setAttribute("aria-labelledby","ev-detail-title");$("[data-ev-dialog]").showModal();
  });
  async function load(){
    status.hidden=false;status.textContent="Carregando seus registros…";content.hidden=true;$("[data-ev-retry]").hidden=true;
    try{
      const api=window.OminiSaber;if(!api?.configured)throw Error("A conexão de dados não está configurada.");
      const session=await api.getSession();if(!session){location.href="../../login/index.html";return;}
      const needAwards=["overview","achievements"].includes(page), needXp=page!=="performance",needHistory=["overview","history"].includes(page),needPerformance=["overview","performance"].includes(page);
      const [xp,historyRows,performanceRows,awards,unlocked]=await Promise.all([
        needXp?api.getStudyXp():null,
        needHistory?api.listStudyHistory({limit:200}):[],
        needPerformance?api.getStudentDescriptorPerformance():[],
        needAwards?api.client.from("conquistas").select("id,nome,descricao,requisito,categoria,xp,icone").order("created_at"):{data:[]},
        needAwards?api.client.from("conquistas_aluno").select("conquista_id,desbloqueado_em").eq("aluno_id",session.user.id):{data:[]}
      ]);
      if(awards.error)throw awards.error;if(unlocked.error)throw unlocked.error;
      data={xp,history:historyRows,performance:performanceRows,achievements:awards.data||[],unlocked:unlocked.data||[]};
      ({overview,performance,achievements,history}[page])();status.hidden=true;content.hidden=false;
    }catch(error){status.textContent="Não foi possível carregar esta página. "+(error.message||"Tente novamente.");$("[data-ev-retry]").hidden=false;}
  }
  $("[data-ev-retry]").addEventListener("click",load);load();
})();
