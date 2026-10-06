begin;

-- Execute esta migração isoladamente antes do catálogo em bancos existentes.
-- O PostgreSQL exige que novos valores de enum sejam confirmados antes do uso.
alter type public.materia_aluno add value if not exists 'quimica' after 'fisica';
alter type public.materia_aluno add value if not exists 'biologia' after 'quimica';

commit;
