-- Third-party apps (Sign in with SAL): a token with a client_id reaches only
-- the areas the Society granted that app; the Society's own tokens are unaffected.
-- until the founding year ends; Honorary and Alumni Members never do.
begin;
-- <preamble>
-- Shared pgTAP preamble. Each test file includes a copy (pg_prove runs files
-- in isolation); keep them identical. `bun run --cwd packages/database db:test:sync` rewrites them.
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

create function pg_temp.login_as(uid uuid, extra jsonb default '{}')
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config(
    'request.jwt.claims',
    -- aal2 by default (two-step sign-in done); pass '{"aal":"aal1"}' to test without it.
    (jsonb_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal2') || extra)::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.login_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

create function pg_temp.logout()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- A confirmed account. AUIB addresses are verified by the sign-up trigger.
create function pg_temp.make_user(uid uuid, email text, name text default 'Test User')
returns uuid
language sql
as $$
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
  values (uid, email, now(), jsonb_build_object('full_name_en', name), 'authenticated', 'authenticated')
  returning id;
$$;

create function pg_temp.grant_role(uid uuid, role_key text, kind text default 'global', scope uuid default null)
returns void
language sql
as $$
  insert into access.role_assignments (user_id, role, scope_type, scope_id)
  values (uid, role_key, kind, scope);
$$;

grant execute on all functions in schema pg_temp to public;

-- Semesters around today: older, previous, current.
insert into core.semesters (code, name_en, name_ar, starts_on, ends_on) values
  ('fall-2024', 'Older', 'أقدم', current_date - 420, current_date - 300),
  ('spring-2025', 'Previous', 'السابق', current_date - 200, current_date - 60),
  ('fall-2025', 'Current', 'الحالي', current_date - 30, current_date + 60);

-- Tests check the two-activity rule; the founding-voter tests turn the
-- first-100 rule back on themselves.
update core.settings set value = '0' where key = 'membership.founding_voters';
-- </preamble>

-- Sets what PostgREST would for a function call.
create function pg_temp.calling(path text, headers text)
returns void
language sql
as $$
  select set_config('request.path', path, true), set_config('request.headers', headers, true);
$$;
grant execute on function pg_temp.calling(text, text) to authenticated;

select plan(16);

select is_empty(
  $$
    select n.nspname || '.' || c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and n.nspname in ('core', 'access', 'membership', 'events', 'journal',
        'charity', 'programmes', 'governance', 'content')
      and not exists (
        select 1 from pg_policy p
        where p.polrelid = c.oid and not p.polpermissive
          and p.polname = 'Third-party apps reach only their areas'
      )
  $$,
  'Every SAL table limits third-party apps to their areas (add the policy to new tables)'
);

select ok(
  exists (
    select 1 from pg_db_role_setting s
    join pg_roles r on r.oid = s.setrole
    where r.rolname = 'authenticator'
      and 'pgrst.db_pre_request=private.gate_request' = any (s.setconfig)
  ),
  'The Data API checks every request with private.gate_request'
);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000e1', 'oauth1@auib.edu.iq');

insert into access.oauth_clients (client_id, name_en, contact_email, areas, enabled) values
  ('00000000-0000-0000-0000-00000000a001', 'Profile app', 'team@auib.edu.iq', '{profile}', true),
  ('00000000-0000-0000-0000-00000000a002', 'Journal app', 'team@auib.edu.iq', '{journal}', true),
  ('00000000-0000-0000-0000-00000000a003', 'Switched off', 'team@auib.edu.iq', '{profile,journal}', false);

select throws_ok(
  $$ insert into access.oauth_clients (client_id, name_en, contact_email, areas)
     values (gen_random_uuid(), 'Ballots app', 'x@auib.edu.iq', '{governance}') $$,
  '23514', null, 'Governance can never be granted to an app');

-- The Nexus (no client_id).
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from core.profiles where id = '00000000-0000-0000-0000-0000000000e1'), 1,
  'The Nexus reads the member''s profile');
select lives_ok($$ select private.gate_request() $$, 'The Nexus passes the request check');

select is(
  (select name_en from access.oauth_client_info('00000000-0000-0000-0000-00000000a002')),
  'Journal app', 'The consent page can see whether the Society approved an app');
select is((select count(*)::int from access.oauth_clients), 0,
  'Members cannot read the registry itself');

-- An app the Society never listed.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1',
  '{"client_id": "00000000-0000-0000-0000-00000000afff"}');
select is((select count(*)::int from core.profiles), 0, 'An unlisted app sees nothing');
select throws_ok($$ select private.gate_request() $$, '42501', null,
  'An unlisted app is turned away');

-- An app granted the profile only.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1',
  '{"client_id": "00000000-0000-0000-0000-00000000a001"}');
select is((select count(*)::int from core.profiles where id = '00000000-0000-0000-0000-0000000000e1'), 1,
  'A profile app reads the member''s profile');
select is((select count(*)::int from core.settings), 0,
  'It sees nothing else in core');

-- An app granted the Journal only.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1',
  '{"client_id": "00000000-0000-0000-0000-00000000a002"}');
select is((select count(*)::int from core.profiles), 0, 'A Journal app does not read profiles');
select pg_temp.calling('/rpc/decide', '{"content-profile": "journal"}');
select lives_ok($$ select private.gate_request() $$,
  'A Journal app may call Journal functions (their own checks still apply)');
select pg_temp.calling('/rpc/my_permissions', '{"accept-profile": "access"}');
select lives_ok($$ select private.gate_request() $$,
  'Any approved app may ask what the member can do');
select pg_temp.calling('/rpc/cast_ballot', '{"content-profile": "governance"}');
select throws_ok($$ select private.gate_request() $$, '42501', null,
  'No app may call governance functions');

-- A switched-off app.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1',
  '{"client_id": "00000000-0000-0000-0000-00000000a003"}');
select is((select count(*)::int from core.profiles), 0, 'A switched-off app sees nothing');

select * from finish();
rollback;
