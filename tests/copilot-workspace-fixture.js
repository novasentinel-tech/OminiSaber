(() => {
  'use strict';
  const query = new URLSearchParams(location.search);
  const scenario = query.get('scenario') || 'success';
  const calls = [];
  const classes = [{ id: 'fixture-class-a', nome: '2º A', serie: 2 }, { id: 'fixture-class-b', nome: '2º B', serie: 2 }];
  const profile = { id: 'fixture-teacher', nome: 'Prof. Fernanda', tipo_professor: 'portugues' };
  const text = 'Toda quinta-feira, depois do intervalo, a biblioteca da Escola Horizonte ganhava novas vozes. Era o encontro do Clube de Leitura, um grupo que começou pequeno e hoje reúne estudantes de diferentes turmas. Nas rodas de conversa, cada um trazia um olhar, uma história, uma pergunta. Para muitos, o clube se tornou o lugar onde as ideias ganham espaço.';
  const question = (title, number = 1) => ({
    type: 'unica_escolha', statement: title, points: 2,
    alternatives: ['Contar a origem e o crescimento de um clube de leitura na escola.','Convencer o leitor a participar de um clube de leitura.','Explicar as regras de funcionamento da biblioteca.'],
    answer: 'Contar a origem e o crescimento de um clube de leitura na escola.', explanation: 'Observe os fatos apresentados sobre o clube e sua história.', skillIds: [],
    configuration: { fixtureNumber: number },
  });
  const activity = (title = 'Leitura que transforma', offset = 0, count = 2) => ({
    title, instructions: text, duration: 20, value: 4,
    questions: [question('Qual é a intenção principal do texto?', offset+1), {
      type: 'dissertativa', statement: 'Que trecho do texto expressa uma opinião? Justifique sua escolha.', points: 2,
      alternatives: [], answer: 'GABARITO_PRIVADO_FIXTURE', explanation: 'Relacione sua justificativa às marcas de opinião no texto.', skillIds: [],
      configuration: {}, rubric: [{criterion:'Cita um trecho de opinião',points:1},{criterion:'Justifica com uma marca linguística',points:1}],
    }, ...Array.from({length: Math.max(0,count-2)},(_,index)=>question(['Qual evidência demonstra que o clube cresceu?','Como o autor apresenta a troca de ideias entre os estudantes?','Que conclusão pode ser sustentada com os fatos do texto?'][index] || `Compare a evidência ${offset+index+1} com a interpretação do texto.`,offset+index+3))].slice(0,count),
  });
  const idea = (title, number) => ({ id: 'idea-'+number, title, objective: 'Distinguir fatos e opiniões com evidências.', hook: 'Uma mesma notícia pode provocar leituras diferentes.', studentAction: 'Compare manchetes inventadas, discuta em dupla e defenda uma interpretação.', interaction: 'dialogo', duration: 20, difficulty: 'equilibrada', materials: ['Texto breve','Caderno'], evidence: 'Uma evidência textual e uma justificativa.', adaptations: ['Ofereça leitura compartilhada.'], teacherPrompt: 'Prepare uma atividade investigativa sobre fatos e opiniões, comparando duas manchetes e justificando com evidências.', skillIds: [] });
  const suggestion = (payload, number) => {
    const count = Number(payload.questionCount) || 5;
    const base = { summary: 'Criei uma proposta que combina leitura, escolhas e justificativas. Você pode ajustar antes de usar.', rationale: 'As perguntas avançam da compreensão para a interpretação com evidências.', activity: {...activity(number>1?'Leitura que transforma — versão ajustada':undefined,0,count), category:payload.category, secureExam:payload.secureExam, duration:payload.duration,value:payload.value} };
    if (payload.action === 'gerar_ideias') { base.ideas = [idea('Detetives de manchetes',1),idea('Dois olhares, um texto',2),idea('Oficina de argumentos',3)]; delete base.activity; }
    if (payload.action === 'gerar_trilha') base.trail = {
      title: 'De leitor a investigador', description: 'Um percurso de leitura crítica com aplicação em um texto novo.',
      steps: ['Observar','Comparar','Argumentar'].slice(0,Math.min(3,count)).map((title,i,array)=>({title,objective:['Identificar informações explícitas.','Distinguir fatos e opiniões.','Defender uma interpretação.'][i],phase:i===array.length-1?'transferencia':i?'pratica_guiada':'diagnostico',interaction:'lista',bridge:i?'Use as evidências da etapa anterior.':'Comece observando o texto.',activity:{...activity(title,i*2,Math.floor(count/array.length)+Number(i<count%array.length)),duration:10,value:Number((Number(payload.value)/array.length).toFixed(2))}})),
    };
    if (scenario === 'visuals' && base.activity) {
      base.activity.title = 'Funções, fórmulas e leitura de gráficos';
      base.activity.instructions = 'Explore $f(x)=ax+b$ e compare os recursos. Uma fração de apoio: $\\frac{3+5}{2}$.';
      base.activity.questions[0] = {
        ...base.activity.questions[0], type:'numerica', alternatives:[],
        statement:'Com $a=2$ e $b=1$, consulte o plano e calcule $f(2)$.', answer:'5',
        configuration:{resources:[
          {type:'graph',caption:'Mova os parâmetros e compare os pontos.',expressions:['a*x+b'],settings:{xMin:-5,xMax:5,yMin:-5,yMax:5,autoY:true,variables:{a:2,b:1}}},
          {type:'formula',caption:'Expressão da função',expression:'f(x)=ax+b'},
        ]},
      };
      base.activity.questions[1].configuration = {resources:[
        {type:'chart',caption:'Livros lidos por três grupos',chartType:'bar',xLabel:'Grupo',yLabel:'Livros',data:[{label:'A',value:4},{label:'B',value:7},{label:'C',value:5}]},
        {type:'figure',caption:'Compare as medidas',kind:'triangle',labels:['A','B','C'],values:[3,4,5],unit:'cm'},
        {type:'comic',caption:'Uma conversa para interpretar',panels:[{speaker:'Bia',text:'O grupo B leu mais livros.'},{speaker:'Caio',text:'Vou conferir os dados antes de concluir.'}]},
      ]};
    }
    if(base.trail){ const steps=base.trail.steps;steps.at(-1).activity.value=Number((Number(payload.value)-steps.slice(0,-1).reduce((sum,item)=>sum+item.activity.value,0)).toFixed(2));base.activity=steps[0].activity; }
    return base;
  };
  const capture = (name,result) => async (...args) => { calls.push({name,args:structuredClone(args)}); document.querySelector('[data-fixture-calls]').textContent=JSON.stringify(calls); return typeof result === 'function'?result(...args):structuredClone(result); };
  window.copilotFixture = { scenario,calls,errors:[],requestCount:0 };
  const fail = error => {const message=error?.message||String(error);window.copilotFixture.errors.push(message);const node=document.createElement('pre');node.className='fixture-error';node.textContent=message;document.body.append(node);};
  window.addEventListener('error',event=>fail(event.error||event.message));
  window.addEventListener('unhandledrejection',event=>fail(event.reason));
  window.OminiSaber = {
    configured:true,
    getProfile:capture('getProfile',profile),
    getTeacherWorkspace:capture('getTeacherWorkspace',{profile,classes,labs:[],evaluations:[],studentCount:0}),
    listCurriculumSkills:capture('listCurriculumSkills',[]),
    isFeatureEnabled:capture('isFeatureEnabled',true),
    listTeacherCopilotHistory:capture('listTeacherCopilotHistory',[]),
    sendTeacherCopilotFeedback:capture('sendTeacherCopilotFeedback',{}),
    requestTeacherCopilot:capture('requestTeacherCopilot',async payload=>{
      const number=++window.copilotFixture.requestCount;
      await new Promise(resolve=>setTimeout(resolve,scenario==='slow'?1600:120));
      if(scenario==='error' && number===1) throw new Error('Serviço temporariamente indisponível. Tente novamente.');
      if(scenario==='provider') throw new Error('Request contains an invalid argument.');
      if(scenario==='invalid') return {executionId:'fixture-'+number,suggestion:{summary:'Saída sem atividade válida.'}};
      return {executionId:'fixture-'+number,sessionId:'fixture-session',suggestion:suggestion(payload,number),contextSummary:{classes:[],skills:[],includesStudentPersonalData:false}};
    }),
    createTeacherEvaluation:capture('createTeacherEvaluation',payload=>{if(payload.publish)throw new Error('Publicação bloqueada no teste isolado.');return {id:'fixture-draft'};}),
    updateTeacherEvaluationStatus:async()=>{throw new Error('Publicação bloqueada no teste isolado.');},
  };
  const revision = Date.now();
  const fresh = src => src + (src.includes('?') ? '&' : '?') + 'fixture=' + revision;
  const script = src => new Promise((resolve,reject)=>{const node=document.createElement('script');node.src=fresh(src);node.onload=resolve;node.onerror=()=>reject(new Error('Não foi possível carregar '+src));document.head.append(node);});
  async function boot(){
    if(!location.hash)history.replaceState(null,'',location.pathname+location.search+'#view=create&turma=fixture-class-a');
    for(const file of ['activity-builder.css','teacher-copilot.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=fresh('../frontend/professor/specialty/'+file);document.head.append(link);}
    await script('../frontend/professor/specialty/configs.js');
    await script('../frontend/professor/specialty/teacher-copilot.js');
    await script('../frontend/professor/specialty/activity-builder.js');
    await script('../frontend/professor/specialty/portal.js?v=20261004-3');
    await script('../frontend/Parties/parties.js?v=20261004-1');
    // Reuse the production teacher shell tokens despite the isolated /tests/ URL.
    document.body.dataset.partyRole = 'teacher';
    document.body.classList.toggle('os-teacher-sidebar-collapsed', innerWidth > 900);
    document.querySelector('.portal-sidebar')?.classList.add('os-teacher-sidebar');
    document.dispatchEvent(new CustomEvent('ominisaber:ready',{detail:{session:{user:{id:profile.id}}}}));
  }
  boot().catch(fail);
})();
