-- Fixes from the Supabase security advisor (Oct 9, 2026).
--
-- 1. "Public bucket allows listing" (storage.media). The media bucket is
--    public: files are served by URL without any policy. The broad select
--    policy only let anyone list every file in it, avatars included. Reading
--    object rows is now limited to the people who may remove them (Storage's
--    remove needs select and delete): publishers, and members for their own
--    avatar folder.
drop policy "Anyone reads public media" on storage.objects;

create policy "Publishers read media objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and (
      (select access.has_permission_anywhere('content.manage'))
      or (select access.has_permission_anywhere('journal.publish'))
    )
  );

create policy "Users read their own avatar objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- 2. "RLS policy always true" (programmes.shift_signups). The manager update
--    policy checked nothing on the new row. Only `status` is updatable, so no
--    row could move, but the check now matches the read rule.
alter policy "Programme managers update sign-ups"
  on programmes.shift_signups
  with check (exists (
    select 1 from programmes.shifts s join programmes.rotas r on r.id = s.rota_id
    where s.id = shift_id
      and (select access.has_permission('programmes.manage', 'programme', r.programme_id))
  ));
