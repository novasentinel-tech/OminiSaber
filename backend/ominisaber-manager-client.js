(() => {
  const base = window.OminiSaber;
  if (!base?.client) return;
  const db = base.client;
  const guard = async () => { const session=await base.getSession(); if(!session) throw new Error('Sessão expirada.'); const profile=await base.getProfile(session.user.id); if(profile?.role!=='gestor') throw new Error('Acesso exclusivo do gestor.'); return {session,profile}; };
  const select = async (table, fields='*', order) => { await guard(); let q=db.from(table).select(fields); if(order) q=q.order(order,{ascending:false}); const {data,error}=await q;if(error)throw error;return data||[]; };
  const optional = p => p.catch(()=>[]);
  const getManagerOverview=async()=>{await guard();const [classes,profiles,links,descriptors,trails,labs,evaluations,prompts,accesses]=await Promise.all([select('turmas','*'),select('perfis','*'),select('professor_turmas','*'),optional(select('descritores_curriculares','*')),select('trilhas','id,titulo,publicada,turma_id,materia_codigo,descritor_sedu,created_at'),select('laboratorios_docentes','id,titulo,status,turma_id,created_at'),select('avaliacoes_docentes','id,titulo,status,turma_id,created_at'),select('propostas_redacao','id,titulo,publicada,turma_id,created_at'),optional(select('solicitacoes_acesso','*','created_at'))]);return{classes,profiles,links,descriptors,trails,labs,evaluations,prompts,accesses}};
  const listManagerClasses=()=>select('turmas','*');
  const saveManagerClass=async p=>{await guard();const row={nome:p.nome.trim(),ano_letivo:Number(p.ano_letivo),serie:p.serie||null};const q=p.id?db.from('turmas').update(row).eq('id',p.id):db.from('turmas').insert(row);const{data,error}=await q.select().single();if(error)throw error;return data};
  const listManagerProfiles=async role=>{const rows=await select('perfis','*,turmas!perfis_turma_id_fkey(id,nome,serie)');return role?rows.filter(x=>x.role===role):rows};
  const updateManagerProfile=async(id,changes)=>{
    await guard();
    const coreKeys=['nome','matricula','curso_tecnico','turma_id','tipo_professor'];
    const optionalKeys=['ativo','email_contato','primeiro_acesso_pendente','ultimo_acesso_em'];
    const core=Object.fromEntries(Object.entries(changes||{}).filter(([key])=>coreKeys.includes(key)));
    const optionalFields=Object.fromEntries(Object.entries(changes||{}).filter(([key])=>optionalKeys.includes(key)));
    if(Object.keys(core).length){
      const{error}=await db.from('perfis').update(core).eq('id',id);
      if(error)throw error;
    }
    if(Object.keys(optionalFields).length){
      const{error}=await db.from('perfis').update(optionalFields).eq('id',id);
      const missingColumn=error&&(error.code==='PGRST204'||error.code==='42703'||/column|schema cache/i.test(error.message||''));
      if(error&&!missingColumn)throw error;
    }
    const{data,error}=await db.from('perfis').select('*,turmas!perfis_turma_id_fkey(id,nome,serie)').eq('id',id).single();
    if(error)throw error;
    return data;
  };
  const listManagerLinks=()=>select('professor_turmas','professor_id,turma_id,materia,created_at,perfis!professor_turmas_professor_id_fkey(id,nome,tipo_professor),turmas!professor_turmas_turma_id_fkey(id,nome,serie)');
  const saveManagerLink=async p=>{await guard();const{data,error}=await db.from('professor_turmas').upsert(p).select().single();if(error)throw error;return data};
  const removeManagerLink=async(p,t)=>{await guard();const{error}=await db.from('professor_turmas').delete().eq('professor_id',p).eq('turma_id',t);if(error)throw error};
  const listManagerDescriptors=()=>optional(select('descritores_curriculares','*'));
  const listManagerCurriculumSkills=async({materia,serie,trimestre,search}={})=>{await guard();if(typeof base.listCurriculumSkills==='function')return base.listCurriculumSkills({materia,serie,trimestre,search});return[]};
  const saveManagerDescriptor=async p=>{await guard();const row={codigo:String(p.codigo||'').trim().toUpperCase(),titulo:String(p.titulo||'').trim(),descricao:String(p.descricao||'').trim()||null,materia_codigo:p.materia_codigo,serie:Number(p.serie),trimestre:Number(p.trimestre),status:p.status||'revisao'};const q=p.id?db.from('descritores_curriculares').update(row).eq('id',p.id):db.from('descritores_curriculares').insert(row);const{data,error}=await q.select().single();if(error)throw error;if(p.habilidade_id){const{data:periods,error:periodError}=await db.from('habilidade_curriculo_periodos').select('periodo_id,curriculo_periodos!inner(serie,trimestre,curriculos!inner(status,ativo))').eq('habilidade_id',p.habilidade_id);if(periodError)throw periodError;const period=periods.find(x=>Number(x.curriculo_periodos?.serie)===row.serie&&Number(x.curriculo_periodos?.trimestre)===row.trimestre&&x.curriculo_periodos?.curriculos?.status==='publicado'&&x.curriculo_periodos?.curriculos?.ativo===true);if(!period)throw new Error('A habilidade selecionada não possui período publicado compatível.');const{error:linkError}=await db.from('habilidade_descritores').upsert({habilidade_id:p.habilidade_id,descritor_id:data.id,periodo_id:period.periodo_id},{onConflict:'habilidade_id,descritor_id,periodo_id'});if(linkError)throw linkError;}return data};
  const hashCurriculumFile=async file=>{const buffer=await file.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',buffer);return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')};
  const listCurriculumImports=async()=>select('importacoes_curriculo','*,importacoes_curriculo_itens(*)','created_at');
  const createCurriculumImport=async(payload,items)=>{const {session}=await guard();const form=new FormData();form.append('file',payload.file);form.append('origem',payload.origem||'');form.append('ano',payload.ano||'');form.append('materia_codigo',payload.materia_codigo||payload.materia||'');form.append('trimestre',payload.trimestre||'');form.append('resumo',JSON.stringify(payload.resumo||{}));form.append('texto',payload.texto||'');form.append('itens',JSON.stringify(items||[]));const{data,error}=await db.functions.invoke('curriculo-upload',{body:form,headers:{Authorization:`Bearer ${session.access_token}`}});if(error)throw error;if(data?.error)throw new Error(data.error);if(data?.duplicate)return{duplicate:true,importacao:data.importacao,items:data.items||[]};return{duplicate:false,importacao:data.importacao,items:data.items||[]}};
  const updateCurriculumImport=async(id,changes)=>{await guard();const{data,error}=await db.from('importacoes_curriculo').update(changes).eq('id',id).select().single();if(error)throw error;return data};
  const updateCurriculumImportItem=async(id,changes)=>{await guard();const{data,error}=await db.rpc('editar_item_importacao_curriculo',{p_item_id:id,p_payload:changes.payload||{},p_source_page:changes.source_page||null,p_status:changes.status||'revisar'});if(error)throw error;return data};
  const approveCurriculumImport=async id=>{await guard();const{data,error}=await db.rpc('aprovar_importacao_curriculo',{p_importacao_id:id});if(error)throw error;return data};
  const rejectCurriculumImport=async id=>{await guard();const{data,error}=await db.rpc('rejeitar_importacao_curriculo',{p_importacao_id:id});if(error)throw error;return data};
  const reprocessCurriculumImport=async id=>{await guard();const{data,error}=await db.rpc('reprocessar_importacao_curriculo',{p_importacao_id:id});if(error)throw error;return data};
  const listManagerAudit=()=>optional(select('gestor_auditoria','*,perfis!gestor_auditoria_gestor_id_fkey(nome)','created_at'));
  const manageManagerAccess=async(action,payload)=>{await guard();const{data,error}=await db.functions.invoke('gestor-contas',{body:{action,...payload}});if(error)throw error;if(data?.error)throw new Error(data.error);return data};
  Object.assign(base,{getManagerOverview,listManagerClasses,saveManagerClass,listManagerProfiles,updateManagerProfile,listManagerLinks,saveManagerLink,removeManagerLink,listManagerDescriptors,listManagerCurriculumSkills,saveManagerDescriptor,hashCurriculumFile,listCurriculumImports,createCurriculumImport,updateCurriculumImport,updateCurriculumImportItem,approveCurriculumImport,rejectCurriculumImport,reprocessCurriculumImport,listManagerAudit,manageManagerAccess});
})();
