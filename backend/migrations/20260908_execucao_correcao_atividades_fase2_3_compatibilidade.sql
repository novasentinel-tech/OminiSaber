-- OminiSaber | Fase 2.3 - compatibilidade com validacao legada de tentativas

begin;

create or replace function public.validar_atualizacao_tentativa_docente()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  papel public.perfil_role := (select public.usuario_role());
begin
  if new.id <> old.id then
    raise exception 'A identidade da tentativa e imutavel.';
  end if;
  if papel = 'aluno' then
    if old.aluno_id <> (select auth.uid())
      or new.aluno_id <> old.aluno_id
      or new.avaliacao_id <> old.avaliacao_id
      or new.numero_tentativa <> old.numero_tentativa
      or new.versao_avaliacao <> old.versao_avaliacao
      or old.status <> 'em_andamento'
      or new.status not in ('enviada', 'corrigida') then
      raise exception 'O aluno nao pode alterar autoria, correcao ou uma tentativa ja enviada.';
    end if;
  elsif papel = 'professor' then
    if new.aluno_id <> old.aluno_id
      or new.avaliacao_id <> old.avaliacao_id
      or new.respostas is distinct from old.respostas
      or new.iniciada_em is distinct from old.iniciada_em
      or new.enviada_em is distinct from old.enviada_em then
      raise exception 'O professor pode corrigir a tentativa, mas nao alterar as respostas do aluno.';
    end if;
  elsif papel <> 'gestor' then
    raise exception 'Perfil sem permissao para atualizar tentativas.';
  end if;
  return new;
end;
$$;

revoke all on function public.validar_atualizacao_tentativa_docente() from public, anon, authenticated;

commit;
