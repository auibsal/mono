-- Co-editing rooms (Supabase Realtime): only people who may edit the record
-- join its channel; app tokens and unknown rooms never do.
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

select plan(7);

select pg_temp.make_user('00000000-0000-0000-0000-0000000000f1', 'editor-rt@auib.edu.iq');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000f2', 'member-rt@auib.edu.iq');
select pg_temp.grant_role('00000000-0000-0000-0000-0000000000f1', 'communications_lead');

insert into content.news_posts (id, slug, title_en, title_ar)
values ('00000000-0000-0000-0000-00000000b001', 'room-test', 'Room test', 'اختبار');

select ok(
  exists (select 1 from pg_policy p where p.polrelid = 'realtime.messages'::regclass
    and p.polname = 'Editors receive their record''s room'),
  'Realtime messages are guarded by the room policy');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000f1');
select ok(private.can_edit_room('sal:news:00000000-0000-0000-0000-00000000b001'),
  'A content editor joins the news post''s room');
select ok(not private.can_edit_room('sal:news:00000000-0000-0000-0000-00000000b999'),
  'No room for a record that does not exist');
select ok(not private.can_edit_room('sal:submission:00000000-0000-0000-0000-00000000b001'),
  'No room for kinds that are not co-edited (blind submissions)');
select ok(not private.can_edit_room('anything'), 'Malformed topics are refused');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000f2');
select ok(not private.can_edit_room('sal:news:00000000-0000-0000-0000-00000000b001'),
  'A member without content.manage stays out');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000f1',
  '{"client_id": "00000000-0000-0000-0000-00000000a001"}');
select ok(not private.can_edit_room('sal:news:00000000-0000-0000-0000-00000000b001'),
  'Third-party app tokens never join a room');

select * from finish();
rollback;
