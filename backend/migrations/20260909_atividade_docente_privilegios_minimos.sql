-- OminiSaber | Privilégios mínimos para o construtor atômico.
--
-- O papel autenticado pode resolver somente as rotinas privadas que receberam
-- EXECUTE explícito. Nenhuma tabela do schema privado é concedida ao cliente.

begin;

grant usage on schema private to authenticated;

revoke all on function private.validar_avaliacao_docente()
from public, anon, authenticated;

alter function public.criar_atividade_docente(jsonb) security invoker;
alter function public.criar_atividade_docente(jsonb) set search_path = '';

revoke all on function public.criar_atividade_docente(jsonb) from public, anon;
grant execute on function public.criar_atividade_docente(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
