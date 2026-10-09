-- Recognition (B4): service records confirmed by someone else, shifts
-- marked as worked, certificates issued only with both signatures, and
-- public verification by code.
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

select plan(24);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'member-rc@auib.edu.iq', 'Layla Member');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'president-rc@auib.edu.iq', 'The President');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a3', 'advisor-rc@auib.edu.iq', 'The Advisor');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a4', 'lead-rc@auib.edu.iq', 'Programme Lead');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a5', 'gs-rc@auib.edu.iq', 'General Secretary');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a2', 'president');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a3', 'faculty_advisor');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a4', 'programme_lead', 'programme',
  (select id from core.programmes where slug = 'side-quest'));
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a5', 'general_secretary');

insert into programmes.rotas (id, programme_id, title_en, title_ar)
select '00000000-0000-0000-0000-00000000c001', id, 'Door team', 'فريق الباب'
from core.programmes where slug = 'side-quest';
insert into programmes.shifts (id, rota_id, role_en, role_ar, starts_at, ends_at, capacity) values
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c001', 'Door', 'الباب',
   now() - interval '2 days', now() - interval '2 days' + interval '2 hours 30 minutes', 2),
  ('00000000-0000-0000-0000-00000000c102', '00000000-0000-0000-0000-00000000c001', 'Later', 'لاحقًا',
   now() + interval '2 days', now() + interval '2 days 2 hours', 2);
insert into programmes.shift_signups (shift_id, user_id) values
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000c102', '00000000-0000-0000-0000-0000000000a1');

-- Members log hours (F-16) as pending, and cannot confirm them.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ insert into membership.service_records (id, programme_id, occurred_on, activity, what, hours)
     select '00000000-0000-0000-0000-00000000e001', id, current_date - 3, 'Side Quest', 'Set up chairs', 3
     from core.programmes where slug = 'side-quest' $$,
  'A member logs hours as pending'
);
select throws_ok(
  $$ insert into membership.service_records (occurred_on, activity, hours, status)
     values (current_date, 'Self-confirmed', 5, 'confirmed') $$,
  '42501', null,
  'and cannot log them as confirmed'
);
select throws_ok(
  $$ select membership.confirm_service('00000000-0000-0000-0000-00000000e001', true) $$,
  '42501', 'not_allowed',
  'nor confirm their own hours'
);

-- The program lead confirms hours for their own program.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a4');
select lives_ok(
  $$ select membership.confirm_service('00000000-0000-0000-0000-00000000e001', true) $$,
  'The program lead confirms hours logged for their program'
);
select throws_ok(
  $$ select membership.record_shift_service('00000000-0000-0000-0000-00000000c102', '00000000-0000-0000-0000-0000000000a1') $$,
  '22023', 'shift_not_over',
  'A shift that has not ended cannot be recorded'
);
select lives_ok(
  $$ select membership.record_shift_service('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-0000000000a1') $$,
  'A finished shift is recorded as worked'
);
select lives_ok(
  $$ select membership.record_shift_service('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-0000000000a1') $$,
  'and recording it twice changes nothing'
);
select pg_temp.logout();
select is(
  (select hours from membership.service_records where source = 'shift'
     and user_id = '00000000-0000-0000-0000-0000000000a1'),
  2.50::numeric(5,2), 'The shift''s length becomes the hours (to the quarter hour)'
);
select is((select count(*)::int from membership.service_records where source = 'shift'), 1,
  'One record per shift and person');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select is(membership.service_hours(), 5.50::numeric, 'The member sees 5.5 confirmed hours this year');
select is(membership.service_hours('00000000-0000-0000-0000-0000000000a2'), null::numeric,
  'but not someone else''s');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a5');
select is((select hours from membership.service_totals() where user_id = '00000000-0000-0000-0000-0000000000a1'),
  5.50::numeric, 'The General Secretary sees everyone''s totals');

-- Certificates of Service (F-28).
select lives_ok(
  $$ insert into membership.certificates (id, user_id, kind, role_en, period_from, period_to)
     values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1', 'service',
       'Door Coordinator', current_date - 200, current_date - 10) $$,
  'The General Secretary prepares a certificate of service'
);
select throws_ok(
  $$ insert into membership.certificates (user_id, kind, citation_en)
     values ('00000000-0000-0000-0000-0000000000a1', 'fellowship', 'Forty hours of care') $$,
  '23514', null,
  'A Fellowship certificate needs the Council''s resolution'
);
select throws_ok(
  $$ insert into membership.certificates (user_id, kind, hours)
     values ('00000000-0000-0000-0000-0000000000a1', 'volunteer', 12) $$,
  '22023', 'volunteer_certificates_off',
  'Volunteer certificates stay off until the Council decides'
);
select throws_ok(
  $$ select membership.sign_certificate('00000000-0000-0000-0000-00000000f001') $$,
  '42501', 'not_allowed',
  'The General Secretary cannot sign'
);

select pg_temp.logout();
create temp table cert_code as
  select verification_code as code from membership.certificates where id = '00000000-0000-0000-0000-00000000f001';
grant select on cert_code to anon, authenticated;

select pg_temp.login_anon();
select is((select count(*)::int from membership.verify_certificate(
  (select code from cert_code))),
  0, 'A draft certificate does not verify');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select is(membership.sign_certificate('00000000-0000-0000-0000-00000000f001'), 'signed',
  'The President signs');
select throws_ok(
  $$ select membership.sign_certificate('00000000-0000-0000-0000-00000000f001') $$,
  '42501', 'not_allowed',
  'and cannot sign twice in place of the Faculty Advisor'
);
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a3');
select is(membership.sign_certificate('00000000-0000-0000-0000-00000000f001'), 'issued',
  'The Faculty Advisor''s countersignature issues it');
select pg_temp.logout();
select matches((select serial from membership.certificates where id = '00000000-0000-0000-0000-00000000f001'),
  '^SAL-\d{4}-001$', 'with the year''s first serial');

select pg_temp.login_anon();
select is((select holder_en || ' · ' || role_en || ' · ' || status from membership.verify_certificate(
  (select code from cert_code))),
  'Layla Member · Door Coordinator · issued', 'Anyone with the code can verify it');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select lives_ok(
  $$ select membership.revoke_certificate('00000000-0000-0000-0000-00000000f001', 'Issued in error') $$,
  'The President can revoke it'
);
select pg_temp.login_anon();
select is((select status from membership.verify_certificate(
  (select code from cert_code))),
  'revoked', 'and verification then says so');

select * from finish();
rollback;
