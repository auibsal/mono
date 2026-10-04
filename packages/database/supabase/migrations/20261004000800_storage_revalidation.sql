-- Storage buckets and their policies, and revalidation of the public site.
--
-- Private: submissions, receipts, library. Clients never read these
-- directly: apps/api issues short-lived signed URLs after checking access.
-- Public: media (published images, issue PDFs, document PDFs).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('submissions', 'submissions', false, 26214400, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]),
  ('receipts', 'receipts', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']),
  ('library', 'library', false, 52428800, null),
  ('media', 'media', true, 26214400, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'
  ]);

-- submissions/<submission id>/<random>.<ext>: the author uploads into a
-- submission of their own that is still in intake. No client reads.
create policy "Authors upload files to their own submissions"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and exists (
      select 1 from journal.submissions s
      where s.id::text = (storage.foldername(name))[1]
        and s.author_id = (select auth.uid())
        and (s.status = 'received' or (s.status = 'intake_check' and s.intake_returned_at is not null))
    )
  );

create policy "Authors remove files from their own submissions in intake"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'submissions'
    and exists (
      select 1 from journal.submissions s
      where s.id::text = (storage.foldername(name))[1]
        and s.author_id = (select auth.uid())
        and (s.status = 'received' or (s.status = 'intake_check' and s.intake_returned_at is not null))
    )
  );

-- receipts/<campaign id>/<random>.<ext>
create policy "Charity managers upload receipts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (select access.has_permission(
      'charity.manage', 'campaign', ((storage.foldername(name))[1])::uuid
    ))
  );

-- library/<audience>/<random>.<ext>
create policy "Governance managers upload library documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'library' and (select access.has_permission('governance.manage'))
  );

-- media/<area>/<random>.<ext>: published images and PDFs.
create policy "Anyone reads public media"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'media');

create policy "Publishers upload media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (
      (select access.has_permission_anywhere('content.manage'))
      or (select access.has_permission_anywhere('journal.publish'))
      or (select access.has_permission_anywhere('programmes.manage'))
      or (select access.has_permission_anywhere('events.manage'))
      or (select access.has_permission_anywhere('charity.manage'))
    )
  );

create policy "Publishers replace and remove media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (
      (select access.has_permission_anywhere('content.manage'))
      or (select access.has_permission_anywhere('journal.publish'))
    )
  );

-- Avatars live in media/avatars/<user id>/…, written by the user.
create policy "Users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "Users remove their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- ── Revalidation ────────────────────────────────────────────────────────────
-- Changes to publish-relevant rows queue `revalidate` with cache tags;
-- apps/api forwards them to apps/web's revalidation route.

create function private.queue_revalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue('revalidate', jsonb_build_object('tags', to_jsonb(tg_argv)));
  return null;
end;
$$;

create trigger revalidate after insert or update or delete on events.events
  for each statement execute function private.queue_revalidation('events');
create trigger revalidate after insert or update or delete on journal.issues
  for each statement execute function private.queue_revalidation('journal');
create trigger revalidate after insert or update or delete on journal.pieces
  for each statement execute function private.queue_revalidation('journal');
create trigger revalidate after insert or update or delete on journal.piece_bodies
  for each statement execute function private.queue_revalidation('journal');
create trigger revalidate after insert or update or delete on journal.contributors
  for each statement execute function private.queue_revalidation('journal');
create trigger revalidate after insert or update or delete on journal.calls
  for each statement execute function private.queue_revalidation('journal');
create trigger revalidate after insert or update or delete on content.news_posts
  for each statement execute function private.queue_revalidation('news');
create trigger revalidate after insert or update or delete on content.pages
  for each statement execute function private.queue_revalidation('news');
create trigger revalidate after insert or update or delete on content.homepage_slots
  for each statement execute function private.queue_revalidation('news', 'events', 'journal');
create trigger revalidate after insert or update or delete on content.announcements
  for each statement execute function private.queue_revalidation('news');
create trigger revalidate after insert or update or delete on charity.campaigns
  for each statement execute function private.queue_revalidation('charity');
create trigger revalidate after insert on charity.ledger_signoffs
  for each statement execute function private.queue_revalidation('charity');
create trigger revalidate after insert or update or delete on charity.impact_metrics
  for each statement execute function private.queue_revalidation('charity');
create trigger revalidate after insert or update or delete on charity.receipts
  for each statement execute function private.queue_revalidation('charity');
create trigger revalidate after insert or update or delete on charity.partners
  for each statement execute function private.queue_revalidation('charity');
create trigger revalidate after insert or update or delete on programmes.episodes
  for each statement execute function private.queue_revalidation('programmes');
create trigger revalidate after insert or update or delete on programmes.reels
  for each statement execute function private.queue_revalidation('programmes');
create trigger revalidate after update of status on programmes.six_words
  for each statement execute function private.queue_revalidation('programmes');
create trigger revalidate after insert or update or delete on core.programmes
  for each statement execute function private.queue_revalidation('programmes');
create trigger revalidate after insert or update or delete on governance.resolutions
  for each statement execute function private.queue_revalidation('documents');
create trigger revalidate after insert or update or delete on access.role_assignments
  for each statement execute function private.queue_revalidation('about');

-- Scheduled publishing: pieces, issues and news with publish_at in the past
-- become published. Run by apps/api cron (and safe to call any time).
create function private.publish_scheduled()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := 0;
  m integer;
begin
  update journal.issues set status = 'published', published_at = publish_at
  where status = 'scheduled' and publish_at <= now();
  get diagnostics m = row_count; n := n + m;
  update journal.pieces set status = 'published', published_at = publish_at
  where status = 'scheduled' and publish_at <= now();
  get diagnostics m = row_count; n := n + m;
  update content.news_posts set status = 'published', published_at = publish_at
  where status = 'scheduled' and publish_at <= now();
  get diagnostics m = row_count; n := n + m;
  return n;
end;
$$;

revoke execute on function private.publish_scheduled() from anon, authenticated;
