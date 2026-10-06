-- OminiSaber | Ajuste de privilégios do validador interno de gabaritos

begin;

alter function private.validar_gabarito_avaliacao() security definer;
alter function private.validar_gabarito_avaliacao() set search_path = '';
revoke all on function private.validar_gabarito_avaliacao()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
