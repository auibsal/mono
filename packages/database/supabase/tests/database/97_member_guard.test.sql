-- Member functions answer only about the caller, or about anyone for member
-- managers (migration 20261008000000).
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

select plan(8);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000f1', 'founder@auib.edu.iq', 'Founder');
select access.bootstrap_founder('founder@auib.edu.iq');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'student@auib.edu.iq', 'Student');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'other@auib.edu.iq', 'Other');

select pg_temp.login_anon();
select ok(not membership.is_member('00000000-0000-0000-0000-0000000000a1'),
  'Anonymous callers learn nothing about a user id');
select ok(not membership.has_current_pledges('00000000-0000-0000-0000-0000000000a1'),
  'Anonymous callers learn nothing about pledges');
select ok(not membership.is_member(), 'An anonymous caller is not a member');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select ok(membership.is_member(), 'A member asking about themselves gets the answer');
select ok(not membership.is_member('00000000-0000-0000-0000-0000000000a1'),
  'A member cannot ask about someone else');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000f1');
select ok(membership.is_member('00000000-0000-0000-0000-0000000000a1'),
  'A member manager can ask about anyone');

select pg_temp.logout();
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select ok(membership.is_member('00000000-0000-0000-0000-0000000000a1'),
  'The service role (apps/api) can ask about anyone');
select pg_temp.logout();
select ok(private.is_member('00000000-0000-0000-0000-0000000000a1'),
  'Internal code uses the unrestricted check');

select * from finish();
rollback;
