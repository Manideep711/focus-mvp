-- Focus v1: normalized, user-owned data. All application writes are atomic and revision-checked.
-- Cross-owner relationships are prevented by composite foreign keys, in addition to RLS.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check(length(name) <= 80),
  timezone text not null default 'UTC',
  weekly_note text not null default '',
  revision bigint not null default 0 check(revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  text text not null check (length(text) between 1 and 20000),
  status text not null check (status in ('unprocessed','organized','archived')),
  kind text not null check (kind in ('thought','idea','note')),
  interpretation text not null default ''
);
create index inbox_owner_idx on public.inbox(user_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  title text not null check (length(trim(title)) between 1 and 500),
  why text not null default '',
  status text not null check (status in ('idea','active','later','paused','completed','archived')),
  target_date date,
  resume_date date,
  notes text not null default '',
  source_inbox_id uuid,
  foreign key(source_inbox_id,user_id) references public.inbox(id,user_id) deferrable initially deferred
);
create index goals_owner_idx on public.goals(user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  title text not null check (length(trim(title)) between 1 and 500),
  goal_id uuid,
  notes text not null default '',
  status text not null check(status in ('active','completed','archived')),
  source_inbox_id uuid,
  foreign key(goal_id,user_id) references public.goals(id,user_id) deferrable initially deferred,
  foreign key(source_inbox_id,user_id) references public.inbox(id,user_id) deferrable initially deferred
);
create index projects_owner_idx on public.projects(user_id);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  title text not null check(length(trim(title)) between 1 and 500),
  type text not null check(type in ('course','book','documentation','video','other')),
  url text not null default '' check(url = '' or url ~* '^https?://'),
  progress integer not null default 0 check(progress >= 0),
  total_units integer check(total_units > 0),
  unit_label text not null default 'units',
  target_date date,
  goal_id uuid,
  project_id uuid,
  notes text not null default '',
  source_inbox_id uuid,
  check(total_units is null or progress <= total_units),
  foreign key(goal_id,user_id) references public.goals(id,user_id) deferrable initially deferred,
  foreign key(project_id,user_id) references public.projects(id,user_id) deferrable initially deferred,
  foreign key(source_inbox_id,user_id) references public.inbox(id,user_id) deferrable initially deferred
);
create index resources_owner_idx on public.resources(user_id);

create table public.phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  title text not null check(length(trim(title)) between 1 and 500),
  goal_id uuid not null,
  position integer not null check(position >= 0),
  completed boolean not null default false,
  foreign key(goal_id,user_id) references public.goals(id,user_id) deferrable initially deferred
);
create index phases_owner_idx on public.phases(user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  title text not null check(length(trim(title)) between 1 and 500),
  description text not null default '',
  status text not null check(status in ('active','waiting','later','done','archived')),
  estimate_minutes integer check(estimate_minutes between 1 and 1440),
  energy text not null check(energy in ('low','steady','high')),
  goal_id uuid,
  project_id uuid,
  resource_id uuid,
  source_inbox_id uuid,
  is_emergency boolean not null default false,
  due_at timestamptz,
  resume_note text not null default '',
  blocker text not null default '',
  follow_up_date date,
  completed_at timestamptz,
  foreign key(goal_id,user_id) references public.goals(id,user_id) deferrable initially deferred,
  foreign key(project_id,user_id) references public.projects(id,user_id) deferrable initially deferred,
  foreign key(resource_id,user_id) references public.resources(id,user_id) deferrable initially deferred,
  foreign key(source_inbox_id,user_id) references public.inbox(id,user_id) deferrable initially deferred
);
create index tasks_owner_idx on public.tasks(user_id);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  date date not null,
  available_minutes integer not null check(available_minutes between 0 and 1440),
  energy text not null check(energy in ('low','steady','high')),
  anchor_task_id uuid,
  unique(user_id,date),
  foreign key(anchor_task_id,user_id) references public.tasks(id,user_id) deferrable initially deferred
);
create index plans_owner_idx on public.plans(user_id);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  task_id uuid not null,
  plan_id uuid not null,
  position integer not null check(position >= 0),
  planned_minutes integer check(planned_minutes between 1 and 1440),
  scheduled_time text check(scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  status text not null check(status in ('planned','completed','moved','removed')),
  reason text not null default '',
  unique(user_id,task_id,plan_id),
  foreign key(task_id,user_id) references public.tasks(id,user_id) deferrable initially deferred,
  foreign key(plan_id,user_id) references public.plans(id,user_id) deferrable initially deferred
);
create index commitments_owner_idx on public.commitments(user_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  task_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check(duration_seconds between 0 and 604800),
  planned_minutes integer check(planned_minutes between 1 and 1440),
  outcome text not null check(outcome in ('completed','progress','stopped')),
  notes text not null default '',
  resume_note text not null default '',
  mode text not null check(mode in ('timer','manual')),
  check(ended_at >= started_at),
  foreign key(task_id,user_id) references public.tasks(id,user_id) deferrable initially deferred
);
create index sessions_owner_idx on public.sessions(user_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  plan_id uuid not null,
  reflection text not null default '',
  kind text not null check(kind in ('daily','weekly')),
  unique(user_id,plan_id,kind),
  foreign key(plan_id,user_id) references public.plans(id,user_id) deferrable initially deferred
);
create index reviews_owner_idx on public.reviews(user_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  task_id uuid,
  plan_id uuid,
  kind text not null,
  note text not null,
  foreign key(task_id,user_id) references public.tasks(id,user_id) deferrable initially deferred,
  foreign key(plan_id,user_id) references public.plans(id,user_id) deferrable initially deferred
);
create index events_owner_idx on public.events(user_id);

