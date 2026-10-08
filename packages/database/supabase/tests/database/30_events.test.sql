-- Events: members-only visibility, RSVP capacity and waitlist promotion,
-- check-ins creating activity records.
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

select plan(20);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000f1', 'founder@auib.edu.iq', 'Founder');
select access.bootstrap_founder('founder@auib.edu.iq');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'one@auib.edu.iq', 'One');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'two@auib.edu.iq', 'Two');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a3', 'three@auib.edu.iq', 'Three');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000b1', 'guest@gmail.com', 'Guest');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000c1', 'staff@auib.edu.iq', 'Staff');

insert into events.events (id, slug, programme_id, title_en, title_ar, starts_at, members_only, capacity, status) values
  ('e0000000-0000-0000-0000-000000000001', 'open-pages', (select id from core.programmes where slug = 'open-pages'),
    'Open Pages', 'صفحات مفتوحة', now() + interval '3 days', false, 2, 'published'),
  ('e0000000-0000-0000-0000-000000000002', 'members-majlis', (select id from core.programmes where slug = 'majlis'),
    'Members Majlis', 'مجلس الأعضاء', now() + interval '4 days', true, null, 'published'),
  ('e0000000-0000-0000-0000-000000000003', 'draft-night', (select id from core.programmes where slug = 'majlis'),
    'Draft', 'مسودة', now() + interval '5 days', false, null, 'draft');

-- ── Visibility ──────────────────────────────────────────────────────────────

select pg_temp.login_anon();
select is((select array_agg(slug order by slug) from events.events), array['open-pages'],
  'Anonymous visitors see only published public events');
select is(
  (select count(*) from content.search('Majlis'))::integer, 0,
  'Search never returns members-only events'
);
select is(events.confirmed_count('e0000000-0000-0000-0000-000000000002'), 0,
  'Counts for members-only events are hidden from visitors');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select is((select array_agg(slug order by slug) from events.events), array['open-pages'],
  'Unverified accounts do not see members-only events');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select is((select array_agg(slug order by slug) from events.events), array['members-majlis', 'open-pages'],
  'Members see members-only events but not drafts');
select throws_ok(
  $$ insert into events.events (slug, title_en, title_ar, starts_at) values ('x', 'x', 'x', now()) $$,
  '42501', null,
  'Members cannot create events'
);

-- ── RSVP and waitlist ───────────────────────────────────────────────────────

select is(events.rsvp('e0000000-0000-0000-0000-000000000001'), 'confirmed', 'First RSVP is confirmed');
select is(events.rsvp('e0000000-0000-0000-0000-000000000001'), 'already', 'A second RSVP is a no-op');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select is(events.rsvp('e0000000-0000-0000-0000-000000000001'), 'confirmed', 'Second RSVP fills the event');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a3');
select is(events.rsvp('e0000000-0000-0000-0000-000000000001'), 'waitlisted', 'A third RSVP joins the waitlist');
select is(events.waitlist_position('e0000000-0000-0000-0000-000000000001'), 1, 'Waitlist position is 1');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ select events.rsvp('e0000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  'Unverified accounts cannot RSVP'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select events.cancel_rsvp('e0000000-0000-0000-0000-000000000001') $$, 'Cancelling an RSVP');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a3');
select is(
  (select status from events.rsvps where event_id = 'e0000000-0000-0000-0000-000000000001'),
  'confirmed',
  'Cancelling promotes the first person on the waitlist'
);
select ok(
  exists (select 1 from events.rsvps where from_waitlist and event_id = 'e0000000-0000-0000-0000-000000000001'),
  'The promoted RSVP is marked as from the waitlist'
);

select pg_temp.logout();
select ok(
  exists (select 1 from core.outbox where kind = 'events.waitlist_promoted'
    and payload ->> 'user_id' = '00000000-0000-0000-0000-0000000000a3'),
  'Promotion queues an email'
);

-- ── Check-in ────────────────────────────────────────────────────────────────

select pg_temp.login_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  $$ select * from events.check_in('e0000000-0000-0000-0000-000000000001', null, '00000000-0000-0000-0000-0000000000a2') $$,
  '42501', null,
  'People without events.checkin cannot check members in'
);

select pg_temp.logout();
insert into events.event_staff (event_id, user_id) values
  ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000c1');

select is(
  (select already from events.check_in('e0000000-0000-0000-0000-000000000001',
    (select ticket_code from events.rsvps where user_id = '00000000-0000-0000-0000-0000000000a2' and status = 'confirmed'))),
  false,
  'Event staff check a member in by ticket code'
);
select is(
  (select already from events.check_in('e0000000-0000-0000-0000-000000000001', null, '00000000-0000-0000-0000-0000000000a2')),
  true,
  'A second check-in is reported, not duplicated'
);

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select is(
  (select count(*) from membership.activity_records where kind = 'check_in')::integer, 1,
  'A check-in creates exactly one activity record'
);

select * from finish();
rollback;
