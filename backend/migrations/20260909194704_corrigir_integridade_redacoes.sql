begin;

-- Uma correção só é válida quando as cinco competências existem e totalizam a
-- mesma nota apresentada na redação.
create or replace function public.corrigir_redacao(
  redacao_input uuid,
  nota_input numeric,
  feedback_input text,
  competencias_input jsonb default '[]'::jsonb,
  comentarios_input jsonb default '[]'::jsonb
)
returns public.redacoes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resultado public.redacoes;
  item jsonb;
  competencia_numero smallint;
  competencia_nota smallint;
  quantidade_competencias integer;
  competencias_distintas integer;
  soma_competencias integer;
begin
  if nota_input is null or nota_input < 0 or nota_input > 1000 then
    raise exception 'A nota deve estar entre 0 e 1000.';
  end if;
  if char_length(pg_catalog.btrim(coalesce(feedback_input, ''))) < 2 then
    raise exception 'A devolutiva precisa ser preenchida.';
  end if;
  if jsonb_typeof(coalesce(competencias_input, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(comentarios_input, '[]'::jsonb)) <> 'array' then
    raise exception 'Competências e comentários devem ser listas.';
  end if;

  select count(*), count(distinct (value ->> 'competencia')::smallint),
         coalesce(sum((value ->> 'nota')::smallint), 0)
  into quantidade_competencias, competencias_distintas, soma_competencias
  from jsonb_array_elements(competencias_input);

  if quantidade_competencias <> 5 or competencias_distintas <> 5 then
    raise exception 'Informe exatamente as cinco competências, sem repetição.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(competencias_input) competencia
    where (competencia ->> 'competencia')::smallint not between 1 and 5
       or (competencia ->> 'nota')::smallint not in (0, 40, 80, 120, 160, 200)
  ) then
    raise exception 'Competência ou nota inválida.';
  end if;
  if soma_competencias::numeric <> nota_input then
    raise exception 'A nota final deve ser igual à soma das cinco competências.';
  end if;
  if (select public.usuario_role()) <> 'gestor' and not (
    (select public.usuario_tipo_professor()) = 'portugues'
    and exists (
      select 1
      from public.redacoes r
      join public.perfis aluno on aluno.id = r.aluno_id
      join public.professor_turmas pt on pt.turma_id = aluno.turma_id
      where r.id = redacao_input and pt.professor_id = (select auth.uid())
    )
  ) then
    raise exception 'Sem permissão para corrigir esta redação.';
  end if;

  update public.redacoes
  set nota = nota_input,
      feedback = pg_catalog.btrim(feedback_input),
      status = 'corrigida',
      corrigida_por = (select auth.uid()),
      corrigida_em = now()
  where id = redacao_input
  returning * into resultado;
  if resultado.id is null then raise exception 'Redação não encontrada.'; end if;

  for item in select value from jsonb_array_elements(competencias_input) loop
    competencia_numero := (item ->> 'competencia')::smallint;
    competencia_nota := (item ->> 'nota')::smallint;
    insert into public.avaliacoes_competencias_redacao
      (redacao_id, competencia, nota, comentario, professor_id)
    values (
      redacao_input,
      competencia_numero,
      competencia_nota,
      nullif(item ->> 'comentario', ''),
      (select auth.uid())
    )
    on conflict (redacao_id, competencia) do update
      set nota = excluded.nota,
          comentario = excluded.comentario,
          professor_id = excluded.professor_id,
          updated_at = now();
  end loop;

  for item in select value from jsonb_array_elements(coalesce(comentarios_input, '[]'::jsonb)) loop
    insert into public.comentarios_redacao
      (redacao_id, professor_id, inicio_offset, fim_offset, trecho, comentario, tipo)
    values (
      redacao_input,
      (select auth.uid()),
      nullif(item ->> 'inicioOffset', '')::integer,
      nullif(item ->> 'fimOffset', '')::integer,
      nullif(item ->> 'trecho', ''),
      item ->> 'comentario',
      coalesce(nullif(item ->> 'tipo', ''), 'orientacao')
    );
  end loop;

  delete from public.rascunhos_correcao_redacao
  where redacao_id = redacao_input and professor_id = (select auth.uid());
  return resultado;
