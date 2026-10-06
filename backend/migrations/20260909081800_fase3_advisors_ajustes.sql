-- OminiSaber | Ajustes dos advisors após a instalação isolada da Fase 3.0

begin;

-- Função de trigger: fixa o namespace sem alterar seu comportamento.
alter function public.set_updated_at() set search_path = '';

-- O FOR ALL também criava uma policy permissiva de SELECT redundante.
-- Operações administrativas ficam separadas e continuam protegidas por role.
drop policy if exists feature_flags_manage_gestor on public.feature_flags;
drop policy if exists feature_flags_insert_gestor on public.feature_flags;
create policy feature_flags_insert_gestor on public.feature_flags
for insert to authenticated
with check ((select public.usuario_role()) = 'gestor');
drop policy if exists feature_flags_update_gestor on public.feature_flags;
create policy feature_flags_update_gestor on public.feature_flags
for update to authenticated
using ((select public.usuario_role()) = 'gestor')
with check ((select public.usuario_role()) = 'gestor');
drop policy if exists feature_flags_delete_gestor on public.feature_flags;
create policy feature_flags_delete_gestor on public.feature_flags
for delete to authenticated
using ((select public.usuario_role()) = 'gestor');

drop policy if exists feature_flag_usuarios_manage_gestor on public.feature_flag_usuarios;
drop policy if exists feature_flag_usuarios_insert_gestor on public.feature_flag_usuarios;
create policy feature_flag_usuarios_insert_gestor on public.feature_flag_usuarios
for insert to authenticated
with check ((select public.usuario_role()) = 'gestor');
drop policy if exists feature_flag_usuarios_update_gestor on public.feature_flag_usuarios;
create policy feature_flag_usuarios_update_gestor on public.feature_flag_usuarios
for update to authenticated
using ((select public.usuario_role()) = 'gestor')
with check ((select public.usuario_role()) = 'gestor');
drop policy if exists feature_flag_usuarios_delete_gestor on public.feature_flag_usuarios;
create policy feature_flag_usuarios_delete_gestor on public.feature_flag_usuarios
for delete to authenticated
using ((select public.usuario_role()) = 'gestor');

grant insert, update, delete on table public.feature_flags to authenticated;
grant insert, update, delete on table public.feature_flag_usuarios to authenticated;

create index if not exists feature_flag_usuarios_concedida_por_idx
  on public.feature_flag_usuarios (concedida_por)
  where concedida_por is not null;

notify pgrst, 'reload schema';

commit;
