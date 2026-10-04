-- RBAC: roles live only in access.role_assignments, written only through
-- assign_role(); has_permission() honours scope and expiry.
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
    (jsonb_build_object('sub', uid, 'role', 'authenticated') || extra)::text,
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
-- </preamble>

select plan(21);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000f1', 'founder@auib.edu.iq', 'Founder');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'member@auib.edu.iq', 'Member');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'other@auib.edu.iq', 'Other');
select access.bootstrap_founder('founder@auib.edu.iq');

-- ── No self-promotion ───────────────────────────────────────────────────────

-- Metadata a user (or anyone) can write never grants anything.
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"role":"president","roles":["president"]}',
    raw_app_meta_data = raw_app_meta_data || '{"role":"president","roles":["president"]}'
where id = '00000000-0000-0000-0000-0000000000a1';

select pg_temp.login_as(
  '00000000-0000-0000-0000-0000000000a1',
  '{"user_metadata":{"role":"president"},"app_metadata":{"role":"president","permissions":["roles.assign"]}}'
);

select ok(not access.has_permission('roles.assign'),
  'Role claims in user or app metadata grant nothing');
select ok(not access.has_permission('members.manage'),
  'A plain member holds no admin permission');

select throws_ok(
  $$ insert into access.role_assignments (user_id, role)
     values ('00000000-0000-0000-0000-0000000000a1', 'president') $$,
  '42501', null,
  'A member cannot insert a role assignment directly'
);

select throws_ok(
  $$ select access.assign_role('00000000-0000-0000-0000-0000000000a1', 'president') $$,
  '42501', null,
  'A member cannot call assign_role'
);

select throws_ok(
  $$ update access.role_permissions set role = 'president' where role = 'reader' $$,
  '42501', null,
  'A member cannot edit role bundles'
);

select throws_ok(
  $$ insert into access.role_permissions (role, permission) values ('reader', 'roles.assign') $$,
  '42501', null,
  'A member cannot add permissions to a role'
);

select throws_ok(
  $$ update core.profiles set verified_at = now() where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null,
  'A member cannot set their own verified_at'
);

select throws_ok(
  $$ select access.bootstrap_founder('member@auib.edu.iq') $$,
  '42501', null,
  'A member cannot call the bootstrap function'
);

select is(
  (select count(*) from access.role_assignments)::integer,
  0,
  'A member sees only their own (no) role assignments'
);

-- ── The founder assigns roles ───────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-0000000000f1');

select ok(access.has_permission('roles.assign'), 'The bootstrapped founder can assign roles');

select lives_ok(
  $$ select access.assign_role(
       '00000000-0000-0000-0000-0000000000a1', 'programme_lead', 'programme',
       (select id from core.programmes where slug = 'side-quest'),
       now() - interval '1 day') $$,
  'The founder assigns a programme-scoped role'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');

select ok(
  access.has_permission('events.manage', 'programme', (select id from core.programmes where slug = 'side-quest')),
  'A programme-scoped grant covers that programme'
);
select ok(
  not access.has_permission('events.manage', 'programme', (select id from core.programmes where slug = 'waraq')),
  'A programme-scoped grant does not cover another programme'
);
select ok(not access.has_permission('events.manage'), 'A programme-scoped grant is not global');
select ok(access.has_permission_anywhere('events.manage'), 'has_permission_anywhere sees scoped grants');
select is(
  (select count(*) from access.my_permissions() where permission = 'events.manage')::integer,
  1,
  'my_permissions lists the scoped grant'
);

-- ── Expiry and start dates ──────────────────────────────────────────────────

select pg_temp.logout();
insert into access.role_assignments (user_id, role, starts_at, ends_at) values
  ('00000000-0000-0000-0000-0000000000a2', 'treasurer', now() - interval '2 days', now() - interval '1 second');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select ok(not access.has_permission('charity.manage'), 'An assignment stops granting access at ends_at');

select pg_temp.logout();
insert into access.role_assignments (user_id, role, starts_at) values
  ('00000000-0000-0000-0000-0000000000a2', 'general_secretary', now() + interval '1 day');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select ok(not access.has_permission('governance.minutes.write'), 'An assignment grants nothing before starts_at');

-- Ending an assignment early takes effect at once.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000f1');
select lives_ok(
  $$ select access.end_role_assignment(
       (select id from access.role_assignments where user_id = '00000000-0000-0000-0000-0000000000a1')) $$,
  'The founder ends an assignment'
);
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select ok(not access.has_permission_anywhere('events.manage'), 'An ended assignment grants nothing');

select pg_temp.login_anon();
select ok(not access.has_permission('roles.assign'), 'Anonymous users hold no permissions');

select * from finish();
rollback;
