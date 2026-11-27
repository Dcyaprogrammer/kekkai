begin;

create table public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint workspace_shape check ((
    jsonb_typeof(data) = 'object'
    and data ?& array['version', 'items', 'saved']
    and data -> 'version' = '1'::jsonb
    and jsonb_typeof(data -> 'items') = 'array'
    and jsonb_typeof(data -> 'saved') = 'array'
    and jsonb_array_length(data -> 'items') <= 10000
    and jsonb_array_length(data -> 'saved') <= 10000
    and octet_length(data::text) <= 5242880
  ) is true)
);

alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon, authenticated;
grant select, insert, update on public.workspaces to authenticated;

create policy workspace_read on public.workspaces for select to authenticated
  using ((select auth.uid()) = user_id);
create policy workspace_create on public.workspaces for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy workspace_update on public.workspaces for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.save_workspace(p_user_id uuid, p_data jsonb, p_revision integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare next_revision integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception 'Sign in to save your workspace' using errcode = '42501';
  end if;
  if p_revision = 0 then
    insert into public.workspaces (user_id, data)
    values (auth.uid(), p_data)
    on conflict (user_id) do nothing
    returning revision into next_revision;
  else
    update public.workspaces
    set data = p_data, revision = revision + 1, updated_at = now()
    where user_id = auth.uid() and revision = p_revision
    returning revision into next_revision;
  end if;
  if next_revision is null then
    raise exception 'Workspace changed on another device' using errcode = '40001';
  end if;
  return next_revision;
end;
$$;

revoke all on function public.save_workspace(uuid, jsonb, integer) from public, anon;
grant execute on function public.save_workspace(uuid, jsonb, integer) to authenticated;

commit;
