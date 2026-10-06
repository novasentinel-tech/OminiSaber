-- OmniStudio: metadados públicos de fórmulas, resolução guiada e plano cartesiano.
-- O banco limita o contrato; expressões nunca são executadas como SQL ou JavaScript.
begin;

-- Preserva integralmente as regras de percurso, gabarito e permissões existentes.
-- A condição torna esta extensão reaplicável sem renomear seu próprio wrapper.
do $$
begin
  if to_regprocedure('private.studio_validar_trabalho_base_integrado(jsonb)') is null then
    alter function private.studio_validar_trabalho(jsonb) rename to studio_validar_trabalho_base_integrado;
  end if;
end;
$$;

create or replace function private.studio_validar_trabalho(p_work jsonb)
returns void language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_bloco jsonb;
  v_config jsonb;
  v_variaveis jsonb;
  v_campo text;
  v_chave text;
  v_valor jsonb;
  v_x_min numeric;
  v_x_max numeric;
  v_y_min numeric;
  v_y_max numeric;
begin
  perform private.studio_validar_trabalho_base_integrado(p_work);
  for v_bloco in select value from jsonb_array_elements(p_work->'blocks') loop
    if v_bloco->>'type' in ('formula','graph') and (jsonb_typeof(v_bloco->'expression') is distinct from 'string'
      or char_length(v_bloco->>'expression') > 2000) then
      raise exception 'A formula ou funcao deve ser um texto de ate 2000 caracteres.';
    end if;
    if v_bloco->>'type' = 'graph' and (select count(*)
      from regexp_split_to_table(v_bloco->>'expression',E'[;\n]') as funcoes(expressao)
      where btrim(expressao) <> '') > 3 then
      raise exception 'Compare no maximo tres funcoes por plano cartesiano, uma por linha ou separadas por ponto e virgula.';
    end if;
    if v_bloco ? 'mathExpression' and (jsonb_typeof(v_bloco->'mathExpression') is distinct from 'string'
      or char_length(v_bloco->>'mathExpression') > 2000) then
      raise exception 'A expressao matematica deve ser um texto de ate 2000 caracteres.';
    end if;
    if v_bloco ? 'solutionSteps' and (jsonb_typeof(v_bloco->'solutionSteps') is distinct from 'string'
      or char_length(v_bloco->>'solutionSteps') > 8000) then
      raise exception 'As orientacoes da resolucao devem ser um texto de ate 8000 caracteres.';
    end if;

    v_config := coalesce(v_bloco->'graphSettings','{}'::jsonb);
    if jsonb_typeof(v_config) is distinct from 'object' then
      raise exception 'As configuracoes do plano cartesiano precisam ser um objeto.';
    end if;
    foreach v_campo in array array['xMin','xMax','yMin','yMax'] loop
      if v_config ? v_campo then
        if jsonb_typeof(v_config->v_campo) is distinct from 'number'
          or abs((v_config->>v_campo)::numeric) > 1000000 then
          raise exception 'Os limites do plano cartesiano precisam ser numeros entre -1000000 e 1000000.';
        end if;
      end if;
    end loop;
    foreach v_campo in array array['autoY','showTable'] loop
      if v_config ? v_campo and jsonb_typeof(v_config->v_campo) is distinct from 'boolean' then
        raise exception 'A escala automatica e a exibicao da tabela precisam ser valores booleanos.';
      end if;
    end loop;
    v_x_min := coalesce((v_config->>'xMin')::numeric,-5);
    v_x_max := coalesce((v_config->>'xMax')::numeric,5);
    if v_x_max - v_x_min < 0.0001 then
      raise exception 'O maximo de x precisa ser maior que o minimo, com uma janela de pelo menos 0.0001.';
    end if;
    if coalesce((v_config->>'autoY')::boolean,true) = false then
      v_y_min := coalesce((v_config->>'yMin')::numeric,-5);
      v_y_max := coalesce((v_config->>'yMax')::numeric,5);
      if v_y_max - v_y_min < 0.0001 then
        raise exception 'O maximo de y precisa ser maior que o minimo, com uma janela de pelo menos 0.0001.';
      end if;
    end if;

    -- Os parâmetros são números públicos escolhidos pelo professor, não código nem gabarito.
    for v_variaveis in
      select value from (values
        (coalesce(v_bloco->'mathVariables','{}'::jsonb)),
        (coalesce(v_config->'variables','{}'::jsonb))
      ) as conjuntos(value)
    loop
      if jsonb_typeof(v_variaveis) is distinct from 'object'
        or (select count(*) from jsonb_object_keys(v_variaveis)) > 26 then
        raise exception 'Use um objeto com ate 26 variaveis matematicas.';
      end if;
      for v_chave,v_valor in select key,value from jsonb_each(v_variaveis) loop
        if v_chave !~ '^[a-z]$' or jsonb_typeof(v_valor) is distinct from 'number'
          or abs((v_valor #>> '{}')::numeric) > 1000000 then
          raise exception 'Cada variavel deve ter uma letra minuscula e um valor numerico entre -1000000 e 1000000.';
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

-- Helpers continuam privados. Nenhuma nova RPC ou permissão de tabela é criada.
revoke all on function private.studio_validar_trabalho_base_integrado(jsonb) from public,anon,authenticated;
revoke all on function private.studio_validar_trabalho(jsonb) from public,anon,authenticated;

comment on function private.studio_validar_trabalho(jsonb) is
  'Valida percurso e metadados matematicos publicos limitados, sem executar expressoes ou expor gabaritos.';

commit;
