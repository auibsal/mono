-- Society documents: public ones readable by everyone, internal ones only
-- by officers who read the internal library, edits by governance managers.
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
select plan(8);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'member-sd@auib.edu.iq', 'A Member');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'director-sd@auib.edu.iq', 'A Director');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a3', 'gs-sd@auib.edu.iq', 'The GS');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a2', 'director');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a3', 'general_secretary');

select pg_temp.login_anon();
select is((select count(*)::int from governance.society_documents where audience = 'public'), 6,
  'Visitors read the six public documents');
select is((select count(*)::int from governance.society_documents where audience = 'internal'), 0,
  'but never the internal ones');
select ok((select body_en like '%<strong>6.6</strong> While the Society is small%' from governance.society_documents where slug = 'constitution'),
  'The Constitution is there as text');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from governance.society_documents where audience = 'internal'), 0,
  'A member does not read the internal documents');
update governance.society_documents set title_en = 'Changed' where slug = 'constitution';
select is((select title_en from governance.society_documents where slug = 'constitution'), 'The Constitution',
  'nor edits any document');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from governance.society_documents where audience = 'internal'), 4,
  'Officers who read the internal library read the internal documents');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a3');
select lives_ok(
  $$ update governance.society_documents set body_en = body_en || '<p>Amended.</p>' where slug = 'bylaws' $$,
  'The General Secretary edits a document in the Nexus'
);
select is((select updated_by from governance.society_documents where slug = 'bylaws'),
  '00000000-0000-0000-0000-0000000000a3'::uuid, 'and is recorded as its last editor');

select * from finish();
rollback;
