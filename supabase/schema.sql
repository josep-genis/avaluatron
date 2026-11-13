-- Run in the Supabase SQL editor as the project owner.
create table if not exists public.avaluatro_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);

alter table public.avaluatro_workspaces enable row level security;
revoke all on public.avaluatro_workspaces from public, anon, authenticated;
grant select on public.avaluatro_workspaces to authenticated;

drop policy if exists "Users read their own workspace" on public.avaluatro_workspaces;
create policy "Users read their own workspace"
  on public.avaluatro_workspaces for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Restrict workspace reads to owner" on public.avaluatro_workspaces;
create policy "Restrict workspace reads to owner"
  on public.avaluatro_workspaces as restrictive for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.avaluatro_save_workspace(expected_revision bigint, new_payload jsonb)
returns table (revision bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if new_payload is null or jsonb_typeof(new_payload) <> 'object' then
    raise exception 'Workspace must be a JSON object';
  end if;

  if expected_revision is null then
    return query
      insert into public.avaluatro_workspaces as workspace (user_id, payload)
      values (current_user_id, new_payload)
      on conflict (user_id) do nothing
      returning workspace.revision;
  else
    return query
      update public.avaluatro_workspaces as workspace
      set payload = new_payload, revision = workspace.revision + 1
      where workspace.user_id = current_user_id
        and workspace.revision = expected_revision
      returning workspace.revision;
  end if;
end;
$$;

revoke all on function public.avaluatro_save_workspace(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.avaluatro_save_workspace(bigint, jsonb) to authenticated;
