-- Outbox dispatch and scheduled jobs, driven from the database.
--
-- • Every core.outbox insert asks apps/api to process the row at once
--   (pg_net); a job every ten minutes drains anything left over (retries).
-- • Hourly: sync the AUIB public calendar into core.external_events.
-- • Every ten minutes: publish what is scheduled (private.publish_scheduled).
-- • Daily: queue reminders and notices (private.daily_notices), deduplicated
--   against the outbox so a re-run sends nothing twice.
--
-- The API's address is the private setting `platform.api_url`; the bearer
-- tokens live in Vault (`outbox_webhook_secret`, `cron_secret`), set per
-- environment and never in this repository. Without them, nothing is sent:
-- local stacks and CI stay quiet.

create extension if not exists pg_net;
create extension if not exists pg_cron;

insert into core.settings (key, value, is_public, description) values
  ('platform.api_url', 'null', false,
    'Base URL of apps/api, called by the outbox trigger and scheduled jobs.')
on conflict (key) do nothing;

-- ── Calling the API ─────────────────────────────────────────────────────────

create function private.vault_secret(secret_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;

revoke all on function private.vault_secret(text) from public, anon, authenticated;

-- POSTs JSON to apps/api with a bearer token from Vault. Returns the pg_net
-- request id, or null when the URL or the secret is not configured.
create function private.call_api(path text, body jsonb, secret_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text := private.setting('platform.api_url') #>> '{}';
  token text := private.vault_secret(secret_name);
begin
  if base is null or base = '' or token is null then
    return null;
  end if;
  return net.http_post(
    url := rtrim(base, '/') || path,
    body := body,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || token
    ),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function private.call_api(text, jsonb, text) from public, anon, authenticated;

create function private.after_outbox_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.call_api('/hooks/outbox', jsonb_build_object('id', new.id),
    'outbox_webhook_secret');
  return null;
end;
$$;

create trigger after_outbox_insert after insert on core.outbox
  for each row execute function private.after_outbox_insert();

-- Who holds a permission for a scope (or globally), for notices. Service
-- role only: it names role holders.
create function access.permission_holders(
  permission text,
  scope_type text default 'global',
  scope_id uuid default null
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct a.user_id
  from access.role_assignments a
  join access.role_permissions rp on rp.role = a.role
  where rp.permission = permission_holders.permission
    and a.starts_at <= now()
    and (a.ends_at is null or a.ends_at > now())
    and (
      a.scope_type = 'global'
      or (a.scope_type = permission_holders.scope_type
        and a.scope_id = permission_holders.scope_id)
    );
$$;

revoke all on function access.permission_holders(text, text, uuid) from public, anon, authenticated;
grant execute on function access.permission_holders(text, text, uuid) to service_role;

-- ── External calendars (AUIB) ───────────────────────────────────────────────

create table core.external_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('auib')),
  uid text not null check (char_length(uid) between 1 and 500),
  title text not null check (char_length(title) between 1 and 500),
  location text check (char_length(location) <= 500),
  url text check (char_length(url) <= 2048),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  synced_at timestamptz not null default now(),
  unique (source, uid),
  check (ends_at is null or ends_at >= starts_at)
);

create index external_events_starts_at_idx on core.external_events (starts_at);

alter table core.external_events enable row level security;

-- The AUIB calendar is public; members see it next to the Society's events.
create policy "Anyone reads external events"
  on core.external_events for select to anon, authenticated using (true);

grant select on core.external_events to anon, authenticated;
grant all on core.external_events to service_role;

-- ── Scheduled publishing ────────────────────────────────────────────────────
-- Replaces the version in 20261004000800: there, one scheduled piece whose
-- author had not signed the agreement made the publish trigger raise and
-- stopped every other item from going out.

create or replace function private.publish_scheduled()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer := 0;
  n integer;
begin
  update content.news_posts set status = 'published', published_at = publish_at
  where status = 'scheduled' and publish_at <= now();
  get diagnostics n = row_count; total := total + n;

  update journal.issues set status = 'published', published_at = publish_at
  where status = 'scheduled' and publish_at <= now();
  get diagnostics n = row_count; total := total + n;

  -- A piece without a signed agreement stays scheduled (the publish
  -- trigger refuses it); the others go out.
  update journal.pieces p set status = 'published', published_at = p.publish_at
  where p.status = 'scheduled' and p.publish_at <= now()
    and (p.submission_id is null or exists (
      select 1 from journal.agreements a where a.submission_id = p.submission_id
    ));
  get diagnostics n = row_count; total := total + n;

  return total;
end;
$$;

revoke all on function private.publish_scheduled() from public, anon, authenticated;

-- ── Daily notices ───────────────────────────────────────────────────────────

-- Queues a notice unless the same one was queued within `within`.
create function private.enqueue_once(kind text, payload jsonb, within interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from core.outbox o
    where o.kind = enqueue_once.kind and o.payload = enqueue_once.payload
      and o.created_at > now() - within
  ) then
    return false;
  end if;
  perform private.enqueue(kind, payload);
  return true;
end;
$$;

revoke all on function private.enqueue_once(text, jsonb, interval) from public, anon, authenticated;

create function private.daily_notices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued integer := 0;
  r record;
begin
  -- Events tomorrow (Baghdad): a reminder to everyone booked.
  for r in
    select e.id as event_id, v.user_id
    from events.events e
    join events.rsvps v on v.event_id = e.id and v.status = 'confirmed'
    where e.status = 'published'
      and (e.starts_at at time zone 'Asia/Baghdad')::date
        = (now() at time zone 'Asia/Baghdad')::date + 1
  loop
    if private.enqueue_once('events.reminder',
         jsonb_build_object('event_id', r.event_id, 'user_id', r.user_id), interval '2 days') then
      queued := queued + 1;
    end if;
  end loop;

  -- Accepted work with no signed agreement after three days: weekly reminder.
  for r in
    select s.id as submission_id, s.author_id as user_id
    from journal.submissions s
    join journal.blind_keys k on k.submission_id = s.id
    join journal.decisions d on d.blind_entry_id = k.blind_entry_id
    where s.status = 'accepted'
      and d.decided_at < now() - interval '3 days'
      and not exists (select 1 from journal.agreements a where a.submission_id = s.id)
  loop
    if private.enqueue_once('journal.agreement_reminder',
         jsonb_build_object('submission_id', r.submission_id, 'user_id', r.user_id), interval '7 days') then
      queued := queued + 1;
    end if;
  end loop;

  -- Roles ending within seven days: one notice.
  for r in
    select a.id as assignment_id, a.user_id
    from access.role_assignments a
    where a.ends_at between now() and now() + interval '7 days'
  loop
    if private.enqueue_once('access.role_ending',
         jsonb_build_object('assignment_id', r.assignment_id, 'user_id', r.user_id), interval '30 days') then
      queued := queued + 1;
    end if;
  end loop;

  -- Removal requests past their 24 hours: tell the managers again, daily.
  for r in
    select q.id as request_id, q.programme_id
    from programmes.removal_requests q
    where q.status in ('open', 'in_progress') and q.due_at < now()
  loop
    if private.enqueue_once('programmes.removal_overdue',
         jsonb_build_object('request_id', r.request_id, 'programme_id', r.programme_id), interval '20 hours') then
      queued := queued + 1;
    end if;
  end loop;

  return queued;
end;
$$;

revoke all on function private.daily_notices() from public, anon, authenticated;

-- ── Schedules ───────────────────────────────────────────────────────────────

select cron.schedule('sal-outbox-drain', '*/10 * * * *',
  $$ select private.call_api('/hooks/outbox', '{"drain": true}'::jsonb, 'outbox_webhook_secret') $$);
select cron.schedule('sal-calendar-sync', '7 * * * *',
  $$ select private.call_api('/cron/calendar-sync', '{}'::jsonb, 'cron_secret') $$);
select cron.schedule('sal-publish', '*/10 * * * *',
  $$ select private.publish_scheduled() $$);
-- 04:45 UTC is 7:45 AM in Baghdad.
select cron.schedule('sal-daily', '45 4 * * *',
  $$ select private.daily_notices() $$);
