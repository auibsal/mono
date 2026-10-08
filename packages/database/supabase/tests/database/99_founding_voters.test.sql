-- Founding voters: the first N verified Members vote without two activities
-- until the founding year ends; Honorary and Alumni Members never do.
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

select plan(6);

update core.settings set value = '2' where key = 'membership.founding_voters';

select pg_temp.make_user('00000000-0000-0000-0000-0000000000c1', 'one@auib.edu.iq', 'One');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000c2', 'two@auib.edu.iq', 'Two');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000c3', 'three@auib.edu.iq', 'Three');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000c0', 'zero@auib.edu.iq', 'Honorary');
-- Same join date in this transaction: the tie falls to the id, so c0 would
-- come first if Honorary Members counted.
update membership.memberships set tier = 'honorary' where user_id = '00000000-0000-0000-0000-0000000000c0';

select ok(private.is_voting_member('00000000-0000-0000-0000-0000000000c1'),
  'The first Member votes without activities');
select ok(private.is_voting_member('00000000-0000-0000-0000-0000000000c2'),
  'So does the second');
select ok(not private.is_voting_member('00000000-0000-0000-0000-0000000000c3'),
  'The third needs two activities');
select ok(not private.is_voting_member('00000000-0000-0000-0000-0000000000c0'),
  'An Honorary Member neither votes nor takes a founding place');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000c1');
select ok((select founding_voter from membership.my_status()),
  'The Home status says why a founding Member votes');

select pg_temp.logout();
update core.settings set value = to_jsonb((current_date - 1)::text)
where key = 'membership.founding_voters_until';
select ok(not private.is_voting_member('00000000-0000-0000-0000-0000000000c1'),
  'After the founding year, the two-activity rule applies to everyone');

select * from finish();
rollback;
