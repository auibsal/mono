-- Notion sync: the link table is for officers, and only the service role
-- may map a Notion editor to a publisher or read the officer directory.
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

select plan(9);

select pg_temp.make_user('00000000-0000-0000-0000-00000000e001', 'events.lead@auib.edu.iq', 'Events Lead');
select pg_temp.make_user('00000000-0000-0000-0000-00000000e002', 'member@auib.edu.iq', 'Member');
select pg_temp.make_user('00000000-0000-0000-0000-00000000e003', 'president@auib.edu.iq', 'President');
select pg_temp.grant_role('00000000-0000-0000-0000-00000000e001', 'events_lead');
select pg_temp.grant_role('00000000-0000-0000-0000-00000000e003', 'president');

insert into core.notion_links (notion_page_id, kind, record_key)
values ('0123456789abcdef0123456789abcdef', 'event', gen_random_uuid()::text);

select pg_temp.login_as('00000000-0000-0000-0000-00000000e002');
select is((select count(*) from core.notion_links), 0::bigint, 'a member sees no Notion links');
select throws_ok(
  $$ select access.notion_publisher('events.lead@auib.edu.iq', 'events.manage') $$,
  '42501', null, 'members cannot map Notion editors to publishers'
);
select throws_ok(
  $$ select * from access.officer_directory() $$,
  '42501', null, 'members cannot read the officer directory'
);

select pg_temp.login_as('00000000-0000-0000-0000-00000000e001');
select is((select count(*) from core.notion_links), 1::bigint, 'the Events Lead sees Notion links');
select throws_ok(
  $$ insert into core.notion_links (notion_page_id, kind, record_key) values ('fedcba9876543210fedcba9876543210', 'news', 'x') $$,
  '42501', null, 'officers cannot write Notion links'
);

select pg_temp.logout();
set local role service_role;
select is(
  access.notion_publisher('Events.Lead@auib.edu.iq', 'events.manage'),
  '00000000-0000-0000-0000-00000000e001'::uuid,
  'the Events Lead may publish events from Notion (email matched without case)'
);
select is(
  access.notion_publisher('member@auib.edu.iq', 'events.manage'),
  null,
  'a member may not'
);
select is(
  access.notion_publisher('president@auib.edu.iq', 'content.manage'),
  null,
  'a two-step role counts only with a verified second factor'
);
select ok(
  exists (
    select 1 from access.officer_directory()
    where email = 'events.lead@auib.edu.iq' and 'Events Lead' = any (roles)
  ) and not exists (select 1 from access.officer_directory() where email = 'member@auib.edu.iq'),
  'the officer directory lists role holders only'
);

select * from finish();
rollback;
