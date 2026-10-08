-- Revalidation without the noise. Statement triggers fire even when an
-- update touches no rows, so the ten-minute publish job queued three
-- revalidations every run (about 430 a day) with nothing published.
--
-- 1. publish_scheduled() updates a table only when something is due.
-- 2. A revalidation that is already queued and not yet sent is not queued
--    again: one call refreshes the same tags.

create or replace function private.queue_revalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tags jsonb := jsonb_build_object('tags', to_jsonb(tg_argv));
begin
  if not exists (
    select 1 from core.outbox o
    where o.kind = 'revalidate' and o.processed_at is null and o.payload = tags
  ) then
    perform private.enqueue('revalidate', tags);
  end if;
  return null;
end;
$$;

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
  if exists (
    select 1 from content.news_posts
    where status = 'scheduled' and publish_at <= now()
  ) then
    update content.news_posts set status = 'published', published_at = publish_at
    where status = 'scheduled' and publish_at <= now();
    get diagnostics n = row_count; total := total + n;
  end if;

  if exists (
    select 1 from journal.issues
    where status = 'scheduled' and publish_at <= now()
  ) then
    update journal.issues set status = 'published', published_at = publish_at
    where status = 'scheduled' and publish_at <= now();
    get diagnostics n = row_count; total := total + n;
  end if;

  -- A piece without a signed agreement stays scheduled (the publish
  -- trigger refuses it); the others go out.
  if exists (
    select 1 from journal.pieces p
    where p.status = 'scheduled' and p.publish_at <= now()
      and (p.submission_id is null or exists (
        select 1 from journal.agreements a where a.submission_id = p.submission_id
      ))
  ) then
    update journal.pieces p set status = 'published', published_at = p.publish_at
    where p.status = 'scheduled' and p.publish_at <= now()
      and (p.submission_id is null or exists (
        select 1 from journal.agreements a where a.submission_id = p.submission_id
      ));
    get diagnostics n = row_count; total := total + n;
  end if;

  return total;
end;
$$;

revoke all on function private.publish_scheduled() from public, anon, authenticated;
revoke all on function private.queue_revalidation() from public, anon, authenticated;

-- Processed outbox rows older than 30 days are history nobody reads.
create function private.prune_outbox()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from core.outbox
    where processed_at is not null and processed_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke all on function private.prune_outbox() from public, anon, authenticated;

-- 05:30 UTC is 8:30 AM in Baghdad.
select cron.schedule('sal-outbox-prune', '30 5 * * *', $$ select private.prune_outbox() $$);
