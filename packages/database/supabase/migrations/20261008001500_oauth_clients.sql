-- Third-party apps ("Sign in with SAL", the Supabase OAuth 2.1 server).
--
-- An OAuth access token is an ordinary member token plus a `client_id`
-- claim: on its own it can do everything the member can. OAuth scopes
-- (openid, email, profile, phone) only shape the ID token; they do not limit
-- the database. So the Society decides here what each app may reach:
--
--   * access.oauth_clients lists the apps the Society approved, each with
--     the areas it may use ('profile', 'journal', 'events', 'programmes',
--     'content'). The rest of core, membership, access, governance and
--     charity are never available to apps.
--   * Every table in a SAL schema gets a restrictive policy: a token from an
--     app sees and changes rows only in the areas granted to that app, and
--     only where the member could anyway (the usual policies still apply,
--     blind review included). A token from an unlisted or switched-off app
--     sees nothing.
--   * Functions called over the Data API (`/rpc/...`) run as their owner and
--     skip row policies, so a pre-request check stops apps calling functions
--     outside their areas (ballots, account functions, GraphQL).
--
-- Nexus and public-site tokens carry no client_id and are unaffected.

create table access.oauth_clients (
  -- The client id Supabase Auth issued (Authentication → OAuth Apps).
  client_id uuid primary key,
  name_en text not null check (char_length(name_en) between 2 and 120),
  name_ar text check (char_length(name_ar) <= 120),
  -- Who runs the app, for when something goes wrong.
  contact_email text not null
    check (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  areas text[] not null default '{profile}'
    check (areas <@ array['profile', 'journal', 'events', 'programmes', 'content']),
  enabled boolean not null default true,
  note text check (char_length(note) <= 2000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table access.oauth_clients is
  'Third-party apps approved for Sign in with SAL, and the areas each may use.';

create trigger set_updated_at before update on access.oauth_clients
  for each row execute function private.set_updated_at();

alter table access.oauth_clients enable row level security;

create policy "Settings managers manage third-party apps"
  on access.oauth_clients for all to authenticated
  using ((select access.has_permission('settings.manage')))
  with check ((select access.has_permission('settings.manage')));

grant select, insert, update, delete on access.oauth_clients to authenticated;
grant all on access.oauth_clients to service_role;

-- The app behind the current token, or null for the Society's own apps.
create function private.oauth_client_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'client_id', '')::uuid;
$$;

-- True for the Society's own apps; for a third-party app, only when it is
-- listed, switched on and granted the area.
create function private.client_allows(area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.oauth_client_id() is null
    or exists (
      select 1 from access.oauth_clients c
      where c.client_id = private.oauth_client_id()
        and c.enabled
        and client_allows.area = any (c.areas)
    );
$$;

grant execute on function private.oauth_client_id(), private.client_allows(text)
  to anon, authenticated, service_role;

-- What the consent page shows: whether the Society approved the app, and
-- what it may reach. Members cannot read the registry itself.
create function access.oauth_client_info(client_id uuid)
returns table (name_en text, name_ar text, areas text[], enabled boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name_en, c.name_ar, c.areas, c.enabled
  from access.oauth_clients c
  where c.client_id = oauth_client_info.client_id;
$$;

revoke all on function access.oauth_client_info(uuid) from public, anon;
grant execute on function access.oauth_client_info(uuid) to authenticated;

-- The area a table belongs to. The profile is its own area so an app can
-- read a member's name without the rest of core.
create function private.table_area(schema_name text, table_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when schema_name = 'core' and table_name = 'profiles' then 'profile'
    else schema_name
  end;
$$;

-- One restrictive policy per table. Restrictive policies are ANDed with the
-- usual ones, so they can only take access away.
do $$
declare
  t record;
begin
  for t in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and n.nspname in ('core', 'access', 'membership', 'events', 'journal',
        'charity', 'programmes', 'governance', 'content')
  loop
    execute format(
      'create policy "Third-party apps reach only their areas" on %I.%I '
      'as restrictive for all to authenticated '
      'using ((select private.client_allows(%L))) '
      'with check ((select private.client_allows(%L)))',
      t.schema_name, t.table_name,
      private.table_area(t.schema_name, t.table_name),
      private.table_area(t.schema_name, t.table_name)
    );
  end loop;
end;
$$;

-- Files: apps never use Storage directly (apps/api issues signed URLs).
create policy "Third-party apps do not use Storage"
  on storage.objects as restrictive for all to authenticated
  using ((select private.oauth_client_id()) is null)
  with check ((select private.oauth_client_id()) is null);

-- Runs before every Data API request. Table reads and writes are covered by
-- the policies above; this covers functions, which skip them.
create function private.gate_request()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  client uuid := private.oauth_client_id();
  -- "rpc/name" or "/rpc/name", depending on the PostgREST version.
  path text := ltrim(coalesce(current_setting('request.path', true), ''), '/');
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  target text;
  fn text;
begin
  if client is null then
    return;
  end if;
  if not exists (
    select 1 from access.oauth_clients c where c.client_id = client and c.enabled
  ) then
    raise exception 'This app is not approved by the Society'
      using errcode = '42501';
  end if;
  if path not like 'rpc/%' then
    return;
  end if;
  fn := substr(path, 5);
  target := coalesce(headers ->> 'content-profile', headers ->> 'accept-profile', 'public');
  -- Any approved app may ask what the member is allowed to do.
  if target = 'access'
    and fn in ('has_permission', 'has_permission_anywhere', 'my_permissions') then
    return;
  end if;
  if target in ('journal', 'events', 'programmes', 'content')
    and private.client_allows(target) then
    return;
  end if;
  raise exception 'This app may not call %.%', target, fn
    using errcode = '42501';
end;
$$;

grant execute on function private.gate_request() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'private.gate_request';
notify pgrst, 'reload config';
