begin;

create or replace function public.aprovar_importacao_curriculo(p_importacao_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  imp public.importacoes_curriculo;
  curr_id uuid;
  anterior_id uuid;
  periodo public.curriculo_periodos;
  periodo_anterior public.curriculo_periodos;
  habilidade public.habilidades_curriculares;
  descritor public.descritores_curriculares;
  objeto public.objetos_conhecimento;
  item jsonb;
  child jsonb;
  serie_num smallint;
  tri_num smallint;
  versao_num integer;
  curriculo_novo boolean := false;
  periodo_afetado boolean;
begin
  if public.usuario_role() <> 'gestor' then raise exception 'Apenas gestores podem aprovar importações'; end if;
  select * into imp from public.importacoes_curriculo where id = p_importacao_id for update;
  if imp.id is null then raise exception 'Importação não encontrada'; end if;
  if imp.status = 'aprovada' and imp.curriculo_id is not null then return imp.curriculo_id; end if;
  if imp.status <> 'revisao' then raise exception 'Importação precisa estar em revisão'; end if;
  if imp.materia_codigo is null then raise exception 'Componente curricular não identificado'; end if;
  if not exists (
    select 1 from public.importacoes_curriculo_itens
    where importacao_id = imp.id
      and tipo = 'habilidade'
      and status in ('ok', 'aprovado')
      and upper(payload ->> 'codigo') ~ '^EM\d{2}[A-Z]{2}\d{2}$'
  ) then raise exception 'Nenhuma habilidade aprovada para publicação'; end if;
  if exists (
    select 1 from public.importacoes_curriculo_itens
    where importacao_id = imp.id
      and tipo = 'habilidade'
      and status = 'revisar'
      and upper(payload ->> 'codigo') ~ '^EM\d{2}[A-Z]{2}\d{2}$'
  ) then raise exception 'Existem habilidades pendentes'; end if;

  perform pg_advisory_xact_lock(hashtext(coalesce(imp.origem, '') || ':' || imp.ano_letivo || ':' || imp.materia_codigo::text));

  if imp.reprocessamento_de_id is null then
    select id into curr_id
    from public.curriculos
    where origem = coalesce(imp.origem, 'Não identificada')
      and ano_letivo = imp.ano_letivo
      and materia_codigo = imp.materia_codigo
      and status = 'publicado'
      and ativo = true
    order by versao desc
    limit 1;
  else
    select id into anterior_id
    from public.curriculos
    where origem = coalesce(imp.origem, 'Não identificada')
      and ano_letivo = imp.ano_letivo
      and materia_codigo = imp.materia_codigo
      and status = 'publicado'
      and ativo = true
    order by versao desc
    limit 1;
  end if;

  if curr_id is null and (imp.reprocessamento_de_id is null or anterior_id is not null) then
    select coalesce(max(versao), 0) + 1 into versao_num
    from public.curriculos
    where origem = coalesce(imp.origem, 'Não identificada')
      and ano_letivo = imp.ano_letivo
      and materia_codigo = imp.materia_codigo;
    insert into public.curriculos (nome, origem, ano_letivo, materia_codigo, versao, status, criado_por, importacao_id)
    values (
      coalesce(imp.origem, 'Currículo importado') || ' ' || imp.ano_letivo,
      coalesce(imp.origem, 'Não identificada'), imp.ano_letivo,
      imp.materia_codigo, versao_num, 'rascunho', imp.importado_por, imp.id
    ) returning id into curr_id;
    curriculo_novo := true;
  elsif anterior_id is not null then
    select coalesce(max(versao), 0) + 1 into versao_num
    from public.curriculos
    where origem = coalesce(imp.origem, 'Não identificada')
      and ano_letivo = imp.ano_letivo
      and materia_codigo = imp.materia_codigo;
    insert into public.curriculos (nome, origem, ano_letivo, materia_codigo, versao, status, criado_por, importacao_id)
    values (
      coalesce(imp.origem, 'Currículo importado') || ' ' || imp.ano_letivo,
      coalesce(imp.origem, 'Não identificada'), imp.ano_letivo,
      imp.materia_codigo, versao_num, 'rascunho', imp.importado_por, imp.id
    ) returning id into curr_id;
    curriculo_novo := true;
  end if;

  if curr_id is null then
    raise exception 'Currículo compatível não encontrado';
  end if;

  if anterior_id is not null then
    for periodo_anterior in
      select cp.*
      from public.curriculo_periodos cp
      where cp.curriculo_id = anterior_id
    loop
      select exists (
        select 1
        from public.importacoes_curriculo_itens i
        where i.importacao_id = imp.id
          and i.tipo = 'habilidade'
          and i.status in ('ok', 'aprovado')
          and upper(i.payload ->> 'codigo') ~ '^EM\d{2}[A-Z]{2}\d{2}$'
          and nullif(i.payload ->> 'serie', '')::smallint = periodo_anterior.serie
          and coalesce(nullif(i.payload ->> 'trimestre', '')::smallint, imp.trimestre) = periodo_anterior.trimestre
      ) into periodo_afetado;
      if not periodo_afetado then
        insert into public.curriculo_periodos (curriculo_id, serie, trimestre)
        values (curr_id, periodo_anterior.serie, periodo_anterior.trimestre)
        on conflict (curriculo_id, serie, trimestre) do update set trimestre = excluded.trimestre
        returning * into periodo;
        insert into public.habilidade_curriculo_periodos (habilidade_id, periodo_id, quinzena, semana, source_page)
        select hcp.habilidade_id, periodo.id, hcp.quinzena, hcp.semana, hcp.source_page
        from public.habilidade_curriculo_periodos hcp
        where hcp.periodo_id = periodo_anterior.id
        on conflict (habilidade_id, periodo_id) do update
          set quinzena = excluded.quinzena, semana = excluded.semana, source_page = excluded.source_page;
        insert into public.habilidade_descritores (habilidade_id, descritor_id, periodo_id)
        select hd.habilidade_id, hd.descritor_id, periodo.id
        from public.habilidade_descritores hd
        where hd.periodo_id = periodo_anterior.id
        on conflict do nothing;
        insert into public.expectativas_aprendizagem (habilidade_id, periodo_id, descricao)
        select ea.habilidade_id, periodo.id, ea.descricao
        from public.expectativas_aprendizagem ea
        where ea.periodo_id = periodo_anterior.id
        on conflict do nothing;
        insert into public.habilidade_objetos (habilidade_id, objeto_id, periodo_id)
        select ho.habilidade_id, ho.objeto_id, periodo.id
        from public.habilidade_objetos ho
        where ho.periodo_id = periodo_anterior.id
        on conflict do nothing;
      end if;
    end loop;
  end if;

  for item in
    select payload from public.importacoes_curriculo_itens
    where importacao_id = imp.id
      and tipo = 'habilidade'
      and status in ('ok', 'aprovado')
      and upper(payload ->> 'codigo') ~ '^EM\d{2}[A-Z]{2}\d{2}$'
  loop
    serie_num := nullif((item ->> 'serie')::smallint, 0);
    tri_num := coalesce(nullif((item ->> 'trimestre')::smallint, 0), imp.trimestre);
    if serie_num is null or tri_num is null then raise exception 'Habilidade sem série ou trimestre'; end if;
    insert into public.curriculo_periodos (curriculo_id, serie, trimestre)
    values (curr_id, serie_num, tri_num)
    on conflict (curriculo_id, serie, trimestre) do update set trimestre = excluded.trimestre
    returning * into periodo;
    insert into public.habilidades_curriculares (codigo, descricao, materia_codigo)
    values (upper(item ->> 'codigo'), coalesce(nullif(item ->> 'descricao', ''), 'Descrição pendente'), imp.materia_codigo)
    on conflict (codigo, materia_codigo) do update
      set descricao = case when public.habilidades_curriculares.descricao = 'Descrição pendente' then excluded.descricao else public.habilidades_curriculares.descricao end
    returning * into habilidade;
    insert into public.habilidade_curriculo_periodos (habilidade_id, periodo_id, quinzena, semana, source_page)
    values (habilidade.id, periodo.id, item ->> 'quinzena', item ->> 'semana', nullif(item ->> 'source_page', '')::integer)
    on conflict (habilidade_id, periodo_id) do update
      set quinzena = excluded.quinzena, semana = excluded.semana, source_page = excluded.source_page;
    for child in select value from jsonb_array_elements(coalesce(item -> 'descritores', '[]'::jsonb)) loop
      insert into public.descritores_curriculares (codigo, titulo, descricao, materia_codigo, serie, trimestre, status)
      values (upper(child ->> 'code'), upper(child ->> 'code'), nullif(child ->> 'descricao', ''), imp.materia_codigo, serie_num, tri_num, 'ativo')
      on conflict (codigo) do update
        set descricao = coalesce(public.descritores_curriculares.descricao, excluded.descricao),
            status = case when public.descritores_curriculares.status = 'revisao' then 'ativo' else public.descritores_curriculares.status end
      returning * into descritor;
      insert into public.habilidade_descritores values (habilidade.id, descritor.id, periodo.id) on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'expectativas', '[]'::jsonb)) loop
      insert into public.expectativas_aprendizagem (habilidade_id, periodo_id, descricao)
      values (habilidade.id, periodo.id, child #>> '{}') on conflict do nothing;
    end loop;
    for child in select value from jsonb_array_elements(coalesce(item -> 'objetos', '[]'::jsonb)) loop
      insert into public.objetos_conhecimento (descricao)
      values (child #>> '{}') on conflict (descricao) do update set descricao = excluded.descricao returning * into objeto;
      insert into public.habilidade_objetos values (habilidade.id, objeto.id, periodo.id) on conflict do nothing;
    end loop;
  end loop;

  update public.curriculos
  set status = 'publicado', ativo = true, updated_at = now()
  where id = curr_id;
  if anterior_id is not null then
    update public.curriculos
    set status = 'arquivado', ativo = false, updated_at = now()
    where id = anterior_id;
  end if;
  update public.importacoes_curriculo
  set status = 'aprovada', curriculo_id = curr_id, versao = (select versao from public.curriculos where id = curr_id), updated_at = now()
  where id = imp.id;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes)
  values (
    (select auth.uid()), 'aprovacao_publicacao', 'curriculo', curr_id::text,
    jsonb_build_object('importacao_id', imp.id, 'versao', (select versao from public.curriculos where id = curr_id), 'curriculo_reutilizado', not curriculo_novo, 'reprocessamento', imp.reprocessamento_de_id is not null, 'curriculo_anterior_id', anterior_id)
  );
  return curr_id;
end;
$$;

revoke all on function public.aprovar_importacao_curriculo(uuid) from public, anon, authenticated;
grant execute on function public.aprovar_importacao_curriculo(uuid) to authenticated;

commit;
