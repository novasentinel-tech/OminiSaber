import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const teacher = '10000000-0000-0000-0000-000000000001';
const otherTeacher = '10000000-0000-0000-0000-000000000002';
const student = '20000000-0000-0000-0000-000000000001';
const otherStudent = '20000000-0000-0000-0000-000000000002';
const classroom = '30000000-0000-0000-0000-000000000001';
const otherClassroom = '30000000-0000-0000-0000-000000000002';
const makeBlock = (id,type,extra={}) => ({id,type,title:id,instructions:`Orientações de ${id}`,points:0,...extra});
const choice = makeBlock('choice','choice',{points:2,options:['Primeira','Segunda'],correct:1});
const number = makeBlock('number','number',{points:2,min:6,max:8});
const decision = makeBlock('decision','decision',{source:'number',min:6,max:8});
const work = {version:1,title:'Investigação de teste',start:'intro',blocks:[
  makeBlock('intro','content',{advanceRule:{required:true,prompt:'Li as orientações'}}),number,decision,
  choice,makeBlock('open','text',{points:4,rubric:'Justificar com evidências'}),makeBlock('finish','content'),
],edges:[{source:'intro',target:'number'},{source:'number',target:'decision'},
  {source:'decision',target:'choice',sourceHandle:'yes'},{source:'decision',target:'open',sourceHandle:'no'},
  {source:'choice',target:'finish'},{source:'open',target:'finish'}]};

// Apenas o núcleo necessário à integração, com as mesmas tabelas, papéis e RLS.
// Nenhuma credencial, rede ou banco Supabase participa deste teste.
const bootstrap = `
create role anon; create role authenticated; create role service_role;
create schema auth; create schema private;
create type public.perfil_role as enum ('aluno','professor','gestor');
create type public.materia_aluno as enum ('portugues','matematica');
create table public.turmas(id uuid primary key,nome text,serie text,ano_letivo integer);
create table public.perfis(id uuid primary key,nome text,role public.perfil_role,turma_id uuid,tipo_professor text);
create table public.professor_turma_materias(professor_id uuid,turma_id uuid,materia_codigo public.materia_aluno,ativo boolean default true);
create table public.notificacoes(id uuid default gen_random_uuid() primary key,titulo text,mensagem text,tipo text,
  prioridade text,destino_turma_id uuid,criado_por uuid,link text,expira_em timestamptz,updated_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create function public.usuario_role() returns public.perfil_role language sql stable security definer as $$
  select role from public.perfis where id = auth.uid();
$$;
create function public.usuario_turma_id() returns uuid language sql stable security definer as $$
  select turma_id from public.perfis where id = auth.uid();
$$;
grant usage on schema auth to authenticated,anon;
grant select on public.perfis,public.professor_turma_materias to authenticated;
insert into public.turmas values('${classroom}','Turma de teste','2ª série',2026),('${otherClassroom}','Outra turma','2ª série',2026);
insert into public.perfis values('${teacher}','Professor de teste','professor',null,'portugues'),
  ('${otherTeacher}','Outro professor','professor',null,'matematica'),
  ('${student}','Aluno sintético','aluno','${classroom}',null),('${otherStudent}','Outro aluno sintético','aluno','${otherClassroom}',null);
insert into public.professor_turma_materias values('${teacher}','${classroom}','portugues',true),
  ('${otherTeacher}','${otherClassroom}','matematica',true);
`;

