-- OminiSaber | Copiloto: ideias e trilhas com atividades completas.
-- Incremental; mantém registros anteriores, RLS, privilégios e feature flags.
begin;

alter table public.copiloto_execucoes
  drop constraint if exists copiloto_execucoes_acao_check;
alter table public.copiloto_execucoes
  add constraint copiloto_execucoes_acao_check
  check (acao in ('gerar_atividade', 'gerar_trilha', 'gerar_ideias', 'revisar_atividade', 'sugerir_recuperacao'));
alter table public.copiloto_execucoes
  alter column prompt_versao set default 'copiloto-pedagogico-2026-10-03';

comment on column public.copiloto_execucoes.prompt_versao is
  'Versão do contrato pedagógico e validação utilizados; registros anteriores mantêm sua versão original.';

commit;
