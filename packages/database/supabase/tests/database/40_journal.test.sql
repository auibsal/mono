-- Waraq pipeline: submission rules, blind review, rubric, third read,
-- decisions and the identity reveal.
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

select plan(39);

-- People: founder, Submissions Manager, EIC, three readers, authors.
select pg_temp.make_user('00000000-0000-0000-0000-0000000000f1', 'founder@auib.edu.iq', 'Founder');
select access.bootstrap_founder('founder@auib.edu.iq');
select pg_temp.make_user('00000000-0000-0000-0000-0000000005a1', 'sm@auib.edu.iq', 'Submissions Manager');
select pg_temp.make_user('00000000-0000-0000-0000-0000000005e1', 'eic@auib.edu.iq', 'Editor');
select pg_temp.make_user('00000000-0000-0000-0000-0000000005b1', 'r1@auib.edu.iq', 'Reader One');
select pg_temp.make_user('00000000-0000-0000-0000-0000000005b2', 'r2@auib.edu.iq', 'Reader Two');
select pg_temp.make_user('00000000-0000-0000-0000-0000000005b3', 'r3@auib.edu.iq', 'Reader Three');

insert into journal.issues (id, volume, number, slug, title_en, title_ar)
values ('1a000000-0000-0000-0000-000000000001', 1, 1, 'issue-1', 'Firsts', 'أوّل مرّة');
insert into journal.calls (id, issue_id, title_en, title_ar, opens_at, closes_at, is_published) values
  ('ca000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001',
    'Issue 1', 'العدد الأول', now() - interval '1 day', now() + interval '30 days', true),
  ('ca000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000001',
    'Guest Page', 'صفحة الضيف', now() - interval '1 day', now() + interval '30 days', true),
  ('ca000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000001',
    'Closed', 'مغلق', now() - interval '10 days', now() - interval '1 day', true);

select pg_temp.grant_role('00000000-0000-0000-0000-0000000005a1', 'submissions_manager', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000005e1', 'eic', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000005b1', 'reader', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000005b2', 'reader', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000005b3', 'reader', 'issue', '1a000000-0000-0000-0000-000000000001');

-- Authors with current pledges, one per category.
create function pg_temp.author(n integer) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-0000000a000' || n)::uuid;
$$;
grant execute on function pg_temp.author(integer) to public;

select pg_temp.make_user(pg_temp.author(n), 'author' || n || '@auib.edu.iq', 'Author ' || n)
from generate_series(1, 8) n;
insert into membership.pledges (user_id, pledge_type, version)
select pg_temp.author(n), t, '1'
from generate_series(1, 7) n, unnest(enum_range(null::membership.pledge_type)) t;

create function pg_temp.submit(n integer, cat journal.category, call uuid default 'ca000000-0000-0000-0000-000000000001')
returns uuid language plpgsql as $$
declare new_id uuid;
begin
  perform pg_temp.login_as(pg_temp.author(n));
  insert into journal.submissions (call_id, category, language, title, body_html, source_text, rights_note,
    human_authorship_confirmed)
  values (call, cat, 'en', initcap(cat::text) || ' by ' || n, '<p>Text</p>',
    case when cat = 'translation' then 'Original' end,
    case when cat = 'translation' then 'Public domain' end, true)
  returning id into new_id;
  perform pg_temp.logout();
  return new_id;
end $$;
grant execute on function pg_temp.submit(integer, journal.category, uuid) to public;

-- ── Submission rules ────────────────────────────────────────────────────────

select is(
  (select array_agg(c order by c) from unnest(enum_range(null::journal.category)) c)::text[],
  array['poetry', 'fiction', 'creative_nonfiction', 'short_drama', 'art_photography', 'translation', 'six_words'],
  'The category enum matches the form''s seven categories'
);

