-- OminiSaber | Fase 2.4 - índices das relações de auditoria de notas

begin;

create index if not exists ajustes_notas_aluno_idx
  on public.ajustes_notas_avaliacao (aluno_id);
create index if not exists ajustes_notas_ajustado_por_idx
  on public.ajustes_notas_avaliacao (ajustado_por);

commit;