end;
$$;

revoke all on function public.corrigir_redacao(uuid,numeric,text,jsonb,jsonb)
  from public, anon;
grant execute on function public.corrigir_redacao(uuid,numeric,text,jsonb,jsonb)
  to authenticated;

-- Repara o registro de demonstração que originou o relatório. A nota anterior,
-- 780, não é representável pela matriz de cinco competências em passos de 40.
insert into public.avaliacoes_competencias_redacao
  (redacao_id, competencia, nota, comentario, professor_id)
select
  r.id,
  valores.competencia,
  valores.nota,
  valores.comentario,
  r.corrigida_por
from public.redacoes r
cross join (
  values
    (1::smallint, 160::smallint, 'Bom domínio da norma-padrão.'::text),
    (2::smallint, 160::smallint, 'Tema compreendido e tese bem delimitada.'::text),
    (3::smallint, 160::smallint, 'Argumentos pertinentes; amplie o repertório.'::text),
    (4::smallint, 160::smallint, 'Boa articulação entre as ideias.'::text),
    (5::smallint, 120::smallint, 'Detalhe melhor os meios da intervenção.'::text)
) as valores(competencia, nota, comentario)
where r.id = 'd2400000-0000-4000-8000-000000000022'
  and r.status = 'corrigida'
  and r.corrigida_por is not null
on conflict (redacao_id, competencia) do update
set nota = excluded.nota,
    comentario = excluded.comentario,
    professor_id = excluded.professor_id,
    updated_at = now();

update public.redacoes
set nota = 760
where id = 'd2400000-0000-4000-8000-000000000022'
  and status = 'corrigida';

-- Correções incompletas que não são o registro de demonstração voltam para a
-- fila docente. A devolutiva textual é preservada, mas a nota inválida é removida.
update public.redacoes r
set status = 'enviada',
    nota = null,
    corrigida_por = null,
    corrigida_em = null
where r.status = 'corrigida'
  and (
    select count(*) <> 5
        or count(distinct c.competencia) <> 5
        or coalesce(sum(c.nota), 0)::numeric <> r.nota
    from public.avaliacoes_competencias_redacao c
    where c.redacao_id = r.id
  );

create or replace function private.validar_integridade_correcao_redacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  redacao_id_validada uuid;
  redacao_validada public.redacoes;
  quantidade integer;
  soma integer;
begin
  if tg_table_name = 'redacoes' then
    if tg_op = 'DELETE' then redacao_id_validada := old.id;
    else redacao_id_validada := new.id;
    end if;
  else
    if tg_op = 'DELETE' then redacao_id_validada := old.redacao_id;
    else redacao_id_validada := new.redacao_id;
    end if;
  end if;

  select * into redacao_validada
  from public.redacoes
  where id = redacao_id_validada;

  if redacao_validada.id is not null and redacao_validada.status = 'corrigida' then
    select count(*), coalesce(sum(nota), 0)
    into quantidade, soma
    from public.avaliacoes_competencias_redacao
    where redacao_id = redacao_id_validada;

    if redacao_validada.nota is null
       or redacao_validada.corrigida_por is null
       or redacao_validada.corrigida_em is null
       or quantidade <> 5
       or soma::numeric <> redacao_validada.nota then
      raise exception 'Redação corrigida exige cinco competências cuja soma seja igual à nota final.';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.validar_integridade_correcao_redacao()
  from public, anon, authenticated;

drop trigger if exists validar_redacao_corrigida on public.redacoes;
create constraint trigger validar_redacao_corrigida
after insert or update of status, nota, corrigida_por, corrigida_em
on public.redacoes
deferrable initially deferred
for each row execute function private.validar_integridade_correcao_redacao();

drop trigger if exists validar_competencias_redacao_corrigida
  on public.avaliacoes_competencias_redacao;
create constraint trigger validar_competencias_redacao_corrigida
after insert or update or delete on public.avaliacoes_competencias_redacao
deferrable initially deferred
for each row execute function private.validar_integridade_correcao_redacao();

notify pgrst, 'reload schema';

commit;