create index tasks_goal_idx on public.tasks(user_id,goal_id,status);
create index tasks_project_idx on public.tasks(user_id,project_id);
create index tasks_resource_idx on public.tasks(user_id,resource_id);
create index tasks_inbox_idx on public.tasks(user_id,source_inbox_id);
create index goals_inbox_idx on public.goals(user_id,source_inbox_id);
create index projects_goal_idx on public.projects(user_id,goal_id);
create index projects_inbox_idx on public.projects(user_id,source_inbox_id);
create index resources_goal_idx on public.resources(user_id,goal_id);
create index resources_project_idx on public.resources(user_id,project_id);
create index resources_inbox_idx on public.resources(user_id,source_inbox_id);
create index phases_goal_idx on public.phases(user_id,goal_id,position);
create index plans_anchor_idx on public.plans(user_id,anchor_task_id);
create index commitments_plan_idx on public.commitments(user_id,plan_id,position);
create index commitments_task_idx on public.commitments(user_id,task_id);
create index sessions_time_idx on public.sessions(user_id,started_at desc);
create index sessions_task_idx on public.sessions(user_id,task_id);
create index events_plan_idx on public.events(user_id,plan_id);
create index events_task_idx on public.events(user_id,task_id);

create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null default 0 check(requests >= 0),
  primary key(user_id,window_start)
);

-- Separate policies ensure UPDATE checks both the existing and resulting owner.
do $$
declare tbl text;
begin
  foreach tbl in array array['profiles','inbox','goals','projects','resources','phases','tasks','plans','commitments','sessions','reviews','events'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from anon',tbl);
    execute format('grant select,insert,update,delete on public.%I to authenticated',tbl);
    execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)',tbl);
    execute format('create policy own_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',tbl);
    execute format('create policy own_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',tbl);
    execute format('create policy own_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',tbl);
  end loop;
end $$;

-- INVOKER functions retain RLS. No browser-accessible function bypasses ownership.
create function public.load_workspace() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  owner uuid := auth.uid();
  profile public.profiles;
  result jsonb;
  rows jsonb;
  tbl text;
begin
  if owner is null then raise exception 'Authentication required'; end if;
  -- A read lock prevents save_workspace from interleaving with the snapshot.
  select * into profile from public.profiles where user_id = owner for share;
  if not found then return null; end if;
  result := jsonb_build_object('schema_version',1,'revision',profile.revision,
    'preferences',jsonb_build_object('name',profile.name,'timezone',profile.timezone,'weekly_note',profile.weekly_note));
  foreach tbl in array array['inbox','goals','projects','resources','phases','tasks','plans','commitments','sessions','reviews','events'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) - ''user_id'' order by created_at,id),''[]''::jsonb) from public.%I r where user_id = $1',tbl) into rows using owner;
    result := result || jsonb_build_object(tbl,rows);
  end loop;
  return result;
end $$;

create function public.save_workspace(workspace jsonb, expected_revision bigint) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  owner uuid := auth.uid();
  current_revision bigint;
  tbl text;
  columns_sql text;
  updates_sql text;
  owned_rows jsonb;
