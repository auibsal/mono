-- SAL foundation: shared helpers, the `core` schema (profiles, semesters,
-- programmes, settings, activity log, outbox) and the `access` schema (RBAC).
--
-- Security model
-- • Row Level Security is the boundary. Every policy asks
--   access.has_permission(permission, scope_type, scope_id); code checks
--   permissions, never role names.
-- • Roles live only in access.role_assignments, written only by
--   access.assign_role() / access.end_role_assignment() (need `roles.assign`).
--   user_metadata and app_metadata are never read for authorization.
-- • SECURITY DEFINER helpers set search_path = '' and use qualified names.

create extension if not exists pgcrypto with schema extensions;

-- New functions are not executable by everyone by default; each migration
-- grants what its roles need.
alter default privileges revoke execute on functions from public;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create schema core;
create schema access;
grant usage on schema core, access to anon, authenticated, service_role;

-- ── Shared helpers ──────────────────────────────────────────────────────────

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Today's date in Baghdad, where every SAL date is defined.
create function private.today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Baghdad')::date;
$$;

create function private.word_count(value text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    array_length(regexp_split_to_array(btrim(value), '\s+'), 1), 0
  ) * (case when btrim(coalesce(value, '')) = '' then 0 else 1 end);
$$;

-- Generic "block this statement" trigger for append-only tables.
create function private.reject_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% on %.% is not allowed: the table is append-only',
    tg_op, tg_table_schema, tg_table_name
    using errcode = '42501';
end;
$$;

-- ── core.profiles ───────────────────────────────────────────────────────────

create table core.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name_en text not null default ''
    check (char_length(full_name_en) <= 120),
  full_name_ar text check (char_length(full_name_ar) <= 120),
  bio text check (private.word_count(bio) <= 50 and char_length(bio) <= 600),
  avatar_path text check (char_length(avatar_path) <= 512),
  locale text not null default 'en' check (locale in ('en', 'ar')),
  -- Camera-shy members: never photographed or filmed for SAL channels.
  camera_shy boolean not null default false,
  notify_email boolean not null default true,
  -- Optional personal address for alumni continuity. Never shown publicly.
  personal_email text
    check (personal_email is null or personal_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  setup_completed_at timestamptz,
  -- Set when the account is verified: automatically for confirmed AUIB
  -- addresses, by a `members.verify` holder for everyone else.
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table core.profiles is
  'One row per auth user. Sign-in email stays in auth.users.';

create trigger set_updated_at before update on core.profiles
  for each row execute function private.set_updated_at();

-- ── core.semesters, programmes, settings ────────────────────────────────────

create table core.semesters (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^(fall|spring|summer)-[0-9]{4}$'),
  name_en text not null,
  name_ar text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on),
  exclude using gist (daterange(starts_on, ends_on, '[]') with &&)
);

-- Exam weeks and other blackout periods: no SAL events are scheduled.
create table core.blackouts (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references core.semesters (id) on delete cascade,
  label_en text not null,
  label_ar text not null,
  starts_on date not null,
  ends_on date not null,
  check (ends_on >= starts_on)
);

create index blackouts_semester_id_idx on core.blackouts (semester_id);

create table core.programmes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null
    check (kind in ('journal', 'series', 'charity', 'tour', 'format')),
  name_en text not null,
  name_ar text not null,
  summary_en text,
  summary_ar text,
  sort integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on core.programmes
  for each row execute function private.set_updated_at();

