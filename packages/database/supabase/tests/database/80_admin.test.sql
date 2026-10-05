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

select plan(9);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000f1', 'founder@auib.edu.iq', 'Founder');
select access.bootstrap_founder('founder@auib.edu.iq');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'member@auib.edu.iq', 'Member');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'other@auib.edu.iq', 'Other');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000b1', 'guest@gmail.com', 'Guest');

-- ── Directory ───────────────────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select * from membership.directory() $$,
  '42501', null, 'A plain member cannot read the directory'
);

select pg_temp.login_anon();
select throws_ok(
  $$ select * from membership.directory() $$,
  '42501', null, 'Visitors cannot call the directory'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000f1');
select is((select count(*) from membership.directory())::integer, 4,
  'A member manager sees every account, verified or not');
select is(
  (select email from membership.directory() where user_id = '00000000-0000-0000-0000-0000000000b1'),
  'guest@gmail.com',
  'The directory carries sign-in emails (for contacting applicants)'
);
select is(
  (select verified_at is null from membership.directory() where user_id = '00000000-0000-0000-0000-0000000000b1'),
  true,
  'An unverified applicant shows as unverified'
);

-- ── Overview ────────────────────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select is(core.admin_overview(), '{}'::jsonb, 'A plain member gets no figures');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000f1');
select ok(core.admin_overview() ? 'members', 'A member manager sees member counts');
select is((core.admin_overview() ->> 'verification_pending')::integer, 1,
  'The overview counts the pending verification request');
select ok(core.admin_overview() ? 'campaigns', 'A charity manager sees campaign totals');

select * from finish();
rollback;
