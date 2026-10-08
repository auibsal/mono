-- Push subscriptions: each member sees and removes only their own devices;
-- a browser's endpoint moves to whoever saves it next.
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

select plan(10);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000d1', 'push1@auib.edu.iq');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000d2', 'push2@auib.edu.iq');

select pg_temp.login_anon();
select throws_ok(
  $$ select core.save_push_subscription('https://push.example/a', 'k', 'a') $$,
  '42501', null, 'Guests cannot save a device');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000d1');
select lives_ok(
  $$ select core.save_push_subscription('https://push.example/a', 'k1', 'a1', 'Laptop') $$,
  'A member saves a device');
select throws_ok(
  $$ insert into core.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/b', 'k', 'a') $$,
  '42501', null, 'Devices are added only through the function');
select throws_ok(
  $$ select core.save_push_subscription('http://push.example/c', 'k', 'a') $$,
  '23514', null, 'Endpoints must be https');
select is((select count(*)::int from core.push_subscriptions), 1,
  'The member sees their device');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000d2');
select is((select count(*)::int from core.push_subscriptions), 0,
  'Another member does not see it');
delete from core.push_subscriptions;
select pg_temp.logout();
select is((select count(*)::int from core.push_subscriptions), 1,
  'Nor can they remove it');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000d2');
select lives_ok(
  $$ select core.save_push_subscription('https://push.example/a', 'k2', 'a2', 'Shared laptop') $$,
  'Another member saves the same browser');
select pg_temp.logout();
select is(
  (select user_id from core.push_subscriptions where endpoint = 'https://push.example/a'),
  '00000000-0000-0000-0000-0000000000d2'::uuid,
  'Saving a known endpoint moves it to the member signed in now');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000d2');
delete from core.push_subscriptions;
select pg_temp.logout();
select is((select count(*)::int from core.push_subscriptions), 0,
  'A member removes their own device');

select * from finish();
rollback;
