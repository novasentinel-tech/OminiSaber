-- OminiSaber | Corrige a execução atômica do construtor de atividades.
--
-- O schema `private` não é exposto aos papéis da API. A função pública valida
-- explicitamente a sessão, o perfil docente e o vínculo turma/matéria antes de
-- chamar a rotina privada; por isso deve executar com os privilégios do dono.

begin;

alter function public.criar_atividade_docente(jsonb) security definer;
alter function public.criar_atividade_docente(jsonb) set search_path = '';

revoke all on function public.criar_atividade_docente(jsonb) from public, anon;
grant execute on function public.criar_atividade_docente(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
