-- OminiSaber | Fase 2.4 - resultados, ajustes auditáveis e recuperação

begin;

create table if not exists public.ajustes_notas_avaliacao (
  id uuid primary key default gen_random_uuid(),
  tentativa_id uuid not null references public.tentativas_avaliacao(id) on delete cascade,
  avaliacao_id uuid not null references public.avaliacoes_docentes(id) on delete cascade,
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  ajustado_por uuid not null references public.perfis(id) on delete restrict,
  nota_anterior numeric(6,2),
  nota_nova numeric(6,2) not null check (nota_nova >= 0),
  motivo text not null check (char_length(btrim(motivo)) between 8 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists ajustes_notas_tentativa_idx
  on public.ajustes_notas_avaliacao (tentativa_id, created_at desc);
create index if not exists ajustes_notas_avaliacao_idx
  on public.ajustes_notas_avaliacao (avaliacao_id, created_at desc);
create index if not exists ajustes_notas_aluno_idx
  on public.ajustes_notas_avaliacao (aluno_id);
create index if not exists ajustes_notas_ajustado_por_idx
  on public.ajustes_notas_avaliacao (ajustado_por);

alter table public.ajustes_notas_avaliacao enable row level security;
revoke all on public.ajustes_notas_avaliacao from public, anon, authenticated;
grant select, insert on public.ajustes_notas_avaliacao to authenticated;

drop policy if exists ajustes_notas_select on public.ajustes_notas_avaliacao;
create policy ajustes_notas_select on public.ajustes_notas_avaliacao
for select to authenticated using (
  aluno_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor'
  or exists (select 1 from public.avaliacoes_docentes a
    where a.id = avaliacao_id and a.professor_id = (select auth.uid()))
);

drop policy if exists ajustes_notas_insert on public.ajustes_notas_avaliacao;
create policy ajustes_notas_insert on public.ajustes_notas_avaliacao
for insert to authenticated with check (
  ajustado_por = (select auth.uid())
  and exists (
    select 1 from public.tentativas_avaliacao t
    join public.avaliacoes_docentes a on a.id = t.avaliacao_id
    where t.id = tentativa_id and t.avaliacao_id = avaliacao_id
      and t.aluno_id = aluno_id and t.status = 'corrigida'
      and nota_anterior is not distinct from t.nota
      and nota_nova <= a.valor
      and (a.professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor')
  )
);

create or replace function private.aplicar_ajuste_nota_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tentativas_avaliacao
  set nota = new.nota_nova,
      feedback = 'Nota ajustada pelo professor. Consulte o histórico da avaliação.',
      updated_at = now()
  where id = new.tentativa_id;
  insert into public.avaliacoes_auditoria
    (avaliacao_id, tentativa_id, ator_id, evento, detalhes)
  values (new.avaliacao_id, new.tentativa_id, new.ajustado_por, 'nota_ajustada',
    jsonb_build_object('ajuste_id', new.id, 'nota_anterior', new.nota_anterior,
      'nota_nova', new.nota_nova, 'motivo', new.motivo));
  return new;
end;
$$;

revoke all on function private.aplicar_ajuste_nota_avaliacao()
  from public, anon, authenticated;
drop trigger if exists aplicar_ajuste_nota_avaliacao_trigger on public.ajustes_notas_avaliacao;
create trigger aplicar_ajuste_nota_avaliacao_trigger
after insert on public.ajustes_notas_avaliacao
for each row execute function private.aplicar_ajuste_nota_avaliacao();

create or replace function public.ajustar_nota_avaliacao(
  p_tentativa_id uuid, p_nota numeric, p_motivo text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tentativa public.tentativas_avaliacao;
  v_avaliacao public.avaliacoes_docentes;
  v_id uuid;
begin
  select t.* into v_tentativa from public.tentativas_avaliacao t
  where t.id = p_tentativa_id for share;
  if not found then raise exception 'Tentativa nao encontrada.'; end if;
  select a.* into v_avaliacao from public.avaliacoes_docentes a
  where a.id = v_tentativa.avaliacao_id;
  if v_tentativa.status <> 'corrigida' then raise exception 'Finalize a correcao antes de ajustar a nota.'; end if;
  if v_avaliacao.professor_id <> (select auth.uid())
     and (select public.usuario_role()) <> 'gestor' then raise exception 'Sem permissao para ajustar esta nota.'; end if;
  if p_nota is null or p_nota < 0 or p_nota > v_avaliacao.valor then
    raise exception 'A nota deve estar entre 0 e %.', v_avaliacao.valor;
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 8 then
    raise exception 'Explique o motivo do ajuste com pelo menos 8 caracteres.';
  end if;
  insert into public.ajustes_notas_avaliacao
    (tentativa_id, avaliacao_id, aluno_id, ajustado_por, nota_anterior, nota_nova, motivo)
  values (v_tentativa.id, v_avaliacao.id, v_tentativa.aluno_id, (select auth.uid()),
    v_tentativa.nota, round(p_nota, 2), btrim(p_motivo))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.ajustar_nota_avaliacao(uuid, numeric, text) from public, anon;
grant execute on function public.ajustar_nota_avaliacao(uuid, numeric, text) to authenticated;

create or replace function public.painel_resultados_avaliacao(p_avaliacao_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_avaliacao public.avaliacoes_docentes;
  v_resultado jsonb;
begin
  select a.* into v_avaliacao from public.avaliacoes_docentes a
  where a.id = p_avaliacao_id
    and (a.professor_id = (select auth.uid()) or (select public.usuario_role()) = 'gestor');
  if not found then raise exception 'Avaliacao nao encontrada ou sem permissao.'; end if;

  with latest as (
    select distinct on (t.aluno_id) t.*
    from public.tentativas_avaliacao t
    where t.avaliacao_id = p_avaliacao_id
    order by t.aluno_id, t.numero_tentativa desc
  ), students as (
    select p.id, p.nome, p.matricula, l.id as tentativa_id,
      l.status, l.nota, l.pontuacao_automatica, l.pontuacao_manual,
      l.requer_revisao, l.numero_tentativa, l.enviada_em, l.corrigida_em
    from public.perfis p left join latest l on l.aluno_id = p.id
    where p.role = 'aluno' and p.turma_id = v_avaliacao.turma_id
  ), answers as (
    select r.* from public.respostas_avaliacao r
    join latest l on l.id = r.tentativa_id
    where l.status in ('enviada', 'corrigida')
  ), question_stats as (
    select q.id, q.ordem, q.tipo, q.enunciado, q.pontos,
      count(an.id) as respostas,
      count(an.id) filter (where an.correta = true) as acertos,
      round(coalesce(avg(an.pontos_automaticos + an.pontos_manuais), 0), 2) as media_pontos,
      round(case when count(an.id) > 0
        then 100.0 * count(an.id) filter (where an.correta = true) / count(an.id)
        else 0 end, 1) as percentual_acerto
    from public.questoes_avaliacao q
    left join answers an on an.questao_id = q.id
    where q.avaliacao_id = p_avaliacao_id
    group by q.id
  ), descriptor_stats as (
    select h.id, h.codigo, h.descricao,
      coalesce((select jsonb_agg(distinct jsonb_build_object('codigo', d.codigo, 'descricao', d.descricao))
        from public.habilidade_descritores hd
        join public.descritores_curriculares d on d.id = hd.descritor_id
        where hd.habilidade_id = h.id), '[]'::jsonb) as descritores,
      count(an.id) as evidencias,
      round(coalesce(sum(an.pontos_automaticos + an.pontos_manuais), 0), 2) as obtidos,
      round(coalesce(sum(q.pontos) filter (where an.id is not null), 0), 2) as possiveis,
      round(case when coalesce(sum(q.pontos) filter (where an.id is not null), 0) > 0
        then 100 * sum(an.pontos_automaticos + an.pontos_manuais)
          / sum(q.pontos) filter (where an.id is not null) else 0 end, 1) as desempenho
    from public.questoes_avaliacao_habilidades qh
    join public.habilidades_curriculares h on h.id = qh.habilidade_id
    join public.questoes_avaliacao q on q.id = qh.questao_id and q.avaliacao_id = p_avaliacao_id
    left join answers an on an.questao_id = q.id
    group by h.id
  )
  select jsonb_build_object(
    'avaliacao', jsonb_build_object('id', v_avaliacao.id, 'titulo', v_avaliacao.titulo,
      'valor', v_avaliacao.valor, 'turma_id', v_avaliacao.turma_id,
      'materia_codigo', v_avaliacao.materia_codigo, 'categoria', v_avaliacao.categoria),
    'metricas', jsonb_build_object(
      'total_alunos', (select count(*) from students),
      'entregaram', (select count(*) from students where status in ('enviada', 'corrigida')),
      'nao_entregaram', (select count(*) from students where status is null or status = 'em_andamento'),
      'em_revisao', (select count(*) from students where requer_revisao),
      'media_turma', (select round(coalesce(avg(nota) filter (where status = 'corrigida'), 0), 2) from students)
    ),
    'alunos', coalesce((select jsonb_agg(jsonb_build_object(
      'aluno_id', id, 'nome', nome, 'matricula', matricula, 'tentativa_id', tentativa_id,
      'status', coalesce(status, 'nao_iniciada'), 'nota', nota,
      'pontuacao_automatica', pontuacao_automatica, 'pontuacao_manual', pontuacao_manual,
      'requer_revisao', coalesce(requer_revisao, false), 'numero_tentativa', numero_tentativa,
      'enviada_em', enviada_em, 'corrigida_em', corrigida_em) order by nome) from students), '[]'::jsonb),
    'questoes', coalesce((select jsonb_agg(to_jsonb(qs) order by percentual_acerto, ordem) from question_stats qs), '[]'::jsonb),
    'descritores', coalesce((select jsonb_agg(to_jsonb(ds) order by desempenho, codigo) from descriptor_stats ds), '[]'::jsonb),
    'auditoria', coalesce((select jsonb_agg(jsonb_build_object('id', au.id, 'evento', au.evento,
      'detalhes', au.detalhes, 'ator_id', au.ator_id, 'created_at', au.created_at) order by au.created_at desc)
      from (select * from public.avaliacoes_auditoria where avaliacao_id = p_avaliacao_id order by created_at desc limit 50) au), '[]'::jsonb)
  ) into v_resultado;
  return v_resultado;
end;
$$;

revoke all on function public.painel_resultados_avaliacao(uuid) from public, anon;
grant execute on function public.painel_resultados_avaliacao(uuid) to authenticated;

create or replace function public.criar_recuperacao_descritores(
  p_avaliacao_origem uuid, p_habilidade_ids uuid[], p_titulo text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_origem public.avaliacoes_docentes;
  v_nova_id uuid;
  v_questao record;
  v_nova_questao uuid;
begin
  select a.* into v_origem from public.avaliacoes_docentes a
  where a.id = p_avaliacao_origem and a.professor_id = (select auth.uid());
  if not found then raise exception 'Avaliacao de origem nao encontrada ou sem permissao.'; end if;
  if coalesce(array_length(p_habilidade_ids, 1), 0) = 0 then
    raise exception 'Selecione ao menos um descritor para a recuperacao.';
  end if;
  if exists (select 1 from unnest(p_habilidade_ids) as selecionada(habilidade_id)
    where not exists (select 1 from public.questoes_avaliacao_habilidades qh
      join public.questoes_avaliacao q on q.id = qh.questao_id
      where q.avaliacao_id = v_origem.id
        and qh.habilidade_id = selecionada.habilidade_id)) then
    raise exception 'Um dos descritores nao pertence a avaliacao de origem.';
  end if;
  insert into public.avaliacoes_docentes
    (professor_id, turma_id, tipo_professor, titulo, instrucoes, duracao_minutos,
     valor, configuracao, status, materia_codigo, categoria, serie, trimestre,
     modo_pontuacao, tentativas_permitidas, embaralhar_questoes,
     embaralhar_alternativas, feedback_imediato, exibir_gabarito)
  values (v_origem.professor_id, v_origem.turma_id, v_origem.tipo_professor,
    coalesce(nullif(btrim(p_titulo), ''), 'Recuperacao - ' || v_origem.titulo),
    'Recuperacao criada a partir dos descritores com menor desempenho. Revise antes de publicar.',
    v_origem.duracao_minutos, v_origem.valor,
    v_origem.configuracao || jsonb_build_object('avaliacao_origem_id', v_origem.id,
      'habilidade_ids', to_jsonb(p_habilidade_ids)), 'rascunho', v_origem.materia_codigo,
    'recuperacao', v_origem.serie, v_origem.trimestre, v_origem.modo_pontuacao,
    1, v_origem.embaralhar_questoes, v_origem.embaralhar_alternativas,
    v_origem.feedback_imediato, v_origem.exibir_gabarito)
  returning id into v_nova_id;

  for v_questao in
    select distinct q.* from public.questoes_avaliacao q
    join public.questoes_avaliacao_habilidades qh on qh.questao_id = q.id
    where q.avaliacao_id = v_origem.id and qh.habilidade_id = any(p_habilidade_ids)
    order by q.ordem
  loop
    insert into public.questoes_avaliacao
      (avaliacao_id, ordem, tipo, enunciado, alternativas, pontos, configuracao, explicacao, obrigatoria)
    values (v_nova_id, v_questao.ordem, v_questao.tipo, v_questao.enunciado,
      v_questao.alternativas, v_questao.pontos, v_questao.configuracao,
      v_questao.explicacao, v_questao.obrigatoria)
    returning id into v_nova_questao;
    insert into public.gabaritos_avaliacao (questao_id, resposta_esperada)
    select v_nova_questao, g.resposta_esperada from public.gabaritos_avaliacao g
    where g.questao_id = v_questao.id;
    insert into public.questoes_avaliacao_habilidades (questao_id, habilidade_id)
    select v_nova_questao, qh.habilidade_id
    from public.questoes_avaliacao_habilidades qh
    where qh.questao_id = v_questao.id and qh.habilidade_id = any(p_habilidade_ids)
    on conflict do nothing;
  end loop;

  insert into public.avaliacoes_auditoria (avaliacao_id, ator_id, evento, detalhes)
  values (v_nova_id, (select auth.uid()), 'recuperacao_criada',
    jsonb_build_object('avaliacao_origem_id', v_origem.id,
      'habilidade_ids', to_jsonb(p_habilidade_ids)));
  return v_nova_id;
end;
$$;

revoke all on function public.criar_recuperacao_descritores(uuid, uuid[], text) from public, anon;
grant execute on function public.criar_recuperacao_descritores(uuid, uuid[], text) to authenticated;

create or replace function public.desempenho_aluno_descritores()
returns table (
  materia_codigo public.materia_aluno, habilidade_id uuid, codigo text,
  descricao text, descritores jsonb, evidencias bigint,
  pontos_obtidos numeric, pontos_possiveis numeric, desempenho numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (select public.usuario_role()) <> 'aluno' then
    raise exception 'Esta leitura esta disponivel apenas para alunos.';
  end if;
  return query
  with latest as (
    select distinct on (t.avaliacao_id) t.*
    from public.tentativas_avaliacao t
    where t.aluno_id = (select auth.uid()) and t.status = 'corrigida'
    order by t.avaliacao_id, t.numero_tentativa desc
  ), evidence as (
    select a.materia_codigo, qh.habilidade_id, r.id,
      r.pontos_automaticos + r.pontos_manuais as obtidos, q.pontos as possiveis
    from latest t
    join public.avaliacoes_docentes a on a.id = t.avaliacao_id
    join public.respostas_avaliacao r on r.tentativa_id = t.id
    join public.questoes_avaliacao q on q.id = r.questao_id
    join public.questoes_avaliacao_habilidades qh on qh.questao_id = q.id
  )
  select e.materia_codigo, h.id, h.codigo, h.descricao,
    coalesce((select jsonb_agg(distinct jsonb_build_object('codigo', d.codigo, 'descricao', d.descricao))
      from public.habilidade_descritores hd
      join public.descritores_curriculares d on d.id = hd.descritor_id
      where hd.habilidade_id = h.id), '[]'::jsonb),
    count(e.id), round(sum(e.obtidos), 2), round(sum(e.possiveis), 2),
    round(case when sum(e.possiveis) > 0 then 100 * sum(e.obtidos) / sum(e.possiveis) else 0 end, 1)
  from evidence e join public.habilidades_curriculares h on h.id = e.habilidade_id
  group by e.materia_codigo, h.id
  order by e.materia_codigo, desempenho, h.codigo;
end;
$$;

revoke all on function public.desempenho_aluno_descritores() from public, anon;
grant execute on function public.desempenho_aluno_descritores() to authenticated;

notify pgrst, 'reload schema';

commit;
