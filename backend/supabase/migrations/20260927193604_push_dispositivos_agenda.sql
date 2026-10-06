begin;

create table if not exists public.push_dispositivos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  endpoint text not null unique,
  chave_p256dh text not null,
  chave_auth text not null,
  nome_dispositivo text,
  user_agent text,
  ativo boolean not null default true,
  ultimo_uso_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(endpoint) between 16 and 4096),
  check (char_length(chave_p256dh) between 16 and 512),
  check (char_length(chave_auth) between 8 and 256)
);

create table if not exists public.push_fila (
  id uuid primary key default gen_random_uuid(),
  notificacao_id uuid not null unique references public.notificacoes(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'processando', 'concluido', 'parcial', 'falhou')),
  tentativas integer not null default 0 check (tentativas >= 0),
  processada_em timestamptz,
  ultimo_erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_entregas (
  id uuid primary key default gen_random_uuid(),
  notificacao_id uuid not null references public.notificacoes(id) on delete cascade,
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  dispositivo_id uuid not null references public.push_dispositivos(id) on delete cascade,
  status text not null default 'processando' check (status in ('processando', 'enviado', 'falhou', 'expirado')),
  tentativas integer not null default 1 check (tentativas > 0),
  codigo_http integer,
  ultimo_erro text,
  enviada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notificacao_id, dispositivo_id)
);

create index if not exists push_dispositivos_usuario_ativo_idx
  on public.push_dispositivos (usuario_id, ativo);
create index if not exists push_fila_status_created_idx
  on public.push_fila (status, created_at);
create index if not exists push_entregas_usuario_created_idx
  on public.push_entregas (usuario_id, created_at desc);

alter table public.push_dispositivos enable row level security;
alter table public.push_fila enable row level security;
alter table public.push_entregas enable row level security;

revoke all on public.push_dispositivos, public.push_fila, public.push_entregas from anon, authenticated;
grant select, insert, update, delete on public.push_dispositivos to authenticated;
grant select on public.push_entregas to authenticated;
grant all on public.push_dispositivos, public.push_fila, public.push_entregas to service_role;

drop policy if exists push_dispositivos_select_proprio on public.push_dispositivos;
create policy push_dispositivos_select_proprio on public.push_dispositivos
for select to authenticated
using ((select auth.uid()) = usuario_id);

drop policy if exists push_dispositivos_insert_proprio on public.push_dispositivos;
create policy push_dispositivos_insert_proprio on public.push_dispositivos
for insert to authenticated
with check ((select auth.uid()) = usuario_id);

drop policy if exists push_dispositivos_update_proprio on public.push_dispositivos;
create policy push_dispositivos_update_proprio on public.push_dispositivos
for update to authenticated
using ((select auth.uid()) = usuario_id)
with check ((select auth.uid()) = usuario_id);

drop policy if exists push_dispositivos_delete_proprio on public.push_dispositivos;
create policy push_dispositivos_delete_proprio on public.push_dispositivos
for delete to authenticated
using ((select auth.uid()) = usuario_id);

drop policy if exists push_entregas_select_propria on public.push_entregas;
create policy push_entregas_select_propria on public.push_entregas
for select to authenticated
using ((select auth.uid()) = usuario_id);

create or replace function private.enfileirar_push_notificacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo = 'agenda' then
    insert into public.push_fila (notificacao_id)
    values (new.id)
    on conflict (notificacao_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.enfileirar_push_notificacao() from public, anon, authenticated;

drop trigger if exists trg_enfileirar_push_notificacao on public.notificacoes;
create trigger trg_enfileirar_push_notificacao
after insert on public.notificacoes
for each row execute function private.enfileirar_push_notificacao();

drop trigger if exists set_push_dispositivos_updated_at on public.push_dispositivos;
create trigger set_push_dispositivos_updated_at
before update on public.push_dispositivos
for each row execute function public.set_updated_at();

drop trigger if exists set_push_fila_updated_at on public.push_fila;
create trigger set_push_fila_updated_at
before update on public.push_fila
for each row execute function public.set_updated_at();

drop trigger if exists set_push_entregas_updated_at on public.push_entregas;
create trigger set_push_entregas_updated_at
before update on public.push_entregas
for each row execute function public.set_updated_at();

commit;
