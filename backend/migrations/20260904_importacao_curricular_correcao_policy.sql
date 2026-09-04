begin;

drop policy if exists objetos_leitura on public.objetos_conhecimento;
create policy objetos_leitura on public.objetos_conhecimento for select to authenticated using (exists (select 1 from public.habilidade_objetos ho join public.curriculo_periodos p on p.id = ho.periodo_id join public.curriculos c on c.id = p.curriculo_id where ho.objeto_id = public.objetos_conhecimento.id and (c.status = 'publicado' or (select public.usuario_role()) = 'gestor')));

commit;