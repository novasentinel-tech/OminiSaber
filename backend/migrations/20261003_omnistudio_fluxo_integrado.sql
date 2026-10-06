-- OmniStudio: catálogo do aluno, versões retomáveis e percurso validado no servidor.
-- Incremental; executar depois de 20260926120000_oministudio_persistencia_rls.sql.
begin;

alter table public.studio_respostas drop constraint if exists studio_respostas_bloco_tipo_check;
alter table public.studio_respostas add constraint studio_respostas_bloco_tipo_check
  check (bloco_tipo in ('content','number','choice','text','decision','flourish',
    'image','formula','graph','table','chemistry','periodic','balance','molecule','ordering','matching'));
alter table public.studio_respostas add column if not exists confirmada boolean not null default false;
alter table public.studio_tentativas add column if not exists pontos_maximos numeric(10,2)
  check (pontos_maximos is null or pontos_maximos >= 0);
-- O rascunho pode mudar; publicação e identidade continuam exclusivas das RPCs.
revoke insert,update on public.studio_experiencias from authenticated;
grant insert (id,professor_id,materia_codigo,titulo,objetivo,turma_referencia,rascunho,tentativas_permitidas)
  on public.studio_experiencias to authenticated;
grant update (professor_id,materia_codigo,titulo,objetivo,turma_referencia,rascunho,tentativas_permitidas,updated_at)
  on public.studio_experiencias to authenticated;
