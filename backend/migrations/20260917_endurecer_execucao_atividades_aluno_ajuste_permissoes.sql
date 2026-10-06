begin;

-- A constraint chama esta função com os privilégios do usuário que grava a
-- resposta. Ela apenas valida o próprio JSON recebido, é IMMUTABLE e não lê
-- nenhuma tabela; por isso o aluno autenticado precisa poder executá-la.
grant execute on function private.resposta_avaliacao_preenchida(jsonb)
  to authenticated;

notify pgrst, 'reload schema';

commit;
