-- Forms: who may fill in and handle each form, drafts, anonymous and
-- routed concerns (F-20), Society-wide incident handling (F-19), and
-- checklists their subject can read and tick.
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
select plan(25);

-- a1 a member, a2 the President, a3 the Vice President, a4 the Faculty
-- Advisor, a5 a program lead (events.manage for one program), a6 the
-- General Secretary.
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'member-fm@auib.edu.iq', 'A Member');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'president-fm@auib.edu.iq', 'The President');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a3', 'vp-fm@auib.edu.iq', 'The VP');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a4', 'advisor-fm@auib.edu.iq', 'The Advisor');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a5', 'lead-fm@auib.edu.iq', 'Program Lead');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a6', 'gs-fm@auib.edu.iq', 'The GS');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a2', 'president');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a3', 'vice_president');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a4', 'faculty_advisor');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a5', 'programme_lead', 'programme',
  (select id from core.programmes order by sort limit 1));
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a6', 'general_secretary');
insert into membership.memberships (user_id) values ('00000000-0000-0000-0000-0000000000a1') on conflict do nothing;

create temp table ids (name text primary key, id uuid);
grant all on ids to public;

-- ── Who may fill in what ──
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ insert into ids select 'f03', governance.save_form('f03', '{"first_choice":"Events Coordinator"}') $$,
  'Anyone signed in applies for a role (F-03)'
);
select is((select count(*)::int from governance.form_submissions), 1, 'and reads their own application');
select throws_ok(
  $$ select governance.save_form('f04', '{"candidate":"x"}') $$,
  '42501', 'not_allowed',
  'Only the panel fills in interview score sheets (F-04)'
);
select throws_ok(
  $$ select governance.save_form('f03', '{}', null, true, true) $$,
  '22023', 'anonymous_not_allowed',
  'Only concerns may be anonymous'
);
select throws_ok(
  $$ select governance.save_form('f10', '{}', null, true, false, null, 'president') $$,
  '22023', 'routing_only_for_concerns',
  'Routing is only for concerns'
);
select throws_ok(
  $$ insert into governance.form_submissions (form_key, submitted_by, data)
     values ('f03', auth.uid(), '{}') $$,
  '42501', null,
  'Nobody writes submissions directly'
);

-- ── Concerns (F-20): anonymity and routing ──
insert into ids select 'anon', governance.save_form('f20', '{"what":"Something at an event"}', null, true, true);
insert into ids select 'about_vp', governance.save_form('f20', '{"what":"About the VP"}', null, true, false, null, 'vice_president');
select is((select count(*)::int from governance.form_submissions where form_key = 'f20'), 1,
  'An anonymous concern cannot be read back even by whoever sent it');
select pg_temp.logout();
select is((select submitted_by from governance.form_submissions where id = (select id from ids where name = 'anon')),
  null, 'and no account is stored with it');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from governance.form_submissions where form_key = 'f20'), 1,
  'The Vice President receives concerns, but never one about the Vice President');
select throws_ok(
  format($$ select governance.handle_form(%L, 'acknowledged') $$, (select id from ids where name = 'about_vp')),
  '42501', 'not_allowed',
  'nor handles it'
);
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from governance.form_submissions where form_key = 'f20'), 2,
  'The President receives both');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from governance.form_submissions where form_key = 'f20'), 2,
  'and so does the Faculty Advisor');

-- ── Incident reports (F-19): Society-wide handlers only ──
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select governance.save_form('f19', '{"what":"A fall on the stairs"}');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from governance.form_submissions where form_key = 'f19'), 0,
  'A program-scoped lead never sees incident reports');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from governance.form_submissions where form_key = 'f19'), 1,
  'the President does');

-- ── Drafts and handling ──
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
insert into ids select 'pitch', governance.save_form('f10', '{"name":"Poetry walk"}', null, false);
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from governance.form_submissions where form_key = 'f10'), 0,
  'Handlers never see drafts');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  format($$ select governance.save_form('f10', '{"name":"Poetry walk","idea":"Read on the lawn."}', %L, true) $$,
    (select id from ids where name = 'pitch')),
  'A member submits their draft pitch (F-10)'
);
select throws_ok(
  format($$ select governance.save_form('f10', '{"name":"Changed"}', %L, true) $$, (select id from ids where name = 'pitch')),
  '42501', 'not_allowed',
  'and cannot change it once submitted'
);
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select lives_ok(
  format($$ select governance.handle_form(%L, 'acknowledged', '{"received":"2026-10-09"}') $$, (select id from ids where name = 'pitch')),
  'The handler acknowledges it'
);
select ok((select acknowledged_at is not null and office ->> 'received' = '2026-10-09'
  from governance.form_submissions where id = (select id from ids where name = 'pitch')),
  'with the time and the office-use boxes');
select governance.handle_form((select id from ids where name = 'pitch'), 'closed');
select ok((select closed_at is not null from governance.form_submissions where id = (select id from ids where name = 'pitch')),
  'and closes it');
select ok((select waiting >= 1 from governance.form_queue() where form_key = 'f20'),
  'The queue counts what is waiting');

-- ── Checklists with a subject (F-27) ──
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a6');
insert into ids select 'offboard', governance.save_form('f27', '{"role":"Events Coordinator"}', null, true, false,
  '00000000-0000-0000-0000-0000000000a1');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from governance.form_submissions where form_key = 'f27'), 1,
  'The person leaving reads their offboarding checklist');
select lives_ok(
  format($$ select governance.save_form('f27', '{"role":"Events Coordinator","items":["dossier"]}', %L) $$,
    (select id from ids where name = 'offboard')),
  'and ticks items while it is open'
);
select throws_ok(
  $$ select governance.save_form('f27', '{}') $$,
  '42501', 'not_allowed',
  'but only the General Secretary starts one'
);

select pg_temp.login_anon();
select throws_ok(
  $$ select governance.save_form('f20', '{}', null, true, true) $$,
  '42501', null,
  'Visitors who are not signed in cannot send forms'
);

select * from finish();
rollback;
