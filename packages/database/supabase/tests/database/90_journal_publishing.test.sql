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
-- </preamble>

select plan(10);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000f1', 'founder@auib.edu.iq', 'Founder');
select access.bootstrap_founder('founder@auib.edu.iq');
select pg_temp.make_user('00000000-0000-0000-0000-0000000005a1', 'sm@auib.edu.iq', 'Submissions Manager');
select pg_temp.make_user('00000000-0000-0000-0000-0000000005e1', 'eic@auib.edu.iq', 'Editor');
select pg_temp.make_user('00000000-0000-0000-0000-0000000005c1', 'copy@auib.edu.iq', 'Copy Editor');
select pg_temp.make_user('00000000-0000-0000-0000-0000000005d1', 'other@auib.edu.iq', 'Other Copy Editor');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'author@auib.edu.iq', 'Layla Hassan');

insert into journal.issues (id, volume, number, slug, title_en, title_ar) values
  ('1a000000-0000-0000-0000-000000000001', 1, 1, 'issue-1', 'Firsts', 'أوّل مرّة'),
  ('1a000000-0000-0000-0000-000000000002', 1, 2, 'issue-2', 'Second', 'الثاني');
insert into journal.calls (id, issue_id, title_en, title_ar, opens_at, closes_at, is_published) values
  ('ca000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001',
    'Issue 1', 'العدد الأول', now() - interval '1 day', now() + interval '30 days', true);

select pg_temp.grant_role('00000000-0000-0000-0000-0000000005a1', 'submissions_manager', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000005e1', 'eic', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000005c1', 'copy_editor', 'issue', '1a000000-0000-0000-0000-000000000001');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000005d1', 'copy_editor', 'issue', '1a000000-0000-0000-0000-000000000002');

insert into membership.pledges (user_id, pledge_type, version)
select '00000000-0000-0000-0000-0000000000a1', t, '1'
from unnest(enum_range(null::membership.pledge_type)) t;

-- A poem, moved through the pipeline as the database would.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
insert into journal.submissions (call_id, category, language, title, body_html, human_authorship_confirmed)
values ('ca000000-0000-0000-0000-000000000001',
  'poetry', 'en', 'The First Rain', '<p>Rain on the roof.</p>', true);

select pg_temp.logout();
create function pg_temp.sub() returns uuid language sql as $$
  select id from journal.submissions where title = 'The First Rain';
$$;
grant execute on function pg_temp.sub() to public;

select pg_temp.login_as('00000000-0000-0000-0000-0000000005a1');
select journal.transition_submission(pg_temp.sub(), 'intake_check');
select journal.transition_submission(pg_temp.sub(), 'in_review');

select pg_temp.logout();
-- Ids captured as the owner: most roles below cannot read submissions.
create temp table ids as
  select s.id as submission_id, k.blind_entry_id
  from journal.submissions s join journal.blind_keys k on k.submission_id = s.id
  where s.title = 'The First Rain';
grant select on ids to public;
create function pg_temp.entry() returns uuid language sql as $$
  select blind_entry_id from ids;
$$;
grant execute on function pg_temp.entry() to public;

select pg_temp.login_as('00000000-0000-0000-0000-0000000005e1');
select journal.transition_submission(pg_temp.entry(), 'selection');

-- ── Before a decision ───────────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-0000000005c1');
select throws_ok(
  $$ select journal.piece_from_entry(pg_temp.entry()) $$,
  '22023', null, 'Undecided work cannot become a piece'
);
select is((select count(*) from journal.accepted_unplaced())::integer, 0,
  'Nothing to place before a decision');

select pg_temp.login_as('00000000-0000-0000-0000-0000000005e1');
select journal.decide(pg_temp.entry(), 'accept');

-- ── After acceptance ────────────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-0000000005d1');
select throws_ok(
  $$ select journal.piece_from_entry(pg_temp.entry()) $$,
  '42501', null, 'A publisher for another issue cannot place the piece'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000005c1');
select is((select count(*) from journal.accepted_unplaced())::integer, 1,
  'The issue''s publisher sees accepted work waiting to be placed');
select is((select count(*) from journal.submissions)::integer, 0,
  'Publishers still cannot read submissions');
select lives_ok($$ select journal.piece_from_entry(pg_temp.entry()) $$,
  'The publisher turns accepted work into a draft piece');
select is(
  (select c.name_en from journal.pieces p join journal.contributors c on c.id = p.contributor_id),
  'Layla Hassan',
  'The piece is credited to its author, now that a decision is recorded'
);
select is((select body_en from journal.piece_bodies), '<p>Rain on the roof.</p>',
  'The piece carries the submitted text');

select throws_ok(
  $$ update journal.pieces set status = 'published', published_at = now() $$,
  '23514', null, 'No publishing before the Publication Agreement is signed'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select journal.sign_agreement((select submission_id from ids), 'Layla Hassan');

select pg_temp.login_as('00000000-0000-0000-0000-0000000005c1');
select lives_ok(
  $$ update journal.pieces set status = 'published', published_at = now() $$,
  'Once signed, the piece can be published'
);

select * from finish();
rollback;
