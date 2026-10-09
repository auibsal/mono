-- Advisor fixes: media objects are not listable by everyone, and the
-- manager update policy on shift sign-ups checks the new row.
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

select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'member-adv@auib.edu.iq');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'comms-adv@auib.edu.iq');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a2', 'communications_lead');

insert into storage.objects (bucket_id, name) values
  ('media', 'news/00000000-0000-0000-0000-00000000f001.jpg'),
  ('media', 'avatars/00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-00000000f002.jpg');

select pg_temp.login_anon();
select is((select count(*)::int from storage.objects where bucket_id = 'media'), 0,
  'Visitors cannot list the media bucket');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select is(
  (select array_agg(name) from storage.objects where bucket_id = 'media'),
  array['avatars/00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-00000000f002.jpg']::text[],
  'A member sees only their own avatar object');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from storage.objects where bucket_id = 'media'), 2,
  'A publisher sees the media objects they may remove');

select pg_temp.logout();
select is(
  (select with_check from pg_policies
   where schemaname = 'programmes' and tablename = 'shift_signups'
     and policyname = 'Programme managers update sign-ups') = 'true',
  false, 'The manager update policy on sign-ups checks the new row');

insert into programmes.rotas (id, programme_id, title_en, title_ar)
select '00000000-0000-0000-0000-00000000c001', id, 'Door team', 'فريق الباب'
from core.programmes where slug = 'side-quest';
insert into programmes.shifts (id, rota_id, role_en, role_ar, starts_at, ends_at, capacity) values
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c001', 'Door', 'الباب',
   now() + interval '1 day', now() + interval '1 day 2 hours', 2);
insert into programmes.shift_signups (shift_id, user_id) values
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-0000000000a1');

select pg_temp.grant_role('00000000-0000-0000-0000-0000000000a2', 'programme_lead', 'programme',
  (select id from core.programmes where slug = 'side-quest'));
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select lives_ok(
  $$ update programmes.shift_signups set status = 'confirmed'
     where user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  'A programme manager still updates a sign-up');
select pg_temp.logout();
select is(
  (select status from programmes.shift_signups where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'confirmed', 'and the change is saved');

select * from finish();
rollback;
