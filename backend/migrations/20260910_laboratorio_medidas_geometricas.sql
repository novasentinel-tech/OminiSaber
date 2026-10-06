-- OminiSaber | Laboratorio de medidas geometricas 2D e 3D

begin;

create or replace function private.validar_questao_avaliacao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_modo text := nullif(new.configuracao->>'mathMode', '');
  v_min numeric;
  v_max numeric;
  v_step numeric;
  v_target numeric;
  v_min_y numeric;
  v_max_y numeric;
  v_target_y numeric;
  v_dimension text;
  v_shape text;
  v_target_type text;
  v_required_keys text[];
  v_key text;
  v_sides integer;
begin
  if v_modo is not null
     and v_modo not in (
       'livre',
       'plano_cartesiano',
       'reta_numerica',
       'pitagoras',
       'geometria_medidas',
       'grafico_barras'
     ) then
    raise exception 'Modelo matematico invalido.';
  end if;

  if new.tipo in ('unica_escolha', 'multipla_escolha')
     and jsonb_array_length(new.alternativas) < 2 then
    raise exception 'Questoes objetivas precisam de pelo menos duas alternativas.';
  end if;

  if new.tipo = 'associacao' then
    if jsonb_typeof(new.configuracao->'pairs') <> 'array'
       or jsonb_array_length(new.configuracao->'pairs') < 2
       or exists (
         select 1
         from jsonb_array_elements(new.configuracao->'pairs') par
         where jsonb_typeof(par) <> 'object'
            or btrim(coalesce(par->>'left', '')) = ''
            or btrim(coalesce(par->>'right', '')) = ''
       ) then
      raise exception 'A associacao precisa de pelo menos dois pares completos.';
    end if;
  elsif new.tipo = 'ordenacao' and jsonb_array_length(new.alternativas) < 2 then
    raise exception 'A ordenacao precisa de pelo menos dois itens.';
  end if;

  if v_modo = 'plano_cartesiano' then
    if new.tipo <> 'resposta_curta' then
      raise exception 'O plano cartesiano deve usar resposta curta.';
    end if;
    begin
      v_min := (new.configuracao->>'minX')::numeric;
      v_max := (new.configuracao->>'maxX')::numeric;
      v_target := (new.configuracao->>'targetX')::numeric;
      v_min_y := (new.configuracao->>'minY')::numeric;
      v_max_y := (new.configuracao->>'maxY')::numeric;
      v_target_y := (new.configuracao->>'targetY')::numeric;
    exception when others then
      raise exception 'Os eixos e o ponto do plano cartesiano precisam ser numericos.';
    end;
    if v_max <= v_min or v_max_y <= v_min_y
       or v_target not between v_min and v_max
       or v_target_y not between v_min_y and v_max_y
       or v_target <> trunc(v_target)
       or v_target_y <> trunc(v_target_y) then
      raise exception 'Revise os limites e o ponto inteiro do plano cartesiano.';
    end if;
  elsif v_modo = 'reta_numerica' then
    if new.tipo <> 'numerica' then
      raise exception 'A reta numerica deve usar resposta numerica.';
    end if;
    begin
      v_min := (new.configuracao->>'min')::numeric;
      v_max := (new.configuracao->>'max')::numeric;
      v_step := (new.configuracao->>'step')::numeric;
      v_target := (new.configuracao->>'target')::numeric;
    exception when others then
      raise exception 'Os valores da reta numerica precisam ser numericos.';
    end;
    if v_max <= v_min or v_step <= 0 or v_target not between v_min and v_max then
      raise exception 'Revise os limites, o intervalo e a resposta da reta numerica.';
    end if;
  elsif v_modo = 'pitagoras' then
    if new.tipo <> 'numerica' then
      raise exception 'O modelo de triangulo deve usar resposta numerica.';
    end if;
    begin
      v_min := (new.configuracao->>'sideA')::numeric;
      v_max := (new.configuracao->>'sideB')::numeric;
      v_step := (new.configuracao->>'sideC')::numeric;
      v_target := (new.configuracao->>'target')::numeric;
    exception when others then
      raise exception 'As medidas do triangulo precisam ser numericas.';
    end;
    if least(v_min, v_max, v_step, v_target) <= 0 then
      raise exception 'As medidas e a resposta do triangulo precisam ser maiores que zero.';
    end if;
  elsif v_modo = 'geometria_medidas' then
    if new.tipo <> 'numerica' then
      raise exception 'O laboratorio de medidas deve usar resposta numerica.';
    end if;

    v_dimension := new.configuracao->>'dimension';
    v_shape := new.configuracao->>'shape';
    v_target_type := new.configuracao->>'targetType';

    if v_dimension is null or v_dimension not in ('2d', '3d') then
      raise exception 'A dimensao geometrica deve ser 2d ou 3d.';
    end if;
    if (v_dimension = '2d' and v_shape not in (
         'quadrado', 'retangulo', 'triangulo', 'circulo', 'trapezio',
         'losango', 'poligono_regular', 'personalizada_2d'
       )) or (v_dimension = '3d' and v_shape not in (
         'cubo', 'paralelepipedo', 'cilindro', 'cone', 'esfera',
         'prisma', 'piramide', 'personalizada_3d'
       )) then
      raise exception 'A forma geometrica nao pertence a dimensao selecionada.';
    end if;
    if v_target_type is null or (v_dimension = '2d' and v_target_type not in (
         'area', 'perimetro', 'diagonal', 'medida_desconhecida'
       )) or (v_dimension = '3d' and v_target_type not in (
         'volume', 'area_total', 'area_lateral', 'medida_desconhecida'
       )) then
      raise exception 'O objetivo de calculo nao pertence a dimensao selecionada.';
    end if;
    if btrim(coalesce(new.configuracao->>'unit', '')) = ''
       or char_length(new.configuracao->>'unit') > 12 then
      raise exception 'Informe uma unidade de medida com ate 12 caracteres.';
    end if;
    if v_shape in ('personalizada_2d', 'personalizada_3d')
       and btrim(coalesce(new.configuracao->>'customName', '')) = '' then
      raise exception 'A forma personalizada precisa de um nome.';
    end if;

    v_required_keys := case v_shape
      when 'quadrado' then array['measureA']
      when 'retangulo' then array['measureA', 'measureB']
      when 'triangulo' then array['measureA', 'measureB', 'measureC', 'measureD']
      when 'circulo' then array['measureA']
      when 'trapezio' then array['measureA', 'measureB', 'measureC', 'measureD']
      when 'losango' then array['measureA', 'measureB', 'measureC']
      when 'poligono_regular' then array['measureA', 'measureB']
      when 'cubo' then array['measureA']
      when 'paralelepipedo' then array['measureA', 'measureB', 'measureC']
      when 'cilindro' then array['measureA', 'measureB']
      when 'cone' then array['measureA', 'measureB', 'measureC']
      when 'esfera' then array['measureA']
      when 'prisma' then array['measureA', 'measureB', 'measureC']
      when 'piramide' then array['measureA', 'measureB', 'measureC', 'measureD']
      else array['measureA', 'measureB', 'measureC', 'measureD']
    end;

    foreach v_key in array v_required_keys loop
      begin
        v_min := (new.configuracao->>v_key)::numeric;
      exception when others then
        raise exception 'A medida % precisa ser numerica.', v_key;
      end;
      if v_min is null or v_min <= 0 then
        raise exception 'Todas as medidas geometricas precisam ser maiores que zero.';
      end if;
    end loop;

    if v_shape in ('poligono_regular', 'prisma', 'piramide') then
      begin
        v_sides := (new.configuracao->>'sides')::integer;
      exception when others then
        raise exception 'O numero de lados da base precisa ser inteiro.';
      end;
      if v_sides is null or v_sides not between 3 and 20 then
        raise exception 'O numero de lados da base deve estar entre 3 e 20.';
      end if;
    end if;

    begin
      v_target := (new.configuracao->>'target')::numeric;
      v_step := coalesce(nullif(new.configuracao->>'tolerance', '')::numeric, 0);
    exception when others then
      raise exception 'A resposta e a tolerancia precisam ser numericas.';
    end;
    if v_target is null or v_step is null then
      raise exception 'A resposta e a tolerancia sao obrigatorias.';
    end if;
    if v_step < 0 then
      raise exception 'A tolerancia nao pode ser negativa.';
    end if;
  elsif v_modo = 'grafico_barras' then
    if new.tipo <> 'unica_escolha'
       or jsonb_typeof(new.configuracao->'chartData') <> 'array'
       or jsonb_array_length(new.configuracao->'chartData') < 2
       or btrim(coalesce(new.configuracao->>'correctLabel', '')) = ''
       or exists (
         select 1
         from jsonb_array_elements(new.configuracao->'chartData') barra
         where jsonb_typeof(barra) <> 'object'
            or btrim(coalesce(barra->>'label', '')) = ''
            or jsonb_typeof(barra->'value') <> 'number'
       )
       or not exists (
         select 1
         from jsonb_array_elements(new.configuracao->'chartData') barra
         where barra->>'label' = new.configuracao->>'correctLabel'
       ) then
      raise exception 'O grafico precisa de ao menos duas barras e uma categoria correta valida.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validar_questao_avaliacao()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
