-- Membership: sign-up verification, pledges, profile visibility and the
-- Voting Member rule (2 activities in the current or previous semester).
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

select plan(26);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000f1', 'founder@auib.edu.iq', 'Founder');
select access.bootstrap_founder('founder@auib.edu.iq');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'student@auib.edu.iq', 'Student');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000b1', 'alum@gmail.com', 'Alum');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'second@AUIB.EDU.IQ', 'Second');

-- Unconfirmed AUIB address: not verified until confirmed.
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000000a3', 'pending@auib.edu.iq', 'authenticated', 'authenticated');

-- ── Verification ────────────────────────────────────────────────────────────

select ok(
  (select verified_at is not null from core.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'A confirmed AUIB address is verified at sign-up'
);
select ok(
  (select verified_at is not null from core.profiles where id = '00000000-0000-0000-0000-0000000000a2'),
  'The AUIB domain check ignores case'
);
select ok(
  (select verified_at is null from core.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'Another domain is not verified at sign-up'
);
select is(
  (select status from membership.verification_requests where user_id = '00000000-0000-0000-0000-0000000000b1'),
  'pending',
  'Another domain lands in the verification queue'
);
select ok(
  (select verified_at is null from core.profiles where id = '00000000-0000-0000-0000-0000000000a3'),
  'An unconfirmed AUIB address is not verified'
);

update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000a3';
select ok(
  (select verified_at is not null from core.profiles where id = '00000000-0000-0000-0000-0000000000a3'),
  'Confirming an AUIB address verifies it'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select ok(not membership.is_member(), 'An unverified account is not a member');
select is((select count(*) from core.profiles)::integer, 1,
  'An unverified account sees only its own profile');
select is((select count(*) from membership.verification_requests)::integer, 1,
  'Applicants see their own request');
select throws_ok(
  $$ select membership.decide_verification(
       (select id from membership.verification_requests limit 1), true) $$,
  '42501', null,
  'Applicants cannot approve themselves'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*) from membership.verification_requests)::integer, 0,
  'Members cannot read the verification queue');
select is((select count(*) from core.profiles where verified_at is null)::integer, 0,
  'Members do not see unverified profiles');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000f1');
select lives_ok(
  $$ select membership.decide_verification(
       (select id from membership.verification_requests
        where user_id = '00000000-0000-0000-0000-0000000000b1'), true, 'Alumna, class of 2024') $$,
  'A members.verify holder approves the request'
);
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select ok(membership.is_member(), 'An approved account is a member');

-- ── Pledges ─────────────────────────────────────────────────────────────────

select is(
  (select pending_pledges from membership.my_status()),
  array['human_authorship', 'member']::membership.pledge_type[],
  'Both pledges are pending for a new member'
);
select throws_ok(
  $$ select membership.accept_pledge('member', '0') $$,
  '22023', null,
  'An out-of-date pledge version is refused'
);
select lives_ok($$ select membership.accept_pledge('member', '1') $$, 'Accepting the current Member Pledge');
select lives_ok($$ select membership.accept_pledge('human_authorship', '1') $$,
  'Accepting the current Human Authorship pledge');
select ok(membership.has_current_pledges(), 'Both pledges are current');

select pg_temp.logout();
update core.settings set value = '"2"' where key = 'pledges.member.version';
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select ok(not membership.has_current_pledges(), 'A new pledge version must be re-accepted');

-- ── Voting eligibility ──────────────────────────────────────────────────────

select pg_temp.logout();
insert into membership.activity_records (user_id, kind, occurred_at, note) values
  -- Student: one this semester, one last semester → voting member.
  ('00000000-0000-0000-0000-0000000000a1', 'manual', now() - interval '5 days', 'Open Pages'),
  ('00000000-0000-0000-0000-0000000000a1', 'manual', now() - interval '100 days', 'Majlis'),
  -- Second: one this semester and one two semesters ago → not.
  ('00000000-0000-0000-0000-0000000000a2', 'manual', now() - interval '5 days', 'Open Pages'),
  ('00000000-0000-0000-0000-0000000000a2', 'manual', now() - interval '350 days', 'Majlis');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select ok(membership.is_voting_member(), 'Two activities in the current and previous semester make a Voting Member');
select is(membership.activity_count(), 2, 'The activity count covers both semesters');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select ok(not membership.is_voting_member(), 'An activity from an older semester does not count');
select is(
  membership.is_voting_member('00000000-0000-0000-0000-0000000000a1'),
  null,
  'Members cannot look up someone else''s eligibility'
);

select throws_ok(
  $$ select membership.add_manual_activity('00000000-0000-0000-0000-0000000000a2', 'Self-credit') $$,
  '42501', null,
  'Members cannot add activity records'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok(
  $$ select membership.add_manual_activity('00000000-0000-0000-0000-0000000000a2', '  ') $$,
  '23514', null,
  'A manual activity record needs a note'
);

select * from finish();
rollback;
