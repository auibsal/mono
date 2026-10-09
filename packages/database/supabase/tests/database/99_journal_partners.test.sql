-- The Journal's partner pathway: calls open to named partners, verified
-- partner members submit with the same rules, readers with a declared
-- conflict are not assigned (P8.3), and Guest Editors come from partners.
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

select plan(17);

-- People.
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'sm-jp@auib.edu.iq', 'Submissions Manager');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'eic-jp@auib.edu.iq', 'Editor');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a3', 'reader1-jp@auib.edu.iq', 'Reader One');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a4', 'reader2-jp@auib.edu.iq', 'Reader Two');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a5', 'member-jp@auib.edu.iq', 'Member Author');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a6', 'vp-jp@auib.edu.iq', 'Vice President');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a7', 'director-jp@auib.edu.iq', 'Partnerships');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000b1', 'poet-jp@gmail.com', 'Partner Poet');

insert into journal.issues (id, volume, number, slug, title_en, title_ar)
values ('1a000000-0000-0000-0000-000000000001', 99, 1, 'partner-pathway-test', 'Firsts', 'أوّل مرّة');
insert into journal.calls (id, issue_id, title_en, title_ar, opens_at, closes_at, is_published) values
  ('ca000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001',
    'Issue 1', 'العدد الأول', now() - interval '1 day', now() + interval '30 days', true);

select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a1', 'submissions_manager', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a2', 'eic', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a3', 'reader', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a4', 'reader', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a6', 'vice_president');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a7', 'partnerships_director');

insert into membership.pledges (user_id, pledge_type, version)
select u, t, '1'
from unnest(array['00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000b1']::uuid[]) u,
  unnest(enum_range(null::membership.pledge_type)) t;

-- A partner with a signed memorandum granting submissions and guest
-- editing, and one still in talks.
insert into governance.partners (id, slug, name_en, kind, status, is_listed) values
  ('00000000-0000-0000-0000-00000000d001', 'poetry-hub', 'Poetry Hub', 'cultural', 'prospect', true),
  ('00000000-0000-0000-0000-00000000d002', 'not-yet', 'Not Yet', 'cultural', 'prospect', false);
insert into governance.partner_agreements (id, partner_id, purpose_en, starts_on, grants)
values ('00000000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-00000000d001',
  'Journal submissions and a guest editor.', current_date - 1, '{journal_submissions,guest_editing}');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a6');
select governance.sign_partner_agreement('00000000-0000-0000-0000-00000000d101', 'Partner Head', 'partners/mou.pdf');

-- Reader One sits on the partner's board and has declared it.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a3');
insert into governance.conflict_declarations (id, role_title)
values ('00000000-0000-0000-0000-00000000d201', 'Reader');
insert into governance.conflict_items (declaration_id, kind, partner_id, what)
values ('00000000-0000-0000-0000-00000000d201', 'partner_role', '00000000-0000-0000-0000-00000000d001', 'Board member');

-- The editor opens the call to the partner.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select lives_ok(
  $$ insert into journal.call_partners (call_id, partner_id)
     values ('ca000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000d001') $$,
  'The editor opens the call to a partner with a signed memorandum'
);
select throws_ok(
  $$ insert into journal.call_partners (call_id, partner_id)
     values ('ca000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000d002') $$,
  '22023', 'partner_not_granted',
  'but not to a partner without one'
);

select pg_temp.login_anon();
select is((select array_agg(name_en) from journal.call_partner_names('ca000000-0000-0000-0000-000000000001')),
  array['Poetry Hub'], 'The call''s public page names the partner');

-- The partner's poet: not a member, not yet verified as the partner's.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ insert into journal.submissions (call_id, partner_id, category, language, title, body_html, human_authorship_confirmed)
     values ('ca000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000d001',
       'poetry', 'en', 'Too early', '<p>Text</p>', true) $$,
  '42501', null,
  'A partner''s member cannot submit before the Society verifies the affiliation'
);
insert into governance.partner_affiliations (partner_id, note)
values ('00000000-0000-0000-0000-00000000d001', 'Member since 2024');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a7');
update governance.partner_affiliations set status = 'verified'
where user_id = '00000000-0000-0000-0000-0000000000b1';

select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from journal.my_call_pathways()), 1,
  'Once verified, the poet sees the call they may answer through the partner');
select lives_ok(
  $$ insert into journal.submissions (call_id, partner_id, category, language, title, body_html, human_authorship_confirmed)
     values ('ca000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-00000000d001', 'poetry', 'en', 'Through the hub', '<p>Text</p>', true) $$,
  'and submits through the partner'
);
select throws_ok(
  $$ insert into journal.submissions (call_id, category, language, title, body_html, human_authorship_confirmed)
     values ('ca000000-0000-0000-0000-000000000001', 'fiction', 'en', 'No pathway', '<p>Text</p>', true) $$,
  '42501', null,
  'but not without naming the partner'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a5');
select lives_ok(
  $$ insert into journal.submissions (call_id, category, language, title, body_html, human_authorship_confirmed)
     values ('ca000000-0000-0000-0000-000000000001', 'poetry', 'en', 'A member''s poem', '<p>Text</p>', true) $$,
  'Members submit as before'
);
select throws_ok(
  $$ insert into journal.submissions (call_id, partner_id, category, language, title, body_html, human_authorship_confirmed)
     values ('ca000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000d001',
       'fiction', 'en', 'Borrowed pathway', '<p>Text</p>', true) $$,
  '42501', null,
  'but cannot claim a partner they do not belong to'
);

-- Blind review: the declared conflict keeps Reader One off the entry.
select pg_temp.logout();
create temp table hub_submission as
  select id from journal.submissions where title = 'Through the hub';
grant select on hub_submission to public;
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select journal.transition_submission((select id from hub_submission), 'intake_check');
select journal.transition_submission((select id from hub_submission), 'in_review');
select throws_ok(
  $$ select journal.assign_reader(
       (select k.blind_entry_id from journal.blind_keys k where k.submission_id = (select id from hub_submission)),
       '00000000-0000-0000-0000-0000000000a3', 1) $$,
  '22023', null,
  'A reader who declared a conflict with the partner is not assigned (P8.3)'
);
select lives_ok(
  $$ select journal.assign_reader(
       (select k.blind_entry_id from journal.blind_keys k where k.submission_id = (select id from hub_submission)),
       '00000000-0000-0000-0000-0000000000a4', 1) $$,
  'Another reader is'
);
select hasnt_column('journal', 'blind_entries', 'partner_id',
  'Blind entries never carry the partner (readers stay blind)');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from journal.submissions), 0,
  'Readers still cannot read submissions or their partner');

-- Guest Editors come from partners whose memorandum grants guest editing.
select pg_temp.logout();
select lives_ok(
  $$ select pg_temp.grant_role('00000000-0000-0000-0000-0000000000b1', 'guest_editor', 'issue', '1a000000-0000-0000-0000-000000000001') $$,
  'The partner''s poet can be a Guest Editor for one issue'
);
select throws_ok(
  $$ select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a5', 'guest_editor', 'issue', '1a000000-0000-0000-0000-000000000001') $$,
  '22023', 'guest_editor_needs_partner',
  'but not someone who is not a partner''s'
);
select throws_ok(
  $$ select pg_temp.grant_role('00000000-0000-0000-0000-0000000000b1', 'guest_editor') $$,
  '22023', 'guest_editor_needs_issue',
  'and only for an issue'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1',
  '{"client_id": "00000000-0000-0000-0000-00000000a002"}');
select is((select count(*)::int from journal.call_partners), 0,
  'Third-party apps do not see the call''s partners');

select * from finish();
rollback;