test('OmniStudio executa publicação, percurso, entrega e devolutiva em PostgreSQL local', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(bootstrap);
  for (const name of ['20260926120000_oministudio_persistencia_rls.sql','20261003_omnistudio_fluxo_integrado.sql','20261003_omnistudio_matematica.sql']) {
    await db.exec(await fs.readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
  }
  const actor = async (id,role='authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id || '']);
    await db.exec(`set role ${role}`);
  };
  const rpc = async (name,params=[]) => {
    const result = await db.query(`select public.${name}(${params.map((_,i)=>`$${i+1}`).join(',')}) as data`,params);
    return result.rows[0].data;
  };
  const create = async (draft,subject='portugues') => {
    const result = await db.query('insert into public.studio_experiencias(professor_id,materia_codigo,titulo,rascunho) values($1,$2,$3,$4) returning id',
      [teacher,subject,draft.title,JSON.stringify(draft)]);
    return result.rows[0].id;
  };
  const save = (attempt,id,answer,confirmed=false) => rpc('salvar_resposta_studio',[attempt,id,JSON.stringify(answer),confirmed]);
  let id; let attempt;

  await t.test('publicação valida disciplina, conexões e ciclo; notifica a turma', async () => {
    await actor(teacher);
    await assert.rejects(()=>create(work,'matematica'),/row-level security/);
    id = await create(work);
    await assert.rejects(()=>rpc('publicar_experiencia_studio',[id,[otherClassroom],null,null]),/vinculo ativo/);
    await db.query('update public.studio_experiencias set rascunho=$2 where id=$1',[id,JSON.stringify({...work,edges:[...work.edges,{source:'finish',target:'intro'}]})]);
    await assert.rejects(()=>rpc('publicar_experiencia_studio',[id,[classroom],null,null]),/circulares/);
    await db.query('update public.studio_experiencias set rascunho=$2 where id=$1',[id,JSON.stringify(work)]);
    const published = await rpc('publicar_experiencia_studio',[id,[classroom,classroom],null,null]);
    assert.equal(published.versao,1);
    await assert.rejects(()=>db.query("update public.studio_experiencias set versao_atual=999 where id=$1",[id]),/permission denied/);
    await actor(teacher,'service_role');
    await db.exec('reset role');
    const notices = await db.query('select link from public.notificacoes where studio_experiencia_id=$1',[id]);
    assert.equal(notices.rows.length,1);
    assert.match(notices.rows[0].link,/\?studio=/);
  });

  await t.test('catálogo, snapshot seguro e idempotência da tentativa', async () => {
    await actor(student);
    const catalog = await rpc('listar_experiencias_aluno_studio');
    assert.equal(catalog.length,1); assert.equal(catalog[0].titulo,work.title);
    const published = await rpc('obter_experiencia_publicada_studio',[id]);
    assert.equal(published.work.blocks.find(b=>b.id==='choice').correct,undefined);
    assert.equal(published.work.blocks.find(b=>b.id==='number').min,undefined);
    assert.equal(published.work.blocks.find(b=>b.id==='open').rubric,undefined);
    const first = await rpc('iniciar_tentativa_studio',[id]);
    attempt = first.tentativa_id;
    const second = await rpc('iniciar_tentativa_studio',[id]);
    assert.equal(second.tentativa_id,attempt); assert.equal(second.numero,1); assert.equal(second.retomada,true);
  });

  await t.test('envio parcial, confirmações e gabarito antecipado são bloqueados', async () => {
    await assert.rejects(()=>rpc('enviar_tentativa_studio',[attempt]),/todas as etapas/);
    await save(attempt,'intro',{viewed:true});
    await assert.rejects(()=>rpc('resolver_proximo_bloco_studio',[attempt,'intro']),/confirmacao obrigatoria/);
    await save(attempt,'intro',{viewed:true},true);
    assert.equal((await rpc('resolver_proximo_bloco_studio',[attempt,'intro'])).nextBlockId,'number');
    const saved = await save(attempt,'number',7);
    assert.equal(saved.correta,undefined); assert.equal(saved.pontos,undefined);
    const snapshot = await rpc('obter_experiencia_tentativa_studio',[attempt]);
    assert.equal(snapshot.tentativa.studio_respostas.find(r=>r.bloco_id==='number').correta,undefined);
    assert.equal((await rpc('resolver_proximo_bloco_studio',[attempt,'decision'])).nextBlockId,'choice');
    await assert.rejects(()=>save(attempt,'open','Tentativa fora do caminho'),/percurso atual/);
    await save(attempt,'number','-');
    await assert.rejects(()=>rpc('resolver_proximo_bloco_studio',[attempt,'number']),/Conclua a etapa/);
    await save(attempt,'number',null);
    await assert.rejects(()=>rpc('enviar_tentativa_studio',[attempt]),/todas as etapas/);
    await save(attempt,'number',7);
  });

  await t.test('alterar resposta recalcula caminho e descarta evidências do ramo abandonado', async () => {
    await save(attempt,'choice',1);
    await save(attempt,'number',4);
    const snapshot = await rpc('obter_experiencia_tentativa_studio',[attempt]);
    assert.equal(snapshot.tentativa.studio_respostas.some(r=>r.bloco_id==='choice'),false);
    assert.equal((await rpc('resolver_proximo_bloco_studio',[attempt,'decision'])).nextBlockId,'open');
    await save(attempt,'open','O valor observado precisa de investigação.');
    await save(attempt,'finish',{viewed:true});
    await actor(teacher);
    const responses = await db.query('select id from public.studio_respostas where tentativa_id=$1 and bloco_id=$2',[attempt,'open']);
    await assert.rejects(()=>rpc('corrigir_resposta_studio',[responses.rows[0].id,3,'Boa análise']),/Aguarde o envio/);
    await actor(student);
    const submitted = await rpc('enviar_tentativa_studio',[attempt]);
    assert.equal(submitted.status,'enviada'); assert.equal(submitted.requer_revisao,true); assert.equal(submitted.pontos_maximos,6);
    await assert.rejects(()=>save(attempt,'number',7),/periodo.*encerrou/);
    await assert.rejects(()=>rpc('iniciar_tentativa_studio',[id]),/Aguarde a devolutiva/);
    assert.equal((await rpc('enviar_tentativa_studio',[attempt])).status,'enviada');
  });

  await t.test('professor corrige via RPC; aluno recebe devolutiva sem editar nota', async () => {
    await actor(teacher);
    // A relação real passa pela FK composta de tentativa → versão → experiência.
    const queue = await db.query(`select r.id,r.bloco_id,t.versao,e.titulo,ev.snapshot
      from public.studio_respostas r join public.studio_tentativas t on t.id=r.tentativa_id
      join public.studio_experiencia_versoes ev on ev.experiencia_id=t.experiencia_id and ev.versao=t.versao
      join public.studio_experiencias e on e.id=ev.experiencia_id
      where r.status_correcao='revisao' and t.status<>'em_andamento' and e.professor_id=$1 and e.materia_codigo='portugues'`,[teacher]);
    assert.equal(queue.rows.length,1); assert.equal(queue.rows[0].versao,1);
    assert.equal(queue.rows[0].snapshot.blocks.find(b=>b.id===queue.rows[0].bloco_id).rubric,'Justificar com evidências');
    const response = (await db.query('select id from public.studio_respostas where tentativa_id=$1 and bloco_id=$2',[attempt,'open'])).rows[0];
    await assert.rejects(()=>db.query('update public.studio_respostas set pontos_manuais=999 where id=$1',[response.id]),/permission denied/);
    await assert.rejects(()=>rpc('corrigir_resposta_studio',[response.id,5,'Excesso']),/intervalo permitido/);
    const graded = await rpc('corrigir_resposta_studio',[response.id,3,'Use outra evidência para justificar.']);
    assert.equal(graded.pendentes,0);
    await actor(student);
    const result = await rpc('obter_experiencia_tentativa_studio',[attempt]);
    assert.equal(result.tentativa.status,'corrigida'); assert.equal(Number(result.tentativa.pontuacao_manual),3);
    assert.equal(result.tentativa.studio_respostas.find(r=>r.bloco_id==='open').feedback,'Use outra evidência para justificar.');
  });

  await t.test('outra turma, outro professor e anônimo não acessam a execução', async () => {
    await actor(otherStudent);
    assert.deepEqual(await rpc('listar_experiencias_aluno_studio'),[]);
    await assert.rejects(()=>rpc('obter_experiencia_tentativa_studio',[attempt]),/indisponivel/);
    await assert.rejects(()=>rpc('iniciar_tentativa_studio',[id]),/indisponivel/);
    await actor(otherTeacher);
    assert.equal((await db.query('select * from public.studio_experiencias where id=$1',[id])).rows.length,0);
    assert.equal((await db.query('select * from public.studio_experiencia_versoes where experiencia_id=$1',[id])).rows.length,0);
    await actor(teacher);
    const privateWork = (await db.query('select snapshot from public.studio_experiencia_versoes where experiencia_id=$1',[id])).rows[0].snapshot;
    assert.equal(privateWork.blocks.find(b=>b.id==='choice').correct,1);
    await actor(student);
    assert.equal((await db.query('select * from public.studio_experiencia_versoes where experiencia_id=$1',[id])).rows.length,0);
    await actor(null,'anon');
    await assert.rejects(()=>rpc('listar_experiencias_aluno_studio'),/permission denied/);
  });

  await t.test('ordenação e associação usam índices públicos e correção privada', async () => {
    await actor(teacher);
    const interactionWork = {version:1,title:'Interações de teste',start:'order',blocks:[
      makeBlock('order','ordering',{points:2,items:'Planejar\nExecutar\nRevisar'}),
      makeBlock('match','matching',{points:3,items:'Causa | Origem\nEfeito | Consequência\nEvidência | Prova'}),
      makeBlock('balance','balance',{points:2,expression:'H2 + O2 → H2O',rubric:'Conservar os átomos'}),
    ],edges:[{source:'order',target:'match'},{source:'match',target:'balance'}]};
    const interaction = await create(interactionWork);
    await rpc('publicar_experiencia_studio',[interaction,[classroom],null,null]);
    await actor(student);
    const published = await rpc('obter_experiencia_publicada_studio',[interaction]);
    const order = published.work.blocks.find(b=>b.id==='order');
    const matching = published.work.blocks.find(b=>b.id==='match');
    assert.equal(order._order,undefined); assert.equal(matching._rightOrder,undefined);
    assert.equal(matching.items.includes('|'),false);
    const interactionAttempt = (await rpc('iniciar_tentativa_studio',[interaction])).tentativa_id;
    await save(interactionAttempt,'order',{order:[0,0,1]});
    await assert.rejects(()=>rpc('resolver_proximo_bloco_studio',[interactionAttempt,'order']),/Conclua a etapa/);
    const publicItems = order.items.split('\n');
    await save(interactionAttempt,'order',{order:['Planejar','Executar','Revisar'].map(label=>publicItems.indexOf(label))});
    await save(interactionAttempt,'match',{matches:Object.fromEntries(['Origem','Consequência','Prova'].map((label,i)=>[i,matching.rightItems.indexOf(label)]))});
    await save(interactionAttempt,'balance','2H2 + O2 → 2H2O');
    const submitted = await rpc('enviar_tentativa_studio',[interactionAttempt]);
    assert.equal(Number(submitted.pontuacao_automatica),5); assert.equal(submitted.requer_revisao,true);
  });

  await t.test('uma republicação mantém a versão da tentativa e prazo é conferido no servidor', async () => {
    await actor(student);
    const secondAttempt = (await rpc('iniciar_tentativa_studio',[id])).tentativa_id;
    await save(secondAttempt,'intro',{viewed:true},true);
    await actor(teacher);
    await db.query('update public.studio_experiencias set rascunho=$2 where id=$1',[id,JSON.stringify({...work,title:'Nova versão'})]);
    await rpc('publicar_experiencia_studio',[id,[classroom],null,null]);
    await actor(student);
    const loaded = await rpc('obter_experiencia_publicada_studio',[id]);
    assert.equal(loaded.versao,1); assert.equal(loaded.work.title,work.title);
    assert.equal((await rpc('listar_experiencias_aluno_studio')).find(item=>item.id===id).versao,1);
    await db.exec('reset role');
    await db.query("update public.studio_experiencia_turmas set encerra_em=now()-interval '1 minute' where experiencia_id=$1 and versao=1",[id]);
    await actor(student);
    await assert.rejects(()=>save(secondAttempt,'number',7),/periodo.*encerrou/);
    await assert.rejects(()=>rpc('enviar_tentativa_studio',[secondAttempt]),/periodo.*encerrou/);
    assert.equal((await rpc('obter_experiencia_tentativa_studio',[attempt])).tentativa.status,'corrigida');
    assert.equal((await rpc('listar_experiencias_aluno_studio')).find(item=>item.id===id).versao,2);
    const renewed = await rpc('iniciar_tentativa_studio',[id]);
    assert.equal(renewed.versao,2); assert.notEqual(renewed.tentativa_id,secondAttempt);
  });

  await t.test('explorações, limite de tentativas e nova versão concluída seguem um só contrato', async () => {
    await actor(teacher);
    const explorers = ['image','formula','graph','table','chemistry','periodic','molecule','flourish'];
    const exploration = {version:1,title:'Exploração multimídia',start:'image',blocks:explorers.map(type=>makeBlock(type,type,
      type==='image'?{url:'https://example.com/diagrama.png',alt:'Diagrama de investigação'}:
        type==='flourish'?{url:'https://public.flourish.studio/visualisation/123/',summary:'Comparação dos valores'}:
          ['formula','graph','chemistry'].includes(type)?{expression:type==='chemistry'?'H2O':'2*x+1'}:
            type==='table'?{columns:'A,B',rows:'1,2\n3,4'}:{})),
      edges:explorers.slice(0,-1).map((source,i)=>({source,target:explorers[i+1]}))};
    const expId = await create(exploration);
    await db.query('update public.studio_experiencias set tentativas_permitidas=1 where id=$1',[expId]);
    await rpc('publicar_experiencia_studio',[expId,[classroom],null,null]);
    await actor(student);
    const expAttempt = (await rpc('iniciar_tentativa_studio',[expId])).tentativa_id;
    for (const type of explorers) await save(expAttempt,type,{viewed:true});
    assert.equal((await rpc('enviar_tentativa_studio',[expAttempt])).status,'corrigida');
    await assert.rejects(()=>rpc('iniciar_tentativa_studio',[expId]),/Limite de tentativas/);
    await actor(teacher);
    await db.query('update public.studio_experiencias set rascunho=$2 where id=$1',[expId,JSON.stringify({...exploration,title:'Exploração revista'})]);
    await rpc('publicar_experiencia_studio',[expId,[classroom],null,null]);
    await actor(student);
    const newest = (await rpc('listar_experiencias_aluno_studio')).find(item=>item.id===expId);
    assert.equal(newest.versao,2); assert.equal(newest.titulo,'Exploração revista'); assert.equal(newest.ultima_tentativa,null);
    assert.equal((await rpc('iniciar_tentativa_studio',[expId])).versao,2);
  });

  await t.test('fórmulas e parâmetros chegam ao aluno sem revelar os critérios privados', async () => {
    await actor(teacher);
    const mathWork = {version:1,title:'Exploração matemática',start:'graph',blocks:[
      makeBlock('graph','graph',{expression:'f(x)=a*x^2+b',
        graphSettings:{xMin:-4,xMax:4,yMin:-5,yMax:15,autoY:false,showTable:true,variables:{a:2,b:3}},
        mathExpression:'\\frac{12}{3}+x^2',mathVariables:{x:2},solutionSteps:'Substitua $x=2$ e calcule a potência.'}),
      makeBlock('math-answer','number',{points:2,min:7.5,max:8.5,
        mathExpression:'3^2-1',mathVariables:{},solutionSteps:'Resolva a potência antes da subtração.'}),
    ],edges:[{source:'graph',target:'math-answer'}]};
    const mathId = await create(mathWork);
    await rpc('publicar_experiencia_studio',[mathId,[classroom],null,null]);
    await actor(student);
    const snapshot = (await rpc('obter_experiencia_publicada_studio',[mathId])).work;
    assert.deepEqual(snapshot.blocks[0].graphSettings,mathWork.blocks[0].graphSettings);
    assert.deepEqual(snapshot.blocks[0].mathVariables,{x:2});
    assert.equal(snapshot.blocks[0].mathExpression,mathWork.blocks[0].mathExpression);
    assert.equal(snapshot.blocks[0].solutionSteps,mathWork.blocks[0].solutionSteps);
    assert.equal(snapshot.blocks[1].min,undefined);
    assert.equal(snapshot.blocks[1].max,undefined);
    const mathAttempt = (await rpc('iniciar_tentativa_studio',[mathId])).tentativa_id;
    await save(mathAttempt,'graph',{viewed:true});
    await save(mathAttempt,'math-answer',8);
    assert.equal(Number((await rpc('enviar_tentativa_studio',[mathAttempt])).pontuacao_automatica),2);
  });

  await t.test('publicação rejeita configurações matemáticas malformadas e não amplia privilégios', async () => {
    await actor(teacher);
    const base = {version:1,title:'Contrato matemático',start:'one',blocks:[makeBlock('one','content')],edges:[]};
    const mathId = await create(base);
    const invalids = [
      {type:'formula',expression:42}, {type:'graph',expression:[]},
      {type:'formula',expression:'x'.repeat(2001)}, {type:'graph',expression:'x'.repeat(2001)},
      {type:'graph',expression:'x\nx^2\nx^3\nx^4'}, {type:'graph',expression:'x; x^2; x^3; x^4'},
      {mathExpression:42}, {mathExpression:'x'.repeat(2001)}, {solutionSteps:[]}, {solutionSteps:'x'.repeat(8001)},
      {mathVariables:[]}, {mathVariables:{aa:2}}, {mathVariables:{x:'2'}}, {mathVariables:{x:1000001}},
      {graphSettings:[]}, {graphSettings:{xMin:1,xMax:1}}, {graphSettings:{xMin:1,xMax:1.00001}},
      {graphSettings:{xMin:'-5'}}, {graphSettings:{yMax:1000001}}, {graphSettings:{autoY:'false'}},
      {graphSettings:{autoY:false,yMin:5,yMax:-5}}, {graphSettings:{variables:{constructor:1}}},
      {graphSettings:{variables:{a:null}}}, {graphSettings:{showTable:'true'}},
    ];
    for (const properties of invalids) {
      await db.query('update public.studio_experiencias set rascunho=$2 where id=$1',[mathId,JSON.stringify({...base,blocks:[{...base.blocks[0],...properties}]})]);
      await assert.rejects(()=>rpc('publicar_experiencia_studio',[mathId,[classroom],null,null]));
    }
    await assert.rejects(()=>db.query('select private.studio_validar_trabalho($1)',[JSON.stringify(base)]),/permission denied/);
    await assert.rejects(()=>db.query('select private.studio_validar_trabalho_base_integrado($1)',[JSON.stringify(base)]),/permission denied/);
    const comparison = {...base,blocks:[{...base.blocks[0],type:'graph',expression:'f(x)=x\ng(x)=x^2;h(x)=2x'}]};
    await db.query('update public.studio_experiencias set rascunho=$2 where id=$1',[mathId,JSON.stringify(comparison)]);
    assert.equal((await rpc('publicar_experiencia_studio',[mathId,[classroom],null,null])).versao,1);
    await actor(student);
    assert.equal((await rpc('obter_experiencia_publicada_studio',[mathId])).work.blocks[0].expression,comparison.blocks[0].expression);
    await actor(null,'anon');
    await assert.rejects(()=>db.query('select private.studio_validar_trabalho($1)',[JSON.stringify(base)]),/permission denied/);
  });
});