begin
  if owner is null then raise exception 'Authentication required'; end if;
  if workspace ->> 'schema_version' is distinct from '1' then raise exception 'Unsupported schema version'; end if;
  if length(workspace::text) > 8000000 then raise exception 'Workspace exceeds snapshot limit; export or archive older history'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = workspace #>> '{preferences,timezone}') then raise exception 'Invalid timezone'; end if;
  insert into public.profiles(user_id) values(owner) on conflict(user_id) do nothing;
  select revision into current_revision from public.profiles where user_id = owner for update;
  if current_revision <> expected_revision then raise exception 'revision conflict'; end if;
  -- Restrict table names to this static list. Client-supplied identifiers are never executed.
  foreach tbl in array array['inbox','goals','projects','resources','phases','tasks','plans','commitments','sessions','reviews','events'] loop
    if jsonb_typeof(workspace -> tbl) is distinct from 'array' then raise exception 'Missing collection: %',tbl; end if;
    if jsonb_array_length(workspace -> tbl) > 20000 then raise exception 'Collection too large: %',tbl; end if;
    select string_agg(format('%I',a.attname),',' order by a.attnum),
      string_agg(format('%I = excluded.%I',a.attname,a.attname),',' order by a.attnum) filter(where a.attname not in ('id','user_id','created_at'))
      into columns_sql,updates_sql
      from pg_catalog.pg_attribute a
      where a.attrelid = format('public.%I',tbl)::regclass and a.attnum > 0 and not a.attisdropped;
    select coalesce(jsonb_agg(value || jsonb_build_object('user_id',owner)),'[]'::jsonb) into owned_rows from jsonb_array_elements(workspace -> tbl);
    execute format('insert into public.%I(%s) select %s from jsonb_populate_recordset(null::public.%I,$1) on conflict(id) do update set %s',tbl,columns_sql,columns_sql,tbl,updates_sql) using owned_rows;
  end loop;
  -- Deferred FKs allow related rows to be removed together, without implicit cascades.
  foreach tbl in array array['events','reviews','sessions','commitments','plans','tasks','phases','resources','projects','goals','inbox'] loop
    execute format('delete from public.%I r where user_id = $1 and not exists(select 1 from jsonb_array_elements($2) e where (e ->> ''id'')::uuid = r.id)',tbl) using owner,workspace -> tbl;
  end loop;
  update public.profiles set name = workspace #>> '{preferences,name}', timezone = workspace #>> '{preferences,timezone}',
    weekly_note = workspace #>> '{preferences,weekly_note}', revision = current_revision + 1, updated_at = now()
    where user_id = owner;
  return current_revision + 1;
end $$;

-- Quota rows are not writable through the Data API, so clients cannot reset their allowance.
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon,authenticated;
grant select on public.ai_usage to authenticated;
create policy own_select on public.ai_usage for select to authenticated using ((select auth.uid()) = user_id);
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;

-- This narrowly scoped privileged helper lives outside the exposed schema.
-- It only accesses the authenticated caller's quota, and accepts no owner or limit argument.
-- Charge before the provider request; failed requests count.
create function private.reserve_ai_quota() returns boolean
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); bucket timestamptz := date_trunc('hour',now()); count integer;
begin
  if owner is null then raise exception 'Authentication required'; end if;
  insert into public.ai_usage(user_id,window_start,requests) values(owner,bucket,1)
    on conflict(user_id,window_start) do update set requests = public.ai_usage.requests + 1
      where public.ai_usage.requests < 20
    returning requests into count;
  delete from public.ai_usage where user_id = owner and window_start < now() - interval '2 days';
  return count is not null;
end $$;

revoke execute on function private.reserve_ai_quota() from public,anon;
grant execute on function private.reserve_ai_quota() to authenticated;
create function public.consume_ai_quota() returns boolean
language sql security invoker set search_path = '' as $$
  select private.reserve_ai_quota();
$$;

revoke execute on function public.load_workspace() from public,anon;
revoke execute on function public.save_workspace(jsonb,bigint) from public,anon;
revoke execute on function public.consume_ai_quota() from public,anon;
grant execute on function public.load_workspace() to authenticated;
grant execute on function public.save_workspace(jsonb,bigint) to authenticated;
grant execute on function public.consume_ai_quota() to authenticated;
