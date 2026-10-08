-- Governance: spending thresholds and elections (eligibility snapshot,
-- one ballot per voter, unlinkable ballots, ranked-choice count with RON).
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

select plan(40);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000f1', 'founder@auib.edu.iq', 'Founder');
select access.bootstrap_founder('founder@auib.edu.iq');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000d1', 'director@auib.edu.iq', 'Director');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000d2', 'treasurer@auib.edu.iq', 'Treasurer');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000e1', 'committee@auib.edu.iq', 'Committee');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000d1', 'director');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000d2', 'treasurer');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000e1', 'elections_committee');

-- ── Spending approvals ──────────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-0000000000d1');
select lives_ok(
  $$ select governance.request_spending('Printing', 40000) $$,
  'A Director raises a request'
);
select lives_ok($$ select governance.request_spending('Venue', 100000) $$, 'A larger request');
select lives_ok($$ select governance.request_spending('Equipment', 300000) $$, 'A request above every limit');

select is(
  governance.approve_spending((select id from governance.spending_approvals where purpose_en = 'Printing')),
  'pending',
  'A Director approves within 50,000 IQD'
);
select throws_ok(
  $$ select governance.approve_spending((select id from governance.spending_approvals where purpose_en = 'Venue')) $$,
  '23514', null,
  'A Director cannot lead an approval above 50,000 IQD'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000d2');
select is(
  governance.approve_spending((select id from governance.spending_approvals where purpose_en = 'Printing')),
  'approved',
  'The Treasurer countersigns and the request is approved'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000f1');
select is(
  governance.approve_spending((select id from governance.spending_approvals where purpose_en = 'Venue')),
  'pending',
  'The President leads up to 250,000 IQD'
);
select throws_ok(
  $$ select governance.approve_spending((select id from governance.spending_approvals where purpose_en = 'Equipment')) $$,
  '23514', null,
  'Above 250,000 IQD needs a Council vote'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000d2');
select is(
  governance.approve_spending((select id from governance.spending_approvals where purpose_en = 'Venue')),
  'approved',
  'President + Treasurer approve 100,000 IQD'
);

select throws_ok(
  $$ insert into governance.spending_approvals (purpose_en, amount_iqd, status) values ('Sneaky', 1, 'approved') $$,
  '42501', null,
  'The log cannot be written directly'
);

-- ── Elections ───────────────────────────────────────────────────────────────

-- Voters: v1–v4 are Voting Members, v5 is not.
create function pg_temp.voter(n integer) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-00000000b00' || n)::uuid;
$$;
grant execute on function pg_temp.voter(integer) to public;

select pg_temp.logout();
select pg_temp.make_user(pg_temp.voter(n), 'v' || n || '@auib.edu.iq', 'Voter ' || n) from generate_series(1, 5) n;
insert into membership.activity_records (user_id, kind, occurred_at, note)
select pg_temp.voter(n), 'manual', now() - (k || ' days')::interval, 'Activity'
from generate_series(1, 4) n, generate_series(1, 2) k;
insert into membership.activity_records (user_id, kind, occurred_at, note)
select '00000000-0000-0000-0000-0000000000e1', 'manual', now() - (k || ' days')::interval, 'Activity'
from generate_series(1, 2) k;

update core.settings set value = 'true' where key = 'features.elections';

insert into governance.elections (id, title_en, title_ar, status, nominations_open_at, nominations_close_at,
  voting_opens_at, voting_closes_at)
values ('e1000000-0000-0000-0000-000000000001', 'Spring 2027', 'ربيع ٢٠٢٧', 'draft',
  now() + interval '8 days', now() + interval '15 days', now() + interval '15 days', now() + interval '17 days');
insert into governance.positions (id, election_id, role_key, title_en, title_ar) values
  ('b1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'president', 'President', 'الرئيس'),
  ('b1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'treasurer', 'Treasurer', 'أمين الصندوق');

create function pg_temp.candidate(n integer) returns text language sql as $$
  select c.id::text from governance.candidates c where c.user_id = pg_temp.voter(n);
$$;
grant execute on function pg_temp.candidate(integer) to public;

create function pg_temp.vote(uid uuid, president jsonb, treasurer jsonb) returns void language plpgsql as $$
begin
  perform pg_temp.login_as(uid);
  perform governance.cast_ballot('e1000000-0000-0000-0000-000000000001',
    jsonb_build_object('b1000000-0000-0000-0000-000000000001', president,
      'b1000000-0000-0000-0000-000000000002', treasurer));
end $$;
grant execute on function pg_temp.vote(uuid, jsonb, jsonb) to public;

-- Notice (B6.2): the voter list is the register on the day notice is given.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(
  $$ update governance.elections set status = 'nominations' where id = 'e1000000-0000-0000-0000-000000000001' $$,
  '22023', null, 'Nominations cannot open before notice is given'
);
select is(governance.give_notice('e1000000-0000-0000-0000-000000000001'), 5,
  'Giving notice freezes five Voting Members on the voter list');
select isnt((select notice_given_at from governance.elections where id = 'e1000000-0000-0000-0000-000000000001'),
  null, 'The notice date is recorded');
select throws_ok($$ select governance.give_notice('e1000000-0000-0000-0000-000000000001') $$,
  '22023', null, 'Notice is given once');
insert into governance.elections (id, title_en, title_ar, nominations_open_at, nominations_close_at,
  voting_opens_at, voting_closes_at)
values ('e1000000-0000-0000-0000-000000000002', 'Too soon', 'مبكر', now() + interval '3 days',
  now() + interval '10 days', now() + interval '10 days', now() + interval '12 days');
insert into governance.positions (election_id, role_key, title_en, title_ar)
values ('e1000000-0000-0000-0000-000000000002', 'president', 'President', 'الرئيس');
select throws_ok($$ select governance.give_notice('e1000000-0000-0000-0000-000000000002') $$,
  '22023', null, 'Notice must come at least a week before nominations open');

-- A member who qualifies after notice is not on this election's list.
select pg_temp.logout();
insert into membership.activity_records (user_id, kind, occurred_at, note)
select pg_temp.voter(5), 'manual', now() - (k || ' days')::interval, 'Activity'
from generate_series(1, 2) k;
update governance.elections
set nominations_open_at = now() - interval '2 days', nominations_close_at = now() + interval '1 hour',
  voting_opens_at = now() + interval '1 hour', voting_closes_at = now() + interval '2 hours'
where id = 'e1000000-0000-0000-0000-000000000001';
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1');
select lives_ok(
  $$ update governance.elections set status = 'nominations' where id = 'e1000000-0000-0000-0000-000000000001' $$,
  'Nominations open after notice'
);

-- Nominations.
select pg_temp.login_as(pg_temp.voter(1));
select lives_ok($$ select governance.nominate('b1000000-0000-0000-0000-000000000001', 'Statement') $$,
  'A Voting Member nominates themselves');
select pg_temp.login_as(pg_temp.voter(2));
select governance.nominate('b1000000-0000-0000-0000-000000000001', 'Statement');
select pg_temp.login_as(pg_temp.voter(4));
select governance.nominate('b1000000-0000-0000-0000-000000000001', 'Statement');
select pg_temp.login_as(pg_temp.voter(3));
select governance.nominate('b1000000-0000-0000-0000-000000000002', 'Statement');

select pg_temp.login_as(pg_temp.voter(5));
select throws_ok($$ select governance.nominate('b1000000-0000-0000-0000-000000000002', 'Statement') $$,
  '42501', null, 'Members not on the voter list cannot stand');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select governance.nominate('b1000000-0000-0000-0000-000000000002', 'Statement') $$,
  '42501', null, 'Elections Committee members cannot stand');

select lives_ok(
  $$ select governance.decide_candidate(id, true) from governance.candidates $$,
  'The Committee approves the candidates'
);

-- Voting opens on the list frozen at notice.
select pg_temp.logout();
update governance.elections
set nominations_close_at = now() - interval '2 minutes', voting_opens_at = now() - interval '1 minute'
where id = 'e1000000-0000-0000-0000-000000000001';
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1');
select is(governance.open_voting('e1000000-0000-0000-0000-000000000001'), 5,
  'Voting opens for the five people on the voter list');

select throws_ok(
  $$ select pg_temp.vote(pg_temp.voter(5), jsonb_build_array(pg_temp.candidate(1)), '[]') $$,
  '42501', null, 'Someone not on the voter list cannot vote'
);
select throws_ok(
  $$ select pg_temp.vote(pg_temp.voter(1), '["RON"]', '[]') $$,
  '22023', null, 'RON is offered only on uncontested races'
);
select throws_ok(
  $$ select pg_temp.vote(pg_temp.voter(1), jsonb_build_array(pg_temp.candidate(3)), '[]') $$,
  '22023', null, 'A candidate from another race is refused'
);

-- President: v1, v2, v4 stand (3 rounds max). Treasurer: v3 alone, with RON.
select lives_ok($$ select pg_temp.vote(pg_temp.voter(1), jsonb_build_array(pg_temp.candidate(1)),
  jsonb_build_array(pg_temp.candidate(3))) $$, 'A Voting Member casts a ranked ballot');
select pg_temp.vote(pg_temp.voter(2), jsonb_build_array(pg_temp.candidate(2), pg_temp.candidate(1)), '["RON"]');
select pg_temp.vote(pg_temp.voter(3), jsonb_build_array(pg_temp.candidate(4), pg_temp.candidate(2)),
  jsonb_build_array(pg_temp.candidate(3)));
select pg_temp.vote(pg_temp.voter(4), jsonb_build_array(pg_temp.candidate(4), pg_temp.candidate(1)), '["RON"]');
select pg_temp.vote('00000000-0000-0000-0000-0000000000e1', jsonb_build_array(pg_temp.candidate(1)), '["RON"]');

select throws_ok(
  $$ select pg_temp.vote(pg_temp.voter(1), jsonb_build_array(pg_temp.candidate(2)), '[]') $$,
  '23505', null, 'A voter cannot vote twice'
);

-- B6.7: online voting needs an AUIB account, even for someone on the list.
select pg_temp.logout();
select pg_temp.make_user('00000000-0000-0000-0000-00000000b0f1', 'outside@example.com', 'Outside');
insert into governance.voters (election_id, user_id)
values ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000b0f1');
select throws_ok(
  $$ select pg_temp.vote('00000000-0000-0000-0000-00000000b0f1', jsonb_build_array(pg_temp.candidate(1)), '[]') $$,
  '42501', null, 'An account outside @auib.edu.iq cannot vote online'
);

-- Unlinkability: no client role can read ballots, and receipts are private.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select * from governance.ballots $$, '42501', null,
  'The Elections Committee cannot read ballots');
select is((select count(*) from governance.ballot_receipts)::integer, 1,
  'The Committee sees only its own receipt, not who voted');
select is((select voted from governance.turnout('e1000000-0000-0000-0000-000000000001')), 5,
  'Turnout is available without names');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok($$ select * from governance.ballots $$, '42501', null, 'The President cannot read ballots');

-- Count after close.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select governance.count_election('e1000000-0000-0000-0000-000000000001') $$,
  '22023', null, 'Ballots are not counted before polls close');
select pg_temp.logout();
update governance.elections set voting_closes_at = now() - interval '1 second'
where id = 'e1000000-0000-0000-0000-000000000001';
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1');
select lives_ok($$ select governance.count_election('e1000000-0000-0000-0000-000000000001') $$,
  'The Committee counts after close');

select is(
  (select winner_candidate_id::text from governance.election_results
   where position_id = 'b1000000-0000-0000-0000-000000000001'),
  pg_temp.candidate(1),
  'Ranked choice elects the candidate with a majority after transfers'
);
select is(
  (select jsonb_array_length(rounds) from governance.election_results
   where position_id = 'b1000000-0000-0000-0000-000000000001'),
  2,
  'Results store each round'
);
select ok(
  (select ron_won from governance.election_results where position_id = 'b1000000-0000-0000-0000-000000000002'),
  'RON can win an uncontested race'
);

-- B6.11: ballot data is kept for one year, then deleted; results stay.
select pg_temp.logout();
select throws_ok($$ delete from governance.ballots $$, '42501', null,
  'Ballots cannot be deleted inside the year');
select is(private.purge_expired_ballots(), 0, 'The yearly purge leaves recent ballots alone');
update governance.elections
set nominations_open_at = nominations_open_at - interval '13 months',
  nominations_close_at = nominations_close_at - interval '13 months',
  voting_opens_at = voting_opens_at - interval '13 months',
  voting_closes_at = voting_closes_at - interval '13 months'
where id = 'e1000000-0000-0000-0000-000000000001';
select is(private.purge_expired_ballots(), 5, 'Ballots older than a year are deleted');
select is(
  (select count(*)::integer from governance.election_results where election_id = 'e1000000-0000-0000-0000-000000000001'),
  2, 'The published results are kept'
);

select * from finish();
rollback;
