begin;

create or replace function public.salvar_descritores_curriculares_lote(p_descritores jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  payload jsonb;
  resultado jsonb := '[]'::jsonb;
  codigos text[] := '{}';
  codigo text;
  titulo text;
  descricao text;
  materia_text text;
  materia public.materia_aluno;
  serie_num smallint;
  trimestre_num smallint;
  status_text text;
  habilidade_id uuid;
  v_descritor_id uuid;
  periodo_id uuid;
  habilidade public.habilidades_curriculares;
  v_periodo public.curriculo_periodos;
  contador integer := 0;
begin
  if (select auth.uid()) is null or public.usuario_role() <> 'gestor' then
    raise exception 'Somente gestores podem cadastrar descritores';
  end if;
  if jsonb_typeof(p_descritores) <> 'array' or jsonb_array_length(p_descritores) not between 1 and 5 then
    raise exception 'O lote deve conter entre 1 e 5 descritores';
  end if;

  for item in select value from jsonb_array_elements(p_descritores) loop
    contador := contador + 1;
    codigo := upper(btrim(item ->> 'codigo'));
    titulo := btrim(item ->> 'titulo');
    descricao := btrim(item ->> 'descricao');
    materia_text := btrim(item ->> 'materia_codigo');
    serie_num := nullif(item ->> 'serie', '')::smallint;
    trimestre_num := nullif(item ->> 'trimestre', '')::smallint;
    status_text := btrim(coalesce(item ->> 'status', 'revisao'));
    habilidade_id := nullif(item ->> 'habilidade_id', '')::uuid;

    if codigo !~ '^D\d{3}(?:_[A-Z])?$' then raise exception 'Código de descritor inválido no item %', contador; end if;
    if titulo is null or char_length(titulo) not between 3 and 180 then raise exception 'Título inválido no item %', contador; end if;
    if descricao is null or char_length(descricao) not between 1 and 20000 then raise exception 'Descrição inválida no item %', contador; end if;
    if materia_text not in ('portugues', 'matematica', 'fisica', 'redacao', 'tecnico_administracao', 'tecnico_informatica') then raise exception 'Matéria inválida no item %', contador; end if;
    materia := materia_text::public.materia_aluno;
    if serie_num not between 1 and 3 or trimestre_num not between 1 and 3 then raise exception 'Série ou trimestre inválido no item %', contador; end if;
    if status_text not in ('ativo', 'revisao', 'arquivado') then raise exception 'Status inválido no item %', contador; end if;
    if codigo = any(codigos) then raise exception 'Código % repetido no lote', codigo; end if;
    if exists (select 1 from public.descritores_curriculares dc where dc.codigo = batch_fn.codigo) then raise exception 'Código % já cadastrado', batch_fn.codigo; end if;
    codigos := array_append(codigos, codigo);

    if habilidade_id is not null then
      select h.* into habilidade from public.habilidades_curriculares h where h.id = habilidade_id;
      if habilidade.id is null then raise exception 'Habilidade selecionada não encontrada'; end if;
      if habilidade.materia_codigo <> materia then raise exception 'Habilidade % não pertence à matéria %', habilidade.codigo, materia_text; end if;
      select cp.* into v_periodo
      from public.habilidade_curriculo_periodos hcp
      join public.curriculo_periodos cp on cp.id = hcp.periodo_id
      join public.curriculos c on c.id = cp.curriculo_id
      where hcp.habilidade_id = habilidade_id and cp.serie = serie_num and cp.trimestre = trimestre_num and c.status = 'publicado' and c.ativo = true
      order by c.versao desc limit 1;
      if v_periodo.id is null then raise exception 'A habilidade % não possui período curricular publicado compatível com %ª série / %º trimestre', habilidade.codigo, serie_num, trimestre_num; end if;
      periodo_id := v_periodo.id;
    end if;

    insert into public.descritores_curriculares (codigo, titulo, descricao, materia_codigo, serie, trimestre, status, criado_por)
    values (codigo, titulo, descricao, materia, serie_num, trimestre_num, status_text, (select auth.uid()))
    returning id into v_descritor_id;

    if habilidade_id is not null then
      insert into public.habilidade_descritores (habilidade_id, descritor_id, periodo_id)
      values (habilidade_id, v_descritor_id, periodo_id);
    end if;
    resultado := resultado || jsonb_build_array(jsonb_build_object('id', v_descritor_id, 'codigo', codigo));
  end loop;

  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes)
  values ((select auth.uid()), 'cadastro_descritores_lote', 'descritores_curriculares', null, jsonb_build_object('quantidade', jsonb_array_length(p_descritores), 'codigos', to_jsonb(codigos)));
  return jsonb_build_object('quantidade', jsonb_array_length(p_descritores), 'descritores', resultado);
end;
$$;

