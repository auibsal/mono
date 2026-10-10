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

select plan(14);

select is(private.call_api('/hooks/outbox', '{}'::jsonb, 'outbox_webhook_secret'), null,
  'Without platform.api_url nothing is called');

select lives_ok(
  $$ select private.enqueue('test.kind', '{"a": 1}'::jsonb) $$,
  'Queuing still works when dispatch is not configured'
);

select is((select count(*)::integer from cron.job where jobname like 'sal-%'), 7,
  'The seven scheduled jobs exist');

-- Scheduled publishing.
insert into content.news_posts (slug, title_en, title_ar, status, publish_at) values
  ('due', 'Due', 'حان', 'scheduled', now() - interval '1 minute'),
  ('later', 'Later', 'لاحقاً', 'scheduled', now() + interval '1 day');
select is(private.publish_scheduled(), 1, 'Only what is due is published');
select is((select status from content.news_posts where slug = 'later'), 'scheduled',
  'Future posts wait');

-- Revalidation: nothing due queues nothing; a pending one is not doubled.
update core.outbox set processed_at = now() where processed_at is null;
select is(private.publish_scheduled(), 0, 'Nothing more is due');
select is((select count(*)::integer from core.outbox where kind = 'revalidate' and processed_at is null), 0,
  'A publish run with nothing due queues no revalidation');
update content.news_posts set title_en = 'Due (edited)' where slug = 'due';
update content.news_posts set title_en = 'Due (edited again)' where slug = 'due';
select is((select count(*)::integer from core.outbox where kind = 'revalidate' and processed_at is null), 1,
  'Two edits before dispatch queue one revalidation');

-- Daily notices are not queued twice.
select is(private.enqueue_once('test.once', '{"x": 1}'::jsonb, interval '1 day'), true,
  'A new notice is queued');
select is(private.enqueue_once('test.once', '{"x": 1}'::jsonb, interval '1 day'), false,
  'The same notice is not queued again');

select pg_temp.make_user('00000000-0000-0000-0000-0000000000b1', 'member@auib.edu.iq');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ select private.vault_secret('cron_secret') $$,
  '42501', null, 'Members cannot read Vault secrets'
);
select throws_ok(
  $$ select private.call_api('/x', '{}'::jsonb, 'cron_secret') $$,
  '42501', null, 'Members cannot call the API through the database'
);

select pg_temp.logout();
insert into core.external_events (source, uid, title, starts_at)
values ('auib', 'evt-1@auib.edu.iq', 'Fall break', now() + interval '3 days');

select pg_temp.login_anon();
select is((select count(*)::integer from core.external_events), 1,
  'Anyone reads the AUIB calendar');
select throws_ok(
  $$ insert into core.external_events (source, uid, title, starts_at)
     values ('auib', 'x', 'Fake', now()) $$,
  '42501', null, 'Nobody writes it but the sync'
);

select * from finish();
rollback;