create table core.settings (
  key text primary key check (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on core.settings
  for each row execute function private.set_updated_at();

-- Typed read of a setting for SQL (SECURITY DEFINER: private settings are
-- still readable by the database functions that need them).
create function private.setting(setting_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select value from core.settings where key = setting_key;
$$;

-- ── Semester helpers ────────────────────────────────────────────────────────

-- The semester in progress, or the latest one that has started.
create function core.current_semester()
returns core.semesters
language sql
stable
security definer
set search_path = ''
as $$
  select s.* from core.semesters s
  where s.starts_on <= private.today()
  order by s.starts_on desc
  limit 1;
$$;

create function core.previous_semester()
returns core.semesters
language sql
stable
security definer
set search_path = ''
as $$
  select s.* from core.semesters s
  where s.starts_on < (select c.starts_on from core.current_semester() c)
  order by s.starts_on desc
  limit 1;
$$;

-- ── core.activity_log ───────────────────────────────────────────────────────

create table core.activity_log (
  id bigint generated always as identity primary key,
  table_schema text not null,
  table_name text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  row_id text,
  actor_id uuid,
  old_row jsonb,
  new_row jsonb,
  occurred_at timestamptz not null default now()
);

create index activity_log_occurred_at_idx on core.activity_log (occurred_at desc);
create index activity_log_table_idx on core.activity_log (table_schema, table_name);
create index activity_log_actor_id_idx on core.activity_log (actor_id);

-- Attached to every table that holds roles, money, decisions or published
-- content. Never attached to ballots or ballot receipts.
create function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_json jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_json jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  insert into core.activity_log
    (table_schema, table_name, operation, row_id, actor_id, old_row, new_row)
  values (
    tg_table_schema,
    tg_table_name,
    tg_op,
    coalesce(new_json, old_json) ->> 'id',
    auth.uid(),
    old_json,
    new_json
  );
  return coalesce(new, old);
end;
$$;

-- ── core.outbox ─────────────────────────────────────────────────────────────
-- Side effects (emails, revalidation) are queued here inside the transaction
-- that caused them; a database webhook on insert hands each row to apps/api.

create table core.outbox (
  id bigint generated always as identity primary key,
  kind text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

create index outbox_pending_idx on core.outbox (created_at) where processed_at is null;

create function private.enqueue(kind text, payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into core.outbox (kind, payload) values (kind, payload);
$$;

-- ── access: roles and permissions ───────────────────────────────────────────

create table access.permissions (
  key text primary key check (key ~ '^[a-z]+(\.[a-z_]+)+$'),
  description text not null
);

create table access.roles (
  key text primary key check (key ~ '^[a-z_]+$'),
  name_en text not null,
  name_ar text not null,
  description text,
  -- The largest spend (IQD) a holder may approve as the lead approver with
  -- the Treasurer's countersignature (Bylaws). Null: cannot lead.
  spending_limit_iqd bigint check (spending_limit_iqd >= 0),
  is_council boolean not null default false,
  sort integer not null default 0
);

create table access.role_permissions (
  role text not null references access.roles (key) on delete cascade,
  permission text not null references access.permissions (key) on delete cascade,
  primary key (role, permission)
);

create index role_permissions_permission_idx on access.role_permissions (permission);

create table access.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null references access.roles (key),
  scope_type text not null default 'global'
    check (scope_type in ('global', 'programme', 'issue', 'campaign')),
  scope_id uuid,
  -- Display title, e.g. "Media Director" for a `director` assignment.
  title_en text check (char_length(title_en) <= 120),
  title_ar text check (char_length(title_ar) <= 120),
  starts_at timestamptz not null default now(),
  -- Assignments expire on their own: this is how the April handover works.
  ends_at timestamptz,
  assigned_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  check ((scope_type = 'global') = (scope_id is null)),
  check (ends_at is null or ends_at > starts_at)
);

create index role_assignments_user_id_ends_at_idx
  on access.role_assignments (user_id, ends_at);
create index role_assignments_role_idx on access.role_assignments (role);
create index role_assignments_scope_idx
  on access.role_assignments (scope_type, scope_id);

-- ── access.has_permission ───────────────────────────────────────────────────
-- True when the caller holds an active assignment whose role grants the
-- permission, either globally or for exactly this scope. A global grant
-- covers every scope.

create function access.has_permission(
  permission text,
  scope_type text default 'global',
  scope_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from access.role_assignments a
    join access.role_permissions rp on rp.role = a.role
    where a.user_id = (select auth.uid())
      and rp.permission = has_permission.permission
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
      and (
        a.scope_type = 'global'
        or (
          a.scope_type = has_permission.scope_type
          and a.scope_id = has_permission.scope_id
        )
      )
  );
$$;

-- True when the caller holds the permission in any scope (for showing a
-- module at all; rows are still checked per scope).
create function access.has_permission_anywhere(permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from access.role_assignments a
    join access.role_permissions rp on rp.role = a.role
    where a.user_id = (select auth.uid())
      and rp.permission = has_permission_anywhere.permission
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
  );
$$;

-- The caller's active grants, for the client-side mirror in @repo/rbac.
create function access.my_permissions()
returns table (permission text, scope_type text, scope_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct rp.permission, a.scope_type, a.scope_id
  from access.role_assignments a
  join access.role_permissions rp on rp.role = a.role
  where a.user_id = (select auth.uid())
    and a.starts_at <= now()
    and (a.ends_at is null or a.ends_at > now());
$$;

-- ── access.assign_role / end_role_assignment ────────────────────────────────

create function access.assign_role(
  target_user uuid,
  role_key text,
  scope_type text default 'global',
  scope_id uuid default null,
  starts_at timestamptz default now(),
  ends_at timestamptz default null,
  title_en text default null,
  title_ar text default null,
  note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not access.has_permission('roles.assign') then
    raise exception 'roles.assign is required' using errcode = '42501';
  end if;

  insert into access.role_assignments
    (user_id, role, scope_type, scope_id, starts_at, ends_at,
     title_en, title_ar, assigned_by, note)
  values
    (target_user, role_key, assign_role.scope_type, assign_role.scope_id,
     coalesce(assign_role.starts_at, now()), assign_role.ends_at,
     assign_role.title_en, assign_role.title_ar, (select auth.uid()),
     assign_role.note)
  returning id into new_id;

  return new_id;
end;
$$;

create function access.end_role_assignment(
  assignment_id uuid,
  ends_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not access.has_permission('roles.assign') then
    raise exception 'roles.assign is required' using errcode = '42501';
  end if;

  update access.role_assignments a
  set ends_at = greatest(end_role_assignment.ends_at, a.starts_at + interval '1 second')
  where a.id = assignment_id;
end;
$$;

-- ── Profiles: creation on sign-up and verification ──────────────────────────

create function private.is_auib_email(email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(split_part(coalesce(email, ''), '@', 2)) = 'auib.edu.iq';
$$;

-- ── RLS: core ───────────────────────────────────────────────────────────────

alter table core.profiles enable row level security;
alter table core.semesters enable row level security;
alter table core.blackouts enable row level security;
alter table core.programmes enable row level security;
alter table core.settings enable row level security;
alter table core.activity_log enable row level security;
alter table core.outbox enable row level security;

-- A verified member, used across policies.
create function private.is_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from core.profiles p
    where p.id = (select auth.uid()) and p.verified_at is not null
  );
$$;

create policy "Users read their own profile"
  on core.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Verified members read other verified members' profiles"
  on core.profiles for select to authenticated
  using ((select private.is_verified()) and verified_at is not null);

create policy "Member managers read every profile"
  on core.profiles for select to authenticated
  using (
    (select access.has_permission('members.manage'))
    or (select access.has_permission('members.verify'))
  );

create policy "Users update their own profile"
  on core.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Anyone reads semesters"
  on core.semesters for select to anon, authenticated using (true);
create policy "Settings managers write semesters"
  on core.semesters for all to authenticated
  using ((select access.has_permission('settings.manage')))
  with check ((select access.has_permission('settings.manage')));

create policy "Anyone reads blackouts"
  on core.blackouts for select to anon, authenticated using (true);
create policy "Settings managers write blackouts"
  on core.blackouts for all to authenticated
  using ((select access.has_permission('settings.manage')))
  with check ((select access.has_permission('settings.manage')));

create policy "Anyone reads active programmes"
  on core.programmes for select to anon, authenticated
  using (is_active or (select access.has_permission('programmes.manage')));
create policy "Programme managers write programmes"
  on core.programmes for all to authenticated
  using ((select access.has_permission('programmes.manage')))
  with check ((select access.has_permission('programmes.manage')));

create policy "Anyone reads public settings"
  on core.settings for select to anon, authenticated
  using (is_public or (select access.has_permission('settings.manage')));
create policy "Settings managers write settings"
  on core.settings for all to authenticated
  using ((select access.has_permission('settings.manage')))
  with check ((select access.has_permission('settings.manage')));

create policy "Auditors read the activity log"
  on core.activity_log for select to authenticated
  using ((select access.has_permission('audit.read')));

-- core.outbox: no client policies; apps/api drains it with the secret key.

-- ── RLS: access ─────────────────────────────────────────────────────────────

alter table access.permissions enable row level security;
alter table access.roles enable row level security;
alter table access.role_permissions enable row level security;
alter table access.role_assignments enable row level security;

create policy "Signed-in users read permissions"
  on access.permissions for select to authenticated using (true);
create policy "Anyone reads roles"
  on access.roles for select to anon, authenticated using (true);
create policy "Signed-in users read role bundles"
  on access.role_permissions for select to authenticated using (true);

create policy "Users read their own role assignments"
  on access.role_assignments for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Role managers read every role assignment"
  on access.role_assignments for select to authenticated
  using (
    (select access.has_permission('roles.assign'))
    or (select access.has_permission('members.manage'))
  );
-- No insert, update or delete policies: writes go through assign_role().

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on all tables in schema core, access from anon, authenticated;
revoke all on all functions in schema core, access, private from public, anon, authenticated;

grant select on core.semesters, core.blackouts, core.programmes, core.settings,
  access.roles to anon, authenticated;
grant select on core.profiles, core.activity_log, access.permissions,
  access.role_permissions, access.role_assignments to authenticated;
grant insert, update, delete on core.semesters, core.blackouts, core.programmes,
  core.settings to authenticated;
-- Members edit only these profile columns; verified_at is set by functions.
grant update (full_name_en, full_name_ar, bio, avatar_path, locale, camera_shy,
  notify_email, personal_email, setup_completed_at)
  on core.profiles to authenticated;

grant all on all tables in schema core, access to service_role;
grant usage, select on all sequences in schema core, access to service_role;

grant execute on function access.has_permission(text, text, uuid),
  access.has_permission_anywhere(text),
  access.my_permissions(),
  core.current_semester(),
  core.previous_semester()
  to anon, authenticated, service_role;
grant execute on function access.assign_role(uuid, text, text, uuid, timestamptz, timestamptz, text, text, text),
  access.end_role_assignment(uuid, timestamptz)
  to authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

-- ── Activity log triggers ───────────────────────────────────────────────────

create trigger log_activity after insert or update or delete on access.role_assignments
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on access.role_permissions
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on core.settings
  for each row execute function private.log_activity();
create trigger log_activity after insert or update or delete on core.semesters
  for each row execute function private.log_activity();
create trigger log_activity after update of verified_at on core.profiles
  for each row execute function private.log_activity();
