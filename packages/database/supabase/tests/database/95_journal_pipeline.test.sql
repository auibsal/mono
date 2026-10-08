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

-- Start from an empty journal: migrations seed the real Issue 1 call.
delete from journal.issues;

select plan(11);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000f1', 'founder@auib.edu.iq', 'Founder');
select access.bootstrap_founder('founder@auib.edu.iq');
select pg_temp.make_user('00000000-0000-0000-0000-0000000005a1', 'sm@auib.edu.iq', 'Submissions Manager');
select pg_temp.make_user('00000000-0000-0000-0000-0000000005e1', 'eic@auib.edu.iq', 'Editor');
select pg_temp.make_user('00000000-0000-0000-0000-0000000005b1', 'reader@auib.edu.iq', 'Reader One');
select pg_temp.make_user('00000000-0000-0000-0000-0000000005b2', 'reader2@auib.edu.iq', 'Reader Two');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'author@auib.edu.iq', 'Layla Hassan');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000b1', 'member@auib.edu.iq', 'Plain Member');

insert into journal.issues (id, volume, number, slug, title_en, title_ar) values
  ('1a000000-0000-0000-0000-000000000001', 1, 1, 'issue-1', 'Firsts', 'أوّل مرّة'),
  ('1a000000-0000-0000-0000-000000000002', 1, 2, 'issue-2', 'Second', 'الثاني');
insert into journal.calls (id, issue_id, title_en, title_ar, opens_at, closes_at, is_published) values
  ('ca000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001',
    'Issue 1', 'العدد الأول', now() - interval '1 day', now() + interval '30 days', true);

select pg_temp.grant_role('00000000-0000-0000-0000-0000000005a1', 'submissions_manager', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000005e1', 'eic', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000005b1', 'reader', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000005b2', 'reader', 'issue', '1a000000-0000-0000-0000-000000000002');

insert into membership.pledges (user_id, pledge_type, version)
select '00000000-0000-0000-0000-0000000000a1', t, '1'
from unnest(enum_range(null::membership.pledge_type)) t;

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
insert into journal.submissions (call_id, category, language, title, body_html, human_authorship_confirmed)
values ('ca000000-0000-0000-0000-000000000001',
  'poetry', 'en', 'The First Rain', '<p>Rain on the roof.</p>', true);

-- ── pipeline_issues ─────────────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-0000000005b1');
select results_eq(
  $$ select id, can_review, can_identity, can_decide from journal.pipeline_issues() $$,
  $$ values ('1a000000-0000-0000-0000-000000000001'::uuid, true, false, false) $$,
  'A reader sees only the issue they read for, as a reader'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select is((select count(*) from journal.pipeline_issues())::integer, 0,
  'A member with no journal role sees no issues');

-- ── intake_queue ────────────────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-0000000005a1');
select is(
  (select author_name_en from journal.intake_queue('1a000000-0000-0000-0000-000000000001')),
  'Layla Hassan',
  'The Submissions Manager sees who sent each submission'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000005e1');
select throws_ok(
  $$ select * from journal.intake_queue('1a000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Editors never see the intake queue (blind review)'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000005b1');
select throws_ok(
  $$ select * from journal.intake_queue('1a000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Readers never see the intake queue'
);

-- ── review_team ─────────────────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-0000000005a1');
select results_eq(
  $$ select full_name_en from journal.review_team('1a000000-0000-0000-0000-000000000001') $$,
  $$ values ('Reader One') $$,
  'The team lists readers for this issue only'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000005b1');
select throws_ok(
  $$ select * from journal.review_team('1a000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Readers cannot list the review team'
);

-- ── The board moves, with the roster ────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-0000000005a1');
select journal.transition_submission(
  (select submission_id from journal.intake_queue('1a000000-0000-0000-0000-000000000001')),
  'intake_check');
select journal.transition_submission(
  (select submission_id from journal.intake_queue('1a000000-0000-0000-0000-000000000001')),
  'in_review');
select isnt(
  (select blind_entry_id from journal.intake_queue('1a000000-0000-0000-0000-000000000001')),
  null, 'Entering review creates the blind entry'
);
select lives_ok(
  $$ select journal.assign_reader(
       (select blind_entry_id from journal.intake_queue('1a000000-0000-0000-0000-000000000001')),
       '00000000-0000-0000-0000-0000000005b1', 1) $$,
  'The Submissions Manager assigns a reader from the team'
);
select throws_ok(
  $$ select journal.assign_reader(
       (select blind_entry_id from journal.intake_queue('1a000000-0000-0000-0000-000000000001')),
       '00000000-0000-0000-0000-0000000005b2', 2) $$,
  '22023', null, 'A reader for another issue cannot be assigned'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000005b1');
select is(
  (select title from journal.blind_entries),
  'The First Rain',
  'The assigned reader reads the blind entry'
);

select * from finish();
rollback;