drop policy if exists studio_experiencias_insert on public.studio_experiencias;
create policy studio_experiencias_insert on public.studio_experiencias for insert to authenticated with check (
  professor_id = (select auth.uid()) and (select public.usuario_role()) = 'professor'
  and exists(select 1 from public.professor_turma_materias ptm where ptm.professor_id = (select auth.uid())
    and ptm.materia_codigo = studio_experiencias.materia_codigo and ptm.ativo)
);
drop policy if exists studio_experiencias_update on public.studio_experiencias;
create policy studio_experiencias_update on public.studio_experiencias for update to authenticated
using(professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor')
with check((select public.usuario_role()) = 'gestor' or (professor_id = (select auth.uid())
  and (select public.usuario_role()) = 'professor' and exists(select 1 from public.professor_turma_materias ptm
    where ptm.professor_id = (select auth.uid()) and ptm.materia_codigo = studio_experiencias.materia_codigo and ptm.ativo)));
-- A correção deve recalcular a tentativa e registrar auditoria na mesma transação.
revoke update on public.studio_respostas from authenticated;
revoke update (pontos_manuais,feedback,status_correcao,corrigida_por,corrigida_em,updated_at)
  on public.studio_respostas from authenticated;
update public.studio_respostas r set correta = null,pontos_automaticos = 0,pontos_manuais = 0,
  feedback = null,status_correcao = 'registrada'
  from public.studio_tentativas t where t.id = r.tentativa_id and t.status = 'em_andamento';

create or replace function private.studio_itens(p_bloco jsonb)
returns text[] language sql immutable security invoker set search_path = '' as $$
  select coalesce(array_agg(btrim(linha) order by ordem), array[]::text[])
  from regexp_split_to_table(coalesce(p_bloco->>'items',''), E'\r?\n') with ordinality as linhas(linha,ordem)
  where btrim(linha) <> '';
$$;

create or replace function private.studio_indices_publicos(p_bloco jsonb, p_matching boolean default false)
returns integer[] language plpgsql immutable security invoker set search_path = '' as $$
declare v_indices integer[]; v_itens text[] := private.studio_itens(p_bloco);
begin
  if jsonb_typeof(p_bloco->case when p_matching then '_rightOrder' else '_order' end) = 'array' then
    select array_agg(value::integer order by ordem) into v_indices
    from jsonb_array_elements_text(p_bloco->case when p_matching then '_rightOrder' else '_order' end)
      with ordinality as indices(value,ordem);
  else
    -- Compatibilidade com versões antigas: uma ordem estável, sem publicar a ordem de referência.
    select array_agg(i-1 order by md5(v_itens[i])) into v_indices
    from generate_subscripts(v_itens,1) as indices(i);
  end if;
  return coalesce(v_indices,array[]::integer[]);
end;
$$;

create or replace function private.studio_snapshot_publico(p_snapshot jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = '' as $$
declare v_bloco jsonb; v_publico jsonb; v_blocos jsonb := '[]'::jsonb;
  v_itens text[]; v_indices integer[]; v_lista text[]; v_esquerda text[]; v_direita text[]; v_i integer;
begin
  for v_bloco in select value from jsonb_array_elements(coalesce(p_snapshot->'blocks','[]'::jsonb)) loop
    v_publico := v_bloco - array['correct','min','max','rubric','feedback','solution','answer','acceptedAnswers','_order','_rightOrder'];
    if v_bloco->>'type' in ('ordering','matching') then
      v_itens := private.studio_itens(v_bloco);
      v_indices := private.studio_indices_publicos(v_bloco,v_bloco->>'type' = 'matching');
      v_lista := array[]::text[]; v_esquerda := array[]::text[]; v_direita := array[]::text[];
      foreach v_i in array v_indices loop
        v_lista := array_append(v_lista,v_itens[v_i+1]);
        v_direita := array_append(v_direita,btrim(split_part(v_itens[v_i+1],'|',2)));
      end loop;
      if v_bloco->>'type' = 'ordering' then
        v_publico := v_publico || jsonb_build_object('items',array_to_string(v_lista,E'\n'));
      else
        foreach v_i in array array(select generate_subscripts(v_itens,1)) loop
          v_esquerda := array_append(v_esquerda,btrim(split_part(v_itens[v_i],'|',1)));
        end loop;
        v_publico := v_publico || jsonb_build_object('items',array_to_string(v_esquerda,E'\n'),
          'leftItems',to_jsonb(v_esquerda),'rightItems',to_jsonb(v_direita));
      end if;
    end if;
    v_blocos := v_blocos || jsonb_build_array(v_publico);
  end loop;
  return jsonb_set(p_snapshot,'{blocks}',v_blocos,true);
end;
$$;

create or replace function private.studio_validar_trabalho(p_work jsonb)
returns void language plpgsql immutable security invoker set search_path = '' as $$
declare v_bloco jsonb; v_aresta jsonb; v_ids text[]; v_itens text[]; v_tipo text;
  v_limite integer; v_ciclo boolean; v_alcancados integer; v_sem_origem boolean;
begin
  if jsonb_typeof(p_work) is distinct from 'object'
    or jsonb_typeof(p_work->'blocks') is distinct from 'array'
    or jsonb_typeof(p_work->'edges') is distinct from 'array' then
    raise exception 'O trabalho precisa de blocos, conexoes e etapa inicial.';
  end if;
  v_limite := jsonb_array_length(p_work->'blocks');
  if v_limite < 1 or v_limite > 100 or jsonb_array_length(p_work->'edges') > 200 then
    raise exception 'Use entre 1 e 100 etapas e no maximo 200 conexoes.';
  end if;
  if char_length(btrim(coalesce(p_work->>'title',''))) not between 1 and 150 then
    raise exception 'De um titulo de ate 150 caracteres ao trabalho.';
  end if;
  select array_agg(value->>'id') into v_ids from jsonb_array_elements(p_work->'blocks');
  if array_position(v_ids,null) is not null or array_position(v_ids,'') is not null
    or (select count(distinct id) from unnest(v_ids) as blocos(id)) <> v_limite
    or not coalesce((p_work->>'start') = any(v_ids),false) then
    raise exception 'Identificadores e etapa inicial precisam ser unicos e validos.';
  end if;
  for v_bloco in select value from jsonb_array_elements(p_work->'blocks') loop
    v_tipo := v_bloco->>'type';
    if v_tipo is null or v_tipo not in ('content','number','choice','text','decision','flourish','image',
      'formula','graph','table','chemistry','periodic','balance','molecule','ordering','matching') then
      raise exception 'Tipo de etapa nao reconhecido.';
    end if;
    if char_length(v_bloco->>'id') > 120 or char_length(btrim(coalesce(v_bloco->>'title',''))) not between 1 and 150
      or char_length(coalesce(v_bloco->>'instructions','')) > 2500
      or (v_tipo <> 'decision' and btrim(coalesce(v_bloco->>'instructions','')) = '') then
      raise exception 'Cada etapa precisa de titulo e orientacoes validas.';
    end if;
    if jsonb_typeof(v_bloco->'points') is distinct from 'number'
      or (v_bloco->>'points')::numeric not between 0 and 1000 then
      raise exception 'Pontuacao invalida em uma etapa.';
    end if;
    if v_tipo not in ('number','choice','text','balance','ordering','matching') and (v_bloco->>'points')::numeric <> 0 then
      raise exception 'Etapas de exploracao e condicoes nao recebem pontos.';
    end if;
    if v_tipo in ('number','decision') and (jsonb_typeof(v_bloco->'min') is distinct from 'number'
      or jsonb_typeof(v_bloco->'max') is distinct from 'number'
      or (v_bloco->>'min')::numeric > (v_bloco->>'max')::numeric) then
      raise exception 'Revise o intervalo numerico.';
    end if;
    if v_tipo = 'choice' then
      if jsonb_typeof(v_bloco->'options') is distinct from 'array'
        or jsonb_array_length(v_bloco->'options') not between 2 and 12
        or coalesce(v_bloco->>'correct','') !~ '^[0-9]+$'
        or (v_bloco->>'correct')::integer >= jsonb_array_length(v_bloco->'options')
        or exists (select 1 from jsonb_array_elements(v_bloco->'options') as op(value)
          where jsonb_typeof(value) <> 'string' or btrim(value #>> '{}') = '') then
        raise exception 'Revise alternativas e gabarito.';
      end if;
    end if;
    if v_tipo in ('text','balance') and btrim(coalesce(v_bloco->>'rubric','')) = '' then
      raise exception 'Defina criterios para as respostas abertas.';
    end if;
    if v_tipo in ('ordering','matching') then
      v_itens := private.studio_itens(v_bloco);
      if cardinality(v_itens) not between 2 and 20
        or (select count(distinct item) from unnest(v_itens) as itens(item)) <> cardinality(v_itens) then
        raise exception 'Use de 2 a 20 itens diferentes na interacao.';
      end if;
      if v_tipo = 'matching' and exists (select 1 from unnest(v_itens) as itens(item)
        where item !~ '^[^|]+[|][^|]+$' or btrim(split_part(item,'|',1)) = '' or btrim(split_part(item,'|',2)) = '') then
        raise exception 'Cada associacao precisa de Termo | Correspondente.';
      end if;
      if v_tipo = 'matching' and (select count(distinct btrim(split_part(item,'|',2)))
        from unnest(v_itens) as itens(item)) <> cardinality(v_itens) then
        raise exception 'Use correspondentes diferentes em cada associacao.';
      end if;
    end if;
    if v_tipo in ('formula','graph','chemistry','balance') and btrim(coalesce(v_bloco->>'expression','')) = '' then
      raise exception 'Preencha a expressao de referencia.';
    end if;
    if v_tipo = 'table' and (btrim(coalesce(v_bloco->>'columns','')) = '' or btrim(coalesce(v_bloco->>'rows','')) = '') then
      raise exception 'Preencha as colunas e os dados da tabela.';
    end if;
    if v_tipo = 'flourish' and (coalesce(v_bloco->>'url','') !~ '^https://(public[.]flourish[.]studio|flo[.]uri[.]sh)/(visualisation|story)/[0-9]+/?(embed/?)?$'
      or btrim(coalesce(v_bloco->>'summary','')) = '') then
      raise exception 'Use um endereco publico Flourish e um resumo acessivel.';
    end if;
    if v_tipo = 'image' and (coalesce(v_bloco->>'url','') !~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$'
      or btrim(coalesce(v_bloco->>'alt','')) = '') then
      raise exception 'Use uma imagem HTTPS e uma descricao acessivel.';
    end if;
    if coalesce(v_bloco#>>'{advanceRule,required}','false') = 'true'
      and btrim(coalesce(v_bloco#>>'{advanceRule,prompt}','')) = '' then
      raise exception 'Escreva a orientacao da confirmacao obrigatoria.';
    end if;
    if v_tipo = 'decision' then
      if not exists (select 1 from jsonb_array_elements(p_work->'blocks') as b(value)
        where value->>'id' = v_bloco->>'source' and value->>'type' = 'number') then
        raise exception 'A condicao precisa de uma resposta numerica de origem.';
      end if;
      if (select count(*) from jsonb_array_elements(p_work->'edges') as e(value)
        where value->>'source' = v_bloco->>'id' and value->>'sourceHandle' = 'yes') <> 1
        or (select count(*) from jsonb_array_elements(p_work->'edges') as e(value)
        where value->>'source' = v_bloco->>'id' and value->>'sourceHandle' = 'no') <> 1 then
        raise exception 'Conecte um caminho Sim e um caminho Nao em cada condicao.';
      end if;
      -- A origem deve ser anterior em todos os percursos que chegam a esta decisão.
      with recursive caminho(id) as (
        select p_work->>'start' where p_work->>'start' <> v_bloco->>'source'
        union select e.value->>'target'
        from caminho c cross join jsonb_array_elements(p_work->'edges') as e(value)
        where e.value->>'source' = c.id and e.value->>'target' <> v_bloco->>'source'
      ) select exists(select 1 from caminho where id = v_bloco->>'id') into v_sem_origem;
      if v_sem_origem then raise exception 'A origem numerica deve anteceder a condicao em todos os caminhos.'; end if;
    elsif (select count(*) from jsonb_array_elements(p_work->'edges') as e(value)
      where value->>'source' = v_bloco->>'id') > 1 then
      raise exception 'Use uma condicao para dividir o percurso.';
    end if;
  end loop;
  for v_aresta in select value from jsonb_array_elements(p_work->'edges') loop
    if not coalesce((v_aresta->>'source') = any(v_ids),false)
      or not coalesce((v_aresta->>'target') = any(v_ids),false) then
      raise exception 'Uma conexao aponta para etapa inexistente.';
    end if;
  end loop;
  -- UNION elimina caminhos repetidos em bifurcações que se reencontram.
  with recursive conexoes(origem,destino) as (
    select value->>'source',value->>'target' from jsonb_array_elements(p_work->'edges')
  ), alcance(origem,destino) as (
    select origem,destino from conexoes union
    select a.origem,c.destino from alcance a join conexoes c on c.origem = a.destino
  ), inicio(id) as (
    select p_work->>'start' union select c.destino from inicio i join conexoes c on c.origem = i.id
  ) select exists(select 1 from alcance where origem = destino),(select count(*) from inicio)
    into v_ciclo,v_alcancados;
  if v_ciclo then raise exception 'O percurso precisa terminar; remova as conexoes circulares.'; end if;
  if v_alcancados <> v_limite then raise exception 'Todas as etapas precisam estar ligadas ao inicio.'; end if;
end;
$$;

create or replace function private.publicar_experiencia_studio(p_experiencia_id uuid,p_turma_ids uuid[],
  p_abre_em timestamptz default null,p_encerra_em timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_usuario uuid := (select auth.uid()); v_papel public.perfil_role := (select public.usuario_role());
  v_exp public.studio_experiencias%rowtype; v_turma uuid; v_versao integer; v_snapshot jsonb;
  v_blocos jsonb := '[]'::jsonb; v_bloco jsonb; v_indices jsonb; v_turmas uuid[];
begin
  if v_usuario is null or v_papel not in ('professor','gestor') then
    raise exception 'Somente professores e gestores podem publicar experiencias.';
  end if;
  select array_agg(distinct id) into v_turmas from unnest(p_turma_ids) as turmas(id) where id is not null;
  if coalesce(cardinality(v_turmas),0) = 0 then raise exception 'Selecione pelo menos uma turma.'; end if;
  if p_encerra_em is not null and (p_encerra_em <= coalesce(p_abre_em,now()) or p_encerra_em <= now()) then
    raise exception 'O encerramento precisa ser posterior a abertura e ao momento atual.';
  end if;
  select * into v_exp from public.studio_experiencias
    where id = p_experiencia_id and (professor_id = v_usuario or v_papel = 'gestor') for update;
  if not found then raise exception 'Experiencia nao encontrada ou sem permissao.'; end if;
  if v_exp.status = 'arquivado' then raise exception 'Experiencia arquivada nao pode ser publicada.'; end if;
  perform private.studio_validar_trabalho(v_exp.rascunho);
  foreach v_turma in array v_turmas loop
    if v_papel <> 'gestor' and not exists(select 1 from public.professor_turma_materias ptm
      where ptm.professor_id = v_usuario and ptm.turma_id = v_turma
        and ptm.materia_codigo = v_exp.materia_codigo and ptm.ativo) then
      raise exception 'Professor sem vinculo ativo com uma das turmas selecionadas.';
    end if;
  end loop;
  for v_bloco in select value from jsonb_array_elements(v_exp.rascunho->'blocks') loop
    if v_bloco->>'type' in ('ordering','matching') then
      select jsonb_agg(i-1 order by random()) into v_indices
      from generate_subscripts(private.studio_itens(v_bloco),1) as itens(i);
      v_bloco := v_bloco - array['_order','_rightOrder'] || jsonb_build_object(
        case when v_bloco->>'type' = 'matching' then '_rightOrder' else '_order' end,v_indices);
    end if;
    v_blocos := v_blocos || jsonb_build_array(v_bloco);
  end loop;
  v_snapshot := jsonb_set(v_exp.rascunho,'{blocks}',v_blocos,true);
  v_versao := v_exp.versao_atual + 1;
  insert into public.studio_experiencia_versoes(experiencia_id,versao,snapshot,publicado_por)
    values(v_exp.id,v_versao,v_snapshot,v_usuario);
  foreach v_turma in array v_turmas loop
    insert into public.studio_experiencia_turmas(experiencia_id,versao,turma_id,abre_em,encerra_em)
      values(v_exp.id,v_versao,v_turma,p_abre_em,p_encerra_em);
  end loop;
  update public.studio_experiencias set status = 'publicado',versao_atual = v_versao where id = v_exp.id;
  insert into public.studio_auditoria(experiencia_id,ator_id,evento,detalhes)
    values(v_exp.id,v_usuario,'experiencia_publicada',jsonb_build_object('versao',v_versao,'turmas',to_jsonb(v_turmas)));
  return jsonb_build_object('experiencia_id',v_exp.id,'versao',v_versao);
end;
$$;

create or replace function private.studio_verificar_acesso_tentativa(p_tentativa public.studio_tentativas,p_edicao boolean)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or (select public.usuario_role()) <> 'aluno'
    or p_tentativa.aluno_id <> (select auth.uid()) or p_tentativa.turma_id <> (select public.usuario_turma_id()) then
    raise exception 'Tentativa indisponivel para este aluno.';
  end if;
  if p_edicao and (p_tentativa.status <> 'em_andamento' or not exists (
    select 1 from public.studio_experiencia_turmas et join public.studio_experiencias e on e.id = et.experiencia_id
    where et.experiencia_id = p_tentativa.experiencia_id and et.versao = p_tentativa.versao
      and et.turma_id = p_tentativa.turma_id and et.ativo and e.status = 'publicado'
      and (et.abre_em is null or et.abre_em <= now()) and (et.encerra_em is null or et.encerra_em >= now())
  )) then raise exception 'O periodo desta tentativa encerrou ou ela ja foi enviada.'; end if;
end;
$$;

create or replace function private.obter_experiencia_tentativa_studio(p_tentativa_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_t public.studio_tentativas%rowtype; v_exp public.studio_experiencias%rowtype;
  v_snapshot jsonb; v_turma public.studio_experiencia_turmas%rowtype; v_respostas jsonb;
begin
  select * into v_t from public.studio_tentativas where id = p_tentativa_id;
  if not found then raise exception 'Tentativa nao encontrada.'; end if;
  perform private.studio_verificar_acesso_tentativa(v_t,false);
  select * into v_exp from public.studio_experiencias where id = v_t.experiencia_id;
  select snapshot into v_snapshot from public.studio_experiencia_versoes where experiencia_id = v_t.experiencia_id and versao = v_t.versao;
  select * into v_turma from public.studio_experiencia_turmas
    where experiencia_id = v_t.experiencia_id and versao = v_t.versao and turma_id = v_t.turma_id;
  select coalesce(jsonb_agg(case when v_t.status = 'em_andamento' then
    to_jsonb(r) - array['correta','pontos_automaticos','pontos_manuais','feedback','status_correcao','corrigida_por','corrigida_em']
    else to_jsonb(r) end order by r.respondida_em),'[]'::jsonb) into v_respostas
    from public.studio_respostas r where r.tentativa_id = v_t.id;
  return jsonb_build_object('experiencia_id',v_t.experiencia_id,'versao',v_t.versao,
    'materia_codigo',v_exp.materia_codigo,'tentativas_permitidas',v_exp.tentativas_permitidas,
    'abre_em',v_turma.abre_em,'encerra_em',v_turma.encerra_em,
    'pontos_maximos',v_t.pontos_maximos,
    'work',private.studio_snapshot_publico(v_snapshot),
    'tentativa',to_jsonb(v_t) || jsonb_build_object('studio_respostas',v_respostas));
end;
$$;

create or replace function private.obter_experiencia_publicada_studio(p_experiencia_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_aluno uuid := (select auth.uid()); v_turma uuid := (select public.usuario_turma_id());
  v_et public.studio_experiencia_turmas%rowtype; v_exp public.studio_experiencias%rowtype; v_snapshot jsonb; v_tentativa uuid;
begin
  if v_aluno is null or (select public.usuario_role()) <> 'aluno' or v_turma is null then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;
  select t.id into v_tentativa from public.studio_tentativas t
    join public.studio_experiencia_turmas et on et.experiencia_id = t.experiencia_id and et.versao = t.versao and et.turma_id = t.turma_id
    join public.studio_experiencias e on e.id = t.experiencia_id
    where t.experiencia_id = p_experiencia_id and t.aluno_id = v_aluno and t.turma_id = v_turma and t.status = 'em_andamento'
      and et.ativo and e.status = 'publicado' and (et.abre_em is null or et.abre_em <= now())
      and (et.encerra_em is null or et.encerra_em >= now())
    order by t.iniciada_em desc limit 1;
  if found then return private.obter_experiencia_tentativa_studio(v_tentativa); end if;
  select et.* into v_et from public.studio_experiencia_turmas et join public.studio_experiencias e on e.id = et.experiencia_id
    where et.experiencia_id = p_experiencia_id and et.turma_id = v_turma and et.ativo and e.status = 'publicado'
      and (et.abre_em is null or et.abre_em <= now()) and (et.encerra_em is null or et.encerra_em >= now())
    order by et.versao desc limit 1;
  if not found then raise exception 'Experiencia indisponivel para este aluno.'; end if;
  select * into v_exp from public.studio_experiencias where id = p_experiencia_id;
  select snapshot into v_snapshot from public.studio_experiencia_versoes where experiencia_id = p_experiencia_id and versao = v_et.versao;
  return jsonb_build_object('experiencia_id',p_experiencia_id,'versao',v_et.versao,'materia_codigo',v_exp.materia_codigo,
    'tentativas_permitidas',v_exp.tentativas_permitidas,'abre_em',v_et.abre_em,'encerra_em',v_et.encerra_em,
    'work',private.studio_snapshot_publico(v_snapshot));
end;
$$;

create or replace function private.listar_experiencias_aluno_studio()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_aluno uuid := (select auth.uid()); v_turma uuid := (select public.usuario_turma_id()); v_resultado jsonb;
begin
  if v_aluno is null or (select public.usuario_role()) <> 'aluno' or v_turma is null then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;
  select coalesce(jsonb_agg(item order by atualizado desc),'[]'::jsonb) into v_resultado from (
    select e.updated_at as atualizado,jsonb_build_object('experiencia_id',e.id,'id',e.id,
      'titulo',coalesce(ev.snapshot->>'title',e.titulo),'objetivo',coalesce(ev.snapshot->>'objective',e.objetivo),
      'materia_codigo',e.materia_codigo,'professor_nome',p.nome,'versao',et.versao,
      'abre_em',et.abre_em,'encerra_em',et.encerra_em,'tentativas_permitidas',e.tentativas_permitidas,
      'total_etapas',jsonb_array_length(ev.snapshot->'blocks'),
      'pontos_maximos',(select coalesce(sum((b.value->>'points')::numeric),0) from jsonb_array_elements(ev.snapshot->'blocks') b(value)),
      'ultima_tentativa',case when t.id is null then null else to_jsonb(t) end,
      'respostas_salvas',(select count(*) from public.studio_respostas r where r.tentativa_id = t.id)) as item
    from public.studio_experiencias e join public.perfis p on p.id = e.professor_id
    left join lateral (
      select tent.* from public.studio_tentativas tent where tent.experiencia_id = e.id and tent.aluno_id = v_aluno
        and tent.turma_id = v_turma order by (tent.status = 'em_andamento') desc,tent.iniciada_em desc limit 1
    ) historico on true
    join lateral (
      select pub.* from public.studio_experiencia_turmas pub where pub.experiencia_id = e.id and pub.turma_id = v_turma
        and ((e.status = 'publicado' and pub.ativo) or pub.versao = historico.versao)
      order by case when historico.status = 'em_andamento' and pub.versao = historico.versao and pub.ativo
        and e.status = 'publicado' and (pub.abre_em is null or pub.abre_em <= now())
        and (pub.encerra_em is null or pub.encerra_em >= now()) then 0
        when e.status = 'publicado' and pub.ativo then 1 else 2 end,pub.versao desc limit 1
    ) et on true
    left join lateral (
      select tent.* from public.studio_tentativas tent where tent.experiencia_id = e.id and tent.aluno_id = v_aluno
        and tent.turma_id = v_turma and tent.versao = et.versao order by tent.iniciada_em desc limit 1
    ) t on true
    join public.studio_experiencia_versoes ev on ev.experiencia_id = e.id and ev.versao = et.versao
  ) catalogo;
  return v_resultado;
end;
$$;

create or replace function private.iniciar_tentativa_studio(p_experiencia_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_aluno uuid := (select auth.uid()); v_turma uuid := (select public.usuario_turma_id());
  v_versao integer; v_limite integer; v_numero integer; v_t public.studio_tentativas%rowtype;
begin
  if v_aluno is null or (select public.usuario_role()) <> 'aluno' or v_turma is null then
    raise exception 'Acesso restrito a alunos autenticados.';
  end if;
  -- Uma trava por aluno/experiência serializa cliques repetidos e múltiplas abas.
  perform pg_advisory_xact_lock(hashtextextended(v_aluno::text || ':' || p_experiencia_id::text,0));
  select t.* into v_t from public.studio_tentativas t
    join public.studio_experiencia_turmas et on et.experiencia_id = t.experiencia_id and et.versao = t.versao and et.turma_id = t.turma_id
    join public.studio_experiencias e on e.id = t.experiencia_id
    where t.experiencia_id = p_experiencia_id and t.aluno_id = v_aluno and t.turma_id = v_turma and t.status = 'em_andamento'
      and et.ativo and e.status = 'publicado' and (et.abre_em is null or et.abre_em <= now())
      and (et.encerra_em is null or et.encerra_em >= now())
    order by t.iniciada_em desc limit 1;
  if found then
    perform private.studio_verificar_acesso_tentativa(v_t,true);
    return jsonb_build_object('tentativa_id',v_t.id,'versao',v_t.versao,'numero',v_t.numero_tentativa,'retomada',true);
  end if;
  select et.versao,e.tentativas_permitidas into v_versao,v_limite
    from public.studio_experiencia_turmas et join public.studio_experiencias e on e.id = et.experiencia_id
    where et.experiencia_id = p_experiencia_id and et.turma_id = v_turma and et.ativo and e.status = 'publicado'
      and (et.abre_em is null or et.abre_em <= now()) and (et.encerra_em is null or et.encerra_em >= now())
    order by et.versao desc limit 1;
  if not found then raise exception 'Experiencia indisponivel para este aluno.'; end if;
  if exists(select 1 from public.studio_tentativas where experiencia_id = p_experiencia_id
    and aluno_id = v_aluno and versao = v_versao and requer_revisao) then
    raise exception 'Aguarde a devolutiva do professor antes de tentar novamente.';
  end if;
  select coalesce(max(numero_tentativa),0)+1 into v_numero from public.studio_tentativas
    where experiencia_id = p_experiencia_id and versao = v_versao and aluno_id = v_aluno;
  if v_numero > v_limite then raise exception 'Limite de tentativas atingido.'; end if;
  insert into public.studio_tentativas(experiencia_id,versao,aluno_id,turma_id,numero_tentativa)
    values(p_experiencia_id,v_versao,v_aluno,v_turma,v_numero) returning * into v_t;
  insert into public.studio_auditoria(experiencia_id,tentativa_id,ator_id,evento,detalhes)
    values(p_experiencia_id,v_t.id,v_aluno,'tentativa_iniciada',jsonb_build_object('versao',v_versao,'numero',v_numero));
  return jsonb_build_object('tentativa_id',v_t.id,'versao',v_versao,'numero',v_numero,'retomada',false);
end;
$$;

create or replace function private.studio_resposta_completa(p_bloco jsonb,p_resposta jsonb,p_confirmada boolean)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare v_tipo text := p_bloco->>'type'; v_itens text[]; v_n integer; v_distintos integer; v_i integer; v_valor text;
begin
  if coalesce(p_bloco#>>'{advanceRule,required}','false') = 'true' and not p_confirmada then return false; end if;
  if v_tipo = 'decision' then return true; end if;
  if p_resposta is null or p_resposta = 'null'::jsonb then return false; end if;
  if v_tipo = 'number' then return jsonb_typeof(p_resposta) in ('number','string')
    and char_length(p_resposta #>> '{}') <= 100 and btrim(p_resposta #>> '{}') ~ '^-?[0-9]+([.,][0-9]+)?$'; end if;
  if v_tipo = 'choice' then
    v_valor := p_resposta #>> '{}';
    if jsonb_typeof(p_resposta) not in ('number','string') or v_valor !~ '^[0-9]{1,3}$' then return false; end if;
    return v_valor::integer < jsonb_array_length(p_bloco->'options');
  end if;
  if v_tipo in ('text','balance') then return jsonb_typeof(p_resposta) = 'string'
    and char_length(btrim(p_resposta #>> '{}')) between 1 and 20000; end if;
  if v_tipo in ('ordering','matching') then
    v_itens := private.studio_itens(p_bloco); v_n := cardinality(v_itens);
    if v_tipo = 'ordering' then
      if jsonb_typeof(p_resposta->'order') is distinct from 'array' or jsonb_array_length(p_resposta->'order') <> v_n then return false; end if;
      if exists(select 1 from jsonb_array_elements_text(p_resposta->'order') val(value)
        where value !~ '^[0-9]{1,3}$') then return false; end if;
      select count(distinct value::integer) into v_distintos from jsonb_array_elements_text(p_resposta->'order') val(value)
        where value::integer between 0 and v_n-1;
    else
      if jsonb_typeof(p_resposta->'matches') is distinct from 'object' then return false; end if;
      for v_i in 0..v_n-1 loop
        v_valor := p_resposta->'matches'->>v_i::text;
        if v_valor is null or v_valor !~ '^[0-9]{1,3}$' or v_valor::integer not between 0 and v_n-1 then return false; end if;
      end loop;
      select count(distinct value::integer) into v_distintos from jsonb_each_text(p_resposta->'matches') val(key,value)
        where key ~ '^[0-9]{1,3}$' and value ~ '^[0-9]{1,3}$';
      if (select count(*) from jsonb_each(p_resposta->'matches')) <> v_n then return false; end if;
    end if;
    return v_distintos = v_n;
  end if;
  return jsonb_typeof(p_resposta) = 'object' and p_resposta->'viewed' = 'true'::jsonb;
end;
$$;

create or replace function private.studio_proxima_etapa(p_snapshot jsonb,p_atual text,p_tentativa_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_bloco jsonb; v_resposta jsonb; v_passou boolean := false; v_alvo text; v_texto text;
begin
  select value into v_bloco from jsonb_array_elements(p_snapshot->'blocks') where value->>'id' = p_atual;
  if v_bloco is null then raise exception 'Etapa nao encontrada.'; end if;
  if v_bloco->>'type' = 'decision' then
    select resposta into v_resposta from public.studio_respostas
      where tentativa_id = p_tentativa_id and bloco_id = v_bloco->>'source';
    v_texto := v_resposta #>> '{}';
    if v_texto is null or v_texto !~ '^-?[0-9]+([.,][0-9]+)?$' then
      raise exception 'Registre a resposta numerica antes da condicao.';
    end if;
    v_passou := replace(v_texto,',','.')::numeric between (v_bloco->>'min')::numeric and (v_bloco->>'max')::numeric;
  end if;
  select value->>'target' into v_alvo from jsonb_array_elements(p_snapshot->'edges')
    where value->>'source' = p_atual and (v_bloco->>'type' <> 'decision'
      or value->>'sourceHandle' = case when v_passou then 'yes' else 'no' end) limit 1;
  return v_alvo;
end;
$$;

create or replace function private.studio_percurso_tentativa(p_snapshot jsonb,p_tentativa_id uuid)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare v_atual text := p_snapshot->>'start'; v_percurso text[] := array[]::text[]; v_bloco jsonb; v_origem text;
begin
  while v_atual is not null loop
    if v_atual = any(v_percurso) or cardinality(v_percurso) >= 100 then raise exception 'Percurso circular ou muito extenso.'; end if;
    v_percurso := array_append(v_percurso,v_atual);
    select value into v_bloco from jsonb_array_elements(p_snapshot->'blocks') where value->>'id' = v_atual;
    if v_bloco is null then raise exception 'Etapa nao encontrada.'; end if;
    -- Permite salvar antes de chegar a uma condição ainda sem resposta de origem.
    if v_bloco->>'type' = 'decision' then
      select resposta #>> '{}' into v_origem from public.studio_respostas
        where tentativa_id = p_tentativa_id and bloco_id = v_bloco->>'source';
      if v_origem is null or v_origem !~ '^-?[0-9]+([.,][0-9]+)?$' then exit; end if;
    end if;
    v_atual := private.studio_proxima_etapa(p_snapshot,v_atual,p_tentativa_id);
  end loop;
  return v_percurso;
end;
$$;

create or replace function private.salvar_resposta_studio(p_tentativa_id uuid,p_bloco_id text,p_resposta jsonb,p_confirmada boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_t public.studio_tentativas%rowtype; v_snapshot jsonb; v_bloco jsonb; v_percurso text[];
begin
  select * into v_t from public.studio_tentativas where id = p_tentativa_id for update;
  if not found then raise exception 'Tentativa nao encontrada.'; end if;
  perform private.studio_verificar_acesso_tentativa(v_t,true);
  if pg_column_size(p_resposta) > 65536 then raise exception 'A resposta excede o limite permitido.'; end if;
  select snapshot into v_snapshot from public.studio_experiencia_versoes where experiencia_id = v_t.experiencia_id and versao = v_t.versao;
  v_percurso := private.studio_percurso_tentativa(v_snapshot,v_t.id);
  if not p_bloco_id = any(v_percurso) then raise exception 'Esta etapa nao pertence ao seu percurso atual.'; end if;
  select value into v_bloco from jsonb_array_elements(v_snapshot->'blocks') where value->>'id' = p_bloco_id;
  if v_bloco is null or v_bloco->>'type' = 'decision' then raise exception 'Esta etapa nao recebe resposta.'; end if;
  -- Digitação intermediária e respostas limpas são rascunhos válidos para autosalvar.
  -- A completude e a confirmação são cobradas somente ao avançar e ao enviar.
  if p_resposta is not null and p_resposta <> 'null'::jsonb then
    if (v_bloco->>'type' in ('number','choice') and jsonb_typeof(p_resposta) not in ('number','string'))
      or (v_bloco->>'type' in ('text','balance') and (jsonb_typeof(p_resposta) <> 'string' or char_length(p_resposta #>> '{}') > 20000))
      or (v_bloco->>'type' = 'ordering' and (jsonb_typeof(p_resposta) <> 'object' or jsonb_typeof(p_resposta->'order') is distinct from 'array'))
      or (v_bloco->>'type' = 'matching' and (jsonb_typeof(p_resposta) <> 'object' or jsonb_typeof(p_resposta->'matches') is distinct from 'object'))
      or (v_bloco->>'type' not in ('number','choice','text','balance','ordering','matching') and jsonb_typeof(p_resposta) <> 'object') then
      raise exception 'Formato de resposta invalido para esta etapa.';
    end if;
  end if;
  insert into public.studio_respostas(tentativa_id,bloco_id,bloco_tipo,resposta,confirmada,status_correcao,correta,pontos_automaticos)
    values(v_t.id,p_bloco_id,v_bloco->>'type',coalesce(p_resposta,'null'::jsonb),coalesce(p_confirmada,false),'registrada',null,0)
    on conflict(tentativa_id,bloco_id) do update set resposta = excluded.resposta,confirmada = excluded.confirmada,
      status_correcao = 'registrada',correta = null,pontos_automaticos = 0,pontos_manuais = 0,feedback = null,
      corrigida_por = null,corrigida_em = null,respondida_em = now();
  -- Uma alteração anterior pode desviar o percurso; evidências fora dele deixam de valer.
  v_percurso := private.studio_percurso_tentativa(v_snapshot,v_t.id);
  delete from public.studio_respostas where tentativa_id = v_t.id and not bloco_id = any(v_percurso);
  return jsonb_build_object('status','salva','bloco_id',p_bloco_id,'confirmada',coalesce(p_confirmada,false));
end;
$$;

create or replace function private.salvar_resposta_studio(p_tentativa_id uuid,p_bloco_id text,p_resposta jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select private.salvar_resposta_studio(p_tentativa_id,p_bloco_id,p_resposta,false);
$$;

create or replace function private.resolver_proximo_bloco_studio(p_tentativa_id uuid,p_bloco_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_t public.studio_tentativas%rowtype; v_snapshot jsonb; v_bloco jsonb; v_r public.studio_respostas%rowtype;
begin
  select * into v_t from public.studio_tentativas where id = p_tentativa_id for update;
  if not found then raise exception 'Tentativa nao encontrada.'; end if;
  perform private.studio_verificar_acesso_tentativa(v_t,true);
  select snapshot into v_snapshot from public.studio_experiencia_versoes where experiencia_id = v_t.experiencia_id and versao = v_t.versao;
  if not p_bloco_id = any(private.studio_percurso_tentativa(v_snapshot,v_t.id)) then raise exception 'Etapa fora do percurso.'; end if;
  select value into v_bloco from jsonb_array_elements(v_snapshot->'blocks') where value->>'id' = p_bloco_id;
  if v_bloco->>'type' <> 'decision' then
    select * into v_r from public.studio_respostas where tentativa_id = v_t.id and bloco_id = p_bloco_id;
    if not found or not private.studio_resposta_completa(v_bloco,v_r.resposta,v_r.confirmada) then
      raise exception 'Conclua a etapa e a confirmacao obrigatoria antes de avancar.';
    end if;
  end if;
  return jsonb_build_object('nextBlockId',private.studio_proxima_etapa(v_snapshot,p_bloco_id,v_t.id));
end;
$$;

create or replace function private.enviar_tentativa_studio(p_tentativa_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_t public.studio_tentativas%rowtype; v_snapshot jsonb; v_percurso text[]; v_id text; v_bloco jsonb;
  v_r public.studio_respostas%rowtype; v_indices integer[]; v_i integer; v_ok boolean; v_max numeric;
  v_auto numeric := 0; v_revisao boolean := false; v_total numeric := 0;
begin
  select * into v_t from public.studio_tentativas where id = p_tentativa_id for update;
  if not found then raise exception 'Tentativa nao encontrada.'; end if;
  perform private.studio_verificar_acesso_tentativa(v_t,v_t.status = 'em_andamento');
  if v_t.status <> 'em_andamento' then return jsonb_build_object('status',v_t.status,
    'pontuacao_automatica',v_t.pontuacao_automatica,'pontos_maximos',v_t.pontos_maximos,'requer_revisao',v_t.requer_revisao); end if;
  select snapshot into v_snapshot from public.studio_experiencia_versoes where experiencia_id = v_t.experiencia_id and versao = v_t.versao;
  v_percurso := private.studio_percurso_tentativa(v_snapshot,v_t.id);
  foreach v_id in array v_percurso loop
    select value into v_bloco from jsonb_array_elements(v_snapshot->'blocks') where value->>'id' = v_id;
    if v_bloco->>'type' = 'decision' then
      perform private.studio_proxima_etapa(v_snapshot,v_id,v_t.id);
      continue;
    end if;
    select * into v_r from public.studio_respostas where tentativa_id = v_t.id and bloco_id = v_id;
    if not found or not private.studio_resposta_completa(v_bloco,v_r.resposta,v_r.confirmada) then
      raise exception 'Conclua todas as etapas do seu percurso antes de enviar.';
    end if;
    v_max := (v_bloco->>'points')::numeric; v_total := v_total + v_max; v_ok := null;
    if v_bloco->>'type' = 'number' then
      v_ok := replace(v_r.resposta #>> '{}',',','.')::numeric between (v_bloco->>'min')::numeric and (v_bloco->>'max')::numeric;
    elsif v_bloco->>'type' = 'choice' then v_ok := (v_r.resposta #>> '{}')::integer = (v_bloco->>'correct')::integer;
    elsif v_bloco->>'type' in ('ordering','matching') then
      v_indices := private.studio_indices_publicos(v_bloco,v_bloco->>'type' = 'matching'); v_ok := true;
      for v_i in 0..cardinality(v_indices)-1 loop
        if v_bloco->>'type' = 'ordering' then
          v_ok := v_ok and v_indices[(v_r.resposta->'order'->>v_i)::integer+1] = v_i;
        else v_ok := v_ok and v_indices[(v_r.resposta->'matches'->>v_i::text)::integer+1] = v_i; end if;
      end loop;
    end if;
    if v_bloco->>'type' in ('text','balance') then
      v_revisao := true;
      update public.studio_respostas set status_correcao = 'revisao',correta = null,pontos_automaticos = 0 where id = v_r.id;
    else
      v_auto := v_auto + case when v_ok then v_max else 0 end;
      update public.studio_respostas set status_correcao = case when v_ok is null then 'registrada' else 'automatica' end,
        correta = v_ok,pontos_automaticos = case when v_ok then v_max else 0 end where id = v_r.id;
    end if;
  end loop;
  delete from public.studio_respostas where tentativa_id = v_t.id and not bloco_id = any(v_percurso);
  update public.studio_tentativas set status = case when v_revisao then 'enviada' else 'corrigida' end,
    pontuacao_automatica = v_auto,pontuacao_manual = 0,pontos_maximos = v_total,requer_revisao = v_revisao,enviada_em = now(),
    corrigida_em = case when v_revisao then null else now() end where id = v_t.id;
  insert into public.studio_auditoria(experiencia_id,tentativa_id,ator_id,evento,detalhes)
    values(v_t.experiencia_id,v_t.id,(select auth.uid()),'tentativa_enviada',
      jsonb_build_object('requer_revisao',v_revisao,'percurso',to_jsonb(v_percurso),'pontos_maximos',v_total));
  return jsonb_build_object('status',case when v_revisao then 'enviada' else 'corrigida' end,
    'pontuacao_automatica',v_auto,'pontos_maximos',v_total,'requer_revisao',v_revisao);
end;
$$;

create or replace function private.corrigir_resposta_studio(p_resposta_id uuid,p_pontos numeric,p_feedback text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_usuario uuid := (select auth.uid()); v_r public.studio_respostas%rowtype;
  v_t public.studio_tentativas%rowtype; v_max numeric; v_pendentes integer;
begin
  if v_usuario is null or (select public.usuario_role()) not in ('professor','gestor') then
    raise exception 'Acesso restrito ao professor responsavel.';
  end if;
  select r.* into v_r from public.studio_respostas r join public.studio_tentativas t on t.id = r.tentativa_id
    join public.studio_experiencias e on e.id = t.experiencia_id where r.id = p_resposta_id
      and (e.professor_id = v_usuario or (select public.usuario_role()) = 'gestor');
  if not found then raise exception 'Resposta nao encontrada ou sem permissao.'; end if;
  select * into v_t from public.studio_tentativas where id = v_r.tentativa_id for update;
  if v_t.status = 'em_andamento' then raise exception 'Aguarde o envio antes de corrigir.'; end if;
  if v_r.bloco_tipo not in ('text','balance') then raise exception 'Somente respostas abertas aceitam correcao manual.'; end if;
  select (value->>'points')::numeric into v_max from public.studio_experiencia_versoes ev,
    jsonb_array_elements(ev.snapshot->'blocks') as b(value)
    where ev.experiencia_id = v_t.experiencia_id and ev.versao = v_t.versao and value->>'id' = v_r.bloco_id;
  if p_pontos is null or p_pontos = 'NaN'::numeric or p_pontos not between 0 and coalesce(v_max,0) then
    raise exception 'Pontuacao fora do intervalo permitido.';
  end if;
  if char_length(coalesce(p_feedback,'')) > 4000 then raise exception 'Use ate 4000 caracteres na devolutiva.'; end if;
  update public.studio_respostas set pontos_manuais = p_pontos,feedback = nullif(btrim(p_feedback),''),
    status_correcao = 'manual',corrigida_por = v_usuario,corrigida_em = now() where id = v_r.id;
  select count(*) into v_pendentes from public.studio_respostas where tentativa_id = v_t.id and status_correcao = 'revisao';
  update public.studio_tentativas set pontuacao_manual = (select coalesce(sum(pontos_manuais),0)
    from public.studio_respostas where tentativa_id = v_t.id),requer_revisao = v_pendentes > 0,
    status = case when v_pendentes = 0 then 'corrigida' else 'enviada' end,
    corrigida_em = case when v_pendentes = 0 then now() else null end where id = v_t.id;
  insert into public.studio_auditoria(experiencia_id,tentativa_id,ator_id,evento,detalhes)
    values(v_t.experiencia_id,v_t.id,v_usuario,'resposta_corrigida',jsonb_build_object('resposta_id',v_r.id,'pontos',p_pontos));
  return jsonb_build_object('resposta_id',v_r.id,'pontos',p_pontos,'pendentes',v_pendentes);
end;
$$;

create or replace function public.listar_experiencias_aluno_studio()
returns jsonb language sql security invoker set search_path = '' as $$ select private.listar_experiencias_aluno_studio(); $$;
create or replace function public.obter_experiencia_tentativa_studio(p_tentativa_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.obter_experiencia_tentativa_studio(p_tentativa_id); $$;
create or replace function public.resolver_proximo_bloco_studio(p_tentativa_id uuid,p_bloco_id text)
returns jsonb language sql security invoker set search_path = '' as $$ select private.resolver_proximo_bloco_studio(p_tentativa_id,p_bloco_id); $$;
-- Uma única assinatura pública evita ambiguidade no cache de schema do PostgREST.
drop function if exists public.salvar_resposta_studio(uuid,text,jsonb);
create or replace function public.salvar_resposta_studio(p_tentativa_id uuid,p_bloco_id text,p_resposta jsonb,p_confirmada boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$ select private.salvar_resposta_studio(p_tentativa_id,p_bloco_id,p_resposta,p_confirmada); $$;

alter table public.notificacoes add column if not exists studio_experiencia_id uuid;
alter table public.notificacoes add column if not exists studio_versao integer;
do $$ begin
  alter table public.notificacoes add constraint notificacoes_studio_versao_fkey
    foreign key(studio_experiencia_id,studio_versao)
    references public.studio_experiencia_versoes(experiencia_id,versao) on delete cascade;
exception when duplicate_object then null; end $$;
create unique index if not exists notificacoes_studio_turma_key
  on public.notificacoes(studio_experiencia_id,studio_versao,destino_turma_id)
  where studio_experiencia_id is not null;
create index if not exists studio_tentativas_retomada_idx
  on public.studio_tentativas(aluno_id,experiencia_id,iniciada_em desc) where status = 'em_andamento';

create or replace function private.studio_notificar_publicacao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_exp public.studio_experiencias%rowtype; v_titulo text;
begin
  if not new.ativo then
    delete from public.notificacoes where studio_experiencia_id = new.experiencia_id
      and studio_versao = new.versao and destino_turma_id = new.turma_id;
    return new;
  end if;
  select * into v_exp from public.studio_experiencias where id = new.experiencia_id;
  select coalesce(snapshot->>'title',v_exp.titulo) into v_titulo from public.studio_experiencia_versoes
    where experiencia_id = new.experiencia_id and versao = new.versao;
  insert into public.notificacoes(titulo,mensagem,tipo,prioridade,destino_turma_id,criado_por,link,expira_em,
    studio_experiencia_id,studio_versao,updated_at)
  values('Nova experiencia interativa',left(v_titulo || case when new.abre_em > now()
    then ' · disponivel em ' || to_char(new.abre_em at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
    when new.encerra_em is not null then ' · entrega ate ' || to_char(new.encerra_em at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
    else ' · descubra o percurso preparado pelo professor.' end,500),
    'avaliacao','normal',new.turma_id,v_exp.professor_id,
    '../atividades/index.html?studio=' || new.experiencia_id,new.encerra_em,new.experiencia_id,new.versao,now())
  on conflict(studio_experiencia_id,studio_versao,destino_turma_id) where studio_experiencia_id is not null
    do update set mensagem = excluded.mensagem,expira_em = excluded.expira_em,updated_at = now();
  return new;
end;
$$;
revoke all on function private.studio_notificar_publicacao() from public,anon,authenticated;
drop trigger if exists studio_publicacao_notificacao on public.studio_experiencia_turmas;
create trigger studio_publicacao_notificacao after insert or update of ativo,abre_em,encerra_em
  on public.studio_experiencia_turmas for each row execute function private.studio_notificar_publicacao();

create or replace function private.studio_remover_notificacao_arquivada()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'arquivado' then delete from public.notificacoes where studio_experiencia_id = new.id; end if;
  return new;
end;
$$;
revoke all on function private.studio_remover_notificacao_arquivada() from public,anon,authenticated;
drop trigger if exists studio_arquivo_notificacao on public.studio_experiencias;
create trigger studio_arquivo_notificacao after update of status on public.studio_experiencias
  for each row execute function private.studio_remover_notificacao_arquivada();

-- Apenas RPCs autenticadas expõem o contrato. Helpers não pertencem à Data API.
revoke all on function private.publicar_experiencia_studio(uuid,uuid[],timestamptz,timestamptz) from public,anon;
revoke all on function private.obter_experiencia_publicada_studio(uuid) from public,anon;
revoke all on function private.iniciar_tentativa_studio(uuid) from public,anon;
revoke all on function private.salvar_resposta_studio(uuid,text,jsonb) from public,anon;
revoke all on function private.enviar_tentativa_studio(uuid) from public,anon;
revoke all on function private.corrigir_resposta_studio(uuid,numeric,text) from public,anon;
grant execute on function private.publicar_experiencia_studio(uuid,uuid[],timestamptz,timestamptz) to authenticated;
grant execute on function private.obter_experiencia_publicada_studio(uuid) to authenticated;
grant execute on function private.iniciar_tentativa_studio(uuid) to authenticated;
grant execute on function private.salvar_resposta_studio(uuid,text,jsonb) to authenticated;
grant execute on function private.enviar_tentativa_studio(uuid) to authenticated;
grant execute on function private.corrigir_resposta_studio(uuid,numeric,text) to authenticated;
revoke all on function private.studio_itens(jsonb) from public,anon,authenticated;
revoke all on function private.studio_indices_publicos(jsonb,boolean) from public,anon,authenticated;
revoke all on function private.studio_snapshot_publico(jsonb) from public,anon,authenticated;
revoke all on function private.studio_validar_trabalho(jsonb) from public,anon,authenticated;
revoke all on function private.studio_verificar_acesso_tentativa(public.studio_tentativas,boolean) from public,anon,authenticated;
revoke all on function private.studio_resposta_completa(jsonb,jsonb,boolean) from public,anon,authenticated;
revoke all on function private.studio_proxima_etapa(jsonb,text,uuid) from public,anon,authenticated;
revoke all on function private.studio_percurso_tentativa(jsonb,uuid) from public,anon,authenticated;
revoke all on function private.listar_experiencias_aluno_studio() from public,anon;
revoke all on function private.obter_experiencia_tentativa_studio(uuid) from public,anon;
revoke all on function private.resolver_proximo_bloco_studio(uuid,text) from public,anon;
revoke all on function private.salvar_resposta_studio(uuid,text,jsonb,boolean) from public,anon;
revoke all on function public.listar_experiencias_aluno_studio() from public,anon;
revoke all on function public.obter_experiencia_tentativa_studio(uuid) from public,anon;
revoke all on function public.resolver_proximo_bloco_studio(uuid,text) from public,anon;
revoke all on function public.salvar_resposta_studio(uuid,text,jsonb,boolean) from public,anon;
grant execute on function private.listar_experiencias_aluno_studio() to authenticated;
grant execute on function private.obter_experiencia_tentativa_studio(uuid) to authenticated;
grant execute on function private.resolver_proximo_bloco_studio(uuid,text) to authenticated;
grant execute on function private.salvar_resposta_studio(uuid,text,jsonb,boolean) to authenticated;
grant execute on function public.listar_experiencias_aluno_studio() to authenticated;
grant execute on function public.obter_experiencia_tentativa_studio(uuid) to authenticated;
grant execute on function public.resolver_proximo_bloco_studio(uuid,text) to authenticated;
grant execute on function public.salvar_resposta_studio(uuid,text,jsonb,boolean) to authenticated;

commit;