select lives_ok($$ select pg_temp.submit(1, 'poetry') $$, 'Poetry is accepted');
select lives_ok($$ select pg_temp.submit(2, 'fiction') $$, 'Fiction is accepted');
select lives_ok($$ select pg_temp.submit(3, 'creative_nonfiction') $$, 'Creative Nonfiction is accepted');
select lives_ok($$ select pg_temp.submit(4, 'short_drama') $$, 'Short Drama is accepted');
select lives_ok($$ select pg_temp.submit(5, 'art_photography') $$, 'Art & Photography is accepted');
select lives_ok($$ select pg_temp.submit(6, 'translation') $$, 'Translation is accepted');
select lives_ok($$ select pg_temp.submit(7, 'six_words') $$, 'Six Words is accepted');

select lives_ok($$ select pg_temp.submit(1, 'fiction') $$, 'A second submission to the same call is accepted');
select throws_ok(
  $$ select pg_temp.submit(1, 'six_words') $$,
  '23514', null,
  'A third submission to the same call is rejected'
);
select lives_ok($$ select pg_temp.submit(1, 'poetry', 'ca000000-0000-0000-0000-000000000002') $$,
  'A third submission in an hour (to another call) is accepted');
select throws_ok(
  $$ select pg_temp.submit(1, 'poetry', 'ca000000-0000-0000-0000-000000000002') $$,
  '54000', null,
  'A fourth submission within an hour is rate-limited'
);
select throws_ok(
  $$ select pg_temp.submit(2, 'poetry', 'ca000000-0000-0000-0000-000000000003') $$,
  '22023', null,
  'A closed call refuses submissions'
);
select throws_ok(
  $$ select pg_temp.submit(8, 'poetry') $$,
  '42501', null,
  'Members without current pledges cannot submit'
);

select pg_temp.login_as(pg_temp.author(2));
select throws_ok(
  $$ insert into journal.submissions (call_id, category, language, title, human_authorship_confirmed)
     values ('ca000000-0000-0000-0000-000000000001', 'translation', 'en', 'No source', true) $$,
  '23514', null,
  'A translation needs its source text and a rights note'
);
select throws_ok(
  $$ insert into journal.submissions (call_id, category, language, title, human_authorship_confirmed)
     values ('ca000000-0000-0000-0000-000000000001', 'poetry', 'en', 'No pledge', false) $$,
  '23514', null,
  'The Human Authorship pledge is reconfirmed per submission'
);
select is((select count(*) from journal.submissions)::integer, 1, 'Authors see only their own submissions');

