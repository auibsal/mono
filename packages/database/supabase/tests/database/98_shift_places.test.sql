-- Shift places: members see counts for upcoming shifts, never names
-- (migration 20261008000100).
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

select plan(5);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'student@auib.edu.iq', 'Student');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'other@auib.edu.iq', 'Other');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000b1', 'alum@gmail.com', 'Applicant');

insert into programmes.rotas (id, programme_id, title_en, title_ar)
select '00000000-0000-0000-0000-00000000c001', id, 'Door team', 'فريق الباب'
from core.programmes where slug = 'side-quest';
insert into programmes.shifts (id, rota_id, role_en, role_ar, starts_at, ends_at, capacity) values
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c001', 'Door', 'الباب', now() + interval '1 day', now() + interval '1 day 2 hours', 2),
  ('00000000-0000-0000-0000-00000000c102', '00000000-0000-0000-0000-00000000c001', 'Past', 'سابق', now() - interval '2 days', now() - interval '1 day', 2);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$ select programmes.sign_up_for_shift('00000000-0000-0000-0000-00000000c101') $$,
  'A member signs up');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select is(
  (select taken from programmes.shift_places() where shift_id = '00000000-0000-0000-0000-00000000c101'),
  1, 'Another member sees the place as taken');
select is((select count(*) from programmes.shift_signups)::integer, 0,
  'But not who took it');
select is((select count(*) from programmes.shift_places() where shift_id = '00000000-0000-0000-0000-00000000c102')::integer, 0,
  'Past shifts are left out');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select is((select count(*) from programmes.shift_places())::integer, 0,
  'An unverified applicant gets no rows');

select * from finish();
rollback;
