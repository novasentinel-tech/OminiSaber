(() => {
  const classes = [{id:'a',nome:'2º INFO 1',serie:2},{id:'b',nome:'2º ADM 1',serie:2}];
  const question = {id:'q1',ordem:1,tipo:'discursiva',enunciado:'Explique sua interpretação do texto.',pontos:10,gabaritos_avaliacao:{resposta_esperada:{value:'GABARITO_PRIVADO'}},questoes_avaliacao_habilidades:[]};
  const evaluations = [
    {id:'draft',titulo:'Avaliação em preparação',status:'rascunho',turma_id:'a',turmas:classes[0],trimestre:2,valor:10,questoes_avaliacao:[question]},
    {id:'published',titulo:'Leitura e interpretação',status:'publicado',turma_id:'a',turmas:classes[0],trimestre:2,valor:10,questoes_avaliacao:[question]},
    {id:'other',titulo:'Outra turma',status:'publicado',turma_id:'b',turmas:classes[1],trimestre:3,valor:10,questoes_avaliacao:[question]},
  ];
  const calls = [];
  const queueAttempt = {id:'attempt-local',avaliacao_id:'published',numero_tentativa:1,status:'enviada',requer_revisao:true,pontuacao_automatica:2,pontuacao_manual:0,enviada_em:'2026-09-29T10:00:00Z',perfis:{id:'student',nome:'Estudante fictício',matricula:'TESTE-LOCAL'},avaliacoes_docentes:{id:'published',titulo:'Leitura e interpretação',valor:10,turmas:classes[0]},respostas_avaliacao:[{id:'response-local',questao_id:'q1',resposta:'Minha interpretação do texto.',status_correcao:'revisao',pontos_automaticos:0,pontos_manuais:0,feedback:'',questoes_avaliacao:{...question,configuracao:{}}}]};
  const api = {
    listCurriculumSkills: async () => [],
    listTeacherReviewQueue: async options => {calls.push(['queue',options]);return [queueAttempt];},
    gradeTeacherEvaluationResponse: async payload => {calls.push(['grade',payload]);return {requer_revisao:false};},
    getTeacherEvaluationAnalytics: async id => {calls.push(['analytics',id]);return {avaliacao:evaluations.find(item=>item.id===id),metricas:{total_alunos:1,entregaram:1,media_turma:7},alunos:[{nome:'Estudante fictício com nome extenso para teste',matricula:'TESTE-LOCAL',status:'corrigida',tentativa_id:'teste-local',nota:7,pontuacao_automatica:3,pontuacao_manual:4}],descritores:[{id:'skill',codigo:'H1',descricao:'Habilidade sem respostas',evidencias:0,desempenho:0}]};},
    adjustTeacherEvaluationGrade: async () => {throw Error('Alteração de nota bloqueada no teste local.');},
    updateTeacherEvaluationStatus: async () => {throw Error('Publicação bloqueada no teste local.');},
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const context = {content:document.querySelector('#workspace'),data:{classes,evaluations},api,config:window.OMINI_TEACHER_CONFIGS.portugues,escapeHtml,formatDate:value=>value || 'Sem prazo',toast:()=>{},reload:()=>window.renderTeacherEvaluations(context)};
  const wait = () => new Promise(resolve=>setTimeout(resolve,30));
  const check = (condition,message) => {if(!condition)throw Error(message);results.push(`OK · ${message}`);};
  const results = [];
  const run = async () => {
    if (new URLSearchParams(location.search).has('test')) history.replaceState(null, '', location.pathname + location.search);
    await window.renderTeacherEvaluations(context);
    if (!new URLSearchParams(location.search).has('test')) return;
    check(document.querySelectorAll('.os-eval-card').length===3,'Listagem das avaliações');
    const filter=document.querySelector('[data-eval-class]');filter.value='a';filter.dispatchEvent(new Event('change'));await wait();
    check(document.querySelectorAll('.os-eval-card').length===2,'Filtro de turma');
    const search=document.querySelector('[data-eval-search]');search.value='interpretação';search.dispatchEvent(new Event('input'));
    check(document.querySelectorAll('.os-eval-card').length===1,'Busca por título');
    search.value='';search.dispatchEvent(new Event('input'));
    document.querySelector('[data-preview="draft"]').click();
    check(document.querySelector('dialog').open,'Revisão em janela acessível');
    check(!document.querySelector('dialog').textContent.includes('GABARITO_PRIVADO'),'Revisão sem gabarito');
    document.querySelector('[data-close]').click();await wait();
    document.querySelector('[data-results="published"]').click();await wait();
    check(calls.some(([kind,id])=>kind==='analytics'&&id==='published'),'Acompanhamento da avaliação escolhida');
    check(document.querySelector('.descriptor-result').textContent.includes('Sem evidências'),'Ausência de evidências não vira dificuldade');
    check(!document.querySelector('input[name="skills"]').checked,'Recuperação não pré-seleciona habilidade sem evidências');
    document.querySelector('[data-adjust-grade]').click();
    const gradeDialog=document.querySelector('[data-grade-dialog]');
    check(gradeDialog.open,'Janela de ajuste abre');
    gradeDialog.querySelector('.dialog-close').click();
    check(!gradeDialog.open,'Fechar ajuste não exige justificativa');
    document.querySelector('[data-adjust-grade]').click();
    gradeDialog.querySelector('[name="reason"]').value='Justificativa anterior de teste';
    gradeDialog.querySelector('.dialog-close').click();
    document.querySelector('[data-adjust-grade]').click();
    check(gradeDialog.querySelector('[name="reason"]').value==='','Reabrir ajuste limpa justificativa anterior');
    check(gradeDialog.getAttribute('aria-label')==='Ajustar nota do aluno','Janela de ajuste tem nome acessível');
    gradeDialog.querySelector('.dialog-close').click();
    document.querySelector('[data-eval-view="reviews"]').click();await wait();
    check(calls.some(([kind])=>kind==='queue'),'Fila de correção conectada');
    check(document.querySelector('.queue-overview')!==null,'Fila resume pendências antes da correção');
    check(document.querySelector('[data-queue-search]')!==null,'Fila permite buscar aluno ou atividade');
    check(document.querySelectorAll('.grade-shortcuts button').length===3,'Correção possui atalhos de pontuação');
    check(document.querySelector('.attempt-progress')!==null,'Entrega mostra progresso da revisão');
    document.querySelector('[data-eval-view="list"]').click();await wait();
    document.querySelector('[data-reviews="published"]').click();await wait();
    check(calls.some(([kind,options])=>kind==='queue'&&options.evaluationId==='published'),'Correção limitada à avaliação escolhida');
    document.querySelector('[data-eval-view="create"]').click();await wait();
    check(document.querySelector('[name="classId"]').value==='a','Turma preservada na criação');
    check(document.querySelectorAll('[data-step]').length===4,'Construtor com quatro etapas');
    document.querySelector('[data-eval-view="list"]').click();await wait();
    document.querySelector('#test-results').textContent=results.join('\n');
    document.querySelector('#test-results').style.whiteSpace='pre-line';
  };
  run().catch(error=>{document.querySelector('#test-results').textContent=`FALHOU: ${error.message}\n${results.join('\n')}`;});
})();