create or replace function public.atualizar_descritor_curricular(p_descritor_id uuid, p_descritor jsonb)
returns public.descritores_curriculares
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resultado public.descritores_curriculares;
  codigo text := upper(btrim(p_descritor ->> 'codigo'));
  titulo text := btrim(p_descritor ->> 'titulo');
  descricao text := btrim(p_descritor ->> 'descricao');
  materia_text text := btrim(p_descritor ->> 'materia_codigo');
  materia public.materia_aluno;
  serie_num smallint := nullif(p_descritor ->> 'serie', '')::smallint;
  trimestre_num smallint := nullif(p_descritor ->> 'trimestre', '')::smallint;
  status_text text := btrim(coalesce(p_descritor ->> 'status', 'revisao'));
  habilidade_id uuid := nullif(p_descritor ->> 'habilidade_id', '')::uuid;
  habilidade public.habilidades_curriculares;
  v_periodo public.curriculo_periodos;
  v_descritor_atual public.descritores_curriculares;
begin
  if (select auth.uid()) is null or public.usuario_role() <> 'gestor' then raise exception 'Somente gestores podem editar descritores'; end if;
  select * into v_descritor_atual from public.descritores_curriculares where id = p_descritor_id for update;
  if v_descritor_atual.id is null then raise exception 'Descritor não encontrado'; end if;
  if codigo !~ '^D\d{3}(?:_[A-Z])?$' then raise exception 'Código de descritor inválido'; end if;
  if titulo is null or char_length(titulo) not between 3 and 180 then raise exception 'Título inválido'; end if;
  if descricao is null or char_length(descricao) not between 1 and 20000 then raise exception 'Descrição inválida'; end if;
  if materia_text not in ('portugues', 'matematica', 'fisica', 'redacao', 'tecnico_administracao', 'tecnico_informatica') then raise exception 'Matéria inválida'; end if;
  materia := materia_text::public.materia_aluno;
  if serie_num not between 1 and 3 or trimestre_num not between 1 and 3 then raise exception 'Série ou trimestre inválido'; end if;
  if status_text not in ('ativo', 'revisao', 'arquivado') then raise exception 'Status inválido'; end if;
  if exists (select 1 from public.descritores_curriculares dc where dc.codigo = upper(btrim(p_descritor ->> 'codigo')) and dc.id <> p_descritor_id) then raise exception 'Código % já cadastrado', codigo; end if;

  if habilidade_id is not null then
    select h.* into habilidade from public.habilidades_curriculares h where h.id = habilidade_id;
    if habilidade.id is null then raise exception 'Habilidade selecionada não encontrada'; end if;
    if habilidade.materia_codigo <> materia then raise exception 'Habilidade % não pertence à matéria %', habilidade.codigo, materia_text; end if;
    select cp.* into v_periodo
    from public.habilidade_curriculo_periodos hcp
    join public.curriculo_periodos cp on cp.id = hcp.periodo_id
    join public.curriculos c on c.id = cp.curriculo_id
    where hcp.habilidade_id = habilidade_id and cp.serie = serie_num and cp.trimestre = trimestre_num and c.status = 'publicado' and c.ativo = true
    order by c.versao desc limit 1;
    if v_periodo.id is null then raise exception 'A habilidade % não possui período curricular publicado compatível com %ª série / %º trimestre', habilidade.codigo, serie_num, trimestre_num; end if;
  end if;

  update public.descritores_curriculares
  set codigo = upper(btrim(p_descritor ->> 'codigo')), titulo = btrim(p_descritor ->> 'titulo'), descricao = btrim(p_descritor ->> 'descricao'), materia_codigo = btrim(p_descritor ->> 'materia_codigo')::public.materia_aluno, serie = nullif(p_descritor ->> 'serie', '')::smallint, trimestre = nullif(p_descritor ->> 'trimestre', '')::smallint, status = btrim(coalesce(p_descritor ->> 'status', 'revisao')), updated_at = now()
  where id = p_descritor_id
  returning * into v_resultado;
  delete from public.habilidade_descritores where descritor_id = p_descritor_id;
  if habilidade_id is not null then
    insert into public.habilidade_descritores (habilidade_id, descritor_id, periodo_id)
    values (habilidade_id, p_descritor_id, v_periodo.id);
  end if;
  insert into public.gestor_auditoria (gestor_id, acao, recurso, recurso_id, detalhes)
  values ((select auth.uid()), 'edicao_descritor', 'descritores_curriculares', p_descritor_id::text, jsonb_build_object('codigo', codigo, 'habilidade_id', habilidade_id));
  return v_resultado;
end;
$$;

revoke all on function public.salvar_descritores_curriculares_lote(jsonb) from public, anon;
grant execute on function public.salvar_descritores_curriculares_lote(jsonb) to authenticated;
revoke all on function public.atualizar_descritor_curricular(uuid, jsonb) from public, anon;
grant execute on function public.atualizar_descritor_curricular(uuid, jsonb) to authenticated;

commit;