-- ── Intake and blind entries ────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-0000000005b1');
select throws_ok(
  $$ select journal.transition_submission(
       (select id from journal.submissions limit 1), 'intake_check') $$,
  'P0002', null,
  'Readers cannot even find submissions to move'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000005a1');
select is((select count(*) from journal.submissions)::integer, 9,
  'The Submissions Manager sees every submission for the issue');

select lives_ok(
  $$ select journal.transition_submission(s.id, 'intake_check')
     from journal.submissions s where s.category in ('poetry', 'fiction') and s.author_id = pg_temp.author(1)
       and s.call_id = 'ca000000-0000-0000-0000-000000000001' $$,
  'Intake check'
);
select lives_ok(
  $$ select journal.transition_submission(s.id, 'in_review')
     from journal.submissions s where s.category in ('poetry', 'fiction') and s.author_id = pg_temp.author(1)
       and s.call_id = 'ca000000-0000-0000-0000-000000000001' $$,
  'Into review: blind entries are created'
);
select is((select count(*) from journal.blind_entries)::integer, 2, 'Two blind entries exist');

select throws_ok(
  $$ select journal.assign_reader(
       (select b.id from journal.blind_entries b where b.category = 'poetry'),
       '00000000-0000-0000-0000-0000000005a1', 1) $$,
  '22023', null,
  'The Submissions Manager never scores'
);

select lives_ok(
  $$ select journal.assign_reader(b.id, '00000000-0000-0000-0000-0000000005b1', 1),
            journal.assign_reader(b.id, '00000000-0000-0000-0000-0000000005b2', 2)
     from journal.blind_entries b $$,
  'Two readers are assigned to each blind entry'
);

-- ── Readers ─────────────────────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-0000000005b1');
select is((select count(*) from journal.submissions)::integer, 0, 'Readers cannot read submissions');
select is((select count(*) from journal.blind_keys)::integer, 0, 'Readers cannot read the key');
select is((select count(*) from journal.blind_entries)::integer, 2, 'Readers see their assigned blind entries');
select is((select count(*) from journal.entry_author((select id from journal.blind_entries limit 1)))::integer, 0,
  'The author is hidden before a decision');

select throws_ok(
  $$ insert into journal.scores (assignment_id, craft, voice, depth, archive_factor)
     select id, 6, 3, 3, 3 from journal.assignments limit 1 $$,
  '23514', null,
  'A score above 5 is rejected'
);
select throws_ok(
  $$ insert into journal.scores (assignment_id, craft, voice, depth, archive_factor)
     select id, 0, 3, 3, 3 from journal.assignments limit 1 $$,
  '23514', null,
  'A score below 1 is rejected'
);

-- Poetry: 5,5,5,5 (100) vs 2,2,2,2 (40) → third read. Fiction: 4s vs 4s → stays.
insert into journal.scores (assignment_id, craft, voice, depth, archive_factor)
select a.id, 5, 5, 5, 5 from journal.assignments a join journal.blind_entries b on b.id = a.blind_entry_id
where b.category = 'poetry';
insert into journal.scores (assignment_id, craft, voice, depth, archive_factor)
select a.id, 4, 4, 4, 4 from journal.assignments a join journal.blind_entries b on b.id = a.blind_entry_id
where b.category = 'fiction';
select is((select total from journal.scores s join journal.assignments a on a.id = s.assignment_id
  join journal.blind_entries b on b.id = a.blind_entry_id where b.category = 'poetry'), 100::smallint,
  'Rubric totals are weighted out of 100');

select pg_temp.login_as('00000000-0000-0000-0000-0000000005b2');
insert into journal.scores (assignment_id, craft, voice, depth, archive_factor)
select a.id, 2, 2, 2, 2 from journal.assignments a join journal.blind_entries b on b.id = a.blind_entry_id
where b.category = 'poetry';
insert into journal.scores (assignment_id, craft, voice, depth, archive_factor)
select a.id, 4, 3, 4, 4 from journal.assignments a join journal.blind_entries b on b.id = a.blind_entry_id
where b.category = 'fiction';

select is((select status from journal.blind_entries where category = 'poetry'), 'third_read'::journal.submission_status,
  'Totals more than 20 apart send the piece to a third read');
select is((select status from journal.blind_entries where category = 'fiction'), 'in_review'::journal.submission_status,
  'Totals within 20 stay in review');
select is((select count(*) from journal.scores)::integer, 2, 'Readers see only their own scores');

-- ── Decisions and the reveal ────────────────────────────────────────────────

select throws_ok(
  $$ select journal.decide((select id from journal.blind_entries where category = 'fiction'), 'accept') $$,
  '42501', null,
  'Readers cannot decide'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000005e1');
select lives_ok(
  $$ select journal.transition_submission((select id from journal.blind_entries where category = 'fiction'), 'selection') $$,
  'The EIC moves a card to selection by its blind id'
);
select lives_ok(
  $$ select journal.decide((select id from journal.blind_entries where category = 'fiction'), 'accept', 'Strong') $$,
  'The EIC records a decision'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000005b1');
select is(
  (select author_name_en from journal.entry_author((select id from journal.blind_entries where category = 'fiction'))),
  'Author 1',
  'After the decision the reader sees the author'
);

select pg_temp.login_as(pg_temp.author(1));
select lives_ok(
  $$ select journal.sign_agreement(
       (select id from journal.submissions where category = 'fiction' and status = 'accepted'), 'Author One') $$,
  'The author signs the agreement once accepted'
);

select * from finish();
rollback;
